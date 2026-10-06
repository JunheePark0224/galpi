"""HTML of the gold labelling page and the calibration page (gold.py writes both under data/processed/check/pipeline/).

Built on the review pages' look and helpers (build_pilot_review.STYLE / COMMON, build_d4_review.AXIS_LABELS — no second copy).
Labelling page (plan 3): AI answers hidden — per book the YES24 intro and TOC, then 🍃 genre + four axes (three-way choice,
"정보 없음" toggle, optional one-line reason) or 🎯 topic + keywords (closed list with definitions) + way. A side panel shows
the part of docs/label-dictionary.md for the field in focus (read when the page is built; without the dictionary, the
older rule sections: balance-game.md 2절, book-pool.md 1-3, target-chips.md 2절). Progress stays in this browser.
Calibration page (plan 4): agreement of AI-1 / AI-2 with the person per field and per slot against the 90% line, then every
mismatch with both AIs' values and reasons and three decisions + a note, downloaded as calibration-decisions.json.
"""
import html
import re
from pathlib import Path

from build_check_page import js_json
from build_d4_review import AXIS_LABELS, WAY_LABELS
from build_pilot_review import COMMON, STYLE

from .gaps import GENRES
from .prompt import AXES

FIELD_NAMES = {"temp": ("온도",), "pull": ("끌림",), "gain": ("얻는 것",), "world": ("세계",), "genre": ("장르",),
               "topic": ("주제",), "keywords": ("키워드",), "way": ("방식", "읽는 방식")}
FIELD_LABEL = {"genre": "장르", "temp": "온도", "pull": "끌림", "gain": "얻는 것", "world": "세계", "topic": "주제",
               "keywords": "키워드", "way": "방식"}
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


def md_html(text: str) -> str:
    """A small markdown → HTML for the rule panel: headings, tables, bullets, **bold**, `code`, paragraphs. Escaped first."""
    out, table = [], []

    def inline(s: str) -> str:
        s = html.escape(s)
        s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
        return re.sub(r"`(.+?)`", r"<code>\1</code>", s)

    def flush() -> None:
        if table:
            rows = [[inline(c.strip()) for c in r.strip().strip("|").split("|")] for r in table
                    if not re.match(r"^\|[\s:|-]+\|?$", r.strip())]
            head, *body = rows or [[]]
            out.append("<table><tr>" + "".join(f"<th>{c}</th>" for c in head) + "</tr>"
                       + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in body) + "</table>")
            table.clear()

    for line in text.splitlines():
        if line.startswith("|"):
            table.append(line)
            continue
        flush()
        if m := HEADING.match(line):
            out.append(f"<p class='gh'>{inline(m.group(2))}</p>")
        elif re.match(r"^\s*[-*]\s+", line):
            out.append(f"<p class='gl'>· {inline(re.sub(r'^\s*[-*]\s+', '', line))}</p>")
        elif line.strip():
            out.append(f"<p>{inline(line)}</p>")
    flush()
    return "".join(out)


def sections(text: str) -> list[tuple[int, str, str]]:
    """(level, title, the section's text with its sub-sections) for every heading."""
    lines = text.splitlines()
    heads = [(i, len(m.group(1)), m.group(2)) for i, line in enumerate(lines) if (m := HEADING.match(line))]
    out = []
    for n, (i, level, title) in enumerate(heads):
        end = next((j for j, lv, _ in heads[n + 1:] if lv <= level), len(lines))
        out.append((level, title, "\n".join(lines[i:end])))
    return out


def _for_field(secs: list[tuple[int, str, str]], field: str) -> str:
    names = FIELD_NAMES[field]
    others = [n for f, ns in FIELD_NAMES.items() if f != field for n in ns if not any(n in m or m in n for m in names)]
    hits = [s for s in secs if any(n in s[1] for n in names)]
    specific = [s for s in hits if not any(o in s[1] for o in others)]
    return "\n\n".join(s[2] for s in (specific or hits))


def _between(text: str, start: str, stop: str) -> str:
    lines = text.splitlines()
    i = next((n for n, line in enumerate(lines) if line.startswith(start)), None)
    if i is None:
        return ""
    j = next((n for n in range(i + 1, len(lines)) if lines[n].startswith(stop)), len(lines))
    return "\n".join(lines[i:j])


