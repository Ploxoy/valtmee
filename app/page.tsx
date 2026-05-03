type SparkPoint = {
  date: string;
  value: number;
};

type Metric = {
  value: string;
  note: string;
  href: string;
  history?: SparkPoint[];
};

type MetricPayload = {
  value: string;
  note: string;
  history: SparkPoint[];
};

type MetricsResponse = {
  benzine: MetricPayload;
  file: MetricPayload;
  weer: MetricPayload;
  storingen: MetricPayload;
  sources: string[];
};

function getBaseUrl() {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  return "http://localhost:3000";
}

async function getMetrics() {
  try {
    const res = await fetch("/api/metrics", {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Metrics fetch failed:", res.status, res.statusText);
      return fallbackMetrics();
    }

    return res.json();
  } catch (error) {
    console.error("Metrics fetch crashed:", error);
    return fallbackMetrics();
  }
}

function fallbackMetrics() {
  return {
    benzine: { value: "—", note: "niet beschikbaar", history: [] },
    file: { value: "—", note: "niet beschikbaar", history: [] },
    weer: { value: "—", note: "niet beschikbaar", history: [] },
    storingen: { value: "— / —", note: "niet beschikbaar", history: [] },
    sources: ["CBS", "Open-Meteo", "NDW", "NS"],
  };
}

function toMetric(payload: MetricPayload, href: string): Metric {
  return {
    value: payload.value,
    note: payload.note,
    history: payload.history,
    href,
  };
}

function Sparkline({ points }: { points: SparkPoint[] }) {
  if (!points || points.length < 2) return null;

  const width = 220;
  const height = 52;
  const padding = 4;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const path = points
    .map((point, index) => {
      const x =
        padding + (index / (points.length - 1)) * (width - padding * 2);

      const y =
        height -
        padding -
        ((point.value - min) / range) * (height - padding * 2);

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-7 h-14 w-full overflow-visible opacity-80"
      role="img"
      aria-label="trend"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-neutral-500"
      />
    </svg>
  );
}

function StatusBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
      {children}
    </span>
  );
}

function ExternalHint() {
  return (
    <span className="absolute right-6 top-6 text-sm text-neutral-600 transition group-hover:text-neutral-400">
      ↗
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
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 min-h-72 shadow-2xl shadow-black/30 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/30"
    >
      <ExternalHint />
      {children}
    </a>
  );
}

function getFileStatus(fileValue: string) {
  const km = Number.parseInt(fileValue, 10);

  if (!Number.isFinite(km) || km === 0) return "rustig";
  if (km < 50) return "valt mee";
  if (km < 150) return "druk";
  return "chaos";
}

function getWeatherStatus(weatherNote: string) {
  const note = weatherNote.toLowerCase();

  if (note.includes("regen")) return "nat";
  if (note.includes("droog")) return "droog";
  return "weer";
}

function getSpoorStatus(storingen: number) {
  if (storingen === 0) return "rustig";
  if (storingen <= 3) return "valt mee";
  if (storingen <= 10) return "onrustig";
  return "chaos";
}

function parseWeather(value: string) {
  const [tempRaw, windRaw] = value.split("/");
  return {
    temperature: tempRaw?.trim() || value,
    wind: windRaw?.trim() || "—",
  };
}

function parseSpoor(value: string) {
  const [storingenRaw, werkzaamhedenRaw] = String(value).split("/");

  const storingen = Number.parseInt(storingenRaw?.trim() || "0", 10);
  const werkzaamheden = Number.parseInt(werkzaamhedenRaw?.trim() || "0", 10);

  return {
    storingen: Number.isFinite(storingen) ? storingen : 0,
    werkzaamheden: Number.isFinite(werkzaamheden) ? werkzaamheden : 0,
  };
}

function buildSummary({
  fileValue,
  weatherNote,
  storingen,
}: {
  fileValue: string;
  weatherNote: string;
  storingen: number;
}) {
  const fileStatus = getFileStatus(fileValue);
  const weatherStatus = getWeatherStatus(weatherNote);
  const spoorStatus = getSpoorStatus(storingen);

  const road =
    fileStatus === "rustig"
      ? "rustig op de weg"
      : fileStatus === "valt mee"
        ? "beperkte files"
        : fileStatus === "druk"
          ? "druk op de weg"
          : "veel files";

  const weather =
    weatherStatus === "nat"
      ? "nat weer"
      : weatherStatus === "droog"
        ? "droog weer"
        : "gewoon weer";

  const spoor =
    spoorStatus === "rustig"
      ? "weinig spoorstoringen"
      : spoorStatus === "valt mee"
        ? "enkele spoorstoringen"
        : spoorStatus === "onrustig"
          ? "onrustig op het spoor"
          : "veel spoorproblemen";

  return `Vandaag: ${road}, ${spoor}, ${weather}.`;
}

function FuelCard({ item }: { item: Metric }) {
  const dateMatch = item.note.match(/\d{4}-\d{2}-\d{2}/);
  const date = dateMatch ? dateMatch[0] : "laatst bekend";

  return (
    <CardShell href={item.href}>
      <StatusBadge>duur</StatusBadge>

      <div className="mt-5 text-5xl font-black tracking-tight leading-tight">
        {item.value}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">benzine</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>Euro95 · pompprijs</div>
        <div>CBS · laatst bekend · {date}</div>
      </div>

      <Sparkline points={item.history ?? []} />
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
  const { storingen, werkzaamheden } = parseSpoor(item.value);
  const status = getSpoorStatus(storingen);

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

  const fuel = toMetric(data.benzine, "https://www.cbs.nl/nl-nl/cijfers/detail/80416ned");
  const traffic = toMetric(data.file, "https://file.ndw.nu/");
  const weather = toMetric(data.weer, "https://open-meteo.com/en/docs");
  const spoor = toMetric(
    data.storingen,
    "https://www.ns.nl/reisinformatie/actuele-situatie-op-het-spoor/"
  );

  const { storingen } = parseSpoor(spoor.value);

  const summary = buildSummary({
    fileValue: traffic.value,
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
            Nederland in cijfers
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
          <WeatherCard item={weather} />
          <SpoorCard item={spoor} />
        </div>

        <footer className="mt-12 flex flex-col gap-2 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{data.sources.join(" · ")}</span>
          <span>experimenteel · klik op een kaart voor de bron</span>
        </footer>
      </section>
    </main>
  );
}
