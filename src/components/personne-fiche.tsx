"use client";

import Link from "next/link";
import { ArrowLeft, BadgeCheck, Loader2, Map as MapIcon, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrutinDetail } from "@/lib/queries";
import { useDeputes } from "@/lib/deputes";
import {
  useDeputesActivite,
  decodePosition,
  POSITION_META,
  type ActiviteScrutin,
  type DeputeActivite,
} from "@/lib/activite";
import { nuanceColor, nuanceLabel } from "@/lib/nuances";
import { PinButton } from "@/components/pin-button";
import { SCRUTIN_META, type Scrutin } from "@/lib/url-state";
import {
  usePersonnesIndex,
  lookupPersonne,
  deptFromCirco,
  candidatSlug,
  displayName,
} from "@/lib/personnes";

const fmtDateFr = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

const fmtInt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));
const fmtPct = (n: number, d = 1) =>
  `${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const fmtPts = (n: number) =>
  `${n >= 0 ? "+" : ""}${(n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts`;

const ORDINAL = (n: number) => (n === 1 ? "1ᵉʳ" : `${n}ᵉ`);

export function PersonneFiche({
  scrutin: scrutinRaw,
  circo,
  slug,
  mode,
}: {
  scrutin: string;
  circo: string;
  slug?: string;
  mode: "candidat" | "elu";
}) {
  const scrutin: Scrutin | null = scrutinRaw in SCRUTIN_META ? (scrutinRaw as Scrutin) : null;
  const detail = useScrutinDetail(scrutin, "circonscriptions", circo);
  const personnes = usePersonnesIndex();
  const deputes = useDeputes();
  const activite = useDeputesActivite();

  const candidates = detail.data?.candidates ?? [];
  const winner = candidates[0] ?? null;

  const targetIndex =
    mode === "elu"
      ? Math.max(0, candidates.findIndex((c) => c.elu))
      : candidates.findIndex((c) => candidatSlug(c.label) === slug);
  const target = targetIndex >= 0 ? candidates[targetIndex] ?? null : null;
  const rank = target ? candidates.indexOf(target) + 1 : null;

  const dept = deptFromCirco(circo);
  const personne = target
    ? lookupPersonne(personnes.data, dept, target.label, target.nuance)
    : null;

  // Député en exercice (open data AN) : on rapproche par circonscription si la
  // cible est l'élu·e. Source plus fiable et à jour pour l'identité + le groupe.
  const depute = target?.elu ? deputes.data?.get(circo) ?? null : null;
  const acti = depute?.uid ? activite.data?.deputes[depute.uid] ?? null : null;
  const actiScrutins = activite.data?.scrutins ?? [];
  const fullName = target
    ? depute?.nom
      ? `${depute.prenom ? `${depute.prenom} ` : ""}${depute.nom}`
      : displayName(target.label, personne)
    : "";

  const circoLibelle = detail.data?.libelle;
  const circoNum = Number(circo.slice(-2));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href={`/circo/${encodeURIComponent(circo)}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Circonscription
      </Link>

      {detail.isLoading ? (
        <Loading />
      ) : !target || !scrutin ? (
        <NotFound circo={circo} />
      ) : (
        <div className="mt-4 flex flex-col gap-7">
          <header className="flex flex-wrap items-center gap-4 border-b border-black/5 pb-5">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-white"
              style={{ background: nuanceColor(target.nuance) }}
            >
              {target.elu ? <Trophy className="h-6 w-6" /> : <span className="text-[18px] font-semibold">{ORDINAL(rank ?? 0)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {target.elu ? "Élu·e" : "Candidat·e"} · {SCRUTIN_META[scrutin].short}
              </p>
              <h1 className="truncate text-[22px] font-semibold tracking-tight">{fullName}</h1>
              <p className="text-[13px] text-muted-foreground">
                <span style={{ color: nuanceColor(target.nuance) }}>{nuanceLabel(target.nuance)}</span>
                {(() => {
                  const sexe = depute?.sexe ?? personne?.sexe;
                  return sexe ? <span> · {sexe === "F" ? "Femme" : "Homme"}</span> : null;
                })()}
                {" · "}
                {Number.isFinite(circoNum) ? `${ORDINAL(circoNum)} circ. ` : ""}dépt {dept}
              </p>
            </div>
            {target.elu && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                Siège remporté
              </span>
            )}
            {(() => {
              const pinId =
                mode === "elu"
                  ? `${scrutin}__${circo}`
                  : `${scrutin}__${circo}__${slug ?? ""}`;
              const pinHref =
                mode === "elu"
                  ? `/elu/${encodeURIComponent(pinId)}`
                  : `/candidat/${encodeURIComponent(pinId)}`;
              return (
                <PinButton
                  pin={{
                    type: mode,
                    id: pinId,
                    label: fullName || nuanceLabel(target.nuance),
                    sublabel: `${target.elu ? "Élu·e" : "Candidat·e"} · ${SCRUTIN_META[scrutin].short} · circ. ${circo}`,
                    href: pinHref,
                  }}
                />
              );
            })()}
          </header>

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPI label="Score" value={fmtPct(target.pct)} accent />
            <KPI label="Rang" value={`${ORDINAL(rank ?? 0)} / ${candidates.length}`} />
            <KPI label="Voix" value={fmtInt(target.voix)} />
            <KPI
              label={rank === 1 ? "Avance sur le 2e" : "Écart au 1er"}
              value={
                winner && target
                  ? fmtPts(rank === 1 ? target.pct - (candidates[1]?.pct ?? 0) : target.pct - winner.pct)
                  : "—"
              }
            />
          </section>

          {depute && (
            <section>
              <SectionTitle>Mandat à l&apos;Assemblée nationale</SectionTitle>
              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-2xl border border-black/5 bg-white/60 p-4">
                <span
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
                  style={{ background: depute.groupeColor ?? "#475569" }}
                >
                  {depute.groupe ?? "Groupe"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{depute.groupeLib ?? "Groupe parlementaire"}</p>
                  {fmtDateFr(depute.depuis) && (
                    <p className="text-[11px] text-muted-foreground">
                      Député·e depuis le {fmtDateFr(depute.depuis)} · 17ᵉ législature
                    </p>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  Source AN
                </span>
              </div>
            </section>
          )}

          {depute && acti && (
            <ActiviteSection acti={acti} scrutins={actiScrutins} />
          )}

          <section>
            <SectionTitle>
              Classement —{" "}
              <Link href={`/circo/${encodeURIComponent(circo)}`} className="text-warm hover:underline">
                {circoLibelle ?? `circonscription ${circo}`}
              </Link>
            </SectionTitle>
            <div className="mt-2 rounded-2xl border border-black/5 bg-white/60 p-5">
              <Ranking candidates={candidates} targetIndex={candidates.indexOf(target)} />
            </div>
          </section>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/explorer?maille=circonscriptions&scrutin=${scrutin}&code=${encodeURIComponent(circo)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <MapIcon className="h-3.5 w-3.5" />
              Voir sur la carte
            </Link>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Résultats : MinInt {SCRUTIN_META[scrutin].short}.{" "}
            {depute
              ? "Identité et groupe parlementaire : open data Assemblée nationale (17ᵉ législature)."
              : "Prénom et sexe issus des procès-verbaux par bureau de vote (législatives 2024)."}
          </p>
        </div>
      )}
    </div>
  );
}

function ActiviteSection({
  acti,
  scrutins,
}: {
  acti: DeputeActivite;
  scrutins: ActiviteScrutin[];
}) {
  const positions = acti.v.split("");
  // Votes récents où le député a une position connue (présent en priorité).
  const recent = scrutins
    .map((s, i) => ({ s, pos: decodePosition(positions[i] ?? ".") }))
    .slice(0, 12);

  return (
    <section>
      <SectionTitle>Activité parlementaire — votes solennels</SectionTitle>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPI label="Participation" value={fmtPct(acti.p, 0)} accent />
        <KPI
          label="Loyauté au groupe"
          value={acti.l != null ? fmtPct(acti.l, 0) : "—"}
        />
        <KPI label="Présence" value={`${acti.present} / ${scrutins.length}`} />
      </div>

      <div className="mt-3 flex flex-col divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white/60">
        {recent.map(({ s, pos }) => {
          const meta = POSITION_META[pos];
          return (
            <div key={s.numero} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: meta.color, background: meta.bg }}
              >
                {meta.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px]" title={s.titre ?? ""}>
                {cleanTitre(s.titre)}
              </span>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
                {s.sort}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        {scrutins.length} scrutins publics solennels et motions de censure de la 17ᵉ législature
        (open data Assemblée nationale).
      </p>
    </section>
  );
}

/** Raccourcit les intitulés de scrutin (souvent « l'ensemble de … »). */
function cleanTitre(titre: string | null): string {
  if (!titre) return "Scrutin";
  let s = titre.replace(/^l(?:'|’)ensemble (?:de |du |des |de la )?/i, "");
  s = s.replace(/\s*\(.*?lecture\)\s*\.?$/i, "");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 110 ? s.slice(0, 109) + "…" : s;
}

function Ranking({
  candidates,
  targetIndex,
}: {
  candidates: { label: string; nuance: string | null; pct: number; elu: boolean }[];
  targetIndex: number;
}) {
  const top = candidates.slice(0, 10);
  const max = Math.max(...top.map((c) => c.pct), 0.0001);
  return (
    <div className="flex flex-col gap-2.5">
      {top.map((c, i) => {
        const isTarget = i === targetIndex;
        return (
          <div
            key={`${c.label}-${i}`}
            className={cn("flex flex-col gap-1 rounded-lg px-2 py-1", isTarget && "bg-warm/10")}
          >
            <div className="flex items-center justify-between gap-2 text-[12px]">
              <span className="flex min-w-0 items-center gap-1.5">
                {c.elu && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                <span className={cn("truncate", isTarget && "font-semibold")}>
                  {c.label || nuanceLabel(c.nuance)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{fmtPct(c.pct)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.05]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.pct / max) * 100}%`, background: nuanceColor(c.nuance) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-black/5 p-3", accent ? "bg-warm/10" : "bg-white/60")}>
      <p className="text-[10px] uppercase tracking-[0.05em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement…
    </div>
  );
}

function NotFound({ circo }: { circo: string }) {
  return (
    <div className="mt-10 rounded-2xl border border-black/5 bg-white/60 p-8 text-center">
      <p className="text-[13px] font-medium">Personne introuvable</p>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Ce candidat n&apos;apparaît pas dans les résultats de la circonscription {circo}.
      </p>
      <Link
        href={`/circo/${encodeURIComponent(circo)}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
      >
        Voir la circonscription
      </Link>
    </div>
  );
}
