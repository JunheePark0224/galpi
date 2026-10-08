"""Message Batches mode of the daily run (route plan 10-08 "비용"): the same requests at half the price.

A run tags its books in rounds. Each round runs every waiting book's tag_one through a Recorder: a request answered by an
earlier batch is replayed from its result, any other is recorded and the book waits (Waiting). The round's recorded
requests go out as one batch (`send`); the next round replays the books with the answers. Pass B of every book is asked
ahead in the first round (run_daily.prefetch), so a book both passes agree on is done after one batch. A replay is free:
the run's usage is what the batches answered (`Recorder.spent`) — a prefetched pass B whose book failed included. A request the batch could not answer (errored / canceled / expired)
comes back as a message with stop_reason `batch_<type>`: that book fails like a refused answer; the others go on.
Requests are keyed by a hash of their whole body (custom_id); results carry our tags only — nothing is written here.
"""
import hashlib
import json
from collections import Counter
from types import SimpleNamespace

import anthropic

from .tagger import TaggerStop, Usage, _usage

DISCOUNT = 0.5    # batch price / list price (Message Batches API)
POLL_EVERY = 60   # seconds between status checks; a batch ends within 24 hours (unanswered requests expire)
PATIENCE = 10     # status / result reads failing in a row (connection, 5xx) before a sent batch is given up


class Waiting(Exception):
    """The request is out in the next batch; its book waits for the next round."""


def key(kwargs: dict) -> str:
    """custom_id of a request: the hash of its whole body (64 hex characters, the API's limit)."""
    return hashlib.sha256(json.dumps(kwargs, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def row(custom_id: str, kwargs: dict) -> dict:
    """One batch request: the SDK-only `extra_body` options go into the request body itself."""
    params = {k: v for k, v in kwargs.items() if k != "extra_body"} | dict(kwargs.get("extra_body") or {})
    return {"custom_id": custom_id, "params": params}


class Recorder:
    """A client whose messages.create answers from earlier batches' results and records any other request (Waiting).
    A book may ask the very same thing twice — pass C repeats pass B word for word (tiebreak.py) — and each must be its
    own request, or pass C would replay pass B's answer: the n-th asking within one book's run (`begin` starts one) has
    its own key; so has every book (two editions with the same text are asked apart, like a direct run asks them)."""

    def __init__(self):
        self.answers: dict[str, object] = {}
        self.pending: dict[str, dict] = {}
        self.spent: dict[str, Usage] = {}
        self.messages, self.asked, self.book = self, Counter(), ""

    def begin(self, isbn: str) -> None:
        """A book's run starts (again): its requests count from the first."""
        self.asked, self.book = Counter(), isbn

    def _key(self, kwargs: dict, n: int) -> str:
        return hashlib.sha256(f"{key(kwargs)}:{self.book}:{n}".encode()).hexdigest()

    def expect(self, isbn: str, kwargs: dict) -> None:
        """Ask for `kwargs` in the next batch now, as book `isbn`'s first asking of it (pass B ahead of pass A's answer)."""
        self.book = isbn
        if (k := self._key(kwargs, 0)) not in self.answers:
            self.pending[k] = kwargs

    def create(self, **kwargs):
        n = self.asked[key(kwargs)]
        self.asked[key(kwargs)] += 1
        k = self._key(kwargs, n)
        if k in self.answers:
            return self.answers[k]
        self.pending[k] = kwargs
        raise Waiting(k)


def _unanswered(kind: str) -> SimpleNamespace:
    usage = SimpleNamespace(input_tokens=0, output_tokens=0, cache_read_input_tokens=0, cache_creation_input_tokens=0)
    return SimpleNamespace(stop_reason=f"batch_{kind}", content=[], usage=usage)


def send(client, recorder: Recorder, sleep, every: int = POLL_EVERY) -> str:
    """Send the recorder's pending requests as one batch, wait for it to end, and file every result as an answer. Returns
    the batch id. Raises TaggerStop when the Batches API fails (the id, when there is one, is in the message)."""
    try:
        batch_id = client.messages.batches.create(requests=[row(k, kw) for k, kw in recorder.pending.items()]).id
    except anthropic.APIError as err:
        raise TaggerStop(f"batch (not created): {type(err).__name__}") from None
    _patiently(lambda: _wait(client, batch_id, sleep, every), batch_id, sleep, every)
    results = _patiently(lambda: list(client.messages.batches.results(batch_id)), batch_id, sleep, every)
    for r in results:
        res, model = r.result, recorder.pending.get(r.custom_id, {}).get("model")
        msg = res.message if res.type == "succeeded" else _unanswered(res.type)
        recorder.answers[r.custom_id] = msg
        if model:
            recorder.spent[model] = recorder.spent.get(model, Usage()).plus(
                _usage(msg) if res.type == "succeeded" else Usage(1, 1))
    for k in recorder.pending:  # a request with no result never leaves its book waiting forever
        recorder.answers.setdefault(k, _unanswered("missing"))
    recorder.pending = {}
    return batch_id


def _wait(client, batch_id: str, sleep, every: int) -> None:
    while client.messages.batches.retrieve(batch_id).processing_status != "ended":
        sleep(every)


def _patiently(read, batch_id: str, sleep, every: int):
    """`read()`, tried again on a connection error or a 5xx (a sent batch is paid for — one bad minute in hours of
    polling must not lose it); any other error, or PATIENCE failures in a row, stops the run with the batch id."""
    for tries in range(1, PATIENCE + 1):
        try:
            return read()
        except (anthropic.APIConnectionError, anthropic.InternalServerError) as err:
            if tries == PATIENCE:
                raise TaggerStop(f"batch {batch_id}: {type(err).__name__} ×{PATIENCE}") from None
        except anthropic.APIError as err:
            raise TaggerStop(f"batch {batch_id}: {type(err).__name__}") from None
        sleep(every)
