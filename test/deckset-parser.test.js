/**
 * Tests for deckset-parser.js
 *
 * Run: node deckset-parser.test.js
 *
 * No dependencies — uses built-in assert.
 */

const assert = require('assert');
const { test, summary } = require('./helpers/harness');
const {
  parseDecksetMarkdown,
  findMedia,
  isMediaOnly,
  isVideo,
  isAudio,
  parseYouTube,
  extractPercent,
  markdownToHtml,
  processContentLines,
  extractDirectives,
  extractNotes,
  DIRECTIVE_REGISTRY,
  FRONTMATTER_NAMES,
  isFrontmatterLine,
  sectionAttrsFromDirectives,
} = require('../deckset-parser.js');

// ============================================================
// Unit tests: findMedia
// ============================================================
console.log('\n── findMedia ──');

test('parses simple image', () => {
  const r = findMedia('![](photo.jpg)');
  assert.equal(r.length, 1);
  assert.equal(r[0].src, 'photo.jpg');
  assert.deepEqual(r[0].modifiers, []);
});

test('parses image with modifiers', () => {
  const r = findMedia('![right fit filtered](bg.png)');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].modifiers, ['right', 'fit', 'filtered']);
  assert.equal(r[0].src, 'bg.png');
});

test('parses multiple images on one line', () => {
  const r = findMedia('![inline](a.png) ![inline](b.png)');
  assert.equal(r.length, 2);
  assert.equal(r[0].src, 'a.png');
  assert.equal(r[1].src, 'b.png');
});

test('parses percentage modifier', () => {
  const r = findMedia('![inline 50%](small.png)');
  assert.equal(r.length, 1);
  assert.ok(r[0].modifiers.includes('50%'));
});

test('handles paths with directories', () => {
  const r = findMedia('![](assets/sub/photo.webp)');
  assert.equal(r[0].src, 'assets/sub/photo.webp');
});

// ============================================================
// Unit tests: isMediaOnly
// ============================================================
console.log('\n── isMediaOnly ──');

test('true for single image line', () => {
  assert.ok(isMediaOnly('![](photo.jpg)'));
});

test('true for two images', () => {
  assert.ok(isMediaOnly('![inline](a.png) ![inline](b.png)'));
});

test('false for text with image', () => {
  assert.ok(!isMediaOnly('Some text ![](photo.jpg)'));
});

test('false for plain text', () => {
  assert.ok(!isMediaOnly('Hello world'));
});

// ============================================================
// Unit tests: isVideo / isAudio / parseYouTube
// ============================================================
console.log('\n── Media type detection ──');

test('detects mp4 as video', () => assert.ok(isVideo('clip.mp4')));
test('detects webm as video', () => assert.ok(isVideo('clip.webm')));
test('rejects png as video', () => assert.ok(!isVideo('photo.png')));
test('detects mp3 as audio', () => assert.ok(isAudio('song.mp3')));
test('rejects jpg as audio', () => assert.ok(!isAudio('photo.jpg')));

test('parses youtube.com URL', () => {
  assert.equal(parseYouTube('https://www.youtube.com/watch?v=jNQXAC9IVRw'), 'jNQXAC9IVRw');
});

test('parses youtu.be URL', () => {
  assert.equal(parseYouTube('https://youtu.be/jNQXAC9IVRw'), 'jNQXAC9IVRw');
});

test('parses youtube embed URL', () => {
  assert.equal(parseYouTube('https://www.youtube.com/embed/jNQXAC9IVRw'), 'jNQXAC9IVRw');
});

test('returns null for non-youtube URL', () => {
  assert.equal(parseYouTube('https://example.com/video'), null);
});

// ============================================================
// Unit tests: extractPercent
// ============================================================
console.log('\n── extractPercent ──');

test('extracts 50% from modifiers', () => {
  assert.equal(extractPercent(['inline', '50%']), 50);
});

test('returns null when no percentage', () => {
  assert.equal(extractPercent(['inline', 'fit']), null);
});

// ============================================================
// Unit tests: markdownToHtml
// ============================================================
console.log('\n── markdownToHtml ──');

test('bold with **', () => {
  assert.equal(markdownToHtml('**hello**'), '<strong>hello</strong>');
});

test('bold with __', () => {
  assert.equal(markdownToHtml('__hello__'), '<strong>hello</strong>');
});

test('italic with *', () => {
  assert.equal(markdownToHtml('*hello*'), '<em>hello</em>');
});

test('strikethrough', () => {
  assert.equal(markdownToHtml('~~deleted~~'), '<del>deleted</del>');
});

test('inline code', () => {
  assert.equal(markdownToHtml('use `npm install`'), 'use <code>npm install</code>');
});

test('link', () => {
  assert.equal(markdownToHtml('[Alura](https://alura.com.br)'),
    '<a href="https://alura.com.br">Alura</a>');
});

test('bare URL', () => {
  const result = markdownToHtml('Visit https://alura.com.br today');
  assert.ok(result.includes('href="https://alura.com.br"'));
});

test('does not convert image syntax to link', () => {
  const result = markdownToHtml('![alt](image.png)');
  assert.ok(result.includes('![alt](image.png)'));
});

// ============================================================
// Underscore/asterisk edge cases — must not break HTML
// ============================================================
console.log('\n── Underscore/asterisk edge cases ──');

test('underscore in URL does not become italic', () => {
  const result = markdownToHtml('[link](https://example.com/some_path)');
  assert.ok(!result.includes('<em>'), 'URL underscore must not become italic');
  assert.ok(result.includes('some_path'), 'underscore preserved in URL');
});

