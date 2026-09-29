"""D2b: short blind re-check of the 🎯 level tag with the new two-level rule (입문 / 기초 이상).

Same 10 🎯 books as D2. The only question per book: "이 책을 읽으려면 미리 알아야 하는 게 있나?"
Local use only (contains YES24 text).

Usage:  python src/build_level_check.py
Output: data/processed/check/d2b_level_check.html  (downloads d2b_human_levels.json)
"""
import json
import re

from build_check_page import OUT_DIR, clean, detail, js_json, short_intro, toc_lines

SAMPLE = OUT_DIR / "d2_sample.json"


def main() -> None:
    books = []
    for b in json.loads(SAMPLE.read_text(encoding="utf-8")):
        if b["entry"] != "target":
            continue
        d = detail(b["isbn"])
        cd = d.get("contentDetail") or {}
        books.append({"isbn": b["isbn"], "title": b["title"], "slot": b["slot"], "pages": d.get("pages"),
                      "intro": short_intro(cd.get("bookIntroduction") or ""),
                      "intro_full": re.sub(r"[ \t]+", " ", clean(cd.get("bookIntroduction") or "")).strip(),
                      "toc": toc_lines(cd.get("tableOfContents") or "", n=400)})
    page = TEMPLATE.replace("__BOOKS__", js_json(books))
    (OUT_DIR / "d2b_level_check.html").write_text(page, encoding="utf-8")
    print(f"saved: data/processed/check/d2b_level_check.html · {len(books)} books")


