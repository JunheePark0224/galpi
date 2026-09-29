"""Download every screen of the Stitch project (screenshot + HTML) into docs/stitch/exports/.

Read-only: uses list_screens / get_screen only. The API key comes from .env and is never printed.
Downloads are tried WITHOUT the key; the key is added only after a 401/403 from a Google host,
and never follows redirects.
Usage:  python src/fetch_stitch.py [project_id]
"""
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

from stitch_client import StitchClient

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "stitch" / "exports"
PROJECT = "8108840855580886710"  # "갈피 프로젝트"
KEY_HOSTS = (".googleusercontent.com", ".googleapis.com")
IMAGE_MAGIC = {b"\x89PNG": ".png", b"\xff\xd8\xff": ".jpg", b"RIFF": ".webp", b"GIF8": ".gif"}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # keyed requests must not be forwarded elsewhere
        return None


def unwrap(result: dict) -> dict:
    if result.get("structuredContent"):
        return result["structuredContent"]
    for item in result.get("content", []):
        if item.get("type") == "text":
            return json.loads(item["text"])
    raise RuntimeError("tool returned no structured content")


def file_name(title: str | None, screen_name: str) -> str:
    screen_id = screen_name.rsplit("/", 1)[-1][-6:]
    m = re.match(r"(P-\d+)", title or "")
    base = m.group(1) if m else (re.sub(r"[^0-9A-Za-z가-힣]+", "_", title or "").strip("_") or "screen")
    return f"{base}" if m else f"{base}_{screen_id}"


def download(url: str, dest: Path, client: StitchClient) -> str:
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        host = urlparse(url).hostname or ""
        if e.code not in (401, 403) or urlparse(url).scheme != "https" or not host.endswith(KEY_HOSTS):
            return f"failed: HTTP {e.code}"
        opener = urllib.request.build_opener(NoRedirect)
        req = urllib.request.Request(url, headers={"X-Goog-Api-Key": client.key})
        try:
            with opener.open(req, timeout=120) as r:
                data = r.read()
        except urllib.error.HTTPError as e2:
            return f"failed: HTTP {e2.code} (with key)"
    except urllib.error.URLError as e:
        return f"failed: {e.reason}"
    if dest.suffix == ".png":  # screenshots: keep the real image format
        ext = next((e for m, e in IMAGE_MAGIC.items() if data.startswith(m)), None)
        if ext is None:
            return "failed: not an image"
        dest = dest.with_suffix(ext)
    elif dest.suffix == ".html" and not data.lstrip().startswith(b"<"):
        return "failed: not html"
    dest.write_bytes(data)
    return "ok" if dest.suffix in (".png", ".html", ".md") else f"ok ({dest.suffix})"


def main() -> None:
    project = sys.argv[1] if len(sys.argv) > 1 else PROJECT
    OUT.mkdir(parents=True, exist_ok=True)
    c = StitchClient()
    c.start()
    screens = unwrap(c.tool("list_screens", {"projectId": project})).get("screens", [])
    if not screens:
        raise SystemExit("no screens returned")
    index, used, failed = [], set(), 0
    for s in screens:
        d = unwrap(c.tool("get_screen", {"name": s["name"]}))
        name = file_name(d.get("title"), s["name"])
        if name in used:
            raise SystemExit(f"duplicate file name {name}")
        used.add(name)
        row = {"title": d.get("title"), "file": name, "screen": s["name"],
               "width": d.get("width"), "height": d.get("height")}
        shot = (d.get("screenshot") or {}).get("downloadUrl")
        code = d.get("htmlCode") or {}
        if shot:
            row["screenshot"] = download(shot, OUT / f"{name}.png", c)
        if code.get("downloadUrl"):
            ext = ".md" if "markdown" in code.get("mimeType", "") else ".html"
            row["code"] = download(code["downloadUrl"], OUT / f"{name}{ext}", c)
        failed += sum(str(row.get(k, "ok")).startswith("failed") for k in ("screenshot", "code"))
        index.append(row)
        print(f"{name:<22} {d.get('title')}  shot={row.get('screenshot', '-')}  code={row.get('code', '-')}")
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    if failed:
        raise SystemExit(f"{failed} download(s) failed")


if __name__ == "__main__":
    main()
