// Render mapping.yaml + docs catalog into Markdown tables.
import { getCatalog, indexCatalog, resolveTarget, missingReason } from './extract.js';
import { isAvailableAt, normalizeRelease } from './release.js';
import { ORDA_THEMES, ORDA_CLASSES } from './rules.js';
import { loadCommandNames, localCommandName } from './names.js';

/** Supported output languages. Notes: `note` (en), `note_<lang>` for the others. */
export const LANGS = ['en', 'ja', 'fr'];
export const NOTE_LANGS = LANGS.filter((l) => l !== 'en');

export const CLASSIFICATION_LABELS = {
  en: { 'Drop-in': 'Drop-in', Refactor: 'Refactor', Partial: 'Partial' },
  ja: { 'Drop-in': 'そのまま置換', Refactor: 'リファクタリング要', Partial: '部分的' },
  fr: { 'Drop-in': 'Remplacement direct', Refactor: 'Refactorisation', Partial: 'Partiel' },
};

export const I18N = {
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
      '**そのまま置換** (Drop-in): 同じセマンティクスで 1 対 1 に置き換え可能。**リファクタリング要** (Refactor): 同等の機能だがモデルが異なる (例: ドキュメント参照 → `FileHandle`、配列 → コレクション、カレントセレクション → エンティティセレクション)。**部分的** (Partial): OOP API はコマンドの一部の機能のみをカバー。',
    meta: (o) =>
      `ドキュメントバージョン: \`${o.version}\` · 言語: \`${o.lang}\`` +
      (o.floor ? ` · 下限: \`${o.floor}\` (4D ${o.floor} 以前で利用可能な OOP のみ)` : '') +
      ` · コマンド数: ${o.count} (一般 ${o.general}、ORDA ${o.orda})`,
    deprecated: '非推奨',
    unreviewed: '† の付いた項目は未レビューです。',
    since: '',
  },
  fr: {
    title: 'Commandes 4D classiques ayant un équivalent objet (OOP)',
    intro:
      "Commandes du langage 4D classique et les fonctions de classe, propriétés ou commandes retournant des objets qui peuvent les remplacer. Les commandes classiques sont affichées sous leur nom français, suivi du nom anglais en petit ; les classes et fonctions n'ont pas de nom localisé.",
    general: 'Général',
    orda: 'ORDA (accès aux données)',
    cols: ['Commande classique', 'Thème', 'Équivalent(s) OOP', 'Classification', 'Notes'],
    legend:
      "**Remplacement direct** (Drop-in) : remplacement 1:1 avec la même sémantique. **Refactorisation** (Refactor) : fonctionnalité équivalente mais modèle différent (ex. référence de document → `FileHandle`, tableaux → collections, sélection courante → entity selection). **Partiel** (Partial) : l'API objet ne couvre qu'une partie de la commande.",
    meta: (o) =>
      `Version de la documentation : \`${o.version}\` · Langue : \`${o.lang}\`` +
      (o.floor ? ` · Plancher : \`${o.floor}\` (uniquement les équivalents OOP disponibles en 4D ${o.floor} ou avant)` : '') +
      ` · Commandes : ${o.count} (général ${o.general}, ORDA ${o.orda})`,
    deprecated: 'obsolète',
    unreviewed: "Les entrées marquées † n'ont pas encore été vérifiées.",
    since: 'depuis',
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

  const names = loadCommandNames(lang);
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
      // Object-returning commands have localized names too; class members do not.
      if (r.type === 'command') r.localLabel = localCommandName(r.ref, names);
      targets.push(r);
    }
    if (!targets.length) continue;
    const orda =
      m.orda ?? (ORDA_THEMES.has(cmd.theme) || targets.some((t) => t.type === 'member' && ORDA_CLASSES.has(t.ref.class)));
    rows.push({
      command: cmd.name,
      commandLocal: localCommandName(cmd, names),
      url: cmd.url,
      theme: cmd.theme,
      themeLabel: (lang !== 'en' && cmd.themeLabel) || cmd.theme,
      targets,
      classification: m.classification,
      classificationLabel: (CLASSIFICATION_LABELS[lang] || CLASSIFICATION_LABELS.en)[m.classification] || m.classification,
      note: (lang !== 'en' && m[`note_${lang}`]) || m.note || '',
      orda,
      deprecated: !!deprecated,
      reviewed: m.reviewed !== false,
    });
  }
  rows.sort(
    (a, b) =>
      a.theme.localeCompare(b.theme, 'en') || (a.commandLocal || a.command).localeCompare(b.commandLocal || b.command, lang, { sensitivity: 'base' }),
  );
  return { rows, warnings };
}

function table(rows, t, { showSince }) {
  const out = [`| ${t.cols.join(' | ')} |`, `|${t.cols.map(() => '---').join('|')}|`];
  for (const r of rows) {
    const cmd =
      link(r.commandLocal || r.command, r.url) +
      (r.commandLocal ? ` <sub>${esc(r.command)}</sub>` : '') +
      (r.deprecated ? ` *(${t.deprecated})*` : '') + (r.reviewed ? '' : ' †');
    const targets = r.targets
      .map((x) => link(x.localLabel || x.label, x.url) + (x.localLabel ? ` <sub>${esc(x.label)}</sub>` : '') + (showSince && x.addedIn ? ` <sub>${t.since ? t.since + ' ' : ''}${x.addedIn}</sub>` : ''))
      .join('<br>');
    out.push(`| ${cmd} | ${esc(r.themeLabel)} | ${targets} | ${esc(r.classificationLabel)} | ${esc(r.note)} |`);
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
