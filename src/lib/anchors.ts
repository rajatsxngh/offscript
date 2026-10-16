import type { Anchor, NoteBlock } from './types';

export type AnchorResolution = {
  kind: 'exact' | 'moved' | 'missing' | 'ambiguous';
  blockId?: string;
  quote: string;
};

function occurrences(content: string, quote: string): number {
  if (!quote) return 0;
  let count = 0, from = 0;
  while (from < content.length) {
    const index = content.indexOf(quote, from);
    if (index < 0) break;
    count++;
    from = index + 1;
  }
  return count;
}

/** Conservative return matching: a deleted stable block never attaches to a copy. */
export function resolveAnchor(blocks: NoteBlock[], anchor: Anchor): AnchorResolution {
  const { quote, blockId } = anchor;
  if (blockId) {
    const original = blocks.find(block => block.id === blockId);
    if (!original) return { kind: 'missing', quote };
    if (!quote) return { kind: 'exact', blockId, quote };
    // Without origin offsets, any changed block is an uncertain return target.
    // In particular, deleting one duplicate phrase must not select another copy.
    if (anchor.blockSnapshot !== undefined && original.content !== anchor.blockSnapshot) return { kind: 'missing', quote };
    const count = occurrences(original.content, quote);
    if (count === 1) return { kind: 'exact', blockId, quote };
    return { kind: count > 1 ? 'ambiguous' : 'missing', quote };
  }
  if (!quote) return { kind: 'exact', quote };
  const matches = blocks.flatMap(block => Array.from({ length: occurrences(block.content, quote) }, () => block.id));
  if (matches.length === 1) return { kind: 'moved', blockId: matches[0], quote };
  return { kind: matches.length > 1 ? 'ambiguous' : 'missing', quote };
}
