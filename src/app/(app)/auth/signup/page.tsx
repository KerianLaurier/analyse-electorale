import { redirect } from "next/navigation";
import { waitlistHref } from "@/lib/site-url";

/**
 * PRÉ-LANCEMENT : l'inscription publique est fermée — la page renvoie vers la
 * liste d'attente de la landing. Le proxy (src/proxy.ts) fait la même chose en
 * amont ; cette redirection sert de ceinture de sécurité si la route est
 * atteinte autrement. À l'ouverture : rétablir `<AuthForm mode="signup" />`
 * (le formulaire vit toujours dans src/app/(app)/auth/auth-form.tsx).
 */
export default function SignupPage() {
  redirect(waitlistHref());
}
