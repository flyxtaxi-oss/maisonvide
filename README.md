# MaisonVide

**Videz votre maison. Gardez vos soirées.**

Marketplace de vide-grenier : on photographie un meuble, l'IA sort une fourchette de
prix, l'annonce part, un acheteur vérifié prend rendez-vous, vient, et le paiement
reste bloqué en séquestre jusqu'à la réception.

Site statique (HTML/CSS/JS vanilla, zéro build) + base PostgreSQL Neon +
fonctions serverless Vercel.

| | |
|---|---|
| **En ligne** | https://maisonvide.vercel.app |
| **Dépôt** | https://github.com/flyxtaxi-oss/maisonvide |
| **API live** | `/api/listings` · `/api/stats` · `/api/appointments` · `/api/pro` · `/api/auth` (source : `neon`) |
| **Compte vendeur démo** | `cuisine.m@example.fr` / `maisonvide` → https://maisonvide.vercel.app/pro.html |
| **Mot de passe démo** | `maisonvide` pour les 12 vendeurs du seed (hashés en scrypt, jamais en clair) |

> Le domaine de référence est `maisonvide.vercel.app`. Brancher `maisonvide.fr` ne
> demande qu'un remplacement de chaîne dans les pages, `robots.txt` et
> `sitemap.xml` : `grep -rl 'maisonvide.vercel.app' . | xargs sed -i '' 's/maisonvide.vercel.app/maisonvide.fr/g'`.

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

Deux documents font foi :

- [`docs/GUIDE-MIGRATION.md`](docs/GUIDE-MIGRATION.md) — le monde « L'inventaire »
  et ses interdits (eyebrow, emoji, glass décoratif, grille de cartes
  identiques, gradient sur texte, Fraunces/Playfair en display).
- [`docs/LANGUE-ORYZO.md`](docs/LANGUE-ORYZO.md) — la grammaire d'inspiration
  oryzo.ai : filets pointillés, données entre crochets, cinq rôles
  typographiques, bouton qui s'inverse, grille 16 colonnes, sections épinglées.

---

## Architecture

```
├── index.html …            18 pages publiques (dont pro.html : l'espace vendeur)
├── admin/                  12 pages (dont 3d.html : le CRM spatial)
├── assets/
│   ├── css/                tokens · main · motion · blocks · trust · legal · admin
│   │                       oryzo (la grammaire) · scroll (le moteur de scroll) · pro
│   ├── js/                 core (icônes/auth/toast) · site (motion) · scroll
│   │                       listings · estimator · admin · booking · pro
│   ├── icons/sprite.svg    symboles SVG maison (24×24, stroke 1.6)
│   ├── vendor/             three.module.js · three.core.js · lenis.min.js
│   └── img/                photos HD optimisées
├── api/                    fonctions serverless Vercel (Neon)
├── db/                     schema.sql · apply.js · seed.js · seed-appts.js · seed-pro.js
└── docs/                   ARCHITECTURE · DEPLOYMENT · GUIDE-MIGRATION · LANGUE-ORYZO
```

### Front-end

- **Zéro dépendance**, zéro build. Ouvrir `index.html` suffit.
- **Icônes** : sprite SVG maison injecté par `core.js`. Aucun emoji.
- **Auth** : deux niveaux.
  - Le compte visiteur des pages publiques reste en `localStorage` (`mvAuth`).
  - L'**espace vendeur** (`pro.html`) et le **traitement des rendez-vous** passent
    par une session serveur réelle : `POST /api/auth` (e-mail + mot de passe
    haché en scrypt) renvoie un jeton HMAC-SHA256 présenté en `Authorization: Bearer`.
- **Motion** : une seule séquence signature (« Le relevé ») au hero de l'accueil
  et de la page de vente. Le reste est du feedback discret. Contenu visible par
  défaut — le motion enhances, il ne conditionne pas.
- **Scroll** : Lenis (local) + un moteur maison (`scroll.js`) qui pose le rail de
  progression à droite, la barre de progression en tête et marque les étapes des
  sections épinglées (`.act`). Désactivé si `prefers-reduced-motion`.

### Base de données (Neon)

15 tables, 3 vues, 5 ENUM, triggers de recherche plein texte en français.

```bash
node db/apply.js        # crée le schéma (idempotent)
node db/seed.js         # 12 vendeurs, 12 annonces, 18 transactions, avis, IA
node db/seed-appts.js   # 46 créneaux de disponibilité, 15 rendez-vous
node db/seed-pro.js     # enrichit le compte vendeur de démonstration
```

`db/.env` contient `DATABASE_URL` (gitignoré). Ne jamais versionner ce fichier.

### API (Vercel Serverless)

| Route | Méthode | Retour |
|---|---|---|
| `/api/listings` | GET | annonces actives + vendeur + estimation IA |
| `/api/stats` | GET | compteurs plateforme (stock, séquestre, confiance, fraude) |
| `/api/auth` | POST · GET | login / inscription / profil (jeton signé) |
| `/api/pro` | GET | tableau de bord vendeur : KPI, leads, séquestre, séries |
| `/api/appointments` | GET · POST · PATCH | créneaux, demande, confirmation |
| `/api/slots` | GET · POST · PATCH · DELETE | créneaux de disponibilité du vendeur |

La connection string ne transite **jamais** côté navigateur : elle vit dans les
variables d'environnement du serveur (`DATABASE_URL`).

Harnais de test local des handlers :

```bash
node tools/test-api.js   # 16/16
```

---

## Les trois produits dans le produit

1. **Le site public** — vitrine de confiance : estimation IA par photo, catalogue,
   charte anti-arnaque, séquestre.
2. **L'espace vendeur** (`pro.html`) — KPI, annonces, leads, chiffre d'affaires,
   encours de séquestre, rendez-vous, créneaux. Alimenté par Neon, pas par des
   maquettes.
3. **L'admin** (`admin/`) — modération, messagerie, analytics, chatbot, IA,
   WhatsApp, CRM 3D.

---

## Lancer en local

```bash
python3 -m http.server 8080
# → http://127.0.0.1:8080
```

Les API sont des fonctions Vercel : en local, elles répondent via l'API déployée
ou pas du tout. Les pages restent lisibles et affichent un état explicite.

---

## Déploiement

Vercel : le dépôt est statique, `vercel.json` déclare les fonctions `/api` et les
headers. Variables d'environnement requises :

```
DATABASE_URL=<connection string Neon>
SESSION_SECRET=<secret de signature des jetons — openssl rand -hex 32>
```

Voir [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

## Vérification

```bash
python3 tools/verify.py          # structure, SEO, design system, liens, syntaxe, HTML
python3 tools/check-html.py      # équilibre des balises
python3 tools/render-check.sh    # rendu headless des pages + erreurs console
node tools/smoke-admin.js        # harnais admin.js
node tools/test-api.js           # harnais API (17 tests, nettoie ses traces)
```

Trois outils gardent le projet honnête :

| Outil | Ce qu'il empêche |
|---|---|
| `tools/normalize-head.py` | un `<style>` inline placé avant les feuilles partagées (il serait neutralisé) ou une feuille partagée disparue |
| `tools/dedupe-css.py` | une règle copiée dans une page alors qu'elle existe dans une feuille partagée — deux sources de vérité qui divergent |
| `tools/repair-styles.py` | un bloc `<style>` cassé (restaure depuis la dernière version commise) |

`verify.py` contrôle la duplication CSS et l'équilibre des balises : les deux
erreurs les plus coûteuses du projet y sont maintenant attrapées automatiquement.

---

© 2026 MaisonVide · RGPD · hébergement UE
