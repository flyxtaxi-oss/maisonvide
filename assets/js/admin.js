/* ==========================================================================
   MaisonVide — Espace pro (admin)
   Interactions de l'admin : navigation, filtres, toggles, tables rendues
   depuis les données de démonstration, et graphiques SVG générés à la volée.

   Aucune dépendance externe : pas de librairie, pas de CDN, pas de build.
   ========================================================================== */

(function () {
  'use strict';

  const $ = (s, ctx = document) => ctx.querySelector(s);
  const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

  /* ------------------------------------------------------------------ */
  /* Sprite d'icônes                                                      */
  /* ------------------------------------------------------------------ */
  /* core.js pointe chaque <use> vers le fichier « assets/icons/sprite.svg ».
     Depuis /admin, ce <use> externe vers un fichier local est bloque par le
     navigateur en protocole file:// : les icones ne s affichent pas. On
     embarque donc une copie du sprite, on injecte les symboles dans la page,
     puis on renvoie chaque <use> vers son symbole local (« #i-... »).
     La copie embarquee est retiree si core.js reussit a inliner le sprite
     lui-meme, pour ne garder qu une seule source d icones. */

  const SPRITE_URL = '../assets/icons/sprite.svg';
  const SPRITE_FALLBACK = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
<!-- MaisonVide — icon system : 24x24 grid, stroke 1.6, round caps, currentColor -->

<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></symbol>
<symbol id="i-camera" viewBox="0 0 24 24"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.3-2h7.9l1.3 2h2.3A1.5 1.5 0 0 1 21 8.5v10A1.5 1.5 0 0 1 19.5 20h-15A1.5 1.5 0 0 1 3 18.5z"/><circle cx="12" cy="13" r="3.6"/></symbol>
<symbol id="i-tag" viewBox="0 0 24 24"><path d="M12.6 3H20a1 1 0 0 1 1 1v7.4a2 2 0 0 1-.6 1.4l-8.6 8.6a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8.6-8.6a2 2 0 0 1 1.4-.6z"/><circle cx="16.4" cy="7.6" r="1.5"/></symbol>
<symbol id="i-chat" viewBox="0 0 24 24"><path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5v-14A2 2 0 0 1 6 4h12a2 2 0 0 1 2 2z"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 20 6v6c0 4.4-3.4 7.9-8 9-4.6-1.1-8-4.6-8-9V6z"/><path d="m9 12 2 2 4-4"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="1.6"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.9"/><path d="M17.4 14.4a6.2 6.2 0 0 1 3.8 5.1"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m4.5 12.5 5 5 10-11"/></symbol>
<symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="m8 12.2 2.8 2.8L16.4 9"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3"/><path d="m15.5 15.5 4 4"/></symbol>
<symbol id="i-filter" viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></symbol>
<symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M4 12h15"/><path d="m13.5 6 6 6-6 6"/></symbol>
<symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M20 12H5"/><path d="m10.5 6-6 6 6 6"/></symbol>
<symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9.5 6 6 6-6"/></symbol>
<symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9.5 6 6 6-6 6"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
<symbol id="i-truck" viewBox="0 0 24 24"><path d="M2.8 6.5h10.4v10H2.8z"/><path d="M13.2 10h3.9l3.1 3.2v3.3h-7z"/><circle cx="7" cy="18.4" r="1.9"/><circle cx="16.8" cy="18.4" r="1.9"/></symbol>
<symbol id="i-package" viewBox="0 0 24 24"><path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="M4 7.2 12 11.5l8-4.3M12 11.5V21"/></symbol>
<symbol id="i-card" viewBox="0 0 24 24"><rect x="2.8" y="5.5" width="18.4" height="13" rx="1.6"/><path d="M2.8 10h18.4"/><path d="M6.5 14.5h3.5"/></symbol>
<symbol id="i-banknote" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="1.6"/><circle cx="12" cy="12" r="2.4"/><path d="M6 10v4M18 10v4"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V4"/><path d="M4 20h16"/><path d="m7.5 15 3.5-4 3 2.6 4.5-6.1"/></symbol>
<symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></symbol>
<symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9z"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4.2L19 9.2a2.1 2.1 0 0 0 0-3l-1.2-1.2a2.1 2.1 0 0 0-3 0L4 15.8z"/><path d="m13.5 6.5 4 4"/></symbol>
<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 6.5h16"/><path d="M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7"/><path d="M6.5 6.5 7.4 20a1.4 1.4 0 0 0 1.4 1.3h6.4a1.4 1.4 0 0 0 1.4-1.3l.9-13.5"/><path d="M10.5 10v7M13.5 10v7"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/></symbol>
<symbol id="i-share" viewBox="0 0 24 24"><circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="m8.4 10.8 7.2-3.9M8.4 13.2l7.2 3.9"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5M12 7.8v.2"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.6 4.2 2.9 17.5A1.6 1.6 0 0 0 4.3 20h15.4a1.6 1.6 0 0 0 1.4-2.5L13.4 4.2a1.6 1.6 0 0 0-2.8 0z"/><path d="M12 9.5v4M12 16.6v.2"/></symbol>
<symbol id="i-ai" viewBox="0 0 24 24"><path d="M12 2.8 13.7 8l5.2 1.7-5.2 1.7L12 16.6l-1.7-5.2L5.1 9.7 10.3 8z"/><path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/></symbol>
<symbol id="i-bot" viewBox="0 0 24 24"><rect x="4" y="7.5" width="16" height="12" rx="3"/><path d="M12 3.5v4"/><circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="13" r="1.2"/><path d="M9.8 16.6h4.4"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M12 7v5.3l3.3 2"/></symbol>
<symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="16" rx="1.8"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M21 16.5v2.6a1.8 1.8 0 0 1-2 1.8 17.6 17.6 0 0 1-7.7-2.7 17.3 17.3 0 0 1-5.3-5.3A17.6 17.6 0 0 1 3.3 5a1.8 1.8 0 0 1 1.8-2h2.6a1.8 1.8 0 0 1 1.8 1.6c.1 1 .3 1.9.6 2.8a1.8 1.8 0 0 1-.4 1.9L8.6 10.4a14 14 0 0 0 5 5l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.9.3 1.8.5 2.8.6a1.8 1.8 0 0 1 1.6 1.9z"/></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="1.8"/><path d="m3.4 6.6 8.6 6 8.6-6"/></symbol>
<symbol id="i-qr" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM20.5 14v3M17.5 20.5h3M14 20.5h.2"/></symbol>
<symbol id="i-cube" viewBox="0 0 24 24"><path d="m12 2.8 8.5 4.7v9.4L12 21.6 3.5 16.9V7.5z"/><path d="M3.5 7.5 12 12.2l8.5-4.7M12 12.2v9.4"/></symbol>
<symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.1M3.5 12h.1M3.5 18h.1"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></symbol>
<symbol id="i-trend" viewBox="0 0 24 24"><path d="m3 16 5.5-5.5 4 4L21 6"/><path d="M15 6h6v6"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.6"/><path d="M4 4v4.6h4.6"/><path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.4"/><path d="M20 20v-4.6h-4.6"/></symbol>
<symbol id="i-logout" viewBox="0 0 24 24"><path d="M9.5 20H5.4A1.4 1.4 0 0 1 4 18.6V5.4A1.4 1.4 0 0 1 5.4 4h4.1"/><path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9"/></symbol>
<symbol id="i-id" viewBox="0 0 24 24"><rect x="2.8" y="5" width="18.4" height="14" rx="2"/><circle cx="8.5" cy="11" r="2.2"/><path d="M4.8 17.2a4 4 0 0 1 7.4 0M14.5 10h4M14.5 13.5h3"/></symbol>
<symbol id="i-leaf" viewBox="0 0 24 24"><path d="M4 20c0-8 5-14 16-15 0 11-5 15-12 15H4z"/><path d="M4 20c3-5 7-8 11-9.5"/></symbol>
<symbol id="i-box" viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/></symbol>
<symbol id="i-scale" viewBox="0 0 24 24"><path d="M12 3v18M7 6.5h10"/><path d="M4 14a3 3 0 0 0 6 0L7 6.5zM14 14a3 3 0 0 0 6 0L17 6.5z"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4a13 13 0 0 1 0 17.2 13 13 0 0 1 0-17.2z"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4M5 4.5h12l-2 3.5 2 3.5H5"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/><circle cx="12" cy="12" r="3"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M10.2 8.8 15.5 12l-5.3 3.2z"/></symbol>
<symbol id="i-cog" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2 7.4 7.4M16.6 16.6l2.2 2.2M18.8 5.2 16.6 7.4M7.4 16.6 5.2 18.8"/></symbol>
<symbol id="i-gem" viewBox="0 0 24 24"><path d="M6 3h12l3.5 6L12 21 2.5 9z"/><path d="M2.5 9h19M9 3 6.5 9 12 21l5.5-12L15 3M6.5 9h11"/></symbol>
<symbol id="i-whatsapp" viewBox="0 0 24 24"><path d="M3.6 20.4 5 16.2A8 8 0 1 1 8.3 19.4z"/><path d="M9 8.4c.3 2.2 2.2 4 4.4 4.4l.9-1.1 1.8.9v1.3c-3.9.6-7.3-2.8-6.7-6.7h1.3l.9 1.8z"/></symbol>
<symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16"/></symbol>
<symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 19.5h16"/></symbol>
<symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></symbol>
<symbol id="i-shield-check" viewBox="0 0 24 24"><path d="M12 3 4.5 5.8v5.4c0 4.4 3.1 8.2 7.5 9.8 4.4-1.6 7.5-5.4 7.5-9.8V5.8z"/><path d="m9 11.8 2.2 2.2 4-4.2"/></symbol>
<symbol id="i-scan" viewBox="0 0 24 24"><path d="M3.5 8.5v-4a1 1 0 0 1 1-1h4M15.5 3.5h4a1 1 0 0 1 1 1v4M20.5 15.5v4a1 1 0 0 1-1 1h-4M8.5 20.5h-4a1 1 0 0 1-1-1v-4M3.5 12h17"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 4.5v15M15 4.5v15"/></symbol>
</svg>
`;

  function pointUsesLocally() {
    document.querySelectorAll('svg.ic use').forEach(u => {
      const href = u.getAttribute('href') || u.getAttribute('xlink:href') || '';
      const id = href.split('#')[1];
      if (!id) return;
      u.setAttribute('href', '#' + id);
      u.setAttribute('xlink:href', '#' + id);
    });
  }

  function injectSprite() {
    if (document.getElementById('mv-sprite')) {
      pointUsesLocally();
      return;
    }

    const host = document.createElement('div');
    host.id = 'mv-sprite';
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    host.innerHTML = SPRITE_FALLBACK;
    document.body.insertBefore(host, document.body.firstChild);
    pointUsesLocally();

    /* Si core.js reussit a inliner le sprite, on retire la copie embarquee. */
    if (typeof MutationObserver === 'function') {
      const observer = new MutationObserver(() => {
        if (!document.querySelector('body > svg')) return;
        observer.disconnect();
        host.remove();
        pointUsesLocally();
      });
      observer.observe(document.body, { childList: true });
    }

    /* On va chercher la version a jour du sprite : elle remplace la copie. */
    if (typeof fetch !== 'function') return;
    fetch(SPRITE_URL)
      .then(r => (r.ok ? r.text() : null))
      .then(text => {
        if (!text || !host.isConnected) return;
        host.innerHTML = text;
        pointUsesLocally();
      })
      .catch(() => { /* la copie embarquee suffit */ });
  }

  /* Icône (même API que core.js, mais avec le href local « #i-… ») */
  const icon = (name, cls) =>
    `<svg class="ic ${cls || ''}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  /* ------------------------------------------------------------------ */
  /* Données de démonstration                                             */
  /* ------------------------------------------------------------------ */

  const listings = [
    { ref: 'MV-2481', title: 'Canapé teck des années 60', cat: 'Mobilier', catKey: 'mobilier', price: 280, seller: 'Sophie M.', city: 'Paris', status: 'pending', conf: 92, views: 134, contacts: 6, date: 'Il y a 2 h' },
    { ref: 'MV-2480', title: 'MacBook Pro M1 2020', cat: 'Électronique', catKey: 'electronique', price: 720, seller: 'Antoine R.', city: 'Lyon', status: 'review', conf: 64, views: 58, contacts: 2, date: 'Il y a 30 min' },
    { ref: 'MV-2479', title: 'Table chêne massif', cat: 'Mobilier', catKey: 'mobilier', price: 340, seller: 'Julien D.', city: 'Bordeaux', status: 'sold', conf: 88, views: 412, contacts: 19, date: 'Hier' },
    { ref: 'MV-2478', title: 'Thermomix TM6', cat: 'Électroménager', catKey: 'electromenager', price: 680, seller: 'Cuisine M.', city: 'Nantes', status: 'active', conf: 95, views: 271, contacts: 11, date: 'Il y a 1 h' },
    { ref: 'MV-2477', title: 'Lampe articulée vintage', cat: 'Décoration', catKey: 'decoration', price: 85, seller: 'Christine P.', city: 'Toulouse', status: 'active', conf: 81, views: 96, contacts: 4, date: 'Hier' },
    { ref: 'MV-2476', title: 'PlayStation 5 + 2 manettes', cat: 'Électronique', catKey: 'electronique', price: 380, seller: 'Gamer P.', city: 'Lille', status: 'flagged', conf: 41, views: 88, contacts: 3, date: 'Il y a 8 h' },
    { ref: 'MV-2475', title: 'Vase Murano signé', cat: 'Art', catKey: 'art', price: 320, seller: 'Galerie S.', city: 'Paris', status: 'pending', conf: 76, views: 42, contacts: 2, date: 'Il y a 2 j' },
    { ref: 'MV-2474', title: 'Dyson Supersonic', cat: 'Électroménager', catKey: 'electromenager', price: 175, seller: 'Beauté F.', city: 'Marseille', status: 'sold', conf: 90, views: 356, contacts: 14, date: 'Il y a 2 j' },
    { ref: 'MV-2473', title: 'Fauteuil rotin', cat: 'Mobilier', catKey: 'mobilier', price: 210, seller: 'Famille L.', city: 'Rennes', status: 'review', conf: 58, views: 61, contacts: 1, date: 'Il y a 3 j' },
    { ref: 'MV-2472', title: 'Collection Astérix complète', cat: 'Livres', catKey: 'livres', price: 110, seller: 'Antoine R.', city: 'Lyon', status: 'active', conf: 84, views: 145, contacts: 5, date: 'Il y a 4 j' }
  ];

  const moderation = [
    { ref: 'MV-2480', title: 'MacBook Pro M1 2020', seller: 'Antoine R.', price: 720, conf: 64, reason: 'Photos insuffisantes', flag: 'Confiance IA sous 65 %' },
    { ref: 'MV-2473', title: 'Fauteuil rotin', seller: 'Famille L.', price: 210, conf: 58, reason: 'Catégorie à confirmer', flag: 'Confiance IA sous 65 %' },
    { ref: 'MV-2476', title: 'PlayStation 5 + 2 manettes', seller: 'Gamer P.', price: 380, conf: 41, reason: 'Signalé par 2 acheteurs', flag: 'Signalement' },
    { ref: 'MV-2475', title: 'Vase Murano signé', seller: 'Galerie S.', price: 320, conf: 76, reason: 'Prix au-dessus du référentiel', flag: 'Écart de prix' }
  ];

  const iaRows = [
    { photo: 'canape-teck.jpg', cat: 'Mobilier', state: 'Bon', brand: 'Sans marque', range: '260 — 320 €', final: 280, conf: 92, latency: '1,2 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'macbook-m1.jpg', cat: 'Électronique', state: 'Très bon', brand: 'Apple', range: '640 — 780 €', final: 720, conf: 64, latency: '1,6 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'thermomix-tm6.jpg', cat: 'Électroménager', state: 'Très bon', brand: 'Thermomix', range: '620 — 720 €', final: 680, conf: 95, latency: '1,1 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'vase-murano.jpg', cat: 'Art', state: 'Bon', brand: 'Murano', range: '280 — 360 €', final: 320, conf: 76, latency: '2,4 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'fauteuil-rotin.jpg', cat: 'Mobilier', state: 'Correct', brand: 'Sans marque', range: '180 — 240 €', final: 210, conf: 58, latency: '1,8 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'lampe-articulee.jpg', cat: 'Décoration', state: 'Bon', brand: 'Arflex', range: '70 — 100 €', final: 85, conf: 81, latency: '1,3 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'ps5-manettes.jpg', cat: 'Électronique', state: 'Correct', brand: 'Sony', range: '300 — 400 €', final: 380, conf: 41, latency: '1,9 s', model: 'mv-estimate-v2.4.1' },
    { photo: 'dyson-supersonic.jpg', cat: 'Électroménager', state: 'Très bon', brand: 'Dyson', range: '150 — 200 €', final: 175, conf: 90, latency: '1,2 s', model: 'mv-estimate-v2.4.1' }
  ];

  const activities = [
    { icon: 'banknote', tone: 'seal', text: 'Vente conclue — MacBook Pro M1', sub: 'Antoine R. vend à l’acheteur #1846 · 720 €', when: 'Il y a 5 min' },
    { icon: 'chat', tone: 'kraft', text: 'Nouveau message WhatsApp', sub: 'Christine P. — Demande d’estimation', when: 'Il y a 12 min' },
    { icon: 'user', tone: 'plain', text: 'Nouveau vendeur inscrit', sub: 'Famille L. — email vérifié', when: 'Il y a 28 min' },
    { icon: 'flag', tone: 'stamp', text: 'Annonce signalée', sub: 'PlayStation 5 + 2 manettes · 2 signalements', when: 'Il y a 1 h' },
    { icon: 'banknote', tone: 'seal', text: 'Vente conclue — Thermomix TM6', sub: 'Cuisine M. vend à l’acheteur #1845 · 680 €', when: 'Il y a 2 h' },
    { icon: 'bot', tone: 'kraft', text: 'Le chatbot a transféré à un conseiller', sub: 'Marc B. — Demande de devis complet', when: 'Il y a 3 h' },
    { icon: 'shield-check', tone: 'plain', text: 'Sceau posé sur un vendeur pro', sub: 'Galerie S. — SIRET et IBAN vérifiés', when: 'Hier' }
  ];

  const conversations = [
    { name: 'Sophie M.', initials: 'SM', preview: 'Bonjour, mon estimation est…', time: '14:23', unread: 2, state: 'bot', phone: '+33 6 12 34 56 78', channel: 'WhatsApp' },
    { name: 'Antoine R.', initials: 'AR', preview: 'Le MacBook est toujours…', time: '13:48', unread: 0, state: 'human', phone: '+33 6 23 45 67 89', channel: 'WhatsApp' },
    { name: 'Christine P.', initials: 'CP', preview: 'Merci pour votre réponse', time: '12:15', unread: 0, state: 'human', phone: '+33 6 34 56 78 90', channel: 'WhatsApp' },
    { name: 'Cuisine M.', initials: 'CM', preview: 'Je voudrais baisser le prix…', time: '11:42', unread: 1, state: 'bot', phone: '+33 6 11 22 33 44', channel: 'WhatsApp' },
    { name: 'Julien D.', initials: 'JD', preview: 'Combien de temps pour publier ?', time: '10:30', unread: 0, state: 'bot', phone: '+33 6 45 67 89 01', channel: 'Chat web' },
    { name: 'Famille L.', initials: 'FL', preview: 'OK pour le retrait demain', time: 'Hier', unread: 0, state: 'human', phone: '+33 6 67 89 01 23', channel: 'WhatsApp' },
    { name: 'Galerie S.', initials: 'GS', preview: 'Le vase est signé…', time: 'Hier', unread: 0, state: 'human', phone: '+33 6 78 90 12 34', channel: 'Email' },
    { name: 'Marc B.', initials: 'MB', preview: 'Je veux un devis complet', time: '2 j', unread: 0, state: 'bot', phone: '+33 6 56 78 90 12', channel: 'WhatsApp' }
  ];

  const charts = {
    revenue: {
      labels: ['22 sept.', '25', '28', '1 oct.', '4', '7', '10', '13', '16', '19', '21 oct.'],
      values: [12400, 13850, 13120, 14640, 14280, 15920, 15460, 17180, 16840, 18240, 17960, 19380, 18740, 20480, 19960, 21420, 20880, 22640, 21980, 23720, 23180, 24860, 24340, 26120, 25480, 27460, 26820, 28940, 28360, 31240]
    },
    categories: [
      { label: 'Mobilier', value: 4200, color: 'var(--kraft-500)' },
      { label: 'Électronique', value: 2800, color: 'var(--stamp-500)' },
      { label: 'Électroménager', value: 1900, color: 'var(--seal-500)' },
      { label: 'Décoration', value: 1500, color: 'var(--kraft-700)' },
      { label: 'Vêtements', value: 1100, color: 'var(--info-500)' },
      { label: 'Autres', value: 980, color: 'var(--ink-400)' }
    ],
    sources: [
      { label: 'Recherche Google', value: 42, color: 'var(--seal-500)' },
      { label: 'WhatsApp', value: 28, color: 'var(--whatsapp)' },
      { label: 'Accès direct', value: 15, color: 'var(--stamp-500)' },
      { label: 'Réseaux sociaux', value: 10, color: 'var(--kraft-500)' },
      { label: 'Publicités', value: 5, color: 'var(--info-500)' }
    ],
    devices: [
      { label: 'Mobile', value: 68, color: 'var(--stamp-500)' },
      { label: 'Poste fixe', value: 27, color: 'var(--seal-500)' },
      { label: 'Tablette', value: 5, color: 'var(--kraft-500)' }
    ],
    cities: [
      { label: 'Paris', value: 3240 },
      { label: 'Lyon', value: 2180 },
      { label: 'Bordeaux', value: 1920 },
      { label: 'Marseille', value: 1540 },
      { label: 'Nantes', value: 1120 },
      { label: 'Toulouse', value: 980 }
    ],
    funnel: [
      { label: 'Visites', value: 24580, pct: 100, color: 'var(--ink-700)' },
      { label: 'Estimations lancées', value: 7866, pct: 32, color: 'var(--kraft-500)' },
      { label: 'Annonces créées', value: 4424, pct: 18, color: 'var(--kraft-700)' },
      { label: 'Contacts reçus', value: 2950, pct: 12, color: 'var(--warn-500)' },
      { label: 'Ventes conclues', value: 2065, pct: 8.4, color: 'var(--seal-500)' }
    ],
    escrow: [
      { label: 'En attente', value: 8, color: 'var(--ink-300)' },
      { label: 'En séquestre', value: 11, color: 'var(--kraft-500)' },
      { label: 'En livraison', value: 6, color: 'var(--info-500)' },
      { label: 'Validé', value: 4, color: 'var(--seal-500)' },
      { label: 'Versé', value: 68, color: 'var(--stamp-500)' }
    ]
  };

  /* ------------------------------------------------------------------ */
  /* Utilitaires de rendu                                                 */
  /* ------------------------------------------------------------------ */

  const euro = n => n.toLocaleString('fr-FR') + ' €';

  const statusMap = {
    active: { label: 'En ligne', cls: 'status--seal' },
    pending: { label: 'En attente', cls: 'status--warn' },
    sold: { label: 'Vendue', cls: 'status--ink' },
    review: { label: 'À contrôler', cls: 'status--stamp' },
    flagged: { label: 'Signalée', cls: 'status--stamp' }
  };

  function confCell(value) {
    const tone = value >= 80 ? '' : value >= 65 ? ' conf__fill--warn' : ' conf__fill--low';
    return `<span class="conf"><span class="conf__bar"><span class="conf__fill${tone}" style="width:${value}%"></span></span><span class="conf__val">${value} %</span></span>`;
  }

  function statusCell(key) {
    const s = statusMap[key] || statusMap.active;
    return `<span class="status ${s.cls}"><span class="status__dot"></span>${s.label}</span>`;
  }

  function toast(message, type) {
    if (typeof window.mvToast === 'function') {
      window.mvToast(message, type || 'success');
      return;
    }
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'success');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  /* ------------------------------------------------------------------ */
  /* Navigation : état actif + tiroir                                     */
  /* ------------------------------------------------------------------ */

  function markActiveNav() {
    const key = document.body.dataset.nav;
    if (!key) return;
    $$('.admin-nav a[data-nav]').forEach(a => {
      a.classList.toggle('is-active', a.dataset.nav === key);
    });
  }

  function setupDrawer() {
    const sidebar = $('.admin-sidebar');
    const toggle = $('.admin-header__menu');
    if (!sidebar || !toggle) return;

    const close = () => {
      sidebar.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      const scrim = $('.admin-scrim');
      if (scrim) scrim.remove();
    };

    toggle.addEventListener('click', () => {
      const open = !sidebar.classList.contains('is-open');
      sidebar.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
      if (open) {
        const scrim = document.createElement('div');
        scrim.className = 'admin-scrim';
        scrim.addEventListener('click', close);
        document.body.appendChild(scrim);
      } else {
        close();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Toggles, chips, segments, réglages                                   */
  /* ------------------------------------------------------------------ */

  function setupToggles() {
    $$('.toggle').forEach(t => {
      if (!t.hasAttribute('role')) t.setAttribute('role', 'switch');
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '0');
      const sync = () => t.setAttribute('aria-checked', t.classList.contains('is-on') ? 'true' : 'false');
      sync();
      const flip = () => { t.classList.toggle('is-on'); sync(); };
      t.addEventListener('click', flip);
      t.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
      });
    });
  }

  function setupChips() {
    $$('[data-chip-group]').forEach(group => {
      const chips = $$('.chip', group);
      chips.forEach(chip => chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        group.dispatchEvent(new CustomEvent('chip:change', { detail: chip.dataset.chip }));
      }));
    });
  }

  function setupSegments() {
    $$('.seg').forEach(seg => {
      const buttons = $$('button', seg);
      buttons.forEach(btn => btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        seg.dispatchEvent(new CustomEvent('seg:change', { detail: btn.dataset.value }));
      }));
    });
  }

  function setupSettingsNav() {
    const nav = $('.settings-nav');
    if (!nav) return;
    $$('a', nav).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      $$('a', nav).forEach(b => b.classList.remove('is-active'));
      a.classList.add('is-active');
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }

  function setupSaveButtons() {
    $$('[data-action="save"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const label = btn.dataset.label || 'Enregistrer';
        toast(label + ' — carnet mis à jour', 'success');
      });
    });
    $$('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const src = document.querySelector(btn.dataset.copy);
        if (!src) return;
        const value = src.value || src.textContent || '';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(() => toast('Copié dans le presse-papiers', 'success'), () => {});
        } else {
          toast('Copie manuelle : ' + value, 'info');
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Table des annonces + filtres                                         */
  /* ------------------------------------------------------------------ */

  function setupListings() {
    const tbody = $('#listings-tbody');
    if (!tbody) return;

    const search = $('#filter-search');
    const cat = $('#filter-cat');
    const status = $('#filter-status');
    const counter = $('#listing-count');
    const chipGroup = $('[data-chip-group="listing"]');
    let chipFilter = 'all';

    function render() {
      const q = (search && search.value || '').trim().toLowerCase();
      const c = cat && cat.value || '';
      const s = status && status.value || '';

      const rows = listings.filter(l => {
        const matchQ = !q || (l.title + ' ' + l.seller + ' ' + l.ref + ' ' + l.city).toLowerCase().includes(q);
        const matchC = !c || l.catKey === c;
        const matchS = !s || l.status === s;
        const matchChip = chipFilter === 'all' || l.status === chipFilter;
        return matchQ && matchC && matchS && matchChip;
      });

      tbody.innerHTML = rows.length ? rows.map(l => `
        <tr data-status="${l.status}" data-cat="${l.catKey}" data-ref="${l.ref}">
          <td><input type="checkbox" data-row-check></td>
          <td>
            <strong>${l.title}</strong>
            <span class="sub">${l.ref} · ${l.cat} · ${l.city}</span>
          </td>
          <td class="num">${euro(l.price)}</td>
          <td>${l.seller}</td>
          <td>${confCell(l.conf)}</td>
          <td>${statusCell(l.status)}</td>
          <td class="num">${l.views} / ${l.contacts}</td>
          <td>${l.date}</td>
          <td class="cell-actions">
            <button class="btn btn--quiet btn--sm" title="Ouvrir la fiche">${icon('eye')}</button>
            <button class="btn btn--quiet btn--sm" title="Mettre en avant">${icon('bookmark')}</button>
            <button class="btn btn--quiet btn--sm" title="Modifier">${icon('edit')}</button>
          </td>
        </tr>`).join('')
        : `<tr><td colspan="9" style="padding:2rem 1rem;text-align:center;color:var(--ink-500)">Aucune annonce ne correspond à ces critères.</td></tr>`;

      if (counter) counter.textContent = rows.length;
      updateSelection();
    }

    function updateSelection() {
      const sel = $('#selection-count');
      if (!sel) return;
      const n = $$('[data-row-check]:checked', tbody).length;
      sel.textContent = 'Sélection : ' + n;
    }

    tbody.addEventListener('change', e => {
      if (e.target.matches('[data-row-check]')) updateSelection();
    });

    [search, cat, status].forEach(el => {
      if (!el) return;
      el.addEventListener('input', render);
      el.addEventListener('change', render);
    });

    if (chipGroup) {
      chipGroup.addEventListener('chip:change', e => {
        chipFilter = e.detail || 'all';
        render();
      });
    }

    render();
  }

  /* ------------------------------------------------------------------ */
  /* File de modération                                                    */
  /* ------------------------------------------------------------------ */

  function renderModeration() {
    const tbody = $('#moderation-tbody');
    if (!tbody) return;
    tbody.innerHTML = moderation.map(m => `
      <tr>
        <td><strong>${m.title}</strong><span class="sub">${m.ref} · ${m.seller}</span></td>
        <td class="num">${euro(m.price)}</td>
        <td>${confCell(m.conf)}</td>
        <td><span class="status status--warn"><span class="status__dot"></span>${m.flag}</span><span class="sub">${m.reason}</span></td>
        <td class="cell-actions">
          <button class="btn btn--ghost btn--sm">${icon('eye')} Examiner</button>
          <button class="btn btn--quiet btn--sm" title="Refuser">${icon('close')}</button>
        </td>
      </tr>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Activité récente                                                      */
  /* ------------------------------------------------------------------ */

  function renderActivity() {
    const feed = $('#activity-feed');
    if (!feed) return;
    feed.innerHTML = activities.map(a => {
      const tone = a.tone === 'seal' ? 'status--seal' : a.tone === 'stamp' ? 'status--stamp' : a.tone === 'kraft' ? 'status--kraft' : '';
      return `
      <div class="timeline__row">
        <div class="timeline__ic"><span class="status ${tone}"><span class="status__dot"></span>${icon(a.icon)}</span></div>
        <div>
          <div class="timeline__t">${a.text}</div>
          <div class="timeline__s">${a.sub}</div>
        </div>
        <div class="timeline__w">${a.when}</div>
      </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Dernières estimations IA                                              */
  /* ------------------------------------------------------------------ */

  function renderIaRows() {
    const tbody = $('#ia-rows');
    if (!tbody) return;
    tbody.innerHTML = iaRows.map(r => `
      <tr>
        <td><strong>${r.photo}</strong></td>
        <td>${r.cat}</td>
        <td>${r.state}</td>
        <td>${r.brand}</td>
        <td class="num">${r.range}</td>
        <td class="num"><strong>${euro(r.final)}</strong></td>
        <td>${confCell(r.conf)}</td>
        <td class="num">${r.latency}</td>
        <td>${r.model}</td>
      </tr>`).join('');
  }

  /* ------------------------------------------------------------------ */
  /* Messagerie : liste + fil + passage du bot à l’humain                       */
  /* ------------------------------------------------------------------ */

  function setupChat() {
    const list = $('#chat-list');
    const msgs = $('#chat-messages');
    if (!list) return;

    const nameEl = $('#chat-name');
    const metaEl = $('#chat-meta');
    const modeEl = $('#chat-mode');
    const badgeEl = $('#chat-state');
    const avatarEl = $('#chat-avatar');

    function renderThread(i) {
      const c = conversations[i];
      if (nameEl) nameEl.textContent = c.name;
      if (metaEl) metaEl.textContent = c.phone + ' · ' + c.channel;
      if (avatarEl) avatarEl.textContent = c.initials;
      if (badgeEl) {
        badgeEl.textContent = c.state === 'bot' ? 'Bot actif' : 'Conseiller en poste';
        badgeEl.className = 'badge ' + (c.state === 'bot' ? 'badge--kraft' : 'badge--seal');
      }
      if (!msgs) return;

      const handover = c.state === 'bot'
        ? `<div class="chat__handover">${icon('bot')} Bot actif — transfert automatique vers un conseiller si la confiance est faible</div>`
        : `<div class="chat__handover">${icon('check-circle')} Transféré à un conseiller humain — réponse sous 2 min</div>`;

      msgs.innerHTML = `
        <div class="chat__msg chat__msg--in">
          <div class="chat__bubble chat__bubble--bot">Bonjour ${c.name.split(' ')[0]}, je suis l’assistant MaisonVide. Dites-moi ce que vous souhaitez estimer…</div>
          <div class="chat__time">14:21</div>
        </div>
        <div class="chat__msg chat__msg--out">
          <div class="chat__bubble">${c.preview}</div>
          <div class="chat__time">14:23</div>
        </div>
        ${handover}
        <div class="chat__msg chat__msg--in">
          <div class="chat__bubble chat__bubble--bot">D’après notre relevé, votre objet est estimé entre 260 et 320 €. Confiance 92 %. Souhaitez-vous que je dépose l’annonce ?</div>
          <div class="chat__time">14:23</div>
        </div>`;
    }

    list.innerHTML = conversations.map((c, i) => `
      <button class="chat__item${i === 0 ? ' is-active' : ''}" data-i="${i}">
        <span class="chat__av">${c.initials}</span>
        <span>
          <span class="chat__name">${c.name}</span>
          <span class="chat__preview">${c.preview}</span>
        </span>
        <span class="chat__meta">${c.time}${c.unread ? `<span class="chat__unread">${c.unread}</span>` : ''}</span>
      </button>`).join('');

    list.addEventListener('click', e => {
      const item = e.target.closest('.chat__item');
      if (!item) return;
      $$('.chat__item', list).forEach(b => b.classList.remove('is-active'));
      item.classList.add('is-active');
      renderThread(Number(item.dataset.i));
    });

    if (modeEl) {
      modeEl.addEventListener('seg:change', e => {
        const human = e.detail === 'human';
        if (badgeEl) {
          badgeEl.textContent = human ? 'Conseiller en poste' : 'Bot actif';
          badgeEl.className = 'badge ' + (human ? 'badge--seal' : 'badge--kraft');
        }
        if (msgs) {
          const note = document.createElement('div');
          note.className = 'chat__handover';
          note.innerHTML = human
            ? icon('user') + ' Reprise en main par un conseiller — le bot est en veille'
            : icon('bot') + ' Bot de nouveau actif — les messages partiront automatiquement';
          msgs.appendChild(note);
          msgs.scrollTop = msgs.scrollHeight;
        }
      });
    }

    const form = $('#chat-form');
    if (form && msgs) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const input = form.querySelector('input');
        if (!input || !input.value.trim()) return;
        const el = document.createElement('div');
        el.className = 'chat__msg chat__msg--out';
        const time = new Date().toTimeString().slice(0, 5);
        el.innerHTML = '<div class="chat__bubble">' + input.value.replace(/</g, '&lt;') + '</div><div class="chat__time">' + time + '</div>';
        msgs.appendChild(el);
        input.value = '';
        msgs.scrollTop = msgs.scrollHeight;
      });
    }

    renderThread(0);
  }

  /* ------------------------------------------------------------------ */
  /* Graphiques SVG                                                        */
  /* ------------------------------------------------------------------ */

  const SVGNS = 'http://www.w3.org/2000/svg';

  function svgEl(name, attrs, parent) {
    const node = document.createElementNS(SVGNS, name);
    for (const key in attrs) {
      if (attrs[key] === null || attrs[key] === undefined) continue;
      node.setAttribute(key, attrs[key]);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* --- Courbe (ligne + aire) --- */
  function drawLine(host, cfg) {
    clear(host);
    const w = cfg.width || 760;
    const h = cfg.height || 260;
    const pad = { t: 14, r: 16, b: 26, l: 52 };
    const values = cfg.values;
    const max = Math.max.apply(null, values);
    const min = 0;
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const x = i => pad.l + (values.length === 1 ? iw / 2 : (i / (values.length - 1)) * iw);
    const y = v => pad.t + ih - ((v - min) / (max - min)) * ih;

    const svg = svgEl('svg', {
      class: 'chart', viewBox: `0 0 ${w} ${h}`,
      preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': cfg.label || 'Courbe'
    }, host);

    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (ih / 4) * g;
      svgEl('line', { class: 'grid-line', x1: pad.l, x2: w - pad.r, y1: gy, y2: gy }, svg);
      const val = max - ((max - min) / 4) * g;
      svgEl('text', { class: 'tick--mono', x: pad.l - 8, y: gy + 3, 'text-anchor': 'end' }, svg)
        .textContent = (cfg.format ? cfg.format(val) : Math.round(val));
    }

    const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
    svgEl('path', {
      d: `${line} L${x(values.length - 1).toFixed(1)} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z`,
      fill: cfg.fill || 'var(--kraft-100)', opacity: '.55'
    }, svg);
    svgEl('path', { class: 'series-line', d: line, stroke: cfg.color || 'var(--stamp-500)' }, svg);

    values.forEach((v, i) => {
      if (i !== values.length - 1 && i % 2 !== 0) return;
      svgEl('circle', { class: 'series-dot', cx: x(i), cy: y(v), r: i === values.length - 1 ? 3.4 : 2.2, fill: cfg.color || 'var(--stamp-500)' }, svg);
    });

    const labels = cfg.labels || [];
    const step = Math.max(1, Math.ceil(labels.length / 7));
    labels.forEach((label, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      svgEl('text', { class: 'tick', x: x(i), y: h - 8, 'text-anchor': 'middle' }, svg).textContent = label;
    });

    svgEl('line', { class: 'axis-line', x1: pad.l, x2: w - pad.r, y1: pad.t + ih, y2: pad.t + ih }, svg);
  }

  /* --- Barres verticales --- */
  function drawBars(host, cfg) {
    clear(host);
    const w = cfg.width || 760;
    const h = cfg.height || 240;
    const pad = { t: 14, r: 10, b: 34, l: 46 };
    const items = cfg.items;
    const max = Math.max.apply(null, items.map(i => i.value));
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const slot = iw / items.length;
    const bw = Math.min(cfg.barWidth || 26, slot - 6);

    const svg = svgEl('svg', {
      class: 'chart', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': cfg.label || 'Histogramme'
    }, host);

    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (ih / 4) * g;
      svgEl('line', { class: 'grid-line', x1: pad.l, x2: w - pad.r, y1: gy, y2: gy }, svg);
      const val = max - (max / 4) * g;
      svgEl('text', { class: 'tick--mono', x: pad.l - 8, y: gy + 3, 'text-anchor': 'end' }, svg)
        .textContent = (cfg.format ? cfg.format(val) : Math.round(val));
    }

    items.forEach((item, i) => {
      const bh = Math.max(2, (item.value / max) * ih);
      const bx = pad.l + slot * i + (slot - bw) / 2;
      const by = pad.t + ih - bh;
      svgEl('rect', {
        x: bx.toFixed(1), y: by.toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1),
        rx: 2, fill: item.color || cfg.color || 'var(--kraft-500)'
      }, svg);
      svgEl('text', { class: 'tick', x: (bx + bw / 2).toFixed(1), y: h - 16, 'text-anchor': 'middle' }, svg)
        .textContent = item.label;
      if (cfg.values) {
        svgEl('text', { class: 'tick--mono', x: (bx + bw / 2).toFixed(1), y: by - 5, 'text-anchor': 'middle' }, svg)
          .textContent = cfg.format ? cfg.format(item.value) : item.value;
      }
    });

    svgEl('line', { class: 'axis-line', x1: pad.l, x2: w - pad.r, y1: pad.t + ih, y2: pad.t + ih }, svg);
  }

  /* --- Donut --- */
  function drawDonut(host, cfg) {
    clear(host);
    const size = cfg.size || 190;
    const thick = cfg.thickness || 26;
    const r = (size - thick) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    const total = cfg.items.reduce((a, i) => a + i.value, 0);

    const svg = svgEl('svg', {
      class: 'chart', viewBox: `0 0 ${size} ${size}`, width: size, height: size,
      role: 'img', 'aria-label': cfg.label || 'Répartition'
    }, host);

    svgEl('circle', { cx, cy, r, fill: 'none', stroke: 'var(--paper-ground)', 'stroke-width': thick }, svg);

    let offset = 0;
    cfg.items.forEach(item => {
      const len = (item.value / total) * circ;
      svgEl('circle', {
        cx, cy, r, fill: 'none',
        stroke: item.color,
        'stroke-width': thick,
        'stroke-dasharray': `${len.toFixed(2)} ${(circ - len).toFixed(2)}`,
        'stroke-dashoffset': (-offset).toFixed(2),
        transform: `rotate(-90 ${cx} ${cy})`
      }, svg);
      offset += len;
    });

    if (cfg.centerValue) {
      svgEl('text', {
        x: cx, y: cy - 1, 'text-anchor': 'middle',
        style: 'font-family:var(--font-mono);font-size:20px;font-weight:700;fill:var(--ink-900)'
      }, svg).textContent = cfg.centerValue;
      svgEl('text', {
        x: cx, y: cy + 15, 'text-anchor': 'middle',
        style: 'font-family:var(--font-body);font-size:9.5px;fill:var(--ink-500)'
      }, svg).textContent = cfg.centerLabel || '';
    }
  }

  /* --- Barres horizontales (top villes, sources) --- */
  function drawHBars(host, cfg) {
    clear(host);
    const w = cfg.width || 420;
    const rowH = cfg.rowH || 30;
    const h = cfg.items.length * rowH + 8;
    const labelW = cfg.labelW || 128;
    const valueW = 68;
    const max = Math.max.apply(null, cfg.items.map(i => i.value));
    const iw = w - labelW - valueW - 10;

    const svg = svgEl('svg', {
      class: 'chart', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': cfg.label || 'Classement'
    }, host);

    cfg.items.forEach((item, i) => {
      const y = i * rowH + 6;
      svgEl('text', { class: 'tick', x: 0, y: y + 12 }, svg).textContent = item.label;
      svgEl('rect', { x: labelW, y: y + 2, width: iw, height: 13, fill: 'var(--paper-ground)', stroke: 'var(--paper-rule)', rx: 2 }, svg);
      svgEl('rect', {
        x: labelW, y: y + 2, width: Math.max(2, (item.value / max) * iw), height: 13,
        fill: item.color || cfg.color || 'var(--seal-500)', rx: 2
      }, svg);
      svgEl('text', { class: 'tick--mono', x: w, y: y + 12, 'text-anchor': 'end' }, svg)
        .textContent = cfg.format ? cfg.format(item.value) : item.value;
    });
  }

  /* --- Entonnoir --- */
  function renderFunnel(host) {
    if (!host) return;
    host.innerHTML = charts.funnel.map(step => `
      <div class="funnel__row">
        <span class="funnel__k">${step.label}</span>
        <span class="funnel__track"><span class="funnel__fill" style="width:${step.pct}%;background:${step.color}"></span></span>
        <span class="funnel__v">${step.value.toLocaleString('fr-FR')} · ${step.pct} %</span>
      </div>`).join('');
  }

  function setupCharts() {
    const rev = $('#chart-revenue');
    if (rev) drawLine(rev, {
      values: charts.revenue.values,
      labels: charts.revenue.labels,
      color: 'var(--stamp-500)',
      fill: 'var(--kraft-100)',
      format: v => (Math.round(v / 1000) + ' k').replace('.', ',') + ' €',
      label: 'Revenus des 30 derniers jours'
    });

    const bar = $('#chart-bar');
    if (bar) drawBars(bar, {
      items: charts.categories.map((c, i) => ({
        label: c.label.split(' ')[0].slice(0, 6),
        value: c.value,
        color: c.color
      })),
      color: 'var(--kraft-500)',
      format: v => (Math.round(v / 1000)) + ' k',
      label: 'Revenus par catégorie'
    });

    const donut = $('#chart-donut');
    if (donut) drawDonut(donut, {
      items: charts.categories,
      centerValue: '12,5 k€',
      centerLabel: 'CA 30 jours',
      label: 'Répartition des revenus par catégorie'
    });

    const escrow = $('#chart-escrow');
    if (escrow) drawDonut(escrow, {
      items: charts.escrow,
      centerValue: '97',
      centerLabel: 'commandes 30 j',
      label: 'État des séquestres'
    });

    const cities = $('#chart-cities');
    if (cities) drawHBars(cities, {
      items: charts.cities,
      color: 'var(--seal-500)',
      format: v => v.toLocaleString('fr-FR') + ' €',
      label: 'Top villes'
    });

    const sources = $('#chart-sources');
    if (sources) drawHBars(sources, {
      items: charts.sources,
      format: v => v + ' %',
      label: 'Sources de trafic'
    });

    const devices = $('#chart-devices');
    if (devices) drawDonut(devices, {
      items: charts.devices,
      size: 160,
      centerValue: '68 %',
      centerLabel: 'mobile',
      label: 'Répartition des appareils'
    });

    renderFunnel($('#funnel'));
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                 */
  /* ------------------------------------------------------------------ */

  function boot() {
    injectSprite();
    markActiveNav();
    setupDrawer();
    setupToggles();
    setupChips();
    setupSegments();
    setupSettingsNav();
    setupSaveButtons();
    setupListings();
    renderModeration();
    renderActivity();
    renderIaRows();
    setupChat();
    setupCharts();
  }

  /* On écoute sur window, comme core.js : le gestionnaire de window s'exécute
     après celui de document, donc après la réécriture des <use> par core.js —
     on peut ainsi pointer chaque icône vers son symbole local. */
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
