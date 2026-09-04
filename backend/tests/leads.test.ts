import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sectorOf } from '../src/leads/Leads.ts';

describe('Leads', () => {
  it('maps OSM tags to our sectors', () => {
    assert.equal(sectorOf({ amenity: 'restaurant' }), 'restaurante');
    assert.equal(sectorOf({ shop: 'hairdresser' }), 'peluqueria');
    assert.equal(sectorOf({ shop: 'car_repair' }), 'taller');
    assert.equal(sectorOf({ amenity: 'dentist' }), 'clinica');
    assert.equal(sectorOf({ shop: 'clothes' }), 'tienda');
    assert.equal(sectorOf({ leisure: 'fitness_centre' }), 'gimnasio');
    assert.equal(sectorOf({ shop: 'copyshop' }), 'negocio');
  });
});
