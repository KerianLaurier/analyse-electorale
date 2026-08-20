"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Hourglass,
  ReceiptText,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { Spinner } from "@appica/ui-react/spinner";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { refreshIdentity } from "@/lib/identity";
import { sessionCookieSnapshot, waitForSessionCookie } from "@/lib/session-cookie";
import {
  billingPhase,
  daysLeft,
  formatDateFr,
  nextRenewal,
  type Cycle,
  type SubscriptionStatus,
  type Tier,
} from "@/lib/billing";
import { PLANS, planForTier, planPrice, type Plan, type PlanId } from "@/lib/team";
import { SignOutButton } from "@/components/sign-out-button";

export type FlowAccount = {
  email: string;
  fullName: string | null;
  organisation: string | null;
  status: SubscriptionStatus;
  tier: Tier;
  trialEndsAt: string | null;
  cancelAt: string | null;
  billingCycle: Cycle | null;
  startedAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

export type BillingProvider = "stripe" | "invoice";
export type CheckoutResult = "success" | "cancelled" | null;

const CONTACT_MAILTO = "mailto:contact@mouvancia.fr?subject=Formule%20Cabinet%20%E2%80%94%20MOUVANCIA";

/** Message d'erreur RPC lisible (les `raise exception` SQL sont déjà en français). */
function rpcErrorMessage(err: { code?: string; message?: string } | null): string {
  if (err?.code === "PGRST202") {
    // Fonction absente : migration billing pas encore appliquée sur cet environnement.
    return "La souscription en ligne n'est pas encore ouverte sur cet environnement — contactez contact@mouvancia.fr.";
  }
  return err?.message || "Une erreur est survenue — réessayez.";
}

/** POST JSON vers nos routes Stripe ; renvoie l'URL de redirection ou lève l'erreur serveur. */
async function fetchStripeUrl(path: string, body: Record<string, unknown>): Promise<{ url?: string; portal?: boolean; error?: string }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: string; portal?: boolean; error?: string };
  if (!res.ok || !data.url) {
    return { portal: data.portal, error: data.error || "Le service de paiement est indisponible — réessayez." };
  }
  return data;
}

/**
 * Après une mutation d'abonnement, le JWT doit être réémis pour que le
 * middleware (qui lit les claims) voie le nouveau statut immédiatement — sans
 * quoi l'accès resterait figé jusqu'au rafraîchissement naturel (~1 h).
 */
async function syncSessionAfterBillingChange(): Promise<void> {
  const supabase = createClient();
  const snapshot = sessionCookieSnapshot();
  await supabase.auth.refreshSession();
  await waitForSessionCookie(snapshot);
  await refreshIdentity();
}

