"""HTML of the pipeline review page (review.py fills the __…__ slots and writes it under data/processed/check/pipeline/).

One page for both entries, built on the pilot page's look and script helpers (build_pilot_review.STYLE / COMMON — no second
copy) and the D4 page's axis labels (build_d4_review.AXIS_LABELS). Same download format ({saved_at, file, answers:
{isbn: {…, ok}}}). 10-05: only what a person must decide — books grouped as ① fits (one pass says the book does not fit
its slot), ② fields the two passes answered differently, ③ a one-liner that breaks a rule, ④ the trial sample — and per
book only those questions, with AI-1 / AI-2 marked on the choices and nothing preselected; [확인] stays off until each is
answered. Fields both passes agreed on are one summary line, editable under "같게 본 칸도 고치기", which also holds the
other decisions (대기 / 다른 갈래로 — a 🎯 book that is really a 🍃 genre book, or the other way round, goes back in as the
other entry; pipeline/requeue.py). Notes the app never shows (the evidence / pass B reason checks) and "AI-1 unsure" on
agreed books are not asked (checks.needs_person). Progress stays in this browser (localStorage).
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
.opts label:has(input:checked) .ai1,.opts label:has(input:checked) .ai2,.opts label:has(input:checked) .ai0{color:var(--line)}
.opts .ai0{display:block;font-size:11px;color:var(--muted)}.opts.two{grid-template-columns:1fr 1fr}
h2{font-family:'Gowun Batang',serif;font-size:17px;margin:22px 0 2px}h2 small{font-size:12px;color:var(--muted);font-weight:400}
#toc{font-size:13px;margin:4px 0 8px}#toc a{color:var(--ink)}
.agreed{font-size:12.5px;color:var(--soft);margin:10px 0 4px;line-height:1.6}.agreed b{color:var(--ok)}
.fix summary{font-size:12.5px;color:var(--muted);cursor:pointer}.ghost.on{background:var(--ink);color:var(--paper)}.ok:disabled{opacity:.45;cursor:not-allowed}
"""

TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 오늘의 새 책 검수</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
__STYLE__
</style></head><body><main>
<h1>갈피 오늘의 새 책 검수 — <span id="name"></span></h1>
<p class="sub"><b>사람이 정해야 하는 것만</b> 모았어요. 카드마다 <b>두 AI가 다르게 본 칸</b>과 <b>규칙에 걸린 한 줄</b>만 물어요 —
같게 본 칸은 그대로 들어가요(고치고 싶으면 카드의 "같게 본 칸도 고치기"). 여기 답이 쌓이면 두 AI가 같게 볼 때 얼마나 맞는지 재고,
충분히 맞으면 사람 확인 없이 들어가요(자동화). 근거 메모의 길이·베낌, AI-1 확신 낮음처럼 앱에 나가지 않는 것은 묻지 않아요.
다 하면 아래 <b>검수 결과 내려받기</b> → <code>python -m src.pipeline.review … --apply &lt;파일&gt;</code>.</p>
<nav id="toc"></nav>
<div id="app"></div></main>
<div class="bar"><span id="prog"></span><button id="dl">검수 결과 내려받기</button></div>
<script>
const BOOKS=__BOOKS__, KW=__KW__, GENRES=__GENRES__, DEFS=__DEFS__, AXES=__AXES__, WAYS=__WAYS__, KEY=__KEY__, NAME=__NAME__;
__COMMON__
const TOPICS=Object.keys(KW);
const STATUS=[["picked","넣기"],["reserve","대기"],["dropped","빼기"],["requeue","다른 갈래로 (다시 태그)"]];
const AXIS_NAME={temp:"온도",pull:"끌림",gain:"얻는 것",world:"세계"};
const NOTE=/^(근거 없음|근거 김|근거가 |판단 이유)/;
const GROUPS=[["fits","① 넣을지 정하기","두 AI 중 하나가 이 책이 이 칸에 안 맞는다고 봤어요"],
 ["tags","② 두 AI가 다르게 본 칸","다르게 본 칸만 골라 주세요"],
 ["line","③ 한 줄 고치기","이용자에게 보이는 한 줄이 규칙에 걸렸어요"],
 ["sample","④ 표본 — 두 AI가 같게 본 책","자동으로 들어갈 책이 정말 맞는지 재요. 맞으면 [확인]만 누르면 돼요"]];
