import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

const TIERS = [
  { name: "Candidat", desc: "1 circonscription suivie, fiches & analyses, export." },
  { name: "Équipe", desc: "Plusieurs territoires, partage en équipe, ciblage." },
  { name: "Parti", desc: "National, API, intégrations & support dédié." },
];

export default async function AbonnementPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[520px]">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-warm/15 text-warm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[24px] font-semibold tracking-tight">Abonnement requis</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {user?.email ? (
            <>Le compte <span className="font-medium text-foreground">{user.email}</span> n&apos;a pas (ou plus) d&apos;abonnement actif.</>
          ) : (
            <>Cet espace est réservé aux abonnés.</>
          )}{" "}
          L&apos;accès à l&apos;analyse électorale 2027 nécessite un abonnement actif.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {TIERS.map((t) => (
            <div key={t.name} className="rounded-xl border border-black/5 bg-white/60 p-4">
              <p className="text-[14px] font-semibold">{t.name}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{t.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <a
            href="mailto:contact@mouvancia.fr?subject=Abonnement%20Analyse%20%C3%A9lectorale"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Demander un accès
          </a>
          <SignOutButton />
          <Link href="/" className="text-[12px] text-muted-foreground hover:text-foreground">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
