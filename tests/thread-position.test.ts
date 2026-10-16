import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampThreadPosition, defaultThreadPosition, floatingThreadSize, readThreadPosition, threadPositionKey, THREAD_DESKTOP_WIDTH } from '../src/lib/thread-position';

test('saved thread positions are versioned, finite and isolated per map', () => {
  assert.deepEqual(readThreadPosition(JSON.stringify({ version: 1, x: 230.5, y: 120 })), { x: 230.5, y: 120 });
  assert.notEqual(threadPositionKey('first-map'), threadPositionKey('second-map'));
  for (const raw of [null, '', '{', 'null', '[]', '{"x":1,"y":2}', '{"version":2,"x":1,"y":2}', '{"version":1,"x":"12","y":2}', '{"version":1,"x":1e309,"y":2}', '{"version":1,"x":1000001,"y":2}', ' '.repeat(513)]) {
    assert.equal(readThreadPosition(raw), null, String(raw));
  }
});

test('panel clamps all four edges below the header with full dimensions visible', () => {
  const viewport = { width: 1440, height: 900 };
  const size = floatingThreadSize(viewport);
  assert.equal(size.width, 580);
  assert.ok(Math.abs(size.height - 495) < .001);
  assert.deepEqual(clampThreadPosition({ x: -50, y: -20 }, viewport), { x: 16, y: 128 });
  const bottomRight = clampThreadPosition({ x: 5000, y: 5000 }, viewport);
  assert.equal(bottomRight.x, 844);
  assert.ok(Math.abs(bottomRight.y - 389) < .001);
  assert.deepEqual(clampThreadPosition({ x: 240.5, y: 150 }, viewport), { x: 240.5, y: 150 });
});

test('restored position is clamped again after a smaller window replaces the original viewport', () => {
  const saved = readThreadPosition('{"version":1,"x":1300,"y":700}')!;
  const viewport = { width: 1000, height: 600 };
  const position = clampThreadPosition(saved, viewport);
  const size = floatingThreadSize(viewport);
  assert.equal(position.x, 484);
  assert.equal(position.y + size.height, viewport.height - 16);
  assert.ok(position.y >= (viewport.width >= 1000 ? 128 : 112));
});

test('short viewport reduces floating height so header and bottom clearance remain reachable', () => {
  for (const height of [250, 400, 600, 800, 1100]) {
    const viewport = { width: 1200, height };
    const position = clampThreadPosition({ x: 900, y: 900 }, viewport);
    const size = floatingThreadSize(viewport);
    assert.ok(position.y >= (viewport.width >= 1000 ? 128 : 112));
    assert.ok(position.y + size.height <= height - 16);
    assert.ok(size.height <= 660);
  }
});

test('floating geometry fits the compact desktop breakpoint and the user preview size', () => {
  assert.equal(THREAD_DESKTOP_WIDTH, 760);
  for (const viewport of [{ width: THREAD_DESKTOP_WIDTH, height: 614 }, { width: 837, height: 614 }]) {
    const size = floatingThreadSize(viewport);
    const position = clampThreadPosition({ x: 900, y: 900 }, viewport);
    assert.equal(size.width, 440);
    assert.ok(position.x >= 16 && position.x + size.width <= viewport.width - 16);
    assert.ok(position.y >= (viewport.width >= 1000 ? 128 : 112) && position.y + size.height <= viewport.height - 16);
  }
});

test('invalid runtime geometry never produces NaN or offscreen coordinates', () => {
  const position = clampThreadPosition({ x: NaN, y: Infinity }, { width: Infinity, height: -10 });
  assert.deepEqual(position, { x: 16, y: 128 });
  for (const viewport of [{ width: 300, height: 160 }, { width: 20, height: 20 }]) {
    const size = floatingThreadSize(viewport);
    const clamped = clampThreadPosition({ x: 1e10, y: 1e10 }, viewport);
    assert.ok(size.width >= 0 && size.height >= 0);
    assert.ok(clamped.x + size.width <= viewport.width);
    assert.ok(clamped.y + size.height <= viewport.height);
  }
});

test('gallery default leaves the upper canvas open and fits without changing size on drag', () => {
  for (const viewport of [{ width: 1470, height: 900 }, { width: 1920, height: 1080 }, { width: 837, height: 614 }, { width: 760, height: 250 }]) {
    const position = defaultThreadPosition(viewport);
    const size = floatingThreadSize(viewport);
    assert.ok(position.x >= 16 && position.x + size.width <= viewport.width - 16);
    assert.ok(position.y >= (viewport.width >= 1000 ? 128 : 112) && position.y + size.height <= viewport.height - 16);
    assert.deepEqual(clampThreadPosition(position, viewport), position);
    if (viewport.width >= 1100) assert.ok(position.y >= viewport.height * .3);
  }
  const defaultPosition = defaultThreadPosition({ width: 1470, height: 900 });
  assert.equal(defaultPosition.x, 705.6);
  assert.ok(Math.abs(defaultPosition.y - 381) < .001);
});

test('compact desktop cards leave room to see and interact with the map', () => {
  assert.equal(floatingThreadSize({ width: 837, height: 614 }).width, 440);
  assert.equal(floatingThreadSize({ width: 1000, height: 800 }).width, 500);
  assert.equal(floatingThreadSize({ width: 1098, height: 800 }).width, 549);
  assert.equal(floatingThreadSize({ width: 1100, height: 800 }).width, 580);
});

test('wide desktops retain conversation space through height breakpoints', () => {
  const shortViewport = { width: 1280, height: 720 };
  assert.deepEqual(floatingThreadSize(shortViewport), { width: 580, height: 480 });
  assert.deepEqual(defaultThreadPosition(shortViewport), { x: 614.4, y: 216 });
  assert.equal(floatingThreadSize({ width: 1440, height: 800 }).height, 480);
  assert.equal(floatingThreadSize({ width: 1280, height: 600 }).height, 456);
  assert.equal(floatingThreadSize({ width: 1230, height: 846 }).height, 480);
  assert.equal(defaultThreadPosition({ width: 1230, height: 846 }).y, 342);
  assert.ok(floatingThreadSize({ width: 1280, height: 801 }).height >= floatingThreadSize({ width: 1280, height: 800 }).height);
  assert.equal(floatingThreadSize({ width: 1600, height: 1100 }).height, 605);
  const position = defaultThreadPosition(shortViewport);
  assert.deepEqual(clampThreadPosition(position, shortViewport), position);
});
