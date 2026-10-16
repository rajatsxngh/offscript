export interface Rect { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number };
type Side = 'left' | 'right' | 'top' | 'bottom';

export interface TetherGeometry {
  from: Point;
  to: Point;
  control1: Point;
  control2: Point;
  fromSide: Side;
  toSide: Side;
  path: string;
}

type Interval = { min: number; max: number };
const CLIPPING_TOLERANCE = 0.5;
const right = (rect: Rect) => rect.x + rect.width;
const bottom = (rect: Rect) => rect.y + rect.height;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function validRect(rect: Rect): boolean {
  return [rect.x, rect.y, rect.width, rect.height, right(rect), bottom(rect)].every(Number.isFinite) &&
    rect.width > 0 && rect.height > 0;
}

function intersection(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(right(a), right(b)) - x;
  const height = Math.min(bottom(a), bottom(b)) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

function contains(container: Rect, rect: Rect): boolean {
  return rect.x >= container.x - CLIPPING_TOLERANCE && rect.y >= container.y - CLIPPING_TOLERANCE &&
    right(rect) <= right(container) + CLIPPING_TOLERANCE && bottom(rect) <= bottom(container) + CLIPPING_TOLERANCE;
}

function insetInterval(start: number, length: number, inset: number): Interval {
  const padding = Math.min(inset, length / 2);
  return { min: start + padding, max: start + length - padding };
}

function nearestPorts(source: Interval, target: Interval, sourceCenter: number): [number, number] {
  if (source.max < target.min) return [source.max, target.min];
  if (target.max < source.min) return [source.min, target.max];
  const aligned = clamp(sourceCenter, Math.max(source.min, target.min), Math.min(source.max, target.max));
  return [aligned, aligned];
}

/**
 * Creates a tether in the caller's coordinate system; no DOM or viewport globals.
 * A separating axis keeps the entire cubic outside both rectangle interiors.
 * Hidden or partly occluded source cards intentionally produce no connection.
 */
export function getThreadTetherGeometry(source: Rect, target: Rect, canvas: Rect, viewport: Rect): TetherGeometry | null {
  if (![source, target, canvas, viewport].every(validRect)) return null;
  const visibleCanvas = intersection(canvas, viewport);
  if (!visibleCanvas || !contains(visibleCanvas, source) || !intersection(target, viewport) || intersection(source, target)) return null;

  const candidates: TetherGeometry[] = [];

  function addCandidate(horizontal: boolean, positive: boolean) {
    const fromAxis = horizontal ? (positive ? right(source) : source.x) : (positive ? bottom(source) : source.y);
    const toAxis = horizontal ? (positive ? target.x : right(target)) : (positive ? target.y : bottom(target));
    const viewportAxisMin = horizontal ? viewport.x : viewport.y;
    const viewportAxisMax = horizontal ? right(viewport) : bottom(viewport);
    // The panel can be partially offscreen, but the actual selected port cannot.
    if (toAxis < viewportAxisMin || toAxis > viewportAxisMax) return;

    const sourceInterval = insetInterval(horizontal ? source.y : source.x, horizontal ? source.height : source.width, 24);
    const targetInterval = insetInterval(horizontal ? target.y : target.x, horizontal ? target.height : target.width, 32);
    targetInterval.min = Math.max(targetInterval.min, horizontal ? viewport.y : viewport.x);
    targetInterval.max = Math.min(targetInterval.max, horizontal ? bottom(viewport) : right(viewport));
    if (targetInterval.min > targetInterval.max) return;

    const center = horizontal ? source.y + source.height / 2 : source.x + source.width / 2;
    const [fromAlong, toAlong] = nearestPorts(sourceInterval, targetInterval, center);
    const from = horizontal ? { x: fromAxis, y: fromAlong } : { x: fromAlong, y: fromAxis };
    const to = horizontal ? { x: toAxis, y: toAlong } : { x: toAlong, y: toAxis };
    const bend = Math.min(120, Math.abs(toAxis - fromAxis) / 2) * (positive ? 1 : -1);
    const control1 = horizontal ? { x: from.x + bend, y: from.y } : { x: from.x, y: from.y + bend };
    const control2 = horizontal ? { x: to.x - bend, y: to.y } : { x: to.x, y: to.y - bend };
    if (![from, to, control1, control2].every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return;
    candidates.push({
      from, to, control1, control2,
      fromSide: horizontal ? (positive ? 'right' : 'left') : (positive ? 'bottom' : 'top'),
      toSide: horizontal ? (positive ? 'left' : 'right') : (positive ? 'top' : 'bottom'),
      path: `M ${from.x} ${from.y} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${to.x} ${to.y}`,
    });
  }

  if (right(source) <= target.x) addCandidate(true, true);
  else if (right(target) <= source.x) addCandidate(true, false);
  if (bottom(source) <= target.y) addCandidate(false, true);
  else if (bottom(target) <= source.y) addCandidate(false, false);

  // Diagonal placements offer two safe edge pairs. Prefer the shorter visible one.
  candidates.sort((a, b) => Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y) - Math.hypot(b.to.x - b.from.x, b.to.y - b.from.y));
  return candidates[0] ?? null;
}
