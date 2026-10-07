"""Pipeline: the gold labelling page, the calibration page and the gold CLI (src/pipeline/gold_page.py, gold.py)."""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline_fakes import INTRO, TOC, FakeClient  # noqa: E402

from pipeline import gold, gold_page, gold_score  # noqa: E402
from pipeline.gaps import GENRES  # noqa: E402

DICT = """# 라벨 정의서 v3 (2026-10-06)

## 0. 원칙
정보가 없으면 정보 없음.

## 🍃 축
### 온도
| 값 | 조건 |
|---|---|
| +1 | 따뜻한 끝맺음 |

### 세계
현실 +1 = 실제로 있는 세상 <script>x</script>

## 🎯 키워드
- **엑셀**: 표 계산
"""
VOCAB = {"데이터 분석": {"kept": {"엑셀": {"pattern": "엑셀"}}}}
ENTRIES = [{"isbn": "1", "title": "소설", "author": "가", "pages": 100, "link": "", "entry": "leaf", "intro": INTRO,
            "toc": "1장"},
           {"isbn": "2", "title": "엑셀책", "author": "나", "pages": 200, "link": "", "entry": "target", "intro": "",
            "toc": ""}]


def docs_dir(tmp_path, dictionary=True):
    d = tmp_path / "docs"
    d.mkdir()
    (d / "balance-game.md").write_text("# bg\n## 1. 근거\n앞\n## 2. 질문 9개\n### 태그 기준\n온도 신호표\n## 3. 점수\n뒤\n",
                                       encoding="utf-8")
    (d / "book-pool.md").write_text("## 1. 구성\n### 1-3. 🍃 장르 경계\n로맨스 규칙\n## 2. 뽑기\n", encoding="utf-8")
    (d / "target-chips.md").write_text("## 1. 화면\n## 2. 태그 — 3층 구조\n방식 규칙\n## 3. 직접 쓰기\n", encoding="utf-8")
    if dictionary:
        (d / "label-dictionary.md").write_text(DICT, encoding="utf-8")
    return d


def test_the_guide_shows_each_fields_own_dictionary_section_escaped(tmp_path):
    d = docs_dir(tmp_path)
    g = gold_page.guide(d / "label-dictionary.md", d, "v3")
    assert "v3" in g["source"] and set(g["fields"]) == set(gold_page.FIELD_NAMES)
    assert "따뜻한 끝맺음" in g["fields"]["temp"] and "실제로 있는" not in g["fields"]["temp"]
    assert "실제로 있는" in g["fields"]["world"] and "&lt;script&gt;" in g["fields"]["world"] and "<script>" not in g["fields"]["world"]
    assert "<b>엑셀</b>" in g["fields"]["keywords"] and "<table>" in g["fields"]["temp"]
    assert "원칙" in g["fields"]["topic"]  # no heading names it: the whole dictionary


def test_without_the_dictionary_the_guide_falls_back_to_the_older_rule_sections(tmp_path):
    d = docs_dir(tmp_path, dictionary=False)
    g = gold_page.guide(d / "label-dictionary.md", d, "v2")
    assert "온도 신호표" in g["fields"]["temp"] and "근거" not in g["fields"]["temp"] and "점수" not in g["fields"]["world"]
    assert "로맨스 규칙" in g["fields"]["genre"] and "방식 규칙" in g["fields"]["way"] and "없어요" in g["source"]


def test_page_entries_are_blind_no_slot_no_tags():
    rows = [{"isbn": "1", "title": "소설", "entry": "leaf", "slot": "한국 소설"}]
    books = {"1": {"author": "가", "pages": 100, "link": "", "axes": {"temp": 1}, "one_liner": "AI 한 줄"}}
    [e] = gold.page_entries(rows, books, lambda i: (INTRO, TOC))
    assert set(e) == {"isbn", "title", "author", "pages", "link", "entry", "intro", "toc"}


def test_the_label_page_holds_the_text_the_choices_and_the_download_but_no_ai_answer(tmp_path):
    d = docs_dir(tmp_path)
    page = gold_page.label_page(ENTRIES, VOCAB, {"데이터 분석": {"엑셀": "표 계산 프로그램"}},
                                gold_page.guide(d / "label-dictionary.md", d, "v3"), "v3")
    assert INTRO[:20] in page and all(g in page for g in GENRES) and "표 계산 프로그램" in page
    assert "정보 없음" in page and "gold-v3.json" in page and "galpi-gold-v3" in page and "localStorage" in page
    assert "one_liner" not in page and "second" not in page and "한국 소설\"" not in page.split("GENRES=")[0]
    assert not re.search(r"</script>(?!</body>)", page.split("<script>", 1)[1].rsplit("</script>", 1)[0])


