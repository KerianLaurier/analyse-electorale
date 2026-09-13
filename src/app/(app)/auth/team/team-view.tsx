"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Info,
  UserPlus,
  Mail,
  Building2,
  Copy,
  LogOut,
  Users,
  Pencil,
  Plus,
  X,
  Tag,
  Crown,
  ArrowRight,
} from "lucide-react";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { refreshIdentity } from "@/lib/identity";
import { SignOutButton } from "@/components/sign-out-button";
import {
  PLANS,
  ROLE_LABELS,
  ROLE_SUGGESTIONS,
  ROLE_COLORS,
  initials,
  planForTier,
  planPrice,
  type Role,
  type TeamRole,
} from "@/lib/team";
import {
  billingPhase,
  daysLeft,
  formatDateFr,
  nextRenewal,
  type BillingPhase,
  type Cycle,
} from "@/lib/billing";
import { RoleChip } from "@/components/role-chip";

export type Account = {
  id: string;
  email: string;
  fullName: string | null;
  organisation: string | null;
  role: string;
  status: "trial" | "active" | "inactive";
  tier: string;
  trialEndsAt: string | null;
  cancelAt: string | null;
  billingCycle: Cycle | null;
  startedAt: string | null;
  teamId: string | null;
  coveredByTeam?: boolean;
  personalBilling?: boolean;
  billingOwnerActive?: boolean;
};

export type Team = {
  id: string;
  name: string;
  joinCode: string;
  createdBy: string | null;
  billingOwnerId?: string | null;
  seatLimit?: number;
  seatsUsed?: number;
};
export type Member = {
  id: string;
  fullName: string | null;
  email: string;
  role: string;
};
export type MemberRole = { memberId: string; roleId: string };

const fmtDate = formatDateFr;

const PHASE_META: Record<BillingPhase, { label: string; className: string }> = {
  active: {
    label: "Abonnement actif",
    className: "bg-emerald-100 text-emerald-700",
  },
  canceling: {
    label: "Résiliation en cours",
    className: "bg-warm/15 text-warm",
  },
  ended: {
    label: "Abonnement terminé",
    className: "bg-surface-soft text-muted-foreground",
  },
  trialing: { label: "Période d’essai", className: "bg-warm/15 text-warm" },
  trial_over: {
    label: "Essai terminé",
    className: "bg-surface-soft text-muted-foreground",
  },
  inactive: {
    label: "Inactif",
    className: "bg-surface-soft text-muted-foreground",
  },
};

const roleLabel = (r: string) => ROLE_LABELS[r as Role] ?? ROLE_LABELS.member;

