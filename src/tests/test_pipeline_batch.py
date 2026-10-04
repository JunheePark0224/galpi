"""Pipeline: batch ids — more than one run on the same day (src/pipeline/batch.py)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import batch  # noqa: E402
from pipeline.batch import BatchError, is_batch, make, next_free, parse, sort_key  # noqa: E402

DAY = "2026-10-06"


def test_the_first_batch_is_the_plain_date_and_later_ones_are_numbered():
    assert parse(DAY) == (DAY, 1) and parse(f"{DAY}-2") == (DAY, 2) and parse(f"{DAY}-12") == (DAY, 12)
    assert make(DAY, 1) == DAY and make(DAY, 3) == f"{DAY}-3"
    assert all(parse(make(DAY, n)) == (DAY, n) for n in range(1, 15))


@pytest.mark.parametrize("bad", [f"{DAY}-1", f"{DAY}-01", f"{DAY}-0", f"{DAY}-pilot", f"{DAY}-pilot-ai2", "2026-13-01",
                                 "2026-02-30-2", "20261006", "", f" {DAY}", f"{DAY}-2.json", f"books/{DAY}"])
def test_anything_else_is_not_a_batch_id(bad):
    assert not is_batch(bad)
    with pytest.raises(BatchError):
        parse(bad)


def test_batches_sort_by_day_then_number_not_by_text():
    ids = [f"{DAY}-10", "2026-10-07", f"{DAY}-2", DAY, f"{DAY}-9", "2026-10-05-3"]
    assert sorted(ids, key=sort_key) == ["2026-10-05-3", DAY, f"{DAY}-2", f"{DAY}-9", f"{DAY}-10", "2026-10-07"]
    assert sort_key("10-025") == ("10-025", 0)  # not a batch id: still sortable, by its text


def test_next_free_batch_follows_files_on_main_and_branches():
    assert next_free(DAY, []) == DAY                                                     # nothing yet: as before
    assert next_free(DAY, [f"{DAY}.json"]) == f"{DAY}-2"
    assert next_free(DAY, [f"{DAY}.json", f"{DAY}-2.json"]) == f"{DAY}-3"
    assert next_free(DAY, [f"{DAY}.json", f"refs/heads/books/{DAY}-2"]) == f"{DAY}-3"  # a left-over branch is taken too
    assert next_free(DAY, [f"books/{DAY}"]) == f"{DAY}-2"                               # unmerged first batch
    assert next_free(DAY, [f"{DAY}.json", f"{DAY}-9.json"]) == f"{DAY}-10"               # after the highest, never a gap
    other = ["2026-10-01-pilot.json", "2026-10-01-pilot-ai2.json", "2026-10-05.json", "2026-10-05-4.json", f"{DAY}-pilot.json"]
    assert next_free(DAY, other) == DAY                                                  # other days and files do not count
    with pytest.raises(BatchError):
        next_free(f"{DAY}-2", [])


def test_the_workflow_gate_command_prints_only_the_id(capsys):
    assert batch.main(["next", "--date", DAY, f"{DAY}.json", "2026-10-01-pilot.json", f"refs/heads/books/{DAY}-2"]) == 0
    assert capsys.readouterr().out == f"{DAY}-3\n"
    assert batch.main(["next", "--date", "2026-10-6"]) == 1 and "not a batch id" in capsys.readouterr().err


def test_the_workflow_gives_the_batch_id_to_every_keyed_step():
    flow = (Path(__file__).resolve().parents[2] / ".github" / "workflows" / "daily-books.yml").read_text(encoding="utf-8")
    assert "next_batch:" in flow and "python3 -m src.pipeline.batch next" in flow
    assert "$DAY" not in flow and "outputs.date }}." not in flow
    for keyed in ('run_daily --batch "$BATCH"', '"data/pipeline/runs/$BATCH.json"', 'report --batch "$BATCH"',
                  'branch="books/$BATCH"', '"data/processed/additions/$BATCH.json"', "dry-run-${{ needs.gate.outputs.batch }}"):
        assert keyed in flow
    assert flow.count("secrets.") == 2  # the keys still reach one step only
