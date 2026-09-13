"use client";

import { useState } from "react";

/** Un membre couvert peut toujours résilier son ancien abonnement personnel. */
export function PersonalBillingPortal() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function openPortal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error();
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error();
      window.location.assign(url.href);
    } catch {
      setError("Le portail de facturation est indisponible. Réessayez.");
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p>
        Votre compte conserve un historique de facturation personnel. Rejoindre
        une équipe ne résilie pas un abonnement existant : vérifiez son état
        dans le portail.
      </p>
      <button
        type="button"
        onClick={openPortal}
        disabled={busy}
        className="underline disabled:opacity-50"
      >
        {busy ? "Ouverture…" : "Gérer ma facturation personnelle"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
