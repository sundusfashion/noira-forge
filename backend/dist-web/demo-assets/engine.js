/* NOIRA demo engine v1 — solo cosas que FUNCIONAN. Sin decoración.
   Uso: <script src="/demo-assets/engine.js" data-slug="mi-negocio"></script>
   Activa solo lo que encuentre en la página. */
(function () {
  'use strict';
  var script = document.currentScript;
  var SLUG = (script && script.dataset.slug) || '';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* 1. Reloj real: abierto/cerrado. data-open="7.5" data-close="20.5" */
  $$('[data-open]').forEach(function (el) {
    var h = new Date().getHours() + new Date().getMinutes() / 60;
    var open = h >= parseFloat(el.dataset.open) && h < parseFloat(el.dataset.close);
    el.classList.remove('open', 'closed');
    el.classList.add(open ? 'open' : 'closed');
    var t = el.querySelector('[data-open-txt]');
    if (t) t.textContent = open ? (el.dataset.openMsg || 'ABIERTO AHORA') : (el.dataset.closedMsg || 'CERRADO · ABRIMOS PRONTO');
  });

  /* 2. Cuenta atrás real de la demo. data-countdown (ISO en data-expires o /api/demos) */
  function tickCountdown(el, ts) {
    function f() {
      var ms = ts - Date.now();
      if (ms <= 0) { el.textContent = 'Demo apagada — pide la tuya'; return; }
      var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
      el.textContent = 'Se apaga en ' + h + 'h ' + m + 'm ' + s + 's';
      setTimeout(f, 1000);
    }
    f();
  }
  $$('[data-countdown]').forEach(function (el) {
    if (el.dataset.expires) { tickCountdown(el, new Date(el.dataset.expires).getTime()); return; }
    if (!SLUG) return;
    fetch('/api/demos/' + SLUG).then(function (r) { return r.json(); }).then(function (cfg) {
      if (cfg.expiresAt) tickCountdown(el, cfg.expiresAt);
    }).catch(function () {});
  });

  /* 3. Contadores animados. <b data-count="2300"> */
  var cio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      cio.unobserve(e.target);
      var end = parseFloat(e.target.dataset.count), t0 = performance.now();
      (function step(t) {
        var p = Math.min(1, (t - t0) / 1400);
        e.target.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('es-ES');
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }, { threshold: 0.5 });
  $$('[data-count]').forEach(function (el) { cio.observe(el); });

  /* 4. Reveal on scroll. .reveal */
  var rio = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
  }, { threshold: 0.12 });
  $$('.reveal').forEach(function (el) { rio.observe(el); });

  /* 5. Pestañas genéricas. .tab[data-tab] + [data-panel="id"] */
  $$('.tab[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.tab[data-tab]').forEach(function (x) { x.classList.remove('on'); });
      btn.classList.add('on');
      $$('[data-panel]').forEach(function (p) { p.style.display = p.dataset.panel === btn.dataset.tab ? '' : 'none'; });
      if (typeof window.__paintTab === 'function') window.__paintTab(btn.dataset.tab);
    });
  });

  /* 6. Saludo según hora. [data-greet] */
  $$('[data-greet]').forEach(function (el) {
    var h = new Date().getHours();
    el.textContent = h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
  });

  /* 7. Visitante que vuelve. [data-welcome] */
  try {
    var seen = localStorage.getItem('noira-seen-' + (SLUG || 'x'));
    $$('[data-welcome]').forEach(function (el) {
      if (seen) { el.style.display = ''; var s = el.querySelector('[data-welcome-txt]'); if (s) s.textContent = 'Bienvenido de nuevo'; }
    });
    localStorage.setItem('noira-seen-' + (SLUG || 'x'), '1');
  } catch (e) {}

  /* 8. Idioma ES/GL. [data-es][data-gl] + [data-lang-btn] */
  var lang = 'es';
  $$('[data-lang-btn]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      lang = lang === 'es' ? 'gl' : 'es';
      $$('[data-es]').forEach(function (el) { el.textContent = el.dataset[lang] || el.textContent; });
      $$('[data-lang-btn]').forEach(function (b) { b.textContent = lang === 'es' ? 'GL' : 'ES'; });
    });
  });

  /* 9. FAQ acordeón real. [data-faq] > dt/dd */
  $$('[data-faq] dt').forEach(function (dt) {
    dt.style.cursor = 'pointer';
    dt.addEventListener('click', function () {
      var dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') dd.style.display = dd.style.display === 'none' ? '' : 'none';
    });
  });

  /* 10. Galería fullscreen. .grid img */
  $$('.grid img').forEach(function (img) {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function () {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
      var big = document.createElement('img');
      big.src = img.src; big.style.cssText = 'max-width:94vw;max-height:90vh;border-radius:12px';
      ov.appendChild(big);
      ov.addEventListener('click', function () { document.body.removeChild(ov); });
      document.body.appendChild(ov);
    });
  });

  /* 11. Carta según hora. [data-hours-menu] con data-morning / data-lunch */
  $$('[data-hours-menu]').forEach(function (el) {
    var h = new Date().getHours();
    var useLunch = h >= 12;
    var alt = useLunch ? el.dataset.lunch : el.dataset.morning;
    if (alt) el.textContent = alt;
  });

  /* 12. WhatsApp nuestro cableado. #demoCta, #waFloat */
  if (SLUG) {
    fetch('/api/demos/' + SLUG).then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg.ownerPhone) return;
      var url = 'https://wa.me/' + cfg.ownerPhone + '?text=' + encodeURIComponent(cfg.waText || 'Hola, me interesa la web demo');
      ['demoCta', 'waFloat'].forEach(function (id) {
        var a = document.getElementById(id);
        if (a) a.href = url;
      });
    }).catch(function () {});
  }

  /* 13. Formulario → lead real. form[data-lead] */
  $$('form[data-lead]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      var data = { slug: SLUG };
      $$('input,select,textarea', form).forEach(function (inp) {
        if (inp.name) data[inp.name] = inp.value;
      });
      if (btn) btn.textContent = 'Enviando…';
      fetch('/api/demo-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw 0; ok(form, btn); })
        .catch(function () { ok(form, btn); });
      function ok(f, b) {
        var box = f.querySelector('[data-lead-ok]');
        if (box) box.style.display = 'block';
        if (b) b.textContent = '✓ Recibido';
      }
    });
  });
})();
