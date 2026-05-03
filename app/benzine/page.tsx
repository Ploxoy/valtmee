import DetailShell from "../components/detail-shell";
import {
  formatDateWithYear,
  getMetrics,
  metricSources,
  type SparkPoint,
} from "../lib/metrics";

export const dynamic = "force-dynamic";

function FuelChart({ points }: { points: SparkPoint[] }) {
  const chartPoints = points.slice(-365);

  if (chartPoints.length < 2) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-sm text-neutral-500">
        Geen grafiek beschikbaar.
      </div>
    );
  }

  const width = 720;
  const height = 240;
  const padding = 18;
  const values = chartPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = chartPoints
    .map((point, index) => {
      const x =
        padding + (index / (chartPoints.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.value - min) / range) * (height - padding * 2);

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const first = chartPoints[0];
  const last = chartPoints[chartPoints.length - 1];

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible"
        role="img"
        aria-label="Benzineprijs trend"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
          className="text-neutral-300"
        />
      </svg>
      <div className="mt-4 flex justify-between text-xs text-neutral-500">
        <span>{formatDateWithYear(first.date)}</span>
        <span>
          min €{min.toFixed(2).replace(".", ",")} · max €
          {max.toFixed(2).replace(".", ",")}
        </span>
        <span>{formatDateWithYear(last.date)}</span>
      </div>
    </div>
  );
}

export default async function BenzinePage() {
  const data = await getMetrics();
  const fuel = data.benzine;
  const dateMatch = fuel.note.match(/\d{4}-\d{2}-\d{2}/);
  const date = dateMatch ? formatDateWithYear(dateMatch[0]) : "laatst bekend";

  return (
    <DetailShell
      title="Benzine"
      kicker="euro95 pompprijs"
      sourceHref={metricSources.fuel}
    >
      <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="text-6xl font-black tracking-tight">{fuel.value}</div>
          <div className="mt-5 text-xl text-neutral-300">
            laatst bekende pompprijs
          </div>
          <div className="mt-4 space-y-1 text-sm text-neutral-500">
            <div>CBS · laatst bekend</div>
            <div>{date}</div>
            {fuel.trend && <div>{fuel.trend}</div>}
          </div>
        </section>

        <FuelChart points={fuel.history} />
      </div>
    </DetailShell>
  );
}
