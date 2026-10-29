# MaisonVide — La doctrine motion

> Le motion enhance, il ne conditionne jamais.
> Un visiteur qui coupe le JavaScript, qui a « mouvement réduit » dans son
> système, ou qui ouvre la page dans un onglet jamais peint doit voir
> **exactement la même information**.

---

## 1. Les trois principes

| # | Principe | Ce qu'il interdit en pratique |
|---|---|---|
| 1 | **Une seule séquence signature** | Pas de sixième effet « parallaxe ». Le relevé du hero est le seul moment cinématographique du site. |
| 2 | **Le contenu est visible par défaut** | Jamais `opacity: 0` en état par défaut. L'état initial d'une animation est l'état final. |
| 3 | **Feedback discret ailleurs** | Les interactions répondent en 120–200 ms, sans spectacle. |

Corollaires :

- pas de rebond, pas d'elastic, pas de spring — un seul easing :
  `cubic-bezier(.16, 1, .3, 1)` ;
- rien n'est déclaré hors de
  `@media (prefers-reduced-motion: no-preference)` ;
- `will-change` se pose sur peu d'éléments, et jamais sur toute une liste.

---

## 2. Les fichiers

| Fichier | Rôle |
|---|---|
| `assets/css/motion.css` | la séquence « Le relevé », les états, le bandeau, la texture de papier |
| `assets/css/scroll.css` | le rail de progression, les sections épinglées (`.act`), le filet `[data-motion]` |
| `assets/css/scroll-timeline.css` | **la couche native** : animations scroll-driven CSS, 0 octet de JS |
| `assets/css/lenis.css` | requis par Lenis (`html.lenis`, `overflow: clip`) |
| `assets/js/scroll.js` | le rail, la barre de progression, le marquage des actes, le repli des révélations |
| `assets/js/site.js` | le relevé, les compteurs, les ancres, la contraction du bandeau, les favoris |
| `assets/vendor/lenis.min.js` | défilement amorti — **épinglé en 1.3.x** |

---

## 3. La règle d'or : le CSS natif d'abord, le JS en repli

Le navigateur sait désormais faire défiler une animation dans le temps :

| Capacité | Chrome / Edge | Firefox | Safari |
|---|---|---|---|
| `animation-timeline` / `animation-range` | 115 | 159 | **26** |
| `view-transition-name` | 111 | 144 | 18 |
| `@view-transition { navigation: auto }` | 126 | — | 18.2 |

*(relevé `mdn/browser-compat-data`, 2026-10-29)*

Concrètement :

1. **Safari ≤ 25 ne sait pas** faire d'animation scroll-driven. En France,
   iOS pèse lourd dans le trafic mobile : le repli JS n'est pas une option,
   c'est une moitié du produit.
2. Donc : le CSS natif est la **première** couche, le moteur maison est le
   **repli**. Les deux ne se marchent jamais dessus :
   - `scroll-timeline.css` n'agit qu'encadré par
     `@supports (animation-timeline: view())` ;
   - `scroll.js` écrit `document.documentElement.dataset.mvTimeline`
     = `native` ou `js`, et n'écrit la hauteur du rail que si le natif est absent ;
   - le CSS l'emporte par la cascade sur les valeurs animées, le JS pose
     l'état final.
3. **GSAP n'est pas dans le projet** — et c'est un choix, pas un oubli.
   117 ko pour ce que le CSS natif couvre à 0 octet, et sa licence
   « Standard no charge » interdit l'usage dès que la plateforme facture
   l'utilisateur final (MaisonVide prend une commission sur les vendeurs).
   Voir [`REPOS-MOTION.md`](REPOS-MOTION.md) § 5.1.

---

## 4. Le lexique

| Classe | Effet | Fichier |
|---|---|---|
| `.releve` | la séquence signature : la page se soulève, le prix s'estampe, la règle se trace | `motion.css` |
| `.releve.is-revealed` | filet de sécurité : force l'état visible | `motion.css` |
| `[data-rise]` | révélation conservatrice au scroll (repli JS) | `motion.css` |
| `[data-motion]` | révélation liée au scroll (native si possible, repli sinon) | `scroll.css` + `scroll-timeline.css` |
| `.act` / `.act__grid` / `.act__sticky` / `.act__flow` / `.act__step` | section épinglée, colonne fixe + colonne qui défile | `scroll.css` |
| `.scroll-rail` / `.scroll-progress` | rail de progression à droite, barre de 2 px en tête | `scroll.css` |
| `.is-mv-scrolled` | bandeau contracté au scroll | `motion.css` |

---

## 5. Recettes

### Ajouter une révélation

```html
<div data-motion>…</div>
<div data-motion="left">…</div>
<div data-motion="scale">…</div>
```

Rien d'autre. Le natif s'en charge si le navigateur le peut ; sinon
`scroll.js` révèle à l'entrée dans le viewport, avec un filet à 2,6 s.

### Ajouter un acte épinglé

```html
<section class="act" id="inventaire" data-section="L'inventaire">
  <div class="act__grid">
    <div class="act__sticky">
      <p class="note">Acte I</p>
      <h2 class="display">…</h2>
    </div>
    <div class="act__flow">
      <article class="act__step">…</article>
    </div>
  </div>
</section>
```

Le moteur marque `.is-current` / `.is-past` sur les étapes. Sous 900 px,
`position: sticky` est désactivé : la page se lit normalement.

**Chaque `<section>` porte `data-section="…"`** : c'est le libellé que le
rail affiche au bord droit.

### Ajouter un effet scroll-linked

```css
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .mon-bloc {
      animation: rise linear both;
      animation-timeline: view();
      animation-range: entry 0% cover 28%;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: none; }
    }
  }
}
```

Uniquement dans `scroll-timeline.css`. Jamais dans une page.

---

## 6. Checklist avant livraison

- [ ] Le contenu est-il lisible **sans JavaScript** ? (`--blink-settings=scriptEnabled=false`)
- [ ] Est-il lisible **avec mouvement réduit** ? (`--force-prefers-reduced-motion`)
- [ ] Lisible dans un **onglet jamais peint** ? (le filet `.is-revealed` à 2,2 s)
- [ ] Aucune règle CSS dupliquée entre une page et une feuille partagée
      (`python3 tools/verify.py` le signale) ;
- [ ] Un seul easing, aucun rebond ;
- [ ] Le focus clavier reste visible sur tous les éléments interactifs ;
- [ ] `aria-checked` / `role` à jour sur les contrôles custom (créneaux de rendez-vous) ;
- [ ] Les ancres internes `#…` défilent jusqu'à la cible, en dessous du bandeau ;
- [ ] `prefers-reduced-motion` coupe aussi le comptage animé des chiffres
      (la valeur finale s'affiche d'un coup).

---

## 7. Interdits

- ❌ `opacity: 0` en état par défaut sur un contenu
- ❌ `backdrop-filter` sur un élément posé au-dessus d'un canvas WebGL
- ❌ une animation qui *retient* l'information (scroll bloqué, contenu masqué)
- ❌ deux séquences signature concurrentes sur une même page
- ❌ une librairie d'animation pour un effet que le CSS sait faire
