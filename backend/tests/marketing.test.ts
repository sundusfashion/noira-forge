import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MarketingStore, mdToHtml } from '../src/marketing/Marketing.ts';

describe('MarketingStore', () => {
  it('queues, publishes and lists articles', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noira-mkt-'));
    const m = new MarketingStore(dir);
    const a = m.queue('Test title', '# Test\nBody here', 'testing', 'blog');
    assert.equal(a.status, 'queued');
    m.mark(a.id, 'published', 'https://x/blog/' + a.id);
    const got = m.get(a.id);
    assert.equal(got?.status, 'published');
    assert.equal(m.list('published').length, 1);
    assert.equal(m.list('queued').length, 0);
    m.close();
  });
  it('converts markdown safely', () => {
    const h = mdToHtml('# Hi\n\nHello **bold** and `code`\n\n- a\n- b\n<script>alert(1)</script>');
    assert.ok(h.includes('<h1>Hi</h1>'));
    assert.ok(h.includes('<strong>bold</strong>'));
    assert.ok(!h.includes('<script>'));
  });
});
