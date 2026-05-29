"use client";

import { useState } from "react";
import { Check, Info, UserPlus, X, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLANS,
  ROLE_LABELS,
  MOCK_MEMBERS,
  MOCK_SUBSCRIPTION,
  planById,
  initials,
  type Role,
  type TeamMember,
} from "@/lib/team";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function TeamView() {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [notice, setNotice] = useState<string | null>(null);

  const sub = MOCK_SUBSCRIPTION;
  const plan = planById(sub.planId);
  const activeCount = members.filter((m) => m.status === "active").length;

  function flash(msg: string) {
    setNotice(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setNotice(null), 4000);
  }

  function invite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    // TODO(supabase): supabase.functions.invoke('invite-member', { email, role })
    setMembers((m) => [
      ...m,
      { id: `inv-${Date.now()}`, name: "—", email, role: inviteRole, status: "invited", lastActive: null },
    ]);
    setInviteEmail("");
    flash(`Invitation préparée pour ${email} (préversion — non envoyée).`);
  }

  function changeRole(id: string, role: Role) {
    // TODO(supabase): update team_members set role where id
    setMembers((m) => m.map((x) => (x.id === id ? { ...x, role } : x)));
  }

  function remove(id: string) {
    // TODO(supabase): delete from team_members where id
    setMembers((m) => m.filter((x) => x.id !== id));
  }

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Espace de travail</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Équipe & abonnement</h1>
          <span className="rounded-pill bg-warm/15 px-2.5 py-1 text-[11px] font-semibold text-warm">Formule {plan.name}</span>
        </div>

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>{notice}</span>
          </div>
        )}

        {/* ── Abonnement ───────────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Abonnement actuel</p>
              <p className="mt-1 text-[18px] font-semibold tracking-tight">
                {plan.name} · {plan.price}
                <span className="text-[13px] font-normal text-muted-foreground">{plan.period}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Renouvellement le {fmtDate(sub.renewsAt)}</p>
            </div>
            <div className="sm:w-56">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Sièges utilisés</span>
                <span className="font-semibold tabular-nums">{sub.seatsUsed} / {sub.seatsTotal}</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-surface-soft/70">
                <span className="block h-full rounded-pill bg-warm" style={{ width: `${(sub.seatsUsed / sub.seatsTotal) * 100}%` }} />
              </div>
              <button
                type="button"
                onClick={() => flash("La facturation (Stripe) sera disponible prochainement.")}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground/80 hover:bg-surface-soft"
              >
                <CreditCard className="h-3.5 w-3.5" /> Gérer la facturation
              </button>
            </div>
          </div>

          {/* Formules */}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PLANS.map((p) => {
              const current = p.id === sub.planId;
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
                      current
                        ? "cursor-default bg-surface-soft text-muted-foreground"
                        : "bg-primary text-primary-foreground hover:opacity-90",
                    )}
                  >
                    {current ? "Formule actuelle" : "Choisir"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Membres ──────────────────────────────────────────────────── */}
        <section className="mt-8">
          <div className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Membres</p>
                <p className="mt-0.5 text-[14px] font-medium">{activeCount} actif{activeCount > 1 ? "s" : ""} · {members.length} au total</p>
              </div>
            </div>

            {/* Invitation */}
            <form onSubmit={invite} className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Inviter par e-mail…"
                  className="w-full rounded-pill border border-border bg-surface py-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground/60 focus:border-warm focus:ring-2 focus:ring-warm/20"
                />
              </div>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="rounded-pill border border-border bg-surface px-3 py-2 text-[13px] outline-none"
              >
                <option value="member">Membre</option>
                <option value="admin">Administrateur</option>
              </select>
              <button type="submit" className="rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground hover:opacity-90">
                Inviter
              </button>
            </form>

            {/* Liste */}
            <ul className="flex flex-col divide-y divide-border/60">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-pill bg-surface-soft text-[11px] font-semibold text-foreground/70">
                    {initials(m.name, m.email)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {m.name !== "—" ? m.name : m.email}
                      {m.status === "invited" && (
                        <span className="ml-2 rounded-pill bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Invité</span>
                      )}
                    </p>
                    <p className="truncate text-[11.5px] text-muted-foreground">
                      {m.name !== "—" ? m.email : "Invitation en attente"}
                      {m.lastActive && ` · vu le ${fmtDate(m.lastActive)}`}
                    </p>
                  </div>
                  {m.role === "owner" ? (
                    <span className="rounded-pill bg-surface-soft px-3 py-1 text-[11.5px] font-medium text-foreground/70">{ROLE_LABELS.owner}</span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as Role)}
                      className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11.5px] outline-none"
                    >
                      <option value="admin">{ROLE_LABELS.admin}</option>
                      <option value="member">{ROLE_LABELS.member}</option>
                    </select>
                  )}
                  {m.role !== "owner" && (
                    <button
                      type="button"
                      onClick={() => remove(m.id)}
                      aria-label="Retirer"
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-4 text-[10.5px] text-muted-foreground/70">
            Préversion : les invitations, rôles et changements de formule ne sont pas encore persistés. Le branchement Supabase (auth, membres, abonnement Stripe) interviendra dans un sprint dédié.
          </p>
        </section>
      </div>
    </div>
  );
}
