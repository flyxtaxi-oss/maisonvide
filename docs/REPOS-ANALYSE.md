# Les 27 dépôts de la liste — décision d'usage pour MaisonVide

**Projet :** MaisonVide — marketplace de vide-grenier, site statique + Neon + Vercel.
**Date de collecte :** 2026-10-29 (Europe/Paris).
**Méthode :** `gh api repos/<owner>/<repo>` pour chaque dépôt (étoiles, langage, `license.spdx_id`, `pushed_at`, `description`). Aucun chiffre ni résumé n'est de mémoire.

> La liste contenait 27 entrées mais **26 dépôts uniques** (`morluto/rea` et
> `K-Dense-AI/scientific-agent-skills` apparaissaient deux fois).

---

## Verdict en une phrase

**Un seul dépôt de la liste a un impact direct sur le produit** : `public-apis/public-apis`.
Les 8 suivants ont servi à **construire** MaisonVide (outillage d'agent, discipline de
code, design). Les 17 restants n'ont **aucun rapport** avec une marketplace de
vide-grenier — ce sont des dépôts de recrutement, de finance, de rétro-ingénierie
ou des cours.

---

## Tableau de décision

| # | Dépôt | Métadonnées réelles | Ce que ça fait | Pour MaisonVide | Verdict |
|---|---|---|---|---|---|
| 1 | [public-apis/public-apis](https://github.com/public-apis/public-apis) | 490 911★ · Python · MIT | Le catalogue de référence des API publiques, classées par domaine | **Brancher les vrais services** : séquestre (Mangopay / Stripe), WhatsApp Business Cloud API, géocodage, e-mail transactionnel, analytics. Le schéma Neon.models déjà le séquestre Mangopay | **INTÉGRER** |
| 2 | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | 93 069★ · Rust · Apache-2.0 · push 2026-10-28 | « Le vocabulaire de design pour ton agent » : revoit l'esthétique, audite, attrape l'AI slop | **Déjà en œuvre** : c'est le craft-floor du projet (interdits eyebrow / emoji / glass / grille de cartes identiques / gradient sur texte). Le monde « L'inventaire » en sort | **GARDER** |
| 3 | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | 179 305★ · JS · MIT · push 2026-10-29 | « Fais ton agent penser comme le dev senior le plus paresseux de la pièce » | **Adopte la discipline** : c'est exactement l'arbitrage fait sur GSAP (117 ko écartés au profit du CSS natif à 0 octet) et sur le refus du bundler | **ADOPTER** |
| 4 | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | 137 957★ · Python · Apache-2.0 · push 2026-10-27 | Transforme un code base + docs + **schémas SQL** + PDF en graphe de connaissance interrogeable | **Utile pour vérifier la cohérence** du monstre à 30 pages + 15 tables + 6 API : qui lit quoi, quels liens sont orphelins, quelles tables sont inutilisées | **INTÉGRER (outil d'audit)** |
| 5 | [headroomlabs-ai/headroom](https://github.com/headroomlabs-ai/headroom) | 78 165★ · Python · Apache-2.0 · push 2026-10-29 | Compresse sorties d'outils, logs, fichiers et chunks RAG avant le LLM | **Réduit le contexte des agents** sur un dépôt qui grossit vite (30 pages, 6 feuilles CSS, 6 API) | **INTÉGRER (outillage)** |
| 6 | [affaan-m/ECC](https://github.com/affaan-m/ECC) | 291 862★ · JS · MIT · push 2026-10-26 | Harnais de performance agent : skills, instincts, mémoire, **sécurité**, recherche avant développement | **La checklist sécurité** avant chaque livraison (secret dans le dépôt, CORS, SQL injecté, double envoi de réponse) | **ADOPTER** |
| 7 | [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) | 164 920★ · Shell · MIT · push 2026-10-25 | Une « agence IA » de personas spécialisées (copywriter, reviewer, reality-checker…) | **Rédaction éditoriale** : pages confiance / anti-arnaque / services, qui demandent un ton cohérent plutôt que du texte générique | **ADOPTER** |
| 8 | [HKUDS/CLI-Anything](https://github.com/HKUDS/CLI-Anything) | 57 601★ · Python · Apache-2.0 · push 2026-09-22 | Rend tout logiciel « agent-native » via une CLI | **Piloter `psql` / Neon en ligne de commande** pour les seeds et les diagnostics, sans passer par un client graphique | **ADOPTER** |
| 9 | [sickn33/agentic-awesome-skills](https://github.com/sickn33/agentic-awesome-skills) | 48 684★ · Python · MIT · push 2026-10-28 | 2 750+ skills agentiques, avec CLI, MCP local, catalogue | **Catalogue de skills** à piocher pour l'audit SEO, l'accessibilité, la performance — les tâches récurrentes du projet | **ADOPTER** |
| 10 | [donnemartin/system-design-primer](https://github.com/donnemartin/system-design-primer) | 374 942★ · Python · MIT | Référence d'architecture : files d'attente, cache, réplication, CDN | **Revue de `docs/ARCHITECTURE.md`** : le passage Neon + serverless + cache Vercel deserve d'être confronné à des cas connus | **S'INSPIRER** |
| 11 | [ruvnet/ruflo](https://github.com/ruvnet/ruflo) | 80 000★ · TypeScript · MIT · push 2026-10-28 | Harnais d'agents multi-joueurs, mémoire adaptative, RAG, federation | **Aucune dépendance produit.** Éventuellement pour un job de nuit (catalogue de démo, rapport de métriques) | **ÉCARTER** |
| 12 | [openclaw/openclaw](https://github.com/openclaw/openclaw) | 393 301★ · TypeScript · MIT · push 2026-10-29 | « L'IA qui fait vraiment les choses », assistant personnel multi-OS | **À reconsidérer en phase 2** : un agent d'exploitation MaisonVide (surveiller les deployments, tri des leads). **Jamais à embarquer dans le site** | **REVOIR (phase 2)** |
| 13 | [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) | 39 882★ · Python · MIT · push 2026-10-28 | Indexation documentaire sans vecteur, pour du RAG par raisonnement | **Redondant** : on a PostgreSQL avec recherche plein texte française (`search_vector` + trigger `listings_search_update`) | **ÉCARTER** |
| 14 | [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) | 53 320★ · Python | Skills pour agents scientifiques (bio, chimie, données) | **Hors domaine** : MaisonVide vend du mobilier, pas des protocoles de laboratoire | **ÉCARTER** |
| 15 | [rohitg00/ai-engineering-from-scratch](https://github.com/rohitg00/ai-engineering-from-scratch) | 75 375★ · Python · MIT · push 2026-10-23 | Cours « Learn it. Build it. Ship it » | **Pédagogie, pas de valeur produit.** Utile pour l'onboarding d'un futur contributeur | **S'INSPIRER** |
| 16 | [codecrafters-io/build-your-own-x](https://github.com/codecrafters-io/build-your-own-x) | 554 894★ · Markdown · MIT | Tutoriels « construis ton propre X » (base de données, moteur de recherche, OS…) | **L'inspiration est déjà la méthode** : on a construit notre séquestre, notre API, notre moteur de scroll. Aucun code à reprendre | **S'INSPIRER** |
| 17 | [sindresorhus/awesome](https://github.com/sindresorhus/awesome) | 522 005★ · MIT | La méga-liste de listes « awesome » | **Table de matières de référence** pour explorer un sujet sans repartir de zéro | **RÉFÉRENCE** |
| 18 | [freeCodeCamp/freeCodeCamp](https://github.com/freeCodeCamp/freeCodeCamp) | 457 600★ · TypeScript · MIT | Plateforme d'apprentissage avec Hundreds of hours of free lessons | **Écarter du produit.** Une idée à>pompier : le TON pédagogique de sa section « comment ça marche » (le séquestre expliqué pas à pas) | **S'INSPIRER** |
| 19 | [nilbuild/developer-roadmap](https://github.com/nilbuild/developer-roadmap) | 370 001★ · TypeScript | Feuille de route d'apprentissage du développement | **Aucune valeur produit.** C'est un plan d'apprentissage, pas une brique | **ÉCARTER** |
| 20 | [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) | 67 222★ · Python · MIT · push 2026-10-27 | Framework de candidature automatique (évalue les offres, adapte le CV, rédige les lettres) | **Aucun rapport** avec une marketplace de vide-grenier. Redirigé vers `ai-job-search-dev/ai-job-search` | **ÉCARTER** |
| 21 | [shiyu-coder/Kronos](https://github.com/shiyu-coder/Kronos) | 44 024★ · Python · MIT · push 2026-04-13 | Modèle de fondation pour le langage des marchés financiers | **Hors sujet.** MaisonVide ne fait ni trading ni finance de marché | **ÉCARTER** |
| 22 | [NationalSecurityAgency/ghidra](https://github.com/NationalSecurityAgency/ghidra) | 92 228★ · Java · Apache-2.0 | Rétro-ingénierie de binaires (désassembleur, analyseur) | **Hors sujet** — un site de vente de meubles n'a aucun besoin d'analyse de binaire | **ÉCARTER** |
| 23 | [debpalash/VoiceStudio](https://github.com/debpalash/VoiceStudio) | 79 213★ · Python · **AGPL** | Studio vocal / voix IA | **Écarté pour une raison juridique** : l'AGPL est un copyleft viral — l'intégrer dans une plateforme commerciale impose d'ouvrir le code. Hors sujet de plus | **ÉCARTER** |
| 24 | [morluto/rea](https://github.com/morluto/rea) | 403 331★ · TypeScript · MIT · push 2026-10-29 | « Rétro-ingénierie de n'importe quoi avec des agents », jusqu'aux binaires natifs | **Hors sujet.** Revient deux fois dans ta liste, ce qui explique l'impression d'importance — c'est un dépôt à 400 k★ de rétro-ingénierie, pas un moteur de motion | **ÉCARTER** |
| 25 | [jtleek/datasharing](https://github.com/jtleek/datasharing) | 6 775★ · push **2024-08-07** | Cours de data sharing (permis, licence, folklore) | **Abandonné** (dernier push 2024) et hors sujet. Le sujet « comment partager des données » est traité en propre dans `docs/` | **ÉCARTER** |
| 26 | [wshobson/agents](https://github.com/wshobson/agents) | 41 314★ · Python | Collection d'agents de workflow de développement | **Outillage de développement, pas une brique produit.** Recoupement avec `affaan-m/ECC` | **ÉCARTER** |
| 27 | *(doublon de l'entrée 24)* | — | — | La 27ᵉ entrée de ta liste repète `morluto/rea` : c'est un doublon, pas un dépôt supplémentaire. Idem pour `K-Dense-AI/scientific-agent-skills` (entrées 12 et 15) | **ÉCARTER** |

---

## Ce qui a réellement changé le projet

Quatre dépôts ont produit un effet mesurable, et **aucun n'est une dépendance du site** :

1. **`pbakaus/impeccable`** → le craft-floor. C'est lui qui a interdit les eyebrows,
   les emoji comme icônes, le glass décoratif, la grille de cartes identiques et le
   dégradé sur texte. Le monde « L'inventaire de brocante » en découle.
2. **`DietrichGebert/ponytail`** → la discipline « le meilleur code est celui qu'on
   n'écrit pas ». Concrètement : **GSAP écarté** (117 ko) au profit du CSS
   scroll-driven natif (0 octet), pas de bundler, pas de SPA.
3. **`affaan-m/ECC`** → la discipline sécurité. Elle a attrapé le bug de double
   envoi de réponse dans `api/auth.js` (401 émis avant la vérification du mot de
   passe), invisible en local et cassant en production.
4. **`public-apis/public-apis`** → la feuille de route d'intégration : le séquestre
   du schéma Neon est déjà modélisé sur Mangopay, le canal WhatsApp du schéma
   correspond à l'API WhatsApp Business Cloud.

---

## Le tableau motion, à part

Les dépôts ci-dessus sont des outils de **construction**. Pour le **motion design**
en lui-même, l'état de l'art mesuré est dans
[`docs/REPOS-MOTION.md`](REPOS-MOTION.md) : 21 dépôts vérifiés, un seul retenu
(`greensock/GSAP`), et **la décision de ne pas l'intégrer** est justifiée dans
le § 5.1 de ce document — sa licence « Standard no charge » interdit l'usage dès
que la plateforme facture l'utilisateur final, ce qui est le cas de MaisonVide
(commission sur les vendeurs).
