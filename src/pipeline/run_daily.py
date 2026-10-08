"""One day of the pipeline (design 2-1): gaps → candidates → pass A + pass B → checks → additions file + run summary.

Usage (from the checkout):  PYTHONIOENCODING=utf-8 python -m src.pipeline.run_daily [--date YYYY-MM-DD | --batch ID] [--count N]
  --batch: a later run of the same day, `YYYY-MM-DD-2`, `-3` … (pipeline/batch.py); the first batch is the plain date
  --batches: send the calls through the Message Batches API (pipeline/batched.py) — half the price, the same requests and
             records; the run waits for each batch (usually minutes, at most 24 hours), so it is for local runs
Then:                        cd web && npm run books:import && npm test      (the workflow does both, then report.py)
Keys: YES24_API_KEY / ANTHROPIC_API_KEY from the environment (Actions secrets) or the local .env — never printed.
Models and counts come from data/pipeline/config.json (model = pass A, second_model = blind pass B).
Exit 0: done (also "nothing to fill" and "no usable candidates", i.e. YES24 answered but had nothing new); 1 (FAILED):
missing key, YES24 failed, the run stopped before any book was finished, or candidates were found and none could be tagged. Failure rules (design 2-1):
  YES24 gives no candidate and a call failed → `yes24_failed`, no file (so no PR); only the failed API paths are named
  (a call that worked but listed nothing is not a failure: `no_candidates`, exit 0)
  more than MAX_FAILED_SHARE of the books tried failing after MIN_ATTEMPTS books (book-level failures do not trip the breaker)
  → the run stops there as `partial` (or `anthropic_failed` with nothing finished), so a systematic break costs ~10 books,
  not a whole day
  a key is refused (401/403), the model is unknown (404) or the account is the problem (400), or one model's calls fail
  STOP_LIMIT times in a row (tagger.Breaker, one streak per pass) → the run stops there; the books finished before it are
  written as `partial`, and if there are none it is `anthropic_failed` with no file
  nothing to fill → `full`, zero API calls
A split a majority may settle (slot, 🍃 axes, way — tiebreak.SETTLES) gets a third pass (pass C, the same blind check); its
2-of-3 value replaces the person's decision (route plan 10-08). Both passes — or the majority — placing a book in a slot of
the other 갈래 drop it here with `requeued_to` and a requeue.json row; a book back from the queue is not sent on again.
A pass-A one-liner that breaks the form / length / hype / title rules is asked for once more from the same model
(pipeline/one_liner.py); the summary's `one_liner_retries` counts them and their cost (also in `usage` / `cost_usd`).
YES24 text (intro, TOC) lives on the Candidate in memory and goes to the tagger only; the additions file, the summary and
stdout carry our tags and counts. Do not set ANTHROPIC_LOG=debug (the SDK would log request bodies with YES24 text).
Files are keyed by the batch id: additions/<id>.json, and the summary in data/pipeline/runs/<id>.json (git-ignored) and stdout.
Candidates skip every ISBN in books.json and in every additions file — earlier batches of the same day included — except
the requeued ones (data/pipeline/requeue.json, pipeline/requeue.py): they come first, as their new entry and slot, take
their place in the day's count, and leave the file once tagged (the workflow commits it with the additions file).
A local run reuses the YES24 lists cached under data/raw/yes24/ (kept forever; only new searches are fetched), so its candidate
pool can differ from the fresh one CI builds.
"""
import argparse
import json
import os
import sys
import time
from collections import Counter
from dataclasses import dataclass
from datetime import datetime

import collect_candidates
from apply_review import FIELD_OF_TOPIC
from compare_apis import load_env

from . import ADDITIONS, BOOKS, KST, REQUEUE, RUNS, VOCAB
from . import batched, requeue
from .axis_check import retry as retry_axes
from .batch import BatchError, parse as parse_batch
from .candidates import Candidate, find, known_from, yes24_env
from .checks import crossed_to, decide, disagreements, rule_issues
from .config import Config, load_config
from .gaps import plan_day
from .keyword_candidates import excluded_names
from .merge import additions_doc, keyword_hints, record, write_doc
from .one_liner import RetryLog, retry as retry_one_liner
from .prompt import all_keywords, schema, system_prompt, user_message
from .rules_version import rules_version
from .slots import keyword_rule, slot_rule
from .tagger import Breaker, TaggerStop, Usage, call, parse, request


