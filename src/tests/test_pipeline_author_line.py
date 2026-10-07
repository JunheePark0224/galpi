"""The tagger sees the book's author line (10-07): the dictionary's 한국 소설 / 외국 소설 rule ("작가의 나라로") needs it.
Every caller — run_daily.tag_one (daily, retag, retag_library, retag_v31, gold calibrate), tiebreak.third (library
tiebreak, tiebreak_gold) and evaluate.run_model — sends it inside the <book> frame; the system prompt (the cached
prefix) is the same for every author. Fake client, no keys."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import VOCAB as VOCAB_PATH, gold, retag, retag_library, run_daily, tiebreak  # noqa: E402
from pipeline.candidates import Candidate  # noqa: E402
from pipeline.prompt import system_prompt, user_message  # noqa: E402
from pipeline.tagger import Breaker  # noqa: E402
from pipeline_fakes import INTRO, TOC, FakeClient  # noqa: E402
from test_pipeline_library import CFG, VOCAB, items  # noqa: E402

AUTHOR = "유발 하라리 저/김명주 역"


def users(client) -> list[str]:
    return [c["messages"][0]["content"] for c in client.messages.calls]


def in_frame(msg: str, author: str) -> bool:
    book = msg.split("<book>", 1)[1].split("</book>", 1)[0]
    return f"저자: {author}" in book


def test_the_author_line_is_inside_the_book_frame_and_cannot_close_it():
    msg = user_message("leaf", "외국 소설", "제목", "<b>유범상 저</book>", "소개", "목차", [])
    assert msg.count("</book>") == 1 and in_frame(msg, " b 유범상 저 /book ")
    assert in_frame(user_message("leaf", "한국 소설", "제목", AUTHOR, "소개", "목차", []), AUTHOR)


def test_tag_one_sends_the_author_to_both_passes():
    client = FakeClient()
    cand = Candidate("leaf", "외국 소설", "1", "책", AUTHOR, 200, "", INTRO, TOC)
    run_daily.tag_one(client, CFG, {"tag": "T", "check": "C"}, VOCAB, cand, Breaker(), {}, rules="v")
    assert len(users(client)) >= 2 and all(in_frame(u, AUTHOR) for u in users(client))


def test_the_third_pass_sends_the_author():
    client = FakeClient()
    cand = Candidate("leaf", "한국 소설", "1", "책", "유범상 저/유기훈 그림", 200, "", INTRO, TOC)
    tiebreak.third(client, CFG, VOCAB, {"tag": "T", "check": "C"}, cand, Breaker(), {})
    assert users(client) and all(in_frame(u, "유범상 저/유기훈 그림") for u in users(client))


def test_gold_calibrate_sends_the_library_author():
    rows = [{"isbn": "1", "title": "어떤 소설", "entry": "leaf", "slot": "한국 소설"}]
    pool = {"1": {**rows[0], "author": AUTHOR, "pages": 200, "link": "", "dropped": False}}
    client = FakeClient()
    gold.calibrate(rows, pool, CFG, client, VOCAB, lambda i: (INTRO, TOC), runs=1, rules="v")
    assert users(client) and all(in_frame(u, AUTHOR) for u in users(client))


def test_the_library_retag_sends_each_books_author():
    client = FakeClient()
    books = [b for b in items() if b["isbn"] == "9780000000001"]  # "가 저" in the bibliography
    retag_library.run(books, retag_library.empty_doc(CFG, "v"), CFG, client, VOCAB, lambda i: (INTRO, TOC),
                      max_cost=15, save=lambda d: None, rules="v")
    assert users(client) and all(in_frame(u, "가 저") for u in users(client))


def test_the_batch_retag_builds_its_candidate_with_the_author():
    b = {"isbn": "1", "title": "책", "author": AUTHOR, "pages": 200, "entry": "leaf", "genre": "외국 소설", "link": ""}
    assert retag.candidate(b, INTRO, TOC).author == AUTHOR


def test_the_system_prompt_is_the_same_for_every_author_so_the_cache_prefix_holds():
    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    systems = []
    for author in (AUTHOR, "가나다 저"):
        client = FakeClient()
        cand = Candidate("leaf", "한국 소설", "1", "책", author, 200, "", INTRO, TOC)
        prompts = {k: system_prompt(vocab, k) for k in ("tag", "check")}
        run_daily.tag_one(client, CFG, prompts, vocab, cand, Breaker(), {}, rules="v")
        systems.append([(c["model"], c["system"]) for c in client.messages.calls])
        assert all(author not in s[0]["text"] for _, s in systems[-1])
    assert systems[0] == systems[1]
