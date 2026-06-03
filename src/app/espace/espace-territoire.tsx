"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  MapPin,
  Map as MapIcon,
  Building2,
  Vote,
  Target,
  ArrowRight,
  Loader2,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePins, useLoaded as usePinsLoaded } from "@/lib/pins";
import { useCampaign, useLoaded as useCampaignLoaded } from "@/lib/campaign";
import { useCircoHistory, type CircoTimelinePoint } from "@/lib/queries";
import { TabSkeleton } from "@/components/skeleton";
import { marginDiagnostic } from "@/lib/analysis";
import { nuanceLabel } from "@/lib/nuances";
import { type Scrutin } from "@/lib/url-state";

const fmtPct = (n: number, d = 0) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtPts = (n: number) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;

export function EspaceTerritoire() {
  const pins = usePins();
  const campaign = useCampaign();
  const pinsLoaded = usePinsLoaded();
  const campaignLoaded = useCampaignLoaded();
  const target = campaign?.target ?? null;
  const targetCircoId = target?.type === "circo" ? target.id : null;

  const circos = useMemo(
    () => pins.filter((p) => p.type === "circo" && p.id !== targetCircoId),
    [pins, targetCircoId],
  );
  const communes = useMemo(() => pins.filter((p) => p.type === "commune"), [pins]);
  const bureaux = useMemo(() => pins.filter((p) => p.type === "bureau"), [pins]);

  if (!pinsLoaded || !campaignLoaded) return <TabSkeleton rows={4} controls={false} />;
  const geoCount = circos.length + communes.length + bureaux.length + (targetCircoId ? 1 : 0);

  if (!target && geoCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <MapPin className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Aucun territoire suivi</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Définissez votre circonscription cible dans l’onglet Campagne, ou épinglez des
          territoires depuis l’explorateur pour les analyser en un clic ici.
        </p>
        <Link
          href="/explorer"
          className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <MapIcon className="h-4 w-4" /> Explorer la carte
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Circonscription cible */}
      {target && (
        <section>
          <SectionTitle icon={Target}>Ma circonscription cible</SectionTitle>
          <div className="mt-3">
            {target.type === "circo" ? (
              <CircoSnapshot
                code={target.id}
                label={target.label}
                href={target.href || `/circo/${target.id}`}
                highlight
              />
            ) : (
              <SimpleTerritoryCard
                icon={Building2}
                label={target.label}
                sublabel="Territoire cible"
                href={target.href}
                highlight
              />
            )}
          </div>
        </section>
      )}

      {/* Circonscriptions épinglées */}
      {circos.length > 0 && (
        <section>
          <SectionTitle icon={MapIcon}>Circonscriptions épinglées · {circos.length}</SectionTitle>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {circos.map((p) => (
              <CircoSnapshot key={p.id} code={p.id} label={p.label} href={p.href} />
            ))}
          </div>
        </section>
      )}

      {/* Communes */}
      {communes.length > 0 && (
        <section>
          <SectionTitle icon={Building2}>Communes épinglées · {communes.length}</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {communes.map((p) => (
              <SimpleTerritoryCard key={p.id} icon={Building2} label={p.label} sublabel={p.sublabel} href={p.href} />
            ))}
          </div>
        </section>
      )}

      {/* Bureaux */}
      {bureaux.length > 0 && (
        <section>
          <SectionTitle icon={Vote}>Bureaux épinglés · {bureaux.length}</SectionTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {bureaux.map((p) => (
              <SimpleTerritoryCard key={p.id} icon={Vote} label={p.label} sublabel={p.sublabel} href={p.href} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Carte d'analyse rapide d'une circonscription (diagnostic + leader + marge). */
function CircoSnapshot({
  code,
  label,
  href,
  highlight,
}: {
  code: string;
  label: string;
  href: string;
  highlight?: boolean;
}) {
  const history = useCircoHistory(code);

  const snapshot = useMemo(() => {
    const data = history.data ?? [];
    const byScrutin = new Map<Scrutin, CircoTimelinePoint>();
    for (const p of data) byScrutin.set(p.scrutin, p);
    const latest = byScrutin.get("legis-2024-t2") ?? byScrutin.get("legis-2024-t1") ?? null;
    if (!latest) return null;
    const winner = latest.candidates[0] ?? null;
    const runnerUp = latest.candidates[1] ?? null;
    const margin = winner && runnerUp ? winner.pct - runnerUp.pct : null;
    return { latest, winner, margin, diag: marginDiagnostic(margin) };
  }, [history.data]);

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border p-4 shadow-card transition-colors",
        highlight ? "border-warm/30 bg-warm/[0.06] hover:bg-warm/[0.1]" : "border-foreground/5 bg-surface hover:border-warm/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            <MapIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
          </p>
          {highlight && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-warm/15 px-1.5 py-0.5 text-[10px] font-medium text-warm">
              <Target className="h-3 w-3" /> Cible
            </span>
          )}
        </div>
        {snapshot && (
          <span className={cn("shrink-0 text-[12px] font-semibold", snapshot.diag.tone)}>
            {snapshot.diag.label}
          </span>
        )}
      </div>

      {history.isLoading ? (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyse en cours…
        </span>
      ) : !snapshot ? (
        <span className="text-[12px] text-muted-foreground">Données électorales indisponibles.</span>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {snapshot.winner && (
            <span className="text-muted-foreground">
              En tête :{" "}
              <span className="font-medium text-foreground">
                {snapshot.winner.label || nuanceLabel(snapshot.winner.nuance)}
              </span>{" "}
              · {fmtPct(snapshot.winner.pct, 1)}
            </span>
          )}
          {snapshot.margin != null && (
            <span className="text-muted-foreground">
              Marge <span className="font-medium text-foreground tabular-nums">+{fmtPts(snapshot.margin)}</span>
            </span>
          )}
          <span className="text-muted-foreground">
            Part. <span className="tabular-nums">{fmtPct(snapshot.latest.participation)}</span>
          </span>
        </div>
      )}

      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-warm">
        <Crosshair className="h-3.5 w-3.5" /> Analyse stratégique
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function SimpleTerritoryCard({
  icon: Icon,
  label,
  sublabel,
  href,
  highlight,
}: {
  icon: typeof Building2;
  label: string;
  sublabel?: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border p-3.5 shadow-card transition-colors",
        highlight ? "border-warm/30 bg-warm/[0.06] hover:bg-warm/[0.1]" : "border-foreground/5 bg-surface hover:border-warm/40",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{label}</span>
        {sublabel && <span className="block truncate text-[11.5px] text-muted-foreground">{sublabel}</span>}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {children}
    </h2>
  );
}