MIN_ATTEMPTS, MAX_FAILED_SHARE = 10, 0.30  # a run whose books keep failing (max_tokens, refusal, invalid answer…) stops here
EMPTY_RESULT = " -> no items"  # collect_candidates.cached_get: the call worked but listed nothing — not a YES24 failure


def load_state() -> tuple[list[dict], dict, list[dict]]:
    books = json.loads(BOOKS.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    additions = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(ADDITIONS.glob("*.json"))]
    return books, vocab, additions


def topic_lists(vocab: dict) -> dict[str, list[str]]:
    """Every 🎯 topic → its closed keyword list. The topics are the app vocab's (keyword_vocab.json → web vocab.json), in
    its order; a topic the pipeline already knows (apply_review.FIELD_OF_TOPIC, 10-05: 마케팅·브랜딩 · 리더십 · 건강·운동 ·
    요리·살림) but the vocab does not have yet follows with no keywords, so its books are still filled (topic target only)."""
    out = {t: list(v.get("kept", {})) for t, v in vocab.items()}
    return out | {t: [] for t in FIELD_OF_TOPIC if t not in out}


def gather(env: dict, wants, vocab: dict, known) -> list[Candidate]:
    out: list[Candidate] = []
    for w in wants:
        rule = keyword_rule(w.slot, w.keyword, vocab[w.slot]["kept"][w.keyword]["pattern"]) if w.keyword else slot_rule(w.slot)
        found = find(env, w, rule, known)
        known = known.plus(found)
        out += found
    return out


def _spend(ledger: dict, model: str, used: Usage) -> None:
    """Add `used` to the run's token ledger (one entry per model). Called after every API call, so a book interrupted by
    a stop still has what it cost counted."""
    ledger[model] = ledger.get(model, Usage()).plus(used)


def tag_one(client, cfg: Config, prompts: dict, vocab: dict, cand: Candidate, breaker: Breaker,
            ledger: dict, retries: RetryLog | None = None, rules: str | None = None,
            axis_retries: RetryLog | None = None, routed: bool = False, requeued: bool = False
            ) -> tuple[dict | None, str]:
    """(record or None, reason). Pass A tags (a one-liner that breaks a rule is asked for once more — one_liner.py), pass B
    checks blind (it writes no one-liner); on a 🍃 book either pass whose axis values its own signal lines do not back is
    asked once more (axis_check.py). Token use goes to `ledger`, one-liner retries also to `retries`, axis re-asks to
    `axis_retries`. Raises TaggerStop. A pass that says the book does not fit names the slot it belongs to (`suggest`).
    The record carries `rules_version`: `rules`, or the label dictionary's version (rules_version.py) when not given.
    `routed` (the daily run — route plan 10-08; the library re-tag and the gold runs keep the two passes' record as it is):
    a split a majority may settle goes to a third pass (`_third_pass`), and both passes naming the same slot of the other 갈래 (checks.crossed_to, 10-08) drop the book here with `requeued_to` — run()
    queues it to be tagged there; a book that came back from the queue (`requeued`) is not sent on again but waits for a person."""
    if not cand.author.strip() or cand.pages <= 0:  # find() never offers one; a book that import would reject costs nothing
        return None, "incomplete_candidate"
    names, hints, user = _book_text(cand, vocab)
    raw_a, used, why = call(client, cfg.model, prompts["tag"], user, schema(cand.entry, "tag", all_keywords(vocab)), breaker, "A")
    _spend(ledger, cfg.model, used)
    left_out = excluded_names(vocab.get(cand.slot, {})) if cand.entry == "target" else []
    lists = topic_lists(vocab)
    a = parse(raw_a, cand.entry, "tag", names, cand.slot, left_out, lists) if raw_a else None
    if a is None:
        return None, why if raw_a is None else "invalid_answer"
    a, used, outcome = retry_one_liner(client, cfg.model, prompts["tag"], user, cand.entry, raw_a, a, cand.title, breaker)
    _spend(ledger, cfg.model, used)
    if retries is not None:
        retries.note(cfg.model, used, outcome)
    a = _axes_backed(client, cfg.model, prompts["tag"], user, cand.entry, raw_a, a, "A", breaker, ledger, axis_retries)
    raw_b, used, why = call(client, cfg.second_model, prompts["check"], user, schema(cand.entry, "check", all_keywords(vocab)), breaker, "B")
    _spend(ledger, cfg.second_model, used)
    b = parse(raw_b, cand.entry, "check", names, lists=lists) if raw_b else None
    if b is None:
        return None, why if raw_b is None else "invalid_answer"
    b = _axes_backed(client, cfg.second_model, prompts["check"], user, cand.entry, raw_b, b, "B", breaker, ledger, axis_retries)
    flags = disagreements(cand.entry, a, b)
    issues = rule_issues(cand.entry, a, cand.title, f"{cand.intro} {cand.toc}", b)
    crossed = routed and not requeued and crossed_to(cand.entry, a, b)
    status, auto = ("dropped", None) if crossed else decide(a, b, flags, issues, cfg.auto_merge, cand.entry)
    rec = record(cand, a, b, flags, issues, status, auto, hints)  # record() blanks any field that copied YES24 text
    rec = _third_pass(client, cfg, prompts, vocab, cand, breaker, ledger, rec, requeued) if routed else rec
    return {**rec, "rules_version": rules or rules_version()}, "ok"


