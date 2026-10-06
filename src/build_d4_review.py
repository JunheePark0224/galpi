"""D4: build the local review page where the user confirms or fixes the AI tags of the 200 books.

Flagged books (d3_report.json `flags`, with the reasons shown) come first, then the rest.
Per book: title, slot, pages, intro (short + full), TOC (12 lines + full), the AI's evidence and
editable AI tags — 🍃: 4 axes as three-way choices, 🎯: reading way — plus the one-liner in a text
field (live count, 12-36 chars without spaces) and a [맞아요, 다음] button.
The page saves progress in the browser, lets you stop after the flagged books, and downloads
d4_review.json ({saved_at, answers: {isbn: {axes?, way?, one_liner, ok: true}}}), which
build_books_v1.py reads to make the reviewed books_v1.json. Books never confirmed keep the AI tags.
It contains YES24 text, so it is for local use only — do not publish it.

Usage:  PYTHONIOENCODING=utf-8 python src/build_d4_review.py
Input:  data/processed/d3_report.json (flags), d3/ai_tags_batch_*.json, d1_selected.csv,
        check/d3_bundles/batch_*.json (YES24 intro + TOC)
Output: data/processed/check/d4_review.html
"""
import json
import re
import sys
from pathlib import Path

from build_books_v1 import AXES, OUT_REPORT, WAYS, load_ai_tags
from build_check_page import OUT_DIR, js_json, short_intro
from build_d3_bundles import BUNDLE_DIR, load_selected

ROOT = Path(__file__).resolve().parents[1]
OUT = OUT_DIR / "d4_review.html"

# key, question, +1 side, 0 side, -1 side, hint (side names from TAGGING.md). The world hint is a short form of
# docs/label-dictionary.md 1-4 세계 (10-06) — test_pipeline_review.py checks its words against that section
AXIS_LABELS = [
    ["temp", "책을 덮은 뒤 남는 느낌", "따뜻함", "중간", "여운·서늘함",
     "끝맺음(결말·맺음말)과 어조로 — 끝맺음이 가장 무겁다. 비소설은 끝맺음·어조만 보고, 둘이 반대이거나 둘 다 약하면 중간"],
    ["pull", "끌리는 힘", "문장", "중간", "몰입·이야기",
     "끄는 힘의 종류 — 글맛이 강점으로 소개되면 문장, 전개·사례·흐름으로 끌면 몰입. 어렵다고 중간 아님, 둘 다 뚜렷하게 강할 때만 중간"],
    ["gain", "읽고 나서 얻는 것", "알게 됨", "중간", "마음",
     "사실·원리를 설명·증명하면 알게 됨, 질문·성찰·감정을 건네면 마음 — 정말 반반일 때만 중간, 둘 다 약하면 더 강한 쪽"],
    ["world", "책 속 세상", "현실", "중간", "딴 세상",
     "비소설은 무대가 우주여도 현실. 소설·우화는 실제로 있거나 있었던 세상이 배경이면 현실(철학적이어도), 우주 배경이거나 "
     "지금 없는 기술이나 존재(귀신·괴이·좀비 등)가 실제로 등장하면 현실 배경이어도 딴 세상. 섞였다고 중간이 아니다 — "
     "중간은 사람도 세계도 없는 책만. 해당 없음 중간은 없다"],
]
WAY_LABELS = [["개념", "개념부터 쉽게"], ["실습", "따라 하며 실습"], ["사례", "사례로 술술"]]
assert [a[0] for a in AXIS_LABELS] == list(AXES) and [w[0] for w in WAY_LABELS] == list(WAYS)


def load_bundles() -> dict[str, dict]:
    paths = sorted(BUNDLE_DIR.glob("batch_*.json"))
    if not paths:
        raise FileNotFoundError(f"no bundles in {BUNDLE_DIR} — run build_d3_bundles.py first")
    return {b["isbn"]: b for p in paths for b in json.loads(p.read_text(encoding="utf-8"))}


