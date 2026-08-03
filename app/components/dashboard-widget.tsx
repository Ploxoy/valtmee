"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import ShareButton from "./share-button";
import { SourceAwareNote, SourceName } from "./source-status";
import {
  buildSummary,
  fallbackMetrics,
  formatShareWeather,
  formatShortDate,
  getFileStatus,
  getSpoorStatus,
  getWeatherStatus,
  parseSpoor,
  parseWeather,
  toMetric,
  type Metric,
  type MetricsResponse,
} from "../lib/metrics-shared";

const refreshIntervalMs = 60_000;

function formatRefreshTime(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(date);
}

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
      className="group relative block min-h-72 rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-white/30"
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

      <div className="mt-5 text-5xl font-black leading-tight tracking-tight">
        {item.value}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">benzine</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>Euro95 · pompprijs</div>
        <div>
          <SourceName status={item.sourceStatus}>CBS</SourceName> · laatst
          bekend
        </div>
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

      <div className="mt-5 text-5xl font-black leading-tight tracking-tight">
        {item.value}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">file</div>

      <div className="mt-2 text-sm leading-6 text-neutral-500">
        <SourceAwareNote
          note={item.note}
          source="NDW"
          status={item.sourceStatus}
        />
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

      <div className="mt-5 text-5xl font-black leading-tight tracking-tight">
        {weather.temperature}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">weer</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>wind {weather.wind}</div>
        <div>{item.note}</div>
        <div>
          bron{" "}
          <SourceName status={item.sourceStatus}>Open-Meteo</SourceName>
        </div>
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

      <div className="mt-5 text-5xl font-black leading-tight tracking-tight">
        {storingen}
      </div>

      <div className="mt-6 text-2xl text-neutral-200">storingen</div>

      <div className="mt-2 space-y-1 text-sm leading-6 text-neutral-500">
        <div>
          actieve meldingen ·{" "}
          <SourceName status={item.sourceStatus}>NS</SourceName>
        </div>
        <div>{werkzaamheden} werkzaamheden</div>
      </div>
    </CardShell>
  );
}

export default function DashboardWidget({
  initialData,
}: {
  initialData: MetricsResponse;
}) {
  const [data, setData] = useState(initialData);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(() => new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const inFlightRef = useRef<AbortController | null>(null);

  const refreshMetrics = useCallback(async () => {
    if (inFlightRef.current) return;

    const controller = new AbortController();
    inFlightRef.current = controller;
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/metrics?ts=${Date.now()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Metrics refresh failed: ${res.status}`);
      }

      const nextData = (await res.json()) as MetricsResponse;
      setData(nextData);
      setLastUpdatedAt(new Date());
      setRefreshFailed(false);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error(error);
        setRefreshFailed(true);
      }
    } finally {
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshMetrics();
      }
    }, refreshIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshMetrics();
      }
    };

    window.addEventListener("focus", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      inFlightRef.current?.abort();
    };
  }, [refreshMetrics]);

  const safeData = data ?? fallbackMetrics();
  const fuel = toMetric(safeData.benzine, "/benzine");
  const traffic = toMetric(safeData.file, "/file");
  const weather = toMetric(safeData.weer, "/weer");
  const spoor = toMetric(safeData.storingen, "/spoor");
  const { isKnown: spoorKnown, storingen } = parseSpoor(spoor.value);

  const summary = buildSummary({
    fileValue: traffic.value,
    spoorKnown,
    weatherNote: weather.note,
    storingen,
  });
  const sources = [
    { name: "CBS", status: safeData.benzine.sourceStatus },
    { name: "Open-Meteo", status: safeData.weer.sourceStatus },
    { name: "NDW", status: safeData.file.sourceStatus },
    { name: "NS", status: safeData.storingen.sourceStatus },
  ];

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
      <header className="mb-14">
        <p className="text-sm uppercase tracking-[0.45em] text-neutral-500">
          de stand van vandaag
        </p>

        <h1 className="mt-5 text-7xl font-black tracking-tight text-neutral-50 md:text-9xl">
          Valt mee.
        </h1>

        <p className="mt-5 max-w-2xl text-lg text-neutral-500">{summary}</p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <FuelCard item={fuel} />
        <TrafficCard item={traffic} />
        <SpoorCard item={spoor} />
        <WeatherCard item={weather} />
      </div>

      <footer className="mt-12 flex flex-col gap-2 text-sm text-neutral-600">
        <div className="flex flex-col gap-2">
          <span>
            {sources.map((source, index) => (
              <span key={source.name}>
                {index > 0 && " · "}
                <SourceName status={source.status}>{source.name}</SourceName>
              </span>
            ))}
          </span>
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
          <div aria-live="polite" className="text-xs text-neutral-700">
            {refreshFailed
              ? "laatste verversing mislukt"
              : isRefreshing
                ? "verversen..."
                : `bijgewerkt ${formatRefreshTime(lastUpdatedAt)}`}
          </div>
        </div>
      </footer>
    </section>
  );
}
