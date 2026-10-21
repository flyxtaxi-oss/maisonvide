# Guide de migration — Monde « L'inventaire de brocante »

Document de référence pour toute page MaisonVide. Une page qui ne suit pas ce guide
ne ressemble pas aux autres. **Le lire avant de toucher à un fichier.**

---

## 1. Le monde

MaisonVide est un **carnet d'inventaire de vide-grenier**. Pas une marketplace SaaS bleu.

| Élément | Valeur | Sens |
|---|---|---|
| Sol | `--paper-ground` `#e8e5db` | papier-ledger gris-olive (PAS crème) |
| Feuille | `--paper-sheet` `#f7f5ef` | fiche cartonnée posée sur le sol |
| Encre | `--ink-900` `#1b1f1c` | encre d'imprimeur |
| Kraft | `--kraft-500` `#b38d5c` | la matière : le champ commité, les étiquettes |
| Tampon | `--stamp-500` `#c0392b` | **l'unique accent** : prix, urgence, contre-mesure |
| Sceau | `--seal-500` `#41624d` | l'institutionnel : validé, vérifié, sûr |

Typographie : `Sentient` (display, serif à grand contraste) + `Switzer` (body, grotesque) +
`Caveat` (`.hand`, pour les mentions manuscrites). `JetBrains Mono` via `--font-mono`
uniquement pour les **données** (prix, références, compteurs), jamais en costume.

---

## 2. Interdits (le craft-floor)

Ces règles ont été lues dans `pbakaus/impeccable` → `reference/craft-floor.md`.
Elles sont **vérifiées** et c'est exactement ce qui faisait « fabriqué par IA ».

| ❌ Interdit | ✅ À la place |
|---|---|
| Eyebrow / kicker / sur-titre en petites capitales au-dessus d'un titre | `.label` — une **donnée** (« 30 s », « AXA · 10 000 € », « L.01 »), pas un habillage |
| Emoji comme icône | `<svg class="ic"><use href="#i-xxx"></use></svg>` |
| Glass / backdrop-blur décoratif | `.site-header` a un `backdrop-filter` **fonctionnel** (collant) — ailleurs, aucun |
| `border-left: 3px` coloré | filets de 1px `--paper-rule`, ou `border-top: 1.5px var(--ink-900)` |
| Grille de 3 ou 4 cartes identiques en rang | **lignes réglées** (`.inventaire__row`, `.charte__row`), colonnes asymétriques, décalages |
| Template hero-metric (3 gros chiffres sous un hero) | un bloc `releve-hero__note` aligné sur les chiffres du tableau de stats |
| Texte en gradient | couleur unie |
| Mono en costume | mono = données seules |
| Fraunces / Playfair / Inter en display | **Sentient** + **Switzer** |
| Coins très arrondis / gros radius | `--radius-xs` 2px à `--radius-md` 6px. Le papier est mat |
| Centre everything, page symétrique 50/50 | asymétrie : `1.05fr .95fr`, `1fr 1.3fr` |

---

## 3. Structure obligatoire d'une page

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#e8e5db">
  <title>… — MaisonVide</title>
  <meta name="description" content="…">
  <link rel="canonical" href="https://maisonvide.fr/…">
  <link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">

  <link rel="preconnect" href="https://api.fontshare.com" crossorigin>
  <link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>
  <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=sentient@400,400i,500,600,700&f[]=switzer@400,500,600,700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&display=swap">

  <link rel="stylesheet" href="assets/css/main.css">
  <link rel="stylesheet" href="assets/css/motion.css">
  <style>/* styles propres à la page */</style>
</head>
<body class="grain">
```

`main.css` importe `tokens.css`. Ne jamais redéfinir une couleur en dur :
passer par `var(--…)`.

### Scripts (en bas, dans cet ordre)

```html
<script src="assets/vendor/lenis.min.js"></script>
<script src="assets/js/core.js"></script>
<script src="assets/js/site.js"></script>
<script src="assets/js/listings.js"></script>   <!-- seulement si la page affiche des annonces -->
</body>
```

> `assets/js/main.js` et `assets/js/motion.js` sont **obsolètes** (ancien monde).
> Ne plus les charger. Les supprimer du projet à la fin.

---

## 4. En-tête — à copier à l'identique

Seule la classe `is-active` change selon la page courante.

```html
<header class="site-header">
  <div class="container site-header__inner">
    <a href="index.html" class="logo">
      <span class="logo__mark"><svg class="ic" aria-hidden="true"><use href="#i-home"></use></svg></span>
      MaisonVide
    </a>
    <nav class="nav" aria-label="Navigation principale">
      <a href="index.html">Accueil</a>
      <a href="vendre.html">Estimer</a>
      <a href="annonces.html">Annonces</a>
      <a href="confiance.html">Confiance</a>
      <a href="services.html">Services</a>
      <a href="contact.html">Contact</a>
    </nav>
    <div class="flex">
      <a href="vendre.html" class="btn btn--primary btn--sm">Estimer un objet</a>
      <a href="auth.html" class="btn btn--ghost btn--sm" data-auth-when="out">Connexion</a>
      <a href="profil.html" class="btn btn--kraft btn--sm" data-auth-when="in" data-user-name hidden>Mon compte</a>
      <button class="nav-toggle" aria-label="Ouvrir le menu" aria-expanded="false">
        <svg class="ic" aria-hidden="true"><use href="#i-menu"></use></svg>
      </button>
    </div>
  </div>