const side=(k,v)=>{const a=AXES.find(x=>x[0]===k);return v>0?a[2]:v<0?a[4]:a[3]};
const base=b=>b.entry==="target"?{topic:b.topic,keywords:[...(b.keywords||[])],way:b.way,keyword_candidate:b.keyword_candidate||""}:{genre:b.genre,axes:{...b.axes}};
const cur=b=>st[b.isbn]||{...base(b),one_liner:b.one_liner,status:"picked",answered:[],ok:false};
const put=(b,patch,key,undo)=>{const c=cur(b), was=(c.answered||[]).filter(k=>k!==undo);st[b.isbn]={...c,...patch,answered:key&&!was.includes(key)?[...was,key]:was,ok:false};save();render()};
const kw=l=>l&&l.length?l.map(esc).join(", "):"(없음)";
const splits=b=>(b.flags||[]).filter(f=>f!=="confidence");
const heldBy=b=>(b.issues||[]).filter(i=>!NOTE.test(i));
const groupOf=b=>b.sample?"sample":splits(b).includes("fits")?"fits":splits(b).length?"tags":"line";
function issues(s,b){const out=baseIssues(s,b.title);
 if(b.entry==="leaf"&&!s.trim().endsWith("?"))out.push("질문형은 ?로 끝나요");if(b.entry==="target"&&s.trim().endsWith("?"))out.push("요약형에 물음표");return out}
const asks=b=>[...splits(b),...(heldBy(b).length?["line"]:[])];
// a held line is answered when it passes the rules here AND the person edited it or kept it on purpose ("이대로 괜찮아요"):
// some rules (근거 약함, the YES24-copy check) need the intro and cannot be checked again on this page
const lineLeft=(b,c)=>issues(c.one_liner,b).length>0||(c.one_liner.trim()===(b.one_liner||"").trim()&&!(c.answered||[]).includes("line"));
const left=(b,c)=>asks(b).filter(k=>k==="line"?lineLeft(b,c):!(c.answered||[]).includes(k));
const decisionKey=b=>asks(b).includes("fits")?"fits":null;  // any decision in the box also answers "넣을지"
const chipsOf=(b,c)=>{const kept=KW[c.topic]||[], two=b.second||{};
 return [...new Set([...(b.keywords||[]),...(two.keywords||[]),...kept])].filter(x=>kept.includes(x))};
