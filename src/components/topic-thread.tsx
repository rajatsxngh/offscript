'use client';

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { clampThreadPosition, floatingThreadSize, readThreadPosition, threadPositionKey, THREAD_DESKTOP_WIDTH, type ThreadPosition } from '../lib/thread-position';
import './topic-thread.css';

interface PanelDrag {
  pointerId: number;
  mapId: string;
  handle: HTMLElement;
  start: ThreadPosition;
  origin: ThreadPosition;
  previous: ThreadPosition | null;
  moved: boolean;
}

/** Keeps a topic in context without replacing or remounting its map. */
export function TopicThread({ title, mapId, suspended, onClose, onFloatingChange, children }: {
  title: string;
  mapId: string;
  suspended: boolean;
  onClose: () => void;
  onFloatingChange: (floating: boolean) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isModal, setIsModal] = useState(false);
  const [placement, setPlacement] = useState<{ mapId: string; position: ThreadPosition | null }>({ mapId, position: null });
  const [viewport, setViewport] = useState({ width: 1000, height: 800 });
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const positionRef = useRef<ThreadPosition | null>(null);
  const drag = useRef<PanelDrag | null>(null);
  const latest = useRef({ onClose, onFloatingChange, suspended, mapId });
  latest.current = { onClose, onFloatingChange, suspended, mapId };
  const position = placement.mapId === mapId ? placement.position : null;
  const isFloating = !isModal && position !== null;

  function place(next: ThreadPosition | null) {
    positionRef.current = next;
    setPlacement({ mapId: latest.current.mapId, position: next });
  }

  function persist(next: ThreadPosition | null) {
    try {
      const key = threadPositionKey(latest.current.mapId);
      if (next) localStorage.setItem(key, JSON.stringify({ version: 1, ...next }));
      else localStorage.removeItem(key);
      return true;
    } catch { return false; }
  }

  function finishDrag(cancel: boolean, pointerId?: number) {
    const current = drag.current;
    if (!current || (pointerId !== undefined && current.pointerId !== pointerId)) return;
    drag.current = null;
    setDragging(false);
    if (current.mapId === latest.current.mapId && current.moved) {
      if (cancel) { place(current.previous); setAnnouncement('Move canceled. Chat returned to its previous position.'); }
      else setAnnouncement(persist(positionRef.current) ? 'Chat position saved for this map.' : 'Chat moved. Position is kept for this session.');
    }
    if (current.handle.hasPointerCapture(current.pointerId)) current.handle.releasePointerCapture(current.pointerId);
  }

  function dock() {
    finishDrag(true);
    ref.current?.querySelector<HTMLElement>('[data-thread-drag-handle]')?.focus({ preventScroll: true });
    place(null);
    setAnnouncement(persist(null) ? 'Chat docked to the right.' : 'Chat docked for this session.');
  }

  useLayoutEffect(() => {
    let saved: ThreadPosition | null = null;
    try { saved = readThreadPosition(localStorage.getItem(threadPositionKey(mapId))); } catch { /* Storage may be unavailable. */ }
    const size = { width: window.innerWidth, height: window.innerHeight };
    place(saved && size.width >= THREAD_DESKTOP_WIDTH ? clampThreadPosition(saved, size) : saved);
    setViewport(size);
    setIsModal(size.width < THREAD_DESKTOP_WIDTH);
    function resize() {
      finishDrag(true);
      const next = { width: window.innerWidth, height: window.innerHeight };
      setViewport(next);
      setIsModal(next.width < THREAD_DESKTOP_WIDTH);
      if (next.width >= THREAD_DESKTOP_WIDTH && positionRef.current) place(clampThreadPosition(positionRef.current, next));
    }
    window.addEventListener('resize', resize);
    return () => { window.removeEventListener('resize', resize); finishDrag(true); };
  }, [mapId]);

  useLayoutEffect(() => { latest.current.onFloatingChange(isFloating); }, [isFloating, mapId]);
  useLayoutEffect(() => () => { latest.current.onFloatingChange(false); }, []);
  useEffect(() => { if (suspended) finishDrag(true); }, [suspended]);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (latest.current.suspended || window.innerWidth < THREAD_DESKTOP_WIDTH || event.button !== 0 || !event.isPrimary || drag.current) return;
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-thread-drag-handle]');
    if (!handle || !event.currentTarget.contains(handle)) return;
    const control = target.closest('button, a, input, textarea, select, [contenteditable="true"], [role="button"]');
    if (control && control !== handle) return;
    event.preventDefault();
    event.stopPropagation();
    ref.current?.getAnimations().forEach(animation => animation.cancel());
    const bounds = ref.current!.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, mapId: latest.current.mapId, handle, start: { x: event.clientX, y: event.clientY }, origin: { x: bounds.left, y: bounds.top }, previous: positionRef.current, moved: false };
    handle.focus({ preventScroll: true });
    handle.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (latest.current.suspended || window.innerWidth < THREAD_DESKTOP_WIDTH) { finishDrag(true); return; }
    const dx = event.clientX - current.start.x, dy = event.clientY - current.start.y;
    if (!current.moved && Math.hypot(dx, dy) < 4) return;
    event.preventDefault();
    event.stopPropagation();
    current.moved = true;
    setDragging(true);
    place(clampThreadPosition({ x: current.origin.x + dx, y: current.origin.y + dy }, { width: window.innerWidth, height: window.innerHeight }));
  }

  function panelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || latest.current.suspended || window.innerWidth < THREAD_DESKTOP_WIDTH) return;
    if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); finishDrag(true); return; }
    const target = event.target as HTMLElement;
    const handle = target.closest<HTMLElement>('[data-thread-drag-handle]');
    if (!handle || !event.currentTarget.contains(handle)) return;
    if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); dock(); return; }
    const directions: Record<string, ThreadPosition> = { ArrowLeft: { x: -20, y: 0 }, ArrowRight: { x: 20, y: 0 }, ArrowUp: { x: 0, y: -20 }, ArrowDown: { x: 0, y: 20 } };
    const direction = event.shiftKey ? directions[event.key] : undefined;
    if (direction) {
      event.preventDefault(); event.stopPropagation(); finishDrag(true);
      ref.current?.getAnimations().forEach(animation => animation.cancel());
      const bounds = ref.current!.getBoundingClientRect();
      const origin = positionRef.current || { x: bounds.left, y: bounds.top };
      const next = clampThreadPosition({ x: origin.x + direction.x, y: origin.y + direction.y }, { width: window.innerWidth, height: window.innerHeight });
      place(next); persist(next); setAnnouncement('Chat moved. Press Home to dock it.');
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); setAnnouncement('Use Shift and the arrow keys to move the chat. Press Home to dock it.');
    }
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const content = ref.current?.querySelector<HTMLElement>('.thread-scroll');
    const animation = content?.animate(
      [{ opacity: 0.55, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 240, easing: 'cubic-bezier(.2, .7, .2, 1)' },
    );
    return () => animation?.cancel();
  }, [title]);

  useEffect(() => {
    const launcher = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const workspace = panel?.closest('.lumen-workspace');
    const smallViewport = window.matchMedia(`(max-width: ${THREAD_DESKTOP_WIDTH - 1}px)`);
    const syncViewport = () => {
      setIsModal(smallViewport.matches);
      if (smallViewport.matches && !latest.current.suspended && !panel?.contains(document.activeElement)) {
        panel?.querySelector<HTMLElement>('[data-thread-close]')?.focus({ preventScroll: true });
      }
    };
    syncViewport();
    smallViewport.addEventListener('change', syncViewport);
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, textarea, select, [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
    panel?.querySelector<HTMLElement>('[data-thread-close]')?.focus({ preventScroll: true });
    function onKey(event: KeyboardEvent) {
      if (latest.current.suspended || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        if (drag.current) { event.preventDefault(); finishDrag(true); return; }
        if (smallViewport.matches || panel?.contains(document.activeElement)) {
          event.preventDefault();
          latest.current.onClose();
        }
        return;
      }
      if (event.key !== 'Tab' || !smallViewport.matches) return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (!panel?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      smallViewport.removeEventListener('change', syncViewport);
      requestAnimationFrame(() => {
        const available = (element: HTMLElement | null | undefined) => !!element?.isConnected && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
        const currentMap = workspace?.querySelector('.map-work-area .thought-map');
        const selected = currentMap?.querySelector<HTMLElement>('[data-selected-topic="true"]');
        const launcherNode = launcher?.closest<HTMLElement>('[data-topic-id]');
        const launcherAvailable = available(launcher) && (!launcherNode || currentMap?.contains(launcherNode));
        const selectedAvailable = available(selected);
        const changedNode = launcherNode && selected && launcherNode.dataset.topicId !== selected.dataset.topicId;
        const target = changedNode && selectedAvailable ? selected : launcherAvailable ? launcher : selectedAvailable ? selected : null;
        if (!target) return;
        // Returning focus should preserve the user's exact map pan and zoom.
        target.dataset.restoringFocus = 'true';
        target.focus({ preventScroll: true });
        delete target.dataset.restoringFocus;
      });
    };
  }, []);

  const floatingSize = floatingThreadSize(viewport);
  return <div className={`thread-backdrop ${isModal ? 'is-modal' : isFloating ? 'is-floating' : 'is-docked'}`} onMouseDown={event => { if (isModal && event.target === event.currentTarget && !suspended) onClose(); }}>
    <div ref={ref} className={`topic-thread${dragging ? ' is-dragging' : ''}`} style={isFloating ? { left: position.x, top: position.y, width: floatingSize.width, height: floatingSize.height } : undefined} role={isModal ? 'dialog' : 'complementary'} aria-modal={isModal && !suspended ? true : undefined} aria-label={`${title} thread`} aria-hidden={suspended || undefined} inert={suspended}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => finishDrag(false, event.pointerId)} onPointerCancel={event => finishDrag(true, event.pointerId)} onLostPointerCapture={event => finishDrag(true, event.pointerId)} onKeyDown={panelKeyDown}
      onClick={event => { if (!isModal && !suspended && (event.target as HTMLElement).closest('[data-thread-dock]')) { event.preventDefault(); dock(); } }}>
      <div className="thread-surface">{children}</div>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </div>
  </div>;
}
