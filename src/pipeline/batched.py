"""Message Batches mode of the daily run (route plan 10-08 "비용"): the same requests at half the price.

A run tags its books in rounds. Each round runs every waiting book's tag_one through a Recorder: a request answered by an
earlier batch is replayed from its result, any other is recorded and the book waits (Waiting). The round's recorded
requests go out as one batch (`send`); the next round replays the books with the answers. Pass B of every book is asked
ahead in the first round (run_daily.prefetch), so a book both passes agree on is done after one batch. A replay is free —
a book's token use is counted once, when it finishes. A request the batch could not answer (errored / canceled / expired)
comes back as a message with stop_reason `batch_<type>`: that book fails like a refused answer; the others go on.
Requests are keyed by a hash of their whole body (custom_id); results carry our tags only — nothing is written here.
"""
import hashlib
import json
from collections import Counter
from types import SimpleNamespace

import anthropic

from .tagger import TaggerStop

DISCOUNT = 0.5    # batch price / list price (Message Batches API)
POLL_EVERY = 60   # seconds between status checks; a batch ends within 24 hours (unanswered requests expire)


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
    its own key."""

    def __init__(self):
        self.answers: dict[str, object] = {}
        self.pending: dict[str, dict] = {}
        self.messages, self.asked = self, Counter()

    def begin(self) -> None:
        """A book's run starts (again): its requests count from the first."""
        self.asked = Counter()

    def expect(self, kwargs: dict) -> None:
        """Ask for `kwargs` in the next batch now, as a book's first asking of it (pass B ahead of pass A's answer)."""
        if key(kwargs) not in self.answers:
            self.pending[key(kwargs)] = kwargs

    def create(self, **kwargs):
        base = key(kwargs)
        n, self.asked[base] = self.asked[base], self.asked[base] + 1
        k = base if n == 0 else hashlib.sha256(f"{base}:{n}".encode()).hexdigest()
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
    batch_id = None
    try:
        batch_id = client.messages.batches.create(requests=[row(k, kw) for k, kw in recorder.pending.items()]).id
        while client.messages.batches.retrieve(batch_id).processing_status != "ended":
            sleep(every)
        for r in client.messages.batches.results(batch_id):
            res = r.result
            recorder.answers[r.custom_id] = res.message if res.type == "succeeded" else _unanswered(res.type)
    except anthropic.APIError as err:
        raise TaggerStop(f"batch {batch_id or '(not created)'}: {type(err).__name__}") from None
    for k in recorder.pending:  # a request with no result never leaves its book waiting forever
        recorder.answers.setdefault(k, _unanswered("missing"))
    recorder.pending = {}
    return batch_id
