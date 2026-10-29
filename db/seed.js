/* ==========================================================================
   MaisonVide — Seed de démonstration (Neon)
   Usage : node db/seed.js

   Donne la base un contenu crédible : 12 vendeurs, 12 annonces, photos,
   transactions en séquestre, avis, estimations IA, conversations et un flux
   de chatbot. Idempotent : on repart d'une base propre à chaque exécution.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const { hashPassword } = require('../api/_auth');

/* Mot de passe de démonstration, commun aux 12 vendeurs du seed.
   Documenté dans README.md — c'est un jeu de données de démo, jamais un
   compte réel. Le hachage est un scrypt (aucun mot de passe en clair). */
const DEMO_PASSWORD = 'maisonvide';

function readUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8')
    .split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (!line) return null;
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

const rowsOf = res => (Array.isArray(res) ? res : (res && res.rows) || []);

/* ------------------------------------------------------------------ */
/* Données                                                              */
/* ------------------------------------------------------------------ */
const SELLERS = [
  { email: 'sophie.m@example.fr',   name: 'Sophie M.',    city: 'Lyon',     tier: 'verified', trust: 92, rating: 4.9, sales: 23, purchases: 6 },
  { email: 'julien.d@example.fr',   name: 'Julien D.',    city: 'Bordeaux', tier: 'verified', trust: 87, rating: 4.8, sales: 12, purchases: 4 },
  { email: 'christine.p@example.fr',name: 'Christine P.', city: 'Nantes',   tier: 'premium',  trust: 98, rating: 5.0, sales: 47, purchases: 9 },
  { email: 'antoine.r@example.fr',  name: 'Antoine R.',   city: 'Paris',    tier: 'verified', trust: 84, rating: 4.7, sales: 5,  purchases: 11 },
  { email: 'famille.l@example.fr',  name: 'Famille L.',   city: 'Toulouse', tier: 'verified', trust: 82, rating: 4.6, sales: 8,  purchases: 3 },
  { email: 'marc.b@example.fr',     name: 'Marc B.',      city: 'Rennes',   tier: 'basic',    trust: 58, rating: 4.2, sales: 2,  purchases: 1 },
  { email: 'biblio.v@example.fr',   name: 'Bibliothèque V.', city: 'Lille',  tier: 'verified', trust: 91, rating: 4.9, sales: 18, purchases: 2 },
  { email: 'cuisine.m@example.fr',  name: 'Cuisine M.',   city: 'Marseille',tier: 'pro',      trust: 96, rating: 5.0, sales: 31, purchases: 7 },
  { email: 'helene.g@example.fr',   name: 'Hélène G.',    city: 'Strasbourg',tier: 'verified',trust: 86, rating: 4.8, sales: 9,  purchases: 5 },
  { email: 'gamer.p@example.fr',    name: 'Gamer P.',     city: 'Rouen',    tier: 'verified', trust: 89, rating: 4.9, sales: 14, purchases: 8 },
  { email: 'galerie.s@example.fr',  name: 'Galerie S.',   city: 'Nice',     tier: 'premium',  trust: 99, rating: 5.0, sales: 67, purchases: 12 },
  { email: 'beaute.f@example.fr',   name: 'Beauté F.',    city: 'Nantes',   tier: 'verified', trust: 81, rating: 4.8, sales: 6,  purchases: 4 },
];