def guide(dictionary: Path, docs: Path, version: str) -> dict:
    """{source, fields: {field: html}} — the dictionary's section for each field (the whole dictionary when no heading names
    the field); without the dictionary, the rule sections it replaces."""
    if dictionary.exists():
        text = dictionary.read_text(encoding="utf-8")
        secs = sections(text)
        return {"source": f"docs/label-dictionary.md ({version})",
                "fields": {f: md_html(_for_field(secs, f) or text) for f in FIELD_NAMES}}
    read = lambda name: (docs / name).read_text(encoding="utf-8") if (docs / name).exists() else ""  # noqa: E731
    axes = _between(read("balance-game.md"), "## 2.", "## 3.")
    genre = _between(read("book-pool.md"), "### 1-3.", "## ")
    chips = _between(read("target-chips.md"), "## 2.", "## 3.")
    return {"source": "정의서(docs/label-dictionary.md)가 아직 없어요 — balance-game.md 2절 · book-pool.md 1-3 · target-chips.md 2절",
            "fields": {f: md_html(axes if f in AXES else genre if f == "genre" else chips) for f in FIELD_NAMES}}

PANEL_STYLE = """
#guide{position:fixed;top:0;right:0;width:min(420px,34vw);height:100vh;overflow:auto;background:#fff;border-left:1px solid var(--line);padding:16px 16px 90px;font-size:13px;line-height:1.65;color:var(--soft)}
#guide h3{font-family:'Gowun Batang',serif;font-size:16px;margin:0 0 4px;color:var(--ink)}#guide .src{font-size:11px;color:var(--muted);margin:0 0 10px}
#guide table{border-collapse:collapse;margin:6px 0;font-size:12px}#guide td,#guide th{border:1px solid var(--line);padding:3px 5px;vertical-align:top;text-align:left}
#guide .gh{font-weight:700;color:var(--ink);margin:10px 0 2px}#guide p{margin:3px 0}#guide code{font-size:12px}
#guide .tabs{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 8px}#guide .tabs button{font:inherit;font-size:12px;border:1px solid var(--line);border-radius:999px;background:var(--paper);padding:4px 9px;cursor:pointer;min-height:30px}
#guide .tabs button.on{background:var(--ink);color:var(--paper)}
@media(min-width:1180px){main{margin-left:max(16px,calc((100vw - min(420px,34vw) - 760px)/2))}}
@media(max-width:1179px){#guide{top:auto;bottom:52px;left:0;width:auto;height:38vh;border-left:none;border-top:2px solid var(--ink)}main{padding-bottom:46vh}#guide.closed{height:auto}#guide.closed .body{display:none}}
"""

LABEL_STYLE = """
.q{margin:12px 0 6px;font-weight:700;font-size:14px}.q .hint{font-size:12px;color:var(--muted);font-weight:400}
.opts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.opts label{position:relative;border:1px solid var(--ink);border-radius:10px;padding:9px 4px;font-size:14px;cursor:pointer;background:var(--paper);min-height:44px;display:flex;align-items:center;justify-content:center;text-align:center}
.opts input{position:absolute;opacity:0;width:1px;height:1px}.opts label:has(input:checked){background:var(--ink);color:var(--paper)}
.opts label:has(input:focus-visible){outline:3px solid #3A6684;outline-offset:2px}
.blk{border-radius:10px;padding:2px 8px 6px;margin:0 -8px}.blk.focus{background:#FBF3E2}
.none{border:1px dashed var(--muted);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;background:var(--paper);cursor:pointer;min-height:44px}
.none.on{background:#9A3B4E;border-color:#9A3B4E;color:#fff}.kwdef{font-size:12px;color:var(--muted);margin:2px 0 0;line-height:1.6}
.card details pre{max-height:42vh;overflow:auto}
.left{font-size:12px;color:var(--warn)}h2{font-family:'Gowun Batang',serif;font-size:17px;margin:22px 0 2px}
"""

