import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { convert } from "../src/translator/convert.ts";

const cases = [
  // Plain digit cases the user reported broken
  "1,500",
  "17%",
  "8:00-17:00",
  "1/3/2026",
  "50",
  "1.85",
  "1,234,567.89",
  "200",
  "+35",
  "-5",
  "V1.2.3",
  "12א",
  "$5",
  "$1,500",
  "₪1,000",
  "100₪",
  // Bigger real-world string
  `מחיר 1,500 ש"ח (כולל מע"מ 17%). שעות עבודה 8:00-17:00, יומיים. משלוח: 1/3/2026 (יום א'). מידות [50 ס"מ] גובה 1.85 מ'. טמפ' -5 עד +35. גרסה V1.2.3 הנחה 25%. סה"כ 1,234,567.89 ש"ח. רוחב כפול 200 ועומק 75. בית מס' 7, דירה 12א.`,
];

const lines = [];
lines.push("# Stress test — paste each OUTPUT line into AutoCAD with Hebrew SHX font + Backwards style.");
lines.push("# Read the rendered display right-to-left (numbers LTR within). It should match INPUT.");
lines.push("");
for (const input of cases) {
  lines.push(`INPUT : ${input}`);
  lines.push(`OUTPUT: ${convert(input)}`);
  lines.push("");
}

const target = resolve(import.meta.dirname, "..", "test-paste-temp.txt");
writeFileSync(target, lines.join("\n"), "utf8");
console.log(`Wrote ${cases.length} cases to ${target}`);
