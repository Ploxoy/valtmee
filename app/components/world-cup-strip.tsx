import Link from "next/link";
import {
  worldCupSourceClassName,
  type WorldCupData,
  type WorldCupMatch,
} from "../lib/world-cup";

function MatchLine({
  empty,
  label,
  match,
}: {
  empty: string;
  label: string;
  match?: WorldCupMatch;
}) {
  return (
    <div className="grid gap-1 border-t border-white/10 py-3 first:border-t-0 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-neutral-600">
        {label}
      </div>
      <div>
        <div className="text-xl font-black leading-tight tracking-tight text-neutral-100 md:text-2xl">
          {match?.line ?? empty}
        </div>
        {match && (
          <div className="mt-1 text-sm font-medium text-neutral-500">
            {match.note}
            {match.stage ? ` · ${match.stage}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorldCupStrip({
  worldCup,
}: {
  worldCup: WorldCupData | null;
}) {
  if (!worldCup) return null;

  const last = worldCup.done[worldCup.done.length - 1];
  const live = worldCup.live[0];
  const next = worldCup.next[0];

  return (
    <Link
      href={worldCup.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-10 block rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/30 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075] focus:outline-none focus:ring-2 focus:ring-white/30 md:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.32em] text-neutral-500">
            WK vandaag
          </div>
          <div className="mt-1 text-3xl font-black leading-none tracking-tight text-neutral-50 md:text-5xl">
            {worldCup.headline}
          </div>
        </div>
        <div className="shrink-0 text-sm font-medium text-neutral-600 transition group-hover:text-neutral-400">
          bron{" "}
          <span className={worldCupSourceClassName(worldCup.sourceStatus)}>
            {worldCup.sourceName}
          </span>{" "}
          ↗
        </div>
      </div>

      <div className="rounded-[1.25rem] bg-black/10 px-4">
        <MatchLine label="laatste" match={last} empty="nog geen uitslag" />
        <MatchLine label="live" match={live} empty="nu geen wedstrijd" />
        <MatchLine label="volgende" match={next} empty="nog niet bekend" />
      </div>
    </Link>
  );
}
