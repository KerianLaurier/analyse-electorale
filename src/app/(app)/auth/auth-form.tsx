"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Info, AlertCircle } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import { Input } from "@appica/ui-react/input";
import { Spinner } from "@appica/ui-react/spinner";
import { Alert, AlertTitle, AlertIcon } from "@appica/ui-react/alert";
import { Badge } from "@appica/ui-react/badge";
import { Separator } from "@appica/ui-react/separator";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth-errors";
import { waitlistHref } from "@/lib/site-url";
import { waitForSessionCookie } from "@/lib/session-cookie";
import { safeInternalPath } from "@/lib/safe-redirect";

type Mode = "login" | "signup";

export function AuthForm({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  const params = useSearchParams();
  // Chemin interne validé : bloque les redirections ouvertes via ?next=…
  const next = safeInternalPath(params.get("next"));
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
        setError(authErrorMessage(error));
        setStatus("error");
        return;
      }
      await waitForSessionCookie();
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
        // Lien de confirmation e-mail → échange du code côté serveur, puis
        // accueil du parcours (essai démarré) sur /bienvenue.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/bienvenue")}`,
      },
    });
    if (error) {
      setError(authErrorMessage(error));
      setStatus("error");
      return;
    }
    // L'essai de 14 jours démarre automatiquement (trigger `handle_new_user`) :
    // accueil sur /bienvenue, sauf destination explicite demandée avant l'inscription.
    const landing = next === "/explorer" ? "/bienvenue" : next;

    // Session immédiate (confirmation e-mail désactivée) → on entre directement.
    if (data.session) {
      await waitForSessionCookie();
      window.location.assign(landing);
      return;
    }
    // Pas de session au signUp, mais certaines configs autorisent quand même la
    // connexion par mot de passe : on tente, pour un parcours sans couture.
    // Sinon (confirmation obligatoire), écran « vérifiez vos e-mails ».
    const { data: login } = await supabase.auth.signInWithPassword({ email, password });
    if (login.session) {
      await waitForSessionCookie();
      window.location.assign(landing);
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
            {isLogin ? "Connexion" : "Démarrer l'essai gratuit"}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {isLogin
              ? "Accédez à vos analyses électorales."
              : "14 jours d'accès complet à l'analyse électorale 2027 — sans carte bancaire, sans engagement."}
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
              action={isLogin ? <Link href="/auth/forgot" className="text-[11px] font-medium text-muted-foreground hover:text-foreground">Oublié ?</Link> : undefined}
            />

            {status === "check-email" && (
              <Alert variant="warning" className="text-[12px]">
                <AlertIcon><Info className="h-3.5 w-3.5" /></AlertIcon>
                <AlertTitle>
                  Compte créé — votre essai gratuit de 14 jours est réservé. Ouvrez le lien de
                  confirmation envoyé par e-mail pour accéder à votre espace.
                </AlertTitle>
              </Alert>
            )}
            {status === "error" && error && (
              <Alert variant="error" className="text-[12px]">
                <AlertIcon><AlertCircle className="h-3.5 w-3.5" /></AlertIcon>
                <AlertTitle>{error}</AlertTitle>
              </Alert>
            )}

            <Button type="submit" size="lg" disabled={status === "pending"} className="mt-1 gap-2 rounded-pill">
              {status === "pending" && <Spinner currentColor className="size-4" aria-label="Connexion en cours" />}
              {isLogin ? "Se connecter" : "Démarrer mon essai gratuit"}
            </Button>
          </form>

          {/* Le Separator d'Appica est un filet, pas un séparateur libellé : on
              encadre le « ou » de deux filets plutôt que de lui passer un enfant. */}
          <div className="my-5 flex items-center gap-3 text-[11px] text-muted-foreground">
            <Separator className="flex-1" />
            ou
            <Separator className="flex-1" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled
            title="Bientôt disponible"
            className="w-full gap-2 rounded-pill"
          >
            Continuer avec SSO
            <Badge variant="soft" size="xs">bientôt</Badge>
          </Button>

          <p className="mt-6 text-center text-[12.5px] text-muted-foreground">
            {isLogin ? (
              // Pré-lancement : plus de création de compte — on renvoie vers la
              // liste d'attente (lien absolu : la vitrine vit sur le domaine racine).
              <>Pas encore de compte ? <a href={waitlistHref()} className="font-medium text-foreground hover:underline">Rejoindre la liste d&apos;attente</a></>
            ) : (
              <>Déjà inscrit ? <Link href="/auth/login" className="font-medium text-foreground hover:underline">Se connecter</Link></>
            )}
          </p>

          <p className="mt-8 text-center text-[10.5px] text-muted-foreground/70">
            En continuant, vous acceptez les{" "}
            <Link href="/cgu" className="underline underline-offset-2 hover:text-foreground">
              conditions d&apos;utilisation
            </Link>{" "}
            et la{" "}
            <Link href="/confidentialite" className="underline underline-offset-2 hover:text-foreground">
              politique de confidentialité
            </Link>{" "}
            de MOUVANCIA.
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
      <Input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="text-[13px]"
      />
    </label>
  );
}
