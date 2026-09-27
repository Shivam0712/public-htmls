/* index.js — front page behaviour. No network, no dependencies. The index
   loads this instead of site.js: only the map, the read marks and the
   progress file controls live here. Storage keys are shared with site.js:
   the six dc-course:* keys (read, quiz, page-pos, page-view, read-sections,
   deck-pos) are exported, imported and reset together.
   Copied verbatim into docs/ by scripts/build-docs.py. */
(function () {
  'use strict';
  var READ = 'dc-course:read', QUIZ = 'dc-course:quiz';
  /* every key the site writes, and the property each one travels under in the progress file */
  var KEYS = [['dc-course:read', 'read'], ['dc-course:quiz', 'quiz'], ['dc-course:page-pos', 'pagePos'],
              ['dc-course:page-view', 'pageView'], ['dc-course:read-sections', 'readSections'], ['dc-course:deck-pos', 'deckPos']];
  function loadObject(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (error) { return {}; }
  }
  function saveObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (error) { return false; }
  }

  /* ---- read marks: the row and its map node get .read; the panel counts rows ---- */
  var read = loadObject(READ), count = 0;
  document.querySelectorAll('[data-topic-page]').forEach(function (element) {
    var id = element.getAttribute('data-topic-page');
    if (Object.prototype.hasOwnProperty.call(read, id)) {
      element.classList.add('read');
      if (element.matches('details.topic')) count++;
    }
  });
  var readCount = document.querySelector('[data-read-count]');
  if (readCount) readCount.textContent = String(count);

  /* ---- opening a topic row: from a map node (a[data-open]), from #t-<slug>
     in the URL (the explorer's topic chips, shared links), or back/forward ---- */
  function openRow(id, smooth) {
    var row = document.getElementById(id);
    if (!row || !row.matches('details.topic')) return false;
    row.open = true;
    requestAnimationFrame(function () {
      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollIntoView({ behavior: smooth && !reduced ? 'smooth' : 'auto', block: 'start' });
      var summary = row.querySelector('summary');
      if (summary) summary.focus({ preventScroll: true });
    });
    return true;
  }
  document.querySelectorAll('a[data-open]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      var id = link.getAttribute('data-open');
      if (!document.getElementById(id)) return;
      event.preventDefault();
      if (window.location.hash !== '#' + id) { try { history.pushState(null, '', '#' + id); } catch (error) {} }
      openRow(id, true);
    });
  });
  function openHash() { var id = window.location.hash.slice(1); if (id) openRow(id, false); }
  openHash();
  window.addEventListener('hashchange', openHash);
  window.addEventListener('popstate', openHash);

  /* ---- progress file: export (all six keys), import with validation, reset with confirm ---- */
  var exporter = document.querySelector('[data-export]'),
      importer = document.querySelector('input[type=file][data-import]'),
      reset = document.querySelector('[data-reset]');
  if (exporter) exporter.addEventListener('click', function () {
    var progress = { exported: new Date().toISOString() };
    KEYS.forEach(function (k) { progress[k[1]] = loadObject(k[0]); });
    var blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url; link.download = 'dc-course-progress.json';
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  });
  if (importer) importer.addEventListener('change', function () {
    var file = importer.files && importer.files[0];
    if (!file) return;
    var reader = new FileReader();
    function invalid() { importer.value = ''; window.alert('That file is not a progress export from this site.'); }
    function isMap(x) { return x && typeof x === 'object' && !Array.isArray(x); }
    reader.addEventListener('load', function () {
      try {
        var progress = JSON.parse(reader.result);
        /* read and quiz are required (every export has had them); the paging
           and deck keys are optional so older exports still import */
        if (!isMap(progress) || !isMap(progress.read) || !isMap(progress.quiz)) throw new Error('Invalid progress export');
        KEYS.forEach(function (k) {
          var value = progress[k[1]];
          if (value !== undefined && !isMap(value)) throw new Error('Invalid progress export');
        });
        KEYS.forEach(function (k) {
          var value = progress[k[1]];
          if (value !== undefined && !saveObject(k[0], value)) throw new Error('Cannot save progress');
        });
        window.location.reload();
      } catch (error) { invalid(); }
    });
    reader.addEventListener('error', invalid);
    reader.readAsText(file);
  });
  if (reset) reset.addEventListener('click', function () {
    if (!window.confirm('Clear all reading, paging and quiz progress on this device?')) return;
    try { KEYS.forEach(function (k) { localStorage.removeItem(k[0]); }); } catch (error) {}
    window.location.reload();
  });
})();