test('underscore in link text does not break HTML', () => {
  const result = markdownToHtml('[@user_name](https://instagram.com/user_name)');
  assert.ok(!result.includes('<em>'), 'link text underscore must not become italic');
  assert.ok(result.includes('@user_name'), 'handle preserved');
});

test('underscore in bare URL does not become italic', () => {
  const result = markdownToHtml('Visit https://example.com/my_page_here');
  assert.ok(!result.includes('<em>'), 'bare URL underscore must not become italic');
});

test('underscore in reference link does not become italic', () => {
  // Simulate a reference link
  const html = parseDecksetMarkdown('[my_ref]: https://example.com/some_path\n\nSee [my_ref][my_ref]');
  assert.ok(!html.includes('<em>'), 'reference link must not have italic from underscore');
});

test('multiple underscores in one line with links', () => {
  const result = markdownToHtml('[@first_user](https://x.com/first_user) and [@second_user](https://x.com/second_user)');
  assert.ok(!result.includes('<em>'), 'multiple links with underscores must not create italic');
  assert.ok(result.includes('first_user'), 'first handle preserved');
  assert.ok(result.includes('second_user'), 'second handle preserved');
});

test('asterisk in URL does not become bold/italic', () => {
  const result = markdownToHtml('[glob](https://docs.com/path/*.js)');
  assert.ok(!result.includes('<strong>'), 'URL asterisk must not become bold');
  assert.ok(!result.includes('<em>'), 'URL asterisk must not become italic');
});

test('snake_case variable is not italic', () => {
  const result = markdownToHtml('Use `my_variable` in code');
  assert.ok(!result.includes('<em>'), 'code underscore must not become italic');
});

test('underscore between words without spaces is italic', () => {
  const result = markdownToHtml('This is _italic text_ here');
  assert.ok(result.includes('<em>italic text</em>'), 'normal italic still works');
});

test('bold inside heading with underscore link', () => {
  const html = parseDecksetMarkdown('# **Bold** and [@user_name](https://instagram.com/user_name)');
  assert.ok(html.includes('<strong>Bold</strong>'), 'bold works');
  assert.ok(!html.includes('</em>name'), 'underscore in link does not break');
});

// ============================================================
// Unit tests: extractNotes
// ============================================================
console.log('\n── extractNotes ──');

test('extracts ^ lines as notes', () => {
  const { notes, content } = extractNotes(['Hello', '^ This is a note', 'World']);
  assert.deepEqual(notes, ['This is a note']);
  assert.deepEqual(content, ['Hello', 'World']);
});

test('handles multiple notes', () => {
  const { notes } = extractNotes(['^ Note 1', '^ Note 2']);
  assert.equal(notes.length, 2);
});

test('no notes when no ^ lines', () => {
  const { notes, content } = extractNotes(['Hello', 'World']);
  assert.equal(notes.length, 0);
  assert.equal(content.length, 2);
});

// ============================================================
// Unit tests: extractDirectives
// ============================================================
console.log('\n── extractDirectives ──');

test('extracts background-color directive', () => {
  const { directives, contentLines } = extractDirectives([
    '[.background-color: #ff0000]', 'Hello'
  ]);
  assert.equal(directives['background-color'], '#ff0000');
  assert.deepEqual(contentLines, ['Hello']);
});

test('extracts build-lists directive', () => {
  const { directives } = extractDirectives(['[.build-lists: true]']);
  assert.equal(directives['build-lists'], 'true');
});

test('passes through non-directive lines', () => {
  const { contentLines } = extractDirectives(['# Title', 'Some text']);
  assert.equal(contentLines.length, 2);
});

// ============================================================
// Unit tests: processContentLines
// ============================================================
console.log('\n── processContentLines ──');

test('heading', () => {
  const html = processContentLines(['# Hello']);
  assert.ok(html.includes('<h1>Hello</h1>'));
});

test('#[fit] heading', () => {
  const html = processContentLines(['#[fit] Big Text']);
  assert.ok(html.includes('class="deckset-fit"'));
  assert.ok(html.includes('Big Text'));
});

test('unordered list', () => {
  const html = processContentLines(['- Item 1', '- Item 2']);
  assert.ok(html.includes('<ul>'));
  assert.ok(html.includes('<li>Item 1</li>'));
  assert.ok(html.includes('<li>Item 2</li>'));
});

test('ordered list', () => {
  const html = processContentLines(['1. First', '2. Second']);
  assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('<li>First</li>'));
});

test('blockquote', () => {
  const html = processContentLines(['> To be or not to be']);
  assert.ok(html.includes('<blockquote>'));
  assert.ok(html.includes('To be or not to be'));
});

test('code block', () => {
  const html = processContentLines(['```js', 'const x = 1;', '```']);
  assert.ok(html.includes('<pre><code'));
  assert.ok(html.includes('const x = 1;'));
});

test('plain text becomes paragraph', () => {
  const html = processContentLines(['Just some text']);
  assert.ok(html.includes('<p>Just some text</p>'));
});

// ============================================================
// Integration tests: parseDecksetMarkdown (slide-level)
// ============================================================
console.log('\n── parseDecksetMarkdown (integration) ──');

test('splits slides on ---', () => {
  const html = parseDecksetMarkdown('# Slide 1\n\n---\n\n# Slide 2');
  const sections = html.match(/<section/g);
  assert.equal(sections.length, 2);
});

