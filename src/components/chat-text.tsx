import type { ReactNode } from 'react';
import './chat-text.css';

/** Render a small Markdown subset as React elements. HTML and links stay plain text. */
function inline(text: string): ReactNode[] {
  const pieces: ReactNode[] = [];
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g;
  let cursor = 0, match: RegExpExecArray | null;
  while ((match = tokens.exec(text)) !== null) {
    if (match.index > cursor) pieces.push(text.slice(cursor, match.index));
    const token = match[0], key = `inline-${match.index}`;
    if (token.startsWith('`')) pieces.push(<code key={key}>{token.slice(1, -1)}</code>);
    else if (token.startsWith('**') || token.startsWith('__')) pieces.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    else pieces.push(<em key={key}>{token.slice(1, -1)}</em>);
    cursor = match.index + token.length;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces;
}

export function ChatText({ content }: { content: string }) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  const listItem = (line: string) => line.match(/^\s*(?:(\d+)[.)]|([-*+]))\s+(.+)$/);
  const boundary = (line: string) => /^\s*```/.test(line) || /^#{1,6}\s/.test(line) || /^>\s?/.test(line) || /^\s*(?:---+|\*\*\*+)\s*$/.test(line) || !!listItem(line);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i], start = i;
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const language = line.replace(/^\s*```/, '').trim();
      const code: string[] = []; i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(<div className="chat-text-code" key={start}>{language && <div className="chat-text-language">{language}</div>}<pre><code>{code.join('\n')}</code></pre></div>);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push(<h3 className={heading[1].length > 2 ? 'chat-text-subheading' : undefined} key={start}>{inline(heading[2].replace(/\s+#+\s*$/, ''))}</h3>); i++; continue; }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { blocks.push(<hr key={start} />); i++; continue; }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={start}>{inline(quote.join('\n'))}</blockquote>); continue;
    }
    const firstItem = listItem(line);
    if (firstItem) {
      const ordered = !!firstItem[1], items: ReactNode[] = [];
      while (i < lines.length) {
        const item = listItem(lines[i]);
        if (!item || !!item[1] !== ordered) break;
        const itemStart = i, parts = [item[3]]; i++;
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !boundary(lines[i])) parts.push(lines[i++].trim());
        items.push(<li key={itemStart}>{inline(parts.join('\n'))}</li>);
      }
      blocks.push(ordered ? <ol key={start} start={Number(firstItem[1])}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !boundary(lines[i])) paragraph.push(lines[i++]);
    blocks.push(<p key={start}>{inline(paragraph.join('\n'))}</p>);
  }
  return <div className="chat-text">{blocks}</div>;
}
