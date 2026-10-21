/* ==========================================================================
   MaisonVide — API Serverless (Vercel / Node.js)
   GET /api/listings
   Lit les annonces depuis Neon. Aucune connection string n'est exposée
   côté navigateur : la variable DATABASE_URL vit uniquement dans
   l'environnement du serveur.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.DATABASE_URL;
  if (!url) {
    return res.status(503).json({
      error: 'Base de données non configurée',
      hint: 'Définir DATABASE_URL dans les variables d’environnement Vercel.',
    });
  }

  const sql = neon(url);
  try {
    const result = await sql.query(`
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
      WHERE l.status = 'active'
      ORDER BY l.is_featured DESC, l.published_at DESC NULLS LAST
      LIMIT 60
    `);

    const rows = (result && result.rows) || result || [];
    const listings = rows.map(r => ({
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
    }));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      source: 'neon',
      count: listings.length,
      listings,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Lecture impossible', detail: e.message });
  }
};
