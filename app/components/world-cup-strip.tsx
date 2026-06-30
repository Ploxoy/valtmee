import Link from "next/link";
import {
  worldCupSourceClassName,
  type WorldCupData,
  type WorldCupMatch,
} from "../lib/world-cup";

function MatchLine({
  label,
  match,
  empty,
}: {
  label: string;
  match: WorldCupMatch | null;
  empty: string;
}) {
  return (
    <div className="grid gap-1 border-t border-black/15 py-3 first:border-t-0 sm:grid-cols-[7rem_1fr] sm:gap-4">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-black/55">
        {label}
      </div>
      <div>
        <div className="text-xl font-black leading-tight tracking-tight text-black md:text-2xl">
          {match?.line ?? empty}
        </div>
        {match && (
          <div className="mt-1 text-sm font-semibold text-black/60">
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

  const nextEmpty =
    worldCup.last && !worldCup.last.isNetherlandsWinner
      ? "Oranje uitgeschakeld"
      : "nog niet bekend";

  return (
    <Link
      href={worldCup.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group mb-10 block rounded-[1.75rem] border border-orange-200/50 bg-[#ff7a00] p-5 text-black shadow-2xl shadow-black/35 transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff8a14] focus:outline-none focus:ring-2 focus:ring-orange-200/70 md:p-6"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.32em] text-black/55">
            WK · Oranje
          </div>
          <div className="mt-1 text-3xl font-black leading-none tracking-tight text-black md:text-5xl">
            voetbalstand
          </div>
        </div>
        <div className="shrink-0 text-sm font-bold text-black/55 transition group-hover:text-black/75">
          bron{" "}
          <span className={worldCupSourceClassName(worldCup.sourceStatus)}>
            {worldCup.sourceName}
          </span>{" "}
          ↗
        </div>
      </div>

      <div className="rounded-[1.25rem] bg-black/[0.06] px-4">
        <MatchLine
          label="laatste"
          match={worldCup.last}
          empty="nog geen vorige wedstrijd"
        />
        <MatchLine
          label="live"
          match={worldCup.live}
          empty="nu geen wedstrijd"
        />
        <MatchLine
          label="volgende"
          match={worldCup.next}
          empty={nextEmpty}
        />
      </div>
    </Link>
  );
}
