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
PAGES_FOR_TAG = {1: 200, 0: 300, -1: 450}  # keeps lengthTag identical to the Python tag


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    books = sim.build_leaf(random.Random(7))          # same pool run("leaf", ...) builds with seed 7
    pool = [{"id": str(b["id"]), "entry": "leaf", "genre": b["genre"], "pages": PAGES_FOR_TAG[b["len"]],
             "axes": {a: b[a] for a in sim.AXES}} for b in books]
    metrics = sim.run("leaf", 1.0, 2)
    (OUT / "leaf_pool.json").write_text(json.dumps(pool, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "leaf_metrics.json").write_text(json.dumps(
        {"fill_pct": metrics["fill_pct"], "overlap": metrics["overlap_same_answers"],
         "genres_per_draw": metrics["genres_per_draw"]}, indent=1), encoding="utf-8")
    print(f"pool {len(pool)} books, metrics {metrics['fill_pct']}% fill, overlap {metrics['overlap_same_answers']}")


if __name__ == "__main__":
    main()
