# La langue MaisonVide — adaptation du système oryzo.ai

oryzo.ai (Lusion, 2026) est une page produit cinématique : fond noir, crème, une seule
couleur d'accent (orange), une typographie à cinq rôles, des filets en pointillés, des
données entre crochets, et un scroll long qui épingle des sections entières.

MaisonVide garde sa **substance** (carnet d'inventaire, papier, kraft, sceau) mais
adopte la **grammaire** d'oryzo : plus technique, plus éditorial, plus dense, plus
cinématique au scroll.

Ce document est le contrat. Tout le travail de refonte s'y conforme.

---

## 1. Les sept apports d'oryzo qu'on garde

| # | Apport oryzo | Adaptation MaisonVide |
|---|---|---|
| 1 | **Filets en pointillés** (`.o-dashline`) partout | `.trait` — le séparateur par défaut. Remplace les filets 1px |
| 2 | **Données entre crochets** `[ 364 ]`, `[ 4.9/5 ]` | `.data` — toute donnée chiffrée : `[ 12 ]`, `[ 87 % ]`, `[ 2 M+ ]` |
| 3 | **Cinq rôles typographiques** | `.lede` (38px) `.sub` (24px) `.micro` (18px) `.note` (16px mono) `.quote` (30px) |
| 4 | **Bouton qui s'inverse** (bg → inversé au survol) | `.btn` en capitales + inversion au survol, `.btn--glow` avec liseré d'accent |
| 5 | **Barre de progression de scroll** en bord droit, avec libellé | `.scroll-rail` fixe à droite, point + libellé de section |
| 6 | **Sections épinglées** au scroll (400–1300 vh) | `.act` — 3 moments cinématiques : l'inventaire, la charte, le séquestre |
| 7 | **Grille 16 colonnes**, gouttière large | `--grid-cols: 16` + `.col-*` ; le hero et le catalogue s'alignent dessus |

## 2. Ce qu'on ne prend pas

- Le **fond noir permanent**. MaisonVide reste sur le papier : c'est le monde du
  projet. Le noir devient un **acte** (`--ink-900`), pas le fond.
- Le **WebGL de 3D** d'oryzo : trop lourd pour le public. On garde Three.js pour
  le CRM en espace pro, en local.
- Les **effets de clone** (pulsation, glitch, typo décorative). On garde la rigueur.

---

## 3. Les primitives à créer

### 3.1 `.trait` — le filet en pointillés (LE signe)

```css
.trait {
  height: 1px;
  background: repeating-linear-gradient(90deg,
    var(--ink-900) 0 3px, transparent 0 7px);
}
.trait--faint { --trait-color: var(--ink-300); }
.trait--stamp { --trait-color: var(--stamp-500); }
.trait--vertical { width: 1px; height: 100%; background: repeating-linear-gradient(180deg, …); }
```

Usage : entre deux blocs, sous un titre, dans un en-tête de section, dans un tableau.
**C'est le séparateur par défaut.** Un `border-bottom: 1px solid` ne l'est plus, sauf
pour le bord physique d'une fiche.

### 3.2 `.data` — la donnée entre crochets

```css
.data {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  letter-spacing: .02em;
  color: var(--ink-600);
}
.data::before { content: "[ "; color: var(--ink-400); }
.data::after  { content: " ]"; color: var(--ink-400); }
```

Usage : `[ 12 annonces ]`, `[ 87 % de confiance ]`, `[ séquestre 300 € ]`.
Une donnée, jamais une phrase. Jamais de `.label` là où un `.data` suffit.

### 3.3 Les cinq rôles typographiques

| Classe | Taille | Rôle | Traitement |
|---|---|---|---|
| `.lede` | `clamp(1.25rem, 2.2vw, 1.7rem)` | phrase d'accroche de section | line-height 1.35, `max-width: 26ch` |
| `.sub` | `clamp(1.05rem, 1.6vw, 1.3rem)` | sous-titre | line-height 1.4 |
| `.micro` | `.9375rem` | corps de texte secondaire | line-height 1.65 |
| `.note` | `.8125rem` mono | annotation technique, uppercase, tracking .08em | `color: var(--ink-500)` |
| `.quote` | `clamp(1.15rem, 1.9vw, 1.55rem)` | citation | display, line-height 1.4 |

### 3.4 `.btn` — inversion au survol

```css
.btn { text-transform: uppercase; letter-spacing: .04em; }
.btn--primary { background: var(--stamp-500); color: #fff; }
.btn--primary:hover { background: var(--ink-900); color: var(--paper-sheet); }
.btn--glow { border: 1.5px solid var(--ink-300); }
.btn--glow:hover { border-color: var(--stamp-500); color: var(--stamp-600); }
```

Plus une variante « flip » : le libellé bascule verticalement au survol
(`.btn--flip > span` avec `translateY(-100%)` → `translateY(0)`), sur le modèle oryzo.

### 3.5 `.scroll-rail` — l'indicateur de progression

Barre verticale fixe à droite (2 px), avec un point qui descend en fonction du scroll
et un libellé qui annonce la section courante. Masquée sous 1100 px.
**Une seule séquence de ce type sur tout le site** (c'est le pendant de « Le relevé »).

### 3.6 `.act` — les sections épinglées

Une section `position: relative` d'une hauteur `N * 100vh`, contenant une
`position: sticky` qui reste centrée pendant que le contenu défile. Trois usages :

1. **L'inventaire** (3 étapes) — la colonne de gauche reste fixe avec le numéro de
   l'étape qui change ; la colonne de droite défile.
2. **La charte** (7 barrières) — une barrière se grave au fur et à mesure.
3. **Le séquestre** (5 étapes) — le rail se remplit.

Fallback sans JS : la section se lit normalement (hauteur auto, pas de sticky).

---

## 4. Ce qui ne change pas

- Le monde « inventaire de brocante » : papier, kraft, tampon, sceau.
- La séquence signature « Le relevé » au hero de l'accueil et de la page de vente.
- Les interdits du craft-floor : pas d'eyebrow, pas d'emoji, pas de glass décoratif,
  pas de gradient sur texte, pas de grille de cartes identiques, pas de mono en costume.
- Le contenu visible par défaut : toute animation est un bonus, jamais une condition.

## 5. Les chiffres (source unique de vérité)

8 % à la vente · 30 s pour un prix · 2 M+ transactions · AXA 10 000 € ·
7 barrières · 4 paliers KYC · 5 étapes de séquestre · 12 patterns d'arnaque ·
8 médiateurs · réponse < 2 min · 487 blocages/mois · 12 annonces · 12 vendeurs ·
9 villes · 87 % de confiance moyenne · 1 089 ms de latence IA.

## 6. Structure type d'une page en acte

```html
<section class="act" data-act="inventaire">
  <div class="act__sticky">
    <div class="note">L.01</div>
    <h2 class="display">L'inventaire,<br>en trois lignes.</h2>
  </div>
  <div class="act__flow">
    <article class="inventaire__row">…</article>
    <article class="inventaire__row">…</article>
  </div>
</section>
```

La page doit rester lisible si `position: sticky` est ignoré : c'est une
amélioration, jamais une condition d'accès au contenu.
