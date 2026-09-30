"""D3-3: rerun the 🍃 draw simulation with the real tagged books (100 leaf books).

Same users (every answer combination), same draw rule and same metrics as
simulate_draws.run("leaf", tau=1.0, delta=2) — only the books are the real ones:
genre = slot, len = length_tag(pages), temp / pull / gain / world = our axis tags.
Metrics: fill %, depth, genres per draw, first-draw genres, overlap, exposure gini, never shown.
PHASES D3 criteria: first-draw fill >= 95% and genres >= 3.5.

Usage:  PYTHONIOENCODING=utf-8 python src/simulate_real.py
Input:  data/processed/books_v1.json if it exists (reviewed), else books_v1_draft.json
Output: printed table + data/processed/simulate_real.json
"""
import json
import random
import sys
from pathlib import Path

from simulate_draws import (AXES, DRAWS, GOOD_SHARE, MAX_SAME_GENRE, Book, User, draw, gini,
                            leaf_score, leaf_users, length_tag, max_possible, random_pool_for)

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
BOOKS_FINAL = PROCESSED / "books_v1.json"
BOOKS_DRAFT = PROCESSED / "books_v1_draft.json"
OUT = ROOT / "data" / "processed" / "simulate_real.json"

TAU, DELTA, SEED = 1.0, 2, 7
EXPOSURE_USERS = 2000
FILL_TARGET, GENRES_TARGET = 95.0, 3.5


def source_path() -> Path:
    return BOOKS_FINAL if BOOKS_FINAL.exists() else BOOKS_DRAFT


def leaf_pool(rows: list[dict]) -> list[Book]:
    """Real leaf books in simulate_draws' book format."""
    leaf = [r for r in rows if r["entry"] == "leaf"]
    return [{"id": i, "genre": r["genre"], "len": length_tag(r["pages"] or 0),
             **{a: r["axes"][a] for a in AXES}} for i, r in enumerate(leaf)]


def evaluate(books: list[Book], users: list[User], seed: int = SEED) -> dict:
    """The metric loop of simulate_draws.run() for kind == "leaf"."""
    rng = random.Random(seed)
    random_pool = random_pool_for("leaf", "field")
    fill = genre_sum = genre_n = first_genre_sum = first_genre_n = overlap_sum = 0.0
    depth_sum = depth_users = depth_ok = overlap_n = 0
    for u in users:
        best_possible = max_possible("leaf", u)
        good = GOOD_SHARE * best_possible
        seen: set[int] = set()
        depth = 0
        for k in range(DRAWS):
            picks, rnd = draw(books, u, seen, leaf_score, TAU, DELTA, rng, MAX_SAME_GENRE, random_pool)
            if len(picks) < 4:
                break
            mean = sum(p[0] for p in picks) / 4
            shown = [p[1] for p in picks] + ([rnd] if rnd else [])
            n_genres = len({b["genre"] for b in shown})
            if k == 0:
                fill += all(p[0] > 0 for p in picks)
                first_genre_sum += n_genres
                first_genre_n += 1
            if mean >= good and depth == k:
                depth += 1
            genre_sum += n_genres
            genre_n += 1
            seen |= {b["id"] for b in shown}
        if best_possible > 0:
            depth_sum += depth
            depth_users += 1
            depth_ok += depth >= 4
        a, _ = draw(books, u, set(), leaf_score, TAU, DELTA, random.Random(rng.random()),
                    MAX_SAME_GENRE, random_pool)
        b, _ = draw(books, u, set(), leaf_score, TAU, DELTA, random.Random(rng.random()),
                    MAX_SAME_GENRE, random_pool)
        sa, sb = {p[1]["id"] for p in a}, {p[1]["id"] for p in b}
        if sa | sb:
            overlap_sum += len(sa & sb) / len(sa | sb)
            overlap_n += 1

    exposure = [0] * len(books)
    for _user in range(EXPOSURE_USERS):
        u = rng.choice(users)
        seen = set()
        for _draw in range(rng.choice([1, 1, 2, 2, 3])):
            picks, rnd = draw(books, u, seen, leaf_score, TAU, DELTA, rng, MAX_SAME_GENRE, random_pool)
            for bk in [p[1] for p in picks] + ([rnd] if rnd else []):
                exposure[bk["id"]] += 1
                seen.add(bk["id"])
    n = len(users)
    return {"kind": "leaf", "tau": TAU, "delta": DELTA, "books": len(books), "combos": n,
            "fill_pct": round(100 * fill / n, 1),
            "depth_mean": round(depth_sum / depth_users, 2),
            "depth4_pct": round(100 * depth_ok / depth_users, 1),
            "genres_per_draw": round(genre_sum / genre_n, 2),
            "first_draw_genres": round(first_genre_sum / first_genre_n, 2),
            "overlap_same_answers": round(overlap_sum / overlap_n, 2),
            "exposure_gini": round(gini(exposure), 2),
            "never_shown": sum(e == 0 for e in exposure)}


def main() -> int:
    path = source_path()
    if not path.exists():
        print(f"ERROR: {path.relative_to(ROOT)} not found — run build_books_v1.py first", file=sys.stderr)
        return 1
    rows = json.loads(path.read_text(encoding="utf-8"))
    books = leaf_pool(rows)
    if not books:
        print("ERROR: no leaf books in the input", file=sys.stderr)
        return 1
    result = evaluate(books, leaf_users())
    result["source"] = path.name
    result["criteria"] = {
        "fill_ge_95": result["fill_pct"] >= FILL_TARGET,
        "genres_per_draw_ge_3_5": result["genres_per_draw"] >= GENRES_TARGET,
        "first_draw_genres_ge_3_5": result["first_draw_genres"] >= GENRES_TARGET,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"source: {path.name} · {result['books']} leaf books · {result['combos']} answer combos")
    for key in ("fill_pct", "depth_mean", "depth4_pct", "genres_per_draw", "first_draw_genres",
                "overlap_same_answers", "exposure_gini", "never_shown"):
        print(f"  {key:<22} {result[key]}")
    for name, ok in result["criteria"].items():
        print(f"  {name:<24} {'PASS' if ok else 'FAIL'}")
    print(f"saved: {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
