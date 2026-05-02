import { describe, expect, it } from "vitest";
import { convert } from "./convert.ts";
import { EN_TO_HE, HE_TO_EN } from "./keymap.ts";

// =============================================================================
// Letter mapping — Hebrew runs are NOT pre-reversed. AutoCAD's Backwards flag
// reverses the source at draw; reading the rendered display right-to-left then
// recovers the typed Hebrew word.
// =============================================================================
describe("convert: letter mapping", () => {
  it("maps every Hebrew letter to its English keyboard key", () => {
    for (const [he, en] of Object.entries(HE_TO_EN)) {
      expect(convert(he), `"${he}" should map to "${en}"`).toBe(en);
    }
  });

  it("is consistent with the source EN_TO_HE map", () => {
    for (const [en, he] of Object.entries(EN_TO_HE)) {
      expect(convert(he)).toBe(en);
    }
  });

  it("converts a Hebrew word", () => {
    expect(convert("שלום")).toBe("akuo");
  });

  it("preserves spaces between letters", () => {
    expect(convert("ש נ ב")).toBe("a b c");
  });

  it("converts a Hebrew sentence", () => {
    expect(convert("שלום עולם")).toBe("akuo guko");
  });
});

// =============================================================================
// Digits — pre-reversed so AutoCAD's Backwards flip restores typed order.
// =============================================================================
describe("convert: digits", () => {
  it("passes single digit through (length 1, reversal is a no-op)", () => {
    expect(convert("5")).toBe("5");
    expect(convert("0")).toBe("0");
  });

  it("reverses multi-digit numbers", () => {
    expect(convert("12")).toBe("21");
    expect(convert("123")).toBe("321");
    expect(convert("2025")).toBe("5202");
    expect(convert("1234567")).toBe("7654321");
  });

  it("reverses preserves-leading-zero numbers", () => {
    expect(convert("007")).toBe("700");
    expect(convert("03")).toBe("30");
  });
});

// =============================================================================
// Times — colons internal to a digit run are part of the run and reversed.
// =============================================================================
describe("convert: time formats", () => {
  it("HH:MM", () => {
    expect(convert("03:17")).toBe("71:30");
    expect(convert("9:05")).toBe("50:9");
  });

  it("HH:MM:SS", () => {
    expect(convert("03:17:45")).toBe("54:71:30");
  });
});

// =============================================================================
// Decimals — `.` (period) → `/` (slash key produces period glyph in font).
// Period internal to digits is part of the numeric run.
// =============================================================================
describe("convert: decimals", () => {
  it("converts and reverses a decimal number", () => {
    expect(convert("12.5")).toBe("5/21");
    expect(convert("1.25")).toBe("52/1");
  });

  it("converts and reverses a decimal less than 1", () => {
    expect(convert("0.5")).toBe("5/0");
  });
});

// =============================================================================
// Dates — `/` → `q` (slash glyph is at q key). Slash internal to digits is
// part of the run.
// =============================================================================
describe("convert: dates", () => {
  it("dd/mm/yyyy", () => {
    expect(convert("25/12/2025")).toBe("5202q21q52");
  });

  it("dd-mm-yyyy", () => {
    expect(convert("25-12-2025")).toBe("5202-21-52");
  });
});

// =============================================================================
// Ranges & phones — hyphens flanked by digits are internal to the run.
// =============================================================================
describe("convert: ranges and phones", () => {
  it("numeric range", () => {
    expect(convert("5-10")).toBe("01-5");
  });

  it("phone number with hyphen", () => {
    expect(convert("03-1234567")).toBe("7654321-30");
  });
});

// =============================================================================
// Parens — `(` ↔ `)` swap (font glyphs at those positions are the opposite
// bracket, so AutoCAD's reversal lands them in correct visual position).
// Parens are NOT part of a numeric run.
// =============================================================================
describe("convert: parentheses", () => {
  it("swaps parens around a Hebrew word", () => {
    expect(convert("(שלום)")).toBe(")akuo(");
  });

  it("swaps parens around a number", () => {
    expect(convert("(123)")).toBe(")321(");
  });

  it("swaps parens around a decimal with sign", () => {
    expect(convert("(±0.5)")).toBe(")±5/0(");
  });
});

// =============================================================================
// Quote handling — `"` passthrough; curly U+201D and Hebrew gershayim U+05F4
// normalize to ASCII `"`. Hebrew geresh U+05F3 normalizes to ASCII `'`.
// =============================================================================
describe("convert: quotes", () => {
  it("passes ASCII double quote through", () => {
    expect(convert('מ"מ')).toBe('n"n');
    expect(convert('ש"ח')).toBe('a"j');
  });

  it("normalizes curly double quote U+201D to ASCII", () => {
    expect(convert("”")).toBe('"');
  });

  it("normalizes Hebrew gershayim U+05F4 to ASCII", () => {
    expect(convert("״")).toBe('"');
    expect(convert("5״")).toBe('5"');
  });

  it("normalizes Hebrew geresh U+05F3 to ASCII apostrophe", () => {
    expect(convert("מס׳")).toBe("nxw");
  });
});