const LISTINGS = [
  { slug: 'canape-ikea-kivik',      title: 'Canapé 3 places IKEA KIVIK',          cat: 'mobilier',      price: 280,  img: 'listing-canape.jpg',      cond: 'tres-bon', brand: 'milieu', age: 5,  seller: 0,  views: 1842, contacts: 64,  status: 'active', featured: true },
  { slug: 'table-chene-massif',     title: 'Table à manger chêne massif',          cat: 'mobilier',      price: 340,  img: 'listing-table.jpg',       cond: 'bon',      brand: 'haut',   age: 12, seller: 1,  views: 967,  contacts: 31,  status: 'active', featured: true },
  { slug: 'lampe-articulo',         title: 'Lampe sur pied articulée vintage',     cat: 'decoration',    price: 85,   img: 'listing-lampe.jpg',       cond: 'tres-bon', brand: 'milieu', age: 30, seller: 2,  views: 2410, contacts: 88,  status: 'active', featured: true },
  { slug: 'macbook-pro-m1',         title: 'MacBook Pro 13" M1 2020',              cat: 'electronique',  price: 720,  img: 'listing-macbook.jpg',     cond: 'tres-bon', brand: 'haut',   age: 6,  seller: 3,  views: 3210, contacts: 112, status: 'active', featured: true },
  { slug: 'commode-laque-p60',      title: 'Commode laquée années 60',             cat: 'mobilier',      price: 145,  img: 'listing-commode.jpg',     cond: 'bon',      brand: 'milieu', age: 40, seller: 4,  views: 612,  contacts: 19,  status: 'active', featured: false },
  { slug: 'velo-ville-peugeot',     title: 'Vélo de ville Peugeot',                cat: 'bricolage',     price: 95,   img: 'listing-velo.jpg',        cond: 'correct',  brand: 'milieu', age: 14, seller: 5,  views: 388,  contacts: 7,   status: 'active', featured: false },
  { slug: 'livre-honestpreface',    title: 'Collection complète Astérix (34 tomes)',cat: 'livres',        price: 110,  img: 'listing-asterix.jpg',     cond: 'bon',      brand: 'bas',    age: 20, seller: 6,  views: 1130, contacts: 42,  status: 'active', featured: false },
  { slug: 'robot-cuiseur-thermomix',title: 'Thermomix TM6',                        cat: 'electromenager',price: 680,  img: 'listing-thermomix.jpg',  cond: 'tres-bon', brand: 'haut',   age: 4,  seller: 7,  views: 2870, contacts: 97,  status: 'active', featured: true },
  { slug: 'manteau-cuir-le-vrai',   title: 'Manteau cuir Le Vrai Breton',           cat: 'vetements',    price: 145,  img: 'listing-manteau.jpg',     cond: 'tres-bon', brand: 'haut',   age: 4,  seller: 8,  views: 745,  contacts: 23,  status: 'active', featured: false },
  { slug: 'console-ps5',            title: 'PlayStation 5 + 2 manettes',            cat: 'electronique',  price: 380,  img: 'listing-ps5.jpg',         cond: 'tres-bon', brand: 'haut',   age: 4,  seller: 9,  views: 3540, contacts: 128, status: 'active', featured: true },
  { slug: 'vase-murano',            title: 'Vase Murano signé',                   cat: 'art',           price: 320,  img: 'listing-murano.jpg',      cond: 'tres-bon', brand: 'haut',   age: 25, seller: 10, views: 1980, contacts: 71,  status: 'active', featured: true },
  { slug: 'seche-cheveux-dyson',    title: 'Sèche-cheveux Dyson Supersonic',       cat: 'electromenager',price: 175,  img: 'listing-dyson.jpg',       cond: 'tres-bon', brand: 'haut',   age: 3,  seller: 11, views: 1290, contacts: 38,  status: 'active', featured: false },
];

