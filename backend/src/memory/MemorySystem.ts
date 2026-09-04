import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision' | 'financial' | 'hired' | 'evolution';

export interface MemoryEvent {
  id: string;
  timestamp: number;
  type: MemoryType;
  title: string;
  content: string;
  metadata: Record<string, any>;
  neuronId?: string;
  importance: number;
  embedding?: number[];
}

// Tiny local embedding: hash-based 64-dim, deterministic, no API needed.
// When GROQ_API_KEY exists we still use this for recall ranking (fast + offline).
function localEmbed(text: string, dim = 64): number[] {
  const vec = new Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    vec[idx] += 1;
    // bigram spread
    vec[(idx * 7 + 13) % dim] += 0.5;
  }
  // normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export class MemorySystem {
  private db: Database.Database;
  dbPath: string;

  constructor(dataDir = './data') {
    fs.mkdirSync(dataDir, { recursive: true });
    this.dbPath = path.join(dataDir, 'noira-memory.db');
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        neuronId TEXT,
        importance REAL NOT NULL DEFAULT 0.5,
        embedding TEXT NOT NULL DEFAULT '[]'
      );
      CREATE INDEX IF NOT EXISTS idx_mem_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_mem_time ON memories(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_mem_importance ON memories(importance DESC);
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ein TEXT,
        state TEXT DEFAULT 'DE',
        status TEXT DEFAULT 'active',
        created_at INTEGER NOT NULL,
        data TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        kind TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT DEFAULT 'USD',
        memo TEXT DEFAULT '',
        meta TEXT DEFAULT '{}'
      );
    `);
  }

  store(input: Omit<MemoryEvent, 'id' | 'timestamp' | 'embedding'> & { id?: string; timestamp?: number }): MemoryEvent {
    const id = input.id ?? `mem_${Date.now()}_${nanoid(6)}`;
    const timestamp = input.timestamp ?? Date.now();
    const embedding = localEmbed(`${input.title} ${input.content} ${input.type}`);
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, timestamp, type, title, content, metadata, neuronId, importance, embedding)
      VALUES (@id, @timestamp, @type, @title, @content, @metadata, @neuronId, @importance, @embedding)
    `);
    stmt.run({
      id, timestamp,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: JSON.stringify(input.metadata ?? {}),
      neuronId: input.neuronId ?? null,
      importance: input.importance ?? 0.5,
      embedding: JSON.stringify(embedding),
    });
    return { ...input, id, timestamp, embedding } as MemoryEvent;
  }

  recent(limit = 50): MemoryEvent[] {
    const rows: any[] = this.db.prepare(`SELECT * FROM memories ORDER BY timestamp DESC LIMIT ?`).all(limit);
    return rows.map(this.rowToEvent);
  }

  recall(query: string, limit = 8): MemoryEvent[] {
    const q = localEmbed(query);
    const rows: any[] = this.db.prepare(`SELECT * FROM memories ORDER BY timestamp DESC LIMIT 400`).all();
    const scored = rows.map(r => {
      const ev = this.rowToEvent(r);
      const emb: number[] = JSON.parse(r.embedding || '[]');
      const sim = emb.length ? cosine(q, emb) : 0;
      // boost recent + important
      const recency = Math.exp(-(Date.now() - ev.timestamp) / (1000 * 60 * 60 * 24 * 7));
      const score = sim * 0.7 + ev.importance * 0.2 + recency * 0.1;
      return { ev, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.ev);
  }

  count(): number {
    const r: any = this.db.prepare(`SELECT COUNT(*) as c FROM memories`).get();
    return r.c;
  }

  // Anti-disk-fill: keep the N most valuable memories (importance, then recency).
  // Money (ledger) and companies (entities) are NEVER pruned.
  prune(maxMemories = 5000): number {
    const c = this.count();
    if (c <= maxMemories) return 0;
    const res: any = this.db.prepare(`
      DELETE FROM memories WHERE id NOT IN (
        SELECT id FROM memories ORDER BY importance DESC, timestamp DESC LIMIT ?
      )
    `).run(maxMemories);
    try { this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch {}
    return Number(res.changes || 0);
  }

  // Full export for cloud backups (Render free disk is ephemeral — memory must be portable)
  dump(maxMemories = 5000) {
    const memories: any[] = this.db.prepare(`SELECT * FROM memories ORDER BY importance DESC, timestamp DESC LIMIT ?`).all(maxMemories);
    const entities: any[] = this.db.prepare(`SELECT * FROM entities`).all();
    const ledger: any[] = this.db.prepare(`SELECT * FROM ledger ORDER BY timestamp ASC`).all();
    return { version: 1, exportedAt: Date.now(), memories, entities, ledger };
  }

  importDump(d: any): { memories: number; entities: number; ledger: number } {
    if (!d || !Array.isArray(d.memories)) throw new Error('bad backup');
    const tx = this.db.transaction(() => {
      let m = 0, e = 0, l = 0;
      const insM = this.db.prepare(`INSERT OR IGNORE INTO memories (id, timestamp, type, title, content, metadata, neuronId, importance, embedding) VALUES (?,?,?,?,?,?,?,?,?)`);
      for (const r of d.memories.slice(0, 20000)) { insM.run(r.id, r.timestamp, r.type, r.title, r.content, r.metadata, r.neuronId ?? null, r.importance, r.embedding); m++; }
      const insE = this.db.prepare(`INSERT OR IGNORE INTO entities (id, name, ein, state, status, created_at, data) VALUES (?,?,?,?,?,?,?)`);
      for (const r of (d.entities || []).slice(0, 500)) { insE.run(r.id, r.name, r.ein ?? null, r.state ?? 'DE', r.status ?? 'active', r.created_at ?? Date.now(), r.data); e++; }
      const insL = this.db.prepare(`INSERT OR IGNORE INTO ledger (id, timestamp, kind, amount_cents, currency, memo, meta) VALUES (?,?,?,?,?,?,?)`);
      for (const r of (d.ledger || []).slice(0, 50000)) { insL.run(r.id, r.timestamp, r.kind, r.amount_cents, r.currency ?? 'USD', r.memo ?? '', r.meta ?? '{}'); l++; }
      return { memories: m, entities: e, ledger: l };
    });
    return tx();
  }

  close() { try { this.db.close(); } catch {} }

  private rowToEvent = (r: any): MemoryEvent => ({
    id: r.id,
    timestamp: r.timestamp,
    type: r.type,
    title: r.title,
    content: r.content,
    metadata: JSON.parse(r.metadata || '{}'),
    neuronId: r.neuronId ?? undefined,
    importance: r.importance,
  });

  // Ledger helpers (financial autonomy persistence)
  recordLedger(kind: string, amountCents: number, memo = '', meta: any = {}) {
    this.db.prepare(`INSERT INTO ledger (id, timestamp, kind, amount_cents, currency, memo, meta) VALUES (?,?,?,?,?,?,?)`)
      .run(`led_${Date.now()}_${nanoid(6)}`, Date.now(), kind, amountCents, 'USD', memo, JSON.stringify(meta));
  }

  ledgerSummary() {
    const rows: any[] = this.db.prepare(`SELECT kind, SUM(amount_cents) as total FROM ledger GROUP BY kind`).all();
    const byKind: Record<string, number> = {};
    for (const r of rows) byKind[r.kind] = r.total;
    return byKind;
  }

  saveEntity(e: any) {
    this.db.prepare(`INSERT OR REPLACE INTO entities (id, name, ein, state, status, created_at, data) VALUES (?,?,?,?,?,?,?)`)
      .run(e.id, e.name, e.ein ?? null, e.state ?? 'DE', e.status ?? 'active', e.createdAt ?? Date.now(), JSON.stringify(e));
  }

  listEntities(): any[] {
    const rows: any[] = this.db.prepare(`SELECT * FROM entities ORDER BY created_at DESC`).all();
    return rows.map(r => ({ ...JSON.parse(r.data), id: r.id, name: r.name, ein: r.ein, status: r.status }));
  }
}
