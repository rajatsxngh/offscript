import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAnchor } from '../src/lib/anchors';
import { normalPdf, normalProbability, buildNormalCurve } from '../src/lib/normal-distribution';
import type { NoteBlock, Anchor } from '../src/lib/types';

const block = (id: string, content: string): NoteBlock => ({ id, type: 'paragraph', content });
const anchor = (blockId?: string, quote = 'standard deviation'): Anchor => ({ topicId: 'topic', blockId, quote, scrollTop: 240, draft: 'Why?' });

test('return follows the stable block when the same phrase occurs in another block', () => {
  assert.deepEqual(resolveAnchor([block('original', 'The standard deviation measures spread.'), block('duplicate', 'standard deviation')], anchor('original')), { kind: 'exact', blockId: 'original', quote: 'standard deviation' });
});
test('deleted original never silently reattaches to a copied phrase', () => {
  assert.equal(resolveAnchor([block('duplicate', 'standard deviation')], anchor('original')).kind, 'missing');
});
test('edited anchor preserves original excerpt and reports a missing match', () => {
  const result = resolveAnchor([block('original', 'A measure of spread.')], anchor('original'));
  assert.equal(result.kind, 'missing');
  assert.equal(result.quote, 'standard deviation');
});
test('an excerpt without a block id requires exactly one occurrence', () => {
  assert.equal(resolveAnchor([block('a', 'standard deviation and standard deviation')], anchor()).kind, 'ambiguous');
  assert.equal(resolveAnchor([block('a', 'standard deviation'), block('b', 'standard deviation')], anchor()).kind, 'ambiguous');
  assert.equal(resolveAnchor([block('a', 'standard deviation')], anchor()).kind, 'moved');
});
test('topic-level returns resolve without a fabricated passage', () => {
  assert.equal(resolveAnchor([], anchor(undefined, '')).kind, 'exact');
});
test('overlapping phrase occurrences cannot be treated as an exact anchor', () => {
  assert.equal(resolveAnchor([block('original', 'aaaa')], anchor('original', 'aaa')).kind, 'ambiguous');
});
test('deleting the selected occurrence does not reattach to a surviving duplicate in the same block', () => {
  const saved = { ...anchor('original', 'term'), blockSnapshot: 'first: term; second: term' };
  assert.equal(resolveAnchor([block('original', 'second: term')], saved).kind, 'missing');
});
test('normal density is normalized and scales with standard deviation', () => {
  assert.ok(Math.abs(normalPdf(0, 0, 1) - 0.3989422804) < 1e-9);
  assert.ok(Math.abs(normalPdf(10, 10, 2) - normalPdf(0, 0, 1) / 2) < 1e-10);
  const curve = buildNormalCurve(5, 2, 1001);
  let area = 0;
  for (let i = 1; i < curve.length; i++) area += (curve[i].x - curve[i-1].x) * (curve[i].y + curve[i-1].y) / 2;
  assert.ok(Math.abs(area - 1) < 0.00007);
});
test('normal ranges show calculated 68–95–99.7 probabilities', () => {
  assert.ok(Math.abs(normalProbability(-1, 1, 0, 1) - 0.68268949) < 1e-6);
  assert.ok(Math.abs(normalProbability(-2, 2, 0, 1) - 0.95449974) < 1e-6);
  assert.ok(Math.abs(normalProbability(-3, 3, 0, 1) - 0.99730020) < 1e-6);
  assert.ok(Math.abs(normalProbability(8, 12, 10, 2) - 0.68268949) < 1e-6);
});
test('invalid chart parameters produce a repairable failure', () => {
  assert.throws(() => normalPdf(0, 0, 0), /positive/);
  assert.throws(() => buildNormalCurve(0, -1), /positive/);
  assert.throws(() => normalProbability(2, -2, 0, 1), /range/);
  assert.throws(() => buildNormalCurve(NaN, 1), /finite/);
});
