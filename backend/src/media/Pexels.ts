// Pexels media: free photos + videos per sector. Needs PEXELS_API_KEY (free, no card).
const API = 'https://api.pexels.com';

function key(): string {
  const k = process.env.PEXELS_API_KEY;
  if (!k) throw new Error('pexels not connected — add PEXELS_API_KEY');
  return k;
}

export async function searchPhotos(query: string, n = 6): Promise<{ url: string; alt: string; photographer: string }[]> {
  const r = await fetch(`${API}/v1/search?query=${encodeURIComponent(query)}&per_page=${Math.min(15, Math.max(1, n))}&orientation=landscape&locale=es-ES`, {
    headers: { Authorization: key() },
  });
  if (!r.ok) throw new Error(`pexels photos ${r.status}`);
  const j: any = await r.json();
  return (j.photos || []).map((p: any) => ({ url: p.src?.large || p.src?.original || '', alt: p.alt || '', photographer: p.photographer || '' })).filter((x: any) => x.url);
}

export async function searchVideos(query: string, n = 3): Promise<{ url: string; preview: string }[]> {
  const r = await fetch(`${API}/videos/search?query=${encodeURIComponent(query)}&per_page=${Math.min(10, Math.max(1, n))}&orientation=landscape&locale=es-ES`, {
    headers: { Authorization: key() },
  });
  if (!r.ok) throw new Error(`pexels videos ${r.status}`);
  const j: any = await r.json();
  return (j.videos || []).map((v: any) => {
    const files = [...(v.video_files || [])].filter((f: any) => f.file_type === 'video/mp4' && f.link);
    files.sort((a: any, b: any) => Math.abs((a.width || 0) - 1280) - Math.abs((b.width || 0) - 1280));
    return { url: files[0]?.link || '', preview: v.image || '' };
  }).filter((x: any) => x.url);
}
