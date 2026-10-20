/* Maison Sirocco · page-local choreography. The engine pins and publishes
   progress; everything bespoke (the arch walk-through, the city regrade, the
   route that draws itself, the chosen room travelling to the ticket) lives
   here. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a || 0, v)); };
  var smooth = function (t) { t = clamp(t); return t * t * (3 - 2 * t); };
  var easeOut = function (t) { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
  var easeInOut = function (t) { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ---------------------------------------------------------------- map --
     Projection: x = (lon + 17.5) * 10, y = (36 - lat) * 10. Real city
     coordinates; the outline is a simplified coast and border. */
  var LAND = [[115.8,2.1],[116.9,2.1],[121.8,1.1],[122,4],[124,5.5],[135.7,7.5],[145.7,8.3],[153,9.1],[157.5,13.2],[159,25],[163,39],[146,45],[125,60],[110,65],[100,70],[88.3,73],[88.3,83.3],[88.3,100],[55,100.1],[55,125],[45,146.7],[5.5,146.7],[4.5,152],[8,140],[14,130],[15.5,123],[26.5,112],[30.2,98.7],[41,88.5],[45.8,80.6],[64,75.6],[73.3,66.2],[79,55.8],[76.1,53.7],[77.3,44.9],[82.6,37],[82.2,34.5],[89.9,27.5],[98.8,24],[106.6,19.7],[109,17],[113.5,8.1],[114.7,5.4]];
  var STOPS = [
    { id: 'tanger',      name: 'Tanger',      x: 116.9, y: 2.3,   lx: 6,  ly: 2 },
    { id: 'chefchaouen', name: 'Chefchaouen', x: 122.3, y: 8.3,   lx: 6,  ly: 3 },
    { id: 'fes',         name: 'Fès',         x: 125,   y: 19.7,  lx: 6,  ly: 3 },
    { id: 'marrakech',   name: 'Marrakech',   x: 94.9,  y: 43.7,  lx: -6, ly: -4, end: true },
    { id: 'ouarzazate',  name: 'Ouarzazate',  x: 106.1, y: 50.8,  lx: 6,  ly: 4 },
    { id: 'essaouira',   name: 'Essaouira',   x: 77.3,  y: 44.9,  lx: -6, ly: 4, end: true },
    { id: 'dakhla',      name: 'Dakhla',      x: 15.4,  y: 123.2, lx: 6,  ly: 3 }
  ];
  var CURVES = [[121,3],[127,13],[116,36],[103,44],[92,54],[40,72]];
  var NS = 'http://www.w3.org/2000/svg';
  var landD = 'M' + LAND.map(function (p) { return p[0] + ' ' + p[1]; }).join('L') + 'Z';

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function buildMap(svg, labels, links) {
    $('.map-land', svg).setAttribute('d', landD);
    var legsG = $('.map-legs', svg), dotsG = $('.map-dots', svg);
    var legs = [], dots = {}, rings = {}, stamps = {}, labs = {};
    for (var i = 1; i < STOPS.length; i++) {
      var a = STOPS[i - 1], b = STOPS[i], c = CURVES[i - 1];
      var path = el('path', { class: 'map-leg', d: 'M' + a.x + ' ' + a.y + 'Q' + c[0] + ' ' + c[1] + ' ' + b.x + ' ' + b.y }, legsG);
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      legs.push({ el: path, len: len, cur: -1 });
    }
    STOPS.forEach(function (s) {
      var host = dotsG;
      if (links) {
        host = el('a', { href: s.id === 'tanger' ? '#top' : '#room-' + s.id, 'data-stop': s.id, 'aria-label': s.name }, dotsG);
        el('circle', { class: 'map-hit', cx: s.x, cy: s.y, r: 7 }, host);
      }
      stamps[s.id] = el('circle', { class: 'map-stamp', cx: s.x, cy: s.y, r: 6.5 }, host);
      rings[s.id] = el('circle', { class: 'map-ring', cx: s.x, cy: s.y, r: 4.6 }, host);
      dots[s.id] = el('circle', { class: 'map-dot', cx: s.x, cy: s.y, r: 2.2 }, host);
      if (labels) {
        var t = el('text', { class: 'map-label', x: s.x + s.lx, y: s.y + s.ly }, host);
        if (s.end) t.setAttribute('text-anchor', 'end');
        t.textContent = s.name;
        labs[s.id] = t;
      }
    });
    return { legs: legs, dots: dots, rings: rings, stamps: stamps, labs: labs };
  }
  var maps = [
    buildMap($('.route__map'), false, false),
    buildMap($('.voyage__map'), true, false)
  ];
  function paintMaps(draw, hereId, visitedUpTo) {
    maps.forEach(function (m) {
      m.legs.forEach(function (L, k) {
        var d = clamp(draw[k]);
        if (Math.abs(d - L.cur) < 0.002) return;
        L.cur = d;
        L.el.style.strokeDashoffset = (L.len * (1 - d)).toFixed(2);
      });
      STOPS.forEach(function (s, k) {
        var here = s.id === hereId;
        m.dots[s.id].classList.toggle('is-here', here);
        m.rings[s.id].classList.toggle('is-here', here);
        m.dots[s.id].classList.toggle('is-visited', k <= visitedUpTo);
        if (m.labs[s.id]) m.labs[s.id].classList.toggle('is-here', here);
      });
    });
  }

  /* ------------------------------------------------------------ colour -- */
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(a, b, t) { return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; }

  /* ------------------------------------------------------------- acts --- */
  var hero = $('#hero'), voyage = $('#voyage'), sky = $('#sky');
  var heroStage = $('.hero__stage');
  var planes = {
    view: $('[data-plane="view"]'), haze: $('[data-plane="haze"]'),
    reveal: $('[data-plane="reveal"]'), wall: $('[data-plane="wall"]')
  };
  var heroCopy = $('.hero__copy'), heroAfter = $('.hero__after'), heroBand = $('.hero__band');
  var vStage = $('.voyage__stage'), depart = $('.voyage__depart');
  var rooms = $$('.room').map(function (r) {
    r.style.setProperty('--g', r.dataset.ground);
    r.style.setProperty('--a', r.dataset.accent);
    return {
      el: r, id: r.dataset.city, ground: hex(r.dataset.ground), accent: hex(r.dataset.accent),
      arch: $('.room__arch', r), detail: $('.room__detail', r), text: $('.room__text', r)
    };
  });
  var ESPRESSO = hex('#17110d'), GOLD = hex('#dcbb84');
  var skyStage = $('.sky__stage');
  var skyDusk = $('.sky__img--dusk'), skyNight = $('.sky__img--night');
  var skyTimes = $$('.sky__time li');
  var SKY = [hex('#2f5a73'), hex('#86412d'), hex('#111b2c')];
  var DEPART = 0.08;

  function progress(sec) {
    var r = sec.getBoundingClientRect();
    var travel = Math.max(r.height - innerHeight, 1);
    return { p: clamp(-r.top / travel), top: r.top, bottom: r.bottom, travel: travel };
  }

  var mouse = { x: 0.5, y: 0.5, sx: 0.5, sy: 0.5 };
  if (!reduce && fine.matches) {
    addEventListener('pointermove', function (e) { mouse.x = e.clientX / innerWidth; mouse.y = e.clientY / innerHeight; }, { passive: true });
  }

  var maxQ = -1; // the route stays drawn as far as the visitor has travelled
  var currentStop = 'tanger';
  var hereLabel = $('#route-here');
  var routeLinks = $$('.route__list a');

  function setStop(id, label) {
    if (id === currentStop && hereLabel.textContent === label) return;
    currentStop = id;
    hereLabel.textContent = label;
    routeLinks.forEach(function (a) { a.setAttribute('aria-current', a.dataset.stop === id ? 'true' : 'false'); });
  }

  function frame() {
    mouse.sx += (mouse.x - mouse.sx) * 0.08;
    mouse.sy += (mouse.y - mouse.sy) * 0.08;
    var vh = innerHeight;

    /* 1 · walking through the arch */
    var H = progress(hero);
    if (!reduce && H.bottom > 0) {
      var e = easeInOut(H.p / 0.84);
      var mx = mouse.sx - 0.5, my = mouse.sy - 0.5;
      planes.view.style.transform = 'translate3d(' + (-mx * 22).toFixed(1) + 'px,' + (-my * 14).toFixed(1) + 'px,0) scale(' + (1.02 + 0.16 * e).toFixed(4) + ')';
      planes.haze.style.transform = 'translate3d(' + (-mx * 12).toFixed(1) + 'px,' + (-8 * e).toFixed(1) + 'vh,0) scale(' + Math.pow(2.2, e).toFixed(4) + ')';
      planes.haze.style.opacity = (1 - e * 0.7).toFixed(3);
      planes.reveal.style.transform = 'translate3d(' + (-mx * 7).toFixed(1) + 'px,' + (-my * 4).toFixed(1) + 'px,0) scale(' + Math.pow(6.5, e).toFixed(4) + ')';
      planes.wall.style.transform = 'scale(' + Math.pow(10, e).toFixed(4) + ')';
      heroCopy.style.opacity = (1 - clamp(H.p / 0.2)).toFixed(3);
      heroCopy.style.visibility = H.p > 0.22 ? 'hidden' : 'visible';
      var after = smooth((H.p - 0.6) / 0.2);
      heroAfter.style.opacity = after.toFixed(3);
      heroAfter.style.transform = 'translate3d(0,' + ((1 - after) * 18).toFixed(1) + 'px,0)';
      heroBand.style.opacity = after.toFixed(3);
    }

    /* 3 · the voyage */
    var V = progress(voyage);
    var inVoyage = V.top < vh * 0.5 && V.bottom > vh * 0.5;
    document.body.classList.toggle('is-voyage', inVoyage);
    var qRaw = (V.p - DEPART) / (1 - DEPART) * 6;
    if (V.top < vh) maxQ = Math.max(maxQ, qRaw);
    var q = clamp(qRaw, 0, 6);
    var i = Math.min(5, Math.floor(q)), t = q - i;
    if (!reduce && V.top < vh && V.bottom > 0) {
      var ground, accent;
      if (V.p < DEPART) {
        var d0 = smooth((V.p - 0.025) / 0.06);
        ground = mix(ESPRESSO, rooms[0].ground, d0);
        accent = mix(GOLD, rooms[0].accent, d0);
      } else {
        var nx = i < 5 ? smooth((t - 0.8) / 0.2) : 0;
        var nxt = rooms[Math.min(5, i + 1)];
        ground = mix(rooms[i].ground, nxt.ground, nx);
        accent = mix(rooms[i].accent, nxt.accent, nx);
      }
      vStage.style.setProperty('--ground', ground);
      vStage.style.setProperty('--acc', accent);

      var dep = smooth((V.p - 0.02) / 0.06);
      depart.style.opacity = (1 - dep).toFixed(3);
      depart.style.transform = 'translate3d(0,' + (-dep * 30).toFixed(1) + 'px,0)';
      depart.style.visibility = dep >= 1 ? 'hidden' : 'visible';

      rooms.forEach(function (R, k) {
        var tk = qRaw - k;
        var live = tk > -0.02 && (k === 5 ? true : tk < 1.02);
        R.el.classList.toggle('is-live', live);
        if (!live) { R.el.style.opacity = 0; return; }
        var open = easeOut(tk / 0.34);
        var fadeIn = smooth(tk / 0.1);
        var leave = k < 5 ? smooth((tk - 0.84) / 0.16) : 0;
        R.el.style.opacity = (fadeIn * (1 - leave)).toFixed(3);
        R.arch.style.setProperty('--o', (0.14 + 0.86 * open).toFixed(4));
        R.arch.style.setProperty('--z', (1.14 - 0.14 * open).toFixed(4));
        var tin = easeOut((tk - 0.08) / 0.2);
        R.text.style.opacity = (tin * (1 - leave)).toFixed(3);
        R.text.style.transform = 'translate3d(0,' + ((1 - tin) * 26 - leave * 18).toFixed(1) + 'px,0)';
        var din = easeOut((tk - 0.18) / 0.22);
        R.detail.style.opacity = (din * (1 - leave)).toFixed(3);
        R.detail.style.transform = 'translate3d(0,' + ((1 - din) * 46 + (tk - 0.5) * -34).toFixed(1) + 'px,0)';
      });
    }
    var draw = [];
    for (var k = 0; k < 6; k++) draw.push((maxQ - k + 0.22) / 0.42);
    var hereId = 'tanger';
    if (inVoyage && V.p >= DEPART * 0.6) hereId = rooms[i].id;
    var visited = Math.min(6, Math.floor(maxQ + 0.22 + 1));
    paintMaps(draw, hereId, visited);

    /* 6 · SKY, morning to night */
    var S = progress(sky);
    var tt = clamp((S.p - 0.12) / 0.74) * 2;
    if (!reduce && S.top < vh && S.bottom > 0) {
      skyDusk.style.opacity = smooth(tt).toFixed(3);
      skyNight.style.opacity = smooth(tt - 1).toFixed(3);
      skyStage.style.setProperty('--sky', tt <= 1 ? mix(SKY[0], SKY[1], smooth(tt)) : mix(SKY[1], SKY[2], smooth(tt - 1)));
      var now = tt < 0.6 ? 0 : tt < 1.5 ? 1 : 2;
      skyTimes.forEach(function (li, n) { li.classList.toggle('is-now', n === now); });
    }

    /* chrome: which ground is under the header, and where are we */
    var probe = 40, tone = 'light';
    if (H.bottom > probe) tone = (H.p > 0.56 && !reduce) ? 'dark' : 'light';
    else {
      var secs = toneMap;
      for (var n = 0; n < secs.length; n++) {
        var r = secs[n][0].getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) { tone = secs[n][1]; break; }
      }
    }
    if (document.body.dataset.tone !== tone) document.body.dataset.tone = tone;

    var mid = vh * 0.5;
    if (inVoyage) {
      if (reduce) {
        var best = null;
        rooms.forEach(function (R) { var b = R.el.getBoundingClientRect(); if (b.top <= mid && b.bottom > mid) best = R; });
        if (best) setStop(best.id, best.el.querySelector('.room__city').textContent);
        else setStop('tanger', 'Départ de Tanger');
      } else if (V.p < DEPART * 0.6) setStop('tanger', 'Départ de Tanger');
      else setStop(rooms[i].id, rooms[i].el.querySelector('.room__city').textContent);
    } else if (V.bottom <= mid) {
      var sr = sky.getBoundingClientRect(), tr = $('#reserver').getBoundingClientRect();
      if (tr.top <= mid) setStop('reserver', 'Réserver');
      else if (sr.top <= mid) setStop('sky', 'SKY, le rooftop');
      else setStop('tanger', 'Retour à Tanger');
    } else setStop('tanger', 'Tanger');

    requestAnimationFrame(frame);
  }
  var toneMap = [
    [$('.refuge'), 'light'], [voyage, 'dark'], [$('.table'), 'dark'],
    [$('.host'), 'light'], [sky, 'dark'], [$('#reserver'), 'light']
  ];

  /* ---------------------------------------------------- route nav ------ */
  var route = $('#route'), toggle = $('.route__toggle');
  function setOpen(open) {
    route.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  toggle.addEventListener('click', function () { setOpen(!route.classList.contains('is-open')); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && route.classList.contains('is-open')) { setOpen(false); toggle.focus(); } });

  function jump(stop) {
    var y;
    var behavior = reduce ? 'auto' : 'smooth';
    var idx = STOPS.map(function (s) { return s.id; }).indexOf(stop);
    if (stop === 'tanger') y = 0;
    else if (idx > 0) {
      if (reduce) { y = document.getElementById('room-' + stop).getBoundingClientRect().top + scrollY; }
      else {
        var r = voyage.getBoundingClientRect();
        var travel = r.height - innerHeight;
        var p = DEPART + (1 - DEPART) * (idx - 1 + 0.55) / 6;
        y = r.top + scrollY + p * travel;
      }
    } else if (stop === 'sky') {
      var s = sky.getBoundingClientRect();
      y = s.top + scrollY + (reduce ? 0 : (s.height - innerHeight) * 0.08);
    } else if (stop === 'reserver') y = $('#reserver').getBoundingClientRect().top + scrollY;
    if (y === undefined) return false;
    scrollTo({ top: Math.round(y), behavior: behavior });
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-stop], a[href="#reserver"], a[href="#voyage"], a[href="#top"]');
    if (!a) return;
    var stop = a.dataset.stop || { '#reserver': 'reserver', '#voyage': 'voyage', '#top': 'tanger' }[a.getAttribute('href')];
    if (stop === 'voyage') {
      var r = voyage.getBoundingClientRect();
      e.preventDefault();
      scrollTo({ top: Math.round(r.top + scrollY), behavior: reduce ? 'auto' : 'smooth' });
    } else if (jump(stop)) e.preventDefault();
    setOpen(false);
    if (stop === 'reserver') setTimeout(function () { $('#f-in').focus({ preventScroll: true }); }, reduce ? 0 : 900);
  });

  /* ------------------------------------- the chosen room travels with you */
  var chosen = '';
  var buttons = $$('.room__choose');
  var roomSelect = $('#f-room'), stamp = $('#stamp'), stampCity = $('#stamp-city');
  var NAME_TO_ID = {};
  STOPS.forEach(function (s) { NAME_TO_ID[s.name] = s.id; });
  function choose(name) {
    chosen = name;
    buttons.forEach(function (b) {
      var on = b.dataset.choose === name;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? 'Chambre choisie' : 'Choisir cette chambre';
    });
    roomSelect.value = name;
    stamp.classList.toggle('is-on', !!name);
    stampCity.textContent = name;
    maps.forEach(function (m) {
      STOPS.forEach(function (s) { m.stamps[s.id].classList.toggle('is-chosen', NAME_TO_ID[name] === s.id); });
    });
    try { name ? localStorage.setItem('sirocco-room', name) : localStorage.removeItem('sirocco-room'); } catch (err) { /* private mode */ }
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () { choose(chosen === b.dataset.choose ? '' : b.dataset.choose); });
  });
  roomSelect.addEventListener('change', function () { choose(roomSelect.value); });
  try { var saved = localStorage.getItem('sirocco-room'); if (saved && NAME_TO_ID[saved]) choose(saved); } catch (err) { /* ignore */ }

  /* ------------------------------------------------------------ the slip */
  var form = $('#slip'), fin = $('#f-in'), fout = $('#f-out'), guests = $('#f-guests'), msg = $('#slip-msg');
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  var iso = today.toISOString().slice(0, 10);
  fin.min = iso; fout.min = iso;
  fin.addEventListener('change', function () { if (fin.value) fout.min = fin.value; });
  function fr(v) { return new Date(v + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function bad(field, text) {
    field.closest('.field').classList.add('is-bad');
    field.setAttribute('aria-invalid', 'true');
    msg.className = 'slip__msg is-bad';
    msg.textContent = text;
    field.focus();
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    $$('.field', form).forEach(function (f) { f.classList.remove('is-bad'); });
    [fin, fout].forEach(function (f) { f.removeAttribute('aria-invalid'); });
    if (!fin.value) return bad(fin, 'Indiquez votre date d’arrivée.');
    if (fin.value < iso) return bad(fin, 'La date d’arrivée est déjà passée.');
    if (!fout.value) return bad(fout, 'Indiquez votre date de départ.');
    if (fout.value <= fin.value) return bad(fout, 'Le départ doit suivre l’arrivée.');
    var room = roomSelect.value ? 'la chambre ' + roomSelect.value : 'une chambre';
    var g = guests.value === '1' ? '1 voyageur' : guests.value + ' voyageurs';
    var text = 'Bonjour Maison Sirocco, je souhaite réserver ' + room + ' du ' + fr(fin.value) + ' au ' + fr(fout.value) + ' pour ' + g + '. Merci de me confirmer la disponibilité.';
    var url = 'https://salimbennani39.github.io/showcase/404.html' + encodeURIComponent(text);
    var w = window.open(url, '_blank', 'noopener');
    msg.className = 'slip__msg';
    msg.innerHTML = '';
    msg.appendChild(document.createTextNode(w ? 'WhatsApp s’ouvre avec votre demande. L’équipe de Maison Sirocco vous confirmera la disponibilité. ' : 'Votre demande est prête. '));
    var link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = w ? 'Rouvrir WhatsApp' : 'Ouvrir WhatsApp';
    msg.appendChild(link);
  });

  requestAnimationFrame(frame);
})();
