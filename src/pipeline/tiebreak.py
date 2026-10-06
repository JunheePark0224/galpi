"""A third pass for the fields the two passes split on (user 10-06 evening, library re-tag).

splits: the fields where pass A and pass B gave different values — the slot (each pass's slot is the given one when it says
the book fits, else its suggestion, "" = none), a 🍃 axis both passes gave a value for (an axis either marked as having no
info is not a split: 정보 없음 always goes to a person), 🎯 keywords (as a set) and way.
third: one more blind pass B — the same v3 check prompt and model (config second_model), the 🍃 axis re-ask included —
as pass "C" (its own Breaker streak). settle: per split field, the value two of the three passes gave; None when all three
differ, when the third marked that axis as having no info, or for the slot when the majority is not the book's own slot
(a move or "nowhere" is a person's decision). Only the value is kept from the third pass's free text: the `why` line is
cut like pass B's and copy-checked by the caller (record keeps no YES24 text).
"""
from .merge import keyword_hints
from .prompt import AXES, all_keywords, schema, user_message
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
    if field in AXES:
        return None if field in (src.get("missing") or []) else (src.get("axes") or {}).get(field)
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


def settle(rec: dict, third: dict | None, only: tuple[str, ...] | None = None) -> dict[str, object]:
    """{split field: the majority value, or None for a person}. `only`: the fields a majority may settle (others None)."""
    a, b, slot = rec, rec.get("second") or {}, own_slot(rec)
    out = {}
    for f in splits(rec):
        va, vb = value(f, a, slot), value(f, b, slot)
        vc = value(f, third, slot) if third else None
        won = va if vc is not None and vc == va else vb if vc is not None and vc == vb else None
        out[f] = None if (f == "slot" and won != slot) or (only is not None and f not in only) else won
    return out


def needs_third(rec: dict) -> bool:
    return any(f in SETTLES for f in splits(rec))


def third(client, cfg, vocab: dict, prompts: dict, cand, breaker, ledger: dict) -> dict | None:
    """Pass C's parsed answer (None when the call failed or the answer was unusable). Raises TaggerStop."""
    kept = vocab.get(cand.slot, {}).get("kept", {}) if cand.entry == "target" else {}
    hints = keyword_hints(cand, kept) if kept else []
    user = user_message(cand.entry, cand.slot, cand.title, cand.intro, cand.toc, hints)
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
    return {k: ans[k] for k in ("fits", "suggest", "axes", "signals", "missing", "keywords", "way") if k in ans}
