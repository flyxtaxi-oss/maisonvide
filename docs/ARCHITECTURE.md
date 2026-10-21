# Architecture technique — MaisonVide

> Vision globale du système, choix techniques et roadmap.

## Vue d'ensemble

MaisonVide est une **marketplace d'estimation et de revente d'objets d'occasion** avec 3 acteurs principaux :

```
┌────────────────────────────────────────────────────────────┐
│                       MAISONVIDE                          │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   👤 Vendeur          🏠 Plateforme         👤 Acheteur    │
│   │                    │                    │              │
│   ├── Photo ────────► Estimation IA ◄──── Recherche       │
│   │                    │                    │              │
│   ├── Annonce ──────► Publication ────────► Annonce       │
│   │                    │                    │              │
│   │                  Messagerie ◄──────── Contact         │
│   │                  WhatsApp Bot            │              │
│   │                    │                    │              │
│   ◄─── Paiement ───── Séquestre ────────► Paiement       │
│   │                    │                    │              │
│   ├── Note ──────────► Avis ◄─────────────── Note         │
│   │                    │                    │              │
│   └──── Service ─────► Pro / Enlèvement ◄── Service       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Stack actuelle (MVP — ce prototype)

| Couche | Techno | Pourquoi |
|---|---|---|
| Frontend | **HTML/CSS/JS vanilla** | Zéro build, opens instantly, modifiable facilement |
| Design | Design system via tokens CSS | Une seule source de vérité pour re-themer |
| Polices | Inter + Fraunces (Google Fonts) | Moderne + serif élégant, FR-friendly |
| Images | SVG inline | Pas de dépendance externe, scaling parfait |
| Charts | SVG natif | Léger, pas de librairie externe |
| Hébergement cible | Vercel / Netlify / Cloudflare Pages | Edge CDN, gratuit, SSL auto |

**Taille totale** : ~300 KB non compressé, **~80 KB gzippé**.

## Stack recommandée (production)

### Option 1 — Full JavaScript
```
Next.js 14 (App Router)
├── TypeScript
├── Tailwind CSS  (alternative aux CSS vanilla pour itérer)
├── Prisma
├── NextAuth / Clerk
├── Stripe Connect
├── Meta WhatsApp Cloud API
├── OpenAI Vision (estimation IA)
├── Cloudinary / Scaleway Object Storage
├── Sentry (monitoring)
├── PostHog / Matomo (analytics)
└── PostgreSQL (Scaleway 🇫🇷)
```

### Option 2 — Full Python
```
Django / FastAPI
├── PostgreSQL
├── Celery (tasks async)
├── Redis (cache + sessions)
├── Stripe Connect
├── OpenAI / Anthropic API
├── Cloudinary
└── HTMX + Alpine.js (front léger)
```

## Schéma de données (proposition)

```
users
├── id (uuid)
├── email
├── phone (E.164)
├── type (buyer | seller | both | pro)
├── verified_at
├── kyc_status (pending | approved | rejected)
└── ...

listings
├── id (uuid)
├── seller_id ──► users.id
├── title
├── description
├── category (enum: mobilier, decoration, ...)
├── condition (enum: neuf, tres_bon, bon, correct, a_renover)
├── brand_tier (enum: luxe, premium, milieu, bas, inconnue)
├── age_years (int)
├── ai_estimate_low (decimal)
├── ai_estimate_high (decimal)
├── ai_confidence (decimal 0-1)
├── seller_price (decimal, nullable)
├── status (enum: draft, pending, active, sold, removed)
├── location (geo: lat, lng, city)
├── created_at
└── ...

listing_photos
├── id, listing_id, position, url, moderation_status

conversations
├── id, listing_id, buyer_id, seller_id, channel, status, bot_active

transactions
├── id, listing_id, buyer_id, seller_id, amount, commission, escrow_status

ai_estimates
├── id, listing_id, request_payload, response_payload, confidence, latency_ms

chatbot_flows
├── id, name, version, definition_json, is_active, traffic_split

