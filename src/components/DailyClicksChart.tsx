import type { DailyCount } from "@/lib/data/clicks";

/** Server-rendered SVG bar chart: no client JavaScript, scales with its container. */
export function DailyClicksChart({ data }: { data: DailyCount[] }) {
  const width = 720;
  const height = 180;
  const padLeft = 32;
  const padBottom = 24;
  const padTop = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = width - padLeft - 8;
  const innerH = height - padBottom - padTop;
  const slot = innerW / data.length;
  const barW = Math.max(2, slot * 0.7);
  const ticks = [0, Math.ceil(max / 2), max];
  const last = data.length - 1;
  // A label every week plus the last day, unless the last day would overlap the previous label.
  const labelled = (i: number) => i % 7 === 0 || (i === last && last % 7 >= 3);

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-labelledby="daily-title">
        <title id="daily-title">Clicks per day over the last {data.length} days</title>
        {ticks.map((t) => {
          const y = padTop + innerH - (t / max) * innerH;
          return (
            <g key={t}>
              <line x1={padLeft} x2={width - 8} y1={y} y2={y} stroke="#e7e5e4" strokeDasharray={t === 0 ? undefined : "3 3"} />
              <text x={padLeft - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#78716c">
                {t}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const h = (d.count / max) * innerH;
          const x = padLeft + i * slot + (slot - barW) / 2;
          const y = padTop + innerH - h;
          const showLabel = labelled(i);
          return (
            <g key={d.day}>
              <rect x={x} y={y} width={barW} height={h} rx={2} fill="#6366f1">
                <title>
                  {d.day}: {d.count}
                </title>
              </rect>
              {showLabel && (
                <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#78716c">
                  {d.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        {data.map((d) => `${d.day}: ${d.count}`).join(", ")}
      </figcaption>
    </figure>
  );
}
