import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { haversineMeters } from './nav-geometry';
import { destinationPoint, regionCirclePolygon } from './region-circle';

describe('regionCirclePolygon', () => {
  it('fecha o anel com 64+1 pontos', () => {
    const poly = regionCirclePolygon(-23.55, -46.63, 5000);
    const ring = poly.geometry.coordinates[0]!;
    assert.equal(ring.length, 65);
    assert.equal(ring[0]![0], ring[ring.length - 1]![0]);
    assert.equal(ring[0]![1], ring[ring.length - 1]![1]);
  });

  it('ponto no anel fica perto do raio (haversine)', () => {
    const center = { latitude: -23.55, longitude: -46.63 };
    const p = destinationPoint(center.latitude, center.longitude, 5000, 0);
    const d = haversineMeters(center, p);
    assert.ok(Math.abs(d - 5000) < 8);
  });
});
