'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Focus, Grip, Lightbulb, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import type { Topic } from '@/lib/types';
import { findAvailableMapPosition, fitMapBounds, moveMapPoint, readMapPositions, serializeMapPositions, type MapPositions, type Point } from '@/lib/map-positions';
import { arrangeGalleryTopics, galleryNodeSize, galleryLinkLabel, frameGalleryMap, galleryLabelFits } from '@/lib/gallery-map-layout';
import './topic-map.css';

type MapNode = Point & { topic: Topic; width: number; height: number; root: boolean };
type Viewport = Point & { zoom: number };
type NodeDrag = { id: string; pointerId: number; start: Point; origin: Point; zoom: number; moved: boolean };
const statusNames = { exploring: 'Exploring', understood: 'Clear for now', revisit: 'Revisit' };
const clampZoom = (zoom: number) => Math.max(.12, Math.min(1.8, zoom));
const storageKey = (notebookId: string) => `offscript:gallery-map-layout:v1:${notebookId}`;
const nodeSize = galleryNodeSize;
const arrangeTopics = arrangeGalleryTopics;
const fitPadding = (width: number) => width < 700 ? { left: 26, right: 26, top: 124, bottom: 110 } : { left: 58, right: 48, top: 154, bottom: 104 };

function connection(parent: MapNode, child: MapNode) {
  const dx = child.x - parent.x;
  const dy = child.y - parent.y;
  const horizontal = Math.abs(dx) > 200;
  const direction = (horizontal ? dx : dy) >= 0 ? 1 : -1;
  const from = horizontal
    ? { x: parent.x + (direction > 0 ? parent.width + 8 : -8), y: parent.y + 52 }
    : { x: parent.x + 10, y: parent.y + (direction > 0 ? 82 : 24) };
  const to = horizontal
    ? { x: child.x + (direction > 0 ? -12 : child.width + 12), y: child.y + 52 }
    : { x: child.x + 10, y: child.y + (direction > 0 ? 24 : child.height + 12) };
  const bend = Math.max(40, Math.min(190, Math.abs(horizontal ? to.x - from.x : to.y - from.y) * .46));
  const a = horizontal ? { x: from.x + bend * direction, y: from.y } : { x: from.x - 75, y: from.y + bend * direction };
  const b = horizontal ? { x: to.x - bend * direction, y: to.y } : { x: to.x - 75, y: to.y - bend * direction };
  return {
    from, to,
    labelPoint: { x: (from.x + 3 * a.x + 3 * b.x + to.x) / 8, y: (from.y + 3 * a.y + 3 * b.y + to.y) / 8 },
    path: `M ${from.x} ${from.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${to.x} ${to.y}`,
  };
}