def _book_text(cand: Candidate, vocab: dict) -> tuple[list[str], list[str], str]:
    """(the topic's keyword names, the keyword hints found in the book, the user message both passes get)."""
    kept = vocab.get(cand.slot, {}).get("kept", {}) if cand.entry == "target" else {}  # a new topic may have no list yet
    hints = keyword_hints(cand, kept) if kept else []
    return list(kept), hints, user_message(cand.entry, cand.slot, cand.title, cand.author, cand.intro, cand.toc, hints)


def prefetch(recorder: batched.Recorder, cfg: Config, prompts: dict, vocab: dict, cands: list[Candidate]) -> None:
    """Pass B of every book in the first batch next to pass A (it is blind: its request does not wait on pass A's answer)."""
    for cand in cands:
        if cand.author.strip() and cand.pages > 0:
            user = _book_text(cand, vocab)[2]
            recorder.expect(cand.isbn, request(cfg.second_model, prompts["check"], user, schema(cand.entry, "check", all_keywords(vocab))))


def _third_pass(client, cfg: Config, prompts: dict, vocab: dict, cand: Candidate, breaker: Breaker, ledger: dict,
                rec: dict, requeued: bool) -> dict:
    """The record after pass C when A and B split on a field a majority may settle (tiebreak.py, route plan 3 — 10-08);
    as it is otherwise. Raises TaggerStop."""
    from . import tiebreak  # tiebreak imports this module
    if rec["status"] == "dropped" or not tiebreak.needs_third(rec):
        return rec
    return tiebreak.applied(rec, tiebreak.third(client, cfg, vocab, prompts, cand, breaker, ledger), cfg.auto_merge,
                            requeued)


def _axes_backed(client, model: str, system: str, user: str, entry: str, raw: dict, ans: dict, pass_: str,
                 breaker: Breaker, ledger: dict, log: RetryLog | None) -> dict:
    """A 🍃 pass's answer after at most one axis re-ask (axis_check.retry); a 🎯 answer as it is."""
    if entry != "leaf":
        return ans
    ans, used, outcome = retry_axes(client, model, system, user, raw, ans, pass_, breaker)
    _spend(ledger, model, used)
    if log is not None:
        log.note(model, used, outcome)
    return ans


@dataclass
class Tagged:
    recs: list[dict]
    reasons: Counter
    ledger: dict
    stopped: str | None
    retries: RetryLog
    axis_retries: RetryLog
    sent: list[str]


