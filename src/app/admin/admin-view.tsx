"use client";

import { useState } from "react";
import { ShieldCheck, Search, Info, Users, UserPlus, Copy, CheckCircle2, Check, X, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@appica/ui-react/select";
import { Checkbox } from "@appica/ui-react/checkbox";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

function genPassword(): string {
  const a = Math.random().toString(36).slice(2, 7);
  const b = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `Mvc-${a}${b}${Math.floor(Math.random() * 90 + 10)}`;
}
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export type AdminAccount = {
  id: string;
  email: string;
  fullName: string | null;
  organisation: string | null;
  role: string;
  status: "trial" | "active" | "inactive";
  tier: string;
  trialEndsAt: string | null;
  billingCycle: "monthly" | "yearly" | null;
  cancelAt: string | null;
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

// Les champs Appica portent leur propre cadre (bordure, fond, focus) :
// il ne reste ici que l'échelle typographique du contexte.
const field = "text-[12px]";

export function AdminView({ accounts: initial, meId }: { accounts: AdminAccount[]; meId: string }) {
  const [accounts, setAccounts] = useState(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminAccount["status"] | "all">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function createAccount(payload: CreatePayload): Promise<boolean> {
    const { data, error } = await createClient().rpc("admin_create_account", {
      p_email: payload.email.trim(),
      p_password: payload.password,
      p_full_name: payload.fullName.trim() || null,
      p_organisation: payload.organisation.trim() || null,
      p_status: payload.status,
      p_tier: payload.tier,
      p_trial_ends_at: payload.trialEndsAt ? new Date(payload.trialEndsAt + "T00:00:00").toISOString() : null,
      p_super: payload.isSuperAdmin,
    });
    if (error) {
      flash(`Échec : ${error.message}`);
      return false;
    }
    const newId = data as string;
    setAccounts((arr) => [
      {
        id: newId,
        email: payload.email.trim().toLowerCase(),
        fullName: payload.fullName.trim() || null,
        organisation: payload.organisation.trim() || null,
        role: "member",
        status: payload.status,
        tier: payload.tier,
        trialEndsAt: payload.trialEndsAt ? new Date(payload.trialEndsAt + "T00:00:00").toISOString() : null,
        billingCycle: null,
        cancelAt: null,
        isSuperAdmin: payload.isSuperAdmin,
        teamName: null,
        createdAt: new Date().toISOString(),
      },
      ...arr,
    ]);
    setCreated({ email: payload.email.trim().toLowerCase(), password: payload.password });
    setCopied(false);
    setShowCreate(false);
    return true;
  }

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Administration</p>
            <h1 className="mt-1 inline-flex items-center gap-2 text-[28px] font-semibold tracking-tight">
              <ShieldCheck className="h-6 w-6 text-warm" /> Back-office
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Gestion des comptes, abonnements et accès super-admin.</p>
          </div>
          <Button
            type="button"
            onClick={() => { setShowCreate((v) => !v); setCreated(null); }}
            className="gap-1.5 rounded-pill text-[13px]" size="md">
            <UserPlus className="h-4 w-4" /> Nouveau compte
          </Button>
        </div>

        {notice && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            <span>{notice}</span>
          </div>
        )}

        {created && (
          <div className="mt-4 flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-3 text-[12.5px] text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Compte créé. Communiquez ces identifiants à l’utilisateur :</p>
              <p className="mt-1 font-mono text-[12px]">
                {created.email} · <span className="font-semibold">{created.password}</span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-700/80">L’utilisateur pourra changer son mot de passe via « Mot de passe oublié » ou son compte.</p>
            </div>
            <Button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(`${created.email} / ${created.password}`); setCopied(true); }}
              className="shrink-0 gap-1 rounded-pill bg-surface/70 text-[11px] hover:bg-surface" variant="ghost" size="sm">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copié" : "Copier"}
            </Button>
            <Button type="button" onClick={() => setCreated(null)} aria-label="Fermer" className="shrink-0 text-emerald-700/70 hover:text-emerald-900" variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {showCreate && <CreateAccountForm onSubmit={createAccount} onCancel={() => setShowCreate(false)} />}

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
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (e-mail, nom, orga, équipe)…" className={cn(field, "w-72 py-1.5 pl-8")} />
          </div>
        </div>

        {/* Table */}
        <div className="mt-3 overflow-x-auto rounded-lg border border-foreground/5 bg-surface shadow-card">
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
                    <Select value={a.status} onValueChange={(appicaValue) => setSubscription(a, { status: String(appicaValue ?? "") as AdminAccount["status"] })} size="sm">
                      <SelectTrigger className={cn("rounded-pill border-0 px-2 py-0.5 text-[11px] font-medium outline-none", STATUS_CLASS[a.status])}><SelectValue /></SelectTrigger>
                      <SelectContent>
                      {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    {a.status === "active" && a.cancelAt && (
                      <div className="mt-1 text-[10.5px] text-warm">↳ résilié, fin le {fmtDate(a.cancelAt)}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select value={a.tier} onValueChange={(appicaValue) => setSubscription(a, { tier: String(appicaValue ?? "") })} size="sm">
                      <SelectTrigger className={field}><SelectValue /></SelectTrigger>
                      <SelectContent>
                      {TIERS.map((t) => <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    {a.billingCycle && (
                      <div className="mt-1 text-[10.5px] text-muted-foreground">
                        {a.billingCycle === "yearly" ? "Annuel" : "Mensuel"}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="date"
                      value={dateInput(a.trialEndsAt)}
                      onChange={(e) =>
                        setSubscription(a, {
                          trialEndsAt: e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : null,
                        })
                      }
                      className={field} />
                  </td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={a.isSuperAdmin}
                      disabled={a.id === meId}
                      title={a.id === meId ? "Vous ne pouvez pas retirer votre propre accès" : undefined}
                      onCheckedChange={(next) => setSuperAdmin(a, next)}
                      aria-label={`Super-admin · ${a.email}`}
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
    <div className="rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
      <p className={cn("text-[22px] font-semibold tabular-nums leading-none", tone === "emerald" ? "text-emerald-600" : tone === "warm" ? "text-warm" : "")}>{value}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

type CreatePayload = {
  email: string;
  password: string;
  fullName: string;
  organisation: string;
  status: AdminAccount["status"];
  tier: string;
  trialEndsAt: string;
  isSuperAdmin: boolean;
};

function CreateAccountForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (p: CreatePayload) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [password, setPassword] = useState(genPassword);
  const [status, setStatus] = useState<AdminAccount["status"]>("trial");
  const [tier, setTier] = useState("candidat");
  const [trialEndsAt, setTrialEndsAt] = useState(addDays(14));
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !email.includes("@")) return setErr("E-mail invalide.");
    if (password.length < 8) return setErr("Mot de passe : 8 caractères minimum.");
    setErr(null);
    setBusy(true);
    const ok = await onSubmit({ email, password, fullName, organisation, status, tier, trialEndsAt: status === "trial" ? trialEndsAt : "", isSuperAdmin });
    setBusy(false);
    if (ok) {
      setEmail("");
      setFullName("");
      setOrganisation("");
      setPassword(genPassword());
    }
  }

  const f = cn(field, "py-1.5");

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
      <p className="text-[12px] font-semibold">Créer un compte</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail *" type="email" className={f} autoComplete="off" />
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom" className={f} />
        <Input value={organisation} onChange={(e) => setOrganisation(e.target.value)} placeholder="Organisation" className={f} />
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Input value={password} onChange={(e) => setPassword(e.target.value)} className={cn(f, "w-full pr-9 font-mono")} />
          <Button type="button" onClick={() => setPassword(genPassword())} title="Générer" className="absolute right-1.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded" variant="soft" size="icon-sm">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Select value={status} onValueChange={(appicaValue) => setStatus(String(appicaValue ?? "") as AdminAccount["status"])} size="sm">
          <SelectTrigger className={f}><SelectValue /></SelectTrigger>
          <SelectContent>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
        </SelectContent>
        </Select>
        <Select value={tier} onValueChange={(appicaValue) => setTier(String(appicaValue ?? ""))} size="sm">
          <SelectTrigger className={f}><SelectValue /></SelectTrigger>
          <SelectContent>
          {TIERS.map((t) => <SelectItem key={t} value={t}>{TIER_LABELS[t]}</SelectItem>)}
        </SelectContent>
        </Select>
        {status === "trial" && (
          <Input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} className={f} title="Fin d’essai" />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
          <Checkbox checked={isSuperAdmin} onCheckedChange={setIsSuperAdmin} />
          <ShieldCheck className="h-3.5 w-3.5" /> Super-admin
        </label>
        {err && <span className="text-[12px] text-destructive">{err}</span>}
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" onClick={onCancel} className="rounded-pill text-[12.5px]" variant="ghost" size="sm">Annuler</Button>
          <Button type="submit" disabled={busy} className="gap-1.5 rounded-pill text-[12.5px]" size="sm">
            {busy && <Spinner currentColor className="size-3.5" />} Créer le compte
          </Button>
        </div>
      </div>
      <p className="text-[10.5px] text-muted-foreground">Le compte est créé avec l’e-mail déjà confirmé : l’utilisateur peut se connecter immédiatement.</p>
    </form>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-pill px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-foreground/[0.04] text-foreground/80 hover:bg-foreground/[0.08]",
      )} variant="ghost" size="sm">
      {children}
    </Button>
  );
}
