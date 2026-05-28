# Design tokens — v3 modern

Extraits depuis le DOM rendu des 3 maquettes HTML (Explorer / Analyser / Suivre).

## Couleurs

### Surfaces

| Token              | Hex      | Usage                                     |
| ------------------ | -------- | ----------------------------------------- |
| `--bg-canvas`      | #F4F3EF  | Fond principal de l'app (off-white cream) |
| `--bg-surface`     | #FFFFFF  | Cards principales                         |
| `--bg-surface-alt` | #FAFAF8  | Surfaces secondaires                      |
| `--bg-surface-soft`| #ECEAE4  | Chips, pills inactives                    |
| `--bg-on-dark`     | #0A0A0C  | Header pill, CTA primaire                 |

### Texte

| Token              | Hex      | Usage                                     |
| ------------------ | -------- | ----------------------------------------- |
| `--fg-primary`     | #0A0A0C  | Texte principal                           |
| `--fg-secondary`   | #1F1F23  | Headings                                  |
| `--fg-soft`        | #55555D  | Texte moyennement atténué                 |
| `--fg-muted`       | #8A8A93  | Labels, captions                          |
| `--fg-on-dark`     | #FAFAF8  | Texte sur fond noir                       |

### Accents et sémantique

| Token              | Hex      | Usage                                     |
| ------------------ | -------- | ----------------------------------------- |
| `--accent-warm`    | #F0A020  | Highlights, couleur marque ENS/macron     |
| `--bloc-navy`      | #2C4978  | Bleu politique (LR / centre droit)        |
| `--bloc-red`       | #B0212B  | Rouge politique (RN / gauche radicale)    |
| `--success`        | #2B7748  | Variations positives                      |
| `--border-subtle`  | #C8C8CC  | Bordures fines                            |

## Typographie

- Famille : `Geist, sans-serif` (importée via next/font ailleurs)
- Mono : `Geist Mono, monospace`
- Échelle utilisée (px) : 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 (taille de body dominante) · 14 · 16 · 22 (gros chiffres KPI)
- Poids : 400 normal · 500 medium (le plus fréquent) · 600 occasionnel

## Radii

- `50%`   — avatars, points colorés
- `6-7px` — boutons compacts, chips
- `9-11px` — cards et containers principaux
- `999px` — pills (toggle, sélecteurs)

## Shadows

| Token              | Valeur                                                                          | Usage |
| ------------------ | ------------------------------------------------------------------------------- | ----- |
| `--shadow-floating`| `rgba(10,10,12,0.16) 0 24px 64px -16px, rgba(10,10,12,0.06) 0 6px 18px`         | Fiche territoire flottante |
| `--shadow-card`    | `rgba(10,10,12,0.04) 0 1px 2px, rgba(10,10,12,0.1) 0 0 0 1px`                   | Cards standard (border-as-shadow) |
| `--ring`           | `rgba(0,0,0,0.1) 0 0 0 1px`                                                     | Focus ring |
| `--ring-strong`    | `rgba(255,255,255,0.9) 0 0 0 2px, rgba(10,10,12,0.1) 0 0 0 3px`                | Sélection forte |

## Layout (Explorer)

- Sidebar verticale icônes : ~60px
- Panneau gauche couches : ~280px
- Centre carte : flex
- Fiche territoire flottante (droite) : ~360px, position absolute, shadow-floating
- Header : pill noir centré en haut, padding 16px

## Notes

Identité **MOUVANCIA** assumée — palette orange chaud + noir profond + crème. Diffère du brief initial qui suggérait une identité distincte ; le design final intègre l'écosystème MOUVANCIA (cohérent avec section 9 du brief).
