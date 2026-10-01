"""Local review page for an additions file (10-01 pilot: 90 books + 18 reserves in the six new 🎯 topics).

One page, books grouped by topic. Per book: title, author, pages, YES24 link, intro (whole sentences, expandable)
and TOC from the local YES24 cache, our evidence and confidence, and the editable tags — topic (or 빼기),
keyword chips from that topic's closed list, reading way, one-liner (live count, 12-36 chars without spaces) —
plus [맞아요]. "이 주제 모두 맞아요" confirms every unconfirmed book of a topic as shown. Reserves sit under
each topic with [넣기]. Progress stays in the browser; [검수 결과 내려받기] saves the JSON that
src/apply_review.py applies. It shows YES24 text, so it is local only (data/processed/check/ is git-ignored).

Usage:  PYTHONIOENCODING=utf-8 python src/build_pilot_review.py [data/processed/additions/2026-10-01-pilot.json]
Output: data/processed/check/pilot/review.html
"""
import json
import re
import sys
from pathlib import Path

from build_check_page import DETAIL, OUT_DIR, clean, js_json, short_intro

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "processed" / "additions" / "2026-10-01-pilot.json"
VOCAB = ROOT / "data" / "processed" / "keyword_vocab.json"
OUT = OUT_DIR / "pilot" / "review.html"
WAY_LABELS = [["개념", "개념부터 쉽게"], ["실습", "따라 하며 실습"], ["사례", "사례로 술술"]]


def yes24_text(isbn: str) -> tuple[str, str]:
    path = DETAIL / f"{isbn}.json"
    if not path.exists():
        return "", ""
    items = (json.loads(path.read_text(encoding="utf-8")).get("data") or {}).get("items") or []
    cd = (items[0].get("contentDetail") or {}) if items else {}
    toc = re.sub(r"\s*<br\s*/?>\s*", "\n", cd.get("tableOfContents") or "")
    return clean(cd.get("bookIntroduction") or ""), clean(toc)


def build_entries(doc: dict) -> list[dict]:
    out = []
    for b in doc["books"]:
        intro, toc = yes24_text(b["isbn"])
        draft = b.get("draft") or b
        out.append({k: b.get(k) for k in ("isbn", "title", "author", "pages", "topic", "keywords", "way", "one_liner",
                                          "status", "evidence", "confidence", "link")}
                   | {"draft_status": draft.get("status", b["status"]), "draft_topic": draft.get("topic", b["topic"]),
                      "intro": short_intro(intro, 300), "intro_full": intro, "toc": toc[:1500]})
    return out


def render(doc: dict, entries: list[dict], vocab: dict, file_name: str) -> str:
    topics = list(dict.fromkeys(e["draft_topic"] for e in entries))
    kws = {t: list(vocab[t]["kept"]) for t in vocab}
    slots = {"__BOOKS__": js_json(entries), "__TOPICS__": js_json(topics), "__KW__": js_json(kws),
             "__WAYS__": js_json(WAY_LABELS), "__FILE__": js_json(file_name),
             "__KEY__": js_json(f"galpi-review-{file_name}")}
    return re.sub("|".join(slots), lambda m: slots[m.group(0)], TEMPLATE)


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    doc = json.loads(path.read_text(encoding="utf-8"))
    vocab = json.loads(VOCAB.read_text(encoding="utf-8"))
    entries = build_entries(doc)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(render(doc, entries, vocab, path.name), encoding="utf-8")
    picked = sum(e["status"] == "picked" for e in entries)
    print(f"saved: {OUT.relative_to(ROOT)} · {picked} books + {len(entries) - picked} reserves")
    return 0


TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 새 책 검수</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
:root{--paper:#FAF5EA;--deep:#F0E6D0;--line:#DDD0B4;--ink:#2B2724;--soft:#4A433D;--muted:#7A6048;--warn:#A94C60;--ok:#3D7350}
*{box-sizing:border-box}body{margin:0;background:var(--deep);color:var(--ink);font-family:'Gowun Dodum',sans-serif}
main{max-width:760px;margin:0 auto;background:var(--paper);min-height:100vh;padding:20px 16px 120px}
h1{font-family:'Gowun Batang',serif;font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 8px;line-height:1.6}
h2{font-family:'Gowun Batang',serif;font-size:18px;margin:28px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
h2 small{font-family:'Gowun Dodum';font-size:13px;color:var(--muted);font-weight:400}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:10px 0}
.card.done{border-color:var(--ok);background:#F5FAF5}.card.dropped{opacity:.55}
.t{font-family:'Gowun Batang',serif;font-size:17px;margin:0}.meta{font-size:12px;color:var(--muted);margin:2px 0 8px}
.meta a{color:var(--muted)}.intro{font-size:13px;line-height:1.7;color:var(--soft)}
details{font-size:13px;color:var(--soft);margin:4px 0}details pre{white-space:pre-wrap;font-family:inherit;margin:4px 0}
.ev{font-size:12px;color:var(--muted);margin:6px 0}.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}
.lab{font-size:12px;color:var(--muted);min-width:44px}
select,input[type=text]{font:inherit;font-size:15px;border:1px solid var(--ink);border-radius:8px;padding:6px 8px;background:#fff;color:var(--ink)}
input[type=text]{flex:1;min-width:240px}
.chip{border:1px solid var(--ink);border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;background:var(--paper);cursor:pointer;min-height:34px}
.chip.on{background:var(--ink);color:var(--paper)}
.way label{border:1px solid var(--ink);border-radius:8px;padding:5px 10px;font-size:13px;cursor:pointer}
.way input{margin-right:4px}.cnt{font-size:12px;color:var(--muted)}.cnt.bad{color:var(--warn);font-weight:700}
.ok{border:none;border-radius:999px;padding:8px 18px;font:inherit;background:var(--ink);color:var(--paper);cursor:pointer;min-height:40px}
.card.done .ok{background:var(--ok)}.ghost{border:1px solid var(--ink);border-radius:999px;padding:6px 14px;font:inherit;font-size:13px;background:var(--paper);cursor:pointer;min-height:36px}
.changed{font-size:11px;color:var(--warn)}.res{margin-top:6px;padding-left:10px;border-left:3px solid var(--line)}
.bar{position:fixed;left:0;right:0;bottom:0;background:var(--ink);color:var(--paper);padding:10px 16px;display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
.bar button{border:1px solid var(--paper);border-radius:999px;padding:8px 16px;font:inherit;background:var(--paper);color:var(--ink);cursor:pointer}
</style></head><body><main>
<h1>갈피 새 책 검수 — 새 🎯 주제 6개</h1>
<p class="sub">책마다 주제·키워드·읽는 방식·한 줄을 보고 고칠 곳만 고친 뒤 <b>맞아요</b>. 다 맞으면 주제 옆 <b>이 주제 모두 맞아요</b>.
주제에 안 맞는 책은 주제 칸에서 <b>빼기</b>, 그 자리는 아래 예비 책에서 <b>넣기</b>. 진행은 이 브라우저에 저장돼요.
끝나면 아래 <b>검수 결과 내려받기</b> → <code>python src/apply_review.py</code>.<br>
키워드는 0~3개, 책의 중심일 때만. 한 줄: 공백 빼고 12~36자, 해요체, 과장어·제목 반복 금지.</p>
<div id="app"></div></main>
<div class="bar"><span id="prog"></span><button id="dl">검수 결과 내려받기</button></div>
<script>
const BOOKS=__BOOKS__, TOPICS=__TOPICS__, KW=__KW__, WAYS=__WAYS__, FILE=__FILE__, KEY=__KEY__;
const MIN=12, MAX=36, HYPE=["최고","필독","반드시","완벽","인생책","미친","역대급","무조건","1위","베스트셀러","강력 추천","꼭 읽어야"];
let st={}; try{st=JSON.parse(localStorage.getItem(KEY)||"{}")||{}}catch(e){st={}}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const len=s=>s.replace(/\\s/g,"").length;
const cur=b=>st[b.isbn]||{topic:b.topic,keywords:[...(b.keywords||[])],way:b.way,one_liner:b.one_liner,status:b.status,ok:false};
const set=(b,patch)=>{st[b.isbn]={...cur(b),...patch,ok:false};save();};
function lineIssues(s,title){const n=len(s),out=[];if(n<MIN)out.push("짧음");if(n>MAX)out.push("김");
 const h=HYPE.filter(w=>s.includes(w));if(h.length)out.push("과장: "+h.join(","));
 const core=title.split(/[:=(]/)[0].trim().replace(/\\s/g,"");if(core&&s.replace(/\\s/g,"").includes(core))out.push("제목 반복");
 if(s.trim().endsWith("?"))out.push("물음표");return out}
function card(b){
 const c=cur(b), dropped=c.status==="dropped", reserve=c.status==="reserve";
 const kws=(KW[c.topic]||[]).map(k=>`<button class="chip ${c.keywords.includes(k)?"on":""}" data-k="${esc(k)}">${esc(k)}</button>`).join("");
 const ways=WAYS.map(([w,l])=>`<label><input type="radio" name="w${b.isbn}" value="${w}" ${c.way===w?"checked":""}>${w} <span class="cnt">${l}</span></label>`).join("");
 const opts=[...TOPICS.map(t=>`<option ${t===c.topic&&!dropped?"selected":""}>${esc(t)}</option>`),`<option value="__drop" ${dropped?"selected":""}>빼기 (이 주제들에 안 맞음)</option>`].join("");
 const iss=lineIssues(c.one_liner,b.title);
 const changed=["topic","way","one_liner"].filter(f=>c[f]!==b[f]).concat(JSON.stringify([...c.keywords].sort())!==JSON.stringify([...(b.keywords||[])].sort())?["keywords"]:[]);
 return `<div class="card ${c.ok?"done":""} ${dropped?"dropped":""}" id="b${b.isbn}">
  <p class="t">${esc(b.title)}</p><p class="meta">${esc(b.author)} · ${b.pages}쪽 · 확신 ${b.confidence} · <a href="${esc(b.link)}" target="_blank" rel="noopener">예스24</a></p>
  <div class="intro">${esc(b.intro)}</div>
  <details><summary>책소개 전체 · 목차</summary><pre>${esc(b.intro_full)}</pre><pre>${esc(b.toc)}</pre></details>
  <p class="ev">근거(우리 말): ${esc(b.evidence)}</p>
  ${reserve?`<button class="ghost" data-act="in">넣기 (예비 → 이 주제에)</button>`:`
  <div class="row"><span class="lab">주제</span><select data-act="topic">${opts}</select></div>
  ${dropped?"":`<div class="row"><span class="lab">키워드</span>${kws||'<span class="cnt">(키워드 없음)</span>'}</div>
  <div class="row way"><span class="lab">방식</span>${ways}</div>
  <div class="row"><span class="lab">한 줄</span><input type="text" data-act="line" value="${esc(c.one_liner)}">
   <span class="cnt ${iss.length?"bad":""}">${len(c.one_liner)}자${iss.length?" · "+iss.join(", "):""}</span></div>`}
  <div class="row"><button class="ok" data-act="ok">${c.ok?"확인함 ✓":"맞아요"}</button>${changed.length&&!dropped?`<span class="changed">고침: ${changed.join(", ")}</span>`:""}</div>`}
 </div>`}
function render(){
 const app=document.getElementById("app");
 app.innerHTML=TOPICS.map(t=>{const mine=BOOKS.filter(b=>b.draft_topic===t);
  const main=mine.filter(b=>b.draft_status!=="reserve"), res=mine.filter(b=>b.draft_status==="reserve");
  const done=main.filter(b=>cur(b).ok).length;
  return `<h2>${esc(t)} <small>${done}/${main.length} 확인</small><button class="ghost" data-all="${esc(t)}">이 주제 모두 맞아요</button></h2>
   ${main.map(card).join("")}<details class="res"><summary>예비 ${res.length}권</summary>${res.map(card).join("")}</details>`}).join("");
 const all=BOOKS.filter(b=>b.draft_status!=="reserve"), n=all.filter(b=>cur(b).ok).length;
 document.getElementById("prog").textContent=`확인 ${n}/${all.length}`;
}
document.addEventListener("click",e=>{
 const all=e.target.closest("[data-all]");
 if(all){BOOKS.filter(b=>b.draft_topic===all.dataset.all&&b.draft_status!=="reserve"&&!cur(b).ok).forEach(b=>{st[b.isbn]={...cur(b),ok:true}});save();render();return}
 const el=e.target.closest(".card"); if(!el)return; const b=BOOKS.find(x=>"b"+x.isbn===el.id);
 const k=e.target.closest(".chip");
 if(k){const c=cur(b),on=c.keywords.includes(k.dataset.k);set(b,{keywords:on?c.keywords.filter(x=>x!==k.dataset.k):[...c.keywords,k.dataset.k]});render();return}
 const act=e.target.dataset.act;
 if(act==="ok"){st[b.isbn]={...cur(b),ok:true};save();render()}
 if(act==="in"){set(b,{status:"picked"});render()}
});
document.addEventListener("change",e=>{
 const el=e.target.closest(".card"); if(!el)return; const b=BOOKS.find(x=>"b"+x.isbn===el.id); const act=e.target.dataset.act;
 if(act==="topic"){const v=e.target.value; if(v==="__drop")set(b,{status:"dropped"}); else set(b,{topic:v,status:"picked",keywords:cur(b).topic===v?cur(b).keywords:[]}); render()}
 if(e.target.name==="w"+b.isbn){set(b,{way:e.target.value});render()}
});
document.addEventListener("input",e=>{
 if(e.target.dataset.act!=="line")return; const el=e.target.closest(".card"); const b=BOOKS.find(x=>"b"+x.isbn===el.id);
 st[b.isbn]={...cur(b),one_liner:e.target.value,ok:false};save();
 const iss=lineIssues(e.target.value,b.title), cnt=e.target.nextElementSibling;
 cnt.textContent=`${len(e.target.value)}자${iss.length?" · "+iss.join(", "):""}`; cnt.className="cnt"+(iss.length?" bad":"");
 el.classList.remove("done"); const ok=el.querySelector(".ok"); if(ok)ok.textContent="맞아요";
});
document.getElementById("dl").onclick=()=>{
 const answers={}; for(const b of BOOKS){const c=st[b.isbn]; if(c&&c.ok)answers[b.isbn]={...c,one_liner:c.one_liner.trim()}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),file:FILE,answers},null,1)],{type:"application/json"});
 const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=FILE.replace(/\\.json$/,"")+"-review.json"; a.click();
};
render();
</script></body></html>
"""

if __name__ == "__main__":
    sys.exit(main())
