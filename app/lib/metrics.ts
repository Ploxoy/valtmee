import { headers } from "next/headers";
import { fallbackMetrics, type MetricsResponse } from "./metrics-shared";

export * from "./metrics-shared";

export const metricSources = {
  fuel: "https://www.cbs.nl/nl-nl/cijfers/detail/80416ned",
  traffic: "https://file.ndw.nu/",
  weather: "https://open-meteo.com/en/docs",
  trains: "https://www.ns.nl/reisinformatie/actuele-situatie-op-het-spoor/",
};

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
