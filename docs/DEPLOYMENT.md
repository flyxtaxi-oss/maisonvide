# Déploiement MaisonVide

Site statique (HTML/CSS/JS vanilla) + deux fonctions serverless Vercel qui lisent
la base Neon. Aucun build, aucune dépendance à l'exécution côté navigateur.

---

## 1. Variables d'environnement

| Variable | Où | Valeur |
|---|---|---|
| `DATABASE_URL` | Vercel (Production + Preview) | connection string Neon |

La connection string **n'est jamais** versionnée : elle vit dans `db/.env`
(gitignoré) en local, et dans les variables d'environnement Vercel en ligne.

```bash
# En local
printf 'DATABASE_URL=%s\n' '<connection-string>' > db/.env

# Chez Vercel
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
```

---

## 2. Premier déploiement

```bash
cd "/Users/jibril/Desktop/vide maison"
vercel --prod          # détecte le projet statique + /api
```

`vercel.json` déclare :
- `functions["api/*.js"]` — mémoire 1 Go, timeout 10 s ;
- les headers de sécurité (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`) ;
- le cache long sur `/assets/**`.

`.vercelignore` exclut `node_modules`, `.git`, `db/.env`, `*.tmp`.

---

## 3. Base de données

```bash
node db/apply.js   # schéma (15 tables, 2 vues, 5 ENUM, triggers FTS français)
node db/seed.js    # données de démonstration
```

`db/apply.js` découpe le SQL avec un **splitter aware du dollar-quoting** : les
blocs `DO $$ … $$` et `CREATE FUNCTION … $$` sont conservés intacts. Un split naïf
sur `;` casse PL/pgSQL.

---

## 4. Endpoints

| Route | Méthode | Retour |
|---|---|---|
| `/api/listings` | GET | `{ ok, source: "neon", count, listings[] }` |
| `/api/stats` | GET | `{ ok, source: "neon", listings, escrow, users, fraud, ai, traffic }` |

Les deux renvoient `503` avec un message explicite si `DATABASE_URL` manque —
utile pour distinguer « base non configurée » d« API cassée ».

---

## 5. Vérification après déploiement

```bash
curl -s https://<domaine>/api/listings | head -c 400
curl -s https://<domaine>/api/stats    | head -c 400
```

Les deux doivent répondre `200` avec `"source":"neon"`.

---

## 6. Performance

- Three.js et Lenis sont **embarqués en local** (`assets/vendor/`) : aucun CDN,
  pas de requête vers un tiers.
- Les photos sont en JPEG optimisées (1600 px de long, qualité 78) : ~10 Mo pour
  28 images.
- Les polices (Sentient, Switzer, Caveat) viennent de Fontshare et Google Fonts,
  avec `preconnect`.
- `prefers-reduced-motion` coupe la séquence signature et le scroll amorti.

---

## 7. Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| `/api/*` renvoie 503 | `DATABASE_URL` absente | `vercel env add DATABASE_URL production` puis redéployer |
| Page blanche côté API | Import CommonJS | Garder `module.exports = (req, res) => {}` |
| Icônes SVG absentes | `core.js` non chargé | Vérifier le chemin `assets/js/core.js` |
| Scène 3D noire | WebGL indisponible | Un message de repli s'affiche ; le reste du site fonctionne |
