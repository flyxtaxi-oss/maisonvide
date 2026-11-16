/* ==========================================================================
   MaisonVide — Messages du formulaire de contact
   POST /api/leads
     { name, email, phone, subject, message, consent }
   Le message est conservé dans admin_audit_log (action contact_lead).
   Aucune nouvelle table : le carnet d'audit existe déjà.
   ========================================================================== */
const { neon } = require('@neondatabase/serverless');
const { cors, readBody } = require('./_auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUBJECTS = {
  estimation: 'Estimer un objet',
  vendre: 'Vendre beaucoup',
  guide: 'Formule Guidé',
  devis: 'Formule Pro — devis',
  litige: 'Un litige',
  autre: 'Autre chose',
};

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const url = process.env.DATABASE_URL;
  if (!url) return res.status(503).json({ error: 'Base de données non configurée' });

  const body = await readBody(req);
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 30);
  const subject = SUBJECTS[body.subject] ? body.subject : 'autre';
  const message = clean(body.message, 4000);

  if (!name || !EMAIL_RE.test(email) || message.length < 8) {
    return res.status(400).json({ error: 'Nom, e-mail valide et message (8 caractères) sont requis.' });
  }
  if (!body.consent) {
    return res.status(400).json({ error: 'L’accord de conservation est requis.' });
  }

  const sql = neon(url);
  try {
    await sql.query(
      `INSERT INTO admin_audit_log (action, target_type, payload)
       VALUES ('contact_lead', 'lead', $1::jsonb)`,
      [JSON.stringify({
        name,
        email,
        phone,
        subject,
        subject_label: SUBJECTS[subject],
        message,
      })]
    );
    return res.status(201).json({ ok: true, source: 'neon' });
  } catch (e) {
    return res.status(500).json({ error: 'Enregistrement impossible', detail: e.message });
  }
};
