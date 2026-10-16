'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Focus, Grip, Lightbulb, Minus, Move, Plus, RotateCcw } from 'lucide-react';
import type { Topic } from '@/lib/types';
import { findAvailableMapPosition, fitMapBounds, moveMapPoint, readMapPositions, serializeMapPositions, type MapPositions, type Point } from '@/lib/map-positions';
import './topic-map.css';

type MapNode = Point & { topic: Topic; width: number; height: number; root: boolean };
type Viewport = Point & { zoom: number };
type NodeDrag = { id: string; pointerId: number; start: Point; origin: Point; zoom: number; moved: boolean };
const statusNames = { exploring: 'Exploring', understood: 'Clear for now', revisit: 'Revisit' };
const clampZoom = (zoom: number) => Math.max(.12, Math.min(1.8, zoom));
const storageKey = (notebookId: string) => `offscript:map-layout:${notebookId}`;
const nodeSize = (root: boolean) => root ? { width: 212, height: 198 } : { width: 174, height: 154 };
const fitPadding = (width: number) => width < 700 ? { left: 72, right: 20, top: 92, bottom: 90 } : { left: 100, right: 32, top: 112, bottom: 90 };

/** Give each branch breathing room, retaining the actual parent relationship. */
function arrangeTopics(topics: Topic[], compact: boolean): MapPositions {
  const ids = new Set(topics.map(topic => topic.id));
  const children = new Map<string, Topic[]>();
  topics.forEach(topic => { if (topic.parentId && ids.has(topic.parentId)) children.set(topic.parentId, [...(children.get(topic.parentId) || []), topic]); });
  const positions: MapPositions = {};
  const occupied: (Point & { width: number; height: number })[] = [];
  const visited = new Set<string>();
  const offsets = compact
    ? [{ x: -120, y: -195 }, { x: 120, y: 245 }, { x: -120, y: 245 }, { x: -200, y: 80 }, { x: 160, y: 445 }, { x: 110, y: -410 }]
    : [{ x: -225, y: -195 }, { x: 280, y: 25 }, { x: -90, y: 255 }, { x: -270, y: 80 }, { x: 185, y: 255 }, { x: 140, y: -230 }];
  function place(topic: Topic, preferred: Point, depth: number) {
    if (visited.has(topic.id)) return;
    visited.add(topic.id);
    const dimensions = nodeSize(depth === 0);
    const position = findAvailableMapPosition(preferred, dimensions, occupied);
    positions[topic.id] = position;
    occupied.push({ ...position, ...dimensions });
    (children.get(topic.id) || []).forEach((child, index) => {
      const offset = depth === 0 ? offsets[index % offsets.length] : { x: (compact ? 220 : 280) * (depth % 2 ? 1 : -1), y: -12 + index * 195 };
      const extraRing = depth === 0 ? Math.floor(index / offsets.length) * 225 : 0;
      place(child, { x: position.x + offset.x + extraRing, y: position.y + offset.y - extraRing }, depth + 1);
    });
  }
  let cluster = 0;
  topics.filter(topic => !topic.parentId || !ids.has(topic.parentId)).forEach(topic => place(topic, { x: cluster++ * 800, y: 0 }, 0));
  // Malformed relationships must not make a topic inaccessible.
  topics.filter(topic => !visited.has(topic.id)).forEach(topic => place(topic, { x: cluster++ * 800, y: 0 }, 0));
  return positions;
}

function connection(parent: MapNode, child: MapNode) {
  const dx = child.x + child.width / 2 - parent.x - parent.width / 2;
  const dy = child.y + child.height / 2 - parent.y - parent.height / 2;
  const horizontal = Math.abs(dx) / ((parent.width + child.width) / 2) > Math.abs(dy) / ((parent.height + child.height) / 2);
  const direction = (horizontal ? dx : dy) >= 0 ? 1 : -1;
  const from = horizontal ? { x: parent.x + (direction > 0 ? parent.width : 0), y: parent.y + parent.height / 2 } : { x: parent.x + parent.width / 2, y: parent.y + (direction > 0 ? parent.height : 0) };
  const to = horizontal ? { x: child.x + (direction > 0 ? 0 : child.width), y: child.y + child.height / 2 } : { x: child.x + child.width / 2, y: child.y + (direction > 0 ? 0 : child.height) };
  const bend = Math.max(36, Math.abs(horizontal ? to.x - from.x : to.y - from.y) * .52);
  const a = horizontal ? { x: from.x + bend * direction, y: from.y } : { x: from.x, y: from.y + bend * direction };
  const b = horizontal ? { x: to.x - bend * direction, y: to.y } : { x: to.x, y: to.y - bend * direction };
  return { from, to, path: `M ${from.x} ${from.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${to.x} ${to.y}` };
}

