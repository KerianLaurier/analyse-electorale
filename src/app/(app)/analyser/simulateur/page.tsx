import { redirect } from "next/navigation";

/**
 * Ancienne page « Simulateur de sièges » — remplacée par la lentille Projection, à l'échelle France.
 *
 * Les six outils autonomes d'Analyser sont devenus cinq lentilles sur un même
 * périmètre (cf. `src/app/(app)/analyser/perimetre.ts`). On redirige plutôt que
 * de casser les liens partagés, en conservant le périmètre s'il est dans l'URL.
 */
export default async function SimulateurRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = new URLSearchParams();
  for (const k of ["t", "c", "l"] as const) {
    const v = params[k];
    if (typeof v === "string") q.set(k, v);
  }
  const suffix = q.size > 0 ? `?${q.toString()}` : "";
  redirect(`/analyser/projection${suffix}`);
}
