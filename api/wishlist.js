/* ==========================================================================
   MaisonVide — Favoris
   GET    /api/wishlist            mes favoris (jeton)
   POST   /api/wishlist { slug }   ajouter
   POST   /api/wishlist { clear }  vider
   DELETE /api/wishlist { slug }   retirer
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const { cors, readBody, bearer, verifyToken } = require('./_auth');

const rowsOf = r => (Array.isArray(r) ? r : (r && r.rows) || []);

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });

  const session = verifyToken(bearer(req));
  if (!session) return res.status(401).json({ error: 'Connectez-vous pour vos favoris.' });

  const sql = neon(url);
  const list = async () => rowsOf(await sql.query(
    `SELECT l.slug, l.title, l.price::float AS price, l.category, l.city, l.status,
            (SELECT url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo
     FROM wishlists w
     JOIN listings l ON l.id = w.listing_id
     WHERE w.user_id = $1
     ORDER BY w.created_at DESC`,
    [session.sub]
  ));

  try {
    if (req.method === 'GET') {
      const items = await list();
      return res.status(200).json({ ok: true, slugs: items.map(i => i.slug), listings: items });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.clear) {
        await sql.query(`DELETE FROM wishlists WHERE user_id = $1`, [session.sub]);
        return res.status(200).json({ ok: true, slugs: [], listings: [] });
      }
      const slug = String(body.slug || '').trim();
      const found = rowsOf(await sql.query(`SELECT id FROM listings WHERE slug = $1`, [slug]));
      if (!found.length) return res.status(404).json({ error: 'Annonce introuvable.' });
      await sql.query(
        `INSERT INTO wishlists (user_id, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [session.sub, found[0].id]
      );
      const items = await list();
      return res.status(200).json({ ok: true, slugs: items.map(i => i.slug), listings: items });
    }

    if (req.method === 'DELETE') {
      const body = await readBody(req);
      const slug = String(body.slug || '').trim();
      await sql.query(
        `DELETE FROM wishlists w USING listings l
         WHERE w.listing_id = l.id AND w.user_id = $1 AND l.slug = $2`,
        [session.sub, slug]
      );
      const items = await list();
      return res.status(200).json({ ok: true, slugs: items.map(i => i.slug), listings: items });
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (e) {
    return res.status(500).json({ error: 'Favoris indisponibles', detail: e.message });
  }
};
