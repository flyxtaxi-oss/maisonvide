/* ==========================================================================
   MaisonVide — Enrichissement du compte vendeur de démonstration
   Usage : node db/seed-pro.js   (après db/seed.js puis db/seed-appts.js)

   Le tableau de bord « espace pro » a besoin de matière : un vendeur avec
   un vrai historique — chiffre d'affaires encaissé, encours de séquestre,
   leads, rendez-vous passés et à venir, créneaux larges.

   On enrichit le compte pro designated par SELLER_EMAIL sans toucher aux
   12 annonces actives (le catalogue et les chiffres publiés restent
   cohérents). Idempotent : les lignes du vendeur sont remplacées.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const SELLER_EMAIL = 'cuisine.m@example.fr';

function readUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return null;
  const line = fs.readFileSync(envPath, 'utf8')
    .split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (!line) return null;
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

const rowsOf = res => (Array.isArray(res) ? res : (res && res.rows) || []);
const TZ = 'Europe/Paris';

function tzOffsetMs(date) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return Date.UTC(+p.year, +p.month - 1, +p.day, (+p.hour) % 24, +p.minute, +p.second) - date.getTime();
}
function parisToUtc(y, mo, d, hh, mi) {
  const naive = Date.UTC(y, mo - 1, d, hh, mi);
  let ts = naive - tzOffsetMs(new Date(naive));
  ts = naive - tzOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}
function parisToday() {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).reduce((a, x) => { a[x.type] = x.value; return a; }, {});
  return { y: +p.year, mo: +p.month, d: +p.day };
}
function plusDays(base, n) {
  const x = new Date(Date.UTC(base.y, base.mo - 1, base.d + n));
  return { y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

/* Transactions du vendeur de démo :
   [indexAnnonce, indexAcheteur, statut, montant, joursDepuis] */
const TX = [
  [7,  0,  'paid',     680,  46],
  [7,  2,  'paid',     680,  31],
  [7,  4,  'received', 680,  18],
  [7,  6,  'escrow',   680,   4],
  [7,  8,  'paid',     720,  62],
  [7, 10,  'shipped',  720,  11],
  [7,  1,  'pending',  720,   1],
  [7,  5,  'paid',     380,  77],
  [7,  9,  'paid',     145,  25],
];

/* Leads : [indexAcheteur, indexAnnonce, canal, état,handled_by, heuresDepuis, message] */
const LEADS = [
  [0,  7, 'whatsapp', 'open',   'human',  2,  'Bonjour, le Thermomix est-il encore disponible ?'],
  [2,  7, 'web',      'open',   'bot',    5,  'Bonjour, je viens de voir votre annonce.'],
  [4,  7, 'whatsapp', 'open',   'human', 19,  'Bonjour, je viens de voir votre annonce.'],
  [6,  7, 'web',      'closed', 'human', 52,  'Bonjour, je viens de voir votre annonce.'],
  [8,  7, 'whatsapp', 'handoff','bot',    74,  'Bonjour, je viens de voir votre annonce.'],
  [10, 7, 'web',      'open',   'human', 96,  'Bonjour, je viens de voir votre annonce.'],
];

/* Rendez-vous : [indexAcheteur, jourRelatif, heure, minute, statut, mode, note] */
const APPTS = [
  [0,  -9, 10,  0, 'done',      'visite',   'Rendez-vous effectué, bol et livre remis.'],
  [2,  -5, 15, 30, 'done',      'remise',   'Remise en main propre, reçu signé.'],
  [4,  -2, 11,  0, 'cancelled', 'visite',   'Empêchement, à reporter.'],
  [0,   2, 17,  0, 'confirmed', 'visite',   'Première utilisation, je veux voir le bol.'],
  [2,   4, 10, 30, 'confirmed', 'visite',   'Livraison possible vers le 5e ?'],
  [6,   3, 16,  0, 'requested', 'visite',   ''],
  [8,   6,  9, 30, 'requested', 'livraison','Expédition possible ?'],
];

/* Créneaux : [jourDeSemaine, début, fin, granularité] — 0 = dimanche */
const SLOTS = [
  [1, 540, 1140, 30],
  [2, 540, 1140, 30],
  [3, 540, 1260, 30],
  [4, 540, 1260, 30],
  [5, 540, 1200, 30],
  [6, 600, 1080, 60],
];

