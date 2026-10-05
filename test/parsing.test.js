import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontMatter, parseHistory, addedInFromHistory, parseRefs, headingAnchor, toPlainText, splitSections } from '../src/markdown.js';
import { extractCatalog, indexCatalog, resolveTarget, urlBase } from '../src/extract.js';
import { loadMapping, validateMapping } from '../src/mapping.js';
import { renderMarkdown } from '../src/render.js';
import { coverageReport } from '../src/coverage.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.join(here, 'fixtures', 'docs');
const mappingFile = path.join(here, 'fixtures', 'mapping.yaml');

test('front matter, history and refs', () => {
  const md = `\uFEFF---\nid: x\ntitle: "MY CMD"\nslug: /commands/x\n---\n<details><summary>History</summary>\n\n|Release|Changes|\n|---|---|\n|18 R2|Modified|\n|17|Created|\n</details>\n<!--REF #_command_.MY CMD.Summary-->The **MY CMD** does *x*.<!-- END REF-->`;
  const { data, body } = parseFrontMatter(md);
  assert.equal(data.title, 'MY CMD');
  assert.equal(data.slug, '/commands/x');
  const h = parseHistory(body);
  assert.deepEqual(h, [{ release: '18 R2', changes: 'Modified' }, { release: '17', changes: 'Created' }]);
  assert.equal(addedInFromHistory(h), '17');
  assert.equal(addedInFromHistory([{ release: '19 R6', changes: 'Class added' }]), '19 R6');
  assert.equal(addedInFromHistory([{ release: '20', changes: 'Modified' }]), null);
  assert.equal(toPlainText(parseRefs(body).get('_command_.MY CMD').Summary), 'The MY CMD does x.');
});

test('heading anchors and sections', () => {
  assert.equal(headingAnchor('.setText()'), 'settext');
  assert.equal(headingAnchor('4D.File.new()'), '4dfilenew');
  assert.equal(headingAnchor('.*attributeName*'), 'attributename');
  assert.equal(headingAnchor('Custom {#my-id}'), 'my-id');
  const secs = splitSections('intro\n## A\n```\n## not a heading\n```\n## B\n');
  assert.deepEqual(secs.map((s) => s.heading), [null, 'A', 'B']);
});

test('extractCatalog parses commands and class members from fixtures', () => {
  const c = extractCatalog({ docsRoot, version: 'latest', lang: 'en' });
  const ttd = c.commands.find((x) => x.name === 'TEXT TO DOCUMENT');
  assert.equal(ttd.theme, 'System Documents');
  assert.equal(ttd.url, 'https://developer.4d.com/docs/commands/text-to-document');
  assert.equal(ttd.addedIn, '14');
  assert.equal(ttd.deprecated, false);
  assert.match(ttd.summary, /write the text directly/);
  assert.deepEqual(ttd.apiLinks, [{ page: 'FileClass', anchor: 'settext' }]);
  assert.equal(c.commands.find((x) => x.name === 'OLD COMMAND').deprecated, true);

  const byId = Object.fromEntries(c.members.map((m) => [m.id, m]));
  assert.equal(byId['File.setText()'].addedIn, '17 R5');
  assert.equal(byId['File.setText()'].url, 'https://developer.4d.com/docs/API/FileClass#settext');
  assert.deepEqual(byId['File.setText()'].commandLinks, ['text-to-document']);
  assert.equal(byId['File.getText()'].addedIn, '17 R5'); // inherited from Document.md
  assert.equal(byId['File.getText()'].summary, 'returns the contents of the file as text');
  assert.equal(byId['4D.File.new()'].kind, 'constructor');
  assert.equal(byId['FileHandle.writeText()'].addedIn, '19 R7'); // class-level History
});

test('resolveTarget and URL bases', () => {
  const idx = indexCatalog(extractCatalog({ docsRoot }));
  assert.equal(resolveTarget('file.settext()', idx).label, 'File.setText()');
  assert.equal(resolveTarget('command:File', idx).url, 'https://developer.4d.com/docs/commands/file');
  assert.equal(resolveTarget('File.nope()', idx), null);
  assert.equal(urlBase('21-R4', 'ja'), 'https://developer.4d.com/docs/ja/21-R4/');
  assert.equal(urlBase('latest', 'en'), 'https://developer.4d.com/docs/');
});

test('mapping validation', () => {
  assert.deepEqual(validateMapping({ mappings: [{ command: 'A', targets: ['X.y()'], classification: 'Drop-in' }] }), []);
  const errs = validateMapping({ mappings: [{ command: 'A', targets: [], classification: 'Maybe' }, { command: 'a', targets: ['x'], classification: 'Partial' }] });
  assert.equal(errs.length, 3);
});

test('render applies floor, deprecation and escaping', () => {
  const mapping = loadMapping(mappingFile);
  let { markdown, rows } = renderMarkdown(mapping, { docsRoot });
  assert.equal(rows.length, 1); // OLD COMMAND is deprecated
  assert.match(markdown, /\[TEXT TO DOCUMENT\]\(https:\/\/developer\.4d\.com\/docs\/commands\/text-to-document\)/);
  assert.match(markdown, /Writes text \\\| in one call\./);
  ({ rows } = renderMarkdown(mapping, { docsRoot, includeDeprecated: true }));
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.command === 'OLD COMMAND').targets.length, 2);
  ({ rows } = renderMarkdown(mapping, { docsRoot, includeDeprecated: true, floor: '19 R6' }));
  assert.deepEqual(rows.map((r) => r.command), ['TEXT TO DOCUMENT']); // FileHandle/open are 19 R7
  ({ markdown } = renderMarkdown(mapping, { docsRoot, lang: 'ja' }));
  assert.match(markdown, /一度に書き込みます。/);
});

test('coverage reports unreferenced members and bad targets', () => {
  const mapping = loadMapping(mappingFile);
  const r = coverageReport(mapping, { docsRoot, all: true });
  assert.deepEqual(r.errors, []);
  assert.ok(r.unreferencedMembers.some((m) => m.id === 'File.getText()'));
  const bad = { ...mapping, mappings: [{ command: 'TEXT TO DOCUMENT', targets: ['File.bogus()'], classification: 'Drop-in' }] };
  assert.equal(coverageReport(bad, { docsRoot }).errors.length, 1);
});
