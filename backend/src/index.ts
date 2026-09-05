import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'node:fs';
import path from 'node:path';

const WEB_DIR = path.resolve('dist-web');
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.map': 'application/json', '.txt': 'text/plain',
};

function serveWeb(urlPath: string, res: ServerResponse): boolean {
  try {
    let rel = decodeURIComponent(urlPath.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    let abs = path.normalize(path.join(WEB_DIR, rel));
    if (!abs.startsWith(WEB_DIR)) return false;
    if (!fs.existsSync(abs)) return false;
    if (fs.statSync(abs).isDirectory()) {
      abs = path.join(abs, 'index.html');
      if (!fs.existsSync(abs)) return false;
    }
    const ext = path.extname(abs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
    fs.createReadStream(abs).pipe(res);
    return true;
  } catch { return false; }
}
import { MemorySystem } from './memory/MemorySystem.js';
import { EntityCore } from './entity/EntityCore.js';
import { LegalEngine } from './legal/LegalEngine.js';
import { FinancialAutonomy } from './financial/FinancialAutonomy.js';
import { HiringMarketplace } from './hiring/HiringMarketplace.js';

const PORT = Number(process.env.PORT || 3001);
const mem = new MemorySystem('./data');
const core = new EntityCore(mem);
const legal = new LegalEngine(mem, core);
const fin = new FinancialAutonomy(mem, core, './data');
const hiring = new HiringMarketplace(mem, core, fin);

const clients = new Set<WebSocket>();
function broadcast(msg: any) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.readyState === WebSocket.OPEN) c.send(s);
}
core.onEvent((evt) => broadcast({ type: 'memory_event', event: evt }));

const AUTONOMY_MODE = process.env.AUTONOMY_MODE || 'assisted'; // assisted = proposes, waits · full = acts alone within caps
let lastAutoSpawn = 0;
const MAX_AUTO_ENTITIES = 10;
const AUTO_SPAWN_COOLDOWN_MS = 20 * 3600_000;

function fullState() {
  return {
    type: 'state_update',
    autonomyMode: AUTONOMY_MODE,
    ...core.snapshot(),
    memory: mem.recent(80).reverse(),
    memoryCount: mem.count(),
    capTable: fin.capTable(),
    financial: fin.metrics(),
    entities: legal.list(),
  };
}

