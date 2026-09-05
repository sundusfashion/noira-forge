// Adaptive demo template: one engine, sector soul.
// Sectors: restaurante | cafeteria | tienda | clinica | negocio
export interface DemoSpec {
  slug: string;
  business: string;
  sector: string;
  phone?: string;
  address?: string;
  photos: string[];
  video?: string;
}

const THEMES: Record<string, { bg: string; coal: string; acc: string; gold: string; kicker: string; cta: string }> = {
  restaurante: { bg: '#0c0705', coal: '#140d08', acc: '#ff7a1a', gold: '#e8b64c', kicker: 'DE LA TIERRA A LA MESA', cta: 'Reservar mesa' },
  cafeteria: { bg: '#120b06', coal: '#1d1209', acc: '#c98a3d', gold: '#e8b64c', kicker: 'TU SITIO DE CADA DÍA', cta: 'Pedir para llevar' },
  tienda: { bg: '#171008', coal: '#221610', acc: '#d9703b', gold: '#e8b64c', kicker: 'DE BARRIO, DE VERDAD', cta: 'Encargar' },
  clinica: { bg: '#04141c', coal: '#08222e', acc: '#19b8d8', gold: '#e8c85c', kicker: 'CUIDAMOS DE TI', cta: 'Pedir cita' },
  negocio: { bg: '#0a0a0d', coal: '#121217', acc: '#D4A843', gold: '#e8c85c', kicker: 'DE TU BARRIO', cta: 'Contactar' },
};

const SECTIONS: Record<string, { s1: [string, string]; s2: [string, string]; s3: [string, string]; items: [string, string, string][] }> = {
  restaurante: {
    s1: ['La carta', 'Producto de cercanía, precios de barrio.'],
    s2: ['El local', 'Así se come aquí.'],
    s3: ['Reserva', 'Elige día y hora. Te confirmamos por WhatsApp.'],
    items: [['Plato de la casa', 'Receta tradicional', '14,50 €'], ['Especialidad', 'Pregunta en barra', '16,00 €'], ['Menú del día', 'De lunes a viernes', '15,00 €'], ['Postre casero', 'Hecho aquí', '5,50 €']],
  },
  cafeteria: {
    s1: ['La carta', 'Lo de siempre, bien hecho.'],
    s2: ['El local', 'Tu sitio en el barrio.'],
    s3: ['Pide', 'Lo pides aquí y lo recoges listo.'],
    items: [['Desayuno completo', 'Café + tostada + zumo', '4,50 €'], ['Café con leche', 'El de siempre', '1,60 €'], ['Pincho del día', 'Pregunta en barra', '2,80 €'], ['Para llevar', 'Sin cola', '+0,20 €']],
  },
  tienda: {
    s1: ['La tienda', 'Selección del barrio.'],
    s2: ['Así somos', 'Comercio local de verdad.'],
    s3: ['Encarga', 'Cuéntanos qué buscas.'],
    items: [['Lo más vendido', 'Selección de la casa', 'desde 12 €'], ['Encargo personalizado', 'Lo preparamos a tu gusto', 'a convenir'], ['Tarjeta regalo', 'Para que elijan ellos', '20–50 €'], ['Envoltorio', 'Siempre incluido', 'gratis']],
  },
  clinica: {
    s1: ['Tratamientos', 'Primera visita informativa.'],
    s2: ['La clínica', 'Trato humano, sin prisas.'],
    s3: ['Pide cita', 'Elige día y hora.'],
    items: [['Primera visita', 'Te escuchamos', 'gratis'], ['Tratamiento base', 'Plan a medida', 'a convenir'], ['Revisión', 'Seguimiento incluido', '—'], ['Urgencias', 'Te hacemos hueco', '—']],
  },
  negocio: {
    s1: ['Servicios', 'Lo que hacemos por ti.'],
    s2: ['Nosotros', 'Gente de barrio.'],
    s3: ['Contacto', 'Escríbenos sin compromiso.'],
    items: [['Servicio 1', 'Pregúntanos', 'a convenir'], ['Servicio 2', 'A medida', 'a convenir'], ['Servicio 3', 'Sin compromiso', '—'], ['Presupuesto', 'Gratis y sin letra pequeña', 'gratis']],
  },
};

