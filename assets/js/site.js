/* ==========================================================================
   MaisonVide — Site motion
   UNE séquence signature (« Le relevé ») + feedback discret.
   Aucune révélation identiques sur chaque section : le rise est conservateur.

   Principes appliqués ici :
     • le contenu est visible par défaut (filet à 2,2 s, garde visibilityState) ;
     • le CSS natif scroll-driven est la première couche (assets/css/scroll-timeline.css),
       ce fichier n'assure que le repli et les interactions ;
     • prefers-reduced-motion coupe tout.
   ========================================================================== */

(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* Le navigateur sait-il gérer les timelines natives ?
     (Chrome 115+, Firefox 159+, Safari 26+). Sinon, c'est le moteur
     maison qui prend le relais — et les deux ne se marchent jamais
     dessus : le CSS l'emporte par la cascade, le JS est le repli. */
  const NATIVE_TIMELINE = (function () {
    try {
      return !!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'));
    } catch (e) {
      return false;
    }
  })();

  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    // Sous mouvement réduit, la donnée s'affiche telle quelle : pas de
    // comptage animé.
    if (reduced()) {
      els.forEach(el => {
        const target = parseFloat(el.dataset.count);
        if (isNaN(target)) return;
        const dec = (el.dataset.count.split('.')[1] || '').length;
        const suffix = el.dataset.suffix || '';
        el.textContent = target.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + suffix;
      });
      return;
    }

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
  /*                                                                      */
  /* Version épinglée : 1.3.x. La v2 inverse les valeurs par défaut et   */
  /* aplatit les options — elle casserait ce code. Ne pas migrer sans   */
  /* réécriture de ce bloc.                                              */
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

    // La mesure est refaite quand le défilement se calme : le document a
    // pu grandir (images, annonces chargées en AJAX) et Lenis garde sinon
    // une hauteur périmée — le scroll But au fond de la page.
    let measureTimer = null;
    lenis.on('scroll', () => {
      if (measureTimer) clearTimeout(measureTimer);
      measureTimer = setTimeout(() => {
        measureTimer = null;
        try { lenis.resize(); } catch (e) { /* rien à faire */ }
      }, 320);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Les ancres internes                                                  */
  /* Lenis v1 ne traite pas les liens `#ancre` : on s'en charge, avec un  */
  /* repli natif quand Lenis est absent (ou sous mouvement réduit).      */
  /* ------------------------------------------------------------------ */
  function headerHeight() {
    const h = $('.site-header');
    return h ? h.offsetHeight : 68;
  }

  function initAnchors() {
    document.addEventListener('click', e => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      const a = el.closest('a[href]');
      if (!a) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      if (href.charAt(0) !== '#' || href.length < 2) return;

      let id = href.slice(1);
      try { id = decodeURIComponent(id); } catch (err) { /* on garde l'id brut */ }
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      const offset = -(headerHeight() + 12);

      if (window.__lenis) {
        window.__lenis.scrollTo(target, { offset, duration: 1.05 });
      } else {
        const top = target.getBoundingClientRect().top + (window.scrollY || 0) - offset;
        try {
          window.scrollTo({ top: top, behavior: reduced() ? 'auto' : 'smooth' });
        } catch (err) {
          window.scrollTo(0, top);
        }
      }

      // L'URL doit refléter l'ancre, sans saut de page.
      if (window.history && window.history.pushState) {
        window.history.pushState(null, '', href);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Le header qui se contracte au scroll                                 */
  /* 180 ms, sans bounce — la classe est posée sur <html> et le style     */
  /* vit dans assets/css/motion.css.                                      */
  /* ------------------------------------------------------------------ */
  function initHeaderContract() {
    const root = document.documentElement;
    let ticking = false;

    function update() {
      ticking = false;
      const y = window.scrollY || window.pageYOffset || 0;
      root.classList.toggle('is-mv-scrolled', y > 24);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
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
    initAnchors();
    initHeaderContract();

    // Repère de diagnostic : le navigateur sait-il gérer les timelines
    // natives ? (Chrome 115+, Firefox 159+, Safari 26+). Le moteur maison
    // reste chargé dans tous les cas : il porte le rail et les actes.
    document.documentElement.dataset.mvTimeline = NATIVE_TIMELINE ? 'native' : 'js';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