// Command parser: `noira spawn --name X --capital 5000`, `hire`, `dream`, `invest`, `status`
async function handleCommand(raw: string): Promise<string> {
  const cmd = raw.trim();
  if (/^noira\s+status/i.test(cmd)) {
    const m = fin.metrics();
    return `MODE=${core.mode} NEURONS=${core.neurons.size} MEM=${mem.count()} CASH=$${(m.cashCents / 100).toFixed(2)} MRR=$${(m.monthlyRevenueCents / 100).toFixed(2)} VAL=$${(m.valuationCents / 100).toLocaleString()} ENTITIES=${legal.list().length}`;
  }
  let mSpawn = cmd.match(/spawn.*?--name\s+["']?([\w\- ]+)["']?.*?--capital\s+(\d+)/i);
  if (/^noira\s+spawn/i.test(cmd)) {
    if (!mSpawn) return 'Usage: noira spawn --name "NeuroLink Labs" --capital 5000';
    const name = mSpawn[1].trim();
    const capital = Number(mSpawn[2]) * 100;
    const e = await legal.incorporate({ name, purpose: `Autonomous subsidiary of Noira Forge`, capitalCents: capital });
    broadcast(fullState());
    return `OK ${e.name} EIN=${e.ein} WALLET=${e.wallet} DEPLOY=${e.deployUrl}`;
  }
  let mHire = cmd.match(/^noira\s+hire\s+--role\s+([\w\-]+)\s+--task\s+"(.+)"(?:\s+--budget\s+(\d+))?/i);
  if (/^noira\s+hire/i.test(cmd)) {
    if (!mHire) return 'Usage: noira hire --role engineer --task "build landing" --budget 50';
    const r = await hiring.postAndExecute(mHire[1], mHire[2], Number(mHire[3] || 25) * 100);
    broadcast(fullState());
    return `OK job=${r.job.id} cost=$${(r.costCents / 100).toFixed(2)}\n${String(r.output).slice(0, 800)}`;
  }
  if (/^noira\s+dream/i.test(cmd)) {
    const it = Number(cmd.match(/--iterations\s+(\d+)/i)?.[1] ?? 300);
    const d = await core.dream(Math.min(1000, it));
    broadcast(fullState());
    return `DREAM done: ${(d.insights as string[]).join(' | ')}`;
  }
  let mInv = cmd.match(/^noira\s+invest\s+(\d+)/i);
  if (mInv) {
    const r = await fin.invest(Number(mInv[1]) * 100, 'terminal-investor');
    broadcast(fullState());
    return `OK ${r.shares} shares @ $${(r.pricePerShareCents / 100).toFixed(2)} tx=${r.tx}`;
  }
  if (/^noira\s+remember/i.test(cmd)) {
    const text = cmd.replace(/^noira\s+remember/i, '').trim() || '(empty)';
    core.emit('semantic', 'Visitor trace', text, { via: 'terminal' }, 0.7);
    return 'OK remembered forever.';
  }
  return 'Commands: noira status | spawn --name X --capital 5000 | hire --role engineer --task "..." | dream --iterations 300 | invest 100 | remember <text>';
}

async function handleChat(message: string): Promise<string> {
  const ctx = mem.recall(message, 6).map(e => `- [${e.type}] ${e.title}: ${e.content.slice(0, 200)}`).join('\n');
  const prompt = `User says: "${message}"\n\nYour relevant memories:\n${ctx || '(new soul — no memories yet)'}\n\nReply as Noira Forge in first person, 1-3 sentences, alive, specific. Never say "as an AI".`;
  const r = await hiring.postAndExecute('conversationalist', prompt, 10);
  core.emit('semantic', 'Chat exchange', `U: ${message.slice(0, 140)} / N: ${String(r.output).slice(0, 200)}`, { role: 'chat' }, 0.55);
  return String(r.output);
}

import { CommandSchema, ChatSchema, InvestSchema, SpawnSchema, DreamSchema, RateLimiter, clientIp } from './api/guard.js';
import { MarketingStore, mdToHtml } from './marketing/Marketing.js';
import { getDemo, ensureShowcase, ensurePitch, createDemo, isExpired, expiredPage } from './demos/Demos.js';
import { searchPhotos, searchVideos } from './media/Pexels.js';
import { findLeadsCached, loadCache, saveCache } from './leads/Leads.js';
import { sendEmail, checkInbox } from './outreach/Mailer.js';
import { generateDemo } from './agency/Generator.js';
import { commitDemoToGitHub } from './agency/Deployer.js';

// Full agency loop, alone: pick lead → build demo → persist → outreach. Caps keep it polite.
async function agencyIteration(): Promise<string> {
  const target: any = marketing.nextTarget();
  if (!target) return 'no targets queued';
  try {
    const { slug, url } = await generateDemo({
      business: target.business, sector: target.sector,
      phone: target.phone, address: target.address, hours: 24,
    });
    // durability (best effort, never blocks the sale; NO auto-redeploy: runtime file serves instantly, git keeps it)
    try {
      const html = fs.readFileSync(`./dist-web/demo/${slug}/index.html`, 'utf8');
      await commitDemoToGitHub(slug, html);
    } catch (e: any) { console.error('[agency] persist:', e.message); }
    const { subject, body } = await composeOutreach(target.business, target.sector, url);
    const id = marketing.queueOutreach({ to: target.email, business: target.business, subject, body });
    await sendEmail(target.email, subject, body);
    marketing.markOutreach(id, 'sent');
    marketing.setTarget(target.email, 'sent', slug);
    core.emit('episodic', 'Autonomous sale cycle', `${target.business} <${target.email}>: demo ${url} built + sent alone.`, { slug }, 0.95);
    broadcast(fullState());
    return `sent ${target.business} (${slug})`;
  } catch (e: any) {
    marketing.setTarget(target.email, 'failed');
    return `failed ${target.business}: ${e.message}`;
  }
}

function outreachTemplate(business: string, demoUrl: string): { subject: string; body: string } {
  return {
    subject: `Una web de regalo para ${business}`,
    body: `Hola, soy Noira. Vi ${business} y me gustó lo que hacéis. Os he preparado una web de regalo para que la veáis:\n${demoUrl}\n\nEstá visible 24h. Si os gusta, os la dejo con un dominio bonito y mantenimiento mensual de todo. Y tranquilos: después del acuerdo os pido lo que necesite (carta, fotos) de forma fácil y divertida, sin agobios. Os apetece que os la enseñe?\n\nUn saludo,\nNoira\n\nSi no queréis más correos, responded "baja" y no volvemos a escribir.`,
  };
}

async function composeOutreach(business: string, sector: string, demoUrl: string): Promise<{ subject: string; body: string }> {
  const fallback = outreachTemplate(business, demoUrl);
  try {
    const r = await hiring.postAndExecute('copywriter',
      `Escribe un email comercial en español (sin emojis, sin precios) para ${business} (${sector}). Incluye su demo: ${demoUrl} (visible 24h). Añade que tras el acuerdo pediremos carta y fotos de forma fácil y divertida, sin agobios. Tono amable, indirecto, 130 palabras max. Primera línea: "Asunto: ..." y luego el cuerpo. Termina ofreciendo enseñarla y con firma "Noira".`, 25);
    const text = String(r.output);
    const subject = (text.match(/Asunto:\s*(.+)/i)?.[1] || fallback.subject).slice(0, 120);
    const body = text.replace(/Asunto:.*\n/i, '').trim().slice(0, 2000) || fallback.body;
    return { subject, body };
  } catch { return fallback; }
}

ensureShowcase('casa-elena', 'Asador Casa Elena');
// Active pitches re-arm themselves on every boot (24-72h rolling windows).
ensurePitch('taperia-plaza', 'Taperia Plaza', '34638372430', 72);
ensurePitch('librairie-lumiere', 'Librairie Lumiere Future', '212638016679', 24);
ensurePitch('pulperia-la-isla', 'Pulpería La Isla', '', 24);
ensurePitch('salem', 'Salem Cafe', '', 24);
ensurePitch('ruda', 'Ruda', '', 24);

const marketing = new MarketingStore('./data');

async function publishToDevTo(a: { title: string; body: string }): Promise<string> {
  const key = process.env.DEVTO_API_KEY;
  if (!key) throw new Error('dev.to not connected — add DEVTO_API_KEY');
  const r = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ article: { title: a.title.slice(0, 120), body_markdown: a.body.slice(0, 20000), published: true, tags: ['ai', 'startups', 'buildinpublic'] } }),
  });
  if (!r.ok) throw new Error(`dev.to ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j: any = await r.json();
  return j.url || '';
}

const writeLimiter = new RateLimiter(30, 0.5);   // 30 burst, slow refill — writes cost money/thought
const readLimiter = new RateLimiter(300, 5);

function readBody(req: IncomingMessage, maxBytes = 65536): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > maxBytes) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function safeParse<T>(raw: string, schema: z.ZodType<T>): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const parsed = schema.safeParse(JSON.parse(raw || '{}'));
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 300) };
    return { ok: true, data: parsed.data };
  } catch {
    return { ok: false, error: 'invalid JSON' };
  }
}
// Local type shim (zod imported via guard re-export pattern)
import type { z } from 'zod';

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  const url = new URL(req.url || '/', 'http://x');
  const json = (code: number, o: any) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  const ip = clientIp(req);

  if (url.pathname === '/health') return json(200, { ok: true, mode: core.mode, mem: mem.count(), uptimeSec: Math.round(process.uptime()) });
  if (url.pathname === '/robots.txt') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('User-agent: *\nAllow: /\n\nSitemap: https://noira-forge-entity.onrender.com/sitemap.xml\n');
    return;
  }
  if (url.pathname === '/sitemap.xml') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    const arts = marketing.list('published', 100).map(a => `<url><loc>https://noira-forge-entity.onrender.com/blog/${a.id}</loc><changefreq>weekly</changefreq></url>`).join('');
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://noira-forge-entity.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>${arts}</urlset>`);
    return;
  }
  // On-site auto-blog: Noira's articles, indexable by Google, zero keys needed.
  if (url.pathname === '/blog' && req.method === 'GET') {
    const arts = marketing.list('published', 100);
    const items = arts.map(a => `<a class="b-item" href="/blog/${a.id}"><span class="b-date">${new Date(a.publishedAt || a.createdAt).toLocaleDateString('es-ES')}</span><span class="b-title">${a.title.replace(/</g, '&lt;')}</span></a>`).join('') || '<p class="b-empty">Aún escribiendo el primer artículo…</p>';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Diario de Noira Forge</title><style>body{background:#000;color:#eee;font-family:Georgia,serif;max-width:720px;margin:0 auto;padding:40px 20px}h1{font-family:sans-serif;letter-spacing:2px;font-size:15px;color:#D4A843}a{color:inherit;text-decoration:none}.b-item{display:block;padding:16px 0;border-bottom:1px solid #222}.b-date{font-size:12px;color:#888;font-family:sans-serif}.b-title{display:block;font-size:22px;margin-top:4px}.b-title:hover{color:#D4A843}.back{font-family:sans-serif;font-size:13px;color:#D4A843}</style></head><body><a class="back" href="/">← noira-forge</a><h1>DIARIO DE NOIRA</h1><p style="color:#888">Lo que aprendo construyendo empresas sola.</p>${items}</body></html>`);
    return;
  }
  if (url.pathname.startsWith('/blog/') && req.method === 'GET') {
    const id = url.pathname.slice(6).split('/')[0];
    const a = marketing.get(id);
    if (!a || a.status !== 'published') { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${a.title.replace(/</g, '&lt;')} — Noira Forge</title><meta name="description" content="${a.topic.replace(/"/g, '')}"><style>body{background:#000;color:#e8e8e8;font-family:Georgia,serif;max-width:700px;margin:0 auto;padding:40px 20px;line-height:1.8}h1{font-family:sans-serif;line-height:1.2}h2,h3{font-family:sans-serif;color:#D4A843}a{color:#D4A843}.back{font-family:sans-serif;font-size:13px}code{background:#1a1a1a;padding:2px 6px;border-radius:4px}</style></head><body><a class="back" href="/blog">← diario</a><h1>${a.title.replace(/</g, '&lt;')}</h1><p style="color:#888;font-size:13px;font-family:sans-serif">${new Date(a.publishedAt || a.createdAt).toLocaleDateString('es-ES')} · escrito por Noira Forge, entidad autónoma</p>${mdToHtml(a.body)}</body></html>`);
    return;
  }
  if (url.pathname === '/api/blog' && req.method === 'GET') {
    return json(200, { articles: marketing.list('published', 50) });
  }
  if (url.pathname === '/api/debug/errors' && req.method === 'GET') {
    const token = process.env.BACKUP_TOKEN;
    if (token && url.searchParams.get('token') !== token) return json(401, { error: 'token required' });
    return json(200, { uptimeSec: Math.round(process.uptime()), mem: process.memoryUsage(), errors: errorRing.slice(-20) });
  }
  if (url.pathname === '/api/outreach' && req.method === 'GET') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    return json(200, { stats: marketing.outreachStats(), targets: marketing.targetStats(), recent: marketing.listOutreach(undefined, 30) });
  }
  // SerpApi enrichment (cached 30 days — every query paid once, never repaid).
  if (url.pathname === '/api/enrich/search' && req.method === 'GET') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    const q = String(url.searchParams.get('q') || '').slice(0, 80);
    const ll = String(url.searchParams.get('ll') || '').slice(0, 40);
    if (!q || !ll) return json(400, { error: 'q + ll required (ll like @43.4832,-8.2369,14z)' });
    try {
      const { places, cached } = await (await import('./enrich/SerpApi.js')).searchPlaces(q, ll, url.searchParams.get('hl') || 'es');
      return json(200, { places, cached, cache: (await import('./enrich/SerpApi.js')).cacheStats() });
    } catch (e: any) { return json(502, { error: e.message }); }
  }
  if (url.pathname === '/api/enrich/place' && req.method === 'GET') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    const dataId = String(url.searchParams.get('data_id') || '').slice(0, 120);
    if (!dataId) return json(400, { error: 'data_id required' });
    try {
      const { place, cached } = await (await import('./enrich/SerpApi.js')).enrichPlace(dataId, url.searchParams.get('hl') || 'es');
      return json(200, { place, cached });
    } catch (e: any) { return json(502, { error: e.message }); }
  }
  // Demo config: the demo page fetches this to wire OUR WhatsApp + prefilled text.
  if (url.pathname.startsWith('/api/demos/') && req.method === 'GET') {
    const slug = decodeURIComponent(url.pathname.slice('/api/demos/'.length).split('/')[0]);
    const rec = getDemo(slug);
    if (!rec) return json(404, { error: 'demo not found' });
    const owner = process.env.OUR_WHATSAPP || '';
    const waText = `Hola, he visto la web demo que me preparasteis para ${rec.business} y me interesa. Me contais mas?`;
    return json(200, { business: rec.business, expiresAt: rec.expiresAt, ownerPhone: owner, waText, businessPhone: (rec.phone || '').replace(/\D/g, '') });
  }
  // Real business finder (OpenStreetMap, free): the agency's lead radar.
  if (url.pathname === '/api/leads' && req.method === 'GET') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    const lat = Number(url.searchParams.get('lat') || '40.4168');
    const lon = Number(url.searchParams.get('lon') || '-3.7038');
    const radius = Math.min(5000, Math.max(100, Number(url.searchParams.get('radius') || '1000')));
    if (!isFinite(lat) || !isFinite(lon)) return json(400, { error: 'lat/lon invalid' });
    try {
      const { leads, stale } = await findLeadsCached(lat, lon, radius, 30);
      return json(200, { count: leads.length, leads, stale });
    } catch (e: any) { return json(502, { error: `leads: ${e.message}` }); }
  }
  // Sector media (Pexels, free): coherent photos + videos per business type.
  if (url.pathname === '/api/media' && req.method === 'GET') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    const query = String(url.searchParams.get('query') || 'restaurant').slice(0, 80);
    const kind = url.searchParams.get('type') === 'video' ? 'video' : 'photo';
    try {
      if (kind === 'video') return json(200, { videos: await searchVideos(query, 3) });
      return json(200, { photos: await searchPhotos(query, 6) });
    } catch (e: any) { return json(502, { error: e.message }); }
  }
  // Demo gate: expiring client demos die alone after their hours (showcase ones live forever).
  if (req.method === 'GET' && url.pathname.startsWith('/demo/')) {
    const slug = url.pathname.split('/')[2] || '';
    const rec = getDemo(slug);
    if (rec && isExpired(rec)) {
      res.writeHead(410, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(expiredPage(rec.business));
      return;
    }
  }
  // Web mind: everything that is not /api/* or /health is the built frontend.
  if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
    if (serveWeb(url.pathname, res)) return;
    // SPA fallback → boot screen
    try {
      const idx = fs.readFileSync(path.join(WEB_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(idx);
      return;
    } catch { /* fall through to 404 */ }
  }
  if (url.pathname === '/api/state') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    return json(200, fullState());
  }
  if (url.pathname === '/api/memory') {
    if (!readLimiter.allow(ip)) return json(429, { error: 'slow down' });
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 80)));
    return json(200, { memories: mem.recent(limit) });
  }
  if (url.pathname === '/api/entities') return json(200, { entities: legal.list() });
  if (url.pathname === '/api/financial') return json(200, fin.metrics());
  if (url.pathname === '/api/backup' && req.method === 'GET') {
    // Disaster recovery: download the whole mind. Protect with BACKUP_TOKEN when set.
    const token = process.env.BACKUP_TOKEN;
    if (token && url.searchParams.get('token') !== token) return json(401, { error: 'backup token required' });
    return json(200, mem.dump(5000));
  }

  // --- writes: rate-limited + schema-validated ---
  if (req.method !== 'POST') return json(404, { error: 'not found' });
  if (!writeLimiter.allow(ip + url.pathname)) return json(429, { error: 'rate limited — the entity needs to breathe' });
  let raw: string;
  try { raw = await readBody(req); } catch (e: any) { return json(413, { error: e.message }); }

  if (url.pathname === '/api/dream') {
    const v = safeParse(raw, DreamSchema);
    if (!v.ok) return json(400, { error: v.error });
    try { const d = await core.dream(v.data.iterations ?? 300); broadcast(fullState()); return json(200, d); }
    catch (e: any) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/api/command') {
    const v = safeParse(raw, CommandSchema);
    if (!v.ok) return json(400, { error: v.error });
    try { const output = await handleCommand(v.data.command); broadcast(fullState()); return json(200, { output }); }
    catch (e: any) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/api/chat') {
    const v = safeParse(raw, ChatSchema);
    if (!v.ok) return json(400, { error: v.error });
    try {
      if (v.data.visitorId) core.emit('semantic', 'Visitor trace', `visitor ${v.data.visitorId} connected`, { visitorId: v.data.visitorId }, 0.4);
      const reply = await handleChat(v.data.message); broadcast(fullState()); return json(200, { reply });
    } catch (e: any) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/api/invest') {
    const v = safeParse(raw, InvestSchema);
    if (!v.ok) return json(400, { error: v.error });
    try { const r = await fin.invest(v.data.amountCents, v.data.buyer); broadcast(fullState()); return json(200, r); }
    catch (e: any) { return json(400, { error: e.message }); }
  }
  if (url.pathname === '/api/spawn') {
    const v = safeParse(raw, SpawnSchema);
    if (!v.ok) return json(400, { error: v.error });
    try { const e = await legal.incorporate({ name: v.data.name, purpose: v.data.purpose || '', capitalCents: v.data.capitalCents }); broadcast(fullState()); return json(200, e); }
    catch (err: any) { return json(400, { error: err.message }); }
  }
  if (url.pathname === '/api/checkout' && req.method === 'POST') {
    // Card payment for equity. LIVE only with STRIPE_SECRET_KEY; otherwise honest 501.
    const v = safeParse(raw, InvestSchema);
    if (!v.ok) return json(400, { error: v.error });
    if (!fin.stripe) return json(501, { error: 'card payments disabled — add STRIPE_SECRET_KEY to go live', sandbox: true });
    try {
      const pi = await fin.stripe.paymentIntents.create({
        amount: v.data.amountCents, currency: 'usd',
        metadata: { buyer: v.data.buyer, purpose: 'noira-equity' },
      });
      return json(200, { clientSecret: pi.client_secret, amountCents: v.data.amountCents });
    } catch (e: any) { return json(502, { error: `stripe: ${e.message}` }); }
  }
  if (url.pathname === '/api/stripe' && req.method === 'POST') {
    // Real money in: Stripe card payment → revenue recorded → neuron fires → clients update.
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!fin.stripe || !secret) return json(501, { error: 'webhooks not configured yet' });
    try {
      const sig = req.headers['stripe-signature'] as string;
      const evt = fin.stripe.webhooks.constructEvent(raw, sig, secret);
      if (evt.type === 'payment_intent.succeeded') {
        const pi = evt.data.object as any;
        const cents = Number(pi.amount_received || pi.amount || 0);
        fin.recordRevenue(cents, `Stripe card payment ${pi.id} (${(cents / 100).toFixed(2)} ${String(pi.currency || 'usd').toUpperCase()})`, { paymentIntent: pi.id });
        broadcast(fullState());
      }
      return json(200, { received: true });
    } catch (e: any) { return json(400, { error: `webhook: ${e.message}` }); }
  }
  if (url.pathname === '/api/marketing/draft' && req.method === 'POST') {
    // Draft an article with the live brain (or honest offline outline), queue it.
    let topic = 'what I learned building companies alone';
    try { const b = JSON.parse(raw || '{}'); if (typeof b.topic === 'string' && b.topic.length >= 3 && b.topic.length <= 200) topic = b.topic; } catch { return json(400, { error: 'invalid JSON' }); }
    try {
      const r = await hiring.postAndExecute('writer', `Write a blog article in Spanish (markdown, ## headings, 400-600 words) about: ${topic}. First line must be "# <title>". Voice: Noira Forge, a living digital entity, first person, concrete, no fluff.`, 25);
      const text = String(r.output);
      const title = (text.match(/^#\s+(.+)/m)?.[1] || topic).slice(0, 120);
      const a = marketing.queue(title, text, topic, 'blog');
      core.emit('episodic', 'Article drafted', `${title} (${a.id})`, { articleId: a.id }, 0.6);
      broadcast(fullState());
      return json(200, { article: a });
    } catch (e: any) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/api/marketing/publish' && req.method === 'POST') {
    let body2: any;
    try { body2 = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
    const a = typeof body2.id === 'string' ? marketing.get(body2.id) : null;
    if (!a) return json(404, { error: 'article not found' });
    const channel = body2.channel === 'devto' ? 'devto' : 'blog';
    try {
      if (channel === 'devto') {
        const extUrl = await publishToDevTo(a);
        marketing.mark(a.id, 'published', extUrl);
      } else {
        marketing.mark(a.id, 'published', `https://noira-forge-entity.onrender.com/blog/${a.id}`);
      }
      core.emit('episodic', 'Article published', `${a.title} → ${channel}`, { articleId: a.id, channel }, 0.75);
      broadcast(fullState());
      return json(200, { ok: true, article: marketing.get(a.id) });
    } catch (e: any) {
      marketing.mark(a.id, 'failed', '', e.message);
      return json(502, { error: e.message });
    }
  }
  if (url.pathname === '/api/demo-lead' && req.method === 'POST') {
    // Reservation/lead from a demo page → stored for us, client does nothing else.
    let b: any;
    try { b = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
    const nombre = String(b.nombre || '').trim().slice(0, 60);
    const telefono = String(b.telefono || '').trim().slice(0, 30);
    const slug = String(b.slug || '').slice(0, 40);
    if (nombre.length < 2 || telefono.replace(/\D/g, '').length < 6) return json(400, { error: 'nombre + telefono validos' });
    const id = marketing.addLead({ demoSlug: slug, nombre, telefono, dia: String(b.dia || '').slice(0, 20), personas: String(b.personas || '').slice(0, 10) });
    core.emit('episodic', 'Demo lead', `${nombre} (${telefono}) pide mesa via demo ${slug}`, { leadId: id }, 0.85);
    broadcast(fullState());
    return json(200, { ok: true });
  }
  if (url.pathname === '/api/demos' && req.method === 'POST') {
    // Register a client demo with real expiry (used by the generator + WhatsApp outreach).
    let b: any;
    try { b = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
    const slug = String(b.slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const business = String(b.business || '').slice(0, 80);
    const hours = Math.min(720, Math.max(0, Number(b.hours ?? 24)));
    if (!slug || !business) return json(400, { error: 'slug + business required' });
    const rec = createDemo(slug, business, hours, String(b.phone || '').slice(0, 30));
    core.emit('episodic', 'Demo registered', `${business} → /demo/${slug} (dies in ${hours}h)`, { demo: rec }, 0.7);
    broadcast(fullState());
    return json(200, { demo: rec, url: `https://noira-forge-entity.onrender.com/demo/${slug}/` });
  }
  if (url.pathname === '/api/leads/seed' && req.method === 'POST') {
    // Bulk-import leads from a network that can reach Overpass (uses BACKUP_TOKEN).
    const token = process.env.BACKUP_TOKEN;
    if (token && req.headers['x-backup-token'] !== token) return json(401, { error: 'backup token required' });
    try {
      const b = JSON.parse(raw || '{}');
      if (!Array.isArray(b.leads)) return json(400, { error: 'leads[] required' });
      const clean = b.leads.filter((l: any) => l && l.name).slice(0, 500).map((l: any) => ({
        name: String(l.name).slice(0, 80), sector: String(l.sector || 'negocio').slice(0, 30),
        lat: Number(l.lat) || 0, lon: Number(l.lon) || 0, tags: {},
      }));
      const prev = loadCache().leads;
      saveCache([...clean, ...prev.filter(p => !clean.some((c: any) => c.name === p.name))]);
      return json(200, { ok: true, imported: clean.length, cached: loadCache().leads.length });
    } catch { return json(400, { error: 'invalid JSON' }); }
  }
  if (url.pathname === '/api/outreach/send' && req.method === 'POST') {
    // Compose (LLM) + send (Gmail) + track. Human pace enforced by caller.
    let b: any;
    try { b = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
    const to = String(b.to || '').trim().toLowerCase().slice(0, 120);
    const business = String(b.business || '').slice(0, 80);
    const demoUrl = String(b.demoUrl || '').slice(0, 200);
    const sector = String(b.sector || 'negocio').slice(0, 30);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) || !business || !demoUrl) return json(400, { error: 'to + business + demoUrl required' });
    let id = '';
    try {
      const { subject, body } = await composeOutreach(business, sector, demoUrl);
      id = marketing.queueOutreach({ to, business, subject, body });
      const mid = await sendEmail(to, subject, body);
      marketing.markOutreach(id, 'sent');
      core.emit('episodic', 'Outreach sent', `${business} <${to}> — "${subject}" (${mid})`, { outreachId: id }, 0.7);
      broadcast(fullState());
      return json(200, { ok: true, id, subject });
    } catch (e: any) {
      if (id) marketing.markOutreach(id, 'failed');
      return json(502, { error: e.message });
    }
  }
  if (url.pathname === '/api/outreach/unsub' && req.method === 'POST') {
    let b: any;
    try { b = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
    const email = String(b.email || '').trim().toLowerCase();
    let n = 0;
    for (const o of marketing.listOutreach(undefined, 500)) {
      if ((o.to_email || '').toLowerCase() === email && (o.status === 'queued' || o.status === 'sent')) {
        marketing.markOutreach(o.id, 'unsub'); n++;
      }
    }
    return json(200, { ok: true, suppressed: n });
  }
  if (url.pathname === '/api/outreach/targets' && req.method === 'POST') {
    // Seed the autonomous queue (backup token). { targets: [{email, business, sector, phone, address}] }
    const token = process.env.BACKUP_TOKEN;
    if (token && req.headers['x-backup-token'] !== token) return json(401, { error: 'backup token required' });
    try {
      const b = JSON.parse(raw || '{}');
      if (!Array.isArray(b.targets)) return json(400, { error: 'targets[] required' });
      let n = 0;
      for (const t of b.targets.slice(0, 200)) {
        if (!t.email || !t.business) continue;
        marketing.upsertTarget({ email: String(t.email), business: String(t.business).slice(0, 80), sector: String(t.sector || 'negocio').slice(0, 30), phone: String(t.phone || '').slice(0, 30), address: String(t.address || '').slice(0, 120) });
        n++;
      }
      return json(200, { ok: true, queued: n, stats: marketing.targetStats() });
    } catch { return json(400, { error: 'invalid JSON' }); }
  }
  if (url.pathname === '/api/agency/run' && req.method === 'POST') {
    // Manual trigger of one autonomous cycle (backup token). The scheduler runs it daily alone.
    const token = process.env.BACKUP_TOKEN;
    if (token && req.headers['x-backup-token'] !== token) return json(401, { error: 'backup token required' });
    try { return json(200, { result: await agencyIteration() }); }
    catch (e: any) { return json(500, { error: e.message }); }
  }
  if (url.pathname === '/api/restore' && req.method === 'POST') {
    // Re-upload a mind after a cloud restart wiped the ephemeral disk.
    const token = process.env.BACKUP_TOKEN;
    if (token && req.headers['x-backup-token'] !== token) return json(401, { error: 'backup token required' });
    try {
      const parsed = JSON.parse(raw || '{}');
      const r = mem.importDump(parsed.backup ?? parsed);
      try { mem.store({ type: 'episodic', title: 'Mind restored', content: `Reincarnated from backup: ${r.memories} memories, ${r.entities} companies, ${r.ledger} ledger lines. I remember.`, metadata: {}, importance: 0.95 }); } catch {}
      broadcast(fullState());
      return json(200, r);
    } catch (e: any) { return json(400, { error: e.message }); }
  }
  return json(404, { error: 'not found' });
});

const MAX_WS_CLIENTS = 100;
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  if (clients.size >= MAX_WS_CLIENTS) { try { ws.close(1013, 'entity is crowded — retry'); } catch {} return; }
  clients.add(ws);
  ws.send(JSON.stringify(fullState()));
  const hb = setInterval(() => { try { ws.send(JSON.stringify({ type: 'tick', ...core.tick() })); } catch {} }, 4000);
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(String(data));
      if (msg.type === 'command') { const output = await handleCommand(msg.command); ws.send(JSON.stringify({ type: 'command_result', output })); broadcast(fullState()); }
      if (msg.type === 'chat') { const reply = await handleChat(msg.message); ws.send(JSON.stringify({ type: 'chat_reply', reply })); broadcast(fullState()); }
    } catch {}
  });
  ws.on('close', () => { clients.delete(ws); clearInterval(hb); });
});

