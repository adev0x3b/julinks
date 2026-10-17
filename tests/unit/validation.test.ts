import { describe, expect, it } from "vitest";
import { fieldErrors, linkSchema, linkUrlSchema, signupSchema, usernameSchema } from "@/lib/validation";

describe("usernameSchema", () => {
  it.each(["ada", "ada_lovelace", "ada-99", "A1b"])("accepts %s", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(true);
  });

  it("lowercases and trims", () => {
    expect(usernameSchema.parse("  AdaLovelace ")).toBe("adalovelace");
  });

  it.each(["ab", "-ada", "ada-", "ada lovelace", "ada.l", "a".repeat(31), "🙂🙂🙂"])("rejects %s", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });

  it.each(["login", "dashboard", "api", "Signup"])("rejects reserved route name %s", (value) => {
    const result = usernameSchema.safeParse(value);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toMatch(/reserved/);
  });
});

describe("linkUrlSchema", () => {
  it("adds https:// when the scheme is missing", () => {
    expect(linkUrlSchema.parse("example.com/page")).toBe("https://example.com/page");
  });

  it("keeps http and https", () => {
    expect(linkUrlSchema.parse("http://example.com")).toBe("http://example.com");
    expect(linkUrlSchema.parse("https://example.com/a?b=c")).toBe("https://example.com/a?b=c");
  });

  it.each(["javascript:alert(1)", "data:text/html,hi", "file:///etc/passwd", "ftp://host", "https://", "not a url"])(
    "rejects %s",
    (value) => {
      expect(linkUrlSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("linkSchema and fieldErrors", () => {
  it("reports one message per field", () => {
    const result = linkSchema.safeParse({ title: "", url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(errors.title).toMatch(/required/);
      expect(errors.url).toMatch(/valid/);
    }
  });
});

describe("signupSchema", () => {
  it("normalises email and username", () => {
    const parsed = signupSchema.parse({ username: "Ada", email: " ADA@Example.com ", password: "12345678", displayName: " Ada " });
    expect(parsed).toMatchObject({ username: "ada", email: "ada@example.com", displayName: "Ada" });
  });

  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ username: "ada", email: "a@b.co", password: "short", displayName: "Ada" }).success).toBe(false);
  });
});
