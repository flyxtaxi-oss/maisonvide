/* ==========================================================================
   MaisonVide — Le moteur de scroll
   1. La barre de progression (2 px)
   2. Le rail de progression à droite (point + libellé de section)
   3. Les actes : marquage des étapes au passage de la lecture
   4. Les révélations [data-motion]

   Principes : pas de bounce, easing cubic-bezier(.16,1,.3,1),
   prefers-reduced-motion respecté, et le contenu reste visible même si
   l'onglet n'a jamais été peint.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ */
  /* Construction du rail                                                */
  /* ------------------------------------------------------------------ */
  function buildRail() {
    if ($('.scroll-rail')) return;

    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    progress.innerHTML = '<div class="scroll-progress__bar"></div>';

    const rail = document.createElement('aside');
    rail.className = 'scroll-rail';
    rail.setAttribute('aria-hidden', 'true');
    rail.innerHTML =
      '<div class="scroll-rail__track"><div class="scroll-rail__fill"></div></div>' +
      '<div class="scroll-rail__dot"></div>' +
      '<div class="scroll-rail__label"></div>' +
      '<div class="scroll-rail__pct"></div>';

    document.body.appendChild(progress);
    document.body.appendChild(rail);
    document.body.classList.add('has-rail');

    return {
      bar: $('.scroll-progress__bar'),
      fill: $('.scroll-rail__fill'),
      dot: $('.scroll-rail__dot'),
      label: $('.scroll-rail__label'),
      pct: $('.scroll-rail__pct'),
      track: $('.scroll-rail__track'),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Les sections-annuaires du rail                                      */
  /* ------------------------------------------------------------------ */
  function collectSections() {
    const nodes = $$('section[id], section[data-section]');
    const out = [];
    nodes.forEach(el => {
      const label = el.dataset.section
        || el.dataset.title
        || (el.querySelector('[data-section-label]') || {}).textContent
        || '';
      const title = label
        || el.getAttribute('data-section')
        || (el.querySelector('h1, h2') || {}).textContent
        || '';
      out.push({
        el,
        title: (title || '').trim().replace(/\s+/g, ' ').slice(0, 48),
      });
    });
    return out.filter(s => s.title);
  }

  /* ------------------------------------------------------------------ */
  /* Mise à jour : progression + section courante                        */
  /* ------------------------------------------------------------------ */
  function update() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const y = window.scrollY || window.pageYOffset || 0;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

    if (ui.bar) ui.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';

    if (ui.track) {
      const h = ui.track.clientHeight;
      if (ui.fill) ui.fill.style.height = (p * h).toFixed(1) + 'px';
      if (ui.dot) ui.dot.style.top = (p * h).toFixed(1) + 'px';
    }
    if (ui.pct) ui.pct.textContent = Math.round(p * 100) + ' %';

    // Section courante : la dernière dont le haut est passé sous le tiers
    // supérieur de la fenêtre.
    let current = null;
    const line = y + window.innerHeight * 0.35;
    for (const s of sections) {
      const top = s.el.offsetTop;
      if (top <= line) current = s; else break;
    }
    if (current) {
      if (ui.label && ui.label.textContent !== current.title) {
        ui.label.textContent = current.title;
      }
      if (ui.label) ui.label.style.color = 'var(--ink-900)';
    } else if (ui.label) {
      ui.label.style.color = '';
    }
  }

  /* ------------------------------------------------------------------ */
  /* Les actes : marquage des étapes                                    */
  /* ------------------------------------------------------------------ */
  function initActs() {
    const acts = $$('.act');
    if (!acts.length) return;

    acts.forEach(act => {
      const steps = $$('.act__step', act);
      if (!steps.length) return;

      const setActive = idx => {
        steps.forEach((s, i) => {
          s.classList.toggle('is-current', i === idx);
          s.classList.toggle('is-past', i < idx);
        });
      };
      setActive(0);

      if (!('IntersectionObserver' in window) || reduce) {
        steps.forEach(s => s.classList.add('is-current'));
        return;
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const idx = steps.indexOf(e.target);
          if (idx >= 0) setActive(idx);
        });
      }, { threshold: 0.55, rootMargin: '-18% 0px -35% 0px' });

      steps.forEach(s => io.observe(s));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Les révélations [data-motion]                                        */
  /* ------------------------------------------------------------------ */
  function initMotion() {
    const items = $$('[data-motion]');
    if (!items.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    items.forEach(el => io.observe(el));

    // Filet : ce qui est déjà à l'écran s'affiche.
    setTimeout(() => {
      const h = window.innerHeight || 800;
      items.forEach(el => {
        if (el.classList.contains('is-in')) return;
        if (el.getBoundingClientRect().top < h) el.classList.add('is-in');
      });
    }, 2600);
  }

  /* ------------------------------------------------------------------ */
  /* Boucle                                                              */
  /* ------------------------------------------------------------------ */
  let ui = {};
  let sections = [];
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  }

  function boot() {
    ui = buildRail() || {};
    sections = collectSections();

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Les ancres peuvent changer la hauteur du document : on recalcule.
    setTimeout(() => { sections = collectSections(); update(); }, 400);
    setTimeout(() => { sections = collectSections(); update(); }, 1200);

    initActs();
    initMotion();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
