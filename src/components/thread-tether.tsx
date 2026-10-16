'use client';

import { useEffect, useRef, useState } from 'react';
import { getThreadTetherGeometry, type Rect, type TetherGeometry } from '@/lib/thread-tether-geometry';
import './thread-tether.css';

/** Attaches to rendered edges, so the connector follows both the map and floating panel. */
export function ThreadTether({ topicId }: { topicId: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [connection, setConnection] = useState<TetherGeometry | null>(null);

  useEffect(() => {
    const workspace = ref.current?.closest('.lumen-workspace');
    const node = workspace?.querySelector<HTMLElement>(`[data-topic-id="${CSS.escape(topicId)}"]`);
    const canvas = workspace?.querySelector<HTMLElement>('.thought-map-canvas');
    const world = workspace?.querySelector<HTMLElement>('.thought-map-world');
    const panel = workspace?.querySelector<HTMLElement>('.topic-thread');
    const backdrop = panel?.closest('.thread-backdrop');
    const mapArea = canvas?.closest('.map-work-area');
    if (!workspace || !node || !canvas || !world || !panel) return;

    const desktop = window.matchMedia('(min-width: 760px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    // CSS arrival/resize motion is sampled only for a finite window. Pointer motion
    // schedules a measurement through style mutations, without an idle render loop.
    let trackUntil = reducedMotion.matches ? 0 : performance.now() + 650;

    function measure() {
      frame = 0;
      const unavailable = !desktop.matches || !node!.isConnected || !panel!.isConnected ||
        panel!.getAttribute('aria-modal') === 'true' || panel!.getAttribute('role') === 'dialog' ||
        panel!.getAttribute('aria-hidden') === 'true' || panel!.hasAttribute('inert') ||
        backdrop?.classList.contains('is-modal') || getComputedStyle(node!).visibility === 'hidden' ||
        getComputedStyle(panel!).visibility === 'hidden';
      let next: TetherGeometry | null = null;
      if (!unavailable) {
        const origin = workspace!.getBoundingClientRect();
        const relativeRect = (element: Element): Rect => {
          const rect = element.getBoundingClientRect();
          return { x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height };
        };
        next = getThreadTetherGeometry(relativeRect(node!), relativeRect(panel!), relativeRect(canvas!), {
          x: -origin.left, y: -origin.top, width: window.innerWidth, height: window.innerHeight,
        });
      }
      setConnection(current => current?.path === next?.path && current?.fromSide === next?.fromSide && current?.toSide === next?.toSide ? current : next);
      if (performance.now() < trackUntil) frame = requestAnimationFrame(measure);
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const trackMotion = (event: Event) => {
      // Ignore our own reveal animation and cosmetic transitions inside the chat.
      if (![workspace, canvas, world, panel, mapArea].includes(event.target as Element)) return;
      trackUntil = reducedMotion.matches ? 0 : performance.now() + 650;
      schedule();
    };
    const mediaChanged = () => {
      if (reducedMotion.matches) trackUntil = 0;
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    [workspace, canvas, node, panel].forEach(element => resize.observe(element));
    const changes = new MutationObserver(schedule);
    changes.observe(world, { subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    changes.observe(panel, { attributes: true, attributeFilter: ['style', 'class', 'role', 'aria-modal', 'aria-hidden', 'inert'] });
    changes.observe(workspace, { attributes: true, attributeFilter: ['style', 'class'] });
    if (backdrop) changes.observe(backdrop, { attributes: true, attributeFilter: ['style', 'class'] });
    workspace.addEventListener('transitionrun', trackMotion);
    workspace.addEventListener('animationstart', trackMotion);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    desktop.addEventListener('change', mediaChanged);
    reducedMotion.addEventListener('change', mediaChanged);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect(); changes.disconnect();
      workspace.removeEventListener('transitionrun', trackMotion);
      workspace.removeEventListener('animationstart', trackMotion);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      desktop.removeEventListener('change', mediaChanged);
      reducedMotion.removeEventListener('change', mediaChanged);
    };
  }, [topicId]);

  return <svg ref={ref} className="thread-tether" aria-hidden="true">
    {connection && <g key={topicId} className="thread-tether-connection" data-source-side={connection.fromSide} data-panel-side={connection.toSide}>
      <path className="tether-bloom" d={connection.path} />
      <path className="tether-bed" d={connection.path} />
      <path className="tether-line" d={connection.path} />
      <circle className="tether-halo" cx={connection.from.x} cy={connection.from.y} r="9" />
      <circle className="tether-port" cx={connection.from.x} cy={connection.from.y} r="4.5" />
      <circle className="tether-halo" cx={connection.to.x} cy={connection.to.y} r="9" />
      <circle className="tether-port" cx={connection.to.x} cy={connection.to.y} r="4.5" />
    </g>}
  </svg>;
}
