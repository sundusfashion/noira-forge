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

export async function findLeads(lat: number, lon: number, radiusM = 1000, limit = 30): Promise<Lead[]> {
  const q = `[out:json][timeout:25];(node["shop"](around:${radiusM},${lat},${lon});node["amenity"~"^(restaurant|cafe|fast_food|bar|hairdresser|beauty|dentist|doctors|clinic|pharmacy|veterinary|car_repair|car_wash)$"](around:${radiusM},${lat},${lon}););out tags center ${limit};`;
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(q),
  });
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const j: any = await r.json();
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
