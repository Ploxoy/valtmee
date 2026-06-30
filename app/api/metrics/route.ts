import { get, put } from "@vercel/blob";
import cbsFuelSnapshotRows from "../../data/cbs-fuel-snapshot.json";

export const runtime = "nodejs";

type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    precipitation: number;
  };
};

type CbsFuelRow = {
  Perioden: string;
  BenzineEuro95_1: number;
};

type SparkPoint = {
  date: string;
  value: number;
};

type TrafficJamDetail = {
  roadNumber: string;
  trajectory: string;
  province: string;
  distanceKm: number;
  updatedAt: string;
};

type TrafficDetails = {
  count: number;
  totalKm: number;
  averageKm: number;
  updatedAt: string;
  staleCount: number;
  jams: TrafficJamDetail[];
};

type TrainMessage = {
  title: string;
  type: string;
  reason?: string;
  meta?: string;
  description?: string;
  advice?: string;
};

type TrainDetails = {
  totalActive: number;
  disruptions: TrainMessage[];
  maintenance: TrainMessage[];
  calamities: TrainMessage[];
};

type MetricPayload = {
  value: string;
  note: string;
  history: SparkPoint[];
  trend?: string;
  details?: {
    traffic?: TrafficDetails;
    trains?: TrainDetails;
  };
};

type SourceCache = {
  fallback: MetricPayload;
  failureCooldownMs: number;
  lastFailureAt: number;
  lastGoodAt: number;
  lastGood: MetricPayload | null;
  snapshotPath: string;
  successTtlMs: number;
};

type SourceName = "fuel" | "traffic" | "trains" | "weather";

type NdwTrafficRow = {
  distanceInMeters: number;
  provinces?: string[];
  roadNumber?: string;
  trajectory?: string;
  versionTime?: string;
};

type NsDisruptionRow = {
  id?: string;
  description?: string;
  end?: string;
  expectedDuration?: {
    description?: string;
  };
  isActive?: boolean;
  lastUpdated?: string;
  period?: string;
  summaryAdditionalTravelTime?: {
    label?: string;
    shortLabel?: string;
  };
  timespans?: Array<{
    additionalTravelTime?: {
      label?: string;
      shortLabel?: string;
    };
    advices?: string[];
    alternativeTransport?: {
      label?: string;
      shortLabel?: string;
    };
    cause?: {
      label?: string;
    };
    period?: string;
    situation?: {
      label?: string;
    };
  }>;
  title?: string;
  topic?: string;
  type?: string;
  route?: string;
  routes?: string[];
  station?: string;
};

type NsDisruptionsResponse = {
  disruptions?: NsDisruptionRow[];
};

const trafficOldTimestampMs = 24 * 60 * 60 * 1000;
const cbsFuelTotalTimeoutMs = 1_800;
const cbsFuelRequestTimeoutMs = 1_500;
const sourceFailureCooldownMs = 5 * 60 * 1000;
const fuelSuccessTtlMs = 6 * 60 * 60 * 1000;
const trafficSuccessTtlMs = 60 * 1000;
const trainsSuccessTtlMs = 5 * 60 * 1000;
const weatherSuccessTtlMs = 10 * 60 * 1000;
const defaultSourceTimeoutMs = 1_800;
const trafficSourceTimeoutMs = 1_500;
const nsSourceTimeoutMs = 2_000;
const cbsFuelFallbackRows = cbsFuelSnapshotRows as CbsFuelRow[];

const sourceCaches: Record<SourceName, SourceCache> = {
  fuel: {
    fallback: buildFuelMetric(cbsFuelFallbackRows, "CBS cache"),
    failureCooldownMs: sourceFailureCooldownMs,
    lastFailureAt: 0,
    lastGoodAt: 0,
    lastGood: null,
    snapshotPath: "metrics/fuel/latest.json",
    successTtlMs: fuelSuccessTtlMs,
  },
  traffic: {
    fallback: metric("—", "NDW niet beschikbaar"),
    failureCooldownMs: sourceFailureCooldownMs,
    lastFailureAt: 0,
    lastGoodAt: 0,
    lastGood: null,
    snapshotPath: "metrics/traffic/latest.json",
    successTtlMs: trafficSuccessTtlMs,
  },
  trains: {
    fallback: unavailableMetric("NS niet beschikbaar"),
    failureCooldownMs: sourceFailureCooldownMs,
    lastFailureAt: 0,
    lastGoodAt: 0,
    lastGood: null,
    snapshotPath: "metrics/trains/latest.json",
    successTtlMs: trainsSuccessTtlMs,
  },
  weather: {
    fallback: metric("— / —", "Open-Meteo niet beschikbaar"),
    failureCooldownMs: sourceFailureCooldownMs,
    lastFailureAt: 0,
    lastGoodAt: 0,
    lastGood: null,
    snapshotPath: "metrics/weather/latest.json",
    successTtlMs: weatherSuccessTtlMs,
  },
};

