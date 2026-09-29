"""D1-3: build the blind tagging page for D2 (the user tags 20 books without seeing AI tags).

20 books = 10 🎯 (every topic at least once) + 10 🍃 (every genre at least once), fixed seed.
🎯: keywords from keyword_vocab.json (kept only) + level + reading style.
🍃: the four balance-game axes (A / middle / B).
The page saves answers in the browser as you go and downloads d2_human_tags.json at the end.
It contains YES24 text, so it is for local use only — do not publish it.

Usage:  python src/build_check_page.py
Output: data/processed/check/d2_check.html, data/processed/check/d2_sample.json
"""
import html
import json
import random
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = ROOT / "data" / "processed" / "d1_candidates.json"
VOCAB = ROOT / "data" / "processed" / "keyword_vocab.json"
DETAIL = ROOT / "data" / "raw" / "yes24" / "detail"
OUT_DIR = ROOT / "data" / "processed" / "check"
SEED = 20260929
AXES = [["temp", "책을 덮은 뒤 남는 느낌", "따뜻함", "여운·서늘함",
         "마음이 데워지는 책인가, 오래 먹먹하고 서늘하게 남는 책인가"],
        ["pull", "끌리는 힘", "문장", "몰입·이야기",
         "계속 읽게 만드는 게 문장 자체(음미·밑줄)인가, 다음이 궁금한 전개(손에서 못 놓음)인가"],
        ["gain", "읽고 나서 얻는 것", "알게 됨(지식)", "마음(정서)",
         "새로 아는 게 생기는 책인가, 마음이 달라지는 책인가"],
        ["world", "책 속 세상", "현실", "딴 세상",
         "지금 여기 같은 현실 이야기인가, 여기 없는 세계(SF·판타지 등)인가"]]


def detail(isbn: str) -> dict:
    items = (json.loads((DETAIL / f"{isbn}.json").read_text(encoding="utf-8")).get("data") or {}).get("items")
    return items[0] if items else {}


def clean(text: str) -> str:
    """YES24 text carries raw HTML tags, entities and '__' indent markers."""
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    return re.sub(r"(?m)^[\s_]+", "", text)


def short_intro(text: str, limit: int = 240) -> str:
    """Whole sentences only (never cut mid-sentence): at least the first one, then while under limit."""
    text = re.sub(r"\s+", " ", clean(text)).strip()
    out = ""
    for sent in re.split(r"(?<=[.!?])[\"'”’)]*\s+", text):
        if out and len(out) + len(sent) > limit:
            break
        out = f"{out} {sent}".strip()
    return out


def toc_lines(text: str, n: int = 12) -> list[str]:
    lines = [ln.strip() for ln in clean(text).splitlines() if ln.strip()]
    return lines[:n] + (["…"] if len(lines) > n else [])


