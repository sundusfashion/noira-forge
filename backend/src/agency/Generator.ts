import fs from 'node:fs';
import path from 'node:path';
import { buildDemoSite, slugify, DemoSpec } from './Templates.js';
import { searchPhotos, searchVideos } from '../media/Pexels.js';
import { createDemo } from '../demos/Demos.js';

const SECTOR_QUERY: Record<string, string> = {
  restaurante: 'grilled food restaurant dish',
  cafeteria: 'coffee cafe barista',
  tienda: 'small shop storefront products',
  clinica: 'modern clinic interior',
  negocio: 'local business storefront',
};

const WEB_DIR = path.resolve('dist-web');

// Generate a complete demo for a business: media + HTML + 24h registration.
// Returns { slug, url }.
export async function generateDemo(input: {
  business: string; sector?: string; phone?: string; address?: string; hours?: number;
}): Promise<{ slug: string; url: string }> {
  const sector = (input.sector || 'negocio').toLowerCase();
  const slug = slugify(input.business);
  const query = SECTOR_QUERY[sector] || SECTOR_QUERY.negocio;

  let photos: string[] = [];
  let sweetPhotos: string[] = [];
  let video: string | undefined;
  try {
    photos = (await searchPhotos(query, 4)).map(p => p.url);
  } catch (e) { console.error('[generator] photos:', (e as any).message); }
  try {
    sweetPhotos = (await searchPhotos('dessert cake coffee', 3)).map(p => p.url);
  } catch (e) { console.error('[generator] sweets:', (e as any).message); }
  try {
    const vids = await searchVideos(query, 1);
    if (vids[0]) video = vids[0].url;
  } catch (e) { console.error('[generator] video:', (e as any).message); }
  if (!photos.length) {
    photos = [1, 2, 3, 4].map(i => `https://picsum.photos/seed/${slug}${i}/700/520`);
  }

  const spec: DemoSpec = {
    slug, business: input.business, sector,
    phone: input.phone, address: input.address, photos, sweetPhotos, video,
  };
  const html = buildDemoSite(spec);

  const dir = path.join(WEB_DIR, 'demo', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  createDemo(slug, input.business, input.hours ?? 24);
  return { slug, url: `https://noira-forge-entity.onrender.com/demo/${slug}/` };
}