async function main() {
  const url = readUrl();
  if (!url) { console.error('DATABASE_URL introuvable.'); process.exit(1); }
  const sql = neon(url);

  const sellers = rowsOf(await sql.query(
    `SELECT id, display_name, city FROM users WHERE lower(email) = $1`, [SELLER_EMAIL]));
  const seller = sellers[0];
  if (!seller) { console.error(`Vendeur ${SELLER_EMAIL} introuvable — lancez d'abord db/seed.js.`); process.exit(1); }

  const all = rowsOf(await sql.query(`SELECT id, display_name FROM users ORDER BY created_at`));
  const listing = rowsOf(await sql.query(
    `SELECT id, title, price FROM listings WHERE seller_id = $1 LIMIT 1`, [seller.id]));
  const listingId = listing[0].id;

  console.log(`→ Enrichissement du vendeur ${seller.display_name} (${SELLER_EMAIL})…`);

  /* ---- Transactions ---- */
  await sql.query(`DELETE FROM transactions WHERE seller_id = $1`, [seller.id]);
  let txCount = 0;
  for (const [li, bi, st, amount, days] of TX) {
    const buyer = all[bi % all.length];
    if (!buyer || buyer.id === seller.id) continue;
    const commission = Math.round(amount * 0.12 * 100) / 100;
    await sql.query(
      `INSERT INTO transactions (listing_id, buyer_id, seller_id, amount, commission,
         commission_pct, status, escrow_provider, escrow_ref, insurance_pct, paid_at, created_at)
       VALUES ($1,$2,$3,$4,$5,12,$6::transaction_status,'mangopay',$7,0.6,
               CASE WHEN $6 IN ('paid','received') THEN now() - interval '${days} days' ELSE NULL END,
               now() - interval '${days} days')`,
      [listingId, buyer.id, seller.id, amount, commission, st, 'ESC-' + (20400 + txCount)]);
    txCount++;
  }
  console.log(`  · ${txCount} transactions`);

  /* ---- Conversations (leads) ---- */
  await sql.query(`DELETE FROM conversations WHERE seller_id = $1`, [seller.id]);
  let leadCount = 0;
  for (const [bi, li, channel, status, handled, hours, msg] of LEADS) {
    const buyer = all[bi % all.length];
    if (!buyer || buyer.id === seller.id) continue;
    const cv = rowsOf(await sql.query(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id, channel, status, handled_by, last_message_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6, now() - interval '${hours} hours', now() - interval '${hours + 3} hours')
       RETURNING id`,
      [listingId, buyer.id, seller.id, channel, status, handled]));
    await sql.query(
      `INSERT INTO messages (conversation_id, sender, body, intent, is_read, created_at)
       VALUES ($1,'user',$2,'buy',TRUE, now() - interval '${hours} hours')`, [cv[0].id, msg]);
    await sql.query(
      `INSERT INTO messages (conversation_id, sender, body, intent, is_read, created_at)
       VALUES ($1,'admin',$2,'estimate',FALSE, now() - interval '${Math.max(1, hours - 1)} hours')`,
      [cv[0].id, 'Bonjour, oui le produit est disponible. Je peux vous faire une estimation de livraison si besoin.']);
    leadCount++;
  }
  console.log(`  · ${leadCount} leads`);

  /* ---- Rendez-vous ---- */
  await sql.query(`DELETE FROM appointments WHERE seller_id = $1`, [seller.id]);
  const today = parisToday();
  let apptCount = 0;
  for (const [bi, dayOff, hh, mm, st, mode, note] of APPTS) {
    const buyer = all[bi % all.length];
    if (!buyer || buyer.id === seller.id) continue;
    const d = plusDays(today, dayOff);
    const startsAt = parisToUtc(d.y, d.mo, d.d, hh, mm);
    const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60000).toISOString();
    await sql.query(
      `INSERT INTO appointments (listing_id, buyer_id, seller_id, starts_at, ends_at,
                                 status, meeting_place, meeting_note, mode, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,30)`,
      [listingId, buyer.id, seller.id, startsAt, endsAt, st, seller.city || null, note || null, mode]);
    apptCount++;
  }
  console.log(`  · ${apptCount} rendez-vous`);

  /* ---- Créneaux larges ---- */
  await sql.query(`DELETE FROM availability_slots WHERE seller_id = $1`, [seller.id]);
  for (const [wd, from, to, step] of SLOTS) {
    await sql.query(
      `INSERT INTO availability_slots (seller_id, weekday, start_minute, end_minute, slot_minutes)
       VALUES ($1,$2,$3,$4,$5)`, [seller.id, wd, from, to, step]);
  }
  console.log(`  · ${SLOTS.length} fenêtres de disponibilité`);

  /* ---- Le vendeur pro devient crédible ---- */
  await sql.query(
    `UPDATE users SET tier = 'pro', pro_plan = 'pro', pro_activated_at = now() - interval '210 days',
            response_time_min = 8, trust_score = 96, rating = 4.9, sales_count = 34,
            kyc_status = 'approved', kyc_verified_at = now() - interval '300 days'
     WHERE id = $1`, [seller.id]);

  const check = rowsOf(await sql.query(
    `SELECT * FROM v_pro_dashboard WHERE seller_id = $1`, [seller.id]));
  const k = check[0];
  console.log(`\n✓ ${SELLER_EMAIL} — annonces ${k.listings_active} · CA ${k.revenue} € · pipeline ${k.pipeline} € · leads ${k.conversations} · rdv ${k.appointments} · créneaux ${k.slots}`);
}

main().catch(e => { console.error(e); process.exit(1); });
