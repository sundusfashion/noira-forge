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
    const abs = path.normalize(path.join(WEB_DIR, rel));
    if (!abs.startsWith(WEB_DIR)) return false;
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return false;
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
    res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://noira-forge-entity.onrender.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url></urlset>`);
    return;
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
function fatal(where: string, err: any) {
  console.error(`[FATAL:${where}]`, err?.stack || err);
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
