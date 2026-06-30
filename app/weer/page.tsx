import DetailShell from "../components/detail-shell";
import LocalForecast from "../components/local-forecast";
import { SourceName } from "../components/source-status";
import {
  getMetrics,
  getWeatherStatus,
  metricSources,
  parseWeather,
} from "../lib/metrics";

export const dynamic = "force-dynamic";

export default async function WeerPage() {
  const data = await getMetrics();
  const weather = data.weer;
  const parsed = parseWeather(weather.value);
  const status = getWeatherStatus(weather.note);

  return (
    <DetailShell title="Weer" kicker="rotterdam nu" sourceHref={metricSources.weather}>
      <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            {status}
          </div>
          <div className="mt-5 text-6xl font-black tracking-tight">
            {parsed.temperature}
          </div>
          <div className="mt-5 text-xl text-neutral-300">actueel weer</div>
          <div className="mt-4 space-y-1 text-sm text-neutral-500">
            <div>wind {parsed.wind}</div>
            <div>{weather.note}</div>
            <div>
              bron{" "}
              <SourceName status={weather.sourceStatus}>Open-Meteo</SourceName>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <LocalForecast />
        </section>
      </div>
    </DetailShell>
  );
}
