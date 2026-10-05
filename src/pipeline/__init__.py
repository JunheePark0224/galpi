"""D-B daily book pipeline (docs/plans/2026-10-01-d-b-daily-pipeline.md, design 2절).

Run from Galpi/:  python -m src.pipeline.run_daily --date YYYY-MM-DD
The older scripts in src/ import each other flat (`from collect_candidates import …`), so src/ goes on sys.path once
here and the pipeline reuses them as they are (design 2-1: "가져다 쓴다, 복사 금지").
"""
import sys
from datetime import timedelta, timezone
from pathlib import Path

SRC = Path(__file__).resolve().parents[1]
ROOT = SRC.parent
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

BOOKS = ROOT / "web" / "src" / "data" / "books.json"
VOCAB = ROOT / "data" / "processed" / "keyword_vocab.json"
ADDITIONS = ROOT / "data" / "processed" / "additions"
PIPELINE = ROOT / "data" / "pipeline"
CONFIG = PIPELINE / "config.json"
AGREEMENT = PIPELINE / "agreement.csv"
REQUEUE = PIPELINE / "requeue.json"  # books going back in as the other entry (pipeline/requeue.py)
RUNS = PIPELINE / "runs"
KST = timezone(timedelta(hours=9))  # the day of a run is the Korean day (Actions runs at 06:00 KST)
