import DashboardWidget from "./components/dashboard-widget";
import { getMetrics } from "./lib/metrics";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getMetrics();

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.45))]" />

      <DashboardWidget initialData={data} />
    </main>
  );
}
