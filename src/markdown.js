// Minimal parsers for the 4D Docusaurus markdown conventions.
import { minRelease, parseRelease, formatRelease } from './release.js';

/** Parse simple `key: value` front matter. Returns { data, body }. */
export function parseFrontMatter(text) {
  const src = text.replace(/^\uFEFF/, '');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: src.slice(m[0].length) };
}

/**
 * Parse every `<details><summary>History</summary>` table in `text`.
 * Returns [{ release, changes }] (release normalized, or raw when unparseable).
 */
export function parseHistory(text) {
  const rows = [];
  const re = /<summary>\s*(?:History|履歴)\s*<\/summary>([\s\S]*?)<\/details>/gi;
  let m;
  while ((m = re.exec(text))) {
    for (const line of m[1].split(/\r?\n/)) {
      const cells = line.trim().match(/^\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*(?:\||$)/);
      if (!cells) continue;
      const [, rel, changes] = cells;
      if (!rel || /^-+$/.test(rel) || /^(release|リリース)$/i.test(rel)) continue;
      const parsed = parseRelease(rel);
      rows.push({ release: parsed ? formatRelease(parsed) : rel, changes: changes.trim() });
    }
  }
  return rows;
}

const ADDED_RE = /\b(created|added)\b|^new\s+(command|class|function)|追加|作成/i;

/** Release in which an item was introduced, from its History rows. */
export function addedInFromHistory(rows) {
  const added = rows.filter((r) => ADDED_RE.test(r.changes));
  return minRelease(added.map((r) => r.release));
}

/** Earliest release mentioned in History rows (any change). */
export function earliestFromHistory(rows) {
  return minRelease(rows.map((r) => r.release));
}

/** Extract `<!-- REF #key.Part -->content<!-- END REF -->` blocks. Returns Map key -> {Part: content}. */
export function parseRefs(text) {
  const out = new Map();
  const re = /<!--\s*REF\s+#(.+?)\.(Syntax|Summary|Params)\s*-->([\s\S]*?)<!--\s*END REF\s*-->/g;
  let m;
  while ((m = re.exec(text))) {
    const key = m[1].trim();
    if (!out.has(key)) out.set(key, {});
    out.get(key)[m[2]] = m[3].trim();
  }
  return out;
}

/** Split markdown into sections at `## ` headings. First item is preamble (heading null). */
export function splitSections(text, level = 2) {
  const marker = '#'.repeat(level) + ' ';
  const lines = text.split(/\r?\n/);
  const sections = [{ heading: null, lines: [] }];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (!inFence && line.startsWith(marker)) {
      sections.push({ heading: line.slice(marker.length).trim(), lines: [] });
    } else {
      sections.at(-1).lines.push(line);
    }
  }
  return sections.map((s) => ({ heading: s.heading, body: s.lines.join('\n') }));
}

/** Docusaurus-style anchor for a heading (explicit `{#id}` wins). */
export function headingAnchor(heading) {
  const explicit = heading.match(/\{#([^}]+)\}\s*$/);
  if (explicit) return explicit[1];
  return heading
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/** Strip markdown/HTML to plain text. */
export function toPlainText(md) {
  if (!md) return '';
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\*_[\]])/g, '$1')
    .replace(/&#?\w+;/g, (e) => ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>' })[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract markdown link targets from text. */
export function extractLinks(text) {
  const out = [];
  const re = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1]);
  return out;
}