TEMPLATE = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>갈피 수준 다시 체크 (D2b)</title>
<link href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Gowun+Dodum&display=swap" rel="stylesheet">
<style>
:root{--paper:#FAF5EA;--deep:#F0E6D0;--line:#DDD0B4;--ink:#2B2724;--soft:#4A433D;--muted:#7A6048}
*{box-sizing:border-box}body{margin:0;background:var(--deep);color:var(--ink);font-family:'Gowun Dodum',sans-serif}
main{max-width:560px;margin:0 auto;background:var(--paper);min-height:100vh;padding:20px 18px 40px}
h1{font-family:'Gowun Batang',serif;font-size:20px;margin:0 0 4px}.sub{color:var(--muted);font-size:13px;margin:0 0 14px}
.rule{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.7;margin-bottom:14px}
.bar{height:6px;background:var(--line);border-radius:3px;margin-bottom:18px}.bar i{display:block;height:100%;background:var(--ink);border-radius:3px}
.title{font-family:'Gowun Batang',serif;font-size:21px;margin:0 0 4px}.meta{font-size:13px;color:var(--muted);margin:0 0 12px}
.box{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;line-height:1.7;color:var(--soft)}
.box b{display:block;color:var(--ink);font-size:13px;margin-bottom:4px}.toc{font-size:13px;white-space:pre-line}
.more{margin-top:8px;border:none;background:none;color:var(--muted);font:inherit;font-size:13px;cursor:pointer;padding:6px 0;text-decoration:underline}
.q{margin:16px 0 8px;font-weight:700}
.opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.opts label{position:relative;border:1px solid var(--ink);border-radius:12px;padding:12px;cursor:pointer;font-size:14px;line-height:1.5}
.opts input{position:absolute;opacity:0}.opts label:has(input:checked){background:var(--ink);color:var(--paper)}
.opts label:has(input:focus-visible){outline:3px solid #3A6684;outline-offset:2px}
.opts small{display:block;font-size:12px;opacity:.8}
nav{display:flex;gap:10px;margin-top:20px}nav button{flex:1;height:46px;border-radius:999px;border:1px solid var(--ink);background:var(--paper);font:inherit;font-size:15px;cursor:pointer}
nav button.main{background:var(--ink);color:var(--paper)}.warn{color:#A94C60;font-size:13px;min-height:18px;margin-top:8px}.done{text-align:center;padding-top:40px}
</style></head><body><main id="app"></main>
<script>
const BOOKS=__BOOKS__, KEY="galpi-d2b-levels";
let ans={}; try{ans=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){} if(!ans||typeof ans!=="object")ans={};
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(ans))}catch(e){}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const app=document.getElementById("app"); let i=BOOKS.findIndex(b=>!ans[b.isbn]); if(i<0)i=BOOKS.length;
function render(){
 if(i>=BOOKS.length)return finish();
 const b=BOOKS[i];
 app.innerHTML=`<h1>수준 다시 체크</h1><p class="sub">새 기준으로 10권만 다시 골라 주세요 (2분)</p>
 <div class="rule">판단 질문은 하나예요 — <b>이 책을 읽으려면 이 주제에 대해 미리 알아야 하는 게 있나?</b><br>독자가 직장인인지는 상관없어요.</div>
 <div class="bar"><i style="width:${Math.round(100*i/BOOKS.length)}%"></i></div>
 <p class="title">${esc(b.title)}</p><p class="meta">🎯 ${esc(b.slot)} · ${b.pages?esc(b.pages)+"쪽":"쪽수 정보 없음"} · ${i+1} / ${BOOKS.length}</p>
 <div class="box"><b>소개</b><div id="intro" class="toc">${esc(b.intro)}</div><button class="more" data-t="intro">소개 전체 보기 ⌄</button></div>
 <div class="box"><b>목차 (${b.toc.length}줄)</b><div id="toc" class="toc">${esc(b.toc.slice(0,12).join("\\n"))}</div>${b.toc.length>12?'<button class="more" data-t="toc">목차 전체 보기 ⌄</button>':''}</div>
 <p class="q">이 책의 수준</p><div class="opts">
 <label><input type="radio" name="lv" value="입문" ${ans[b.isbn]==="입문"?"checked":""}><span>입문<small>미리 몰라도 시작할 수 있어요</small></span></label>
 <label><input type="radio" name="lv" value="기초 이상" ${ans[b.isbn]==="기초 이상"?"checked":""}><span>기초 이상<small>기본 개념을 안다고 가정해요</small></span></label></div>
 <p class="warn" id="warn"></p><nav><button id="prev">이전</button><button class="main" id="next">${i===BOOKS.length-1?"끝내기":"다음"}</button></nav>`;
 app.querySelectorAll("button.more").forEach(btn=>btn.onclick=()=>{const t=btn.dataset.t,box=document.getElementById(t),open=btn.dataset.open==="1";
  box.textContent=t==="intro"?(open?b.intro:b.intro_full):(open?b.toc.slice(0,12):b.toc).join("\\n");btn.dataset.open=open?"0":"1";
  btn.textContent=(t==="intro"?"소개":"목차")+(open?" 전체 보기 ⌄":" 접기 ⌃")});
 app.querySelectorAll('input[name="lv"]').forEach(el=>el.addEventListener("change",()=>{ans[b.isbn]=el.value;save();document.getElementById("warn").textContent=""}));
 document.getElementById("prev").onclick=()=>{if(i>0){i--;render();scrollTo(0,0)}};
 document.getElementById("next").onclick=()=>{if(!ans[b.isbn]){document.getElementById("warn").textContent="수준을 골라 주세요";return}i++;render();scrollTo(0,0)};
}
function finish(){
 app.innerHTML=`<div class="done"><h1>다 끝났어요</h1><p class="sub">10권 체크 완료</p><nav><button class="main" id="dl">결과 파일 저장하기</button></nav>
 <p class="sub" style="margin-top:14px">저장된 <b>d2b_human_levels.json</b>을 <b>Galpi/data/processed/</b> 폴더에 넣고 채팅에 "넣었어"라고 알려주세요.</p><nav><button id="back">마지막 책으로</button></nav></div>`;
 document.getElementById("dl").onclick=()=>{const blob=new Blob([JSON.stringify({saved_at:new Date().toISOString(),answers:ans},null,1)],{type:"application/json"});
  const u=URL.createObjectURL(blob);const x=document.createElement("a");x.href=u;x.download="d2b_human_levels.json";document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
 document.getElementById("back").onclick=()=>{i=BOOKS.length-1;render()};
}
render();
</script></body></html>
"""

if __name__ == "__main__":
    main()
