"""Design check for book pool size, genre mix and redraw randomness (no real users, no real books).

Builds a synthetic 🍃 pool (100 books) and 🎯 pool with the planned genre / topic mix, then runs
every possible answer combination through the planned draw rule and reports:
  fill      share of answer combos whose draw 1 gets 4 books with a positive score
  depth     consecutive "good" draws (mean score of the 4 picks >= 50% of the user's best possible);
            users who chose nothing (best possible = 0) are left out of depth
  genres    distinct genres among the 5 bookmarks of a draw (🍃)
  overlap   Jaccard of draw-1 picks for two users with identical answers (freshness)
  exposure  Gini of how often each book is shown to 2,000 simulated users, and books never shown

Usage:  python src/simulate_draws.py
Output: printed tables + data/processed/simulate_draws.json
Tag probabilities per genre are assumptions for design only — rerun with real tags after D3.
"""
import itertools
import json
import math
import random
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "processed" / "simulate_draws.json"

Book = dict
User = dict
Scored = tuple[float, Book]
ScoreFn = Callable[[Book, User], float]
PoolFn = Callable[[list[Book], User], list[Book]]

# + side / - side: 따뜻함/여운, 문장/몰입, 알게 됨/마음, 현실/딴 세상
AXES = ("temp", "pull", "gain", "world")


def _p(temp: tuple, pull: tuple, gain: tuple, world: tuple) -> dict:
    """Per-axis tag probabilities (p_plus, p_zero, p_minus)."""
    return {"temp": temp, "pull": pull, "gain": gain, "world": world}


# genre: (count, axis probabilities, mean pages)
LEAF_GENRES = {
    "한국 소설": (12, _p((.35, .25, .40), (.50, .20, .30), (.10, .20, .70), (.80, .10, .10)), 300),
    "외국 소설": (12, _p((.35, .25, .40), (.40, .20, .40), (.10, .20, .70), (.60, .20, .20)), 340),
    "SF·판타지": (14, _p((.30, .30, .40), (.20, .20, .60), (.25, .25, .50), (.05, .10, .85)), 420),
    "추리·스릴러": (14, _p((.10, .20, .70), (.10, .10, .80), (.10, .30, .60), (.70, .10, .20)), 400),
    "에세이": (18, _p((.70, .20, .10), (.70, .20, .10), (.20, .20, .60), (.90, .10, .00)), 240),
    "시": (5, _p((.40, .20, .40), (.90, .10, .00), (.00, .10, .90), (.60, .30, .10)), 150),
    "인문": (10, _p((.30, .40, .30), (.40, .30, .30), (.80, .10, .10), (.90, .10, .00)), 330),
    "과학 교양": (10, _p((.30, .40, .30), (.30, .30, .40), (.90, .10, .00), (.70, .20, .10)), 350),
    "예술·여행": (5, _p((.60, .30, .10), (.60, .30, .10), (.40, .30, .30), (.90, .10, .00)), 250),
}
TARGET_TOPICS = ("데이터 분석", "통계", "AI 활용", "업무 자동화", "습관·집중", "시간·생산성")
DEFAULT_PER_TOPIC = (17, 17, 17, 17, 16, 16)  # = 100 books
FIELD_OF = {"데이터 분석": "데이터", "통계": "데이터", "AI 활용": "AI", "업무 자동화": "AI",
            "습관·집중": "자기계발", "시간·생산성": "자기계발"}

GOOD_SHARE = 0.5
MAX_SAME_GENRE = 2
DRAWS = 6
NO_MATCH = -99.0


def sample_tag(p: tuple, rng: random.Random) -> int:
    r = rng.random()
    return 1 if r < p[0] else (0 if r < p[0] + p[1] else -1)


def length_tag(pages: int) -> int:
    return 1 if pages <= 250 else (-1 if pages >= 400 else 0)


def build_leaf(rng: random.Random) -> list[Book]:
    books: list[Book] = []
    for genre, (n, probs, mean_pages) in LEAF_GENRES.items():
        for _ in range(n):
            pages = max(90, int(rng.gauss(mean_pages, 80)))
            books.append({"id": len(books), "genre": genre, "len": length_tag(pages),
                          **{a: sample_tag(probs[a], rng) for a in AXES}})
    return books


