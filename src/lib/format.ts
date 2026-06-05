// Formatage de nombres fr-FR — instances `Intl.NumberFormat` mémoïsées au
// niveau module (réutilisées plutôt que recréées à chaque appel : gain sensible
// au rendu de longues listes / choroplèthes). Source unique de vérité pour
// remplacer les définitions locales jusque-là dupliquées dans les vues.

const intFmt = new Intl.NumberFormat("fr-FR");

/** Entier fr-FR (séparateur de milliers), arrondi. Ex. « 11 134 ». */
export const fmtInt = (n: number) => intFmt.format(Math.round(n));

/** Montant en euros entiers. Ex. « 22 040 € ». */
export const fmtEuro = (n: number) => `${fmtInt(n)} €`;

// Formatters de pourcentage par nombre de décimales (cachés) — `fmtPct` prend
// une fraction 0..1 et applique un nombre fixe de décimales (défaut 1), sortie
// identique à `(n*100).toLocaleString("fr-FR", { min: d, max: d })`.
const pctFmt = new Map<number, Intl.NumberFormat>();
function pctFormatter(d: number): Intl.NumberFormat {
  let f = pctFmt.get(d);
  if (!f) {
    f = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
    pctFmt.set(d, f);
  }
  return f;
}

/** Pourcentage à partir d'une fraction 0..1, `d` décimales fixes (défaut 1). */
export const fmtPct = (n: number, d = 1) => `${pctFormatter(d).format(n * 100)} %`;
