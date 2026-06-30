import { get, put } from "@vercel/blob";
import { sourceTextClassName, type SourceStatus } from "./metrics";

export type WorldCupMatchSlot = "live" | "next" | "done";

export type WorldCupMatch = {
  date: string;
  line: string;
  note: string;
  slot: WorldCupMatchSlot;
  stage?: string;
};

export type WorldCupData = {
  headline: string;
  matches: WorldCupMatch[];
  sourceName: string;
  sourceStatus: SourceStatus;
  sourceUrl: string;
};

type EspnScoreboard = {
  events?: EspnEvent[];
};

type EspnEvent = {
  date?: string;
  competitions?: Array<{
    altGameNote?: string;
    competitors?: EspnCompetitor[];
    status?: {
      type?: {
        completed?: boolean;
        state?: string;
      };
    };
  }>;
};

type EspnCompetitor = {
  homeAway?: string;
  score?: string;
  team?: {
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
};

const espnSourceUrl = "https://www.espn.com/soccer/scoreboard/_/league/fifa.world";
const snapshotPath = "world-cup/today/latest.json";
const requestTimeoutMs = 1_800;
const successTtlMs = 2 * 60 * 1000;
const failureCooldownMs = 5 * 60 * 1000;

let lastGood: WorldCupData | null = null;
let lastGoodAt = 0;
let lastFailureAt = 0;

function isBlobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

function isWorldCupMatch(value: unknown): value is WorldCupMatch {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<WorldCupMatch>;
  return (
    typeof payload.date === "string" &&
    typeof payload.line === "string" &&
    typeof payload.note === "string" &&
    (payload.slot === "live" || payload.slot === "next" || payload.slot === "done")
  );
}

function isWorldCupData(value: unknown): value is WorldCupData {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<WorldCupData>;
  return (
    typeof payload.headline === "string" &&
    Array.isArray(payload.matches) &&
    payload.matches.every(isWorldCupMatch) &&
    typeof payload.sourceName === "string" &&
    typeof payload.sourceUrl === "string"
  );
}

function withSourceStatus(
  data: WorldCupData,
  sourceStatus: SourceStatus
): WorldCupData {
  return { ...data, sourceStatus };
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readSnapshot() {
  if (!isBlobConfigured()) return null;

  try {
    const result = await get(snapshotPath, { access: "private" });

    if (!result || result.statusCode !== 200) return null;

    const payload = (await new Response(result.stream).json()) as unknown;
    return isWorldCupData(payload) ? payload : null;
  } catch (error) {
    console.error("[world-cup] Blob snapshot read failed", error);
    return null;
  }
}

async function writeSnapshot(data: WorldCupData) {
  if (!isBlobConfigured()) return;

  try {
    const snapshot: Omit<WorldCupData, "sourceStatus"> = {
      headline: data.headline,
      matches: data.matches,
      sourceName: data.sourceName,
      sourceUrl: data.sourceUrl,
    };

    await put(snapshotPath, JSON.stringify(snapshot), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/json",
    });
  } catch (error) {
    console.error("[world-cup] Blob snapshot write failed", error);
  }
}

function teamName(competitor?: EspnCompetitor) {
  return (
    competitor?.team?.shortDisplayName ??
    competitor?.team?.displayName ??
    competitor?.team?.abbreviation ??
    "onbekend"
  );
}

function formatAmsterdamDateTime(rawDate: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(rawDate));
}

function formatAmsterdamDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Amsterdam",
    year: "numeric",
  })
    .format(date)
    .replaceAll("-", "");
}

function todayScoreboardUrl() {
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${formatAmsterdamDayKey()}&limit=50`;
}

function toWorldCupMatch(event: EspnEvent): WorldCupMatch | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];

  if (!event.date || !competition || competitors.length < 2) return null;

  const home = competitors.find((item) => item.homeAway === "home");
  const away = competitors.find((item) => item.homeAway === "away");
  const status = competition.status?.type;
  const state = status?.state ?? "pre";
  const completed = status?.completed === true;
  const slot: WorldCupMatchSlot =
    state === "in" ? "live" : completed ? "done" : "next";
  const score =
    slot === "live" || slot === "done"
      ? `${home?.score ?? "0"}-${away?.score ?? "0"}`
      : formatAmsterdamDateTime(event.date);
  const note =
    slot === "live"
      ? "nu bezig"
      : slot === "done"
        ? "afgelopen"
        : `aftrap ${formatAmsterdamDateTime(event.date)}`;

  return {
    date: event.date,
    line: `${teamName(home)} - ${teamName(away)} · ${score}`,
    note,
    slot,
    stage: competition.altGameNote,
  };
}

function pickWorldCupData(events: EspnEvent[]): WorldCupData | null {
  const matches = events
    .map(toWorldCupMatch)
    .filter((match): match is WorldCupMatch => Boolean(match))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!matches.length) return null;

  const live = matches.filter((match) => match.slot === "live");
  const next = matches.filter((match) => match.slot === "next");
  const done = matches.filter((match) => match.slot === "done");
  const selected = live.length ? live : next.length ? next.slice(0, 3) : done.slice(-3);
  const headline = live.length
    ? `${live.length} live wedstrijd${live.length === 1 ? "" : "en"}`
    : next.length
      ? "volgende WK-wedstrijden"
      : "laatste WK-uitslagen";

  return {
    headline,
    matches: selected,
    sourceName: "ESPN",
    sourceStatus: "live",
    sourceUrl: espnSourceUrl,
  };
}

async function fetchWorldCupData() {
  const res = await fetchWithTimeout(todayScoreboardUrl(), requestTimeoutMs);

  if (!res.ok) {
    throw new Error(`ESPN World Cup request failed: ${res.status}`);
  }

  const data = (await res.json()) as EspnScoreboard;
  const worldCup = pickWorldCupData(data.events ?? []);

  if (!worldCup) {
    throw new Error("No World Cup matches found in ESPN scoreboard");
  }

  return worldCup;
}

export async function getWorldCupData(): Promise<WorldCupData | null> {
  const now = Date.now();

  if (lastGood && now - lastGoodAt < successTtlMs) {
    return withSourceStatus(lastGood, "live");
  }

  if (lastFailureAt && now - lastFailureAt < failureCooldownMs) {
    const snapshot = lastGood ?? (await readSnapshot());
    return snapshot ? withSourceStatus(snapshot, "cache") : null;
  }

  try {
    const data = await fetchWorldCupData();
    lastGood = data;
    lastGoodAt = Date.now();
    lastFailureAt = 0;
    await writeSnapshot(data);
    return withSourceStatus(data, "live");
  } catch (error) {
    console.error("[world-cup] live fetch failed", error);
    lastFailureAt = Date.now();
    const snapshot = lastGood ?? (await readSnapshot());
    return snapshot ? withSourceStatus(snapshot, "cache") : null;
  }
}

export function formatWorldCupShareLine(data: WorldCupData | null) {
  if (!data || !data.matches.length) return undefined;

  const [first, ...rest] = data.matches;
  const suffix = rest.length ? ` (+${rest.length})` : "";

  return `WK ${first.line}${suffix}`;
}

export function worldCupSourceClassName(sourceStatus?: SourceStatus) {
  return sourceTextClassName(sourceStatus);
}
