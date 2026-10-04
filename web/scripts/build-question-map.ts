// Run from web/:  npm run map:build   — docs/question-map.md → checks → src/data/question-map.json (commit it)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseQuestionMap, validateMap } from "../src/lib/paths";

const root = path.resolve(process.cwd());
const vocab = JSON.parse(readFileSync(path.join(root, "src/data/vocab.json"), "utf8")) as Record<string, { keywords: Record<string, string> }>;
const books = JSON.parse(readFileSync(path.join(root, "src/data/books.json"), "utf8")) as { genre: string }[];
const map = parseQuestionMap(readFileSync(path.resolve(root, "..", "docs", "question-map.md"), "utf8"));
const errors = validateMap(map, {
  topics: Object.fromEntries(Object.entries(vocab).map(([t, v]) => [t, Object.keys(v.keywords)])),
  genres: [...new Set(books.map((b) => b.genre))],
});
if (errors.length) {
  console.error(`question map: ${errors.length} problem(s)\n${errors.map((e) => `  - ${e}`).join("\n")}`);
  process.exit(1);
}
writeFileSync(path.join(root, "src/data/question-map.json"), `${JSON.stringify(map, null, 1)}\n`);
console.log(`question-map.json: ${Object.keys(map.nodes).length} questions, ${map.far.length} far rules`);