function TopicGlyph({ topic, root }: { topic: Topic; root: boolean }) {
  if (!root || !topic.blocks.some(block => block.type === 'chart')) return null;
  const curve = Array.from({ length: 81 }, (_, index) => {
    const x = index / 80 * 238 + 1;
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${(118 - Math.exp(-.5 * ((index - 40) / 13.2) ** 2) * 105).toFixed(2)}`;
  }).join(' ');
  return <span className="thought-node-glyph is-curve" aria-hidden="true"><svg viewBox="0 0 240 153">
    <path className="thought-glyph-axis" d="M1 4V122H239" />
    {[40, 80, 120, 160, 200].map((x, index) => <g key={x}><path className="thought-glyph-guide" d={`M${x} ${118 - Math.exp(-.5 * ((x - 120) / 39.6) ** 2) * 105}V126`} /><text className="thought-glyph-label" x={x} y="143" textAnchor="middle">{['μ − 2σ', 'μ − σ', 'μ', 'μ + σ', 'μ + 2σ'][index]}</text></g>)}
    <path className="thought-glyph-curve" d={curve} />
  </svg><span className="thought-chart-caption">A closer look at the shape of this idea.</span></span>;
}

export function TopicMap({ topics, selectedId, onSelect, onCreate }: { topics: Topic[]; selectedId?: string; onSelect: (id: string) => void; onCreate: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const arrowId = useId().replaceAll(':', '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<MapPositions>({});
  const positionsRef = useRef(positions);
  const [ready, setReady] = useState(false);
  const loadedNotebook = useRef<string | null>(null);
  const notebookId = topics[0]?.notebookId || '';
  const topologyKey = topics.map(topic => `${topic.id}:${topic.parentId || ''}`).join('|');
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef(viewport);
  const userFramedView = useRef(false);
  viewportRef.current = viewport;
  const [panning, setPanning] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const pan = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);
  const nodeDrag = useRef<NodeDrag | null>(null);
  const suppressClick = useRef<string | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number; world: Point } | null>(null);
  const ids = useMemo(() => new Set(topics.map(topic => topic.id)), [topics]);
  const nodes = useMemo(() => topics.map(topic => ({ topic, ...(positions[topic.id] || { x: 0, y: 0 }), ...nodeSize(!topic.parentId || !ids.has(topic.parentId)), root: !topic.parentId || !ids.has(topic.parentId) })), [topics, positions, ids]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const nodeLookup = useMemo(() => new Map(nodes.map(node => [node.topic.id, node])), [nodes]);
  const selectedPath = useMemo(() => {
    const parents = new Map(topics.map(topic => [topic.id, topic.parentId]));
    const path = new Set<string>();
    let current = selectedId;
    while (current && parents.has(current) && !path.has(current)) {
      path.add(current);
      current = parents.get(current) || undefined;
    }
    return path;
  }, [topics, selectedId]);
  const links = useMemo(() => nodes.flatMap(node => {
    const parent = node.topic.parentId ? nodeLookup.get(node.topic.parentId) : undefined;
    if (!parent || parent === node) return [];
    return [{ id: node.topic.id, parentId: parent.topic.id, ...connection(parent, node), label: galleryLinkLabel(node.topic.anchor?.quote), active: selectedPath.has(node.topic.id) && selectedPath.has(parent.topic.id) }];
  }), [nodes, nodeLookup, selectedPath]);


  function updatePositions(next: MapPositions) {
    positionsRef.current = next;
    setPositions(next);
  }
  function persist(next: MapPositions) {
    if (!notebookId) return false;
    try { localStorage.setItem(storageKey(notebookId), serializeMapPositions(next)); setStorageWarning(false); return true; }
    catch { setStorageWarning(true); return false; }
  }

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(canvas); return () => observer.disconnect();
  }, []);

  const measured = size.width > 0 && size.height > 0;
  useEffect(() => {
    if (!measured) return;
    const firstLoad = loadedNotebook.current !== notebookId;
    let previous = positionsRef.current;
    if (firstLoad) {
      userFramedView.current = false;
      try { previous = readMapPositions(notebookId ? localStorage.getItem(storageKey(notebookId)) : null, topics.map(topic => topic.id)); }
      catch { previous = {}; setStorageWarning(true); }
      loadedNotebook.current = notebookId;
    }
    const defaults = arrangeTopics(topics, size.width < 700);
    const next: MapPositions = {};
    const occupied: (Point & { width: number; height: number })[] = [];
    topics.forEach(topic => {
      if (!previous[topic.id]) return;
      next[topic.id] = previous[topic.id];
      occupied.push({ ...previous[topic.id], ...nodeSize(!topic.parentId || !ids.has(topic.parentId)) });
    });
    const hasPrevious = occupied.length > 0;
    // Defaults are inserted parent-first, so a new child can follow its moved parent.
    Object.keys(defaults).forEach(id => {
      if (next[id]) return;
      const topic = topics.find(item => item.id === id)!;
      const dimensions = nodeSize(!topic.parentId || !ids.has(topic.parentId));
      const parent = topic.parentId ? next[topic.parentId] : undefined;
      const parentTopic = topic.parentId ? topics.find(item => item.id === topic.parentId) : undefined;
      const preferred = hasPrevious && parent && parentTopic ? { x: parent.x + nodeSize(!parentTopic.parentId || !ids.has(parentTopic.parentId)).width + 64, y: parent.y + 30 } : defaults[id];
      next[id] = findAvailableMapPosition(preferred, dimensions, occupied);
      occupied.push({ ...next[id], ...dimensions });
    });
    updatePositions(next);
    persist(next);
    setReady(true);
    if (firstLoad) {
      const rects = topics.map(topic => ({ ...next[topic.id], ...nodeSize(!topic.parentId || !ids.has(topic.parentId)), root: !topic.parentId || !ids.has(topic.parentId) }));
      setViewport(frameGalleryMap(rects, size.width, size.height, fitPadding(size.width), rects.find(node => node.root)));
    }
    // Only the notebook and hierarchy change the arrangement. Edits and viewport changes do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, topologyKey, measured]);

  const fit = useCallback(() => {
    userFramedView.current = true;
    setViewport(fitMapBounds(nodesRef.current.map(node => ({ ...node, ...(positionsRef.current[node.topic.id] || node) })), size.width, size.height, fitPadding(size.width)));
  }, [size.width, size.height]);
  useEffect(() => {
    if (!ready || !measured || nodeDrag.current || userFramedView.current) return;
    const rects = nodesRef.current.map(node => ({ ...node, ...(positionsRef.current[node.topic.id] || node) }));
    setViewport(frameGalleryMap(rects, size.width, size.height, fitPadding(size.width), rects.find(node => node.root)));
  }, [size.width, size.height, ready, measured]);

  const zoomAt = useCallback((factor: number, point?: Point) => {
    userFramedView.current = true;
    setViewport(current => {
      const center = point || { x: size.width / 2, y: size.height / 2 };
      const zoom = clampZoom(current.zoom * factor);
      return { zoom, x: center.x - (center.x - current.x) * zoom / current.zoom, y: center.y - (center.y - current.y) * zoom / current.zoom };
    });
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (nodeDrag.current) return;
      userFramedView.current = true;
      if (event.ctrlKey || event.metaKey) {
        const rect = canvas.getBoundingClientRect();
        zoomAt(Math.exp(-event.deltaY * .008), { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else setViewport(current => ({ ...current, x: current.x - (event.shiftKey ? event.deltaY : event.deltaX), y: current.y - (event.shiftKey ? 0 : event.deltaY) }));
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button') || event.button !== 0 || nodeDrag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointers.current.set(event.pointerId, position);
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = viewportRef.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: current.zoom, world: { x: (center.x - current.x) / current.zoom, y: (center.y - current.y) / current.zoom } };
      pan.current = null;
    } else pan.current = { pointerId: event.pointerId, start: position, origin: { x: current.x, y: current.y } };
    setPanning(true);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    userFramedView.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    const position = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointers.current.set(event.pointerId, position);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()], current = pinch.current;
      const zoom = clampZoom(current.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, current.distance));
      setViewport({ zoom, x: (a.x + b.x) / 2 - current.world.x * zoom, y: (a.y + b.y) / 2 - current.world.y * zoom });
    } else if (pan.current?.pointerId === event.pointerId) {
      const current = pan.current;
      setViewport(view => ({ ...view, x: current.origin.x + position.x - current.start.x, y: current.origin.y + position.y - current.start.y }));
    }
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
    const remaining = [...pointers.current.entries()];
    if (remaining.length === 1) {
      const [pointerId, start] = remaining[0];
      const view = viewportRef.current;
      pan.current = { pointerId, start, origin: { x: view.x, y: view.y } };
    } else pan.current = null;
    setPanning(remaining.length > 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function startNodeDrag(event: PointerEvent<HTMLButtonElement>, node: MapNode) {
    event.stopPropagation();
    if (event.button !== 0 || !event.isPrimary || nodeDrag.current || pointers.current.size) return;
    suppressClick.current = null;
    nodeDrag.current = { id: node.topic.id, pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: { x: node.x, y: node.y }, zoom: viewportRef.current.zoom, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveNode(event: PointerEvent<HTMLButtonElement>) {
    const current = nodeDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y };
    if (!current.moved && Math.hypot(delta.x, delta.y) < 6) return;
    current.moved = true;
    userFramedView.current = true;
    setMovingId(current.id);
    updatePositions({ ...positionsRef.current, [current.id]: moveMapPoint(current.origin, delta, current.zoom) });
  }
  function finishNodeDrag(event: PointerEvent<HTMLButtonElement>, canceled = false) {
    const current = nodeDrag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (current.moved || canceled) suppressClick.current = current.id;
    if (canceled) updatePositions({ ...positionsRef.current, [current.id]: current.origin });
    else if (current.moved) { const saved = persist(positionsRef.current); setAnnouncement(saved ? 'Topic moved. Arrangement saved on this device.' : 'Topic moved. Arrangement is kept for this session.'); }
    nodeDrag.current = null;
    setMovingId(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keepFocusedNodeVisible(node: MapNode) {
    userFramedView.current = true;
    const view = viewportRef.current;
    const x = node.x * view.zoom + view.x, y = node.y * view.zoom + view.y;
    const padding = fitPadding(size.width);
    if (x < padding.left || x + node.width * view.zoom > size.width - padding.right || y < padding.top || y + node.height * view.zoom > size.height - padding.bottom) {
      setViewport({ ...view, x: padding.left + (size.width - padding.left - padding.right) / 2 - (node.x + node.width / 2) * view.zoom, y: padding.top + (size.height - padding.top - padding.bottom) / 2 - (node.y + node.height / 2) * view.zoom });
    }
  }
  function resetArrangement() {
    userFramedView.current = true;
    const next = arrangeTopics(topics, size.width < 700);
    updatePositions(next);
    persist(next);
    setViewport(fitMapBounds(nodes.map(node => ({ ...node, ...next[node.topic.id] })), size.width, size.height, fitPadding(size.width)));
    setAnnouncement('Arrangement reset. All topics are in view.');
  }

  return <section className={`thought-map ${size.width < 700 ? 'is-compact' : ''}`} aria-label="Connected topic map">
    <p id={`map-help-${notebookId}`} className="thought-map-sr-only">Select a topic to open its thread. Drag a topic to arrange it, or focus it and press Shift plus an arrow key. Drag the empty canvas to pan. Use plus or minus to zoom, and F to fit.</p>
    <div ref={canvasRef} className={`thought-map-canvas ${panning ? 'is-panning' : ''}`} tabIndex={0} role="region" aria-label="Mind map canvas" aria-describedby={`map-help-${notebookId}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDoubleClick={event => { if (!(event.target as HTMLElement).closest('button')) fit(); }} onKeyDown={event => {
      if (event.target !== event.currentTarget || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') { event.preventDefault(); zoomAt(1.2); }
      else if (event.key === '-') { event.preventDefault(); zoomAt(1 / 1.2); }
      else if (event.key.toLowerCase() === 'f' || event.key === 'Home') { event.preventDefault(); fit(); }
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); userFramedView.current = true; setViewport(current => ({ ...current, x: current.x + (event.key === 'ArrowLeft' ? 65 : event.key === 'ArrowRight' ? -65 : 0), y: current.y + (event.key === 'ArrowUp' ? 65 : event.key === 'ArrowDown' ? -65 : 0) })); }
    }}>
      <div className={`thought-map-world ${ready ? 'is-ready' : ''}`} style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <svg className="thought-map-connections" width="1" height="1" aria-hidden="true">
          <defs><marker id={`${arrowId}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path className="thought-arrow" d="M2 1L7 5L2 9" /></marker><marker id={`${arrowId}-active-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path className="thought-arrow is-active" d="M2 1L7 5L2 9" /></marker></defs>
          {links.map(link => <g key={link.id} className={link.active ? 'is-connected' : undefined}>
            <path className="thought-link-line" d={link.path} markerEnd={`url(#${arrowId}-${link.active ? 'active-arrow' : 'arrow'})`} />
            {galleryLabelFits(link.labelPoint, link.label.length, nodes) && <g className="thought-link-label" transform={`translate(${link.labelPoint.x}, ${link.labelPoint.y})`}><rect x="-78" y={link.label.length > 1 ? -23 : -15} width="156" height={link.label.length > 1 ? 46 : 30} rx="3" /><text textAnchor="middle">{link.label.map((line, index) => <tspan key={index} x="0" y={link.label.length > 1 ? -4 + index * 17 : 4}>{line}</tspan>)}</text></g>}
          </g>)}
        </svg>
        {nodes.map((node, nodeIndex) => {
          const topic = node.topic;
          const childCount = topics.filter(child => child.parentId === topic.id).length;
          return <button key={topic.id} className={`thought-node ${node.root ? 'is-root' : ''} ${selectedId === topic.id ? 'is-selected' : selectedPath.has(topic.id) ? 'is-ancestor' : ''} ${movingId === topic.id ? 'is-moving' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onPointerDown={event => startNodeDrag(event, node)} onPointerMove={moveNode} onPointerUp={event => finishNodeDrag(event)} onPointerCancel={event => finishNodeDrag(event, true)} onLostPointerCapture={event => { if (nodeDrag.current?.pointerId === event.pointerId) finishNodeDrag(event, true); }} onClick={() => { if (suppressClick.current === topic.id) { suppressClick.current = null; return; } onSelect(topic.id); }} onFocus={event => { if (event.currentTarget.dataset.restoringFocus !== 'true' && event.currentTarget.matches(':focus-visible') && !nodeDrag.current) keepFocusedNodeVisible(node); }} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') suppressClick.current = null;
            if (event.key === 'Escape' && nodeDrag.current?.id === topic.id) { const current = nodeDrag.current; event.preventDefault(); event.stopPropagation(); updatePositions({ ...positionsRef.current, [topic.id]: current.origin }); suppressClick.current = topic.id; nodeDrag.current = null; setMovingId(null); if (event.currentTarget.hasPointerCapture(current.pointerId)) event.currentTarget.releasePointerCapture(current.pointerId); }
            if (!event.shiftKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation(); userFramedView.current = true;
            const delta = { x: event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0, y: event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0 };
            const next = { ...positionsRef.current, [topic.id]: moveMapPoint(positionsRef.current[topic.id], delta, viewportRef.current.zoom) };
            updatePositions(next); persist(next); setAnnouncement(`${topic.title} moved ${event.key.replace('Arrow', '').toLowerCase()}.`);
          }} aria-label={`Open ${topic.title} thread. ${statusNames[topic.status]}. ${topic.blocks.length} notes, ${childCount} branches.`} aria-describedby={`map-help-${notebookId}`} data-topic-id={topic.id} data-selected-topic={selectedId === topic.id} aria-current={selectedId === topic.id ? 'true' : undefined}>
            <span className="thought-node-number" aria-hidden="true">{String(nodeIndex + 1).padStart(2, '0')}</span><span className={`thought-node-status status-${topic.status}`} title={statusNames[topic.status]} aria-hidden="true" />
            <Grip className="thought-node-grip" size={15} aria-hidden="true" />
            <strong className="thought-node-title">{topic.title}</strong>
            <span className="thought-node-snippet">{topic.description || topic.blocks.find(block => block.content)?.content || 'A new thought to explore.'}</span>
            <TopicGlyph topic={topic} root={node.root} />
          </button>;
        })}

      </div>
      {topics.length === 0 && <div className="thought-map-empty"><span><Lightbulb size={29} /></span><h2>One thought opens another.</h2><p>Start with a question. See where it takes you.</p><button onClick={onCreate}><Plus size={15} />Add your first topic</button></div>}
    </div>
    <div className="thought-map-bottom"><div className="thought-map-hint"><Move size={12} /><span>{storageWarning ? 'Arrangement stays here for this session' : 'Drag nodes to arrange · click to explore'}</span></div><div className="thought-map-controls" aria-label="Map view controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(1 / 1.2)} disabled={viewport.zoom <= .12}><Minus size={16} /></button><span aria-live="polite">{Math.round(viewport.zoom * 100)}%</span><button aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(1.2)} disabled={viewport.zoom >= 1.8}><Plus size={16} /></button><i /><button aria-label="Fit all topics" title="Fit all topics (F)" onClick={fit}><Focus size={17} /></button><button aria-label="Reset node arrangement" title="Reset arrangement" onClick={resetArrangement} disabled={!topics.length}><RotateCcw size={15} /></button></div><span className="thought-map-signature" aria-hidden="true">A MORE THOUGHTFUL MIND<span /></span></div>
    <div role="status" className="thought-map-sr-only">{announcement}</div>
  </section>;
}