function metric(
  value: string,
  note: string,
  history: SparkPoint[] = [],
  trend?: string,
  details?: MetricPayload["details"]
): MetricPayload {
  return { value, note, history, trend, details };
}

function unavailableMetric(note: string): MetricPayload {
  return metric("—", note);
}

function windKmhToBft(kmh: number): number {
  const limits = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
  const index = limits.findIndex((limit) => kmh < limit);
  return index === -1 ? 12 : index;
}

function formatCbsDate(rawDate: string): string {
  return rawDate.length === 8
    ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    : rawDate;
}

function formatAmsterdamDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isBlobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

function isMetricPayload(value: unknown): value is MetricPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<MetricPayload>;
  return (
    typeof payload.value === "string" &&
    typeof payload.note === "string" &&
    Array.isArray(payload.history)
  );
}

async function readBlobSnapshot(cache: SourceCache) {
  if (!isBlobConfigured()) return null;

  try {
    const result = await get(cache.snapshotPath, { access: "private" });

    if (!result || result.statusCode !== 200) {
      return null;
    }

    const payload = (await new Response(result.stream).json()) as unknown;

    return isMetricPayload(payload) ? payload : null;
  } catch (error) {
    console.error(`[metrics] Blob snapshot read failed: ${cache.snapshotPath}`, error);
    return null;
  }
}

async function writeBlobSnapshot(cache: SourceCache, payload: MetricPayload) {
  if (!isBlobConfigured()) return;

  try {
    await put(cache.snapshotPath, JSON.stringify(payload), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
    });
  } catch (error) {
    console.error(`[metrics] Blob snapshot write failed: ${cache.snapshotPath}`, error);
  }
}

async function resolveCachedMetric(
  name: SourceName,
  fetchMetric: () => Promise<MetricPayload>
) {
  const cache = sourceCaches[name];
  const now = Date.now();

  if (cache.lastGood && now - cache.lastGoodAt < cache.successTtlMs) {
    return cache.lastGood;
  }

  if (
    cache.lastFailureAt &&
    now - cache.lastFailureAt < cache.failureCooldownMs
  ) {
    const snapshot = cache.lastGood ?? (await readBlobSnapshot(cache));

    if (snapshot) {
      cache.lastGood = snapshot;
      return snapshot;
    }

    return cache.fallback;
  }

  try {
    const result = await fetchMetric();
    cache.lastGood = result;
    cache.lastGoodAt = Date.now();
    cache.lastFailureAt = 0;
    await writeBlobSnapshot(cache, result);
    return result;
  } catch (error) {
    console.error(`[metrics] ${name} live fetch failed`, error);
    cache.lastFailureAt = Date.now();
    const snapshot = cache.lastGood ?? (await readBlobSnapshot(cache));

    if (snapshot) {
      cache.lastGood = snapshot;
      return snapshot;
    }

    return cache.fallback;
  }
}

async function getWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=51.9244" +
    "&longitude=4.4777" +
    "&current=temperature_2m,wind_speed_10m,precipitation" +
    "&timezone=Europe%2FAmsterdam";

  const res = await fetchWithTimeout(
    url,
    { cache: "no-store" },
    defaultSourceTimeoutMs
  );

  if (!res.ok) {
    throw new Error("Open-Meteo request failed");
  }

  const json = (await res.json()) as OpenMeteoResponse;

  const temp = Math.round(json.current.temperature_2m);
  const wind = windKmhToBft(json.current.wind_speed_10m);
  const rain = json.current.precipitation;

  return metric(`${temp}° / ${wind} Bft`, rain > 0 ? `${rain} mm regen` : "droog");
}

