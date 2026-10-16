'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, BookOpen, Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, Clock3, Ellipsis, FileText, GitBranch, GripVertical, History, Layers2, LoaderCircle, Menu, MessageCircle, Network, PanelRightClose, PanelRightOpen, Pencil, Plus, Search, Settings2, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import type { Anchor, BlockType, Message, NoteBlock, Topic, Workspace } from '@/lib/types';
import { resolveAnchor } from '@/lib/anchors';
import { NormalCurve } from './normal-curve';
import { TopicMap } from './topic-map';
import { TopicThread } from './topic-thread';
import { ThreadTether } from './thread-tether';
import { FormulaDisplay } from './formula-display';
import { AiConnection } from './ai-connection';
import { ChatText } from './chat-text';
import { Logo, OffscriptMark } from './brand-logo';
import './lumen-workspace.css';

type Modal = 'search' | 'notebook' | 'topic' | 'settings' | 'history' | 'keep' | 'delete' | 'connect' | null;
type QuestionRequest = { topicId: string; question: string; userMessageId?: string; requestKey: string };
type QuestionBranchRequest = { parentId: string; question: string; sourceMessageId?: string; requestKey: string; anchor: Anchor };
type BlockDraft = { topicId: string; block: NoteBlock; isNew: boolean; baseRevision: number };
type TitleDraft = { topicId: string; value: string; baseRevision: number };
type BranchSource = { parentId: string; anchor: Anchor; sourceView: 'conversation' | 'notes' } | null;
type Revision = { revision: number; blocks: NoteBlock[]; createdAt: string };
const statuses = { exploring: 'Exploring', understood: 'Clear for now', revisit: 'Revisit' };
const blockNames: Record<BlockType, string> = { paragraph: 'Text', heading: 'Heading', definition: 'Definition', example: 'Example', formula: 'Formula', callout: 'Observation', chart: 'Normal distribution chart', code: 'Code' };

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Request failed (${res.status}). Please try again.`), { status: res.status, code: data?.error?.code });
  return data as T;
}
const id = () => crypto.randomUUID();
function readLocal<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(`offscript:${key}`) || 'null') ?? fallback; } catch { return fallback; } }
function writeLocal(key: string, value: unknown) { try { localStorage.setItem(`offscript:${key}`, JSON.stringify(value)); } catch { /* Server data is unaffected by unavailable draft storage. */ } }
function focusableElements(container: HTMLElement | null) {
  return Array.from(container?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select, summary, [tabindex]') || [])
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0);
}

function Dialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const focusable = () => focusableElements(panel);
    const initial = focusable().find(element => element.hasAttribute('data-autofocus')) || focusable()[0];
    initial?.focus({ preventScroll: true });
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') { const els = focusable(), first = els[0], last = els.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      if (previous?.isConnected && !previous.closest('[inert]') && previous.getClientRects().length) previous.focus({ preventScroll: true });
    };
  }, [onClose, title]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-top"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div><div className="modal-content">{children}</div></div></div>;
}

function ContextPreview({ context }: { context: string }) {
  let items: { title?: string; blocks?: { content?: string }[]; messages?: { content?: string }[] }[] = [];
  try { const parsed: unknown = JSON.parse(context); if (Array.isArray(parsed)) items = parsed; } catch { return <p>{context}</p>; }
  if (!items.length) return <p>This topic has no inherited branch context.</p>;
  return <div className="context-preview">{items.map((item, index) => <section key={index}><strong>{item.title || 'Parent topic'}</strong>{item.blocks?.map((block, i) => <p key={i}>{block.content}</p>)}{item.messages?.map((message, i) => <p key={`m${i}`}>{message.content}</p>)}</section>)}</div>;
}

function BlockBody({ block }: { block: NoteBlock }) {
  if (block.type === 'chart' && block.chart) return <><NormalCurve chart={block.chart} />{block.content && <p className="chart-description">{block.content}</p>}</>;
  if (block.type === 'heading') return <h2>{block.content}</h2>;
  if (block.type === 'code') return <pre><code>{block.content}</code></pre>;
  if (block.type === 'paragraph') return <p className="note-paragraph">{block.content}</p>;
  return <><h3 className="insight-heading">{block.title || blockNames[block.type]}</h3><div className={block.type === 'formula' ? 'formula-text' : 'block-text'}>{block.type === 'formula' ? <FormulaDisplay content={block.content} /> : block.content}</div></>;
}

export default function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [loadingError, setLoadingError] = useState('');
  const [threadOpen, setThreadOpen] = useState(false);
  const [threadFloating, setThreadFloating] = useState(false);
  const [threadTab, setThreadTab] = useState<'conversation' | 'notes'>('conversation');
  const threadTabRef = useRef(threadTab);
  threadTabRef.current = threadTab;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [branch, setBranch] = useState<BranchSource>(null);
  const [selection, setSelection] = useState<{ blockId: string; quote: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [blockDraft, setBlockDraft] = useState<BlockDraft | null>(null);
  const [titleDraft, setTitleDraft] = useState<TitleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingQuestions, setPendingQuestions] = useState<Record<string, QuestionRequest>>({});
  const [branching, setBranching] = useState(false);
  const [aiError, setAiError] = useState('');
  const [keepMessage, setKeepMessage] = useState<Message | null>(null);
  const [keepText, setKeepText] = useState('');
  const [keepTarget, setKeepTarget] = useState('');
  const [history, setHistory] = useState<Revision[] | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [anchorNotice, setAnchorNotice] = useState<{ text: string; quote: string } | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarTriggerRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const exportTriggerRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const field = questionRef.current;
    if (!field || threadTab !== 'conversation') return;
    field.style.height = '24px';
    field.style.height = `${Math.min(120, field.scrollHeight)}px`;
  }, [draft, activeId, threadTab, threadOpen]);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const requestKey = useRef('');
  const runningQuestions = useRef(new Set<string>());
  const questionAttempts = useRef(new Map<string, QuestionRequest>());
  const connectionIntent = useRef<Omit<QuestionRequest, 'requestKey'> | null>(null);
  const branchInFlight = useRef(false);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const mobileSidebarOpen = sidebarOpen;
  const overlayState = useRef({ modal, threadOpen });
  overlayState.current = { modal, threadOpen };
  const topic = workspace?.topics.find(t => t.id === activeId);
  const notebook = workspace?.notebooks.find(n => n.id === notebookId);
  const topics = workspace?.topics.filter(t => t.notebookId === notebookId) || [];
  const messages = workspace?.messages.filter(m => m.topicId === activeId) || [];
  const pendingQuestion = activeId ? pendingQuestions[activeId] : undefined;
  const aiBusy = !!pendingQuestion;
  const blockConflict = !!blockDraft && !!topic && blockDraft.topicId === topic.id && blockDraft.baseRevision !== topic.revision;
  const ancestors: Topic[] = [];
  if (topic && workspace) { let parent = workspace.topics.find(t => t.id === topic.parentId); const visited = new Set<string>(); while (parent && !visited.has(parent.id)) { visited.add(parent.id); ancestors.unshift(parent); parent = workspace.topics.find(t => t.id === parent?.parentId); } }

  const load = useCallback(async () => {
    setLoadingError('');
    try {
      const data = await api<Workspace>('/api/workspace');
      setWorkspace(data);
      const route = new URLSearchParams(window.location.hash.slice(1));
      const requestedThread = route.get('thread');
      const requestedMap = route.get('map');
      const selected = data.topics.find(t => t.id === requestedThread)
        || data.topics.find(t => t.notebookId === requestedMap)
        || data.topics.find(t => t.id === readLocal('active-topic', ''))
        || data.topics.find(t => t.id === data.selectedTopicId) || data.topics[0];
      const selectedMap = selected?.notebookId || data.notebooks[0]?.id || null;
      const open = !!requestedThread && selected?.id === requestedThread;
      setThreadOpen(open);
      setThreadTab('conversation');
      if (!open) window.history.replaceState({}, '', selectedMap ? `#map=${selectedMap}` : window.location.pathname);
      if (requestedThread && !open) setNotice('That topic is no longer available. Your map is still here.');
      setActiveId(selected?.id || null); setNotebookId(selectedMap);
      setDraft(selected ? readLocal(`draft:${selected.id}`, '') : '');
      setBlockDraft(selected ? readLocal(`editor:${selected.id}`, null) : null);
      setTitleDraft(selected ? readLocal(`title:${selected.id}`, null) : null);
      setCollapsed(new Set(readLocal<string[]>('collapsed', [])));
      setTimeout(() => { if (scrollRef.current && selected && activeIdRef.current === selected.id) scrollRef.current.scrollTop = readLocal(`scroll:${selected.id}:conversation`, 0); }, 100);
    } catch (e) { setLoadingError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const closeModal = useCallback(() => { connectionIntent.current = null; setModal(null); setError(''); }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 759px)');
    const update = () => { setMobileViewport(media.matches); if (!media.matches) setSidebarOpen(false); };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const panel = sidebarRef.current;
    const suspended = () => !!overlayState.current.modal || overlayState.current.threadOpen;
    const focusFirst = () => focusableElements(panel)[0]?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() => { if (!suspended()) focusFirst(); });
    function key(event: KeyboardEvent) {
      if (suspended()) return;
      if (event.key === 'Escape') { event.preventDefault(); setSidebarOpen(false); return; }
      if (event.key !== 'Tab') return;
      const elements = focusableElements(panel), first = elements[0], last = elements.at(-1);
      if (!elements.length) { event.preventDefault(); panel?.focus({ preventScroll: true }); }
      else if (event.shiftKey && (document.activeElement === first || !panel?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    }
    function containFocus(event: FocusEvent) {
      if (!suspended() && event.target instanceof Node && !panel?.contains(event.target)) focusFirst();
    }
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', containFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', key);
      document.removeEventListener('focusin', containFocus);
      requestAnimationFrame(() => {
        const trigger = sidebarTriggerRef.current;
        if (!suspended() && trigger?.getClientRects().length && !trigger.closest('[inert]')) trigger.focus({ preventScroll: true });
      });
    };
  }, [mobileSidebarOpen]);
  useEffect(() => {
    if (threadOpen || modal || mobileSidebarOpen) setExportOpen(false);
  }, [threadOpen, modal, mobileSidebarOpen]);
  useEffect(() => {
    if (!exportOpen) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !exportRef.current?.contains(event.target)) setExportOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault(); setExportOpen(false); exportTriggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }, [exportOpen]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearch(''); setModal('search'); } };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => { if (activeId) writeLocal(`draft:${activeId}`, draft); }, [draft, activeId]);
  useEffect(() => { if (blockDraft) writeLocal(`editor:${blockDraft.topicId}`, blockDraft); }, [blockDraft]);
  useEffect(() => { if (titleDraft) writeLocal(`title:${titleDraft.topicId}`, titleDraft); }, [titleDraft]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);

  function navigate(target: string, anchor?: Anchor, updateHistory = true) {
    const next = workspace?.topics.find(t => t.id === target); if (!next) return;
    if (activeId && scrollRef.current) writeLocal(`scroll:${activeId}:${threadTabRef.current}`, scrollRef.current.scrollTop);
    const nextTab = anchor?.blockId || anchor?.quote ? 'notes' : anchor && topic && readLocal<string>(`return-view:${topic.id}`, 'conversation') === 'notes' ? 'notes' : 'conversation';
    const nextScroll = anchor?.scrollTop ?? readLocal<number>(`scroll:${target}:${nextTab}`, 0);
    setThreadTab(nextTab);
    setActiveId(target); setNotebookId(next.notebookId); setThreadOpen(true); setSidebarOpen(false); setSelection(null); setTitleDraft(readLocal(`title:${target}`, null)); setError(''); setAiError(''); setAnchorNotice(null);
    setDraft(readLocal<string | null>(`draft:${target}`, null) ?? anchor?.draft ?? ''); setBlockDraft(readLocal(`editor:${target}`, null));
    writeLocal('active-topic', target);
    if (updateHistory) window.history.pushState({}, '', `#thread=${encodeURIComponent(target)}`);
    void api('/api/view', { method: 'POST', body: JSON.stringify({ topicId: target }) }).catch(() => setNotice('Your reading location could not be saved to the server. Your notes are safe.'));
    setTimeout(() => {
      if (!scrollRef.current || activeIdRef.current !== target) return;
      scrollRef.current.scrollTop = nextScroll;
      if (anchor) {
        const result = resolveAnchor(next.blocks, anchor);
        if (result.blockId) { setHighlight(result.blockId); document.getElementById(`block-${result.blockId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => setHighlight(null), 6000); }
        if (result.kind !== 'exact') setAnchorNotice({ text: result.kind === 'moved' ? 'We found your original passage in its new location.' : 'Your original passage has changed or is no longer available. Here is the excerpt you left from.', quote: anchor.quote });
      }
    }, 70);
  }
  function closeThread(updateHistory = true) {
    if (activeId && scrollRef.current) writeLocal(`scroll:${activeId}:${threadTabRef.current}`, scrollRef.current.scrollTop);
    setThreadOpen(false); setSelection(null); setAnchorNotice(null);
    if (updateHistory) window.history.pushState({}, '', notebookId ? `#map=${notebookId}` : window.location.pathname);
  }
  function openMap(targetMap: string, updateHistory = true) {
    const first = workspace?.topics.find(t => t.notebookId === targetMap);
    if (activeId && scrollRef.current) writeLocal(`scroll:${activeId}:${threadTabRef.current}`, scrollRef.current.scrollTop);
    setNotebookId(targetMap); setActiveId(first?.id || null); setThreadOpen(false); setSidebarOpen(false); setSelection(null);
    setDraft(first ? readLocal(`draft:${first.id}`, '') : '');
    setBlockDraft(first ? readLocal(`editor:${first.id}`, null) : null);
    setTitleDraft(first ? readLocal(`title:${first.id}`, null) : null);
    setError(''); setAiError(''); setExportOpen(false);
    if (updateHistory) window.history.pushState({}, '', `#map=${targetMap}`);
  }
  function changeThreadTab(next: 'conversation' | 'notes') {
    if (next === threadTabRef.current) return;
    const target = activeId;
    const nextScroll = target ? readLocal<number>(`scroll:${target}:${next}`, 0) : 0;
    if (target && scrollRef.current) writeLocal(`scroll:${target}:${threadTabRef.current}`, scrollRef.current.scrollTop);
    setSelection(null); setThreadTab(next);
    requestAnimationFrame(() => { if (scrollRef.current && activeIdRef.current === target && threadTabRef.current === next) scrollRef.current.scrollTop = nextScroll; });
  }
  function focusQuestion(targetId = activeId) {
    if (!targetId) return;
    if (targetId === activeIdRef.current) changeThreadTab('conversation');
    else setThreadTab('conversation');
    requestAnimationFrame(() => { if (activeIdRef.current === targetId) questionRef.current?.focus({ preventScroll: true }); });
  }
  function openNavigation() { if (threadOpen) closeThread(); setSidebarOpen(true); }
  useEffect(() => {
    const onPop = () => {
      connectionIntent.current = null; setModal(null); setError(''); setHistory(null);
      const route = new URLSearchParams(window.location.hash.slice(1));
      const target = route.get('thread');
      const targetMap = route.get('map');
      if (target && workspace?.topics.some(t => t.id === target)) navigate(target, undefined, false);
      else if (targetMap && workspace?.notebooks.some(n => n.id === targetMap)) openMap(targetMap, false);
      else closeThread(false);
    };
    window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop);
  });

  async function patchTopic(target: Topic, changes: { title?: string; status?: Topic['status']; blocks?: NoteBlock[] }, expectedRevision = target.revision) {
    setSaveState('saving'); setError('');
    try {
      const data = await api<{ topic: Topic }>(`/api/topics/${target.id}`, { method: 'PATCH', body: JSON.stringify({ ...changes, expectedRevision }) });
      setWorkspace(w => w ? { ...w, topics: w.topics.map(t => t.id === data.topic.id ? data.topic : t) } : w); setSaveState('saved'); return data.topic;
    } catch (e) {
      setSaveState('error'); setError((e as Error).message);
      // Refresh canonical records after a revision conflict, keeping the unsaved editor draft.
      try { const fresh = await api<Workspace>('/api/workspace'); setWorkspace(fresh); } catch { /* Keep current data visible while offline. */ }
      return null;
    }
  }
  function cancelTitle() { if (titleDraft) writeLocal(`title:${titleDraft.topicId}`, null); setTitleDraft(null); }
  async function saveTitle(useLatest = false) {
    if (!topic || !titleDraft?.value.trim()) return;
    const submitted = titleDraft;
    const saved = await patchTopic(topic, { title: submitted.value.trim() }, useLatest ? topic.revision : submitted.baseRevision);
    if (saved) {
      if (JSON.stringify(readLocal(`title:${submitted.topicId}`, null)) === JSON.stringify(submitted)) writeLocal(`title:${submitted.topicId}`, null);
      setTitleDraft(current => current === submitted ? null : current);
    }
  }
  function beginTopic(asBranch: boolean, selected = selection) {
    if (!notebookId) return;
    setError(''); setNewTitle(asBranch && selected ? selected.quote.slice(0, 90) : ''); setNewDescription(''); requestKey.current = id();
    setBranch(asBranch && topic ? { parentId: topic.id, sourceView: threadTabRef.current, anchor: { topicId: topic.id, blockId: selected?.blockId, blockSnapshot: topic.blocks.find(b => b.id === selected?.blockId)?.content, quote: selected?.quote || '', scrollTop: scrollRef.current?.scrollTop || 0, draft } } : null);
    setModal('topic');
  }
  async function createTopic(e: FormEvent) {
    e.preventDefault(); if (!newTitle.trim() || !notebookId) return; setBusy(true); setError('');
    try {
      const { topic: created } = await api<{ topic: Topic }>('/api/topics', { method: 'POST', body: JSON.stringify({ notebookId, parentId: branch?.parentId || null, title: newTitle.trim(), description: newDescription.trim(), anchor: branch?.anchor || null, requestKey: requestKey.current }) });
      setWorkspace(w => w ? { ...w, topics: w.topics.some(t => t.id === created.id) ? w.topics : [...w.topics, created] } : w);
      if (activeId && scrollRef.current) writeLocal(`scroll:${activeId}:${threadTabRef.current}`, scrollRef.current.scrollTop);
      setThreadTab('conversation'); setActiveId(created.id); setDraft(''); setBlockDraft(null); setTitleDraft(null); setThreadOpen(true); setSelection(null); setModal(null); setSidebarOpen(false); setAnchorNotice(null); setAiError(''); writeLocal('active-topic', created.id); window.history.pushState({}, '', `#thread=${created.id}`); requestAnimationFrame(() => { if (scrollRef.current && activeIdRef.current === created.id) scrollRef.current.scrollTop = 0; });
      if (branch) { writeLocal(`return-view:${created.id}`, branch.sourceView); setCollapsed(c => { const next = new Set(c); next.delete(branch.parentId); return next; }); focusQuestion(created.id); }
      setNotice(branch ? 'Your branch is ready. Your place in the parent topic is saved.' : 'Your topic is ready.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function createNotebook(e: FormEvent) {
    e.preventDefault(); if (!newTitle.trim()) return; setBusy(true); setError('');
    try {
      const data = await api<{ notebook: Workspace['notebooks'][number]; topic: Topic }>('/api/notebooks', { method: 'POST', body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }) });
      setWorkspace(w => w ? { ...w, notebooks: [...w.notebooks, data.notebook], topics: [...w.topics, data.topic] } : w); setNotebookId(data.notebook.id); setActiveId(data.topic.id); setDraft(''); setBlockDraft(null); setTitleDraft(null); setThreadOpen(false); setModal(null); setSidebarOpen(false); setAnchorNotice(null); setAiError(''); writeLocal('active-topic', data.topic.id); window.history.pushState({}, '', `#map=${data.notebook.id}`); setNotice('Map created. Follow your first idea.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function deleteNotebook() {
    if (!notebook) return; setBusy(true); setError('');
    try { await api(`/api/notebooks/${notebook.id}`, { method: 'DELETE' }); workspace!.topics.filter(t => t.notebookId === notebook.id).forEach(t => { for (const kind of ['draft', 'editor', 'title', 'scroll']) { try { localStorage.removeItem(`offscript:${kind}:${t.id}`); } catch { /* Browser storage may be unavailable. */ } } }); const remaining = workspace!.notebooks.filter(n => n.id !== notebook.id); const remainingTopics = workspace!.topics.filter(t => t.notebookId !== notebook.id); setWorkspace(w => w ? { ...w, notebooks: remaining, topics: remainingTopics, messages: w.messages.filter(m => remainingTopics.some(t => t.id === m.topicId)) } : w); setNotebookId(remaining[0]?.id || null); setActiveId(remainingTopics.find(t => t.notebookId === remaining[0]?.id)?.id || null); setDraft(''); setBlockDraft(null); setTitleDraft(null); setModal(null); setThreadOpen(false); setAnchorNotice(null); setSelection(null); setAiError(''); const nextTopic = remainingTopics.find(t => t.notebookId === remaining[0]?.id); if (nextTopic) { setDraft(readLocal(`draft:${nextTopic.id}`, '')); setBlockDraft(readLocal(`editor:${nextTopic.id}`, null)); setTitleDraft(readLocal(`title:${nextTopic.id}`, null)); writeLocal('active-topic', nextTopic.id); window.history.replaceState({}, '', `#map=${nextTopic.notebookId}`); } else { writeLocal('active-topic', null); window.history.replaceState({}, '', window.location.pathname); } setNotice('Map deleted from this local workspace.'); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function captureSelection() {
    setTimeout(() => {
      const selected = window.getSelection(); const quote = selected?.toString().trim() || '';
      if (!quote || quote.length > 2000 || !selected?.anchorNode || !selected.focusNode) { setSelection(null); return; }
      const start = (selected.anchorNode.nodeType === 1 ? selected.anchorNode as Element : selected.anchorNode.parentElement)?.closest('[data-block-id]');
      const end = (selected.focusNode.nodeType === 1 ? selected.focusNode as Element : selected.focusNode.parentElement)?.closest('[data-block-id]');
      if (start && start === end) {
        const blockId = start.getAttribute('data-block-id')!;
        const block = topic?.blocks.find(item => item.id === blockId);
        // A stacked fraction's visual DOM omits operators; branch from its saved equation.
        setSelection({ blockId, quote: block?.type === 'formula' ? block.content : quote });
      } else setSelection(null);
    }, 0);
  }
  function beginEdit(block?: NoteBlock) {
    if (!topic) return; setThreadTab('notes'); if (blockDraft) { setNotice('Your current note draft is still open. Save or cancel it before editing another block.'); requestAnimationFrame(() => { if (activeIdRef.current === topic.id) document.getElementById('block-editor')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); return; } setError(''); setBlockDraft({ topicId: topic.id, baseRevision: topic.revision, isNew: !block, block: block ? structuredClone(block) : { id: id(), type: 'paragraph', content: '' } });
    setTimeout(() => { if (activeIdRef.current !== topic.id) return; document.getElementById('block-editor')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); document.querySelector<HTMLTextAreaElement>('#block-editor textarea')?.focus({ preventScroll: true }); }, 60);
  }
  function cancelEdit() { if (blockDraft) writeLocal(`editor:${blockDraft.topicId}`, null); setBlockDraft(null); setError(''); }
  function finishBlockEdit(submitted: BlockDraft) {
    if (JSON.stringify(readLocal(`editor:${submitted.topicId}`, null)) === JSON.stringify(submitted)) writeLocal(`editor:${submitted.topicId}`, null);
    setBlockDraft(current => current === submitted ? null : current);
    if (activeIdRef.current === submitted.topicId) setError('');
  }
  async function saveBlock(e: FormEvent) {
    e.preventDefault(); if (!topic || !blockDraft) return;
    if (blockDraft.baseRevision !== topic.revision || (!blockDraft.isNew && !topic.blocks.some(b => b.id === blockDraft.block.id))) { setError('This topic has changed since you started editing. Your draft is preserved below. Review the current note and keep your draft as a new block to preserve both versions.'); return; }
    setBusy(true);
    const block = { ...blockDraft.block, ...(blockDraft.block.provenance ? { provenance: { ...blockDraft.block.provenance, edited: true } } : {}) };
    const result = await patchTopic(topic, { blocks: blockDraft.isNew ? [...topic.blocks, block] : topic.blocks.map(b => b.id === block.id ? block : b) }, blockDraft.baseRevision);
    if (result) { finishBlockEdit(blockDraft); if (activeIdRef.current === topic.id) { setHighlight(block.id); setTimeout(() => { if (activeIdRef.current !== topic.id) return; document.getElementById(`block-${block.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => setHighlight(null), 3500); }, 70); } } setBusy(false);
  }
  async function keepConflictedDraft() {
    if (!topic || !blockDraft) return; setBusy(true);
    const block = { ...blockDraft.block, id: id(), ...(blockDraft.block.provenance ? { provenance: { ...blockDraft.block.provenance, edited: true } } : {}) };
    const result = await patchTopic(topic, { blocks: [...topic.blocks, block] });
    if (result) { finishBlockEdit(blockDraft); setNotice('Your draft was kept as a new note. The existing version is unchanged.'); } setBusy(false);
  }
  function showConversation(targetId: string) {
    requestAnimationFrame(() => {
      if (activeIdRef.current === targetId && threadTabRef.current === 'conversation') conversationEnd.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    });
  }
  function clearSentDraft(targetId: string, question: string) {
    if (activeIdRef.current === targetId) setDraft(current => current.trim() === question ? '' : current);
    else if (readLocal<string>(`draft:${targetId}`, '').trim() === question) writeLocal(`draft:${targetId}`, '');
  }
  function openConnection() { connectionIntent.current = null; setModal('connect'); }
  function connectionReady() {
    setWorkspace(current => current ? { ...current, aiConfigured: true } : current);
    setModal(null); setAiError(''); setNotice('AI connected. Your conversations are ready.');
    const intent = connectionIntent.current;
    connectionIntent.current = null;
    if (intent) void sendQuestion(intent.topicId, intent.question, intent.userMessageId, true);
  }
  async function sendQuestion(targetId: string, rawQuestion: string, userMessageId?: string, justConnected = false) {
    const question = rawQuestion.trim();
    if (!question || runningQuestions.current.has(targetId)) return;
    if (!workspace?.aiConfigured && !justConnected) {
      connectionIntent.current = { topicId: targetId, question, ...(userMessageId ? { userMessageId } : {}) };
      setModal('connect'); return;
    }
    const previous = questionAttempts.current.get(targetId);
    const request: QuestionRequest = previous?.question === question && previous.userMessageId === userMessageId
      ? previous : { topicId: targetId, question, requestKey: id(), ...(userMessageId ? { userMessageId } : {}) };
    questionAttempts.current.set(targetId, request);
    runningQuestions.current.add(targetId);
    const knownIds = new Set(workspace?.messages.map(message => message.id));
    setPendingQuestions(current => ({ ...current, [targetId]: request }));
    if (activeIdRef.current === targetId) setAiError('');
    showConversation(targetId);
    try {
      const result = await api<{ message: Message; userMessage: Message }>('/api/ai', { method: 'POST', body: JSON.stringify(request) });
      setWorkspace(current => current ? { ...current, messages: [...current.messages.filter(message => message.id !== result.message.id && message.id !== result.userMessage.id), result.userMessage, result.message] } : current);
      questionAttempts.current.delete(targetId);
      clearSentDraft(targetId, question);
      showConversation(targetId);
    } catch (err) {
      let completed = false;
      try {
        const fresh = await api<Workspace>('/api/workspace');
        // Recovery for one node must not replace another node's newer work.
        setWorkspace(current => {
          if (!current) return fresh;
          const byId = new Map(current.messages.map(message => [message.id, message]));
          for (const message of fresh.messages.filter(message => message.topicId === targetId)) byId.set(message.id, message);
          return { ...current, aiConfigured: fresh.aiConfigured, messages: [...byId.values()] };
        });
        const savedQuestion = fresh.messages.filter(message => message.topicId === targetId && message.role === 'user' && message.content === question && (userMessageId ? message.id === userMessageId : !knownIds.has(message.id))).at(-1);
        const answer = savedQuestion?.runId ? fresh.messages.find(message => message.role === 'assistant' && message.runId === savedQuestion.runId) : undefined;
        if (answer) {
          questionAttempts.current.delete(targetId);
          completed = answer.state === 'complete';
          if (completed) clearSentDraft(targetId, question);
        }
      } catch { /* Keep the request key: an unknown outcome must not be charged twice. */ }
      if (!completed) {
        if (activeIdRef.current === targetId) setAiError((err as Error).message);
        else setNotice('An answer in another node could not finish. Its question is preserved in that thread.');
      }
    } finally {
      runningQuestions.current.delete(targetId);
      setPendingQuestions(current => { const next = { ...current }; delete next[targetId]; return next; });
    }
  }
  async function askQuestion(e?: FormEvent) {
    e?.preventDefault();
    if (!topic || !draft.trim() || aiBusy) return;
    setThreadTab('conversation');
    // Reuse a failed or not-yet-answered saved question instead of duplicating it.
    const unanswered = messages.filter(message => message.role === 'user' && message.content === draft.trim() && !messages.some(answer => answer.role === 'assistant' && answer.runId === message.runId && answer.state === 'complete')).at(-1);
    await sendQuestion(topic.id, draft, unanswered?.id);
  }
  async function branchQuestion(source?: Message) {
    if (!topic || branchInFlight.current) return;
    const question = (source?.content || draft).trim();
    if (!question) return;
    const parent = topic;
    const attempts = readLocal<QuestionBranchRequest[]>('branch-requests', []);
    const previous = attempts.find(attempt => attempt.parentId === parent.id && attempt.question === question && attempt.sourceMessageId === source?.id);
    const request: QuestionBranchRequest = previous || {
      parentId: parent.id, question, requestKey: id(), ...(source ? { sourceMessageId: source.id } : {}),
      anchor: { topicId: parent.id, quote: '', scrollTop: scrollRef.current?.scrollTop || 0, draft },
    };
    if (!previous) writeLocal('branch-requests', [...attempts, request]);
    branchInFlight.current = true; setBranching(true); setAiError('');
    try {
      const result = await api<{ topic: Topic; question: Message }>('/api/topics/branch', { method: 'POST', body: JSON.stringify(request) });
      writeLocal('branch-requests', readLocal<QuestionBranchRequest[]>('branch-requests', []).filter(attempt => attempt.requestKey !== request.requestKey));
      setWorkspace(current => current ? {
        ...current,
        topics: [...current.topics.filter(item => item.id !== result.topic.id), result.topic],
        messages: [...current.messages.filter(item => item.id !== result.question.id), result.question],
      } : current);
      if (!source && readLocal<string>(`draft:${parent.id}`, '').trim() === question) writeLocal(`draft:${parent.id}`, '');
      if (scrollRef.current && activeIdRef.current === parent.id) writeLocal(`scroll:${parent.id}:${threadTabRef.current}`, scrollRef.current.scrollTop);
      setThreadTab('conversation'); setActiveId(result.topic.id); setNotebookId(result.topic.notebookId); setThreadOpen(true);
      setDraft(''); setBlockDraft(null); setTitleDraft(null); setSelection(null); setAnchorNotice(null); setError('');
      setCollapsed(current => { const next = new Set(current); next.delete(parent.id); return next; });
      writeLocal('active-topic', result.topic.id);
      window.history.pushState({}, '', `#thread=${result.topic.id}`);
      setNotice('New node connected. Your parent conversation is still there.');
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; });
      if (workspace?.aiConfigured) void sendQuestion(result.topic.id, result.question.content, result.question.id);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status && status >= 400 && status < 500 && status !== 408) {
        writeLocal('branch-requests', readLocal<QuestionBranchRequest[]>('branch-requests', []).filter(attempt => attempt.requestKey !== request.requestKey));
      }
      if (activeIdRef.current === parent.id) setAiError((err as Error).message);
      else setNotice('The new node could not be created. Your question is still saved.');
    } finally { branchInFlight.current = false; setBranching(false); }
  }
  function beginKeep(message: Message) { setKeepMessage(message); setKeepText(message.content); setKeepTarget(activeId || ''); setError(''); setModal('keep'); }
  async function keepAnswer(e: FormEvent) {
    e.preventDefault(); const target = workspace?.topics.find(t => t.id === keepTarget); if (!target || !keepMessage || !keepText.trim()) return; setBusy(true);
    const block: NoteBlock = { id: id(), type: 'callout', title: 'Kept from a discussion', content: keepText.trim(), provenance: { messageId: keepMessage.id, topicId: keepMessage.topicId, excerpt: keepMessage.content, createdAt: new Date().toISOString(), author: 'ai', edited: keepText.trim() !== keepMessage.content } };
    const result = await patchTopic(target, { blocks: [...target.blocks, block] });
    if (result) { setModal(null); setNotice(`Explanation kept in “${target.title}”.`); } setBusy(false);
  }
  async function openHistory() { if (!topic) return; setModal('history'); setHistory(null); setError(''); try { const result = await api<{ revisions: Revision[] }>(`/api/topics/${topic.id}/history`); if (activeIdRef.current === topic.id) setHistory(result.revisions); } catch (err) { if (activeIdRef.current === topic.id) setError((err as Error).message); } }

  const renderTree = (parentId: string | null, depth = 0): ReactNode => topics.filter(t => t.parentId === parentId).map(t => {
    const children = topics.filter(c => c.parentId === t.id); const closed = collapsed.has(t.id);
    return <div key={t.id}><div className={`tree-row ${activeId === t.id ? 'active' : ''}`} style={{ paddingLeft: 9 + Math.min(depth, 7) * 17 }}><button className={`tree-expander ${children.length ? '' : 'empty'}`} aria-label={`${closed ? 'Expand' : 'Collapse'} ${t.title}`} aria-expanded={!closed} onClick={() => setCollapsed(c => { const next = new Set(c); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); writeLocal('collapsed', [...next]); return next; })} disabled={!children.length}>{children.length ? closed ? <ChevronRight size={13} /> : <ChevronDown size={13} /> : <span className={`tree-dot ${t.status}`} />}</button><button className="tree-topic" onClick={() => navigate(t.id)} title={t.title}><span>{t.title}</span>{t.status === 'understood' && <Check size={12} className="tree-check" />}</button></div>{!closed && children.length > 0 && renderTree(t.id, depth + 1)}</div>;
  });

  if (!workspace) return <div className="loading-screen"><Logo /><div className="loading-card">{loadingError ? <><h1>Let’s reconnect your workspace.</h1><p>{loadingError}</p><button className="button primary" onClick={() => void load()}>Try again</button></> : <><LoaderCircle className="spinner" size={24} /><p>Opening your workspace…</p></>}</div></div>;

  return <div className={`workspace map-first-workspace lumen-workspace ${threadOpen ? 'is-thread-open' : ''} ${threadFloating ? 'is-thread-floating' : ''}`}>
    {mobileSidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" tabIndex={-1} inert={threadOpen || !!modal} onClick={() => setSidebarOpen(false)} />}
    <aside ref={sidebarRef} id="workspace-navigation" className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Map navigation" aria-hidden={!sidebarOpen || undefined} tabIndex={-1} inert={threadOpen || !!modal || !sidebarOpen}><div className="sidebar-brand"><Logo /><button className="icon-button" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
      <button className="search-button" onClick={() => { setSearch(''); setModal('search'); }}><Search size={16} /><span>Search anything</span><kbd>⌘ K</kbd></button>
      <div className="sidebar-navigation">
      <div className="sidebar-section-label"><span>LIBRARY</span><button className="icon-button" aria-label="Create map" onClick={() => { setNewTitle(''); setNewDescription(''); setError(''); setModal('notebook'); }}><Plus size={16} /></button></div>
      <div className="notebook-list">{workspace.notebooks.map(n => <button className={`notebook-item ${notebookId === n.id ? 'active' : ''}`} key={n.id} onClick={() => openMap(n.id)}><Network size={17} /><span>{n.title}</span>{n.isSample && <span className="sample-tag">Sample</span>}</button>)}</div>
      {notebook && <><div className="sidebar-rule" /><div className="sidebar-section-label"><span>ON THIS MAP <span className="topic-count">{topics.length}</span></span><button className="icon-button" aria-label="Create topic" onClick={() => beginTopic(false)}><Plus size={16} /></button></div><nav className="topic-tree" aria-label="Topics">{renderTree(null)}</nav><button className="add-topic-sidebar" onClick={() => beginTopic(false)}><Plus size={14} /> New topic</button></>}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-note"><GitBranch size={19} /><p>A thought is just<br /><span>the beginning.</span></p></div><button className="sidebar-setting ai-sidebar-connect" onClick={openConnection}><Sparkles size={16} />{workspace.aiConfigured ? 'AI connected' : 'Connect AI'}<span className={`ai-connection-dot ${workspace.aiConfigured ? 'is-connected' : ''}`} /></button><button className="sidebar-setting" onClick={() => { setError(''); setModal('settings'); }}><Settings2 size={16} /> Workspace settings</button><div className="local-workspace"><span className="local-dot" /><span>Local workspace</span><span className="local-avatar">You</span></div></div>
    </aside>
    <div className="workspace-body" inert={(threadOpen && mobileViewport) || !!modal || mobileSidebarOpen}>
      <header className="topbar lumen-topbar">
        <button className="lumen-brand-home" aria-label="Back to map" onClick={() => closeThread()}><Logo /></button>
        <button ref={sidebarTriggerRef} className="lumen-map-selector" aria-label="Open map library" aria-expanded={sidebarOpen} aria-controls="workspace-navigation" onClick={openNavigation}><Network size={16} /><span>{notebook?.title || 'Your maps'}</span><ChevronDown size={14} /></button>
        <div className="topbar-right">
          <span className={`save-indicator ${saveState}`} role="status">{saveState === 'saving' ? <LoaderCircle className="spinner" size={13} /> : saveState === 'error' ? <CircleHelp size={13} /> : <CheckCheck size={14} />}<span>{saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Unsaved changes' : (blockDraft || titleDraft) ? 'Draft saved' : 'Saved'}</span></span>
          <button className="icon-button lumen-search" aria-label="Search thoughts" title="Search · ⌘ K" onClick={() => { setSearch(''); setModal('search'); }}><Search size={20} /></button>
          <div ref={exportRef} className="export-wrap"><button ref={exportTriggerRef} className="icon-button export-button" aria-label="Export map" aria-expanded={exportOpen} aria-controls={exportOpen ? 'map-export-options' : undefined} disabled={!notebook} onClick={() => setExportOpen(!exportOpen)}><ArrowDownToLine size={18} /></button>{exportOpen && notebook && <div id="map-export-options" className="popover export-popover" role="group" aria-label="Export saved notes"><span>EXPORT SAVED NOTES</span><a href={`/api/export?notebookId=${encodeURIComponent(notebook.id)}&format=markdown`} onClick={() => setExportOpen(false)}><FileText size={15} /> Markdown</a><a href={`/api/export?notebookId=${encodeURIComponent(notebook.id)}&format=json`} onClick={() => setExportOpen(false)}><Layers2 size={15} /> Structured JSON</a></div>}</div>
          <button className="lumen-profile" aria-label="Workspace settings" onClick={() => { setError(''); setModal('settings'); }}>You</button>
        </div>
      </header>
      <nav className="lumen-tool-rail" aria-label="Canvas tools">
        <button aria-label="New topic" title="New topic" disabled={!notebook} onClick={() => beginTopic(false)}><Plus size={21} /></button>
        <button aria-label="Map library" title="Map library" onClick={openNavigation}><Network size={19} /></button>
        <span className="tool-divider" />
        <button className={workspace.aiConfigured ? 'is-connected' : ''} aria-label={workspace.aiConfigured ? 'Manage AI connection' : 'Connect AI'} title={workspace.aiConfigured ? 'AI connected' : 'Connect AI'} onClick={openConnection}><Sparkles size={20} /><span className="tool-status-dot" /></button>
      </nav>
      <div className="map-work-area">
        {!notebook ? <section className="empty-workspace"><span className="empty-icon"><Network size={30} /></span><div className="eyebrow">A LITTLE SPACE TO THINK</div><h1>Every idea leads somewhere.</h1><p>Create a map for something you want to understand.<br />Follow a connection. Open a thread. See the bigger picture.</p><button className="button primary" onClick={() => { setNewTitle(''); setNewDescription(''); setModal('notebook'); }}><Plus size={16} />Create your first map</button></section> : <TopicMap key={notebook.id} topics={topics} selectedId={activeId || undefined} onSelect={navigate} onCreate={() => beginTopic(false)} />}
      </div>
    </div>
    {threadOpen && topic && !modal && !mobileViewport && <ThreadTether key={topic.id} topicId={topic.id} />}
    {threadOpen && topic && <TopicThread mapId={topic.notebookId} onFloatingChange={setThreadFloating} title={topic.title} suspended={!!modal} onClose={() => closeThread()}>
      <div className="thread-toolbar"><div className="thread-location" data-thread-drag-handle role={mobileViewport ? undefined : "button"} tabIndex={mobileViewport ? -1 : 0} aria-label={mobileViewport ? undefined : "Move chat panel"} aria-keyshortcuts={mobileViewport ? undefined : "Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown Home"} title={mobileViewport ? undefined : "Drag to move · Shift + arrow keys to move · Home to dock"}><GripVertical size={16} aria-hidden="true" /><span>{notebook?.title}</span><span className="thread-live-dot" aria-hidden="true" /></div><div className="thread-toolbar-actions"><button data-thread-dock className="icon-button thread-dock-button" hidden={!threadFloating || mobileViewport} aria-label="Dock chat panel" title="Dock chat panel on the right"><PanelRightClose size={16} /></button><button className="icon-button thread-history" aria-label="View topic history" title="Version history" onClick={() => void openHistory()}><History size={16} /></button><button className="thread-branch-button" onClick={() => beginTopic(true, null)}><GitBranch size={14} />Branch out</button><button className="icon-button" title="Print this thread" aria-label="Print this thread" onClick={() => window.print()}><ArrowDownToLine size={16} /></button><span className="thread-toolbar-divider" /><button data-thread-close className="icon-button" aria-label="Close thread and return to map" title="Back to map · Esc" onClick={() => closeThread()}><X size={19} /></button></div></div>
      <main className="thread-scroll" ref={scrollRef} onScroll={() => { if (activeId && scrollRef.current) writeLocal(`scroll:${activeId}:${threadTabRef.current}`, scrollRef.current.scrollTop); }}>
        <article className="thread-story" onMouseUp={captureSelection} onKeyUp={e => { if (e.key === 'Shift') captureSelection(); }}>
          {threadTab === 'notes' && ancestors.length > 1 && !topic.anchor && <nav className="topic-path" aria-label="Topic ancestry">{ancestors.map(a => <span key={a.id}><button onClick={() => navigate(a.id)}>{a.title}</button><ChevronRight size={12} /></span>)}<span className="current">{topic.title}</span></nav>}
          {anchorNotice && <div className="anchor-notice"><div><GitBranch size={16} /><span>{anchorNotice.text}</span><button className="icon-button" aria-label="Dismiss return notice" onClick={() => setAnchorNotice(null)}><X size={14} /></button></div>{anchorNotice.quote && <blockquote>{anchorNotice.quote}</blockquote>}</div>}
          {titleDraft !== null ? <><form className="title-editor" onSubmit={e => { e.preventDefault(); void saveTitle(); }}><label className="sr-only" htmlFor="topic-title">Topic title</label><input id="topic-title" autoFocus value={titleDraft.value} onChange={e => setTitleDraft({ ...titleDraft, value: e.target.value })} maxLength={180} /><button className="button primary" type="submit" disabled={saveState === 'saving' || titleDraft.baseRevision !== topic.revision}>Save</button><button className="icon-button" type="button" aria-label="Cancel title edit" onClick={cancelTitle}><X size={17} /></button></form>{titleDraft.baseRevision !== topic.revision && <div className="draft-conflict"><strong>This topic changed while you were renaming it.</strong><p>The current saved title is “{topic.title}”. Your proposed title is still in the field above.</p><button className="button subtle" disabled={saveState === 'saving'} onClick={() => void saveTitle(true)}>Apply my title to the latest version</button></div>}</> : <div className="note-title"><h1 id="thread-title">{topic.title}</h1><button className="icon-button title-edit" aria-label="Edit topic title" onClick={() => setTitleDraft({ topicId: topic.id, value: topic.title, baseRevision: topic.revision })}><Pencil size={16} /></button></div>}
          {(topic.anchor || topic.parentId) && <button className="thread-parent-link" aria-label={`Back to ${ancestors.at(-1)?.title || 'parent thread'}`} onClick={() => navigate(topic.anchor?.topicId || topic.parentId!, topic.anchor || undefined)}><Network size={15} /><span>Connected to <strong>{ancestors.at(-1)?.title || 'parent thread'}</strong></span><ArrowUpRight size={12} /></button>}
          {topic.description && (threadTab === 'notes' || !topic.parentId) && <p className="note-description">{topic.description}</p>}
          <div className="thread-tabs" role="tablist" aria-label="Topic view" onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); const next = event.key === 'Home' ? 'conversation' : event.key === 'End' ? 'notes' : threadTab === 'conversation' ? 'notes' : 'conversation';
            changeThreadTab(next); document.getElementById(`thread-tab-${next}`)?.focus();
          }}><button id="thread-tab-conversation" role="tab" aria-selected={threadTab === 'conversation'} aria-controls="thread-conversation-panel" tabIndex={threadTab === 'conversation' ? 0 : -1} onClick={() => changeThreadTab('conversation')}><MessageCircle size={14} />Conversation{messages.length > 0 && <span>{messages.filter(message => message.role === 'user').length}</span>}</button><button id="thread-tab-notes" role="tab" aria-selected={threadTab === 'notes'} aria-controls="thread-notes-panel" tabIndex={threadTab === 'notes' ? 0 : -1} onClick={() => changeThreadTab('notes')}><FileText size={14} />Notes <span>{topic.blocks.length}</span></button></div>
          {error && !modal && threadTab === 'conversation' && <div className="error-message" role="alert">{error}</div>}
          <div id="thread-notes-panel" role="tabpanel" aria-labelledby="thread-tab-notes" hidden={threadTab !== 'notes'} inert={threadTab !== 'notes'}>
          <div className="note-metadata"><label className={`status-select ${topic.status}`}><span className="status-dot" /><select aria-label="Learning status" value={topic.status} disabled={saveState === 'saving'} onChange={e => void patchTopic(topic, { status: e.target.value as Topic['status'] })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={11} /></label><span className="metadata-divider" /><span><FileText size={13} />{topic.blocks.length} note{topic.blocks.length !== 1 ? 's' : ''}</span><span className="metadata-divider" /><span><GitBranch size={13} />{topics.filter(t => t.parentId === topic.id).length} branch{topics.filter(t => t.parentId === topic.id).length !== 1 ? 'es' : ''}</span></div>
          <div className="note-rule" />
          {error && !modal && <div className="error-message" role="alert">{error}{(blockDraft || titleDraft) && " Your draft is preserved on this device."}</div>}
          {topic.anchor?.quote && <details className="thread-origin"><summary><GitBranch size={13} />Where this thought began<ChevronDown size={12} /></summary><blockquote>“{topic.anchor.quote}”</blockquote></details>}
          <div className="note-blocks">{topic.blocks.map(block => <section id={`block-${block.id}`} data-block-id={block.id} key={block.id} className={`note-block block-${block.type} ${highlight === block.id ? 'highlighted' : ''}`}><div className="block-actions"><button className="icon-button" title="Explore this block as a topic" aria-label={`Explore ${block.title || blockNames[block.type]} as a topic`} onClick={() => beginTopic(true, { blockId: block.id, quote: block.content.slice(0, 2000) })}><GitBranch size={14} /></button><button className="icon-button" title="Edit block" aria-label={`Edit ${block.title || blockNames[block.type]}`} onClick={() => beginEdit(block)}><Pencil size={13} /></button></div><BlockBody block={block} />{block.provenance?.author === 'ai' && <button className="provenance" onClick={() => { navigate(block.provenance!.topicId); focusQuestion(block.provenance!.topicId); }}><Sparkles size={11} />Kept from a discussion{block.provenance.edited ? ' · edited by you' : ''}<ArrowUpRight size={11} /></button>}</section>)}</div>
          {topic.blocks.length === 0 && !blockDraft && <div className="empty-note"><div className="empty-note-drawing"><Pencil size={25} /><span /><span /></div><h2>Let’s follow this thought.</h2><p>Add an explanation in your own words, or switch to Conversation to ask a question.</p><div><button className="button subtle" onClick={() => beginEdit()}><Plus size={15} />Write a note</button><button className="button primary" onClick={() => focusQuestion()}><Sparkles size={15} />Ask a question</button></div></div>}
          {blockDraft?.topicId === topic.id && <form id="block-editor" className="block-editor" onSubmit={saveBlock}><div className="editor-heading"><h3>{blockDraft.isNew ? 'Add to this thread' : 'Edit your note'}</h3><span>Draft saved on this device</span></div>{blockConflict && <div className="draft-conflict"><strong>This topic changed while you were editing.</strong><p>Your draft is preserved. Review the current saved version below, then keep your draft as a new block to preserve both.</p><details><summary>Current saved note</summary><p>{topic.blocks.find(b => b.id === blockDraft.block.id)?.content || 'The original block was removed or this draft is a new block.'}</p></details><button type="button" className="button subtle" disabled={busy} onClick={() => void keepConflictedDraft()}><Plus size={14} />Keep draft as a new block</button></div>}<div className="editor-fields"><label>Block type<select value={blockDraft.block.type} onChange={e => setBlockDraft({ ...blockDraft, block: { ...blockDraft.block, type: e.target.value as BlockType, ...(e.target.value === 'chart' ? { chart: blockDraft.block.chart || { mean: 0, deviation: 1, shadeMin: -1, shadeMax: 1 } } : {}) } })}>{Object.entries(blockNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><label>Label <span>(optional)</span><input value={blockDraft.block.title || ''} onChange={e => setBlockDraft({ ...blockDraft, block: { ...blockDraft.block, title: e.target.value } })} placeholder="Give this note a little context" /></label></div><label>{blockDraft.block.type === 'chart' ? 'Chart description' : 'Content'}<textarea value={blockDraft.block.content} onChange={e => setBlockDraft({ ...blockDraft, block: { ...blockDraft.block, content: e.target.value } })} rows={5} required={blockDraft.block.type !== 'chart'} placeholder="Write in your own words…" /></label>{blockDraft.block.type === 'chart' && blockDraft.block.chart && <div className="chart-editor-fields">{([['mean', 'Mean (μ)'], ['deviation', 'Standard deviation (σ)'], ['shadeMin', 'Shade from'], ['shadeMax', 'Shade to']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" step="any" min={key === 'deviation' ? .001 : undefined} required value={blockDraft.block.chart![key]} onChange={e => setBlockDraft({ ...blockDraft, block: { ...blockDraft.block, chart: { ...blockDraft.block.chart!, [key]: Number(e.target.value) } } })} /></label>)}</div>}<div className="editor-footer"><span>Plain text is perfect. Make it yours.</span><div><button className="button ghost" type="button" onClick={cancelEdit}>Cancel</button><button className="button primary" disabled={busy || blockConflict} type="submit">{busy ? <LoaderCircle size={14} className="spinner" /> : <Check size={14} />}Save note</button></div></div></form>}
          {topic.blocks.length > 0 && !blockDraft && <button className="add-block" onClick={() => beginEdit()}><Plus size={15} />Add an insight</button>}
          {(topic.blocks.length > 0 || topics.some(child => child.parentId === topic.id)) && <div className="branches-section"><div className="section-heading"><div><GitBranch size={16} /><h2>Connected ideas</h2></div><button onClick={() => beginTopic(true, null)}><Plus size={14} />New branch</button></div>{topics.filter(t => t.parentId === topic.id).length ? <div className="branch-cards">{topics.filter(t => t.parentId === topic.id).map(child => <button className="branch-card" key={child.id} onClick={() => navigate(child.id)}><div className={`branch-card-icon ${child.status}`}><GitBranch size={17} /></div><div><strong>{child.title}</strong><span>{statuses[child.status]} · {child.blocks.length} note{child.blocks.length !== 1 ? 's' : ''}</span></div><ArrowUpRight size={17} /></button>)}</div> : <p className="no-branches">Ask a follow-up in Conversation, then choose “Ask in new node” to connect it here.</p>}</div>}
          
          </div>
        </article><section id="thread-conversation-panel" role="tabpanel" aria-labelledby="thread-tab-conversation" hidden={threadTab !== 'conversation'} inert={threadTab !== 'conversation'} className="thread-conversation" aria-live="polite">
          {messages.length === 0 && topic.blocks.some(block => block.type === 'definition' || block.type === 'formula') && <div className="reference-summary"><span className="reference-summary-label"><BookOpen size={13} />From your notes</span>{topic.blocks.filter(block => block.type === 'definition' || block.type === 'formula').slice(0, 2).map(block => <div key={block.id} className={block.type === 'formula' ? 'reference-formula' : 'reference-definition'}>{block.type === 'formula' ? <FormulaDisplay content={block.content} /> : block.content}</div>)}<button onClick={() => changeThreadTab('notes')}>View all notes<ArrowUpRight size={12} /></button></div>}
          <div className="thread-section-label"><MessageCircle size={15} /><span>{messages.length || aiBusy ? 'THE CONVERSATION' : 'KEEP EXPLORING'}</span><span className="thread-section-line" /></div>
          {messages.length === 0 && !aiBusy && <div className="thread-invitation"><p>What would you like to understand about {topic.title.toLowerCase()}?</p><div className="thread-suggestions">{['Explain it simply', 'Show me an example'].map(question => <button key={question} onClick={() => { setDraft(question); focusQuestion(); }}>{question}<ArrowUpRight size={13} /></button>)}</div></div>}
          {messages.map(message => {
            const answer = message.role === 'user' && message.runId ? messages.find(item => item.role === 'assistant' && item.runId === message.runId) : undefined;
            const unanswered = message.role === 'user' && (!message.runId || answer?.state === 'failed' || answer?.state === 'interrupted');
            return <div className={`message ${message.role}`} key={message.id}>
              <span className={`message-avatar ${message.role === 'user' ? 'is-user' : 'is-assistant'}`} aria-hidden="true">{message.role === 'user' ? <UserRound size={16} /> : <OffscriptMark size={19} />}</span>
              <div className="message-body"><div className="message-label"><span className="message-author">{message.role === 'user' ? 'You' : 'Offscript'}</span>{message.state !== 'complete' && <span className="message-state">{message.state === 'failed' ? 'Could not finish' : 'Interrupted'}</span>}<time className="message-time" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>
              <div className="message-content">{message.role === 'assistant' && message.state === 'complete' ? <ChatText content={message.content} /> : message.content}</div>
              <div className="message-actions">
                {message.role === 'assistant' && message.state === 'complete' && <button className="keep-answer" onClick={() => beginKeep(message)}><Plus size={12} />Keep this insight</button>}
                {message.role === 'user' && <button className="message-branch" disabled={branching} onClick={() => void branchQuestion(message)}><GitBranch size={12} />Explore as new node<ArrowUpRight size={12} /></button>}
                {unanswered && !aiBusy && <button className="message-answer" onClick={() => void sendQuestion(topic.id, message.content, message.id)}><Sparkles size={12} />{answer ? 'Try again' : workspace.aiConfigured ? 'Answer this question' : 'Connect AI to answer'}</button>}
              </div></div>
            </div>;
          })}
          {pendingQuestion && <>
            {!messages.some(message => message.id === pendingQuestion.userMessageId || (message.role === 'user' && message.content === pendingQuestion.question && message.runId && !messages.some(answer => answer.runId === message.runId && answer.role === 'assistant'))) && <div className="message user is-pending"><span className="message-avatar is-user" aria-hidden="true"><UserRound size={16} /></span><div className="message-body"><div className="message-label"><span className="message-author">You</span></div><div className="message-content">{pendingQuestion.question}</div></div></div>}
            <div className="ai-thinking" role="status"><LoaderCircle size={15} className="spinner" /><span>Thinking through your question…<small>You can keep exploring other nodes.</small></span></div>
          </>}
          {aiError && <div className="error-message" role="alert">{aiError}{!workspace.aiConfigured && <button className="button subtle" onClick={openConnection}>Connect AI</button>}</div>}
          {topics.some(child => child.parentId === topic.id) && <div className="conversation-branches"><span><GitBranch size={12} />Followed from here</span><div>{topics.filter(child => child.parentId === topic.id).map(child => <button className="conversation-branch" key={child.id} onClick={() => navigate(child.id)}><span>{child.title}</span><ArrowUpRight size={13} /></button>)}</div></div>}
          <div ref={conversationEnd} className="conversation-end" />
        </section>
      </main>
      <div className="thread-compose" hidden={threadTab !== 'conversation'}>
        {!workspace.aiConfigured && <div className="provider-note"><span /><span>Connect AI to start a conversation.</span><button onClick={openConnection}>Connect AI <ArrowUpRight size={11} /></button></div>}
        <form className="question-composer" onSubmit={askQuestion}>
          <label className="sr-only" htmlFor="question">Ask about this topic</label>
          <textarea ref={questionRef} id="question" value={draft} onChange={e => setDraft(e.target.value)} maxLength={8000} placeholder={messages.length ? 'Ask a follow-up…' : `Ask about ${topic.title.toLowerCase()}…`} rows={1} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void askQuestion(); } }} />
          <button className="compose-send" type="submit" aria-label="Send question" title="Ask in this node · ⌘ / Ctrl + Enter" disabled={!draft.trim() || aiBusy || branching}>{aiBusy ? <LoaderCircle size={16} className="spinner" /> : <ArrowRight size={19} />}</button>
        </form>
        <div className="compose-footer">
          <button className="compose-branch" type="button" disabled={!draft.trim() || branching || aiBusy} onClick={() => void branchQuestion()} title="Create a connected node and ask this question there">{branching ? <LoaderCircle size={13} className="spinner" /> : <Plus size={15} />}<span>Ask in new node</span></button>
          <p className="ai-disclaimer">{draft.trim() ? '⌘ / Ctrl + Enter to send' : 'Follow your curiosity.'}</p>
        </div>
      </div>
    {selection && threadOpen && threadTab === 'notes' && !modal && <div className="selection-toolbar" role="region" aria-label="Selected passage actions"><GitBranch size={15} /><span>Follow that thought?</span><button onClick={() => beginTopic(true)}>Explore as topic<ArrowUpRight size={13} /></button><button className="icon-button" aria-label="Dismiss text selection" onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }}><X size={14} /></button></div>}
    </TopicThread>}

    {notice && <div className="toast" role="status"><Check size={15} /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={14} /></button></div>}
    {modal === 'connect' && <Dialog title="Connect AI" onClose={closeModal}><AiConnection onConnected={connectionReady} onCancel={closeModal} /></Dialog>}
    {modal === 'search' && <Dialog title="Find a thought" onClose={closeModal} wide><div className="search-input-wrap"><Search size={19} /><input data-autofocus aria-label="Search topics and notes" placeholder="Search your topics and notes…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="search-results">{workspace.topics.filter(t => !search.trim() || `${t.title} ${t.description} ${t.blocks.map(b => b.content).join(' ')}`.toLowerCase().includes(search.toLowerCase())).map(t => <button key={t.id} onClick={() => { navigate(t.id); setModal(null); }}><FileText size={18} /><div><strong>{t.title}</strong><span>{workspace.notebooks.find(n => n.id === t.notebookId)?.title} · {statuses[t.status]}</span><p>{t.description || t.blocks.find(b => b.content)?.content.slice(0, 130) || 'A new place to think.'}</p></div><ArrowUpRight size={17} /></button>)}{!workspace.topics.some(t => `${t.title} ${t.description} ${t.blocks.map(b => b.content).join(' ')}`.toLowerCase().includes(search.toLowerCase())) && <p className="empty-search">No matching thoughts yet. Try another word.</p>}</div></Dialog>}
    {(modal === 'topic' || modal === 'notebook') && <Dialog title={modal === 'notebook' ? 'A new map' : branch ? 'Follow your curiosity' : 'A new topic'} onClose={closeModal}><form onSubmit={modal === 'notebook' ? createNotebook : createTopic}><p className="modal-description">{modal === 'notebook' ? 'A home for the questions, connections, and little breakthroughs that come next.' : branch ? 'Open a new thread. We’ll keep your place, your passage, and your unsent question ready for your return.' : 'Give this idea a place on your map.'}</p>{branch?.anchor.quote && <blockquote className="modal-quote">“{branch.anchor.quote}”</blockquote>}<label>{modal === 'notebook' ? 'Map name' : 'Topic title'}<input data-autofocus value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={modal === 'notebook' ? 'What are you learning?' : 'What would you like to understand?'} required maxLength={180} /></label><label>A little context <span>(optional)</span><textarea rows={3} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="A question, a goal, or a starting thought…" /></label>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button className="button ghost" type="button" onClick={closeModal}>Cancel</button><button className="button primary" disabled={busy || !newTitle.trim()} type="submit">{busy ? <LoaderCircle size={15} className="spinner" /> : branch ? <GitBranch size={15} /> : <Plus size={15} />}{modal === 'notebook' ? 'Create map' : branch ? 'Explore topic' : 'Create topic'}</button></div></form></Dialog>}
    {modal === 'keep' && <Dialog title="Keep the part that clicked" onClose={closeModal} wide><form onSubmit={keepAnswer}><p className="modal-description">Make the explanation your own before adding it. Its original discussion stays linked.</p><label>Add to<select value={keepTarget} onChange={e => setKeepTarget(e.target.value)}>{topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Your saved explanation<textarea data-autofocus rows={9} value={keepText} onChange={e => setKeepText(e.target.value)} required /></label><div className="keep-preview-note"><Sparkles size={14} />Adds an editable insight to this thread, linked to its original discussion.</div>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button className="button ghost" type="button" onClick={closeModal}>Cancel</button><button className="button primary" type="submit" disabled={busy || !keepText.trim()}>{busy ? <LoaderCircle size={15} className="spinner" /> : <Check size={15} />}Keep this insight</button></div></form></Dialog>}
    {modal === 'history' && <Dialog title="A record of your thinking" onClose={closeModal} wide><p className="modal-description">Saved revisions of {topic?.title}. Each save preserves the previous note blocks on this local server.</p>{error && <p className="error-message">{error}</p>}{!history && !error ? <div className="modal-loading"><LoaderCircle className="spinner" size={22} />Loading revisions…</div> : <div className="history-list">{history?.map(rev => <details key={rev.revision}><summary><History size={15} /><strong>Revision {rev.revision}</strong><span>{new Date(rev.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><ChevronDown size={14} /></summary><div>{rev.blocks.length === 0 ? <p>Blank note page.</p> : rev.blocks.map(b => <section key={b.id}><span>{blockNames[b.type]}</span><p>{b.content || (b.chart ? `Mean ${b.chart.mean}; standard deviation ${b.chart.deviation}` : 'Empty block')}</p></section>)}</div></details>)}</div>}</Dialog>}
    {modal === 'settings' && <Dialog title="Your local workspace" onClose={closeModal}><div className="settings-intro"><Logo small /><div><strong>A quieter place to understand.</strong><p>Offscript · Local development preview</p></div></div><div className="settings-section"><h3><CheckCheck size={16} />Where your work lives</h3><p>Notes and conversations are saved in a SQLite database on this app’s server. Unsent questions and editor drafts stay in this browser. This preview has no accounts or cloud sync.</p></div><div className="settings-section"><h3><Sparkles size={16} />AI tutor <span className={`config-badge ${workspace.aiConfigured ? 'connected' : ''}`}>{workspace.aiConfigured ? 'Connected' : 'Not configured'}</span></h3><p>{workspace.aiConfigured ? 'Conversations use this topic and the parent context saved when it branched.' : 'Connect your OpenAI account with an API key to talk through ideas in each node.'}</p><button className="button subtle" onClick={openConnection}><Sparkles size={14} />{workspace.aiConfigured ? 'Manage AI connection' : 'Connect AI'}</button></div><div className="settings-section"><h3><ArrowDownToLine size={16} />Take your notes with you</h3><p>Use the map’s export button for Markdown or JSON. The thread toolbar prints the open thread. Discussions are excluded from exports.</p></div>{notebook && <div className="settings-danger"><div><strong>Delete {notebook.isSample ? 'sample map' : 'this map'}</strong><p>Remove “{notebook.title}” and its topics permanently.</p></div><button className="icon-button danger" aria-label="Delete current map" onClick={() => { setError(''); setModal('delete'); }}><Trash2 size={17} /></button></div>}</Dialog>}
    {modal === 'delete' && <Dialog title="Delete this map?" onClose={closeModal}><p className="modal-description">“{notebook?.title}” and its {topics.length} topics, note revisions, and conversations will be permanently deleted from this local workspace. This cannot be undone.</p><p className="modal-description">Export anything you want to keep before continuing.</p>{error && <p className="error-message" role="alert">{error}</p>}<div className="modal-actions"><button className="button ghost" onClick={closeModal}>Keep map</button><button className="button danger-fill" disabled={busy} onClick={() => void deleteNotebook()}>{busy ? <LoaderCircle className="spinner" size={15} /> : <Trash2 size={15} />}Delete permanently</button></div></Dialog>}
  </div>;
}
