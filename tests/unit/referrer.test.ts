import { describe, expect, it } from "vitest";
import { referrerHost } from "@/lib/referrer";

describe("referrerHost", () => {
  it("keeps only the host", () => {
    expect(referrerHost("https://twitter.com/ada/status/1?x=1")).toBe("twitter.com");
  });
  it("returns null for missing or broken values", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });
});
