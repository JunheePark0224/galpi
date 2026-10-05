"""HTML of the pipeline review page (review.py fills the __…__ slots and writes it under data/processed/check/pipeline/).

One page for both entries, built on the pilot page's look and script helpers (build_pilot_review.STYLE / COMMON — no second
copy) and the D4 page's axis labels (build_d4_review.AXIS_LABELS). Same download format ({saved_at, file, answers:
{isbn: {…, ok}}}). Per book: why it is here (flags / rule issues / "표본"), the YES24 intro and TOC, AI-1 and AI-2 side by
side — 🎯 keywords and way, 🍃 the four axes — with [AI-1이 맞아요] / [AI-2가 맞아요] (copy that opinion into the form,
confirm, and a "doesn't fit" opinion moves the book out), and the editable form: 🎯 topic · keyword chips (closed list) ·
way · a keyword candidate (a short name missing from the list, 12 characters — pipeline/keyword_candidates.py), 🍃 genre · four axes as three-way choices (the D4 wording), the one-liner with a live rule check, and a decision
(넣기 / 대기 / 빼기 / 다른 갈래로 — a 🎯 book that is really a 🍃 genre book, or the other way round, goes back in as
the other entry: 🎯 → 🍃 asks for the genre, 🍃 → 🎯 may name a topic or leave it to the pipeline; pipeline/requeue.py).
Progress stays in this browser (localStorage).
"""
from build_pilot_review import COMMON, STYLE

EXTRA_STYLE = """
.badge{display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--ink);color:var(--paper);margin-left:6px;vertical-align:middle}
.q{margin:12px 0 6px;font-weight:700;font-size:14px}.q .hint{font-size:12px;color:var(--muted);font-weight:400}
.opts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.opts label{position:relative;border:1px solid var(--ink);border-radius:10px;padding:9px 4px;font-size:14px;cursor:pointer;background:var(--paper);min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center}
.opts input{position:absolute;opacity:0;width:1px;height:1px}.opts label:has(input:checked){background:var(--ink);color:var(--paper)}
.opts label:has(input:focus-visible){outline:3px solid #3A6684;outline-offset:2px}
.ai ul{margin:4px 0 0;padding-left:16px}.ai .diff{background:#F6DCE2;border-radius:4px;padding:0 3px}
.opts .ai1,.opts .ai2{display:block;font-size:11px;color:var(--muted)}
.opts label:has(input:checked) .ai1,.opts label:has(input:checked) .ai2{color:var(--line)}
"""

TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 오늘의 새 책 검수</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
__STYLE__
</style></head><body><main>
<h1>갈피 오늘의 새 책 검수 — <span id="name"></span></h1>
<p class="sub">두 AI가 다르게 봤거나 규칙 검사에 걸린 책, 그리고 두 AI가 같게 본 책 중 <b>표본</b>으로 뽑힌 책이에요(주간 표본 검수면 뽑힌 책 전부).
질문 하나: <b>이 칸으로 찾아온 사람에게 이 책을 줘도 되나?</b> 두 AI 중 하나가 맞으면 <b>AI-1이 맞아요</b> / <b>AI-2가 맞아요</b>,
아니면 고칠 곳만 고치고 <b>맞아요</b>. 다 하면 아래 <b>검수 결과 내려받기</b> → <code>python -m src.pipeline.review … --apply &lt;파일&gt;</code>.
일치율은 여기서 사람이 확인한 책만으로 계산해요 — 두 AI가 같게 봐서 이 페이지에 없는 책은 사람이 보지 않았고 따로 세요.</p>
<div id="app"></div></main>
<div class="bar"><span id="prog"></span><button id="dl">검수 결과 내려받기</button></div>
<script>
const BOOKS=__BOOKS__, KW=__KW__, GENRES=__GENRES__, DEFS=__DEFS__, AXES=__AXES__, WAYS=__WAYS__, KEY=__KEY__, NAME=__NAME__;
__COMMON__
const TOPICS=Object.keys(KW);
const FLAG={fits:"두 AI 중 하나가 이 칸에 안 맞을 수 있다고 봐요",keywords:"키워드가 달라요",way:"읽는 방식이 달라요",temp:"온도가 달라요",
 pull:"끌림이 달라요",gain:"얻는 것이 달라요",world:"세계가 달라요",confidence:"AI-1 확신이 낮아요"};
