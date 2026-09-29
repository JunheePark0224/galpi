"""D2: agreement between the user's blind tags and the AI's blind tags on the same 20 books.

Reports percent agreement and Cohen's kappa per tag type, plus every disagreement, so vague
tag definitions can be fixed (docs/target-chips.md 2절, docs/balance-game.md 태그 기준).
With 10 books per entry, kappa is unstable — read the disagreement list first.

Usage:  python src/compare_tags.py
Input:  data/processed/d2_human_tags.json, data/processed/d2_ai_tags.json,
        data/processed/keyword_tags_draft.json (rule-based keyword draft, for reference),
        data/processed/check/d2_sample.json, data/processed/keyword_vocab.json
Output: data/processed/d2_agreement.json + printed report
"""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
P = ROOT / "data" / "processed"
AXES = {"temp": ("따뜻함", "여운"), "pull": ("문장", "몰입"), "gain": ("알게 됨", "마음"), "world": ("현실", "딴 세상")}


def kappa(a: list, b: list) -> float | None:
    """Cohen's kappa for two raters over the same items (None when undefined)."""
    n = len(a)
    if n == 0:
        return None
    po = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum(ca[k] * cb[k] for k in set(ca) | set(cb)) / (n * n)
    return None if pe == 1 else round((po - pe) / (1 - pe), 2)


def agree(a: list, b: list) -> float:
    return round(100 * sum(x == y for x, y in zip(a, b)) / len(a), 1) if a else 0.0


def load(name: str) -> dict:
    return json.loads((P / name).read_text(encoding="utf-8"))


def main() -> None:
    human = load("d2_human_tags.json")["answers"]
    ai = load("d2_ai_tags.json")["answers"]
    ai_notes = load("d2_ai_tags.json").get("notes", {})
    rule = load("keyword_tags_draft.json")
    vocab = load("keyword_vocab.json")
    sample = load("check/d2_sample.json")
    target = [b for b in sample if b["entry"] == "target"]
    leaf = [b for b in sample if b["entry"] == "leaf"]
    report: dict = {"n_target": len(target), "n_leaf": len(leaf)}

    # 🎯 keywords: one yes/no decision per (book, keyword in its topic list)
    kw_h, kw_ai, kw_rule, kw_rows = [], [], [], []
    for b in target:
        for kw in vocab[b["slot"]]["kept"]:
            h = kw in human[b["isbn"]].get("keywords", [])
            a = kw in ai[b["isbn"]].get("keywords", [])
            r = kw in rule.get(b["isbn"], {}).get("keywords", [])
            kw_h.append(h), kw_ai.append(a), kw_rule.append(r)
            if h != a:
                kw_rows.append({"title": b["title"], "keyword": kw, "human": h, "ai": a, "rule": r})
    report["keywords"] = {"decisions": len(kw_h), "agree_ai": agree(kw_h, kw_ai), "kappa_ai": kappa(kw_h, kw_ai),
                          "agree_rule": agree(kw_h, kw_rule), "kappa_rule": kappa(kw_h, kw_rule),
                          "disagreements": kw_rows}

    for field in ("level", "way"):
        h = [human[b["isbn"]].get(field) for b in target]
        a = [ai[b["isbn"]].get(field) for b in target]
        report[field] = {"agree": agree(h, a), "kappa": kappa(h, a),
                         "human_counts": Counter(h), "ai_counts": Counter(a),
                         "disagreements": [{"title": b["title"], "human": x, "ai": y, "ai_note": ai_notes.get(b["isbn"])}
                                           for b, x, y in zip(target, h, a) if x != y]}

    axes = {}
    pooled_h, pooled_a = [], []
    for axis, (plus, minus) in AXES.items():
        h = [human[b["isbn"]].get(axis) for b in leaf]
        a = [ai[b["isbn"]].get(axis) for b in leaf]
        pooled_h += h
        pooled_a += a
        name = {1: plus, 0: "중간", -1: minus}
        axes[axis] = {"label": f"{plus}↔{minus}", "agree": agree(h, a), "kappa": kappa(h, a),
                      "opposite": sum(1 for x, y in zip(h, a) if x and y and x != y),
                      "disagreements": [{"title": b["title"], "human": name.get(x), "ai": name.get(y),
                                         "ai_note": ai_notes.get(b["isbn"])} for b, x, y in zip(leaf, h, a) if x != y]}
    report["axes"] = axes
    report["axes_pooled"] = {"agree": agree(pooled_h, pooled_a), "kappa": kappa(pooled_h, pooled_a)}

    (P / "d2_agreement.json").write_text(json.dumps(report, ensure_ascii=False, indent=1, default=dict), encoding="utf-8")

    k = report["keywords"]
    print(f"🎯 키워드  결정 {k['decisions']}개 · 사람↔AI 일치 {k['agree_ai']}% (κ={k['kappa_ai']}) · 사람↔규칙 {k['agree_rule']}% (κ={k['kappa_rule']})")
    for row in k["disagreements"]:
        print(f"    {row['title'][:22]:<22} {row['keyword']:<10} 사람 {'O' if row['human'] else '-'}  AI {'O' if row['ai'] else '-'}  규칙 {'O' if row['rule'] else '-'}")
    for field, label in (("level", "수준"), ("way", "읽는 방식")):
        r = report[field]
        print(f"🎯 {label}  일치 {r['agree']}% (κ={r['kappa']}) · 사람 {dict(r['human_counts'])} · AI {dict(r['ai_counts'])}")
        for d in r["disagreements"]:
            print(f"    {d['title'][:22]:<22} 사람 {d['human']} / AI {d['ai']}  ({d['ai_note'] or ''})")
    for axis, r in axes.items():
        print(f"🍃 {r['label']:<10} 일치 {r['agree']}% (κ={r['kappa']}) · 정반대 {r['opposite']}")
        for d in r["disagreements"]:
            print(f"    {d['title'][:22]:<22} 사람 {d['human']} / AI {d['ai']}")
    print(f"🍃 축 전체  일치 {report['axes_pooled']['agree']}% (κ={report['axes_pooled']['kappa']})")


if __name__ == "__main__":
    main()
