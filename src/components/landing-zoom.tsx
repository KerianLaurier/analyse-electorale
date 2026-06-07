"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const DISPLAY = "[font-family:var(--font-display)]";

// Ordonné par granularité croissante : « du national au bureau de vote ».
const STEPS = [
  { n: "01", img: "/landing/zoom-1-national.webp", level: "National", count: "18 régions", desc: "Le rapport de force d'un coup d'œil sur toute la France." },
  { n: "02", img: "/landing/zoom-2-departement.webp", level: "Département", count: "96 départements", desc: "On resserre sur les bascules territoriales." },
  { n: "03", img: "/landing/zoom-4-circonscription.webp", level: "Circonscription", count: "559 circonscriptions", desc: "L'échelle du mandat législatif, siège par siège." },
  { n: "04", img: "/landing/zoom-3-commune.webp", level: "Commune", count: "35 798 communes", desc: "La maille du terrain et de la sociologie INSEE." },
  { n: "05", img: "/landing/zoom-5-bureau.webp", level: "Bureau de vote", count: "≈ 69 000 bureaux", desc: "Le grain le plus fin — jusqu'au bureau près de chez vous." },
];

function Row({ step, i }: { step: (typeof STEPS)[number]; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const imgRight = i % 2 === 0;
  return (
    <div
      ref={ref}
      className={cn(
        "grid items-center gap-6 transition-all duration-700 ease-[var(--ease-out-quint)] lg:grid-cols-2 lg:gap-14",
        shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      )}
    >
      <div className={imgRight ? "lg:order-1" : "lg:order-2"}>
        <div className="flex items-baseline gap-3">
          <span className={cn(DISPLAY, "text-[13px] font-bold tabular-nums text-warm")}>{step.n}</span>
          <span aria-hidden className="h-px w-8 bg-border" />
        </div>
        <h3 className={cn(DISPLAY, "mt-3 text-[clamp(1.5rem,3vw,2.1rem)] font-extrabold tracking-[-0.02em]")}>{step.level}</h3>
        <p className={cn(DISPLAY, "mt-1 text-[15px] font-bold text-warm")}>{step.count}</p>
        <p className="mt-2.5 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">{step.desc}</p>
      </div>
      <div className={cn("overflow-hidden rounded-2xl border border-border bg-surface shadow-floating", imgRight ? "lg:order-2" : "lg:order-1")}>
        <Image
          src={step.img}
          width={1600}
          height={970}
          alt={`Explorer MOUVANCIA — échelle ${step.level.toLowerCase()}`}
          sizes="(min-width: 1024px) 48vw, 100vw"
          className="block h-auto w-full"
        />
      </div>
    </div>
  );
}

/** Séquence de zoom « du national au bureau de vote » — captures réelles de l'Explorer. */
export function LandingZoom() {
  return (
    <div className="flex flex-col gap-14 lg:gap-24">
      {STEPS.map((s, i) => (
        <Row key={s.n} step={s} i={i} />
      ))}
    </div>
  );
}