LABEL_TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 정답 라벨</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
__STYLE__
</style></head><body><main>
<h1>갈피 정답 라벨 — 정답 세트 40권</h1>
<p class="sub">AI 답은 <b>숨겼어요</b>. 책소개·목차만 보고, 옆의 정의서대로 골라 주세요. 축마다 값 하나 — 책소개·목차에 판단할 정보가
아예 없으면 <b>정보 없음</b>을 켜요(값은 골라도 되고 비워도 돼요). 근거 한 줄은 선택이에요. 진행은 이 브라우저에 저장돼요.
다 하면 아래 <b>정답 내려받기</b> → <code>gold-v3.json</code> → <code>python -m src.pipeline.gold calibrate --labels &lt;파일&gt;</code>.</p>
<div id="app"></div></main>
<aside id="guide"><div class="tabs" id="tabs"></div><div class="body"><h3 id="gt"></h3><p class="src" id="gs"></p><div id="gb"></div></div></aside>
<div class="bar"><span id="prog"></span><button id="dl">정답 내려받기</button></div>
<script>
const BOOKS=__BOOKS__, KW=__KW__, DEFS=__DEFS__, GENRES=__GENRES__, AXES=__AXES__, WAYS=__WAYS__, GUIDE=__GUIDE__, KEY=__KEY__, RULES=__RULES__;
__COMMON__
const TOPICS=Object.keys(KW), LABEL=__LABEL__, NONE="-", DROP="서재에 넣지 않음";  // DROP: the book does not belong in Galpi at all (교재·수험서 …, 10-06)
const other=v=>v===""||v===DROP;
const cur=b=>st[b.isbn]||(b.entry==="leaf"?{axes:{},missing:[],reasons:{}}:{keywords:[],kwDone:false});
const put=(b,patch)=>{st[b.isbn]={...cur(b),...patch};save();render()};
function left(b){const c=cur(b), out=[];
 // "어느 장르/주제도 아님" (the other branch): nothing else to answer for this book (10-06)
 if(b.entry==="leaf"){if(c.genre===undefined)out.push("장르");else if(!other(c.genre))for(const [k] of AXES)if(![1,0,-1].includes(c.axes[k])&&!c.missing.includes(k))out.push(LABEL[k])}
 else{if(c.topic===undefined)out.push("주제");else if(!other(c.topic)){if(!c.kwDone)out.push("키워드");if(!c.way)out.push("방식")}}
 return out}
const blk=(f,inner)=>`<div class="blk" data-field="${f}">${inner}</div>`;
function leafQs(b,c){
 const g=blk("genre",`<p class="q">장르</p><div class="row"><select data-act="genre"><option value="" ${c.genre===undefined?"selected":""}>장르를 골라 주세요</option>
  ${GENRES.map(x=>`<option ${c.genre===x?"selected":""}>${esc(x)}</option>`).join("")}<option value="${NONE}" ${c.genre===""?"selected":""}>어느 🍃 장르도 아님 (🎯 배우기 책)</option><option value="${DROP}" ${c.genre===DROP?"selected":""}>서재에 넣지 않음 (빼기)</option></select></div>`);
 if(other(c.genre))return g+`<p class="hint">${c.genre===DROP?"빼는 책이라":"🎯 배우기 책이라"} 축은 고르지 않아요.</p>`;
 return g+AXES.map(([k,q,p,z,m,hint])=>blk(k,`<p class="q">${esc(LABEL[k])} — ${esc(q)} <span class="hint">${esc(hint)}</span></p>
  <div class="opts">${[[p,1],[z,0],[m,-1]].map(([t,v])=>`<label><input type="radio" name="ax-${b.isbn}-${k}" data-axis="${k}" value="${v}" ${c.axes[k]===v?"checked":""}><span>${esc(t)}</span></label>`).join("")}</div>
  <div class="row"><button class="none ${c.missing.includes(k)?"on":""}" data-none="${k}">정보 없음</button>
  <input type="text" data-reason="${k}" maxlength="60" value="${esc(c.reasons[k]||"")}" placeholder="근거 한 줄 (선택) — 예: 끝맺음 −, 마지막 장이 이별"></div>`)).join("")}
