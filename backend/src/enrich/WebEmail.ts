// Website email extractor: fetch homepage (+ /contacto) and harvest emails.
// Works from anywhere (plain HTTPS) — the cloud-safe half of lead sourcing.
const JUNK = new Set([
  'example.com', 'email.com', 'mail.com', 'facebook.com', 'instagram.com',
  'google.com', 'wix.com', 'wordpress.com', 'godaddy.com', 'sentry.io',
  'schema.org', 'w3.org', 'adobe.com', 'png', 'jpg', 'svg', 'webp',
]);

export async function extractEmailsFromSite(siteUrl: string, timeoutMs = 12000): Promise<string[]> {
  const found = new Set<string>();
  const urls = [siteUrl];
  for (const suffix of ['/contacto', '/contact', '/contactar']) {
    try { urls.push(new URL(suffix, siteUrl).toString()); } catch {}
    if (urls.length >= 3) break;
  }
  for (const u of urls.slice(0, 3)) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      const r = await fetch(u, {
        signal: ctl.signal,
        headers: { 'User-Agent': 'NoiraForge/1.0 (contact research)', 'Accept': 'text/html' },
        redirect: 'follow',
      });
      clearTimeout(t);
      if (!r.ok) continue;
      const html = (await r.text()).slice(0, 400000);
      // mailto: first (explicit), then plain-text emails
      const re = /(?:mailto:)?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const email = m[1].toLowerCase();
        const domain = email.split('@')[1] || '';
        if (JUNK.has(domain)) continue;
        if (email.length > 80) continue;
        found.add(email);
        if (found.size >= 3) break;
      }
    } catch {}
    if (found.size >= 2) break;
  }
  return [...found];
}