const STATUS=[["picked","넣기"],["reserve","대기"],["dropped","빼기"],["requeue","다른 갈래로 (다시 태그)"]];
const SAMPLE_WHY="표본 — 두 AI가 같게 봤어요. 사람이 한 번 확인해 두 AI가 같아도 틀리는지 재요";
const side=(k,v)=>{const a=AXES.find(x=>x[0]===k);return v>0?a[2]:v<0?a[4]:a[3]};
const base=b=>b.entry==="target"?{topic:b.topic,keywords:[...(b.keywords||[])],way:b.way,keyword_candidate:b.keyword_candidate||""}:{genre:b.genre,axes:{...b.axes}};
const cur=b=>st[b.isbn]||{...base(b),one_liner:b.one_liner,status:b.status==="reserve"?"reserve":"picked",ok:false};
const put=(b,patch)=>{st[b.isbn]={...cur(b),...patch,ok:false,pick:null};save();render()};
const kw=l=>l&&l.length?l.map(esc).join(", "):"(없음)";
const sameSet=(a,c)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(c||[])].sort());
function issues(s,b){const out=baseIssues(s,b.title);
 if(b.entry==="leaf"&&!s.trim().endsWith("?"))out.push("질문형은 ?로 끝나요");if(b.entry==="target"&&s.trim().endsWith("?"))out.push("요약형에 물음표");return out}
function opinion(b,n){const o=n===1?b:b.second||{}, d=n===1?b.second||{}:b, mark=(same,t)=>same?t:`<span class="diff">${t}</span>`;
 const fit=`맞음 ${o.fits?"예":"아니요"}`, tail=n===1?` · 확신 ${b.confidence}`:o.why?` — ${esc(o.why)}`:"";
 if(b.entry==="target")return `<div class="ai"><b>AI-${n}</b>키워드 ${mark(sameSet(o.keywords,d.keywords),kw(o.keywords))}<br>방식 ${mark(o.way===d.way,esc(o.way))}<br>${fit}${tail}</div>`;
 const lines=AXES.map(([k,q])=>`<li>${esc(q)}: ${mark((o.axes||{})[k]===(d.axes||{})[k],esc(side(k,(o.axes||{})[k])))}</li>`).join("");
 return `<div class="ai"><b>AI-${n}</b><ul>${lines}</ul>${fit}${tail}</div>`}
function picks(b,c){const two=b.second||{}, drop2=two.fits===false;
 return `<div class="cmp">${opinion(b,1)}${opinion(b,2)}</div><div class="picks"><button data-act="pick1" class="${c.ok&&c.pick==="ai1"?"chosen":""}">AI-1이 맞아요${b.fits===false?" (빼기)":""}</button>
  <button data-act="pick2" class="${c.ok&&c.pick==="ai2"?"chosen":""}" title="${drop2?"AI-2가 이 칸에 안 맞다고 봐요: 누르면 이 책을 빼요":"AI-2의 태그를 폼에 넣고 확인"}">AI-2가 맞아요${drop2?" (빼기)":""}</button></div>`}
