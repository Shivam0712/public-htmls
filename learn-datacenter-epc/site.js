/* site.js — reader behaviour. No network, no dependencies.
   Progress, quiz results and the card-deck position live in localStorage under dc-course:*.
   Copied verbatim into docs/ by scripts/build-docs.py. */
(function () {
  'use strict';
  var KEY_READ = 'dc-course:read', KEY_QUIZ = 'dc-course:quiz';
  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var page = document.body.getAttribute('data-page') || '';

  /* ---- reading progress line (chapter pages) ---- */
  var bar = document.querySelector('.progress'), tick = null;
  if (bar) {
    tick = function () {
      if (document.querySelector('.deck[data-view=one]')) return; /* the deck sets it by card index */
      var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? Math.min(100, 100 * h.scrollTop / max) : 0) + '%';
    };
    addEventListener('scroll', tick, { passive: true }); tick();
  }

  /* ---- mark as read ---- */
  var mark = document.querySelector('[data-mark-read]');
  if (mark && page) {
    var read = load(KEY_READ);
    var render = function () {
      var on = !!read[page];
      mark.textContent = on ? 'Read ✓' : 'Mark as read';
      mark.classList.toggle('done', on);
      mark.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    mark.addEventListener('click', function () {
      if (read[page]) delete read[page]; else read[page] = new Date().toISOString();
      save(KEY_READ, read); render();
    });
    render();
  }

  /* ---- expand / collapse every read-more on a chapter ---- */
  var xa = document.querySelector('[data-expand-all]');
  if (xa) {
    var mores = document.querySelectorAll('details.more');
    var paint2 = function () {
      var allOpen = Array.prototype.every.call(mores, function (d) { return d.open; });
      xa.textContent = allOpen ? 'Collapse all' : 'Expand all';
      xa.setAttribute('aria-pressed', allOpen ? 'true' : 'false');
    };
    xa.addEventListener('click', function () {
      var allOpen = Array.prototype.every.call(mores, function (d) { return d.open; });
      mores.forEach(function (d) { d.open = !allOpen; }); paint2();
    });
    mores.forEach(function (d) { d.addEventListener('toggle', paint2); });
    paint2();
  }

  /* ---- quiz cards ---- */
  var quiz = load(KEY_QUIZ);
  document.querySelectorAll('.quiz').forEach(function (card) {
    var id = page + '#' + card.getAttribute('data-q');
    var res = card.querySelector('.result');
    var paint = function () {
      var r = quiz[id];
      card.classList.toggle('hit', r === 'hit');
      card.classList.toggle('miss', r === 'miss');
      if (res) res.textContent = r === 'hit' ? 'Got it last time' : r === 'miss' ? 'Missed last time' : '';
    };
    card.querySelector('.reveal').addEventListener('click', function () { card.classList.add('open'); });
    card.querySelectorAll('[data-score]').forEach(function (b) {
      b.addEventListener('click', function () {
        quiz[id] = b.getAttribute('data-score'); save(KEY_QUIZ, quiz); paint();
      });
    });
    paint();
  });


  /* ---- card deck (C-<slug> pages) ----
     One state, one render(). The cards themselves are quiz cards (handled
     above, stored under dc-course:quiz as C-<slug>#<id>); this block only
     decides which of them are shown. view: 'one' (current card, Next /
     Previous, arrow keys, swipe) or 'all' (the list). filter: null or the
     list of card indices to step through (Review missed). The position is
     remembered per deck under dc-course:deck-pos. */
  var deck = document.querySelector('.deck');
  if (deck) {
    var KEY_POS = 'dc-course:deck-pos', deckId = page;
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.card'));
    var fin = deck.querySelector('.card.fin'), last = cards.length - 1;
    var posStore = load(KEY_POS);
    var st = { view: 'one', i: Math.min(Math.max(parseInt(posStore[deckId], 10) || 0, 0), last), filter: null };
    var vt = deck.querySelector('[data-view-toggle]'), dn = deck.querySelector('[data-deck-note]');
    var bPrev = deck.querySelector('[data-prev]'), bNext = deck.querySelector('[data-next]');
    var bMiss = deck.querySelector('[data-review-missed]'), bAll = deck.querySelector('[data-review-all]');
    var order = function () { return st.filter || cards.map(function (_, k) { return k; }); };
    var tally = function () {
      var q = load(KEY_QUIZ), t = { hit: 0, miss: 0, missIdx: [] };
      cards.forEach(function (c, k) {
        var id = c.getAttribute('data-q'); if (!id) return;
        var r = q[deckId + '#' + id];
        if (r === 'hit') t.hit++; else if (r === 'miss') { t.miss++; t.missIdx.push(k); }
      });
      return t;
    };
    var renderDeck = function () {
      var vis = order();
      if (vis.indexOf(st.i) < 0) st.i = vis[0];
      var k = vis.indexOf(st.i), one = st.view === 'one';
      deck.setAttribute('data-view', st.view);
      cards.forEach(function (c, j) {
        c.classList.toggle('cur', j === st.i);
        c.hidden = one ? j !== st.i : vis.indexOf(j) < 0;
      });
      if (vt) { vt.textContent = one ? 'Show all cards' : 'One at a time'; vt.setAttribute('aria-pressed', one ? 'false' : 'true'); }
      if (bPrev) bPrev.disabled = k <= 0;
      if (bNext) bNext.disabled = k >= vis.length - 1;
      var t = tally();
      if (fin) {
        fin.querySelector('[data-fin-hit]').textContent = t.hit;
        fin.querySelector('[data-fin-miss]').textContent = t.miss;
        fin.querySelector('[data-fin-left]').textContent = last - t.hit - t.miss;
        if (bMiss) { bMiss.disabled = t.miss === 0; bMiss.textContent = t.miss ? 'Review ' + t.miss + ' missed' : 'Nothing missed'; }
        if (bAll) bAll.hidden = !st.filter;
      }
      if (dn) dn.textContent = st.filter ? 'Reviewing ' + (st.filter.length - 1) + ' missed card' + (st.filter.length === 2 ? '' : 's') : '';
      if (bar) { if (one) bar.style.width = (100 * (k + 1) / vis.length).toFixed(2) + '%'; else if (tick) tick(); }
      posStore[deckId] = st.i; save(KEY_POS, posStore);
    };
    var go = function (d) {
      var vis = order(), k = vis.indexOf(st.i) + d;
      if (k < 0 || k >= vis.length) return;
      st.i = vis[k]; renderDeck();
      var top = deck.getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > top || deck.getBoundingClientRect().top < 0) window.scrollTo(0, top);
      var h = cards[st.i].querySelector('h2');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    };
    if (bPrev) bPrev.addEventListener('click', function () { go(-1); });
    if (bNext) bNext.addEventListener('click', function () { go(1); });
    if (vt) vt.addEventListener('click', function () { st.view = st.view === 'one' ? 'all' : 'one'; renderDeck(); });
    if (bMiss) bMiss.addEventListener('click', function () {
      var m = tally().missIdx; if (!m.length) return;
      st.filter = m.concat([last]); st.i = m[0]; renderDeck();
      if (st.view === 'one') go(0);
    });
    if (bAll) bAll.addEventListener('click', function () { st.filter = null; renderDeck(); });
    deck.addEventListener('click', function (ev) { if (ev.target.closest('[data-score]')) renderDeck(); });
    document.addEventListener('keydown', function (ev) {
      if (st.view !== 'one' || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
    });
    var tx = 0, ty = 0, touching = false;
    deck.addEventListener('touchstart', function (ev) {
      var t = ev.changedTouches[0]; tx = t.clientX; ty = t.clientY; touching = true;
    }, { passive: true });
    deck.addEventListener('touchend', function (ev) {
      if (!touching) return; touching = false;
      if (st.view !== 'one') return;
      var t = ev.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    renderDeck();
  }

  /* ---- figure lightbox: tap a raster figure to see it at readable size ----
     Illustration labels are about 6px tall at phone width. One overlay per
     page, built on first use. Fit by default; tapping the image toggles 2x
     around the tap point; the view scrolls and the browser pinch-zooms.
     Close: button, Escape, or a tap on the backdrop; focus returns. */
  var figImgs = document.querySelectorAll('figure.fig img');
  if (figImgs.length) {
    var lb = null, lbImg, lbCap, lbClose, lbView, opener = null, scrollY0 = 0, lastTap = 0;
    var toggleZoom = function (ev) {
      var now = Date.now(); if (now - lastTap < 300) return; lastTap = now; /* a double tap is one toggle */
      var zoomed = !lb.classList.contains('zoomed');
      if (zoomed) {
        var r = lbImg.getBoundingClientRect();
        var fx = ev ? (ev.clientX - r.left) / r.width : 0.5, fy = ev ? (ev.clientY - r.top) / r.height : 0.5;
        lbImg.style.width = (r.width * 2) + 'px';
        lb.classList.add('zoomed');
        lbView.scrollLeft = fx * lbImg.clientWidth - lbView.clientWidth / 2;
        lbView.scrollTop = fy * lbImg.clientHeight - lbView.clientHeight / 2;
      } else { lb.classList.remove('zoomed'); lbImg.style.width = ''; }
      lbImg.setAttribute('aria-pressed', zoomed ? 'true' : 'false');
    };
    var close = function () {
      if (!lb || lb.hidden) return;
      lb.classList.remove('open'); lb.hidden = true;
      document.documentElement.classList.remove('lb-lock'); document.body.classList.remove('lb-lock');
      document.body.style.top = ''; window.scrollTo(0, scrollY0);
      if (opener) opener.focus({ preventScroll: true });
    };
    var build = function () {
      lb = document.createElement('div');
      lb.className = 'lightbox'; lb.hidden = true;
      lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Enlarged figure');
      lb.innerHTML = '<div class="lb-bar"><button type="button" class="lb-close" aria-label="Close">×</button></div>' +
        '<div class="lb-view"><img alt="" tabindex="0" role="button" aria-label="Toggle zoom" aria-pressed="false"></div>' +
        '<p class="lb-cap"></p>';
      document.body.appendChild(lb);
      lbImg = lb.querySelector('img'); lbCap = lb.querySelector('.lb-cap');
      lbClose = lb.querySelector('.lb-close'); lbView = lb.querySelector('.lb-view');
      lbClose.addEventListener('click', close);
      lb.addEventListener('click', function (ev) { if (ev.target === lbView || ev.target === lbCap) close(); });
      lbImg.addEventListener('click', toggleZoom);
      lbImg.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleZoom(null); }
      });
      lb.addEventListener('keydown', function (ev) { /* two tab stops: close, image */
        if (ev.key !== 'Tab') return;
        if (ev.shiftKey && document.activeElement === lbClose) { ev.preventDefault(); lbImg.focus(); }
        else if (!ev.shiftKey && document.activeElement === lbImg) { ev.preventDefault(); lbClose.focus(); }
      });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !lb.hidden) close(); });
    };
    var open = function (img) {
      if (!lb) build();
      opener = img;
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt || '';
      var cap = img.closest('figure').querySelector('figcaption');
      lbCap.textContent = cap ? cap.textContent : '';
      lb.classList.remove('zoomed'); lbImg.style.width = ''; lbImg.setAttribute('aria-pressed', 'false');
      scrollY0 = window.scrollY;
      document.body.style.top = -scrollY0 + 'px';
      document.documentElement.classList.add('lb-lock'); document.body.classList.add('lb-lock');
      lb.hidden = false;
      requestAnimationFrame(function () { lb.classList.add('open'); });
      lbClose.focus();
    };
    figImgs.forEach(function (img) {
      img.setAttribute('tabindex', '0'); img.setAttribute('role', 'button'); img.setAttribute('aria-label', 'Enlarge figure');
      img.addEventListener('click', function () { open(img); });
      img.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(img); }
      });
      var hint = document.createElement('span'); hint.className = 'fig-hint aside'; hint.textContent = 'Tap to enlarge';
      img.closest('figure').appendChild(hint);
    });
  }

  /* ============ landing page: the density explorer ============
     One decision, rack density, flows down a bus and re-sizes everything.
     All numbers are rules of thumb an engineer would recognise, stated as
     ranges; the assumptions block under the hero lists them and Topics 2,
     5, 7, 8 refine them. Keep the model in estimate() and nowhere else. */
  var RACKS = 1000;          // the hall we hold fixed: a room of 1,000 cabinets
  var BLOCK_MW = 2.5;        // one UPS block, commonly 2 to 3 MW (Topic 5)
  var GEN_MW = 2.75;         // one standby genset; generators carry IT x PUE, the UPS only IT (Topic 5)
  var THRESH = [20, 45, 80]; // kW/rack: 20 is the comfort limit for air (containment reaches ~30 with discipline), 45 containment ends, 80 liquid required (Topics 2, 7)
  var REGIME = [
    { mode: 'Air, room-level', pue: [1.4, 1.7], liquid: [0, 0],     m2: 2.8 },
    { mode: 'Air with containment', pue: [1.25, 1.45], liquid: [0, 0], m2: 2.8 },
    { mode: 'Rear-door heat exchangers', pue: [1.2, 1.35], liquid: [0.8, 1.0], m2: 3.2 },
    { mode: 'Direct-to-chip liquid', pue: [1.1, 1.2], liquid: [0.7, 0.8], m2: 4.0 }
  ];
  /* The slider is stepped: its value is an index into STEPS, the list of
     densities where a categorical output flips (regime, grid tier, what
     fits, floor) plus the reference hall's zone densities. The list comes
     from the section's data-steps attribute (STEPS in build-docs.py, derived
     by scripts/explorer_steps.py), so it lives in one place. */

  function estimate(d) {
    var r = d < THRESH[0] ? 0 : d < THRESH[1] ? 1 : d < THRESH[2] ? 2 : 3, R = REGIME[r];
    var it = d * RACKS / 1000;                              // MW of IT load
    var fac = [it * R.pue[0], it * R.pue[1]];               // MW at the fence
    var ups = Math.ceil(it / BLOCK_MW) + 1;                 // N+1 UPS blocks, sized on IT load
    var facMid = (fac[0] + fac[1]) / 2;
    var gens = Math.ceil(facMid / GEN_MW) + 1;              // N+1 gensets, sized on IT x PUE (mechanical load too)
    var tier = facMid <= 15 ? 0 : facMid <= 50 ? 1 : facMid <= 150 ? 2 : 3; // interconnect class (Topic 5)
    var mass = d < THRESH[2] ? 400 + 8 * d : Math.max(400 + 8 * d, 1400); // kg per loaded rack, +-20%; vendor floor for rack-scale AI (Topic 8)
    var white = RACKS * R.m2;                               // m2 of computer room
    var plant = it * 1000 * 0.5;                            // m2 of plant, 0.4-0.6 m2/kW
    var share = white / (white + plant);
    var capex = [8 + 0.03 * d, 12 + 0.05 * d];              // $M per MW of IT, ex-servers
    return { d: d, r: r, R: R, it: it, fac: fac, ups: ups, gens: gens, tier: tier, mass: mass,
             white: white, gross: white + plant, share: share, capex: capex,
             total: [it * capex[0], it * capex[1]] };
  }

  var TIER = ['a distribution feeder (12 to 35 kV)', 'a dedicated substation (69 to 138 kV)',
              'a transmission-fed substation (138 to 230 kV)', 'a transmission interconnect (230 to 345 kV)'];
  var TIER_SHORT = ['distribution feeder', 'dedicated substation', 'transmission-fed substation', 'transmission interconnect'];
  var NET = ['Copper to a top-of-rack switch, a few fibre uplinks. Cabling is a trade, not a design driver.',
             'Still copper in the rack; 25G to the server, fibre uplinks. Trays begin to fill.',
             '100G to the rack, fibre everywhere above it; pathways are sized, not assumed.',
             'A GPU fabric: hundreds of fibre strands and optics per rack. Pathways and optics are a design item and a cost line.'];
  var OPS = ['Filters, hot spots, CRAC upkeep.', 'Containment discipline; airflow commissioning.',
             'A coolant loop at every rack door joins the air routine.',
             'Coolant chemistry, leak detection, CDU maintenance; each rack weighs more than a car.'];
  function fmtMW(x) { return x < 10 ? x.toFixed(1) : Math.round(x).toString(); }
  function fmtN(x) { return Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function fmtRange(a, b, f) { return f(a) + ' to ' + f(b); }
  function fmtMoney(m) { return m >= 1000 ? '$' + (m / 1000).toFixed(1) + 'B' : '$' + fmtN(Math.round(m / 10) * 10) + 'M'; }
  function fits(e) {
    var d = e.d;
    if (e.r === 0) return 'about ' + Math.min(42, Math.round(d / 0.7)) + ' general-purpose servers';
    if (e.r === 1) return 'a full rack of dense two-socket servers, or ' + Math.round(d / 12) + ' eight-GPU servers';
    if (e.r === 2) return Math.round(d / 12) + ' eight-GPU servers at 10 to 14 kW each';
    if (d < 100) return 'a partial rack-scale GPU system, or ' + Math.round(d / 12) + ' eight-GPU servers';
    if (d <= 145) return 'one rack-scale AI system (GB200 NVL72 120 to 132 kW, GB300 NVL72 132 to 142 kW)';
    return 'GB300 peaks near 155 kW; Vera Rubin 120 to 190 kW from H2 2026; Kyber about 600 kW on 800 VDC in 2027';
  }
  function floorNote(m) {
    return m < 900 ? 'a standard raised floor carries it'
         : m < 1400 ? 'at the rating of most raised floors; slab preferred'
         : 'slab on grade, with a structural check per rack';
  }
  function takeaway(e) {
    var d = Math.round(e.d), pl = Math.round(100 - e.share * 100);
    if (e.r === 0) return 'At ' + d + ' kW a rack this is a conventional hall: ' + fmtMW(e.it) + ' MW of IT, air-cooled, ' + e.ups + ' UPS blocks and ' + e.gens + ' generators, and roughly ' + Math.round(e.share * 100) + '% of the building is computer room.';
    if (e.r === 1) return 'At ' + d + ' kW a rack air still works, but only with containment; ' + fmtMW(e.it) + ' MW of IT needs ' + e.ups + ' UPS blocks and ' + e.gens + ' generators, and the plant is already ' + pl + '% of the building.';
    if (e.r === 2) return 'At ' + d + ' kW a rack air alone has given out: heat leaves through a liquid loop at the rack door, the grid connection is ' + TIER[e.tier].split(' (')[0] + ', and the building is ' + pl + '% plant.';
    return 'At ' + d + ' kW a rack cold plates are mandatory; ' + fmtMW(e.it) + ' MW of IT becomes ' + fmtRange(e.fac[0], e.fac[1], fmtMW) + ' MW at the fence, and the computer room is ' + Math.round(e.share * 100) + '% of a building that is now a power and cooling plant.';
  }

  /* ---- drawings: 120 x 72 viewBox each, classes styled by site.css ---- */
  function picRack(e) {
    var s = '<rect class="ln" x="44" y="4" width="32" height="64"/>', i, n, h;
    if (e.r < 2) {
      n = Math.min(40, Math.round(e.d / 0.5)); h = 60 / 40;
      for (i = 0; i < n; i++) s += '<rect class="dim" x="47" y="' + (66 - (i + 1) * h).toFixed(1) + '" width="26" height="' + (h * 0.6).toFixed(1) + '"/>';
    } else {
      n = Math.min(9, Math.round(e.d / 14));
      for (i = 0; i < n; i++) s += '<rect class="fl" x="47" y="' + (66 - (i + 1) * 6.4).toFixed(1) + '" width="26" height="5"/>';
    }
    if (e.r === 2) s += '<rect class="wt" x="77" y="6" width="5" height="60"/>';
    if (e.r === 3) s += '<path class="wt" d="M38 10 V66 M40 10 V66 M40 20 H44 M40 40 H44 M40 60 H44 M38 30 H44 M38 50 H44"/>';
    return s;
  }
  function picPower(e) {
    var s = '', i, cols = 9, bw = 8, bh = 5, gx = 9.4, gy = 6.6;
    for (i = 0; i <= e.tier; i++) s += '<path class="ln" d="M' + (10 + i * 5) + ' 4 V16"/>';
    s += '<circle class="ln" cx="15" cy="26" r="8"/><circle class="ln" cx="15" cy="38" r="8"/><path class="ln" d="M15 46 V60 H32"/>';
    for (i = 0; i < e.ups; i++) {
      s += '<rect class="fl" x="' + (34 + (i % cols) * gx).toFixed(1) + '" y="' + (8 + Math.floor(i / cols) * gy).toFixed(1) + '" width="' + bw + '" height="' + bh + '"/>';
    }
    return s;
  }
  function picCooling(e) {
    var liq = (e.R.liquid[0] + e.R.liquid[1]) / 2, air = 1 - liq;
    var s = '<rect class="ln" x="6" y="14" width="16" height="40"/>';
    s += '<path class="ln" d="M22 24 H56 M50 20 l6 4 -6 4"/><rect class="ln" x="58" y="12" width="26" height="22"/><circle class="ln" cx="71" cy="23" r="7"/><path class="ln" d="M71 16 V30 M64 23 H78"/>';
    if (liq > 0) s += '<path class="wt" d="M22 46 H56 M50 42 l6 4 -6 4"/><rect class="wt" x="58" y="38" width="26" height="18"/><path class="wt" d="M62 47 h18 M62 43 h18 M62 51 h18"/>';
    else s += '<path class="dm" d="M22 46 H56"/>';
    s += '<rect class="dim" x="6" y="62" width="' + (108 * air).toFixed(1) + '" height="6"/>';
    s += '<rect class="wf" x="' + (6 + 108 * air).toFixed(1) + '" y="62" width="' + (108 * liq).toFixed(1) + '" height="6"/>';
    return s;
  }
  function picBuilding(e) {
    var W = 76, H = 56, k = Math.sqrt(e.share), w = W * k, h = H * k, t = 3 + 9 * Math.min(1, e.mass / 1600);
    var s = '<rect class="hatch" x="4" y="6" width="' + W + '" height="' + H + '"/><rect class="ln" x="4" y="6" width="' + W + '" height="' + H + '"/>';
    s += '<rect class="fl" x="' + (4 + W - w).toFixed(1) + '" y="' + (6 + H - h).toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '"/>';
    s += '<rect class="ln" x="94" y="' + (62 - t - 30).toFixed(1) + '" width="14" height="30"/><rect class="dim" x="86" y="' + (62 - t).toFixed(1) + '" width="30" height="' + t.toFixed(1) + '"/>';
    return s;
  }
  function picNetwork(e) {
    var n = [3, 5, 9, 16][e.r], cls = e.r < 2 ? 'ln' : 'wt', s = '<rect class="ln" x="40" y="6" width="40" height="10"/><rect class="ln" x="44" y="42" width="32" height="26"/>', i;
    for (i = 0; i < n; i++) {
      var x0 = 44 + 32 * (i + 0.5) / n, x1 = 46 + 28 * (i + 0.5) / n;
      s += '<path class="' + cls + '" d="M' + x0.toFixed(1) + ' 16 L' + x1.toFixed(1) + ' 42"/>';
    }
    if (e.r === 3) s += '<rect class="dm" x="30" y="24" width="60" height="4"/>';
    return s;
  }
  function picCost(e) {
    var x = function (m) { return 8 + 104 * Math.min(1, m / 22); };
    var s = '<path class="ln" d="M8 44 H112 M8 41 v6 M60 41 v6 M112 41 v6"/>';
    s += '<text class="tk" x="8" y="60">0</text><text class="tk" x="60" y="60" text-anchor="middle">11</text><text class="tk" x="112" y="60" text-anchor="end">22</text>';
    s += '<rect class="fl" x="' + x(e.capex[0]).toFixed(1) + '" y="26" width="' + (x(e.capex[1]) - x(e.capex[0])).toFixed(1) + '" height="12"/>';
    return s;
  }
  var PICS = { rack: picRack, power: picPower, cooling: picCooling, building: picBuilding, network: picNetwork, cost: picCost };

  var xp = document.querySelector('.explorer');
  if (xp) {
    var STEPS = JSON.parse(xp.getAttribute('data-steps') || '[]'), N = STEPS.length; // [{kw, name}]
    var slider = xp.querySelector('input[type=range]'), out = {}, prevText = null;
    xp.querySelectorAll('[data-x]').forEach(function (el) { out[el.getAttribute('data-x')] = el; });
    var pics = {}; xp.querySelectorAll('svg[data-pic]').forEach(function (el) { pics[el.getAttribute('data-pic')] = el; });
    var bus = xp.querySelector('.ripple'), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var stepBtns = xp.querySelectorAll('.x-step');
    /* the fields whose flips define the steps; their labels feed the "Changed at this step" line */
    var CATEG = [['mode', 'cooling mode'], ['tier', 'grid connection'], ['fits', 'what fits'], ['floor', 'floor']];
    var set = function (k, v) { if (out[k]) out[k].textContent = v; };
    var clampI = function (i) { return Math.max(0, Math.min(N - 1, Math.round(i))); };
    var stepFor = function (kw) { var b = 0; STEPS.forEach(function (s, i) { if (Math.abs(s.kw - kw) < Math.abs(STEPS[b].kw - kw)) b = i; }); return b; };
    var render = function () {
      var i = clampI(+slider.value), s = STEPS[i], e = estimate(s.kw), d = s.kw;
      slider.value = i;
      slider.setAttribute('aria-valuetext', d + ' kilowatts per rack, step ' + (i + 1) + ' of ' + N + ': ' + s.name);
      slider.style.setProperty('--p', (N > 1 ? 100 * i / (N - 1) : 0).toFixed(2) + '%');
      xp.setAttribute('data-regime', e.r);
      if (bus) bus.style.setProperty('--bus-w', (2 + 9 * e.it / 150).toFixed(1) + 'px');
      set('kw', d);
      set('fits', fits(e));
      set('it', fmtMW(e.it) + ' MW');
      set('fac', fmtRange(e.fac[0], e.fac[1], fmtMW) + ' MW');
      set('ups', e.ups + ' blocks of ' + BLOCK_MW + ' MW');
      set('gens', e.gens + ' sets of ' + GEN_MW + ' MW');
      set('tier', TIER[e.tier]);
      set('mode', e.R.mode);
      set('heat', e.R.liquid[1] === 0 ? 'all of it to air'
        : Math.round(e.R.liquid[0] * 100) + ' to ' + Math.round(e.R.liquid[1] * 100) + '% to liquid, the rest to air');
      set('pue', fmtRange(e.R.pue[0], e.R.pue[1], function (x) { return x.toFixed(2); }));
      set('white', fmtN(e.white) + ' m²');
      set('gross', fmtN(e.gross / 1000 * 0.8) + ' to ' + fmtN(e.gross / 1000 * 1.2) + ' thousand m²');
      set('share', Math.round(e.share * 100) + '%');
      set('mass', fmtN(e.mass * 0.8) + ' to ' + fmtN(e.mass * 1.2) + ' kg');
      set('floor', floorNote(e.mass));
      set('net', NET[e.r]);
      set('ops', OPS[e.r]);
      set('capex', '$' + e.capex[0].toFixed(0) + ' to ' + e.capex[1].toFixed(0) + 'M per MW');
      set('total', fmtMoney(e.total[0]) + ' to ' + fmtMoney(e.total[1]));
      set('takeaway', takeaway(e));
      Object.keys(PICS).forEach(function (k) { if (pics[k]) pics[k].innerHTML = PICS[k](e); });
      /* what changed since the previous step: highlight every station value whose
         text differs (.chg, a 1.2 s pulse; a plain state under reduced motion) and
         name the categorical fields that flipped */
      var text = {};
      Object.keys(out).forEach(function (k) { if (out[k].classList.contains('n')) text[k] = out[k].textContent; });
      xp.querySelectorAll('.n.chg').forEach(function (el) { el.classList.remove('chg'); });
      if (prevText) {
        Object.keys(text).forEach(function (k) {
          if (text[k] !== prevText[k]) { void out[k].offsetWidth; out[k].classList.add('chg'); }
        });
        var flipped = CATEG.filter(function (c) { return text[c[0]] !== prevText[c[0]]; }).map(function (c) { return c[1]; });
        set('changed', flipped.length ? 'Changed at this step: ' + flipped.join(', ') + '.'
          : 'Changed at this step: the numbers only; no design threshold crossed.');
      }
      prevText = text;
      set('step', 'Step ' + (i + 1) + ' of ' + N + ': ' + s.name);
      stepBtns.forEach(function (b) {
        var off = +b.getAttribute('data-step') < 0 ? i === 0 : i === N - 1;
        if (off && document.activeElement === b) slider.focus();
        b.disabled = off;
      });
    };
    slider.addEventListener('input', render);
    stepBtns.forEach(function (b) {
      b.addEventListener('click', function () { slider.value = clampI(+slider.value + +b.getAttribute('data-step')); render(); });
    });
    /* the threshold marks on the scale are also buttons: tap one to jump to its step */
    xp.querySelectorAll('[data-kw]').forEach(function (b) {
      b.addEventListener('click', function () { slider.value = stepFor(+b.getAttribute('data-kw')); render(); slider.focus(); });
    });
    render();
  }

  /* ---- landing page: energize the bus, show what is read ---- */
  var landing = document.querySelector('.sld');
  if (landing) {
    var read2 = load(KEY_READ), n = 0;
    document.querySelectorAll('[data-topic-page]').forEach(function (el) {
      var p = el.getAttribute('data-topic-page');
      if (read2[p]) { el.classList.add('read'); if (el.tagName === 'DETAILS') n++; }
    });
    var c = document.querySelector('[data-read-count]');
    if (c) c.textContent = n;
    /* one moment: the bus energizes left to right (or top to bottom) */
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var buses = Array.prototype.filter.call(document.querySelectorAll('.sld svg .bus'), function (b) {
        return b.getClientRects().length && !b.hasAttribute('stroke-dasharray');
      });
      buses.forEach(function (b) {
        var L = b.getTotalLength(); b.style.strokeDasharray = L; b.style.strokeDashoffset = L;
      });
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        buses.forEach(function (b, i) {
          b.classList.add('energize'); b.style.transitionDelay = (i * 120) + 'ms'; b.style.strokeDashoffset = 0;
        });
      }); });
    }
    /* clicking a node in the diagram opens that topic's row */
    var openRow = function (d, smooth) {
      d.open = true; d.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      d.querySelector('summary').focus({ preventScroll: true });
    };
    document.querySelectorAll('a[data-open]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var d = document.getElementById(a.getAttribute('data-open'));
        if (d) { ev.preventDefault(); openRow(d, true); }
      });
    });
    /* arriving with #t-<slug> (from the explorer's topic chips, or a shared link) opens that row */
    var openHash = function () {
      var d = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (d && d.tagName === 'DETAILS') openRow(d, false);
    };
    openHash(); window.addEventListener('hashchange', openHash);
    /* export / import / reset progress */
    var ex = document.querySelector('[data-export]'), im = document.querySelector('[data-import]'),
        rs = document.querySelector('[data-reset]');
    if (ex) ex.addEventListener('click', function () {
      var blob = new Blob([JSON.stringify({ read: load(KEY_READ), quiz: load(KEY_QUIZ), exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'dc-course-progress.json'; a.click(); URL.revokeObjectURL(a.href);
    });
    if (im) im.addEventListener('change', function () {
      var f = im.files[0]; if (!f) return;
      f.text().then(function (t) {
        var d = JSON.parse(t); if (d.read) save(KEY_READ, d.read); if (d.quiz) save(KEY_QUIZ, d.quiz); location.reload();
      }).catch(function () { alert('That file is not a progress export from this site.'); });
    });
    if (rs) rs.addEventListener('click', function () {
      if (confirm('Clear all reading and quiz progress on this device?')) {
        localStorage.removeItem(KEY_READ); localStorage.removeItem(KEY_QUIZ); localStorage.removeItem('dc-course:deck-pos'); location.reload();
      }
    });
  }

  /* ---- glossary filter ---- */
  var filt = document.querySelector('.filter');
  if (filt) {
    var terms = document.querySelectorAll('dl.gloss dt');
    filt.addEventListener('input', function () {
      var q = filt.value.trim().toLowerCase();
      terms.forEach(function (dt) {
        var dd = dt.nextElementSibling, hit = !q || (dt.textContent + ' ' + (dd ? dd.textContent : '')).toLowerCase().indexOf(q) >= 0;
        dt.classList.toggle('hide', !hit); if (dd) dd.classList.toggle('hide', !hit);
      });
      document.querySelectorAll('.gloss-group').forEach(function (g) {
        g.style.display = g.querySelector('dt:not(.hide)') ? '' : 'none';
      });
    });
  }
})();
