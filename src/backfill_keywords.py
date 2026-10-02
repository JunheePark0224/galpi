"""Backfill keywords put (back) on the list onto books we already have (10-02).

A keyword can only be given when it is on the list (data/processed/keyword_vocab.json), so books that came in before it
was added never got it. This finds them with the keyword's word rule — over the title and the local YES24 intro / table of
contents (data/raw/yes24/detail, git-ignored) — and shows a local page where a person ticks the right ones; the download
is then applied to the source rows (books_v1.json and the additions files) and `npm run books:import` rebuilds the app data.

Only the matched word is kept in the page and the proposals, never the YES24 text around it (the page is local anyway).

  PYTHONIOENCODING=utf-8 python src/backfill_keywords.py build "데이터 분석:엑셀,파이썬,데이터 리터러시" "AI 활용:LLM 원리"
  PYTHONIOENCODING=utf-8 python src/backfill_keywords.py apply <downloaded.json>

promote (plans/2026-10-02-keyword-candidates.md): a keyword candidate the user approved becomes a keyword — the word rule
goes on the list, the definition into docs/target-chips.md "새 키워드 정의", and the books whose `keyword_candidate` was that
name (same topic, spaces and case ignored) get the keyword and lose the candidate.

  PYTHONIOENCODING=utf-8 python src/backfill_keywords.py promote "데이터 분석:Power BI" --pattern "Power ?BI|파워 ?BI" --definition "…"
"""
import argparse
import html
import json
import re
import sys
from datetime import date
from pathlib import Path

from pipeline.keyword_candidates import normalize

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
DETAIL = ROOT / "data" / "raw" / "yes24" / "detail"
BOOKS = ROOT / "web" / "src" / "data" / "books.json"
OUT = PROCESSED / "check"
CHIPS = ROOT / "docs" / "target-chips.md"
DEFS_MARKER = "새 키워드 정의"


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


def _write(path: Path, data: object) -> None:
    """JSON with LF line ends (the repo's), whatever the OS."""
    with path.open("w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")


def apply(answers_path: Path) -> int:
    choices = {str(k): list(v) for k, v in json.loads(answers_path.read_text(encoding="utf-8"))["answers"].items()}
    vocab = json.loads((PROCESSED / "keyword_vocab.json").read_text(encoding="utf-8"))
    allowed = {k for t in vocab.values() for k in t.get("kept", {})}
    touched: set[str] = set()
    base = PROCESSED / "books_v1.json"
    rows, changed = apply_choices(json.loads(base.read_text(encoding="utf-8")), choices, allowed)
    if changed:
        _write(base, rows)
    touched |= changed
    for path in sorted((PROCESSED / "additions").glob("*.json")):
        if path.name.endswith("-ai2.json"):
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        books, changed = apply_choices(doc["books"], choices, allowed)
        if changed:
            _write(path, {**doc, "books": books})
        touched |= changed
    missing = set(choices) - touched
    print(f"keywords added to {len(touched)} books" + (f" · not found or already there: {sorted(missing)}" if missing else ""))
    print("next: cd web && npm run books:import && npm test")
    return 0


MAX_HUMAN_KEYWORDS = 5  # a person may give a book up to 5 keywords (the AI's cap stays 3, pipeline/prompt.py)
JS_GROUPS = (":", "=", "!", "<=", "<!")  # the "(?…" groups Python and JS RegExp both read the same way


def promote_rows(rows: list[dict], topic: str, name: str) -> tuple[list[dict], set[str], list[dict], set[str]]:
    """(new rows, isbns changed, rows left as they are because they already hold MAX_HUMAN_KEYWORDS keywords, isbns of
    `topic` that hold the keyword afterwards). A row of `topic` whose keyword_candidate is `name` (spaces and case ignored)
    gets the keyword (no duplicates) and its candidate cleared. Any status counts (picked, review, reserve, dropped): the
    keyword belongs to the book whatever happens to it. The input rows are not changed; running it again changes nothing."""
    key, out, changed, full, has = normalize(name), [], set(), [], set()
    for r in rows:
        cand, kws = r.get("keyword_candidate"), list(r.get("keywords") or [])
        mine = r.get("topic") == topic
        if mine and isinstance(cand, str) and normalize(cand) == key:
            if name not in kws and len(kws) >= MAX_HUMAN_KEYWORDS:
                full.append(r)
                out.append(r)
                continue
            r = {**r, "keywords": list(dict.fromkeys([*kws, name])), "keyword_candidate": None}
            changed.add(str(r["isbn"]))
        if mine and name in (r.get("keywords") or []):
            has.add(str(r["isbn"]))
        out.append(r)
    return out, changed, full, has


def _has_row(lines: list[str], topic: str, name: str) -> bool:
    """Whether the definition table rows already hold (topic, name) — a rerun must not add a second row."""
    current = ""
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) >= 3 and not line.startswith("|---"):
            current = re.sub(r"\s*\(.*\)$", "", cells[0]) or current
            if current == topic and cells[1] == name:
                return True
    return False


def with_definition(text: str, row: str, topic: str, name: str) -> str:
    """`text` with `row` right after the last row of the "새 키워드 정의" table (its line ends kept); unchanged when the
    table already has the keyword."""
    nl = "\r\n" if "\r\n" in text else "\n"
    lines = text.split(nl)
    start = next((i for i, line in enumerate(lines) if line.startswith(DEFS_MARKER)), None)
    if start is None:
        raise BackfillError(f'no "{DEFS_MARKER}" table in the chips doc')
    first = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("|")), None)
    if first is None:
        raise BackfillError(f'the "{DEFS_MARKER}" table has no rows')
    last = first
    while last + 1 < len(lines) and lines[last + 1].startswith("|"):
        last += 1
    if _has_row(lines[first:last + 1], topic, name):
        return text
    return nl.join([*lines[:last + 1], row, *lines[last + 1:]])


