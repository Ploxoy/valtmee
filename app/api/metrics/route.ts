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
  route: string;
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

type NdwTrafficRow = {
  distanceInMeters: number;
  provinces?: string[];
  roadNumber?: string;
  trajectory?: string;
  versionTime?: string;
};

type NsDisruptionRow = {
  id?: string;
  isActive?: boolean;
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

const trafficFreshnessMs = 6 * 60 * 60 * 1000;
const futureSkewMs = 5 * 60 * 1000;

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

async function getWeather() {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=51.9244" +
    "&longitude=4.4777" +
    "&current=temperature_2m,wind_speed_10m,precipitation" +
    "&timezone=Europe%2FAmsterdam";

  const res = await fetch(url, {
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    throw new Error("Open-Meteo request failed");
  }

  const json = (await res.json()) as OpenMeteoResponse;

  const temp = Math.round(json.current.temperature_2m);
  const wind = windKmhToBft(json.current.wind_speed_10m);
  const rain = json.current.precipitation;

  return metric(`${temp}° / ${wind} Bft`, rain > 0 ? `${rain} mm regen` : "droog");
}

async function getFuelPrice() {
  let url: string | null =
    "https://opendata.cbs.nl/ODataApi/OData/80416ned/TypedDataSet?$select=Perioden,BenzineEuro95_1";

  const rows: CbsFuelRow[] = [];

  while (url) {
    const res = await fetch(url, {
      next: { revalidate: 21600 },
    });

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

  if (!rows.length) {
    throw new Error("CBS fuel data empty");
  }

  rows.sort((a, b) => String(a.Perioden).localeCompare(String(b.Perioden)));

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
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

  const history: SparkPoint[] = rows.slice(-365).map((row) => ({
    date: formatCbsDate(String(row.Perioden)),
    value: row.BenzineEuro95_1,
  }));

  return metric(
    `€${latest.BenzineEuro95_1.toFixed(2).replace(".", ",")}`,
    `Euro95 · CBS · ${formatCbsDate(String(latest.Perioden))}`,
    history,
    trend
  );
}
async function getTraffic() {
  const url =
    "https://datafusion.ndw.nu/api/rest/traffic-jam/v1/actual/traffic-jam-latest-summary";

  const res = await fetch(url, {
    next: { revalidate: 60 },
  });

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

  const now = Date.now();
  const freshRows = validRows.filter((row) => {
    if (!row.versionTime) return false;

    const timestamp = new Date(row.versionTime).getTime();
    if (!Number.isFinite(timestamp)) return false;
    if (timestamp > now + futureSkewMs) return false;

    return now - timestamp <= trafficFreshnessMs;
  });
  const staleCount = validRows.length - freshRows.length;

  if (!freshRows.length) {
    return metric(
      "—",
      "NDW verouderd",
      [],
      undefined,
      {
        traffic: {
          count: 0,
          totalKm: 0,
          averageKm: 0,
          updatedAt: "geen actuele data",
          staleCount,
          jams: [],
        },
      }
    );
  }

  const totalMeters = freshRows.reduce(
    (sum, row) => sum + Number(row.distanceInMeters),
    0
  );

  const km = Math.round(totalMeters / 1000);

  const validTimes = freshRows
    .map((row) =>
      row.versionTime ? new Date(row.versionTime).getTime() : NaN
    )
    .filter((time) => Number.isFinite(time));

  const newestTime = validTimes.length > 0 ? Math.max(...validTimes) : null;

  const time =
    newestTime === null
      ? "actueel"
      : formatAmsterdamDateTime(newestTime);

  const sortedRows = [...freshRows].sort(
    (a, b) => Number(b.distanceInMeters) - Number(a.distanceInMeters)
  );

  const details: TrafficDetails = {
    count: freshRows.length,
    totalKm: km,
    averageKm: Number((km / freshRows.length).toFixed(1)),
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
    `${freshRows.length} files · NDW · ${time}`,
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
  const route =
    item.route ??
    item.routes?.join(" · ") ??
    item.station ??
    "traject onbekend";
  const title = item.title ?? item.topic ?? item.id ?? "NS melding";

  return { title, type, route };
}

async function getTrainDisruptions() {
  const apiKey = process.env.NS_API_KEY;

  if (!apiKey) {
    return unavailableMetric("NS key ontbreekt");
  }

  const url =
    "https://gateway.apiportal.ns.nl/reisinformatie-api/api/v3/disruptions";

  const res = await fetch(url, {
    headers: {
      "Ocp-Apim-Subscription-Key": apiKey,
    },
    next: { revalidate: 300 },
  });

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

async function resolveMetric(
  name: string,
  fetchMetric: () => Promise<MetricPayload>,
  fallback: MetricPayload
): Promise<MetricPayload> {
  try {
    return await fetchMetric();
  } catch (error) {
    console.error(`[metrics] ${name} failed`, error);
    return fallback;
  }
}

export async function GET() {
  const [weather, fuel, traffic, trains] = await Promise.all([
    resolveMetric("weather", getWeather, unavailableMetric("weer niet beschikbaar")),
    resolveMetric("fuel", getFuelPrice, unavailableMetric("benzine niet beschikbaar")),
    resolveMetric("traffic", getTraffic, unavailableMetric("files niet beschikbaar")),
    resolveMetric("trains", getTrainDisruptions, unavailableMetric("NS niet beschikbaar")),
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
