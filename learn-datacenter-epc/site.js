/* site.js — reader behaviour. No network, no dependencies.
   Everything the reader does lives in localStorage under six dc-course:* keys:
     read           {pageId: ISO}            a chapter read end to end
     quiz           {"<pageId>#<q>": hit|miss} self-scored quiz and deck cards
     page-pos       {pageId: int}            the page a chapter was left on
     page-view      {pageId: "one"|"all"}    paged or full view per chapter
     read-sections  {"<pageId>#<idx>": ISO}  Read marks per page of a chapter
     deck-pos       {deckId: int}            the card a deck was left on
   index.js exports, imports and resets the same six keys.
   Copied verbatim into docs/ by scripts/build-docs.py. */
(function () {
  'use strict';
  var KEY_READ = 'dc-course:read', KEY_QUIZ = 'dc-course:quiz', KEY_POS = 'dc-course:page-pos',
      KEY_VIEW = 'dc-course:page-view', KEY_RS = 'dc-course:read-sections', KEY_DECK = 'dc-course:deck-pos';
  function load(k) {
    try { var v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
    catch (e) { return {}; }
  }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var page = document.body.getAttribute('data-page') || '';
  var main = document.querySelector('main');

  /* ---- progress line: by page when paging, by card in a deck, by scroll otherwise ---- */
  var bar = document.querySelector('.progress'), frame = 0, pager = null, deckState = null;
  function updateBar() {
    frame = 0;
    if (!bar) return;
    if (pager && pager.view === 'one') { bar.style.width = (100 * (pager.i + 1) / pager.n).toFixed(2) + '%'; return; }
    if (deckState && deckState.view === 'one') { bar.style.width = deckState.pct.toFixed(2) + '%'; return; }
    var root = document.documentElement, len = root.scrollHeight - root.clientHeight;
    bar.style.width = (len > 0 ? Math.min(100, 100 * root.scrollTop / len) : 0) + '%';
  }
  function schedule() { if (bar && !frame) frame = requestAnimationFrame(updateBar); }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  addEventListener('load', schedule);
  document.querySelectorAll('details.more,figure img').forEach(function (el) {
    el.addEventListener(el.tagName === 'DETAILS' ? 'toggle' : 'load', schedule);
  });

  /* ---- quiz cards (chapter quiz and deck cards): reveal, self-score, per-card reset.
     Stored under dc-course:quiz as <pageId>#<q>, or the card's data-key when a
     page (the self-test) shows cards that belong to other decks. ---- */
  var quizSaved = load(KEY_QUIZ), quizPaints = [];
  function storeQuiz() { save(KEY_QUIZ, quizSaved); }
  function quizKey(card) { return card.getAttribute('data-key') || page + '#' + card.getAttribute('data-q'); }
  document.querySelectorAll('.quiz[data-q]').forEach(function (card) {
    var key = quizKey(card), reveal = card.querySelector('.reveal'), answer = card.querySelector('.a'),
        score = card.querySelector('.score'), result = card.querySelector('.result'), reset = card.querySelector('[data-reset]');
    if (!reveal || !answer) return;
    function paint() {
      var v = quizSaved[key];
      card.classList.toggle('hit', v === 'hit');
      card.classList.toggle('miss', v === 'miss');
      if (result) result.textContent = v === 'hit' ? 'Got it last time' : v === 'miss' ? 'Missed last time' : '';
      card.querySelectorAll('[data-score]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-score') === v ? 'true' : 'false'); });
    }
    function changed() { card.dispatchEvent(new CustomEvent('dc:score', { bubbles: true })); }
    reveal.addEventListener('click', function () {
      var opening = answer.hidden;
      answer.hidden = !opening;
      if (score) score.hidden = !opening;
      card.classList.toggle('open', opening);
      reveal.setAttribute('aria-expanded', opening ? 'true' : 'false');
      reveal.textContent = opening ? 'Hide answer' : 'Show answer';
    });
    card.querySelectorAll('[data-score]').forEach(function (b) {
      b.addEventListener('click', function () { quizSaved[key] = b.getAttribute('data-score'); storeQuiz(); paint(); changed(); });
    });
    if (reset) reset.addEventListener('click', function () {
      delete quizSaved[key]; storeQuiz(); paint();
      if (result) result.textContent = 'Result cleared';
      changed();
    });
    paint(); quizPaints.push(paint);
  });
  function repaintQuiz() { quizSaved = load(KEY_QUIZ); quizPaints.forEach(function (p) { p(); }); }
  addEventListener('storage', function (ev) { if (ev.key === KEY_QUIZ) repaintQuiz(); });

  /* ---- expand / collapse every read-more ---- */
  var xa = document.querySelector('[data-expand-all]');
  if (xa) {
    var mores = Array.prototype.slice.call(document.querySelectorAll('details.more'));
    var paintAll = function () {
      var open = mores.every(function (d) { return d.open; });
      xa.textContent = open ? 'Collapse all' : 'Expand all';
      xa.setAttribute('aria-pressed', open ? 'true' : 'false');
    };
    xa.addEventListener('click', function () {
      var open = mores.every(function (d) { return d.open; });
      mores.forEach(function (d) { d.open = !open; }); paintAll();
    });
    mores.forEach(function (d) { d.addEventListener('toggle', paintAll); });
    paintAll();
  }

  /* ---- figure viewer: one dialog per page (built by the generator when a
     raster figure exists); the enlarge button around each image opens it,
     the image toggles 2x, Escape / Close / backdrop close, focus returns. ---- */
  var viewer = document.getElementById('figure-viewer');
  if (viewer && typeof viewer.showModal === 'function') {
    var opener = null, canvas = viewer.querySelector('.viewer-canvas'), zoom = viewer.querySelector('[data-zoom]'),
        large = viewer.querySelector('[data-large-image]'), caption = viewer.querySelector('[data-large-caption]'),
        closeBtn = viewer.querySelector('[data-close]');
    document.querySelectorAll('[data-enlarge]').forEach(function (button) {
      button.addEventListener('click', function () {
        opener = button;
        var figure = button.closest('figure'), image = button.querySelector('img'), cap = figure && figure.querySelector('figcaption');
        large.src = image.currentSrc || image.getAttribute('src'); large.alt = image.alt;
        caption.textContent = cap ? cap.textContent.trim() : '';
        canvas.classList.remove('zoomed'); zoom.setAttribute('aria-pressed', 'false'); zoom.setAttribute('aria-label', 'Zoom image');
        viewer.showModal(); document.body.classList.add('viewer-open'); closeBtn.focus();
      });
    });
    closeBtn.addEventListener('click', function () { viewer.close(); });
    zoom.addEventListener('click', function () {
      var on = canvas.classList.toggle('zoomed');
      zoom.setAttribute('aria-pressed', on ? 'true' : 'false'); zoom.setAttribute('aria-label', on ? 'Fit image' : 'Zoom image');
      if (!on) { canvas.scrollTop = 0; canvas.scrollLeft = 0; }
    });
    viewer.addEventListener('click', function (ev) { if (ev.target === viewer) viewer.close(); });
    viewer.addEventListener('close', function () { document.body.classList.remove('viewer-open'); if (opener) opener.focus({ preventScroll: true }); });
  }

  /* ---- paged reading (chapters): intro, one page per section, quiz + foot last.
     Activates only when .opening, .chapter-section and .quiz-area all exist
     (L3 pages); appendix, report, archive, overview and glossary stay unpaged.
     Position dc-course:page-pos[page]; view dc-course:page-view[page];
     Read marks dc-course:read-sections[<page>#<idx>] (intro 0, sections 1..n-2,
     quiz n-1); when every page is read the chapter goes into dc-course:read. ---- */
  var hero = main && main.querySelector('.hero'), opening = main && main.querySelector('.opening'),
      sections = main ? Array.prototype.slice.call(main.querySelectorAll('.chapter-section')) : [],
      quizArea = main && main.querySelector('.quiz-area');
  if (main && opening && quizArea && sections.length && page) {
    var foot = main.querySelector('.chapter-foot');
    var mapHref = (foot && foot.getAttribute('data-map')) || 'index.html';
    var pages = [{ els: [hero, opening].filter(Boolean), focus: opening, idx: 0 }];
    sections.forEach(function (s, i) { pages.push({ els: [s], focus: s.querySelector('h2'), idx: i + 1 }); });
    pages.push({ els: [quizArea, foot].filter(Boolean), focus: quizArea, idx: sections.length + 1 });
    var N = pages.length;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    sections.forEach(function (s, i) { var h = s.querySelector('h2'); if (h) { h.setAttribute('data-pg', pad(i + 2)); h.setAttribute('data-pn', pad(N)); } });
    function pidx(n) { var el = document.createElement('p'); el.className = 'pidx'; el.setAttribute('aria-hidden', 'true'); el.textContent = pad(n) + ' / ' + pad(N); return el; }
    var introIdx = pidx(1); opening.parentNode.insertBefore(introIdx, opening); pages[0].els.push(introIdx);
    quizArea.insertBefore(pidx(N), quizArea.firstChild);
    var topBar = document.createElement('div'); topBar.className = 'page-bar';
    topBar.innerHTML = '<button class="btn quiet" type="button" data-view-toggle aria-pressed="false">Show all sections</button>' +
      '<span class="page-pos" data-page-pos aria-live="polite"></span>';
    main.insertBefore(topBar, main.firstChild);
    var nav = document.createElement('nav'); nav.className = 'page-nav'; nav.setAttribute('aria-label', 'Pages');
    nav.innerHTML = '<button class="btn" type="button" data-back>Back</button><button class="btn" type="button" data-read aria-pressed="false">Read</button>' +
      '<button class="btn reset" type="button" data-reset>Reset</button><button class="btn" type="button" data-next>Next</button>';
    main.appendChild(nav);
    var toggle = topBar.querySelector('[data-view-toggle]'), posLabel = topBar.querySelector('[data-page-pos]');
    var bBack = nav.querySelector('[data-back]'), bRead = nav.querySelector('[data-read]'), bReset = nav.querySelector('[data-reset]'), bNext = nav.querySelector('[data-next]');
    var posStore = load(KEY_POS), viewStore = load(KEY_VIEW);
    function clamp(k) { k = parseInt(k, 10); return isNaN(k) ? 0 : Math.min(Math.max(k, 0), N - 1); }
    pager = { i: clamp(posStore[page]), n: N, view: viewStore[page] === 'all' ? 'all' : 'one' };
    function hashTarget() { var h = decodeURIComponent(location.hash.slice(1)); if (!h) return null; return document.getElementById(h) || document.getElementsByName(h)[0] || null; }
    function pageOf(el) { for (var k = 0; k < N; k++) { if (pages[k].els.some(function (e) { return e.contains(el); })) return k; } return -1; }
    function readKey(k) { return page + '#' + pages[k].idx; }
    function render() {
      var one = pager.view === 'one';
      document.body.setAttribute('data-view', pager.view);
      pages.forEach(function (p, k) { p.els.forEach(function (el) { el.hidden = one && k !== pager.i; }); });
      posLabel.textContent = 'Page ' + (pager.i + 1) + ' of ' + N;
      toggle.textContent = one ? 'Show all sections' : 'One page at a time';
      toggle.setAttribute('aria-pressed', one ? 'false' : 'true');
      bBack.disabled = pager.i === 0;
      bNext.textContent = pager.i === N - 1 ? 'Finish' : 'Next';
      var on = !!load(KEY_RS)[readKey(pager.i)];
      bRead.textContent = on ? 'Read ✓' : 'Read';
      bRead.setAttribute('aria-pressed', on ? 'true' : 'false');
      posStore[page] = pager.i; save(KEY_POS, posStore);
      viewStore[page] = pager.view; save(KEY_VIEW, viewStore);
      updateBar();
    }
    function go(d) {
      var k = pager.i + d; if (k < 0 || k >= N) return;
      pager.i = k; render();
      var top = topBar.getBoundingClientRect().top + window.scrollY - 8;
      if (window.scrollY > top) window.scrollTo(0, Math.max(0, top));
      var f = pages[k].focus; if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
    }
    bBack.addEventListener('click', function () { go(-1); });
    bNext.addEventListener('click', function () { if (pager.i === N - 1) location.href = mapHref; else go(1); });
    toggle.addEventListener('click', function () { pager.view = pager.view === 'one' ? 'all' : 'one'; render(); if (pager.view === 'one') go(0); });
    bRead.addEventListener('click', function () {
      var rs = load(KEY_RS), key = readKey(pager.i);
      if (!rs[key]) { rs[key] = new Date().toISOString(); save(KEY_RS, rs); }
      if (pages.every(function (p, k) { return !!rs[readKey(k)]; })) {
        var rd = load(KEY_READ); if (!rd[page]) { rd[page] = new Date().toISOString(); save(KEY_READ, rd); }
      }
      render();
    });
    bReset.addEventListener('click', function () {
      if (!window.confirm('Reset this page? Its read mark and any quiz scores on it will be cleared.')) return;
      var rs = load(KEY_RS); delete rs[readKey(pager.i)]; save(KEY_RS, rs);
      var rd = load(KEY_READ); if (rd[page]) { delete rd[page]; save(KEY_READ, rd); }
      var live = load(KEY_QUIZ), touched = false;
      pages[pager.i].els.forEach(function (el) {
        el.querySelectorAll('.quiz[data-q]').forEach(function (card) {
          var key = quizKey(card);
          if (key in live || key in quizSaved) { delete live[key]; delete quizSaved[key]; touched = true; }
        });
      });
      if (touched) { quizSaved = live; storeQuiz(); repaintQuiz(); }
      render();
    });
    document.addEventListener('keydown', function (ev) {
      if (pager.view !== 'one' || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      if (viewer && viewer.open) return;
      var t = ev.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (t && t.closest && t.closest('.compare-wrap')) return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(-1); }
    });
    var tx = 0, ty = 0, touching = false;
    main.addEventListener('touchstart', function (ev) {
      var t = ev.changedTouches[0]; tx = t.clientX; ty = t.clientY;
      var wrap = ev.target.closest && ev.target.closest('.compare-wrap');
      touching = !(wrap && wrap.scrollWidth > wrap.clientWidth + 1);
    }, { passive: true });
    main.addEventListener('touchend', function (ev) {
      if (!touching) return; touching = false;
      if (pager.view !== 'one') return;
      var t = ev.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    function openHash() {
      var el = hashTarget(); if (!el) return false;
      var k = pageOf(el); if (k >= 0 && k !== pager.i) { pager.i = k; render(); }
      el.scrollIntoView(); return true;
    }
    addEventListener('hashchange', openHash);
    render();
    if (openHash()) addEventListener('load', function () { var el = hashTarget(); if (el) el.scrollIntoView(); });
  }

  /* ---- card deck (C-<slug> pages, and the self-test): which cards show.
     The cards themselves are quiz cards (above). view 'one' (current card,
     Next / Previous, arrow keys, swipe) or 'all'; filter = the missed cards
     under review; position remembered per deck under dc-course:deck-pos. ---- */
  var deck = document.querySelector('.deck');
  if (deck && page) {
    var cards = Array.prototype.slice.call(deck.querySelectorAll('.card')),
        questions = cards.filter(function (c) { return c.classList.contains('quiz'); }),
        fin = deck.querySelector('.card.fin'), last = cards.length - 1,
        stored = parseInt(load(KEY_DECK)[page], 10);
    var st = { view: 'one', i: isFinite(stored) ? Math.min(Math.max(stored, 0), last) : 0, filter: null };
    var vt = deck.querySelector('[data-view-toggle]'), dn = deck.querySelector('[data-deck-note]'),
        dcount = deck.querySelector('[data-deck-count]'), ncount = deck.querySelector('[data-nav-count]'),
        bPrev = deck.querySelector('[data-prev]'), bNextC = deck.querySelector('[data-next]'),
        bMiss = deck.querySelector('[data-review-missed]'), bAll = deck.querySelector('[data-review-all]');
    var order = function () { return st.filter || cards.map(function (_, k) { return k; }); };
    var tally = function () {
      var q = load(KEY_QUIZ), t = { hit: 0, miss: 0, missIdx: [] };
      cards.forEach(function (c, k) {
        if (!c.classList.contains('quiz')) return;
        var r = q[quizKey(c)];
        if (r === 'hit') t.hit++; else if (r === 'miss') { t.miss++; t.missIdx.push(k); }
      });
      return t;
    };
    var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
    var renderDeck = function () {
      var vis = order();
      if (vis.indexOf(st.i) < 0) st.i = vis[0];
      var k = vis.indexOf(st.i), one = st.view === 'one', t = tally(), nq = questions.length;
      deck.setAttribute('data-view', st.view);
      cards.forEach(function (c, j) { c.classList.toggle('cur', j === st.i); c.hidden = one ? j !== st.i : vis.indexOf(j) < 0; });
      if (vt) { vt.textContent = one ? 'Show all cards' : 'One at a time'; vt.setAttribute('aria-pressed', one ? 'false' : 'true'); }
      if (bPrev) bPrev.disabled = k <= 0;
      if (bNextC) bNextC.disabled = k >= vis.length - 1;
      if (fin) {
        fin.querySelector('[data-fin-hit]').textContent = t.hit;
        fin.querySelector('[data-fin-miss]').textContent = t.miss;
        fin.querySelector('[data-fin-left]').textContent = nq - t.hit - t.miss;
      }
      if (bMiss) { bMiss.disabled = t.miss === 0; bMiss.textContent = t.miss ? 'Review ' + t.miss + ' missed' : 'Nothing missed'; }
      if (bAll) bAll.hidden = !st.filter;
      if (dn) dn.textContent = st.filter ? 'Reviewing ' + (vis.length - 1) + ' missed card' + (vis.length === 2 ? '' : 's') : (t.hit + t.miss) + ' of ' + nq + ' scored';
      if (dcount) dcount.textContent = one ? (st.i === last ? 'End / ' + nq : pad2(st.i + 1) + ' / ' + nq) : 'All / ' + nq;
      if (ncount) ncount.textContent = st.i === last ? 'End of deck' : st.filter ? 'Review ' + (k + 1) + ' / ' + (vis.length - 1) : (st.i + 1) + ' / ' + nq;
      deckState = { view: st.view, pct: 100 * (k + 1) / vis.length };
      updateBar();
      var positions = load(KEY_DECK); positions[page] = st.i; save(KEY_DECK, positions);
    };
    var showCurrent = function () {
      var top = deck.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo(0, Math.max(0, top));
      var h = cards[st.i].querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    };
    var move = function (d) {
      var vis = order(), k = vis.indexOf(st.i) + d;
      if (k < 0 || k >= vis.length) return;
      st.i = vis[k]; renderDeck(); showCurrent();
    };
    if (bPrev) bPrev.addEventListener('click', function () { move(-1); });
    if (bNextC) bNextC.addEventListener('click', function () { move(1); });
    if (vt) vt.addEventListener('click', function () { st.view = st.view === 'one' ? 'all' : 'one'; renderDeck(); if (st.view === 'one') showCurrent(); });
    if (bMiss) bMiss.addEventListener('click', function () {
      var m = tally().missIdx; if (!m.length) return;
      st.filter = m.concat([last]); st.i = m[0]; st.view = 'one'; renderDeck(); showCurrent();
    });
    if (bAll) bAll.addEventListener('click', function () {
      st.filter = null; st.view = 'all'; renderDeck();
      if (vt) vt.focus({ preventScroll: true });
      window.scrollTo(0, Math.max(0, deck.getBoundingClientRect().top + window.scrollY - 10));
    });
    deck.addEventListener('dc:score', renderDeck);
    addEventListener('storage', function (ev) { if (ev.key === KEY_QUIZ) renderDeck(); });
    document.addEventListener('keydown', function (ev) {
      if (st.view !== 'one' || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      var t = ev.target;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); move(1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); move(-1); }
    });
    var sx = 0, sy = 0, swiping = false;
    deck.addEventListener('touchstart', function (ev) {
      swiping = false;
      if (st.view !== 'one' || ev.touches.length !== 1) return;
      var t = ev.target; if (t instanceof Element && t.closest('button,a,input,textarea,select,.compare-wrap')) return;
      sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; swiping = true;
    }, { passive: true });
    deck.addEventListener('touchend', function (ev) {
      if (!swiping) return; swiping = false;
      if (st.view !== 'one') return;
      var t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.25) move(dx < 0 ? 1 : -1);
    }, { passive: true });
    deck.addEventListener('touchcancel', function () { swiping = false; }, { passive: true });
    renderDeck();
  }

  /* ============ the density explorer (explorer.html) ============
     One decision, rack density, flows down a bus and re-sizes everything.
     All numbers are rules of thumb an engineer would recognise, stated as
     ranges; the assumptions block under the box lists them and Topics 2,
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
  function floorBand(m) { return m < 900 ? 0 : m < 1400 ? 1 : 2; }
  function floorNote(m) {
    return ['a standard raised floor carries it', 'at the rating of most raised floors; slab preferred',
            'slab on grade, with a structural check per rack'][floorBand(m)];
  }
  /* the what-fits band: the three air/rear-door regimes, then partial rack-scale, one NVL72, past NVL72 */
  function fitsBand(e) { return e.r < 3 ? e.r : e.d < 100 ? 3 : e.d <= 145 ? 4 : 5; }
  /* the categorical outputs whose flips define the steps (mirrored in scripts/explorer_steps.py) */
  function bands(e) { return { mode: e.r, tier: e.tier, fits: fitsBand(e), floor: floorBand(e.mass) }; }
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
    var STEPS = JSON.parse(xp.getAttribute('data-steps') || '[]'), N2 = STEPS.length; // [{kw, name}]
    var slider = xp.querySelector('input[type=range]'), out = {}, prevText = null, prevBands = null;
    xp.querySelectorAll('[data-x]').forEach(function (el) { out[el.getAttribute('data-x')] = el; });
    var pics = {}; xp.querySelectorAll('svg[data-pic]').forEach(function (el) { pics[el.getAttribute('data-pic')] = el; });
    var bus = xp.querySelector('.ripple');
    var stepBtns = xp.querySelectorAll('.x-step');
    /* the fields whose flips define the steps; their labels feed the "Changed at this step" line */
    var CATEG = [['mode', 'cooling mode'], ['tier', 'grid connection'], ['fits', 'what fits'], ['floor', 'floor']];
    var set = function (k, v) { if (out[k]) out[k].textContent = v; };
    var clampI = function (i) { return Math.max(0, Math.min(N2 - 1, Math.round(i))); };
    var stepFor = function (kw) { var b = 0; STEPS.forEach(function (s, i) { if (Math.abs(s.kw - kw) < Math.abs(STEPS[b].kw - kw)) b = i; }); return b; };
    var renderX = function () {
      var i = clampI(+slider.value), s = STEPS[i], e = estimate(s.kw), d = s.kw;
      slider.value = i;
      slider.setAttribute('aria-valuetext', d + ' kilowatts per rack, step ' + (i + 1) + ' of ' + N2 + ': ' + s.name);
      slider.style.setProperty('--p', (N2 > 1 ? 100 * i / (N2 - 1) : 0).toFixed(2) + '%');
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
      var text = {}, bd = bands(e);
      Object.keys(out).forEach(function (k) { if (out[k].classList.contains('n')) text[k] = out[k].textContent; });
      xp.querySelectorAll('.n.chg').forEach(function (el) { el.classList.remove('chg'); });
      if (prevText) {
        Object.keys(text).forEach(function (k) {
          if (text[k] !== prevText[k]) { void out[k].offsetWidth; out[k].classList.add('chg'); }
        });
        var flipped = CATEG.filter(function (c) { return bd[c[0]] !== prevBands[c[0]]; }).map(function (c) { return c[1]; });
        set('changed', flipped.length ? 'Changed at this step: ' + flipped.join(', ') + '.'
          : 'Changed at this step: the numbers only; no design threshold crossed.');
      }
      prevText = text; prevBands = bd;
      set('step', 'Step ' + (i + 1) + ' of ' + N2 + ': ' + s.name);
      stepBtns.forEach(function (b) {
        var off = +b.getAttribute('data-step') < 0 ? i === 0 : i === N2 - 1;
        if (off && document.activeElement === b) slider.focus();
        b.disabled = off;
      });
    };
    slider.addEventListener('input', renderX);
    stepBtns.forEach(function (b) {
      b.addEventListener('click', function () { slider.value = clampI(+slider.value + +b.getAttribute('data-step')); renderX(); });
    });
    /* the threshold marks on the scale are also buttons: tap one to jump to its step */
    xp.querySelectorAll('[data-kw]').forEach(function (b) {
      b.addEventListener('click', function () { slider.value = stepFor(+b.getAttribute('data-kw')); renderX(); slider.focus(); });
    });
    renderX();
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
  schedule();
})();