</header>
```

---

## 5. Pied de page — à copier à l'identique

```html
<footer class="site-footer">
  <div class="container">
    <div class="site-footer__grid">
      <div class="site-footer__brand">
        <div class="logo" style="color:var(--paper-sheet)">
          <span class="logo__mark"><svg class="ic" aria-hidden="true"><use href="#i-home"></use></svg></span>
          MaisonVide
        </div>
        <p>Videz votre maison. Gardez vos soirées.</p>
      </div>
      <div>
        <h4>Service</h4>
        <ul class="flex-col" style="gap:.4rem">
          <li><a href="vendre.html">Estimer un objet</a></li>
          <li><a href="annonces.html">Annonces</a></li>
          <li><a href="services.html">Services pro</a></li>
          <li><a href="contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h4>Confiance</h4>
        <ul class="flex-col" style="gap:.4rem">
          <li><a href="confiance.html">Charte de sécurité</a></li>
          <li><a href="garanties.html">Garanties</a></li>
          <li><a href="anti-arnaque.html">Anti-arnaque</a></li>
        </ul>
      </div>
      <div>
        <h4>Compte</h4>
        <ul class="flex-col" style="gap:.4rem">
          <li><a href="auth.html">Connexion</a></li>
          <li><a href="profil.html">Mon compte</a></li>
          <li><a href="favoris.html">Mes favoris</a></li>
          <li><a href="admin/">Espace pro</a></li>
        </ul>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>© 2026 MaisonVide · SIRET 000 000 000 00000</span>
      <span>Hébergement France · RGPD · ACPR</span>
    </div>
  </div>
</footer>

<a href="https://wa.me/33600000000?text=Bonjour%20MaisonVide%20!" class="whatsapp-fab" aria-label="Écrire sur WhatsApp">
  <svg class="ic" aria-hidden="true"><use href="#i-chat"></use></svg>
</a>

<div class="cookie hidden" id="cookie-banner" role="dialog" aria-label="Cookies">
  <p>On dépose des cookies de mesure d'audience, anonymisés, sans publicité. C'est tout.</p>
  <div class="cookie__actions">
    <button class="btn btn--ghost btn--sm" data-cookie="refuse">Refuser</button>
    <button class="btn btn--primary btn--sm" data-cookie="accept">Accepter</button>
  </div>
</div>

