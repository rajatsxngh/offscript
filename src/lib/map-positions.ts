export type Point = { x: number; y: number };
export type PositionedRect = Point & { width: number; height: number };
export type MapPositions = Record<string, Point>;

const COORDINATE_LIMIT = 100_000;
const RESERVED_IDS = new Set(['__proto__', 'prototype', 'constructor']);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const validCoordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= COORDINATE_LIMIT;
const isPoint = (value: unknown): value is Point =>
  isRecord(value) && Object.hasOwn(value, 'x') && Object.hasOwn(value, 'y') &&
  validCoordinate(value.x) && validCoordinate(value.y);
const boundedCoordinate = (value: number) => Math.max(-COORDINATE_LIMIT, Math.min(COORDINATE_LIMIT, value));

/** Positions are presentation preferences; unknown topics and corrupt preferences are discarded. */
export function readMapPositions(raw: string | null, allowedIds: readonly string[]): MapPositions {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.positions)) return {};
    const result: MapPositions = {};
    for (const id of new Set(allowedIds)) {
      if (RESERVED_IDS.has(id) || !Object.hasOwn(value.positions, id)) continue;
      const point = value.positions[id];
      if (isPoint(point)) result[id] = { x: point.x, y: point.y };
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeMapPositions(positions: MapPositions): string {
  const clean: MapPositions = {};
  for (const [id, point] of Object.entries(positions)) {
    if (!RESERVED_IDS.has(id) && isPoint(point)) clean[id] = { x: point.x, y: point.y };
  }
  return JSON.stringify({ version: 1, positions: clean });
}

/** Pointer movement arrives in screen pixels while node positions live in canvas coordinates. */
export function moveMapPoint(origin: Point, screenDelta: Point, zoom: number): Point {
  if (!Number.isFinite(zoom) || zoom <= 0 || !Number.isFinite(screenDelta.x) || !Number.isFinite(screenDelta.y)) {
    return { ...origin };
  }
  return {
    x: boundedCoordinate(origin.x + screenDelta.x / zoom),
    y: boundedCoordinate(origin.y + screenDelta.y / zoom),
  };
}

export function fitMapBounds(rects: readonly PositionedRect[], width: number, height: number, padding: { left?: number; right?: number; top?: number; bottom?: number } = {}): Point & { zoom: number } {
  const viewportWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const viewportHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const valid = rects.filter(rect =>
    Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0);
  if (!valid.length) return { x: viewportWidth / 2, y: viewportHeight / 2, zoom: 1 };

  const left = Math.min(...valid.map(rect => rect.x));
  const top = Math.min(...valid.map(rect => rect.y));
  const right = Math.max(...valid.map(rect => rect.x + rect.width));
  const bottom = Math.max(...valid.map(rect => rect.y + rect.height));
  const inset = { left: 32, right: 32, top: 30, bottom: 100, ...padding };
  const availableWidth = Math.max(1, viewportWidth - inset.left - inset.right);
  const availableHeight = Math.max(1, viewportHeight - inset.top - inset.bottom);
  const zoom = Math.max(0.12, Math.min(1.12, availableWidth / (right - left), availableHeight / (bottom - top)));
  return {
    x: inset.left + (availableWidth - (right - left) * zoom) / 2 - left * zoom,
    y: inset.top + (availableHeight - (bottom - top) * zoom) / 2 - top * zoom,
    zoom,
  };
}

export function findAvailableMapPosition(
  preferred: Point,
  size: { width: number; height: number },
  occupied: readonly PositionedRect[],
): Point {
  const gap = 24;
  const clear = (point: Point) => occupied.every(rect =>
    point.x + size.width + gap <= rect.x || point.x >= rect.x + rect.width + gap ||
    point.y + size.height + gap <= rect.y || point.y >= rect.y + rect.height + gap);
  if (clear(preferred)) return { ...preferred };
  const stepX = size.width + gap;
  const stepY = size.height + gap;
  // Walk clockwise around increasingly wide rings, keeping branches near their parent.
  for (let ring = 1; ring <= 16; ring++) {
    const offsets: Point[] = [];
    for (let x = -ring; x <= ring; x++) offsets.push({ x, y: -ring });
    for (let y = -ring + 1; y <= ring; y++) offsets.push({ x: ring, y });
    for (let x = ring - 1; x >= -ring; x--) offsets.push({ x, y: ring });
    for (let y = ring - 1; y > -ring; y--) offsets.push({ x: -ring, y });
    for (const offset of offsets) {
      const point = { x: preferred.x + offset.x * stepX, y: preferred.y + offset.y * stepY };
      if (clear(point)) return point;
    }
  }
  // Dense maps still get a non-overlapping position after the bounded nearby search.
  return { x: Math.max(...occupied.map(rect => rect.x + rect.width)) + gap, y: preferred.y };
}
