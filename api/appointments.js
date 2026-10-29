/* ==========================================================================
   MaisonVide — API Rendez-vous (Vercel / Node.js)
   GET    /api/appointments?listing_id=<uuid>   → créneaux disponibles (14 j)
   GET    /api/appointments                      → mes rendez-vous (acheteur ou vendeur)
   POST   /api/appointments                      → demander un rendez-vous
   PATCH  /api/appointments                      → confirmer / refuser / annuler

   Tous les horaires sont exprimés en heure de Paris (Europe/Paris) et
   stockés en UTC. Le fuseau est calculé sans dépendance externe.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const { verifyToken, bearer, cors, readBody } = require('./_auth');

const TZ = 'Europe/Paris';
const DAYS = 14;

/* ------------------------------------------------------------------ */
/* Fuseau : conversions heure de Paris ↔ UTC                          */
/* ------------------------------------------------------------------ */
function tzOffsetMs(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = dtf.formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second);
  return asUTC - date.getTime();
}

function parisNow() {
  const now = new Date();
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(now).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return {
    y: +p.year, mo: +p.month, d: +p.day,
    hh: (+p.hour) % 24, mi: +p.minute,
    weekday: new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay(),
  };
}

function parisToUtc(y, mo, d, hh, mi) {
  const naive = Date.UTC(y, mo - 1, d, hh, mi);
  let ts = naive - tzOffsetMs(new Date(naive));
  ts = naive - tzOffsetMs(new Date(ts));
  return new Date(ts);
}

function addDays(base, n) {
  return new Date(Date.UTC(base.y, base.mo - 1, base.d + n));
}

function fmtFr(date) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

