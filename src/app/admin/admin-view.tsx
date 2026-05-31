"use client";

import { useState } from "react";
import { ShieldCheck, Search, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export type AdminAccount = {
  id: string;
  email: string;
  fullName: string | null;
  organisation: string | null;
  role: string;
  status: "trial" | "active" | "inactive";
  tier: string;
  trialEndsAt: string | null;
  isSuperAdmin: boolean;
  teamName: string | null;
  createdAt: string | null;
};

const STATUSES = ["trial", "active", "inactive"] as const;
const STATUS_LABELS: Record<AdminAccount["status"], string> = {
  trial: "Essai",
  active: "Actif",
  inactive: "Inactif",
};
const STATUS_CLASS: Record<AdminAccount["status"], string> = {
  active: "bg-emerald-100 text-emerald-700",
  trial: "bg-warm/15 text-warm",
  inactive: "bg-surface-soft text-muted-foreground",
};
const TIERS = ["candidat", "equipe", "parti"] as const;
const TIER_LABELS: Record<string, string> = { candidat: "Candidat", equipe: "Équipe", parti: "Parti" };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";
const dateInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

const field = "rounded-md border border-border bg-surface px-2 py-1 text-[12px] outline-none focus:border-warm";

export function AdminView({ accounts: initial, meId }: { accounts: AdminAccount[]; meId: string }) {
  const [accounts, setAccounts] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminAccount["status"] | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visible = accounts.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (q && !`${a.email} ${a.fullName ?? ""} ${a.organisation ?? ""} ${a.teamName ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    trial: accounts.filter((a) => a.status === "trial").length,
    inactive: accounts.filter((a) => a.status === "inactive").length,
    admins: accounts.filter((a) => a.isSuperAdmin).length,
  };

  function flash(msg: string) {
    setNotice(msg);
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setNotice(null), 4000);
  }
  function patch(id: string, p: Partial<AdminAccount>) {
    setAccounts((arr) => arr.map((a) => (a.id === id ? { ...a, ...p } : a)));
  }

  async function setSubscription(a: AdminAccount, next: Partial<Pick<AdminAccount, "status" | "tier" | "trialEndsAt">>) {
    const status = next.status ?? a.status;
    const tier = next.tier ?? a.tier;
    const trial = next.trialEndsAt !== undefined ? next.trialEndsAt : a.trialEndsAt;
    patch(a.id, { status, tier, trialEndsAt: trial });
    const { error } = await createClient().rpc("admin_set_subscription", {
      p_user: a.id,
      p_status: status,
      p_tier: tier,
      p_trial_ends_at: trial,
    });
    if (error) {
      flash(`Échec de la mise à jour : ${error.message}`);
      patch(a.id, { status: a.status, tier: a.tier, trialEndsAt: a.trialEndsAt });
    }
  }

  async function setSuperAdmin(a: AdminAccount, value: boolean) {
    patch(a.id, { isSuperAdmin: value });
    const { error } = await createClient().rpc("admin_set_super_admin", { p_user: a.id, p_value: value });
    if (error) {
      flash(error.message);
      patch(a.id, { isSuperAdmin: a.isSuperAdmin });
    }
  }

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Administration</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-[28px] font-semibold tracking-tight">
          <ShieldCheck className="h-6 w-6 text-warm" /> Back-office
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Gestion des comptes, abonnements et accès super-admin.</p>

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>{notice}</span>
          </div>
        )}

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Comptes" value={stats.total} />
          <Stat label="Actifs" value={stats.active} tone="emerald" />
          <Stat label="En essai" value={stats.trial} tone="warm" />
          <Stat label="Inactifs" value={stats.inactive} />
          <Stat label="Super-admins" value={stats.admins} />
        </div>

        {/* Filtres */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Tous · {stats.total}</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {STATUS_LABELS[s]} · {accounts.filter((a) => a.status === s).length}
            </Chip>
          ))}
          <div className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (e-mail, nom, orga, équipe)…" className={cn(field, "w-72 py-1.5 pl-8")} />
          </div>
        </div>

        {/* Table */}
        <div className="mt-3 overflow-x-auto rounded-lg border border-black/5 bg-surface shadow-card">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-border/60 text-left text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Compte</th>
                <th className="px-3 py-2 font-medium">Organisation / Équipe</th>
                <th className="px-3 py-2 font-medium">Statut</th>
                <th className="px-3 py-2 font-medium">Formule</th>
                <th className="px-3 py-2 font-medium">Fin d’essai</th>
                <th className="px-3 py-2 font-medium">Super-admin</th>
                <th className="px-3 py-2 font-medium">Créé</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => (
                <tr key={a.id} className="border-b border-border/40 last:border-0 align-middle">
                  <td className="px-3 py-2">
                    <div className="font-medium">{a.fullName || "—"}</div>
                    <div className="text-[11px] text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{a.organisation || "—"}</div>
                    {a.teamName && (
                      <div className="inline-flex items-center gap-1 text-[11px] text-warm">
                        <Users className="h-3 w-3" /> {a.teamName}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={a.status}
                      onChange={(e) => setSubscription(a, { status: e.target.value as AdminAccount["status"] })}
                      className={cn("rounded-pill border-0 px-2 py-0.5 text-[11px] font-medium outline-none", STATUS_CLASS[a.status])}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select value={a.tier} onChange={(e) => setSubscription(a, { tier: e.target.value })} className={field}>
                      {TIERS.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={dateInput(a.trialEndsAt)}
                      onChange={(e) =>
                        setSubscription(a, {
                          trialEndsAt: e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : null,
                        })
                      }
                      className={field}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={a.isSuperAdmin}
                      disabled={a.id === meId}
                      title={a.id === meId ? "Vous ne pouvez pas retirer votre propre accès" : undefined}
                      onChange={(e) => setSuperAdmin(a, e.target.checked)}
                      className="h-4 w-4 accent-[var(--warm,#c8743c)] disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(a.createdAt)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Aucun compte.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "warm" }) {
  return (
    <div className="rounded-lg border border-black/5 bg-surface p-4 shadow-card">
      <p className={cn("text-[22px] font-semibold tabular-nums leading-none", tone === "emerald" ? "text-emerald-600" : tone === "warm" ? "text-warm" : "")}>{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-black/[0.04] text-foreground/80 hover:bg-black/[0.08]",
      )}
    >
      {children}
    </button>
  );
}
