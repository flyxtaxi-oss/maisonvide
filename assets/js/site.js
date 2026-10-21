/* ==========================================================================
   MaisonVide — Site motion
   UNE séquence signature (« Le relevé ») + feedback discret.
   Aucune révélation identiques sur chaque section : le rise est conservateur.
   ========================================================================== */

(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ------------------------------------------------------------------ */
  /* LE MOMENT SIGNATURE — le relevé                                      */
  /* La photo se soulève comme une page, le prix s'estampe, les règles    */
  /* se tracent. Une seule fois, au chargement.                          */
  /*                                                                      */
  /* Deux garde-fous :                                                    */
  /*  1. la séquence ne démarre que si la page est réellement peinte      */
  /*     (un onglet en arrière-plan gèle les animations CSS) ;            */
  /*  2. un filet de sécurité force l'état visible si la séquence n'a     */
  /*     pas pu se jouer. Le contenu ne doit JAMAIS rester invisible.    */
  /* ------------------------------------------------------------------ */
  function stampSequence() {
    const stage = $('.releve');
    if (!stage) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { stage.classList.add('is-revealed'); return; }

    let played = false;
    const play = () => {
      if (played) return;
      played = true;
      requestAnimationFrame(() => stage.classList.add('is-stamped'));
      // Filet : si l'animation est gelée (onglet jamais peint), on force
      // l'état final visible.
      setTimeout(() => stage.classList.add('is-revealed'), 2200);
    };

    // Si l'onglet n'est pas visible, on attend qu'il le becomes.
    if (document.visibilityState === 'hidden') {
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        document.removeEventListener('visibilitychange', onVisible);
        start();
      };
      document.addEventListener('visibilitychange', onVisible);
      // En attendant, le contenu reste visible (état par défaut).
      stage.classList.add('is-revealed');
      return;
    }

    function start() {
      // On attend le chargement de l'image pour que le soulèvement soit franc
      const img = stage.querySelector('.releve-card__media img');
      const go = () => requestAnimationFrame(() => { played = true; stage.classList.add('is-stamped'); });
      if (img && !img.complete) {
        img.addEventListener('load', go, { once: true });
        setTimeout(go, 900); // filet de sécurité
      } else {
        setTimeout(go, 120);
      }
      setTimeout(() => stage.classList.add('is-revealed'), 2200);
    }
    start();
  }

  /* ------------------------------------------------------------------ */
  /* Rise conservateur — le contenu reste visible sans JS                 */
  /* ------------------------------------------------------------------ */
  function initRise() {
    const items = $$('[data-rise]');
    if (!items.length) return;
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    items.forEach(el => io.observe(el));

    // Filet de sécurité : ce qui est déjà à l'écran s'affiche, même si
    // l'observateur n'a pas pu se déclencher (onglet non peint).
    setTimeout(() => {
      const h = window.innerHeight || 800;
      items.forEach(el => {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < h) el.classList.add('is-in');
      });
    }, 3000);
  }

  /* ------------------------------------------------------------------ */
  /* Compteurs amortis (damp) — la donnée qui bouge                       */
  /* ------------------------------------------------------------------ */
  function initCounters() {
    const els = $$('.count[data-count]');
    if (!els.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        const target = parseFloat(el.dataset.count);
        if (isNaN(target)) return;
        const dec = (el.dataset.count.split('.')[1] || '').length;
        const suffix = el.dataset.suffix || '';
        let t0 = null;
        const dur = 1400;
        function tick(ts) {
          if (!t0) t0 = ts;
          const p = Math.min(1, (ts - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          el.textContent = (target * eased).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    els.forEach(el => io.observe(el));
  }

  /* ------------------------------------------------------------------ */
  /* Wishlist — persistant, lié à la session                             */
  /* ------------------------------------------------------------------ */
  function initWishlist() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-wishlist]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const slug = btn.dataset.wishlist;

      if (!window.mvAuth.isLogged()) {
        window.mvToast('Connectez-vous pour garder vos favoris', 'warning');
        setTimeout(() => location.href = 'auth.html?next=' + encodeURIComponent(location.pathname + location.search), 900);
        return;
      }
      const res = window.mvAuth.toggleWishlist(slug);
      if (res.ok) {
        btn.classList.toggle('is-active', res.added);
        window.mvToast(res.added ? 'Ajouté à vos favoris' : 'Retiré de vos favoris', 'success', 1800);
        syncWishlistButtons();
      }
    });

    function syncWishlistButtons() {
      $$('[data-wishlist]').forEach(b => {
        b.classList.toggle('is-active', window.mvAuth.inWishlist(b.dataset.wishlist));
      });
    }
    syncWishlistButtons();
  }

  /* ------------------------------------------------------------------ */
  /* Cartes annonces → fiche                                             */
  /* ------------------------------------------------------------------ */
  function initCards() {
    document.addEventListener('click', e => {
      if (e.target.closest('a, button')) return;
      const card = e.target.closest('.listing-card[data-slug]');
      if (card) location.href = 'annonce.html?slug=' + card.dataset.slug;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Lenis — défilement amorti (repris de motion-4)                      */
  /* ------------------------------------------------------------------ */
  function initSmoothScroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!window.Lenis) {
      // fallback : pas de smooth scroll, le site reste parfaitement utilisable
      return;
    }
    const lenis = new window.Lenis({
      duration: 1.05,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    let id;
    function raf(time) {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    }
    id = requestAnimationFrame(raf);
    window.__lenis = lenis;
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                 */
  /* ------------------------------------------------------------------ */
  function boot() {
    stampSequence();
    initRise();
    initCounters();
    initWishlist();
    initCards();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
