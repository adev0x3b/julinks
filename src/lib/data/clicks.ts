import { prisma } from "@/lib/db";

/** Resolves a link for redirecting; disabled links behave like missing ones. */
export async function findRedirectTarget(linkId: string) {
  return prisma.link.findFirst({ where: { id: linkId, enabled: true }, select: { id: true, url: true } });
}

export async function recordClick(linkId: string, referrer: string | null) {
  await prisma.click.create({ data: { linkId, referrer: referrer ? referrer.slice(0, 255) : null } });
}

export type DailyCount = { day: string; count: number };

export type Stats = {
  totalClicks: number;
  clicksLast7Days: number;
  perLink: { id: string; title: string; url: string; enabled: boolean; clicks: number }[];
  daily: DailyCount[];
  topReferrers: { referrer: string; count: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Aggregates clicks for a user's links over the last `days` days (UTC buckets). */
export async function getStats(userId: string, days = 30, now = new Date()): Promise<Stats> {
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [links, totalClicks, clicksLast7Days, rows, referrers] = await Promise.all([
    prisma.link.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      select: { id: true, title: true, url: true, enabled: true, _count: { select: { clicks: true } } },
    }),
    prisma.click.count({ where: { link: { userId } } }),
    prisma.click.count({ where: { link: { userId }, createdAt: { gte: sevenDaysAgo } } }),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', c."createdAt" AT TIME ZONE 'UTC') AS day, COUNT(*)::bigint AS count
      FROM clicks c JOIN links l ON l.id = c."linkId"
      WHERE l."userId" = ${userId} AND c."createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ referrer: string | null; count: bigint }[]>`
      SELECT c.referrer, COUNT(*)::bigint AS count
      FROM clicks c JOIN links l ON l.id = c."linkId"
      WHERE l."userId" = ${userId}
      GROUP BY c.referrer ORDER BY count DESC LIMIT 5`,
  ]);

  const byDay = new Map(rows.map((r) => [toDayKey(r.day), Number(r.count)]));
  const daily: DailyCount[] = [];
  for (let i = 0; i < days; i++) {
    const day = toDayKey(new Date(since.getTime() + i * DAY_MS));
    daily.push({ day, count: byDay.get(day) ?? 0 });
  }

  return {
    totalClicks,
    clicksLast7Days,
    perLink: links.map((l) => ({ id: l.id, title: l.title, url: l.url, enabled: l.enabled, clicks: l._count.clicks })),
    daily,
    topReferrers: referrers.map((r) => ({ referrer: r.referrer ?? "direct", count: Number(r.count) })),
  };
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
