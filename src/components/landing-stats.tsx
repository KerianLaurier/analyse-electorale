"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DISPLAY = "[font-family:var(--font-display)]";

type Stat = { to?: number; fixed?: string; label: string };

const STATS: Stat[] = [
  { to: 10, label: "scrutins · 2017 → 2026" },
  { to: 35798, label: "communes couvertes" },
  { to: 577, label: "circonscriptions" },
  { fixed: "24/7", label: "sondages · votes AN · veille" },
];

const fmt = (n: number) => n.toLocaleString("fr-FR");

/** Bandeau de chiffres — les valeurs s'incrémentent à l'entrée dans le viewport. */
export function LandingStats() {
  const ref = useRef<HTMLDListElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="border-y border-border/70 bg-surface/40">
      <dl ref={ref} className="mx-auto grid max-w-6xl grid-cols-2 px-5 sm:px-8 md:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "border-border/70 py-7 sm:py-8",
              i % 2 === 1 && "border-l pl-5 sm:pl-8",
              i >= 2 && "border-t md:border-t-0",
              i >= 1 && "md:border-l",
              "md:pl-8 md:[&:first-child]:pl-0",
            )}
          >
            <dt className={cn(DISPLAY, "text-[clamp(1.9rem,3.4vw,2.7rem)] font-bold leading-none tracking-[-0.02em] tabular-nums")}>
              {s.fixed ?? <CountUp to={s.to ?? 0} run={shown} />}
            </dt>
            <dd className="mt-2 text-[12px] text-muted-foreground">{s.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function CountUp({ to, run }: { to: number; run: boolean }) {
  const [v, setV] = useState(0);

  useEffect(() => {
    if (!run) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setV(to);
      return;
    }
    const dur = 1200;
    const start = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      setV(Math.round(to * ease(t)));
      if (t < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [run, to]);

  return <>{fmt(v)}</>;
}
