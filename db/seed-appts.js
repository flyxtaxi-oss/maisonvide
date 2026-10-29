/* ==========================================================================
   MaisonVide — Seed rendez-vous & disponibilités (Neon)
   Usage : node db/seed-appts.js   (après db/seed.js)

   Remplit availability_slots (fenêtres du vendeur) et appointments
   (demandes, confirmations, rendez-vous passés, refus) pour que la
   prise de rendez-vous et l'espace pro ayent de la matière crédible.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

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

/* Date-heure de Paris → ISO UTC */
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

/* +n jours en date de Paris */
function plusDays(base, n) {
  const x = new Date(Date.UTC(base.y, base.mo - 1, base.d + n));
  return { y: x.getUTCFullYear(), mo: x.getUTCMonth() + 1, d: x.getUTCDate() };
}

/* Fenêtres de disponibilité par vendeur (index aligné sur le seed principal) */
const AVAILABILITY = [
  { days: [2, 3, 4, 5], from: 600,  to: 1140, slot: 30 }, // 10h–19h, du mardi au vendredi
  { days: [2, 3, 4, 6], from: 540,  to: 1080, slot: 30 },
  { days: [1, 2, 3, 4, 5], from: 480, to: 1200, slot: 45 }, // samedi inclus, créneaux 45 min
  { days: [4, 5, 6], from: 660,  to: 1260, slot: 30 },
  { days: [2, 3, 4, 5], from: 720,  to: 1200, slot: 60 },
  { days: [6],          from: 540,  to: 1020, slot: 60 }, // samedi uniquement
  { days: [1, 2, 3, 4], from: 600,  to: 1140, slot: 30 },
  { days: [1, 2, 3, 4, 5, 6], from: 480, to: 1320, slot: 30 }, // pro : ouvert 6 j/7
  { days: [3, 4, 5],    from: 600,  to: 1140, slot: 30 },
  { days: [2, 3, 4, 5, 6], from: 540, to: 1200, slot: 30 },
  { days: [1, 2, 3, 4, 5], from: 600, to: 1260, slot: 45 },
  { days: [5, 6],       from: 600,  to: 1140, slot: 30 },
];

/* Rendez-vous de démonstration :
   [indexVendeur, indexAnnonce, jourRelatif, heure, minute, statut, mode, note] */
const APPTS = [
  [0, 0,  2, 10, 30, 'confirmed', 'visite',   'Je passe avec mon camion, un carton de rusty.'],
  [0, 2,  3, 17, 0,  'requested', 'visite',   'La lampe fonctionne toujours ?'],
  [1, 1,  1, 11, 0,  'confirmed', 'remise',   'Livraison possible vers le 5e ?'],
  [2, 2,  4, 16, 30, 'requested', 'visite',   ''],
  [3, 3,  2, 14, 0,  'confirmed', 'visite',   'Je viens tester la machine avant de décider.'],
  [7, 7,  1, 9,  30, 'confirmed', 'visite',   'Première utilisation, je veux voir le bol.'],
  [7, 7,  5, 15, 0,  'requested', 'visite',   ''],
  [9, 9,  3, 18, 0,  'requested', 'livraison','Expédition possible ?'],
  [10, 10, 2, 12, 0, 'confirmed', 'visite',   'Pièce de vente — je passe avec un expert.'],
  [4, 4,  6, 10, 0,  'requested', 'visite',   ''],
  [2, 2,  -4, 15, 0, 'done',      'visite',   'Rendez-vous effectué, pièce reserved.'],
  [3, 3,  -9, 11, 30,'done',      'remise',   'Remis en main propre, reçu signé.'],
  [9, 9,  -6, 16, 0, 'cancelled', 'visite',   'Empêchement, à reporter.'],
  [1, 1,  -2, 10, 0, 'declined',  'visite',   'Créneau indisponible ce jour-là.'],
  [8, 8,  4, 13, 30,'requested', 'visite',   ''],
];

async function main() {
  const url = readUrl();
  if (!url) { console.error('DATABASE_URL introuvable.'); process.exit(1); }
  const sql = neon(url);

  const sellers = rowsOf(await sql.query(
    `SELECT id, display_name, city FROM users ORDER BY created_at ASC LIMIT 12`));
  const listings = rowsOf(await sql.query(
    `SELECT id, slug, title, seller_id FROM listings ORDER BY created_at ASC LIMIT 12`));

  if (!sellers.length) { console.error('Aucune donnée : lancez d’abord `node db/seed.js`.'); process.exit(1); }

  console.log('→ Nettoyage disponibilités et rendez-vous…');
  await sql.query(`TRUNCATE availability_slots, appointments RESTART IDENTITY CASCADE`);

  console.log('→ Créneaux de disponibilité…');
  let slotCount = 0;
  for (let i = 0; i < sellers.length; i++) {
    const a = AVAILABILITY[i % AVAILABILITY.length];
    for (const d of a.days) {
      await sql.query(
        `INSERT INTO availability_slots (seller_id, weekday, start_minute, end_minute, slot_minutes)
         VALUES ($1,$2,$3,$4,$5)`, [sellers[i].id, d, a.from, a.to, a.slot]);
      slotCount++;
    }
  }

  console.log('→ Rendez-vous…');
  const today = parisToday();
  let count = 0;
  for (const [si, li, dayOff, hh, mm, status, mode, note] of APPTS) {
    const seller = sellers[si % sellers.length];
    const listing = listings.find(l => l.seller_id === seller.id) || listings[li % listings.length];
    if (!listing) continue;
    // L'acheteur est un autre vendeur du jeu (le rôle « acheteur » du seed).
    const buyer = sellers[(si + 4) % sellers.length];
    const d = plusDays(today, dayOff);
    const startsAt = parisToUtc(d.y, d.mo, d.d, hh, mm);
    const endsAt = new Date(new Date(startsAt).getTime() + 30 * 60000).toISOString();
    await sql.query(
      `INSERT INTO appointments (listing_id, buyer_id, seller_id, starts_at, ends_at,
                                 status, meeting_place, meeting_note, mode, duration_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,30)`,
      [listing.id, buyer.id, seller.id, startsAt, endsAt, status, seller.city || null, note || null, mode]);
    count++;
  }

  const check = rowsOf(await sql.query(
    `SELECT (SELECT count(*) FROM availability_slots)::int AS slots,
            (SELECT count(*) FROM appointments)::int AS appts,
            (SELECT count(*) FROM appointments WHERE status='requested')::int AS pending`));
  console.log(`\n✓ ${check[0].slots} créneaux · ${check[0].appts} rendez-vous (${check[0].pending} en attente)`);
}

main().catch(e => { console.error(e); process.exit(1); });
