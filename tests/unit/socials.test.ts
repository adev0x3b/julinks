import { describe, expect, it } from "vitest";
import { SOCIAL_PLATFORM_IDS, SOCIAL_PLATFORMS } from "@/lib/socials";

describe("social platforms", () => {
  it("turn a handle into the profile URL and keep a full URL", () => {
    expect(SOCIAL_PLATFORMS.instagram.toUrl("@june")).toBe("https://instagram.com/june");
    expect(SOCIAL_PLATFORMS.instagram.toUrl("https://www.instagram.com/june/")).toBe("https://www.instagram.com/june/");
    expect(SOCIAL_PLATFORMS.tiktok.toUrl("june")).toBe("https://www.tiktok.com/@june");
    expect(SOCIAL_PLATFORMS.youtube.toUrl("@channel")).toBe("https://www.youtube.com/@channel");
    expect(SOCIAL_PLATFORMS.github.toUrl("adev0x3b")).toBe("https://github.com/adev0x3b");
    expect(SOCIAL_PLATFORMS.telegram.toUrl("@june")).toBe("https://t.me/june");
  });

  it("handle the platforms with their own address shapes", () => {
    expect(SOCIAL_PLATFORMS.email.toUrl("june@example.com")).toBe("mailto:june@example.com");
    expect(SOCIAL_PLATFORMS.email.toUrl("mailto:june@example.com")).toBe("mailto:june@example.com");
    expect(SOCIAL_PLATFORMS.email.toUrl("not an address")).toBeNull();
    expect(SOCIAL_PLATFORMS.whatsapp.toUrl("+39 333 123 4567")).toBe("https://wa.me/393331234567");
    expect(SOCIAL_PLATFORMS.whatsapp.toUrl("12")).toBeNull();
    expect(SOCIAL_PLATFORMS.mastodon.toUrl("@june@mastodon.social")).toBe("https://mastodon.social/@june");
    expect(SOCIAL_PLATFORMS.mastodon.toUrl("june")).toBeNull();
    expect(SOCIAL_PLATFORMS.bluesky.toUrl("june.bsky.social")).toBe("https://bsky.app/profile/june.bsky.social");
    expect(SOCIAL_PLATFORMS.website.toUrl("example.com/me")).toBe("https://example.com/me");
    expect(SOCIAL_PLATFORMS.website.toUrl("javascript:alert(1)")).toBeNull();
    expect(SOCIAL_PLATFORMS.website.toUrl("nope")).toBeNull();
  });

  it("every platform has a label, a placeholder and an icon path", () => {
    for (const id of SOCIAL_PLATFORM_IDS) {
      const platform = SOCIAL_PLATFORMS[id];
      expect(platform.label.length).toBeGreaterThan(0);
      expect(platform.placeholder.length).toBeGreaterThan(0);
      expect(platform.path).toMatch(/^M/);
    }
  });
});
