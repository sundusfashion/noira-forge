import fs from 'node:fs';
import path from 'node:path';

export interface DemoRecord {
  slug: string;
  business: string;
  createdAt: number;
  expiresAt: number | null; // null = escaparate permanente (nuestro portfolio)
  phone?: string;
}

const FILE = './data/demos.json';

function load(): Record<string, DemoRecord> {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return {}; }
}
function save(all: Record<string, DemoRecord>) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export function getDemo(slug: string): DemoRecord | null {
  return load()[slug] ?? null;
}

export function ensureShowcase(slug: string, business: string): DemoRecord {
  const all = load();
  if (!all[slug]) {
    all[slug] = { slug, business, createdAt: Date.now(), expiresAt: null };
    save(all);
  }
  return all[slug];
}

export function createDemo(slug: string, business: string, hours = 24, phone = ''): DemoRecord {
  const all = load();
  const rec: DemoRecord = { slug, business, createdAt: Date.now(), expiresAt: Date.now() + hours * 3600_000, phone };
  all[slug] = rec;
  save(all);
  return rec;
}

export function isExpired(rec: DemoRecord | null): boolean {
  if (!rec || rec.expiresAt === null) return false;
  return Date.now() > rec.expiresAt;
}

export function expiredPage(business: string): string {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Demo expirada — Noira</title><style>body{background:#0c0705;color:#f7ead7;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:20px}h1{font-family:Verdana,sans-serif;letter-spacing:2px}a{color:#e8b64c}</style></head><body><div><p style="letter-spacing:4px;font-size:12px;color:#e8b64c;font-family:Verdana">NOIRA</p><h1>Esta demo se apagó tras 24h.</h1><p>Era una prueba gratuita para <strong>${business.replace(/</g, '&lt;')}</strong>.</p><p>¿Quieres la tuya? <a href="https://noira-forge-entity.onrender.com/">Habla con Noira</a></p></div></body></html>`;
}