function targetQs(b,c){const kept=c.topic?KW[c.topic]||[]:[], defs=DEFS[c.topic]||{};
 const tb=blk("topic",`<p class="q">주제</p><div class="row"><select data-act="topic"><option value="" ${c.topic===undefined?"selected":""}>주제를 골라 주세요</option>
   ${TOPICS.map(t=>`<option ${c.topic===t?"selected":""}>${esc(t)}</option>`).join("")}<option value="${NONE}" ${c.topic===""?"selected":""}>어느 🎯 주제도 아님 (🍃 이야기 책)</option><option value="${DROP}" ${c.topic===DROP?"selected":""}>서재에 넣지 않음 (빼기)</option></select></div>`);
 if(other(c.topic))return tb+`<p class="hint">${c.topic===DROP?"빼는 책이라":"🍃 이야기 책이라"} 키워드·방식은 고르지 않아요.</p>`;
 return tb+blk("keywords",`<p class="q">키워드 <span class="hint">— 책의 중심일 때만, 0~3개 · 눌러서 켜고 끄기</span></p>
   <div class="row">${kept.map(k=>`<button class="chip ${c.keywords.includes(k)?"on":""}" data-kw="${esc(k)}" title="${esc(defs[k]||"")}">${esc(k)}</button>`).join("")||'<span class="cnt">주제를 먼저 골라 주세요 (목록이 없는 주제도 있어요)</span>'}
   <button class="none ${c.kwDone&&!c.keywords.length?"on":""}" data-act="kwnone">키워드 없음</button></div>
   ${kept.length?`<p class="kwdef">${kept.map(k=>`<b>${esc(k)}</b> — ${esc(defs[k]||"(정의 없음)")}`).join("<br>")}</p>`:""}`)
 +blk("way",`<p class="q">읽는 방식</p><div class="opts">${WAYS.map(([w,l])=>`<label><input type="radio" name="way-${b.isbn}" data-act="way" value="${w}" ${c.way===w?"checked":""}><span>${w} — ${esc(l)}</span></label>`).join("")}</div>
   <div class="row"><input type="text" data-reason="way" maxlength="60" value="${esc(c.reason||"")}" placeholder="근거 한 줄 (선택)"></div>`)}
function card(b){const c=cur(b), rest=left(b);
 return `<div class="card ${rest.length?"":"done"}" id="b${b.isbn}"><p class="t">${b.entry==="target"?"🎯":"🍃"} ${esc(b.title)}</p>
  <p class="meta">${esc(b.author)} · ${b.pages}쪽${b.link?` · <a href="${esc(b.link)}" target="_blank" rel="noopener">예스24</a>`:""} · 정보 제공: 예스24</p>
  ${b.intro?`<details open><summary>책소개</summary><pre>${esc(b.intro)}</pre></details>`:'<p class="left">캐시에 책소개가 없어요 (예스24 링크로 확인)</p>'}
  ${b.toc?`<details><summary>목차</summary><pre>${esc(b.toc)}</pre></details>`:""}
  ${b.entry==="leaf"?leafQs(b,c):targetQs(b,c)}
  <p class="${rest.length?"left":"cnt"}">${rest.length?`남은 것: ${rest.join(" · ")}`:"다 골랐어요 ✓"}</p></div>`}
function render(){const leaf=BOOKS.filter(b=>b.entry==="leaf"), tgt=BOOKS.filter(b=>b.entry!=="leaf");
 document.getElementById("app").innerHTML=`<h2>🍃 이야기 책 ${leaf.length}권</h2>${leaf.map(card).join("")}<h2>🎯 배우기 책 ${tgt.length}권</h2>${tgt.map(card).join("")}`;
 document.getElementById("prog").textContent=`다 고른 책 ${BOOKS.filter(b=>!left(b).length).length}/${BOOKS.length}`;focusField(FOCUS,false)}
