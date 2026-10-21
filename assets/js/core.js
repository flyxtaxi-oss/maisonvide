/* ==========================================================================
   MaisonVide — Core
   Icônes SVG · Auth (session) · Toasts · Maths amorties (damp/hermite)
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Maths — reprise de motion-design-2 (amortissement indépendant du fr) */
  /* ------------------------------------------------------------------ */
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

  /* ------------------------------------------------------------------ */
  /* Icônes — injection du sprite, puis <svg class="ic"><use href="#i-x"/></svg> */
  /* ------------------------------------------------------------------ */
  /* Le sprite est résolu depuis l'URL de core.js, pas depuis la page :
     sans ça, /admin/*.html cherche le sprite dans /admin/assets/ et 404. */
  const ASSETS_BASE = (() => {
    const s = document.currentScript;
    if (s && s.src) return new URL('../', s.src).href;
    return 'assets/';
  })();
  const ICON_SPRITE = ASSETS_BASE + 'icons/sprite.svg';

  function injectIcons() {
    // 1) Essaie le <use> externe (rapide, 0 requête JS)
    // 2) En parallèle, on fetch le sprite pour l'inliner (compat Safari)
    const uses = document.querySelectorAll('svg.ic use');
    if (!uses.length) return;

    uses.forEach(u => {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href');
      if (href && href.startsWith('#')) {
        u.setAttribute('href', ICON_SPRITE + href);
        u.setAttribute('xlink:href', ICON_SPRITE + href);
      }
    });

    // Inline fallback : garantit le rendu même si <use> externe est bloqué
    fetch(ICON_SPRITE)
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (!text) return;
        const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        const svg = doc.documentElement;
        if (!svg || svg.querySelector('parsererror')) return;
        const host = document.createElement('div');
        host.style.display = 'none';
        host.innerHTML = text;
        const first = host.querySelector('svg');
        if (first) document.body.insertBefore(first, document.body.firstChild);
        document.querySelectorAll('svg.ic use').forEach(u => {
          const href = u.getAttribute('href') || '';
          if (href.includes(ICON_SPRITE)) {
            const id = href.split('#')[1];
            u.setAttribute('href', '#' + id);
            u.setAttribute('xlink:href', '#' + id);
          }
        });
      })
      .catch(() => { /* le <use> externe suffit */ });
  }

  /* Raccourci : mvIcon('camera') -> '<svg class="ic"><use href="#i-camera"/></svg>' */
  window.mvIcon = function (name, cls) {
    return `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  };

  /* ------------------------------------------------------------------ */
  /* Storage sûr */
  /* ------------------------------------------------------------------ */
  const store = {
    get(k, d = null) {
      try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); }
      catch { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  window.mvStore = store;

  /* ------------------------------------------------------------------ */
  /* AUTH — session persistante, prête pour un vrai backend */
  /* ------------------------------------------------------------------ */
  const Auth = {
    KEY: 'mv_user',
    USERS: 'mv_users',

    current() { return store.get(Auth.KEY, null); },
    isLogged() { return !!Auth.current(); },

    register({ name, email, password, phone }) {
      const users = store.get(Auth.USERS, []);
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('Un compte existe déjà avec cet email.');
      }
      const user = {
        id: 'u_' + Date.now().toString(36),
        name, email, phone: phone || '',
        password, // démo uniquement — en prod : hash serveur
        createdAt: new Date().toISOString(),
        tier: 'verified',
        listings: [],
        wishlist: [],
        sales: 0,
        rating: 0,
        reviews: [],
      };
      users.push(user);
      store.set(Auth.USERS, users);
      const session = { ...user };
      delete session.password;
      store.set(Auth.KEY, session);
      return session;
    },

    login(email, password) {
      const users = store.get(Auth.USERS, []);
      const u = users.find(x => x.email.toLowerCase() === email.toLowerCase());
      if (!u) throw new Error('Aucun compte avec cet email.');
      if (u.password !== password) throw new Error('Mot de passe incorrect.');
      const session = { ...u };
      delete session.password;
      store.set(Auth.KEY, session);
      return session;
    },

    logout() { store.del(Auth.KEY); location.reload(); },

    update(patch) {
      const u = Auth.current();
      if (!u) return null;
      const next = { ...u, ...patch };
      store.set(Auth.KEY, next);
      const users = store.get(Auth.USERS, []).map(x => x.id === next.id ? { ...x, ...patch } : x);
      store.set(Auth.USERS, users);
      return next;
    },

    toggleWishlist(slug) {
      const u = Auth.current();
      if (!u) return { ok: false, reason: 'login' };
      const list = u.wishlist || [];
      const has = list.includes(slug);
      const next = has ? list.filter(s => s !== slug) : [...list, slug];
      Auth.update({ wishlist: next });
      return { ok: true, added: !has, count: next.length };
    },

    inWishlist(slug) {
      const u = Auth.current();
      return !!(u && (u.wishlist || []).includes(slug));
    },
  };
  window.mvAuth = Auth;

  /* ------------------------------------------------------------------ */
  /* Toast */
  /* ------------------------------------------------------------------ */
  window.mvToast = function (message, type = 'info', duration = 3400) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast--' + type;
    const icon = { success: 'check-circle', warning: 'alert', danger: 'alert', info: 'info' }[type] || 'info';
    el.innerHTML = window.mvIcon(icon) + '<span>' + message + '</span>';
    host.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(16px)';
      el.style.transition = 'opacity .25s, transform .25s';
      setTimeout(() => el.remove(), 260);
    }, duration);
  };

  /* ------------------------------------------------------------------ */
  /* Nav : état connecté / déconnecté */
  /* ------------------------------------------------------------------ */
  function renderAuthNav() {
    const u = Auth.current();
    document.querySelectorAll('[data-auth-when]').forEach(el => {
      const state = el.dataset.authWhen;
      const show = state === 'out' ? !u : !!u;
      el.classList.toggle('hidden', !show);
    });
    document.querySelectorAll('[data-user-name]').forEach(el => {
      el.textContent = u ? u.name.split(' ')[0] : '';
    });
  }
  window.mvRenderAuthNav = renderAuthNav;

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-action="logout"]');
    if (t) { e.preventDefault(); Auth.logout(); }
    const reg = e.target.closest('[data-action="register"]');
    if (reg) { e.preventDefault(); location.href = 'auth.html?mode=register'; }
    const log = e.target.closest('[data-action="login"]');
    if (log) { e.preventDefault(); location.href = 'auth.html'; }
  });

  /* ------------------------------------------------------------------ */
  /* Nav mobile */
  /* ------------------------------------------------------------------ */
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open);
    });
    nav.addEventListener('click', e => {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', false);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Cookie */
  /* ------------------------------------------------------------------ */
  const cookie = document.getElementById('cookie-banner');
  if (cookie) {
    if (!store.get('mv_cookie_consent')) cookie.classList.remove('hidden');
    cookie.querySelectorAll('[data-cookie]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.set('mv_cookie_consent', btn.dataset.cookie);
        cookie.classList.add('hidden');
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Liens légaux — injectés dans le pied de page de TOUTES les pages     */
  /* RGPD : mentions, confidentialité, CGU et cookies doivent être        */
  /* accessibles depuis n'importe quelle page, sans pieds de page        */
  /* différents à maintenir.                                             */
  /* ------------------------------------------------------------------ */
  const LEGAL_PAGES = [
    ['mentions-legales.html', 'Mentions légales'],
    ['confidentialite.html', 'Confidentialité'],
    ['cgu.html', 'CGU'],
    ['cookies.html', 'Cookies'],
  ];

  function injectLegalLinks() {
    const bottom = document.querySelector('.site-footer__bottom');
    if (!bottom || bottom.querySelector('[data-legal-links]')) return;
    const prefix = /\/admin(\/|$)/.test(location.pathname) ? '../' : '';
    const span = document.createElement('span');
    span.className = 'footer-legal';
    span.setAttribute('data-legal-links', '');
    span.innerHTML = LEGAL_PAGES
      .map(([href, label]) => `<a href="${prefix}${href}">${label}</a>`)
      .join('');
    bottom.appendChild(span);
  }
  window.mvInjectLegalLinks = injectLegalLinks;

  /* ------------------------------------------------------------------ */
  /* Boot */
  /* ------------------------------------------------------------------ */
  document.documentElement.classList.add('js');
  window.addEventListener('DOMContentLoaded', () => {
    injectIcons();
    renderAuthNav();
    injectLegalLinks();
  });
  if (document.readyState !== 'loading') {
    injectIcons();
    renderAuthNav();
    injectLegalLinks();
  }

  window.mvMath = { clamp, lerp, smoothstep, damp };
})();
