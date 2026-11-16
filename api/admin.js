/* ==========================================================================
   MaisonVide — Relevé de l'espace pro (lecture seule)
   GET /api/admin
   Les pages admin affichent les mêmes lignes que le site public et
   l'espace vendeur. Aucun secret : pas de hash, pas de jeton.
   Les adresses sont masquées (démonstration).
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');

const rowsOf = r => (Array.isArray(r) ? r : (r && r.rows) || []);

const CATS = {
  mobilier: 'Mobilier',
  electronique: 'Électronique',
  electromenager: 'Électroménager',
  decoration: 'Décoration',
  art: 'Art',
  livres: 'Livres',
  vetements: 'Vêtements',
  bricolage: 'Bricolage',
};

const CAT_COLOR = {
  mobilier: 'var(--kraft-500)',
  electronique: 'var(--stamp-500)',
  electromenager: 'var(--seal-500)',
  decoration: 'var(--kraft-700)',
  art: 'var(--ink-500)',
  livres: 'var(--info-500)',
  vetements: 'var(--warn-500)',
  bricolage: 'var(--ink-400)',
};

const TX_LABEL = {
  pending: 'En attente',
  escrow: 'En séquestre',
  shipped: 'En livraison',
  received: 'Validé',
  paid: 'Versé',
  disputed: 'Litige',
  cancelled: 'Annulée',
  refunded: 'Remboursé',
};

function maskEmail(email) {
  const [user, host] = String(email || '').split('@');
  if (!user || !host) return '—';
  const head = user.slice(0, Math.min(3, user.length));
  return head + '…@' + host;
}

function euro(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('fr-FR') + ' €';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });

  const sql = neon(url);
  const q = async (text) => rowsOf(await sql.query(text));

  try {
    const [
      listingRows, userRows, txRows, convRows, aiRows, escrowRows,
      weekRows, catRows, cityRows, leadRows, responseRows, reportRows,
    ] = await Promise.all([
      q(`SELECT l.slug, l.title, l.category, l.city, l.price::float AS price,
                l.status, COALESCE(l.ai_confidence, 0)::int AS conf,
                l.views, l.contacts,
                u.display_name AS seller,
                to_char(COALESCE(l.published_at, l.created_at) AT TIME ZONE 'Europe/Paris', 'DD/MM') AS day
         FROM listings l JOIN users u ON u.id = l.seller_id
         ORDER BY l.price DESC`),
      q(`SELECT display_name, email, city, tier, trust_score::int AS trust,
                rating::float AS rating, sales_count::int AS sales,
                kyc_status, is_banned,
                COALESCE(response_time_min, 0)::int AS response_min,
                to_char(created_at AT TIME ZONE 'Europe/Paris', 'MM/YYYY') AS inscrit,
                (SELECT count(*)::int FROM listings WHERE seller_id = users.id) AS ads
         FROM users ORDER BY trust_score DESC`),
      q(`SELECT substring(t.id::text, 1, 8) AS ref, l.title,
                s.display_name AS seller, b.display_name AS buyer,
                t.amount::float AS amount, t.commission::float AS commission,
                t.status,
                to_char(t.created_at AT TIME ZONE 'Europe/Paris', 'DD/MM') AS day
         FROM transactions t
         JOIN listings l ON l.id = t.listing_id
         JOIN users s ON s.id = t.seller_id
         JOIN users b ON b.id = t.buyer_id
         ORDER BY t.created_at DESC
         LIMIT 40`),
      q(`SELECT b.display_name AS buyer, s.display_name AS seller, l.title,
                c.channel, c.status, c.handled_by,
                (SELECT body FROM messages m WHERE m.conversation_id = c.id
                 ORDER BY m.created_at DESC LIMIT 1) AS preview,
                to_char(c.last_message_at AT TIME ZONE 'Europe/Paris', 'DD/MM HH24:MI') AS when_label
         FROM conversations c
         LEFT JOIN users b ON b.id = c.buyer_id
         LEFT JOIN users s ON s.id = c.seller_id
         LEFT JOIN listings l ON l.id = c.listing_id
         ORDER BY c.last_message_at DESC
         LIMIT 12`),
      q(`SELECT COALESCE(l.title, a.detected_category, 'estimation') AS title,
                COALESCE(a.detected_category, l.category, '—') AS category,
                COALESCE(a.detected_condition::text, '—') AS condition,
                COALESCE(a.detected_brand, '—') AS brand,
                a.estimate_low::float AS low, a.estimate_high::float AS high,
                a.final_price::float AS final_price,
                COALESCE(a.confidence, 0)::int AS conf,
                COALESCE(a.latency_ms, 0)::int AS latency_ms,
                COALESCE(a.model_version, 'mv-estimate') AS model
         FROM ai_estimates a
         LEFT JOIN listings l ON l.id = a.listing_id
         ORDER BY a.created_at DESC
         LIMIT 12`),
      q(`SELECT status, count(*)::int AS n, COALESCE(sum(amount),0)::float AS amount
         FROM transactions GROUP BY status`),
      q(`SELECT to_char(date_trunc('week', created_at), 'DD/MM') AS label,
                sum(amount)::float AS value
         FROM transactions
         WHERE status IN ('paid','received')
         GROUP BY date_trunc('week', created_at)
         ORDER BY date_trunc('week', created_at)`),
      q(`SELECT l.category, COALESCE(sum(t.amount),0)::float AS amount
         FROM transactions t JOIN listings l ON l.id = t.listing_id
         GROUP BY l.category ORDER BY amount DESC`),
      q(`SELECT COALESCE(l.city, '—') AS city, COALESCE(sum(t.amount),0)::float AS amount
         FROM transactions t JOIN listings l ON l.id = t.listing_id
         GROUP BY l.city ORDER BY amount DESC LIMIT 6`),
      q(`SELECT count(*)::int AS n FROM admin_audit_log WHERE action = 'contact_lead'`),
      q(`SELECT round(avg(response_time_min))::int AS avg_min
         FROM users WHERE response_time_min IS NOT NULL`),
      q(`SELECT count(*)::int AS n FROM reports WHERE status <> 'dismissed'`),
    ]);

    const byStatus = {};
    escrowRows.forEach(r => { byStatus[r.status] = r; });
    const sumStatus = (keys) => keys.reduce((a, k) => a + ((byStatus[k] && byStatus[k].amount) || 0), 0);
    const countStatus = (keys) => keys.reduce((a, k) => a + ((byStatus[k] && byStatus[k].n) || 0), 0);

    const listings = listingRows.map(l => ({
      ref: String(l.slug || '').slice(0, 18),
      title: l.title,
      cat: CATS[l.category] || l.category,
      catKey: l.category,
      price: Math.round(l.price),
      seller: l.seller,
      city: l.city || '—',
      status: l.status === 'flagged' ? 'flagged' : l.status,
      conf: l.conf,
      views: l.views,
      contacts: l.contacts,
      date: l.day,
    }));

    const watch = listings
      .filter(l => l.conf < 80 || l.status === 'pending' || l.status === 'flagged')
      .slice(0, 6)
      .map(l => ({
        ref: l.ref,
        title: l.title,
        seller: l.seller,
        price: l.price,
        conf: l.conf,
        reason: l.conf < 80 ? 'Confiance du modèle sous 80 %' : 'Statut à confirmer',
        flag: l.conf < 80 ? 'À surveiller' : 'En attente',
      }));

    const txCount = escrowRows.reduce((a, r) => a + r.n, 0);
    const paid = sumStatus(['paid', 'received']);
    const escrowAmount = (byStatus.escrow && byStatus.escrow.amount) || 0;
    const escrowCount = (byStatus.escrow && byStatus.escrow.n) || 0;
    const views = listings.reduce((a, l) => a + l.views, 0);
    const contacts = listings.reduce((a, l) => a + l.contacts, 0);
    const estimates = aiRows.length;
    const sold = countStatus(['paid', 'received']);

    const funnelBase = Math.max(views, 1);
    const funnel = [
      { label: 'Vues des annonces', value: views, pct: 100, color: 'var(--ink-700)' },
      { label: 'Estimations enregistrées', value: estimates, pct: Math.round(estimates / funnelBase * 1000) / 10, color: 'var(--kraft-500)' },
      { label: 'Annonces en ligne', value: listings.length, pct: Math.round(listings.length / funnelBase * 1000) / 10, color: 'var(--kraft-700)' },
      { label: 'Contacts reçus', value: contacts, pct: Math.round(contacts / funnelBase * 1000) / 10, color: 'var(--warn-500)' },
      { label: 'Ventes encaissées', value: sold, pct: Math.round(sold / funnelBase * 1000) / 10, color: 'var(--seal-500)' },
    ];

    const escrowChart = [
      { label: 'En attente', value: countStatus(['pending']), color: 'var(--ink-300)' },
      { label: 'En séquestre', value: countStatus(['escrow']), color: 'var(--kraft-500)' },
      { label: 'En livraison', value: countStatus(['shipped']), color: 'var(--info-500)' },
      { label: 'Validé', value: countStatus(['received']), color: 'var(--seal-500)' },
      { label: 'Versé', value: countStatus(['paid']), color: 'var(--stamp-500)' },
    ];

    const initials = (name) => String(name || '?')
      .split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
    return res.status(200).json({
      ok: true,
      source: 'neon',
      metrics: {
        pending: listings.filter(l => l.status === 'pending' || l.status === 'flagged').length,
        watch: watch.length,
        escrowAmount: Math.round(escrowAmount),
        escrowCount,
        revenue: Math.round(paid),
        txCount,
        reports: (reportRows[0] && reportRows[0].n) || 0,
        leads: (leadRows[0] && leadRows[0].n) || 0,
        basket: txCount ? Math.round((escrowRows.reduce((a, r) => a + r.amount, 0)) / txCount) : 0,
        responseMin: (responseRows[0] && responseRows[0].avg_min) || null,
        users: userRows.length,
        listings: listings.length,
        openChats: convRows.filter(c => c.status === 'open').length,
      },
      listings,
      moderation: watch,
      users: userRows.map(u => ({
        name: u.display_name,
        email: maskEmail(u.email),
        city: u.city || '—',
        tier: u.tier,
        trust: u.trust,
        rating: u.rating,
        sales: u.sales,
        ads: u.ads,
        kyc: u.kyc_status,
        banned: u.is_banned,
        inscrit: u.inscrit,
      })),
      orders: txRows.map(t => ({
        ref: 'MV-' + String(t.ref).slice(0, 4).toUpperCase(),
        title: t.title,
        seller: t.seller,
        buyer: t.buyer,
        amount: Math.round(t.amount),
        commission: Math.round(t.commission * 100) / 100,
        status: t.status,
        statusLabel: TX_LABEL[t.status] || t.status,
        day: t.day,
      })),
      conversations: convRows.map(c => ({
        name: c.buyer || 'Acheteur',
        initials: initials(c.buyer),
        preview: c.preview || c.title || '—',
        time: c.when_label,
        unread: c.status === 'open' ? 1 : 0,
        state: c.handled_by === 'bot' ? 'bot' : 'human',
        phone: c.seller ? ('vendeur ' + c.seller) : '—',
        channel: (c.channel || 'web') + (c.title ? ' · ' + c.title : ''),
      })),
      activities: txRows.slice(0, 7).map(t => ({
        icon: t.status === 'paid' || t.status === 'received' ? 'banknote' : 'package',
        tone: t.status === 'paid' || t.status === 'received' ? 'seal' : 'kraft',
        text: (TX_LABEL[t.status] || t.status) + ' — ' + t.title,
        sub: t.seller + ' · ' + euro(t.amount),
        when: t.day,
      })),
      iaRows: aiRows.map(r => ({
        photo: r.title,
        cat: CATS[r.category] || r.category,
        state: r.condition,
        brand: r.brand,
        range: (r.low != null && r.high != null)
          ? (Math.round(r.low) + ' — ' + Math.round(r.high) + ' €')
          : '—',
        final: Math.round(r.final_price || 0),
        conf: r.conf,
        latency: (Math.round(r.latency_ms / 100) / 10).toLocaleString('fr-FR') + ' s',
        model: r.model,
      })),
      charts: {
        revenue: {
          labels: weekRows.map(w => w.label),
          values: weekRows.map(w => Math.round(w.value)),
        },
        categories: catRows.map(c => ({
          label: CATS[c.category] || c.category,
          value: Math.round(c.amount),
          color: CAT_COLOR[c.category] || 'var(--kraft-500)',
        })),
        cities: cityRows.map(c => ({ label: c.city, value: Math.round(c.amount) })),
        escrow: escrowChart,
        funnel,
      },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Lecture impossible', detail: e.message });
  }
};
