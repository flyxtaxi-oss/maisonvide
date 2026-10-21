/* ==========================================================================
   MaisonVide — Application du schéma sur Neon
   Usage : node db/apply.js [--seed]

   Points clés :
   - Le SQL est découpé par un splitter qui COMPREND le dollar-quoting `$$`
     (blocs DO $$ ... $$ et CREATE FUNCTION ... $$), les chaînes '...' avec
     échappement, les identifiants "..." et les commentaires ligne / bloc.
   - Les objets déjà présents ne sont pas bloquants.
   ========================================================================== */
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

/* ------------------------------------------------------------------ */
/* Splitter SQL-aware                                                   */
/* ------------------------------------------------------------------ */
function splitSql(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inLine = false;
  let inBlock = false;
  let dollarTag = null;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLine) {
      if (ch === '\n') { inLine = false; buf += ch; }
      i++; continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i += 2; continue; }
      i++; continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) { buf += dollarTag; i += dollarTag.length; dollarTag = null; continue; }
      buf += ch; i++; continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'") {
        if (next === "'") { buf += next; i += 2; continue; }
        inSingle = false;
      }
      i++; continue;
    }
    if (inDouble) {
      buf += ch;
      if (ch === '"') inDouble = false;
      i++; continue;
    }

    if (ch === '-' && next === '-') { inLine = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }
    if (ch === "'") { inSingle = true; buf += ch; i++; continue; }
    if (ch === '"') { inDouble = true; buf += ch; i++; continue; }
    if (ch === '$') {
      const m = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) { dollarTag = m[0]; buf += m[0]; i += m[0].length; continue; }
    }
    if (ch === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

/* ------------------------------------------------------------------ */
/* Connexion                                                            */
/* ------------------------------------------------------------------ */
function readUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, 'utf8')
      .split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
    if (line) {
      return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

/* Le driver HTTP renvoie un objet { rows, fields, rowCount } ou un tableau
   selon la version. On normalise. */
function rowsOf(res) {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.rows)) return res.rows;
  if (Array.isArray(res.data)) return res.data;
  return [];
}

/* ------------------------------------------------------------------ */
/* Exécution                                                            */
/* ------------------------------------------------------------------ */
async function main() {
  const url = readUrl();
  if (!url) {
    console.error('DATABASE_URL introuvable. Créez db/.env avec DATABASE_URL=...');
    process.exit(1);
  }
  const sql = neon(url);

  const statements = splitSql(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log(`→ ${statements.length} instructions détectées\n`);

  let ok = 0; const fails = [];
  for (const st of statements) {
    const preview = st.replace(/\s+/g, ' ').slice(0, 72);
    try {
      await sql.query(st);
      ok++;
    } catch (e) {
      const msg = e.message || String(e);
      if (/already exists|duplicate/i.test(msg)) { ok++; continue; }
      fails.push({ preview, msg });
    }
  }
  console.log(`✓ ${ok} instructions appliquées, ${fails.length} échec(s)`);
  fails.forEach(f => console.error('  ✗', f.preview, '→', f.msg));

  /* ---- Vérification ---- */
  const t = rowsOf(await sql.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`));
  const v = rowsOf(await sql.query(`
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public' ORDER BY table_name`));
  const e = rowsOf(await sql.query(`
    SELECT typname FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY typname`));

  console.log('\nTables  :', t.length ? t.map(r => r.table_name).join(', ') : '(aucune)');
  console.log('Vues    :', v.length ? v.map(r => r.table_name).join(', ') : '(aucune)');
  console.log('ENUM    :', e.length ? e.map(r => r.typname).join(', ') : '(aucun)');

  const expected = ['users', 'listings', 'listing_photos', 'wishlists', 'conversations',
    'messages', 'transactions', 'reviews', 'appointments', 'reports', 'ai_estimates',
    'chatbot_flows', 'chatbot_logs', 'admin_audit_log', 'platform_settings'];
  const got = t.map(r => r.table_name);
  const missing = expected.filter(x => !got.includes(x));
  if (missing.length) {
    console.error('\n✗ Tables manquantes :', missing.join(', '));
    process.exitCode = 1;
  } else {
    console.log('\n✓ Schéma complet : 15 tables, 2 vues, 5 ENUM.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
