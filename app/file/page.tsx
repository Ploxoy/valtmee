import DetailShell from "../components/detail-shell";
import { getFileStatus, getMetrics, metricSources } from "../lib/metrics";

export const dynamic = "force-dynamic";

export default async function FilePage() {
  const data = await getMetrics();
  const traffic = data.file;
  const status = getFileStatus(traffic.value);
  const details = traffic.details?.traffic;

  return (
    <DetailShell title="File" kicker="wegen nu" sourceHref={metricSources.traffic}>
      <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            {status}
          </div>
          <div className="mt-5 text-6xl font-black tracking-tight">
            {traffic.value}
          </div>
          <div className="mt-5 text-xl text-neutral-300">totale filelengte</div>
          <div className="mt-4 text-sm text-neutral-500">{traffic.note}</div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <h2 className="text-sm uppercase tracking-[0.28em] text-neutral-500">
            overzicht
          </h2>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div>
              <div className="text-3xl font-black text-neutral-100">
                {details?.count ?? "—"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">files</div>
            </div>
            <div>
              <div className="text-3xl font-black text-neutral-100">
                {details ? `${details.averageKm} km` : "—"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">gemiddeld</div>
            </div>
            <div>
              <div className="text-3xl font-black text-neutral-100">
                {details?.updatedAt ?? "—"}
              </div>
              <div className="mt-1 text-xs text-neutral-500">bijgewerkt</div>
            </div>
          </div>

          <h2 className="mt-8 text-sm uppercase tracking-[0.28em] text-neutral-500">
            langste files
          </h2>
          {details && details.staleCount > 0 && (
            <p className="mt-3 text-xs leading-5 text-neutral-600">
              {details.staleCount} oude NDW-meldingen genegeerd, omdat ze ouder
              zijn dan 6 uur.
            </p>
          )}
          <div className="mt-4 divide-y divide-white/10">
            {(details?.jams ?? []).map((jam) => (
              <div key={`${jam.roadNumber}-${jam.trajectory}`} className="py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-neutral-200">
                      {jam.roadNumber}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {jam.trajectory}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      {jam.province}
                    </div>
                    <div className="mt-1 text-xs text-neutral-600">
                      bijgewerkt {jam.updatedAt}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-neutral-200">
                    {jam.distanceKm} km
                  </div>
                </div>
              </div>
            ))}
            {!details?.jams?.length && (
              <p className="py-3 text-sm text-neutral-500">
                Geen filedetails beschikbaar.
              </p>
            )}
          </div>
        </section>
      </div>
    </DetailShell>
  );
}