function TopicGlyph({ topic, root }: { topic: Topic; root: boolean }) {
  const title = topic.title.toLowerCase();
  if (/normal distribution|bell curve|gaussian/.test(title) || topic.blocks.some(block => block.type === 'chart')) {
    const curve = Array.from({ length: 61 }, (_, index) => {
      const x = index / 60 * 146 + 3;
      return `${index ? 'L' : 'M'}${x.toFixed(2)},${(68 - Math.exp(-.5 * ((index - 30) / 8.8) ** 2) * 55).toFixed(2)}`;
    }).join(' ');
    return <span className="thought-node-glyph is-curve" aria-hidden="true"><svg viewBox="0 0 152 78"><path className="thought-glyph-axis" d="M2 69H150M76 8V74" /><path className="thought-glyph-fill" d={`${curve} L149,69 L3,69 Z`} /><path className="thought-glyph-curve" d={curve} /></svg></span>;
  }
  const symbol = /standard deviation|\bsigma\b/.test(title) ? 'σ' : /variance/.test(title) ? 'σ²' : /z[-\s]?scores?/.test(title) ? 'Z' : /central limit|\bmean\b|average/.test(title) ? 'μ' : /probability/.test(title) ? 'P' : /integral/.test(title) ? '∫' : /derivative/.test(title) ? 'ƒ′' : /code|programming|javascript|python/.test(title) ? '{ }' : null;
  return <span className={`thought-node-glyph ${root ? 'is-root-glyph' : ''}`} aria-hidden="true">{symbol || <svg className="thought-glyph-ideas" viewBox="0 0 64 52"><path d="M19 33C19 18 44 34 44 15M19 33C19 48 49 40 49 29M19 33L9 16" /><circle cx="19" cy="33" r="6" /><circle cx="44" cy="15" r="4" /><circle cx="49" cy="29" r="4" /><circle cx="9" cy="16" r="3" /></svg>}</span>;
}

