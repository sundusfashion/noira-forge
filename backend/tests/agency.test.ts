import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildDemoSite, slugify } from '../src/agency/Templates.ts';

describe('Agency templates', () => {
  it('slugifies business names', () => {
    assert.equal(slugify('Pulpería La Isla'), 'pulperia-la-isla');
    assert.equal(slugify("Salem's Café!"), 'salem-s-cafe');
  });
  it('builds a complete functional page per sector', () => {
    for (const sector of ['restaurante', 'cafeteria', 'tienda', 'clinica', 'negocio']) {
      const html = buildDemoSite({
        slug: 'test', business: 'Test Biz', sector,
        phone: '600123456', address: 'Calle Falsa 123',
        photos: ['https://x/y.jpg'],
      });
      assert.ok(html.includes('Test Biz'), sector);
      assert.ok(html.includes('600123456'), sector);
      assert.ok(html.includes('/demo-assets/engine.js'), sector);
      assert.ok(html.includes('data-lead'), sector);
      assert.ok(html.includes('data-countdown'), sector);
    }
  });
});