def js_unsafe(pattern: str) -> list[str]:
    """The "(?…" groups of `pattern` that JS `new RegExp(p, "i")` (the app's word rule) cannot read the same way: only
    lookbehind / lookahead and non-capturing groups are allowed. An escaped parenthesis is a plain character."""
    out, i = [], 0
    while i < len(pattern):
        if pattern[i] == "\\":
            i += 2
            continue
        if pattern.startswith("(?", i) and not pattern.startswith(JS_GROUPS, i + 2):
            out.append(pattern[i:i + 4])
        i += 1
    return out


def _checked_pattern(pattern: str) -> str:
    if not pattern:
        raise BackfillError("the word pattern is empty")
    try:
        rule = re.compile(pattern)
    except re.error as err:
        raise BackfillError(f"the word pattern does not compile: {err}") from None
    if bad := js_unsafe(pattern):
        allowed = ", ".join("(?" + g for g in JS_GROUPS)
        raise BackfillError(f"the word pattern has groups JavaScript reads differently or not at all: {bad} (allowed: {allowed})")
    if rule.search("") is not None:
        raise BackfillError("the word pattern matches the empty string (it would hit every book)")
    return pattern


def _checked(spec: str, pattern: str, definition: str, vocab: dict) -> tuple[str, str, str, str]:
    topic, _, name = (part.strip() for part in spec.partition(":"))
    definition = " ".join(definition.split())
    if not topic or not name:
        raise BackfillError(f'give the keyword as "topic:name", not {spec!r}')
    if topic not in vocab:
        raise BackfillError(f"unknown topic {topic}")
    if normalize(name) == normalize(topic):
        raise BackfillError(f"{name} is the topic itself")
    if normalize(name) in {normalize(k) for k in vocab[topic].get("kept", {})}:  # folded / too_common names may come back
        raise BackfillError(f"{topic} › {name} is already on the keyword list")
    if not definition:
        raise BackfillError("the definition is empty")
    if any(c in s for s in (name, definition) for c in "|\n"):
        raise BackfillError("name and definition cannot hold | (they go into a markdown table)")
    return topic, name, definition, _checked_pattern(pattern)


def promote(spec: str, pattern: str, definition: str, processed: Path = PROCESSED, chips: Path = CHIPS,
            day: str | None = None) -> int:
    """An approved candidate becomes a keyword. Everything is checked and computed first, then written in an order that
    can simply be run again after a failure part-way: the book files (idempotent), the definition table (a second row is
    never added), the keyword list last — until the list has it, the same command is accepted again."""
    vocab_path = processed / "keyword_vocab.json"
    vocab = json.loads(vocab_path.read_text(encoding="utf-8"))
    topic, name, definition, pattern = _checked(spec, pattern, definition, vocab)
    sources = [processed / "books_v1.json", *(p for p in sorted((processed / "additions").glob("*.json"))
                                             if not p.name.endswith("-ai2.json"))]
    writes: list[tuple[Path, object, set[str]]] = []
    full: list[dict] = []
    books: set[str] = set()
    for path in sources:
        data = json.loads(path.read_text(encoding="utf-8"))
        rows, changed, too_many, has = promote_rows(data if isinstance(data, list) else data["books"], topic, name)
        full += too_many
        books |= has
        if changed:
            writes.append((path, rows if isinstance(data, list) else {**data, "books": rows}, changed))
    # Books of any status get the keyword (review / reserve / dropped too — it describes the book), and n counts them all:
    # every book of the topic that holds the keyword now.
    if not books:
        raise BackfillError(f"no {topic} book has the candidate {name} (or the keyword) — nothing to promote")
    new_vocab = {**vocab, topic: {**vocab[topic], "kept": {**vocab[topic].get("kept", {}),
                                                           name: {"pattern": pattern, "n": len(books)}}}}
    row = f"| {topic} ({day or date.today().isoformat()} 승인) | {name} | {definition} |"
    doc = with_definition(chips.read_bytes().decode("utf-8"), row, topic, name)  # line ends as they are
    for path, data, _ in writes:
        _write(path, data)
    with chips.open("w", encoding="utf-8", newline="") as f:
        f.write(doc)
    _write(vocab_path, new_vocab)
    print(f"keyword list: {topic} › {name} (pattern {pattern!r}, {len(books)} books) · definition row in {chips.name}")
    for path, _, changed in writes:
        print(f"  {path.name}: {len(changed)} books got {name} — {', '.join(sorted(changed))}")
    for r in full:
        print(f"  skipped, already {MAX_HUMAN_KEYWORDS} keywords — a person decides: {r.get('isbn')} {r.get('title') or ''}")
    print("next: cd web && npm run books:import && npx vitest run, then commit the vocab, the doc, the book files and web/src/data/")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("spec", nargs="+", help='"topic:keyword,keyword"')
    b.add_argument("--detail-dir", type=Path, default=DETAIL, help="the local YES24 cache (a worktree has none: point at the main checkout)")
    a = sub.add_parser("apply")
    a.add_argument("answers", type=Path)
    p = sub.add_parser("promote", help="an approved keyword candidate becomes a keyword")
    p.add_argument("spec", help='"topic:name"')
    p.add_argument("--pattern", required=True, help="the word rule (regex) for the keyword list")
    p.add_argument("--definition", required=True, help='one sentence for the "새 키워드 정의" table')
    args = ap.parse_args(argv)
    try:
        if args.cmd == "build":
            build(args.spec, args.detail_dir)
            return 0
        if args.cmd == "promote":
            return promote(args.spec, args.pattern, args.definition)
        return apply(args.answers)
    except BackfillError as err:
        print(f"ERROR: {err}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