def build_target(rng: random.Random, per_topic: tuple[int, ...]) -> list[Book]:
    books: list[Book] = []
    for topic, n in zip(TARGET_TOPICS, per_topic):
        for k in range(n):
            pages = max(120, int(rng.gauss(300, 90)))
            books.append({"id": len(books), "topic": topic, "field": FIELD_OF[topic], "genre": topic,
                          "level": k % 3 + 1, "way": rng.choice(["개념", "실습", "사례"]),
                          "len": length_tag(pages)})
    return books


def leaf_score(book: Book, user: User) -> float:
    """An axis left empty (None, 비움 — label-dictionary v3.1 rule 9) adds 0, as in web/src/lib/recommend/score.ts."""
    return sum(user[a] * (book[a] or 0) for a in AXES) + user["len"] * book["len"]


def target_score(book: Book, user: User) -> float:
    if book["topic"] != user["topic"]:
        return NO_MATCH
    s = 0.0
    if user["level"]:
        s += {0: 2, 1: 1}.get(abs(book["level"] - user["level"]), 0)
    if user["way"]:
        s += 2 if book["way"] == user["way"] else 0
    if user["len"]:
        s += 2 if book["len"] == user["len"] else (-1 if book["len"] == -user["len"] else 0)
    return s


def max_possible(kind: str, user: User) -> float:
    if kind == "leaf":
        return sum(abs(user[a]) for a in AXES) + abs(user["len"])
    return (2 if user["level"] else 0) + (2 if user["way"] else 0) + (2 if user["len"] else 0)


def weighted_pick(cands: list[Scored], k: int, tau: float, rng: random.Random,
                  max_same: int) -> list[Scored]:
    """Weighted sampling without replacement (weight = e^((score - top)/tau)); tau=0 = strict top-k."""
    pool = list(cands)
    picked: list[Scored] = []
    per_genre: dict[str, int] = {}
    while pool and len(picked) < k:
        if tau == 0:
            pool.sort(key=lambda c: (-c[0], rng.random()))
            choice = pool[0]
        else:
            top = max(c[0] for c in pool)
            choice = rng.choices(pool, weights=[math.exp((c[0] - top) / tau) for c in pool])[0]
        pool.remove(choice)
        g = choice[1]["genre"]
        if per_genre.get(g, 0) >= max_same:
            continue
        per_genre[g] = per_genre.get(g, 0) + 1
        picked.append(choice)
    return picked


def draw(books: list[Book], user: User, seen: set[int], score_fn: ScoreFn, tau: float,
         delta: float, rng: random.Random, max_same: int,
         random_pool: PoolFn) -> tuple[list[Scored], Book | None]:
    cands = [(score_fn(b, user), b) for b in books if b["id"] not in seen]
    cands = [c for c in cands if c[0] > NO_MATCH]
    if not cands:
        return [], None
    best = max(c[0] for c in cands)
    picks: list[Scored] = []
    d = delta
    while len(picks) < 4 and d <= 20:
        picks = weighted_pick([c for c in cands if c[0] >= best - d], 4, tau, rng, max_same)
        d += 1
    blocked = seen | {p[1]["id"] for p in picks}
    genres = [p[1]["genre"] for p in picks]
    rnd_cands = [b for b in random_pool(books, user)
                 if b["id"] not in blocked and genres.count(b["genre"]) < max_same]
    return picks, (rng.choice(rnd_cands) if rnd_cands else None)


def gini(values: list[int]) -> float:
    v = sorted(values)
    n, total = len(v), sum(v)
    if total == 0:
        return 0.0
    return (2 * sum((i + 1) * x for i, x in enumerate(v))) / (n * total) - (n + 1) / n


def leaf_users() -> list[User]:
    vals = (-2, -1, 0, 1, 2)  # ±1 when one of the two answers was "갈피를 못 잡겠어요"
    return [dict(zip(AXES, combo), len=ln)
            for combo in itertools.product(vals, repeat=4) for ln in (-1, 0, 1)]


def target_users() -> list[User]:
    return [{"topic": t, "level": lv, "way": w, "len": ln}
            for t in TARGET_TOPICS for lv in (0, 1, 2, 3)
            for w in (None, "개념", "실습", "사례") for ln in (0, 1, -1)]