function buildFuelMetric(rows: CbsFuelRow[], sourceLabel = "CBS") {
  if (!rows.length) {
    throw new Error("CBS fuel data empty");
  }

  const sortedRows = [...rows].sort((a, b) =>
    String(a.Perioden).localeCompare(String(b.Perioden))
  );

  const latest = sortedRows[sortedRows.length - 1];
  const previous = sortedRows[sortedRows.length - 2];
  const fuelTrend =
    previous && Number.isFinite(previous.BenzineEuro95_1)
      ? latest.BenzineEuro95_1 - previous.BenzineEuro95_1
      : null;

  const trend =
    fuelTrend === null
      ? undefined
      : `${fuelTrend >= 0 ? "+" : "-"}€${Math.abs(fuelTrend)
          .toFixed(2)
          .replace(".", ",")} vs vorige`;

  const history: SparkPoint[] = sortedRows.slice(-365).map((row) => ({
    date: formatCbsDate(String(row.Perioden)),
    value: row.BenzineEuro95_1,
  }));

  return metric(
    `€${latest.BenzineEuro95_1.toFixed(2).replace(".", ",")}`,
    `Euro95 · ${sourceLabel} · ${formatCbsDate(String(latest.Perioden))}`,
    history,
    trend
  );
}

async function fetchCbsFuelRows() {
  let url: string | null =
    "https://opendata.cbs.nl/ODataApi/OData/80416ned/TypedDataSet?$select=Perioden,BenzineEuro95_1";

  const rows: CbsFuelRow[] = [];
  const deadline = Date.now() + cbsFuelTotalTimeoutMs;

  while (url) {
    const remainingMs = deadline - Date.now();

    if (remainingMs <= 0) {
      throw new Error("CBS fuel request timed out");
    }

    const res = await fetchWithTimeout(
      url,
      { cache: "no-store" },
      Math.min(cbsFuelRequestTimeoutMs, remainingMs)
    );

    if (!res.ok) {
      throw new Error("CBS fuel request failed");
    }

    const json = (await res.json()) as {
      value: CbsFuelRow[];
      "odata.nextLink"?: string;
      "__next"?: string;
    };

    rows.push(
      ...json.value.filter(
        (row) => row.Perioden && row.BenzineEuro95_1 != null
      )
    );

    url = json["odata.nextLink"] ?? json["__next"] ?? null;
  }

  return rows;
}

async function getFuelPrice() {
  return buildFuelMetric(await fetchCbsFuelRows());
}

async function getTraffic() {
  const url =
    "https://datafusion.ndw.nu/api/rest/traffic-jam/v1/actual/traffic-jam-latest-summary";

  const res = await fetchWithTimeout(
    url,
    { cache: "no-store" },
    trafficSourceTimeoutMs
  );

  if (!res.ok) {
    throw new Error(`NDW traffic request failed: ${res.status}`);
  }

  const rows = (await res.json()) as NdwTrafficRow[];

  if (!Array.isArray(rows)) {
    throw new Error("NDW traffic data is not an array");
  }

  const validRows = rows.filter((row) =>
    Number.isFinite(Number(row.distanceInMeters))
  );

  if (!validRows.length) {
    return metric("0 km", "geen files · NDW");
  }

  const totalMeters = validRows.reduce(
    (sum, row) => sum + Number(row.distanceInMeters),
    0
  );

  const km = Math.round(totalMeters / 1000);

  const validTimes = validRows
    .map((row) =>
      row.versionTime ? new Date(row.versionTime).getTime() : NaN
    )
    .filter((time) => Number.isFinite(time));

  const newestTime = validTimes.length > 0 ? Math.max(...validTimes) : null;

  const time =
    newestTime === null
      ? "actueel"
      : formatAmsterdamDateTime(newestTime);

  const now = Date.now();
  const staleCount = validRows.filter((row) => {
    if (!row.versionTime) return true;

    const timestamp = new Date(row.versionTime).getTime();
    if (!Number.isFinite(timestamp)) return true;

    return now - timestamp > trafficOldTimestampMs;
  }).length;

  const sortedRows = [...validRows].sort(
    (a, b) => Number(b.distanceInMeters) - Number(a.distanceInMeters)
  );

  const details: TrafficDetails = {
    count: validRows.length,
    totalKm: km,
    averageKm: Number((km / validRows.length).toFixed(1)),
    updatedAt: time,
    staleCount,
    jams: sortedRows.slice(0, 7).map((row) => {
      const timestamp = row.versionTime
        ? new Date(row.versionTime).getTime()
        : NaN;

      return {
        roadNumber: row.roadNumber ?? "weg",
        trajectory: row.trajectory ?? "traject onbekend",
        province: row.provinces?.[0] ?? "Nederland",
        distanceKm: Number((Number(row.distanceInMeters) / 1000).toFixed(1)),
        updatedAt: Number.isFinite(timestamp)
          ? formatAmsterdamDateTime(timestamp)
          : "onbekend",
      };
    }),
  };

  return metric(
    `${km} km`,
    `${validRows.length} files · NDW · ${time}`,
    [],
    undefined,
    { traffic: details }
  );
}

