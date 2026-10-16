import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getThreadTetherGeometry, type Rect, type TetherGeometry } from '../src/lib/thread-tether-geometry';

const viewport: Rect = { x: -1000, y: -1000, width: 3000, height: 3000 };
const source: Rect = { x: 200, y: 200, width: 180, height: 150 };

function geometry(target: Rect, node = source) {
  const result = getThreadTetherGeometry(node, target, viewport, viewport);
  assert.ok(result);
  return result;
}

function inside(point: { x: number; y: number }, rect: Rect) {
  const epsilon = 1e-8;
  return point.x > rect.x + epsilon && point.x < rect.x + rect.width - epsilon &&
    point.y > rect.y + epsilon && point.y < rect.y + rect.height - epsilon;
}

function verifySafeCurve(result: TetherGeometry, node: Rect, panel: Rect) {
  for (const control of [result.control1, result.control2]) {
    assert.equal(inside(control, node), false, 'control is outside the node interior');
    assert.equal(inside(control, panel), false, 'control is outside the panel interior');
  }
  assert.ok(Math.hypot(result.control1.x - result.from.x, result.control1.y - result.from.y) <= 120);
  assert.ok(Math.hypot(result.control2.x - result.to.x, result.control2.y - result.to.y) <= 120);
  for (let step = 0; step <= 100; step++) {
    const t = step / 100;
    const u = 1 - t;
    const point = {
      x: u ** 3 * result.from.x + 3 * u ** 2 * t * result.control1.x + 3 * u * t ** 2 * result.control2.x + t ** 3 * result.to.x,
      y: u ** 3 * result.from.y + 3 * u ** 2 * t * result.control1.y + 3 * u * t ** 2 * result.control2.y + t ** 3 * result.to.y,
    };
    assert.equal(inside(point, node), false, `curve enters the node at t=${t}`);
    assert.equal(inside(point, panel), false, `curve enters the panel at t=${t}`);
  }
  assert.match(result.path, /^M [-\d.]+ [-\d.]+ C /);
}

test('panels in all four directions attach to facing edges', () => {
  const cases = [
    { target: { x: 600, y: 100, width: 400, height: 500 }, fromSide: 'right', toSide: 'left', from: { x: 380, y: 275 }, to: { x: 600, y: 275 } },
    { target: { x: -400, y: 100, width: 400, height: 500 }, fromSide: 'left', toSide: 'right', from: { x: 200, y: 275 }, to: { x: 0, y: 275 } },
    { target: { x: 100, y: -400, width: 400, height: 500 }, fromSide: 'top', toSide: 'bottom', from: { x: 290, y: 200 }, to: { x: 290, y: 100 } },
    { target: { x: 100, y: 500, width: 400, height: 500 }, fromSide: 'bottom', toSide: 'top', from: { x: 290, y: 350 }, to: { x: 290, y: 500 } },
  ] as const;
  for (const scenario of cases) {
    const result = geometry(scenario.target);
    assert.equal(result.fromSide, scenario.fromSide);
    assert.equal(result.toSide, scenario.toSide);
    assert.deepEqual(result.from, scenario.from);
    assert.deepEqual(result.to, scenario.to);
    verifySafeCurve(result, source, scenario.target);
  }
});

test('diagonal placements use the shortest inset edge pair and stay outside both rectangles', () => {
  for (const target of [
    { x: 450, y: 450, width: 400, height: 500 },
    { x: -400, y: -400, width: 400, height: 500 },
    { x: 450, y: -400, width: 400, height: 500 },
    { x: -400, y: 450, width: 400, height: 500 },
  ]) verifySafeCurve(geometry(target), source, target);
  const result = geometry({ x: 450, y: 450, width: 400, height: 500 });
  assert.deepEqual(result.from, { x: 356, y: 350 });
  assert.deepEqual(result.to, { x: 482, y: 450 });
});

test('narrow gaps and tiny rectangles do not create oversized or corner-crossing controls', () => {
  const node = { x: 50, y: 50, width: 10, height: 10 };
  const target = { x: 61, y: 53, width: 8, height: 12 };
  const result = geometry(target, node);
  assert.deepEqual(result.from, { x: 60, y: 55 });
  assert.deepEqual(result.to, { x: 61, y: 59 });
  assert.equal(result.control1.x, 60.5);
  assert.equal(result.control2.x, 60.5);
  verifySafeCurve(result, node, target);
});

