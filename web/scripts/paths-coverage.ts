// Run from web/:  npm run map:coverage   — books at every path end of src/data/question-map.json, fewest first
import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogBook } from "../src/lib/books/types";
import { coverage, type QuestionMap } from "../src/lib/paths";
import type { Book } from "../src/lib/recommend";

const root = path.resolve(process.cwd());
const map = JSON.parse(readFileSync(path.join(root, "src/data/question-map.json"), "utf8")) as QuestionMap;
// same mapping as toBook() in src/lib/books/catalog.ts (not imported: catalog.ts pulls the app's data modules)
const toBook = (b: CatalogBook): Book => (b.entry === "leaf"
  ? { id: b.isbn, entry: "leaf", genre: b.genre, pages: b.pages, axes: b.axes }
  : { id: b.isbn, entry: "target", field: b.field, topic: b.topic, genre: b.genre, pages: b.pages, way: b.way, keywords: b.keywords });
const books = (JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as CatalogBook[]).map(toBook);
const rows = coverage(map, books);
console.log("books | mode | path | scope");
for (const r of rows) console.log(`${String(r.books).padStart(5)} | ${r.mode.padEnd(9)} | ${r.crumbs.join(" › ") || "(좁히지 않음)"} | ${r.scopeKey}`);
const short = rows.filter((r) => r.books < 4).length;
console.log(`\n${rows.length} ends · ${short} with fewer than 4 books`);
