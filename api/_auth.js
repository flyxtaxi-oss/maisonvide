/* ==========================================================================
   MaisonVide — Auth partagée (helper)
   Les fichiers "_*" du dossier api/ ne deviennent pas des routes Vercel :
   ce module est un simple utilitaire importé par auth.js, pro.js et
   appointments.js.

   Principe : le secret ne transite JAMAIS côté navigateur. Le client reçoit
   un jeton signé (HMAC-SHA256) qu'il présente en `Authorization: Bearer`.
   Les mots de passe sont hachés avec scrypt (module natif Node, zéro
   dépendance).
   ========================================================================== */
const crypto = require('crypto');

const TOKEN_TTL = 60 * 60 * 24 * 14; // 14 jours

/* Secret de session : SESSION_SECRET si défini, sinon dérivé du
   DATABASE_URL (stable entre invocations, jamais exposé au client). */
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const base = process.env.DATABASE_URL || 'maisonvide-local-fallback';
  return crypto.createHash('sha256').update(base).digest('hex');
}

/* ---- Mots de passe ---- */
function hashPassword(password, salt) {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(password), s, 64).toString('hex');
  return `${s}:${h}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  let actual;
  try {
    actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  } catch {
    return false;
  }
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* ---- Jetons ---- */
function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret()).update(parts[0]).digest('base64url');
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false && null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---- Helpers HTTP ---- */
function bearer(req) {
  const raw = req.headers.authorization || req.headers.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim());
  return m ? m[1].trim() : null;
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function readBody(req) {
  return new Promise(resolve => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let raw = '';
    req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.display_name,
    email: u.email,
    phone: u.phone || '',
    city: u.city || '',
    tier: u.tier,
    trustScore: u.trust_score,
    rating: Number(u.rating || 0),
    kyc: u.kyc_status,
    salesCount: u.sales_count,
  };
}

module.exports = {
  TOKEN_TTL,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  bearer,
  cors,
  readBody,
  publicUser,
};
