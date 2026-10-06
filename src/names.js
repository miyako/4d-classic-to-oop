// Localized classic command names (e.g. French), imported from the 4D application's XLIFF resources.
// Command classes/functions are not localized; only classic command names are.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NAMES_DIR = path.join(REPO, 'data');

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&amp;/g, '&')
    .trim();

/**
 * Parse a 4D "4D_Commands<LANG>.xlf" file (group STR#8: trans-unit id = command number).
 * @returns {Array<{number: number, en: string, local: string}>}
 */
export function parseCommandXliff(xml) {
  const out = [];
  const group = xml.match(/<group[^>]*resname="STR#8"[^>]*>([\s\S]*?)<\/group>/);
  const body = (group ? group[1] : xml).replace(/<trans-unit\b[^>]*\/>/g, '');
  for (const m of body.matchAll(/<trans-unit\s+id="(\d+)"[^>]*>([\s\S]*?)<\/trans-unit>/g)) {
    const src = m[2].match(/<source>([\s\S]*?)<\/source>/);
    const tgt = m[2].match(/<target[^>]*>([\s\S]*?)<\/target>/);
    if (!src || !tgt) continue;
    const en = decode(src[1]);
    const local = decode(tgt[1]);
    if (en && local) out.push({ number: Number(m[1]), en, local });
  }
  return out;
}

/** Build the JSON document stored in data/command-names.<lang>.json. */
export function namesDocument(entries, { lang, source }) {
  const commands = {};
  for (const e of [...entries].sort((a, b) => a.number - b.number)) commands[e.number] = { en: e.en, [lang]: e.local };
  return { lang, source, count: Object.keys(commands).length, commands };
}

const cache = new Map();

/**
 * Load localized command names for a language. Returns null when the language has none (en, ja).
 * @returns {{byNumber: Map<number,string>, byName: Map<string,string>, source: string} | null}
 */
export function loadCommandNames(lang, dir = NAMES_DIR) {
  if (!lang || lang === 'en') return null;
  const file = path.join(dir, `command-names.${lang}.json`);
  if (cache.has(file)) return cache.get(file);
  let res = null;
  if (fs.existsSync(file)) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byNumber = new Map();
    const byName = new Map();
    for (const [n, e] of Object.entries(doc.commands || {})) {
      byNumber.set(Number(n), e[lang]);
      byName.set(String(e.en).toLowerCase(), e[lang]);
    }
    res = { byNumber, byName, source: doc.source };
  }
  cache.set(file, res);
  return res;
}

/** Localized name of a catalog command ({name, number}), or null when unknown / identical. */
export function localCommandName(cmd, names) {
  if (!names || !cmd) return null;
  // The command number is stable across renames (e.g. "Get last query plan" -> "Last query plan").
  const n = (cmd.number != null && names.byNumber.get(cmd.number)) || names.byName.get(String(cmd.name).toLowerCase()) || null;
  return n && n !== cmd.name ? n : null;
}
