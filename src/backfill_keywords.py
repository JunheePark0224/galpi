"""Backfill keywords put (back) on the list onto books we already have (10-02).

A keyword can only be given when it is on the list (data/processed/keyword_vocab.json), so books that came in before it
was added never got it. This finds them with the keyword's word rule — over the title and the local YES24 intro / table of
contents (data/raw/yes24/detail, git-ignored) — and shows a local page where a person ticks the right ones; the download
is then applied to the source rows (books_v1.json and the additions files) and `npm run books:import` rebuilds the app data.

Only the matched word is kept in the page and the proposals, never the YES24 text around it (the page is local anyway).

  PYTHONIOENCODING=utf-8 python src/backfill_keywords.py build "데이터 분석:엑셀,파이썬,데이터 리터러시" "AI 활용:LLM 원리"
  PYTHONIOENCODING=utf-8 python src/backfill_keywords.py apply <downloaded.json>
"""
import argparse
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
DETAIL = ROOT / "data" / "raw" / "yes24" / "detail"
BOOKS = ROOT / "web" / "src" / "data" / "books.json"
OUT = PROCESSED / "check"


class BackfillError(ValueError):
    pass


def proposals(books: list[dict], patterns: dict[str, dict[str, str]], material: dict[str, str]) -> list[dict]:
    """Books of the keyword's own topic that lack it and whose title (or local intro/TOC) matches its word rule."""
    out = []
    for b in books:
        if b.get("entry") != "target":
            continue
        for keyword, pattern in patterns.get(b.get("topic") or "", {}).items():
            if keyword in (b.get("keywords") or []):
                continue
            rule = re.compile(pattern, re.IGNORECASE)
            for where, text in (("제목", b.get("title") or ""), ("소개·목차", material.get(b["isbn"], ""))):
                hit = rule.search(text)
                if hit:
                    out.append({"isbn": b["isbn"], "title": b.get("title") or "", "topic": b["topic"], "keyword": keyword,
                                "where": where, "word": hit.group(0)})
                    break
    return out


def apply_choices(rows: list[dict], choices: dict[str, list[str]], allowed: set[str]) -> tuple[list[dict], set[str]]:
    """Rows with the chosen keywords added (no duplicates, order kept) — a new list; the input rows are not changed."""
    for kws in choices.values():
        for k in kws:
            if k not in allowed:
                raise BackfillError(f"{k} is not on the keyword list")
    out, changed = [], set()
    for r in rows:
        add = choices.get(str(r.get("isbn")), [])
        merged = list(dict.fromkeys([*(r.get("keywords") or []), *add]))
        if merged != (r.get("keywords") or []):
            changed.add(str(r["isbn"]))
            out.append({**r, "keywords": merged})
        else:
            out.append(r)
    return out, changed


def _material(isbn: str, detail: Path = DETAIL) -> str:
    path = detail / f"{isbn}.json"
    if not path.exists():
        return ""
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    cd = (items[0].get("contentDetail") or {}) if items else {}
    return f"{cd.get('bookIntroduction') or ''} {cd.get('tableOfContents') or ''}"


def _patterns(spec: list[str]) -> dict[str, dict[str, str]]:
    vocab = json.loads((PROCESSED / "keyword_vocab.json").read_text(encoding="utf-8"))
    out: dict[str, dict[str, str]] = {}
    for item in spec:
        topic, _, names = item.partition(":")
        kept = vocab.get(topic, {}).get("kept", {})
        for name in filter(None, (n.strip() for n in names.split(","))):
            if name not in kept:
                raise BackfillError(f"{topic} › {name} is not on the keyword list")
            out.setdefault(topic, {})[name] = kept[name]["pattern"]
    return out


