"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const DISPLAY = "[font-family:var(--font-display)]";

const RACE = [
  { label: "Bloc A", pct: 34, color: "var(--bloc-navy)" },
  { label: "Bloc B", pct: 28, color: "var(--warm)" },
  { label: "Bloc C", pct: 21, color: "var(--bloc-red)" },
];

/**
 * Aperçu produit du hero (« deck » de commandement). Les barres se remplissent
 * à l'entrée dans le viewport (IntersectionObserver) — animées via `scaleX`
 * (GPU, pas de layout) ; `prefers-reduced-motion` neutralise la transition
 * globalement, les barres apparaissent alors pleines d'emblée.
 */
export function LandingDeck() {
  const ref = useRef<HTMLDivElement>(null);
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
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="anim-slide-up relative lg:pl-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-floating">
        {/* Chrome navigateur */}
        <div className="flex items-center gap-1.5 border-b border-border/70 bg-surface-soft/50 px-3.5 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-bloc-red/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warm/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-2 rounded bg-canvas px-2 py-0.5 text-[10px] text-muted-foreground">mouvancia.fr/espace</span>
          <span className="ml-auto text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground">
            Lég. 2024 · T2
          </span>
        </div>
        <div className="space-y-3 p-4">
          {/* Objectif */}
          <div className="rounded-xl border border-warm/30 bg-warm/[0.07] p-3.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.06em] text-warm">
              <span>Objectif de campagne</span>
              <span className="font-bold normal-case tabular-nums text-foreground/75">8 240 / 11 134 voix</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-pill bg-surface-soft">
              <span
                className="block h-full origin-left rounded-pill bg-warm transition-transform duration-[1100ms] ease-[var(--ease-out-quint)]"
                style={{ width: "74%", transform: shown ? "scaleX(1)" : "scaleX(0)" }}
              />
            </div>
          </div>
          {/* Tête de course */}
          <div className="rounded-xl border border-border/70 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Tête de course · circonscription
            </p>
            <div className="mt-2.5 space-y-2">
              {RACE.map((r, i) => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <span className="w-12 shrink-0 text-[11px] text-foreground/70">{r.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-pill bg-surface-soft">
                    <span
                      className="block h-full origin-left rounded-pill transition-transform duration-[900ms] ease-[var(--ease-out-quint)]"
                      style={{
                        width: `${r.pct}%`,
                        background: r.color,
                        transform: shown ? "scaleX(1)" : "scaleX(0)",
                        transitionDelay: `${160 + i * 130}ms`,
                      }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums">{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          {/* Indicateurs clés du territoire */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/70 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Participation T2</p>
              <p className={cn(DISPLAY, "mt-1 text-[20px] font-bold leading-none tabular-nums")}>61,4 %</p>
            </div>
            <div className="rounded-xl border border-border/70 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Marge 1er / 2e</p>
              <p className={cn(DISPLAY, "mt-1 text-[20px] font-bold leading-none tabular-nums text-success")}>+4,8 pts</p>
            </div>
          </div>
        </div>
      </div>
      {/* Badge flottant « sentiment terrain » */}
      <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-border bg-surface px-3.5 py-2.5 shadow-floating sm:block">
        <p className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sentiment terrain</p>
        <p className={cn(DISPLAY, "text-[18px] font-bold leading-none text-success")}>58 % favorables</p>
      </div>
    </div>
  );
}