test('strips frontmatter', () => {
  const html = parseDecksetMarkdown('footer: Paulo Silveira\nslidenumbers: true\n\n# Title');
  assert.ok(!html.includes('footer'));
  assert.ok(html.includes('Title'));
});

test('![](img) alone → background image', () => {
  const html = parseDecksetMarkdown('![](photo.jpg)');
  assert.ok(html.includes('data-background-image="photo.jpg"'));
});

test('![fit](img) → background contain', () => {
  const html = parseDecksetMarkdown('![fit](photo.jpg)');
  assert.ok(html.includes('data-background-size="contain"'));
});

test('![filtered](img) → dark overlay (black bg + opacity)', () => {
  const html = parseDecksetMarkdown('![filtered](photo.jpg)');
  assert.ok(html.includes('data-background-opacity="0.5"'));
  assert.ok(html.includes('data-background-color="#000"'));
});

test('![right](img) with text → split layout', () => {
  const html = parseDecksetMarkdown('![right](photo.jpg)\n\n# Title\n\nSome text');
  assert.ok(html.includes('deckset-split'));
  assert.ok(html.includes('photo.jpg'));
  assert.ok(html.includes('Title'));
});

test('![left](img) alone → split background', () => {
  const html = parseDecksetMarkdown('![left](photo.jpg)');
  assert.ok(html.includes('deckset-split-bg'));
  assert.ok(html.includes('img-half'));
});

test('![left](img) after #[fit] headings → split layout', () => {
  const md = '#[fit] primeira\n#[fit] batalha\n#[fit] contra IA\n\n![left](photo.jpg)';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('deckset-split'), 'should be a split layout');
  assert.ok(html.includes('photo.jpg'), 'should contain the image');
  assert.ok(html.includes('deckset-fit'), 'should contain fit headings');
});

test('![inline](a) ![inline](b) → flex row', () => {
  const html = parseDecksetMarkdown('![inline](a.png) ![inline](b.png)');
  assert.ok(html.includes('deckset-inline-row'));
});

test('![inline](img) single → inline single', () => {
  const html = parseDecksetMarkdown('![inline](photo.jpg)');
  assert.ok(html.includes('deckset-inline-single'));
});

test('speaker notes with ^', () => {
  const html = parseDecksetMarkdown('# Title\n^ Remember to mention X');
  assert.ok(html.includes('<aside class="notes">'));
  assert.ok(html.includes('Remember to mention X'));
});

test('[.background-color] directive', () => {
  const html = parseDecksetMarkdown('[.background-color: #000]\n\n# Dark slide');
  assert.ok(html.includes('data-background-color="#000"'));
});

test('[.build-lists: true] adds fragments', () => {
  const html = parseDecksetMarkdown('[.build-lists: true]\n\n- Item 1\n- Item 2');
  assert.ok(html.includes('class="fragment"'));
});

test('video with autoplay → video element', () => {
  const html = parseDecksetMarkdown('![autoplay loop](demo.mp4)');
  assert.ok(html.includes('data-background-video') || html.includes('<video'));
});

test('YouTube URL → iframe', () => {
  const html = parseDecksetMarkdown('![](https://www.youtube.com/watch?v=jNQXAC9IVRw)');
  assert.ok(html.includes('youtube.com/embed'));
});

test('#[fit] heading is rendered', () => {
  const html = parseDecksetMarkdown('#[fit] Hello World');
  assert.ok(html.includes('deckset-fit'));
  assert.ok(html.includes('Hello World'));
});

test('# [fit] with space between # and [fit]', () => {
  const html = parseDecksetMarkdown('# [fit] carreiras líquidas');
  assert.ok(html.includes('deckset-fit'));
  assert.ok(html.includes('carreiras líquidas'));
  assert.ok(!html.includes('[fit]'));
});

test('#[fit]Text without space after [fit]', () => {
  const html = parseDecksetMarkdown('#[fit]Prelúdio');
  assert.ok(html.includes('deckset-fit'));
  assert.ok(html.includes('Prelúdio'));
});

test('multiple #[fit] headings in same slide', () => {
  const html = parseDecksetMarkdown('#[fit]1. Youtube e\n#[fit]Hollywood');
  const fits = html.match(/deckset-fit/g);
  assert.equal(fits.length, 2);
});

test('**bold** spanning multiple #[fit] lines', () => {
  const html = parseDecksetMarkdown('#[fit] a **camada humana\n#[fit] de confiança.**');
  assert.ok(html.includes('<strong>'), 'should render <strong> across lines');
  assert.ok(!html.includes('**'), 'should not have literal ** in output');
});

test('#_**Paulo Silveira**_ heading with no space', () => {
  const html = parseDecksetMarkdown('#_**Paulo Silveira**_');
  assert.ok(html.includes('Paulo Silveira'));
  assert.ok(html.includes('<h1>'));
});

test('mixed text and inline image', () => {
  const html = parseDecksetMarkdown('# Title\n\n![inline](photo.jpg)\n\nSome text below');
  assert.ok(html.includes('<h1>Title</h1>'));
  assert.ok(html.includes('photo.jpg'));
  assert.ok(html.includes('Some text below'));
});

test('empty slides are filtered out', () => {
  const html = parseDecksetMarkdown('# Slide 1\n\n---\n\n\n\n---\n\n# Slide 3');
  const sections = html.match(/<section/g);
  assert.equal(sections.length, 2);
});

