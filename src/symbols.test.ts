import { describe, it, expect } from "vitest";
import { applySymbols } from "./symbols.ts";

describe("applySymbols", () => {
  it("returns empty input as-is", () => {
    expect(applySymbols("")).toBe("");
  });

  it("replaces single-word symbol keywords", () => {
    expect(applySymbols("שלוש פלוס שתיים")).toBe("שלוש + שתיים");
    expect(applySymbols("חמש מינוס אחת")).toBe("חמש - אחת");
    expect(applySymbols("מטר סלש שניה")).toBe("מטר / שניה");
    expect(applySymbols("ארבע כפול שש")).toBe("ארבע * שש");
    expect(applySymbols("עשרים אחוז")).toBe("עשרים %");
  });

  it("supports both slash spelling variants", () => {
    expect(applySymbols("א סלש ב")).toBe("א / ב");
    expect(applySymbols("א סלאש ב")).toBe("א / ב");
  });

  it("handles multi-word phrases before single-word matches", () => {
    expect(applySymbols("פתח סוגריים שלום סגור סוגריים")).toBe("(שלום)");
    expect(applySymbols("מספר נקודה פסיק שני")).toBe("מספר; שני");
  });

  it("standalone נקודה still maps to dot when not part of נקודה פסיק", () => {
    expect(applySymbols("שלום נקודה")).toBe("שלום.");
  });

  it("does not match keyword inside larger word", () => {
    expect(applySymbols("פלוסים")).toBe("פלוסים");
    expect(applySymbols("מקפים")).toBe("מקפים");
    expect(applySymbols("הפלוס")).toBe("הפלוס");
  });

  it("preserves text without keywords", () => {
    expect(applySymbols("שלום עולם")).toBe("שלום עולם");
  });

  it("tightens punctuation spacing after replacement", () => {
    expect(applySymbols("שלום נקודה עולם")).toBe("שלום. עולם");
    expect(applySymbols("א פסיק ב")).toBe("א, ב");
  });

  it("handles bracket/at/hash keywords", () => {
    expect(applySymbols("שטרודל מייל")).toBe("@ מייל");
    expect(applySymbols("סולמית אחת")).toBe("# אחת");
    expect(applySymbols("האשטג שניים")).toBe("# שניים");
  });

  it("works on real-world transcribe sample", () => {
    const input = "820 פלוס 818 פלוס אבן שפה";
    expect(applySymbols(input)).toBe("820 + 818 + אבן שפה");
  });

  it("supports both colon spellings", () => {
    expect(applySymbols("שעה נקודותיים שתיים")).toBe("שעה: שתיים");
    expect(applySymbols("שעה נקודתיים שתיים")).toBe("שעה: שתיים");
  });

  it("converts newline keywords to actual newline", () => {
    expect(applySymbols("שורה אחת ירידת שורה שורה שתיים")).toBe("שורה אחת\nשורה שתיים");
    expect(applySymbols("שורה אחת רד שורה שורה שתיים")).toBe("שורה אחת\nשורה שתיים");
  });

  it("matches newline keyword even when whisper joins words without space", () => {
    expect(applySymbols("שורה אחת רדשורה שורה שתיים")).toBe("שורה אחת\nשורה שתיים");
    expect(applySymbols("א ירידתשורה ב")).toBe("א\nב");
  });

  it("matches multi-word symbol keywords joined without space", () => {
    expect(applySymbols("פתחסוגריים שלום סגורסוגריים")).toBe("(שלום)");
    expect(applySymbols("מספר נקודהפסיק שני")).toBe("מספר; שני");
  });

  it("dedupes whisper pause-comma stutter", () => {
    expect(applySymbols("שלום,, עולם")).toBe("שלום, עולם");
    expect(applySymbols("שלום, , , עולם")).toBe("שלום, עולם");
    expect(applySymbols("שלום ,,, עולם")).toBe("שלום, עולם");
  });

  it("dedupes repeated periods", () => {
    expect(applySymbols("שלום.. עולם")).toBe("שלום. עולם");
    expect(applySymbols("שלום . . . עולם")).toBe("שלום. עולם");
  });

  it("strips stray punctuation whisper appends after newline keyword", () => {
    expect(applySymbols("שורה אחת רד שורה. שורה שתיים")).toBe("שורה אחת\nשורה שתיים");
    expect(applySymbols("א ירידת שורה, ב")).toBe("א\nב");
    expect(applySymbols("א רדשורה. ב")).toBe("א\nב");
  });

  it("strips whisper silence artifact at start of output", () => {
    expect(applySymbols(". שלום עולם")).toBe("שלום עולם");
    expect(applySymbols(", שלום")).toBe("שלום");
    expect(applySymbols("   . שלום")).toBe("שלום");
  });

  it("strips pause-comma adjacent to standalone operator symbol", () => {
    expect(applySymbols("שפה , / אחד")).toBe("שפה / אחד");
    expect(applySymbols("שפה / , אחד")).toBe("שפה / אחד");
    expect(applySymbols("שפה , / , אחד")).toBe("שפה / אחד");
    expect(applySymbols("רוטשילד , + מדרכה")).toBe("רוטשילד + מדרכה");
    expect(applySymbols("הימיני , - תקני")).toBe("הימיני - תקני");
  });

  it("does not strip comma when symbol is part of compound word", () => {
    expect(applySymbols("אבן-שפה, צד אחד")).toBe("אבן-שפה, צד אחד");
  });

  it("removes unicode replacement char from whisper output", () => {
    expect(applySymbols("לצ�וך")).toBe("לצוך");
    expect(applySymbols("שלום�� עולם")).toBe("שלום עולם");
  });

  it("strips bidi control chars and lets dedupe collapse the resulting commas", () => {
    // U+202B (RLE) between two commas
    expect(applySymbols("כבדים, ‫, אין")).toBe("כבדים, אין");
    // U+200F (RLM) before a word
    expect(applySymbols("שלום ‏עולם")).toBe("שלום עולם");
    // U+200E (LRM)
    expect(applySymbols("א‎ב")).toBe("אב");
  });
});
