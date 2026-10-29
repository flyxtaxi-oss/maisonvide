/* ==========================================================================
   MaisonVide — Prise de rendez-vous (fiche annonce)
   --------------------------------------------------------------------------
   Vanilla, sans dépendance, sans module ES. Chargé en différé sur annonce.html.

   Il attend la fiche déjà rendue par la page (window.MV_LISTING), puis
   interroge l'API des rendez-vous. Si l'API ne répond pas — prévisualisation
   locale, service coupé — le bloc reste lisible et propose WhatsApp : la page
   ne se bloque jamais.
   ========================================================================== */
(function () {
  'use strict';

  /* Base de l'API : vide = même origine (production). Surchargeable par
     window.MV_BOOKING_API pour un test local. */
  // Les fonctions serverless vivent sur Vercel : en local, on interroge
  // l'API déployée pour que la démonstration fonctionne hors production.
  // Aucune clé n'est exposée — l'API est publique et ne renvoie que des
  // données déjà lisibles par le navigateur.
  const LOCAL = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const API_BASE = window.MV_BOOKING_API || (LOCAL ? 'https://maisonvide.vercel.app' : '');

  const TZ = 'Europe/Paris';
  const TIMEOUT = 12000;
  const WA_NUMBER = '33600000000';
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const MODES = [
    { key: 'visite', label: 'Visite' },
    { key: 'remise', label: 'Remise' },
    { key: 'livraison', label: 'Livraison' }
  ];

  const MODE_LABEL = MODES.reduce((acc, m) => { acc[m.key] = m.label; return acc; }, {});

  /* ------------------------------------------------------------------ */
  /* Outils                                                             */
  /* ------------------------------------------------------------------ */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function toast(message, type) {
    if (typeof window.mvToast === 'function') window.mvToast(message, type || 'info');
  }

  /* ------------------------------------------------------------------ */
  /* État                                                               */
  /* ------------------------------------------------------------------ */

  const state = {
    listingId: null,
    slug: null,
    listing: null,
    slots: [],
    selected: null,
    mode: 'visite',
    appointment: null,
    busy: false
  };

  /* ------------------------------------------------------------------ */
  /* Réseau                                                             */
  /* ------------------------------------------------------------------ */

  async function request(path, options) {
    const opts = options || {};
    opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    if (opts.body) opts.headers['Content-Type'] = 'application/json';

    let timer = null;
    if (typeof AbortController !== 'undefined') {
      const ctrl = new AbortController();
      opts.signal = ctrl.signal;
      timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT);
    }

    try {
      const res = await fetch(API_BASE + path, opts);
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data: data };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Heures de Paris                                                    */
  /* ------------------------------------------------------------------ */

  const keyFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const dayFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short'
  });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
  });

  function dayKey(date) {
    const p = {};
    keyFmt.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }

  function dayLabel(date) {
    return dayFmt.format(date);
  }

  function timeLabel(date) {
    const p = {};
    timeFmt.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    const hour = p.hour === '24' ? '00' : p.hour;
    return hour + ' h ' + p.minute;
  }

  function fullLabel(date) {
    return dayLabel(date) + ' · ' + timeLabel(date);
  }

  /* ------------------------------------------------------------------ */
  /* Rendu : statut, erreur, créneaux                                   */
  /* ------------------------------------------------------------------ */

  function setStatus(message, kind) {
    const el = $('#rdv-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
    el.classList.toggle('is-error', kind === 'error');
  }

  function show(node, visible) {
    if (node) node.classList.toggle('hidden', !visible);
  }

  function fail(message) {
    setStatus(message || 'Le service de rendez-vous ne répond pas.', 'error');
    show($('#rdv-form'), false);
    show($('#rdv-slots'), false);
    show($('#rdv-done'), false);
  }

  function slotButton(slot) {
    const btn = document.createElement('button');
    const date = new Date(slot.start);
    btn.type = 'button';
    btn.className = 'slot';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.tabIndex = -1;
    btn.dataset.start = slot.start;
    btn.dataset.duration = slot.durationMinutes || 30;
    btn.textContent = timeLabel(date);
    btn.setAttribute('aria-label', fullLabel(date) + ', ' + (slot.durationMinutes || 30) + ' minutes');
    btn.addEventListener('click', function () { selectSlot(btn, true); });
    return btn;
  }

  function renderSlots(slots) {
    const host = $('#rdv-slots');
    if (!host) return;
    host.innerHTML = '';

    if (!slots.length) {
      const p = document.createElement('p');
      p.className = 'rdv__none';
      p.textContent = 'Aucun créneau libre sur les deux prochaines semaines. Écrivez au vendeur sur WhatsApp.';
      host.appendChild(p);
      return;
    }

    const groups = [];
    const index = {};
    slots.forEach(function (slot) {
      const date = new Date(slot.start);
      const key = dayKey(date);
      if (!index[key]) {
        index[key] = { date: date, items: [] };
        groups.push(index[key]);
      }
      index[key].items.push(slot);
    });

    groups.forEach(function (group, i) {
      const wrap = document.createElement('div');
      wrap.className = 'rdv__daygroup';
      wrap.setAttribute('role', 'group');

      const title = document.createElement('span');
      title.className = 'rdv__day';
      title.id = 'rdv-day-' + i;
      title.textContent = dayLabel(group.date);
      wrap.setAttribute('aria-labelledby', title.id);

      const grid = document.createElement('div');
      grid.className = 'rdv__grid';
      group.items.forEach(function (slot) { grid.appendChild(slotButton(slot)); });

      wrap.appendChild(title);
      wrap.appendChild(grid);
      host.appendChild(wrap);
    });

    /* Un seul créneau atteignable au clavier : le premier. */
    const first = $('[role="radio"]', host);
    if (first) first.tabIndex = 0;
  }

  /* ------------------------------------------------------------------ */
  /* Sélection d'un créneau (souris + clavier)                           */
  /* ------------------------------------------------------------------ */

  function radios(host) {
    return $$('[role="radio"]', host);
  }

  function selectSlot(btn, focus) {
    const host = $('#rdv-slots');
    if (!host || !btn) return;
    radios(host).forEach(function (other) {
      const on = other === btn;
      other.setAttribute('aria-checked', on ? 'true' : 'false');
      other.tabIndex = on ? 0 : -1;
    });
    state.selected = btn.dataset.start;
    if (focus) btn.focus();
    const note = $('#rdv-account');
    if (note && note.dataset.role === 'slot') {
      note.textContent = 'Créneau choisi : ' + fullLabel(new Date(btn.dataset.start));
    }
  }

  function setMode(key, focus) {
    const host = $('#rdv-modes');
    if (!host) return;
    $$('[role="radio"]', host).forEach(function (btn) {
      const on = btn.dataset.mode === key;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
    state.mode = key;
    if (focus) {
      const target = $('[role="radio"][data-mode="' + key + '"]', host);
      if (target) target.focus();
    }
  }

  /* Flèches : déplacement dans le groupe, sélection suivie du focus. */
  function onRadioKeydown(event) {
    const host = event.currentTarget;
    const list = radios(host);
    const index = list.indexOf(document.activeElement);
    if (index < 0) return;

    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % list.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = list.length - 1;
    else return;

    event.preventDefault();
    const target = list[next];
    if (host.id === 'rdv-slots') selectSlot(target, true);
    else setMode(target.dataset.mode, true);
  }

  /* ------------------------------------------------------------------ */
  /* Coordonnées de l'acheteur                                          */
  /* ------------------------------------------------------------------ */

  function prefill() {
    const user = window.mvAuth && typeof window.mvAuth.current === 'function'
      ? window.mvAuth.current()
      : null;

    const name = $('#rdv-name');
    const mail = $('#rdv-email');
    const phone = $('#rdv-phone');
    const note = $('#rdv-account');

    if (!user) {
      if (phone) phone.required = true;
      if (note) {
        note.dataset.role = 'slot';
        note.textContent = 'Sans compte, indiquez vos coordonnées pour que le vendeur vous confirme.';
      }
      return;
    }

    if (name && user.name) name.value = user.name;
    if (mail && user.email) mail.value = user.email;
    if (phone && user.phone) phone.value = user.phone;
    if (note) {
      note.dataset.role = 'slot';
      note.textContent = 'Coordonnées reprises de votre compte. Le vendeur vous confirme sous 2 h.';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Confirmation                                                       */
  /* ------------------------------------------------------------------ */

  function whatsappLink(message) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message);
  }

  function listingTitle() {
    if (state.listing && state.listing.title) return state.listing.title;
    const el = $('#title');
    return el ? el.textContent : 'votre objet';
  }

  function renderDone(appointment) {
    state.appointment = appointment;
    const date = new Date(appointment.startsAt);

    const when = $('#rdv-done-when');
    const mode = $('#rdv-done-mode');
    const place = $('#rdv-done-place');
    const seller = $('#rdv-done-seller');
    const wa = $('#rdv-done-wa');

    if (when) when.textContent = fullLabel(date);
    if (mode) mode.textContent = MODE_LABEL[appointment.mode] || appointment.mode;
    if (place) place.textContent = appointment.place || (state.listing && state.listing.city) || 'À préciser';
    if (seller) seller.textContent = (appointment.seller && appointment.seller.name) || (state.listing && state.listing.seller && state.listing.seller.name) || 'Le vendeur';

    if (wa) {
      wa.href = whatsappLink('Bonjour, je confirme notre rendez-vous pour « ' + listingTitle() + ' » le ' + fullLabel(date) + '.');
    }

    show($('#rdv-form'), false);
    show($('#rdv-status'), false);
    show($('#rdv-done'), true);

    const heading = $('#rdv-done-title');
    if (heading) heading.textContent = 'Demande envoyée au vendeur';
  }

  /* ------------------------------------------------------------------ */
  /* Fichier d'agenda (.ics)                                            */
  /* ------------------------------------------------------------------ */

  function icsStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  function icsEscape(text) {
    return String(text == null ? '' : text)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  function buildICS(appointment) {
    const title = (appointment.listing && appointment.listing.title) || listingTitle();
    const place = appointment.place || '';
    const seller = (appointment.seller && appointment.seller.name) || '';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MaisonVide//Rendez-vous//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + icsEscape(appointment.id) + '@maisonvide.fr',
      'DTSTAMP:' + icsStamp(new Date()),
      'DTSTART:' + icsStamp(new Date(appointment.startsAt)),
      'DTEND:' + icsStamp(new Date(appointment.endsAt || appointment.startsAt)),
      'SUMMARY:' + icsEscape('Rendez-vous MaisonVide — ' + title),
      'LOCATION:' + icsEscape(place),
      'DESCRIPTION:' + icsEscape('Rendez-vous demandé auprès de ' + seller + '. Objet : ' + title + '.'),
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ];
    return lines.join('\r\n');
  }

  function downloadICS() {
    const appointment = state.appointment;
    if (!appointment) return;
    const blob = new Blob([buildICS(appointment)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rendez-vous-maisonvide.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    toast('Fichier d’agenda téléchargé', 'success');
  }

  /* ------------------------------------------------------------------ */
  /* Chargement des créneaux                                            */
  /* ------------------------------------------------------------------ */

  async function resolveListingId() {
    if (state.listingId) return state.listingId;
    if (!state.slug) return null;

    const res = await request('/api/listings');
    if (!res.ok || !res.data || !res.data.listings) throw new Error('Annonces indisponibles');
    const found = res.data.listings.filter(function (l) { return l.slug === state.slug; })[0];
    if (!found) return null;
    state.listingId = found.id;
    return state.listingId;
  }

  async function load() {
    if (!$('#rdv')) return;

    state.selected = null;
    setStatus('Chargement des créneaux disponibles…', 'loading');
    show($('#rdv-form'), false);
    show($('#rdv-done'), false);

    try {
      const listingId = await resolveListingId();
      if (!listingId) {
        fail('Cette annonce n’est pas encore ouverte aux rendez-vous. Écrivez au vendeur sur WhatsApp.');
        return;
      }

      const res = await request('/api/appointments?listing_id=' + encodeURIComponent(listingId));
      if (!res.ok || !res.data || !res.data.ok) {
        throw new Error((res.data && res.data.error) || 'Service indisponible');
      }

      state.listing = res.data.listing || null;
      state.slots = res.data.slots || [];

      renderSlots(state.slots);
      setStatus('', 'ok');
      show($('#rdv-form'), true);

      const durations = {};
      state.slots.forEach(function (s) { durations[s.durationMinutes || 30] = true; });
      const duration = $('#rdv-duration');
      if (duration) {
        const keys = Object.keys(durations);
        duration.textContent = keys.length === 1 ? (keys[0] + ' min') : '30 min';
      }

      const wa = $('#rdv-wa');
      if (wa) {
        wa.href = whatsappLink('Bonjour, je souhaite prendre rendez-vous pour « ' + listingTitle() + ' ».');
      }
    } catch (e) {
      fail('Le service de rendez-vous ne répond pas. Écrivez au vendeur sur WhatsApp, il vous répondra directement.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Envoi de la demande                                                */
  /* ------------------------------------------------------------------ */

  async function submit(event) {
    event.preventDefault();
    if (state.busy) return;

    const button = $('#rdv-send');
    const name = $('#rdv-name');
    const mail = $('#rdv-email');
    const phone = $('#rdv-phone');
    const note = $('#rdv-note');

    if (!state.selected) {
      toast('Choisissez d’abord un créneau.', 'warning');
      const first = $('#rdv-slots [role="radio"]');
      if (first) first.focus();
      return;
    }
    if (!state.listingId) {
      fail('Impossible de joindre le service de rendez-vous. Écrivez au vendeur sur WhatsApp.');
      return;
    }
    if (!mail || !mail.value || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) {
      toast('Indiquez un e-mail valide pour recevoir la confirmation.', 'warning');
      if (mail) mail.focus();
      return;
    }
    if (phone && phone.required && !phone.value.trim()) {
      toast('Indiquez un numéro de téléphone pour être joint.', 'warning');
      phone.focus();
      return;
    }

    state.busy = true;
    const label = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.textContent = 'Envoi en cours…';
    }

    try {
      const res = await request('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          listing_id: state.listingId,
          starts_at: state.selected,
          mode: state.mode,
          meeting_note: note ? note.value.trim() : '',
          name: name ? name.value.trim() : '',
          email: mail ? mail.value.trim() : '',
          phone: phone ? phone.value.trim() : ''
        })
      });

      if (!res.ok || !res.data || !res.data.ok) {
        const message = (res.data && res.data.error) || 'La demande n’a pas pu être envoyée.';
        toast(message, 'danger');
        setStatus(message + ' Vous pouvez réessayer ou écrire au vendeur sur WhatsApp.', 'error');
        return;
      }

      renderDone(res.data.appointment || {});
      toast('Demande de rendez-vous envoyée', 'success');
    } catch (e) {
      setStatus('Le service de rendez-vous ne répond pas. Écrivez au vendeur sur WhatsApp, il vous répondra directement.', 'error');
    } finally {
      state.busy = false;
      if (button) {
        button.disabled = false;
        button.innerHTML = label;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Branchement                                                        */
  /* ------------------------------------------------------------------ */

  function bind() {
    const form = $('#rdv-form');
    if (form) form.addEventListener('submit', submit);

    const slots = $('#rdv-slots');
    if (slots) slots.addEventListener('keydown', onRadioKeydown);

    const modes = $('#rdv-modes');
    if (modes) {
      modes.addEventListener('keydown', onRadioKeydown);
      $$('[role="radio"]', modes).forEach(function (btn) {
        btn.addEventListener('click', function () { setMode(btn.dataset.mode, false); });
      });
    }

    const ics = $('#rdv-ics');
    if (ics) ics.addEventListener('click', downloadICS);
  }

  function init(listingId) {
    if (!$('#rdv')) return;

    const value = String(listingId || '').trim();
    if (value) {
      if (UUID_RE.test(value)) state.listingId = value;
      else state.slug = value;
    }
    if (!state.listingId && !state.slug) {
      state.slug = new URLSearchParams(location.search).get('slug') || '';
    }

    prefill();
    load();
  }

  function refresh() {
    load();
  }

  window.mvBooking = { init: init, refresh: refresh };

  function boot() {
    bind();
    const info = window.MV_LISTING || {};
    init(info.id || info.slug || '');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
