import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { haversineMeters } from './nav-geometry';
import {
  bearingDegrees,
  destinationPoint,
  regionBoundsIncluding,
  regionCirclePolygon,
  regionMaskPolygon,
} from './region-circle';

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

  it('10 km ao norte ≈ 0,09° de latitude (não 0,9°)', () => {
    const lat = -23.55;
    const p = destinationPoint(lat, -46.63, 10_000, 0);
    const dLat = p.latitude - lat;
    const expected = 10_000 / 111_320;
    assert.ok(Math.abs(dLat - expected) < 0.006);
    assert.ok(dLat > 0.08 && dLat < 0.12);
  });
});

describe('regionMaskPolygon', () => {
  it('tem anel mundial + furo do círculo', () => {
    const mask = regionMaskPolygon(-23.55, -46.63, 5000);
    const rings = mask.geometry.coordinates;
    assert.equal(rings.length, 2);
    assert.equal(rings[0]!.length, 5);
    assert.equal(rings[1]!.length, 65);
    assert.equal(rings[0]![0]![0], -180);
    assert.equal(rings[0]![0]![1], -85);
  });
});

describe('regionBoundsIncluding', () => {
  it('expande o bounds para incluir ponto fora do círculo', () => {
    const center = { latitude: -23.55, longitude: -46.63 };
    const extra = { latitude: -23.55, longitude: -47.2 };
    const [[west], [east]] = regionBoundsIncluding(
      center.latitude,
      center.longitude,
      5000,
      extra,
    );
    assert.ok(west <= extra.longitude);
    assert.ok(east >= extra.longitude);
  });
});

describe('bearingDegrees', () => {
  it('norte ≈ 0', () => {
    const from = { latitude: -23.55, longitude: -46.63 };
    const to = { latitude: -23.45, longitude: -46.63 };
    const b = bearingDegrees(from, to);
    assert.ok(b < 2 || b > 358);
  });
});