const marks=(on1,on2)=>`${on1?'<span class="ai1">AI-1</span>':""}${on2?'<span class="ai2">AI-2</span>':""}`;
const NAME_OF=k=>k==="fits"?"넣을지":k==="line"?"한 줄":k==="keywords"?"키워드":k==="way"?"방식":AXIS_NAME[k]||k;
function ask(b,c,k){const two=b.second||{}, done=(c.answered||[]).includes(k);
 if(k==="fits"){const slot=b.entry==="target"?b.topic:b.genre, yes=o=>o.fits===false?"안 맞아요":"맞아요";
  return `<p class="q">이 책, <b>${esc(slot)}</b> 칸에 맞나요? <span class="hint">— AI-1 ${yes(b)} · AI-2 ${yes(two)}${two.why?` (AI-2: ${esc(two.why)})`:""}</span></p>
   <div class="opts two"><label><input type="radio" name="fit-${b.isbn}" data-act="fit" value="picked" ${done&&c.status!=="dropped"?"checked":""}><span>맞아요 · 넣기</span></label>
   <label><input type="radio" name="fit-${b.isbn}" data-act="fit" value="dropped" ${done&&c.status==="dropped"?"checked":""}><span>안 맞아요 · 빼기</span></label></div>`}
 if(AXIS_NAME[k]){const [,q,p,z,m,hint]=AXES.find(x=>x[0]===k), ax2=two.axes||{};
  return `<p class="q">${esc(q)} <span class="hint">— ${esc(hint)}</span></p><div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="q-${b.isbn}-${k}" data-axis="${k}" value="${v}" ${done&&c.axes[k]===v?"checked":""}><span>${esc(t)}
   ${marks(b.axes[k]===v,ax2[k]===v)}</span></label>`).join("")}</div>`}
 if(k==="keywords"){const k1=b.keywords||[], k2=two.keywords||[], list=chipsOf(b,c);
  return `<p class="q">키워드 <span class="hint">— 책의 중심일 때만 · 눌러서 켜고 끄기 (최대 5개) · ¹ AI-1이 붙임 · ² AI-2가 붙임</span></p>
   <div class="row">${list.map(x=>`<button class="chip ${done&&c.keywords.includes(x)?"on":""}" data-kw="${esc(x)}" title="${esc((DEFS[c.topic]||{})[x]||"")}">${esc(x)}${k1.includes(x)?" ¹":""}${k2.includes(x)?" ²":""}</button>`).join("")}
   <button class="ghost" data-act="kwnone">키워드 없음</button></div>`}
 if(k==="way"){return `<p class="q">읽는 방식</p><div class="opts">${WAYS.map(([w,l])=>`<label><input type="radio" name="way-${b.isbn}" data-act="way" value="${w}" ${done&&c.way===w?"checked":""}><span>${w}<span class="ai0">${esc(l)}</span>${marks(b.way===w,two.way===w)}</span></label>`).join("")}</div>`}
 if(k==="line"){const li=issues(c.one_liner,b);
  return `<p class="q">한 줄 고치기 <span class="hint">— 걸린 이유: ${heldBy(b).map(esc).join(" · ")}${b.one_liner?"":" (책소개를 베껴서 지웠어요 — 새로 써 주세요)"}</span></p>
   <div class="row"><input type="text" data-act="line" value="${esc(c.one_liner)}" placeholder="${b.entry==="leaf"?"질문형 — ?로 끝나요":"요약형 — 물음표 없이"} · 공백 빼고 12~36자"></div>
   <div class="row"><span class="cnt ${li.length?"bad":""}">${len(c.one_liner)}자 ${li.join(" · ")}</span>
   ${b.one_liner&&!li.length?`<button class="ghost ${(c.answered||[]).includes("line")?"on":""}" data-act="linekeep">이대로 괜찮아요</button>`:""}</div>`}
 return ""}
function agreed(b,c){const s=new Set(splits(b)), out=[];
 if(b.entry==="target"){out.push(`주제 ${esc(c.topic)}`);if(!s.has("keywords"))out.push(`키워드 ${kw(c.keywords)}`);if(!s.has("way"))out.push(`방식 ${esc(c.way)}`)}
 else{out.push(`장르 ${esc(c.genre)}`);for(const k of Object.keys(AXIS_NAME))if(!s.has(k))out.push(`${AXIS_NAME[k]} ${esc(side(k,c.axes[k]))}`)}
 if(!heldBy(b).length)out.push(`한 줄 “${esc(c.one_liner)}”`);
 return out.join(" · ")}
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
function card(b){const c=cur(b), q=asks(b), rest=left(b,c), lineAsked=q.includes("line");
 return `<div class="card ${c.ok?"done":""} ${c.status==="dropped"?"dropped":""}" id="b${b.isbn}"><p class="t">${b.entry==="target"?"🎯":"🍃"} ${esc(b.title)}${b.sample?'<span class="badge">표본</span>':""}</p>
  <p class="meta">${esc(b.author)} · ${b.pages}쪽 · <a href="${esc(b.link)}" target="_blank" rel="noopener">예스24</a></p>
  <div class="intro">${esc(b.intro)}</div><details><summary>책소개 전체 · 목차</summary><pre>${esc(b.intro_full)}</pre><pre>${esc(b.toc)}</pre></details>
  ${q.length?`<p class="why">정할 것 ${q.length}개: ${q.map(NAME_OF).join(" · ")}</p>`:""}
  ${q.map(k=>ask(b,c,k)).join("")}
  <p class="agreed"><b>${q.length?"같게 본 칸":"두 AI가 같게 봤어요"}</b> ${agreed(b,c)}</p>
  <details class="fix"><summary>같게 본 칸도 고치기 · 다른 결정</summary>${fields(b,c)}
   ${lineAsked?"":`<div class="row"><span class="lab">한 줄</span><input type="text" data-act="line" value="${esc(c.one_liner)}"></div><div class="row"><span class="cnt"></span></div>`}
   <div class="row"><span class="lab">결정</span><select data-act="status">${STATUS.map(([v,l])=>`<option value="${v}" ${v===c.status?"selected":""}>${l}</option>`).join("")}</select></div>${requeueRow(b,c)}</details>
  <div class="row"><button class="ok" data-act="ok" ${rest.length&&!c.ok?"disabled":""}>${c.ok?"확인함 ✓":rest.length?`남은 것 ${rest.length}개`:"확인"}</button></div></div>`}
function requeueRow(b,c){if(c.status!=="requeue")return "";
 if(b.entry==="target")return `<div class="row"><span class="lab">🍃 장르</span><select data-act="to_slot"><option value="">장르를 골라 주세요</option>${GENRES.map(g=>`<option ${g===c.to_slot?"selected":""}>${esc(g)}</option>`).join("")}</select>
  <span class="cnt">이 책을 🍃 이야기 책으로 다시 태그해요 (다음 묶음)</span></div>`;
 return `<div class="row"><span class="lab">🎯 주제</span><select data-act="to_slot"><option value="">AI가 정해요</option>${TOPICS.map(t=>`<option ${t===c.to_slot?"selected":""}>${esc(t)}</option>`).join("")}</select>
  <span class="cnt">이 책을 🎯 배우기 책으로 다시 태그해요 (다음 묶음)</span></div>`}
function render(){
 const open=[...document.querySelectorAll("details[open]")].map(d=>(d.closest(".card")||{}).id+"|"+d.className);
 document.getElementById("app").innerHTML=GROUPS.map(([g,t,d])=>{const list=BOOKS.filter(b=>groupOf(b)===g); if(!list.length)return "";
  return `<h2 id="g-${g}">${esc(t)} <small>${list.filter(b=>cur(b).ok).length}/${list.length} 확인</small></h2><p class="sub">${esc(d)}</p>${list.map(card).join("")}`}).join("");
 document.getElementById("toc").innerHTML=GROUPS.map(([g,t])=>{const n=BOOKS.filter(b=>groupOf(b)===g).length;return n?`<a href="#g-${g}">${esc(t)} ${n}권</a>`:""}).filter(Boolean).join(" · ");
 document.querySelectorAll("details").forEach(d=>{if(open.includes((d.closest(".card")||{}).id+"|"+d.className))d.open=true});
 document.getElementById("prog").textContent=`확인 ${BOOKS.filter(b=>cur(b).ok).length}/${BOOKS.length}`}
const bookOf=e=>{const el=e.target.closest(".card");return el&&BOOKS.find(x=>"b"+x.isbn===el.id)};
const toEntry=b=>b.entry==="target"?"leaf":"target";
document.addEventListener("click",e=>{const b=bookOf(e); if(!b)return; const c=cur(b), k=e.target.dataset.kw, act=e.target.dataset.act;
 if(k!==undefined){put(b,{keywords:c.keywords.includes(k)?c.keywords.filter(x=>x!==k):[...c.keywords,k].slice(0,5)},"keywords");return}
 if(act==="kwnone"){put(b,{keywords:[]},"keywords");return}
 if(act==="linekeep"){put(b,{one_liner:b.one_liner},"line");return}
 if(act==="ok"){if(left(b,c).length)return; if(c.status==="requeue"&&b.entry==="target"&&!c.to_slot){alert("어느 🍃 장르 책인지 골라 주세요");return}
  st[b.isbn]={...c,ok:true};save();render()}});
document.addEventListener("change",e=>{const b=bookOf(e); if(!b)return; const act=e.target.dataset.act, axis=e.target.dataset.axis, v=e.target.value;
 if(axis){put(b,{axes:{...cur(b).axes,[axis]:Number(v)}},axis);return}
 if(act==="fit"){put(b,{status:v},"fits");return}
 if(act==="topic")put(b,{topic:v,keywords:[]},null,"keywords"); if(act==="way")put(b,{way:v},"way"); if(act==="genre")put(b,{genre:v});
 if(act==="status")put(b,v==="requeue"?{status:v,to_entry:toEntry(b),to_slot:cur(b).to_slot||""}:{status:v},decisionKey(b));
 if(act==="to_slot")put(b,{to_slot:v})});  // the one-liner is stored by the input handler (a re-render here would swallow the next click)
document.addEventListener("input",e=>{if(e.target.dataset.act==="cand"){const b=bookOf(e), el=e.target.closest(".card");
  st[b.isbn]={...cur(b),keyword_candidate:e.target.value,ok:false};save(); el.classList.remove("done"); return}
 if(e.target.dataset.act!=="line")return; const b=bookOf(e), el=e.target.closest(".card");
 st[b.isbn]={...cur(b),one_liner:e.target.value,ok:false};save();
 const c=cur(b), li=issues(e.target.value,b), nx=e.target.parentElement.nextElementSibling, cnt=nx&&nx.querySelector(".cnt");
 if(cnt){cnt.textContent=`${len(e.target.value)}자 ${li.join(" · ")}`; cnt.className="cnt"+(li.length?" bad":"")}
 st[b.isbn]={...c,answered:(c.answered||[]).filter(k=>k!=="line")};save();  // an edit replaces "이대로 괜찮아요"
 el.classList.remove("done"); const ok=el.querySelector(".ok"), rest=left(b,cur(b)); if(ok){ok.disabled=rest.length>0; ok.textContent=rest.length?`남은 것 ${rest.length}개`:"확인"}});
document.getElementById("dl").onclick=()=>{const answers={};
 for(const b of BOOKS){const c=st[b.isbn]; if(c&&c.ok){const a={...c,one_liner:c.one_liner.trim(),...(typeof c.keyword_candidate==="string"?{keyword_candidate:c.keyword_candidate.trim()}:{})}; if(!a.pick)delete a.pick; delete a.answered; answers[b.isbn]=a}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),file:NAME,answers},null,1)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${NAME}-review.json`;a.click()};
document.getElementById("name").textContent=NAME; render();
</script></body></html>
""".replace("__STYLE__", STYLE + EXTRA_STYLE).replace("__COMMON__", COMMON)
