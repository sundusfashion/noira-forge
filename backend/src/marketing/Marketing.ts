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
      CREATE TABLE IF NOT EXISTS demo_leads (
        id TEXT PRIMARY KEY, demo_slug TEXT NOT NULL, nombre TEXT NOT NULL,
        telefono TEXT NOT NULL, dia TEXT DEFAULT '', personas TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );
    `);
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