test('code blocks inside slides', () => {
  const html = parseDecksetMarkdown('# Code\n\n```python\nprint("hello")\n```');
  assert.ok(html.includes('<pre><code'));
  assert.ok(html.includes('print'));
});

// ============================================================
// Unit tests: GFM tables
// ============================================================
console.log('\n── GFM tables ──');

test('basic table without alignment', () => {
  const html = processContentLines([
    '| Feature | Status |',
    '|---------|--------|',
    '| Tables  | New    |',
  ]);
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('<thead>'));
  assert.ok(html.includes('<th>Feature</th>'));
  assert.ok(html.includes('<th>Status</th>'));
  assert.ok(html.includes('<tbody>'));
  assert.ok(html.includes('<td>Tables</td>'));
  assert.ok(html.includes('<td>New</td>'));
});

test('table with alignment', () => {
  const html = processContentLines([
    '| Left | Center | Right |',
    '|:-----|:------:|------:|',
    '| a    | b      | c     |',
  ]);
  assert.ok(html.includes('<th style="text-align: left">Left</th>'));
  assert.ok(html.includes('<th style="text-align: center">Center</th>'));
  assert.ok(html.includes('<th style="text-align: right">Right</th>'));
  assert.ok(html.includes('<td style="text-align: left">a</td>'));
  assert.ok(html.includes('<td style="text-align: center">b</td>'));
  assert.ok(html.includes('<td style="text-align: right">c</td>'));
});

test('table with multiple data rows', () => {
  const html = processContentLines([
    '| Name | Score |',
    '|------|-------|',
    '| Alice | 90   |',
    '| Bob   | 85   |',
    '| Carol | 95   |',
  ]);
  const rows = html.match(/<tr>/g);
  // 1 header row + 3 data rows
  assert.equal(rows.length, 4);
});

test('table with inline markdown in cells', () => {
  const html = processContentLines([
    '| Feature | Status |',
    '|---------|--------|',
    '| **Bold** | `code` |',
  ]);
  assert.ok(html.includes('<strong>Bold</strong>'));
  assert.ok(html.includes('<code>code</code>'));
});

// ============================================================
// Unit tests: [.header:] and [.text:] color directives
// ============================================================
console.log('\n── Header/text color directives ──');

test('[.header: #hex] sets heading color', () => {
  const html = parseDecksetMarkdown('[.header: #ff0000]\n\n# Red Title');
  assert.ok(html.includes('--r-heading-color: #ff0000'));
  assert.ok(html.includes('Red Title'));
});

test('[.text: #hex] sets text color', () => {
  const html = parseDecksetMarkdown('[.text: #00ff00]\n\nGreen text');
  assert.ok(html.includes('--r-main-color: #00ff00'));
});

test('[.header-strong: #hex] aliases to heading color', () => {
  const html = parseDecksetMarkdown('[.header-strong: #0000ff]\n\n# Blue');
  assert.ok(html.includes('--r-heading-color: #0000ff'));
});

test('header and text combined on same slide', () => {
  const html = parseDecksetMarkdown('[.header: #fff]\n[.text: #ccc]\n\n# Title\nBody');
  assert.ok(html.includes('--r-heading-color: #fff'));
  assert.ok(html.includes('--r-main-color: #ccc'));
});

// ============================================================
// Unit tests: :::columns block directive
// ============================================================
console.log('\n── :::columns ──');

