// Spoken Hebrew keyword → symbol post-processing for whisper output.
// Longest phrases first so multi-word entries beat single-word matches.
// Word-edge: char before/after must not be Hebrew letter or word char,
// since Hebrew has no \b that respects its block.
const HE_WORD = "\\u0590-\\u05FF\\w";

function rule(phrase: string, symbol: string): [RegExp, string] {
  return [new RegExp(`(?<![${HE_WORD}])${phrase}(?![${HE_WORD}])`, "g"), symbol];
}

const SYMBOL_RULES: Array<[RegExp, string]> = [
  // Whisper sometimes joins multi-word phrases without spaces. Allow optional whitespace.
  rule("ירידת\\s*שורה", "\n"),
  rule("רד\\s*שורה", "\n"),
  rule("פתח\\s*סוגריים", "("),
  rule("סגור\\s*סוגריים", ")"),
  rule("נקודה\\s*פסיק", ";"),
  rule("נקודותיים", ":"),
  rule("נקודתיים", ":"),
  rule("פלוס", "+"),
  rule("מינוס", "-"),
  rule("מקף", "-"),
  rule("סלאש", "/"),
  rule("סלש", "/"),
  rule("כפול", "*"),
  rule("כוכבית", "*"),
  rule("שווה", "="),
  rule("אחוז", "%"),
  rule("שטרודל", "@"),
  rule("סולמית", "#"),
  rule("האשטג", "#"),
  rule("נקודה", "."),
  rule("פסיק", ","),
];

export function applySymbols(input: string): string {
  if (!input) return input;
  let out = input;
  for (const [re, sym] of SYMBOL_RULES) out = out.replace(re, sym);
  // remove unicode replacement char (whisper tokenizer invalid-byte artifact)
  out = out.replace(/�/g, "");
  // strip bidi formatting chars (LRM/RLM/LRE/RLE/PDF/LRO/RLO/LRI/RLI/FSI/PDI).
  // Whisper sometimes emits these around Hebrew boundaries; textbox is already
  // dir="rtl" so they add nothing but break downstream regex matching.
  out = out.replace(/[‎‏‪-‮⁦-⁩]/g, "");
  // strip pause-comma adjacent to operator symbol (BEFORE tightening,
  // since tightening would glue the comma to the symbol)
  // case A: comma on BOTH sides of symbol: ", + ," → " + "
  out = out.replace(/[ \t]*,[ \t]*([+\-/*=%@#])[ \t]*,[ \t]*/g, " $1 ");
  // case B: leading comma only: " , +" → " +"
  out = out.replace(/[ \t]*,[ \t]+(?=[+\-/*=%@#][ \t])/g, " ");
  // case C: trailing comma only: "+ , " → "+ "
  out = out.replace(/(?<=[ \t][+\-/*=%@#])[ \t]+,[ \t]*/g, " ");
  // tighten punctuation: ". " stays, " ." → "."
  out = out.replace(/[ \t]+([.,;:)])/g, "$1");
  // tighten open paren: "( " → "("
  out = out.replace(/(\()[ \t]+/g, "$1");
  // dedupe whisper's pause-comma stutter: ",,", ", ,", ",,," → ","
  out = out.replace(/(?:[ \t]*,){2,}/g, ",");
  // collapse repeated periods from same source
  out = out.replace(/(?:[ \t]*\.){2,}/g, ".");
  // strip whisper's stray punctuation that landed after a newline keyword
  // e.g. "רד שורה." → " \n." after replace → " \n" after this pass
  out = out.replace(/\n[ \t]*[.,;:]+/g, "\n");
  // strip spaces around inserted newlines (also catches space left by previous pass)
  out = out.replace(/[ \t]*\n[ \t]*/g, "\n");
  // strip stray punctuation at very start of output (whisper silence artifact)
  out = out.replace(/^[ \t]*[.,;:]+[ \t]*/, "");
  return out;
}
