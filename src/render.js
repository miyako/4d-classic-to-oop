// Render mapping.yaml + docs catalog into Markdown tables.
import { getCatalog, indexCatalog, resolveTarget, missingReason } from './extract.js';
import { isAvailableAt, normalizeRelease } from './release.js';
import { ORDA_THEMES, ORDA_CLASSES } from './rules.js';

const I18N = {
  en: {
    title: '4D classic commands with an OOP equivalent',
    intro: 'Classic 4D language commands and the class functions, properties or object-returning commands that can replace them.',
    general: 'General',
    orda: 'ORDA (database access)',
    cols: ['Classic command', 'Theme', 'OOP equivalent(s)', 'Classification', 'Notes'],
    legend:
      '**Drop-in**: 1:1 replacement with the same semantics. **Refactor**: equivalent feature but a different model (e.g. document reference → `FileHandle`, arrays → collections, current selection → entity selection). **Partial**: the OOP API covers only part of the command.',
    meta: (o) =>
      `Docs version: \`${o.version}\` · Language: \`${o.lang}\`` +
      (o.floor ? ` · Floor: \`${o.floor}\` (only OOP targets available in 4D ${o.floor} or earlier)` : '') +
      ` · Commands: ${o.count} (general ${o.general}, ORDA ${o.orda})`,
    deprecated: 'deprecated',
    unreviewed: 'Entries marked † have not been reviewed yet.',
    since: 'since',
  },
  ja: {
    title: 'OOP 版のある 4D クラシックコマンド一覧',
    intro: '4D クラシックランゲージのコマンドと、それを置き換えることができるクラス関数・プロパティ・オブジェクトを返すコマンドの対応表です。',
    general: '一般',
    orda: 'ORDA (データベースアクセス)',
    cols: ['クラシックコマンド', 'テーマ', 'OOP 版', '分類', '備考'],
    legend:
      '**Drop-in**: 同じセマンティクスでそのまま置き換え可能。**Refactor**: 同等の機能だがモデルが異なる (例: ドキュメント参照 → `FileHandle`、配列 → コレクション、カレントセレクション → エンティティセレクション)。**Partial**: OOP API はコマンドの一部のみをカバー。',
    meta: (o) =>
      `ドキュメントバージョン: \`${o.version}\` · 言語: \`${o.lang}\`` +
      (o.floor ? ` · 下限: \`${o.floor}\` (4D ${o.floor} 以前で利用可能な OOP のみ)` : '') +
      ` · コマンド数: ${o.count} (一般 ${o.general}、ORDA ${o.orda})`,
    deprecated: '非推奨',
    unreviewed: '† の付いた項目は未レビューです。',
    since: '',
  },
};

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const link = (label, url) => (url ? `[${esc(label)}](${url})` : esc(label));

/**
 * Build the rows (data only) for a mapping at a version/lang/floor.
 * @returns {{rows: object[], warnings: string[]}}
 */
export function buildRows(mapping, opts) {
  const { docsRoot, version = 'latest', lang = 'en', floor = null, themes = null, includeDeprecated = false } = opts;
  const warnings = [];
  const catalog = getCatalog({ docsRoot, version, lang });
  let cmdCatalog = catalog;
  if (!catalog.commands.length) {
    cmdCatalog = getCatalog({ docsRoot, version: 'latest', lang });
    warnings.push(`docs version "${version}" has no command pages; command links point to the latest docs`);
  }
  if (!catalog.members.length) warnings.push(`docs version "${version}" has no class pages; class members cannot be linked`);
  const memIdx = indexCatalog(catalog);
  const cmdIdx = indexCatalog(cmdCatalog);
  const latestIdx = version === 'latest' ? memIdx : indexCatalog(getCatalog({ docsRoot, version: 'latest', lang }));
  const themeSet = themes && themes.length ? new Set(themes.map((t) => t.toLowerCase())) : null;
  const floorRel = floor ? normalizeRelease(floor) : null;
  if (floor && !floorRel) throw new Error(`Invalid --floor release: ${floor}`);

  const rows = [];
  for (const m of mapping.mappings) {
    const cmd = cmdIdx.byCommand.get(m.command.toLowerCase());
    if (!cmd) {
      warnings.push(`command not found in docs: ${m.command}`);
      continue;
    }
    if (themeSet && !themeSet.has(cmd.theme.toLowerCase())) continue;
    const deprecated = m.deprecated ?? cmd.deprecated;
    if (deprecated && !includeDeprecated) continue;
    const targets = [];
    for (const t of m.targets) {
      // Object-returning commands are resolved against the command catalog (may be the latest one).
      const r = /^command:/i.test(t) ? resolveTarget(t, cmdIdx) : resolveTarget(t, memIdx);
      if (!r) {
        // Targets added after the selected docs version are silently dropped.
        const why = missingReason(t, latestIdx, version);
        if (!catalog.members.length && !/^command:/i.test(t)) continue;
        if (why.reason === 'unknown') warnings.push(`${m.command}: unknown target "${t}"`);
        else if (why.reason === 'absent') warnings.push(`${m.command}: target "${t}" not documented in docs version "${version}"`);
        continue;
      }
      if (floorRel && !isAvailableAt(r.addedIn, floorRel)) continue;
      targets.push(r);
    }
    if (!targets.length) continue;
    const orda =
      m.orda ?? (ORDA_THEMES.has(cmd.theme) || targets.some((t) => t.type === 'member' && ORDA_CLASSES.has(t.ref.class)));
    rows.push({
      command: cmd.name,
      url: cmd.url,
      theme: cmd.theme,
      targets,
      classification: m.classification,
      note: (lang === 'ja' && m.note_ja) || m.note || '',
      orda,
      deprecated: !!deprecated,
      reviewed: m.reviewed !== false,
    });
  }
  rows.sort((a, b) => a.theme.localeCompare(b.theme, 'en') || a.command.localeCompare(b.command, 'en'));
  return { rows, warnings };
}

function table(rows, t, { showSince }) {
  const out = [`| ${t.cols.join(' | ')} |`, `|${t.cols.map(() => '---').join('|')}|`];
  for (const r of rows) {
    const cmd = link(r.command, r.url) + (r.deprecated ? ` *(${t.deprecated})*` : '') + (r.reviewed ? '' : ' †');
    const targets = r.targets
      .map((x) => link(x.label, x.url) + (showSince && x.addedIn ? ` <sub>${t.since ? t.since + ' ' : ''}${x.addedIn}</sub>` : ''))
      .join('<br>');
    out.push(`| ${cmd} | ${esc(r.theme)} | ${targets} | ${r.classification} | ${esc(r.note)} |`);
  }
  return out.join('\n');
}

/** Render Markdown. Returns { markdown, warnings, rows }. */
export function renderMarkdown(mapping, opts) {
  const lang = opts.lang || 'en';
  const t = I18N[lang] || I18N.en;
  const { rows, warnings } = buildRows(mapping, opts);
  const general = rows.filter((r) => !r.orda);
  const orda = rows.filter((r) => r.orda);
  const md = [
    `# ${t.title}`,
    '',
    t.intro,
    '',
    t.meta({ version: opts.version || 'latest', lang, floor: opts.floor ? normalizeRelease(opts.floor) : null, count: rows.length, general: general.length, orda: orda.length }),
    '',
    t.legend,
    ...(rows.some((r) => !r.reviewed) ? ['', t.unreviewed] : []),
    '',
    `## ${t.general}`,
    '',
    table(general, t, opts),
    '',
    `## ${t.orda}`,
    '',
    table(orda, t, opts),
    '',
  ].join('\n');
  return { markdown: md, warnings, rows };
}