test('two-column layout', () => {
  const html = processContentLines([
    ':::columns',
    '## Left',
    'Content A',
    ':::',
    '## Right',
    'Content B',
    ':::',
  ]);
  assert.ok(html.includes('deckset-columns'));
  assert.ok(html.includes('repeat(2, 1fr)'));
  const cols = html.match(/deckset-column"/g);
  assert.equal(cols.length, 2);  // exact class match in opening tags
  assert.ok(html.includes('Left'));
  assert.ok(html.includes('Right'));
});

test('three-column layout', () => {
  const html = processContentLines([
    ':::columns',
    'A',
    ':::',
    'B',
    ':::',
    'C',
    ':::',
  ]);
  assert.ok(html.includes('repeat(3, 1fr)'));
});

test('columns with empty column are skipped', () => {
  const html = processContentLines([
    ':::columns',
    ':::',
    'Only column',
    ':::',
  ]);
  assert.ok(html.includes('repeat(1, 1fr)'));
});

// ============================================================
// Unit tests: :::steps block directive
// ============================================================
console.log('\n── :::steps ──');

test('steps wraps paragraphs in fragments', () => {
  const html = processContentLines([
    ':::steps',
    'First paragraph.',
    '',
    'Second paragraph.',
    '',
    'Third paragraph.',
    ':::',
  ]);
  const fragments = html.match(/class="fragment"/g);
  assert.equal(fragments.length, 3);
  assert.ok(html.includes('First paragraph.'));
  assert.ok(html.includes('Second paragraph.'));
  assert.ok(html.includes('Third paragraph.'));
});

test('steps with single paragraph', () => {
  const html = processContentLines([
    ':::steps',
    'Only one.',
    ':::',
  ]);
  assert.ok(html.includes('class="fragment"'));
  assert.ok(html.includes('Only one.'));
});

test('steps with headings wraps in fragment div', () => {
  const html = processContentLines([
    ':::steps',
    '## Step One',
    '',
    '## Step Two',
    ':::',
  ]);
  const fragments = html.match(/class="fragment"/g);
  assert.equal(fragments.length, 2);
});

// ============================================================
// Unit tests: :::center block directive
// ============================================================
console.log('\n── :::center ──');

test('center wraps content in centered div', () => {
  const html = processContentLines([
    ':::center',
    '# Thank You',
    'Paulo Silveira',
    ':::',
  ]);
  assert.ok(html.includes('text-align:center'));
  assert.ok(html.includes('display:flex'));
  assert.ok(html.includes('justify-content:center'));
  assert.ok(html.includes('Thank You'));
  assert.ok(html.includes('Paulo Silveira'));
});

test('center with empty content', () => {
  const html = processContentLines([
    ':::center',
    ':::',
  ]);
  assert.ok(html.includes('text-align:center'));
});

// ============================================================
// Unit tests: HTML comments as speaker notes
// ============================================================
console.log('\n── HTML comments as notes ──');

test('single-line HTML comment becomes note', () => {
  const { notes, content } = extractNotes([
    '# Title',
    '<!-- This is a note -->',
    'Some text',
  ]);
  assert.deepEqual(notes, ['This is a note']);
  assert.equal(content.length, 2);
  assert.ok(content.includes('# Title'));
  assert.ok(content.includes('Some text'));
});

test('multi-line HTML comment becomes note', () => {
  const { notes, content } = extractNotes([
    '# Title',
    '<!--',
    'Note line 1',
    'Note line 2',
    '-->',
    'Some text',
  ]);
  assert.deepEqual(notes, ['Note line 1', 'Note line 2']);
  assert.equal(content.length, 2);
});

test('directive-like comments are NOT notes', () => {
  const { notes, content } = extractNotes([
    '<!-- _class: lead -->',
    '# Title',
  ]);
  assert.equal(notes.length, 0);
  assert.equal(content.length, 2);
});

test('^ notes and HTML comments coexist', () => {
  const { notes } = extractNotes([
    '^ Caret note',
    '<!-- Comment note -->',
  ]);
  assert.equal(notes.length, 2);
  assert.equal(notes[0], 'Caret note');
  assert.equal(notes[1], 'Comment note');
});

test('HTML comment notes render in slide', () => {
  const html = parseDecksetMarkdown('# Title\n<!-- Remember to breathe -->');
  assert.ok(html.includes('<aside class="notes">'));
  assert.ok(html.includes('Remember to breathe'));
});

// ============================================================
// Unit tests: code block line highlights
// ============================================================
console.log('\n── Code block line highlights ──');

test('code block with line highlight range', () => {
  const html = processContentLines([
    '```python {2,4}',
    'def foo():',
    '    highlighted',
    '    normal',
    '    also_highlighted',
    '```',
  ]);
  assert.ok(html.includes('data-line-numbers="2,4"'));
  assert.ok(html.includes('language-python'));
});

test('code block with range syntax', () => {
  const html = processContentLines([
    '```js {1-3}',
    'const a = 1;',
    'const b = 2;',
    'const c = 3;',
    '```',
  ]);
  assert.ok(html.includes('data-line-numbers="1-3"'));
  assert.ok(html.includes('language-js'));
});

test('code block without highlights has no data-line-numbers', () => {
  const html = processContentLines([
    '```python',
    'print("hello")',
    '```',
  ]);
  assert.ok(!html.includes('data-line-numbers'));
  assert.ok(html.includes('language-python'));
});

// ============================================================
// Unit tests: ![qr](url) — QR code generation
// ============================================================
console.log('\n── QR codes ──');

test('![qr](url) renders QR placeholder div', () => {
  const html = processContentLines(['![qr](https://example.com)']);
  assert.ok(html.includes('deckset-qr'));
  assert.ok(html.includes('data-qr-url="https://example.com"'));
});

test('![qr](url) alone on slide → centered QR (not background)', () => {
  const html = parseDecksetMarkdown('![qr](https://example.com)');
  assert.ok(html.includes('deckset-qr-bg'));
  assert.ok(html.includes('data-qr-url="https://example.com"'));
  assert.ok(!html.includes('data-background-image'));
});

test('![qr, right](url) with text → split layout with QR', () => {
  const html = parseDecksetMarkdown('![qr, right](https://example.com)\n\n# Title\n\nScan me');
  assert.ok(html.includes('deckset-split'));
  assert.ok(html.includes('deckset-qr'));
  assert.ok(html.includes('data-qr-url="https://example.com"'));
  assert.ok(html.includes('Title'));
});

test('![qr](url) inline renders QR div', () => {
  const html = processContentLines(['Some text', '![qr](https://example.com)']);
  assert.ok(html.includes('deckset-qr'));
  assert.ok(html.includes('data-qr-url="https://example.com"'));
});

// ============================================================
// Unit tests: :::math — KaTeX block
// ============================================================
console.log('\n── :::math ──');

test(':::math block renders math placeholder', () => {
  const html = processContentLines([
    ':::math',
    'E = mc^2',
    ':::',
  ]);
  assert.ok(html.includes('deckset-math'));
  assert.ok(html.includes('data-math-src="E = mc^2"'));
});

test(':::math block escapes HTML in LaTeX', () => {
  const html = processContentLines([
    ':::math',
    'a < b > c & d',
    ':::',
  ]);
  assert.ok(html.includes('&lt;'));
  assert.ok(html.includes('&gt;'));
  assert.ok(html.includes('&amp;'));
});

test(':::math multiline preserves content', () => {
  const html = processContentLines([
    ':::math',
    '\\frac{a}{b}',
    '+ \\frac{c}{d}',
    ':::',
  ]);
  assert.ok(html.includes('deckset-math'));
  assert.ok(html.includes('\\frac{a}{b}'));
  assert.ok(html.includes('\\frac{c}{d}'));
});

// ============================================================
// Unit tests: inline math ($...$, $$...$$)
// ============================================================
console.log('\n── Inline math ──');

test('$...$ renders inline math span', () => {
  const html = markdownToHtml('The formula $E = mc^2$ is famous');
  assert.ok(html.includes('deckset-math-inline'));
  assert.ok(html.includes('data-math-src="E = mc^2"'));
});

test('$$...$$ renders block math div', () => {
  const html = markdownToHtml('$$\\int_0^1 x^2 dx$$');
  assert.ok(html.includes('deckset-math'));
  assert.ok(html.includes('data-math-src="\\int_0^1 x^2 dx"'));
});

test('multiple inline math in one line', () => {
  const html = markdownToHtml('$a$ and $b$');
  const matches = html.match(/deckset-math-inline/g);
  assert.equal(matches.length, 2);
});

test('dollar sign in code is not math', () => {
  // inline code is processed first, so $ inside backticks is safe
  const html = markdownToHtml('Use `$var` in bash');
  assert.ok(!html.includes('deckset-math'));
  assert.ok(html.includes('<code>$var</code>'));
});

// ============================================================
// Unit tests: :::diagram — Mermaid block
// ============================================================
console.log('\n── :::diagram ──');

test(':::diagram block renders mermaid pre', () => {
  const html = processContentLines([
    ':::diagram',
    'graph LR',
    '  A --> B',
    ':::',
  ]);
  assert.ok(html.includes('deckset-diagram'));
  assert.ok(html.includes('class="mermaid"'));
  assert.ok(html.includes('graph LR'));
  assert.ok(html.includes('A --&gt; B'));
});

test(':::diagram escapes HTML in diagram code', () => {
  const html = processContentLines([
    ':::diagram',
    'graph TD',
    '  A[Label <b>] --> B',
    ':::',
  ]);
  assert.ok(html.includes('&lt;b&gt;'));
});

test(':::diagram preserves multiline content', () => {
  const html = processContentLines([
    ':::diagram',
    'flowchart TD',
    '  A --> B',
    '  B --> C',
    '  C --> D',
    ':::',
  ]);
  assert.ok(html.includes('flowchart TD'));
  assert.ok(html.includes('C --&gt; D'));
});

// ============================================================
// Integration: feature-showcase.md parses correctly
// ============================================================
// ============================================================
// YAML frontmatter (Marp-style --- delimited)
// ============================================================
console.log('\n── YAML frontmatter ──');

test('YAML frontmatter (--- delimited) is stripped', () => {
  const md = '---\nmarp: true\ntheme: gaia\n---\n\n# Hello';
  const html = parseDecksetMarkdown(md);
  assert.ok(!html.includes('marp'), 'Frontmatter should be stripped');
  assert.ok(html.includes('<h1>Hello</h1>'), 'Content should render');
});

test('Deckset frontmatter (no delimiters) still works', () => {
  const md = 'footer: Test\nslidenumbers: true\n\n# Hello';
  const html = parseDecksetMarkdown(md);
  assert.ok(!html.includes('footer: Test'), 'Frontmatter should be stripped');
  assert.ok(html.includes('<h1>Hello</h1>'));
});

// ============================================================
// Setext headings (=== for h1)
// ============================================================
console.log('\n── Setext headings ──');

test('text followed by === becomes h1', () => {
  const html = processContentLines(['My Title', '===']);
  assert.ok(html.includes('<h1>My Title</h1>'));
});

test('text followed by ====== becomes h1', () => {
  const html = processContentLines(['Big Heading', '======']);
  assert.ok(html.includes('<h1>Big Heading</h1>'));
});

// ============================================================
// Reference links ([text][ref] with [ref]: url)
// ============================================================
console.log('\n── Reference links ──');

test('reference links resolve across slides', () => {
  const md = '[marp]: https://marp.app\n\n# See [Marp][marp]\n\n---\n\nAlso [Marp][marp]';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('href="https://marp.app"'), 'Reference link should resolve');
  // Should resolve in both slides
  const matches = html.match(/href="https:\/\/marp\.app"/g);
  assert.ok(matches && matches.length >= 2, 'Should resolve in multiple slides');
});

