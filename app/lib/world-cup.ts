import { get, put } from "@vercel/blob";
import { sourceTextClassName, type SourceStatus } from "./metrics";

export type WorldCupMatchSlot = "last" | "live" | "next";

export type WorldCupMatch = {
  date: string;
  isNetherlandsWinner: boolean;
  line: string;
  note: string;
  slot: WorldCupMatchSlot;
  stage?: string;
};

export type WorldCupData = {
  last: WorldCupMatch | null;
  live: WorldCupMatch | null;
  next: WorldCupMatch | null;
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
    notes?: Array<{
      headline?: string;
      text?: string;
    }>;
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
  winner?: boolean;
  team?: {
    abbreviation?: string;
    displayName?: string;
    shortDisplayName?: string;
  };
};

const espnScoreboardUrl =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const espnSourceUrl = "https://www.espn.com/soccer/scoreboard/_/league/fifa.world";
const snapshotPath = "world-cup/oranje/latest.json";
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
    typeof payload.isNetherlandsWinner === "boolean" &&
    typeof payload.line === "string" &&
    typeof payload.note === "string" &&
    (payload.slot === "last" || payload.slot === "live" || payload.slot === "next")
  );
}

function isWorldCupData(value: unknown): value is WorldCupData {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<WorldCupData>;
  return (
    (payload.last === null || isWorldCupMatch(payload.last)) &&
    (payload.live === null || isWorldCupMatch(payload.live)) &&
    (payload.next === null || isWorldCupMatch(payload.next)) &&
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
      last: data.last,
      live: data.live,
      next: data.next,
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

function isNetherlands(competitor: EspnCompetitor) {
  return (
    competitor.team?.abbreviation === "NED" ||
    competitor.team?.displayName === "Netherlands"
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

function formatAdvanceNote(note?: string) {
  const match = note?.match(/^(.+) advance ([\\d-]+) on penalties$/i);

  if (!match) return undefined;

  return `${match[1]} door na penalty's (${match[2]})`;
}

function toWorldCupMatch(event: EspnEvent): WorldCupMatch | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const netherlands = competitors.find(isNetherlands);

  if (!event.date || !competition || !netherlands) return null;

  const home = competitors.find((item) => item.homeAway === "home");
  const away = competitors.find((item) => item.homeAway === "away");
  const status = competition.status?.type;
  const state = status?.state ?? "pre";
  const completed = status?.completed === true;
  const isNetherlandsWinner = netherlands.winner === true;
  const slot: WorldCupMatchSlot =
    state === "in" ? "live" : completed ? "last" : "next";
  const score =
    slot === "live" || slot === "last"
      ? `${home?.score ?? "0"}-${away?.score ?? "0"}`
      : formatAmsterdamDateTime(event.date);
  const advanceNote = formatAdvanceNote(
    competition.notes?.[0]?.headline ?? competition.notes?.[0]?.text
  );
  const note =
    slot === "live"
      ? "nu bezig"
      : slot === "last"
        ? advanceNote ?? "afgelopen"
        : `aftrap ${formatAmsterdamDateTime(event.date)}`;

  return {
    date: event.date,
    isNetherlandsWinner,
    line: `${teamName(home)} - ${teamName(away)} · ${score}`,
    note,
    slot,
    stage: competition.altGameNote,
  };
}

function pickOranjeData(events: EspnEvent[]): WorldCupData | null {
  const now = Date.now();
  const matches = events
    .map(toWorldCupMatch)
    .filter((match): match is WorldCupMatch => Boolean(match))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!matches.length) return null;

  const live = matches.find((match) => match.slot === "live") ?? null;
  const past = matches.filter((match) => match.slot === "last");
  const future = matches.filter(
    (match) => match.slot === "next" && new Date(match.date).getTime() >= now
  );

  return {
    last: past[past.length - 1] ?? null,
    live,
    next: future.find((match) => match.slot !== "live") ?? null,
    sourceName: "ESPN",
    sourceStatus: "live",
    sourceUrl: espnSourceUrl,
  };
}

async function fetchWorldCupData() {
  const res = await fetchWithTimeout(espnScoreboardUrl, requestTimeoutMs);

  if (!res.ok) {
    throw new Error(`ESPN World Cup request failed: ${res.status}`);
  }

  const data = (await res.json()) as EspnScoreboard;
  const worldCup = pickOranjeData(data.events ?? []);

  if (!worldCup) {
    throw new Error("No Oranje match found in ESPN World Cup scoreboard");
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
  if (!data) return undefined;

  const parts = [
    data.last ? `laatste ${data.last.line}` : null,
    data.live ? `live ${data.live.line}` : null,
    data.next ? `volgende ${data.next.line}` : null,
  ].filter(Boolean);

  return parts.length ? `WK Oranje: ${parts.join(" · ")}` : undefined;
}

export function worldCupSourceClassName(sourceStatus?: SourceStatus) {
  return sourceTextClassName(sourceStatus);
}
