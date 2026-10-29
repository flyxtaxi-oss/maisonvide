# État de l'art — dépôts motion / scroll animation pour un site statique sans build

**Projet :** MaisonVide — marketplace française de vide-grenier.
**Contrainte :** HTML/CSS/JS vanilla, zéro build, zéro CDN, zéro bundler. Identité « carnet d'inventaire de brocante » (papier-ledger `#e8e5db`, kraft `#b38d5c`, vermillon `#c0392b`, sceau vert `#41624d`, typos Sentient/Switzer/Caveat).
**Date de collecte des métadonnées :** 2026-10-29 (Europe/Paris).
**Méthode :** `gh api repos/<owner>/<repo>` pour chaque dépôt (stars, `language`, `license.spdx_id`, `pushed_at`, `archived`, `description`, `homepage`, `size`). README via `gh api repos/<owner>/<repo>/readme`. Versions publiées et poids réels via `https://registry.npmjs.org/<pkg>/latest` et `https://unpkg.com/<pkg>@<ver>/?meta`. Support navigateur via `mdn/browser-compat-data` (`gh api repos/mdn/browser-compat-data/contents/css/properties/*.json`).

**Aucun chiffre de ce document ne vient de mémoire.** Les 404 sont notés comme tels. Les tailles sont des octets réels mesurés sur les artefacts publiés.

---

## État des lieux dans le projet (avant décision)

Pour éviter de proposer un doublon, relevé dans le dépôt au 2026-10-29 :

| Élément | Emplacement | État constaté |
|---|---|---|
| Lenis `1.3.26` | `assets/vendor/lenis.min.js` (18 722 o) | **déjà vendorisé et branché** — `assets/js/site.js:182` l'initialise avec `duration: 1.05`, easing custom, `touchMultiplier: 1.6`, et un garde `prefers-reduced-motion` (ligne 177). Chargé sur **15 pages HTML**. |
| Moteur de révélations maison | `assets/js/scroll.js` + `assets/css/scroll.css` | **déjà écrit** : `IntersectionObserver` + transitions CSS, rail de progression à droite, « actes » épinglés, filet `html:not(.js)` pour ne jamais masquer le contenu. |
| Three.js | `assets/vendor/three.module.js` + `three.core.js` | vendorisé, utilisé en `admin/3d.html` **via `<script type="importmap">`** (ligne 175) — le motif importmap est déjà accepté par le projet. |
| CSS scroll-driven | aucun | **absent** — c'est le principal manque. |

Conséquence directe : **Lenis n'est pas à choisir, il est à maintenir.** Les arbitrages restants sont : GSAP vs Motion, le découpage de texte, les transitions de page, et le natif CSS.

---

## 1. Tableau de décision

