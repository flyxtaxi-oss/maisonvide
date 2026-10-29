/* ==========================================================================
   MaisonVide — Espace pro (vendeur)
   Connexion, relevé des KPI, graphiques SVG dessinés à la main, leads,
   rendez-vous, séquestre et créneaux de disponibilité.
   Aucune dépendance, aucun build : tout est rendu dans le document.
   ========================================================================== */
(function () {
  'use strict';

  /* API : relative en production. Pour un test local, remplacer par
     'https://maisonvide.vercel.app' (l'API n'existe pas sur le serveur local). */
  // Les fonctions serverless vivent sur Vercel : en local, on interroge
  // l'API déployée pour que la démo fonctionne hors production.
  // Aucune clé n'est exposée — l'API est publique et ne renvoie que des
  // données déjà lisibles par le navigateur.
  const API_BASE = /^(127\.0\.0\.1|localhost)$/.test(location.hostname)
    ? 'https://maisonvide.vercel.app'
    : '';
  const TOKEN_KEY = 'mv_pro_token';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ------------------------------------------------------------------ */
  /* Outils de format                                                    */
  /* ------------------------------------------------------------------ */
  const nf = new Intl.NumberFormat('fr-FR');
  const dLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const dCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const dMois = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });
  const dHeure = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  const STATUTS_ANNONCE = {
    active: 'En ligne', sold: 'Vendue', pending: 'En attente', reserved: 'Réservée',
    draft: 'Brouillon', archived: 'Archivée', rejected: 'Refusée', expired: 'Expirée',
  };
  const STATUTS_RDV = {
    requested: 'À confirmer', confirmed: 'Confirmé', declined: 'Refusé',
    cancelled: 'Annulé', done: 'Terminé',
  };
  const STATUTS_TX = {
    escrow: 'Séquestre', paid: 'Payée', shipped: 'Expédiée', received: 'Reçue',
    refunded: 'Remboursée', cancelled: 'Annulée', pending: 'En cours',
  };
  const CANAUX = { web: 'Site web', whatsapp: 'WhatsApp', email: 'E-mail', phone: 'Téléphone', chat: 'Chat' };
  const TIERS = { basic: 'Particulier', pro: 'Pro', premium: 'Premium' };

  const state = { data: null, slots: [] };

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function num(v) { return nf.format(Number(v || 0)); }

  function eur(v) { return nf.format(Math.round(Number(v || 0))) + ' €'; }

  function eurCourt(v) {
    const n = Number(v || 0);
    if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + ' k€';
    return num(Math.round(n)) + ' €';
  }

  function dateFr(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : dLong.format(d);
  }

  function dateHeureFr(v) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : dHeure.format(d);
  }

  function relatifFr(v) {
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 0) return dHeure.format(d);
    if (diff < 3600) return 'il y a ' + Math.max(1, Math.round(diff / 60)) + ' min';
    if (diff < 86400) return 'il y a ' + Math.round(diff / 3600) + ' h';
    if (diff < 172800) return 'hier, ' + dHeure.format(d);
    return dCourt.format(d);
  }

  function moisFr(m) {
    const parts = String(m || '').split('-');
    if (parts.length < 2) return String(m || '');
    const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, 1));
    return isNaN(d.getTime()) ? String(m) : dMois.format(d);
  }

  function heureLabel(minutes) {
    const m = Number(minutes || 0);
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min ? h + ' h ' + String(min).padStart(2, '0') : h + ' h';
  }

  function minutesDe(valeur) {
    const parts = String(valeur || '').split(':');
    if (parts.length < 2) return NaN;
    const h = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isInteger(h) || !Number.isInteger(m)) return NaN;
    return h * 60 + m;
  }

  function badge(label, tone) {
    const classes = {
      seal: ' badge--seal', stamp: ' badge--stamp', kraft: ' badge--kraft', warn: ' badge--warn',
    };
    return '<span class="badge' + (classes[tone] || '') + '">' + esc(label) + '</span>';
  }

  function dataSpan(valeur, extra) {
    return '<span class="data' + (extra ? ' ' + extra : '') + '">' + esc(valeur) + '</span>';
  }

  function toast(message, type) {
    if (typeof window.mvToast === 'function') window.mvToast(message, type || 'info');
  }

  /* ------------------------------------------------------------------ */
  /* Session                                                             */
  /* ------------------------------------------------------------------ */
  function jeton() {
    try { return sessionStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function memoriserJeton(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* stockage indisponible : la session ne survivra pas */ }
  }

  async function api(chemin, options) {
    const opts = options || {};
    const headers = { 'Content-Type': 'application/json' };
    const t = jeton();
    if (t) headers.Authorization = 'Bearer ' + t;

    let reponse;
    try {
      reponse = await fetch(API_BASE + chemin, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (e) {
      const err = new Error('Le serveur ne répond pas. Vérifiez votre connexion.');
      err.status = 0;
      throw err;
    }

    let charge = null;
    try { charge = await reponse.json(); } catch (e) { charge = null; }

    if (!reponse.ok) {
      const err = new Error((charge && charge.error) || 'Erreur ' + reponse.status + '.');
      err.status = reponse.status;
      throw err;
    }
    return charge || {};
  }

  /* ------------------------------------------------------------------ */
  /* Affichage : connexion / tableau de bord / états                    */
  /* ------------------------------------------------------------------ */
  function afficherVue(nom) {
    $('#vue-connexion').hidden = nom !== 'connexion';
    $('#vue-dashboard').hidden = nom !== 'dashboard';
    $('#entete-vendeur').hidden = nom !== 'dashboard';
    $('#btn-deconnexion').hidden = nom !== 'dashboard';

    /* Le rail de progression n'a de sens que sur le relevé. */
    const rail = document.querySelector('.scroll-rail');
    if (rail) rail.style.display = nom === 'dashboard' ? '' : 'none';
    document.body.classList.toggle('has-rail', nom === 'dashboard');
  }

  /* Demande au rail de recalculer son libellé de section. */
  function recalerRail() {
    window.dispatchEvent(new Event('scroll'));
  }

  function message(cible, texte, erreur) {
    const el = $(cible);
    if (!el) return;
    if (!texte) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = texte;
    el.classList.toggle('pro-message--erreur', !!erreur);
  }

  function etat(mode, texte) {
    const boite = $('#pro-etat');
    const contenu = $('#pro-contenu');
    if (mode === 'ok') {
      boite.hidden = true;
      contenu.hidden = false;
      return;
    }
    boite.hidden = false;
    contenu.hidden = true;
    $('#pro-etat-chargement').hidden = mode !== 'chargement';
    $('#pro-etat-erreur').hidden = mode !== 'erreur';
    if (texte) $('#pro-etat-message').textContent = texte;
  }

  /* ------------------------------------------------------------------ */
  /* Connexion                                                           */
  /* ------------------------------------------------------------------ */
  function occupation(bouton, action) {
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Un instant…';
    return Promise.resolve()
      .then(action)
      .catch(function (err) { message('#auth-message', err.message, true); })
      .then(function () {
        bouton.disabled = false;
        bouton.textContent = libelle;
      });
  }

  $('#form-connexion').addEventListener('submit', function (e) {
    e.preventDefault();
    message('#auth-message', '', false);
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    occupation($('#btn-connexion'), async function () {
      const data = await api('/api/auth', {
        method: 'POST',
        body: { action: 'login', email, password },
      });
      memoriserJeton(data.token);
      await chargerTableau();
    });
  });

  // Raccourci de démonstration : /pro.html?auto=1 ouvre directement le
  // tableau de bord avec le compte de démonstration. Sans effet lors d'une
  // navigation normale.
  if (/[?&]auto=1/.test(location.search)) {
    $('#login-email').value = 'cuisine.m@example.fr';
    $('#login-password').value = 'maisonvide';
    $('#form-connexion').dispatchEvent(new Event('submit', { cancelable: true }));
  }

  $('#form-inscription').addEventListener('submit', function (e) {
    e.preventDefault();
    message('#auth-message', '', false);
    const body = {
      action: 'register',
      name: $('#reg-name').value.trim(),
      email: $('#reg-email').value.trim(),
      password: $('#reg-password').value,
      phone: $('#reg-phone').value.trim(),
    };
    occupation($('#btn-inscription'), async function () {
      const data = await api('/api/auth', { method: 'POST', body });
      memoriserJeton(data.token);
      await chargerTableau();
    });
  });

  $('#bascule-inscription').addEventListener('click', function () {
    $('#form-connexion').hidden = true;
    $('#form-inscription').hidden = false;
    this.hidden = true;
    message('#auth-message', '', false);
    $('#reg-name').focus();
  });

  $('#bascule-connexion').addEventListener('click', function () {
    $('#form-inscription').hidden = true;
    $('#form-connexion').hidden = false;
    $('#bascule-inscription').hidden = false;
    this.hidden = true;
    message('#auth-message', '', false);
    $('#login-email').focus();
  });

  $$('[data-demo-email]').forEach(function (bouton) {
    bouton.addEventListener('click', function () {
      $('#login-email').value = bouton.dataset.demoEmail;
      $('#login-password').value = bouton.dataset.demoPass;
      $('#form-inscription').hidden = true;
      $('#bascule-inscription').hidden = false;
      message('#auth-message', '', false);
      $('#btn-connexion').focus();
    });
  });

  $('#btn-deconnexion').addEventListener('click', function () {
    memoriserJeton(null);
    state.data = null;
    state.slots = [];
    afficherVue('connexion');
    $('#form-connexion').reset();
    $('#form-inscription').reset();
    message('#auth-message', '', false);
    window.scrollTo(0, 0);
  });

  $('#btn-reessayer').addEventListener('click', function () { chargerTableau(); });

  /* ------------------------------------------------------------------ */
  /* Chargement du relevé                                                */
  /* ------------------------------------------------------------------ */
  async function chargerTableau() {
    afficherVue('dashboard');
    etat('chargement');
    try {
      const data = await api('/api/pro');
      state.data = data;
      rendreTout(data);
      etat('ok');

      /* Les créneaux passent par leur API dédiée ; en cas d'échec, on
         garde la copie reçue avec /api/pro et on le dit. */
      try {
        const slots = await api('/api/slots');
        state.slots = slots.slots || [];
        message('#creneaux-message', '', false);
      } catch (err) {
        state.slots = data.slots || [];
        message('#creneaux-message',
          'Les créneaux n’ont pas pu être rafraîchis depuis /api/slots. Dernière copie connue affichée.',
          true);
      }
      rendreCreneaux();
      rendreKpis(data);
      recalerRail();
    } catch (err) {
      if (err.status === 401) {
        memoriserJeton(null);
        afficherVue('connexion');
        message('#auth-message', 'Votre session a expiré. Reconnectez-vous.', true);
      } else {
        etat('erreur', err.message);
      }
    }
  }

  function rendreTout(data) {
    rendreProfil(data);
    rendreKpis(data);
    dessinerTrafic($('#graph-trafic'), data.series || []);
    dessinerCA($('#graph-ca'), data.series || []);
    rendreAnnonces(data);
    rendreLeads(data);
    rendreRendezVous(data);
    rendreTransactions(data);
  }

  /* ------------------------------------------------------------------ */
  /* En-tête vendeur                                                      */
  /* ------------------------------------------------------------------ */
  function rendreProfil(data) {
    const p = data.profile || {};
    const k = data.kpis || {};
    $('#pro-nom').textContent = p.name || 'Vendeur MaisonVide';
    $('#pro-lieu').innerHTML = (window.mvIcon ? window.mvIcon('pin', 'ic--sm') : '')
      + esc(p.city || 'Ville non renseignée');
    $('#pro-tier').textContent = TIERS[p.tier] || p.tier || '—';
    $('#pro-confiance').innerHTML = dataSpan(num(k.trustScore) + ' / 100');
    const note = Number(k.rating || 0);
    $('#pro-note').innerHTML = note
      ? dataSpan(note.toFixed(1).replace('.', ',') + ' / 5')
      : '<span class="micro">Pas encore d’avis</span>';
    const reponse = Number(k.responseTimeMin || 0);
    $('#pro-reponse').innerHTML = reponse ? dataSpan(reponse + ' min') : '<span class="micro">Non mesuré</span>';
    $('#pro-adhesion').textContent = p.memberSince ? dateFr(p.memberSince) : '—';
    $('#entete-vendeur').textContent = (p.name || '') + (p.city ? ' · ' + p.city : '');
  }

  /* ------------------------------------------------------------------ */
  /* Bandeau KPI                                                         */
  /* ------------------------------------------------------------------ */
  function variation(series, cle) {
    if (!Array.isArray(series) || series.length < 2) return null;
    const dernier = Number(series[series.length - 1][cle] || 0);
    const precedent = Number(series[series.length - 2][cle] || 0);
    if (!precedent) return null;
    const pct = Math.round(((dernier - precedent) / precedent) * 100);
    return { pct: pct, texte: (pct > 0 ? '+' : '') + pct + ' %' };
  }

  function ecrireDelta(cible, v) {
    const el = $(cible);
    if (!el) return;
    if (!v) {
      el.textContent = '';
      el.className = 'pro-kpi__delta';
      return;
    }
    el.textContent = v.texte + ' vs mois précédent';
    el.className = 'pro-kpi__delta ' + (v.pct >= 0 ? 'pro-kpi__delta--hausse' : 'pro-kpi__delta--baisse');
  }

  function rendreKpis(data) {
    const k = data.kpis || {};
    const series = data.series || [];

    $('#kpi-ca').textContent = eur(k.revenue);
    ecrireDelta('#kpi-ca-delta', variation(series, 'revenue'));
    $('#kpi-commission').textContent = eur(k.commission);
    $('#kpi-pipeline').textContent = eur(k.pipeline);
    $('#kpi-sequestre').textContent = eur(k.escrowAmount);
    const fonds = Number(k.escrowCount || 0);
    $('#kpi-sequestre-detail').textContent = fonds + (fonds > 1 ? ' fonds immobilisés' : ' fonds immobilisé');
    $('#kpi-annonces').textContent = num(k.listingsTotal);
    $('#kpi-annonces-detail').textContent = num(k.listingsActive) + ' en ligne';
    $('#kpi-creneaux').textContent = num(k.slots);
    $('#kpi-vues').textContent = num(k.views);
    $('#kpi-contacts').textContent = num(k.contacts);
    $('#kpi-rdv').textContent = num(k.appointmentsPending);
    $('#kpi-rdv-detail').textContent = num(k.appointments) + ' rendez-vous au total';
    ecrireDelta('#kpi-vues-delta', variation(series, 'views'));
    ecrireDelta('#kpi-contacts-delta', variation(series, 'contacts'));

    const phrases = [];
    phrases.push(num(k.salesCount) + (Number(k.salesCount) > 1 ? ' ventes conclues' : ' vente conclue'));
    phrases.push(num(k.conversationsOpen) + (Number(k.conversationsOpen) > 1 ? ' conversations ouvertes' : ' conversation ouverte'));
    phrases.push(num(k.conversations) + ' conversations au total');
    $('#kpi-resume').textContent = phrases.join(' · ');
  }

  /* ------------------------------------------------------------------ */
  /* Graphiques SVG (dessinés à la main, sans librairie)                 */
  /* ------------------------------------------------------------------ */
  const SVGNS = 'http://www.w3.org/2000/svg';

  function svgEl(nom, attributs, parent) {
    const noeud = document.createElementNS(SVGNS, nom);
    for (const cle in attributs) {
      if (attributs[cle] === null || attributs[cle] === undefined) continue;
      noeud.setAttribute(cle, attributs[cle]);
    }
    if (parent) parent.appendChild(noeud);
    return noeud;
  }

  function vider(noeud) {
    while (noeud && noeud.firstChild) noeud.removeChild(noeud.firstChild);
  }

  function dessinerTrafic(hote, series) {
    vider(hote);
    if (!series.length) {
      hote.innerHTML = '<p class="pro-vide">Pas encore d’historique à tracer.</p>';
      $('#legende-trafic').innerHTML = '';
      return;
    }

    const w = 760, h = 250;
    const pad = { t: 16, r: 18, b: 30, l: 56 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const vues = series.map(function (s) { return Number(s.views || 0); });
    const contacts = series.map(function (s) { return Number(s.contacts || 0); });
    const maxV = Math.max.apply(null, vues.concat([1]));
    const maxC = Math.max.apply(null, contacts.concat([1]));
    const x = function (i) { return pad.l + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw); };
    const yV = function (v) { return pad.t + ih - (v / maxV) * ih; };
    const yC = function (v) { return pad.t + ih - (v / maxC) * ih; };

    const svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': 'Évolution des vues et des contacts sur ' + series.length + ' mois',
    }, hote);

    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (ih / 4) * g;
      svgEl('line', { class: 'grid-line', x1: pad.l, x2: w - pad.r, y1: gy, y2: gy }, svg);
      const valeur = maxV - (maxV / 4) * g;
      svgEl('text', { class: 'tick--mono', x: pad.l - 8, y: gy + 3, 'text-anchor': 'end' }, svg)
        .textContent = num(Math.round(valeur));
    }

    const ligneV = vues.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yV(v).toFixed(1); }).join(' ');
    const ligneC = contacts.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yC(v).toFixed(1); }).join(' ');

    svgEl('path', {
      d: ligneV + ' L' + x(vues.length - 1).toFixed(1) + ' ' + (pad.t + ih) + ' L' + pad.l + ' ' + (pad.t + ih) + ' Z',
      fill: 'var(--kraft-100)', opacity: '.5',
    }, svg);

    svgEl('path', { class: 'series-line', d: ligneV, stroke: 'var(--seal-500)' }, svg);
    svgEl('path', { class: 'series-line series-line--dashed', d: ligneC, stroke: 'var(--stamp-500)' }, svg);

    vues.forEach(function (v, i) {
      if (i !== vues.length - 1 && i % 2 !== 0) return;
      svgEl('circle', { class: 'series-dot', cx: x(i), cy: yV(v), r: i === vues.length - 1 ? 3.4 : 2.2, fill: 'var(--seal-500)' }, svg);
    });
    contacts.forEach(function (v, i) {
      if (i !== contacts.length - 1 && i % 2 !== 0) return;
      svgEl('circle', { class: 'series-dot', cx: x(i), cy: yC(v), r: i === contacts.length - 1 ? 3.4 : 2.2, fill: 'var(--stamp-500)' }, svg);
    });

    const pas = Math.max(1, Math.ceil(series.length / 7));
    series.forEach(function (s, i) {
      if (i % pas !== 0 && i !== series.length - 1) return;
      svgEl('text', { class: 'tick', x: x(i), y: h - 8, 'text-anchor': 'middle' }, svg)
        .textContent = moisFr(s.month);
    });

    svgEl('line', { class: 'axis-line', x1: pad.l, x2: w - pad.r, y1: pad.t + ih, y2: pad.t + ih }, svg);

    $('#legende-trafic').innerHTML =
      '<span><i data-tone="vues"></i>vues · max ' + dataSpan(num(maxV)) + '</span>' +
      '<span><i data-tone="contacts"></i>contacts · max ' + dataSpan(num(maxC)) + '</span>';
  }

  function dessinerCA(hote, series) {
    vider(hote);
    const total = series.reduce(function (acc, s) { return acc + Number(s.revenue || 0); }, 0);
    $('#graph-ca-note').textContent = series.length
      ? series.length + ' mois · ' + eur(total)
      : 'aucun mois tracé';

    if (!series.length) {
      hote.innerHTML = '<p class="pro-vide">Aucune vente enregistrée pour l’instant.</p>';
      return;
    }

    const w = 760, h = 250;
    const pad = { t: 18, r: 14, b: 32, l: 56 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;
    const valeurs = series.map(function (s) { return Number(s.revenue || 0); });
    const max = Math.max.apply(null, valeurs.concat([1]));
    const pas = iw / series.length;
    const largeur = Math.min(34, pas - 10);

    const svg = svgEl('svg', {
      class: 'chart', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'xMidYMid meet',
      role: 'img', 'aria-label': 'Chiffre d’affaires par mois',
    }, hote);

    for (let g = 0; g <= 4; g++) {
      const gy = pad.t + (ih / 4) * g;
      svgEl('line', { class: 'grid-line', x1: pad.l, x2: w - pad.r, y1: gy, y2: gy }, svg);
      const valeur = max - (max / 4) * g;
      svgEl('text', { class: 'tick--mono', x: pad.l - 8, y: gy + 3, 'text-anchor': 'end' }, svg)
        .textContent = eurCourt(valeur);
    }

    valeurs.forEach(function (v, i) {
      const hauteur = Math.max(2, (v / max) * ih);
      const bx = pad.l + pas * i + (pas - largeur) / 2;
      const by = pad.t + ih - hauteur;
      svgEl('rect', {
        x: bx.toFixed(1), y: by.toFixed(1), width: largeur.toFixed(1), height: hauteur.toFixed(1),
        rx: 2, fill: i === valeurs.length - 1 ? 'var(--stamp-500)' : 'var(--kraft-500)',
      }, svg);
      if (v > 0) {
        svgEl('text', { class: 'tick--mono', x: (bx + largeur / 2).toFixed(1), y: (by - 6).toFixed(1), 'text-anchor': 'middle' }, svg)
          .textContent = eurCourt(v);
      }
      svgEl('text', { class: 'tick', x: (bx + largeur / 2).toFixed(1), y: h - 10, 'text-anchor': 'middle' }, svg)
        .textContent = moisFr(series[i].month);
    });

    svgEl('line', { class: 'axis-line', x1: pad.l, x2: w - pad.r, y1: pad.t + ih, y2: pad.t + ih }, svg);
  }

  /* ------------------------------------------------------------------ */
  /* Mes annonces                                                        */
  /* ------------------------------------------------------------------ */
  function rendreAnnonces(data) {
    const liste = data.listings || [];
    $('#annonces-lignes').innerHTML = liste.map(function (l) {
      const photo = l.photo
        ? '<img src="' + esc(l.photo) + '" alt="" loading="lazy">'
        : '<span class="pro-table__sans-photo">—</span>';
      const statut = STATUTS_ANNONCE[l.status] || l.status || '—';
      const ton = l.status === 'active' ? 'seal' : l.status === 'sold' ? 'kraft' : l.status === 'pending' ? 'warn' : '';
      return '<tr>' +
        '<td class="pro-table__photo">' + photo + '</td>' +
        '<td class="pro-table__titre">' + esc(l.title) + '</td>' +
        '<td>' + dataSpan(eur(l.price), 'data--stamp') + '</td>' +
        '<td>' + badge(statut, ton) + '</td>' +
        '<td>' + dataSpan(num(l.views)) + '</td>' +
        '<td>' + dataSpan(num(l.contacts)) + '</td>' +
        '</tr>';
    }).join('');
    $('#annonces-total').textContent = liste.length + (liste.length > 1 ? ' annonces' : ' annonce');
    $('#annonces-vide').hidden = liste.length > 0;
  }

  /* ------------------------------------------------------------------ */
  /* Leads                                                               */
  /* ------------------------------------------------------------------ */
  function rendreLeads(data) {
    const leads = data.leads || [];
    const k = data.kpis || {};
    $('#leads-liste').innerHTML = leads.map(function (c) {
      const canal = CANAUX[String(c.channel || '').toLowerCase()] || c.channel || '—';
      const ouvert = c.status === 'open';
      const etatLabel = ouvert ? 'À traiter' : (c.status === 'closed' ? 'Clôturé' : (c.status || '—'));
      return '<li class="pro-lead">' +
        '<span class="pro-lead__canal badge">' + esc(canal) + '</span>' +
        '<div class="pro-lead__qui"><b>' + esc(c.buyerName || 'Acheteur') + '</b>' +
        '<span>' + esc(c.listingTitle || 'Annonce retirée') + '</span></div>' +
        '<p class="pro-lead__msg">' + esc(c.lastBody || '—') + '</p>' +
        '<div class="pro-lead__fin"><span class="pro-lead__date">' + esc(relatifFr(c.lastMessageAt)) + '</span>' +
        badge(etatLabel, ouvert ? 'stamp' : '') + '</div>' +
        '</li>';
    }).join('');
    $('#leads-total').textContent = num(k.conversationsOpen) + ' à traiter sur ' + num(k.conversations);
    $('#leads-vide').hidden = leads.length > 0;
  }

  /* ------------------------------------------------------------------ */
  /* Rendez-vous                                                         */
  /* ------------------------------------------------------------------ */
  function rendreRendezVous(data) {
    const liste = (data.appointments || []).slice().sort(function (a, b) {
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });
    const maintenant = Date.now();
    const visibles = liste.filter(function (a) {
      const debut = new Date(a.startsAt).getTime();
      return debut >= maintenant - 3600000 || a.status === 'requested' || a.status === 'confirmed';
    });

    $('#rendez-vous-liste').innerHTML = visibles.map(function (a) {
      const actes = [];
      if (a.status === 'requested') {
        actes.push('<button class="btn btn--seal btn--sm" type="button" data-appt="' + esc(a.id) + '" data-appt-status="confirmed">Confirmer</button>');
        actes.push('<button class="btn btn--ghost btn--sm" type="button" data-appt="' + esc(a.id) + '" data-appt-status="declined">Refuser</button>');
      }
      if (a.status === 'confirmed') {
        actes.push('<button class="btn btn--kraft btn--sm" type="button" data-appt="' + esc(a.id) + '" data-appt-status="done">Terminer</button>');
      }
      const enAttente = a.status === 'requested';
      return '<li class="pro-rdv__item' + (enAttente ? ' pro-rdv__item--attente' : '') + '">' +
        '<div class="pro-rdv__quand"><b>' + esc(dateHeureFr(a.startsAt)) + '</b>' +
        '<span>' + esc(a.mode || 'visite') + ' · ' + esc(num(a.durationMinutes || 0)) + ' min</span></div>' +
        '<div class="pro-rdv__quoi"><b>' + esc(a.listingTitle || 'Annonce') + '</b>' +
        '<span>' + esc(a.buyerName || 'Acheteur') + (a.place ? ' · ' + esc(a.place) : '') + '</span></div>' +
        '<div class="pro-rdv__actes">' + badge(STATUTS_RDV[a.status] || a.status || '—', enAttente ? 'stamp' : 'seal') + actes.join('') + '</div>' +
        '</li>';
    }).join('');

    const enAttente = liste.filter(function (a) { return a.status === 'requested'; }).length;
    $('#rendez-vous-total').textContent = enAttente + ' à traiter · ' + visibles.length + ' affichés';
    $('#rendez-vous-vide').hidden = visibles.length > 0;
  }

  $('#rendez-vous-liste').addEventListener('click', function (e) {
    const bouton = e.target.closest('[data-appt-status]');
    if (!bouton) return;
    const id = bouton.dataset.appt;
    const statut = bouton.dataset.apptStatus;
    bouton.disabled = true;
    api('/api/appointments', { method: 'PATCH', body: { id: id, status: statut } })
      .then(function (data) {
        const nouveau = data && data.appointment ? data.appointment.status : statut;
        const rdv = (state.data.appointments || []).find(function (a) { return a.id === id; });
        if (rdv) rdv.status = nouveau;
        rendreRendezVous(state.data);
        toast('Rendez-vous : ' + (STATUTS_RDV[nouveau] || nouveau).toLowerCase() + '.', 'success');
      })
      .catch(function (err) {
        bouton.disabled = false;
        toast(err.message, 'danger');
      });
  });

  /* ------------------------------------------------------------------ */
  /* Séquestre & transactions                                            */
  /* ------------------------------------------------------------------ */
  function rendreTransactions(data) {
    const tx = data.transactions || [];
    const k = data.kpis || {};
    $('#transactions-lignes').innerHTML = tx.map(function (t) {
      const statut = STATUTS_TX[t.status] || t.status || '—';
      const ton = t.status === 'escrow' ? 'stamp' : t.status === 'paid' ? 'seal' : '';
      return '<tr>' +
        '<td>' + esc(dateFr(t.createdAt)) + '</td>' +
        '<td class="pro-table__titre">' + esc(t.listingTitle || '—') + '</td>' +
        '<td>' + dataSpan(eur(t.amount), 'data--stamp') + '</td>' +
        '<td>' + dataSpan(eur(t.commission)) + (t.commissionPct ? ' <span class="micro">(' + esc(num(t.commissionPct)) + ' %)</span>' : '') + '</td>' +
        '<td>' + badge(statut, ton) + '</td>' +
        '</tr>';
    }).join('');
    $('#transactions-total').textContent = tx.length + ' opérations · séquestre ' + eur(k.escrowAmount);
    $('#transactions-vide').hidden = tx.length > 0;
  }

  /* ------------------------------------------------------------------ */
  /* Mes créneaux                                                         */
  /* ------------------------------------------------------------------ */
  function rendreCreneaux() {
    const slots = state.slots || [];
    $('#creneaux-liste').innerHTML = slots.map(function (s) {
      const actif = s.active !== false;
      const jour = JOURS[Number(s.weekday) % 7] || 'jour';
      return '<li class="pro-creneau' + (actif ? '' : ' pro-creneau--inactif') + '">' +
        '<div class="pro-creneau__texte"><b>' + esc(jour + ' ' + heureLabel(s.startMinute) + ' – ' + heureLabel(s.endMinute)) + '</b>' +
        '<span>créneaux ' + esc(num(s.slotMinutes)) + ' min</span></div>' +
        badge(actif ? 'Actif' : 'Désactivé', actif ? 'seal' : '') +
        '<div class="pro-creneau__actes">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-slot="' + esc(s.id) + '" data-slot-action="toggle">'
        + (actif ? 'Désactiver' : 'Activer') + '</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-slot="' + esc(s.id) + '" data-slot-action="delete">Supprimer</button>' +
        '</div></li>';
    }).join('');
    $('#creneaux-vide').hidden = slots.length > 0;
    if (state.data && state.data.kpis) {
      state.data.kpis.slots = slots.filter(function (s) { return s.active !== false; }).length;
      rendreKpis(state.data);
    }
  }

  $('#form-creneau').addEventListener('submit', function (e) {
    e.preventDefault();
    message('#creneaux-message', '', false);
    const weekday = Number($('#slot-weekday').value);
    const start = minutesDe($('#slot-start').value);
    const end = minutesDe($('#slot-end').value);
    const step = Number($('#slot-step').value);
    if (isNaN(start) || isNaN(end)) {
      message('#creneaux-message', 'Heures invalides.', true);
      return;
    }
    if (end <= start) {
      message('#creneaux-message', 'L’heure de fin doit suivre l’heure de début.', true);
      return;
    }
    const bouton = $('#btn-creneau');
    bouton.disabled = true;
    api('/api/slots', {
      method: 'POST',
      body: { weekday: weekday, start_minute: start, end_minute: end, slot_minutes: step },
    })
      .then(function (data) {
        if (data.slot) {
          state.slots = (state.slots || []).concat([data.slot]);
          state.slots.sort(function (a, b) {
            return (a.weekday - b.weekday) || (a.startMinute - b.startMinute);
          });
        }
        rendreCreneaux();
        toast('Créneau ajouté.', 'success');
      })
      .catch(function (err) { message('#creneaux-message', err.message, true); })
      .then(function () { bouton.disabled = false; });
  });

  $('#creneaux-liste').addEventListener('click', function (e) {
    const bouton = e.target.closest('[data-slot-action]');
    if (!bouton) return;
    const id = bouton.dataset.slot;
    const action = bouton.dataset.slotAction;
    const slot = (state.slots || []).find(function (s) { return s.id === id; });
    bouton.disabled = true;

    if (action === 'toggle') {
      const suivant = !(slot && slot.active);
      api('/api/slots', { method: 'PATCH', body: { id: id, is_active: suivant } })
        .then(function (data) {
          if (slot && data.slot) slot.active = data.slot.active;
          rendreCreneaux();
          toast(suivant ? 'Créneau activé.' : 'Créneau désactivé.', 'success');
        })
        .catch(function (err) {
          bouton.disabled = false;
          toast(err.message, 'danger');
        });
      return;
    }

    api('/api/slots', { method: 'DELETE', body: { id: id } })
      .then(function () {
        state.slots = (state.slots || []).filter(function (s) { return s.id !== id; });
        rendreCreneaux();
        toast('Créneau supprimé.', 'success');
      })
      .catch(function (err) {
        bouton.disabled = false;
        toast(err.message, 'danger');
      });
  });

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                            */
  /* ------------------------------------------------------------------ */
  function demarrer() {
    if (jeton()) chargerTableau();
    else afficherVue('connexion');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
