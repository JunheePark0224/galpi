"""D1-2: build the closed keyword vocabulary for 🎯 topics and draft keyword tags per book.

Why not 정보나루 keywords: they exist only for books with library loan history — 78 of ~150 🎯
candidates (mostly new AI/data books) had none (see d1_keyword_counts.json).
So each keyword below is a fixed name + synonym regex, matched on YES24 title + introduction + TOC.

Rule (docs/target-chips.md 2절): a keyword stays in the vocabulary only if >= MIN_BOOKS picked books
of its topic carry it; smaller ones fold into the topic itself.

Usage:  python src/build_vocab.py
Input:  data/processed/d1_candidates.json, data/raw/yes24/detail/<isbn>.json
Output: data/processed/keyword_vocab.json   (topic -> kept / folded keywords with book counts)
        data/processed/keyword_tags_draft.json  (isbn -> matched keywords, draft for D2/D3)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data" / "processed" / "d1_candidates.json"
DETAIL = ROOT / "data" / "raw" / "yes24" / "detail"
OUT_VOCAB = ROOT / "data" / "processed" / "keyword_vocab.json"
OUT_TAGS = ROOT / "data" / "processed" / "keyword_tags_draft.json"
MIN_BOOKS = 5
MIN_HITS = 2  # hits = 2 x title matches + body matches, so one title match or two body matches
MAX_SHARE = 0.6  # a keyword on more than 60% of a topic's books cannot tell books apart -> dropped

VOCAB: dict[str, dict[str, str]] = {
    # compound terms only: bare words like 시간, 사고, 뇌, 분포, 커서 matched nearly every book (review 09-29)
    "데이터 분석": {
        "파이썬": r"파이썬|Python|판다스|pandas",
        "SQL": r"SQL|쿼리|데이터베이스",
        "엑셀": r"엑셀|Excel|피벗 ?테이블",
        "R": r"(?<![A-Za-z0-9])R(?:로|을|를| ?언어| ?프로그래밍| ?데이터)(?![A-Za-z0-9])|RStudio|R 스튜디오",
        "시각화": r"시각화|대시보드|태블로|Tableau|Power ?BI",
        "데이터 리터러시": r"리터러시|데이터 ?해석",
    },
    "통계": {
        "기초 통계": r"기초 ?통계|기술 ?통계|표준 ?편차|분산",
        "확률": r"확률",
        "베이즈": r"베이즈|베이지안",
        "회귀분석": r"회귀",
        "가설검정": r"가설 ?검정|p-?값|신뢰 ?구간|유의 ?수준|t-?검정",
        "통계적 사고": r"통계적 ?사고|숫자 ?감각|숫자에 ?속|거짓말|함정|착각",
        "파이썬·R 통계": r"파이썬|Python|(?<![A-Za-z0-9])R(?:로|을|를| ?언어| ?프로그래밍| ?데이터)(?![A-Za-z0-9])|RStudio|R 스튜디오",
    },
    "AI 활용": {
        "챗GPT": r"챗GPT|ChatGPT",
        "클로드": r"클로드|Claude",
        "제미나이": r"제미나이|Gemini|노트북LM|NotebookLM",
        "프롬프트 엔지니어링": r"프롬프트 ?엔지니어링|프롬프트 ?(?:작성|설계|공식)",
        "바이브 코딩": r"바이브 ?코딩|코덱스|Codex|Cursor|클로드 ?코드",
        "AI 에이전트": r"에이전트|Agent|MCP",
        "이미지·영상 생성": r"미드저니|이미지 ?생성|영상 ?생성|캔바",
        "LLM 원리": r"LLM|대규모 ?언어 ?모델|트랜스포머",
    },
    "업무 자동화": {
        "엑셀": r"엑셀|Excel",
        "파이썬 자동화": r"파이썬|Python",
        "노션": r"노션|Notion",
        "구글 워크스페이스": r"구글 ?(?:시트|스프레드시트|워크스페이스|앱스 ?스크립트)|Apps Script",
        "코파일럿·M365": r"코파일럿|Copilot|M365|(?<![0-9])365(?![0-9]|일)",
        "AI 업무 활용": r"챗GPT|ChatGPT|제미나이|클로드|생성형 ?AI",
    },
    "습관·집중": {
        "습관": r"습관|루틴",
        "집중력": r"집중력|몰입|주의력",
        "도파민": r"도파민|디지털 ?디톡스|스마트폰 ?중독",
        "뇌과학": r"뇌과학|신경과학|전전두엽|뇌 ?(?:회로|구조|건강)",
        "마음·회복": r"회복 ?탄력성|스트레스|번아웃|불안",
    },
    "시간·생산성": {
        "시간 관리": r"시간 ?관리|시간 ?활용|시간을 ?(?:쓰|관리|지배)",
        "메모·기록": r"메모|기록",
        "지식 관리": r"세컨드 ?브레인|지식 ?관리|PARA",
        "계획·목표": r"계획|목표 ?설정",
        "일하는 법": r"일 ?잘하는|업무 ?효율|생산성",
        "아침·새벽": r"새벽|아침 ?(?:루틴|시간)|기상",
    },
}


def book_text(isbn: str) -> tuple[str, str]:
    path = DETAIL / f"{isbn}.json"
    if not path.exists():
        return "", ""
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    if not items:
        return "", ""
    it = items[0]
    cd = it.get("contentDetail") or {}
    return it.get("title") or "", f"{cd.get('bookIntroduction') or ''}\n{cd.get('tableOfContents') or ''}"


def tag_book(topic: str, title: str, body: str) -> list[str]:
    tags = []
    for kw, pattern in VOCAB[topic].items():
        hits = 2 * len(re.findall(pattern, title)) + len(re.findall(pattern, body))
        if hits >= MIN_HITS:
            tags.append(kw)
    return tags


def main() -> None:
    rows = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    books = [r for r in rows if r["entry"] == "target" and r["status"] in ("picked", "reserve")]
    tags_draft, vocab = {}, {}
    for topic in VOCAB:
        picked = [b for b in books if b["slot"] == topic and b["status"] == "picked"]
        counts = {kw: [] for kw in VOCAB[topic]}
        for b in [x for x in books if x["slot"] == topic]:
            title, body = book_text(b["isbn"])
            tags = tag_book(topic, title, body)
            tags_draft[b["isbn"]] = {"title": b["title"], "topic": topic, "status": b["status"], "keywords": tags}
            if b["status"] == "picked":
                for kw in tags:
                    counts[kw].append(b["isbn"])
        vocab[topic] = {
            "books": len(picked),
            "kept": {kw: {"pattern": VOCAB[topic][kw], "n": len(v)} for kw, v in counts.items()
                     if MIN_BOOKS <= len(v) <= MAX_SHARE * len(picked)},
            "folded": {kw: len(v) for kw, v in counts.items() if len(v) < MIN_BOOKS},
            "too_common": {kw: len(v) for kw, v in counts.items() if len(v) > MAX_SHARE * len(picked)},
            "untagged": sum(1 for b in picked if not tags_draft[b["isbn"]]["keywords"]),
        }
        kept = ", ".join(f"{k}({v['n']})" for k, v in vocab[topic]["kept"].items())
        folded = ", ".join(f"{k}({n})" for k, n in vocab[topic]["folded"].items())
        common = ", ".join(f"{k}({n})" for k, n in vocab[topic]["too_common"].items())
        print(f"{topic:<8} 유지: {kept}\n{'':9}합침: {folded or '-'}  · 너무 흔함: {common or '-'}"
              f"  · 키워드 없는 책 {vocab[topic]['untagged']}")
    OUT_VOCAB.write_text(json.dumps(vocab, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_TAGS.write_text(json.dumps(tags_draft, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"saved: {OUT_VOCAB.relative_to(ROOT)}, {OUT_TAGS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
