// Run from web/:  npm run map:coverage   — books at every path end of src/data/question-map.json, fewest first
import { readFileSync } from "node:fs";
import path from "node:path";
import { toBook } from "../src/lib/books/toBook";
import type { CatalogBook } from "../src/lib/books/types";
import { coverage, type QuestionMap } from "../src/lib/paths";

const root = path.resolve(process.cwd());
const map = JSON.parse(readFileSync(path.join(root, "src/data/question-map.json"), "utf8")) as QuestionMap;
const books = (JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as CatalogBook[]).map(toBook);
const rows = coverage(map, books);
console.log("books | mode | path | scope");
for (const r of rows) console.log(`${String(r.books).padStart(5)} | ${r.mode.padEnd(9)} | ${r.crumbs.join(" › ") || "(좁히지 않음)"} | ${r.scopeKey}`);
const short = rows.filter((r) => r.books < 4).length;
console.log(`\n${rows.length} ends · ${short} with fewer than 4 books`);