def build_entries(selected: list[dict], ai_tags: dict[str, dict], bundles: dict[str, dict],
                  flags: list[dict]) -> list[dict]:
    """Page data: flagged books first (report order), then the rest in selection order."""
    reasons = {f["isbn"]: list(f["reasons"]) for f in flags}
    by_isbn = {r["isbn"]: r for r in selected}
    order = [i for i in reasons if i in by_isbn] + [r["isbn"] for r in selected if r["isbn"] not in reasons]
    entries = []
    for isbn in order:
        row, bundle, tag = by_isbn[isbn], bundles.get(isbn, {}), ai_tags.get(isbn, {})
        intro = bundle.get("intro") or ""
        entries.append({
            "isbn": isbn, "entry": row["entry"], "slot": row["slot"], "title": row["title"],
            "author": row.get("author", ""), "pages": row.get("pages") or None,
            "intro": short_intro(intro), "intro_full": intro,
            "toc": list(bundle.get("toc") or []),
            "evidence": tag.get("evidence", ""),
            "flags": reasons.get(isbn, []),
            "axes": {a: (tag.get("axes") or {}).get(a, 0) for a in AXES} if row["entry"] == "leaf" else None,
            "way": tag.get("way") if row["entry"] == "target" else None,
            "one_liner": tag.get("one_liner", ""),
        })
    return entries


def render_page(entries: list[dict]) -> str:
    slots = {"__BOOKS__": js_json(entries), "__AXES__": js_json(AXIS_LABELS),
             "__WAYS__": js_json(WAY_LABELS),
             "__NFLAG__": str(sum(bool(e["flags"]) for e in entries))}
    return re.sub("__BOOKS__|__AXES__|__WAYS__|__NFLAG__", lambda m: slots[m.group(0)], TEMPLATE)