/* ------------------------------------------------------------------ */
/* Génération des créneaux                                             */
/* ------------------------------------------------------------------ */
function buildSlots(slots, booked, from) {
  const out = [];
  const now = new Date();
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(from, d);
    const wd = day.getUTCDay();
    for (const s of slots.filter(x => x.weekday === wd && x.is_active)) {
      const step = s.slot_minutes || 30;
      for (let m = s.start_minute; m + step <= s.end_minute; m += step) {
        const start = parisToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(),
          Math.floor(m / 60), m % 60);
        if (start.getTime() <= now.getTime()) continue;
        const end = new Date(start.getTime() + step * 60000);
        const clash = booked.some(b =>
          new Date(b.starts_at).getTime() < end.getTime() &&
          new Date(b.ends_at).getTime() > start.getTime());
        if (clash) continue;
        out.push({
          start: start.toISOString(),
          end: end.toISOString(),
          label: fmtFr(start),
          durationMinutes: step,
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });
  const sql = neon(url);

  const payload = verifyToken(bearer(req));
  const fail = (code, message) => res.status(code).json({ error: message });

  try {
    /* ---------------- GET ---------------- */
    if (req.method === 'GET') {
      /* a) Créneaux d'une annonce (public) */
      const listingId = req.query && req.query.listing_id;
      if (listingId) {
        const l = await sql.query(
          `SELECT l.id, l.title, l.slug, l.city, l.delivery_mode,
                  u.id AS seller_id, u.display_name AS seller_name, u.trust_score
           FROM listings l JOIN users u ON u.id = l.seller_id
           WHERE l.id = $1 AND l.status = 'active'`, [listingId]);
        const listing = l.rows[0];
        if (!listing) return fail(404, 'Annonce introuvable.');

        const slots = await sql.query(
          `SELECT weekday, start_minute, end_minute, slot_minutes, is_active
           FROM availability_slots WHERE seller_id = $1 ORDER BY weekday, start_minute`,
          [listing.seller_id]);
        const booked = await sql.query(
          `SELECT starts_at, ends_at FROM appointments
           WHERE listing_id = $1 AND status NOT IN ('declined','cancelled')
             AND starts_at > now() - interval '1 day'`, [listingId]);

        const from = parisNow();
        return res.status(200).json({
          ok: true,
          listing: {
            id: listing.id, title: listing.title, slug: listing.slug,
            city: listing.city, deliveryMode: listing.delivery_mode,
            seller: { name: listing.seller_name, trustScore: listing.trust_score },
          },
          slots: buildSlots(slots.rows, booked.rows, from),
          timezone: TZ,
        });
      }

      /* b) Mes rendez-vous (authentifié) */
      if (!payload) return fail(401, 'Connectez-vous pour voir vos rendez-vous.');
      const mine = await sql.query(
        `SELECT a.id, a.starts_at, a.ends_at, a.status, a.mode, a.meeting_place, a.meeting_note,
                a.duration_minutes, a.created_at,
                l.title, l.slug, l.price,
                su.display_name AS seller_name, bu.display_name AS buyer_name,
                su.id AS seller_id, bu.id AS buyer_id
         FROM appointments a
         JOIN listings l ON l.id = a.listing_id
         JOIN users su  ON su.id = a.seller_id
         JOIN users bu  ON bu.id = a.buyer_id
         WHERE a.buyer_id = $1 OR a.seller_id = $1
         ORDER BY a.starts_at DESC LIMIT 100`, [payload.sub]);
      return res.status(200).json({ ok: true, appointments: mine.rows.map(shape) });
    }

    /* ---------------- POST : demander un rendez-vous ---------------- */
    if (req.method === 'POST') {
      const body = await readBody(req);
      const listingId = String(body.listing_id || '').trim();
      const startsAt = String(body.starts_at || '').trim();
      const mode = ['visite', 'remise', 'livraison'].includes(body.mode) ? body.mode : 'visite';
      const note = String(body.meeting_note || '').slice(0, 800);
      const phone = String(body.phone || '').trim();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();

      if (!listingId || !startsAt) return fail(400, 'Annonce et créneau requis.');
      const start = new Date(startsAt);
      if (isNaN(start.getTime())) return fail(400, 'Créneau invalide.');
      if (start.getTime() < Date.now() - 60000) return fail(400, 'Ce créneau est déjà passé.');

      const l = await sql.query(
        `SELECT l.id, l.title, l.slug, l.city, l.seller_id, u.display_name AS seller_name
         FROM listings l JOIN users u ON u.id = l.seller_id
         WHERE l.id = $1 AND l.status = 'active'`, [listingId]);
      const listing = l.rows[0];
      if (!listing) return fail(404, 'Annonce introuvable ou déjà vendue.');

      /* Vendeur authentifié = action légitime sur sa propre annonce */
      const isSeller = payload && payload.sub === listing.seller_id;

      /* Résolution de l'acheteur : session connue, sinon compte visiteur */
      let buyerId = payload ? payload.sub : null;
      if (!buyerId) {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
          return fail(400, 'Indiquez un e-mail valide pour confirmer le rendez-vous.');
        }
        const found = await sql.query(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
        if (found.rows.length) {
          buyerId = found.rows[0].id;
        } else {
          const created = await sql.query(
            `INSERT INTO users (email, phone, display_name, tier, kyc_status, trust_score, rating)
             VALUES ($1, $2, $3, 'basic', 'pending', 50, 0) RETURNING id`,
            [email, phone || null, name || email.split('@')[0]]);
          buyerId = created.rows[0].id;
        }
      }

      /* Contrôle du créneau : dans les disponibilités du vendeur, sans conflit */
      const slots = await sql.query(
        `SELECT weekday, start_minute, end_minute, slot_minutes, is_active
         FROM availability_slots WHERE seller_id = $1 AND is_active`, [listing.seller_id]);
      const booked = await sql.query(
        `SELECT starts_at, ends_at FROM appointments
         WHERE listing_id = $1 AND status NOT IN ('declined','cancelled')`, [listingId]);
      const available = buildSlots(slots.rows, booked.rows, parisNow());
      const ok = available.some(s => new Date(s.start).getTime() === start.getTime());
      if (!ok && !isSeller) return fail(409, 'Ce créneau vient d’être pris. Choisissez-en un autre.');

      const end = new Date(start.getTime() + 30 * 60000);

      const inserted = await sql.query(
        `INSERT INTO appointments (listing_id, buyer_id, seller_id, starts_at, ends_at,
                                   status, meeting_place, meeting_note, mode, duration_minutes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id, starts_at, ends_at, status, mode, meeting_place, meeting_note, duration_minutes, created_at`,
        [listingId, buyerId, listing.seller_id, start.toISOString(), end.toISOString(),
         'requested', listing.city || null, note || null, mode, 30]);

      /* La demande devient un lead visible par le vendeur */
      const cv = await sql.query(
        `INSERT INTO conversations (listing_id, buyer_id, seller_id, channel, status, handled_by)
         VALUES ($1,$2,$3,'web','open','human') RETURNING id`,
        [listingId, buyerId, listing.seller_id]);
      await sql.query(
        `INSERT INTO messages (conversation_id, sender, body, intent)
         VALUES ($1,'user',$2,'pro')`,
        [cv.rows[0].id,
         `Demande de rendez-vous — ${mode} le ${fmtFr(start)}. ${note || ''}`.trim()]);
      await sql.query(`UPDATE listings SET contacts = contacts + 1 WHERE id = $1`, [listingId]);

      const full = await sql.query(
        `SELECT a.id, a.starts_at, a.ends_at, a.status, a.mode, a.meeting_place, a.meeting_note,
                a.duration_minutes, a.created_at, l.title, l.slug, l.price,
                su.display_name AS seller_name, bu.display_name AS buyer_name,
                su.id AS seller_id, bu.id AS buyer_id
         FROM appointments a
         JOIN listings l ON l.id = a.listing_id
         JOIN users su  ON su.id = a.seller_id
         JOIN users bu  ON bu.id = a.buyer_id
         WHERE a.id = $1`, [inserted.rows[0].id]);

      return res.status(201).json({
        ok: true,
        appointment: shape(full.rows[0]),
        message: 'Demande envoyée. Le vendeur confirme sous 2 h.',
      });
    }

    /* ---------------- PATCH : confirmer / refuser / annuler ---------------- */
    if (req.method === 'PATCH') {
      if (!payload) return fail(401, 'Connectez-vous pour gérer un rendez-vous.');
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      const status = String(body.status || '').trim();
      const allowed = ['confirmed', 'declined', 'cancelled', 'done'];
      if (!id || !allowed.includes(status)) return fail(400, 'Statut invalide.');

      const cur = await sql.query(
        `SELECT id, seller_id, buyer_id, status FROM appointments WHERE id = $1`, [id]);
      const appt = cur.rows[0];
      if (!appt) return fail(404, 'Rendez-vous introuvable.');

      const isSeller = appt.seller_id === payload.sub;
      const isBuyer = appt.buyer_id === payload.sub;
      if (!isSeller && !isBuyer) return fail(403, 'Ce rendez-vous ne vous appartient pas.');
      if (isBuyer && !['cancelled'].includes(status)) {
        return fail(403, 'L’acheteur peut uniquement annuler son rendez-vous.');
      }
      if (isSeller && !isBuyer && status === 'cancelled') {
        return fail(403, 'L’annulation vendeur passe par « refusé ».');
      }

      const updated = await sql.query(
        `UPDATE appointments SET status = $1, cancel_reason = $2 WHERE id = $3
         RETURNING id, starts_at, ends_at, status, mode, meeting_place, meeting_note,
                   duration_minutes, created_at`,
        [status, body.reason || null, id]);
      return res.status(200).json({ ok: true, appointment: updated.rows[0] });
    }

    return fail(405, 'Méthode non autorisée');
  } catch (e) {
    return res.status(500).json({ error: 'Requête impossible', detail: e.message });
  }
};

/* ------------------------------------------------------------------ */
function shape(r) {
  if (!r) return null;
  return {
    id: r.id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    mode: r.mode,
    place: r.meeting_place,
    note: r.meeting_note,
    durationMinutes: r.duration_minutes,
    createdAt: r.created_at,
    label: fmtFr(r.starts_at),
    listing: { title: r.title, slug: r.slug, price: Number(r.price || 0) },
    seller: { id: r.seller_id, name: r.seller_name },
    buyer: { id: r.buyer_id, name: r.buyer_name },
  };
}