function toDisruptions(payload: unknown): NsDisruptionRow[] {
  if (Array.isArray(payload)) {
    return payload as NsDisruptionRow[];
  }

  if (payload && typeof payload === "object") {
    const withDisruptions = payload as NsDisruptionsResponse;
    if (Array.isArray(withDisruptions.disruptions)) {
      return withDisruptions.disruptions;
    }
  }

  return [];
}

function toTrainMessage(item: NsDisruptionRow): TrainMessage {
  const type = String(item.type ?? "melding").toUpperCase();
  const timespan = item.timespans?.[0];
  const title = stripTrailingDot(item.title ?? item.topic ?? item.id ?? "NS melding");
  const cause = timespan?.cause?.label;
  const duration =
    item.expectedDuration?.description ??
    toUntilLabel(item.end) ??
    compactPeriod(item.period ?? timespan?.period);
  const update = item.lastUpdated
    ? `update ${formatAmsterdamDateTime(new Date(item.lastUpdated).getTime())}`
    : undefined;
  const extraTime =
    item.summaryAdditionalTravelTime?.shortLabel ??
    timespan?.additionalTravelTime?.shortLabel;
  const transport = timespan?.alternativeTransport?.shortLabel;
  const description = item.description ?? timespan?.situation?.label;
  const reason = toTrainReason(type, description, cause);
  const metaCause = reason === cause ? undefined : cause;
  const meta = [metaCause, duration ?? update, extraTime, transport]
    .filter(Boolean)
    .join(" · ");
  const advice = timespan?.advices?.find(Boolean);

  return { title, type, reason, meta, description, advice };
}

function toTrainReason(type: string, description?: string, cause?: string) {
  if (type !== "DISRUPTION") return undefined;

  const text = description?.toLowerCase() ?? "";

  if (text.includes("geen treinen")) return "geen treinen";
  if (text.includes("minder treinen")) return "minder treinen";

  return cause;
}

function stripTrailingDot(value: string) {
  return value.replace(/\.+$/g, "");
}

function compactPeriod(period?: string) {
  if (!period) return undefined;

  const match = period.match(/\bt\/m\s+(.+)$/i);
  return match ? `t/m ${match[1]}` : period;
}

function toUntilLabel(value?: string) {
  if (!value) return undefined;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return undefined;

  return `t/m ${new Date(timestamp).toLocaleString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  })}`;
}

async function getTrainDisruptions() {
  const apiKey = process.env.NS_API_KEY;

  if (!apiKey) {
    return unavailableMetric("NS key ontbreekt");
  }

  const url =
    "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3/disruptions";

  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
      },
      cache: "no-store",
    },
    nsSourceTimeoutMs
  );

  if (!res.ok) {
    throw new Error(`NS disruptions request failed: ${res.status}`);
  }

  const disruptionRows = toDisruptions(await res.json());
  const active = disruptionRows.filter((item) => item.isActive === true);

  const disruptions = active.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    return type === "DISRUPTION";
  });

  const werkzaamheden = active.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    return type === "MAINTENANCE";
  });

  const calamities = active.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    return type === "CALAMITY";
  });

  const details: TrainDetails = {
    totalActive: active.length,
    disruptions: disruptions.slice(0, 8).map(toTrainMessage),
    maintenance: werkzaamheden.slice(0, 10).map(toTrainMessage),
    calamities: calamities.slice(0, 5).map(toTrainMessage),
  };

  return metric(
    `${disruptions.length} / ${werkzaamheden.length}`,
    "actieve meldingen · NS",
    [],
    undefined,
    { trains: details }
  );
}

export async function GET() {
  const [weather, fuel, traffic, trains] = await Promise.all([
    resolveCachedMetric("weather", getWeather),
    resolveCachedMetric("fuel", getFuelPrice),
    resolveCachedMetric("traffic", getTraffic),
    resolveCachedMetric("trains", getTrainDisruptions),
  ]);

  const data = {
    benzine: fuel,
    file: traffic,
    weer: weather,
    storingen: trains,
    sources: ["CBS", "Open-Meteo", "NDW", "NS"],
  };

  return Response.json(data);
}