def main() -> int:
    if not OUT_REPORT.exists():
        print(f"ERROR: {OUT_REPORT.relative_to(ROOT)} not found — run build_books_v1.py first", file=sys.stderr)
        return 1
    report = json.loads(OUT_REPORT.read_text(encoding="utf-8"))
    entries = build_entries(load_selected(), load_ai_tags(), load_bundles(), report["flags"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render_page(entries), encoding="utf-8")
    n_flag = sum(bool(e["flags"]) for e in entries)
    print(f"saved: {OUT.relative_to(ROOT)} · {len(entries)} books (flagged first: {n_flag})")
    return 0


TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 태그 검수 (D4)</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
:root{--paper:#FAF5EA;--deep:#F0E6D0;--line:#DDD0B4;--ink:#2B2724;--soft:#4A433D;--muted:#7A6048;--warn:#A94C60}
*{box-sizing:border-box}body{margin:0;background:var(--deep);color:var(--ink);font-family:'Gowun Dodum',sans-serif}
main{max-width:600px;margin:0 auto;background:var(--paper);min-height:100vh;padding:20px 18px 40px}
h1{font-family:'Gowun Batang',serif;font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 10px}
.bar{height:6px;background:var(--line);border-radius:3px;margin:12px 0 6px}.bar i{display:block;height:100%;background:var(--ink);border-radius:3px}
.note{font-size:12px;color:var(--muted);margin:0 0 16px}
.tag{display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;background:var(--ink);color:var(--paper);margin-bottom:8px}
.title{font-family:'Gowun Batang',serif;font-size:22px;margin:0 0 4px}.meta{font-size:13px;color:var(--muted);margin:0 0 14px}
.box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;line-height:1.7;color:var(--soft)}
.box b{display:block;color:var(--ink);font-size:13px;margin-bottom:4px}.toc{font-size:13px;white-space:pre-line}
.box.flag{border-color:var(--warn);background:#FFF6F3}.box.flag b{color:var(--warn)}.box.flag ul{margin:0;padding-left:18px}
.more{min-height:44px;margin-top:2px;border:none;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer;padding:6px 0;text-decoration:underline}
.q{margin:18px 0 8px;font-weight:700;font-size:15px}.hint{font-size:12px;color:var(--muted);font-weight:400}
.opts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.opts label{position:relative;border:1px solid var(--ink);border-radius:10px;padding:10px 4px;font-size:14px;cursor:pointer;background:var(--paper);min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center}
.opts input{position:absolute;opacity:0;width:1px;height:1px}.opts input:checked+span{font-weight:700}
.opts label:has(input:checked){background:var(--ink);color:var(--paper)}
.opts label:has(input:focus-visible),textarea:focus-visible{outline:3px solid #3A6684;outline-offset:2px}
textarea{width:100%;min-height:76px;border:1px solid var(--ink);border-radius:10px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.6;background:#fff;color:var(--ink);resize:vertical}
.count{font-size:13px;color:var(--muted);margin-top:4px}.count.bad{color:var(--warn);font-weight:700}
nav{display:flex;gap:10px;margin-top:22px}nav button,.stop{flex:1;min-height:46px;border-radius:999px;border:1px solid var(--ink);background:var(--paper);font:inherit;font-size:15px;cursor:pointer;color:var(--ink)}
nav button.main{background:var(--ink);color:var(--paper);flex:2}.stop{width:100%;margin-top:10px;font-size:13px;color:var(--muted);border-color:var(--line)}
.warn{color:var(--warn);font-size:13px;min-height:18px;margin-top:8px}.done{text-align:center;padding-top:40px}
</style></head><body><main id="app"></main>
<script>
const BOOKS=__BOOKS__, AXES=__AXES__, WAYS=__WAYS__, NFLAG=__NFLAG__, KEY="galpi-d4-review";
const MIN=12, MAX=36;
let st={ans:{},drafts:{}}; try{const r=JSON.parse(localStorage.getItem(KEY)||"{}");if(r&&r.ans&&typeof r.ans==="object")st={ans:r.ans,drafts:r.drafts||{}}}catch(e){}
const app=document.getElementById("app");
let i=BOOKS.findIndex(b=>!st.ans[b.isbn]); if(i<0)i=BOOKS.length;  // resume at the first unconfirmed book
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const len=s=>s.replace(/\\s/g,"").length;
const doneCount=()=>BOOKS.filter(b=>st.ans[b.isbn]).length;
function current(b){return st.drafts[b.isbn]||st.ans[b.isbn]||{axes:b.axes,way:b.way,one_liner:b.one_liner}}
function render(){
 if(i>=BOOKS.length)return finish();
 const b=BOOKS[i], c=current(b), n=doneCount();
 let q="";
 if(b.entry==="leaf"){
  q=AXES.map(([k,label,p,z,m,hint])=>`<p class="q">${esc(label)} <span class="hint">— ${esc(hint)}</span></p><div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="${k}" value="${v}" ${(c.axes||{})[k]===v?"checked":""}><span>${esc(t)}</span></label>`).join("")}</div>`).join("");
 }else{
  q=`<p class="q">읽는 방식</p><div class="opts">${WAYS.map(([v,t])=>`<label><input type="radio" name="way" value="${esc(v)}" ${c.way===v?"checked":""}><span>${esc(t)}</span></label>`).join("")}</div>`;
 }
 const style=b.entry==="leaf"?"질문형 — 물음표(?)로 끝나게":"요약형 — 이 책으로 무엇을 얻는지",
  section=b.flags.length?"걸린 책":(i<NFLAG?"":"나머지");
 const stopLabel=(i<NFLAG||i===NFLAG)?"걸린 책만 끝내기":"여기서 끝내기";
 app.innerHTML=`<h1>갈피 태그 검수</h1><p class="sub">AI가 붙인 태그와 한 줄이 맞는지 확인하고, 틀리면 고쳐 주세요. 맞으면 [맞아요, 다음]만 누르면 돼요.</p>
 <div class="bar"><i style="width:${Math.round(100*n/BOOKS.length)}%"></i></div>
 <p class="note">${n} / ${BOOKS.length}권 확인 · 걸린 책 ${NFLAG}권 먼저${i>=NFLAG&&NFLAG>0?" — 걸린 책은 끝났어요, 나머지는 원하는 만큼만":""}</p>
 <span class="tag">${b.entry==="leaf"?"🍃":"🎯"} ${esc(b.slot)}</span><p class="title">${esc(b.title)}</p>
 <p class="meta">${esc(b.author)} · ${b.pages?esc(b.pages)+"쪽":"쪽수 정보 없음"} · ${i+1} / ${BOOKS.length}${section?" · "+section:""}</p>
 ${b.flags.length?`<div class="box flag"><b>왜 걸렸나요</b><ul>${b.flags.map(f=>`<li>${esc(f)}</li>`).join("")}</ul></div>`:""}
 <div class="box"><b>소개</b><div id="intro" class="toc">${esc(b.intro||"(소개 없음)")}</div>${b.intro_full.length>b.intro.length+5?'<button class="more" data-t="intro">소개 전체 보기 ⌄</button>':''}</div>
 <div class="box"><b>목차 <span class="hint">(${b.toc.length}줄)</span></b><div id="toc" class="toc">${esc(b.toc.slice(0,12).join("\\n")||"(목차 없음)")}</div>${b.toc.length>12?'<button class="more" data-t="toc">목차 전체 보기 ⌄</button>':''}</div>
 <div class="box"><b>AI가 이렇게 본 이유</b>${esc(b.evidence||"(근거 없음)")}</div>
 ${q}
 <p class="q">첫인상 한 줄 <span class="hint">— ${style} · 공백 빼고 ${MIN}~${MAX}자</span></p>
 <textarea id="line" rows="2" aria-label="첫인상 한 줄">${esc(c.one_liner)}</textarea><div class="count" id="count"></div>
 <p class="warn" id="warn"></p>
 <nav><button id="prev">이전</button><button class="main" id="next">맞아요, 다음</button></nav>
 <button class="stop" id="stop">${stopLabel}</button>`;
 app.querySelectorAll("button.more").forEach(btn=>btn.onclick=()=>{
  const t=btn.dataset.t, box=document.getElementById(t), open=btn.dataset.open==="1";
  box.textContent=t==="intro"?(open?b.intro:b.intro_full):(open?b.toc.slice(0,12):b.toc).join("\\n");
  btn.dataset.open=open?"0":"1"; btn.textContent=(t==="intro"?"소개":"목차")+(open?" 전체 보기 ⌄":" 접기 ⌃");
 });
 const line=document.getElementById("line"), count=document.getElementById("count");
 const upd=()=>{const n=len(line.value),ok=n>=MIN&&n<=MAX;count.textContent=`${n}자 (공백 제외) · ${MIN}~${MAX}자`;count.className="count"+(ok?"":" bad")};
 line.addEventListener("input",()=>{upd();collect();document.getElementById("warn").textContent=""});upd();
 app.querySelectorAll('input[type="radio"]').forEach(el=>el.addEventListener("change",collect));
 document.getElementById("prev").onclick=()=>{collect();if(i>0){i--;render();scrollTo(0,0)}};
 document.getElementById("next").onclick=()=>{
  const d=collect();if(!d)return;const n=len(d.one_liner);
  if(n<MIN||n>MAX){document.getElementById("warn").textContent=`한 줄은 공백 빼고 ${MIN}~${MAX}자여야 해요 (지금 ${n}자)`;return}
  st.ans[b.isbn]={...d,ok:true};delete st.drafts[b.isbn];save();i++;render();scrollTo(0,0)};
 document.getElementById("stop").onclick=()=>{collect();i=BOOKS.length;render();scrollTo(0,0)};
}
function collect(){const b=BOOKS[i];if(!b)return null;const d={one_liner:document.getElementById("line").value.trim()};
 if(b.entry==="leaf"){d.axes={};AXES.forEach(([k])=>{const x=app.querySelector(`input[name="${k}"]:checked`);d.axes[k]=x?Number(x.value):0})}
 else{const x=app.querySelector('input[name="way"]:checked');d.way=x?x.value:b.way}
 st.drafts[b.isbn]=d;save();return d}
function finish(){
 const n=doneCount(), nf=BOOKS.filter(b=>b.flags.length&&st.ans[b.isbn]).length;
 app.innerHTML=`<div class="done"><h1>검수 끝</h1><p class="sub">${n}권 확인 (걸린 책 ${nf} / ${NFLAG}권 포함). 확인하지 않은 ${BOOKS.length-n}권은 AI 태그 그대로 써요.</p>
 <nav><button class="main" id="dl">결과 파일 저장하기</button></nav>
 <p class="sub" style="margin-top:14px">저장된 <b>d4_review.json</b>을 <b>Galpi/data/processed/</b> 폴더에 넣고 채팅에 "넣었어"라고 알려주세요.</p>
 <nav><button id="back">이어서 검수하기</button></nav></div>`;
 document.getElementById("dl").onclick=()=>{const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),answers:st.ans},null,1)],{type:"application/json"});
  const u=URL.createObjectURL(blob);const x=document.createElement("a");x.href=u;x.download="d4_review.json";
  document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 document.getElementById("back").onclick=()=>{const j=BOOKS.findIndex(b=>!st.ans[b.isbn]);i=j<0?BOOKS.length-1:j;render();scrollTo(0,0)};
}
render();
</script></body></html>
"""

if __name__ == "__main__":
    sys.exit(main())
