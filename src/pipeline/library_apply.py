"""--apply of the v3 library re-tag: the decided values go into the files `npm run books:import` reads.

A book decided without a person (library_review: auto, sample not answered) takes its v3 values — including a slot both
passes (or the third-pass majority) moved it to — and the library's one-liner stays. A book a person answered (the page's download, {answers: {isbn: {…, ok: true}}}) takes the answer, checked like
the review pages' answers (agreement.checked_leaf / apply_review.checked_answer; a pick whose one-liner breaks a rule is
refused). A "person" book without an answer is left as it is. Every written book gets the rules it was tagged under
(`rules_version` of the re-tag entry — "v3.1" for a book re-tagged after the v3.1 rules, else "v3"); when its
values change, the old ones are appended to `history` (so the change can be undone) and an additions record keeps its
pre-review `draft`. An additions book still waiting (review / unreviewed reserve) becomes picked — `auto: "ai-agree"`
when no person answered. A books_v1 book a person drops leaves books_v1.json and is kept in retag/removed.json.
A "다른 갈래로" answer (`status: "requeue"`, 10-07) sends the book to the other entry like the daily review page's
(agreement.requeue_target, pipeline/requeue.py): it leaves its slot — a books_v1 book goes to retag/removed.json, an
additions book becomes `dropped` — with `requeued_to` {entry, slot}, and the tally lists the rows for requeue.json.
A source row whose values are neither the ones the re-tag saw nor the decided ones (edited since) is skipped and named.
Applying the same download again changes nothing.
"""
from apply_review import FIELD_OF_TOPIC, ReviewError, draft_of
from apply_review import checked_answer as checked_target

from .agreement import AUTO, checked_leaf, line_problems, requeue_target
from .library import V1_SOURCE, values_of
from .prompt import AXES

RULES = "v3"
WAITING = ("review", "reserve")


def from_answer(book: dict, ans: dict, kept: dict) -> dict:
    if ans.get("status") == "requeue":
        return {"status": "requeue", "requeued_to": requeue_target(book, ans)}
    if book["entry"] == "leaf":
        out = checked_leaf(book["isbn"], ans)
    else:
        out = checked_target(book["isbn"], ans, kept)
    if out["status"] == "picked" and (problems := line_problems(book, out["one_liner"])):
        raise ReviewError(f"{book['isbn']}: the one-liner breaks a rule — {', '.join(problems)}")
    if book["source"] == V1_SOURCE and out["status"] == "reserve":
        raise ReviewError(f"{book['isbn']}: a books_v1 book is kept or dropped (no 대기)")
    return out


def from_auto(book: dict, d: dict) -> dict:
    cur, auto = book["current"], d["auto"]
    if book["entry"] == "leaf":
        return {"genre": auto.get("slot", cur["genre"]), "axes": {a: auto.get(a, (cur.get("axes") or {}).get(a)) for a in AXES},
                "one_liner": cur["one_liner"], "status": None}
    return {"topic": auto.get("slot", cur["topic"]), "keywords": list(auto.get("keywords", cur["keywords"])), "way": auto.get("way", cur["way"]),
            "one_liner": cur["one_liner"], "status": None}


def _values(vals: dict, entry: str) -> dict:
    keys = ("genre", "axes", "one_liner") if entry == "leaf" else ("topic", "keywords", "way", "one_liner")
    return {k: vals[k] for k in keys}


def _same(a: dict, b: dict, entry: str) -> bool:
    if entry == "target":
        a, b = {**a, "keywords": sorted(a["keywords"])}, {**b, "keywords": sorted(b["keywords"])}
    return a == b