let FOCUS="temp";
function focusField(f,scroll=true){if(!GUIDE.fields[f])return; FOCUS=f;
 document.getElementById("tabs").innerHTML=Object.keys(GUIDE.fields).map(k=>`<button data-tab="${k}" class="${k===f?"on":""}">${esc(LABEL[k])}</button>`).join("")+'<button data-tab="close">접기/펴기</button>';
 document.getElementById("gt").textContent=`정의서 — ${LABEL[f]}`;document.getElementById("gs").textContent=GUIDE.source;
 document.getElementById("gb").innerHTML=GUIDE.fields[f]; if(scroll)document.getElementById("guide").scrollTop=0}
const bookOf=e=>{const el=e.target.closest(".card");return el&&BOOKS.find(x=>"b"+x.isbn===el.id)};
document.addEventListener("focusin",e=>{const bl=e.target.closest(".blk");if(bl){document.querySelectorAll(".blk.focus").forEach(x=>x.classList.remove("focus"));bl.classList.add("focus");focusField(bl.dataset.field)}});
document.addEventListener("click",e=>{const tab=e.target.dataset.tab;
 if(tab){if(tab==="close")document.getElementById("guide").classList.toggle("closed");else focusField(tab);return}
 const bl=e.target.closest(".blk"); if(bl)focusField(bl.dataset.field);
 const b=bookOf(e); if(!b)return; const c=cur(b), k=e.target.dataset.kw, n=e.target.dataset.none;
 if(k!==undefined){const on=c.keywords.includes(k);put(b,{keywords:on?c.keywords.filter(x=>x!==k):[...c.keywords,k].slice(0,3),kwDone:true});return}
 if(e.target.dataset.act==="kwnone"){put(b,{keywords:[],kwDone:true});return}
 if(n){put(b,{missing:c.missing.includes(n)?c.missing.filter(x=>x!==n):[...c.missing,n]})}});
document.addEventListener("change",e=>{const b=bookOf(e); if(!b)return; const c=cur(b), act=e.target.dataset.act, v=e.target.value, ax=e.target.dataset.axis;
 if(ax){put(b,{axes:{...c.axes,[ax]:Number(v)}});return}
 if(act==="genre")put(b,v?{genre:v===NONE?"":v}:{genre:undefined});
 if(act==="topic")put(b,v?{topic:v===NONE?"":v,keywords:[],kwDone:false}:{topic:undefined,keywords:[],kwDone:false});
 if(act==="way")put(b,{way:v})});
document.addEventListener("input",e=>{const r=e.target.dataset.reason; if(!r)return; const b=bookOf(e), c=cur(b);
 st[b.isbn]=r==="way"?{...c,reason:e.target.value}:{...c,reasons:{...c.reasons,[r]:e.target.value}};save()});
document.getElementById("dl").onclick=()=>{const labels={};
 for(const b of BOOKS){const c=st[b.isbn]; if(!c)continue; const done=!left(b).length;
  labels[b.isbn]=b.entry==="leaf"?{entry:"leaf",genre:c.genre,axes:Object.fromEntries(AXES.map(([k])=>[k,[1,0,-1].includes(c.axes[k])?c.axes[k]:null])),
   missing:c.missing,reasons:Object.fromEntries(Object.entries(c.reasons).map(([k,v])=>[k,v.trim()]).filter(([,v])=>v)),done}
  :{entry:"target",topic:c.topic,keywords:c.keywords,way:c.way||null,reason:(c.reason||"").trim(),done}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),set:"gold-v3",rules_version:RULES,labels},null,1)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gold-v3.json";a.click()};