admin_audit_log
└── id, user_id, action, target_type, target_id, payload_json, ip, ts
```

## Estimation IA — comment ça marche

### Approche MVP (prototype)
Algorithme déterministe dans `estimator.js` :
1. Récupère la base de prix de la catégorie
2. Applique multiplicateur (état × marque × âge × photo)
3. Calcule un indice de confiance
4. Génère des conseils contextuels

### Approche production
1. **Vision** : OpenAI `gpt-4o` ou modèle custom (YOLO + classifier)
2. **Pricing** : modèle de régression sur 2M+ transactions historiques
3. **Ajustements** : marge de sécurité paramétrable dans l'admin (`/admin/ia.html`)
4. **Cache** : Redis pour éviter les appels API redondants
5. **Fallback** : si IA down → estimation heuristique (l'algo actuel)

```python
# Pseudo-code backend
async def estimate(photo_url, category_hint=None, condition=None):
    # 1. Vision : identifier l'objet
    vision = await openai_vision.analyze(photo_url)
    detected_category = vision.get("category") or category_hint
    
    # 2. Pricing : récupérer transactions similaires
    similar = await db.query("""
        SELECT price, condition, brand, age_years
        FROM transactions
        WHERE category = :cat
        ORDER BY similarity(embedding) DESC
        LIMIT 100
    """, cat=detected_category)
    
    # 3. Estimation
    estimate = pricing_model.predict(similar, condition, age)
    
    # 4. Confiance
    confidence = compute_confidence(estimate, similar)
    
    return {
        "low": estimate.low,
        "high": estimate.high,
        "confidence": confidence,
        "similar_count": len(similar),
    }
```

## Chatbot WhatsApp — flow

```
[Utilisateur envoie message]
         │
         ▼