test('unresolved reference links show text only', () => {
  const md = '# See [unknown-ref][missing]';
  const html = parseDecksetMarkdown(md);
  assert.ok(!html.includes('[missing]'), 'Should not show bracket syntax');
  assert.ok(html.includes('unknown-ref'), 'Should show link text');
});

// ============================================================
// Marp image modifiers
// ============================================================
console.log('\n── Marp image modifiers ──');

test('![bg](url) is treated as background (bg stripped)', () => {
  const html = parseDecksetMarkdown('![bg](test.jpg)');
  // bg modifier stripped → media-only slide → becomes background
  assert.ok(html.includes('data-background-image'), 'Should be background image');
  assert.ok(!html.includes('![bg]'), 'bg modifier should be stripped');
});

test('![bg right](url) with text → split layout', () => {
  const html = parseDecksetMarkdown('![bg right](test.jpg)\n\n# Title\n\nText');
  assert.ok(html.includes('deckset-split'), 'Should be split layout');
});

test('![bg fit](url) → background contain', () => {
  const html = parseDecksetMarkdown('![bg fit](test.jpg)');
  assert.ok(html.includes('data-background-size="contain"'), 'Should be contain');
});

test('Marp w:h: size modifiers are stripped', () => {
  const media = findMedia('![w:200 h:100](test.jpg)');
  assert.ok(media.length === 1);
  assert.ok(!media[0].modifiers.includes('w:200'), 'w: modifier should be stripped');
  assert.ok(!media[0].modifiers.includes('h:100'), 'h: modifier should be stripped');
});

