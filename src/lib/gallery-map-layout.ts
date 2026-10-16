import type { Topic } from './types';
import { findAvailableMapPosition, fitMapBounds, type MapPositions, type Point, type PositionedRect } from './map-positions';

export const galleryNodeSize = (root: boolean) => root ? { width: 294, height: 480 } : { width: 264, height: 216 };

/** Short excerpts show an actual branch origin; unanchored edges make no semantic claim. */
export function galleryLinkLabel(quote?: string | null): string[] {
  const text = quote?.replace(/\s+/g, ' ').trim();
  if (!text) return ['Explore further'];
  const excerpt = text.length > 47 ? `${text.slice(0, 46).trimEnd()}…` : text;
  if (excerpt.length < 25) return [excerpt];
  const splitAt = excerpt.lastIndexOf(' ', 25);
  const split = splitAt > 9 ? splitAt : 24;
  return [excerpt.slice(0, split), excerpt.slice(split).trimStart()];
}

/** Place the first ideas around an open center; extend naturally for larger maps. */
export function arrangeGalleryTopics(topics: Topic[], compact: boolean): MapPositions {
  const ids = new Set(topics.map(topic => topic.id));
  const children = new Map<string, Topic[]>();
  for (const topic of topics) if (topic.parentId && ids.has(topic.parentId)) children.set(topic.parentId, [...(children.get(topic.parentId) || []), topic]);
  const visited = new Set<string>();
  const positions: MapPositions = {};
  const occupied: PositionedRect[] = [];
  const slots = compact
    ? [{ x: 0, y: 0 }, { x: 380, y: 18 }, { x: 380, y: 294 }, { x: 0, y: 540 }, { x: 380, y: 570 }, { x: 0, y: 816 }]
    : [{ x: 0, y: 0 }, { x: 548, y: 12 }, { x: 984, y: 12 }, { x: 0, y: 540 }, { x: 984, y: 370 }, { x: 548, y: 270 }, { x: 0, y: 830 }, { x: 984, y: 730 }];
  let index = 0;
  function place(topic: Topic) {
    if (visited.has(topic.id)) return;
    visited.add(topic.id);
    const root = !topic.parentId || !ids.has(topic.parentId);
    const dimensions = galleryNodeSize(root);
    const overflow = index - slots.length;
    const preferred = slots[index] || { x: (overflow % (compact ? 2 : 3)) * (compact ? 380 : 492), y: (compact ? 1010 : 1080) + Math.floor(overflow / (compact ? 2 : 3)) * 300 };
    index++;
    const position = findAvailableMapPosition(preferred, dimensions, occupied);
    positions[topic.id] = position;
    occupied.push({ ...position, ...dimensions });
    for (const child of children.get(topic.id) || []) place(child);
  }
  for (const topic of topics) if (!topic.parentId || !ids.has(topic.parentId)) place(topic);
  // Missing parents and cycles must not make a thought disappear.
  for (const topic of topics) place(topic);
  return positions;
}


/** Initial framing favors readable ideas; the explicit Fit control still reveals the whole map. */
export function frameGalleryMap(rects: readonly PositionedRect[], width: number, height: number, padding: { left: number; right: number; top: number; bottom: number }, focus = rects[0]) {
  const fit = fitMapBounds(rects, width, height, padding);
  if (fit.zoom >= .64 || !focus) return fit;
  const zoom = .64;
  const availableWidth = Math.max(1, width - padding.left - padding.right);
  const availableHeight = Math.max(1, height - padding.top - padding.bottom);
  return {
    zoom,
    x: padding.left + Math.max(0, Math.min(80, (availableWidth - focus.width * zoom) * .24)) - focus.x * zoom,
    y: padding.top + Math.max(0, Math.min(24, (availableHeight - focus.height * zoom) * .12)) - focus.y * zoom,
  };
}

/** A narrow connector may be clearer without a label than with text crossing an idea. */
export function galleryLabelFits(point: Point, lineCount: number, nodes: readonly PositionedRect[]): boolean {
  const width = 164, height = lineCount > 1 ? 54 : 38;
  const label = { x: point.x - width / 2, y: point.y - height / 2, width, height };
  return nodes.every(node => label.x + width <= node.x || label.x >= node.x + node.width || label.y + height <= node.y || label.y >= node.y + node.height);
}
