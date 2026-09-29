"""Minimal client for the Google Stitch MCP endpoint (JSON-RPC over streamable HTTP).

The API key is read from .env (STITCH_API_KEY) and never printed; it is masked in any error text.
Usage (as a module): from stitch_client import StitchClient
"""
import json
import urllib.error
import urllib.request

from compare_apis import load_env

ENDPOINT = "https://stitch.googleapis.com/mcp"


class StitchClient:
    def __init__(self) -> None:
        self.key = load_env().get("STITCH_API_KEY", "")
        if not self.key:
            raise SystemExit("STITCH_API_KEY is empty in .env")
        self.session: str | None = None
        self.next_id = 1

    def _mask(self, text: str) -> str:
        return text.replace(self.key, "***")

    def _post(self, payload: dict) -> str:
        headers = {"X-Goog-Api-Key": self.key, "Content-Type": "application/json",
                   "Accept": "application/json, text/event-stream"}
        if self.session:
            headers["Mcp-Session-Id"] = self.session
        req = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode("utf-8"), headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                self.session = r.headers.get("Mcp-Session-Id") or self.session
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:500]
            raise RuntimeError(self._mask(f"HTTP {e.code}: {detail}")) from None
        except urllib.error.URLError as e:
            raise RuntimeError(self._mask(f"network error: {e.reason}")) from None

    @staticmethod
    def _messages(body: str) -> list[dict]:
        """JSON-RPC messages from a plain JSON body or an SSE stream (multi-line data joined)."""
        text = body.strip()
        if not text:
            return []
        if text[0] in "[{":
            parsed = json.loads(text)
            return parsed if isinstance(parsed, list) else [parsed]
        messages, data = [], []
        for line in body.splitlines() + [""]:
            if line.startswith("data:"):
                data.append(line[5:].lstrip())
            elif not line.strip() and data:
                messages.append(json.loads("\n".join(data)))
                data = []
        return messages

    def rpc(self, method: str, params: dict | None = None) -> dict:
        req_id = self.next_id
        self.next_id += 1
        body = self._post({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}})
        resp = next((m for m in self._messages(body) if m.get("id") == req_id), None)
        if resp is None:
            raise RuntimeError(f"no response for {method}")
        if "error" in resp:
            raise RuntimeError(self._mask(json.dumps(resp["error"], ensure_ascii=False)))
        return resp.get("result", {})

    def start(self) -> dict:
        info = self.rpc("initialize", {"protocolVersion": "2025-03-26", "capabilities": {},
                                       "clientInfo": {"name": "galpi", "version": "0.1"}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return info

    def tool(self, name: str, args: dict | None = None) -> dict:
        result = self.rpc("tools/call", {"name": name, "arguments": args or {}})
        if result.get("isError"):
            text = " ".join(c.get("text", "") for c in result.get("content", []))
            raise RuntimeError(self._mask(f"tool {name} failed: {text[:500]}"))
        return result