PAGE = """<!doctype html><meta charset="utf-8"><title>키워드 붙이기 {day}</title>
<style>body{{font:15px/1.6 system-ui;max-width:760px;margin:24px auto;padding:0 16px;background:#FAF5EA;color:#2B2724}}
label{{display:flex;gap:10px;align-items:flex-start;padding:10px;border-bottom:1px solid #DDD0B4}}small{{color:#7A6048}}
button{{margin:16px 0;padding:10px 18px;border-radius:999px;border:0;background:#2B2724;color:#FAF5EA;font:inherit}}</style>
<h1>새 키워드 붙이기 — {day}</h1>
<p>단어 규칙이 찾은 책이에요. 책의 <b>중심</b>이 그 키워드일 때만 체크하세요. 다 보면 [내려받기].</p>
{rows}
<button onclick="save()">내려받기</button>
<script>
function save(){{const a={{}};document.querySelectorAll('input:checked').forEach(c=>{{(a[c.dataset.isbn]=a[c.dataset.isbn]||[]).push(c.dataset.kw)}});
const blob=new Blob([JSON.stringify({{saved_at:new Date().toISOString(),answers:a}},null,1)],{{type:'application/json'}});
const l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download='backfill-{day}.json';l.click()}}
</script>"""


def build(spec: list[str], detail: Path = DETAIL) -> Path:
    books = json.loads(BOOKS.read_text(encoding="utf-8"))
    patterns = _patterns(spec)
    material = {b["isbn"]: _material(b["isbn"], detail) for b in books if b.get("topic") in patterns}
    if not any(material.values()):
        raise BackfillError(f"no YES24 detail text found in {detail} (use --detail-dir)")
    found = proposals(books, patterns, material)
    rows = "\n".join(
        f'<label><input type="checkbox" data-isbn="{p["isbn"]}" data-kw="{html.escape(p["keyword"])}"{" checked" if p["where"] == "제목" else ""}>'
        f'<span><b>{html.escape(p["title"])}</b> → {html.escape(p["keyword"])}<br>'
        f'<small>{html.escape(p["topic"])} · {p["where"]}에서 “{html.escape(p["word"])}”</small></span></label>'
        for p in found)
    OUT.mkdir(parents=True, exist_ok=True)
    day = date.today().isoformat()
    path = OUT / f"backfill-{day}.html"
    path.write_text(PAGE.format(day=day, rows=rows or "<p>찾은 책이 없어요.</p>"), encoding="utf-8")
    print(f"saved: {path} · {len(found)} proposals")
    return path


def apply(answers_path: Path) -> int:
    choices = {str(k): list(v) for k, v in json.loads(answers_path.read_text(encoding="utf-8"))["answers"].items()}
    vocab = json.loads((PROCESSED / "keyword_vocab.json").read_text(encoding="utf-8"))
    allowed = {k for t in vocab.values() for k in t.get("kept", {})}
    touched: set[str] = set()
    base = PROCESSED / "books_v1.json"
    rows, changed = apply_choices(json.loads(base.read_text(encoding="utf-8")), choices, allowed)
    if changed:
        base.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    touched |= changed
    for path in sorted((PROCESSED / "additions").glob("*.json")):
        if path.name.endswith("-ai2.json"):
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        books, changed = apply_choices(doc["books"], choices, allowed)
        if changed:
            path.write_text(json.dumps({**doc, "books": books}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        touched |= changed
    missing = set(choices) - touched
    print(f"keywords added to {len(touched)} books" + (f" · not found or already there: {sorted(missing)}" if missing else ""))
    print("next: cd web && npm run books:import && npm test")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("spec", nargs="+", help='"topic:keyword,keyword"')
    b.add_argument("--detail-dir", type=Path, default=DETAIL, help="the local YES24 cache (a worktree has none: point at the main checkout)")
    a = sub.add_parser("apply")
    a.add_argument("answers", type=Path)
    args = ap.parse_args(argv)
    try:
        if args.cmd == "build":
            build(args.spec, args.detail_dir)
            return 0
        return apply(args.answers)
    except BackfillError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
