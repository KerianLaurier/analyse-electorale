"use client";

import { useState } from "react";
import { Mail, ArrowRight, Send } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Textarea } from "@appica/ui-react/textarea";
import { cn } from "@/lib/utils";

const DISPLAY = "[font-family:var(--font-display)]";

// Adresse de contact (déjà utilisée pour la formule Cabinet des tarifs).
const CONTACT_EMAIL = "contact@mouvancia.fr";

// Les champs Appica portent leur propre cadre : il ne reste que le fond canvas
// (la section est posée sur une surface claire) et l'échelle de texte.
const field = "w-full bg-canvas text-[14px]";

/**
 * Section « Contact » de la landing. Le formulaire compose un e-mail pré-rempli
 * et ouvre le client de messagerie du visiteur (aucun back-end requis, robuste).
 * Un lien direct est proposé en repli. `id="contact"` (ancré depuis la nav).
 */
export function LandingContact() {
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const org = String(form.get("org") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();

    const subject = `Demande de contact — ${org || name || "MOUVANCIA"}`;
    const body =
      `Nom : ${name}\n` +
      `Organisation : ${org || "—"}\n` +
      `E-mail : ${email}\n\n` +
      `${message}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className="grid gap-8 rounded-3xl border border-border bg-canvas p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:p-10">
      {/* Colonne info */}
      <div>
        <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span aria-hidden className="h-px w-6 bg-warm" />
          Contact
        </p>
        <h2 className={cn(DISPLAY, "mt-3 text-[clamp(1.7rem,3.4vw,2.5rem)] font-extrabold leading-[1.04] tracking-[-0.02em]")}>
          Parlons de votre campagne.
        </h2>
        <p className="mt-3 max-w-[46ch] text-[14.5px] leading-relaxed text-muted-foreground">
          Une démonstration, un devis, un besoin particulier pour votre parti ou votre cabinet ?
          Écrivez-nous — nous répondons sous 24&nbsp;h ouvrées.
        </p>

        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-6 inline-flex items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-warm/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warm/12 text-warm">
            <Mail className="h-[18px] w-[18px]" />
          </span>
          <span className="flex flex-col">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Nous écrire</span>
            <span className={cn(DISPLAY, "text-[15px] font-bold")}>{CONTACT_EMAIL}</span>
          </span>
        </a>

        <p className="mt-5 text-[12px] text-muted-foreground">
          Vous voulez simplement être prévenu·e de l&apos;ouverture ?{" "}
          <a href="#bientot" className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/70">
            Rejoignez la liste d&apos;attente
          </a>{" "}
          — une adresse e-mail suffit.
        </p>
      </div>

      {/* Colonne formulaire */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-foreground/80">Nom</span>
            <Input name="name" type="text" required autoComplete="name" placeholder="Camille Dupont" className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-foreground/80">Organisation</span>
            <Input name="org" type="text" autoComplete="organization" placeholder="Parti, cabinet, équipe…" className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-foreground/80">E-mail professionnel</span>
          <Input name="email" type="email" required autoComplete="email" placeholder="vous@organisation.fr" className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-foreground/80">Votre message</span>
          <Textarea name="message" required rows={4} placeholder="Décrivez votre besoin, votre territoire, votre échéance…" className={`${field} resize-y`} />
        </label>
        <Button
          type="submit"
          size="lg"
          className="mt-1 gap-2 rounded-pill text-[14px] font-semibold transition-transform hover:-translate-y-0.5"
        >
          <Send className="h-4 w-4" /> Envoyer le message
        </Button>
        {sent ? (
          <p className="text-[12.5px] text-success">
            Votre logiciel de messagerie s&apos;est ouvert avec le message pré-rempli. Sinon, écrivez-nous à{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline underline-offset-2">{CONTACT_EMAIL}</a>.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ArrowRight className="h-3.5 w-3.5" />
            Le message ouvre votre messagerie, pré-rempli — rien n&apos;est envoyé sans votre validation.
          </p>
        )}
      </form>
    </div>
  );
}
