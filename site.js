/* My Pet Book website behaviour (27 Oct 2026, hero, sprites, sound and touch 29 Oct). Everything works without it; it adds:
   - feel: soft clicks from Kenney's CC0 interface sounds (snd/), a vibration where the phone allows
     it (Android; iPhone with iOS 18 through the switch control), a ripple and a paw on buttons;
   - the pixel pets: tap one to pat it (it hops, a heart floats up; every fifth pat is a cheer);
   - the hero: the pet's name typed in the form becomes the giant word and the name on the phone;
   - the live thing: the pet's name typed on the cover line (and cat or dog) names the book,
     and is carried into the "New pet" sheet at the end;
   - the screen tabs, one open question at a time, entrances as sections arrive;
   - live text from the dashboard (Supabase site_content), so Mohamed edits the site without a rebuild. */
(function () {
  var S = window.PB_SITE || {};
  var doc = document.documentElement;
  doc.classList.add('js');
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- feel: sound and touch ----
  // Sounds load quietly after the page; the browser lets them play only after the first tap, and
  // every sound answers something the person did. The speaker button in the bar mutes them.
  var feel = { on: true, ctx: null, bufs: {}, touched: false };
  try { feel.on = localStorage.getItem('pb-sound') !== 'off'; } catch (e) {}
  function loadSounds() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC || !window.fetch || feel.ctx) return;
    try { feel.ctx = new AC(); } catch (e) { return; }
    ['tap', 'toggle', 'pat', 'success', 'open', 'close', 'tick'].forEach(function (n) {
      fetch('/snd/' + n + '.mp3')
        .then(function (r) { return r.ok ? r.arrayBuffer() : null; })
        .then(function (b) { if (b) feel.ctx.decodeAudioData(b, function (buf) { feel.bufs[n] = buf; }, function () {}); })
        .catch(function () {});
    });
  }
  if ('requestIdleCallback' in window) requestIdleCallback(loadSounds, { timeout: 2500 }); else setTimeout(loadSounds, 1200);
  function sound(n, vol, pitch) {
    if (!feel.on || !feel.touched || !feel.ctx || !feel.bufs[n]) return;
    try {
      if (feel.ctx.state === 'suspended') feel.ctx.resume();
      var src = feel.ctx.createBufferSource();
      src.buffer = feel.bufs[n];
      // A hair of random pitch, so a run of taps sounds alive instead of mechanical.
      src.playbackRate.value = (pitch || 1) * (0.97 + Math.random() * 0.06);
      var g = feel.ctx.createGain();
      g.gain.value = vol == null ? 0.4 : vol;
      src.connect(g); g.connect(feel.ctx.destination);
      src.start();
    } catch (e) {}
  }
  // Vibration: Android browsers have navigator.vibrate. Safari has none, but on iOS 18 a tap on a
  // switch control ticks the Taptic Engine, so a hidden one is tapped for single beats.
  var canVibrate = 'vibrate' in navigator;
  var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var tick = null;
  if (!canVibrate && ios) {
    tick = document.createElement('label');
    tick.setAttribute('aria-hidden', 'true');
    tick.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none'; // taste-skill-ignore: an invisible control, not a rule
    var sw = document.createElement('input');
    sw.type = 'checkbox'; sw.setAttribute('switch', ''); sw.tabIndex = -1;
    tick.appendChild(sw);
    document.body.appendChild(tick);
  }
  function buzz(pattern) {
    try {
      if (canVibrate) { navigator.vibrate(pattern); return; }
      if (tick) {
        tick.click();
        // Patterns: the extra beats follow while the tap still counts as the person's own.
        if (Array.isArray(pattern)) for (var i = 2; i < pattern.length; i += 2) setTimeout(function () { tick.click(); }, pattern.slice(0, i).reduce(function (a, b) { return a + b; }, 0));
      }
    } catch (e) {}
  }
  window.addEventListener('pointerdown', function () { feel.touched = true; if (feel.ctx && feel.ctx.state === 'suspended') feel.ctx.resume(); }, { capture: true, passive: true });
  window.addEventListener('keydown', function () { feel.touched = true; }, { capture: true, passive: true });
  var sndBtn = document.querySelector('[data-snd]');
  if (sndBtn) {
    sndBtn.hidden = false;
    sndBtn.setAttribute('aria-pressed', String(feel.on));
    sndBtn.addEventListener('click', function () {
      feel.on = !feel.on;
      sndBtn.setAttribute('aria-pressed', String(feel.on));
      try { localStorage.setItem('pb-sound', feel.on ? 'on' : 'off'); } catch (e) {}
      sound('toggle', 0.4);
      buzz(8);
    });
  }

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
      // https, mail, or a path on this site; never "//other.site" or javascript:.
      if (v && /^(https:\/\/|mailto:|\/(?!\/))/.test(v)) el.setAttribute('href', v);
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
  // Enter in the name field must not reload the page (no inline handler: the CSP allows none).
  document.querySelectorAll('form.belongs').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); }); });
  var input = document.getElementById('petname');
  var dlgName = document.getElementById('dlg-name');
  var go = document.getElementById('dlg-go');
  var bookOf = document.querySelector('[data-bookof]');
  var kind = 'cat';
  var hero = document.querySelector('.hero');
  var DEF = S.lang === 'ar' ? { cat: 'مشمش', dog: 'ميلو' } : { cat: 'Mishmish', dog: 'Milo' };
  function defaultName() { return DEF[kind] || S.defaults.name; }
  function petName() {
    var v = (input && input.value.trim()) || (dlgName && dlgName.value.trim()) || defaultName();
    return v.slice(0, 24);
  }
  function nameBook() {
    if (!bookOf) return;
    var tpl = bookOf.getAttribute('data-tpl') || '{name}';
    bookOf.textContent = tpl.replace('{name}', petName());
    writeGiant(petName());
    var hs = document.querySelector('[data-hero-sprite]');
    if (hs) hs.setAttribute('aria-label', (hs.getAttribute('data-pat') || '{name}').replace('{name}', petName()));
    if (go) {
      // The sheet's button carries the typed name into the WhatsApp message.
      var msg = S.lang === 'ar'
        ? 'أهلًا! عايز أجرّب دفتر أليفي على أندرويد. أليفي اسمه ' + petName() + ' (' + (kind === 'cat' ? 'قطة' : 'كلب') + '). الجيميل بتاعي: '
        : 'Hi! I want to test My Pet Book on Android. My pet is ' + petName() + ' (' + kind + '). My Gmail is: ';
      go.setAttribute('href', 'https://wa.me/201055755232?text=' + encodeURIComponent(msg));
    }
  }
  function pickKind(k) {
    if (k === kind) return;
    kind = k;
    document.querySelectorAll('[data-kind]').forEach(function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-kind') === k)); });
    document.querySelectorAll('.kind, .seg').forEach(function (g) { g.style.setProperty('--ki', k === 'dog' ? '1' : '0'); });
    if (hero) {
      hero.setAttribute('data-pet', k);
      hero.querySelectorAll('.hp-screen img').forEach(function (im) { im.classList.toggle('on', im.getAttribute('data-pet') === k); });
      var hs = hero.querySelector('[data-hero-sprite]');
      if (hs) hopSprite(hs);
    }
    sound('toggle', 0.4, k === 'dog' ? 0.92 : 1.06);
    buzz(10);
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

  // ---- the giant name behind the phone ----
  var giant = document.querySelector('[data-giant]');
  var giantBox = document.querySelector('.giant-name');
  var hpName = document.querySelector('[data-hpname]');
  var shown = '';
  function fitGiant() {
    if (!giant || !giantBox) return;
    giantBox.style.setProperty('--gfs', '100px');
    var w = giant.getBoundingClientRect().width || 1;
    var vw = document.documentElement.clientWidth;
    var max = Math.min(vw * 0.3, window.innerHeight * 0.42, 360);
    var px = Math.max(56, Math.min(max, (vw * 0.92 / w) * 100));
    giantBox.style.setProperty('--gfs', px.toFixed(1) + 'px');
    if (hero) hero.style.setProperty('--gfs-px', px.toFixed(1) + 'px');
  }
  function writeGiant(name) {
    if (hpName) hpName.textContent = name;
    if (!giant || name === shown) return;
    var grew = name.length > shown.length && name.indexOf(shown) === 0 && shown !== '';
    shown = name;
    if (S.lang === 'ar') { giant.textContent = name; }
    else {
      // One letter per span, so the name rises in letter by letter; a typed letter pops in.
      giant.textContent = '';
      Array.from(name).forEach(function (ch, i) {
        var el = document.createElement('i');
        el.textContent = ch === ' ' ? '\u00a0' : ch;
        el.style.setProperty('--li', String(i));
        if (grew && i === name.length - 1) el.className = 'new';
        giant.appendChild(el);
      });
    }
    fitGiant();
  }
  var fitT = 0;
  window.addEventListener('resize', function () { clearTimeout(fitT); fitT = setTimeout(fitGiant, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitGiant);
  writeGiant(petName());

  // The hero leans back as you scroll away from it: the name rises slower than the phone.
  if (hero && !reduced) {
    var hpTick = false;
    var hpMove = function () {
      hpTick = false;
      var p = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
      hero.style.setProperty('--hp', p.toFixed(3));
    };
    window.addEventListener('scroll', function () { if (!hpTick) { hpTick = true; requestAnimationFrame(hpMove); } }, { passive: true });
    hpMove();
  }

  // ---- the pixel pets ----
  var HEART = '<svg viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true"><path fill="#3D2A1E" d="M1 0h3v1H1zM5 0h3v1H5zM0 1h1v3H0zM8 1h1v3H8zM4 1h1v1H4zM1 4h1v1H1zM7 4h1v1H7zM2 5h1v1H2zM6 5h1v1H6zM3 6h1v1H3zM5 6h1v1H5zM4 7h1v1H4z"/><path fill="#F2557A" d="M1 1h3v3H1zM5 1h3v3H5zM4 2h1v2H4zM2 4h5v1H2zM3 5h3v1H3zM4 6h1v1H4z"/><path fill="#fff" d="M2 1h1v1H2z"/></svg>';
  function hopSprite(sp) {
    if (reduced) return;
    sp.classList.remove('hop');
    void sp.offsetWidth;
    sp.classList.add('hop');
    setTimeout(function () { sp.classList.remove('hop'); }, 600);
  }
  function heart(sp, dx) {
    var r = sp.getBoundingClientRect();
    var h = document.createElement('span');
    h.className = 'heart';
    h.innerHTML = HEART;
    h.style.left = (r.left + r.width / 2 + window.scrollX) + 'px';
    h.style.top = (r.top + r.height * 0.15 + window.scrollY) + 'px';
    h.style.setProperty('--dx', (dx || 0) + 'px');
    document.body.appendChild(h);
    setTimeout(function () { h.remove(); }, 950);
  }
  var pats = 0;
  document.querySelectorAll('[data-sprite]').forEach(function (sp) {
    sp.addEventListener('click', function () {
      pats++;
      hopSprite(sp);
      if (pats % 5 === 0) {
        // Every fifth pat: a little cheer, three hearts and a rolling buzz.
        sound('success', 0.45);
        buzz([12, 50, 12, 50, 28]);
        if (!reduced) [-26, 0, 26].forEach(function (dx, i) { setTimeout(function () { heart(sp, dx); }, i * 90); });
      } else {
        sound('pat', 0.5, 0.9 + (pats % 4) * 0.07);
        buzz([10, 40, 16]);
        if (!reduced) heart(sp, (Math.random() - 0.5) * 30);
      }
    });
  });
  // Each pet hops once when its part of the page arrives, as if it noticed you.
  if ('IntersectionObserver' in window && !reduced) {
    var hopper = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { setTimeout(function () { hopSprite(e.target); }, 350); hopper.unobserve(e.target); } });
    }, { threshold: 0.9 });
    document.querySelectorAll('.perched > .sprite').forEach(function (sp) { hopper.observe(sp); });
  }

  // ---- buttons you can feel ----
  var PAW = document.querySelector('.btn .paw');
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .bar-btn, .dlg-go, .cell');
    if (!b) return;
    b.classList.add('pressed');
    var off = function () { b.classList.remove('pressed'); window.removeEventListener('pointerup', off); window.removeEventListener('pointercancel', off); };
    window.addEventListener('pointerup', off); window.addEventListener('pointercancel', off);
    sound('tap', 0.42);
    buzz(8);
    if (reduced) return;
    var rip = b.querySelector(':scope > .rip');
    if (!rip) { rip = document.createElement('span'); rip.className = 'rip'; rip.setAttribute('aria-hidden', 'true'); b.appendChild(rip); }
    var r = b.getBoundingClientRect();
    var dot = document.createElement('i');
    dot.style.left = (e.clientX - r.left) + 'px';
    dot.style.top = (e.clientY - r.top) + 'px';
    dot.style.setProperty('--rs', String(Math.ceil(Math.hypot(r.width, r.height) / 10)));
    rip.appendChild(dot);
    setTimeout(function () { dot.remove(); }, 620);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.btn, .bar-btn, .dlg-go');
    if (!b || reduced || !PAW) return;
    var p = PAW.cloneNode(true);
    p.setAttribute('class', 'pop');
    b.appendChild(p);
    setTimeout(function () { p.remove(); }, 650);
  });
  // A soft click for the other controls: tabs of the drawer, the nav, the name field.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.bar nav a, .seg button');
    if (a) { sound('tick', 0.35); buzz(6); }
  });

  // ---- the scroll story: the step in the middle of the screen picks the phone's screen ----
  var story = document.querySelector('.story');
  if (story) {
    var steps = story.querySelectorAll('[data-step]');
    var shots = story.querySelectorAll('[data-shot]');
    var dots = story.querySelectorAll('.dots i');
    var phone = story.querySelector('.phone');
    var current = 0;
    var show = function (n) {
      if (n === current) return;
      current = n;
      steps.forEach(function (s, i) { s.classList.toggle('on', i === n); });
      shots.forEach(function (s, i) { s.classList.toggle('on', i === n); });
      dots.forEach(function (d, i) { d.classList.toggle('on', i === n); });
      // A soft tick as each screen lands (only once the person has touched the page).
      sound('tick', 0.22);
      if (phone && !reduced) { phone.classList.remove('bump'); void phone.offsetWidth; phone.classList.add('bump'); }
    };
    if ('IntersectionObserver' in window) {
      var seen = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) show(Number(e.target.getAttribute('data-step'))); });
      }, { rootMargin: '-45% 0px -45% 0px' });
      steps.forEach(function (s) { seen.observe(s); });
    } else {
      steps.forEach(function (s) { s.classList.add('on'); });
    }
    // The phone tips up into place as the story arrives (scroll-linked, transform only).
    if (phone && !reduced) {
      var ticking = false;
      var tilt = function () {
        ticking = false;
        var r = story.getBoundingClientRect();
        var h = window.innerHeight;
        var p = Math.min(1, Math.max(0, (h - r.top) / (h * 0.75)));
        phone.style.setProperty('--p', p.toFixed(3));
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(tilt); } }, { passive: true });
      tilt();
    }
  }

  // ---- links inside the page glide to their section; any touch, wheel or key takes over at once ----
  if (!reduced) {
    var anim = 0;
    var stop = function () { if (anim) { cancelAnimationFrame(anim); anim = 0; } };
    ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(function (ev) { window.addEventListener(ev, stop, { passive: true }); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      var id = a.getAttribute('href').slice(1);
      var target = id && document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      stop();
      var bar = document.querySelector('.bar');
      var from = window.scrollY;
      var to = Math.max(0, target.getBoundingClientRect().top + from - (bar ? bar.offsetHeight : 0) - 8);
      var dist = Math.abs(to - from);
      var dur = Math.min(1100, Math.max(450, dist * 0.35));
      var t0 = performance.now();
      var ease = function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); };
      var step = function (now) {
        var x = Math.min(1, (now - t0) / dur);
        window.scrollTo(0, from + (to - from) * ease(x));
        if (x < 1) anim = requestAnimationFrame(step); else { anim = 0; target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      };
      anim = requestAnimationFrame(step);
      if (history.pushState) history.pushState(null, '', '#' + id);
    });
  }

  // ---- one question open at a time ----
  var cards = document.querySelectorAll('.drawer details');
  cards.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) cards.forEach(function (o) { if (o !== d) o.open = false; });
    });
    d.querySelector('summary').addEventListener('click', function () {
      sound(d.open ? 'close' : 'open', 0.38);
      buzz(d.open ? 6 : 10);
    });
  });

  // ---- entrances: each section's parts rise in turn as it arrives ----
  var groups = ['.menu > *', '.menu-side img', '.how-text > *', '.slip > *', '.ticket .main > *', '.stub > *', '.plus-shot', '.faq h2', '.drawer details', '.cta-text > *', '.dialog > *', '.foot-top > *'];
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

  // ---- load out: where cross-page view transitions are missing, the page lifts away before leaving ----
  if (!reduced && !('CSSViewTransitionRule' in window)) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
      e.preventDefault();
      doc.classList.add('leaving');
      setTimeout(function () { location.href = url.href; }, 200);
    });
    window.addEventListener('pageshow', function () { doc.classList.remove('leaving'); });
  }

})();
