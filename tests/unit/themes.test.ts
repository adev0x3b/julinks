import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, getTheme, THEMES, THEME_IDS } from "@/lib/themes";

describe("themes", () => {
  it("has unique ids and the default among them", () => {
    expect(new Set(THEME_IDS).size).toBe(THEMES.length);
    expect(THEME_IDS).toContain(DEFAULT_THEME);
  });
  it("falls back to the first theme for unknown ids", () => {
    expect(getTheme("does-not-exist")).toBe(THEMES[0]);
    expect(getTheme("paper").id).toBe("paper");
  });
});
