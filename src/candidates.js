// Propose OOP targets for classic commands (input for curating mapping.yaml).
import { THEME_RULES, ORDA_THEMES, SYNONYMS, STOP_WORDS } from './rules.js';

export function commandTokens(name) {
  const out = new Set();
  for (const w of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!w || STOP_WORDS.has(w)) continue;
    out.add(w);
    for (const s of SYNONYMS[w] || []) out.add(s);
  }
  return out;
}

export function memberTokens(member) {
  const base = member.member.replace(/^4D\.\w+\./, '').replace(/[().*]/g, '');
  const out = new Set([base.toLowerCase()]);
  for (const w of base.split(/(?<=[a-z0-9])(?=[A-Z])|[^A-Za-z0-9]+/)) if (w) out.add(w.toLowerCase());
  return out;
}

/** Overlap score in [0,1] between command tokens and member tokens. */
export function nameSimilarity(cmdTokens, memTokens) {
  let hit = 0;
  for (const t of memTokens) if (cmdTokens.has(t)) hit++;
  return memTokens.size ? hit / memTokens.size : 0;
}

/**
 * @param {object} catalog from extractCatalog
 * @param {{minScore?: number, max?: number}} opts
 */
export function proposeCandidates(catalog, { minScore = 0.5, max = 6 } = {}) {
  const classByPage = new Map(catalog.classes.map((c) => [c.page.toLowerCase(), c.name]));
  const membersByClass = new Map();
  const memberByAnchor = new Map();
  const linkedFromMembers = new Map(); // command slug -> [member]
  for (const m of catalog.members) {
    if (!membersByClass.has(m.class)) membersByClass.set(m.class, []);
    membersByClass.get(m.class).push(m);
    if (m.anchor) memberByAnchor.set(`${m.class}#${m.anchor}`, m);
    for (const slug of m.commandLinks || []) {
      if (!linkedFromMembers.has(slug)) linkedFromMembers.set(slug, []);
      linkedFromMembers.get(slug).push(m);
    }
  }
  const commandById = new Map(catalog.commands.map((c) => [c.id, c]));

  const results = [];
  for (const cmd of catalog.commands) {
    const cands = new Map();
    const bump = (target, score, reason) => {
      const cur = cands.get(target) || { target, score: 0, reasons: [] };
      cur.score = Math.min(1, cur.score + score);
      if (!cur.reasons.includes(reason)) cur.reasons.push(reason);
      cands.set(target, cur);
    };
    const tokens = commandTokens(cmd.name);

    // 1. theme rules + name similarity
    for (const cls of THEME_RULES[cmd.theme] || []) {
      for (const m of membersByClass.get(cls) || []) {
        const s = nameSimilarity(tokens, memberTokens(m));
        if (s > 0) bump(m.id, 0.4 * s + 0.1, `theme:${cmd.theme}->${cls}`);
      }
    }
    // 2. cross-links command page -> class page
    for (const l of cmd.apiLinks || []) {
      const cls = classByPage.get(l.page.toLowerCase());
      if (!cls) continue;
      const m = l.anchor ? memberByAnchor.get(`${cls}#${l.anchor}`) : null;
      if (m) bump(m.id, 0.5, 'link:command->member');
      else bump(`class:${cls}`, 0.3, 'link:command->class');
    }
    // 3. cross-links class member -> command page
    for (const m of linkedFromMembers.get(cmd.id) || []) bump(m.id, 0.4, 'link:member->command');
    // 4. command page -> object-returning command (e.g. Open document -> File)
    for (const slug of cmd.commandLinks || []) {
      const other = commandById.get(slug);
      if (other && ['File', 'Folder', 'New collection', 'HTTP Request', 'ZIP Create archive'].includes(other.name) && other.id !== cmd.id)
        bump(`command:${other.name}`, 0.3, 'link:command->oop-command');
    }
    // 5. global name similarity (strong matches only)
    for (const m of catalog.members) {
      const s = nameSimilarity(tokens, memberTokens(m));
      if (s >= 1 && tokens.size <= 3) bump(m.id, 0.2, 'name');
    }

    const list = [...cands.values()].filter((c) => c.score >= minScore * 0.5).sort((a, b) => b.score - a.score || a.target.localeCompare(b.target));
    if (!list.length || list[0].score < minScore) continue;
    results.push({
      command: cmd.name,
      theme: cmd.theme,
      orda: ORDA_THEMES.has(cmd.theme),
      deprecated: cmd.deprecated,
      url: cmd.url,
      candidates: list.slice(0, max).map((c) => ({ ...c, score: Math.round(c.score * 100) / 100 })),
    });
  }
  return results;
}

export function candidatesToMarkdown(results) {
  const lines = ['| Command | Theme | Candidates (score, reasons) |', '|---|---|---|'];
  for (const r of results)
    lines.push(`| ${r.command} | ${r.theme} | ${r.candidates.map((c) => `\`${c.target}\` (${c.score}; ${c.reasons.join(', ')})`).join('<br>')} |`);
  return lines.join('\n') + '\n';
}
