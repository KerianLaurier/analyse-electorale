"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@appica/ui-react/button";
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
    <Button
      type="button"
      variant="soft"
      size="sm"
      onClick={signOut}
      className={cn("gap-1.5 rounded-pill text-[12px]", className)}
    >
      {icon && <LogOut className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
