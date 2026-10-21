# MaisonVide

**Videz votre maison. Gardez vos soirées.**

Marketplace de vide-grenier : on photographie un meuble, l'IA sort une fourchette de
prix, l'annonce part, un acheteur vérifié vient, et le paiement reste bloqué en
séquestre jusqu'à la réception.

Site statique (HTML/CSS/JS vanilla, zéro build) + base PostgreSQL Neon +
fonctions serverless Vercel.

---

## Le monde visuel

**« L'inventaire de brocante »** — un carnet d'inventaire de vide-grenier, pas une
marketplace SaaS.

| Rôle | Token | Valeur |
|---|---|---|
| Sol | `--paper-ground` | `#e8e5db` papier-ledger gris-olive |
| Feuille | `--paper-sheet` | `#f7f5ef` fiche cartonnée |
| Encre | `--ink-900` | `#1b1f1c` encre d'imprimeur |
| Kraft | `--kraft-500` | `#b38d5c` la matière, les étiquettes |
| Tampon | `--stamp-500` | `#c0392b` l'unique accent : prix, urgence |
| Sceau | `--seal-500` | `#41624d` l'institutionnel : validé, vérifié |

Typographie : **Sentient** (display) + **Switzer** (body) + **Caveat** (mentions
manuscrites). Mono réservé aux données.

Le contrat de design complet est dans [`docs/GUIDE-MIGRATION.md`](docs/GUIDE-MIGRATION.md).
Il liste les interdits (eyebrow, emoji, glass décoratif, grille de cartes
identiques, gradient sur texte, Fraunces/Playfair en display) et les motifs de
composition à privilégier (lignes réglées, carnet, bandeau kraft).

---

## Architecture

```
├── index.html …            13 pages publiques
├── admin/                  11 pages (dont 3d.html : le CRM spatial)
├── assets/
│   ├── css/                tokens · main · motion · trust · legal · admin
│   ├── js/                 core (icônes/auth/toast) · site (motion) ·
│   │                       listings · estimator · admin
│   ├── icons/sprite.svg    67 icônes SVG maison (24×24, stroke 1.6)
│   ├── vendor/             three.module.js · three.core.js · lenis.min.js
│   └── img/                28 photos HD optimisées
├── api/                    fonctions serverless Vercel (Neon)
├── db/                     schema.sql · apply.js · seed.js
└── docs/                   ARCHITECTURE · DEPLOYMENT · GUIDE-MIGRATION
```

### Front-end

- **Zéro dépendance**, zéro build. Ouvrir `index.html` suffit.
- **Icônes** : sprite SVG maison injecté par `core.js`. Aucun emoji.
- **Auth** : démo `localStorage` (`mvAuth`), structurée pour être remplacée par
  l'API Neon sans refonte des pages.
- **Motion** : une seule séquence signature (« Le relevé ») au hero de l'accueil
  et de la page de vente. Le reste est du feedback discret. Contenu visible par
  défaut — le motion enhances, il ne conditionne pas.
- **Scroll** : Lenis (local), amorti, désactivé si `prefers-reduced-motion`.

### Base de données (Neon)

15 tables, 2 vues, 5 ENUM, triggers de recherche plein texte en français.

```bash
node db/apply.js   # crée le schéma
node db/seed.js    # 12 vendeurs, 12 annonces, 18 transactions, avis, IA
```

`db/.env` contient `DATABASE_URL` (gitignoré). Ne jamais versionner ce fichier.

### API (Vercel Serverless)

| Route | Retour |
|---|---|
| `GET /api/listings` | annonces actives + vendeur + estimation IA |
| `GET /api/stats` | compteurs plateforme (stock, séquestre, confiance, fraude) |

La connection string ne transite **jamais** côté navigateur : elle vit dans les
variables d'environnement du serveur (`DATABASE_URL`).

---

## Espace pro

- **Dashboard** : file de modération, signaux de santé, bande de chiffres dense.
- **CRM 3D** (`admin/3d.html`) : le stock en volume. Chaque bloc est un objet —
  hauteur = prix, couleur = catégorie, opacité = statut. Three.js local
  (aucun CDN), caméra orbitale amortie (`damp λ 6`), timeline 13 mois.
- **Flow builder chatbot**, pilotage IA, règles WhatsApp, analytics en SVG
  générés par le JS (aucune librairie externe).

---

## Lancer en local

```bash
python3 -m http.server 8080
# → http://127.0.0.1:8080
```

Compte de démonstration : `demo@maisonvide.fr` / `maisonvide`.

---

## Déploiement

Vercel : le dépôt est statique, `vercel.json` déclare les fonctions `/api` et les
headers. Variables d'environnement requises :

```
DATABASE_URL=<connection string Neon>
```

Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

© 2026 MaisonVide · RGPD · hébergement UE
