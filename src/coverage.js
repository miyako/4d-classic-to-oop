// Coverage / diff report: what in the docs is not covered by mapping.yaml, and which targets are invalid.
import { getCatalog, indexCatalog, resolveTarget, missingReason } from './extract.js';
import { proposeCandidates } from './candidates.js';
import { compareReleases, normalizeRelease } from './release.js';
import { THEME_RULES } from './rules.js';

export function coverageReport(mapping, { docsRoot, version = 'latest', since = null, all = false }) {
  const catalog = getCatalog({ docsRoot, version, lang: 'en' });
  const cmdCatalog = catalog.commands.length ? catalog : getCatalog({ docsRoot, version: 'latest', lang: 'en' });
  const memIdx = indexCatalog(catalog);
  const cmdIdx = indexCatalog(cmdCatalog);
  const latestIdx = version === 'latest' ? memIdx : indexCatalog(getCatalog({ docsRoot, version: 'latest', lang: 'en' }));
  const notYetAvailable = [];
  const errors = [];
  const warnings = [];
  if (cmdCatalog !== catalog) warnings.push(`docs version "${version}" has no command pages; commands checked against latest`);
  const noClasses = !catalog.members.length;
  if (noClasses) warnings.push(`docs version "${version}" has no class pages; member targets are not validated`);

  const mapped = new Set();
  const referenced = new Set();
  for (const m of mapping.mappings) {
    mapped.add(m.command.toLowerCase());
    if (!cmdIdx.byCommand.has(m.command.toLowerCase())) errors.push(`unknown command: ${m.command}`);
    for (const t of m.targets) {
      const r = /^command:/i.test(t) ? resolveTarget(t, cmdIdx) : resolveTarget(t, memIdx);
      if (!r) {
        const why = missingReason(t, latestIdx, version);
        if (noClasses && why.reason !== 'unknown' && !/^command:/i.test(t)) continue;
        if (why.reason === 'later') notYetAvailable.push({ command: m.command, target: t, addedIn: why.addedIn });
        else if (why.reason === 'absent') warnings.push(`${m.command}: target "${t}" not documented in docs version "${version}"`);
        else errors.push(`${m.command}: target "${t}" not found in docs version "${version}"`);
      } else referenced.add(r.type === 'member' ? r.ref.id : `command:${r.ref.name}`);
    }
  }
  const ignored = new Set(mapping.ignore.map((c) => String(c).toLowerCase()));
  for (const c of mapping.ignore) if (!cmdIdx.byCommand.has(String(c).toLowerCase())) warnings.push(`ignore: unknown command "${c}"`);
  const triaged = (name) => mapped.has(name.toLowerCase()) || ignored.has(name.toLowerCase());

  const candidates = proposeCandidates(cmdCatalog).filter((c) => !triaged(c.command));
  const untriagedInRuleThemes = all
    ? cmdCatalog.commands.filter((c) => THEME_RULES[c.theme] && !triaged(c.name)).map((c) => ({ command: c.name, theme: c.theme }))
    : [];

  const ruleClasses = new Set(Object.values(THEME_RULES).flat());
  const unreferencedMembers = catalog.members
    .filter((m) => (all || ruleClasses.has(m.class)) && !referenced.has(m.id))
    .map((m) => ({ id: m.id, addedIn: m.addedIn, url: m.url }));

  let newSince = null;
  if (since) {
    const rel = normalizeRelease(since);
    if (!rel) throw new Error(`Invalid --since release: ${since}`);
    const after = (x) => x && compareReleases(x, rel) > 0;
    newSince = {
      release: rel,
      commands: cmdCatalog.commands.filter((c) => after(c.addedIn)).map((c) => ({ command: c.name, theme: c.theme, addedIn: c.addedIn, mapped: triaged(c.name) })),
      members: catalog.members.filter((m) => after(m.addedIn) && !m.addedInInferred).map((m) => ({ id: m.id, addedIn: m.addedIn, referenced: referenced.has(m.id) })),
    };
  }

  return {
    version,
    stats: {
      commands: cmdCatalog.commands.length,
      members: catalog.members.length,
      mapped: mapping.mappings.length,
      ignored: mapping.ignore.length,
      unreviewed: mapping.mappings.filter((m) => m.reviewed === false).length,
      referencedMembers: referenced.size,
    },
    errors,
    warnings,
    notYetAvailable,
    untriagedCandidates: candidates.map((c) => ({ command: c.command, theme: c.theme, top: c.candidates.slice(0, 3).map((x) => x.target) })),
    untriagedInRuleThemes,
    unreferencedMembers,
    newSince,
  };
}

export function coverageToMarkdown(r) {
  const L = [];
  L.push(`# Coverage report (docs version \`${r.version}\`)`, '');
  const s = r.stats;
  L.push(`- Commands in docs: ${s.commands}; class members: ${s.members}`);
  L.push(`- Mapped commands: ${s.mapped} (unreviewed: ${s.unreviewed}); ignored: ${s.ignored}; referenced members: ${s.referencedMembers}`, '');
  L.push(`## Errors (${r.errors.length})`, '', ...(r.errors.length ? r.errors.map((e) => `- ${e}`) : ['None.']), '');
  if (r.warnings.length) L.push(`## Warnings (${r.warnings.length})`, '', ...r.warnings.map((e) => `- ${e}`), '');
  if (r.notYetAvailable.length) {
    L.push(`## Targets added after docs version \`${r.version}\` (${r.notYetAvailable.length})`, '');
    for (const x of r.notYetAvailable) L.push(`- ${x.command}: \`${x.target}\` (${x.addedIn})`);
    L.push('');
  }
  L.push(`## Commands with OOP candidates not in mapping.yaml (${r.untriagedCandidates.length})`, '');
  L.push('Add them to `mappings:` or to `ignore:` once reviewed.', '');
  for (const c of r.untriagedCandidates) L.push(`- **${c.command}** (${c.theme}): ${c.top.map((t) => `\`${t}\``).join(', ')}`);
  L.push('');
  if (r.untriagedInRuleThemes.length) {
    L.push(`## Other untriaged commands in OOP-related themes (${r.untriagedInRuleThemes.length})`, '');
    for (const c of r.untriagedInRuleThemes) L.push(`- ${c.command} (${c.theme})`);
    L.push('');
  }
  L.push(`## Class members not referenced by any mapping (${r.unreferencedMembers.length})`, '');
  for (const m of r.unreferencedMembers) L.push(`- [\`${m.id}\`](${m.url})${m.addedIn ? ` — ${m.addedIn}` : ''}`);
  L.push('');
  if (r.newSince) {
    L.push(`## New since ${r.newSince.release}`, '', '### Commands', '');
    for (const c of r.newSince.commands) L.push(`- ${c.mapped ? '[x]' : '[ ]'} ${c.command} (${c.theme}) — ${c.addedIn}`);
    L.push('', '### Members', '');
    for (const m of r.newSince.members) L.push(`- ${m.referenced ? '[x]' : '[ ]'} \`${m.id}\` — ${m.addedIn}`);
    L.push('');
  }
  return L.join('\n');
}
