/* site.js — reader behaviour. No network, no dependencies.
   Progress and quiz results live in localStorage under dc-course:*.
   Copied verbatim into docs/ by scripts/build-docs.py. */
(function () {
  'use strict';
  var KEY_READ = 'dc-course:read', KEY_QUIZ = 'dc-course:quiz';
  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var page = document.body.getAttribute('data-page') || '';

  /* ---- reading progress line (chapter pages) ---- */
  var bar = document.querySelector('.progress');
  if (bar) {
    var tick = function () {
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
    document.querySelectorAll('.sld a[data-open]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var d = document.getElementById(a.getAttribute('data-open'));
        if (d) { ev.preventDefault(); d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); d.querySelector('summary').focus({ preventScroll: true }); }
      });
    });
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
        localStorage.removeItem(KEY_READ); localStorage.removeItem(KEY_QUIZ); location.reload();
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
