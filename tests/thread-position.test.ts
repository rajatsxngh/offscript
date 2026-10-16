import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampThreadPosition, floatingThreadSize, readThreadPosition, threadPositionKey, THREAD_DESKTOP_WIDTH } from '../src/lib/thread-position';

test('saved thread positions are versioned, finite and isolated per map', () => {
  assert.deepEqual(readThreadPosition(JSON.stringify({ version: 1, x: 230.5, y: 120 })), { x: 230.5, y: 120 });
  assert.notEqual(threadPositionKey('first-map'), threadPositionKey('second-map'));
  for (const raw of [null, '', '{', 'null', '[]', '{"x":1,"y":2}', '{"version":2,"x":1,"y":2}', '{"version":1,"x":"12","y":2}', '{"version":1,"x":1e309,"y":2}', '{"version":1,"x":1000001,"y":2}', ' '.repeat(513)]) {
    assert.equal(readThreadPosition(raw), null, String(raw));
  }
});

test('panel clamps all four edges below the header with full dimensions visible', () => {
  const viewport = { width: 1440, height: 900 };
  assert.deepEqual(floatingThreadSize(viewport), { width: 480, height: 620 });
  assert.deepEqual(clampThreadPosition({ x: -50, y: -20 }, viewport), { x: 16, y: 88 });
  assert.deepEqual(clampThreadPosition({ x: 5000, y: 5000 }, viewport), { x: 944, y: 264 });
  assert.deepEqual(clampThreadPosition({ x: 240.5, y: 150 }, viewport), { x: 240.5, y: 150 });
});

test('restored position is clamped again after a smaller window replaces the original viewport', () => {
  const saved = readThreadPosition('{"version":1,"x":1300,"y":700}')!;
  const viewport = { width: 1000, height: 600 };
  const position = clampThreadPosition(saved, viewport);
  const size = floatingThreadSize(viewport);
  assert.equal(position.x, 504);
  assert.equal(position.y + size.height, viewport.height - 16);
  assert.ok(position.y >= 88);
});

test('short viewport reduces floating height so header and bottom clearance remain reachable', () => {
  for (const height of [250, 400, 600, 800, 1100]) {
    const viewport = { width: 1200, height };
    const position = clampThreadPosition({ x: 900, y: 900 }, viewport);
    const size = floatingThreadSize(viewport);
    assert.ok(position.y >= 88);
    assert.ok(position.y + size.height <= height - 16);
    assert.ok(size.height <= 620);
  }
});

test('floating geometry fits the compact desktop breakpoint and the user preview size', () => {
  assert.equal(THREAD_DESKTOP_WIDTH, 760);
  for (const viewport of [{ width: THREAD_DESKTOP_WIDTH, height: 614 }, { width: 837, height: 614 }]) {
    const size = floatingThreadSize(viewport);
    const position = clampThreadPosition({ x: 900, y: 900 }, viewport);
    assert.equal(size.width, 480);
    assert.ok(position.x >= 16 && position.x + size.width <= viewport.width - 16);
    assert.ok(position.y >= 88 && position.y + size.height <= viewport.height - 16);
  }
});

test('invalid runtime geometry never produces NaN or offscreen coordinates', () => {
  const position = clampThreadPosition({ x: NaN, y: Infinity }, { width: Infinity, height: -10 });
  assert.deepEqual(position, { x: 16, y: 88 });
  for (const viewport of [{ width: 300, height: 160 }, { width: 20, height: 20 }]) {
    const size = floatingThreadSize(viewport);
    const clamped = clampThreadPosition({ x: 1e10, y: 1e10 }, viewport);
    assert.ok(size.width >= 0 && size.height >= 0);
    assert.ok(clamped.x + size.width <= viewport.width);
    assert.ok(clamped.y + size.height <= viewport.height);
  }
});