// ============================================================
// Marp HTML comment directives
// ============================================================
console.log('\n── Marp HTML comment directives ──');

test('<!-- backgroundColor: #hex --> converts to [.background-color]', () => {
  const html = parseDecksetMarkdown('<!-- backgroundColor: #ff0000 -->\n\n# Red');
  assert.ok(html.includes('data-background-color="#ff0000"'), 'Should set background color');
});

test('<!-- color: #hex --> converts to [.text]', () => {
  const html = parseDecksetMarkdown('<!-- color: #00ff00 -->\n\n# Green');
  assert.ok(html.includes('--r-main-color: #00ff00'), 'Should set text color');
});

test('<!-- paginate: true --> in frontmatter enables slide numbers', () => {
  const md = '---\npaginate: true\n---\n\n# Hello';
  const html = parseDecksetMarkdown(md);
  // parseDecksetMarkdown doesn't render slide numbers itself,
  // but the global directive should be set (checked by caller)
  assert.ok(!html.includes('paginate'), 'paginate should not appear in content');
});

// ============================================================
// Marp compatibility integration
// ============================================================
console.log('\n── Marp compatibility ──');

test('marp-example.md parses without errors', () => {
  const fs = require('fs');
  const path = require('path');
  const md = fs.readFileSync(path.join(__dirname, 'marp-example.md'), 'utf8');
  const html = parseDecksetMarkdown(md);
  const sections = html.match(/<section/g);
  assert.ok(sections.length >= 15, `Expected >= 15 slides, got ${sections.length}`);
  // Should NOT contain raw frontmatter
  assert.ok(!html.includes('marp: false'), 'Frontmatter should be stripped');
  // Should resolve reference links
  assert.ok(html.includes('href="https://github.com/marp-team"'), 'Reference links should resolve');
  // Should have setext h1
  assert.ok(html.includes('<h1>Marp</h1>'), 'Setext heading should render');
});