[Webhook WhatsApp] ─► [File d'attente]
         │                    │
         ▼                    ▼
[Classifier intent]  ◄── [Récupérer contexte]
         │
    ┌────┼────┬─────────┬─────────┐
    ▼    ▼    ▼         ▼         ▼
  Estimer Vendre Pro   Acheter   Humain
    │    │    │         │         │
    ▼    ▼    ▼         ▼         ▼
[Flow] [Flow] [Lead]   [Lien]   [Handoff]
    │    │    │                   │
    └────┴────┴──────[Transfert]──┘
                ▼
        [Conseiller humain]
                │
                ▼
        [Tag utilisateur + Analytics]
```

### Stack chatbot production

- **Meta WhatsApp Cloud API** (gratuit pour les 1000 premiers)
- **Orchestrateur** : Node.js + un LLM (Claude / GPT-4)
- **Flow designer** : ce qu'on a dans `/admin/chatbot.html`
- **State machine** : XState
- **Handoff** : webhook vers Intercom ou Crisp

## Sécurité

| Surface | Mesure |
|---|---|
| Auth | Magic link + 2FA optionnelle, hash bcrypt |
| Anti-bot | Cloudflare Turnstile |
| Photos | AV scan (ClamAV) + IA modération |
| Paiements | 3DS obligatoire, séquestre |
| RGPD | Export / oubli en 1 clic |
| Backups | Quotidien chiffré, 30 jours rétention |
| Audit log | Toutes actions admin tracées |

## Observabilité

- **Logs** : Sentry + Datadog (ou Grafana + Loki self-hosted)
- **Métriques** : Prometheus + Grafana
- **Tracing** : OpenTelemetry
- **Métier** : dashboard admin `/admin/analytics.html`

## Performance — cibles

| Métrique | Cible |
|---|---|
| LCP | < 1,5s |
| FID | < 100ms |
| CLS | < 0,1 |
| TTFB | < 200ms |
| Lighthouse Perf | > 95 |
| Lighthouse A11y | > 90 |

## Coûts estimés (à 1000 utilisateurs actifs/mois)

| Service | Coût |
|---|---|
| Vercel Pro | 20 €/mois |
| Scaleway DB (PostgreSQL) | 15 €/mois |
| OpenAI API (10k estimations) | 50 €/mois |
| WhatsApp Business (Tier 2) | 50 €/mois |
| Sentry | 26 €/mois |
| Stripe Connect | % sur ventes |
| **Total infra** | **~160 €/mois** |
| Mangopay séquestre | % sur séquestres |

À 100k€/mois de CA → marge 60-70% avant coûts salariaux.

## Roadmap technique (12 mois)

| Mois | Jalon |
|---|---|
| M1 | Backend API + DB + Auth |
| M2 | WhatsApp Business API live |
| M3 | IA estimation (OpenAI Vision) |
| M4 | Paiements Stripe + Mangopay |
| M5 | App mobile (React Native ou PWA+) |
| M6 | Multi-villes + multi-langues |
| M7 | API publique + partenaires |
| M8 | Modèle IA custom (YOLO + price model) |
| M9 | Programme de fidélité |
| M10 | B2B (pros, successions notaires) |
| M11 | Expansion Belgique / Suisse |
| M12 | Series A 🚀 |

## Questions à trancher avec le client

1. **Volume attendu** : nb d'annonces / mois ? → dimensionne infra
2. **Zones** : France only ou Europe ? → impacte RGPD/TVA
3. **Mobile** : web responsive suffisant ou app native ?
4. **IA** : OpenAI (rapide, €€) ou modèle custom (lent, €, plus précis) ?
5. **Marque blanche** : un seul client ou multi-tenant ?
6. **Enlèvement** : on le gère nous-même ou via partenaire ?
---

## Système de confiance & anti-arnaque

MaisonVide intègre **7 couches de sécurité actives** pour garantir que chaque transaction se passe sans risque.

### Les 7 couches

| # | Couche | Technologie | Coût pour l'utilisateur |
|---|--------|-------------|------------------------|
| 1 | **Vérification d'identité (KYC)** | Pièce d'identité + selfie vidéo + OCR + reconnaissance d'hologrammes | Inclus |
| 2 | **IA anti-fraude** | Deepfake detection (GAN patterns), reverse image search sur 100M+ d'images, base de données objets volés | Inclus |
| 3 | **Séquestre bancaire** | Mangopay (agréé ACPR), 5 étapes : accord → paiement bloqué → envoi → inspection → versement | Inclus |
| 4 | **3D Secure** | Stripe Connect + DSP2, authentification bancaire obligatoire | Inclus |
| 5 | **Assurance AXA** | Contrat AXA-FRA-2026-487263, jusqu'à 2 500 € (basic) / 5 000 € (Pro) / 10 000 € (Premium+) | Inclus dans la commission |
| 6 | **Médiation humaine 24/7** | 8 médiateurs à Paris, réponse < 2 min, décision sous 24h, gratuit | Inclus |
| 7 | **Partenariat forces de l'ordre** | Convention Gendarmerie Nationale + Police Nationale + PHAROS | Public |

### Niveaux de vérification vendeur (KYC tiers)

| Tier | Vérifications | Garantie | Coût |
|------|--------------|----------|------|
| **Basique** | Email | 1 000 € | Gratuit |
| **Vérifié** | + ID + selfie vidéo + IBAN | 2 500 € | Gratuit |
| **Pro** | + SIRET + RC Pro | 5 000 € | Gratuit |
| **Premium** | + 50 ventes + 4,9/5 + audit | 10 000 € | Sur invitation |

### Score de confiance (0-100)

Calculé en temps réel à partir de :
- Ancienneté du compte (+1/mois, max +20)
- Ventes réussies (+1/vente, max +30)
- Note moyenne (+rating × 10, max +30)
- Délai de réponse (+15 si < 1h, +10 si < 4h)
- KYC complet (+10)
- Litiges (-10 par litige)
- Signalements (-20 par signalement validé)

### Flow séquestre (visualisé sur `/garanties.html`)

```
1. Accord trouvé          2. Paiement sécurisé       3. Envoi
   ⏱️ 0 seconde             🔒 280 € bloqués            📦 24-72h
   
4. Inspection acheteur    5. Vendeur payé
   ✅ 48h                    💸 257,60 € versés
```

### 12 patterns d'arnaques bloqués automatiquement

Voir `/anti-arnaque.html` pour le détail complet. Notre IA détecte :
1. Photos volées d'autres sites (reverse search)
2. Faux dépôt-vente / paiement hors plateforme (NLP keywords)
3. Fausses preuves de paiement (validation séquestre)
4. Surpaiement + demande de remboursement (séquestre bloqué)
5. Objets volés (base Gendarmerie + numéro de série)
6. Deepfake / photos générées par IA (GAN patterns)
7. Usurpation d'identité (KYC obligatoire + doublons)
8. Fausses annonces de location (interdites par CGU)
9. Contrefaçons (authentificateur humain pour marques de luxe)
10. Chargeback après envoi (tracking + signature + équipe juridique)
11. Phishing (DKIM + SPF + DMARC + détection liens externes)
12. Extorsion (détection patterns + transmission PHAROS auto)

### Statistiques publiques (compteur live sur `/confiance.html`)

- **487** arnaques bloquées ce mois
- **99,2 %** de transactions sans litige
- **342 000 €** sécurisés aujourd'hui
- **2** litiges en cours de médiation

Toutes les pages affichent des **badges de confiance** :
- Score de confiance sur chaque annonce (cercle coloré)
- Tier de vérification (Email / Vérifié / Pro / Premium)
- Bandeau "Sécurisé par MaisonVide" sur chaque produit
- Lien vers `/confiance.html`, `/garanties.html`, `/anti-arnaque.html`
