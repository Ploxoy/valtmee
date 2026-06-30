import Link from "next/link";
import {
  worldCupSourceClassName,
  type WorldCupData,
  type WorldCupMatch,
} from "../lib/world-cup";

function MatchLine({ match }: { match: WorldCupMatch }) {
  return (
    <div className="border-t border-white/10 py-3 first:border-t-0">
      <div className="text-xl font-black leading-tight tracking-tight text-neutral-100 md:text-2xl">
        {match.line}
      </div>
      <div className="mt-1 text-sm font-medium text-neutral-500">
        {match.note}
        {match.stage ? ` · ${match.stage}` : ""}
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
        {worldCup.matches.map((match) => (
          <MatchLine key={`${match.date}-${match.line}`} match={match} />
        ))}
      </div>
    </Link>
  );
}
