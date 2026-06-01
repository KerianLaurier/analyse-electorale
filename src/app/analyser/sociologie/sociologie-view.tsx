"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Choropleth } from "@/components/map";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import { type Maille } from "@/lib/map-config";
import {
  BLOCS,
  SOCIO_INDICATORS,
  socioMeta,
  useSocioByMaille,
  useSocioFeaturesCirco,
  useCircoBlocMatrix,
  pearson,
  type SocioIndicator,
  type SocioUnit,
} from "@/lib/analysis";

const MapView = dynamic(() => import("@/components/map").then((m) => m.Map), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center text-[12px] text-muted-foreground">
      Chargement de la carte…
    </div>
  ),
});

const ELECTIONS = (Object.keys(SCRUTIN_META) as Scrutin[]).filter(
  (s) => SCRUTIN_META[s].family !== "sociologie" && SCRUTIN_META[s].mailles.includes("circonscriptions"),
);

const MAILLES: { id: Maille; label: string }[] = [
  { id: "circonscriptions", label: "Circonscriptions" },
  { id: "communes", label: "Communes" },
];

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
function fmtSocio(v: number, unit: SocioUnit): string {
  if (unit === "euro") return `${fmtInt(v)} €`;
  if (unit === "ratio") return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}×`;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

// Échelle séquentielle claire → ambre → brun (palette warm de l'app).
const RAMP_LO = "#f8fafc";
const RAMP_MID = "#fbbf24";
const RAMP_HI = "#b45309";

export function SociologieView() {
  const [indicator, setIndicator] = useState<SocioIndicator>("revenu");
  const [maille, setMaille] = useState<Maille>("circonscriptions");
  const [scrutin, setScrutin] = useState<Scrutin>("legis-2024-t1");
  const [profileCode, setProfileCode] = useState<string>("");

  const meta = socioMeta(indicator);
  const socio = useSocioByMaille(indicator, maille);
  const features = useSocioFeaturesCirco();
  const matrix = useCircoBlocMatrix(scrutin);

  // ── Stats nationales + échelle de la carte ─────────────────────────────
  const stats = useMemo(() => {
    const values = socio.data ? [...socio.data.values()].filter((v) => Number.isFinite(v)).sort((a, b) => a - b) : [];
    if (values.length === 0) return null;
    const lo = quantile(values, 0.05);
    const hi = quantile(values, 0.95);
    return { values, n: values.length, median: quantile(values, 0.5), min: values[0], max: values[values.length - 1], lo, hi };
  }, [socio.data]);

  const choropleth = useMemo<Choropleth | undefined>(() => {
    if (!socio.data || !stats) return undefined;
    let { lo, hi } = stats;
    if (!(lo < hi)) {
      lo = stats.min;
      hi = stats.max || stats.min + 1;
    }
    const mid = (lo + hi) / 2;
    return {
      stateKey: "socio",
      data: [...socio.data].map(([code, value]) => ({ code, value })),
      paint: [
        "interpolate", ["linear"], ["feature-state", "socio"],
        lo, RAMP_LO, mid, RAMP_MID, hi, RAMP_HI,
      ] as unknown as Choropleth["paint"],
    };
  }, [socio.data, stats]);

  // ── Corrélation indicateur × vote par bloc (au niveau circonscription) ──
  const correlations = useMemo(() => {
    const feat = features.data;
    const mat = matrix.data;
    if (!feat || !mat) return null;
    const idx = SOCIO_INDICATORS.findIndex((s) => s.id === indicator);
    if (idx < 0) return null;
    return BLOCS.map((b) => {
      const pairs: Array<[number, number]> = [];
      for (const c of mat.circos) {
        const vec = feat.get(c.code);
        const x = vec?.[idx];
        if (x != null && Number.isFinite(x)) pairs.push([x, c.shares[b.id]]);
      }
      return { bloc: b, r: pearson(pairs), n: pairs.length };
    });
  }, [features.data, matrix.data, indicator]);

  // ── Profil d'une circonscription vs moyenne nationale ──────────────────
  const circoList = useMemo(
    () =>
      (matrix.data?.circos ?? [])
        .map((c) => ({ code: c.code, libelle: c.libelle ?? c.code }))
        .sort((a, b) => a.libelle.localeCompare(b.libelle, "fr")),
    [matrix.data],
  );

  const nationalMeans = useMemo(() => {
    const feat = features.data;
    if (!feat) return null;
    const sums = new Array(SOCIO_INDICATORS.length).fill(0);
    const counts = new Array(SOCIO_INDICATORS.length).fill(0);
    for (const vec of feat.values()) {
      vec.forEach((v, i) => {
        if (Number.isFinite(v)) {
          sums[i] += v;
          counts[i] += 1;
        }
      });
    }
    return sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  }, [features.data]);

  const profile = useMemo(() => {
    if (!profileCode || !features.data || !nationalMeans) return null;
    const vec = features.data.get(profileCode);
    if (!vec) return null;
    return SOCIO_INDICATORS.map((s, i) => ({
      meta: s,
      value: vec[i],
      national: nationalMeans[i],
      ratio: nationalMeans[i] ? vec[i] / nationalMeans[i] - 1 : 0,
    }));
  }, [profileCode, features.data, nationalMeans]);

  const isLoading = socio.isFetching || features.isFetching || matrix.isFetching;

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3 overflow-auto bg-canvas p-3">
      <div className="flex items-end justify-between gap-4 px-2 pt-2">
        <div>
          <Link href="/analyser" className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Analyser
          </Link>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Sociologie des territoires</h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Cartographie des indicateurs INSEE (revenus, CSP, âge, diplômes…) et leur corrélation avec le vote.
          </p>
        </div>
        {isLoading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Contrôles */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-4 shadow-card">
        <Field label="Indicateur">
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as SocioIndicator)}
            className="rounded-pill bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground outline-none"
          >
            {SOCIO_INDICATORS.map((s) => (
              <option key={s.id} value={s.id} className="bg-surface text-foreground">{s.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Maille (carte)">
          <Segmented
            value={maille}
            options={MAILLES}
            onChange={(v) => setMaille(v as Maille)}
          />
        </Field>
        <Field label="Scrutin (corrélation)">
          <select
            value={scrutin}
            onChange={(e) => setScrutin(e.target.value as Scrutin)}
            className="rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground/80 outline-none"
          >
            {ELECTIONS.map((s) => (
              <option key={s} value={s} className="bg-surface text-foreground">{SCRUTIN_META[s].short}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* KPIs nationaux */}
      <div className="grid grid-cols-4 gap-2">
        <KPICard label={`${meta.label} — médiane`} value={stats ? fmtSocio(stats.median, meta.unit) : "—"} />
        <KPICard label="Minimum" value={stats ? fmtSocio(stats.min, meta.unit) : "—"} />
        <KPICard label="Maximum" value={stats ? fmtSocio(stats.max, meta.unit) : "—"} />
        <KPICard label="Territoires" value={stats ? fmtInt(stats.n) : "—"} />
      </div>

      <div className="grid min-h-[480px] grid-cols-[1fr_400px] gap-2">
        {/* Carte */}
        <div className="flex flex-col overflow-hidden rounded-lg bg-surface shadow-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Carte</p>
            <p className="mt-0.5 text-[13px] font-medium">{meta.label}</p>
          </div>
          <div className="relative min-h-0 flex-1">
            <MapView className="h-full w-full" maille={maille} choropleth={choropleth} />
          </div>
          {stats && (
            <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2 text-[10.5px] text-muted-foreground">
              <span>{fmtSocio(stats.lo, meta.unit)}</span>
              <span className="h-2 flex-1 rounded-full" style={{ background: `linear-gradient(to right, ${RAMP_LO}, ${RAMP_MID}, ${RAMP_HI})` }} />
              <span>{fmtSocio(stats.hi, meta.unit)}</span>
            </div>
          )}
        </div>

        {/* Corrélation + profil */}
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <div className="rounded-lg bg-surface p-4 shadow-card">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Corrélation avec le vote</p>
            <p className="mt-0.5 text-[12.5px] font-medium">{meta.label} × score par bloc</p>
            <p className="text-[10.5px] text-muted-foreground">{SCRUTIN_META[scrutin].short} · par circonscription</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {correlations ? (
                correlations.map(({ bloc, r }) => <CorrBar key={bloc.id} label={bloc.label} color={bloc.color} r={r} />)
              ) : (
                <p className="py-4 text-center text-[12px] text-muted-foreground">Calcul…</p>
              )}
            </div>
            <p className="mt-3 inline-flex items-start gap-1 text-[10px] leading-snug text-muted-foreground/80">
              <Info className="mt-px h-3 w-3 shrink-0" />
              r ∈ [−1, +1] : signe = sens du lien, valeur = intensité. Corrélation ≠ causalité.
            </p>
          </div>

          <div className="rounded-lg bg-surface p-4 shadow-card">
            <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Profil sociologique</p>
            <select
              value={profileCode}
              onChange={(e) => setProfileCode(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12.5px] outline-none focus:border-warm focus:ring-2 focus:ring-warm/20"
            >
              <option value="">Choisir une circonscription…</option>
              {circoList.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.libelle}</option>
              ))}
            </select>
            {profile ? (
              <div className="mt-3 flex flex-col gap-2">
                {profile.map((p) => (
                  <ProfileRow key={p.meta.id} label={p.meta.label} value={fmtSocio(p.value, p.meta.unit)} ratio={p.ratio} />
                ))}
                <p className="mt-1 text-[10px] text-muted-foreground/80">Écart relatif à la moyenne nationale des circonscriptions.</p>
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Sélectionnez une circonscription pour comparer son profil à la moyenne nationale.
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="px-2 text-[10.5px] text-muted-foreground/70">
        Sources INSEE : Filosofi 2021 (revenus, pauvreté, inégalités, prestations) et Recensement 2022 (âge, CSP,
        chômage, diplômes), agrégés par circonscription (pondéré population) et disponibles à la commune.
      </p>
    </div>
  );
}

function CorrBar({ label, color, r }: { label: string; color: string; r: number }) {
  const pct = Math.min(50, Math.abs(r) * 50); // demi-largeur (0..50 %)
  const positive = r >= 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> {label}
        </span>
        <span className={cn("font-semibold tabular-nums", positive ? "text-emerald-600" : "text-red-600")}>
          {r >= 0 ? "+" : ""}{r.toFixed(2)}
        </span>
      </div>
      <div className="relative mt-1 h-2 rounded-full bg-black/[0.05]">
        <span className="absolute left-1/2 top-0 h-full w-px bg-black/15" />
        <span
          className="absolute top-0 h-full rounded-full"
          style={{
            background: color,
            width: `${pct}%`,
            left: positive ? "50%" : `${50 - pct}%`,
          }}
        />
      </div>
    </div>
  );
}

function ProfileRow({ label, value, ratio }: { label: string; value: string; ratio: number }) {
  const pct = Math.round(ratio * 100);
  const tone = Math.abs(pct) < 5 ? "text-muted-foreground" : pct > 0 ? "text-emerald-600" : "text-red-600";
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 font-medium tabular-nums">{value}</span>
      <span className={cn("w-14 shrink-0 text-right text-[11px] font-medium tabular-nums", tone)}>
        {pct >= 0 ? "+" : ""}{pct} %
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-pill px-2.5 py-1 text-[12px] font-medium transition-colors",
            value === o.id ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-4 shadow-card">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}
