"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

/** Déconnexion Supabase + retour à l'écran de connexion. */
export function SignOutButton({
  className,
  label = "Se déconnecter",
  icon = true,
}: {
  className?: string;
  label?: string;
  icon?: boolean;
}) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/auth/login");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={signOut}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-black/[0.08]",
        className,
      )}
    >
      {icon && <LogOut className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
