"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Hourglass, Undo2, X } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";
import { getIdentity, onIdentityChange, type IdentitySubscription } from "@/lib/identity";
import { billingPhase, daysLeft, formatDateFr } from "@/lib/billing";

// Pages qui portent déjà leur propre message d'état : pas de bandeau.
const HIDDEN_ON = new Set(["/", "/auth/login", "/auth/signup", "/auth/abonnement", "/auth/forgot", "/auth/reset", "/bienvenue"]);
const DISMISS_KEY = "mvc:subbanner:dismissed";

/**
 * Bandeau global du parcours d'abonnement, sous le header applicatif :
 * - essai en cours → jours restants + « Choisir ma formule » (pressant ≤ 3 j) ;
 * - résiliation programmée → date de fin + « Reprendre ».
 * Marges : masqué ailleurs. Dismissible pour la session, sauf en fin d'essai.
 */
export function SubscriptionBanner() {
  const pathname = usePathname();
  const [sub, setSub] = useState<IdentitySubscription | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true; // silencieux au pré-rendu
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let alive = true;
    async function sync() {
      const id = await getIdentity();
      if (!alive) return;
      setSub(id.subscription);
    }
    void sync();
    const off = onIdentityChange(() => void sync());
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (!sub || HIDDEN_ON.has(pathname) || pathname.startsWith("/admin")) return null;

  const phase = billingPhase(sub.status, sub.trialEndsAt, sub.cancelAt);
  const days = daysLeft(sub.trialEndsAt);
  const urgent = phase === "trialing" && days != null && days <= 3;
  // Fin d'essai imminente : le bandeau redevient visible même si masqué.
  const hidden = dismissed && !urgent;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* stockage indisponible */
    }
    setDismissed(true);
  }

  if (hidden) return null;

  if (phase === "trialing") {
    return (
      <Shell tone={urgent ? "urgent" : "info"}>
        <Hourglass className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">
          Essai gratuit —{" "}
          <strong className="font-semibold">
            {days == null ? "en cours" : days > 0 ? `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}` : "dernier jour"}
          </strong>
          {sub.trialEndsAt && <span className="hidden sm:inline"> · se termine le {formatDateFr(sub.trialEndsAt)}</span>}
        </span>
        <Link
          href="/auth/abonnement"
          className={cn(
            "ml-auto inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1 text-[11.5px] font-semibold transition-opacity hover:opacity-90",
            urgent ? "bg-destructive text-white" : "bg-primary text-primary-foreground",
          )}
        >
          Choisir ma formule <ArrowRight className="h-3 w-3" />
        </Link>
        {!urgent && <Dismiss onClick={dismiss} />}
      </Shell>
    );
  }

  if (phase === "canceling") {
    return (
      <Shell tone="info">
        <Undo2 className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate">
          Abonnement résilié — accès jusqu&apos;au{" "}
          <strong className="font-semibold">{sub.cancelAt ? formatDateFr(sub.cancelAt) : "terme"}</strong>
        </span>
        <Link
          href="/auth/abonnement"
          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-pill bg-primary px-3 py-1 text-[11.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Reprendre <ArrowRight className="h-3 w-3" />
        </Link>
        <Dismiss onClick={dismiss} />
      </Shell>
    );
  }

  return null;
}

function Shell({ tone, children }: { tone: "info" | "urgent"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 border-b px-4 py-2 text-[12px] sm:px-5",
        tone === "urgent"
          ? "border-destructive/20 bg-destructive/[0.07] text-foreground"
          : "border-warm/20 bg-warm/[0.07] text-foreground/85",
      )}
    >
      {children}
    </div>
  );
}

function Dismiss({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label="Masquer ce bandeau"
      className="h-6 w-6 shrink-0"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  );
}
