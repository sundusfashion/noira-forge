import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemorySystem } from '../src/memory/MemorySystem.ts';

function tmpdir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'noira-test-')); }

describe('MemorySystem', () => {
  it('stores and recalls relevant memories', () => {
    const mem = new MemorySystem(tmpdir());
    mem.store({ type: 'financial', title: 'First revenue', content: 'SaaS subscription paid $47.23', metadata: {}, importance: 0.9 });
    mem.store({ type: 'dream', title: 'Night vision', content: 'purple oceans of churn', metadata: {}, importance: 0.3 });
    const hits = mem.recall('revenue subscription money', 5);
    assert.equal(hits[0].title, 'First revenue');
    mem.close();
  });

  it('prunes faded memories but keeps the count capped', () => {
    const mem = new MemorySystem(tmpdir());
    for (let i = 0; i < 10; i++) {
      mem.store({ type: 'episodic', title: `noise ${i}`, content: 'filler thought', metadata: {}, importance: 0.1 });
    }
    mem.store({ type: 'decision', title: 'KEEP ME', content: 'critical decision', metadata: {}, importance: 1.0 });
    assert.equal(mem.count(), 11);
    const removed = mem.prune(5);
    assert.equal(removed, 6);
    assert.equal(mem.count(), 5);
    const titles = mem.recent(10).map(m => m.title);
    assert.ok(titles.includes('KEEP ME'), 'important memory survives pruning');
    mem.close();
  });

  it('ledger never loses money lines', () => {
    const mem = new MemorySystem(tmpdir());
    mem.recordLedger('revenue', 4723, 'test sale');
    mem.recordLedger('expense', -100, 'test cost');
    const s = mem.ledgerSummary();
    assert.equal(s.revenue, 4723);
    assert.equal(s.expense, -100);
    mem.close();
  });
});