const DESCRIPTIONS = {
  'canape-ikea-kivik': "Canapé 3 places gris clair, housses lavées à 40 degrés et retapissées l'an dernier. Structure solide, aucun trou, juste deux marques d'usure sur l'accoudoir droit. Idéal pour un salon ou une chambre d'amis.",
  'table-chene-massif': "Table à manger en chêne massif, 6 places, plateau de 4 cm. Une trace de coup de décantation sur le bord (photo 3), rien de structurel. Se démonte en 4 pièces pour le transport.",
  'lampe-articulo': "Lampe sur pied articulée des années 50, pied en fonte, restauration complète : câble neuf, douille E27, ampoule LED incluse. Fonctionne parfaitement, le bras bouge sans résistance.",
  'macbook-pro-m1': "MacBook Pro 13 pouces M1, 16 Go de RAM, 512 Go SSD. Cycle batterie 87 %, aucune rayure sur l'écran, clavier intact. Boîtier d'origine et chargeur. Facture Apple disponible.",
  'commode-laque-p60': "Commode 4 tiroirs laquée, années 60. Un éclail sur le dessus (photo 4), sinon impeccable. Tiroirs qui coulissent bien, serrures d'époque fonctionnelles.",
  'velo-ville-peugeot': "Vélo de ville Peugeot, 3 vitesses, freins V-brake révisés l'hiver dernier. Pneu arrière crevé, à changer. Cadre 56 cm, idéal de 1m65 à 1m80.",
  'livre-honestpreface': "Collection Astérix complète en 34 tomes, éditions originales. État très correct, deux couvertures cornues (Astérix chez les Pictes et le Louvre). Pas de page manquante.",
  'robot-cuiseur-thermomix': "Thermomix TM6 avec son bol, sa lame, le panier vapeur et le livre de recettes. Utilisé huit mois, jamais surchauffé. Nettoyé et désinfecté, fonctionne parfaitement.",
  'manteau-cuir-le-vrai': "Manteau en cuir de vachette, taille M, doublure laine. Porté deux saisons, patine naturelle sans aucune fissure. Doublure à remplacer à l'automne prochain, sinon parfait.",
  'console-ps5': "PlayStation 5 avec 2 manettes DualSense, un câble HDMI et un disque de 1 To. Console en excellent état, ventilateur propre, aucun grésillement. Aucun compte associé.",
  'vase-murano': "Vase en verre de Murano, signé sur la base, hauteur 32 cm. Aucun éclat, aucune craquelure, extrêmement lourd en main. Pièce de vente.",
  'seche-cheveux-dyson': "Dyson Supersonic, léger, 3 niveaux de chaleur, diffuseur complet. Fonctionne parfaitement, aucun cheveu dans le filtre. Boîte et facture incluses.",
};


