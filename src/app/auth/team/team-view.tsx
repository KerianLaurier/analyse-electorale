"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Info, UserPlus, Mail, Building2, Copy, LogOut, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { reloadPins } from "@/lib/pins";
import { SignOutButton } from "@/components/sign-out-button";
import { PLANS, ROLE_LABELS, initials, type Role, type PlanId } from "@/lib/team";

export type Account = {
  id: string;
  email: string;
  fullName: string | null;
  organisation: string | null;
  role: string;
  status: "trial" | "active" | "inactive";
  tier: string;
  trialEndsAt: string | null;
  teamId: string | null;
};

export type Team = { id: string; name: string; joinCode: string };
export type Member = { id: string; fullName: string | null; email: string; role: string };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const TIER_TO_PLAN: Record<string, PlanId> = { candidat: "solo", equipe: "equipe", parti: "cabinet" };

const STATUS_META: Record<Account["status"], { label: string; className: string }> = {
  active: { label: "Abonnement actif", className: "bg-emerald-100 text-emerald-700" },
  trial: { label: "Période d’essai", className: "bg-warm/15 text-warm" },
  inactive: { label: "Inactif", className: "bg-surface-soft text-muted-foreground" },
};

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

const roleLabel = (r: string) => ROLE_LABELS[(r as Role)] ?? ROLE_LABELS.member;