export function TeamView({
  account,
  team,
  members,
  teamRoles,
  memberRoles,
}: {
  account: Account;
  team: Team | null;
  members: Member[];
  teamRoles: TeamRole[];
  memberRoles: MemberRole[];
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [nextOwner, setNextOwner] = useState("");

  const phase = billingPhase(
    account.status,
    account.trialEndsAt,
    account.cancelAt,
  );
  const status = PHASE_META[phase];
  const currentPlan = planForTier(account.tier);
  const trialDays =
    account.status === "trial" ? daysLeft(account.trialEndsAt) : null;
  const displayName = account.fullName?.trim() || account.email;
  const isOwner = !!team && team.createdBy === account.id;

  const billingDepartureBlocked =
    team?.billingOwnerId === account.id && account.billingOwnerActive;

  // Profil éditable
  const [editingProfile, setEditingProfile] = useState(false);
  const [pName, setPName] = useState(account.fullName ?? "");
  const [pOrg, setPOrg] = useState(account.organisation ?? "");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: pName.trim() || null,
        organisation: pOrg.trim() || null,
      })
      .eq("id", account.id);
    setBusy(false);
    if (error) {
      console.error(error);
      return flash("Échec de l'enregistrement — réessayez.");
    }
    setEditingProfile(false);
    flash("Profil mis à jour.");
    router.refresh();
  }

  // Rôles de campagne
  const rolesByMember = new Map<string, string[]>();
  for (const a of memberRoles) {
    const arr = rolesByMember.get(a.memberId) ?? [];
    arr.push(a.roleId);
    rolesByMember.set(a.memberId, arr);
  }
  const roleMemberCount = (roleId: string) =>
    memberRoles.filter((a) => a.roleId === roleId).length;

  async function createRole(name: string, color: string) {
    if (busy || !team || !name.trim()) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("team_roles")
      .insert({ team_id: team.id, name: name.trim(), color });
    setBusy(false);
    if (error) {
      console.error(error);
      return flash("Échec de l'opération — réessayez.");
    }
    router.refresh();
  }

  async function removeRole(id: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("team_roles").delete().eq("id", id);
    setBusy(false);
    if (error) return flash("Suppression du rôle refusée — réessayez.");
    router.refresh();
  }

  async function toggleMemberRole(
    memberId: string,
    roleId: string,
    assigned: boolean,
  ) {
    if (busy || !team) return;
    setBusy(true);
    const supabase = createClient();
    if (assigned) {
      await supabase
        .from("member_roles")
        .delete()
        .eq("member_id", memberId)
        .eq("role_id", roleId);
    } else {
      await supabase
        .from("member_roles")
        .insert({ member_id: memberId, role_id: roleId, team_id: team.id });
    }
    setBusy(false);
    router.refresh();
  }

  function flash(msg: string) {
    setNotice(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(
      () => setNotice(null),
      4500,
    );
  }

  async function afterTeamChange() {
    await refreshIdentity();
    router.refresh();
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("create_team", { p_name: teamName });
    setBusy(false);
    if (error) {
      console.error(error);
      return flash("Échec de la création — réessayez.");
    }
    setTeamName("");
    flash("Équipe créée. Partagez le code d’invitation à vos coéquipiers.");
    await afterTeamChange();
  }

  async function joinTeam(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("join_team", {
        p_code: joinCode,
      });
      if (error) {
        const messages: Record<string, string> = {
          P0003:
            "Tous les sièges sont occupés. Contactez le titulaire de l’abonnement de l’équipe.",
          P0005:
            "L’offre de cette équipe est inactive. Contactez son titulaire pour rétablir l’accès.",
          P0006:
            "Un paiement personnel est en attente. Contactez le support pour vérifier son état avant de rejoindre l’équipe.",
        };
        return flash(
          messages[error.code] ??
            "Impossible de rejoindre l’équipe. Vérifiez le code et réessayez.",
        );
      }
      setJoinCode("");
      flash(
        "Vous avez rejoint l’équipe. Votre siège est inclus dans son offre.",
      );
      await afterTeamChange();
    } catch {
      flash(
        "Connexion interrompue — rechargez l’équipe pour vérifier votre inscription.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function transferTeam() {
    if (busy || !nextOwner) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("transfer_team", {
        p_member: nextOwner,
      });
      if (error)
        return flash(
          "Transfert refusé — vérifiez que ce membre appartient toujours à l’équipe.",
        );
      setNextOwner("");
      flash("Propriété transférée. Vous restez membre de l’équipe.");
      await afterTeamChange();
    } catch {
      flash(
        "Connexion interrompue — rechargez l’équipe pour vérifier le transfert.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function leaveTeam() {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await createClient().rpc("leave_team");
      if (error)
        return flash(
          "Départ refusé. Vérifiez la propriété et la facturation de l’équipe, puis rechargez la page.",
        );
      flash("Vous avez quitté l’équipe.");
      await afterTeamChange();
    } catch {
      flash(
        "Connexion interrompue — rechargez l’équipe pour vérifier votre départ.",
      );
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!team) return;
    void navigator.clipboard?.writeText(team.joinCode);
    flash(`Code « ${team.joinCode} » copié dans le presse-papier.`);
  }

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Espace de travail
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">
            Équipe &amp; abonnement
          </h1>
          <span
            className={cn(
              "rounded-pill px-2.5 py-1 text-[11px] font-semibold",
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>

        {notice && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>{notice}</span>
          </div>
        )}

        {/* ── Compte / profil ──────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="rounded-lg bg-surface p-5 shadow-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-pill bg-warm/90 text-[15px] font-semibold text-on-dark">
                  {initials(account.fullName ?? "", account.email)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold tracking-tight">
                    {displayName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {account.email}
                    </span>
                    {account.organisation && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />{" "}
                        {account.organisation}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-soft px-2 py-0.5 text-[10.5px] font-medium text-foreground/70">
                      {isOwner && <Crown className="h-3 w-3 text-warm" />}
                      {roleLabel(account.role)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setPName(account.fullName ?? "");
                    setPOrg(account.organisation ?? "");
                    setEditingProfile((v) => !v);
                  }}
                  className="gap-1.5 rounded-pill text-[12px]"
                  variant="outline"
                  size="sm"
                >
                  <Pencil className="h-3.5 w-3.5" /> Modifier
                </Button>
                <SignOutButton />
              </div>
            </div>

            {editingProfile && (
              <form
                onSubmit={saveProfile}
                className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-2"
              >
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Nom complet
                  </span>
                  <Input
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="ex. Kérian Laurier"
                    className="text-[13px]"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                    Organisation
                  </span>
                  <Input
                    value={pOrg}
                    onChange={(e) => setPOrg(e.target.value)}
                    placeholder="ex. MOUVANCIA"
                    className="text-[13px]"
                  />
                </label>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Button
                    type="submit"
                    disabled={busy}
                    className="gap-1.5 rounded-pill text-[12.5px]"
                    size="sm"
                  >
                    {busy && <Spinner currentColor className="size-3.5" />}{" "}
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="rounded-pill text-[12.5px]"
                    variant="ghost"
                    size="sm"
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* ── Abonnement ───────────────────────────────────────────────── */}
        <section className="mt-4">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {account.coveredByTeam
                  ? "Accès couvert par l’équipe"
                  : "Abonnement actuel"}
              </p>
              <p className="mt-1 text-[18px] font-semibold tracking-tight">
                Formule {currentPlan.name}
                {!account.coveredByTeam &&
                  (phase === "active" || phase === "canceling") &&
                  account.billingCycle && (
                    <span className="ml-2 align-middle text-[12px] font-normal text-muted-foreground">
                      {planPrice(currentPlan, account.billingCycle)} €{" "}
                      {account.billingCycle === "yearly" ? "/ an" : "/ mois"}
                    </span>
                  )}
              </p>
              {account.coveredByTeam ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Votre siège est inclus dans l’abonnement de{" "}
                  {team?.name ?? "votre équipe"}. Aucun paiement personnel n’est
                  nécessaire.
                  {account.personalBilling &&
                    " Votre ancien compte de facturation reste gérable ; rejoindre l’équipe ne résilie aucun abonnement personnel."}
                </p>
              ) : phase === "trialing" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {trialDays != null
                    ? trialDays > 0
                      ? `Essai gratuit — ${trialDays} jour${trialDays > 1 ? "s" : ""} restant${trialDays > 1 ? "s" : ""}`
                      : "Essai gratuit — dernier jour"
                    : "Essai gratuit en cours"}
                  {account.trialEndsAt &&
                    ` · expire le ${fmtDate(account.trialEndsAt)}`}
                </p>
              ) : phase === "trial_over" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Essai terminé
                  {account.trialEndsAt &&
                    ` le ${fmtDate(account.trialEndsAt)}`}{" "}
                  — choisissez une formule pour continuer.
                </p>
              ) : phase === "active" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Accès complet · prochaine échéance le{" "}
                  {fmtDate(
                    nextRenewal(account.startedAt, account.billingCycle),
                  )}{" "}
                  selon les modalités de votre abonnement.
                </p>
              ) : phase === "canceling" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Résiliation enregistrée — accès jusqu&apos;au{" "}
                  {account.cancelAt ? fmtDate(account.cancelAt) : "terme"}.
                </p>
              ) : phase === "ended" ? (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Abonnement terminé
                  {account.cancelAt && ` le ${fmtDate(account.cancelAt)}`} —
                  réactivable à tout moment.
                </p>
              ) : (
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Aucun abonnement actif — accès restreint.
                </p>
              )}
            </div>
            <Link
              href="/auth/abonnement"
              className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:self-center"
            >
              {account.coveredByTeam
                ? "Voir ma couverture"
                : phase === "active" || phase === "canceling"
                  ? "Gérer l’abonnement"
                  : "Choisir une formule"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Formules */}
          {!account.coveredByTeam && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {PLANS.map((p) => {
                const current =
                  p.id === currentPlan.id &&
                  (phase === "active" || phase === "canceling");
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col rounded-lg border p-5 transition-colors",
                      current
                        ? "border-warm bg-warm/[0.06]"
                        : "border-border/60 bg-surface",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[14px] font-semibold">{p.name}</p>
                      {current && (
                        <span className="rounded-pill bg-warm px-2 py-0.5 text-[10px] font-semibold text-[#0A0A0C]">
                          Actuelle
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[20px] font-semibold tracking-tight">
                      {p.price}
                      <span className="text-[12px] font-normal text-muted-foreground">
                        {p.period}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.seats}
                      {p.yearly != null && <> · {p.yearly} € / an</>}
                    </p>
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      {p.tagline}
                    </p>
                    <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                      {p.features.map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-1.5 text-[12px] text-foreground/75"
                        >
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {current ? (
                      <span className="mt-4 rounded-pill bg-surface-soft px-3 py-1.5 text-center text-[12px] font-medium text-muted-foreground">
                        Formule actuelle
                      </span>
                    ) : p.monthly == null ? (
                      <a
                        href="mailto:contact@mouvancia.fr?subject=Formule%20Cabinet%20%E2%80%94%20MOUVANCIA"
                        className="mt-4 rounded-pill border border-border bg-surface px-3 py-1.5 text-center text-[12px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
                      >
                        Demander un devis
                      </a>
                    ) : (
                      <Link
                        href={`/auth/abonnement?plan=${p.id}`}
                        className="mt-4 rounded-pill bg-primary px-3 py-1.5 text-center text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                      >
                        Choisir
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Équipe ───────────────────────────────────────────────────── */}
        <section className="mt-8">
          {team ? (
            <>
              <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Équipe
                    </p>
                    <p className="mt-0.5 text-[16px] font-semibold tracking-tight">
                      {team.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {team.seatsUsed ?? members.length} siège
                      {(team.seatsUsed ?? members.length) > 1 ? "s" : ""} occupé
                      {(team.seatsUsed ?? members.length) > 1 ? "s" : ""}
                      {team.seatLimit != null &&
                        ` sur ${team.seatLimit === 2147483647 ? "un nombre illimité" : team.seatLimit}`}{" "}
                      · titulaire de l’abonnement inclus
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={leaveTeam}
                    disabled={busy || isOwner || !!billingDepartureBlocked}
                    className="gap-1.5 rounded-pill text-[12px]"
                    variant="outline"
                    size="sm"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Quitter l’équipe
                  </Button>
                </div>

                {team.seatLimit != null &&
                  (team.seatsUsed ?? members.length) >= team.seatLimit && (
                    <p className="text-sm text-muted-foreground">
                      Aucun siège disponible. Une nouvelle personne pourra
                      rejoindre l’équipe lorsqu’un siège sera libéré ou la
                      formule adaptée. Les données existantes sont conservées.
                    </p>
                  )}
                {billingDepartureBlocked && (
                  <p className="text-sm text-muted-foreground">
                    Ce compte porte la facturation de l’équipe. Pour partir, il
                    faut transférer la propriété et attendre la fin de
                    l’abonnement, ou contacter le support pour organiser la
                    reprise de facturation.
                  </p>
                )}
                {isOwner && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor="next-owner" className="text-sm font-medium">
                      Transférer la propriété de l’équipe
                    </label>
                    <p
                      id="transfer-help"
                      className="text-sm text-muted-foreground"
                    >
                      Pour quitter l’équipe, confiez-la d’abord à un autre
                      membre. Cette personne gérera les rôles à votre place. Le
                      titulaire de l’abonnement et sa facturation restent
                      inchangés.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        id="next-owner"
                        value={nextOwner}
                        onChange={(event) => setNextOwner(event.target.value)}
                        disabled={busy}
                        aria-describedby="transfer-help"
                        className="min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-base"
                      >
                        <option value="">Choisir un membre</option>
                        {members
                          .filter((member) => member.id !== account.id)
                          .map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.fullName || member.email}
                            </option>
                          ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || !nextOwner}
                        onClick={transferTeam}
                      >
                        Confirmer le transfert
                      </Button>
                    </div>
                  </div>
                )}
                {/* Code d'invitation */}
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-soft/60 px-3 py-2.5">
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[12px] text-muted-foreground">
                    Code d’invitation
                  </span>
                  <code className="rounded bg-surface px-2 py-0.5 text-[13px] font-semibold tracking-wider">
                    {team.joinCode}
                  </code>
                  <Button
                    type="button"
                    onClick={copyCode}
                    className="gap-1 rounded-pill text-[11.5px] text-warm hover:bg-warm/10"
                    variant="ghost"
                    size="sm"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copier
                  </Button>
                  <span className="text-[11px] text-muted-foreground/80">
                    Partagez-le pour que vos coéquipiers rejoignent l’équipe.
                  </span>
                </div>

                {/* Membres */}
                <ul className="flex flex-col divide-y divide-border/60">
                  {members.map((m) => {
                    const isMe = m.id === account.id;
                    const name = m.fullName?.trim() || m.email;
                    const myRoleIds = rolesByMember.get(m.id) ?? [];
                    const isTeamOwner = team.createdBy === m.id;
                    return (
                      <li key={m.id} className="flex items-start gap-3 py-2.5">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-surface-soft text-[11px] font-semibold text-foreground/70">
                          {initials(m.fullName ?? "", m.email)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {name}
                            {isMe && (
                              <span className="ml-2 rounded-pill bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Vous
                              </span>
                            )}
                          </p>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {m.email}
                          </p>
                          {myRoleIds.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {myRoleIds.map((rid) => {
                                const r = teamRoles.find((x) => x.id === rid);
                                return r ? (
                                  <RoleChip key={rid} role={r} />
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-surface-soft px-3 py-1 text-[11.5px] font-medium text-foreground/70">
                          {isTeamOwner && (
                            <Crown className="h-3 w-3 text-warm" />
                          )}
                          {roleLabel(m.role)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* ── Rôles de campagne ──────────────────────────────────── */}
              <div className="mt-4 flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" /> Rôles de campagne
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {isOwner
                      ? "Créez les rôles de votre équipe (logistique, communication…) et attribuez-les aux membres."
                      : "Les rôles de campagne sont définis par le propriétaire de l’équipe."}
                  </p>
                </div>

                {teamRoles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {teamRoles.map((r) => (
                      <span
                        key={r.id}
                        className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-[12px]"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: r.color }}
                        />
                        {r.name}
                        <span className="text-[10.5px] text-muted-foreground">
                          · {roleMemberCount(r.id)}
                        </span>
                        {isOwner && (
                          <Button
                            type="button"
                            onClick={() => void removeRole(r.id)}
                            aria-label="Supprimer le rôle"
                            className="ml-0.5 h-4 w-4 rounded hover:text-red-600"
                            variant="ghost"
                            size="icon-sm"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  !isOwner && (
                    <p className="text-[12px] text-muted-foreground">
                      Aucun rôle défini pour l’instant.
                    </p>
                  )
                )}

                {isOwner && (
                  <RoleCreator
                    onCreate={createRole}
                    existing={teamRoles}
                    busy={busy}
                  />
                )}

                {isOwner && teamRoles.length > 0 && (
                  <div className="flex flex-col gap-2.5 border-t border-border/60 pt-4">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Attribuer les rôles aux membres
                    </p>
                    {members.map((m) => {
                      const myRoleIds = rolesByMember.get(m.id) ?? [];
                      return (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span
                            className="w-44 shrink-0 truncate text-[12.5px] font-medium"
                            title={m.fullName?.trim() || m.email}
                          >
                            {m.fullName?.trim() || m.email}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {teamRoles.map((r) => {
                              const assigned = myRoleIds.includes(r.id);
                              return (
                                <Button
                                  key={r.id}
                                  type="button"
                                  onClick={() =>
                                    void toggleMemberRole(m.id, r.id, assigned)
                                  }
                                  disabled={busy}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-60",
                                    assigned
                                      ? "border-transparent text-white"
                                      : "border-border bg-surface text-foreground/70 hover:bg-surface-soft",
                                  )}
                                  style={
                                    assigned
                                      ? { background: r.color }
                                      : undefined
                                  }
                                  variant="ghost"
                                  size="sm"
                                >
                                  {assigned ? (
                                    <Check className="h-3 w-3" />
                                  ) : (
                                    <span
                                      className="h-2 w-2 rounded-full"
                                      style={{ background: r.color }}
                                    />
                                  )}
                                  {r.name}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-pill bg-warm/15 text-warm">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[15px] font-semibold tracking-tight">
                    Travaillez en équipe
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    Créez une équipe pour partager vos épingles (territoires,
                    élus, candidats), ou rejoignez-en une avec un code.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form
                  onSubmit={createTeam}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 p-4"
                >
                  <p className="text-[12px] font-semibold">Créer une équipe</p>
                  <Input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nom de l’équipe (ex. Campagne 4e circ.)"
                    className="text-[13px]"
                  />
                  <Button
                    type="submit"
                    disabled={busy}
                    className="gap-1.5 rounded-pill text-[13px]"
                    size="md"
                  >
                    {busy && <Spinner currentColor className="size-3.5" />}{" "}
                    Créer
                  </Button>
                </form>

                <form
                  onSubmit={joinTeam}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 p-4"
                >
                  <p className="text-[12px] font-semibold">
                    Rejoindre une équipe
                  </p>
                  <Input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Code d’invitation"
                    className="text-[13px] uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal"
                  />
                  <Button
                    type="submit"
                    disabled={busy || !joinCode.trim()}
                    className="gap-1.5 rounded-pill text-[13px]"
                    variant="outline"
                    size="md"
                  >
                    {busy && <Spinner currentColor className="size-3.5" />}{" "}
                    Rejoindre
                  </Button>
                </form>
              </div>
            </div>
          )}

          <p className="mt-4 text-[10.5px] text-muted-foreground/70">
            Le partage fonctionne au niveau de l’équipe (épingles, plan de
            terrain, porte-à-porte, phoning). Souscription en ligne avec
            activation après confirmation du paiement.
          </p>
        </section>
      </div>
    </div>
  );
}

function RoleCreator({
  onCreate,
  existing,
  busy,
}: {
  onCreate: (name: string, color: string) => void | Promise<void>;
  existing: TeamRole[];
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(ROLE_COLORS[0]);
  const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));
  const suggestions = ROLE_SUGGESTIONS.filter(
    (s) => !existingNames.has(s.name.toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-2.5 border-t border-border/60 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nouveau rôle…"
          className="min-w-[180px] flex-1 text-[13px]"
        />
        <div className="flex items-center gap-1">
          {ROLE_COLORS.map((c) => (
            <Button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Couleur ${c}`}
              className={cn(
                "h-5 w-5 rounded-full ring-offset-1 transition-all",
                color === c ? "ring-2 ring-foreground/40" : "ring-0",
              )}
              style={{ background: c }}
              variant="ghost"
              size="sm"
            />
          ))}
        </div>
        <Button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => {
            void onCreate(name, color);
            setName("");
          }}
          className="gap-1.5 rounded-pill text-[12.5px]"
          size="sm"
        >
          <Plus className="h-3.5 w-3.5" /> Ajouter
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] text-muted-foreground">
            Suggestions :
          </span>
          {suggestions.map((s) => (
            <Button
              key={s.name}
              type="button"
              disabled={busy}
              onClick={() => void onCreate(s.name, s.color)}
              className="gap-1 rounded-pill border-dashed text-[11px]"
              variant="outline"
              size="sm"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />{" "}
              {s.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
