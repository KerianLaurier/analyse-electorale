"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Info, AlertCircle } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Alert, AlertTitle, AlertIcon } from "@appica/ui-react/alert";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

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
      setError(authErrorMessage(error));
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
            <Alert variant="warning" className="mt-6 text-[12.5px]">
              <AlertIcon><Info className="h-3.5 w-3.5" /></AlertIcon>
              <AlertTitle>
                Si un compte existe pour cette adresse, un e-mail de réinitialisation vient
                d&apos;être envoyé. Vérifiez votre boîte de réception.
              </AlertTitle>
            </Alert>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-medium text-foreground/80">E-mail professionnel</span>
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="vous@organisation.fr"
                  autoComplete="email"
                  className="text-[13px]"
                />
              </label>

              {status === "error" && error && (
                <Alert variant="error" className="text-[12px]">
                  <AlertIcon><AlertCircle className="h-3.5 w-3.5" /></AlertIcon>
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <Button type="submit" size="lg" disabled={status === "pending"} className="mt-1 gap-2 rounded-pill">
                {status === "pending" && <Spinner currentColor className="size-4" aria-label="Envoi en cours" />}
                Envoyer le lien
              </Button>
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
