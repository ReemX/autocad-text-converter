import { HE_TO_EN } from "./keymap.ts";

const QUOTE_NORMALIZE: Readonly<Record<string, string>> = {
  "”": '"',
  "״": '"',
  "׳": "'",
};

// AutoCAD's Backwards flag reverses the whole source at draw time. Hebrew
// runs need that reversal — read RTL, glyphs land in correct order. LTR
// content (Latin letters, digits, ASCII punctuation) needs the reversal
// undone, so we pre-reverse the whole LTR run; AutoCAD's flip then restores
// natural typed order.
//
// One contiguous LTR run can include letters, digits, and connectors
// (space, hyphen, comma, period, apostrophe, double-quote, semicolon,
// colon, slash, plus, percent, currency). Run starts with a letter/digit
// (with optional leading sign or currency) and ends with a letter/digit
// or terminator-class punctuation — never a trailing space.
//
// Neutrals that break the run: brackets, =, ±, ⌀, °, Hebrew.
const LTR_RUN =
  /[$€£₪+\-]?[A-Za-z\d](?:[A-Za-z\d $€£₪+\-,.'";:/%]*[A-Za-z\d$€£₪+\-,.;:/%])?/g;

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