def updated(row: dict, entry: str, vals: dict, source: str, answered: bool, rules: str = RULES) -> dict:
    """A copy of a source row with `vals` written in."""
    old, new = values_of(row), _values(vals, entry)
    out = dict(row)
    if entry == "leaf":
        out |= {"genre": new["genre"], "axes": dict(new["axes"])}
        if source == V1_SOURCE:
            out["slot"] = new["genre"]
    else:
        out |= {"topic": new["topic"], "field": FIELD_OF_TOPIC[new["topic"]], "keywords": list(new["keywords"]),
                "way": new["way"]}
        if source == V1_SOURCE:
            out |= {"slot": new["topic"], "genre": new["topic"]}
    out["one_liner"] = new["one_liner"]
    if source != V1_SOURCE:
        status = vals["status"] or ("picked" if row.get("status") in WAITING and not row.get("reviewed") else row["status"])
        out["status"] = status
        if "draft" not in row:
            out["draft"] = draft_of(row)
        if answered:
            out = {k: v for k, v in out.items() if k != "auto"} | {"reviewed": True}
        elif row.get("status") in WAITING and status == "picked":
            out["auto"] = AUTO
    if not _same(old, new, entry):
        out["history"] = [*(row.get("history") or []), {"rules_version": row.get("rules_version") or "before-v3", **old}]
    out["rules_version"] = rules
    return out


def plan(books: list[dict], decided: dict[str, dict], answers: dict[str, dict], kept: dict) -> dict[str, dict]:
    """{isbn: decided values (+ answered flag)} — books left to a person without an answer are not in it."""
    on_page = {i for i, d in decided.items() if d["group"] in ("person", "sample", "answered")}
    stray = sorted(set(answers) - on_page)
    if stray:
        raise ReviewError(f"answers for books not on this page: {stray[:5]}")
    out = {}
    for b in books:
        d, ans = decided[b["isbn"]], answers.get(b["isbn"])
        if ans is not None:
            out[b["isbn"]] = from_answer(b, ans, kept) | {"answered": True}
        elif not d["asks"]:
            out[b["isbn"]] = from_auto(b, d) | {"answered": False}
    return out


def apply(books: list[dict], decided: dict[str, dict], answers: dict[str, dict], kept: dict, v1_rows: list[dict],
          docs: dict[str, dict]) -> tuple[list[dict], dict[str, dict], list[dict], dict]:
    """(new books_v1 rows, new additions docs by file name, books_v1 rows removed, tally). Inputs are not changed."""
    decided_vals = plan(books, decided, answers, kept)
    by_isbn = {b["isbn"]: b for b in books}
    tally = {"written": 0, "changed": 0, "unchanged": 0, "dropped": 0, "skipped_edited": [], "requeued": []}

    def requeued(row: dict, source: str, to: dict) -> dict:
        tally["requeued"].append({"isbn": row["isbn"], "to_entry": to["entry"], "to_slot": to["slot"]})
        if source == V1_SOURCE:
            return {**row, "requeued_to": to, "removed": True}
        out = {k: v for k, v in row.items() if k != "auto"}
        return {**out, "status": "dropped", "requeued_to": to, "draft": row.get("draft") or draft_of(row), "reviewed": True}

    def one(row: dict, source: str) -> dict:
        b, vals = by_isbn.get(row["isbn"]), decided_vals.get(row["isbn"])
        if b is None or vals is None:
            return row
        if vals["status"] == "requeue":
            return requeued(row, source, vals["requeued_to"])
        entry, now = b["entry"], values_of(row)
        target = _values(vals, entry)
        if not vals["answered"] and not (_same(now, b["current"], entry) or _same(now, target, entry)):
            tally["skipped_edited"].append(row["isbn"])
            return row
        new = updated(row, entry, vals, source, vals["answered"], b.get("rules_version") or RULES)
        tally["written"] += 1
        tally["changed" if len(new.get("history") or []) > len(row.get("history") or []) else "unchanged"] += 1
        if vals["status"] == "dropped":
            tally["dropped"] += 1
            if source == V1_SOURCE:
                return {**new, "removed": True}
        return new

    v1_out, removed = [], []
    for r in v1_rows:
        new = one(r, V1_SOURCE)
        (removed if new.get("removed") else v1_out).append(new)
    docs_out = {name: {**doc, "books": [one(b, name) for b in doc["books"]]} for name, doc in docs.items()}
    return v1_out, docs_out, [{k: v for k, v in r.items() if k != "removed"} for r in removed], tally
