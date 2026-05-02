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
const NUMERIC_RUN_SOURCE =
  /[$€£₪+\-]?[A-Za-z]*\d+(?:[+.,:/\-]\d+)*[A-Za-z]*[%$€£₪+\-]?/.source;
// Pure Latin word runs (no adjacent digits) get the same pre-reversal
// treatment — AutoCAD's flip then displays them in typed letter order.
const LATIN_RUN_SOURCE = /[A-Za-z]+/.source;
const LTR_RUN = new RegExp(`${NUMERIC_RUN_SOURCE}|${LATIN_RUN_SOURCE}`, "g");

function reverseLtrRuns(input: string): string {
  return input.replace(LTR_RUN, (m) => [...m].reverse().join(""));
}

// In AutoCAD's Hebrew SHX font, lowercase Latin slots hold Hebrew glyphs
// while uppercase slots hold real English glyphs. So any English actually
// typed by the user must be uppercased — otherwise AutoCAD would render it
// as Hebrew. Hebrew chars typed by the user pass through HE_TO_EN to
// lowercase Latin (intentionally), which is what makes them render Hebrew.
function uppercaseInputLatin(input: string): string {
  return input.replace(/[a-z]/g, (c) => c.toUpperCase());
}

export function convert(input: string): string {
  if (!input) return "";

  let pre = uppercaseInputLatin(input);
  pre = reverseLtrRuns(pre);
  let out = "";
  for (const raw of pre) {
    const char = QUOTE_NORMALIZE[raw] ?? raw;
    out += HE_TO_EN[char] ?? char;
  }
  return out;
}
