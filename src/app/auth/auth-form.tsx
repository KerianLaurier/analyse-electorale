"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  const params = useSearchParams();
  const next = params.get("next") || "/explorer";
  const [status, setStatus] = useState<"idle" | "pending" | "check-email" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("pending");
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setStatus("error");
        return;
      }
      // Laisse le client écrire les cookies de session avant la navigation complète.
      await new Promise((r) => setTimeout(r, 200));
      window.location.assign(next);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: String(form.get("name") || ""),
          organisation: String(form.get("org") || ""),
        },
      },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    // Session immédiate (confirmation e-mail désactivée) → on entre directement.
    if (data.session) {
      await new Promise((r) => setTimeout(r, 200));
      window.location.assign(next);
      return;
    }
    setStatus("check-email");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <div className="px-6 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Accueil
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          {/* Marque */}
          <div className="mb-7 flex items-center gap-2.5">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
              <span className="block h-3 w-3 rounded-sm bg-primary-foreground" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">MOUVANCIA</span>
          </div>

          <h1 className="text-[24px] font-semibold tracking-tight">
            {isLogin ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {isLogin
              ? "Accédez à vos analyses électorales."
              : "Demandez un accès à l'espace d'analyse 2027."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3.5">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nom" name="name" type="text" placeholder="Camille Dupont" autoComplete="name" />
                <Field label="Organisation" name="org" type="text" placeholder="Parti / cabinet" autoComplete="organization" />
              </div>
            )}
            <Field label="E-mail professionnel" name="email" type="email" placeholder="vous@organisation.fr" autoComplete="email" required />
            <Field
              label="Mot de passe"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              action={isLogin ? <button type="button" className="text-[11px] font-medium text-muted-foreground hover:text-foreground">Oublié ?</button> : undefined}
            />

            {status === "check-email" && (
              <div className="flex items-start gap-2 rounded-md bg-warm/12 px-3 py-2.5 text-[12px] text-foreground/80">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warm" />
                <span>Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.</span>
              </div>
            )}
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
              {isLogin ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="inline-flex w-full items-center justify-center gap-2 rounded-pill border border-border bg-surface px-5 py-2.5 text-[13px] font-medium text-foreground/70 opacity-70"
          >
            Continuer avec SSO
            <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] text-muted-foreground">bientôt</span>
          </button>

          <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
            {isLogin ? (
              <>Pas encore de compte ? <Link href="/auth/signup" className="font-medium text-foreground hover:underline">Demander un accès</Link></>
            ) : (
              <>Déjà inscrit ? <Link href="/auth/login" className="font-medium text-foreground hover:underline">Se connecter</Link></>
            )}
          </p>

          <p className="mt-8 text-center text-[10.5px] text-muted-foreground/70">
            En continuant, vous acceptez les conditions d&apos;utilisation de MOUVANCIA.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  placeholder,
  autoComplete,
  required,
  action,
}: {
  label: string;
  name: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[12px] font-medium text-foreground/80">
        {label}
        {action}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-shadow placeholder:text-muted-foreground/60 focus:border-warm focus:ring-2 focus:ring-warm/20"
      />
    </label>
  );
}
