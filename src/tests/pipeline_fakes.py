"""Fakes for the pipeline tests: a fake Anthropic client and a fake YES24 cache — no keys, no network."""
import json
from pathlib import Path
from types import SimpleNamespace

INTRO = ("주식 투자를 처음 시작하는 사회초년생을 위해 계좌 만들기부터 배당과 분산 투자까지 차근차근 설명한다. "
         "저자는 십 년 넘게 개인 투자자를 가르쳐 온 경험으로 흔한 실수와 피하는 법을 사례로 보여 준다.")
TOC = "1장 왜 주식인가<br>2장 계좌와 주문<br>3장 배당과 분산<br>4장 흔한 실수"


SIGNALS = {"temp": "끝맺음 +: 다시 일어서는 마무리", "pull": "몰입: 실패담이 이어짐", "gain": "0 반반: 방법과 다짐",
           "world": "현실: 개인 투자자의 삶"}  # 🍃 per-axis signal lines (10-06), our own words


def message(payload: dict, stop: str = "end_turn", tokens: tuple[int, int] = (1000, 100)) -> SimpleNamespace:
    usage = SimpleNamespace(input_tokens=tokens[0], output_tokens=tokens[1], cache_read_input_tokens=0,
                            cache_creation_input_tokens=0)
    content = [SimpleNamespace(type="text", text=json.dumps(payload, ensure_ascii=False))]
    return SimpleNamespace(stop_reason=stop, content=content, usage=usage)


def tag_answer(entry: str, **over) -> dict:
    if entry == "target":
        base = {"fits": True, "keywords": ["주식"], "way": "개념", "one_liner": "배당과 분산 투자로 주식의 첫걸음을 알려줘요",
                "evidence": "입문자용 주식 기초서", "confidence": 0.9, "new_keyword": ""}
    else:
        base = {"fits": True, "temp": 1, "pull": -1, "gain": 0, "world": 1, "signals": SIGNALS, "missing": [],
                "one_liner": "투자 실수 앞에서 사람은 무엇을 배울까요?", "evidence": "경험담 중심의 이야기", "confidence": 0.9}
    return base | over


def check_answer(entry: str, **over) -> dict:
    base = ({"fits": True, "keywords": ["주식"], "way": "개념"} if entry == "target"
            else {"fits": True, "temp": 1, "pull": -1, "gain": 0, "world": 1, "signals": SIGNALS, "missing": []})
    return base | {"why": "주식 입문서"} | over


class FakeMessages:
    def __init__(self, answer):
        self.answer, self.calls = answer, []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.answer(kwargs)


class FakeClient:
    """`answer(kwargs)` → a message; by default every call agrees (pass A = tag_answer, pass B = check_answer)."""

    def __init__(self, answer=None):
        self.messages = FakeMessages(answer or agreeing)


def kind_of(kwargs: dict) -> tuple[str, str]:
    """(entry, kind): kind "tag" (pass A), "check" (pass B), "fix" (a one-liner retry — its schema has one field, so the
    entry is read from the first answer sent back) or "axisfix" (a 🍃 axis re-ask)."""
    props = kwargs["output_config"]["format"]["schema"]["properties"]
    if "fits" not in props and "signals" in props:  # an axis re-ask (axis_check.py): 🍃 only
        return "leaf", "axisfix"
    if set(props) == {"one_liner"}:
        first = json.loads(kwargs["messages"][1]["content"])
        return ("target" if "way" in first else "leaf"), "fix"
    return ("target" if "way" in props else "leaf"), ("tag" if "one_liner" in props else "check")


def agreeing(kwargs: dict) -> SimpleNamespace:
    entry, kind = kind_of(kwargs)
    if kind == "fix":  # a retry gets the default line of its entry, which passes every rule
        return message({"one_liner": tag_answer(entry)["one_liner"]})
    return message(tag_answer(entry) if kind == "tag" else check_answer(entry))


def yes24_item(isbn: str, title: str, author: str = "가나다 저", rank: int = 1, **over) -> dict:
    return {"isbn13": isbn, "title": title, "author": author, "goodsType": "도서", "adultYn": "N", "itemStatus": "판매중",
            "goodsSortNm": "경제경영", "publisher": "출판사", "publishDate": "2024-01-01", "sortOrder": rank,
            "link": f"https://www.yes24.com/product/goods/{isbn[-6:]}",
            "contentDetail": {"bookIntroduction": INTRO, "tableOfContents": TOC}, **over}


def write_cache(raw: Path, search: dict[str, list[dict]], details: list[dict]) -> None:
    """Search lists (search_<slug>.json) and details (detail/<isbn>.json) in collect_candidates' cache layout."""
    (raw / "lists").mkdir(parents=True, exist_ok=True)
    (raw / "detail").mkdir(parents=True, exist_ok=True)
    for slug, items in search.items():
        (raw / "lists" / f"search_{slug}.json").write_text(json.dumps({"data": {"items": items}}, ensure_ascii=False),
                                                           encoding="utf-8")
    for d in details:
        item = {**d, "starScore": d.get("starScore", 9.2), "pages": d.get("pages", 280)}
        (raw / "detail" / f"{d['isbn13']}.json").write_text(json.dumps({"data": {"items": [item]}}, ensure_ascii=False),
                                                             encoding="utf-8")
