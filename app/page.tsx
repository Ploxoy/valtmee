import Link from "next/link";
import ShareButton from "./components/share-button";
import {
  buildSummary,
  formatShareWeather,
  formatShortDate,
  getFileStatus,
  getMetrics,
  getSpoorStatus,
  getWeatherStatus,
  parseSpoor,
  parseWeather,
  toMetric,
  type Metric,
} from "./lib/metrics";

export const dynamic = "force-dynamic";

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
      {children}
    </span>
  );
}

function DetailHint() {
  return (
    <span className="absolute right-6 top-6 text-sm text-neutral-600 transition group-hover:text-neutral-400">
      meer
    </span>
  );
}

function CardShell({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative block rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 min-h-72 shadow-2xl shadow-black/30 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      <DetailHint />
      {children}
    </Link>
  );
}

function FuelCard({ item }: { item: Metric }) {
  const dateMatch = item.note.match(/\d{4}-\d{2}-\d{2}/);
  const date = dateMatch ? formatShortDate(dateMatch[0]) : "laatst bekend";

  return (
    <CardShell href={item.href}>
      <StatusBadge>duur</StatusBadge>

      <div className="mt-5 text-5xl font-black tracking-tight leading-tight">
        {item.value}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">benzine</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>Euro95 · pompprijs</div>
        <div>CBS · laatst bekend</div>
        <div>{date}</div>
      </div>
    </CardShell>
  );
}

function TrafficCard({ item }: { item: Metric }) {
  const status = getFileStatus(item.value);

  return (
    <CardShell href={item.href}>
      <StatusBadge>{status}</StatusBadge>

      <div className="mt-5 text-5xl font-black tracking-tight leading-tight">
        {item.value}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">file</div>

      <div className="mt-2 text-sm leading-6 text-neutral-500">
        {item.note}
      </div>
    </CardShell>
  );
}

function WeatherCard({ item }: { item: Metric }) {
  const weather = parseWeather(item.value);
  const status = getWeatherStatus(item.note);

  return (
    <CardShell href={item.href}>
      <StatusBadge>{status}</StatusBadge>

      <div className="mt-5 text-5xl font-black tracking-tight leading-tight">
        {weather.temperature}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">weer</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>wind {weather.wind}</div>
        <div>{item.note}</div>
      </div>
    </CardShell>
  );
}

function SpoorCard({ item }: { item: Metric }) {
  const { isKnown, storingen, werkzaamheden } = parseSpoor(item.value);
  const status = getSpoorStatus(storingen, isKnown);

  return (
    <CardShell href={item.href}>
      <StatusBadge>{status}</StatusBadge>

      <div className="mt-5 text-5xl font-black tracking-tight leading-tight">
        {storingen}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">storingen</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>actieve meldingen · NS</div>
        <div>{werkzaamheden} werkzaamheden</div>
      </div>
    </CardShell>
  );
}

export default async function Home() {
  const data = await getMetrics();

  const fuel = toMetric(data.benzine, "/benzine");
  const traffic = toMetric(data.file, "/file");
  const weather = toMetric(data.weer, "/weer");
  const spoor = toMetric(data.storingen, "/spoor");

  const { isKnown: spoorKnown, storingen } = parseSpoor(spoor.value);

  const summary = buildSummary({
    fileValue: traffic.value,
    spoorKnown,
    weatherNote: weather.note,
    storingen,
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.45))]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
        <header className="mb-14">
          <p className="text-sm uppercase tracking-[0.45em] text-neutral-500">
            de stand van vandaag
          </p>

          <h1 className="mt-5 text-7xl font-black tracking-tight text-neutral-50 md:text-9xl">
            Valt mee.
          </h1>

          <p className="mt-5 max-w-2xl text-lg text-neutral-500">
            {summary}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <FuelCard item={fuel} />
          <TrafficCard item={traffic} />
          <SpoorCard item={spoor} />
          <WeatherCard item={weather} />
        </div>

        <footer className="mt-12 flex flex-col gap-2 text-sm text-neutral-600">
          <div className="flex flex-col gap-2">
            <span>{data.sources.join(" · ")}</span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>experimenteel · automatisch samengevat · klik op een kaart voor meer ·</span>
              <ShareButton
                summary={summary}
                fuel={fuel.value}
                traffic={traffic.value}
                weather={formatShareWeather(weather.value, weather.note)}
                trains={spoor.value}
              />
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}
