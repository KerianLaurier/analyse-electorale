"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import Script from "next/script";
import { Button } from "@appica/ui-react/button";

/**
 * Google Analytics 4, conditionné au consentement (exigence CNIL : la mesure
 * d'audience GA n'est pas exemptée de consentement, a fortiori sur un site à
 * audience politique).
 *
 * - `NEXT_PUBLIC_GA_ID` absent (dev, previews) → le composant ne rend rien,
 *   pas même le bandeau : aucun consentement à demander sans traceur.
 * - Choix mémorisé en localStorage ; tant qu'aucun choix n'est fait, GA n'est
 *   PAS chargé (aucune requête vers Google, pas de « consent mode » en ping).
 * - « Accepter » et « Refuser » ont le même poids visuel (exigence CNIL).
 *
 * Le choix est lu via `useSyncExternalStore` (même idiome que
 * landing-session.tsx) : `ssr` côté serveur — ni bandeau ni script dans le
 * HTML statique — puis la valeur réelle à l'hydratation.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const STORAGE_KEY = "mvc-consent-analytics";

type Consent = "granted" | "denied" | "unset";

// Repli mémoire quand localStorage est indisponible (navigation privée
// stricte…) : le choix vaut alors au moins pour la page en cours.
let fallback: Consent | null = null;

const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): Consent {
  if (fallback) return fallback;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : "unset";
  } catch {
    return "unset";
  }
}

function choose(value: "granted" | "denied") {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Non persistable → repli mémoire.
  }
  fallback = value;
  listeners.forEach((l) => l());
}

export function AnalyticsConsent() {
  const consent = useSyncExternalStore(subscribe, snapshot, () => "ssr" as const);

  if (!GA_ID) return null;

  return (
    <>
      {consent === "granted" && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
          </Script>
        </>
      )}

      {consent === "unset" && (
        <div
          role="dialog"
          aria-label="Consentement à la mesure d'audience"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-canvas p-4 shadow-floating sm:p-5"
        >
          <p className="text-[13px] leading-relaxed text-foreground/85">
            <strong className="font-semibold">Mesure d&apos;audience.</strong>{" "}
            Nous souhaitons utiliser Google Analytics pour comprendre la fréquentation de ce site. Refuser
            n&apos;a aucune conséquence sur votre navigation —{" "}
            <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
              politique de confidentialité
            </Link>
            .
          </p>
          <div className="mt-3 flex gap-2.5">
            <Button size="sm" variant="outline" className="flex-1 rounded-pill" onClick={() => choose("denied")}>
              Refuser
            </Button>
            <Button size="sm" variant="outline" className="flex-1 rounded-pill" onClick={() => choose("granted")}>
              Accepter
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
