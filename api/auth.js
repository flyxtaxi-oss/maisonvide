/* ==========================================================================
   MaisonVide — API Auth (Vercel / Node.js)
   POST /api/auth
     { action: 'login',    email, password }  → jeton + profil
     { action: 'register', name, email, password, phone }
   GET  /api/auth  (Authorization: Bearer) → profil courant
   Les mots de passe sont stockés hachés (scrypt) dans users.password_hash.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const rowsOf = r => (Array.isArray(r) ? r : (r && r.rows) || []);

const { hashPassword, verifyPassword, signToken, verifyToken, bearer, cors, readBody, publicUser, TOKEN_TTL } = require('./_auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });
  const sql = neon(url);

  const fail = (code, message) => res.status(code).json({ error: message });

  try {
    /* ---------------- GET : profil courant ---------------- */
    if (req.method === 'GET') {
      const payload = verifyToken(bearer(req));
      if (!payload) return fail(401, 'Session expirée ou absente.');
      const rows = await sql.query(
        `SELECT id, email, phone, display_name, city, tier, trust_score, rating, kyc_status, sales_count
         FROM users WHERE id = $1`, [payload.sub]);
      const u = rowsOf(rows)[0];
      if (!u) return fail(404, 'Compte introuvable.');
      return res.status(200).json({ ok: true, user: publicUser(u) });
    }

    if (req.method !== 'POST') return fail(405, 'Méthode non autorisée');

    const body = await readBody(req);
    const action = body.action || 'login';

    /* ---------------- REGISTER ---------------- */
    if (action === 'register') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const phone = String(body.phone || '').trim();

      if (name.length < 2) return fail(400, 'Indiquez votre nom.');
      if (!EMAIL_RE.test(email)) return fail(400, 'Adresse e-mail invalide.');
      if (password.length < 8) return fail(400, 'Le mot de passe doit contenir au moins 8 caractères.');

      const existing = rowsOf(await sql.query(`SELECT id FROM users WHERE lower(email) = $1`, [email]));
      if (existing.length) return fail(409, 'Un compte existe déjà avec cet e-mail.');

      const inserted = await sql.query(
        `INSERT INTO users (email, phone, display_name, tier, kyc_status, trust_score, rating, city)
         VALUES ($1, $2, $3, 'basic', 'pending', 50, 0, $4)
         RETURNING id, email, phone, display_name, city, tier, trust_score, rating, kyc_status, sales_count`,
        [email, phone || null, name, String(body.city || '').trim() || null]);

      const u = rowsOf(inserted)[0];
      const token = signToken({ sub: u.id, email: u.email, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL });
      return res.status(201).json({ ok: true, token, user: publicUser(u) });
    }

    /* ---------------- LOGIN ---------------- */
    if (action === 'login') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!email || !password) return fail(400, 'E-mail et mot de passe requis.');

      const rows = await sql.query(
        `SELECT id, email, phone, display_name, city, tier, trust_score, rating, kyc_status, sales_count,
                password_hash, is_banned, ban_reason
         FROM users WHERE lower(email) = $1`, [email]);
      const u = rowsOf(rows)[0];

      // Message identique dans tous les cas : pas d'énumération de comptes.
      // ATTENTION : la réponse ne doit être envoyée qu'au moment de l'échec —
      // l'envoyer ici enverrait un 401 avant même la vérification.
      const generic = () => fail(401, 'E-mail ou mot de passe incorrect.');
      if (!u) return generic();
      if (u.is_banned) return fail(403, u.ban_reason || 'Ce compte est suspendu.');
      if (!u.password_hash) return generic();
      if (!verifyPassword(password, u.password_hash)) return generic();

      const token = signToken({ sub: u.id, email: u.email, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL });
      return res.status(200).json({ ok: true, token, user: publicUser(u) });
    }

    return fail(400, 'Action inconnue.');
  } catch (e) {
    return res.status(500).json({ error: 'Requête impossible', detail: e.message });
  }
};
