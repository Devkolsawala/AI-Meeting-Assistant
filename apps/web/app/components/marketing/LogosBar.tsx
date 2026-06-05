const COMPANIES = [
  { name: "Nexlify", className: "font-semibold tracking-tight" },
  { name: "STRATEX", className: "font-bold uppercase tracking-widest" },
  { name: "Vantora", className: "font-light" },
  { name: "Orion AI", className: "font-semibold" },
  { name: "Cloudreach", className: "font-medium" },
  { name: "Luminex", className: "font-bold tracking-tight" },
  { name: "Praxis", className: "font-medium" },
  { name: "Arcadia", className: "font-semibold text-lg" },
];

function Wordmark({ name, className }: { name: string; className: string }) {
  return (
    <span
      className={`shrink-0 text-base text-[#0A0A0A] opacity-30 transition-opacity hover:opacity-70 ${className}`}
    >
      {name}
    </span>
  );
}

export function LogosBar() {
  return (
    <section className="border-y border-[var(--color-border)] bg-white py-12">
      <p className="mb-8 text-center text-xs font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
        Trusted by teams at fast-moving companies
      </p>

      {/* Desktop: static centered row */}
      <div className="mx-auto hidden max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-6 md:flex">
        {COMPANIES.map((c) => (
          <Wordmark key={c.name} name={c.name} className={c.className} />
        ))}
      </div>

      {/* Mobile: seamless marquee (list duplicated) */}
      <div className="relative overflow-hidden md:hidden">
        <div className="flex w-max animate-marquee items-center gap-10 px-6">
          {[...COMPANIES, ...COMPANIES].map((c, i) => (
            <Wordmark key={`${c.name}-${i}`} name={c.name} className={c.className} />
          ))}
        </div>
      </div>
    </section>
  );
}
