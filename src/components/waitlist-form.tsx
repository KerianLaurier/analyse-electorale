"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Alert, AlertTitle, AlertIcon } from "@appica/ui-react/alert";
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
      <Alert variant="success" className={className}>
        <AlertIcon><Check className="h-3.5 w-3.5" /></AlertIcon>
        <AlertTitle className="text-[13.5px] leading-relaxed">
          <strong className="font-semibold">C&apos;est noté.</strong> Vous serez prévenu·e dès
          l&apos;ouverture de MOUVANCIA. Aucun autre e-mail ne vous sera envoyé d&apos;ici là.
        </AlertTitle>
      </Alert>
    );
  }

  const loading = state.status === "loading";

  return (
    <form onSubmit={onSubmit} className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">Adresse e-mail</span>
          <Input
            name="email"
            type="email"
            inputSize="lg"
            required
            autoComplete="email"
            disabled={loading}
            placeholder="vous@organisation.fr"
            aria-describedby="waitlist-rgpd"
            className="w-full rounded-pill bg-canvas text-[14px]"
          />
        </label>
        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="shrink-0 gap-2 rounded-pill text-[14px] font-semibold transition-transform hover:-translate-y-0.5 disabled:translate-y-0"
        >
          {loading ? (
            <>
              <Spinner currentColor className="size-4" aria-label="Inscription en cours" /> Inscription…
            </>
          ) : (
            <>
              Être prévenu·e <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
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
        <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
          politique de confidentialité
        </Link>
        .
      </p>
    </form>
  );
}
