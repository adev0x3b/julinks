import { describe, expect, it } from "vitest";
import { DEFAULT_PRESET, getPreset, luminance, pageBackground, PRESETS, themeStyle, withAlpha } from "@/lib/themes";
import { themeTokensSchema } from "@/lib/validation";

describe("presets", () => {
  it("have unique ids, the default among them, and tokens that pass the schema", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(PRESETS).toContain(DEFAULT_PRESET);
    for (const preset of PRESETS) {
      expect(themeTokensSchema.safeParse(preset.tokens).success, preset.id).toBe(true);
    }
    expect(getPreset("nope")).toBeUndefined();
    expect(getPreset("paper")?.name).toBe("Paper");
  });
});

describe("themeStyle", () => {
  it("turns tokens into custom properties, flat or gradient", () => {
    const flat = themeStyle({ ...DEFAULT_PRESET.tokens, backgroundEnd: null });
    expect(flat["--jl-bg"]).toBe(DEFAULT_PRESET.tokens.background);
    const gradient = themeStyle(DEFAULT_PRESET.tokens);
    expect(gradient["--jl-bg"]).toBe(pageBackground(DEFAULT_PRESET.tokens));
    expect(gradient["--jl-bg"]).toContain("linear-gradient(160deg");
    expect(gradient["--jl-radius"]).toBe("9999px");
    expect(gradient["--jl-font"]).toContain("system-ui");
  });

  it("layers the overlay and the image over the background when an image is set", () => {
    const style = themeStyle({ ...DEFAULT_PRESET.tokens, overlay: 50 }, "/img/backgrounds/u/abc.webp");
    expect(style["--jl-bg"]).toBe(
      'linear-gradient(#00000080, #00000080), url("/img/backgrounds/u/abc.webp") center / cover no-repeat, ' + pageBackground(DEFAULT_PRESET.tokens),
    );
  });

  it("maps shadows: soft for themes saved before the option, none, or a 3D outline with a hard shadow", () => {
    const tokens = { ...DEFAULT_PRESET.tokens, buttonStyle: "solid" as const };
    const old = themeStyle(tokens);
    expect(old["--jl-btn-shadow"]).toBe("0 1px 2px rgba(0,0,0,0.12)");
    expect(old["--jl-btn-border-width"]).toBe("1px");
    expect(themeStyle({ ...tokens, shadow: "flat" })["--jl-btn-shadow"]).toBe("none");
    const hard = themeStyle({ ...tokens, shadow: "hard" });
    expect(hard["--jl-btn-shadow"]).toBe("4px 4px 0 #111111");
    expect(hard["--jl-btn-border"]).toBe("#111111");
    expect(hard["--jl-btn-border-width"]).toBe("2px");
    expect(themeTokensSchema.parse({ ...tokens, shadow: undefined }).shadow).toBe("soft");
    expect(themeTokensSchema.safeParse({ ...tokens, shadow: "huge" }).success).toBe(false);
  });

  it("maps button styles", () => {
    const tokens = { ...DEFAULT_PRESET.tokens, button: "#ff0000" };
    expect(themeStyle({ ...tokens, buttonStyle: "solid" })["--jl-btn-bg"]).toBe("#ff0000");
    expect(themeStyle({ ...tokens, buttonStyle: "outline" })["--jl-btn-bg"]).toBe("transparent");
    expect(themeStyle({ ...tokens, buttonStyle: "outline" })["--jl-btn-border"]).toBe("#ff0000");
    expect(themeStyle({ ...tokens, buttonStyle: "glass" })["--jl-btn-bg"]).toBe("#ff00001f");
  });
});

describe("colour helpers", () => {
  it("appends alpha as two hex digits, clamped", () => {
    expect(withAlpha("#ffffff", 0)).toBe("#ffffff00");
    expect(withAlpha("#ffffff", 1)).toBe("#ffffffff");
    expect(withAlpha("#ffffff", 2)).toBe("#ffffffff");
    expect(withAlpha("#000000", 0.5)).toBe("#00000080");
  });
  it("measures luminance", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
    expect(luminance("#ff0000")).toBeLessThan(luminance("#00ff00"));
  });
});
