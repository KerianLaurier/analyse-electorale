"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Alert, AlertTitle, AlertIcon } from "@appica/ui-react/alert";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";

type Phase = "checking" | "ready" | "invalid" | "saving" | "done";

export function ResetForm() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    (async () => {
      // Lien de récupération : échange le code contre une session.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          /* code invalide / expiré : géré ci-dessous via getUser */
        }
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (active) setPhase(user ? "ready" : "invalid");
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setPhase("ready");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password"));
    const pw2 = String(fd.get("confirm"));
    if (pw.length < 8) {
      setError("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    if (pw !== pw2) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setPhase("saving");
    setError(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    if (error) {
      setError(authErrorMessage(error));
      setPhase("ready");
      return;
    }
    setPhase("done");
    await new Promise((r) => setTimeout(r, 900));
    window.location.assign("/explorer");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="px-6 pt-6">
        <Link href="/explorer" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-7 flex items-center gap-2.5">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <KeyRound className="h-4 w-4" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">MOUVANCIA</span>
          </div>

          <h1 className="text-[24px] font-semibold tracking-tight">Nouveau mot de passe</h1>

          {phase === "checking" && (
            <p className="mt-4 inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <Spinner currentColor className="size-4" aria-label="Vérification du lien" /> Vérification du lien…
            </p>
          )}

          {phase === "invalid" && (
            <>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Ce lien de réinitialisation est invalide ou a expiré. Vous pouvez en demander un nouveau.
              </p>
              <Button size="lg" nativeButton={false} className="mt-5 rounded-pill" render={<Link href="/auth/forgot" />}>
                Demander un nouveau lien
              </Button>
            </>
          )}

          {phase === "done" && (
            <Alert variant="success" className="mt-4 text-[12.5px]">
              <AlertIcon><CheckCircle2 className="h-3.5 w-3.5" /></AlertIcon>
              <AlertTitle>Mot de passe mis à jour. Redirection…</AlertTitle>
            </Alert>
          )}

          {(phase === "ready" || phase === "saving") && (
            <>
              <p className="mt-1.5 text-[13px] text-muted-foreground">Choisissez un nouveau mot de passe (8 caractères minimum).</p>
              <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
                <Field label="Nouveau mot de passe" name="password" />
                <Field label="Confirmer le mot de passe" name="confirm" />

                {error && (
                  <Alert variant="error" className="text-[12px]">
                    <AlertIcon><AlertCircle className="h-3.5 w-3.5" /></AlertIcon>
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                )}

                <Button type="submit" size="lg" disabled={phase === "saving"} className="mt-1 gap-2 rounded-pill">
                  {phase === "saving" && <Spinner currentColor className="size-4" aria-label="Enregistrement" />}
                  Enregistrer le mot de passe
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-foreground/80">{label}</span>
      <Input
        name={name}
        type="password"
        required
        autoComplete="new-password"
        placeholder="••••••••"
        className="text-[13px]"
      />
    </label>
  );
}
