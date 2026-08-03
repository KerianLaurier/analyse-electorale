"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTACT_EMAIL = "contact@mouvancia.fr";

type State = { status: "idle" | "loading" | "done" } | { status: "error"; message: string };

/**
 * Inscription à la liste d'attente de pré-lancement.
 *
 * Poste vers /api/waitlist, qui écrit côté serveur avec le service_role — la
 * table `waitlist` n'est pas accessible depuis le navigateur (RLS sans policy).
 * La réponse est identique que l'adresse soit nouvelle ou déjà inscrite, pour
 * ne pas transformer le formulaire en oracle d'appartenance à la liste.
 */
export function WaitlistForm({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setState({
          status: "error",
          message: body?.error ?? "Inscription impossible pour le moment.",
        });
        return;
      }
      setState({ status: "done" });
    } catch {
      setState({ status: "error", message: "Connexion impossible. Vérifiez votre réseau." });
    }
  }

  if (state.status === "done") {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border border-success/30 bg-success/[0.07] px-4 py-3.5",
          className,
        )}
      >
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
          <Check className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13.5px] leading-relaxed text-foreground/85">
          <strong className="font-semibold">C&apos;est noté.</strong> Vous serez prévenu·e dès
          l&apos;ouverture de MOUVANCIA. Aucun autre e-mail ne vous sera envoyé d&apos;ici là.
        </p>
      </div>
    );
  }

  const loading = state.status === "loading";

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Adresse e-mail</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={loading}
            placeholder="vous@organisation.fr"
            aria-describedby="waitlist-rgpd"
            className="w-full rounded-pill border border-border bg-canvas px-4 py-3 text-[14px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-warm focus:ring-2 focus:ring-warm/20 disabled:opacity-60"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-pill bg-primary px-5 py-3 text-[14px] font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Inscription…
            </>
          ) : (
            <>
              Être prévenu·e <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-[12.5px] text-destructive">
          {state.message} Vous pouvez aussi nous écrire à{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      )}

      <p id="waitlist-rgpd" className="text-[11.5px] leading-relaxed text-muted-foreground">
        En vous inscrivant, vous acceptez d&apos;être recontacté·e à l&apos;ouverture du service.
        Votre adresse ne sert qu&apos;à cela, n&apos;est jamais cédée, et vous pouvez demander son
        effacement à tout moment —{" "}
        <a href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
}
