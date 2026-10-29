/* ==========================================================================
   MaisonVide — API Espace Pro (Vercel / Node.js)
   GET /api/pro   (Authorization: Bearer)
   Tableau de bord vendeur : KPI, annonces, leads, transactions, séquestre,
   rendez-vous, créneaux, séries mensuelles. Données réelles lues dans Neon.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const rowsOf = r => (Array.isArray(r) ? r : (r && r.rows) || []);

const { verifyToken, bearer, cors, publicUser } = require('./_auth');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });
  const sql = neon(url);

  const payload = verifyToken(bearer(req));
  if (!payload) return res.status(401).json({ error: 'Connectez-vous pour ouvrir votre espace pro.' });

  try {
    const me = await sql.query(
      `SELECT id, email, phone, display_name, city, tier, trust_score, rating,
              kyc_status, sales_count, pro_plan, pro_activated_at, response_time_min, created_at
       FROM users WHERE id = $1`, [payload.sub]);
    const user = rowsOf(me)[0];
    if (!user) return res.status(404).json({ error: 'Compte introuvable.' });

    const [kpi, listings, leads, appts, txs, slots, series] = await Promise.all([
      sql.query(`SELECT * FROM v_pro_dashboard WHERE seller_id = $1`, [payload.sub]),
      sql.query(
        `SELECT l.id, l.title, l.slug, l.price, l.status, l.views, l.contacts,
                l.published_at, l.category, l.is_featured,
                (SELECT url FROM listing_photos p WHERE p.listing_id = l.id ORDER BY p.position LIMIT 1) AS photo
         FROM listings l WHERE l.seller_id = $1
         ORDER BY l.created_at DESC LIMIT 40`, [payload.sub]),
      sql.query(
        `SELECT c.id, c.channel, c.status, c.handled_by, c.last_message_at, c.created_at,
                l.title AS listing_title, l.slug AS listing_slug,
                u.display_name AS buyer_name,
                (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_body
         FROM conversations c
         LEFT JOIN listings l ON l.id = c.listing_id
         LEFT JOIN users u    ON u.id = c.buyer_id
         WHERE c.seller_id = $1
         ORDER BY c.last_message_at DESC LIMIT 25`, [payload.sub]),
      sql.query(
        `SELECT a.id, a.starts_at, a.ends_at, a.status, a.mode, a.meeting_place, a.meeting_note,
                a.duration_minutes, a.created_at,
                l.title AS listing_title, l.slug AS listing_slug,
                u.display_name AS buyer_name
         FROM appointments a
         JOIN listings l ON l.id = a.listing_id
         JOIN users u    ON u.id = a.buyer_id
         WHERE a.seller_id = $1
         ORDER BY a.starts_at DESC LIMIT 40`, [payload.sub]),
      sql.query(
        `SELECT t.id, t.amount, t.commission, t.commission_pct, t.status, t.created_at,
                t.paid_at, t.escrow_ref, l.title AS listing_title, l.slug AS listing_slug
         FROM transactions t JOIN listings l ON l.id = t.listing_id
         WHERE t.seller_id = $1 ORDER BY t.created_at DESC LIMIT 30`, [payload.sub]),
      sql.query(
        `SELECT id, weekday, start_minute, end_minute, slot_minutes, is_active
         FROM availability_slots WHERE seller_id = $1 ORDER BY weekday, start_minute`, [payload.sub]),
      sql.query(
        `SELECT to_char(date_trunc('month', l.created_at), 'YYYY-MM') AS month,
                COALESCE(sum(l.views), 0)::int AS views,
                COALESCE(sum(l.contacts), 0)::int AS contacts,
                count(*)::int AS published
         FROM listings l WHERE l.seller_id = $1 AND l.created_at > now() - interval '8 months'
         GROUP BY 1 ORDER BY 1`, [payload.sub]),
    ]);

    const k = rowsOf(kpi)[0] || {};
    const revenueSeries = await sql.query(
      `SELECT to_char(date_trunc('month', t.created_at), 'YYYY-MM') AS month,
              COALESCE(sum(t.amount), 0)::numeric AS amount,
              count(*)::int AS n
       FROM transactions t WHERE t.seller_id = $1 AND t.created_at > now() - interval '8 months'
       GROUP BY 1 ORDER BY 1`, [payload.sub]);

    const esc = rowsOf(txs).filter(t => t.status === 'escrow');
    const escrowAmount = esc.reduce((a, t) => a + Number(t.amount || 0), 0);

    return res.status(200).json({
      ok: true,
      source: 'neon',
      profile: {
        ...publicUser(user),
        plan: user.pro_plan,
        activatedAt: user.pro_activated_at,
        responseTimeMin: user.response_time_min,
        memberSince: user.created_at,
      },
      kpis: {
        listingsTotal: k.listings_total || 0,
        listingsActive: k.listings_active || 0,
        views: k.views || 0,
        contacts: k.contacts || 0,
        revenue: Number(k.revenue || 0),
        pipeline: Number(k.pipeline || 0),
        commission: Number(k.commission || 0),
        conversations: k.conversations || 0,
        conversationsOpen: k.conversations_open || 0,
        appointments: k.appointments || 0,
        appointmentsPending: k.appointments_pending || 0,
        escrowAmount,
        escrowCount: esc.length,
        salesCount: k.sales_count || 0,
        trustScore: k.trust_score || 0,
        rating: Number(k.rating || 0),
        responseTimeMin: user.response_time_min || 0,
        slots: k.slots || 0,
      },
      listings: rowsOf(listings).map(r => ({
        id: r.id, title: r.title, slug: r.slug, price: Number(r.price),
        status: r.status, views: r.views, contacts: r.contacts,
        publishedAt: r.published_at, category: r.category, featured: r.is_featured, photo: r.photo,
      })),
      leads: rowsOf(leads).map(r => ({
        id: r.id, channel: r.channel, status: r.status, handledBy: r.handled_by,
        lastMessageAt: r.last_message_at, createdAt: r.created_at,
        listingTitle: r.listing_title, listingSlug: r.listing_slug,
        buyerName: r.buyer_name, lastBody: r.last_body,
      })),
      appointments: rowsOf(appts).map(r => ({
        id: r.id, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, mode: r.mode,
        place: r.meeting_place, note: r.meeting_note, durationMinutes: r.duration_minutes,
        createdAt: r.created_at, listingTitle: r.listing_title, listingSlug: r.listing_slug,
        buyerName: r.buyer_name,
      })),
      transactions: rowsOf(txs).map(r => ({
        id: r.id, amount: Number(r.amount), commission: Number(r.commission),
        commissionPct: Number(r.commission_pct), status: r.status, createdAt: r.created_at,
        paidAt: r.paid_at, escrowRef: r.escrow_ref,
        listingTitle: r.listing_title, listingSlug: r.listing_slug,
      })),
      slots: rowsOf(slots).map(r => ({
        id: r.id, weekday: r.weekday, startMinute: r.start_minute,
        endMinute: r.end_minute, slotMinutes: r.slot_minutes, active: r.is_active,
      })),
      series: mergeSeries(rowsOf(series), rowsOf(revenueSeries)),
    });
  } catch (e) {
    return res.status(500).json({ error: 'Lecture impossible', detail: e.message });
  }
};

/* Fusionne les deux séries (annonces / transactions) sur les mêmes mois. */
function mergeSeries(listings, txs) {
  const map = new Map();
  const get = m => {
    if (!map.has(m)) map.set(m, { month: m, views: 0, contacts: 0, published: 0, revenue: 0, sales: 0 });
    return map.get(m);
  };
  listings.forEach(r => {
    const o = get(r.month);
    o.views = r.views; o.contacts = r.contacts; o.published = r.published;
  });
  txs.forEach(r => {
    const o = get(r.month);
    o.revenue = Number(r.amount || 0); o.sales = r.n;
  });
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}
