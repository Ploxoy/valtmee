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

type MetricPayload = {
  value: string;
  note: string;
  history: SparkPoint[];
};

type NdwTrafficRow = {
  distanceInMeters: number;
  versionTime?: string;
};

type NsDisruptionRow = {
  isActive?: boolean;
  type?: string;
};

type NsDisruptionsResponse = {
  disruptions?: NsDisruptionRow[];
};

function metric(value: string, note: string, history: SparkPoint[] = []): MetricPayload {
  return { value, note, history };
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

  const history: SparkPoint[] = rows.slice(-365).map((row) => ({
    date: formatCbsDate(String(row.Perioden)),
    value: row.BenzineEuro95_1,
  }));

  return metric(
    `€${latest.BenzineEuro95_1.toFixed(2).replace(".", ",")}`,
    `Euro95 · CBS · ${formatCbsDate(String(latest.Perioden))}`,
    history
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
      : new Date(newestTime).toLocaleTimeString("nl-NL", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Amsterdam",
        });

  return metric(`${km} km`, `${validRows.length} files · NDW · ${time}`);
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

  const disruptions = toDisruptions(await res.json());
  const active = disruptions.filter((item) => item.isActive === true);

  const storingen = active.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    return type === "DISRUPTION";
  }).length;

  const werkzaamheden = active.filter((item) => {
    const type = String(item.type ?? "").toUpperCase();
    return type === "MAINTENANCE";
  }).length;

  return metric(`${storingen} / ${werkzaamheden}`, "actieve meldingen · NS");
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
    hypotheek: metric("4,03%", "gemiddeld"),
    file: traffic,
    weer: weather,
    storingen: trains,
    sources: ["CBS", "Open-Meteo", "NDW", "NS"],
  };

  return Response.json(data);
}