export function TopicMap({ topics, selectedId, onSelect, onCreate }: { topics: Topic[]; selectedId?: string; onSelect: (id: string) => void; onCreate: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState<MapPositions>({});
  const positionsRef = useRef(positions);
  const [ready, setReady] = useState(false);
  const loadedNotebook = useRef<string | null>(null);
  const notebookId = topics[0]?.notebookId || '';
  const topologyKey = topics.map(topic => `${topic.id}:${topic.parentId || ''}`).join('|');
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef(viewport);
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
    return [{ id: node.topic.id, parentId: parent.topic.id, ...connection(parent, node), active: selectedPath.has(node.topic.id) && selectedPath.has(parent.topic.id) }];
  }), [nodes, nodeLookup, selectedPath]);
  const ports = useMemo(() => {
    const sockets = new Map<string, Point & { active: boolean; selected: boolean }>();
    links.forEach(link => {
      ([{ point: link.from, id: link.parentId }, { point: link.to, id: link.id }]).forEach(({ point, id }) => {
        const key = `${point.x},${point.y}`;
        const previous = sockets.get(key);
        sockets.set(key, { ...point, active: !!previous?.active || link.active || id === selectedId, selected: !!previous?.selected || id === selectedId });
      });
    });
    return [...sockets.entries()];
  }, [links, selectedId]);

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
    if (firstLoad) setViewport(fitMapBounds(topics.map(topic => ({ ...next[topic.id], ...nodeSize(!topic.parentId || !ids.has(topic.parentId)) })), size.width, size.height, fitPadding(size.width)));
    // Only the notebook and hierarchy change the arrangement. Edits and viewport changes do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId, topologyKey, measured]);

  const fit = useCallback(() => {
    setViewport(fitMapBounds(nodesRef.current.map(node => ({ ...node, ...(positionsRef.current[node.topic.id] || node) })), size.width, size.height, fitPadding(size.width)));
  }, [size.width, size.height]);
  useEffect(() => { if (ready && measured && !nodeDrag.current) fit(); }, [fit, ready, measured]);

  const zoomAt = useCallback((factor: number, point?: Point) => {
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
    const view = viewportRef.current;
    const x = node.x * view.zoom + view.x, y = node.y * view.zoom + view.y;
    const padding = fitPadding(size.width);
    if (x < padding.left || x + node.width * view.zoom > size.width - padding.right || y < padding.top || y + node.height * view.zoom > size.height - padding.bottom) {
      setViewport({ ...view, x: padding.left + (size.width - padding.left - padding.right) / 2 - (node.x + node.width / 2) * view.zoom, y: padding.top + (size.height - padding.top - padding.bottom) / 2 - (node.y + node.height / 2) * view.zoom });
    }
  }
  function resetArrangement() {
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
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); setViewport(current => ({ ...current, x: current.x + (event.key === 'ArrowLeft' ? 65 : event.key === 'ArrowRight' ? -65 : 0), y: current.y + (event.key === 'ArrowUp' ? 65 : event.key === 'ArrowDown' ? -65 : 0) })); }
    }}>
      <div className={`thought-map-world ${ready ? 'is-ready' : ''}`} style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <svg className="thought-map-connections" width="1" height="1" aria-hidden="true">{links.map(link => <g key={link.id} className={link.active ? 'is-connected' : undefined}><path className="thought-link-underlay" d={link.path} /><path className="thought-link-glow" d={link.path} /><path className="thought-link-line" d={link.path} /></g>)}</svg>
        {nodes.map(node => {
          const topic = node.topic;
          const childCount = topics.filter(child => child.parentId === topic.id).length;
          return <button key={topic.id} className={`thought-node ${node.root ? 'is-root' : ''} ${selectedId === topic.id ? 'is-selected' : selectedPath.has(topic.id) ? 'is-ancestor' : ''} ${movingId === topic.id ? 'is-moving' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} onPointerDown={event => startNodeDrag(event, node)} onPointerMove={moveNode} onPointerUp={event => finishNodeDrag(event)} onPointerCancel={event => finishNodeDrag(event, true)} onLostPointerCapture={event => { if (nodeDrag.current?.pointerId === event.pointerId) finishNodeDrag(event, true); }} onClick={() => { if (suppressClick.current === topic.id) { suppressClick.current = null; return; } onSelect(topic.id); }} onFocus={event => { if (event.currentTarget.dataset.restoringFocus !== 'true' && event.currentTarget.matches(':focus-visible') && !nodeDrag.current) keepFocusedNodeVisible(node); }} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') suppressClick.current = null;
            if (event.key === 'Escape' && nodeDrag.current?.id === topic.id) { const current = nodeDrag.current; event.preventDefault(); event.stopPropagation(); updatePositions({ ...positionsRef.current, [topic.id]: current.origin }); suppressClick.current = topic.id; nodeDrag.current = null; setMovingId(null); if (event.currentTarget.hasPointerCapture(current.pointerId)) event.currentTarget.releasePointerCapture(current.pointerId); }
            if (!event.shiftKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const delta = { x: event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0, y: event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0 };
            const next = { ...positionsRef.current, [topic.id]: moveMapPoint(positionsRef.current[topic.id], delta, viewportRef.current.zoom) };
            updatePositions(next); persist(next); setAnnouncement(`${topic.title} moved ${event.key.replace('Arrow', '').toLowerCase()}.`);
          }} aria-label={`Open ${topic.title} thread. ${statusNames[topic.status]}. ${topic.blocks.length} notes, ${childCount} branches.`} aria-describedby={`map-help-${notebookId}`} data-topic-id={topic.id} data-selected-topic={selectedId === topic.id} aria-current={selectedId === topic.id ? 'true' : undefined}>
            <span className={`thought-node-status status-${topic.status}`} title={statusNames[topic.status]} aria-hidden="true" />
            <Grip className="thought-node-grip" size={15} aria-hidden="true" />
            <TopicGlyph topic={topic} root={node.root} />
            <strong className="thought-node-title">{topic.title}</strong>
            <span className="thought-node-snippet">{topic.description || topic.blocks.find(block => block.content)?.content || 'A new thought to explore.'}</span>
          </button>;
        })}
        <svg className="thought-map-ports" width="1" height="1" aria-hidden="true">{ports.map(([id, port]) => <g key={id} className={`${port.active ? 'is-connected' : ''} ${port.selected ? 'is-selected' : ''}`}><circle className="thought-port-halo" cx={port.x} cy={port.y} r="8" /><circle className="thought-port-rim" cx={port.x} cy={port.y} r="5.5" /><circle className="thought-port-core" cx={port.x} cy={port.y} r="3.5" /></g>)}</svg>
      </div>
      {topics.length === 0 && <div className="thought-map-empty"><span><Lightbulb size={29} /></span><h2>One thought opens another.</h2><p>Start with a question. See where it takes you.</p><button onClick={onCreate}><Plus size={15} />Add your first topic</button></div>}
    </div>
    <div className="thought-map-bottom"><div className="thought-map-hint"><Move size={12} /><span>{storageWarning ? 'Arrangement stays here for this session' : 'Drag nodes to arrange · click to explore'}</span></div><div className="thought-map-controls" aria-label="Map view controls"><button aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(1 / 1.2)} disabled={viewport.zoom <= .12}><Minus size={16} /></button><span aria-live="polite">{Math.round(viewport.zoom * 100)}%</span><button aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(1.2)} disabled={viewport.zoom >= 1.8}><Plus size={16} /></button><i /><button aria-label="Fit all topics" title="Fit all topics (F)" onClick={fit}><Focus size={17} /></button><button aria-label="Reset node arrangement" title="Reset arrangement" onClick={resetArrangement} disabled={!topics.length}><RotateCcw size={15} /></button></div></div>
    <div role="status" className="thought-map-sr-only">{announcement}</div>
  </section>;
}
