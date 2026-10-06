// Build a catalog of classic commands and OOP class members from a 4D docs clone (read-only).
import fs from 'node:fs';
import path from 'node:path';
import {
  parseFrontMatter,
  parseHistory,
  addedInFromHistory,
  earliestFromHistory,
  parseRefs,
  splitSections,
  headingAnchor,
  toPlainText,
  extractLinks,
} from './markdown.js';
import { compareReleases, docsVersionToRelease } from './release.js';

export const SITE = 'https://developer.4d.com/docs/';
export const SHARED_API_PAGES = new Set(['Document', 'Directory', 'Transporter']);

/** Directory holding the markdown sources for a version/lang. */
export function contentDir(docsRoot, version = 'latest', lang = 'en') {
  const v = !version || version === 'latest' || version === 'current' ? null : version;
  if (lang === 'en') return v ? path.join(docsRoot, 'versioned_docs', `version-${v}`) : path.join(docsRoot, 'docs');
  return path.join(docsRoot, 'i18n', lang, 'docusaurus-plugin-content-docs', v ? `version-${v}` : 'current');
}

/** Public URL base for a version/lang, e.g. https://developer.4d.com/docs/ja/21-R4/ */
export function urlBase(version = 'latest', lang = 'en') {
  const v = !version || version === 'latest' || version === 'current' ? '' : `${version}/`;
  const l = lang && lang !== 'en' ? `${lang}/` : '';
  return `${SITE}${l}${v}`;
}