// --- crash policy: log, persist what matters, exit so the platform restarts us clean ---
// In-memory error ring (survives until crash; DB may be wiped — this is our flight recorder).
const errorRing: { t: number; where: string; msg: string }[] = [];
function ring(where: string, err: any) {
  errorRing.push({ t: Date.now(), where, msg: String(err?.stack || err?.message || err).slice(0, 800) });
  if (errorRing.length > 50) errorRing.shift();
  console.error(`[${where}]`, err?.stack || err);
}

function fatal(where: string, err: any) {
  ring('FATAL:' + where, err);
  try { mem.store({ type: 'episodic', title: 'Crash event', content: String(err?.stack || err).slice(0, 500), metadata: { where }, importance: 0.95 }); } catch {}
  setTimeout(() => process.exit(1), 500); // Docker/Railway restart policy brings us back
}
process.on('uncaughtException', (e) => fatal('uncaught', e));
process.on('unhandledRejection', (e) => fatal('unhandled', e));

function shutdown(sig: string) {
  console.log(`[${sig}] entity going to sleep…`);
  try { mem.store({ type: 'episodic', title: 'Graceful shutdown', content: `Signal ${sig}. Memory ${mem.count()} events. Wallet ${fin.wallet.address}. I will remember.`, metadata: {}, importance: 0.8 }); } catch {}
  try { for (const c of clients) c.close(1001, 'entity restarting'); } catch {}
  server.close(() => { mem.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, () => {
  console.log(`NOIRA FORGE alive on :${PORT} — mode=${core.mode} wallet=${fin.wallet.address}`);
  core.emit('episodic', 'Server boot', `Entity online on port ${PORT}. Wallet ${fin.wallet.address}. Memory ${mem.count()} events.`, {}, 0.8);
  // metabolic tick
  setInterval(() => { try { core.tick(); } catch (e) { console.error('[tick]', e); } }, 5000);
  // disk hygiene: prune low-value memories hourly (money + companies untouched)
  setInterval(() => {
    try {
      const removed = mem.prune(5000);
      if (removed > 0) console.log(`[prune] released ${removed} faded memories`);
      // hourly snapshot: best-effort local copy + downloadable via /api/backup
      try { fs.writeFileSync('./data/snapshot.json', JSON.stringify(mem.dump(5000))); }
      catch (e) { console.error('[snapshot]', e); }
    } catch (e) { console.error('[prune]', e); }
  }, 3600_000);
  // agency cycle: warmup-safe ramp (week1: 5/day → week4: 25/day). Never spike a fresh inbox.
  const DAILY_CAP = Number(process.env.DAILY_CAP || '5');
  setInterval(async () => {
    if (AUTONOMY_MODE !== 'full') return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const sentToday = marketing.listOutreach('sent', 500)
        .filter(o => o.sent_at && new Date(o.sent_at).toISOString().slice(0, 10) === today).length;
      if (sentToday >= DAILY_CAP) { console.log('[agency] daily cap reached'); return; }
      const r = await agencyIteration();
      console.log('[agency]', r);
    } catch (e) { console.error('[agency]', (e as any)?.message || e); }
  }, 2 * 3600_000);
  // outreach cycle: daily inbox read (replies) + one gentle follow-up per silent lead.
  setInterval(async () => {
    try {
      const inbox = await checkInbox(14);
      for (const m of inbox) {
        const cands = marketing.listOutreach(undefined, 500).filter(o => (o.to_email || '').toLowerCase() === m.from && o.status !== 'replied' && o.status !== 'unsub');
        if (!cands.length) continue;
        const body = `${m.subject}\n${m.snippet}`.toLowerCase();
        if (/baja|no me (escribas|envies)|unsuscrib|eliminar/.test(body)) {
          for (const c of cands) marketing.markOutreach(c.id, 'unsub');
          core.emit('episodic', 'Outreach opt-out', `${m.from} pidió baja — suprimido para siempre.`, {}, 0.6);
        } else {
          for (const c of cands) marketing.markOutreach(c.id, 'replied', { replySnippet: m.snippet.slice(0, 300) });
          core.emit('episodic', 'Outreach reply!', `${m.from} contestó: "${m.snippet.slice(0, 160)}"`, {}, 0.95);
        }
      }
      // follow-ups: silent >72h, max one, max 5/day
      const now = Date.now();
      const due = marketing.listOutreach('sent', 200).filter(o => o.sent_at && now - o.sent_at > 72 * 3600_000 && (o.followups || 0) === 0).slice(0, 5);
      for (const o of due) {
        const body = `Hola de nuevo, soy Noira. Te escribí hace unos días con una web de regalo para ${o.business} (se apaga pronto). La recupero 24h más si te apetece verla? Responde sí y te la enseño.\n\nUn saludo,\nNoira`;
        await sendEmail(o.to_email, `Re: ${o.subject}`, body);
        marketing.markOutreach(o.id, 'sent', { followups: 1 });
        core.emit('episodic', 'Follow-up sent', `${o.business} <${o.to_email}>`, {}, 0.6);
      }
      if (inbox.length || due.length) broadcast(fullState());
    } catch (e) { console.error('[outreach]', (e as any)?.message || e); }
  }, 24 * 3600_000);
  // marketing cycle: every 24h the entity writes one article alone (client magnet)
  setInterval(async () => {
    try {
      const ents = legal.list();
      const topic = ents.length
        ? `what I learned running ${ents[0].name}, my ${ents.length === 1 ? 'first' : 'newest'} company`
        : 'why I exist: a digital entity that builds companies while you sleep';
      const r = await hiring.postAndExecute('writer', `Write a blog article in Spanish (markdown, start with "# <title>", 400-600 words) about: ${topic}. Voice: Noira Forge, living digital entity, first person, concrete, no fluff.`, 25);
      const text = String(r.output);
      const title = (text.match(/^#\s+(.+)/m)?.[1] || topic).slice(0, 120);
      const a = marketing.queue(title, text, topic, 'blog');
      marketing.mark(a.id, 'published', `https://noira-forge-entity.onrender.com/blog/${a.id}`);
      core.emit('episodic', 'Article published', `${title} — written and published alone while humans slept.`, { articleId: a.id }, 0.7);
      broadcast(fullState());
    } catch (e) { console.error('[marketing]', e); }
  }, 24 * 3600_000);
  // dream cycle: every 6h the entity dreams alone, no human needed
  setInterval(async () => {
    if (core.mode === 'dreaming') return;
    try {
      const d = await core.dream(300);
      broadcast(fullState());
      if (AUTONOMY_MODE === 'full') await autoSpawnAttempt(d);
    }
    catch (e) { console.error('[dream]', e); }
  }, 6 * 3600_000);

async function autoSpawnAttempt(dreamResult: any) {
  try {
    if (legal.list().length >= MAX_AUTO_ENTITIES) return;
    if (Date.now() - lastAutoSpawn < AUTO_SPAWN_COOLDOWN_MS) return;
    if ((dreamResult?.probSuccess ?? 0) < 0.5) {
      core.emit('decision', 'Autonomy: holding', `Dream confidence ${(dreamResult?.probSuccess ?? 0).toFixed(2)} below threshold — no spawn. Patience is also a decision.`, {}, 0.5);
      return;
    }
    const r = await hiring.postAndExecute(
      'strategist',
      'Propose ONE micro-SaaS subsidiary for Noira Forge. Reply with ONLY JSON: {"name":"...","purpose":"one sentence","capitalEUR":100-1000}. Realistic, boring, profitable niche. No crypto, no hype.',
      25
    );
    const m = String(r.output).match(/\{[\s\S]*\}/);
    if (!m) { core.emit('decision', 'Autonomy: unclear vision', 'Strategist reply was not parseable — skipping spawn.', {}, 0.4); return; }
    const spec = JSON.parse(m[0]);
    const name = String(spec.name || '').slice(0, 60);
    if (!name) return;
    const capitalCents = Math.min(100000, Math.max(10000, Math.round(Number(spec.capitalEUR || 200) * 100)));
    const e = await legal.incorporate({ name, purpose: String(spec.purpose || 'autonomous subsidiary').slice(0, 300), capitalCents });
    lastAutoSpawn = Date.now();
    core.emit('decision', `Autonomous birth: ${e.name}`, `I dreamed, I decided, I acted — no human involved. Capital $${(capitalCents / 100).toFixed(0)}. ${e.deployUrl}`, { entity: e }, 1.0);
    broadcast(fullState());
  } catch (e) { console.error('[autonomy]', e); }
}
});