// =============================================================================
// Passthrough — chars not in map render as-is (or fail to render if the font
// lacks the glyph, e.g. `x`, `⌀`).
// =============================================================================
describe("convert: passthrough", () => {
  it("returns empty for empty input", () => {
    expect(convert("")).toBe("");
  });

  it("preserves whitespace", () => {
    expect(convert("   ")).toBe("   ");
  });

  it("passes ASCII uppercase letters through (rendered as English glyphs)", () => {
    expect(convert("ABC")).toBe("ABC");
    expect(convert("R=5")).toBe("R=5");
  });

  it("passes special symbols through", () => {
    expect(convert("±")).toBe("±");
    expect(convert("%")).toBe("%");
    expect(convert("⌀")).toBe("⌀");
    expect(convert("=")).toBe("=");
  });

  it("maps standalone comma to apostrophe key (font's apostrophe glyph is comma)", () => {
    expect(convert(",")).toBe("'");
  });

  it("reverses thousands-separated numbers (comma becomes apostrophe)", () => {
    expect(convert("1,000")).toBe("000'1");
    expect(convert("12,345.67")).toBe("76/543'21");
  });

  it("passes colon through (font's colon key produces colon glyph)", () => {
    expect(convert(":")).toBe(":");
  });
});

// =============================================================================
// Mixed sentences (real-world cases)
// =============================================================================
describe("convert: mixed sentences", () => {
  it("Hebrew + 2-digit number", () => {
    expect(convert("פרויקט 12")).toBe("pruhey 21");
  });

  it("Hebrew + date with hyphen prefix (hyphen binds as leading sign)", () => {
    expect(convert("ב-25/12/2025")).toBe("c5202q21q52-");
  });

  it("Hebrew + time", () => {
    expect(convert("בשעה 03:17")).toBe("cagv 71:30");
  });

  it("Hebrew + decimal", () => {
    expect(convert("אורך 12.5 מטר")).toBe("turl 5/21 nyr");
  });

  it("Hebrew + parens with decimal", () => {
    expect(convert("אורך (12.5) מטר")).toBe("turl )5/21( nyr");
  });
});

// =============================================================================
// English in input — uppercased so the Hebrew SHX font renders English glyphs
// (lowercase Latin slots in that font hold Hebrew glyphs).
// =============================================================================
describe("convert: English input uppercasing", () => {
  it("uppercases a lowercase English word", () => {
    expect(convert("autocad")).toBe("AUTOCAD");
    expect(convert("hello")).toBe("HELLO");
  });

  it("uppercases mixed-case English", () => {
    expect(convert("AutoCAD")).toBe("AUTOCAD");
    expect(convert("Hello")).toBe("HELLO");
  });

  it("uppercases multiple English words preserving spaces", () => {
    expect(convert("hello world")).toBe("HELLO WORLD");
  });

  it("uppercases English embedded in Hebrew", () => {
    expect(convert("שלום autocad")).toBe("akuo AUTOCAD");
  });

  it("uppercases lowercase letter prefix on numeric run", () => {
    expect(convert("v1.2.3")).toBe("3/2/1V");
  });

  it("leaves Hebrew→Latin output lowercase (so font renders Hebrew)", () => {
    expect(convert("שלום")).toBe("akuo");
  });
});

// =============================================================================
// AutoCAD notation
// =============================================================================
describe("convert: AutoCAD notation", () => {
  it("R=5", () => {
    expect(convert("R=5")).toBe("R=5");
  });

  it("percentage binds to digits (suffix part of numeric run)", () => {
    expect(convert("50%")).toBe("%05");
    expect(convert("17%")).toBe("%71");
  });

  it("version with leading letter binds to digits", () => {
    expect(convert("V1.2.3")).toBe("3/2/1V");
  });

  it("plus/minus single digit (± is neutral, not part of run)", () => {
    expect(convert("±5")).toBe("±5");
  });

  it("ASCII sign binds as leading: +35, -5", () => {
    expect(convert("+35")).toBe("53+");
    expect(convert("-5")).toBe("5-");
  });

  it("ASCII sign binds as trailing: 35+, 5-", () => {
    expect(convert("35+")).toBe("+53");
    expect(convert("5-")).toBe("-5");
  });

  it("plus as internal connector between digits", () => {
    expect(convert("5+10")).toBe("01+5");
  });

  it("currency binds at leading edge", () => {
    expect(convert("$5")).toBe("5$");
    expect(convert("$1,500")).toBe("005'1$");
    expect(convert("₪1,000")).toBe("000'1₪");
    expect(convert("€10")).toBe("01€");
  });

  it("currency binds at trailing edge", () => {
    expect(convert("5$")).toBe("$5");
    expect(convert("100₪")).toBe("₪001");
  });

  it("inches with ASCII quote", () => {
    expect(convert('5"')).toBe('5"');
  });
});
