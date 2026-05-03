import Link from "next/link";

type DetailShellProps = {
  title: string;
  kicker: string;
  sourceHref: string;
  children: React.ReactNode;
};

export default function DetailShell({
  title,
  kicker,
  sourceHref,
  children,
}: DetailShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(0,0,0,0.45))]" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-12">
        <nav className="mb-16 flex items-center justify-between gap-4 text-sm text-neutral-500">
          <Link
            href="/"
            className="transition hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            ← terug
          </Link>
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-white/30"
          >
            bron bekijken ↗
          </a>
        </nav>

        <header>
          <p className="text-sm uppercase tracking-[0.45em] text-neutral-500">
            {kicker}
          </p>
          <h1 className="mt-5 text-6xl font-black tracking-tight text-neutral-50 md:text-8xl">
            {title}
          </h1>
        </header>

        <div className="mt-12">{children}</div>
      </section>
    </main>
  );
}
