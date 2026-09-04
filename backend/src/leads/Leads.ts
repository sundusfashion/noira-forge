// Lead finder: real nearby businesses via OpenStreetMap (Overpass API).
// Free, no key, no scraping against ToS. Categories mapped to our sectors.
export interface Lead {
  name: string;
  sector: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

const SECTOR_MAP: [RegExp, string][] = [
  [/restaurant|fast_food|bar|cafe|ice_cream/i, 'restaurante'],
  [/hairdresser|beauty|barber|nails|spa|massage/i, 'peluqueria'],
  [/car_repair|car_wash|fuel|car_parts/i, 'taller'],
  [/dentist|doctors|clinic|physiotherapist|pharmacy|veterinary/i, 'clinica'],
  [/clothes|shoes|jewelry|gift|florist|books|bakery/i, 'tienda'],
  [/gym|fitness|yoga|dance/i, 'gimnasio'],
];

export function sectorOf(tags: Record<string, string>): string {
  const hay = `${tags.shop || ''} ${tags.amenity || ''} ${tags.craft || ''} ${tags.leisure || ''}`;
  for (const [re, sector] of SECTOR_MAP) if (re.test(hay)) return sector;
  return 'negocio';
}

import fs from 'node:fs';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

const CACHE_FILE = './data/leads-cache.json';

export function loadCache(): { updatedAt: number; leads: Lead[] } {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (Array.isArray(c.leads)) return { updatedAt: c.updatedAt || 0, leads: c.leads };
  } catch {}
  return { updatedAt: 0, leads: [] };
}

export function saveCache(leads: Lead[]) {
  try {
    fs.mkdirSync('./data', { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ updatedAt: Date.now(), leads: leads.slice(0, 500) }));
  } catch {}
}

// Cache-first: live radar when Overpass answers, stale cache when datacenters are filtered.
// Never 502s if we have ever seen leads.
export async function findLeadsCached(lat: number, lon: number, radiusM = 1000, limit = 30): Promise<{ leads: Lead[]; stale: boolean }> {
  try {
    const live = await findLeads(lat, lon, radiusM, limit);
    if (live.length > 0) {
      const cache = loadCache();
      const merged = [...live, ...cache.leads.filter(c => !live.some(l => l.name === c.name))].slice(0, 500);
      saveCache(merged);
      return { leads: live, stale: false };
    }
  } catch {}
  const cache = loadCache();
  return { leads: cache.leads.slice(0, limit), stale: true };
}

export async function findLeads(lat: number, lon: number, radiusM = 1000, limit = 30): Promise<Lead[]> {
  const q = `[out:json][timeout:25];(node["shop"](around:${radiusM},${lat},${lon});node["amenity"~"^(restaurant|cafe|fast_food|bar|hairdresser|beauty|dentist|doctors|clinic|pharmacy|veterinary|car_repair|car_wash)$"](around:${radiusM},${lat},${lon}););out tags center ${limit};`;
  let lastErr = 'unreachable';
  for (const m of MIRRORS) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    try {
      const r = await fetch(m, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'NoiraForge/1.0 (lead radar)',
        },
        body: 'data=' + encodeURIComponent(q),
        signal: ctl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) { lastErr = `overpass ${r.status}`; continue; }
      const j: any = await r.json();
      return normalize(j, limit);
    } catch (e: any) { clearTimeout(timer); lastErr = e.name === 'AbortError' ? 'overpass timeout' : (e.message || String(e)); }
  }
  throw new Error(lastErr);
}

function normalize(j: any, limit: number): Lead[] {
  const out: Lead[] = [];
  for (const el of j.elements || []) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;
    out.push({ name: String(name).slice(0, 80), sector: sectorOf(tags), lat: el.lat, lon: el.lon, tags });
    if (out.length >= limit) break;
  }
  return out;
}
