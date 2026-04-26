import { HE_TO_EN } from "./keymap.ts";

const QUOTE_NORMALIZE: Readonly<Record<string, string>> = {
  "”": '"',
  "״": '"',
};

/**
 * Convert Hebrew text (typed naturally) to the English keyboard keystrokes
 * that produce the same characters in AutoCAD with a Hebrew font.
 */
export function convert(input: string): string {
  if (!input) return "";

  const segments: string[] = [];
  let digitRun = "";

  for (const raw of input) {
    const char = QUOTE_NORMALIZE[raw] ?? raw;
    const isDigit = char >= "0" && char <= "9";

    if (isDigit) {
      digitRun += char;
      continue;
    }

    if (digitRun) {
      segments.push(digitRun);
      digitRun = "";
    }
    segments.push(char);
  }
  if (digitRun) segments.push(digitRun);

  return segments
    .map((seg) => {
      if (seg.length > 1) return seg.split("").reverse().join("");
      return HE_TO_EN[seg] ?? seg;
    })
    .join("");
}
