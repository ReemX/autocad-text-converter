import { describe, expect, it } from "vitest";
import { convert } from "./convert.ts";
import { EN_TO_HE, HE_TO_EN } from "./keymap.ts";

describe("convert: en -> he letter mapping", () => {
  it("maps every entry in EN_TO_HE", () => {
    for (const [en, he] of Object.entries(EN_TO_HE)) {
      expect(convert(en, "en-to-he"), `"${en}" should map to "${he}"`).toBe(he);
    }
  });

  it("maps a sample word", () => {
    expect(convert("shalom", "en-to-he")).toBe("דישךםצ");
  });

  it("preserves spaces", () => {
    expect(convert("a b c", "en-to-he")).toBe("ש נ ב");
  });
});

describe("convert: he -> en letter mapping", () => {
  it("maps every entry in HE_TO_EN", () => {
    for (const [he, en] of Object.entries(HE_TO_EN)) {
      expect(convert(he, "he-to-en"), `"${he}" should map to "${en}"`).toBe(en);
    }
  });

  it("is the inverse of en->he for plain letters", () => {
    const sample = "abcdefghijklmnopqrstuvwxyz";
    const round = convert(convert(sample, "en-to-he"), "he-to-en");
    expect(round).toBe(sample);
  });
});

describe("convert: passthrough", () => {
  it("returns empty for empty input", () => {
    expect(convert("", "en-to-he")).toBe("");
    expect(convert("", "he-to-en")).toBe("");
  });

  it("passes whitespace through", () => {
    expect(convert("   ", "en-to-he")).toBe("   ");
  });

  it("passes uppercase ASCII through (not in map)", () => {
    expect(convert("ABC", "en-to-he")).toBe("ABC");
  });

  it("passes unmapped punctuation through", () => {
    expect(convert("?!@#$%^&*", "en-to-he")).toBe("?!@#$%^&*");
  });
});

describe("convert: quote normalization", () => {
  it("normalizes curly double quote U+201D to ASCII", () => {
    expect(convert("”", "en-to-he")).toBe('"');
    expect(convert("”", "he-to-en")).toBe('"');
  });

  it("normalizes Hebrew gershayim U+05F4 to ASCII", () => {
    expect(convert("״", "en-to-he")).toBe('"');
    expect(convert("״", "he-to-en")).toBe('"');
  });
});

// =============================================================================
// EDGE CASES — behavior pending AutoCAD verification.
// User will paste stress strings into AutoCAD and report rendered output.
// Convert each `it.todo` into a real `it` once expected output is known.
// =============================================================================

describe("convert: digits and numbers (PENDING AutoCAD verification)", () => {
  it.todo("single digit");
  it.todo("multi-digit number (e.g. 1234)");
  it.todo("number with leading zero (e.g. 007)");
  it.todo("zero");
});

describe("convert: time formats (PENDING)", () => {
  it.todo("HH:MM (03:17)");
  it.todo("HH:MM:SS (03:17:45)");
  it.todo("H:MM (9:05)");
});

describe("convert: decimal numbers (PENDING)", () => {
  it.todo("X.Y (12.5)");
  it.todo("0.X (0.5)");
  it.todo("X. trailing dot (12.)");
  it.todo(".X leading dot (.5)");
});

describe("convert: dates (PENDING)", () => {
  it.todo("dd/mm/yyyy (25/12/2025)");
  it.todo("dd.mm.yyyy (25.12.2025)");
  it.todo("dd-mm-yyyy (25-12-2025)");
});

describe("convert: ranges and dimensions (PENDING)", () => {
  it.todo("range with hyphen (5-10)");
  it.todo("dimension X*Y or X×Y (5x10)");
  it.todo("phone with hyphen (03-1234567)");
});

describe("convert: parentheses and brackets (PENDING)", () => {
  it.todo("parens around text ((hello))");
  it.todo("parens around number ((123))");
  it.todo("nested or back-to-back");
  it.todo("brackets ([abc])");
});

describe("convert: thousands separator (PENDING)", () => {
  it.todo("1,000");
  it.todo("12,345.67");
});

describe("convert: mixed sentences (PENDING)", () => {
  it.todo("Hebrew word + number (פרויקט 12)");
  it.todo("Hebrew + date (ב-25/12/2025)");
  it.todo("Hebrew + time (בשעה 03:17)");
  it.todo("Hebrew + decimal (אורך 12.5 מטר)");
  it.todo("Hebrew + parens with number (אורך (12.5))");
});

describe("convert: AutoCAD-specific notation (PENDING)", () => {
  it.todo("diameter ⌀12");
  it.todo("R=5");
  it.todo("percentage 50%");
  it.todo("plus/minus ±5");
  it.todo("apostrophe in word (don't)");
  it.todo("double-quote inches (5\")");
});