export function SubscriptionFlow({
  account,
  provider,
  initialPlanId,
  initialCycle,
  checkoutResult,
}: {
  account: FlowAccount | null;
  provider: BillingProvider;
  initialPlanId: PlanId | null;
  initialCycle: Cycle | null;
  checkoutResult: CheckoutResult;
}) {
  const router = useRouter();
  const phase = account ? billingPhase(account.status, account.trialEndsAt, account.cancelAt) : null;
  const hasOpenAccess = phase === "trialing" || phase === "active" || phase === "canceling";
  const currentPlan = account ? planForTier(account.tier) : null;
  // Abonné par carte : formule/résiliation/factures se gèrent chez Stripe
  // (Billing Portal) ; l'état revient dans profiles par le webhook.
  const isStripeSubscriber =
    provider === "stripe" && !!account?.stripeSubscriptionId && (phase === "active" || phase === "canceling");

  const [cycle, setCycle] = useState<Cycle>(initialCycle ?? account?.billingCycle ?? "yearly");
  const [confirming, setConfirming] = useState<Plan | null>(() => {
    if (!account || !initialPlanId) return null;
    const p = PLANS.find((x) => x.id === initialPlanId);
    return p && p.monthly != null ? p : null;
  });
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ plan: Plan; cycle: Cycle; kind: "subscribe" | "change" } | null>(() => {
    // Retour de Checkout avec webhook déjà passé : succès immédiat.
    if (checkoutResult === "success" && account?.status === "active") {
      return { plan: planForTier(account.tier), cycle: account.billingCycle ?? "yearly", kind: "subscribe" };
    }
    return null;
  });
  const [notice, setNotice] = useState<string | null>(
    checkoutResult === "cancelled" ? "Paiement annulé — aucune facturation n'a eu lieu." : null,
  );
  // Retour de Checkout avant le webhook : courte attente d'activation.
  const [awaitingActivation, setAwaitingActivation] = useState(
    checkoutResult === "success" && account?.status !== "active",
  );

  useEffect(() => {
    if (!awaitingActivation) return;
    let stopped = false;
    let tries = 0;
    async function poll() {
      if (stopped) return;
      tries += 1;
      const id = await refreshIdentity();
      const sub = id.subscription;
      if (stopped) return;
      if (sub?.status === "active") {
        await syncSessionAfterBillingChange();
        if (stopped) return;
        setDone({ plan: planForTier(sub.tier), cycle: sub.billingCycle ?? "yearly", kind: "subscribe" });
        setAwaitingActivation(false);
        router.refresh();
        return;
      }
      if (tries < 8) {
        setTimeout(() => void poll(), 1500);
      } else {
        setAwaitingActivation(false);
        setNotice(
          "Paiement confirmé — l'activation peut prendre quelques instants. Rechargez la page d'ici une minute.",
        );
      }
    }
    void poll();
    return () => {
      stopped = true;
    };
  }, [awaitingActivation, router]);

  async function openPortal(flow?: "subscription_update") {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetchStripeUrl("/api/stripe/portal", flow ? { flow } : {});
    if (res.url) {
      window.location.assign(res.url);
      return; // navigation en cours — on ne réactive pas les boutons
    }
    setError(res.error ?? null);
    setBusy(false);
  }

  async function subscribe(plan: Plan) {
    if (busy || !account) return;
    setBusy(true);
    setError(null);

    // Paiement carte : redirection vers Stripe Checkout — l'activation arrive
    // par webhook, confirmée au retour sur ?checkout=success.
    if (provider === "stripe") {
      const res = await fetchStripeUrl("/api/stripe/checkout", { tier: plan.tier, cycle });
      if (res.url) {
        window.location.assign(res.url);
        return;
      }
      if (res.portal) {
        // Déjà abonné par carte : le changement passe par le portail.
        await openPortal("subscription_update");
        return;
      }
      setError(res.error ?? null);
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { error: err } = await supabase.rpc("self_set_plan", { p_tier: plan.tier, p_cycle: cycle });
    if (err) {
      setError(rpcErrorMessage(err));
      setBusy(false);
      return;
    }
    await syncSessionAfterBillingChange();
    setBusy(false);
    setConfirming(null);
    setDone({ plan, cycle, kind: phase === "active" || phase === "canceling" ? "change" : "subscribe" });
    router.refresh();
  }

  async function cancelSubscription() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("self_cancel");
    if (err) {
      setError(rpcErrorMessage(err));
      setBusy(false);
      return;
    }
    await syncSessionAfterBillingChange();
    setBusy(false);
    setCancelOpen(false);
    setNotice(
      data
        ? `Résiliation enregistrée — votre accès reste ouvert jusqu'au ${formatDateFr(data as string)}.`
        : "Résiliation enregistrée.",
    );
    router.refresh();
  }

  async function resumeSubscription() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.rpc("self_resume");
    if (err) {
      setError(rpcErrorMessage(err));
      setBusy(false);
      return;
    }
    await syncSessionAfterBillingChange();
    setBusy(false);
    setNotice("Résiliation annulée — votre abonnement se poursuit normalement.");
    router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      {/* En-tête minimal (page sans chrome applicatif) */}
      <div className="flex items-center justify-between px-6 pt-6">
        <Link
          href={hasOpenAccess ? "/explorer" : "/"}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {hasOpenAccess ? "Retour à l'application" : "Accueil"}
        </Link>
        {account && <SignOutButton />}
      </div>

      <div className="flex flex-1 justify-center px-6 py-10">
        <div className="w-full max-w-4xl">
          {awaitingActivation ? (
            <AwaitingActivationPanel />
          ) : done ? (
            <SuccessPanel done={done} account={account} provider={provider} />
          ) : (
            <>
              <FlowHeader account={account} phase={phase} currentPlan={currentPlan} />

              {notice && (
                <div className="mt-5 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/85">
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
                  <span>{notice}</span>
                </div>
              )}
              {error && (
                <div className="mt-5 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Abonnement actif : gestion (échéance, résiliation, reprise) */}
              {account && (phase === "active" || phase === "canceling") && currentPlan && (
                <CurrentSubscription
                  account={account}
                  phase={phase}
                  plan={currentPlan}
                  busy={busy}
                  cancelOpen={cancelOpen}
                  onOpenCancel={() => setCancelOpen(true)}
                  onCloseCancel={() => setCancelOpen(false)}
                  onCancel={cancelSubscription}
                  onResume={resumeSubscription}
                  onPortal={isStripeSubscriber ? () => void openPortal() : null}
                />
              )}

              {/* Sélecteur de cycle */}
              <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-[16px] font-semibold tracking-tight">
                  {phase === "active" || phase === "canceling" ? "Changer de formule" : "Choisissez votre formule"}
                </h2>
                <CycleToggle cycle={cycle} onChange={setCycle} />
              </div>

              {/* Cartes de formules */}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {PLANS.map((p) => (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    cycle={cycle}
                    account={account}
                    phase={phase}
                    busy={busy}
                    onChoose={() => {
                      setError(null);
                      // Abonné par carte : changement de formule via le portail
                      // Stripe (proration gérée là-bas), pas un second checkout.
                      if (isStripeSubscriber) void openPortal("subscription_update");
                      else setConfirming(p);
                    }}
                  />
                ))}
              </div>

              <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground/80">
                {provider === "stripe" ? (
                  <>
                    Essai gratuit de 14 jours sans carte bancaire. Paiement sécurisé par carte (Stripe),
                    activation immédiate. Sans engagement de durée : résiliation à tout moment depuis votre
                    espace de facturation, effective à l&apos;échéance en cours. Formule Cabinet sur devis.
                  </>
                ) : (
                  <>
                    Essai gratuit de 14 jours sans carte bancaire. Souscription avec activation immédiate —
                    facture émise à votre organisation, payable à réception (virement). Sans engagement de durée :
                    résiliation à tout moment, effective à l&apos;échéance en cours. Formule Cabinet sur devis.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Panneau de confirmation (checkout) */}
      {confirming && account && !done && !awaitingActivation && (
        <CheckoutPanel
          plan={confirming}
          cycle={cycle}
          account={account}
          phase={phase}
          provider={provider}
          busy={busy}
          error={error}
          onCycle={setCycle}
          onConfirm={() => void subscribe(confirming)}
          onClose={() => {
            if (!busy) {
              setConfirming(null);
              setError(null);
            }
          }}
        />
      )}
    </div>
  );
}

/* ── En-tête selon la phase du parcours ─────────────────────────────────────── */

function FlowHeader({
  account,
  phase,
  currentPlan,
}: {
  account: FlowAccount | null;
  phase: ReturnType<typeof billingPhase> | null;
  currentPlan: Plan | null;
}) {
  if (!account) {
    return (
      <header>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-warm/15 text-warm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[26px] font-semibold tracking-tight">Une formule pour chaque campagne</h1>
        <p className="mt-2 max-w-[60ch] text-[13.5px] leading-relaxed text-muted-foreground">
          Commencez par un essai gratuit de 14 jours — sans carte bancaire, sans engagement.{" "}
          <Link href="/auth/signup" className="font-medium text-foreground underline-offset-2 hover:underline">
            Créer un compte
          </Link>{" "}
          ou{" "}
          <Link href="/auth/login?next=/auth/abonnement" className="font-medium text-foreground underline-offset-2 hover:underline">
            se connecter
          </Link>
          .
        </p>
      </header>
    );
  }

  const trialDays = daysLeft(account.trialEndsAt);

  const heading: Record<string, { title: string; sub: React.ReactNode; tone?: "warn" }> = {
    trialing: {
      title: "Votre essai gratuit est en cours",
      sub: (
        <>
          {trialDays != null && (
            <>
              <span className="font-medium text-foreground">
                {trialDays > 0 ? `${trialDays} jour${trialDays > 1 ? "s" : ""} restant${trialDays > 1 ? "s" : ""}` : "Dernier jour"}
              </span>
              {account.trialEndsAt && <> — l&apos;essai se termine le {formatDateFr(account.trialEndsAt)}.</>}{" "}
            </>
          )}
          Choisissez votre formule dès maintenant pour continuer sans interruption ; vos analyses, épingles
          et votre équipe sont conservées.
        </>
      ),
    },
    trial_over: {
      title: "Votre essai gratuit est terminé",
      sub: (
        <>
          Le compte <span className="font-medium text-foreground">{account.email}</span>
          {" "}a terminé sa période d&apos;essai
          {account.trialEndsAt && <> le {formatDateFr(account.trialEndsAt)}</>}. Choisissez une formule
          pour retrouver immédiatement vos analyses — rien n&apos;a été supprimé.
        </>
      ),
      tone: "warn",
    },
    active: {
      title: "Votre abonnement",
      sub: (
        <>
          Le compte <span className="font-medium text-foreground">{account.email}</span>
          {" "}est sur la formule{" "}
          <span className="font-medium text-foreground">{currentPlan?.name}</span>.
        </>
      ),
    },
    canceling: {
      title: "Votre abonnement prend bientôt fin",
      sub: (
        <>
          La résiliation est enregistrée : l&apos;accès reste ouvert jusqu&apos;au{" "}
          <span className="font-medium text-foreground">{account.cancelAt ? formatDateFr(account.cancelAt) : "terme"}</span>.
          Vous pouvez l&apos;annuler d&apos;un clic ci-dessous.
        </>
      ),
      tone: "warn",
    },
    ended: {
      title: "Votre abonnement a pris fin",
      sub: (
        <>
          L&apos;abonnement du compte <span className="font-medium text-foreground">{account.email}</span>
          {" "}s&apos;est terminé{account.cancelAt && <> le {formatDateFr(account.cancelAt)}</>}. Réactivez une
          formule pour reprendre là où vous en étiez — vos données sont conservées.
        </>
      ),
      tone: "warn",
    },
    inactive: {
      title: "Abonnement requis",
      sub: (
        <>
          Le compte <span className="font-medium text-foreground">{account.email}</span>
          {" "}n&apos;a pas d&apos;abonnement actif. Choisissez une formule pour accéder à
          l&apos;analyse électorale 2027.
        </>
      ),
      tone: "warn",
    },
  };

  const h = heading[phase ?? "inactive"];
  return (
    <header>
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-xl",
          h.tone === "warn" ? "bg-warm/15 text-warm" : "bg-primary/10 text-foreground",
        )}
      >
        {phase === "trialing" ? <Hourglass className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
      </span>
      <h1 className="mt-4 text-[26px] font-semibold tracking-tight">{h.title}</h1>
      <p className="mt-2 max-w-[64ch] text-[13.5px] leading-relaxed text-muted-foreground">{h.sub}</p>
    </header>
  );
}

/* ── Bloc abonnement courant (actif / résiliation en cours) ─────────────────── */

function CurrentSubscription({
  account,
  phase,
  plan,
  busy,
  cancelOpen,
  onOpenCancel,
  onCloseCancel,
  onCancel,
  onResume,
  onPortal,
}: {
  account: FlowAccount;
  phase: "active" | "canceling";
  plan: Plan;
  busy: boolean;
  cancelOpen: boolean;
  onOpenCancel: () => void;
  onCloseCancel: () => void;
  onCancel: () => void;
  onResume: () => void;
  /** Abonné par carte : toutes les actions passent par le Billing Portal Stripe. */
  onPortal: (() => void) | null;
}) {
  const renewal = nextRenewal(account.startedAt, account.billingCycle);
  const price = account.billingCycle ? planPrice(plan, account.billingCycle) : plan.monthly;

  return (
    <section className="mt-6 rounded-xl border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Abonnement actuel
          </p>
          <p className="mt-1 text-[17px] font-semibold tracking-tight">
            Formule {plan.name}
            <span className="ml-2 align-middle text-[12px] font-normal text-muted-foreground">
              {price != null && (
                <>
                  {price} € {account.billingCycle === "yearly" ? "/ an" : "/ mois"}
                </>
              )}
            </span>
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {phase === "canceling" && account.cancelAt ? (
              <>Prend fin le {formatDateFr(account.cancelAt)} — plus aucune facture ensuite.</>
            ) : onPortal ? (
              <>Prochaine échéance le {formatDateFr(renewal)} (reconduction tacite, paiement par carte).</>
            ) : (
              <>Prochaine échéance le {formatDateFr(renewal)} (reconduction tacite, facture à réception).</>
            )}
          </p>
        </div>

        {onPortal ? (
          <div className="flex flex-col items-end gap-1.5">
            <Button
              type="button"
              disabled={busy}
              onClick={onPortal}
              className="gap-1.5 rounded-pill text-[12.5px]" size="md">
              {busy ? <Spinner currentColor className="size-3.5" /> : <ReceiptText className="h-3.5 w-3.5" />}
              {phase === "canceling" ? "Reprendre mon abonnement" : "Gérer mon abonnement"}
            </Button>
            <span className="text-[10.5px] text-muted-foreground/80">
              Carte, factures, formule et résiliation — portail sécurisé Stripe.
            </span>
          </div>
        ) : phase === "canceling" ? (
          <Button
            type="button"
            disabled={busy}
            onClick={onResume}
            className="gap-1.5 rounded-pill text-[12.5px]" size="md">
            {busy ? <Spinner currentColor className="size-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
            Reprendre mon abonnement
          </Button>
        ) : cancelOpen ? null : (
          <Button
            type="button"
            disabled={busy}
            onClick={onOpenCancel}
            className="rounded-pill text-[12.5px]" variant="outline" size="md">
            Résilier l&apos;abonnement
          </Button>
        )}
      </div>

      {phase === "active" && cancelOpen && !onPortal && (
        <div className="mt-4 rounded-lg border border-warm/30 bg-warm/[0.06] p-4">
          <p className="text-[13px] font-medium">Confirmer la résiliation ?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Votre accès reste ouvert jusqu&apos;au{" "}
            <span className="font-medium text-foreground">{formatDateFr(renewal)}</span>
            {" "}(fin de la période en cours), puis l&apos;abonnement s&apos;arrête sans autre facture.
            Vos données et votre équipe sont conservées : vous pourrez réactiver plus tard.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="gap-1.5 rounded-pill bg-destructive text-[12.5px] text-white" variant="destructive" size="sm">
              {busy && <Spinner currentColor className="size-3.5" />}
              Résilier au {formatDateFr(renewal)}
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={onCloseCancel}
              className="rounded-pill text-[12.5px]" variant="ghost" size="sm">
              Garder mon abonnement
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Sélecteur mensuel / annuel ─────────────────────────────────────────────── */

function CycleToggle({ cycle, onChange }: { cycle: Cycle; onChange: (c: Cycle) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-pill bg-surface-soft/80 p-1 text-[12px]" role="group" aria-label="Cycle de facturation">
      {(
        [
          { id: "monthly", label: "Mensuel" },
          { id: "yearly", label: "Annuel · 2 mois offerts" },
        ] as const
      ).map((c) => (
        <Button
          key={c.id}
          type="button"
          aria-pressed={cycle === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "rounded-pill px-3 py-1.5 font-medium transition-all",
            cycle === c.id ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/65 hover:text-foreground",
          )} variant="ghost" size="sm">
          {c.label}
        </Button>
      ))}
    </div>
  );
}

/* ── Carte d'une formule ────────────────────────────────────────────────────── */

function PlanCard({
  plan,
  cycle,
  account,
  phase,
  busy,
  onChoose,
}: {
  plan: Plan;
  cycle: Cycle;
  account: FlowAccount | null;
  phase: ReturnType<typeof billingPhase> | null;
  busy: boolean;
  onChoose: () => void;
}) {
  const price = planPrice(plan, cycle);
  const isQuote = plan.monthly == null;
  const isCurrent =
    !!account && (phase === "active" || phase === "canceling") && plan.tier === account.tier;
  const isCurrentExact = isCurrent && account?.billingCycle === cycle;
  const featured = plan.id === "equipe" && !isCurrent;
  const isActivePhase = phase === "active" || phase === "canceling";

  let cta: React.ReactNode;
  if (isQuote) {
    cta = (
      <a
        href={CONTACT_MAILTO}
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-pill border border-border bg-surface px-4 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        Nous contacter
      </a>
    );
  } else if (!account) {
    cta = (
      <Link
        href="/auth/signup"
        className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Démarrer l&apos;essai gratuit <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  } else if (isCurrentExact && phase === "active") {
    cta = (
      <span className="mt-5 inline-flex cursor-default items-center justify-center gap-1.5 rounded-pill bg-surface-soft px-4 py-2 text-[13px] font-medium text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> Votre formule
      </span>
    );
  } else {
    const label = isActivePhase
      ? isCurrent
        ? cycle === account.billingCycle
          ? "Reprendre cette formule"
          : `Passer au cycle ${cycle === "yearly" ? "annuel" : "mensuel"}`
        : `Passer à ${plan.name}`
      : `Souscrire ${plan.name}`;
    cta = (
      <Button
        type="button"
        disabled={busy}
        onClick={onChoose}
        className={cn(
          "mt-5 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2 text-[13px] font-medium transition-all disabled:opacity-60",
          featured || isCurrent
            ? "bg-primary text-primary-foreground hover:opacity-90"
            : "border border-border bg-surface text-foreground/80 hover:border-foreground/30 hover:text-foreground",
        )} variant="ghost" size="sm">
        {label} <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl p-5",
        isCurrent
          ? "border-2 border-warm bg-warm/[0.05]"
          : featured
            ? "border-2 border-warm/70 bg-surface shadow-card"
            : "border border-border bg-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">{plan.name}</p>
        {isCurrent ? (
          <span className="rounded-pill bg-warm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0a0a0c]">
            Actuelle
          </span>
        ) : (
          featured && (
            <span className="rounded-pill bg-warm/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warm">
              Recommandée
            </span>
          )
        )}
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight">
        {isQuote ? (
          "Sur devis"
        ) : (
          <>
            {price} €
            <span className="text-[12px] font-normal text-muted-foreground"> {cycle === "yearly" ? "/ an" : "/ mois"}</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {plan.seats}
        {!isQuote && cycle === "yearly" && plan.monthly != null && (
          <> · soit {Math.round((plan.yearly ?? 0) / 12)} € / mois</>
        )}
      </p>
      <p className="mt-2 text-[12.5px] text-muted-foreground">{plan.tagline}</p>
      <ul className="mt-4 flex flex-1 flex-col gap-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-[12.5px] text-foreground/80">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
            {f}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}

/* ── Panneau de confirmation (checkout) ─────────────────────────────────────── */

function CheckoutPanel({
  plan,
  cycle,
  account,
  phase,
  provider,
  busy,
  error,
  onCycle,
  onConfirm,
  onClose,
}: {
  plan: Plan;
  cycle: Cycle;
  account: FlowAccount;
  phase: ReturnType<typeof billingPhase> | null;
  provider: BillingProvider;
  busy: boolean;
  error: string | null;
  onCycle: (c: Cycle) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const price = planPrice(plan, cycle);
  const isChange = phase === "active" || phase === "canceling";

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Confirmer la formule ${plan.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-2xl border border-border bg-canvas p-6 shadow-floating"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {isChange ? "Changement de formule" : "Souscription"}
        </p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight">Formule {plan.name}</h2>

        <div className="mt-4 flex justify-center">
          <CycleToggle cycle={cycle} onChange={onCycle} />
        </div>

        <dl className="mt-4 flex flex-col gap-2 rounded-lg bg-surface p-4 text-[13px]">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Formule</dt>
            <dd className="font-medium">
              {plan.name} · {plan.seats}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Facturation</dt>
            <dd className="font-medium">{cycle === "yearly" ? "Annuelle (2 mois offerts)" : "Mensuelle"}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border/60 pt-2">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="text-[16px] font-semibold">
              {price} € <span className="text-[11px] font-normal text-muted-foreground">{cycle === "yearly" ? "/ an" : "/ mois"} HT</span>
            </dd>
          </div>
        </dl>

        <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-relaxed text-muted-foreground">
          {provider === "stripe" ? (
            <>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
              <span>
                Paiement sécurisé par carte — vous allez être redirigé vers Stripe. Activation immédiate
                après paiement, reçu envoyé à{" "}
                <span className="font-medium text-foreground/80">{account.email}</span>. Sans engagement :
                résiliable à tout moment, effet à l&apos;échéance en cours.
              </span>
            </>
          ) : (
            <>
              <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-warm" />
              <span>
                Activation immédiate. La facture est adressée à{" "}
                <span className="font-medium text-foreground/80">{account.organisation || account.email}</span>,
                payable à réception par virement. Sans engagement : résiliable à tout moment, effet à l&apos;échéance
                en cours.
              </span>
            </>
          )}
        </p>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 gap-2 rounded-pill text-[13.5px]" size="lg">
            {busy && <Spinner currentColor className="size-4" />}
            {provider === "stripe"
              ? "Continuer vers le paiement"
              : isChange
                ? "Confirmer le changement"
                : "Confirmer la souscription"}
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-pill text-[13px]" variant="ghost" size="lg">
            Annuler
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Retour de Stripe Checkout : activation par webhook en cours ────────────── */

function AwaitingActivationPanel() {
  return (
    <div className="mx-auto max-w-[520px] py-16 text-center" role="status" aria-live="polite">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-warm/15 text-warm">
        <Spinner currentColor className="size-7" />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight">Paiement confirmé</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Activation de votre espace en cours — quelques secondes…
      </p>
    </div>
  );
}

/* ── Écran de confirmation post-souscription ────────────────────────────────── */

function SuccessPanel({
  done,
  account,
  provider,
}: {
  done: { plan: Plan; cycle: Cycle; kind: "subscribe" | "change" };
  account: FlowAccount | null;
  provider: BillingProvider;
}) {
  const price = planPrice(done.plan, done.cycle);
  return (
    <div className="mx-auto max-w-[520px] py-10 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1 className="mt-5 text-[24px] font-semibold tracking-tight">
        {done.kind === "subscribe" ? "Bienvenue à bord !" : "Formule mise à jour"}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
        Votre formule <span className="font-medium text-foreground">{done.plan.name}</span>
        {" "}est active
        {price != null && (
          <>
            {" "}
            ({price} € {done.cycle === "yearly" ? "/ an" : "/ mois"} HT)
          </>
        )}
        .{" "}
        {provider === "stripe" ? (
          <>Reçu envoyé par e-mail — factures et moyen de paiement disponibles dans votre espace de facturation.</>
        ) : (
          <>
            La facture sera adressée à{" "}
            <span className="font-medium text-foreground">{account?.organisation || account?.email}</span>, payable
            à réception.
          </>
        )}
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <Button
          type="button"
          onClick={() => window.location.assign("/explorer")}
          className="gap-2 rounded-pill text-[13.5px]" size="lg">
          Accéder à mes analyses <ArrowRight className="h-4 w-4" />
        </Button>
        <Link
          href="/auth/team"
          className="rounded-pill border border-border bg-surface px-4 py-2.5 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-surface-soft"
        >
          Inviter mon équipe
        </Link>
      </div>
    </div>
  );
}
