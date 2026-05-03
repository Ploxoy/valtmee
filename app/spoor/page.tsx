import DetailShell from "../components/detail-shell";
import {
  getMetrics,
  getSpoorStatus,
  metricSources,
  parseSpoor,
} from "../lib/metrics";

export const dynamic = "force-dynamic";

export default async function SpoorPage() {
  const data = await getMetrics();
  const trains = data.storingen;
  const { storingen, werkzaamheden } = parseSpoor(trains.value);
  const status = getSpoorStatus(storingen);
  const details = trains.details?.trains;

  return (
    <DetailShell title="Spoor" kicker="ns nu" sourceHref={metricSources.trains}>
      <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
            {status}
          </div>
          <div className="mt-5 text-6xl font-black tracking-tight">
            {storingen}
          </div>
          <div className="mt-5 text-xl text-neutral-300">actieve storingen</div>
          <div className="mt-4 space-y-1 text-sm text-neutral-500">
            <div>{werkzaamheden} werkzaamheden</div>
            <div>{details?.totalActive ?? storingen + werkzaamheden} actieve meldingen totaal</div>
            <div>calamiteiten apart gehouden</div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7 shadow-2xl shadow-black/30 backdrop-blur">
          <h2 className="text-sm uppercase tracking-[0.28em] text-neutral-500">
            werkzaamheden
          </h2>
          <MessageList
            empty="Geen actieve werkzaamheden."
            items={details?.maintenance ?? []}
          />

          <h2 className="mt-8 text-sm uppercase tracking-[0.28em] text-neutral-500">
            storingen
          </h2>
          <MessageList
            empty="Geen actieve storingen."
            items={details?.disruptions ?? []}
          />

          {details && details.calamities.length > 0 && (
            <>
              <h2 className="mt-8 text-sm uppercase tracking-[0.28em] text-neutral-500">
                calamiteiten
              </h2>
              <MessageList empty="" items={details.calamities} />
            </>
          )}
        </section>
      </div>
    </DetailShell>
  );
}

function MessageList({
  empty,
  items,
}: {
  empty: string;
  items: Array<{ title: string; route: string }>;
}) {
  if (!items.length) {
    return <p className="mt-4 text-sm text-neutral-500">{empty}</p>;
  }

  return (
    <div className="mt-4 divide-y divide-white/10">
      {items.map((item) => (
        <div key={`${item.title}-${item.route}`} className="py-3">
          <div className="text-sm font-semibold text-neutral-200">
            {item.title}
          </div>
          <div className="mt-1 text-sm text-neutral-500">{item.route}</div>
        </div>
      ))}
    </div>
  );
}