export function TeamView({
  account,
  team,
  members,
}: {
  account: Account;
  team: Team | null;
  members: Member[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const status = STATUS_META[account.status];
  const currentPlanId = TIER_TO_PLAN[account.tier] ?? "solo";
  const trialDays = account.status === "trial" ? daysLeft(account.trialEndsAt) : null;
  const displayName = account.fullName?.trim() || account.email;

  function flash(msg: string) {
    setNotice(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setNotice(null), 4500);
  }

  async function afterTeamChange() {
    await reloadPins();
    router.refresh();
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_team", { p_name: teamName });
    setBusy(false);
    if (error) return flash(`Échec de la création : ${error.message}`);
    setTeamName("");
    flash("Équipe créée. Partagez le code d’invitation à vos coéquipiers.");
    await afterTeamChange();
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("join_team", { p_code: joinCode });
    setBusy(false);
    if (error) return flash("Code d’équipe invalide.");
    setJoinCode("");
    flash("Vous avez rejoint l’équipe.");
    await afterTeamChange();
  }

  async function leaveTeam() {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("leave_team");
    setBusy(false);
    if (error) return flash(`Échec : ${error.message}`);
    flash("Vous avez quitté l’équipe.");
    await afterTeamChange();
  }

  function copyCode() {
    if (!team) return;
    void navigator.clipboard?.writeText(team.joinCode);
    flash(`Code « ${team.joinCode} » copié dans le presse-papier.`);
  }

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Espace de travail</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Équipe &amp; abonnement</h1>
          <span className={cn("rounded-pill px-2.5 py-1 text-[11px] font-semibold", status.className)}>{status.label}</span>
        </div>

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>{notice}</span>
          </div>
        )}

        {/* ── Compte ───────────────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-warm/90 text-[15px] font-semibold text-on-dark">
                {initials(account.fullName ?? "", account.email)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[16px] font-semibold tracking-tight">{displayName}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {account.email}
                  </span>
                  {account.organisation && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {account.organisation}
                    </span>
                  )}
                  <span className="rounded-pill bg-surface-soft px-2 py-0.5 text-[10.5px] font-medium text-foreground/70">
                    {roleLabel(account.role)}
                  </span>
                </p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </section>

        {/* ── Abonnement ───────────────────────────────────────────────── */}
        <section className="mt-4">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Abonnement actuel</p>
              <p className="mt-1 text-[18px] font-semibold tracking-tight">
                Formule {PLANS.find((p) => p.id === currentPlanId)?.name ?? "Solo"}
              </p>
              {account.status === "trial" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {trialDays != null
                    ? trialDays > 0
                      ? `Essai gratuit — ${trialDays} jour${trialDays > 1 ? "s" : ""} restant${trialDays > 1 ? "s" : ""}`
                      : "Essai gratuit — dernier jour"
                    : "Essai gratuit en cours"}
                  {account.trialEndsAt && ` · expire le ${fmtDate(account.trialEndsAt)}`}
                </p>
              ) : account.status === "active" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">Accès complet à l’espace d’analyse 2027.</p>
              ) : (
                <p className="mt-0.5 text-[12px] text-muted-foreground">Aucun abonnement actif — accès restreint.</p>
              )}
            </div>
            <a
              href="mailto:contact@mouvancia.fr?subject=Abonnement%20Analyse%20%C3%A9lectorale"
              className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:self-center"
            >
              {account.status === "active" ? "Gérer l’abonnement" : "Activer un abonnement"}
            </a>
          </div>

          {/* Formules */}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PLANS.map((p) => {
              const current = p.id === currentPlanId;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex flex-col rounded-lg border p-5 transition-colors",
                    current ? "border-warm bg-warm/[0.06]" : "border-border/60 bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold">{p.name}</p>
                    {current && <span className="rounded-pill bg-warm px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0C]">Actuel</span>}
                  </div>
                  <p className="mt-1 text-[20px] font-semibold tracking-tight">
                    {p.price}<span className="text-[12px] font-normal text-muted-foreground">{p.period}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{p.seats}</p>
                  <p className="mt-2 text-[12px] text-muted-foreground">{p.tagline}</p>
                  <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-1.5 text-[12px] text-foreground/75">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={current}
                    onClick={() => flash(`Changement vers la formule ${p.name} — facturation bientôt disponible.`)}
                    className={cn(
                      "mt-4 rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
                      current ? "cursor-default bg-surface-soft text-muted-foreground" : "bg-primary text-primary-foreground hover:opacity-90",
                    )}
                  >
                    {current ? "Formule actuelle" : "Choisir"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Équipe ───────────────────────────────────────────────────── */}
        <section className="mt-8">
          {team ? (
            <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Équipe</p>
                  <p className="mt-0.5 text-[16px] font-semibold tracking-tight">{team.name}</p>
                  <p className="text-[12px] text-muted-foreground">
                    {members.length} membre{members.length > 1 ? "s" : ""} · épingles partagées visibles par toute l’équipe
                  </p>
                </div>
                <button
                  type="button"
                  onClick={leaveTeam}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground/80 hover:bg-surface-soft disabled:opacity-60"
                >
                  <LogOut className="h-3.5 w-3.5" /> Quitter l’équipe
                </button>
              </div>

              {/* Code d'invitation */}
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-soft/60 px-3 py-2.5">
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[12px] text-muted-foreground">Code d’invitation</span>
                <code className="rounded bg-surface px-2 py-0.5 text-[13px] font-semibold tracking-wider">{team.joinCode}</code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[11.5px] font-medium text-warm hover:bg-warm/10"
                >
                  <Copy className="h-3.5 w-3.5" /> Copier
                </button>
                <span className="text-[11px] text-muted-foreground/80">Partagez-le pour que vos coéquipiers rejoignent l’équipe.</span>
              </div>

              {/* Membres */}
              <ul className="flex flex-col divide-y divide-border/60">
                {members.map((m) => {
                  const isMe = m.id === account.id;
                  const name = m.fullName?.trim() || m.email;
                  return (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-surface-soft text-[11px] font-semibold text-foreground/70">
                        {initials(m.fullName ?? "", m.email)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">
                          {name}
                          {isMe && (
                            <span className="ml-2 rounded-pill bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Vous</span>
                          )}
                        </p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{m.email}</p>
                      </div>
                      <span className="rounded-pill bg-surface-soft px-3 py-1 text-[11.5px] font-medium text-foreground/70">{roleLabel(m.role)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-pill bg-warm/15 text-warm">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight">Travaillez en équipe</p>
                  <p className="text-[12px] text-muted-foreground">
                    Créez une équipe pour partager vos épingles (territoires, élus, candidats), ou rejoignez-en une avec un code.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form onSubmit={createTeam} className="flex flex-col gap-2 rounded-lg border border-border/60 p-4">
                  <p className="text-[12px] font-semibold">Créer une équipe</p>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nom de l’équipe (ex. Campagne 4e circ.)"
                    className="rounded-pill border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:border-warm focus:ring-2 focus:ring-warm/20"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Créer
                  </button>
                </form>

                <form onSubmit={joinTeam} className="flex flex-col gap-2 rounded-lg border border-border/60 p-4">
                  <p className="text-[12px] font-semibold">Rejoindre une équipe</p>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Code d’invitation"
                    className="rounded-pill border border-border bg-surface px-3 py-2 text-[13px] uppercase tracking-wider outline-none placeholder:text-muted-foreground/60 placeholder:normal-case placeholder:tracking-normal focus:border-warm focus:ring-2 focus:ring-warm/20"
                  />
                  <button
                    type="submit"
                    disabled={busy || !joinCode.trim()}
                    className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground/80 hover:bg-surface-soft disabled:opacity-60"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Rejoindre
                  </button>
                </form>
              </div>
            </div>
          )}

          <p className="mt-4 text-[10.5px] text-muted-foreground/70">
            Le partage fonctionne au niveau des épingles : depuis une fiche, choisissez « Partager avec l’équipe ». La gestion fine des rôles et la facturation Stripe arriveront ultérieurement.
          </p>
        </section>
      </div>
    </div>
  );
}
