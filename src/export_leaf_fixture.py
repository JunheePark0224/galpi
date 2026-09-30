"""Export the synthetic 🍃 pool and its Python metrics so the TS draw can be checked against them.

Usage:  python src/export_leaf_fixture.py
Output: web/src/lib/recommend/__fixtures__/leaf_pool.json, leaf_metrics.json
"""
import json
import random
from pathlib import Path

import simulate_draws as sim

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "src" / "lib" / "recommend" / "__fixtures__"
SEED = 7
TAU, DELTA = 1.0, 2
PAGES_FOR_TAG = {1: 200, 0: 300, -1: 450}  # keeps lengthTag identical to the Python tag


def first_draw_genres() -> float:
    """Mean genres in the first draw only, replaying run("leaf", ...)'s draw loop so the RNG stream is identical."""
    rng = random.Random(SEED)
    books = sim.build_leaf(rng)
    random_pool = sim.random_pool_for("leaf", "field")
    total = 0
    users = sim.leaf_users()
    for u in users:
        seen: set[int] = set()
        for k in range(sim.DRAWS):
            picks, rnd = sim.draw(books, u, seen, sim.leaf_score, TAU, DELTA, rng, sim.MAX_SAME_GENRE, random_pool)
            if len(picks) < 4:
                break
            shown = [p[1] for p in picks] + ([rnd] if rnd else [])
            if k == 0:
                total += len({b["genre"] for b in shown})
            seen |= {b["id"] for b in shown}
        for _ in range(2):  # run() also draws twice for the overlap check; keep the RNG stream aligned
            sim.draw(books, u, set(), sim.leaf_score, TAU, DELTA, random.Random(rng.random()),
                     sim.MAX_SAME_GENRE, random_pool)
    return total / len(users)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    books = sim.build_leaf(random.Random(SEED))       # same pool run("leaf", ...) builds with this seed
    pool = [{"id": str(b["id"]), "entry": "leaf", "genre": b["genre"], "pages": PAGES_FOR_TAG[b["len"]],
             "axes": {a: b[a] for a in sim.AXES}} for b in books]
    metrics = sim.run("leaf", TAU, DELTA, seed=SEED)
    (OUT / "leaf_pool.json").write_text(json.dumps(pool, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "leaf_metrics.json").write_text(json.dumps(
        {"fill_pct": metrics["fill_pct"], "overlap": metrics["overlap_same_answers"],
         "genres_per_draw": metrics["genres_per_draw"],
         "genres_first_draw": round(first_draw_genres(), 3)}, indent=1), encoding="utf-8")
    print(f"pool {len(pool)} books, metrics {metrics['fill_pct']}% fill, overlap {metrics['overlap_same_answers']}")


if __name__ == "__main__":
    main()