render();
</script></body></html>
""".replace("__STYLE__", STYLE + LABEL_STYLE + PANEL_STYLE).replace("__COMMON__", COMMON)


def _fill(template: str, slots: dict) -> str:
    return re.sub("|".join(map(re.escape, slots)), lambda m: slots[m.group(0)], template)


def label_page(entries: list[dict], vocab: dict, defs: dict, guide_: dict, rules: str) -> str:
    return _fill(LABEL_TEMPLATE, {
        "__BOOKS__": js_json(entries), "__KW__": js_json({t: list(v.get("kept", {})) for t, v in vocab.items()}),
        "__DEFS__": js_json(defs), "__GENRES__": js_json(list(GENRES)), "__AXES__": js_json(AXIS_LABELS),
        "__WAYS__": js_json(WAY_LABELS), "__GUIDE__": js_json(guide_), "__KEY__": js_json("galpi-gold-v3"),
        "__RULES__": js_json(rules), "__LABEL__": js_json(FIELD_LABEL)})


CAL_STYLE = """
table.agr{border-collapse:collapse;width:100%;font-size:13px;margin:6px 0}table.agr td:first-child{white-space:nowrap}table.agr th,table.agr td{border-bottom:1px solid var(--line);padding:6px 4px;text-align:left;vertical-align:middle}
.meter{position:relative;height:10px;background:var(--deep);border-radius:999px;min-width:80px}.meter i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:var(--warn)}
.meter i.pass{background:var(--ok)}.meter b{position:absolute;left:90%;top:-3px;bottom:-3px;width:2px;background:var(--ink)}
.pass-t{color:var(--ok);font-weight:700}.fail-t{color:var(--warn);font-weight:700}
.mm{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:8px 0}.mm>div{border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.6;background:var(--paper)}
.mm b{display:block}.mm .bad{color:var(--warn)}.nomark{color:#9A3B4E;font-weight:700;font-size:12px}
textarea{width:100%;font:inherit;font-size:14px;border:1px solid var(--ink);border-radius:8px;padding:6px 8px;min-height:44px}
@media(max-width:620px){.mm{grid-template-columns:1fr}}
"""

CAL_TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 맞춰 보기</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
__STYLE__
</style></head><body><main>
<h1>갈피 맞춰 보기 — 정답과 AI</h1>
<p class="sub" id="head"></p>
<h2>칸마다 정답과 같은 비율 <small>목표선 90% (막대의 세로줄)</small></h2><div id="fields"></div>
<h2>장르·주제마다 <small>그 칸 책들의 모든 칸을 합쳐서</small></h2><div id="slots"></div>
<h2>'정보 없음'</h2><p class="sub" id="miss"></p>
<h2>틀린 칸 <small id="mmn"></small></h2>
<p class="sub">칸마다 하나 골라 주세요: <b>AI가 틀림</b> → 정의 문구를 고쳐요 · <b>내 답이 틀림</b> → 정답을 고쳐요 · <b>기준에 빈칸</b> → 규칙을 더해요. 메모는 선택.</p>
<div id="app"></div></main>
<div class="bar"><span id="prog"></span><button id="dl">결정 내려받기</button></div>
<script>
const S=__SCORE__, AXES=__AXES__, LABEL=__LABEL__, RUN=__RUN__, RULES=__RULES__, KEY=__KEY__;
__COMMON__
const CHOICES=[["ai_wrong","AI가 틀림"],["mine_wrong","내 답이 틀림"],["rule_gap","기준에 빈칸"]];
const pct=([k,n])=>n?Math.round(k/n*100):0;
const cell=p=>{const v=pct(p);return `<td>${p[0]}/${p[1]}</td><td style="width:34%"><div class="meter"><i class="${v>=90?"pass":""}" style="width:${v}%"></i><b></b></div></td><td class="${v>=90?"pass-t":"fail-t"}">${v}%</td>`};
const table=(rows,name)=>`<table class="agr"><tr><th>${name}</th><th colspan="3">AI-1</th><th colspan="3">AI-2</th></tr>${rows.map(([n,p])=>`<tr><td>${esc(n)}</td>${cell(p.ai1)}${cell(p.ai2)}</tr>`).join("")}</table>`;
function show(field,v){if(v===null||v===undefined)return "(비움)";
 const a=AXES.find(x=>x[0]===field); if(a)return v===1?a[2]:v===-1?a[4]:a[3];
 if(field==="keywords")return v.length?v.join(", "):"(없음)";
 if(field==="genre"&&v==="")return "🍃 장르 아님"; if(field==="topic"&&v==="")return "🎯 주제 아님"; return String(v)}
const aiShow=(m,v)=>(m.field==="genre"||m.field==="topic")&&v===m.slot?`${v}에 맞음`:show(m.field,v);
const none=on=>on?' <span class="nomark">정보 없음</span>':"";
function card(m){const d=st[m.key]||{};
 const runs=m.runs.map(r=>`<div><b>AI-1${S.runs>1?` · ${r.run}번째`:""}</b><span>${esc(aiShow(m,r.ai1))}${none(r.miss1)}</span><br><span class="cnt">${esc(r.why1||"(근거 없음)")}</span></div>
  <div><b>AI-2${S.runs>1?` · ${r.run}번째`:""}</b><span>${esc(aiShow(m,r.ai2))}${none(r.miss2)}</span><br><span class="cnt">${esc(r.why2||"(근거 없음)")}</span></div>`);
 return `<div class="card ${d.choice?"done":""}" id="m${esc(m.key)}"><p class="t">${m.entry==="target"?"🎯":"🍃"} ${esc(m.title)} <small class="cnt">· ${esc(m.slot)} · ${esc(LABEL[m.field])}</small></p>
  ${runs.map((x,i)=>`<div class="mm"><div><b>사람</b>${esc(show(m.field,m.person))}${none(m.person_missing)}<br><span class="cnt">${esc(m.person_reason||"")}</span></div>${x}</div>`).join("")}
  <div class="picks">${CHOICES.map(([v,l])=>`<button data-key="${esc(m.key)}" data-choice="${v}" class="${d.choice===v?"chosen":""}">${l}</button>`).join("")}</div>
  <textarea data-note="${esc(m.key)}" placeholder="메모 (선택) — 어떤 문구·규칙을 고칠지">${esc(d.note||"")}</textarea></div>`}
function render(){
 document.getElementById("head").innerHTML=`정의서 <b>${esc(RULES)}</b> · ${esc(RUN)} · 정답 ${S.labelled}권${S.unlabelled.length?` (라벨 없는 책 ${S.unlabelled.length}권은 빼고)`:""} · ${S.runs}번 태그`;
 document.getElementById("fields").innerHTML=table(Object.entries(S.fields).map(([f,p])=>[LABEL[f],p]),"칸");
 document.getElementById("slots").innerHTML=table(Object.entries(S.slots),"장르·주제");
 const ms=S.missing; document.getElementById("miss").textContent=`사람이 '정보 없음'으로 둔 축 ${ms.person}개 — AI-1도 ${ms.ai1_too}, AI-2도 ${ms.ai2_too} · 사람은 정보가 있다고 봤는데 AI가 '정보 없음': AI-1 ${ms.ai1_only}, AI-2 ${ms.ai2_only}`;
 document.getElementById("mmn").textContent=`${S.mismatches.length}개`;
 document.getElementById("app").innerHTML=S.mismatches.map(card).join("")||'<p class="sub">틀린 칸이 없어요.</p>';
 document.getElementById("prog").textContent=`고른 것 ${S.mismatches.filter(m=>(st[m.key]||{}).choice).length}/${S.mismatches.length}`}
document.addEventListener("click",e=>{const k=e.target.dataset.key; if(!k)return; st[k]={...(st[k]||{}),choice:e.target.dataset.choice};save();render()});
document.addEventListener("input",e=>{const k=e.target.dataset.note; if(!k)return; st[k]={...(st[k]||{}),note:e.target.value};save()});
document.getElementById("dl").onclick=()=>{const decisions={};
 for(const m of S.mismatches){const d=st[m.key]; if(d&&(d.choice||(d.note||"").trim()))decisions[m.key]={isbn:m.isbn,field:m.field,choice:d.choice||null,note:(d.note||"").trim()}}
 const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),run:RUN,rules_version:RULES,decisions},null,1)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="calibration-decisions.json";a.click()};
render();
</script></body></html>
""".replace("__STYLE__", STYLE + CAL_STYLE).replace("__COMMON__", COMMON)


def calibration_page(scored: dict, run_name: str, rules: str) -> str:
    return _fill(CAL_TEMPLATE, {
        "__SCORE__": js_json(scored), "__AXES__": js_json(AXIS_LABELS), "__LABEL__": js_json(FIELD_LABEL),
        "__RUN__": js_json(run_name), "__RULES__": js_json(rules), "__KEY__": js_json(f"galpi-calibration-{run_name}")})
