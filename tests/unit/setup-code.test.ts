import { describe, expect, it } from "vitest";
import { generateSetupCode, isWellFormedSetupCode, normalizeSetupCode, setupBanner } from "@/lib/setup-code";

describe("setup code", () => {
  it("is three groups of four symbols from an alphabet without 0/O and 1/I", () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateSetupCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01IO]/);
      expect(isWellFormedSetupCode(code)).toBe(true);
    }
  });

  it("is different every time", () => {
    const codes = new Set(Array.from({ length: 20 }, generateSetupCode));
    expect(codes.size).toBe(20);
  });

  it("accepts what a person types: lower case, spaces, missing or extra dashes", () => {
    expect(normalizeSetupCode("abcd-efgh-jklm")).toBe("ABCD-EFGH-JKLM");
    expect(normalizeSetupCode(" abcdefghjklm ")).toBe("ABCD-EFGH-JKLM");
    expect(normalizeSetupCode("ABCD EFGH JKLM")).toBe("ABCD-EFGH-JKLM");
    expect(normalizeSetupCode("ab-cd-ef-gh-jk-lm")).toBe("ABCD-EFGH-JKLM");
    expect(isWellFormedSetupCode(normalizeSetupCode("abcd-efgh-jklm"))).toBe(true);
    expect(isWellFormedSetupCode(normalizeSetupCode("abcd-efgh"))).toBe(false);
    expect(isWellFormedSetupCode("ABCD-EFGH-JKL0")).toBe(false);
  });

  it("prints the code and the way to get a new one", () => {
    const banner = setupBanner("ABCD-EFGH-JKLM", "https://links.example.com");
    expect(banner).toContain("ABCD-EFGH-JKLM");
    expect(banner).toContain("https://links.example.com/setup");
    expect(banner).toContain("docker compose run --rm --no-deps migrate npm run setup-code");
  });
});
