import { EN_TO_HE, HE_TO_EN } from "./keymap.ts";

export type Direction = "en-to-he" | "he-to-en";

const QUOTE_NORMALIZE: Readonly<Record<string, string>> = {
  "”": '"',
  "״": '"',
};

export function convert(input: string, direction: Direction): string {
  if (!input) return "";

  const map = direction === "en-to-he" ? EN_TO_HE : HE_TO_EN;
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
      return map[seg] ?? seg;
    })
    .join("");
}
