import { HE_TO_EN } from "./keymap.ts";

const QUOTE_NORMALIZE: Readonly<Record<string, string>> = {
  "”": '"',
  "״": '"',
  "׳": "'",
};

// AutoCAD's Backwards flag reverses the whole source at draw time. Hebrew
// runs need that reversal — read RTL, glyphs land in correct order. LTR
// runs (Latin letters, digits, math signs, units) need the reversal undone,
// so we pre-reverse them; AutoCAD's flip then restores natural typed order.
//
// Approximates a Unicode bidi level run for LTR content:
//   - optional leading currency ET ($ € £ ₪) or sign ES (+ -)
//   - optional leading ASCII letters L (e.g. "V" in "V1.2.3")
//   - one or more digits EN
//   - any number of internal CS/ES (+ - . , : /) flanked by digits
//   - optional trailing ASCII letters L
//   - optional trailing terminator ET (% $ € £ ₪) or sign ES (+ -)
//
// Neutrals that break the run: brackets, =, ±, ⌀, °, whitespace, Hebrew.
const NUMERIC_RUN =
  /[$€£₪+\-]?[A-Za-z]*\d+(?:[+.,:/\-]\d+)*[A-Za-z]*[%$€£₪+\-]?/g;

function reverseNumericRuns(input: string): string {
  return input.replace(NUMERIC_RUN, (m) => [...m].reverse().join(""));
}

export function convert(input: string): string {
  if (!input) return "";

  const pre = reverseNumericRuns(input);
  let out = "";
  for (const raw of pre) {
    const char = QUOTE_NORMALIZE[raw] ?? raw;
    out += HE_TO_EN[char] ?? char;
  }
  return out;
}
