import Database from 'better-sqlite3';
import fs from 'node:fs';

// SerpApi enrichment with AGGRESSIVE caching: every query paid once, stored forever.
// Budget discipline: 100 free searches → discovery via OSM (free), SerpApi only for
// place details (photos + reviews + hours) of hot candidates.
export interface EnrichedPlace {
  title: string;
  rating?: number;
  reviewsCount?: number;
  phone?: string;
  address?: string;
  website?: string;
  hours?: Record<string, string>;
  photos: string[];
  reviews: { author: string; rating: number; text: string }[];
  fetchedAt: number;
}

function key(): string {
  const k = process.env.SERPAPI_KEY;
  if (!k) throw new Error('serpapi not connected — add SERPAPI_KEY');
  return k;
}

let db: Database.Database | null = null;
function store(): Database.Database {
  if (!db) {
    fs.mkdirSync('./data', { recursive: true });
    db = new Database('./data/noira-marketing.db');
    db.exec(`CREATE TABLE IF NOT EXISTS serpapi_cache (qkey TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  }
  return db;
}

function cached<T>(qkey: string, maxAgeMs: number, fn: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
  const s = store();
  const row: any = s.prepare(`SELECT payload, created_at FROM serpapi_cache WHERE qkey=?`).get(qkey);
  if (row && Date.now() - row.created_at < maxAgeMs) {
    return Promise.resolve({ data: JSON.parse(row.payload), cached: true });
  }
  return fn().then(data => {
    s.prepare(`INSERT OR REPLACE INTO serpapi_cache (qkey, payload, created_at) VALUES (?,?,?)`)
      .run(qkey, JSON.stringify(data), Date.now());
    return { data, cached: false };
  });
}

async function serp(endpoint: string, params: Record<string, string>): Promise<any> {
  const u = new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine', endpoint);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('api_key', key());
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`serpapi ${endpoint} ${r.status}`);
  return r.json();
}

// One search call → up to 20 businesses with rating/hours/phone/thumbnail inline.
export async function searchPlaces(query: string, ll: string, hl = 'es'): Promise<{ places: any[]; cached: boolean }> {
  const qkey = `search|${query}|${ll}|${hl}`;
  const { data, cached } = await cached<any[]>(qkey, 30 * 86400_000, async () => {
    const j = await serp('google_maps', { q: query, ll, type: 'search', hl });
    return (j.local_results || []).map((p: any) => ({
      title: p.title, data_id: p.data_id, rating: p.rating, reviews: p.reviews,
      phone: p.phone, address: p.address, website: p.website,
      hours: p.operating_hours, open_state: p.open_state,
      thumbnail: p.thumbnail, type: p.type,
    }));
  });
  return { places: data, cached };
}

// Deep dive (2 calls): top reviews + top photos. Only for hot candidates.
export async function enrichPlace(dataId: string, hl = 'es'): Promise<{ place: EnrichedPlace; cached: boolean }> {
  const qkey = `place|${dataId}|${hl}`;
  const { data, cached } = await cached<EnrichedPlace>(qkey, 30 * 86400_000, async () => {
    const [rev, pho] = await Promise.all([
      serp('google_maps_reviews', { data_id: dataId, hl }).catch(() => ({ reviews: [] })),
      serp('google_maps_photos', { data_id: dataId, hl }).catch(() => ({ photos: [] })),
    ]);
    const place: EnrichedPlace = {
      title: '',
      rating: rev.rating, reviewsCount: rev.reviews,
      photos: (pho.photos || []).slice(0, 8).map((p: any) => p.image || p.thumbnail || '').filter(Boolean),
      reviews: (rev.reviews || []).slice(0, 5).map((r: any) => ({
        author: r.user?.name || 'Google', rating: r.rating || 5, text: (r.snippet || '').slice(0, 300),
      })),
      fetchedAt: Date.now(),
    };
    return place;
  });
  return { place: data, cached };
}

export function cacheStats(): { keys: number } {
  const r: any = store().prepare(`SELECT COUNT(*) as c FROM serpapi_cache`).get();
  return { keys: r.c };
}
