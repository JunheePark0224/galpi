"""How often each pass agrees with a person's gold labels (plans/2026-10-06-calibration.md 4).

Labels (the gold page's download, {labels: {isbn: …}}):
  🍃 {genre: a genre or "" (no 🍃 genre), axes: {temp|pull|gain|world: 1 / 0 / -1 / null}, missing: [axes with no info],
      reasons: {axis: one line}}
  🎯 {topic: a topic or "" (no 🎯 topic), keywords: [...], way: 개념 / 실습 / 사례, reason: one line}
Results: [{run, isbn, record}] — a record as run_daily.tag_one writes it (pass A on the record, pass B under `second`).
The tagger is told the slot and answers `fits`; a pass that says the book does not fit also names the slot it belongs to
(`suggest`, 10-06 calibration). Genre / topic agree when the AI's slot (the given one when it fits, else its suggestion,
"" = none) is the person's. A record from before suggestions keeps the old rule: `fits` is true exactly when the person
kept the book in that slot. An axis the person left without a value (only "정보 없음") is not counted; its no-info marks
are tallied. Keywords agree when the sets are equal; on a book the person moved to another topic, a pass's keywords are
compared only when it suggested that same topic (its `suggest_keywords`), otherwise not counted for that pass. Several runs: each run is counted, mismatches are one row per book and field.
"""
from collections import defaultdict

from .prompt import AXES

LEAF_FIELDS = ("genre", *AXES)
TARGET_FIELDS = ("topic", "keywords", "way")
FIELDS = (*LEAF_FIELDS, *TARGET_FIELDS)
TARGET_LINE = 0.9


class GoldError(ValueError):
    """The labels do not belong to this gold set."""


def check_labels(gold: list[dict], raw: dict) -> dict[str, dict]:
    labels = raw.get("labels") if isinstance(raw.get("labels"), dict) else raw
    stray = sorted(set(labels) - {g["isbn"] for g in gold})
    if stray:
        raise GoldError(f"labels for books outside the gold set: {stray[:5]}")
    return labels


def _person(field: str, lab: dict):
    """The person's value for a field, or None when not given."""
    if field in AXES:
        return (lab.get("axes") or {}).get(field)
    if field in ("genre", "topic"):
        return lab.get(field) if isinstance(lab.get(field), str) else None
    if field == "keywords":
        return sorted(lab["keywords"]) if isinstance(lab.get("keywords"), list) else None
    return lab.get(field) or None


SKIP = "(다른 주제를 제안 — 비교 안 함)"  # a pass's keywords on a book the person moved, without the same suggestion


def _ai(field: str, g: dict, src: dict, lab: dict):
    if field in AXES:
        return (src.get("axes") or {}).get(field)
    if field in ("genre", "topic"):
        if src.get("fits"):
            return g["slot"]
        return src["suggest"] if isinstance(src.get("suggest"), str) else f"{g['slot']} 아님"
    if field == "keywords":
        moved = lab.get("topic") != g["slot"]
        if not moved:
            return sorted(src.get("keywords") or [])
        return sorted(src.get("suggest_keywords") or []) if src.get("suggest") == lab.get("topic") and not src.get("fits") else SKIP
    return src.get(field)


def _same(field: str, g: dict, person, ai) -> bool:
    if field in ("genre", "topic") and ai == f"{g['slot']} 아님":  # a record from before suggestions
        return person != g["slot"]
    return person == ai


def _why(field: str, src: dict, who: int) -> str:
    if field in AXES:
        return (src.get("signals") or {}).get(field, "")
    return src.get("evidence" if who == 1 else "why") or ""


def _pair() -> dict:
    return {"ai1": [0, 0], "ai2": [0, 0]}


def score(gold: list[dict], labels: dict[str, dict], results: list[dict]) -> dict:
    by_isbn = {g["isbn"]: g for g in gold}
    fields, slots, rows = defaultdict(_pair), defaultdict(_pair), {}
    missing = {"person": 0, "ai1_too": 0, "ai2_too": 0, "ai1_only": 0, "ai2_only": 0}
    for res in sorted(results, key=lambda r: (r["run"], r["isbn"])):
        g, lab, rec = by_isbn.get(res["isbn"]), labels.get(res["isbn"]), res["record"]
        if g is None or lab is None:
            continue
        srcs = {1: rec, 2: rec.get("second") or {}}
        for field in LEAF_FIELDS if g["entry"] == "leaf" else TARGET_FIELDS:
            person = _person(field, lab)
            if field in AXES:
                _tally_missing(missing, field, lab, srcs)
            if person is None:
                continue
            ai = {w: _ai(field, g, s, lab) for w, s in srcs.items()}
            ok = {w: _same(field, g, person, ai[w]) for w in srcs if ai[w] != SKIP}
            if not ok:
                continue
            for w in srcs:
                for table in (fields[field], slots[g["slot"]]):
                    table[f"ai{w}"][0] += ok.get(w, False)
                    table[f"ai{w}"][1] += w in ok
            if not all(ok.values()):
                _mismatch(rows, g, lab, field, person, res["run"], ai, srcs)
    order = {f: i for i, f in enumerate(FIELDS)}
    return {"fields": {f: fields[f] for f in FIELDS if f in fields}, "slots": dict(slots), "missing": missing,
            "mismatches": sorted(rows.values(), key=lambda m: (order[m["field"]], m["slot"], m["title"])),
            "labelled": sum(g["isbn"] in labels for g in gold), "unlabelled": [g["isbn"] for g in gold if g["isbn"] not in labels],
            "runs": len({r["run"] for r in results}), "target": TARGET_LINE}


def _tally_missing(missing: dict, axis: str, lab: dict, srcs: dict) -> None:
    person = axis in (lab.get("missing") or [])
    missing["person"] += person
    for w, s in srcs.items():
        missing[f"ai{w}_too" if person else f"ai{w}_only"] += axis in (s.get("missing") or [])


def _mismatch(rows: dict, g: dict, lab: dict, field: str, person, run: int, ai: dict, srcs: dict) -> None:
    key = f"{g['isbn']}|{field}"
    row = rows.setdefault(key, {
        "key": key, "isbn": g["isbn"], "title": g["title"], "entry": g["entry"], "slot": g["slot"], "field": field,
        "person": person, "person_missing": field in (lab.get("missing") or []),
        "person_reason": (lab.get("reasons") or {}).get(field, "") if field in AXES else lab.get("reason", ""),
        "runs": []})
    row["runs"].append({"run": run, "ai1": ai[1], "ai2": ai[2], "why1": _why(field, srcs[1], 1), "why2": _why(field, srcs[2], 2),
                        "miss1": field in (srcs[1].get("missing") or []), "miss2": field in (srcs[2].get("missing") or [])})
