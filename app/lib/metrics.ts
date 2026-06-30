import { headers } from "next/headers";

export const metricSources = {
  fuel: "https://www.cbs.nl/nl-nl/cijfers/detail/80416ned",
  traffic: "https://file.ndw.nu/",
  weather: "https://open-meteo.com/en/docs",
  trains: "https://www.ns.nl/reisinformatie/actuele-situatie-op-het-spoor/",
};

export type SparkPoint = {
  date: string;
  value: number;
};

export type Metric = {
  value: string;
  note: string;
  href: string;
  sourceStatus?: SourceStatus;
};

export type SourceStatus = "live" | "cache" | "fallback";

export type MetricPayload = {
  value: string;
  note: string;
  history: SparkPoint[];
  sourceStatus?: SourceStatus;
  trend?: string;
  details?: {
    traffic?: {
      count: number;
      totalKm: number;
      averageKm: number;
      updatedAt: string;
      staleCount: number;
      jams: Array<{
        roadNumber: string;
        trajectory: string;
        province: string;
        distanceKm: number;
        updatedAt: string;
      }>;
    };
    trains?: {
      totalActive: number;
      disruptions: Array<{
        title: string;
        type: string;
        reason?: string;
        meta?: string;
        description?: string;
        advice?: string;
      }>;
      maintenance: Array<{
        title: string;
        type: string;
        reason?: string;
        meta?: string;
        description?: string;
        advice?: string;
      }>;
      calamities: Array<{
        title: string;
        type: string;
        reason?: string;
        meta?: string;
        description?: string;
        advice?: string;
      }>;
    };
  };
};

export type MetricsResponse = {
  benzine: MetricPayload;
  file: MetricPayload;
  weer: MetricPayload;
  storingen: MetricPayload;
  sources: string[];
};

export function fallbackMetrics(): MetricsResponse {
  return {
    benzine: {
      value: "-",
      note: "niet beschikbaar",
      history: [],
      sourceStatus: "fallback",
    },
    file: {
      value: "-",
      note: "niet beschikbaar",
      history: [],
      sourceStatus: "fallback",
    },
    weer: {
      value: "-",
      note: "niet beschikbaar",
      history: [],
      sourceStatus: "fallback",
    },
    storingen: {
      value: "- / -",
      note: "niet beschikbaar",
      history: [],
      sourceStatus: "fallback",
    },
    sources: ["CBS", "Open-Meteo", "NDW", "NS"],
  };
}

function getRequestOrigin(incomingHeaders: Headers) {
  const host = incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
  const proto = incomingHeaders.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${proto}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function getMetrics(): Promise<MetricsResponse> {
  try {
    const incomingHeaders = await headers();
    const cookie = incomingHeaders.get("cookie");
    const res = await fetch(`${getRequestOrigin(incomingHeaders)}/api/metrics`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });

    if (!res.ok) {
      console.error("Metrics fetch failed:", res.status, res.statusText);
      return fallbackMetrics();
    }

    return (await res.json()) as MetricsResponse;
  } catch (error) {
    console.error("Metrics fetch crashed:", error);
    return fallbackMetrics();
  }
}

export function toMetric(payload: MetricPayload, href: string): Metric {
  return {
    value: payload.value,
    note: payload.note,
    href,
    sourceStatus: payload.sourceStatus,
  };
}

export function isSourceDegraded(sourceStatus?: SourceStatus) {
  return sourceStatus === "cache" || sourceStatus === "fallback";
}

export function sourceTextClassName(sourceStatus?: SourceStatus) {
  return isSourceDegraded(sourceStatus) ? "text-rose-400" : undefined;
}

export function getFileStatus(fileValue: string) {
  const km = Number.parseInt(fileValue, 10);

  if (!Number.isFinite(km)) return "onbekend";
  if (km === 0) return "rustig";
  if (km < 50) return "valt mee";
  if (km < 150) return "druk";
  return "chaos";
}

export function getWeatherStatus(weatherNote: string) {
  const note = weatherNote.toLowerCase();

  if (note.includes("niet beschikbaar")) return "onbekend";
  if (note.includes("regen")) return "nat";
  if (note.includes("droog")) return "droog";
  return "weer";
}

export function getSpoorStatus(storingen: number, isKnown = true) {
  if (!isKnown) return "onbekend";
  if (storingen === 0) return "rustig";
  if (storingen <= 3) return "valt mee";
  if (storingen <= 10) return "onrustig";
  return "chaos";
}

export function parseWeather(value: string) {
  const [tempRaw, windRaw] = value.split("/");

  return {
    temperature: tempRaw?.trim() || value,
    wind: windRaw?.trim() || "-",
  };
}

export function formatShareWeather(value: string, note: string) {
  const weather = parseWeather(value);
  return `${weather.temperature} / ${note}`;
}

export function parseSpoor(value: string) {
  const [storingenRaw, werkzaamhedenRaw] = String(value).split("/");

  const storingen = Number.parseInt(storingenRaw?.trim() || "0", 10);
  const werkzaamheden = Number.parseInt(werkzaamhedenRaw?.trim() || "0", 10);
  const isKnown =
    Number.isFinite(storingen) && Number.isFinite(werkzaamheden);

  return {
    isKnown,
    storingen: isKnown ? storingen : 0,
    werkzaamheden: isKnown ? werkzaamheden : 0,
  };
}

export function buildSummary({
  fileValue,
  weatherNote,
  spoorKnown = true,
  storingen,
}: {
  fileValue: string;
  weatherNote: string;
  spoorKnown?: boolean;
  storingen: number;
}) {
  const fileStatus = getFileStatus(fileValue);
  const weatherStatus = getWeatherStatus(weatherNote);
  const spoorStatus = getSpoorStatus(storingen, spoorKnown);

  const road =
    fileStatus === "onbekend"
      ? "files onbekend"
      : fileStatus === "rustig"
      ? "rustig op de weg"
      : fileStatus === "valt mee"
        ? "beperkte files"
        : fileStatus === "druk"
          ? "druk op de weg"
          : "veel files";

  const weather =
    weatherStatus === "onbekend"
      ? "weer onbekend"
      : weatherStatus === "nat"
      ? "nat weer"
      : weatherStatus === "droog"
        ? "droog weer"
        : "gewoon weer";

  const spoor =
    spoorStatus === "onbekend"
      ? "spoor onbekend"
      : spoorStatus === "rustig"
      ? "weinig spoorstoringen"
      : spoorStatus === "valt mee"
        ? "enkele spoorstoringen"
        : spoorStatus === "onrustig"
          ? "onrustig op het spoor"
          : "veel spoorproblemen";

  return `Vandaag: ${road}, ${spoor}, ${weather}.`;
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

export function formatDateWithYear(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}
