import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CommandSchema, InvestSchema, SpawnSchema, RateLimiter } from '../src/api/guard.ts';
import { MemorySystem } from '../src/memory/MemorySystem.ts';
import { EntityCore } from '../src/entity/EntityCore.ts';
import { FinancialAutonomy } from '../src/financial/FinancialAutonomy.ts';

describe('guard schemas', () => {
  it('rejects oversized / empty commands', () => {
    assert.equal(CommandSchema.safeParse({ command: '' }).success, false);
    assert.equal(CommandSchema.safeParse({ command: 'x'.repeat(2001) }).success, false);
    assert.equal(CommandSchema.safeParse({ command: 'noira status' }).success, true);
  });
  it('enforces invest bounds $10–$1000', () => {
    assert.equal(InvestSchema.safeParse({ amountCents: 999, buyer: 'a' }).success, false);
    assert.equal(InvestSchema.safeParse({ amountCents: 100001, buyer: 'a' }).success, false);
    assert.equal(InvestSchema.safeParse({ amountCents: 10000, buyer: 'angel' }).success, true);
  });
  it('rejects nameless companies', () => {
    assert.equal(SpawnSchema.safeParse({ name: 'X', capitalCents: 100 }).success, false);
    assert.equal(SpawnSchema.safeParse({ name: 'NeuroLink', capitalCents: 500000 }).success, true);
  });
  it('rate limiter blocks bursts', () => {
    const lim = new RateLimiter(2, 0);
    assert.equal(lim.allow('ip'), true);
    assert.equal(lim.allow('ip'), true);
    assert.equal(lim.allow('ip'), false);
  });
});

describe('FinancialAutonomy', () => {
  it('issues shares at revenue-multiple price and tracks cash', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noira-fin-'));
    const mem = new MemorySystem(dir);
    const core = new EntityCore(mem);
    const fin = new FinancialAutonomy(mem, core, dir);
    // floor valuation $50k / 1M shares = $0.05 → $100 buys 2000 shares
    const r = await fin.invest(10000, 'test-angel');
    assert.equal(r.shares, 2000);
    assert.equal(r.pricePerShareCents, 5);
    assert.equal(core.cashCents, 10000);
    // second buy at same price (no revenue yet): still consistent
    const r2 = await fin.invest(1000, 'minnow');
    assert.equal(r2.shares, 200);
    // sandbox honesty: no Stripe key → card mode off, ledger mode on
    assert.equal(fin.stripe, null);
    assert.equal(fin.metrics().stripeLive, false);
    mem.close();
  });
});
