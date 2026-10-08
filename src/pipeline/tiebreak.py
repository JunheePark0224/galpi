"""A third pass for the fields the two passes split on (user 10-06 evening, library re-tag).

splits: the fields where pass A and pass B gave different values — the slot (each pass's slot is the given one when it says
the book fits, else its suggestion, "" = none), a 🍃 axis both passes gave a value for (an axis one pass left empty — null,
비움 — is not a split: it goes to a person; both empty is decided as empty, v3.1 rule 9, 10-07; a no-info mark on a value
is that value), 🎯 keywords (as a set) and way.
third: one more blind pass B — the same v3 check prompt and model (config second_model), the 🍃 axis re-ask included —
as pass "C" (its own Breaker streak). settle: per split field, the value two of the three passes gave; None when all three
differ, when the third left that axis empty, or for the slot unless one of A / B kept the book where it is
(user 10-06: then 2 of 3 decide — stay, or move to the slot both "not fit" votes name; "nowhere" is a person's decision). Only the value is kept from the third pass's free text: the `why` line is
cut like pass B's and copy-checked by the caller (record keeps no YES24 text).
"""
from apply_review import FIELD_OF_TOPIC

from .checks import crossed_to, status_of
from .merge import keyword_hints
from .prompt import AXES, MAX_KEYWORDS, all_keywords, schema, user_message
from .run_daily import _axes_backed, _spend, topic_lists
from .tagger import call, parse

PASS = "C"
# the fields a majority may settle: validated on the gold set 10-06 (3 runs' split pairs + pass C): axes 6/6, way 2/2,
# slot 3/3 settled right; keywords 5/10 — so keyword splits always go to a person
SETTLES = ("slot", *AXES, "way")


def own_slot(rec: dict) -> str:
    return rec["genre"] if rec["entry"] == "leaf" else rec["topic"]


def pass_slot(src: dict, slot: str) -> str:
    return slot if src.get("fits") else (src.get("suggest") or "")


def value(field: str, src: dict, slot: str):
    if field == "slot":
        return pass_slot(src, slot)
    if field in AXES:  # null = 비움; a no-info mark on a value is still that value (v3.1 rule 9, 10-07)
        return (src.get("axes") or {}).get(field)
    if field == "keywords":
        return sorted(src.get("keywords") or [])
    return src.get(field)


def fields_of(entry: str) -> tuple[str, ...]:
    return ("slot", *AXES) if entry == "leaf" else ("slot", "keywords", "way")


def splits(rec: dict) -> list[str]:
    a, b, slot = rec, rec.get("second") or {}, own_slot(rec)
    out = []
    for f in fields_of(rec["entry"]):
        va, vb = value(f, a, slot), value(f, b, slot)
        if f in AXES and (va is None or vb is None):
            continue
        if va != vb:
            out.append(f)
    return out


def settle(rec: dict, third: dict | None, only: tuple[str, ...] | None = None,
           out_of_slot: bool = False) -> dict[str, object]:
    """{split field: the majority value, or None for a person}. `only`: the fields a majority may settle (others None).
    `out_of_slot` (the daily run, route plan 10-08): two passes out of the slot on different slots are settled too when the
    third names one of them; the library re-tag (default) leaves them to a person. "Nowhere" is always a person's."""
    a, b, slot = rec, rec.get("second") or {}, own_slot(rec)
    out = {}
    for f in splits(rec):
        va, vb = value(f, a, slot), value(f, b, slot)
        vc = value(f, third, slot) if third else None
        won = va if vc is not None and vc == va else vb if vc is not None and vc == vb else None
        if f == "slot" and ((slot not in (va, vb) and not out_of_slot) or not won):
            won = None
        out[f] = None if only is not None and f not in only else won
    return out


def needs_third(rec: dict) -> bool:
    return any(f in SETTLES for f in splits(rec))


