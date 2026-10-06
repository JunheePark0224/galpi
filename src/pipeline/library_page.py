"""HTML of the v3 library re-tag page (retag_library --page fills the __…__ slots; written under the main checkout's
data/processed/check/pipeline/, git-ignored — it shows YES24 intro/TOC from the local cache).

Top: the counts and the table of changes v3 makes without a person (field, old → new, count; each row opens its books).
Then ① the books a person decides (library_review "person": only the asked fields — a split the majority did not settle,
정보 없음, the slot, the library's one-liner when it breaks a rule — with AI-1 / AI-2 / AI-3 (the tiebreak pass) / 지금
marked on the choices; nothing preselected) and ② the seeded 5% sample of the books decided without a person, prefilled
with the v3 values: [확인] or fix a field under "칸 고치기". Same look and helpers as the daily review page
(build_pilot_review.STYLE / COMMON, review_page.EXTRA_STYLE). Download: {saved_at, file, answers: {isbn: {…, ok: true}}}
→ `python -m src.pipeline.retag_library --apply <download>`. Progress stays in this browser (its own localStorage key).
"""
from build_pilot_review import COMMON, STYLE

from .review_page import EXTRA_STYLE

PAGE_STYLE = """
table.chg{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}table.chg td,table.chg th{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;vertical-align:top}
table.chg details summary{cursor:pointer;color:var(--muted)}table.chg ul{margin:4px 0;padding-left:16px}
.auto{font-size:12.5px;color:var(--soft);margin:6px 0}.opts .ai3,.opts .now{display:block;font-size:11px;color:var(--muted)}
.opts label:has(input:checked) .ai3,.opts label:has(input:checked) .now{color:var(--line)}
"""

TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 서재 다시 태그 v3</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
__STYLE__
</style></head><body><main>
<h1>갈피 서재 다시 태그 — 정의서 v3</h1>
<p class="sub">서재의 모든 책을 v3 기준으로 두 AI가 다시 태그했어요. <b>사람이 정해야 하는 것만</b> 물어요 — 두 AI가 갈렸는데 세 번째 AI로도
안 정해진 칸, 정보 없음, 이 칸이 아니라는 책, 규칙에 걸린 지금 한 줄. 두 AI가 같게 본 값은 묻지 않고 <b>자동으로 들어가요</b>(지금 값은
기록으로 남아 되돌릴 수 있어요) — 무엇이 바뀌는지는 아래 표. 표본은 자동으로 들어갈 책 중 5%예요: 맞으면 [확인]만.
다 하면 <b>검수 결과 내려받기</b> → <code>python -m src.pipeline.retag_library --apply &lt;파일&gt;</code> → <code>cd web &amp;&amp; npm run books:import</code>.</p>
<div id="counts" class="sub"></div>
<h2>칸 이동 <small>두 AI가 모두 "이 칸 아님"이라며 같은 칸을 짚었거나, 세 번째 AI 다수결로 옮겨요</small></h2>
<div id="moves"></div>
<h2>자동으로 바뀌는 값 <small>두 AI가 같게 봤거나(키워드는 두 AI가 함께 고른 것만) 다수결로 정해졌는데 지금 서재 값과 달라요 — 이상한 줄은 열어서 책을 보세요</small></h2>
<div id="table"></div>
<nav id="toc"></nav>
<div id="app"></div></main>
<div class="bar"><span id="prog"></span><button id="dl">검수 결과 내려받기</button></div>
<script>
const BOOKS=__BOOKS__, KW=__KW__, GENRES=__GENRES__, DEFS=__DEFS__, AXES=__AXES__, WAYS=__WAYS__, KEY=__KEY__, NAME=__NAME__,
 TABLE=__TABLE__, COUNTS=__COUNTS__, TITLES=__TITLES__;
__COMMON__
const TOPICS=Object.keys(KW);
const AXIS_NAME={temp:"온도",pull:"끌림",gain:"얻는 것",world:"세계"};
const FNAME=k=>k==="slot"?"어디에 둘지":k==="line"?"한 줄":k==="keywords"?"키워드":k==="way"?"방식":AXIS_NAME[k]||k;
const GROUPS=[["person","① 사람이 정할 책","두 AI가 갈렸는데 다수결로도 안 정해진 칸, 정보 없음, 이 칸이 아니라는 책, 규칙에 걸린 지금 한 줄"],
 ["sample","② 표본 — 자동으로 들어갈 책 5%","v3 값이 채워져 있어요. 맞으면 [확인], 틀리면 아래 '칸 고치기'에서 고쳐 주세요"]];
