"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export function ForgotForm() {
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("pending");
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email"));
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="px-6 pt-6">
        <Link href="/auth/login" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Connexion
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex items-center gap-2.5">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="block h-3 w-3 rounded-sm bg-primary-foreground" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">MOUVANCIA</span>
          </div>

          <h1 className="text-[24px] font-semibold tracking-tight">Mot de passe oublié</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Saisissez votre e-mail : vous recevrez un lien pour définir un nouveau mot de passe.
          </p>

          {status === "sent" ? (
            <div className="mt-6 flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12.5px] text-foreground/80">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
              <span>Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d&apos;être envoyé. Vérifiez votre boîte de réception.</span>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-foreground/80">E-mail professionnel</span>
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="vous@organisation.fr"
                  autoComplete="email"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-warm focus:ring-2 focus:ring-warm/20"
                />
              </label>

              {status === "error" && error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "pending"}
                className={cn(
                  "mt-1 inline-flex items-center justify-center gap-2 rounded-pill bg-primary px-5 py-2.5 text-[14px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60",
                )}
              >
                {status === "pending" && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer le lien
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
            <Link href="/auth/login" className="font-medium text-foreground hover:underline">Retour à la connexion</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
