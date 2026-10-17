import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findRedirectTarget, getStats, recordClick } from "@/lib/data/clicks";
import { createLink, updateLink } from "@/lib/data/links";
import { makeUser } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

describe("clicks", () => {
  it("resolves only enabled links for redirecting", async () => {
    const user = await makeUser();
    const link = await createLink(user.id, { title: "A", url: "https://a.example" });
    expect(await findRedirectTarget(link.id)).toEqual({ id: link.id, url: "https://a.example" });
    await updateLink(user.id, link.id, { enabled: false });
    expect(await findRedirectTarget(link.id)).toBeNull();
    expect(await findRedirectTarget("missing")).toBeNull();
  });

  it("aggregates totals, daily buckets and referrers per owner", async () => {
    const now = new Date("2026-10-17T12:00:00Z");
    const user = await makeUser();
    const other = await makeUser();
    const a = await createLink(user.id, { title: "A", url: "https://a.example" });
    const b = await createLink(user.id, { title: "B", url: "https://b.example" });
    const theirs = await createLink(other.id, { title: "Theirs", url: "https://c.example" });

    await recordClick(a.id, "twitter.com");
    await recordClick(a.id, "twitter.com");
    await recordClick(b.id, null);
    await recordClick(theirs.id, "github.com");
    // Backdate one click by 10 days and one by 40 days (outside the 30-day window).
    const clicks = await prisma.click.findMany({ where: { linkId: a.id }, orderBy: { createdAt: "asc" } });
    await prisma.click.update({ where: { id: clicks[0].id }, data: { createdAt: new Date(now.getTime() - 10 * DAY) } });
    await prisma.click.create({ data: { linkId: b.id, createdAt: new Date(now.getTime() - 40 * DAY) } });
    await prisma.click.updateMany({ where: { createdAt: { gt: now } }, data: { createdAt: now } });

    const stats = await getStats(user.id, 30, now);
    expect(stats.totalClicks).toBe(4);
    expect(stats.clicksLast7Days).toBe(2);
    expect(stats.perLink.map((l) => [l.title, l.clicks])).toEqual([
      ["A", 2],
      ["B", 2],
    ]);
    expect(stats.daily).toHaveLength(30);
    expect(stats.daily.at(-1)).toEqual({ day: "2026-10-17", count: 2 });
    expect(stats.daily.find((d) => d.day === "2026-10-07")).toEqual({ day: "2026-10-07", count: 1 });
    expect(stats.daily.reduce((sum, d) => sum + d.count, 0)).toBe(3);
    expect(stats.topReferrers).toEqual([
      { referrer: "twitter.com", count: 2 },
      { referrer: "direct", count: 2 },
    ]);
  });
});