def random_pool_for(kind: str, scope: str) -> PoolFn:
    if kind == "leaf":
        return lambda bs, u: bs
    if scope == "field_other_topic":
        return lambda bs, u: [b for b in bs if b["field"] == FIELD_OF[u["topic"]]
                              and b["topic"] != u["topic"]]
    return lambda bs, u: [b for b in bs if b["field"] == FIELD_OF[u["topic"]]]


def run(kind: str, tau: float, delta: float, per_topic: tuple[int, ...] = DEFAULT_PER_TOPIC,
        scope: str = "field", seed: int = 7) -> dict:
    rng = random.Random(seed)
    books = build_leaf(rng) if kind == "leaf" else build_target(rng, per_topic)
    score_fn = leaf_score if kind == "leaf" else target_score
    max_same = MAX_SAME_GENRE if kind == "leaf" else 99
    random_pool = random_pool_for(kind, scope)
    users = leaf_users() if kind == "leaf" else target_users()

    fill = genre_sum = genre_n = overlap_sum = 0.0
    depth_sum = depth_users = depth_ok = overlap_n = 0
    for u in users:
        best_possible = max_possible(kind, u)
        good = GOOD_SHARE * best_possible
        seen: set[int] = set()
        depth = 0
        for k in range(DRAWS):
            picks, rnd = draw(books, u, seen, score_fn, tau, delta, rng, max_same, random_pool)
            if len(picks) < 4:
                break
            mean = sum(p[0] for p in picks) / 4
            if k == 0:
                fill += all(p[0] > 0 for p in picks)
            if mean >= good and depth == k:
                depth += 1
            shown = [p[1] for p in picks] + ([rnd] if rnd else [])
            genre_sum += len({b["genre"] for b in shown})
            genre_n += 1
            seen |= {b["id"] for b in shown}
        if best_possible > 0:
            depth_sum += depth
            depth_users += 1
            depth_ok += depth >= 4
        a, _ = draw(books, u, set(), score_fn, tau, delta, random.Random(rng.random()),
                    max_same, random_pool)
        b, _ = draw(books, u, set(), score_fn, tau, delta, random.Random(rng.random()),
                    max_same, random_pool)
        sa, sb = {p[1]["id"] for p in a}, {p[1]["id"] for p in b}
        if sa | sb:
            overlap_sum += len(sa & sb) / len(sa | sb)
            overlap_n += 1

    exposure = [0] * len(books)
    for _user in range(2000):
        u = rng.choice(users)
        seen = set()
        for _draw in range(rng.choice([1, 1, 2, 2, 3])):
            picks, rnd = draw(books, u, seen, score_fn, tau, delta, rng, max_same, random_pool)
            for bk in [p[1] for p in picks] + ([rnd] if rnd else []):
                exposure[bk["id"]] += 1
                seen.add(bk["id"])
    n = len(users)
    return {"kind": kind, "tau": tau, "delta": delta, "books": len(books), "scope": scope,
            "combos": n, "fill_pct": round(100 * fill / n, 1),
            "depth_mean": round(depth_sum / depth_users, 2),
            "depth4_pct": round(100 * depth_ok / depth_users, 1),
            "genres_per_draw": round(genre_sum / genre_n, 2) if kind == "leaf" else None,
            "overlap_same_answers": round(overlap_sum / overlap_n, 2),
            "exposure_gini": round(gini(exposure), 2),
            "never_shown": sum(e == 0 for e in exposure)}


def main() -> None:
    settings = [(0, 0), (0.5, 2), (1.0, 2), (2.0, 3)]
    rows = [run("leaf", t, d) for t, d in settings]
    for per_topic in (DEFAULT_PER_TOPIC, (25,) * 6):
        for scope in ("field", "field_other_topic"):
            rows += [run("target", t, d, per_topic, scope) for t, d in [(0.5, 2), (1.0, 2)]]
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    head = ("pool", "books", "random", "tau", "Δ", "fill%", "depth", "≥4draw%", "genres",
            "overlap", "gini", "never")
    print(" ".join(f"{h:>8}" for h in head))
    for r in rows:
        vals = (r["kind"], r["books"], r["scope"] if r["kind"] == "target" else "-", r["tau"],
                r["delta"], r["fill_pct"], r["depth_mean"], r["depth4_pct"],
                r["genres_per_draw"], r["overlap_same_answers"], r["exposure_gini"],
                r["never_shown"])
        print(" ".join(f"{str(v)[:8]:>8}" for v in vals))
    print(f"saved: {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