def tag_all(client, cfg: Config, prompts: dict, vocab: dict, cands: list[Candidate], rules: str,
            requeued: set[str] = frozenset(), batches: bool = False, sleep=time.sleep) -> Tagged:
    """Every candidate through tag_one (routed: third pass, cross-entry requeue), in the run's order. `batches`: in rounds
    through the Message Batches API (batched.py); `requeued`: ISBNs back from requeue.json (not sent on again). Stops on a
    TaggerStop or when too many books fail (MIN_ATTEMPTS / MAX_FAILED_SHARE) — the finished books are kept."""
    recs, reasons, ledger, stopped, breaker, tried, retries = [], Counter(), {}, None, Breaker(), 0, RetryLog()
    axis_retries, sent = RetryLog(), []
    tagger = batched.Recorder() if batches else client
    if batches:
        prefetch(tagger, cfg, prompts, vocab, cands)
    todo = cands
    while todo and not stopped:
        waiting = []
        for cand in todo:
            # one book's use is kept apart and added once it is done: a batched book is run again each round (replays)
            own, own_retries, own_axes, rec, why = {}, RetryLog(), RetryLog(), None, None
            if batches:
                tagger.begin(cand.isbn)
            try:
                rec, why = tag_one(tagger, cfg, prompts, vocab, cand, breaker, own, own_retries, rules, own_axes,
                                   routed=True, requeued=cand.isbn in requeued)
            except batched.Waiting:
                waiting.append(cand)
                continue
            except TaggerStop as err:
                stopped = str(err)
            except Exception as err:  # one odd book must not lose the finished ones; the class name is all that is kept
                rec, why = None, f"error:{type(err).__name__}"
            for m, u in own.items():
                ledger[m] = ledger.get(m, Usage()).plus(u)
            retries.absorb(own_retries)
            axis_retries.absorb(own_axes)
            if stopped:
                break
            reasons[why] += 1
            if rec:
                recs.append(rec)
            if why != "incomplete_candidate":  # that one cost nothing
                tried += 1
            if tried >= MIN_ATTEMPTS and 1 - len(recs) / tried > MAX_FAILED_SHARE:
                top = max((r for r in reasons if r != "ok"), key=reasons.get, default="unknown")
                stopped = f"{tried - len(recs)} of {tried} books failed ({top}) — over {MAX_FAILED_SHARE:.0%}, stopped to save cost"
                break
        if stopped or not waiting:
            break
        try:
            sent.append(batched.send(client, tagger, sleep))
        except TaggerStop as err:
            stopped = str(err)
        todo = waiting
    if batches:  # what the batches answered: a prefetched pass B whose book failed, and books cut off by a stop, too
        ledger = dict(tagger.spent)
    order = {c.isbn: i for i, c in enumerate(cands)}
    recs.sort(key=lambda r: order[r["isbn"]])  # a batched book finishes in its own round; the file keeps the run's order
    return Tagged(recs, reasons, ledger, stopped, retries, axis_retries, sent)


