/* ==========================================================================
   MaisonVide — Estimateur IA
   Trois choses dans ce fichier :
     1. les tables de prix et le calcul du relevé ;
     2. la lecture d'une fiche (ce que le modèle a compris) ;
     3. la machine à états des trois lignes du relevé.
   Aucune emoji : les icônes viennent du sprite (assets/icons/sprite.svg).
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* 1. Les tables                                                       */
  /* ------------------------------------------------------------------ */

  // Fourchette min/max par défaut, et nombre de ventes comparables.
  // Prix calibrés sur le marché de l'occasion en France (2024-2026).
  const PRICE_BASES = {
    mobilier:       { min: 20,   max: 1800, avg: 280,  weight: 1.5, bigItem: true,  sales: 18420 },
    decoration:     { min: 5,    max: 600,  avg: 65,   weight: 0.3, bigItem: false, sales: 31200 },
    livres:         { min: 1,    max: 80,   avg: 8,    weight: 0.4, bigItem: false, sales: 24600 },
    vaisselle:      { min: 3,    max: 200,  avg: 25,   weight: 0.5, bigItem: false, sales: 9800 },
    vetements:      { min: 3,    max: 250,  avg: 22,   weight: 0.4, bigItem: false, sales: 27300 },
    electronique:   { min: 10,   max: 1200, avg: 180,  weight: 0.8, bigItem: false, sales: 15600 },
    jouets:         { min: 2,    max: 150,  avg: 18,   weight: 0.4, bigItem: false, sales: 11400 },
    bricolage:      { min: 5,    max: 400,  avg: 55,   weight: 0.9, bigItem: false, sales: 8200 },
    jardin:         { min: 5,    max: 500,  avg: 60,   weight: 0.9, bigItem: true,  sales: 6400 },
    art:            { min: 30,   max: 5000, avg: 380,  weight: 1.0, bigItem: true,  sales: 3100 },
    bijoux:         { min: 20,   max: 3000, avg: 220,  weight: 0.3, bigItem: false, sales: 4800 },
    electromenager: { min: 15,   max: 700,  avg: 130,  weight: 1.2, bigItem: true,  sales: 7300 },
  };

  // Multiplicateurs par état (état déclaré + indice IA simulé).
  const CONDITION_FACTOR = {
    neuf:        { mult: 1.4,  label: 'Neuf / sous emballage' },
    'tres-bon':  { mult: 1.0,  label: 'Très bon état' },
    bon:         { mult: 0.75, label: 'Bon état' },
    correct:     { mult: 0.5,  label: 'État correct' },
    'a-renover': { mult: 0.25, label: 'À rénover' },
  };

  // Bonus/malus marques (effet « marque connue »).
  const BRAND_FACTOR = {
    luxe:     { mult: 1.8,  label: 'Luxe / premium' },
    premium:  { mult: 1.35, label: 'Grande marque' },
    milieu:   { mult: 1.0,  label: 'Marque milieu de gamme' },
    bas:      { mult: 0.7,  label: 'Marque entrée de gamme' },
    inconnue: { mult: 0.85, label: 'Sans marque / inconnu' },
  };

  const BRAND_BY_CATEGORY = {
    mobilier: { luxe: ['Roche Bobois', 'Luxe'], premium: ['IKEA', 'Maison du Monde', 'Habitat'], milieu: ['Conforama', 'But', "Alice's Garden"], bas: ['Ikea bas', 'No name bas', 'Inconnu'] },
    decoration: { luxe: ['Lalique', 'Baccarat'], premium: ['IKEA', 'H&M Home', 'Casa'], milieu: ['Maisons du Monde', 'Monsieur Meuble'], bas: ['Tati', 'Action'], inconnue: ['No name', 'Sans marque'] },
    electronique: { luxe: ['Apple', 'Bose', 'Sonos'], premium: ['Samsung', 'Sony', 'LG'], milieu: ['Panasonic', 'Philips', 'Xiaomi'], bas: ['Inconnu', 'Marque blanche'], inconnue: ['Sans marque'] },
    electromenager: { luxe: ['Miele', 'Sub-Zero'], premium: ['Bosch', 'Siemens', 'Smeg'], milieu: ['Whirlpool', 'Beko', 'Indesit'], bas: ['Brandt', 'Candy', 'Inconnu'], inconnue: ['Sans marque'] },
    vetements: { luxe: ['Hermès', 'Chanel', 'Dior'], premium: ['Zara', 'H&M', "Levi's"], milieu: ['Uniqlo', 'Mango'], bas: ['Primark', 'Shein'], inconnue: ['Sans marque'] },
    bijoux: { luxe: ['Cartier', 'Tiffany'], premium: ['Swarovski', 'Pandora'], milieu: ['Agatha'], bas: ['Bijoux fantaisie'], inconnue: ['Sans marque'] },
  };

  const CONFIDENCE_BASE = {
    neuf: 96, 'tres-bon': 88, bon: 82, correct: 70, 'a-renover': 60,
  };

  // Délai de vente moyen observé, en jours, par catégorie.
  const DELAY_BASE = {
    mobilier: [2, 5], decoration: [4, 9], livres: [3, 7], vaisselle: [4, 10],
    vetements: [5, 11], electronique: [2, 6], jouets: [5, 12], bricolage: [4, 9],
    jardin: [6, 14], art: [8, 21], bijoux: [3, 8], electromenager: [2, 7],
  };

  // Catégories : `icon` est un symbole du sprite, jamais une emoji.
  const CATEGORIES = {
    mobilier:       { label: 'Mobilier',           icon: 'i-cube' },
    decoration:     { label: 'Décoration',         icon: 'i-spark' },
    livres:         { label: 'Livres & BD',        icon: 'i-list' },
    vaisselle:      { label: 'Vaisselle',          icon: 'i-leaf' },
    vetements:      { label: 'Vêtements',          icon: 'i-user' },
    electronique:   { label: 'Électronique',       icon: 'i-scan' },
    jouets:         { label: 'Jouets & jeux',      icon: 'i-play' },
    bricolage:      { label: 'Bricolage',          icon: 'i-cog' },
    jardin:         { label: 'Jardin & extérieur', icon: 'i-box' },
    art:            { label: 'Art & antiquités',   icon: 'i-flag' },
    bijoux:         { label: 'Bijoux',             icon: 'i-gem' },
    electromenager: { label: 'Électroménager',     icon: 'i-package' },
  };

  /* ------------------------------------------------------------------ */
  /* 2. Le calcul                                                        */
  /* ------------------------------------------------------------------ */

  /**
   * Calcule l'estimation.
   * @param {Object} input
   *   - category: clé catégorie
   *   - condition: 'neuf' | 'tres-bon' | 'bon' | 'correct' | 'a-renover'
   *   - brand: 'luxe' | 'premium' | 'milieu' | 'bas' | 'inconnue'
   *   - age: nombre d'années (0 = neuf)
   *   - hasPhotos: bool
   * @returns {Object|null} estimation complète
   */
  function estimate(input) {
    const base = PRICE_BASES[input.category];
    if (!base) return null;

    const condFactor = CONDITION_FACTOR[input.condition]?.mult ?? 1;
    const brandFactor = BRAND_FACTOR[input.brand]?.mult ?? 1;

    // Décote annuelle (~12 % en moyenne pour l'occasion, plus lent pour le luxe)
    const ageDecay = Math.pow(0.88, Math.max(0, input.age || 0));
    // Bonus si photos
    const photoBonus = input.hasPhotos ? 1.05 : 0.95;

    const factor = condFactor * brandFactor * ageDecay * photoBonus;

    let low  = Math.round((base.min * factor) / 5) * 5;
    let high = Math.round((base.max * factor) / 5) * 5;
    let avg  = Math.round((base.avg * factor) / 5) * 5;

    // Arrondir pour rester crédible (pas 137 €, plutôt 130 ou 140)
    low  = Math.max(5, Math.round(low / 10) * 10 - 5);
    high = Math.max(low + 10, Math.round(high / 10) * 10 + 5);
    avg  = Math.round((low + high) / 2 / 5) * 5;

    // Confiance
    let confidence = CONFIDENCE_BASE[input.condition] ?? 80;
    if (input.hasPhotos) confidence += 5;
    if (input.brand === 'inconnue') confidence -= 8;
    if (input.age > 15) confidence -= 5;
    confidence = Math.max(45, Math.min(98, confidence));

    // Le prix de marché : la fourchette serrée autour du médian observé.
    const marketLow  = Math.max(5, Math.round((avg * 0.88) / 5) * 5);
    const marketHigh = Math.max(marketLow + 5, Math.round((avg * 1.14) / 5) * 5);

    // Nombre de ventes comparables dans la base.
    const basis = Math.round(base.sales * (0.55 + confidence / 180));

    const detected = {
      category: input.category,
      condition: input.condition,
      brand: input.brand,
      age: input.age || 0,
      confidence,
      suggestions: generateSuggestions(input, factor, avg),
    };

    return {
      low, high, avg,
      marketLow, marketHigh,
      basis,
      confidence,
      detected,
      condLabel: CONDITION_FACTOR[input.condition]?.label,
      brandLabel: BRAND_FACTOR[input.brand]?.label,
      categoryLabel: CATEGORIES[input.category]?.label,
      sellDelay: sellDelay(input),
      factors: {
        condition: condFactor,
        brand: brandFactor,
        age: ageDecay,
        photo: photoBonus,
        global: factor,
      },
    };
  }

  function generateSuggestions(input, factor, avg) {
    const s = [];
    if (input.condition === 'a-renover') {
      s.push("Une rénovation légère (repeinture, Lookup) pourrait remonter la valeur de 30 à 50 %.");
    }
    if (!input.hasPhotos) {
      s.push("Ajoutez 3 à 5 photos sous différents angles : l'estimation gagne en moyenne 8 % de justesse.");
    }
    if (input.brand === 'inconnue' && ['mobilier', 'decoration', 'bijoux'].indexOf(input.category) !== -1) {
      s.push("Si la pièce est signée ou porte une étiquette de marque, précisez-le : la valeur peut être multipliée par 5.");
    }
    if (input.age > 15) {
      s.push("Un objet de plus de quinze ans se négocie plutôt en Grenier des Dieux qu'en brocante de rue.");
    }
    if (avg >= 500) {
      s.push("Au-delà de 500 €, un expert de l'équipe peut valider cette estimation, gratuitement.");
    }
    if (factor < 0.5) {
      s.push("À ce prix, la vente en ligne demande une description honnête : la reprise MaisonVide reste le plus rapide.");
    } else {
      s.push("Cet objet se vend bien en publication locale avec paiement bloqué en séquestre.");
    }
    return s;
  }

  function sellDelay(input) {
    const d = DELAY_BASE[input.category] || [3, 8];
    let min = d[0];
    let max = d[1];
    if (input.condition === 'a-renover') { min = Math.round(min * 1.6); max = Math.round(max * 1.8); }
    if (input.condition === 'neuf') { min = Math.max(1, min - 1); }
    if (input.brand === 'luxe') { min = min + 2; max = max + 5; }
    return min + ' à ' + max + ' jours';
  }

  window.MaisonVideEstimator = { estimate, CATEGORIES, BRAND_BY_CATEGORY };

  /* ------------------------------------------------------------------ */
  /* 3. L'interface : les trois lignes du relevé                          */
  /* ------------------------------------------------------------------ */

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function toast(message, type) {
    if (typeof window.mvToast === 'function') window.mvToast(message, type || 'info');
  }

  function scrollToPanel(el) {
    if (!el) return;
    if (window.__lenis && typeof window.__lenis.scrollTo === 'function') {
      window.__lenis.scrollTo(el, { offset: -90 });
    } else if (el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function money(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function initUI() {
    const root = document.getElementById('est');
    if (!root) return;

    const state = {
      photos: [],
      category: null,
      condition: 'bon',
      brand: 'milieu',
      age: 3,
      step: 1,
    };

    const dropzone = $('#est-dropzone', root);
    const input    = $('#est-input', root);
    const previews = $('#est-previews', root);
    const btnNext  = $('#est-next', root);
    const cats     = $('#est-cats', root);
    const selCond  = $('#est-condition', root);
    const selBrand = $('#est-brand', root);
    const inpAge   = $('#est-age', root);
    const btnRun   = $('#est-run', root);
    const btnBack  = $('#est-back', root);
    const restarts = $$('[data-est-restart]', root);
    const fiche    = $('#est-fiche', root);
    const empty    = $('#est-empty', root);
    const lines    = $$('[data-est-line]', root);
    const panels   = [1, 2, 3].map(function (n) { return $('#est-step-' + n, root); });

    if (!dropzone || !input || !previews) return;

    /* --- Les catégories : des jetons, pas des emoji --- */
    function renderCategories() {
      if (!cats) return;
      cats.innerHTML = Object.keys(CATEGORIES).map(function (key) {
        const c = CATEGORIES[key];
        return '<button type="button" class="est-cat" data-cat="' + key + '">' +
          icon(c.icon) + '<span>' + c.label + '</span></button>';
      }).join('');
      $$('.est-cat', cats).forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('.est-cat', cats).forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          state.category = btn.dataset.cat;
        });
      });
    }

    /* --- Les photos --- */
    function renderPhotos() {
      previews.innerHTML = '';
      state.photos.forEach(function (url, i) {
        const div = document.createElement('div');
        div.className = 'preview';
        div.innerHTML = '<img src="' + url + '" alt="Photo ' + (i + 1) + ' de l\'objet">' +
          '<button type="button" class="preview__del" aria-label="Retirer la photo ' + (i + 1) + '">' +
          icon('close') + '</button>';
        div.querySelector('.preview__del').addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          state.photos.splice(i, 1);
          renderPhotos();
        });
        previews.appendChild(div);
      });
      previews.classList.toggle('hidden', state.photos.length === 0);
      if (btnNext) btnNext.disabled = state.photos.length === 0;
    }

    function addFiles(files) {
      Array.prototype.slice.call(files).slice(0, 8 - state.photos.length).forEach(function (file) {
        if (!file.type || file.type.indexOf('image/') !== 0) {
          toast("Ce fichier n'est pas une image.", 'warning');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast('Image trop lourde (10 Mo maximum).', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          state.photos.push(e.target.result);
          renderPhotos();
        };
        reader.readAsDataURL(file);
      });
    }

    input.addEventListener('change', function (e) { addFiles(e.target.files); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.add('is-dragging');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        dropzone.classList.remove('is-dragging');
      });
    });
    dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    });

    /* --- La machine à états --- */
    function goStep(n, doScroll) {
      state.step = n;
      panels.forEach(function (p, i) {
        if (!p) return;
        p.classList.toggle('hidden', i + 1 !== n);
      });
      lines.forEach(function (row) {
        const s = Number(row.getAttribute('data-est-line'));
        row.classList.toggle('is-active', s === n);
        row.classList.toggle('is-done', s < n);
        const tag = row.querySelector('[data-est-state]');
        if (tag) tag.textContent = s < n ? 'Fait' : (s === n ? 'En cours' : 'À faire');
        if (s === n) row.setAttribute('aria-current', 'step');
        else row.removeAttribute('aria-current');
      });
      if (doScroll !== false) scrollToPanel(panels[n - 1]);
    }

    lines.forEach(function (row) {
      row.addEventListener('click', function () {
        goStep(Number(row.getAttribute('data-est-line')));
      });
    });

    if (btnNext) btnNext.addEventListener('click', function () { goStep(2); });
    if (btnBack) btnBack.addEventListener('click', function () { goStep(1); });

    if (selCond) selCond.addEventListener('change', function (e) { state.condition = e.target.value; });
    if (selBrand) selBrand.addEventListener('change', function (e) { state.brand = e.target.value; });
    if (inpAge) inpAge.addEventListener('change', function (e) { state.age = parseInt(e.target.value, 10) || 0; });

    /* --- Le relevé --- */
    function paint(result) {
      const set = function (id, value) {
        const el = $('#' + id, root);
        if (el) el.textContent = value;
      };

      set('est-stamp', money(result.low) + ' – ' + money(result.high) + ' €');
      set('est-range', money(result.avg) + ' €');
      set('est-confidence', result.confidence + ' %');
      set('est-conf-meta', result.confidence + ' %');
      set('est-market', money(result.marketLow) + ' – ' + money(result.marketHigh) + ' €');
      set('est-delay', result.sellDelay);
      set('est-cat-read', result.categoryLabel);
      set('est-cond-read', result.condLabel);
      set('est-brand-read', result.brandLabel);
      set('est-age-read', state.age === 0 ? 'Neuf' : state.age + ' an' + (state.age > 1 ? 's' : ''));
      set('est-summary', 'Sur ' + money(result.basis) + ' ventes comparables, un ' +
        String(result.categoryLabel).toLowerCase() + ' dans cet état sort entre ' +
        money(result.low) + ' € et ' + money(result.high) + ' €. Le médian observé est à ' +
        money(result.avg) + ' €.');
      set('est-hand', '→ à ' + money(result.avg) + ' €, on est dans le marché');

      const list = $('#est-suggestions', root);
      if (list) {
        list.innerHTML = '';
        result.detected.suggestions.forEach(function (text) {
          const li = document.createElement('li');
          li.className = 'est-note';
          li.innerHTML = icon('info') + '<span>' + text + '</span>';
          list.appendChild(li);
        });
      }

      if (empty) empty.classList.add('hidden');
      if (fiche) {
        fiche.classList.remove('hidden');
        // Le prix s'estampe : on relance la séquence du relevé.
        fiche.classList.remove('is-stamped');
        void fiche.offsetWidth;
        fiche.classList.add('is-stamped');
      }
    }

    function runEstimate() {
      if (!state.category) {
        toast("Choisissez d'abord une catégorie à la ligne L.02.", 'warning');
        goStep(2);
        return;
      }
      const result = estimate({
        category: state.category,
        condition: state.condition,
        brand: state.brand,
        age: state.age,
        hasPhotos: state.photos.length > 0,
      });
      if (!result) {
        toast("Catégorie illisible. Reprenez à la ligne L.02.", 'danger');
        goStep(2);
        return;
      }
      paint(result);
      goStep(3);
      toast('Relevé fait. Le prix est estampé.', 'success');
    }

    if (btnRun) btnRun.addEventListener('click', runEstimate);

    function restart() {
      state.photos = [];
      state.category = null;
      state.condition = 'bon';
      state.brand = 'milieu';
      state.age = 3;
      if (inpAge) inpAge.value = 3;
      if (selCond) selCond.value = 'bon';
      if (selBrand) selBrand.value = 'milieu';
      if (cats) $$('.est-cat', cats).forEach(function (b) { b.classList.remove('is-active'); });
      if (fiche) fiche.classList.add('hidden');
      if (empty) empty.classList.remove('hidden');
      renderPhotos();
      goStep(1);
    }

    restarts.forEach(function (btn) { btn.addEventListener('click', restart); });

    /* --- Démarrage --- */
    renderCategories();
    renderPhotos();
    goStep(1, false);

    const params = new URLSearchParams(location.search);
    const catParam = params.get('cat');
    if (catParam && CATEGORIES[catParam]) {
      state.category = catParam;
      if (cats) {
        const btn = cats.querySelector('.est-cat[data-cat="' + catParam + '"]');
        if (btn) btn.classList.add('is-active');
      }
      goStep(2);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
