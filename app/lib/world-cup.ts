import { get, put } from "@vercel/blob";
import { sourceTextClassName, type SourceStatus } from "./metrics";

export type WorldCupMatch = {
  date: string;
  label: string;
  line: string;
  note: string;
  sourceStatus: SourceStatus;
  sourceName: string;
  sourceUrl: string;
  stage?: string;
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
        description?: string;
        state?: string;
      };
    };
    venue?: {
      fullName?: string;
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

const espnScoreboardUrl =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200";
const espnSourceUrl = "https://www.espn.com/soccer/scoreboard/_/league/fifa.world";
const snapshotPath = "world-cup/oranje/latest.json";
const requestTimeoutMs = 1_800;
const successTtlMs = 2 * 60 * 1000;
const failureCooldownMs = 5 * 60 * 1000;

let lastGood: WorldCupMatch | null = null;
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
    typeof payload.label === "string" &&
    typeof payload.line === "string" &&
    typeof payload.note === "string" &&
    typeof payload.sourceName === "string" &&
    typeof payload.sourceUrl === "string"
  );
}

function withSourceStatus(
  match: WorldCupMatch,
  sourceStatus: SourceStatus
): WorldCupMatch {
  return { ...match, sourceStatus };
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
    return isWorldCupMatch(payload) ? payload : null;
  } catch (error) {
    console.error("[world-cup] Blob snapshot read failed", error);
    return null;
  }
}

async function writeSnapshot(match: WorldCupMatch) {
  if (!isBlobConfigured()) return;

  try {
    const snapshot: Omit<WorldCupMatch, "sourceStatus"> = {
      date: match.date,
      label: match.label,
      line: match.line,
      note: match.note,
      sourceName: match.sourceName,
      sourceUrl: match.sourceUrl,
      stage: match.stage,
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
  const score =
    state !== "pre" || completed
      ? `${home?.score ?? "0"}-${away?.score ?? "0"}`
      : formatAmsterdamDateTime(event.date);
  const label =
    state === "in"
      ? "oranje live"
      : completed
        ? "laatste oranje"
        : "volgende oranje";
  const opponent = competitors.find((item) => !isNetherlands(item));
  const opponentName = teamName(opponent);
  const note =
    state === "in"
      ? "nu bezig"
      : completed
        ? "afgelopen"
        : `aftrap ${formatAmsterdamDateTime(event.date)}`;

  return {
    date: event.date,
    label,
    line: `${teamName(home)} - ${teamName(away)} · ${score}`,
    note: `${note} · tegen ${opponentName}`,
    sourceName: "ESPN",
    sourceStatus: "live",
    sourceUrl: espnSourceUrl,
    stage: competition.altGameNote,
  };
}

function pickOranjeMatch(events: EspnEvent[]) {
  const now = Date.now();
  const matches = events
    .map(toWorldCupMatch)
    .filter((match): match is WorldCupMatch => Boolean(match))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const live = matches.find((match) => match.label === "oranje live");
  if (live) return live;

  const next = matches.find((match) => new Date(match.date).getTime() >= now);
  if (next) return next;

  return matches[matches.length - 1] ?? null;
}

async function fetchWorldCupMatch() {
  const res = await fetchWithTimeout(espnScoreboardUrl, requestTimeoutMs);

  if (!res.ok) {
    throw new Error(`ESPN World Cup request failed: ${res.status}`);
  }

  const data = (await res.json()) as EspnScoreboard;
  const match = pickOranjeMatch(data.events ?? []);

  if (!match) {
    throw new Error("No Oranje match found in ESPN World Cup scoreboard");
  }

  return match;
}

export async function getWorldCupMatch(): Promise<WorldCupMatch | null> {
  const now = Date.now();

  if (lastGood && now - lastGoodAt < successTtlMs) {
    return withSourceStatus(lastGood, "live");
  }

  if (lastFailureAt && now - lastFailureAt < failureCooldownMs) {
    const snapshot = lastGood ?? (await readSnapshot());
    return snapshot ? withSourceStatus(snapshot, "cache") : null;
  }

  try {
    const match = await fetchWorldCupMatch();
    lastGood = match;
    lastGoodAt = Date.now();
    lastFailureAt = 0;
    await writeSnapshot(match);
    return withSourceStatus(match, "live");
  } catch (error) {
    console.error("[world-cup] live fetch failed", error);
    lastFailureAt = Date.now();
    const snapshot = lastGood ?? (await readSnapshot());
    return snapshot ? withSourceStatus(snapshot, "cache") : null;
  }
}

export function worldCupSourceClassName(sourceStatus?: SourceStatus) {
  return sourceTextClassName(sourceStatus);
}
