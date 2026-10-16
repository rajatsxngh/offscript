import test from 'node:test';
import assert from 'node:assert/strict';
import { arrangeGalleryTopics, galleryLinkLabel, galleryNodeSize, frameGalleryMap, galleryLabelFits } from '../src/lib/gallery-map-layout';
import type { Topic } from '../src/lib/types';

const topic = (id: string, parentId: string | null = null): Topic => ({ id, parentId, notebookId: 'map', title: id, description: '', status: 'exploring', blocks: [], revision: 1, anchor: null, inheritedContext: '', createdAt: '', updatedAt: '' });

test('Gallery arranges every thought in a growing map without overlapping blocks', () => {
  const topics = Array.from({ length: 40 }, (_, index) => topic(String(index), index ? String(Math.floor((index - 1) / 3)) : null));
  for (const compact of [true, false]) {
    const positions = arrangeGalleryTopics(topics, compact);
    assert.equal(Object.keys(positions).length, topics.length);
    const rects = topics.map(item => ({ ...positions[item.id], ...galleryNodeSize(!item.parentId) }));
    rects.forEach((a, index) => rects.slice(index + 1).forEach(b => {
      assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y, 'Topic bounds overlap');
    }));
  }
});

test('Gallery makes malformed parent cycles and missing-parent topics accessible', () => {
  const topics = [topic('one', 'two'), topic('two', 'one'), topic('orphan', 'missing'), topic('root')];
  const positions = arrangeGalleryTopics(topics, false);
  assert.deepEqual(Object.keys(positions).sort(), topics.map(item => item.id).sort());
  assert.deepEqual(arrangeGalleryTopics(topics, false), positions);
});

test('Gallery reserves an open central area for the first group of ideas', () => {
  const topics = [topic('root'), ...Array.from({ length: 5 }, (_, index) => topic(`child${index}`, 'root'))];
  const positions = arrangeGalleryTopics(topics, false);
  for (const item of topics) {
    const rect = { ...positions[item.id], ...galleryNodeSize(!item.parentId) };
    assert.ok(rect.x + rect.width <= 400 || rect.x >= 920 || rect.y + rect.height <= 500 || rect.y >= 780);
  }
});

test('Gallery link labels retain real branch excerpts and never invent a relationship', () => {
  assert.deepEqual(galleryLinkLabel(), ['Explore further']);
  assert.deepEqual(galleryLinkLabel('  '), ['Explore further']);
  assert.deepEqual(galleryLinkLabel('  A simple   quote  '), ['A simple quote']);
  const lines = galleryLinkLabel('This is a much longer quote from the actual parent conversation to explore.');
  assert.equal(lines.length, 2);
  assert.ok(lines.join(' ').endsWith('…'));
  assert.ok(lines.every(line => line.length <= 25));
});


test('Gallery starts compact windows at a readable scale with the root in view', () => {
  const rects = [{ x: 0, y: 0, width: 294, height: 480 }, { x: 380, y: 816, width: 264, height: 216 }];
  const padding = { left: 26, right: 26, top: 124, bottom: 110 };
  const view = frameGalleryMap(rects, 516, 614, padding);
  assert.equal(view.zoom, .64);
  assert.ok(view.x >= padding.left);
  assert.ok(view.y >= padding.top);
  assert.ok(view.x + rects[0].width * view.zoom <= 516 - padding.right);
  assert.ok(view.y + rects[0].height * view.zoom <= 614 - padding.bottom);
});

test('Gallery framing retains an all-map view when there is room to read it', () => {
  const rects = [{ x: 0, y: 0, width: 294, height: 480 }, { x: 600, y: 0, width: 264, height: 216 }];
  const padding = { left: 58, right: 48, top: 154, bottom: 104 };
  const view = frameGalleryMap(rects, 1470, 900, padding);
  assert.equal(view.zoom, 1.12);
  assert.ok(view.x + 864 * view.zoom <= 1470 - padding.right);
});

test('Gallery suppresses labels that would overlap a topic in narrow gaps', () => {
  const nodes = [{ x: 0, y: 0, width: 294, height: 480 }, { x: 380, y: 18, width: 264, height: 216 }];
  assert.equal(galleryLabelFits({ x: 337, y: 61 }, 1, nodes), false);
  assert.equal(galleryLabelFits({ x: 420, y: 530 }, 2, nodes), true);
  assert.equal(galleryLabelFits({ x: 424, y: 52 }, 1, [nodes[0], { ...nodes[1], x: 548 }]), true);
});
