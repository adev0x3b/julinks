import { DailyClicksChart } from "@/components/DailyClicksChart";
import { getStats } from "@/lib/data/clicks";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Stats" };

export default async function StatsPage() {
  const user = await requireUser();
  const stats = await getStats(user.id, 30);
  const topLinks = [...stats.perLink].sort((a, b) => b.clicks - a.clicks);
  const max = Math.max(1, ...topLinks.map((l) => l.clicks));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total clicks" value={stats.totalClicks} />
        <Stat label="Last 7 days" value={stats.clicksLast7Days} />
        <Stat label="Active links" value={stats.perLink.filter((l) => l.enabled).length} />
      </div>

      <section className="card">
        <h2 className="text-base font-semibold">Clicks per day</h2>
        <p className="mb-4 text-sm text-stone-500">Last 30 days, UTC.</p>
        <DailyClicksChart data={stats.daily} />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="card">
          <h2 className="mb-4 text-base font-semibold">Clicks per link</h2>
          {topLinks.length === 0 ? (
            <p className="text-sm text-stone-500">No links yet.</p>
          ) : (
            <ul className="flex flex-col gap-3" data-testid="clicks-per-link">
              {topLinks.map((link) => (
                <li key={link.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                    <span className={`truncate font-medium ${link.enabled ? "" : "text-stone-400"}`}>{link.title}</span>
                    <span className="shrink-0 tabular-nums text-stone-600" data-testid="link-clicks">
                      {link.clicks}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(link.clicks / max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h2 className="mb-4 text-base font-semibold">Top referrers</h2>
          {stats.topReferrers.length === 0 ? (
            <p className="text-sm text-stone-500">No clicks yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {stats.topReferrers.map((r) => (
                <li key={r.referrer} className="flex justify-between gap-4">
                  <span className="truncate">{r.referrer}</span>
                  <span className="tabular-nums text-stone-600">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card py-5">
      <p className="label">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
