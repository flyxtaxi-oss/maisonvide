/* ==========================================================================
   MaisonVide — API Serverless (Vercel / Node.js)
   GET /api/stats
   Chiffres de la plateforme lus depuis Neon (annonces, encours de séquestre,
   confiance moyenne, détections de fraude).
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });

  const sql = neon(url);
  try {
    const one = async (q) => {
      const r = await sql.query(q);
      const rows = (r && r.rows) || r || [];
      return rows[0] || {};
    };

    const [listings, escrow, users, fraud, ai, views] = await Promise.all([
      one(`SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status='active')::int AS active,
                  count(*) FILTER (WHERE status='pending')::int AS pending
           FROM listings`),
      one(`SELECT count(*)::int AS count,
                  COALESCE(sum(amount) FILTER (WHERE status='escrow'), 0)::numeric AS amount
           FROM transactions`),
      one(`SELECT count(*)::int AS total,
                  round(avg(trust_score))::int AS avg_trust,
                  count(*) FILTER (WHERE kyc_status='approved')::int AS kyc
           FROM users`),
      one(`SELECT count(*)::int AS count FROM reports WHERE status <> 'dismissed'`),
      one(`SELECT count(*)::int AS count,
                  round(avg(confidence))::int AS avg_confidence,
                  round(avg(latency_ms))::int AS avg_latency
           FROM ai_estimates`),
      one(`SELECT COALESCE(sum(views),0)::int AS views,
                  COALESCE(sum(contacts),0)::int AS contacts
           FROM listings`),
    ]);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      ok: true,
      source: 'neon',
      listings,
      escrow,
      users,
      fraud,
      ai,
      traffic: views,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Lecture impossible', detail: e.message });
  }
};