<div class="toast-container" id="toasts" aria-live="polite"></div>
```

---

## 6. Composants disponibles

### Classes utilitaires
`.container` `.container--narrow` `.container--wide` `.section` `.section--tight`
`.section--kraft` `.section--ink` `.grid` `.grid-2` `.grid-3` `.grid-4` `.grid-auto`
`.flex` `.flex-col` `.flex-between` `.text-center` `.mt-6` `.mt-8` `.mt-12` `.mt-16`
`.sr-only` `.hidden` `.ledger` `.ledger--margin` `.display` `.label` `.lead` `.hand`

### Boutons
`.btn` + `--primary` (tampon) `--seal` (sceau) `--kraft` `--ghost` `--quiet` `--whatsapp`
+ `--lg` `--sm` `--block`

### Données / marqueurs
`.etiquette` (étiquette kraft, avec puce) · `.stamp-price` (+ `--seal` `--kraft`) ·
`.sceau` (+ `--stamp`) · `.badge` (+ `--seal` `--kraft` `--stamp` `--warn`) ·
`.avatar` (+ `--seal`) · `.toggle` (+ `.is-on`) · `.data-table` · `.prix-inline`

### Formulaires
`.form-group` `.form-label` `.form-help` `.input` (+ `--lg`) `.select` `.textarea`
`.dropzone` (+ `.dropzone__icon`, `.dropzone__title`, `.dropzone__sub`) `.preview-grid` `.preview`

### Blocs maison
`.listing-card` (+ `__img` `__price` `__body` `__title` `__meta`) · `.listings-grid` ·
`.filters` `.filters__group` `.chip` (+ `.is-active`) · `.estimate` (+ `__label`
`__range` `__meta`) · `.details-list` (+ `__item` `__q` `__a`) · `.card` (+ `__body`
`__title` `__meta`) · `.toast-container` / `.toast` (+ `--success` `--warning` `--danger`)

### Motifs de composition (favoris)
- **Lignes réglées** : `.inventaire` / `.inventaire__row` (n° mono + étape + `.etiquette`)
- **Charte** : `.charte` / `.charte__row` (icône + titre + texte + `.charte__proof`)
- **Carnet** : `.carnet` / `.carnet__fiche` / `.carnet__stars` / `.carnet__quote` / `.carnet__who`
- **Bandeau kraft** : `.bandeau` / `.bandeau__grid`
- **Fiche relevée** : `.releve-card` / `.releve-card__media` / `.releve-card__foot` / `.releve-card__tag`
- **Hero relevé** : `.releve-hero` / `.releve-hero__grid` / `.releve-hero__title` /
  `.releve-hero__lede` / `.releve-hero__actions` / `.releve-hero__note`

---

## 7. Icônes

Sprite : `assets/icons/sprite.svg`, injecté automatiquement par `core.js`.
Usage : `<svg class="ic" aria-hidden="true"><use href="#i-cube"></use></svg>`
Tailles : `.ic` (défaut) `.ic--sm` `.ic--lg` `.ic--xl`.

Symboles disponibles (61) :
`i-home` `i-camera` `i-tag` `i-chat` `i-shield` `i-shield-check` `i-lock` `i-user` `i-users`
`i-check` `i-check-circle` `i-star` `i-pin` `i-search` `i-filter` `i-arrow-right`
`i-arrow-left` `i-chev-down` `i-chev-right` `i-plus` `i-minus` `i-close` `i-menu` `i-truck`
`i-package` `i-card` `i-banknote` `i-chart` `i-trend` `i-settings` `i-cog` `i-bell`
`i-edit` `i-trash` `i-eye` `i-heart` `i-share` `i-info` `i-alert` `i-ai` `i-bot` `i-clock`
`i-calendar` `i-phone` `i-mail` `i-qr` `i-scan` `i-cube` `i-list` `i-grid` `i-refresh`
`i-logout` `i-id` `i-leaf` `i-box` `i-scale` `i-globe` `i-flag` `i-spark` `i-play`
`i-gem` `i-whatsapp` `i-download` `i-upload` `i-bookmark`

> Vérifie l'existence dans `assets/icons/sprite.svg` avant d'utiliser un symbole.
> Si un symbole manque, **ajoute-le au sprite** (24×24, stroke 1.6, `currentColor`,
> `fill="none"`) plutôt que d'inventer un caractère.

---

## 8. Motion

**Une seule séquence signature par page.** C'est `releve` : le hero se soulève,
le prix s'estampe, les règles se tracent. Réservée à la page d'accueil et à la page
de vente (`vendre.html`) — ailleurs, **pas** de `.releve` sur le hero.

Le reste :
- `[data-rise]` → apparition **conservatrice** (contenu visible sans JS, `is-in` ajouté
  par IntersectionObserver). Ne jamais mettre `opacity: 0` en CSS pur.
- `.count[data-count="2400"]` → compteur amorti au scroll.
- `.marquee` / `.marquee--reverse` → bandeau défilant.
- `.press` `.lift` `.link-underline` `.bookmark` → feedback au survol/clic.
- `.stage3d` → profondeur CSS légère.

Règles absolues :
- easing `cubic-bezier(.16, 1, .3, 1)` — jamais de bounce/elastic/back.
- rien ne clignote, rien ne pulse, rien ne tourne en boucle sauf la marquee.
- `prefers-reduced-motion` → tout se fige, le contenu reste **visible**.

---

## 9. Données & contenu

- **Vrai français de brocante**, pas de SaaS générique : « le juste prix », « le relevé »,
  « la fiche », « le sceau », « le carnet ».
- Les chiffres doivent être **cohérents** avec le reste du site :
  8 % de commission à la vente, 30 s pour une estimation, 2 M+ transactions,
  AXA jusqu'à 10 000 €, 7 barrières, 12 patterns d'arnaque, 4 niveaux KYC.
- Pas de Lorem ipsum. Pas de texte de remplissage générique type « Solution complète ».
- Les avis/témoignages sont des **fiches de client** avec initiales en `.avatar`.

---

## 10. SEO / RGPD (obligatoire sur chaque page)

- `<title>` unique, ≤ 60 caractères, avec « MaisonVide ».
- `<meta name="description">` unique, 140–160 caractères, contient 1 mot-clé + un bénéfice.
- `<link rel="canonical">`.
- JSON-LD `WebSite` + `Organization` sur l'accueil, `ItemList` sur les pages d'annonces,
  `FAQPage` sur les pages de FAQ.
- Pages légales accessibles en pied de page.
- Le bandeau cookies (`#cookie-banner`) est **identique** sur toutes les pages.
