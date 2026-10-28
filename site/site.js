/* My Pet Book website behaviour (27 Oct 2026). Everything works without it; it adds:
   - the live thing: the pet's name typed on the cover line (and cat or dog) names the book,
     and is carried into the "New pet" sheet at the end;
   - the screen tabs, one open question at a time, entrances as sections arrive;
   - live text from the dashboard (Supabase site_content), so Mohamed edits the site without a rebuild. */
(function () {
  var S = window.PB_SITE || {};
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- live content from the dashboard ----
  var live = {};
  function apply(map) {
    live = map || {};
    document.querySelectorAll('[data-k]').forEach(function (el) {
      var k = el.getAttribute('data-k');
      if (k === 'hero.bookOf') { el.setAttribute('data-tpl', live[k] || el.getAttribute('data-tpl')); return; }
      if (live[k] != null && live[k] !== '') el.textContent = live[k];
    });
    document.querySelectorAll('[data-kp]').forEach(function (el) {
      var v = live[el.getAttribute('data-kp')];
      if (v) el.setAttribute('placeholder', v);
    });
    document.querySelectorAll('[data-ka]').forEach(function (el) {
      var v = live[el.getAttribute('data-ka')];
      if (v) el.setAttribute('alt', v);
    });
    document.querySelectorAll('[data-link]').forEach(function (el) {
      var v = live['link.' + el.getAttribute('data-link')];
      if (v && /^(https:|mailto:|\/)/.test(v)) el.setAttribute('href', v);
    });
    if (live['meta.title']) document.title = live['meta.title'];
    nameBook();
  }
  try {
    if (S.supabase && window.fetch) {
      fetch(S.supabase.url + '/rest/v1/rpc/site_content_public', {
        method: 'POST',
        headers: { apikey: S.supabase.key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_lang: S.lang }),
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (m) { if (m && typeof m === 'object') apply(m); })
        .catch(function () {});
    }
  } catch (e) {}

  // ---- the name line on the cover ----
  var input = document.getElementById('petname');
  var dlgName = document.getElementById('dlg-name');
  var go = document.getElementById('dlg-go');
  var bookOf = document.querySelector('[data-bookof]');
  var kind = 'cat';
  function petName() {
    var v = (input && input.value.trim()) || (dlgName && dlgName.value.trim()) || S.defaults.name;
    return v.slice(0, 24);
  }
  function nameBook() {
    if (!bookOf) return;
    var tpl = bookOf.getAttribute('data-tpl') || '{name}';
    bookOf.textContent = tpl.replace('{name}', petName());
    if (go) {
      // The sheet's button carries the typed name into the WhatsApp message.
      var msg = S.lang === 'ar'
        ? 'أهلًا! عايز أجرّب دفتر أليفي على أندرويد. أليفي اسمه ' + petName() + ' (' + (kind === 'cat' ? 'قطة' : 'كلب') + '). الجيميل بتاعي: '
        : 'Hi! I want to test My Pet Book on Android. My pet is ' + petName() + ' (' + kind + '). My Gmail is: ';
      go.setAttribute('href', 'https://wa.me/201055755232?text=' + encodeURIComponent(msg));
    }
  }
  function pickKind(k) {
    kind = k;
    document.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === k)); });
    nameBook();
  }
  if (input) input.addEventListener('input', function () { if (dlgName) dlgName.value = input.value; nameBook(); });
  if (dlgName) dlgName.addEventListener('input', function () { if (input) input.value = dlgName.value; nameBook(); });
  document.querySelectorAll('[data-kind]').forEach(function (b) {
    b.addEventListener('click', function () { pickKind(b.getAttribute('data-kind')); });
  });
  try { var saved = localStorage.getItem('pb-pet'); if (saved && input) { input.value = saved; if (dlgName) dlgName.value = saved; } } catch (e) {}
  if (input) input.addEventListener('change', function () { try { localStorage.setItem('pb-pet', input.value.trim()); } catch (e) {} });
  nameBook();

  // ---- screen tabs ----
  var plate = document.querySelector('[data-plate]');
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
      document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== n; });
      if (plate) {
        var src = b.getAttribute('data-src');
        if (reduced) { plate.src = src; return; }
        plate.style.opacity = '0';
        setTimeout(function () { plate.src = src; plate.onload = function () { plate.style.opacity = '1'; }; }, 260);
      }
    });
  });

  // ---- one question open at a time ----
  var cards = document.querySelectorAll('.drawer details');
  cards.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) cards.forEach(function (o) { if (o !== d) o.open = false; });
    });
  });

  // ---- entrances: each section's parts rise in turn as it arrives ----
  var groups = ['.cover-body > *', '.show-text > *', '.menu > *', '.menu-side img', '.how-text > *', '.slip > *', '.ticket .main > *', '.stub > *', '.plus-shot', '.faq h2', '.drawer details', '.cta-text > *', '.dialog > *', '.foot-top > *'];
  groups.forEach(function (sel) {
    document.querySelectorAll(sel).forEach(function (el, i) { el.setAttribute('data-rise', ''); el.style.setProperty('--d', String(Math.min(i, 8))); });
  });
  var targets = document.querySelectorAll('.reveal, [data-rise]');
  if (!('IntersectionObserver' in window) || reduced) {
    targets.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    targets.forEach(function (el) { io.observe(el); });
    // Anything still hidden after 2.5 s shows anyway (a print, a tall screen, a missed callback).
    setTimeout(function () { targets.forEach(function (el) { el.classList.add('in'); }); }, 2500);
  }

  // ---- the signature move: the app screen in the hero changes with the time of day of the pet ----
  var shot = document.querySelector('.room-shot img');
  if (shot && !reduced) {
    var srcs = [shot.getAttribute('src'), shot.getAttribute('src').replace(/home(-ar)?\.webp/, 'book$1.webp'), '/img/app/nearby.webp'];
    var at = 0;
    var timer = setInterval(function () {
      if (document.hidden) return;
      at = (at + 1) % srcs.length;
      shot.style.transition = 'opacity 800ms ease';
      shot.style.opacity = '0';
      setTimeout(function () { shot.src = srcs[at]; shot.onload = function () { shot.style.opacity = '1'; }; }, 800);
    }, 6000);
    window.addEventListener('pagehide', function () { clearInterval(timer); });
  }
})();
