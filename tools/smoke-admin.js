/* Harnais de fumée : exécute assets/js/admin.js sur un DOM minimal
   pour vérifier que les rendus (tables, graphiques SVG) ne lèvent pas. */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

let errors = [];
let nextId = 1;

function makeEl(tag, opts = {}) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    _id: opts.id || ('el' + nextId++),
    className: opts.className || '',
    dataset: opts.dataset || {},
    style: { cssText: '', setProperty(k, v) { this[k] = v; } },
    innerHTML: '',
    textContent: '',
    value: opts.value !== undefined ? opts.value : '',
    checked: !!opts.checked,
    children: [],
    attributes: {},
    listeners: {},
    scrollTop: 0,
    scrollHeight: 0,
    parentNode: null,
    classList: {
      _s: new Set((opts.className || '').split(' ').filter(Boolean)),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); return this._s.has(c); },
    },
    get firstChild() { return this.children[0] || null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    hasAttribute(k) { return this.attributes[k] !== undefined; },
    removeAttribute(k) { delete this.attributes[k]; },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    insertBefore(c) { c.parentNode = this; this.children.unshift(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    remove() {},
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (this.listeners[t] || []).forEach(fn => fn(ev || { target: this, preventDefault() {} })); },
    querySelector(sel) { return queryAll(this, sel)[0] || null; },
    querySelectorAll(sel) { return queryAll(this, sel); },
    matches(sel) { return matchesSimple(this, sel); },
    closest(sel) { return this; },
    focus() {},
  };
  return el;
}

function matchesSimple(el, sel) {
  sel = sel.trim();
  if (sel === '*') return true;
  const attrM = sel.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
  if (attrM) {
    const key = attrM[1].replace(/^data-/, '').replace(/-(\w)/g, (m, c) => c.toUpperCase());
    const v = el.dataset[key];
    return attrM[2] === undefined ? v !== undefined : v === attrM[2];
  }
  const parts = sel.split('.');
  const tag = parts[0];
  const cls = parts.slice(1);
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  return cls.every(c => el.classList.contains(c));
}

function queryAll(root, sel) {
  sel = (sel || '').trim();
  if (!sel) return [];
  const groups = sel.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  const pool = [];
  (function walk(n) {
    (n.children || []).forEach(c => { pool.push(c); walk(c); });
  })(root);
  const candidates = root === document.body ? pool.concat([document.body]) : pool;
  groups.forEach(g => {
    candidates.forEach(c => {
      if (matchesSimple(c, g) && !out.includes(c)) out.push(c);
    });
  });
  return out;
}

const byId = new Map();
const document = {
  readyState: 'complete',
  documentElement: { classList: { add() {}, remove() {} } },
  body: null,
  createElement(tag) { return makeEl(tag); },
  createElementNS(ns, tag) { return makeEl(tag); },
  querySelector(sel) {
    if (sel.startsWith('#') && byId.has(sel.slice(1))) return byId.get(sel.slice(1));
    return queryAll(document.body, sel)[0] || null;
  },
  getElementById(id) { return byId.has(id) ? byId.get(id) : null; },
  querySelectorAll(sel) { return queryAll(document.body, sel); },
  addEventListener() {},
};
document.body = makeEl('body');
document.body.dataset = { nav: 'dashboard' };
document.body.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };

function reg(id, tag, opts) {
  const el = makeEl(tag, Object.assign({ id }, opts || {}));
  byId.set(id, el);
  document.body.children.push(el);
  el.parentNode = document.body;
  return el;
}

// --- Éléments attendus par admin.js -------------------------------
reg('listings-tbody', 'tbody');
reg('moderation-tbody', 'tbody');
reg('ia-rows', 'tbody');
reg('activity-feed', 'div', { className: 'timeline' });
reg('chat-list', 'div', { className: 'chat__list' });
reg('chat-messages', 'div', { className: 'chat__msgs' });
reg('chat-name', 'b'); reg('chat-meta', 'span'); reg('chat-state', 'span'); reg('chat-avatar', 'span');
reg('chat-mode', 'div', { className: 'seg' });
reg('chat-form', 'form');
reg('chart-revenue', 'div'); reg('chart-bar', 'div'); reg('chart-donut', 'div');
reg('chart-escrow', 'div'); reg('chart-cities', 'div'); reg('chart-sources', 'div');
reg('chart-devices', 'div'); reg('funnel', 'div');
reg('filter-search', 'input'); reg('filter-cat', 'select'); reg('filter-status', 'select');
reg('listing-count', 'span'); reg('selection-count', 'span');
reg('toasts', 'div');

// Segments de contrôle
const seg = reg('chat-mode', 'div', { className: 'seg' });
['bot', 'human'].forEach(v => {
  const b = makeEl('button', { className: v === 'bot' ? 'is-active' : '', dataset: { value: v } });
  seg.children.push(b);
});