Légende métadonnées : `★` étoiles GitHub · langage · licence (`gh` renvoie `null` quand **aucun fichier LICENSE n'existe** dans le dépôt) · date du dernier push.

| # | Dépôt | Métadonnées réelles (★ / langage / licence / dernier push) | Ce que ça fait vraiment | Intégrable sans build ? | VERDICT | Pourquoi, en une phrase | Source de vérification |
|---|---|---|---|---|---|---|---|
| 1 | [greensock/GSAP](https://github.com/greensock/GSAP) | ★29 880 · JavaScript · **licence `null` (Standard « no charge »)** · 2026-04-13 | Moteur d'animation/timeline + ScrollTrigger, SplitText, Flip, ScrollSmoother, Observer, MorphSVG. Zéro dépendance. | **OUI** — `dist/*.min.js` en UMD, globals `gsap`/`ScrollTrigger` | **INTEGRER** | Le seul moteur qui couvre timeline + scroll-linked + split texte avec des fichiers UMD autonomes dans `dist/`. | `gh api repos/greensock/GSAP` |
| 2 | [motiondivision/motion](https://github.com/motiondivision/motion) | ★34 630 · TypeScript · MIT · 2026-10-28 | Successeur de Framer Motion. API vanilla `animate`, `scroll` (3,8 ko, s'appuie sur `ScrollTimeline`), `inView`, `stagger`, `spring`, `hover`, `press`. | **OUI mais imparfait** — seul `dist/motion.js` (UMD, 176 646 o) est autonome ; `dist/es/index.mjs` = `export * from 'framer-motion/dom'` → **specifier nu, inutilisable sans bundler** | **S'INSPIRER** | Excellente API, mais le seul bundle navigateur fait 176 ko contre 117 ko pour GSAP+ScrollTrigger, et son ESM exige un bundler. | `gh api repos/motiondivision/motion` |
| 3 | [darkroomengineering/lenis](https://github.com/darkroomengineering/lenis) | ★16 939 · TypeScript · MIT · 2026-10-27 | Smooth scroll par interpolation exponentielle, anime `window.scrollTo` — ne bloque pas le scroll natif. Monorepo `packages/core`. | **OUI, déjà fait** — `dist/lenis.min.js` (18 815 o) + `dist/lenis.css` (513 o) | **INTEGRER (déjà en place)** | À maintenir et à passer en 1.3.27 ; c'est la seule couche qui rend le scroll amorti compatible `position: sticky`. | `gh api repos/darkroomengineering/lenis` |
| 4 | [juliangarnier/anime](https://github.com/juliangarnier/anime) | ★74 005 · JavaScript · MIT · 2026-08-21 | Moteur d'animation/timeline JS (v4), avec pont WAAPI (`anime/waapi`), `drag`, `svg`, `text`. **Ne fait pas de scroll-linked.** | **OUI** — `dist/bundles/anime.esm.min.js` (118 678 o) ESM, ou `umd/index.min.js` (11 804 o pour `split-type`, non ici) | **S'INSPIRER** | Le plus étoilé de la liste et une API propre, mais 118 ko pour une capacité que GSAP couvre mieux et que le projet n'utilise pas encore. | `gh api repos/juliangarnier/anime` |
| 5 | [russellsamora/scrollama](https://github.com/russellsamora/scrollama) | ★6 011 · HTML · MIT · 2025-11-13 | Détecte l'entrée/sortie d'un élément dans le viewport avec un offset, et notifie une progression incrémentale. | **OUI** — un seul fichier `scrollama.min.js` (4 768 o) | **ÉCARTER** | Le projet a déjà résolu ce problème dans `assets/js/scroll.js` (IntersectionObserver maison, 218 lignes, avec filet reduced-motion) : doublon de 4,8 ko pour un push de novembre 2025. | `gh api repos/russellsamora/scrollama` |
| 6 | [michalsnik/aos](https://github.com/michalsnik/aos) | ★28 047 · JavaScript · MIT · 2024-03-26 | « Animate On Scroll » : attributs `data-aos` + `data-aos-duration` sur le HTML, sans JS à écrire. | **OUI** — `dist/aos.js` | **ÉCARTER** | Superficiel (fade/slide uniques, pas de timeline ni de scroll-linked) et **abandonné depuis avril 2024** alors que le projet a déjà un système `[data-motion]` supérieur. | `gh api repos/michalsnik/aos` |
| 7 | [swup/swup](https://github.com/swup/swup) | ★5 251 · TypeScript · MIT · 2026-10-27 | Transitions entre pages pour site *server-rendered* : intercepte les clics, précharge, anime l'entrée/sortie, gère l'historique. | **OUI** — `dist/Swup.umd.js` (25 731 o) ou `dist/Swup.module.js` (25 271 o) | **S'INSPIRER** | Très actif et excellent pour les transitions inter-pages, mais MaisonVide est un site statique multi-pages où chaque page a déjà sa propre identité : le ROI est faible et le risque SEO réel. | `gh api repos/swup/swup` |
| 8 | [barbajs/barba](https://github.com/barbajs/barba) | ★13 001 · TypeScript · MIT · **2024-12-02** | Transformations de page façon SPA : `barba.init()`, hooks `leave`/`enter`, préchargement, namespaces. ~7 ko min+gz. | **OUI** — via `@barba/core` 2.10.3 (`dist/barba.mjs`) ; le paquet `barba` 1.0.0 est un méta-paquet de 80 o | **ÉCARTER** | Projet **figé depuis décembre 2024** (~2 ans) alors que Swup, son successeur concurrent, est mis à jour la semaine de la collecte. | `gh api repos/barbajs/barba` |
| 9 | [locomotivemtl/locomotive-scroll](https://github.com/locomotivemtl/locomotive-scroll) | ★8 891 · JavaScript · MIT · 2026-06-30 | Smooth scroll + détection in-view + parallax. v4 = attributs `data-scroll` ; la branche `main` est un **monorepo v5** (`5.0.0-rc.1`, npm `5.0.1`). | **NON** — v5 est un monorepo Turborepo ; `dist/` n'est produit qu'au build | **ÉCARTER** | Refait Lenis + ScrollTrigger, mais impose une chaîne de build et un modèle « conteneur de scroll » qui casse `position: sticky` et le scroll natif de Safari. | `gh api repos/locomotivemtl/locomotive-scroll` |
| 10 | [lukePeavey/SplitType](https://github.com/lukePeavey/SplitType) | ★732 · JavaScript · **`license: null`** (le `package.json` déclare `ISC` mais **aucun fichier LICENSE n'existe**) · 2023-12-03 | Découpe un texte en lignes / mots / caractères, sans dépendance. | **OUI** — `dist/index.js` (43 774 o) ESM ou `umd/index.min.js` (11 804 o) | **ÉCARTER** | Licence **absente du dépôt** (donc « tous droits réservés » par défaut) et code **figé depuis décembre 2023** : le risque juridique dépasse le gain de 8 ko face à `SplitText` de GSAP. | `gh api repos/lukePeavey/SplitType` |
| 11 | [tweenjs/tween.js](https://github.com/tweenjs/tween.js) | ★10 150 · TypeScript · MIT (fichier LICENSE lu) · 2026-10-06 | Moteur de tweening minimaliste (interpolation de valeurs numériques dans le temps), sans gestion DOM ni scroll. | **OUI** | **ÉCARTER** | Active et bien notée, mais ne fait que le tweening : c'est le sous-ensemble exact de GSAP, sans le rapport valeur/coût. | `gh api repos/tweenjs/tween.js` |
| 12 | [hotwired/turbo](https://github.com/hotwired/turbo) | ★7 399 · JavaScript · MIT · 2026-09-29 | Navigation « à la Turbolinks » : remplace la page par un morph via `<turbo-frame>`, cache, préchargement. | **NON** — nécessite des `<turbo-frame>` dans le HTML et une logique serveur compatible | **ÉCARTER** | Impose de réécrire la structure HTML de 15 pages et un déploiement serveur ; disproportionné pour un site vitrine. | `gh api repos/hotwired/turbo` |
| 13 | [alexfoxy/lax.js](https://github.com/alexfoxy/lax.js) | ★10 459 · JavaScript · MIT · 2025-05-21 · **`archived: true`** | Lerp de valeurs pilotées par le scroll (parallax, fade), <4 ko gzip. | **OUI** | **ÉCARTER** | **Dépôt archivé** par l'auteur : plus aucune maintenance, et Lenis couvre déjà le scroll amorti du projet. | `gh api repos/alexfoxy/lax.js` |
| 14 | [gka/chroma.js](https://github.com/gka/chroma.js) | ★10 608 · JavaScript · BSD-3-Clause (fichier LICENSE lu) · 2026-10-24 | Manipulation de couleur : conversions HSL/HSV/Lab/LCH, `mix`, `luminance`. | **OUI** — un fichier UMD | **S'INSPIRER** | Très utile pour générer à la volée les dégradés kraft/papier à partir des tokens `#e8e5db` / `#b38d5c` — mais c'est de la couleur, pas du motion : à traiter dans un autre document. | `gh api repos/gka/chroma.js` |
| 15 | [oframe/ogl](https://github.com/oframe/ogl) | ★4 740 · JavaScript · **licence `null` (aucun fichier LICENSE)** · 2025-04-13 | Micro-librairie WebGL : shaders, géométries, textures. Base des effets « canvas reveal ». | **OUI** — module ESM | **ÉCARTER** | **Aucune licence dans le dépôt** → usage commercial juridiquement non couvert, et projet figé depuis avril 2025 alors que Three.js est déjà vendorisé. | `gh api repos/oframe/ogl` |
| 16 | [demarketed/view-transitions-polyfill](https://github.com/demarketed/view-transitions-polyfill) | ★74 · TypeScript · ISC · 2026-08-19 | Polyfill de la View Transitions API pour les navigateurs anciens. | **OUI** | **ÉCARTER** | ★74 seulement, et **inutile** : la View Transitions API est livrée par Chrome 111 / Safari 18 / Firefox 144 (cf. §5). | `gh api repos/demarketed/view-transitions-polyfill` |
| 17 | [GoogleChromeLabs/view-transitions-mock](https://github.com/GoogleChromeLabs/view-transitions-mock) | ★70 · TypeScript · Apache-2.0 · 2026-09-17 | Mock non visuel pour tester des transitions de page sans navigateur compatible. | **NON** — outil de test, pas de prod | **ÉCARTER** | Outil de test Google, aucun intérêt en production. | `gh api repos/GoogleChromeLabs/view-transitions-mock` |
| 18 | [w3c/csswg-drafts](https://github.com/w3c/csswg-drafts) | ★4 901 · Bikeshed · NOASSERTION (licence W3C) · 2026-10-28 | **Source normative** du module CSS Scroll-driven Animations (`animation-timeline`, `view()`, `scroll()`), du View Transitions et de `animation-range`. | **S/O** — à lire, pas à intégrer | **INTEGRER (comme référence)** | C'est la spécification elle-même : la lire avant d'écrire la moindre ligne d'animation scroll-linked. | `gh api repos/w3c/csswg-drafts` |
| 19 | [mdn/content](https://github.com/mdn/content) | ★11 104 · Markdown · NOASSERTION (CC-BY) · 2026-10-28 | Documentation MDN : `animation-timeline`, `view-transition-name`, `prefers-reduced-motion`, `ScrollTimeline`. | **S/O** — à lire, pas à intégrer | **INTEGRER (comme référence)** | Source de vérité du comportement cross-browser et des cascades de reduced-motion. | `gh api repos/mdn/content` |
| 20 | [mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) | ★5 779 · JSON · **CC0-1.0** · 2026-10-29 | Données de compatibilité navigateur, machine-lisibles. | **S/O** | **INTEGRER (comme référence)** | Source factuelle des versions d'arrivée ; c'est elle qui a permis de mesurer le trou Safari (cf. §5). | `gh api repos/mdn/browser-compat-data` |
| 21 | [w3c/IntersectionObserver](https://github.com/w3c/IntersectionObserver) | ★3 607 · Bikeshed · NOASSERTION (licence W3C) · 2026-03-19 | Spécification d'`IntersectionObserver`, l'API sur laquelle repose déjà `assets/js/scroll.js`. | **S/O** | **S'INSPIRER** | Le projet l'utilise déjà ; à consulter avant tout remplacement par une lib. | `gh api repos/w3c/IntersectionObserver` |

### Candidats demandés qui n'existent pas / métadonnées non récupérables

| Candidat demandé | Commande | Résultat |
|---|---|---|
| `gsap/gsap` | `gh api repos/gsap/gsap` | **404 Not Found.** Le dépôt vit sous **[`greensock/GSAP`](https://github.com/greensock/GSAP)** (★29 880). L'organisation `gsap` elle-même n'existe pas (`gh api orgs/gsap` → 404). |
| `motiondivision/motion-dom` | `gh api repos/motiondivision/motion-dom` | **404 Not Found.** `motion-dom` n'est plus un dépôt autonome : c'est un **paquet du monorepo** `motiondivision/motion` (`packages/motion-dom`, avec `packages/motion`, `packages/motion-utils`, `packages/framer-motion`). |
| `splitting-type/splitting.type` | `gh api repos/splitting-type/splitting.type` | **404 Not Found.** Aucun dépôt public à ce nom. `gh api search/repositories?q=split+type+animation+text` renvoie `lukePeavey/SplitType` (★732) et `callmecavs/text-split` (★46) — pas le plugin GSAP. |
| `lemurb/lenis`, `goto/lenis`, `yokai/lenis`, `smoothui/smoothui`, `rechroma/*`, `theolivierfr/grain`, `emilk/ellipsis` | `gh api repos/<owner>/<repo>` | **404 Not Found** pour tous (le hôte a notamment `theolivierfr/grain` → 404). Aucun de ces dépôts n'est vérifiable ; ils n'apparaissent pas dans l'état de l'art public. |
| `locomotive/…` | `gh api repos/locomotivemtl/locomotive-scroll` | Le dépôt réel est sous l'organisation **`locomotivemtl`**, pas `locomotive`. |
| `SplitType` (plugin GSAP) | `gh api repos/greensock/SplitType` → 404 ; `gh api repos/greensock/GSAP/contents` → pas de fichier `SplitType*` | **Le plugin GSAP `SplitType` n'existe ni comme dépôt ni dans le paquet npm `gsap@3.15.0`** (179 fichiers, seuls `SplitText*` sont présents). `SplitText` (7 732 o) est, lui, dans `dist/`. À ne pas confondre avec le `split-type` npm de `lukePeavey`. |
| `motion.dev` / MDN « CSS scroll-driven animations » | `gh api` **non applicable** (ce sont des pages doc, pas des dépôts) | Compatibilité mesurée via `gh api repos/mdn/browser-compat-data/contents/css/properties/animation-timeline.json` et `.../view-transition-name.json` → cf. §5. |

---

## 2. Fiches détaillées — dépôts INTEGRER / À INSPPIRER

> Convention : les exemples ci-dessous supposent des fichiers **vendorisés localement** en UMD (globals). Aucun CDN, aucun build. Le motif `<script type="importmap">` déjà présent dans `admin/3d.html:175` est rappelé en fin de section.

### 2.1 GSAP — `greensock/GSAP` → **INTEGRER**

- **Lien :** https://github.com/greensock/GSAP · **version npm :** `3.15.0` · **dépôt :** master, `pushed_at 2026-04-13`
- **Licence :** `gh api` renvoie `license: null` → **aucun fichier LICENSE dans le dépôt**. Le README (ligne 90) renvoie à la « Standard License » : https://gsap.com/standard-license. npm déclare : `Standard 'no charge' license`.
- **« Commercial sans attribution ? » → OUI, sous condition.** Texte vérifié le 2026-10-29 : *« You may use the code at no charge in commercial or non-commercial apps, web sites, games, components, and other software as long as end users are not charged a fee of any kind to use your product or gain access to any part of it. If your client pays you a one-time fee to create the site/product, that's perfectly fine and qualifies under the "no charge" license. »* → **pas d'obligation d'attribution** (la page dit seulement « Please respect the copyright »). **Le fichier minifié porte déjà l'en-tête** `@license Copyright 2026, GreenSock. All rights reserved. Subject to the terms at https://gsap.com/standard-license.` — **le conserver**.
- **Poids réel (npm `gsap@3.15.0`, 179 fichiers) :** `dist/gsap.min.js` **72 927 o** · `dist/ScrollTrigger.min.js` **44 575 o** · `dist/SplitText.min.js` **7 732 o** · `dist/Flip.min.js` 25 534 o · `dist/Observer.min.js` 10 014 o · `dist/ScrollSmoother.min.js` 13 373 o.
- **ESM ou pas ?** Le dossier `esm/` existe **dans le dépôt GitHub** (29 fichiers, imports relatifs `./Observer.js`) mais **n'est PAS publié sur npm** (`unpkg.com/gsap@3.15.0/esm/ScrollTrigger.js` → *Not found*) et n'est pas minifié (`esm/ScrollTrigger.js` = 112 578 o). **Conclusion : en no-build, utiliser `dist/*.min.js` (UMD), pas `esm/`.**

**Exemple minimal — révélations au scroll (11 lignes) :**
```html
<script src="assets/vendor/gsap.min.js"></script>
<script src="assets/vendor/ScrollTrigger.min.js"></script>
<script>
  gsap.registerPlugin(ScrollTrigger);
  gsap.utils.toArray('[data-reveal]').forEach(el => {
    gsap.from(el, {
      y: 18, opacity: 0, duration: .7, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
</script>
```

**Exemple minimal — découpage de texte façon « relevé d'inventaire » (9 lignes) :**
```html
<script src="assets/vendor/gsap.min.js"></script>
<script src="assets/vendor/SplitText.min.js"></script>
<script>
  gsap.registerPlugin(SplitText);
  document.querySelectorAll('[data-split]').forEach(el => {
    const split = new SplitText(el, { type: 'chars' });
    gsap.from(split.chars, {
      yPercent: 110, opacity: 0, stagger: .012, duration: .6, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
</script>
```
> ⚠️ `SplitText` réécrit le DOM du titre : l'accessibilité s'appuie alors sur `aria-label` (ou `aria-hidden` sur les fragments). Toujours le poser.

### 2.2 Lenis — `darkroomengineering/lenis` → **INTEGRER (déjà en place)**

- **Lien :** https://github.com/darkroomengineering/lenis · **version npm :** `1.3.27` · **fichier vendorisé :** `assets/vendor/lenis.min.js` = **1.3.26** (18 722 o) → **une version de retard**.
- **Licence :** MIT (fichier `LICENSE` présent, 1 088 o). → **Commercial sans attribution ? OUI**, MIT n'exige ni mention ni licence affichée.
- **Poids réel (npm `lenis@1.3.27`) :** `dist/lenis.min.js` **18 815 o** · `dist/lenis.css` **513 o**.
- **Point d'attention vérifié :** `V2-ROADMAP.md` est publié dans le dépôt. La v2 **inverse les valeurs par défaut** (`autoRaf`, `autoToggle`, `anchors`, `allowNestedScroll`, `stopInertiaOnNavigate`, `naiveDimensions` passent de `false` à `true`) et **restructure les options** (plat → imbriqué). Le code actuel du projet (`assets/js/site.js:182`) utilise `smoothWheel`, `touchMultiplier`, `duration`, `easing` : **il cassera à la v2**. À pinscer sur `1.3.x` et à ne pas suivre la v2 sans migration.
- **CSS obligatoire :** `lenis.css` (513 o) est **requis** — il pose `html.lenis { height: auto }` et `overflow: clip` en mode arrêté. Le projet **ne le charge pas aujourd'hui** (`assets/css/` ne contient pas `lenis.css`) → c'est un correctif à faire.

**Exemple minimal — Lenis piloté par le ticker GSAP (8 lignes) :**
```html
<link rel="stylesheet" href="assets/css/lenis.css">
<script src="assets/vendor/lenis.min.js"></script>
<script>
  const lenis = new Lenis({ autoRaf: false, duration: 1.05 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
</script>
```

### 2.3 CSS scroll-driven animations (natif) — `w3c/csswg-drafts` → **INTEGRER, prioritaire**

- **Lien :** https://github.com/w3c/csswg-drafts (spécification) · docs : https://developer.mozilla.org/docs/Web/CSS/CSS_scroll-driven_animations
- **Licence :** NOASSERTION (licence W3C) — **référence, rien à vendoriser, 0 octet.**
- **Poids :** **0 o** (CSS pur dans `assets/css/`). C'est le seul rapport poids/effet du dossier.
- **Support mesuré (`mdn/browser-compat-data`, 2026-10-29) :** `animation-timeline` et `scroll-timeline` → **Chrome 115, Firefox 159, Safari 26**. `view-transition-name` → **Chrome 111, Firefox 144, Safari 18**.
- **Conséquence directe :** Safari ne supporte les animations scroll-driven **que depuis la version 26**. En France, Safari/iOS représente une part majoritaire du trafic mobile → **obligatoirement une voie de repli** (l'existant `assets/js/scroll.js` fait exactement ce travail).
- **Pattern retenu :** CSS natif **en amélioration progressive**, le JS maison en repli. `@supports` suffit à basculer.

**Exemple minimal — 0 octet, en amélioration progressive (9 lignes) :**
```css
@supports (animation-timeline: view()) {
  [data-reveal] {
    animation: mvh-rise linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 28%;
  }
  @keyframes mvh-rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: none; }
  }
}
```

### 2.4 Motion — `motiondivision/motion` → **S'INSPIRER**

- **Lien :** https://github.com/motiondivision/motion · **version npm :** `14.7.1` · monorepo `packages/{motion,motion-dom,motion-utils,framer-motion}`.
- **Licence :** MIT (`packages/motion/LICENSE.md`, 1 100 o). → **Commercial sans attribution ? OUI.**
- **Poids réel (npm `motion@14.7.1`, 40 fichiers, 922 802 o au total) :** `dist/motion.js` (UMD, global `Motion`) **176 646 o** · `dist/motion.dev.js` 696 010 o · `dist/es/index.mjs` **35 o**.
- **Le point bloquant, mesuré :** `dist/es/index.mjs` contient littéralement `export * from 'framer-motion/dom';` — un **specifier nu** qui n'existe pas dans le paquet `motion`. Donc **l'ESM de Motion est inutilisable dans un navigateur sans bundler** (il faudrait copier `framer-motion` en plus, ou un importmap bricolé). Seul `dist/motion.js` (UMD) est autonome.
- **Points forts :** `scroll()` est annoncé à **3,8 ko** et s'appuie sur `ScrollTimeline` quand le navigateur le permet (accélération matérielle, sans mesure de scroll en JS) — voir https://motion.dev/docs/scroll. `inView`, `stagger`, `spring`, `hover`, `press` sont exposés sur le global UMD (vérifié dans `dist/motion.js`).
- **Points faibles :** 176 ko pour le seul bundle navigateur ; la doc indique que `splitText`, `scrambleText`, `curtains` sont réservés à **Motion+ (payant)**.

**Exemple minimal — bundle UMD global (7 lignes) :**
```html
<script src="assets/vendor/motion.js"></script>
<script>
  const { animate, scroll, inView } = Motion;
  animate('[data-fade]', { opacity: [0, 1], y: [16, 0], duration: .6 });
  scroll(animate('.act__step', { opacity: [.2, 1] }), { target: '.act' });
  inView('.act', () => {}, { amount: .4 });
</script>
```

### 2.5 anime.js — `juliangarnier/anime` → **S'INSPIRER**

- **Lien :** https://github.com/juliangarnier/anime · **version npm :** `4.5.0`
- **Licence :** MIT (`LICENSE.md` présent, 1 075 o) → **Commercial sans attribution ? OUI.**
- **Poids réel (npm `animejs@4.5.0`) :** `dist/bundles/anime.esm.min.js` **118 678 o** · `dist/bundles/anime.umd.min.js` 118 043 o · `dist/modules/index.js` 2 243 o (baril de ré-export, comme Motion).
- **Ce qu'elle fait vraiment :** moteur d'animation/timeline/waapi, `animate`, `timeline`, `stagger`, `spring`, `svg`, `text`, `drag`, et un pont explicite vers la **Web Animations API** (`anime/waapi`).
- **Pourquoi seulement « s'inspirer » :** 118 ko pour une bibliothèque **sans scroll-linked**, alors que GSAP+ScrollTrigger (117 ko) fournit ce que le projet cherche. Son interest réel : l'API `timeline` plus simple que GSAP, et le pont WAAPI.

**Exemple minimal — ESM vendorisé (6 lignes) :**
```html
<script type="module">
  import { animate, stagger } from './assets/vendor/anime.esm.min.js';
  animate('.act__step', { opacity: [0.2, 1], delay: stagger(0.08), duration: .5 });
</script>
```

### 2.6 View Transitions API (natif) → **S'INSPIRER**

- **Lien :** https://developer.mozilla.org/docs/Web/API/View_Transition_API · spec : https://drafts.csswg.org/css-view-transitions/
- **Licence :** API navigateur — **rien à licencer, 0 octet.**
- **Support mesuré (`mdn/browser-compat-data`) :** `view-transition-name` → **Chrome 111, Safari 18, Firefox 144**. C'est-à-dire **largement déployé**, contrairement aux animations scroll-driven.
- **Intérêt pour MaisonVide :** transition douce entre les pages statiques (fiche → index), sans JS, en respectant le « carnet d'inventaire ». **Réserve :** une transition cross-document exige `@view-transition { navigation: auto; }` dans le CSS, et sur un site multi-pages cela change le comportement de navigation → à tester sur Safari iOS avant toute mise en production.

**Exemple minimal — 0 octet (8 lignes) :**
```css
@view-transition { navigation: auto; }
```
```js
if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || a.origin !== location.origin || a.target === '_blank') return;
    e.preventDefault();
    document.startViewTransition(() => { location.href = a.href; });
  });
}
```

### 2.7 Rappel — le motif importmap, déjà utilisé par le projet

`admin/3d.html:175` pose déjà :

```html
<script type="importmap">
{ "imports": { "three": "../assets/vendor/three.module.js" } }
</script>
```

Il est donc **légitimement réutilisable** pour un vendorisé ESM :

```html
<script type="importmap">
{ "imports": { "motion": "./assets/vendor/motion.js" } }
</script>
<script type="module">
  import { animate, scroll } from 'motion';
  animate('[data-fade]', { opacity: [0, 1] });
</script>
```
> ⚠️ Réserve vérifiée : `motion/dist/motion.js` est un **UMD**, pas un ESM — un importmap ne le convertit pas en module ESM nommé. L'exemple ci-dessus ne fonctionne **que** si le fichier vendorisé est un vrai ESM (cas de `anime.esm.min.js`, de `three.module.js`, ou du dossier `esm/` complet de GSAP copié en bloc).

---

## 3. TOP 5 à vendoriser

Ordre = priorité de valeur réelle pour MaisonVide, pas classement par nombre d'étoiles.

| Rang | Fichier local proposé | Source | Taille réelle | Raison |
|---|---|---|---|---|
| **1** | `assets/vendor/gsap.min.js` | npm `gsap@3.15.0` → `dist/gsap.min.js` | **72 927 o** | Le moteur de base : timeline, staggers, easing, `matchMedia` pour les variantes responsive. UMD autonome, un seul `<script>`, zéro dépendance. |
| **2** | `assets/vendor/ScrollTrigger.min.js` | npm `gsap@3.15.0` → `dist/ScrollTrigger.min.js` | **44 575 o** | C'est le seul moyen propre d obtains un scroll-*linked* (et non scroll-*triggered*) avec pinning, scrub et snap. Dialogue natif avec Lenis via `ScrollTrigger.update`. |
| **3** | `assets/vendor/SplitText.min.js` | npm `gsap@3.15.0` → `dist/SplitText.min.js` | **7 732 o** | Le « relevé d'inventaire » (lettre par lettre, tampon) est le geste identitaire du site. 7,7 ko pour un plugin — c'est le meilleur rapport de tout le dossier. |
| **4** | `assets/vendor/lenis.min.js` + `assets/css/lenis.css` | npm `lenis@1.3.27` → `dist/` | **18 815 o + 513 o** | Déjà vendorisé et branché : **passage de 1.3.26 → 1.3.27** et **ajout du CSS manquant** (`html.lenis { height:auto }`, `overflow: clip`). Priorité haute, coût quasi nul. |
| **5** | `assets/vendor/motion.js` | npm `motion@14.7.1` → `dist/motion.js` | **176 646 o** | **Alternative complète à GSAP (1+2), pas un complément.** À vendoriser seulement si on veut `scroll()` sur `ScrollTimeline` + `inView` + une API plus simple. **Ne pas installer les deux** : 176 ko contre 117 ko, recouvrement quasi total. |

**Bonus à 0 octet (priorité au-dessus du JS) :** `assets/css/scroll-timeline.css` — animations scroll-driven natives, avec `assets/js/scroll.js` en repli Safari ≤ 25. C'est la seule « intégration » qui n'ajoute **aucun** octet au bundle.

**Ordre de chargement recommandé dans le `<head>` / en fin de `<body>` :**
`lenis.min.js` → `gsap.min.js` → `ScrollTrigger.min.js` → `SplitText.min.js` → `assets/js/scroll.js` (existant) → `assets/js/site.js` (existant).

---

## 4. À écarter — raison factuelle

| Dépôt | Raison de l'écart | Source |
|---|---|---|
| `locomotivemtl/locomotive-scroll` | **Dépendance build.** La branche `main` est un monorepo Turborepo (`packages/{lib,demo,docs,landing}`, `turbo.json`, `package-lock.json`, config Astro). `packages/lib/dist/` n'est **produit qu'au build** → non vendorisable en l'état. De plus, son modèle « scroll container » entre en concurrence directe avec Lenis, et son API v4 (`data-scroll`) diffère de la v5 (npm `5.0.1`, repo `5.0.0-rc.1`). | `gh api repos/locomotivemtl/locomotive-scroll/contents/packages/lib` |
| `barbajs/barba` | **Abandonné.** `pushed_at = 2024-12-02` — aucun commit depuis ~2 ans. Remplacé dans le même domaine par Swup (push la semaine de la collecte). Le paquet npm `barba@1.0.0` est un méta-paquet de 80 o qui renvoie à `@barba/core@2.10.3`. | `gh api repos/barbajs/barba` |
| `michalsnik/aos` | **Abandonné** (`pushed_at 2024-03-26`) et **fonctionnellement surpassed** par `assets/js/scroll.js` + `assets/css/scroll.css` déjà écrits. Apport : fade/slide uniques, sans timeline ni scroll-linked. | `gh api repos/michalsnik/aos` |
| `russellsamora/scrollama` | **Doublon.** 4 768 o pour ce que le projet fait déjà en natif via `IntersectionObserver` (`assets/js/scroll.js:132-146`, avec seuil `0.55` et `rootMargin` — plus précis que scrollama). Push de novembre 2025. | `gh api repos/russellsamora/scrollama` |
| `alexfoxy/lax.js` | **Dépôt archivé** (`archived: true`) — décision de l'auteur. Ne fait que du lerp scroll, déjà couvert par Lenis. | `gh api repos/alexfoxy/lax.js` |
| `oframe/ogl` | **Aucune licence dans le dépôt** (`license: null`) → pas de droits d'usage commercial accordés explicitement. Figé depuis avril 2025. Three.js est déjà vendorisé. | `gh api repos/oframe/ogl` |
| `lukePeavey/SplitType` | **Licence absente du dépôt** (`license: null`) alors que le `package.json` déclare `ISC` → incohérence, donc risque juridique. Push de **décembre 2023** (~3 ans). Remplacé par `SplitText` de GSAP (7 732 o, licence Standard « no charge » lue). | `gh api repos/lukePeavey/SplitType` |
| `tweenjs/tween.js` | **Hors périmètre.** Ne fait que l'interpolation temporelle de valeurs — le sous-ensemble exact de GSAP, avec un rapport valeur/coût défavorable. | `gh api repos/tweenjs/tween.js` |
| `hotwired/turbo` | **Dépendance serveur + refonte HTML.** Exige des `<turbo-frame>` et un déploiement compatible Turbo sur les 15 pages. | `gh api repos/hotwired/turbo` |
| `demarketed/view-transitions-polyfill` | **Inutile.** La View Transitions API est livrée par Chrome 111 / Safari 18 / Firefox 144. ★74 seulement. | `gh api repos/demarketed/view-transitions-polyfill` |
| `GoogleChromeLabs/view-transitions-mock` | Outil de test, pas une brique de production. | `gh api repos/GoogleChromeLabs/view-transitions-mock` |
| `gka/chroma.js` | **Hors périmètre du motion** — excellent en couleur (BSD-3), mais c'est un autre sujet : à traiter dans un document dédié si les dégradés kraft doivent être générés. | `gh api repos/gka/chroma.js` |
| `swup/swup` | **Pas écarté, mais décalé.** Très actif et meilleur que Barba — mais MaisonVide est multi-pages statiques, chaque page a sa propre identité et son propre HTML ; le ROI est faible et le **risque SEO est réel** (le contenu transitoire peut être indexé, l'historique et le scroll-back se complexifient). À reconsidérer si un jour le site devient un catalogue unique très long. | `gh api repos/swup/swup` |

---

## 5. Risques

### 5.1 Copyleft et licences

- **Aucun candidat de la liste n'est copyleft.** Vérifié : MIT (GSAP est sous licence propriétaire permissive « no charge », pas MIT), MIT (Lenis, Motion, anime.js, Swup, Scrollama, AOS, lax.js, Turbo, sweet-scroll, jump.js, moveTo), BSD-3-Clause (chroma.js), ISC (`@barba/core`, polyfill VT), Apache-2.0 (`view-transitions-mock`), CC0-1.0 (`browser-compat-data`), licences W3C (spécifications, NOASSERTION).
- **GSAP est le seul risque juridique réel**, et il est *commercial* et non *copyleft* : la Standard License autorise l'usage commercial **gratuit et sans attribution**, *à condition que les utilisateurs finaux ne soient pas facturés d'un quelconque montant pour utiliser le produit ou y accéder*. **Question à trancher par le porteur de projet :** si MaisonVide facture les vendeurs (commission, abonnement, frais de mise en ligne) ou si l'accès au service est payant, la lecture stricte de la clause impose un abonnement **Business**. La lecture usuelle (une commission de place de marché n'est pas « un accès payant au produit ») est plus favorable, mais **ce n'est pas une évidence** — à confirmer avant mise en production. Le bandeau `@license` du fichier minifié doit rester en place.
- **`lukePeavey/SplitType` et `oframe/ogl` sont « tous droits réservés » de fait** (absence de fichier LICENSE). Écartés pour cette raison, pas seulement pour l'obsolescence.

### 5.2 API breaking changes

- **Lenis v2 est annoncée** (`V2-ROADMAP.md` publié dans le dépôt) : valeurs par défaut inversées (`autoRaf`, `autoToggle`, `anchors`, `allowNestedScroll`, `stopInertiaOnNavigate`, `naiveDimensions` → `true`) et **options aplaties → imbriquées**. `assets/js/site.js:182-187` utilise `duration`, `easing`, `smoothWheel`, `touchMultiplier` : **migration obligatoire** le jour où la v2 sortira. → **Pinner `1.3.x`**, ne pas faire de `latest`.
- **GSAP est en 3.15.0** depuis avril 2026 : API stable et documentée comme telle, mais c'est une version **mineure** d'une lib sans semantic-versioning strict sur les plugins. `ScrollTrigger` et `SplitText` sont les plus stables.
- **Motion 14.7.1** : le monorepo fusionne `framer-motion` dans `motion` (« Framer Motion is now Motion », import depuis `motion/react`) — c'est déjà fait, mais cela montre que la numérotation `motion@14` est jeune et sujette à churn.
- **`motiondivision/motion-dom` n'existe plus comme dépôt** : quiconque suivra un tutorial l'ancestrera échouera. À documenter dans le README interne.

### 5.3 Performance mobile

- **Le budget est déjà à surveiller.** GSAP core + ScrollTrigger + SplitText + Lenis + CSS = **72 927 + 44 575 + 7 732 + 18 815 = 144 049 o** non compressés, ~35–40 ko gzipés. Sur un budget « zéro CDN, statique, léger », c'est acceptable **à condition de n'être chargé que sur les pages qui en ont besoin** (accueil, catalogue, fiche) et **pas** sur `mentions-legales.html`, `cookies.html`, `cgu.html`.
- **ScrollTrigger + Lenis** : la combinaison est standard, mais Lenis anime `window.scrollTo` → ScrollTrigger doit être rafraîchi à chaque frame (`lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker.lagSmoothing(0)`). Sans ça, on obtient un **décalage visible** entre la position visuelle et les déclencheurs.
- **`ScrollTrigger` avec `scrub: true` sur mobile** : le scrub est lié au framerate ; forcer le `pin` sur petit écran coûte cher. Règle recommandée : `matchMedia` (`gsap.matchMedia()`) pour n'activer le pinning et le scrub **qu'au-dessus de 900 px** — cohérent avec le breakpoint déjà en place dans `assets/css/scroll.css:135`.
- **`will-change`** : à poser sur des éléments Promoteurs, jamais sur beaucoup d'éléments à la fois (saturation des couches de composition sur mobile).
- **Le CSS natif est le plus économe** : `animation-timeline: view()` s'exécute sur le thread de composition, **sans** JS par frame. C'est un argument fort pour le prioriser comme première couche.

### 5.4 `prefers-reduced-motion`

- **Le projet gère déjà ce point correctement** et il faut ne pas le casser : `assets/js/scroll.js:18` (`reduce`), `:132` et `:156` (bascule vers l'état visible), `assets/css/scroll.css:155` (`@media (prefers-reduced-motion: no-preference)` autour des `[data-motion]` → **si l'utilisateur demande moins de mouvement, les animations ne sont même pas déclarées**), `assets/js/site.js:177` (Lenis désactivé).
- **Point de vigilance GSAP** : `gsap.matchMedia()` accepte `(prefers-reduced-motion: reduce)` comme condition. Il faut **envelopper chaque séquence** dans `gsap.matchMedia()` avec cette condition, sinon les animations tourneront malgré la préférence système.
- **Point de vigilance `SplitText`** : découper le texte en caractères puis animer est un mouvement *décoratif* ; sous `reduce`, il ne faut soit pas splitter du tout, soit splitter sans animation. Le plus simple : ne pas exécuter le split si `reduce` est vrai.
- **View Transitions** : l'API doit être désactivée sous `reduce` (l'exemple du §2.6 le fait via `matchMedia`).
- **CSS scroll-driven** : aucune animation ne doit être déclarée hors du bloc `@media (prefers-reduced-motion: no-preference)`.

### 5.5 Accessibilité

- **`SplitText` casse la lecture assistive** si on ne pose pas `aria-label` sur le conteneur et `aria-hidden="true"` sur les fragments. C'est le piège n°1 des animations de texte.
- **Le scroll animé reste un scroll** : Lenis ne modifie pas la sémantique, mais il **intercepte la molette**. Vérifier que les liens d'ancrage, le `skip link` et la navigation clavier fonctionnent (Lenis 1.3 a `anchors: true` en v2, `false` en v1 → en v1, les ancres internes peuvent demander un `lenis.scrollTo()` explicite).
- **Ne jamais rendre le contenu dépendant de l'animation** : c'est déjà la règle appliquée dans `assets/css/scroll.css:181` (`html:not(.js) [data-motion] { opacity: 1 }`) — toute bibliothèque ajoutée doit respecter cette règle, sinon un échec de chargement du JS laisse une page blanche.
- **`ScrollTrigger` et `pin` modifient la mise en page** (l'élément épinglé sort du flux) → vérifier l'ordre de lecture DOM, qui reste correct, mais la navigation clavier peut devenir trompeuse si le pin est appliqué à un conteneur de liens.
- **Contrastes** : le vermillon `#c0392b` et le kraft `#b38d5c` sur papier-ledger `#e8e5db` doivent rester lisibles quand ils deviennent des overlays animés (opacité < 1 pendant une transition).

### 5.6 SEO

- **Le plus gros risque du dossier : toute technique de « page transition »** (Barba, Swup, Turbo) transforme un site multi-pages en SPA et **modifie le rendu perçu par les robots** si mal configurée. Sur un site vitrine de marketplace dont le référencement organique est vital, c'est un risque disproportionné. → **Écarter**, et rester sur du multi-pages classique.
- **Les animations ne doivent jamais retarder le contenu** : `IntersectionObserver` + transitions CSS ne bloquent pas le rendu, et `assets/js/scroll.js` est chargé en `defer`. **Ne jamais** placer un script bloquant de bibliothèque d'animation dans le `<head>`.
- **`View Transitions` cross-document** : le rendu initial reste identique (le navigateur gère la transition), donc **pas de risque SEO** — contrairement à une SPA. C'est un argument pour l'envisager, mais il faut vérifier le comportement sur Safari iOS 18+ et l'impact sur le **Core Web Vitals** (une transition de navigation allonge le `navigationStart` perçu).
- **Le contenu en `<noscript>` / sans JS** : `assets/css/scroll.css` gère déjà `[data-motion]` en `html:not(.js)`. Toute nouvelle technique (SplitText, View Transitions) doit respecter la même règle.
- **Core Web Vitals** : `ScrollTrigger` en `scrub` sur toute la page d'accueil dégrade l'INP si mal isolé. Mesurer avant d'activer.
- **Le trou Safari sur les animations scroll-driven** (Safari 26 requis) ne poses **aucun** risque SEO : c'est une simple absence d'effet, avec repli JS. En revanche, **ne pas** faire dépendre une information d'une `view()` timeline.

---

## Annexe — Commandes de vérification

Toutes exécutées le **2026-10-29** depuis `/Users/jibril/Desktop/vide maison`, token `gh` authentifié (scopes `repo`, `workflow`, `read:org`, `gist`).

```bash
# Métadonnées d'un dépôt (modèle utilisé pour les 21 lignes du tableau)
gh api repos/greensock/GSAP --jq '{full_name,stargazers_count,language,license,pushed_at,archived,description,homepage,size,topics}'

# README réel
gh api repos/greensock/GSAP/readme --jq '.content' | base64 -d

# Contenu d'un dossier (existence des bundles, licences)
gh api repos/greensock/GSAP/contents/dist --jq '.[] | "\(.name) \(.size)"'
gh api repos/greensock/GSAP/contents/esm --jq '.[].name'
gh api repos/greensock/GSAP/contents/package.json --jq '.content' | base64 -d

# Licence / README d'un paquet npm
gh api repos/lukePeavey/SplitType/contents/LICENSE --jq '.content' | base64 -d
gh api repos/gka/chroma.js/contents/LICENSE --jq '.content' | base64 -d

# Version publiée + licence déclarée
curl -s https://registry.npmjs.org/gsap/latest | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['version'],d['license'])"

# Poids réels des artefacts publiés
curl -sL "https://unpkg.com/gsap@3.15.0/?meta"   # 179 fichiers
curl -sL "https://unpkg.com/gsap@3.15.0/dist/gsap.min.js" | wc -c   # 72927

# Support navigateur (source de vérité)
gh api repos/mdn/browser-compat-data/contents/css/properties/animation-timeline.json --jq '.content' | base64 -d
gh api repos/mdn/browser-compat-data/contents/css/properties/view-transition-name.json --jq '.content' | base64 -d
gh api repos/mdn/browser-compat-data/contents/api/ViewTransition.json --jq '.content' | base64 -d

# Recherche de dépôts inconnus
gh api "search/repositories?q=split+type+animation+text&sort=stars" --jq '.items[].full_name'
gh api "search/repositories?q=smooth+scroll+library&sort=stars" --jq '.items[].full_name'

# Candidats qui n'existent pas (404 attendus)
gh api repos/gsap/gsap                       # 404
gh api repos/motiondivision/motion-dom       # 404
gh api repos/splitting-type/splitting.type   # 404
gh api repos/greensock/SplitType             # 404
gh api repos/GSAP/SplitType                  # 404
```