def third(client, cfg, vocab: dict, prompts: dict, cand, breaker, ledger: dict) -> dict | None:
    """Pass C's parsed answer (None when the call failed or the answer was unusable). Raises TaggerStop."""
    kept = vocab.get(cand.slot, {}).get("kept", {}) if cand.entry == "target" else {}
    hints = keyword_hints(cand, kept) if kept else []
    user = user_message(cand.entry, cand.slot, cand.title, cand.author, cand.intro, cand.toc, hints)
    raw, used, _ = call(client, cfg.second_model, prompts["check"], user, schema(cand.entry, "check", all_keywords(vocab)),
                        breaker, PASS)
    _spend(ledger, cfg.second_model, used)
    ans = parse(raw, cand.entry, "check", list(kept), lists=topic_lists(vocab)) if raw else None
    if ans is None:
        return None
    return _axes_backed(client, cfg.second_model, prompts["check"], user, cand.entry, raw, ans, PASS, breaker, ledger, None)


def kept_of(ans: dict | None) -> dict | None:
    """What the library file keeps of pass C: the values and signal lines, never the free-text reason."""
    if ans is None:
        return None
    return {k: ans[k] for k in ("fits", "suggest", "suggest_keywords", "axes", "signals", "missing", "keywords", "way") if k in ans}


def applied(rec: dict, third: dict | None, auto_merge: bool, requeued: bool = False) -> dict:
    """A daily record after pass C (route plan 3, 10-08): each split the majority settles (SETTLES, slot `out_of_slot`)
    takes the majority value and is no longer a person's — the record keeps pass C's values (`third`, no free text), what
    was settled (`settled`) and pass A's value where it lost (`a_was`); then its status is sorted again (checks.status_of).
    A slot settled elsewhere in the same 갈래 moves the book (`moved_from`; a 🎯 book takes the keywords its two voters
    share — none left is a person's "keywords"); one in the other 갈래 drops it here with `requeued_to` (run_daily queues
    it), unless it came from the queue (`requeued`) — then the slot stays a person's. The given record is not changed."""
    if third is None:
        return dict(rec)
    out, flags, a_was, settled = {**rec, "third": kept_of(third)}, list(rec.get("flags") or []), {}, {}
    for f, v in settle(rec, third, SETTLES, out_of_slot=True).items():
        if v is None:
            continue
        if f == "slot":
            moved = _slot_move(rec, third, v, requeued)
            if moved is None:
                continue
            out |= moved
            gone = ("fits", "keywords") if "topic" in moved else ("fits",)  # old-topic keywords left with the old topic
            flags = [x for x in flags if x not in gone] + (["keywords"] if moved.get("keywords") == [] else [])
            if "requeued_to" in moved:
                return ({k: x for k, x in out.items() if k != "auto"}
                        | {"flags": flags, "settled": settled | {"slot": v}, "status": "dropped"}
                        | ({"a_was": a_was} if a_was else {}))
        elif f in AXES:
            a_was |= {f: rec["axes"][f]} if rec["axes"][f] != v else {}
            out["axes"] = {**out["axes"], f: v}
        else:
            a_was |= {f: rec[f]} if rec[f] != v else {}
            out[f] = v
        flags = [x for x in flags if x != f]
        settled[f] = v
    status, auto = status_of(flags, rec.get("issues") or [], auto_merge)
    out = {k: x for k, x in out.items() if k != "auto"} | {"flags": flags, "status": status, "settled": settled}
    return out | ({"a_was": a_was} if a_was else {}) | ({"auto": auto} if auto else {})


def _slot_move(rec: dict, third: dict, new: str, requeued: bool) -> dict | None:
    """The fields a majority slot changes: none when it stays; `requeued_to` for the other 갈래 (None — a person's — for a
    book already requeued once); else the new genre / topic, `moved_from`, and a 🎯 book's keywords its voters share."""
    slot = own_slot(rec)
    if new == slot:
        return {}
    out_here = {"fits": False, "suggest": new}
    crossed = crossed_to(rec["entry"], out_here, out_here)
    if crossed:
        return None if requeued else {"requeued_to": crossed}
    if rec["entry"] == "leaf":
        return {"genre": new, "moved_from": slot}
    voters = [v for v in (rec, rec.get("second") or {}, third) if not v.get("fits") and v.get("suggest") == new]
    common = [k for k in voters[0].get("suggest_keywords") or []
              if all(k in (v.get("suggest_keywords") or []) for v in voters)]
    return {"topic": new, "field": FIELD_OF_TOPIC[new], "keywords": common[:MAX_KEYWORDS], "moved_from": slot,
            "keywords_regex": []}  # the hints were the old topic's
