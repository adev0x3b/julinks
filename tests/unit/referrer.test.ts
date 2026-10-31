import { describe, expect, it } from "vitest";
import { clickSource, referrerHost, sourceName } from "@/lib/referrer";

describe("referrerHost", () => {
  it("keeps only the host", () => {
    expect(referrerHost("https://twitter.com/ada/status/1?x=1")).toBe("twitter.com");
  });
  it("returns null for missing or broken values", () => {
    expect(referrerHost(null)).toBeNull();
    expect(referrerHost("not a url")).toBeNull();
  });
});

describe("sourceName", () => {
  it("names mobile sites and link redirectors after the site", () => {
    expect(sourceName("www.instagram.com")).toBe("instagram.com");
    expect(sourceName("l.instagram.com")).toBe("instagram.com");
    expect(sourceName("lm.facebook.com")).toBe("facebook.com");
    expect(sourceName("M.YouTube.com")).toBe("youtube.com");
  });
  it("keeps a host whose only dot is the prefix's", () => {
    expect(sourceName("m.example")).toBe("m.example");
    expect(sourceName("localhost:3000")).toBe("localhost:3000");
  });
  it("refuses anything that is not a host name", () => {
    for (const bad of ["", "insta gram.com", "evil.com/path", "<b>x</b>", "a".repeat(254), "-bad.com", "x.com:"]) {
      expect(sourceName(bad)).toBeNull();
    }
  });
});

describe("clickSource", () => {
  const ownHosts = ["links.example.com", "links.example.com"];

  it("prefers the site the page passed along", () => {
    expect(clickSource({ from: "l.instagram.com", referer: "https://links.example.com/ada", ownHosts })).toBe("instagram.com");
  });
  it("falls back to the Referer when a /l/ link was shared elsewhere directly", () => {
    expect(clickSource({ from: null, referer: "https://news.ycombinator.com/item?id=1", ownHosts })).toBe("news.ycombinator.com");
  });
  it("never counts this site, or junk, as a source", () => {
    expect(clickSource({ from: null, referer: "https://links.example.com/ada", ownHosts })).toBeNull();
    expect(clickSource({ from: "links.example.com", referer: null, ownHosts })).toBeNull();
    expect(clickSource({ from: "not a host!", referer: "https://links.example.com/ada", ownHosts })).toBeNull();
    expect(clickSource({ from: null, referer: null, ownHosts })).toBeNull();
  });
});
