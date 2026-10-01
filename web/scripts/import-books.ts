// Run from web/:  npm run books:import
// ../data/processed/books_v1.json (reviewed, D4) — or books_v1_draft.json (D3) until it exists —
// + d1_selected.csv titles and authors + keyword_vocab.json  →  src/data/books.json, src/data/vocab.json.
// Then the picked books of ../data/processed/additions/*.json (file-name order) are appended after the 200 (D-C pilot,
// 10-01) — the human review is already applied to those files by src/apply_review.py.
// Only our own tags, one-liners, titles and authors: no YES24 text.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { mergeAdditions } from "../src/lib/books/additions";
import { bibFromCsv, normalizeCatalog, normalizeVocab } from "../src/lib/books/normalize";

const processed = path.resolve(process.cwd(), "..", "data", "processed");
const outDir = path.resolve(process.cwd(), "src", "data");
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, "utf8"));
const write = (name: string, data: unknown) => writeFileSync(path.join(outDir, name), `${JSON.stringify(data, null, 1)}\n`);

const vocab = normalizeVocab(readJson(path.join(processed, "keyword_vocab.json")));
write("vocab.json", vocab);
console.log(`vocab.json: ${Object.values(vocab).reduce((n, t) => n + Object.keys(t.keywords).length, 0)} keywords`);

const source = ["books_v1.json", "books_v1_draft.json"].map((f) => path.join(processed, f)).find((f) => existsSync(f));
if (!source) {
  console.error("no books_v1.json or books_v1_draft.json yet — src/data/books.json is left as it is");
  process.exit(2);
}
const addDir = path.join(processed, "additions");
const addFiles = existsSync(addDir) ? readdirSync(addDir).filter((f) => f.endsWith(".json") && !f.endsWith("-ai2.json")).sort() : [];
const base = readJson(source) as Record<string, unknown>[];
const merged = mergeAdditions(base, bibFromCsv(readFileSync(path.join(processed, "d1_selected.csv"), "utf8")),
  addFiles.map((f) => readJson(path.join(addDir, f))), vocab);
const books = normalizeCatalog(merged.rows, merged.bib);
write("books.json", books);
const leaf = books.filter((b) => b.entry === "leaf").length;
console.log(`books.json: ${books.length} books (leaf ${leaf}, target ${books.length - leaf}) from ${path.basename(source)}`
  + ` + ${books.length - base.length} added (${addFiles.join(", ") || "no additions"})`);