def run(batch: str, cfg: Config, env: dict, client, batches: bool = False, sleep=time.sleep) -> dict:
    """One batch (`batch` = the day, or `<day>-N` for a later run that day). `batches`: send the calls through the Message
    Batches API (batched.py — half the price, results within 24 hours; `sleep` waits between status checks)."""
    date = parse_batch(batch)[0]
    books, vocab, additions = load_state()
    fails_before = len(collect_candidates.FAILURES)
    queued = requeue.load(REQUEUE)
    back, waiting = requeue.candidates(env, queued, vocab) if queued else ([], {})
    wants = plan_day(books, topic_lists(vocab), max(cfg.daily_count - len(back), 0), phase=cfg.target_phase)
    summary = {"date": date, "batch": batch, "model": cfg.model, "second_model": cfg.second_model,
               "target_phase": cfg.target_phase, "wanted": sum(w.n for w in wants) + len(back),
               "slots": [f"{c.slot} (다시 태그) 1" for c in back]
               + [f"{w.slot}{'/' + w.keyword if w.keyword else ''} {w.n}" for w in wants],
               **({"requeue_waiting": waiting} if waiting else {})}
    if not wants and not back:
        return summary | {"status": "full"}
    cands = back + gather(env, wants, vocab, known_from(books, additions).plus(back))
    new_fails = collect_candidates.FAILURES[fails_before:]
    yes24_fail = [f.split(" -> ")[0] for f in new_fails if not f.endswith(EMPTY_RESULT)]  # paths only, never the answer
    summary |= {"candidates": len(cands), "yes24_failures": len(yes24_fail), "yes24_failed_paths": sorted(set(yes24_fail)),
                "yes24_empty": len(new_fails) - len(yes24_fail)}
    if not cands:
        return summary | {"status": "yes24_failed" if yes24_fail else "no_candidates"}
    prompts, rules = {kind: system_prompt(vocab, kind) for kind in ("tag", "check")}, rules_version()
    t = tag_all(client, cfg, prompts, vocab, cands, rules, {c.isbn for c in back}, batches, sleep)
    recs, reasons, ledger, stopped, retries, axis_retries, sent = (t.recs, t.reasons, t.ledger, t.stopped, t.retries,
                                                                  t.axis_retries, t.sent)
    back_isbns = {c.isbn for c in back}
    status = Counter(r["status"] for r in recs)
    summary |= {"tagged": len(recs), "reasons": dict(reasons), "stopped": stopped, "rules_version": rules,
                "picked": status["picked"], "review": status["review"], "reserve": status["reserve"],
                "dropped": status["dropped"], "crossed": sum(bool(r.get("requeued_to")) for r in recs),
                "auto_agreed": sum(r.get("auto") == "ai-agree" for r in recs),
                "flagged": sum(bool(r["flags"]) and r["status"] != "dropped" for r in recs),
                "third_pass": {"books": sum("third" in r for r in recs), "settled": sum(bool(r.get("settled")) for r in recs)},
                "one_liner_retries": retries.summary(),
                "axis_retries": axis_retries.summary(),
                "usage": {m: u.__dict__ for m, u in ledger.items()},
                "cost_usd": round(sum(u.cost(m) for m, u in ledger.items()) * (batched.DISCOUNT if batches else 1), 4),
                **({"batches": {"ids": sent, "discount": batched.DISCOUNT}} if batches else {})}
    if not recs:
        return summary | {"status": "anthropic_failed" if stopped else "no_books"}
    write_doc(ADDITIONS / f"{batch}.json", additions_doc(date, cfg.model, cfg.second_model, recs, batch))
    done = {r["isbn"] for r in recs} & back_isbns
    crossing = [{"isbn": r["isbn"], "to_entry": r["requeued_to"]["entry"], "to_slot": r["requeued_to"]["slot"],
                 "from_batch": batch, "date": date} for r in recs if r.get("requeued_to")]
    if done or crossing:  # a row tagged as the other entry has done its job (a failed one waits for the next batch);
        # a book both passes sent to the other 갈래 goes in for the next batch
        requeue.save(REQUEUE, requeue.added(requeue.without(requeue.load(REQUEUE), done), crossing))
        summary |= {"requeued": sorted(done)} if done else {}
    return summary | {"status": "partial" if stopped else "ok", "file": f"data/processed/additions/{batch}.json"}


# exit 1 for the workflow: `no_books` = candidates were found but not one could be tagged (a systematic break — a changed
# schema, an unparsable answer — that would otherwise look green and burn tokens every day)
FAILED = ("yes24_failed", "anthropic_failed", "no_books")


def anthropic_key() -> str:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    try:
        return load_env().get("ANTHROPIC_API_KEY", "")
    except FileNotFoundError:
        return ""


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="갈피 daily book pipeline")
    ap.add_argument("--date", help="the day (default: today in KST) — the day's first batch")
    ap.add_argument("--batch", help="batch id: YYYY-MM-DD, or YYYY-MM-DD-N for a later run that day")
    ap.add_argument("--count", type=int)
    ap.add_argument("--batches", action="store_true", help="Message Batches API: half the price, waits up to 24 hours")
    args = ap.parse_args(argv)
    batch = args.batch or args.date or datetime.now(KST).date().isoformat()
    try:
        day = parse_batch(batch)[0]
    except BatchError as err:
        ap.error(str(err))
    if args.date and args.batch and args.date != day:
        ap.error(f"--batch {args.batch} is not a batch of --date {args.date}")
    if (ADDITIONS / f"{batch}.json").exists():
        print(f"{batch}: additions file already exists — nothing to do")
        return 0
    cfg, env, key = load_config(count=args.count), yes24_env(), anthropic_key()
    missing = [n for n, v in (("YES24_API_KEY", env.get("YES24_API_KEY")), ("ANTHROPIC_API_KEY", key)) if not v]
    if missing:
        print(f"ERROR: {', '.join(missing)} not set", file=sys.stderr)
        return 1
    import anthropic  # the SDK is only needed for a real run
    summary = run(batch, cfg, env, anthropic.Anthropic(api_key=key, max_retries=2, timeout=60), batches=args.batches)
    RUNS.mkdir(parents=True, exist_ok=True)
    (RUNS / f"{batch}.json").write_text(json.dumps(summary, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 1 if summary["status"] in FAILED else 0


if __name__ == "__main__":
    sys.exit(main())
