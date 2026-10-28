import { describe, expect, it } from "vitest";
import { imageFocusSchema, linkImageSchema } from "@/lib/validation";
import { bioSchema, decisionSchema, fieldErrors, folderSchema, linkSchema, socialsSchema, linkUrlSchema, signupSchema, themeSchema, themeTokensSchema, usernameSchema } from "@/lib/validation";

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

  it.each(["login", "dashboard", "api", "Signup", "forgot-password", "reset-password"])("rejects reserved route name %s", (value) => {
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
    const parsed = signupSchema.parse({ username: "Ada", email: " ADA@Example.com ", password: "12345678" });
    expect(parsed).toEqual({ username: "ada", email: "ada@example.com", password: "12345678" });
  });

  it("rejects short passwords", () => {
    expect(signupSchema.safeParse({ username: "ada", email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("bioSchema", () => {
  it("keeps single line breaks, trims each line and collapses blank runs", () => {
    expect(bioSchema.parse("Libri e articoli  \r\n\r\n\n✨ 🏳️‍⚧️ 🎨\n")).toBe("Libri e articoli\n✨ 🏳️‍⚧️ 🎨");
  });

  it("caps the number of lines and the length", () => {
    expect(bioSchema.safeParse("1\n2\n3\n4\n5\n6").success).toBe(true);
    expect(bioSchema.safeParse("1\n2\n3\n4\n5\n6\n7").success).toBe(false);
    expect(bioSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});

describe("socialsSchema", () => {
  it("builds the URL for each row and reports bad rows by index", () => {
    const parsed = socialsSchema.parse([
      { platform: "instagram", value: " @june " },
      { platform: "email", value: "june@example.com" },
    ]);
    expect(parsed).toEqual([
      { platform: "instagram", value: "@june", url: "https://instagram.com/june" },
      { platform: "email", value: "june@example.com", url: "mailto:june@example.com" },
    ]);
    const bad = socialsSchema.safeParse([{ platform: "instagram", value: "ok" }, { platform: "email", value: "nope" }]);
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues[0].path).toEqual([1, "value"]);
    expect(socialsSchema.safeParse([{ platform: "myspace", value: "x" }]).success).toBe(false);
  });
});

describe("folderSchema", () => {
  it("needs a short name", () => {
    expect(folderSchema.parse({ title: "  Articoli " })).toEqual({ title: "Articoli" });
    expect(folderSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(folderSchema.safeParse({ title: "x".repeat(41) }).success).toBe(false);
  });
});

describe("decisionSchema", () => {
  it("accepts an approval with a known role and a plain denial", () => {
    expect(decisionSchema.parse({ status: "approved", role: "moderator" })).toEqual({ status: "approved", role: "moderator" });
    expect(decisionSchema.parse({ status: "denied" })).toEqual({ status: "denied" });
  });

  it("rejects unknown roles, approvals without a role and other statuses", () => {
    expect(decisionSchema.safeParse({ status: "approved", role: "owner" }).success).toBe(false);
    expect(decisionSchema.safeParse({ status: "approved" }).success).toBe(false);
    expect(decisionSchema.safeParse({ status: "pending" }).success).toBe(false);
  });
});

describe("themeTokensSchema", () => {
  const valid = {
    background: "#0F172A",
    backgroundEnd: null,
    text: "#f8fafc",
    muted: "#a5b4fc",
    button: "#ffffff",
    buttonText: "#f8fafc",
    buttonStyle: "glass",
    radius: "pill",
    font: "sans",
    overlay: "30",
  };

  it("lowercases colours and coerces the overlay", () => {
    const parsed = themeTokensSchema.parse(valid);
    expect(parsed.background).toBe("#0f172a");
    expect(parsed.overlay).toBe(30);
  });

  it.each([
    ["a non-hex colour", { ...valid, text: "red" }],
    ["a short hex colour", { ...valid, text: "#fff" }],
    ["an 8-digit colour", { ...valid, button: "#ffffff80" }],
    ["an unknown button style", { ...valid, buttonStyle: "neon" }],
    ["an overlay out of range", { ...valid, overlay: 95 }],
    ["an unknown key (no CSS smuggling)", { ...valid, extra: "url(evil)" }],
  ])("rejects %s", (_label, value) => {
    expect(themeTokensSchema.safeParse(value).success).toBe(false);
  });

  it("requires a theme name of at most 40 characters", () => {
    expect(themeSchema.safeParse({ name: "", tokens: valid }).success).toBe(false);
    expect(themeSchema.safeParse({ name: "x".repeat(41), tokens: valid }).success).toBe(false);
    expect(themeSchema.safeParse({ name: "  Mine  ", tokens: valid }).data?.name).toBe("Mine");
  });
});

describe("reserved usernames", () => {
  it.each(["img", "themes", "uploads"])("keeps %s for app routes", (value) => {
    expect(usernameSchema.safeParse(value).success).toBe(false);
  });
});

describe("link picture settings", () => {
  it("accepts a layout with a focal point in percent", () => {
    expect(linkImageSchema.parse({ layout: "featured", focus: { x: "30", y: 70 } })).toEqual({ layout: "featured", focus: { x: 30, y: 70 } });
  });

  it("rejects unknown layouts and points outside the picture", () => {
    expect(linkImageSchema.safeParse({ layout: "huge", focus: { x: 50, y: 50 } }).success).toBe(false);
    expect(imageFocusSchema.safeParse({ x: 101, y: 50 }).success).toBe(false);
    expect(imageFocusSchema.safeParse({ x: 10.5, y: 50 }).success).toBe(false);
    expect(imageFocusSchema.safeParse({ x: -1, y: 50 }).success).toBe(false);
  });
});