def js_json(value: object) -> str:
    """JSON safe to embed inside <script>: no '<', no U+2028/2029."""
    return (json.dumps(value, ensure_ascii=False).replace("<", "\\u003c")
            .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def sample(rows: list[dict]) -> list[dict]:
    rng = random.Random(SEED)
    picked = [r for r in rows if r["status"] == "picked"]
    out = []
    for entry, n in (("target", 10), ("leaf", 10)):
        pool = [r for r in picked if r["entry"] == entry]
        slots = sorted({r["slot"] for r in pool})
        first = [rng.choice([r for r in pool if r["slot"] == s]) for s in slots]  # every slot once
        rest = [r for r in pool if r not in first]
        out += first + rng.sample(rest, n - len(first))
    rng.shuffle(out)
    return out


def main() -> None:
    rows = json.loads(CANDIDATES.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    books = []
    for r in sample(rows):
        d = detail(r["isbn"])
        cd = d.get("contentDetail") or {}
        books.append({"isbn": r["isbn"], "title": r["title"], "author": r["author"], "entry": r["entry"],
                      "slot": r["slot"], "pages": d.get("pages"),
                      "intro": short_intro(cd.get("bookIntroduction") or ""),
                      "intro_full": re.sub(r"[ \t]+", " ", clean(cd.get("bookIntroduction") or "")).strip(),
                      "toc": toc_lines(cd.get("tableOfContents") or "", n=400),  # full TOC: the AI saw all of it
                      "keywords": list(vocab[r["slot"]]["kept"]) if r["entry"] == "target" else []})
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "d2_sample.json").write_text(json.dumps([{k: b[k] for k in ("isbn", "title", "entry", "slot")}
                                                        for b in books], ensure_ascii=False, indent=1), encoding="utf-8")
    slots = {"__AXES__": js_json(AXES), "__BOOKS__": js_json(books)}
    page = re.sub("__AXES__|__BOOKS__", lambda m: slots[m.group(0)], TEMPLATE)  # one pass
    (OUT_DIR / "d2_check.html").write_text(page, encoding="utf-8")
    print(f"saved: {(OUT_DIR / 'd2_check.html').relative_to(ROOT)} · {len(books)} books "
          f"({sum(b['entry'] == 'target' for b in books)} 🎯 / {sum(b['entry'] == 'leaf' for b in books)} 🍃)")


TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 태그 체크 (D2)</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
:root{--paper:#FAF5EA;--deep:#F0E6D0;--line:#DDD0B4;--ink:#2B2724;--soft:#4A433D;--muted:#7A6048}
*{box-sizing:border-box}body{margin:0;background:var(--deep);color:var(--ink);font-family:'Gowun Dodum',sans-serif}
main{max-width:560px;margin:0 auto;background:var(--paper);min-height:100vh;padding:20px 18px 40px}
h1{font-family:'Gowun Batang',serif;font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 14px}
.bar{height:6px;background:var(--line);border-radius:3px;margin-bottom:18px}.bar i{display:block;height:100%;background:var(--ink);border-radius:3px}
.tag{display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;background:var(--ink);color:var(--paper);margin-bottom:8px}
.title{font-family:'Gowun Batang',serif;font-size:22px;margin:0 0 4px}.meta{font-size:13px;color:var(--muted);margin:0 0 14px}
.box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;line-height:1.7;color:var(--soft)}
.box b{display:block;color:var(--ink);font-size:13px;margin-bottom:4px}.toc{font-size:13px;white-space:pre-line}
.more{margin-top:8px;border:none;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer;padding:6px 0;text-decoration:underline}
.q{margin:18px 0 8px;font-weight:700;font-size:15px}.hint{font-size:12px;color:var(--muted);font-weight:400}
.opts{display:flex;flex-wrap:wrap;gap:8px}
.opts label{border:1px solid var(--ink);border-radius:999px;padding:9px 14px;font-size:14px;cursor:pointer;background:var(--paper);min-height:40px}
.opts label{position:relative}.opts input{position:absolute;opacity:0;width:1px;height:1px}.opts input:checked+span{font-weight:700}
.opts label:has(input:checked){background:var(--ink);color:var(--paper)}
.opts label:has(input:focus-visible){outline:3px solid #3A6684;outline-offset:2px}
.axis{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.axis label{text-align:center;border-radius:10px;padding:10px 4px}
nav{display:flex;gap:10px;margin-top:24px}nav button{flex:1;height:46px;border-radius:999px;border:1px solid var(--ink);background:var(--paper);font:inherit;font-size:15px;cursor:pointer}
nav button.main{background:var(--ink);color:var(--paper)}.warn{color:#A94C60;font-size:13px;min-height:18px;margin-top:8px}
.done{text-align:center;padding-top:40px}
</style></head><body><main id="app"></main>
<script>
const BOOKS=__BOOKS__, AXES=__AXES__, KEY="galpi-d2-answers";
const LEVELS=["처음이에요","조금 알아요","실무에 써요"], WAYS=["개념부터 쉽게","따라 하며 실습","사례로 술술"];
let ans={}; try{ans=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
if(!ans||typeof ans!=="object"||Array.isArray(ans))ans={};
const app=document.getElementById("app");
let i=BOOKS.findIndex(b=>missing(b)); if(i<0)i=BOOKS.length;  // resume at the first unfinished book
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ans))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function group(name,items,type,cur){return `<div class="opts">${items.map(v=>`<label><input type="${type}" name="${name}" value="${esc(v)}" ${(type==="checkbox"?(cur||[]).includes(v):cur===v)?"checked":""}><span>${esc(v)}</span></label>`).join("")}</div>`}
function render(){
 if(i>=BOOKS.length){return finish()}
 const b=BOOKS[i], a=ans[b.isbn]||{};
 let q="";
 if(b.entry==="target"){
  q+=`<p class="q">이 책에 해당하는 키워드 <span class="hint">모두 고르기 · 없으면 "해당 없음"</span></p>`+group("kw",[...b.keywords,"해당 없음"],"checkbox",a.keywords);
  q+=`<p class="q">수준</p>`+group("level",LEVELS,"radio",a.level);
  q+=`<p class="q">읽는 방식</p>`+group("way",WAYS,"radio",a.way);
 }else{
  q+=AXES.map(([k,label,A,B,hint])=>`<p class="q">${label} <span class="hint">— ${hint}</span></p><div class="opts axis">${[A,"중간·해당 없음",B].map((v,j)=>`<label><input type="radio" name="${k}" value="${[1,0,-1][j]}" ${String(a[k])===String([1,0,-1][j])?"checked":""}><span>${esc(v)}</span></label>`).join("")}</div>`).join("");
 }
 app.innerHTML=`<h1>갈피 태그 체크</h1><p class="sub">소개와 목차만 보고 골라 주세요. 정답은 없어요 — AI가 붙인 답과 비교해 기준을 다듬는 데 써요.</p>
 <div class="bar"><i style="width:${Math.round(100*i/BOOKS.length)}%"></i></div>
 <span class="tag">${b.entry==="target"?"🎯":"🍃"} ${esc(b.slot)}</span><p class="title">${esc(b.title)}</p><p class="meta">${esc(b.author)} · ${b.pages?esc(b.pages)+"쪽":"쪽수 정보 없음"} · ${i+1} / ${BOOKS.length}</p>
 <div class="box"><b>소개</b><div id="intro" class="toc">${esc(b.intro)}</div>${b.intro_full.length>b.intro.length+5?'<button class="more" data-t="intro">소개 전체 보기 ⌄</button>':''}</div>
 <div class="box"><b>목차 <span class="hint">(${b.toc.length}줄)</span></b><div id="toc" class="toc">${esc(b.toc.slice(0,12).join("\\n"))}</div>${b.toc.length>12?'<button class="more" data-t="toc">목차 전체 보기 ⌄</button>':''}</div>
 ${q}<p class="warn" id="warn"></p><nav><button id="prev">이전</button><button class="main" id="next">${i===BOOKS.length-1?"끝내기":"다음"}</button></nav>`;
 app.querySelectorAll("button.more").forEach(btn=>btn.onclick=()=>{  // show the full text the AI tagged from
  const t=btn.dataset.t, box=document.getElementById(t), open=btn.dataset.open==="1";
  box.textContent=t==="intro"?(open?b.intro:b.intro_full):(open?b.toc.slice(0,12):b.toc).join("\\n");
  btn.dataset.open=open?"0":"1"; btn.textContent=(t==="intro"?"소개":"목차")+(open?" 전체 보기 ⌄":" 접기 ⌃");
 });
 app.querySelectorAll('input[name="kw"]').forEach(el=>el.addEventListener("change",()=>{  // '해당 없음' excludes the others
  if(!el.checked)return;
  app.querySelectorAll('input[name="kw"]').forEach(o=>{if(o!==el&&(el.value==="해당 없음"||o.value==="해당 없음"))o.checked=false});
 }));
 app.querySelectorAll("input").forEach(el=>el.addEventListener("change",()=>{collect();document.getElementById("warn").textContent=""}));
 document.getElementById("prev").onclick=()=>{collect();if(i>0){i--;render();scrollTo(0,0)}};
 document.getElementById("next").onclick=()=>{collect();const m=missing(b);if(m){document.getElementById("warn").textContent=m;return}i++;render();scrollTo(0,0)};
}
function collect(){const b=BOOKS[i];if(!b)return;const a={};
 if(b.entry==="target"){a.keywords=[...app.querySelectorAll('input[name="kw"]:checked')].map(x=>x.value);
  const l=app.querySelector('input[name="level"]:checked'),w=app.querySelector('input[name="way"]:checked');if(l)a.level=l.value;if(w)a.way=w.value;}
 else{AXES.forEach(([k])=>{const x=app.querySelector(`input[name="${k}"]:checked`);if(x)a[k]=Number(x.value)})}
 ans[b.isbn]=a;save();}
function missing(b){const a=ans[b.isbn]||{};
 if(b.entry==="target"){if(!(a.keywords||[]).length)return "키워드를 하나 이상 골라 주세요 (없으면 '해당 없음')";if(!a.level)return "수준을 골라 주세요";if(!a.way)return "읽는 방식을 골라 주세요";}
 else{for(const [k,label] of AXES){if(a[k]===undefined)return `'${label}'을 골라 주세요`}}return ""}
function finish(){
 app.innerHTML=`<div class="done"><h1>다 끝났어요</h1><p class="sub">${BOOKS.length}권 체크 완료</p><nav><button class="main" id="dl">결과 파일 저장하기</button></nav>
 <p class="sub" style="margin-top:14px">저장된 <b>d2_human_tags.json</b>을 <b>Galpi/data/processed/</b> 폴더에 넣고 채팅에 "넣었어"라고 알려주세요.</p><nav><button id="back">마지막 책으로</button></nav></div>`;
 document.getElementById("dl").onclick=()=>{const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),answers:ans},null,1)],{type:"application/json"});
  const u=URL.createObjectURL(blob);const x=document.createElement("a");x.href=u;x.download="d2_human_tags.json";
  document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 document.getElementById("back").onclick=()=>{i=BOOKS.length-1;render()};
}
render();
</script></body></html>
"""

if __name__ == "__main__":
    main()