/** List available docs versions (from versions.json) plus "latest". */
export function listVersions(docsRoot) {
  try {
    return ['latest', ...JSON.parse(fs.readFileSync(path.join(docsRoot, 'versions.json'), 'utf8'))];
  } catch {
    return ['latest'];
  }
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'assets' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const read = (p) => fs.readFileSync(p, 'utf8');
const readIfExists = (p) => (fs.existsSync(p) ? read(p) : null);
const COMMAND_SLUG = /^\/commands\/([^/]+)$/;
const DEPRECATED_RE = /deprecat|obsolete|廃止/i;

function detectDeprecated(title, history, body) {
  if (/^_o_/.test(title)) return true;
  if (history.some((h) => DEPRECATED_RE.test(h.changes) && !/support|property|parameter|selector/i.test(h.changes))) return true;
  // Admonition / sentence near the top of the description stating the command itself is deprecated.
  const head = body.slice(0, 4000);
  return /:::\s*\w*\s*(deprecated|obsolete)/i.test(head) || /\b(this|the)\s+command\s+is\s+(now\s+)?(deprecated|obsolete)/i.test(head);
}

/** Build slug -> theme from commands/theme/*.md index pages. */
function themeIndex(files) {
  const map = new Map();
  for (const f of files) {
    const text = read(f);
    const { data, body } = parseFrontMatter(text);
    if (!/^\/commands\/theme\//.test(data.slug || '')) continue;
    const theme = data.title || data.sidebar_label;
    const re = /commands(?:-legacy)?\/([a-z0-9][\w-]*?)(?:\.md)?(?:#[^)]*)?\)/gi;
    let m;
    while ((m = re.exec(body))) if (!map.has(m[1])) map.set(m[1], theme);
  }
  return map;
}

/** Resolve a markdown link found in `fromFile` to an API page + anchor, if it points to one. */
function apiLinkTarget(link, fromFile, root) {
  const [p, anchor] = link.split('#');
  if (!p) return null;
  if (/^https?:/.test(p)) {
    const m = p.match(/\/API\/([\w]+)/);
    return m ? { page: m[1], anchor: anchor || null } : null;
  }
  const abs = path.resolve(path.dirname(fromFile), p);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  const m = rel.match(/(?:^|\/)API\/([\w]+?)(?:\.md)?$/);
  return m ? { page: m[1], anchor: anchor || null } : null;
}

function commandLinkSlug(link) {
  const m = link.match(/(?:^|\/)commands(?:-legacy)?\/([a-z0-9][\w-]*?)(?:\.md)?(?:#.*)?$/i);
  return m && m[1] !== 'theme' ? m[1].toLowerCase() : null;
}

function classAliases(root) {
  const map = new Map();
  const conf = readIfExists(path.join(root, 'preprocessing.conf'));
  if (conf) {
    const re = /REF\s+#(\w+)\._alias_\s*-->\s*([^<]+?)\s*<!--/g;
    let m;
    while ((m = re.exec(conf))) map.set(m[1].toLowerCase(), m[2]);
  }
  return map;
}

function memberKind(name) {
  if (/(^|\.)new\(\)$/.test(name) && name.startsWith('4D.')) return 'constructor';
  return name.endsWith(')') ? 'function' : 'property';
}

function memberNameFromKey(key) {
  if (key.startsWith('4D.')) return key.replace(/\*/g, '');
  const i = key.indexOf('.');
  return (i >= 0 ? key.slice(i + 1) : key).replace(/\*/g, '').replace(/^\./, '');
}

/**
 * Extract commands from a content dir.
 */
function extractCommands(root, files, base) {
  const themes = themeIndex(files);
  const commands = [];
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const inCommandDir = /^(commands|commands-legacy|language-legacy)\/(?!theme\/)/.test(rel);
    const text = read(f);
    if (!inCommandDir && !/^\uFEFF?---[\s\S]*?slug:\s*\/commands\//m.test(text.slice(0, 600))) continue;
    const { data, body } = parseFrontMatter(text);
    // Pages without a slug are served at their path (commands/<id>).
    const slug = data.slug || (inCommandDir && /REF\s+#_command_\./.test(body) ? `/commands/${data.id || path.basename(f, '.md')}` : '');
    const sm = slug.match(COMMAND_SLUG);
    if (!sm || data.id === 'command-index') continue;
    const legacy = rel.match(/^language-legacy\/([^/]+)\//);
    const name = data.title || sm[1];
    const history = parseHistory(body);
    const refs = parseRefs(body);
    const ref = refs.get(`_command_.${name}`) || [...refs.entries()].find(([k]) => k.startsWith('_command_.'))?.[1] || {};
    const links = extractLinks(body);
    commands.push({
      name,
      id: sm[1],
      theme: legacy ? legacy[1] : themes.get(sm[1]) || (rel.startsWith('commands-legacy/') ? 'Database Methods' : 'Other'),
      file: rel,
      url: base + slug.replace(/^\//, ''),
      addedIn: addedInFromHistory(history),
      firstRelease: earliestFromHistory(history),
      deprecated: detectDeprecated(name, history, body),
      summary: toPlainText(ref.Summary || ''),
      apiLinks: links.map((l) => apiLinkTarget(l, f, root)).filter(Boolean),
      commandLinks: [...new Set(links.map(commandLinkSlug).filter(Boolean))],
    });
  }
  commands.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return commands;
}

/** Index every REF key defined in API pages with its section info (heading, history). */
function apiRefIndex(apiFiles, root) {
  const index = new Map();
  for (const f of apiFiles) {
    const page = path.basename(f, '.md');
    const { body } = parseFrontMatter(read(f));
    for (const sec of splitSections(body)) {
      if (!sec.heading) continue;
      const refs = parseRefs(sec.body);
      const history = parseHistory(sec.body);
      const commandLinks = [...new Set(extractLinks(sec.body).map(commandLinkSlug).filter(Boolean))];
      for (const [key, parts] of refs) {
        if (!parts.Syntax && !parts.Summary) continue;
        if (index.has(key) && index.get(key).history.length) continue;
        index.set(key, {
          page,
          heading: sec.heading,
          anchor: headingAnchor(sec.heading),
          history,
          summary: toPlainText(parts.Summary || ''),
          syntax: toPlainText(parts.Syntax || ''),
          commandLinks,
          file: path.relative(root, f).split(path.sep).join('/'),
        });
      }
    }
  }
  return index;
}

function extractMembers(root, base) {
  const apiDir = path.join(root, 'API');
  if (!fs.existsSync(apiDir)) return { classes: [], members: [] };
  const apiFiles = fs.readdirSync(apiDir).filter((n) => n.endsWith('.md')).map((n) => path.join(apiDir, n));
  const aliases = classAliases(root);
  const index = apiRefIndex(apiFiles, root);
  const classes = [];
  const members = [];
  for (const f of apiFiles) {
    const page = path.basename(f, '.md');
    if (!/Class$/.test(page)) continue;
    const { data, body } = parseFrontMatter(read(f));
    const cls = aliases.get(page.toLowerCase()) || data.title || page.replace(/Class$/, '');
    const pageUrl = base + 'API/' + (data.id || page);
    // Class-level History (page preamble) is the fallback for members without their own History.
    const classHistory = parseHistory(splitSections(body)[0].body);
    const classAdded = addedInFromHistory(classHistory);
    classes.push({ name: cls, page, url: pageUrl, file: `API/${page}.md` });
    const seen = new Set();
    const add = (key, anchor) => {
      const info = index.get(key);
      const name = memberNameFromKey(key);
      if (!name || seen.has(name)) return;
      seen.add(name);
      const kind = memberKind(name);
      members.push({
        id: kind === 'constructor' ? name : `${cls}.${name}`,
        class: cls,
        member: name,
        kind,
        anchor: anchor || info?.anchor || null,
        url: pageUrl + (anchor || info?.anchor ? `#${anchor || info.anchor}` : ''),
        addedIn: (info && addedInFromHistory(info.history)) || (info?.page === page ? classAdded : null),
        firstRelease: info ? earliestFromHistory(info.history) : null,
        summary: info?.summary || '',
        definedIn: info?.file || null,
        commandLinks: info?.commandLinks || [],
        refKey: key,
      });
    };
    const tableRe = /\[<!--\s*INCLUDE\s+#(.+?)\.Syntax\s*-->\]\(#([^)\s]+)\)/g;
    let m;
    while ((m = tableRe.exec(body))) add(m[1].trim(), m[2]);
    // Sections defined in the page but not listed in its member table (e.g. constructors).
    for (const sec of splitSections(body)) {
      if (!sec.heading) continue;
      for (const [key, parts] of parseRefs(sec.body)) if (parts.Syntax) add(key, headingAnchor(sec.heading));
    }
  }
  // A member cannot predate its class: infer unknown addedIn from the earliest known member of the class.
  const classMin = new Map();
  for (const m of members) {
    if (!m.addedIn) continue;
    const cur = classMin.get(m.class);
    if (!cur || compareReleases(m.addedIn, cur) < 0) classMin.set(m.class, m.addedIn);
  }
  for (const m of members) {
    if (!m.addedIn && classMin.has(m.class)) {
      m.addedIn = classMin.get(m.class);
      m.addedInInferred = true;
    }
  }
  members.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return { classes, members };
}

/** English theme title -> localized theme title, from commands/theme/*.md index pages (same file names). */
export function themeLabels(enRoot, locRoot) {
  const map = new Map();
  const dir = path.join(enRoot, 'commands', 'theme');
  if (!fs.existsSync(dir)) return map;
  for (const n of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const loc = readIfExists(path.join(locRoot, 'commands', 'theme', n));
    if (!loc) continue;
    const en = parseFrontMatter(read(path.join(dir, n))).data;
    const ja = parseFrontMatter(loc).data;
    const enTitle = en.title || en.sidebar_label;
    const locTitle = ja.title || ja.sidebar_label;
    if (enTitle && locTitle) {
      map.set(String(enTitle), String(locTitle));
      map.set(n.replace(/\.md$/, '').replace(/_/g, ' '), String(locTitle));
    }
  }
  return map;
}

/** Overlay localized summaries (same relative paths / REF keys) and theme labels onto an English catalog. */
function overlayLang(catalog, locRoot, labels = new Map()) {
  for (const c of catalog.commands) if (labels.has(c.theme)) c.themeLabel = labels.get(c.theme);
  if (!fs.existsSync(locRoot)) return catalog;
  for (const c of catalog.commands) {
    const t = readIfExists(path.join(locRoot, c.file));
    if (!t) continue;
    const refs = parseRefs(t);
    const ref = refs.get(`_command_.${c.name}`);
    if (ref?.Summary) c.summary = toPlainText(ref.Summary);
  }
  const apiDir = path.join(locRoot, 'API');
  if (fs.existsSync(apiDir)) {
    const keys = new Map();
    for (const n of fs.readdirSync(apiDir).filter((x) => x.endsWith('.md'))) {
      for (const [k, parts] of parseRefs(read(path.join(apiDir, n)))) if (parts.Summary && !keys.has(k)) keys.set(k, parts.Summary);
    }
    for (const mem of catalog.members) if (keys.has(mem.refKey)) mem.summary = toPlainText(keys.get(mem.refKey));
  }
  return catalog;
}

/**
 * Extract a catalog for a docs version and language.
 * @param {{docsRoot: string, version?: string, lang?: string}} opts
 */
export function extractCatalog({ docsRoot, version = 'latest', lang = 'en' }) {
  const root = contentDir(docsRoot, version, 'en');
  if (!fs.existsSync(root)) throw new Error(`Docs content not found for version "${version}": ${root}`);
  const base = urlBase(version, lang);
  const files = walk(root);
  const commands = extractCommands(root, files, base);
  const { classes, members } = extractMembers(root, base);
  const catalog = { docsVersion: version || 'latest', lang, urlBase: base, commands, classes, members };
  if (lang !== 'en') {
    // Theme index pages only exist in recent versions: fall back to the latest ones.
    let labels = themeLabels(root, contentDir(docsRoot, version, lang));
    if (!labels.size) labels = themeLabels(contentDir(docsRoot, 'latest', 'en'), contentDir(docsRoot, 'latest', lang));
    overlayLang(catalog, contentDir(docsRoot, version, lang), labels);
  }
  return catalog;
}

const cache = new Map();
/** Cached extractCatalog (per process). */
export function getCatalog(opts) {
  const k = `${opts.docsRoot}|${opts.version || 'latest'}|${opts.lang || 'en'}`;
  if (!cache.has(k)) cache.set(k, extractCatalog(opts));
  return cache.get(k);
}

/** Lookup helpers. */
export function indexCatalog(catalog) {
  const byCommand = new Map();
  for (const c of catalog.commands) byCommand.set(c.name.toLowerCase(), c);
  const byMember = new Map();
  for (const m of catalog.members) byMember.set(m.id.toLowerCase(), m);
  return { byCommand, byMember };
}

const CLASS_RENAMES = [
  ['Function', 'Formula'],
  ['Formula', 'Function'],
];

/**
 * Resolve a mapping target id against a catalog.
 * Accepts "Class.member()", "Class.property", "4D.Class.new()", "command:Name".
 */
export function resolveTarget(target, idx) {
  const t = String(target).trim();
  if (/^command:/i.test(t)) {
    const c = idx.byCommand.get(t.slice(8).trim().toLowerCase());
    return c ? { type: 'command', id: t, label: c.name, url: c.url, addedIn: c.addedIn, ref: c } : null;
  }
  let m = idx.byMember.get(t.toLowerCase());
  // Class pages renamed across versions (4D.Function was documented as Formula before 20).
  for (const [from, to] of CLASS_RENAMES) if (!m && t.startsWith(from + '.')) m = idx.byMember.get((to + t.slice(from.length)).toLowerCase());
  if (!m) return null;
  const label = m.kind === 'constructor' ? m.member : `${m.class}.${m.member}`;
  return { type: 'member', id: t, label, url: m.url, addedIn: m.addedIn, ref: m };
}

/**
 * Explain why a target is missing from a version catalog:
 * "later" when it exists in the latest docs but was added after `version`, "unknown" otherwise.
 */
export function missingReason(target, latestIdx, version) {
  const r = resolveTarget(target, latestIdx);
  if (!r) return { reason: 'unknown' };
  const rel = docsVersionToRelease(version);
  if (rel && r.addedIn && compareReleases(r.addedIn, rel) > 0) return { reason: 'later', addedIn: r.addedIn };
  return { reason: 'absent', addedIn: r.addedIn };
}
