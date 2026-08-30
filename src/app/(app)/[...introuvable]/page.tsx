import { notFound } from "next/navigation";

/**
 * Attrape-tout : rend la 404 **maison** (`(app)/not-found.tsx`), dans le chrome
 * applicatif, pour toute URL qui ne correspond à aucune route.
 *
 * Nécessaire depuis le passage à deux layouts racines (`(vitrine)` et `(app)`) :
 * sans `src/app/layout.tsx`, Next n'a plus de tronc commun où composer une 404
 * globale et retombe sur sa page par défaut en anglais (« This page could not be
 * found »). Les routes statiques et dynamiques déclarées ont la priorité sur ce
 * segment, qui n'attrape donc que le reste.
 *
 * À noter : un visiteur non connecté n'arrive pas jusqu'ici — le proxy renvoie
 * toute URL inconnue vers la page de connexion (cf. `src/proxy.ts`). Cette page
 * sert les personnes authentifiées qui suivent un lien périmé.
 */
export default function CatchAllPage(): never {
  notFound();
}