test('any strict panel overlap hides the tether, including partial occlusion', () => {
  for (const panel of [source, { ...source, x: 379 }, { ...source, x: 21 }, { ...source, y: 349 }, { ...source, y: 51 }, { x: 0, y: 0, width: 1000, height: 1000 }]) {
    assert.equal(getThreadTetherGeometry(source, panel, viewport, viewport), null);
  }
  const touching = { x: 380, y: 200, width: 400, height: 500 };
  verifySafeCurve(geometry(touching), source, touching);
});

test('source must be fully visible inside both canvas and viewport with half-pixel tolerance', () => {
  const panel = { x: 600, y: 100, width: 400, height: 500 };
  const clippedCanvas = { x: 200.6, y: 100, width: 800, height: 500 };
  assert.equal(getThreadTetherGeometry(source, panel, clippedCanvas, viewport), null);
  assert.equal(getThreadTetherGeometry(source, panel, viewport, clippedCanvas), null);
  const tolerated = { ...clippedCanvas, x: 200.5 };
  assert.ok(getThreadTetherGeometry(source, panel, tolerated, viewport));
  for (const clipping of [
    { x: 0, y: 0, width: 379.4, height: 1000 },
    { x: 0, y: 200.6, width: 1000, height: 1000 },
    { x: 0, y: 0, width: 1000, height: 349.4 },
  ]) assert.equal(getThreadTetherGeometry(source, panel, clipping, viewport), null);
});

test('source outside the canvas and targets completely outside the viewport are hidden', () => {
  const screen = { x: 0, y: 0, width: 800, height: 600 };
  assert.equal(getThreadTetherGeometry(source, { x: 900, y: 0, width: 400, height: 500 }, screen, screen), null);
  assert.equal(getThreadTetherGeometry(source, { x: 800, y: 0, width: 400, height: 500 }, screen, screen), null);
  assert.equal(getThreadTetherGeometry(source, { x: 600, y: 100, width: 400, height: 500 }, { x: 1000, y: 0, width: 800, height: 600 }, screen), null);
});

test('partially visible panels attach only to a visible, inset part of their facing edge', () => {
  const screen = { x: 0, y: 0, width: 800, height: 600 };
  const node = { x: 200, y: 350, width: 180, height: 150 };
  const panel = { x: 600, y: -100, width: 400, height: 500 };
  const result = getThreadTetherGeometry(node, panel, screen, screen);
  assert.ok(result);
  assert.equal(result.to.x, 600);
  assert.equal(result.to.y, 368, 'port remains clear of the panel corner');
  verifySafeCurve(result, node, panel);
  const cornerOnly = { x: 600, y: 590, width: 400, height: 500 };
  const cornerResult = getThreadTetherGeometry(source, cornerOnly, screen, screen);
  assert.ok(cornerResult);
  assert.equal(cornerResult.toSide, 'top', 'falls back to a visible edge when the inset side port is offscreen');
  assert.ok(cornerResult.to.x >= 632 && cornerResult.to.x <= 800);
  assert.equal(cornerResult.to.y, 590);
});

test('a visible panel corner with no usable inset edge produces no tether', () => {
  const screen = { x: 0, y: 0, width: 800, height: 600 };
  assert.equal(getThreadTetherGeometry(source, { x: 790, y: 590, width: 400, height: 500 }, screen, screen), null);
});

test('invalid rectangles and coordinate overflow produce no path', () => {
  const panel = { x: 600, y: 100, width: 400, height: 500 };
  for (const invalid of [
    { ...source, width: 0 }, { ...source, height: -1 }, { ...source, x: NaN },
    { ...source, y: Infinity }, { ...source, width: Infinity }, { ...source, x: Number.MAX_VALUE, width: Number.MAX_VALUE },
  ]) {
    assert.equal(getThreadTetherGeometry(invalid, panel, viewport, viewport), null);
    assert.equal(getThreadTetherGeometry(source, invalid, viewport, viewport), null);
    assert.equal(getThreadTetherGeometry(source, panel, invalid, viewport), null);
    assert.equal(getThreadTetherGeometry(source, panel, viewport, invalid), null);
  }
});

test('translated workspace coordinates preserve the complete curve', () => {
  const panel = { x: 600, y: 100, width: 400, height: 500 };
  const original = geometry(panel);
  const translate = (rect: Rect): Rect => ({ ...rect, x: rect.x - 800, y: rect.y - 700 });
  const shifted = getThreadTetherGeometry(translate(source), translate(panel), translate(viewport), translate(viewport));
  assert.ok(shifted);
  for (const key of ['from', 'to', 'control1', 'control2'] as const) {
    assert.deepEqual(shifted[key], { x: original[key].x - 800, y: original[key].y - 700 });
  }
});
