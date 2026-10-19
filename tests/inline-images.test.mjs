import test from 'node:test';
import assert from 'node:assert/strict';
import { splitInlineImages, insertInlineImage, findInkBounds } from '../src/services/inlineImages.ts';

const png = 'data:image/png;base64,aGVsbG8=';
test('old embedded sketches become image blocks without changing stored text', () => {
  const source = `Before\n\n![Ink Sketch](${png})\n\nAfter`;
  const blocks = splitInlineImages(source);
  assert.deepEqual(blocks.map(b => b.kind), ['text', 'image', 'text']);
  assert.equal(blocks[1].src, png);
  assert.equal(blocks.map(b => source.slice(b.start, b.end)).join(''), source);
  assert.ok(blocks.filter(b => b.kind === 'text').every(b => !b.text.includes('base64')));
});
test('multiple images retain editable text before, between and after', () => {
  const blocks = splitInlineImages(`![A](${png})middle![B](${png})`);
  assert.equal(blocks.length, 5);
  assert.equal(blocks[0].text, '');
  assert.equal(blocks[2].text, 'middle');
  assert.equal(blocks[4].text, '');
});
test('image examples in fenced code are not converted and SVG data is not rendered', () => {
  assert.equal(splitInlineImages(`\x60\x60\x60md\n![Example](${png})\n\x60\x60\x60`).length, 1);
  assert.equal(splitInlineImages('![unsafe](data:image/svg+xml;base64,aGVsbG8=)').length, 1);
});
test('inserting a sketch keeps selected text and places the image at the cursor', () => {
  const result = insertInlineImage('Before After', 7, png);
  assert.equal(result.content, `Before \n\n![Ink Sketch](${png})\n\nAfter`);
  assert.equal(result.content.slice(result.caret), 'After');
});
test('cropping preserves ink, clamps padding and rejects blank boards', () => {
  const pixels = new Uint8ClampedArray(10 * 10 * 4).fill(255);
  assert.equal(findInkBounds(pixels, 10, 10, [255,255,255], 2), null);
  for (const [x,y] of [[3,4],[6,7]]) { const i = (y*10+x)*4; pixels[i]=pixels[i+1]=pixels[i+2]=0; }
  assert.deepEqual(findInkBounds(pixels,10,10,[255,255,255],2),{x:1,y:2,width:8,height:8});
});