// Sample decks live in `samples/` (presentations-paulo) or `demo/` (stellardeck).
// Try both locations so the same test runs in both repos.
function loadSample(name) {
  const fs = require('fs');
  const path = require('path');
  for (const dir of ['samples', 'demo']) {
    const p = path.join(__dirname, '..', dir, name);
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error(`Sample not found in samples/ or demo/: ${name}`);
}

test('hand-balancing.md parses all slides correctly', () => {
  const html = parseDecksetMarkdown(loadSample('hand-balancing.md'));
  const sections = html.match(/<section/g);
  assert.ok(sections.length >= 17, `Expected >= 17 slides, got ${sections.length}`);
  assert.ok(html.includes('deckset-split'), 'Should have split layouts');
  assert.ok(html.includes('deckset-diagram'), 'Should have diagram');
});

test('bean-to-bar-chocolate.md parses all slides correctly', () => {
  const html = parseDecksetMarkdown(loadSample('bean-to-bar-chocolate.md'), { autoflow: false });
  const sections = html.match(/<section/g);
  assert.ok(sections.length >= 14, `Expected >= 14 slides, got ${sections.length}`);
  assert.ok(html.includes('deckset-diagram'), 'Should have process diagram');
  assert.ok(html.includes('deckset-columns'), 'Should have columns');
});

test('vibe-coding.md parses all slides correctly', () => {
  const html = parseDecksetMarkdown(loadSample('vibe-coding.md'));
  const sections = html.match(/<section/g);
  assert.ok(sections.length >= 18, `Expected >= 18 slides, got ${sections.length}`);
  assert.ok(html.includes('deckset-split'), 'Should have split layouts');
  assert.ok(html.includes('deckset-fit'), 'Should have fit headings');
});

console.log('\n── Feature showcase integration ──');

test('feature-showcase.md parses without errors', () => {
  const fs = require('fs');
  const path = require('path');
  const md = fs.readFileSync(path.join(__dirname, 'feature-showcase.md'), 'utf8');
  const html = parseDecksetMarkdown(md);
  const sections = html.match(/<section/g);
  // Should have many slides
  assert.ok(sections.length >= 15, `Expected >= 15 slides, got ${sections.length}`);
  // Should contain QR, math, and diagram elements
  assert.ok(html.includes('deckset-qr'), 'Should have QR elements');
  assert.ok(html.includes('deckset-math'), 'Should have math elements');
  assert.ok(html.includes('deckset-diagram'), 'Should have diagram elements');
  assert.ok(html.includes('deckset-math-inline'), 'Should have inline math elements');
  assert.ok(html.includes('deckset-qr-bg'), 'Should have background QR element');
});

// ============================================================
// Smoke tests: full presentation parse
// ============================================================
console.log('\n── Smoke test: full presentation ──');

test('parses a realistic multi-slide presentation', () => {
  const md = `footer: Paulo Silveira
slidenumbers: true

![right](assets/paulo.webp)

# [fit] carreiras líquidas
# [fit] inteligência artificial

#_**Paulo Silveira**_

---

#[fit]Prelúdio

Carreira e IA

---

![left](assets/demis.webp)

---

# Demis

- ~13 anos xadrez
- ~17 anos Theme Park e jogos

^ Mencionar trajetória multidisciplinar

---

1. Youtube e Hollywood
2. Japão e Squads
3. Carreira e Tecnologia

---

![](assets/mercado.webp)

---

![inline](assets/a.png) ![inline](assets/b.png)

---

[.background-color: #1a1a2e]

> Nós não somos estudantes de alguma disciplina, mas estudantes de problemas.

Karl Popper

---

![filtered](assets/bg.jpg)

---

![autoplay loop](assets/demo.mp4)

---

![](https://www.youtube.com/watch?v=jNQXAC9IVRw)
`;

  const html = parseDecksetMarkdown(md);
  const sections = html.match(/<section/g);

  // Should have 11 slides
  assert.equal(sections.length, 11);

  // Slide 1: split layout (right image + fit headings)
  assert.ok(html.includes('deckset-split'));
  assert.ok(html.includes('deckset-fit'));

  // Slide 3: left image alone → split-bg
  assert.ok(html.includes('deckset-split-bg'));

  // Slide 4: has speaker notes
  assert.ok(html.includes('<aside class="notes">'));

  // Slide 6: background image
  assert.ok(html.includes('data-background-image="assets/mercado.webp"'));

  // Slide 7: inline row
  assert.ok(html.includes('deckset-inline-row'));

  // Slide 8: background color
  assert.ok(html.includes('data-background-color="#1a1a2e"'));

  // Slide 9: filtered (dark overlay)
  assert.ok(html.includes('data-background-opacity="0.5"'));
  assert.ok(html.includes('data-background-color="#000"'));

  // Slide 10: video
  assert.ok(html.includes('data-background-video') || html.includes('<video'));

  // Slide 11: YouTube
  assert.ok(html.includes('youtube.com/embed'));
});

// ============================================================
// Directive registry
// ============================================================
console.log('\n── Directive registry ──');

test('DIRECTIVE_REGISTRY is a non-empty array', () => {
  assert.ok(Array.isArray(DIRECTIVE_REGISTRY));
  assert.ok(DIRECTIVE_REGISTRY.length >= 15, `Expected ≥15 directives, got ${DIRECTIVE_REGISTRY.length}`);
});

test('every entry has name and scope', () => {
  for (const d of DIRECTIVE_REGISTRY) {
    assert.ok(d.name, 'entry must have a name');
    assert.ok(['global', 'slide', 'both'].includes(d.scope), `${d.name}: invalid scope "${d.scope}"`);
  }
});

test('FRONTMATTER_NAMES includes core global directives', () => {
  for (const name of ['theme', 'scheme', 'footer', 'slidenumbers', 'autoflow']) {
    assert.ok(FRONTMATTER_NAMES.has(name), `Expected "${name}" in FRONTMATTER_NAMES`);
  }
});

test('FRONTMATTER_NAMES does NOT include slide-only directives', () => {
  for (const name of ['background-color', 'heading-align', 'bullets-layout', 'text']) {
    assert.ok(!FRONTMATTER_NAMES.has(name), `"${name}" should NOT be in FRONTMATTER_NAMES (scope=slide)`);
  }
});

test('isFrontmatterLine matches known keys', () => {
  assert.ok(isFrontmatterLine('theme: nordic'));
  assert.ok(isFrontmatterLine('scheme: 1'));
  assert.ok(isFrontmatterLine('footer: hello'));
  assert.ok(isFrontmatterLine('autoflow: true'));
});

test('isFrontmatterLine rejects unknown keys and non-key lines', () => {
  assert.ok(!isFrontmatterLine('# Heading'));
  assert.ok(!isFrontmatterLine('random text'));
  assert.ok(!isFrontmatterLine('background-color: #fff'));  // slide-only
  assert.ok(!isFrontmatterLine(''));
});

test('sectionAttrsFromDirectives applies background-color', () => {
  const result = sectionAttrsFromDirectives({ 'background-color': '#1a1a2e' });
  assert.ok(result.includes('data-background-color="#1a1a2e"'));
});

test('sectionAttrsFromDirectives applies autoscale with tier', () => {
  const result = sectionAttrsFromDirectives({ 'autoscale': 'true', 'autoscale-lines': '15' });
  assert.ok(result.includes('data-autoscale="true"'));
  assert.ok(result.includes('data-autoscale-tier="moderate"'));
});

test('sectionAttrsFromDirectives applies heading-align as CSS var', () => {
  const result = sectionAttrsFromDirectives({ 'heading-align': 'center' });
  assert.ok(result.includes('--sd-heading-align: center'));
});

test('sectionAttrsFromDirectives applies bullets-layout', () => {
  const result = sectionAttrsFromDirectives({ 'bullets-layout': 'cards' });
  assert.ok(result.includes('data-bullets-layout="cards"'));
});

test('adding a new directive to registry works (round-trip)', () => {
  // Simulate: the registry already has bullets-layout, which was added in this session.
  // Verify that parseDecksetMarkdown correctly handles it end-to-end.
  const md = '[.bullets-layout: pills]\n\n# Test\n\n- Item 1\n- Item 2';
  const html = parseDecksetMarkdown(md);
  assert.ok(html.includes('data-bullets-layout="pills"'), 'Expected bullets-layout data attr in section');
});

// ============================================================
// Results
// ============================================================

summary();
