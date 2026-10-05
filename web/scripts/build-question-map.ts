// Run from web/:  npm run map:build   — docs/question-map.md → checks → src/data/question-map.json, and the mood questions
// that cannot change the draw with today's books → src/data/mood-skips.json (commit both)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { toBook } from "../src/lib/books/toBook";
import type { CatalogBook } from "../src/lib/books/types";
import { mapVocabulary, moodSkips, parseQuestionMap, validateMap } from "../src/lib/paths";

const root = path.resolve(process.cwd());
const vocab = JSON.parse(readFileSync(path.join(root, "src/data/vocab.json"), "utf8")) as Record<string, { keywords: Record<string, string> }>;
const map = parseQuestionMap(readFileSync(path.resolve(root, "..", "docs", "question-map.md"), "utf8"));
const errors = validateMap(map, mapVocabulary(vocab));
if (errors.length) {
  console.error(`question map: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
writeFileSync(path.join(root, "src/data/question-map.json"), `${JSON.stringify(map, null, 1)}\n`);
console.log(`question-map.json: ${Object.keys(map.nodes).length} questions, ${map.far.length} far rules`);
const books = (JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as CatalogBook[]).map(toBook);
const skips = moodSkips(map, books);
writeFileSync(path.join(root, "src/data/mood-skips.json"), `${JSON.stringify(skips, null, 1)}
`);
console.log(`mood-skips.json: ${skips.length} places where a mood question is passed over`);
