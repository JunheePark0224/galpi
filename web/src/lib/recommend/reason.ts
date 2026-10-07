import { lengthTag } from "./length";
import { AXES, type AxisKey, type Book, type LeafAnswers, type TargetAnswers } from "./types";

export const AXIS_LABEL: Record<AxisKey, [string, string]> = {
  temp: ["따뜻함", "여운"], pull: ["문장", "몰입"], gain: ["알게 됨", "마음"], world: ["현실", "딴 세상"],
};
export const WAY_LABEL = { 개념: "개념부터 쉽게", 실습: "따라 하며 실습", 사례: "사례로 술술" } as const;
const MAX_ITEMS = 5;

export type Reason = { label: "나온 이유" | "이 책은"; items: string[] };

export function reasonLine(book: Book, answers: LeafAnswers | TargetAnswers): Reason {
  if (book.entry === "target") {
    const a = answers as TargetAnswers;
    if (book.topic !== a.topic) return { label: "이 책은", items: [book.topic, WAY_LABEL[book.way]] };
    const items = [book.topic, ...a.keywords.filter((k) => book.keywords.includes(k))];
    if (a.way && a.way === book.way) items.push(WAY_LABEL[a.way]);
    if (a.len !== 0 && a.len === lengthTag(book.pages)) items.push(a.len > 0 ? "얇게" : "두껍게");
    return { label: "나온 이유", items: items.slice(0, MAX_ITEMS) };
  }
  const a = answers as LeafAnswers;
  const label = (axis: AxisKey, sign: number) => AXIS_LABEL[axis][sign > 0 ? 0 : 1];
  const matched = [...AXES]
    .filter((axis) => a[axis] !== 0 && Math.sign(a[axis]) === book.axes[axis])
    .sort((x, y) => Math.abs(a[y]) - Math.abs(a[x]))
    .map((axis) => label(axis, a[axis]));
  const len = lengthTag(book.pages);
  if (a.len !== 0 && a.len === len) matched.push(a.len > 0 ? "얇게" : "두껍게");
  if (matched.length) return { label: "나온 이유", items: matched.slice(0, MAX_ITEMS) };
  const own = AXES.flatMap((axis) => {
    const v = book.axes[axis];
    return v === null || v === 0 ? [] : [label(axis, v)];   // an empty axis (비움) says nothing about the book
  });
  return { label: "이 책은", items: own.slice(0, 3) };
}