const leafOf=b=>b.entry==="leaf";
const side=(k,v)=>{const a=AXES.find(x=>x[0]===k);return v===null||v===undefined?"(비어 있음)":v>0?a[2]:v<0?a[4]:a[3]};
function init(b){const cur=b.current, au=b.auto;
 const v=leafOf(b)?{genre:au.slot||cur.genre,axes:{...cur.axes,...Object.fromEntries(Object.entries(au).filter(([k])=>AXIS_NAME[k]))}}
  :{topic:au.slot||cur.topic,keywords:[...(au.keywords||cur.keywords||[])],way:au.way||cur.way};
 return {...v,one_liner:cur.one_liner,status:"picked",answered:[],ok:false}}
const cur=b=>st[b.isbn]||init(b);
const put=(b,patch,key)=>{const c=cur(b), was=c.answered||[];st[b.isbn]={...c,...patch,answered:key&&!was.includes(key)?[...was,key]:was,ok:false};save();render()};
function issues(s,b){const out=baseIssues(s,b.title);if(leafOf(b)&&!s.trim().endsWith("?"))out.push("질문형은 ?로 끝나요");if(!leafOf(b)&&s.trim().endsWith("?"))out.push("요약형에 물음표");return out}
const left=(b,c)=>b.asks.filter(k=>k==="line"?(issues(c.one_liner,b).length>0||c.one_liner.trim()===b.current.one_liner.trim()):!(c.answered||[]).includes(k));
const srcs=b=>[["AI-1",b.a,"ai1"],["AI-2",b.b,"ai2"],["AI-3",b.c,"ai3"]].filter(([,o])=>o);
const passSlot=(o,slot)=>o.fits?slot:(o.suggest||"");
function marks(b,k,v){const out=srcs(b).filter(([,o])=>{if(AXIS_NAME[k])return !(o.missing||[]).includes(k)&&(o.axes||{})[k]===v;if(k==="way")return o.way===v;return false}).map(([n,,c])=>`<span class="${c}">${n}</span>`);
 const now=AXIS_NAME[k]?b.current.axes[k]===v:k==="way"?b.current.way===v:false;return out.join("")+(now?'<span class="now">지금</span>':"")}
function sigs(b,k){return `<p class="sig">${srcs(b).map(([n,o])=>{const line=(o.signals||{})[k]||"", none=(o.missing||[]).includes(k)||(o.axes||{})[k]===null;
 return line||none?`${n}: ${esc(line||"(근거 없음)")}${none?` <span class="none">정보 없음</span>`:""}`:""}).filter(Boolean).join("<br>")}</p>`}
