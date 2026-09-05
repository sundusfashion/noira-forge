import Database from 'better-sqlite3';
import fs from 'node:fs';
import { nanoid } from 'nanoid';

export interface Article {
  id: string; title: string; body: string; topic: string;
  channel: string; status: 'draft' | 'queued' | 'published' | 'failed';
  createdAt: number; publishedAt?: number; externalUrl?: string; error?: string;
}

// Marketing store: own SQLite file, same data dir. Articles queue + publish log.
export class MarketingStore {
  private db: Database.Database;
  constructor(dataDir = './data') {
    fs.mkdirSync(dataDir, { recursive: true });
    this.db = new Database(dataDir + '/noira-marketing.db');
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
        topic TEXT DEFAULT '', channel TEXT DEFAULT 'blog',
        status TEXT DEFAULT 'draft', created_at INTEGER NOT NULL,
        published_at INTEGER, external_url TEXT, error TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_art_status ON articles(status);
      CREATE TABLE IF NOT EXISTS outreach (
        id TEXT PRIMARY KEY, to_email TEXT NOT NULL, business TEXT NOT NULL,
        subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT DEFAULT 'queued',
        sent_at INTEGER, reply_at INTEGER, reply_snippet TEXT DEFAULT '',
        followups INTEGER DEFAULT 0, created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_out_status ON outreach(status);
      CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL DEFAULT '');
      CREATE TABLE IF NOT EXISTS targets (
        email TEXT PRIMARY KEY, business TEXT NOT NULL, sector TEXT DEFAULT 'negocio',
        phone TEXT DEFAULT '', address TEXT DEFAULT '', demo_slug TEXT DEFAULT '',
        status TEXT DEFAULT 'new', created_at INTEGER NOT NULL,
        scheduled_for INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS demo_leads (
        id TEXT PRIMARY KEY, demo_slug TEXT NOT NULL, nombre TEXT NOT NULL,
        telefono TEXT NOT NULL, dia TEXT DEFAULT '', personas TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );
    `);
    try { this.db.exec(`ALTER TABLE targets ADD COLUMN scheduled_for INTEGER DEFAULT 0`); } catch { /* column exists */ }
  }
  queue(title: string, body: string, topic = '', channel = 'blog'): Article {
    const a: Article = { id: `art_${nanoid(8)}`, title, body, topic, channel, status: 'queued', createdAt: Date.now() };
    this.db.prepare(`INSERT INTO articles (id,title,body,topic,channel,status,created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(a.id, a.title, a.body, a.topic, a.channel, a.status, a.createdAt);
    return a;
  }
  mark(id: string, status: Article['status'], externalUrl = '', error = '') {
    this.db.prepare(`UPDATE articles SET status=?, published_at=?, external_url=?, error=? WHERE id=?`)
      .run(status, status === 'published' ? Date.now() : null, externalUrl || null, error || null, id);
  }
  list(status?: string, limit = 50): Article[] {
    const rows: any[] = status
      ? this.db.prepare(`SELECT * FROM articles WHERE status=? ORDER BY created_at DESC LIMIT ?`).all(status, limit)
      : this.db.prepare(`SELECT * FROM articles ORDER BY created_at DESC LIMIT ?`).all(limit);
    return rows.map(r => ({ id: r.id, title: r.title, body: r.body, topic: r.topic, channel: r.channel, status: r.status, createdAt: r.created_at, publishedAt: r.published_at ?? undefined, externalUrl: r.external_url ?? undefined, error: r.error ?? undefined }));
  }
  addLead(lead: { demoSlug: string; nombre: string; telefono: string; dia?: string; personas?: string }): string {
    const id = `lead_${Date.now()}_${nanoid(4)}`;
    this.db.prepare(`INSERT INTO demo_leads (id, demo_slug, nombre, telefono, dia, personas, created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(id, lead.demoSlug, lead.nombre, lead.telefono, lead.dia || '', lead.personas || '', Date.now());
    return id;
  }

  listLeads(limit = 100): any[] {
    return this.db.prepare(`SELECT * FROM demo_leads ORDER BY created_at DESC LIMIT ?`).all(limit);
  }

  queueOutreach(o: { to: string; business: string; subject: string; body: string }): string {
    const id = `out_${Date.now()}_${nanoid(4)}`;
    this.db.prepare(`INSERT INTO outreach (id, to_email, business, subject, body, status, created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(id, o.to, o.business, o.subject, o.body, 'queued', Date.now());
    return id;
  }
  markOutreach(id: string, status: string, extra: { replySnippet?: string; followups?: number } = {}) {
    const cur: any = this.db.prepare(`SELECT * FROM outreach WHERE id=?`).get(id);
    if (!cur) return;
    this.db.prepare(`UPDATE outreach SET status=?, sent_at=COALESCE(sent_at,?), reply_at=?, reply_snippet=?, followups=? WHERE id=?`)
      .run(status, status === 'sent' ? Date.now() : cur.sent_at,
        status === 'replied' ? Date.now() : cur.reply_at,
        extra.replySnippet ?? cur.reply_snippet ?? '',
        extra.followups ?? cur.followups ?? 0, id);
  }
  listOutreach(status?: string, limit = 100): any[] {
    return status
      ? this.db.prepare(`SELECT * FROM outreach WHERE status=? ORDER BY created_at DESC LIMIT ?`).all(status, limit)
      : this.db.prepare(`SELECT * FROM outreach ORDER BY created_at DESC LIMIT ?`).all(limit);
  }
  getSetting(k: string): string | null {
    const r: any = this.db.prepare(`SELECT v FROM settings WHERE k=?`).get(k);
    return r ? r.v : null;
  }
  setSetting(k: string, v: string) {
    this.db.prepare(`INSERT INTO settings (k, v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v`).run(k, v);
  }
  outreachStats(): Record<string, number> {
    const rows: any[] = this.db.prepare(`SELECT status, COUNT(*) as c FROM outreach GROUP BY status`).all();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = r.c;
    return out;
  }

  upsertTarget(t: { email: string; business: string; sector?: string; phone?: string; address?: string }): void {
    this.db.prepare(`INSERT INTO targets (email, business, sector, phone, address, status, created_at)
      VALUES (?,?,?,?,?,'new',?) ON CONFLICT(email) DO UPDATE SET business=excluded.business, sector=excluded.sector, phone=excluded.phone, address=excluded.address`)
      .run(t.email.toLowerCase(), t.business, t.sector || 'negocio', t.phone || '', t.address || '', Date.now());
  }
  nextTarget(): any | null {
    // Only targets whose scheduled day arrived (0 = anytime).
    return this.db.prepare(`SELECT * FROM targets WHERE status='new' AND (scheduled_for IS NULL OR scheduled_for = 0 OR scheduled_for <= ?) ORDER BY scheduled_for ASC, created_at ASC LIMIT 1`).get(Date.now()) ?? null;
  }
  // Stagger unscheduled targets across days following the warmup ramp.
  // Default: 5/day × 7d, 10/day × 7d, 18/day × 7d, then 25/day.
  stagger(plan: { perDay: number; days: number }[] = [{ perDay: 5, days: 7 }, { perDay: 10, days: 7 }, { perDay: 18, days: 7 }, { perDay: 25, days: 365 }]): number {
    const pending: any[] = this.db.prepare(
      `SELECT email FROM targets WHERE status='new' AND (scheduled_for IS NULL OR scheduled_for = 0) ORDER BY created_at ASC`
    ).all();
    const dayMs = 86400_000;
    const baseDay = Math.floor(Date.now() / dayMs);
    let i = 0;
    let dayOffset = 0;
    const upd = this.db.prepare(`UPDATE targets SET scheduled_for=? WHERE email=?`);
    for (const phase of plan) {
      for (let d = 0; d < phase.days && i < pending.length; d++, dayOffset++) {
        // send slots spread through the day (9:00–18:00) to look human
        for (let k = 0; k < phase.perDay && i < pending.length; k++, i++) {
          const hour = 9 + Math.floor((9 * (k + 1)) / (phase.perDay + 1));
          const ts = (baseDay + dayOffset) * dayMs + hour * 3600_000 + Math.floor(Math.random() * 1800_000);
          upd.run(Math.max(ts, Date.now() + 60000), pending[i].email);
        }
      }
    }
    return pending.length;
  }
  setTarget(email: string, status: string, demoSlug = '') {
    if (demoSlug) this.db.prepare(`UPDATE targets SET status=?, demo_slug=? WHERE email=?`).run(status, demoSlug, email);
    else this.db.prepare(`UPDATE targets SET status=? WHERE email=?`).run(status, email);
  }
  targetStats(): Record<string, number> {
    const rows: any[] = this.db.prepare(`SELECT status, COUNT(*) as c FROM targets GROUP BY status`).all();
    const out: Record<string, number> = {};
    for (const r of rows) out[r.status] = r.c;
    return out;
  }

  get(id: string): Article | null {
    const r: any = this.db.prepare(`SELECT * FROM articles WHERE id=?`).get(id);
    return r ? { id: r.id, title: r.title, body: r.body, topic: r.topic, channel: r.channel, status: r.status, createdAt: r.created_at, publishedAt: r.published_at ?? undefined, externalUrl: r.external_url ?? undefined, error: r.error ?? undefined } : null;
  }
  close() { try { this.db.close(); } catch {} }
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Minimal markdown → HTML (headings, bold, code, paragraphs, lists). No deps.
export function mdToHtml(md: string): string {
  const lines = md.split('\n');
  let html = '';
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      if (inList) { html += '</ul>'; inList = false; }
      const level = line.match(/^#+/)![0].length;
      html += `<h${level}>${esc(line.replace(/^#+\s/, ''))}</h${level}>`;
    } else if (/^[-*]\s/.test(line)) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(esc(line.replace(/^[-*]\s/, '')))}</li>`;
    } else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(esc(line))}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}
function inline(s: string) {
  return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
}