// Groupe de chips
const chips = makeEl('div', { className: 'chips', dataset: { chipGroup: 'listing' } });
['all', 'active', 'pending', 'sold', 'review', 'flagged'].forEach((v, i) => {
  const c = makeEl('button', { className: 'chip' + (i === 0 ? ' is-active' : ''), dataset: { chip: v } });
  chips.children.push(c);
});
document.body.children.push(chips);

// Toggles
for (let i = 0; i < 3; i++) {
  const t = makeEl('div', { className: 'toggle' });
  document.body.children.push(t);
}

// Liens de navigation
['dashboard', 'annonces', 'ia'].forEach(k => {
  const a = makeEl('a', { className: 'admin-nav', dataset: { nav: k } });
  a.className = '';
  document.body.children.push(a);
});

// --- Contexte ------------------------------------------------------
const sandbox = {
  document,
  window: {},
  navigator: { clipboard: null },
  CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
  fetch: () => Promise.reject(new Error('offline')),
  setTimeout: () => 0,
  clearTimeout: () => {},
  console,
  Math, Date, JSON, Array, Object, String, Number, Boolean, isNaN, parseInt, parseFloat,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const code = fs.readFileSync(path.join(process.cwd(), 'assets/js/admin.js'), 'utf8');
try {
  vm.runInContext(code, sandbox, { filename: 'admin.js' });
} catch (e) {
  errors.push('EXECUTION: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
}

// --- Assertions ----------------------------------------------------
function assert(cond, label) { if (!cond) errors.push('ASSERT: ' + label); }

const listings = byId.get('listings-tbody');
assert(listings.innerHTML.includes('MV-2481'), 'la table des annonces est rendue');
assert(listings.innerHTML.includes('conf__bar'), 'la confiance est rendue en barre');
assert(byId.get('moderation-tbody').innerHTML.includes('MV-2480'), 'la file de modération est rendue');
assert(byId.get('ia-rows').innerHTML.includes('mv-estimate-v2.4.1'), 'les estimations IA sont rendues');
assert(byId.get('activity-feed').innerHTML.includes('timeline__row'), 'l’activité est rendue');
assert(byId.get('chat-list').innerHTML.includes('chat__item'), 'la liste de conversations est rendue');
assert(byId.get('chat-messages').innerHTML.includes('chat__bubble'), 'le fil de discussion est rendu');
assert(byId.get('chat-name').textContent === 'Sophie M.', 'le nom actif est positionné');

const rev = byId.get('chart-revenue');
assert(rev.children.length > 0, 'la courbe SVG a des nœuds');
assert(rev.children.some(c => c.tagName === 'SVG'), 'la courbe est bien un SVG');
const donut = byId.get('chart-donut');
assert(donut.children.length > 0 && donut.children[0].tagName === 'SVG', 'le donut est un SVG');
assert(byId.get('funnel').innerHTML.includes('funnel__row'), 'l’entonnoir est rendu');
assert(byId.get('chart-cities').children.length > 0, 'les villes sont tracées');
assert(byId.get('chart-bar').children.length > 0, 'les barres sont tracées');

// Le SVG de la courbe contient un path avec une courbe réelle
const svg = rev.children[0];
const paths = svg.children.filter(c => c.tagName === 'PATH');
assert(paths.length >= 2, 'la courbe contient une aire et une ligne');
assert(paths[1].attributes.d && paths[1].attributes.d.indexOf('L') > 0, 'le tracé de la courbe est non vide');

// Filtres : le filtre catégorie « decoration » ne doit laisser qu’une ligne
byId.get('filter-cat').value = 'decoration';
byId.get('filter-cat').dispatch('change');
assert(String(byId.get('listing-count').textContent) === '1', 'le filtre catégorie réduit la table à 1 ligne');
byId.get('filter-cat').value = '';
byId.get('filter-cat').dispatch('change');
assert(String(byId.get('listing-count').textContent) === '10', 'le reset du filtre rend les 10 lignes');

// Toggle
const tog = document.body.children.find(c => c.className === 'toggle');
tog.dispatch('click');
assert(tog.classList.contains('is-on'), 'le toggle bascule');

// Chips
chips.dispatch('chip:change', { detail: 'pending' });
assert(String(byId.get('listing-count').textContent) === '2', 'le filtre par chip limite aux annonces en attente');

if (errors.length) {
  console.log('ECHECS (' + errors.length + ') :');
  errors.forEach(e => console.log(' - ' + e));
  process.exit(1);
}
console.log('SMOKE TEST OK — admin.js s’exécute sans erreur et rend tables + graphiques.');