function ask(b,c,k){const done=(c.answered||[]).includes(k);
 if(k==="slot"){const slot=b.slot, leaf=leafOf(b), names=leaf?GENRES:TOPICS, now=leaf?c.genre:c.topic, moved=now!==slot;
  const say=srcs(b).map(([n,o])=>`${n} ${o.fits?"맞아요":"안 맞아요"+(o.suggest?` → ${esc(o.suggest)}`:"")}`).join(" · ");
  const pick=!done?"":c.status==="dropped"?"dropped":moved?"move":"picked";
  return `<p class="q">이 책을 어디에 둘까요? <span class="hint">— 지금 <b>${esc(slot)}</b> · ${say}${b.b&&b.b.why?` (AI-2: ${esc(b.b.why)})`:""}</span></p>
  <div class="opts"><label><input type="radio" name="s-${b.isbn}" data-act="slot" value="picked" ${pick==="picked"?"checked":""}><span>${esc(slot)} 맞아요</span></label>
  <label><input type="radio" name="s-${b.isbn}" data-act="slot" value="move" ${pick==="move"||c.moveOpen?"checked":""}><span>다른 ${leaf?"장르":"주제"}로 옮겨요</span></label>
  <label><input type="radio" name="s-${b.isbn}" data-act="slot" value="dropped" ${pick==="dropped"?"checked":""}><span>어디에도 안 맞아요<span class="ai0">빼기</span></span></label></div>
  ${pick==="move"||c.moveOpen?`<div class="row"><select data-act="slotto"><option value="">골라 주세요</option>${names.filter(n=>n!==slot).map(n=>`<option ${moved&&n===now?"selected":""}>${esc(n)}</option>`).join("")}</select>${leaf?"":'<span class="cnt">키워드는 아래 "칸 고치기"에서 새 주제에 맞게</span>'}</div>`:""}`}
 if(AXIS_NAME[k]){const [,q,p,z,m,hint]=AXES.find(x=>x[0]===k);
  return `<p class="q">${esc(q)} <span class="hint">— ${esc(hint)}</span></p><div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="q-${b.isbn}-${k}" data-axis="${k}" value="${v}" ${done&&c.axes[k]===v?"checked":""}><span>${esc(t)}${marks(b,k,v)}</span></label>`).join("")}</div>${sigs(b,k)}`}
 if(k==="keywords"){const list=KW[c.topic]||[], has=(o,x)=>(o.keywords||[]).includes(x);
  return `<p class="q">키워드 <span class="hint">— 책의 중심일 때만 · 최대 5개 · ¹ AI-1 ² AI-2 ³ AI-3 · ✓ 지금</span></p><div class="row">${list.map(x=>`<button class="chip ${done&&c.keywords.includes(x)?"on":""}" data-kw="${esc(x)}" title="${esc((DEFS[c.topic]||{})[x]||"")}">${esc(x)}${has(b.a,x)?" ¹":""}${has(b.b,x)?" ²":""}${b.c&&has(b.c,x)?" ³":""}${b.current.keywords.includes(x)?" ✓":""}</button>`).join("")}
  <button class="ghost ${done&&!c.keywords.length?"on":""}" data-act="kwnone">키워드 없음</button></div>`}
 if(k==="way")return `<p class="q">읽는 방식</p><div class="opts">${WAYS.map(([w,l])=>`<label><input type="radio" name="w-${b.isbn}" data-act="way" value="${w}" ${done&&c.way===w?"checked":""}><span>${w}<span class="ai0">${esc(l)}</span>${marks(b,"way",w)}</span></label>`).join("")}</div>`;
 if(k==="line"){const li=issues(c.one_liner,b), v3=b.a.one_liner||"", v3ok=v3&&!issues(v3,b).length;
  return `<p class="q">한 줄 고치기 <span class="hint">— 지금 한 줄이 규칙에 걸렸어요: ${b.line_issues.map(esc).join(" · ")}</span></p>
  <div class="row"><input type="text" data-act="line" value="${esc(c.one_liner)}" placeholder="${leafOf(b)?"질문형 — ?로 끝나요":"요약형 — 물음표 없이"} · 공백 빼고 12~36자"></div>
  <div class="row"><span class="cnt ${li.length?"bad":""}">${len(c.one_liner)}자 ${li.join(" · ")}</span>${v3ok?`<button class="ghost" data-act="v3line">v3 한 줄 쓰기: “${esc(v3)}”</button>`:""}</div>`}
 return ""}
function summary(b,c){const out=[];
 if(leafOf(b)){out.push(`장르 ${esc(c.genre)}`);for(const k of Object.keys(AXIS_NAME))if(!b.asks.includes(k))out.push(`${AXIS_NAME[k]} ${esc(side(k,c.axes[k]))}`)}
 else{out.push(`주제 ${esc(c.topic)}`);if(!b.asks.includes("keywords"))out.push(`키워드 ${c.keywords.map(esc).join(", ")||"(없음)"}`);if(!b.asks.includes("way"))out.push(`방식 ${esc(c.way)}`)}
 if(!b.asks.includes("line"))out.push(`한 줄 “${esc(c.one_liner)}”`);return out.join(" · ")}
const val=(k,v)=>k==="keywords"?(v||[]).join(", ")||"(없음)":AXIS_NAME[k]?side(k,v):esc(v??"(비어 있음)");
function autoNote(b){const ch=b.changes.map(x=>`${FNAME(x.field)} ${val(x.field,x.old)} → ${val(x.field,x.new)}`), st=b.settled.map(FNAME);
 return (ch.length?`<p class="auto">자동으로 바뀌는 칸: ${ch.join(" · ")}</p>`:"")+(st.length?`<p class="auto">세 번째 AI 다수결로 정한 칸: ${st.join(" · ")}</p>`:"")}
function fields(b,c){if(leafOf(b))return `<div class="row"><span class="lab">장르</span><select data-act="genre">${GENRES.map(g=>`<option ${g===c.genre?"selected":""}>${esc(g)}</option>`).join("")}</select></div>`
  +AXES.map(([k,q,p,z,m])=>`<p class="q">${esc(q)}</p><div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="f-${b.isbn}-${k}" data-axis="${k}" data-fix="1" value="${v}" ${c.axes[k]===v?"checked":""}><span>${esc(t)}${marks(b,k,v)}</span></label>`).join("")}</div>`).join("");
 return `<div class="row"><span class="lab">주제</span><select data-act="topic">${TOPICS.map(t=>`<option ${t===c.topic?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
  <div class="row"><span class="lab">키워드</span>${(KW[c.topic]||[]).map(k=>`<button class="chip ${c.keywords.includes(k)?"on":""}" data-kw="${esc(k)}" data-fix="1">${esc(k)}</button>`).join("")||'<span class="cnt">(키워드 없음)</span>'}</div>
  <div class="row"><span class="lab">방식</span><select data-act="way" data-fix="1">${WAYS.map(([w,l])=>`<option value="${w}" ${w===c.way?"selected":""}>${w} — ${esc(l)}</option>`).join("")}</select></div>`}
function card(b){const c=cur(b), rest=left(b,c), isV1=b.source==="books_v1.json";
 const status=[["picked","넣기"],...(isV1?[]:[["reserve","대기"]]),["dropped","빼기"]];
 return `<div class="card ${c.ok?"done":""} ${c.status==="dropped"?"dropped":""}" id="b${b.isbn}"><p class="t">${leafOf(b)?"🍃":"🎯"} ${esc(b.title)}${b.group==="sample"?'<span class="badge">표본</span>':""}</p>
 <p class="meta">${esc(b.author)} · ${b.pages}쪽 · ${esc(b.source)} · <a href="${esc(b.link)}" target="_blank" rel="noopener">예스24</a></p>
 <div class="intro">${esc(b.intro)}</div><details><summary>책소개 전체 · 목차</summary><pre>${esc(b.intro_full)}</pre><pre>${esc(b.toc)}</pre></details>
 ${b.asks.length?`<p class="why">정할 것 ${b.asks.length}개: ${b.asks.map(FNAME).join(" · ")}</p>`:""}${b.asks.map(k=>ask(b,c,k)).join("")}
 ${autoNote(b)}<p class="agreed"><b>${b.asks.length?"나머지 칸":"v3 값"}</b> ${summary(b,c)}</p>
 <details class="fix"><summary>칸 고치기 · 다른 결정</summary>${fields(b,c)}
  ${b.asks.includes("line")?"":`<div class="row"><span class="lab">한 줄</span><input type="text" data-act="line" value="${esc(c.one_liner)}"></div><div class="row"><span class="cnt"></span></div>`}
  <div class="row"><span class="lab">결정</span><select data-act="status">${status.map(([v,l])=>`<option value="${v}" ${v===c.status?"selected":""}>${l}</option>`).join("")}</select></div></details>
 <div class="row"><button class="ok" data-act="ok" ${rest.length&&!c.ok?"disabled":""}>${c.ok?"확인함 ✓":rest.length?`남은 것 ${rest.length}개`:"확인"}</button></div></div>`}
function tableOf(rows){return rows.length?`<table class="chg"><tr><th>칸</th><th>지금 → v3</th><th>권</th></tr>${rows.map(r=>`<tr><td>${esc(FNAME(r.field))}</td><td>${esc(r.field==="keywords"||r.field==="slot"?r.change:r.change.split(" → ").map(v=>AXIS_NAME[r.field]&&v!=="(비어 있음)"?`${v} ${side(r.field,Number(v))}`:v).join(" → "))}</td><td><details><summary>${r.count}권</summary><ul>${r.isbns.map(i=>`<li>${esc(TITLES[i]||i)} <small>${i}</small></li>`).join("")}</ul></details></td></tr>`).join("")}</table>`:'<p class="sub">없음</p>'}
function head(){document.getElementById("counts").innerHTML=`서재 ${COUNTS.books}권 다시 태그 · 사람이 정할 책 <b>${COUNTS.to_person}</b> · 자동으로 칸을 옮기는 책 ${COUNTS.moved_auto} · 키워드를 두 AI 공통으로 정한 책 ${COUNTS.keyword_intersection} · 세 번째 AI 다수결로 정해진 책 ${COUNTS.settled_by_tiebreak} · 자동으로 값이 바뀌는 책 ${COUNTS.changed_auto} · 표본 ${COUNTS.sample} · 그대로 ${COUNTS.unchanged_silent}${COUNTS.skipped?` · 태그 실패 ${COUNTS.skipped}`:""}`;
 document.getElementById("moves").innerHTML=tableOf(TABLE.filter(r=>r.field==="slot"));
 document.getElementById("table").innerHTML=tableOf(TABLE.filter(r=>r.field!=="slot"))}
function render(){const open=[...document.querySelectorAll(".card details[open]")].map(d=>d.closest(".card").id+"|"+d.className);
 document.getElementById("app").innerHTML=GROUPS.map(([g,t,d])=>{const list=BOOKS.filter(b=>b.group===g);if(!list.length)return "";
  return `<h2 id="g-${g}">${esc(t)} <small>${list.filter(b=>cur(b).ok).length}/${list.length} 확인</small></h2><p class="sub">${esc(d)}</p>${list.map(card).join("")}`}).join("");
 document.getElementById("toc").innerHTML=GROUPS.map(([g,t])=>{const n=BOOKS.filter(b=>b.group===g).length;return n?`<a href="#g-${g}">${esc(t)} ${n}권</a>`:""}).filter(Boolean).join(" · ");
 document.querySelectorAll(".card details").forEach(d=>{if(open.includes(d.closest(".card").id+"|"+d.className))d.open=true});
 document.getElementById("prog").textContent=`확인 ${BOOKS.filter(b=>cur(b).ok).length}/${BOOKS.length}`}
const bookOf=e=>{const el=e.target.closest(".card");return el&&BOOKS.find(x=>"b"+x.isbn===el.id)};
document.addEventListener("click",e=>{const b=bookOf(e);if(!b)return;const c=cur(b), k=e.target.dataset.kw, act=e.target.dataset.act;
 if(k!==undefined){put(b,{keywords:c.keywords.includes(k)?c.keywords.filter(x=>x!==k):[...c.keywords,k].slice(0,5)},"keywords");return}
 if(act==="kwnone"){put(b,{keywords:[]},"keywords");return}
 if(act==="v3line"){put(b,{one_liner:b.a.one_liner},"line");return}
 if(act==="ok"){if(left(b,c).length)return;st[b.isbn]={...c,ok:true};save();render()}});
document.addEventListener("change",e=>{const b=bookOf(e);if(!b)return;const act=e.target.dataset.act, axis=e.target.dataset.axis, v=e.target.value, c=cur(b);
 if(axis){put(b,{axes:{...c.axes,[axis]:Number(v)}},axis);return}
 if(act==="slot"){if(v==="move"){st[b.isbn]={...c,moveOpen:true,ok:false,answered:(c.answered||[]).filter(x=>x!=="slot")};save();render();return}
  put(b,{status:v,moveOpen:false,...(leafOf(b)?{genre:b.slot}:{topic:b.slot,keywords:[...b.current.keywords]})},"slot");return}
 if(act==="slotto"){if(!v)return;const s=srcs(b).find(([,o])=>!o.fits&&o.suggest===v);
  put(b,{status:"picked",moveOpen:false,...(leafOf(b)?{genre:v}:{topic:v,keywords:s&&s[1].suggest_keywords?s[1].suggest_keywords.filter(x=>(KW[v]||[]).includes(x)):[]})},"slot");return}
 if(act==="genre")put(b,{genre:v},b.asks.includes("slot")?"slot":null);
 if(act==="topic")put(b,{topic:v,keywords:[]},b.asks.includes("slot")?"slot":null);
 if(act==="way")put(b,{way:v},"way");
 if(act==="status")put(b,{status:v},b.asks.includes("slot")?"slot":null)});
document.addEventListener("input",e=>{if(e.target.dataset.act!=="line")return;const b=bookOf(e), el=e.target.closest(".card");
 st[b.isbn]={...cur(b),one_liner:e.target.value,ok:false};save();const li=issues(e.target.value,b), nx=e.target.parentElement.nextElementSibling, cnt=nx&&nx.querySelector(".cnt");
 if(cnt){cnt.textContent=`${len(e.target.value)}자 ${li.join(" · ")}`;cnt.className="cnt"+(li.length?" bad":"")}
 el.classList.remove("done");const ok=el.querySelector(".ok"), rest=left(b,cur(b));if(ok){ok.disabled=rest.length>0;ok.textContent=rest.length?`남은 것 ${rest.length}개`:"확인"}});
document.getElementById("dl").onclick=()=>{const answers={};
 for(const b of BOOKS){const c=st[b.isbn];if(c&&c.ok){const a=leafOf(b)?{genre:c.genre,axes:c.axes}:{topic:c.topic,keywords:c.keywords,way:c.way};
  answers[b.isbn]={entry:b.entry,...a,one_liner:c.one_liner.trim(),status:c.status,ok:true}}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),file:NAME,answers},null,1)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${NAME}-review.json`;a.click()};
head();render();
</script></body></html>
""".replace("__STYLE__", STYLE + EXTRA_STYLE + PAGE_STYLE).replace("__COMMON__", COMMON)