const MARQUEE: Record<string, string[]> = {
  restaurante: ['BRASA', 'PRODUCTO DE AQUÍ', 'SIN PRISAS', 'DE BARRIO'],
  cafeteria: ['RECIÉN HECHO', 'PARA LLEVAR', 'DE BARRIO', 'SIN COLA'],
  tienda: ['HECHO AQUÍ', 'COMERCIO LOCAL', 'ENVOLTORIO GRATIS', 'DE BARRIO'],
  clinica: ['TE ESCUCHAMOS', 'SIN PRISAS', 'PRIMERA VISITA', 'CONFIANZA'],
  negocio: ['DE BARRIO', 'SIN COMPROMISO', 'TRATO HUMANO', 'RESPUESTA HOY'],
};

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function buildDemoSite(spec: DemoSpec): string {
  const t = THEMES[spec.sector] || THEMES.negocio;
  const s = SECTIONS[spec.sector] || SECTIONS.negocio;
  const contact = [spec.address, spec.phone].filter(Boolean).join(' · ');
  const bizWa = (spec.phone || '').replace(/\D/g, '');
  const dishOrder = (d: string) => bizWa
    ? ` <a data-wa-biz data-wa-text="Hola ${esc(spec.business)}, quiero pedir: ${d}. Soy " href="#" style="font-size:12px;color:var(--acc)">pedir →</a>`
    : '';
  const photos = spec.photos.slice(0, 4);
  const gallery = photos.map((u, i) => `    <figure><img loading="lazy" src="${u}" alt="Foto ${i + 1} de ${esc(spec.business)}"></figure>`).join('\n');
  const items = s.items.map((d, i) => `      <div class="dish" style="animation-delay:${i * 70}ms"><img loading="lazy" src="${photos[i % Math.max(1, photos.length)]}" alt=""><div><h4>${d[0]}</h4><p>${d[1]}</p>${dishOrder(d[0])}</div><div class="price">${d[2]}</div></div>`).join('\n');
  const videoBg = spec.video
    ? `<video autoplay muted loop playsinline poster="${photos[0] || ''}"><source src="${spec.video}" type="video/mp4"></video>`
    : `<canvas id="fx"></canvas>`;
  const fxScript = spec.video ? '' : `
/* brasas genéricas del sector */
const cv=document.getElementById('fx'),cx=cv.getContext('2d');let W,H;
function rs(){W=cv.width=cv.offsetWidth;H=cv.height=cv.offsetHeight}
addEventListener('resize',rs);rs();
const P=[];for(let i=0;i<70;i++)P.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.4+.6,s:Math.random()*.7+.2,o:Math.random()*.6+.2});
(function loop(){cx.clearRect(0,0,W,H);for(const p of P){p.y-=p.s;if(p.y<-6){p.y=H+6;p.x=Math.random()*W}
cx.fillStyle='ACC'.replace('ACC','${t.acc}');cx.globalAlpha=p.o;cx.beginPath();cx.arc(p.x,p.y,p.r*2.5,0,7);cx.fill()}cx.globalAlpha=1;requestAnimationFrame(loop)})();`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(spec.business)} — Hecho por Noira</title>
<meta name="description" content="${esc(spec.business)}: web demo creada por Noira. Visible 24h.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:${t.bg};--coal:${t.coal};--acc:${t.acc};--gold:${t.gold};--cream:#f7ecdc;--muted:#bfae97;--line:rgba(255,255,255,.1);--font-d:'Syne',Verdana,sans-serif;--font-b:Georgia,serif}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--cream);font-family:var(--font-b);overflow-x:hidden}
a{color:inherit}
.demo-bar{position:sticky;top:0;z-index:60;background:linear-gradient(90deg,${t.coal},${t.acc},${t.coal});color:#fff;text-align:center;font-family:Verdana,sans-serif;font-size:12.5px;font-weight:bold;padding:10px 14px}
.demo-bar b{background:#000;color:#ffe9b0;padding:2px 10px;border-radius:20px;margin-left:8px}
.nav{position:sticky;top:41px;z-index:50;display:flex;justify-content:space-between;align-items:center;padding:14px 26px;background:rgba(0,0,0,.8);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.brand{font-family:var(--font-d);font-weight:800;font-size:19px;letter-spacing:2px}
.brand span{color:var(--acc)}
.links{display:flex;gap:22px;font-family:Verdana,sans-serif;font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase}
.links a{text-decoration:none;color:var(--muted)}
.links a:hover{color:var(--gold)}
.btn{display:inline-block;background:linear-gradient(180deg,${t.acc},${t.coal});color:#fff;text-decoration:none;font-family:Verdana,sans-serif;font-weight:bold;font-size:13px;letter-spacing:1px;padding:13px 28px;border-radius:12px;border:1px solid var(--acc);cursor:pointer;transition:transform .15s}
.btn:hover{transform:translateY(-2px)}
.btn.ghost{background:transparent}
.hero{position:relative;min-height:88vh;display:flex;align-items:center;justify-content:center;text-align:center;overflow:hidden;background:#000}
.hero video,.hero canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}
.hero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,.5) 60%,var(--bg));pointer-events:none}
.hero-inner{position:relative;z-index:2;max-width:860px;padding:60px 22px}
.kicker{font-family:Verdana,sans-serif;font-size:11px;letter-spacing:5px;color:var(--gold);border:1px solid var(--acc);display:inline-block;padding:8px 18px;border-radius:999px;margin-bottom:22px}
.hero h1{font-family:var(--font-d);font-size:clamp(40px,8vw,84px);line-height:1.02;font-weight:800}
.hero p{color:var(--muted);font-size:clamp(15px,2.4vw,19px);margin:20px auto 30px;max-width:600px;line-height:1.65}
.cta-row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.open-pill{display:inline-flex;align-items:center;gap:8px;font-family:Verdana,sans-serif;font-size:11px;letter-spacing:2px;padding:8px 18px;border-radius:999px;margin-bottom:20px;border:1px solid}
.open-pill .dot{width:8px;height:8px;border-radius:50%;background:currentColor;animation:pl 1.8s infinite}
.open-pill.open{color:#5fe8ab;border-color:rgba(0,200,120,.5);background:rgba(0,200,120,.1)}
.open-pill.closed{color:#ff9db0;border-color:rgba(255,45,85,.5);background:rgba(255,45,85,.1)}
@keyframes pl{0%,100%{opacity:1}50%{opacity:.4}}
section{padding:70px 26px;max-width:1100px;margin:0 auto}
.k{font-family:Verdana,sans-serif;font-size:11px;letter-spacing:4px;color:var(--acc);margin-bottom:8px}
h2{font-family:var(--font-d);font-size:clamp(28px,5vw,46px);margin-bottom:14px}
.sub{color:var(--muted);margin-bottom:30px;max-width:620px;line-height:1.7}
.tabs{display:flex;gap:10px;margin-bottom:22px;flex-wrap:wrap}
.tab{font-family:Verdana,sans-serif;font-size:12.5px;padding:10px 22px;border-radius:999px;cursor:pointer;background:transparent;border:1px solid rgba(255,255,255,.2);color:var(--muted)}
.tab.on{background:var(--acc);color:#000;border-color:transparent;font-weight:bold}
.dish{display:flex;justify-content:space-between;gap:14px;padding:15px 4px;border-bottom:1px dashed rgba(255,255,255,.14)}
.dish h4{font-size:17px}.dish p{color:var(--muted);font-size:13.5px;margin-top:3px}
.price{font-family:var(--font-d);font-weight:800;color:var(--gold);font-size:18px;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.grid figure{position:relative;margin:0;border-radius:14px;overflow:hidden}
.grid img{width:100%;height:230px;object-fit:cover;display:block;filter:saturate(.92) contrast(1.06);transition:transform .3s}
.grid figure::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,var(--coal) 130%),linear-gradient(120deg,transparent 60%,var(--acc) 160%);opacity:.55;pointer-events:none}
.grid figure:hover img{transform:scale(1.05)}
.dish img{width:64px;height:64px;border-radius:12px;object-fit:cover;flex:none;border:1px solid var(--line)}
.progress{position:fixed;top:0;left:0;height:3px;width:0;background:linear-gradient(90deg,var(--gold),var(--acc));z-index:99}
.grain{position:fixed;inset:0;z-index:98;pointer-events:none;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E")}
.btn{position:relative;overflow:hidden}
.btn::after{content:'';position:absolute;top:0;left:-80%;width:50%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:shine 4s ease-in-out infinite}
@keyframes shine{0%,60%{left:-80%}100%{left:160%}}
.rev-track{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.rev{background:var(--coal);border:1px solid var(--line);border-radius:16px;padding:22px}
.rev .stars{color:var(--gold);letter-spacing:3px;margin-bottom:10px}
.rev p{font-style:italic;line-height:1.65}
.rev b{display:block;margin-top:12px;font-family:Verdana,sans-serif;font-size:12px;color:var(--muted)}
.book{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
form{background:var(--coal);border:1px solid var(--line);border-radius:18px;padding:26px;display:grid;gap:12px}
label{font-family:Verdana,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
input,select{background:#000;border:1px solid rgba(255,255,255,.16);color:#fff;padding:12px 14px;border-radius:10px;font-size:14px;width:100%;outline:none}
.ok{display:none;background:rgba(0,200,120,.1);border:1px solid #00c878;color:#5fe8ab;padding:16px;border-radius:12px;font-size:14px}
.hours{background:var(--coal);border:1px solid var(--acc);border-radius:18px;padding:26px}
.hours h3{font-family:var(--font-d);margin-bottom:14px}
.hours li{list-style:none;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:14px;color:var(--muted);line-height:1.6}
footer{border-top:1px solid var(--line);padding:30px 26px;text-align:center;color:var(--muted);font-size:13px;font-family:Verdana,sans-serif}
.wa{position:fixed;right:20px;bottom:20px;z-index:55;width:58px;height:58px;border-radius:50%;background:#25d366;display:flex;align-items:center;justify-content:center;font-size:28px;text-decoration:none}
.reveal{opacity:0;transform:translateY(30px);transition:opacity .7s,transform .7s}
.reveal.in{opacity:1;transform:none}
.marquee{overflow:hidden;border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(0,0,0,.5)}
.marquee-track{display:inline-flex;white-space:nowrap;padding:11px 0;animation:mslide 24s linear infinite;font-size:11px;letter-spacing:4px;color:var(--gold);font-weight:700;font-family:Verdana,sans-serif}
@keyframes mslide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.orderbar{position:fixed;left:0;right:0;bottom:0;z-index:55;display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 14px;background:rgba(0,0,0,.85);backdrop-filter:blur(10px);border-top:1px solid var(--acc)}
.orderbar a{flex:1;max-width:420px;text-align:center;background:linear-gradient(180deg,var(--acc),var(--coal));border:1px solid var(--acc);color:#fff;text-decoration:none;font-family:Verdana,sans-serif;font-weight:bold;font-size:13px;padding:12px;border-radius:10px}
.mapframe{width:100%;height:280px;border:1px solid var(--line);border-radius:14px;margin-top:16px}
@media(max-width:760px){.links{display:none}.book{grid-template-columns:1fr}.nav{top:62px}}
</style>
</head>
<body>
<div class="progress" id="progress"></div>
<div class="grain" aria-hidden="true"></div>
<div class="demo-bar">⚡ WEB DEMO para ${esc(spec.business)} · <span data-countdown>Visible 24h</span> · ¿Te gusta? <a id="demoCta" href="#" style="color:#000"><b>Escríbenos por WhatsApp</b></a></div>
<nav class="nav">
  <div class="brand">${esc(spec.business.split(' ')[0].toUpperCase())}</div>
  <div class="links"><a href="#inicio">Inicio</a><a href="#s1">${esc(s.s1[0])}</a><a href="#s2">Fotos</a><a href="#s3">Contacto</a></div>
  <a class="btn" href="#s3">${esc(t.cta)}</a>
</nav>
<header class="hero" id="inicio">
  ${videoBg}
  <div class="hero-inner">
    <div class="open-pill open" data-open="8" data-close="21" data-open-msg="ABIERTO AHORA" data-closed-msg="CERRADO · VOLVEMOS PRONTO"><span class="dot"></span><span data-open-txt>ABIERTO AHORA</span></div>
    <div class="kicker">${esc(t.kicker)}</div>
    <h1>${esc(spec.business)}</h1>
    <p>${contact ? esc(contact) + ' · ' : ''}Te lo ponemos fácil: mira, toca y pide.</p>
    <div class="cta-row"><a class="btn" href="#s1">Ver más</a><a class="btn ghost" href="#s3">${esc(t.cta)}</a></div>
    <div class="badges"><div><b>✓</b>${contact ? esc(contact) : 'Pídenos los datos'}</div><div><b>24h</b>demo gratuita</div><div><b>★</b>hecha a medida</div></div>
  </div>
</header>
<script>addEventListener('scroll',function(){var h=document.documentElement,p=h.scrollTop/(h.scrollHeight-h.clientHeight)*100;document.getElementById('progress').style.width=p+'%'},{passive:true})</script>
  <div class="marquee" aria-hidden="true"><div class="marquee-track"><span>${(MARQUEE[spec.sector] || MARQUEE.negocio).map(w => esc(w) + ' ✦ ').join('').repeat(2)}</span><span>${(MARQUEE[spec.sector] || MARQUEE.negocio).map(w => esc(w) + ' ✦ ').join('').repeat(2)}</span></div></div>
<section id="s1">
  <div class="k">${esc(t.kicker)}</div>
  <h2>${esc(s.s1[0])}</h2>
  <p class="sub">${esc(s.s1[1])} Precios orientativos: los fijamos juntos con tu carta real.</p>
${items}
</section>
<section id="s2">
  <div class="k">ASÍ SE VE</div>
  <h2>Fotos</h2>
  <p class="sub">Fotos de muestra de tu sector. En tu web pondríamos las tuyas.</p>
  <div class="grid">
${gallery}
  </div>
</section>
<section id="s3">
  <div class="k">SIN LLAMAR, SIN ESPERAR</div>
  <h2>Contacto</h2>
  <p class="sub">Escríbenos y te contestamos. Sin compromiso.</p>
    <div class="book" style="margin-bottom:18px">
    <form data-lead data-wa-open data-wa-template="Hola {business}, soy {nombre} ({telefono}). Quiero: {personas} el {dia}.">
      <div><label>Nombre</label><input name="nombre" required placeholder="Tu nombre"></div>
      <div><label>Teléfono / WhatsApp</label><input name="telefono" required placeholder="600 123 456"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><label>Día</label><input name="dia" type="date"></div>
        <div><label>Personas / Pedido</label><input name="personas" placeholder="2 personas"></div>
      </div>
      <button class="btn" type="submit">Enviar por WhatsApp</button>
      <div class="ok" data-lead-ok>✓ ¡Enviado al WhatsApp del negocio! Te contestan enseguida.</div>
    </form>
    <div class="hours">
      <h3>${esc(spec.business)}</h3>
      <ul><li>${contact ? esc(contact) : 'Pídenos los datos por WhatsApp'}</li></ul>
      ${spec.address ? `<iframe class="mapframe" loading="lazy" title="Mapa" src="https://www.google.com/maps?q=${encodeURIComponent(spec.address)}&output=embed"></iframe>` : ''}
    </div>
  </div>
</section>
<footer>${esc(spec.business)}${contact ? ' · ' + esc(contact) : ''} · Demo de Noira · Visible 24h, luego se apaga sola</footer>
${bizWa ? `<div class="orderbar"><a data-wa-biz data-wa-text="Hola ${esc(spec.business)}, os escribo desde vuestra web." href="#">Pedir por WhatsApp</a></div>` : ''}
<a class="wa" id="waFloat" data-wa-biz data-wa-text="Hola ${esc(spec.business)}, he visto vuestra web y quiero información." href="#" aria-label="WhatsApp">✆</a>
<script src="/demo-assets/engine.js" data-slug="${spec.slug}"></script>
<script>${fxScript}</script>
</body>
</html>`;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'negocio';
}