/* ------------------------------------------------------------------ */
async function main() {
  const url = readUrl();
  if (!url) { console.error('DATABASE_URL introuvable.'); process.exit(1); }
  const sql = neon(url);

  console.log('→ Nettoyage des données de démonstration…');
  await sql.query(`TRUNCATE users, listings, listing_photos, wishlists, conversations,
    messages, transactions, reviews, appointments, reports, ai_estimates,
    chatbot_flows, chatbot_logs, admin_audit_log RESTART IDENTITY CASCADE`);

  /* ---- Vendeurs ---- */
  console.log('→ 12 vendeurs…');
  const sellerIds = [];
  for (const s of SELLERS) {
    const r = rowsOf(await sql.query(
      `INSERT INTO users (email, phone, display_name, city, tier, kyc_status, kyc_verified_at,
                          trust_score, rating, sales_count, purchases_count, created_at,
                          password_hash, pro_plan, pro_activated_at, response_time_min)
       VALUES ($1,$2,$3,$4,$5::user_tier,'approved', now() - interval '400 days',
               $6,$7,$8,$9, now() - interval '400 days', $10, $11, now() - interval '120 days', $12)
       RETURNING id`,
      [s.email, '+3360000' + String(sellerIds.length + 1).padStart(4, '0'), s.name, s.city,
       s.tier, s.trust, s.rating, s.sales, s.purchases,
       hashPassword(DEMO_PASSWORD), s.tier === 'pro' || s.tier === 'premium' ? 'pro' : null,
       12 + (s.trust % 30)]));
    sellerIds.push(r[0].id);
  }

  /* ---- Annonces ---- */
  console.log('→ 12 annonces + photos…');
  const listingIds = [];
  for (const l of LISTINGS) {
    const est = Math.round(l.price * 0.82);
    const estHi = Math.round(l.price * 1.24);
    const r = rowsOf(await sql.query(
      `INSERT INTO listings (seller_id, slug, title, description, category, condition,
                             brand_tier, age_years, price, original_price, status,
                             ai_estimate_low, ai_estimate_high, ai_confidence,
                             city, views, contacts, is_featured, published_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::listing_condition,$7,$8,$9,$10,$11::listing_status,
               $12,$13,$14,$15,$16,$17,$18, now() - interval '12 days', now() - interval '14 days')
       RETURNING id`,
      [sellerIds[l.seller], l.slug, l.title, DESCRIPTIONS[l.slug] || l.title,
       l.cat, l.cond, l.brand, l.age, l.price, Math.round(l.price * 1.9), l.status,
       est, estHi, 72 + (SELLERS[l.seller].trust % 20),
       SELLERS[l.seller].city, l.views, l.contacts, l.featured]));
    const id = r[0].id;
    listingIds.push(id);
    await sql.query(
      `INSERT INTO listing_photos (listing_id, url, position, width, height, moderation)
       VALUES ($1,$2,0,1600,1200,'approved')`,
      [id, '/assets/img/' + l.img]);
    // Estimation IA journalisée
    await sql.query(
      `INSERT INTO ai_estimates (listing_id, user_id, photo_url, detected_category,
         detected_condition, detected_brand, estimate_low, estimate_high, confidence,
         final_price, latency_ms, model_version, created_at)
       VALUES ($1,$2,$3,$4,$5::listing_condition,$6,$7,$8,$9,$10,$11,'mv-estimate-v3', now() - interval '14 days')`,
      [id, sellerIds[l.seller], '/assets/img/' + l.img, l.cat, l.cond, l.brand,
       est, estHi, 72 + (SELLERS[l.seller].trust % 20), l.price, 840 + (l.views % 600)]);
  }

  /* ---- Transactions en séquestre ---- */
  console.log('→ Transactions, avis, rendez-vous…');
  const statuses = ['paid', 'escrow', 'shipped', 'received', 'pending'];
  for (let i = 0; i < 18; i++) {
    const li = i % listingIds.length;
    const sellerIdx = LISTINGS[li].seller;
    const buyerIdx = (sellerIdx + 1 + (i % 5)) % SELLERS.length;
    if (buyerIdx === sellerIdx) continue;
    const amount = LISTINGS[li].price;
    const commission = Math.round(amount * 0.08 * 100) / 100;
    const st = statuses[i % statuses.length];
    const days = i % 28 + 1;
    const tr = rowsOf(await sql.query(
      `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, commission,
         commission_pct, status, escrow_provider, escrow_ref, insurance_pct, created_at)
       VALUES ($1,$2,$3,$4,$5,8,$6::transaction_status,'mangopay',$7,0.6, now() - interval '${days} days')
       RETURNING id`,
      [listingIds[li], sellerIds[buyerIdx], sellerIds[sellerIdx], amount, commission, st,
       'ESC-' + (10000 + i)]));
    // Avis
    if (st === 'paid') {
      const rd = i % 28 + 2;
      await sql.query(
        `INSERT INTO reviews (transaction_id, author_id, subject_id, rating, body, created_at)
         VALUES ($1,$2,$3,$4,$5, now() - interval '${rd} days')
         ON CONFLICT DO NOTHING`,
        [tr[0].id, sellerIds[buyerIdx], sellerIds[sellerIdx], 4 + (i % 2),
         'Objet conforme à la description, remise rapide et soignée.']);
    }
  }

  /* ---- Conversations ---- */
  console.log('→ Conversations et messages…');
  for (let i = 0; i < 6; i++) {
    const li = i % listingIds.length;
    const buyerIdx = (LISTINGS[li].seller + 3) % SELLERS.length;
    const hrs = i * 3 + 1;
    const cv = rowsOf(await sql.query(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id, channel, status, handled_by, last_message_at)
       VALUES ($1,$2,$3,$4,'open',$5, now() - interval '${hrs} hours')
       RETURNING id`,
      [listingIds[li], sellerIds[buyerIdx], sellerIds[LISTINGS[li].seller],
       i % 2 ? 'web' : 'whatsapp', i % 3 === 0 ? 'bot' : 'human']));
    const h1 = i * 3 + 1;
    await sql.query(
      `INSERT INTO messages (conversation_id, sender, body, intent, is_read, created_at)
       VALUES ($1,'user',$2,'buy',TRUE, now() - interval '${h1} hours')`,
      [cv[0].id, 'Bonjour, est-ce que l\'objet est toujours disponible ?']);
    const h2 = i * 3;
    await sql.query(
      `INSERT INTO messages (conversation_id, sender, body, intent, is_read, created_at)
       VALUES ($1,$2,$3,$4,TRUE, now() - interval '${h2} hours')`,
      [cv[0].id, i % 3 === 0 ? 'bot' : 'user',
       i % 3 === 0 ? 'Oui, il est toujours disponible. Souhaitez-vous une estimation de livraison ?'
                  : 'Bonjour, oui il est disponible. Je peux vous envoyer des photos supplémentaires si besoin.',
       'estimate']);
  }

  /* ---- Flux chatbot ---- */
  console.log('→ Flux chatbot…');
  await sql.query(
    `INSERT INTO chatbot_flows (name, version, is_active, traffic_split, definition, created_at)
     VALUES ($1,1,TRUE,100,$2::jsonb, now())`,
    ['Accueil — estimation et confiance', JSON.stringify({
      entry: 'bienvenue',
      nodes: {
        bienvenue: { type: 'message', text: 'Bonjour, je suis l\'assistant MaisonVide. Vous souhaitez estimer un objet, vendre, ou acheter ?', choices: ['Estimer un objet', 'Vendre', 'Acheter', 'Parler à un humain'] },
        estimation: { type: 'redirect', to: '/vendre.html' },
        vendre: { type: 'message', text: 'Photographiez votre objet, nous sortons une fourchette en 30 secondes.', choices: ['Estimer', 'En savoir plus'] },
        acheter: { type: 'message', text: 'Toutes nos annonces sont publiées par des vendeurs vérifiés. Le paiement est bloqué en séquestre jusqu\'à réception.', choices: ['Voir les annonces', 'Nos garanties'] },
        humain: { type: 'handoff', text: 'Je vous passe un médiateur. Réponse moyenne : moins de 2 minutes.' }
      }
    })]);

  /* ---- Signalement de démo ---- */
  await sql.query(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, details, status, created_at)
     VALUES ($1,'listing',$2,'photos_volées',
             'Mêmes photos que deux annonces actives sur un autre site, avec un logo dans le coin.',
             'reviewing', now() - interval '3 days')`,
    [sellerIds[3], listingIds[6]]);

  /* ---- Vérification ---- */
  const t = rowsOf(await sql.query(`SELECT count(*)::int AS n FROM listings`));
  const u = rowsOf(await sql.query(`SELECT count(*)::int AS n FROM users`));
  const tx = rowsOf(await sql.query(`SELECT count(*)::int AS n FROM transactions`));
  const ai = rowsOf(await sql.query(`SELECT count(*)::int AS n FROM ai_estimates`));
  const rv = rowsOf(await sql.query(`SELECT count(*)::int AS n FROM reviews`));
  console.log(`\n✓ ${u[0].n} vendeurs · ${t[0].n} annonces · ${tx[0].n} transactions · ${ai[0].n} estimations IA · ${rv[0].n} avis`);
}

main().catch(e => { console.error(e); process.exit(1); });
