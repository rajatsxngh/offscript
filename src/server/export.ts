import type { NoteBlock } from '../lib/types';
import { OffscriptStore } from './db';
import { assert } from './errors';

function markdownBlock(block: NoteBlock) {
  const title = block.title ? `### ${block.title.replace(/\n/g, ' ')}\n\n` : '';
  if (block.type === 'heading') return `### ${block.content.replace(/\n/g, ' ')}`;
  if (block.type === 'chart' && block.chart) {
    const chart = block.chart;
    return `${title}${block.content}\n\nNormal density chart: mean = ${chart.mean}; standard deviation = ${chart.deviation}; shaded interval = [${chart.shadeMin}, ${chart.shadeMax}].`;
  }
  if (block.type === 'formula' || block.type === 'code') {
    const longest = Math.max(2, ...(block.content.match(/`+/g) || []).map(value => value.length));
    const fence = '`'.repeat(longest + 1);
    return `${title}${fence}${block.type === 'formula' ? 'math' : ''}\n${block.content}\n${fence}`;
  }
  return `${title}${block.content}`;
}

export function exportNotebook(store: OffscriptStore, notebookId: string, format: string) {
  assert(format === 'json' || format === 'markdown', 'INVALID_FORMAT', 'Choose JSON or Markdown export.');
  const notebook = store.getNotebook(notebookId);
  // Frozen context, discussions, return drafts and original message excerpts stay private.
  const topics = store.workspace().topics.filter(topic => topic.notebookId === notebookId).map(topic => ({
    id: topic.id, parentId: topic.parentId, title: topic.title, description: topic.description,
    status: topic.status, revision: topic.revision, createdAt: topic.createdAt, updatedAt: topic.updatedAt,
    blocks: topic.blocks.map(block => ({ ...block, ...(block.provenance ? { provenance: { author: block.provenance.author, topicId: block.provenance.topicId, messageId: block.provenance.messageId, createdAt: block.provenance.createdAt, edited: block.provenance.edited } } : {}) })),
  }));
  const safeName = notebook.title.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'offscript-notes';
  if (format === 'json') return new Response(JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), notebook, topics }, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${safeName}.json"` },
  });
  const sections = topics.map(topic => {
    const parent = topics.find(item => item.id === topic.parentId);
    const original = store.getTopic(topic.id);
    return `## ${topic.title.replace(/\n/g, ' ')}\n\n${parent ? `Parent topic: ${parent.title}\n\n` : ''}${topic.description ? `${topic.description}\n\n` : ''}${original.blocks.map(markdownBlock).join('\n\n')}`;
  });
  return new Response(`# ${notebook.title.replace(/\n/g, ' ')}\n\n${notebook.description}\n\n${sections.join('\n\n---\n\n')}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${safeName}.md"` },
  });
}
