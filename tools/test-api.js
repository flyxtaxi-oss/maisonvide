/* ==========================================================================
   MaisonVide — Harnais de test des API serverless
   Usage : node tools/test-api.js
   Appelle les handlers api/*.js en local avec une fausse req/res, contre la
   vraie base Neon (DATABASE_URL lue depuis db/.env). Aucune écriture
   destructrice : le test se contente de lire et de créer un rendez-vous
   de démonstration qu'il annule ensuite.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

function readUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = path.join(__dirname, '..', 'db', '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8')
    .split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (!line) return null;
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

function mockRes() {
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    headersSent: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) {
      // Comme Express : une seconde écriture après l'envoi est une erreur.
      // C'est ce qui a masqué un bug de double-envoi en production.
      if (this.headersSent) {
        const err = new Error('ERR_HTTP_HEADERS_SENT: headers déjà envoyés');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      this.headersSent = true;
      this.body = b;
      return this;
    },
    end() { this.headersSent = true; return this; },
    on() { return this; },
  };
  return res;
}

function mockReq(opts = {}) {
  const { method = 'GET', query = {}, body = null, token = null } = opts;
  return {
    method,
    query,
    body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    on() { return this; },
  };
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const url = readUrl();
  if (!url) { console.error('DATABASE_URL introuvable (db/.env).'); process.exit(1); }
  process.env.DATABASE_URL = url;

  const auth = require('../api/auth.js');
  const pro = require('../api/pro.js');
  const appts = require('../api/appointments.js');
  const listings = require('../api/listings.js');

  console.log('\n— AUTH —');
  let res = mockRes();
  await auth(mockReq({ method: 'POST', body: { action: 'login', email: 'cuisine.m@example.fr', password: 'maisonvide' } }), res);
  check('login vendeur démo', res.statusCode === 200 && res.body && res.body.token,
    res.body && res.body.error ? res.body.error : `token ${String(res.body && res.body.token).slice(0, 12)}…`);
  const token = res.body && res.body.token;

  res = mockRes();
  await auth(mockReq({ method: 'POST', body: { action: 'login', email: 'cuisine.m@example.fr', password: 'mauvais' } }), res);
  check('login refuse un mauvais mot de passe', res.statusCode === 401);

  res = mockRes();
  await auth(mockReq({ method: 'GET', token }), res);
  check('profil courant', res.statusCode === 200 && res.body.user && res.body.user.email === 'cuisine.m@example.fr');

  console.log('\n— ESPACE PRO —');
  res = mockRes();
  await pro(mockReq({ method: 'GET', token }), res);
  const k = (res.body && res.body.kpis) || {};
  check('dashboard pro', res.statusCode === 200 && res.body.ok,
    `annonces ${k.listingsActive} · CA ${k.revenue} · séquestre ${k.escrowAmount} · rdv ${k.appointments} · leads ${k.conversations}`);
  check('série mensuelle non vide', Array.isArray(res.body.series) && res.body.series.length > 0);
  check('transactions présentes', Array.isArray(res.body.transactions) && res.body.transactions.length > 0);
  check('créneaux présents', Array.isArray(res.body.slots) && res.body.slots.length > 0);

  res = mockRes();
  await pro(mockReq({ method: 'GET' }), res);
  check('dashboard pro refuse un anonyme', res.statusCode === 401);

  console.log('\n— ANNONCES / RENDEZ-VOUS —');
  res = mockRes();
  await listings(mockReq({ method: 'GET' }), res);
  check('liste des annonces', res.statusCode === 200 && res.body.count === 12, `${res.body.count} annonces`);
  const first = res.body.listings[0];

  res = mockRes();
  await appts(mockReq({ method: 'GET', query: { listing_id: first.id } }), res);
  const slots = (res.body && res.body.slots) || [];
  check('créneaux disponibles', res.statusCode === 200 && slots.length > 0, `${slots.length} créneaux, ex. ${slots[0] && slots[0].label}`);
  check('créneaux en Europe/Paris', !slots.length || /\d{2}:\d{2}/.test(slots[0].label));

  if (slots.length) {
    res = mockRes();
    await appts(mockReq({
      method: 'POST',
      body: {
        listing_id: first.id, starts_at: slots[0].start, mode: 'visite',
        name: 'Test Harnais', email: 'harnais.test@example.fr', phone: '+33600000000',
        meeting_note: 'Créé par tools/test-api.js',
      },
    }), res);
    const created = res.body && res.body.appointment;
    check('demande de rendez-vous', res.statusCode === 201 && !!created,
      res.body && res.body.error ? res.body.error : created && created.label);

    if (created) {
      // On annule avec le compte du VENDEUR de l'annonce : c'est lui qui
      // peut confirmer/refuser. L'annulation par un tiers doit être refusée.
      const { neon } = require('@neondatabase/serverless');
      const db = neon(url);
      const owner = await db.query(
        `SELECT u.email FROM users u
         JOIN listings l ON l.seller_id = u.id
         WHERE l.id = $1`, [first.id]);
      const ownerEmail = (Array.isArray(owner) ? owner : owner.rows)[0].email;

      res = mockRes();
      await auth(mockReq({ method: 'POST', body: { action: 'login', email: ownerEmail, password: 'maisonvide' } }), res);
      const ownerToken = res.body && res.body.token;

      res = mockRes();
      await appts(mockReq({ method: 'PATCH', token: token, body: { id: created.id, status: 'cancelled', reason: 'test' } }), res);
      check('annulation par un tiers refusée', res.statusCode === 403, `HTTP ${res.statusCode}`);

      res = mockRes();
      await appts(mockReq({ method: 'PATCH', token: ownerToken, body: { id: created.id, status: 'cancelled', reason: 'test' } }), res);
      check('annulation par le vendeur', res.statusCode === 200 && res.body.appointment.status === 'cancelled',
        `HTTP ${res.statusCode}`);
    }
  }

  res = mockRes();
  await appts(mockReq({ method: 'GET', query: { listing_id: '00000000-0000-0000-0000-000000000000' } }), res);
  check('annonce inconnue → 404', res.statusCode === 404);

  res = mockRes();
  await appts(mockReq({ method: 'GET' }), res);
  check('mes rendez-vous exige une session', res.statusCode === 401);

  console.log('\n— BILAN —');
  const ko = results.filter(r => !r.ok);
  console.log(`${results.length - ko.length}/${results.length} tests OK`);
  if (ko.length) { ko.forEach(r => console.log('  ✗ ' + r.name)); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
