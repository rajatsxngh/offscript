export interface ThreadPosition { x: number; y: number }
export interface ThreadViewport { width: number; height: number }

export const THREAD_DESKTOP_WIDTH = 760;

export function threadPositionKey(mapId: string): string {
  return `offscript:thread-position:v1:${mapId}`;
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
  const top = Math.min(88, Math.max(0, height - 16));
  return { width: Math.max(0, Math.min(480, width - 32)), height: Math.max(0, Math.min(620, height * .76, height - top - 16)) };
}

export function clampThreadPosition(position: ThreadPosition, viewport: ThreadViewport): ThreadPosition {
  const { width, height } = usableViewport(viewport);
  const size = floatingThreadSize({ width, height });
  const left = Math.min(16, Math.max(0, width - size.width));
  const top = Math.min(88, Math.max(0, height - size.height));
  return {
    x: Math.max(left, Math.min(Number.isFinite(position.x) ? position.x : left, Math.max(left, width - size.width - 16))),
    y: Math.max(top, Math.min(Number.isFinite(position.y) ? position.y : top, Math.max(top, height - size.height - 16))),
  };
}
