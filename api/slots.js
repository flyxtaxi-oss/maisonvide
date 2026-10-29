/* ==========================================================================
   MaisonVide — API Créneaux de disponibilité (Vercel / Node.js)
   GET    /api/slots  (Authorization: Bearer) → les créneaux du vendeur
   POST   /api/slots  (Bearer) { weekday, start_minute, end_minute, slot_minutes }
   PATCH  /api/slots  (Bearer) { id, is_active }
   DELETE /api/slots  (Bearer) { id }

   Un vendeur ne manipule que ses propres créneaux : chaque écriture est
   filtrée par seller_id, et l'appartenance est vérifiée avant mutation.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const rowsOf = r => (Array.isArray(r) ? r : (r && r.rows) || []);
const { verifyToken, bearer, cors, readBody } = require('./_auth');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });
  const sql = neon(url);

  const payload = verifyToken(bearer(req));
  if (!payload) return res.status(401).json({ error: 'Connectez-vous pour gérer vos créneaux.' });

  const fail = (code, message) => res.status(code).json({ error: message });

  try {
    /* ---------------- GET : mes créneaux ---------------- */
    if (req.method === 'GET') {
      const rows = await sql.query(
        `SELECT id, weekday, start_minute, end_minute, slot_minutes, is_active
         FROM availability_slots WHERE seller_id = $1 ORDER BY weekday, start_minute`,
        [payload.sub]);
      return res.status(200).json({ ok: true, slots: rowsOf(rows).map(shape) });
    }

    /* ---------------- POST : ajouter un créneau ---------------- */
    if (req.method === 'POST') {
      const body = await readBody(req);
      const weekday = toInt(body.weekday);
      const start = toInt(body.start_minute);
      const end = toInt(body.end_minute);
      const step = body.slot_minutes === undefined || body.slot_minutes === null
        ? 30
        : toInt(body.slot_minutes);

      if (weekday === null || weekday < 0 || weekday > 6) {
        return fail(400, 'Jour de la semaine invalide (0 = dimanche, 6 = samedi).');
      }
      if (start === null || start < 0 || start > 1439) {
        return fail(400, 'Heure de début invalide.');
      }
      if (end === null || end > 1440 || end <= start) {
        return fail(400, 'L’heure de fin doit suivre l’heure de début.');
      }
      if (step === null || step < 10 || step > 240) {
        return fail(400, 'La durée des créneaux doit être comprise entre 10 et 240 minutes.');
      }

      const inserted = await sql.query(
        `INSERT INTO availability_slots (seller_id, weekday, start_minute, end_minute, slot_minutes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, weekday, start_minute, end_minute, slot_minutes, is_active`,
        [payload.sub, weekday, start, end, step]);
      return res.status(201).json({ ok: true, slot: shape(rowsOf(inserted)[0]) });
    }

    /* ---------------- PATCH : activer / désactiver ---------------- */
    if (req.method === 'PATCH') {
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      if (!UUID_RE.test(id)) return fail(400, 'Identifiant de créneau invalide.');
      if (typeof body.is_active !== 'boolean') {
        return fail(400, 'Indiquez true pour activer le créneau, false pour le désactiver.');
      }

      const owned = await ownedSlot(sql, id, payload.sub);
      if (owned === 'missing') return fail(404, 'Créneau introuvable.');
      if (owned === 'foreign') return fail(403, 'Ce créneau ne vous appartient pas.');

      const updated = await sql.query(
        `UPDATE availability_slots SET is_active = $1
         WHERE id = $2 AND seller_id = $3
         RETURNING id, weekday, start_minute, end_minute, slot_minutes, is_active`,
        [body.is_active, id, payload.sub]);
      return res.status(200).json({ ok: true, slot: shape(rowsOf(updated)[0]) });
    }

    /* ---------------- DELETE : supprimer ---------------- */
    if (req.method === 'DELETE') {
      const body = await readBody(req);
      const id = String(body.id || '').trim();
      if (!UUID_RE.test(id)) return fail(400, 'Identifiant de créneau invalide.');

      const owned = await ownedSlot(sql, id, payload.sub);
      if (owned === 'missing') return fail(404, 'Créneau introuvable.');
      if (owned === 'foreign') return fail(403, 'Ce créneau ne vous appartient pas.');

      await sql.query(
        `DELETE FROM availability_slots WHERE id = $1 AND seller_id = $2`, [id, payload.sub]);
      return res.status(200).json({ ok: true, deleted: id });
    }

    return fail(405, 'Méthode non autorisée');
  } catch (e) {
    return res.status(500).json({ error: 'Requête impossible', detail: e.message });
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/* Vérifie l'appartenance d'un créneau : 'owned' | 'foreign' | 'missing'. */
async function ownedSlot(sql, id, sellerId) {
  const rows = await sql.query(
    `SELECT id, seller_id FROM availability_slots WHERE id = $1`, [id]);
  const slot = rowsOf(rows)[0];
  if (!slot) return 'missing';
  if (slot.seller_id !== sellerId) return 'foreign';
  return 'owned';
}

/* Entier strict : rejette '', null, NaN, 12.5 et '12abc'. */
function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

/* Même forme que celle de /api/pro, pour un rendu client homogène. */
function shape(r) {
  if (!r) return null;
  return {
    id: r.id,
    weekday: r.weekday,
    startMinute: r.start_minute,
    endMinute: r.end_minute,
    slotMinutes: r.slot_minutes,
    active: r.is_active,
  };
}
