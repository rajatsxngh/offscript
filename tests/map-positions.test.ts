import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findAvailableMapPosition, fitMapBounds, moveMapPoint, readMapPositions, serializeMapPositions,
  type PositionedRect,
} from '../src/lib/map-positions';

test('dragging follows the pointer at both zoomed-out and zoomed-in scales', () => {
  const origin = { x: -120, y: 40 };
  assert.deepEqual(moveMapPoint(origin, { x: 30, y: -20 }, 0.5), { x: -60, y: 0 });
  assert.deepEqual(moveMapPoint(origin, { x: 30, y: -20 }, 2), { x: -105, y: 30 });
  assert.deepEqual(origin, { x: -120, y: 40 });
});

test('invalid drag scale cannot corrupt positions and extreme movement is bounded', () => {
  const origin = { x: 12, y: 34 };
  for (const zoom of [0, -1, NaN, Infinity]) assert.deepEqual(moveMapPoint(origin, { x: 10, y: 10 }, zoom), origin);
  assert.deepEqual(moveMapPoint(origin, { x: Infinity, y: 10 }, 1), origin);
  assert.deepEqual(moveMapPoint(origin, { x: 1e9, y: -1e9 }, 0.5), { x: 100_000, y: -100_000 });
});

test('saved positions round-trip and only currently existing topics are restored', () => {
  const saved = serializeMapPositions({ root: { x: -450, y: 80 }, removed: { x: 12, y: -30 } });
  assert.deepEqual(JSON.parse(saved).version, 1);
  assert.deepEqual(readMapPositions(saved, ['root', 'new']), { root: { x: -450, y: 80 } });
});

test('corrupt or unsupported storage safely starts with no restored positions', () => {
  for (const raw of [null, '', 'broken', 'null', '[]', '{"version":2,"positions":{}}', '{"version":1,"positions":[]}']) {
    assert.deepEqual(readMapPositions(raw, ['root']), {});
  }
});

test('storage ignores malformed, excessive, and reserved entries while retaining valid neighbors', () => {
  const raw = '{"version":1,"positions":{"good":{"x":-100000,"y":100000},"string":{"x":"4","y":5},"missing":{"x":1},"excess":{"x":100001,"y":0},"overflow":{"x":1e400,"y":0},"array":[1,2],"__proto__":{"x":1,"y":2},"constructor":{"x":1,"y":2}}}';
  const restored = readMapPositions(raw, ['good', 'string', 'missing', 'excess', 'overflow', 'array', '__proto__', 'constructor']);
  assert.deepEqual(restored, { good: { x: -100_000, y: 100_000 } });
  assert.equal(Object.getPrototypeOf(restored), Object.prototype);
});

test('fit uses actual negative and positive node extents with space for bottom controls', () => {
  const rects = [{ x: -700, y: -330, width: 210, height: 195 }, { x: 230, y: 210, width: 174, height: 152 }];
  const view = fitMapBounds(rects, 900, 720);
  for (const rect of rects) {
    assert.ok(rect.x * view.zoom + view.x >= 32 - 1e-8);
    assert.ok((rect.x + rect.width) * view.zoom + view.x <= 868 + 1e-8);
    assert.ok(rect.y * view.zoom + view.y >= 30 - 1e-8);
    assert.ok((rect.y + rect.height) * view.zoom + view.y <= 620 + 1e-8);
  }
  const moved = fitMapBounds([{ ...rects[0], x: -1400 }, rects[1]], 900, 720);
  assert.ok(moved.zoom < view.zoom, 'fit includes a node after it is moved further away');
});

test('empty and very small maps have useful bounded fit transforms', () => {
  assert.deepEqual(fitMapBounds([], 800, 600), { x: 400, y: 300, zoom: 1 });
  assert.equal(fitMapBounds([{ x: 0, y: 0, width: 100, height: 100 }], 1000, 800).zoom, 1.12);
  assert.equal(fitMapBounds([{ x: -100000, y: 0, width: 200000, height: 200000 }], 300, 400).zoom, 0.12);
});

test('new branches keep their preferred position if free and avoid occupied cards with a gap', () => {
  const occupied: PositionedRect[] = [{ x: 0, y: 0, width: 174, height: 152 }, { x: -198, y: -176, width: 174, height: 152 }];
  const snapshot = structuredClone(occupied);
  const size = { width: 174, height: 152 };
  assert.deepEqual(findAvailableMapPosition({ x: 250, y: 40 }, size, occupied), { x: 250, y: 40 });
  const placed = findAvailableMapPosition({ x: 0, y: 0 }, size, occupied);
  assert.deepEqual(placed, findAvailableMapPosition({ x: 0, y: 0 }, size, occupied), 'placement is deterministic');
  for (const rect of occupied) {
    assert.ok(placed.x + size.width + 24 <= rect.x || placed.x >= rect.x + rect.width + 24 ||
      placed.y + size.height + 24 <= rect.y || placed.y >= rect.y + rect.height + 24);
  }
  assert.deepEqual(occupied, snapshot);
});

test('dense nearby arrangements terminate with a clear position beyond occupied bounds', () => {
  const occupied = [{ x: -10000, y: -10000, width: 20000, height: 20000 }];
  assert.deepEqual(findAvailableMapPosition({ x: 0, y: 0 }, { width: 174, height: 152 }, occupied), { x: 10024, y: 0 });
});


test('fit reserves asymmetric space for the floating header and tool rail', () => {
  const rects = [{ x: -120, y: -207, width: 174, height: 154 }, { x: 120, y: 245, width: 174, height: 154 }];
  const view = fitMapBounds(rects, 516, 740, { left: 72, right: 20, top: 92, bottom: 90 });
  for (const rect of rects) {
    assert.ok(rect.x * view.zoom + view.x >= 72 - 1e-8);
    assert.ok((rect.x + rect.width) * view.zoom + view.x <= 496 + 1e-8);
    assert.ok(rect.y * view.zoom + view.y >= 92 - 1e-8);
    assert.ok((rect.y + rect.height) * view.zoom + view.y <= 650 + 1e-8);
  }
});
