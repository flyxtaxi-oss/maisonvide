/* ==========================================================================
   MaisonVide — API Serverless (Vercel / Node.js)
   GET  /api/listings            annonces actives
   GET  /api/listings?mine=1    mes annonces (jeton)
   POST /api/listings           déposer une annonce en attente (jeton)
   Lit et écrit Neon. Aucune connection string n'est exposée
   côté navigateur : la variable DATABASE_URL vit uniquement dans
   l'environnement du serveur.
   ========================================================================== */
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { cors, readBody, bearer, verifyToken } = require('./_auth');

const CATEGORIES = ['mobilier','decoration','livres','vaisselle','vetements','electronique','jouets','bricolage','jardin','art','bijoux','electromenager'];
const CONDITIONS = ['neuf','tres-bon','bon','correct','a-renover'];
const BRANDS = ['luxe','premium','milieu','bas','inconnue'];

function rowsOf(r) { return (Array.isArray(r) ? r : (r && r.rows) || []); }

function slugify(title) {
  const base = String(title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return (base || 'objet') + '-' + crypto.randomBytes(3).toString('hex');
}

const SELECT = `
  SELECT
    l.id, l.slug, l.title, l.description, l.category, l.condition,
    l.brand_tier, l.age_years, l.price, l.original_price, l.status,
    l.ai_estimate_low, l.ai_estimate_high, l.ai_confidence,
    l.city, l.views, l.contacts, l.is_featured, l.published_at,
    u.display_name AS seller_name, u.tier AS seller_tier,
    u.trust_score, u.rating AS seller_rating, u.sales_count,
    u.avatar_url AS seller_avatar, u.kyc_status,
    (SELECT url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo
  FROM listings l
  JOIN users u ON u.id = l.seller_id
`;

function mapRow(r) {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    category: r.category,
    condition: r.condition,
    brandTier: r.brand_tier,
    ageYears: r.age_years,
    price: Number(r.price),
    originalPrice: r.original_price == null ? null : Number(r.original_price),
    status: r.status,
    estimateLow: r.ai_estimate_low == null ? null : Number(r.ai_estimate_low),
    estimateHigh: r.ai_estimate_high == null ? null : Number(r.ai_estimate_high),
    confidence: r.ai_confidence,
    city: r.city,
    views: r.views,
    contacts: r.contacts,
    featured: r.is_featured,
    publishedAt: r.published_at,
    photo: r.photo,
    seller: {
      name: r.seller_name,
      tier: r.seller_tier,
      trustScore: r.trust_score,
      rating: Number(r.seller_rating),
      sales: r.sales_count,
      avatar: r.seller_avatar,
      kyc: r.kyc_status,
      verified: r.kyc_status === 'approved',
    },
  };
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const url = process.env.DATABASE_URL;
  if (!url) {
    return res.status(503).json({
      error: 'Base de données non configurée',
      hint: 'Définir DATABASE_URL dans les variables d’environnement Vercel.',
    });
  }

  const sql = neon(url);
  const session = verifyToken(bearer(req));

  try {
    if (req.method === 'POST') {
      if (!session) return res.status(401).json({ error: 'Connectez-vous pour déposer une annonce.' });
      const body = await readBody(req);
      const title = String(body.title || '').trim().slice(0, 140);
      const category = String(body.category || '');
      const condition = CONDITIONS.includes(body.condition) ? body.condition : 'bon';
      const brand = BRANDS.includes(body.brandTier) ? body.brandTier : 'milieu';
      const price = Math.round(Number(body.price));
      const city = String(body.city || '').trim().slice(0, 80) || null;
      const description = String(body.description || '').trim().slice(0, 4000);
      if (title.length < 3) return res.status(400).json({ error: 'Le titre est trop court.' });
      if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Catégorie inconnue.' });
      if (!Number.isFinite(price) || price < 1 || price > 100000) {
        return res.status(400).json({ error: 'Prix invalide.' });
      }
      const low = body.estimateLow == null ? null : Number(body.estimateLow);
      const high = body.estimateHigh == null ? null : Number(body.estimateHigh);
      const confidence = body.confidence == null ? null : Math.max(0, Math.min(100, Math.round(Number(body.confidence))));
      const age = Math.max(0, Math.min(80, Math.round(Number(body.ageYears) || 0)));
      const slug = slugify(title);

      const inserted = rowsOf(await sql.query(
        `INSERT INTO listings (
           seller_id, slug, title, description, category, condition, brand_tier, age_years,
           price, status, ai_estimate_low, ai_estimate_high, ai_confidence, city
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8,
           $9, 'pending', $10, $11, $12, $13
         ) RETURNING id, slug`,
        [session.sub, slug, title, description, category, condition, brand, age, price, low, high, confidence, city]
      ));
      const row = inserted[0];
      await sql.query(
        `INSERT INTO ai_estimates (
           listing_id, user_id, detected_category, detected_condition, detected_brand,
           estimate_low, estimate_high, confidence, final_price, latency_ms, model_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'mv-estimate-local')`,
        [row.id, session.sub, category, condition, brand, low, high, confidence, price, 0]
      );
      const full = rowsOf(await sql.query(SELECT + ' WHERE l.id = $1', [row.id]));
      return res.status(201).json({ ok: true, source: 'neon', listing: mapRow(full[0]) });
    }

    if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

    const mine = String((req.query && req.query.mine) || '') === '1';
    let result;
    if (mine) {
      if (!session) return res.status(401).json({ error: 'Connectez-vous pour voir vos annonces.' });
      result = await sql.query(SELECT + ' WHERE l.seller_id = $1 ORDER BY l.created_at DESC LIMIT 60', [session.sub]);
    } else {
      result = await sql.query(SELECT + ` WHERE l.status = 'active' ORDER BY l.is_featured DESC, l.published_at DESC NULLS LAST LIMIT 60`);
    }

    const listings = rowsOf(result).map(mapRow);
    if (!mine) res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, source: 'neon', count: listings.length, listings });
  } catch (e) {
    return res.status(500).json({ error: 'Lecture impossible', detail: e.message });
  }
};
