export interface ThreadPosition { x: number; y: number }
export interface ThreadViewport { width: number; height: number }

export const THREAD_DESKTOP_WIDTH = 760;

export function threadPositionKey(mapId: string): string {
  return `offscript:gallery:thread-position:v1:${mapId}`;
}

/** A missing or malformed value leaves the panel in its original dock. */
export function readThreadPosition(raw: string | null): ThreadPosition | null {
  if (!raw || raw.length > 512) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const saved = value as Record<string, unknown>;
    if (saved.version !== 1 || typeof saved.x !== 'number' || typeof saved.y !== 'number') return null;
    if (!Number.isFinite(saved.x) || !Number.isFinite(saved.y) || Math.abs(saved.x) > 1_000_000 || Math.abs(saved.y) > 1_000_000) return null;
    return { x: saved.x, y: saved.y };
  } catch { return null; }
}

function usableViewport(viewport: ThreadViewport): ThreadViewport {
  return {
    width: Number.isFinite(viewport.width) && viewport.width > 0 ? viewport.width : 1000,
    height: Number.isFinite(viewport.height) && viewport.height > 0 ? viewport.height : 800,
  };
}

/** Keep the entire floating panel below the app header, including on short windows. */
export function floatingThreadSize(viewport: ThreadViewport): ThreadViewport {
  const { width, height } = usableViewport(viewport);
  const top = Math.min(width >= 1000 ? 128 : 112, Math.max(0, height - 16));
  // Wide canvases leave an upper row of ideas visible above the conversation.
  const heightRatio = width >= 1100 ? .55 : .76;
  const panelWidth = width >= 1100 ? 580 : Math.max(440, width * .5);
  // Preserve reading room as wide desktop windows cross height breakpoints.
  const preferredHeight = width >= 1100 ? Math.max(480, height * heightRatio) : height * heightRatio;
  return { width: Math.max(0, Math.min(panelWidth, width - 32)), height: Math.max(0, Math.min(660, preferredHeight, height - top - 16)) };
}

export function clampThreadPosition(position: ThreadPosition, viewport: ThreadViewport): ThreadPosition {
  const { width, height } = usableViewport(viewport);
  const size = floatingThreadSize({ width, height });
  const left = Math.min(16, Math.max(0, width - size.width));
  const top = Math.min(width >= 1000 ? 128 : 112, Math.max(0, height - size.height));
  return {
    x: Math.max(left, Math.min(Number.isFinite(position.x) ? position.x : left, Math.max(left, width - size.width - 16))),
    y: Math.max(top, Math.min(Number.isFinite(position.y) ? position.y : top, Math.max(top, height - size.height - 16))),
  };
}

/** A reset returns to the lower-right gallery composition, using the same size as dragging. */
export function defaultThreadPosition(viewport: ThreadViewport): ThreadPosition {
  const usable = usableViewport(viewport);
  const size = floatingThreadSize(usable);
  return clampThreadPosition({ x: usable.width * .48, y: usable.height - size.height - 24 }, usable);
}