def test_the_calibration_page_shows_the_90_line_three_decisions_and_the_download():
    gold_rows = [{"isbn": "1", "title": "소설", "entry": "leaf", "slot": "한국 소설"}]
    rec = {"axes": {"temp": 1, "pull": 0, "gain": 0, "world": 1}, "fits": True, "signals": {"temp": "끝 +"}, "missing": [],
           "second": {"axes": {"temp": -1, "pull": 0, "gain": 0, "world": 1}, "fits": True, "signals": {}, "missing": ["temp"]}}
    labels = {"1": {"genre": "한국 소설", "axes": {"temp": 1, "pull": 0, "gain": 0, "world": 1}, "missing": []}}
    page = gold_page.calibration_page(gold_score.score(gold_rows, labels, [{"run": 1, "isbn": "1", "record": rec}]),
                                      "run-1.json", "v3")
    for text in ("AI가 틀림", "내 답이 틀림", "기준에 빈칸", "calibration-decisions.json", "90%", "정보 없음", "1|temp"):
        assert text in page


def write_world(tmp_path, monkeypatch):
    """A tiny repo: library, batch, vocab, cache — with gold.py's paths pointed at it."""
    books = [{"isbn": f"L{i}", "title": f"책{i}", "author": "가", "pages": 100, "entry": "leaf", "genre": g, "topic": None}
             for i, g in enumerate(GENRES)]
    books += [{"isbn": f"T{i}", "title": f"배움{i}", "author": "나", "pages": 100, "entry": "target", "genre": None,
               "topic": "데이터 분석"} for i in range(3)]
    adds = tmp_path / "additions"
    adds.mkdir()
    (adds / f"{gold.BATCH}.json").write_text(json.dumps({"books": []}), encoding="utf-8")
    (tmp_path / "books.json").write_text(json.dumps(books, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "vocab.json").write_text(json.dumps(VOCAB, ensure_ascii=False), encoding="utf-8")
    cache = tmp_path / "detail"
    cache.mkdir()
    item = {"contentDetail": {"bookIntroduction": INTRO, "tableOfContents": TOC}}
    for b in books:
        (cache / f"{b['isbn']}.json").write_text(json.dumps({"data": {"items": [item]}}, ensure_ascii=False), encoding="utf-8")
    d = docs_dir(tmp_path)
    for name, value in {"BOOKS": tmp_path / "books.json", "ADDITIONS": adds, "VOCAB": tmp_path / "vocab.json",
                        "GOLD_SET": tmp_path / "gold" / "gold-set.json", "PAGES": tmp_path / "pages",
                        "RUN_DIR": tmp_path / "runs", "DOCS": d, "DICTIONARY": d / "label-dictionary.md"}.items():
        monkeypatch.setattr(gold, name, value)
    monkeypatch.setattr(gold, "detail_dirs", lambda: [cache])
    monkeypatch.setattr(gold, "keyword_definitions", lambda: {})
    monkeypatch.setattr(gold, "rules_version", lambda: "v3")
    return tmp_path


def test_pick_then_page_then_calibrate_end_to_end_with_a_fake_client(tmp_path, monkeypatch, capsys):
    root = write_world(tmp_path, monkeypatch)
    assert gold.main(["pick", "--keep", str(root / "none.json")]) == 0
    doc = json.loads((root / "gold" / "gold-set.json").read_text(encoding="utf-8"))
    assert doc["counts"] == {"leaf": 13, "target": 3} and INTRO[:20] not in json.dumps(doc, ensure_ascii=False)
    assert gold.main(["pick", "--keep", str(root / "none.json")]) == 1               # never over an existing set
    assert gold.main(["page"]) == 0 and INTRO[:20] in (root / "pages" / "gold-v3.html").read_text(encoding="utf-8")
    labels = {"labels": {"L0": {"genre": GENRES[0], "axes": {"temp": 1, "pull": -1, "gain": 0, "world": 1}, "missing": []}}}
    (root / "gold-v3.json").write_text(json.dumps(labels, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(gold, "anthropic_key", lambda: "test-key")
    monkeypatch.setattr(gold, "yes24_env", lambda: {})
    monkeypatch.setattr(gold, "load_config", lambda: __import__("test_pipeline_retag").CFG)
    import anthropic
    monkeypatch.setattr(anthropic, "Anthropic", lambda **kw: FakeClient())
    assert gold.main(["calibrate", "--labels", str(root / "gold-v3.json")]) == 0
    out = capsys.readouterr().out
    assert "about $0.32" in out and out.index("about $") < out.index("cost_usd")      # estimate printed before calling
    [run] = list((root / "runs").glob("run-*.json"))
    assert len(json.loads(run.read_text(encoding="utf-8"))["results"]) == 16
    page = (root / "pages" / "gold-calibration.html").read_text(encoding="utf-8")
    assert run.name in page and INTRO[:20] not in page
    assert gold.main(["calibrate", "--labels", str(root / "gold-v3.json"), "--reuse", str(run)]) == 0


def test_calibrate_refuses_labels_from_another_set(tmp_path, monkeypatch):
    root = write_world(tmp_path, monkeypatch)
    gold.main(["pick", "--keep", str(root / "none.json")])
    (root / "bad.json").write_text(json.dumps({"labels": {"999": {}}}), encoding="utf-8")
    assert gold.main(["calibrate", "--labels", str(root / "bad.json")]) == 1
