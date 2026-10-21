/* ==========================================================================
   MaisonVide — Source de vérité des annonces + rendu partagé
   Monde « L'inventaire de brocante » : aucune icône emoji, tout passe par
   le sprite SVG (assets/icons/sprite.svg). En production : fetch depuis l'API.
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Icônes — le sprite dessiné, jamais un caractère                     */
  /* ------------------------------------------------------------------ */
  function icon(name, cls) {
    const c = cls ? 'ic ' + cls : 'ic';
    return `<svg class="${c}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  /* ------------------------------------------------------------------ */
  /* Images de repli — une vignette dessinée, pas un emoji                */
  /* ------------------------------------------------------------------ */
  function svgImg(bg, label) {
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'>
      <rect width='400' height='300' fill='${bg}'/>
      <g fill='none' stroke='#1b1f1c' stroke-opacity='.3' stroke-width='2'>
        <rect x='116' y='92' width='168' height='124'/>
        <path d='M116 134h168M116 176h168M200 92v124'/>
      </g>
      <text x='200' y='252' text-anchor='middle' font-size='19' font-family='Georgia,serif' fill='#1b1f1c' fill-opacity='.42'>${label}</text>
    </svg>`;
  }

  function toDataUrl(svg) {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  /* ------------------------------------------------------------------ */
  /* Formatage (français)                                                 */
  /* ------------------------------------------------------------------ */
  function fmtPrice(n) {
    return Number(n).toLocaleString('fr-FR') + ' €';
  }
  function fmtKm(n) {
    return String(n).replace('.', ',') + ' km';
  }
  function cap(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ------------------------------------------------------------------ */
  /* Les 12 fiches du carnet                                              */
  /* ------------------------------------------------------------------ */
  const DATA = {
    categories: {
      mobilier:       { label: 'Mobilier',           iconId: 'cube',     color: '#e6d3b4' },
      decoration:     { label: 'Décoration',         iconId: 'spark',    color: '#e9dbc2' },
      livres:         { label: 'Livres & BD',        iconId: 'bookmark', color: '#ded0b8' },
      vaisselle:      { label: 'Vaisselle',          iconId: 'package',  color: '#e6d3b4' },
      vetements:      { label: 'Vêtements',          iconId: 'user',     color: '#e9dbc2' },
      electronique:   { label: 'Électronique',       iconId: 'play',     color: '#dcd7c9' },
      jouets:         { label: 'Jouets & jeux',      iconId: 'star',     color: '#e6d3b4' },
      bricolage:      { label: 'Bricolage',          iconId: 'cog',      color: '#dcd7c9' },
      jardin:         { label: 'Jardin & extérieur', iconId: 'leaf',     color: '#ded0b8' },
      art:            { label: 'Art & antiquités',   iconId: 'flag',     color: '#e9dbc2' },
      bijoux:         { label: 'Bijoux',             iconId: 'gem',      color: '#dcd7c9' },
      electromenager: { label: 'Électroménager',     iconId: 'scale',    color: '#e6d3b4' },
    },

    // Niveaux de vérification vendeur (4 niveaux KYC)
    verifyTiers: {
      basic:    { label: 'Email',    iconId: 'mail',         tier: 1 },
      verified: { label: 'Vérifié',  iconId: 'check-circle', tier: 2 },
      pro:      { label: 'Pro',      iconId: 'star',         tier: 3 },
      premium:  { label: 'Premium',  iconId: 'gem',          tier: 4 },
    },

    listings: [
      {
        slug: 'canape-ikea-kivik',
        title: 'Canapé 3 places IKEA KIVIK',
        category: 'mobilier',
        price: 280,
        originalPrice: 599,
        location: 'Paris 11ᵉ',
        distance: 4.2,
        postedAt: 'Il y a 2h',
        condition: 'très bon',
        brand: 'IKEA',
        year: '2021',
        material: 'Tissu gris clair, housse lavable',
        negotiable: true,
        color: '#e6d3b4',
        seller: { name: 'Sophie M.', verified: true, rating: 4.9, sales: 23, trustScore: 92, tier: 'verified', joinedYear: 2024, responseTime: '< 2h', insurance: '2 500 €' },
        description: "Canapé 3 places IKEA modèle KIVIK, 5 ans d'usage, non-fumeur. Tissu gris clair en très bon état, assise ferme, housse lavable. À venir chercher sur rendez-vous.",
        dimensions: '180×78×88 cm',
        delivery: 'Remise en main propre',
        payment: 'Espèces, virement instantané',
      },
      {
        slug: 'table-chene-massif',
        title: 'Table à manger chêne massif',
        category: 'mobilier',
        price: 340,
        originalPrice: 850,
        location: 'Lyon 6ᵉ',
        distance: 2.1,
        postedAt: 'Il y a 5h',
        condition: 'bon',
        brand: 'Fabrication artisanale',
        year: '1990',
        material: 'Chêne massif, allonge papillon',
        negotiable: true,
        color: '#ded0b8',
        seller: { name: 'Julien D.', verified: true, rating: 4.8, sales: 12, trustScore: 87, tier: 'verified', joinedYear: 2024, responseTime: '< 4h', insurance: '2 500 €' },
        description: "Belle table en chêne massif, 6-8 couverts. Allonge papillon intégrée. Quelques marques d'usage visibles mais bois sain.",
        dimensions: '160×90×75 cm (allonge 220)',
        delivery: 'Remise en main propre, démontable',
        payment: 'Virement, Lydia',
      },
      {
        slug: 'lampe-articulo',
        title: 'Lampe sur pied Articulée vintage',
        category: 'decoration',
        price: 85,
        originalPrice: 220,
        location: 'Bordeaux',
        distance: 1.3,
        postedAt: 'Hier',
        condition: 'très bon',
        brand: 'Articulo',
        year: '1975',
        material: 'Laiton brossé',
        negotiable: false,
        color: '#e9dbc2',
        seller: { name: 'Christine P.', verified: true, rating: 5.0, sales: 47, trustScore: 98, tier: 'premium', joinedYear: 2024, responseTime: '< 30min', insurance: '10 000 €' },
        description: "Lampe articulée des années 70, laiton brossé, fonctionne parfaitement. Ampoule E27 non fournie.",
        dimensions: 'Hauteur 160 cm',
        delivery: 'Remise en main propre',
        payment: 'Tous',
      },
      {
        slug: 'macbook-pro-m1',
        title: 'MacBook Pro 13" M1 2020',
        category: 'electronique',
        price: 720,
        originalPrice: 1499,
        location: 'Paris 18ᵉ',
        distance: 5.8,
        postedAt: 'Il y a 30 min',
        condition: 'très bon',
        brand: 'Apple',
        year: '2020',
        material: 'Aluminium, 8 Go RAM, 256 Go SSD',
        negotiable: false,
        color: '#dcd7c9',
        seller: { name: 'Antoine R.', verified: true, rating: 4.7, sales: 5, trustScore: 84, tier: 'verified', joinedYear: 2024, responseTime: '< 1h', insurance: '2 500 €' },
        description: "MacBook Pro 13 pouces, puce M1, 8 Go RAM, 256 Go SSD. Cycle batterie 312. Chargeur d'origine. Aucun défaut.",
        dimensions: '13 pouces · 1.4 kg',
        delivery: 'Remise en main propre ou colissimo',
        payment: 'Virement, Lydia',
      },
      {
        slug: 'commode-laque-p60',
        title: 'Commode années 60',
        category: 'mobilier',
        price: 145,
        originalPrice: 320,
        location: 'Nantes',
        distance: 8.4,
        postedAt: 'Il y a 1j',
        condition: 'bon',
        brand: 'Scandinave',
        year: '1965',
        material: 'Teak massif, poignées d\'origine',
        negotiable: true,
        color: '#ded0b8',
        seller: { name: 'Famille L.', verified: true, rating: 4.6, sales: 8, trustScore: 82, tier: 'verified', joinedYear: 2024, responseTime: '< 6h', insurance: '2 500 €' },
        description: "Commode pieds compas, 4 tiroirs. Bois massif, poignées d'origine. Style scandinave authentique.",
        dimensions: '90×45×80 cm',
        delivery: 'Remise en main propre',
        payment: 'Espèces, virement',
      },
      {
        slug: 'velo-ville-peugeot',
        title: 'Vélo de ville Peugeot',
        category: 'bricolage',
        price: 95,
        originalPrice: 320,
        location: 'Toulouse',
        distance: 3.2,
        postedAt: 'Il y a 3j',
        condition: 'bon',
        brand: 'Peugeot',
        year: '2019',
        material: 'Acier, 7 vitesses, pneus neufs',
        negotiable: true,
        color: '#e6d3b4',
        seller: { name: 'Marc B.', verified: false, rating: 4.2, sales: 2, trustScore: 58, tier: 'basic', joinedYear: 2026, responseTime: '< 12h', insurance: '1 000 €' },
        description: "Vélo de ville Peugeot, 7 vitesses. Quelques traces d'usage mais fonctionne parfaitement. Pneus neufs.",
        dimensions: 'Taille M (1m70-1m80)',
        delivery: 'Remise en main propre',
        payment: 'Espèces, Lydia',
      },
      {
        slug: 'livre-honestpreface',
        title: 'Collection complète Astérix (34 tomes)',
        category: 'livres',
        price: 110,
        originalPrice: 280,
        location: 'Lille',
        distance: 12.1,
        postedAt: 'Il y a 6h',
        condition: 'très bon',
        brand: 'Dargaud',
        year: '1975',
        material: 'Broché, éditions originales',
        negotiable: true,
        color: '#e9dbc2',
        seller: { name: 'Bibliothèque V.', verified: true, rating: 4.9, sales: 18, trustScore: 91, tier: 'verified', joinedYear: 2024, responseTime: '< 3h', insurance: '2 500 €' },
        description: "Collection complète Astérix, 34 tomes, éditions originales. Très bon état, peu de lecture.",
        dimensions: 'Format poche',
        delivery: 'Colissimo ou remise en main propre',
        payment: 'Tous',
      },
      {
        slug: 'robot-cuiseur-thermomix',
        title: 'Thermomix TM6',
        category: 'electromenager',
        price: 680,
        originalPrice: 1359,
        location: 'Paris 9ᵉ',
        distance: 4.6,
        postedAt: 'Il y a 1h',
        condition: 'très bon',
        brand: 'Vorwerk',
        year: '2024',
        material: 'Plastique, tous accessoires et boîte',
        negotiable: false,
        color: '#dcd7c9',
        seller: { name: 'Cuisine M.', verified: true, rating: 5.0, sales: 31, trustScore: 96, tier: 'pro', joinedYear: 2024, responseTime: '< 1h', insurance: '5 000 €' },
        description: "Thermomix TM6, 2 ans, parfait état. Tous les accessoires inclus, boîte d'origine.",
        dimensions: '34×32×32 cm',
        delivery: 'Remise en main propre',
        payment: 'Virement, Lydia',
      },
      {
        slug: 'manteau-cuir-le-vrai',
        title: 'Manteau cuir Le Vrai Breton',
        category: 'vetements',
        price: 145,
        originalPrice: 450,
        location: 'Rennes',
        distance: 2.7,
        postedAt: 'Il y a 4h',
        condition: 'bon',
        brand: 'Le Vrai Breton',
        year: '2021',
        material: 'Cuir pleine fleur, doublure intacte',
        negotiable: true,
        color: '#ded0b8',
        seller: { name: 'Hélène G.', verified: true, rating: 4.8, sales: 9, trustScore: 86, tier: 'verified', joinedYear: 2025, responseTime: '< 4h', insurance: '2 500 €' },
        description: "Manteau cuir Le Vrai Breton, taille 38. Porté 2 saisons. Cuir encore souple, doublure en parfait état.",
        dimensions: 'Taille 38',
        delivery: 'Colissimo ou remise',
        payment: 'Virement',
      },
      {
        slug: 'console-ps5',
        title: 'PlayStation 5 + 2 manettes',
        category: 'electronique',
        price: 380,
        originalPrice: 549,
        location: 'Marseille',
        distance: 5.5,
        postedAt: 'Il y a 8h',
        condition: 'très bon',
        brand: 'Sony',
        year: '2023',
        material: 'Plastique blanc, 3 jeux inclus',
        negotiable: false,
        color: '#e6d3b4',
        seller: { name: 'Gamer P.', verified: true, rating: 4.9, sales: 14, trustScore: 89, tier: 'verified', joinedYear: 2024, responseTime: '< 2h', insurance: '2 500 €' },
        description: "PS5 édition standard, 2 manettes DualSense, 3 jeux inclus (Spider-Man 2, FIFA 24, GT7). Aucun défaut.",
        dimensions: 'Console + boîte',
        delivery: 'Remise en main propre',
        payment: 'Virement, Lydia',
      },
      {
        slug: 'vase-murano',
        title: 'Vase Murano signé',
        category: 'art',
        price: 320,
        originalPrice: 800,
        location: 'Paris 6ᵉ',
        distance: 6.2,
        postedAt: 'Il y a 2j',
        condition: 'très bon',
        brand: 'Murano',
        year: '1982',
        material: 'Verre soufflé, signé',
        negotiable: false,
        color: '#e9dbc2',
        seller: { name: 'Galerie S.', verified: true, rating: 5.0, sales: 67, trustScore: 99, tier: 'premium', joinedYear: 2023, responseTime: '< 30min', insurance: '10 000 €' },
        description: "Vase Murano signé, années 80, travail du verre soufflé. Hauteur 32 cm. Pièce de collection.",
        dimensions: 'H 32 cm · Ø 18 cm',
        delivery: 'Remise en main propre',
        payment: 'Virement sécurisé séquestre',
      },
      {
        slug: 'seche-cheveux-dyson',
        title: 'Sèche-cheveux Dyson Supersonic',
        category: 'electromenager',
        price: 175,
        originalPrice: 329,
        location: 'Nice',
        distance: 3.8,
        postedAt: 'Il y a 12h',
        condition: 'très bon',
        brand: 'Dyson',
        year: '2025',
        material: 'Nickel et cuivre, tous embouts',
        negotiable: true,
        color: '#dcd7c9',
        seller: { name: 'Beauté F.', verified: true, rating: 4.8, sales: 6, trustScore: 81, tier: 'verified', joinedYear: 2025, responseTime: '< 5h', insurance: '2 500 €' },
        description: "Dyson Supersonic HD08, 1 an. Tous les embouts fournis. Couleur nickel/cuivre.",
        dimensions: 'Boîte complète',
        delivery: 'Colissimo recommandé',
        payment: 'Lydia',
      },
    ],
  };

  /* ------------------------------------------------------------------ */
  /* Photos réelles + repli dessiné                                        */
  /* ------------------------------------------------------------------ */
  const PHOTOS = {
    'canape-ikea-kivik':       ['listing-canape.jpg', 'storytelling.jpg', 'lifestyle-2.jpg'],
    'table-chene-massif':      ['listing-table.jpg', 'lifestyle-1.jpg', 'lifestyle-2.jpg'],
    'lampe-articulo':          ['listing-lampe.jpg', 'storytelling.jpg', 'lifestyle-3.jpg'],
    'macbook-pro-m1':          ['listing-macbook.jpg', 'lifestyle-1.jpg', 'lifestyle-2.jpg'],
    'commode-laque-p60':       ['listing-commode.jpg', 'storytelling.jpg', 'lifestyle-2.jpg'],
    'velo-ville-peugeot':      ['listing-velo.jpg', 'lifestyle-3.jpg', 'storytelling.jpg'],
    'livre-honestpreface':     ['listing-asterix.jpg', 'storytelling.jpg', 'lifestyle-2.jpg'],
    'robot-cuiseur-thermomix': ['listing-thermomix.jpg', 'lifestyle-1.jpg', 'storytelling.jpg'],
    'manteau-cuir-le-vrai':    ['listing-manteau.jpg', 'lifestyle-2.jpg', 'lifestyle-3.jpg'],
    'console-ps5':             ['listing-ps5.jpg', 'lifestyle-1.jpg', 'lifestyle-2.jpg'],
    'vase-murano':             ['listing-murano.jpg', 'storytelling.jpg', 'lifestyle-1.jpg'],
    'seche-cheveux-dyson':     ['listing-dyson.jpg', 'lifestyle-3.jpg', 'storytelling.jpg'],
  };

  const AVATARS = {
    'Sophie M.': 'avatar-sophie.jpg',
    'Julien D.': 'avatar-julien.jpg',
    'Christine P.': 'avatar-christine.jpg',
  };

  // Une référence de carnet par fiche (L.01 … L.12) + photos + avatar.
  DATA.listings.forEach((l, i) => {
    l.ref = 'L.' + String(i + 1).padStart(2, '0');
    l.photos = (PHOTOS[l.slug] || []).map(p => 'assets/img/' + p);
    l.image = l.photos[0] || toDataUrl(svgImg(l.color, DATA.categories[l.category].label));
    l.images = l.photos.length ? l.photos.slice() : [l.image];
    l.avatar = AVATARS[l.seller.name] ? 'assets/img/' + AVATARS[l.seller.name] : null;
  });

  // L'icône de catégorie reste utilisable telle quelle par les autres pages.
  Object.keys(DATA.categories).forEach(key => {
    DATA.categories[key].icon = icon(DATA.categories[key].iconId);
  });

  /* ------------------------------------------------------------------ */
  /* Utils                                                                */
  /* ------------------------------------------------------------------ */
  function findListing(slug) {
    return DATA.listings.find(l => l.slug === slug);
  }

  function tierMeta(tier) {
    return DATA.verifyTiers[tier] || DATA.verifyTiers.verified;
  }

  // Le niveau KYC, sans jamais répéter le sceau « Vérifié ».
  function tierLabel(tier) {
    const t = tierMeta(tier);
    return t.tier > 2 ? 'KYC ' + t.tier + ' · ' + t.label : 'KYC ' + t.tier;
  }

  function cityOf(location) {
    return String(location).replace(/\s+\d+ᵉ$/u, '').trim();
  }

  function initials(name) {
    return String(name).split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  }

  /* ------------------------------------------------------------------ */
  /* RENDU — une ligne réglée du carnet                                   */
  /* ------------------------------------------------------------------ */
  function listingRow(l) {
    const cat = DATA.categories[l.category];
    const url = 'annonce.html?slug=' + l.slug;
    const off = Math.round((1 - l.price / l.originalPrice) * 100);

    return `
    <article class="cat-row" data-slug="${l.slug}">
      <a class="cat-row__media" href="${url}" aria-label="Voir la fiche : ${esc(l.title)}">
        <img src="${l.image}" alt="" loading="lazy" decoding="async">
      </a>

      <div class="cat-row__main">
        <div class="cat-row__head">
          <span class="etiquette">${l.ref}</span>
          <span class="badge badge--kraft">${cat.label}</span>
        </div>
        <h3 class="cat-row__title"><a href="${url}">${esc(l.title)}</a></h3>
        <p class="cat-row__meta">
          <span>${l.seller.name}</span>
          <span>${l.location}</span>
          <span>${fmtKm(l.distance)}</span>
          <span>${l.postedAt}</span>
        </p>
        <div class="cat-row__tags">
          ${l.seller.verified ? `<span class="sceau">${icon('check', 'ic--sm')} Vérifié</span>` : ''}
          <span class="badge">${cap(l.condition)}</span>
          <span class="badge">${tierLabel(l.seller.tier)}</span>
          <span class="badge badge--stamp">−${off} %</span>
        </div>
      </div>

      <div class="cat-row__price">
        <span class="stamp-price">${fmtPrice(l.price)}</span>
        <span class="cat-row__was"><s>${fmtPrice(l.originalPrice)}</s> neuf</span>
      </div>

      <button class="cat-row__fav" type="button" data-wishlist="${l.slug}"
              aria-label="Ajouter ${esc(l.title)} aux favoris" aria-pressed="false">
        ${icon('heart')}
      </button>
    </article>`;
  }

  /* ------------------------------------------------------------------ */
  /* Favoris : aria-pressed synchronisé avec l'état de session            */
  /* ------------------------------------------------------------------ */
  function syncWishlistPressed() {
    document.querySelectorAll('[data-wishlist]').forEach(b => {
      b.setAttribute('aria-pressed', b.classList.contains('is-active') ? 'true' : 'false');
    });
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('[data-wishlist]')) return;
    setTimeout(syncWishlistPressed, 0);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncWishlistPressed);
  } else {
    syncWishlistPressed();
  }

  window.MaisonVideData = {
    DATA, findListing, toDataUrl, svgImg, icon,
    listingRow, tierMeta, tierLabel, cityOf, initials,
    fmtPrice, fmtKm, cap, esc, PHOTOS, AVATARS,
  };
})();