function fields(b,c){
 if(b.entry==="target"){const kws=(KW[c.topic]||[]).map(k=>`<button class="chip ${c.keywords.includes(k)?"on":""}" data-kw="${esc(k)}" title="${esc((DEFS[c.topic]||{})[k]||"")}">${esc(k)}</button>`).join("");
  const defs=Object.entries(DEFS[c.topic]||{}).map(([k,d])=>`<li><b>${esc(k)}</b> — ${esc(d)}</li>`).join("");
  return `<div class="row"><span class="lab">주제</span><select data-act="topic">${TOPICS.map(t=>`<option ${t===c.topic?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
   <div class="row"><span class="lab">키워드</span>${kws||'<span class="cnt">(키워드 없음)</span>'}</div>
   ${defs?`<details class="defs"><summary>키워드 뜻 보기 (책의 중심일 때만 붙여요)</summary><ul>${defs}</ul></details>`:""}
   <div class="row"><span class="lab">방식</span><select data-act="way">${WAYS.map(([w,l])=>`<option value="${w}" ${w===c.way?"selected":""}>${w} — ${esc(l)}</option>`).join("")}</select></div>
   <div class="row"><span class="lab">후보</span><input type="text" data-act="cand" maxlength="12" value="${esc(c.keyword_candidate||"")}" placeholder="목록에 없는 키워드 후보 (12자)" title="책의 중심이 위 키워드 목록에 없을 때만 — 짧은 이름. 5권이 모이면 키워드로 만들지 물어봐요"></div>`}
 const two=b.second||{axes:{}};
 return `<div class="row"><span class="lab">장르</span><select data-act="genre">${GENRES.map(g=>`<option ${g===c.genre?"selected":""}>${esc(g)}</option>`).join("")}</select></div>`
  +AXES.map(([k,q,p,z,m,hint])=>`<p class="q">${esc(q)} <span class="hint">— ${esc(hint)}</span></p><div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="ax-${b.isbn}-${k}" data-axis="${k}" value="${v}" ${c.axes[k]===v?"checked":""}><span>${esc(t)}
   ${b.axes[k]===v?'<span class="ai1">AI-1</span>':""}${two.axes[k]===v?'<span class="ai2">AI-2</span>':""}</span></label>`).join("")}</div>`).join("")}
function card(b){const c=cur(b), why=[...(b.flags||[]).map(f=>FLAG[f]||f),...(b.issues||[])], li=issues(c.one_liner,b);
 return `<div class="card ${c.ok?"done":""} ${c.status==="dropped"?"dropped":""}" id="b${b.isbn}"><p class="t">${b.entry==="target"?"🎯":"🍃"} ${esc(b.title)}${b.sample?'<span class="badge">표본</span>':""}</p>
  <p class="meta">${esc(b.author)} · ${b.pages}쪽 · <a href="${esc(b.link)}" target="_blank" rel="noopener">예스24</a> · ${esc(b.file)}</p>
  <div class="intro">${esc(b.intro)}</div><details><summary>책소개 전체 · 목차</summary><pre>${esc(b.intro_full)}</pre><pre>${esc(b.toc)}</pre></details>
  <p class="why">왜 보나: ${why.length?why.map(esc).join(" · "):SAMPLE_WHY}</p><p class="ev">근거(우리 말): ${esc(b.evidence)}</p>${picks(b,c)}
  ${fields(b,c)}<div class="row"><span class="lab">한 줄</span><input type="text" data-act="line" value="${esc(c.one_liner)}"></div>
  <div class="row"><span class="cnt ${li.length?"bad":""}">${len(c.one_liner)}자 ${li.join(" · ")}</span></div>
  <div class="row"><span class="lab">결정</span><select data-act="status">${STATUS.map(([v,l])=>`<option value="${v}" ${v===c.status?"selected":""}>${l}</option>`).join("")}</select>
  <button class="ok" data-act="ok">${c.ok?"확인함 ✓":"맞아요"}</button></div>${requeueRow(b,c)}</div>`}
function requeueRow(b,c){if(c.status!=="requeue")return "";
 if(b.entry==="target")return `<div class="row"><span class="lab">🍃 장르</span><select data-act="to_slot"><option value="">장르를 골라 주세요</option>${GENRES.map(g=>`<option ${g===c.to_slot?"selected":""}>${esc(g)}</option>`).join("")}</select>
  <span class="cnt">이 책을 🍃 이야기 책으로 다시 태그해요 (다음 묶음)</span></div>`;
 return `<div class="row"><span class="lab">🎯 주제</span><select data-act="to_slot"><option value="">AI가 정해요</option>${TOPICS.map(t=>`<option ${t===c.to_slot?"selected":""}>${esc(t)}</option>`).join("")}</select>
  <span class="cnt">이 책을 🎯 배우기 책으로 다시 태그해요 (다음 묶음)</span></div>`}
function render(){
 const open=[...document.querySelectorAll("details[open]")].map(d=>(d.closest(".card")||{}).id+"|"+d.className);
 document.getElementById("app").innerHTML=BOOKS.map(card).join("");
 document.querySelectorAll("details").forEach(d=>{if(open.includes((d.closest(".card")||{}).id+"|"+d.className))d.open=true});
 document.getElementById("prog").textContent=`확인 ${BOOKS.filter(b=>cur(b).ok).length}/${BOOKS.length}`}
const bookOf=e=>{const el=e.target.closest(".card");return el&&BOOKS.find(x=>"b"+x.isbn===el.id)};
const toEntry=b=>b.entry==="target"?"leaf":"target";
const fromAi=(b,n)=>{const o=n===1?b:b.second||{};
 return {...(b.entry==="target"?{keywords:[...(o.keywords||[])],way:o.way}:{axes:{...o.axes}}),status:o.fits===false?"dropped":cur(b).status}};  // never promotes a held book: the decision stays as it is
document.addEventListener("click",e=>{const b=bookOf(e); if(!b)return; const c=cur(b), k=e.target.dataset.kw, act=e.target.dataset.act;
 if(k!==undefined){put(b,{keywords:c.keywords.includes(k)?c.keywords.filter(x=>x!==k):[...c.keywords,k].slice(0,5)});return}
 if(act==="pick1"||act==="pick2"){st[b.isbn]={...c,...fromAi(b,act==="pick1"?1:2),ok:true,pick:act==="pick1"?"ai1":"ai2"};save();render();return}
 if(act==="ok"){if(c.status==="requeue"&&b.entry==="target"&&!c.to_slot){alert("어느 🍃 장르 책인지 골라 주세요");return}
  st[b.isbn]={...c,ok:true};save();render()}});
document.addEventListener("change",e=>{const b=bookOf(e); if(!b)return; const act=e.target.dataset.act, axis=e.target.dataset.axis, v=e.target.value;
 if(axis){put(b,{axes:{...cur(b).axes,[axis]:Number(v)}});return}
 if(act==="topic")put(b,{topic:v,keywords:[]}); if(act==="way")put(b,{way:v}); if(act==="genre")put(b,{genre:v});
 if(act==="status")put(b,v==="requeue"?{status:v,to_entry:toEntry(b),to_slot:cur(b).to_slot||""}:{status:v});
 if(act==="to_slot")put(b,{to_slot:v})});  // the one-liner is stored by the input handler (a re-render here would swallow the next click)
document.addEventListener("input",e=>{if(e.target.dataset.act==="cand"){const b=bookOf(e), el=e.target.closest(".card");
  st[b.isbn]={...cur(b),keyword_candidate:e.target.value,ok:false,pick:null};save();
  el.classList.remove("done"); const ok=el.querySelector(".ok"); if(ok)ok.textContent="맞아요"; return}
 if(e.target.dataset.act!=="line")return; const b=bookOf(e), el=e.target.closest(".card");
 st[b.isbn]={...cur(b),one_liner:e.target.value,ok:false,pick:null};save();
 const li=issues(e.target.value,b), cnt=e.target.parentElement.nextElementSibling.firstElementChild;
 cnt.textContent=`${len(e.target.value)}자 ${li.join(" · ")}`; cnt.className="cnt"+(li.length?" bad":"");
 el.classList.remove("done"); const ok=el.querySelector(".ok"); if(ok)ok.textContent="맞아요"});
document.getElementById("dl").onclick=()=>{const answers={};
 for(const b of BOOKS){const c=st[b.isbn]; if(c&&c.ok){const a={...c,one_liner:c.one_liner.trim(),...(typeof c.keyword_candidate==="string"?{keyword_candidate:c.keyword_candidate.trim()}:{})}; if(!a.pick)delete a.pick; answers[b.isbn]=a}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),file:NAME,answers},null,1)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${NAME}-review.json`;a.click()};
document.getElementById("name").textContent=NAME; render();
</script></body></html>
""".replace("__STYLE__", STYLE + EXTRA_STYLE).replace("__COMMON__", COMMON)
