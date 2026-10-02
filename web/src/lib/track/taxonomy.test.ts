// @vitest-environment node
/**
 * taxonomy 7-3 ②: docs/taxonomy.md (source) ↔ docs/taxonomy.csv (machine copy) ↔ EVENT_SPEC (code) ↔ track() calls.
 * When this fails, find out which side is wrong (taxonomy 7-3 ④) — never edit an expectation just to make it pass.
 */
import { readdirSync, readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { COMMON_KEYS, EVENT_SPEC, parseCommon, type EventName, type PropSpec } from "./schema";

const DOCS = new URL("../../../../docs/", import.meta.url);
const SRC = new URL("../../", import.meta.url);
const md = readFileSync(new URL("taxonomy.md", DOCS), "utf8");
const table: string[][] = parse(readFileSync(new URL("taxonomy.csv", DOCS), "utf8"), { bom: true, skip_empty_lines: true });

const HEADER = ["Trigger", "Event Category", "Integration", "Event Name", "Event Description", "Event Properties",
  "Value Description", "Array", "Data Type", "Value Example", "Note", "Event ID", "Status"] as const;
type Row = Record<(typeof HEADER)[number], string>;
const rows: Row[] = table.slice(1).map((cells) => Object.fromEntries(HEADER.map((h, i) => [h, cells[i] ?? ""])) as Row);
const eventRows = rows.filter((r) => r["Event Name"] !== "*");
const commonRows = rows.filter((r) => r["Event Name"] === "*");
const byEvent = Map.groupBy(eventRows, (r) => r["Event Name"]);

/** First-column backticked words of the markdown table under `heading` (up to the next heading). */
function tableWords(heading: string): string[] {
  const start = md.indexOf(heading);
  const body = md.slice(start + heading.length, md.indexOf("\n#", start + heading.length));
  return [...body.matchAll(/^\| ([^|]+)\|/gm)].flatMap((m) => [...m[1].matchAll(/`([^`]+)`/g)].map((w) => w[1]));
}
const VERBS = new Set(tableWords("### 2-2. 허용 동사"));
const STATUSES = new Set(tableWords("### 2-8. 상태"));
const IN_CODE = ["live", "planned-P4", "planned-P5", "planned-taxonomy"];
const TYPES: Record<string, string> = { String: "string", Number: "number", Boolean: "boolean", Object: "object" };

const quoted = (example: string) => [...example.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
const listsNull = (example: string) => /(^|,\s*)null(\s*,|$)/.test(example.trim());
const acceptsNull = (s: PropSpec) => (typeof s.type === "string" ? s.nullable === true : s.type.includes(null));
const specOf = (name: string): Readonly<Record<string, PropSpec>> => EVENT_SPEC[name as EventName];

/**
 * Every `track("name"` in the app's source (tests excluded) — the events the code really sends — and, since v0.10, every
 * `trackStored("name"` (taxonomy 2-7: an event its own route stored, only the Amplitude copy left to send — E-31).
 */
function trackedNames(): Set<string> {
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const text = files.map((f) => readFileSync(new URL(f.replaceAll("\\", "/"), SRC), "utf8")).join("\n");
  return new Set([...text.matchAll(/\btrack(?:Stored)?\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1]));
}

describe("taxonomy.csv format and naming (taxonomy 2절)", () => {
  it("#1 has exactly the 13 columns", () => {
    expect(table[0]).toEqual([...HEADER]);
    expect(table.every((cells) => cells.length === HEADER.length)).toBe(true);
  });

  it("reads the verb and status lists from taxonomy.md", () => {
    expect(VERBS.size).toBeGreaterThanOrEqual(15);
    expect([...STATUSES]).toEqual(expect.arrayContaining(["live", "planned-P4", "planned-P5", "planned-taxonomy", "proposed", "removed"]));
  });

  it.each([...byEvent.keys()])("#2 %s is snake_case and ends in an allowed verb (2-1, 2-2)", (name) => {
    expect(name).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/);
    expect(VERBS, name).toContain(name.split("_").at(-1));
  });

  it("#3 property names, types, arrays, triggers and statuses follow 2-3 · 2-6 · 2-8", () => {
    for (const r of rows) {
      const where = `${r["Event ID"]} ${r["Event Properties"]}`;
      expect(["view", "click", "submit", "system", "-"], where).toContain(r.Trigger);
      expect(STATUSES, where).toContain(r.Status);
      if (r["Event Properties"] === "") continue;   // an event with common props only
      expect(r["Event Properties"], where).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
      expect(Object.keys(TYPES), where).toContain(r["Data Type"]);
      expect(["TRUE", "FALSE"], where).toContain(r.Array);
      if (r["Data Type"] === "Boolean") expect(r["Event Properties"], where).toMatch(/^(is|has)_/);
    }
  });

  it("#4 one Event ID per name, and an event's rows share trigger, category, description and status", () => {
    for (const [name, list] of byEvent) {
      for (const col of ["Event ID", "Trigger", "Event Category", "Event Description", "Status"] as const) {
        expect(new Set(list.map((r) => r[col])).size, `${name} ${col}`).toBe(1);
      }
    }
    const ids = [...byEvent.values()].map((list) => list[0]["Event ID"]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("#5 one property name = one data type and one array flag in every event (2-3)", () => {
    const seen = new Map<string, string>();
    for (const r of rows.filter((x) => x["Event Properties"] !== "")) {
      const shape = `${r["Data Type"]}/${r.Array}`;
      expect(seen.get(r["Event Properties"]) ?? shape, r["Event Properties"]).toBe(shape);
      seen.set(r["Event Properties"], shape);
    }
  });
});

describe("taxonomy.csv ↔ EVENT_SPEC ↔ code (taxonomy 7-3)", () => {
  const inCode = [...byEvent].filter(([, list]) => IN_CODE.includes(list[0].Status));

  it("#6 the live and planned events are exactly EVENT_SPEC's", () => {
    expect(inCode.map(([name]) => name).sort()).toEqual(Object.keys(EVENT_SPEC).sort());
  });

  it.each(inCode)("#7 %s has the csv properties, types, values and destinations", (name, list) => {
    const spec = specOf(name);
    const props = list.filter((r) => r["Event Properties"] !== "" && IN_CODE.includes(r.Status));
    expect(Object.keys(spec).sort()).toEqual(props.map((r) => r["Event Properties"]).sort());
    for (const r of props) {
      const s = spec[r["Event Properties"]];
      const where = `${name}.${r["Event Properties"]}`;
      expect(typeof s.type === "string" ? s.type : "string", where).toBe(TYPES[r["Data Type"]]);
      expect(s.array === true, where).toBe(r.Array === "TRUE");
      expect(acceptsNull(s), `${where} null`).toBe(listsNull(r["Value Example"]));
      if (typeof s.type !== "string") {
        expect(s.type.filter((v) => v !== null).sort(), `${where} values`).toEqual(quoted(r["Value Example"]).sort());
      }
      expect(s.only === "supabase", `${where} Supabase only`).toBe(r.Note.includes("Supabase only"));
      expect(s.only === "amplitude", `${where} Amplitude only`).toBe(r.Note.includes("Amplitude only"));
    }
  });

  it("#8 the `*` rows are COMMON_KEYS, and parseCommon returns exactly them", () => {
    expect(commonRows.map((r) => r["Event Properties"])).toEqual([...COMMON_KEYS]);
    const sample = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, screen_version: "v1",
      referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };
    expect(Object.keys(parseCommon(sample) ?? {})).toEqual([...COMMON_KEYS]);
  });

  it("#9 the `#### E-xx \\`name\\`` headings of taxonomy.md match the csv (ID, name) pairs", () => {
    const headings = [...md.matchAll(/^#### (E-\d+) `([a-z0-9_]+)`/gm)].map((m) => `${m[1]} ${m[2]}`);
    const csv = [...byEvent].map(([name, list]) => `${list[0]["Event ID"]} ${name}`);
    expect(headings.sort()).toEqual(csv.sort());
  });

  it("#10 the live events are exactly the ones the app calls track() with", () => {
    const live = [...byEvent].filter(([, list]) => list[0].Status === "live").map(([name]) => name);
    expect([...trackedNames()].sort()).toEqual(live.sort());
  });

  it("#11 each event's property table in taxonomy.md has the csv's property names, types, arrays and values", () => {
    const sections = md.split(/^(?=#### E-\d+ )/m).filter((part) => part.startsWith("#### E-"));
    expect(sections).toHaveLength(byEvent.size);
    let compared = 0;
    for (const section of sections) {
      const [, id, name] = section.match(/^#### (E-\d+) `([a-z0-9_]+)`/)!;
      // Row shape: | `prop` | 현재 → 제안 | Type (String[] = array) | Value | 설명 |
      const fromMd = [...section.matchAll(/^\| `([a-z0-9_]+)` \|[^|]*\|\s*(\w+)(\[\])?\s*\|([^|]*)\|/gm)]
        .map((m) => `${m[1]}: ${m[2]} ${m[3] ? "TRUE" : "FALSE"} ${m[4].trim()}`);
      const fromCsv = (byEvent.get(name) ?? []).filter((r) => r["Event Properties"] !== "")
        .map((r) => `${r["Event Properties"]}: ${r["Data Type"]} ${r.Array} ${r["Value Example"].trim()}`);
      expect(fromMd.sort(), `${id} ${name}`).toEqual(fromCsv.sort());
      compared += fromMd.length;
    }
    expect(compared, "the md row regex found the property tables").toBe(eventRows.filter((r) => r["Event Properties"] !== "").length);
  });
});
