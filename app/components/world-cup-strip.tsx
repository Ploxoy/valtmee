import Link from "next/link";
import {
  getWorldCupMatch,
  worldCupSourceClassName,
} from "../lib/world-cup";

export default async function WorldCupStrip() {
  const match = await getWorldCupMatch();

  if (!match) return null;

  return (
    <Link
      href={match.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-5 block rounded-[1.5rem] border border-orange-300/15 bg-orange-300/[0.055] px-5 py-4 text-sm shadow-2xl shadow-black/20 backdrop-blur transition duration-300 hover:border-orange-300/25 hover:bg-orange-300/[0.08] focus:outline-none focus:ring-2 focus:ring-orange-200/30"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.24em] text-orange-200/70">
            WK · {match.label}
          </div>
          <div className="mt-2 truncate text-lg font-black tracking-tight text-neutral-100">
            {match.line}
          </div>
          <div className="mt-1 text-neutral-500">
            {match.note}
            {match.stage ? ` · ${match.stage}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-neutral-600 transition group-hover:text-neutral-400">
          bron{" "}
          <span className={worldCupSourceClassName(match.sourceStatus)}>
            {match.sourceName}
          </span>{" "}
          ↗
        </div>
      </div>
    </Link>
  );
}
