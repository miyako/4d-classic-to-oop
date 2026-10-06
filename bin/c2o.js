#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { extractCatalog, listVersions } from '../src/extract.js';
import { proposeCandidates, candidatesToMarkdown } from '../src/candidates.js';
import { loadMapping } from '../src/mapping.js';
import { renderMarkdown } from '../src/render.js';
import { coverageReport, coverageToMarkdown } from '../src/coverage.js';
import { buildSite, DEFAULT_REPO_URL, DEFAULT_DOCS_REPO } from '../src/site.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `c2o — map 4D classic commands to OOP equivalents

Usage: c2o <command> [options]

Commands:
  extract      Parse the docs into a catalog JSON (commands + class members)
  candidates   Propose OOP targets per command (heuristics) to help curate mapping.yaml
  render       Generate the Markdown table from mapping.yaml
  coverage     Report docs items not covered by mapping.yaml and validate targets (alias: diff)
  site         Build the static web site (en + ja) into --out (default: site/)
  versions     List docs versions available in --docs-root

Common options:
  --docs-root <dir>      4D docs clone (read-only). Default: $C2O_DOCS_ROOT or ../docs
  --docs-version <v>     latest (default) | 21-R4 | 21-R3 | 21 | 20 | 19 | 18
  --lang <en|ja>         Language for links/summaries (default: en)
  --mapping <file>       Mapping file (default: mapping.yaml in this repo)
  --out <file>           Write output to a file instead of stdout
  --format <md|json>     Output format for candidates/coverage (default: md)

render:
  --floor <release>      Only keep OOP targets added in <release> or earlier (e.g. "19 R5"); drop empty rows
  --themes <a,b>         Only include these command themes
  --include-deprecated   Include commands flagged deprecated
  --show-since           Show the release each OOP target was added in

candidates:
  --min-score <n>        Minimum score (default 0.5)
  --all                  Include commands already in mapping.yaml

site:
  --out <dir>            Output folder (default: site). Writes index.html, data.json, ja/index.html, ja/data.json
  --floor, --docs-version, --themes, --include-deprecated   Same as render
  --repo-url <url>       Link back to this repository (default: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY or ${DEFAULT_REPO_URL})
  --docs-repo <o/r>      GitHub repo of the docs, used to link the docs commit (default: ${DEFAULT_DOCS_REPO})

coverage:
  --since <release>      Also list commands/members added after <release>
  --all                  List every untriaged command in OOP-related themes and members of all classes
  --strict               Exit 1 on warnings as well as errors
`;

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
    process.stdout.write(HELP);
    return 0;
  }
  const { values: o } = parseArgs({
    args: rest,
    options: {
      'docs-root': { type: 'string' },
      'docs-version': { type: 'string', default: 'latest' },
      lang: { type: 'string', default: 'en' },
      mapping: { type: 'string', default: path.join(REPO, 'mapping.yaml') },
      out: { type: 'string' },
      format: { type: 'string', default: 'md' },
      floor: { type: 'string' },
      themes: { type: 'string' },
      'include-deprecated': { type: 'boolean', default: false },
      'show-since': { type: 'boolean', default: false },
      'min-score': { type: 'string', default: '0.5' },
      since: { type: 'string' },
      all: { type: 'boolean', default: false },
      strict: { type: 'boolean', default: false },
      'repo-url': { type: 'string' },
      'docs-repo': { type: 'string', default: DEFAULT_DOCS_REPO },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (o.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const docsRoot = path.resolve(o['docs-root'] || process.env.C2O_DOCS_ROOT || path.join(REPO, '..', 'docs'));
  if (!fs.existsSync(path.join(docsRoot, 'docs'))) throw new Error(`--docs-root does not look like a 4D docs clone: ${docsRoot}`);
  if (!['en', 'ja'].includes(o.lang)) throw new Error(`--lang must be en or ja`);
  const version = o['docs-version'];
  if (!listVersions(docsRoot).includes(version)) throw new Error(`Unknown --docs-version "${version}". Available: ${listVersions(docsRoot).join(', ')}`);
  const write = (text) => {
    if (o.out) {
      fs.mkdirSync(path.dirname(path.resolve(o.out)), { recursive: true });
      fs.writeFileSync(o.out, text);
      process.stderr.write(`Wrote ${o.out}\n`);
    } else process.stdout.write(text);
  };
  const warn = (ws) => ws.forEach((w) => process.stderr.write(`warning: ${w}\n`));

  switch (cmd) {
    case 'versions':
      write(listVersions(docsRoot).join('\n') + '\n');
      return 0;
    case 'extract': {
      const catalog = extractCatalog({ docsRoot, version, lang: o.lang });
      write(JSON.stringify(catalog, null, 2) + '\n');
      process.stderr.write(`${catalog.commands.length} commands, ${catalog.members.length} members, ${catalog.classes.length} classes\n`);
      return 0;
    }
    case 'candidates': {
      const catalog = extractCatalog({ docsRoot, version, lang: o.lang });
      let res = proposeCandidates(catalog, { minScore: Number(o['min-score']) });
      if (!o.all && fs.existsSync(o.mapping)) {
        const m = loadMapping(o.mapping);
        const done = new Set([...m.mappings.map((x) => x.command), ...m.ignore].map((x) => String(x).toLowerCase()));
        res = res.filter((r) => !done.has(r.command.toLowerCase()));
      }
      write(o.format === 'json' ? JSON.stringify(res, null, 2) + '\n' : candidatesToMarkdown(res));
      process.stderr.write(`${res.length} commands with candidates\n`);
      return 0;
    }
    case 'render': {
      const mapping = loadMapping(o.mapping);
      const { markdown, warnings } = renderMarkdown(mapping, {
        docsRoot,
        version,
        lang: o.lang,
        floor: o.floor,
        themes: o.themes ? o.themes.split(',').map((s) => s.trim()).filter(Boolean) : null,
        includeDeprecated: o['include-deprecated'],
        showSince: o['show-since'],
      });
      warn(warnings);
      write(markdown);
      return 0;
    }
    case 'site': {
      const mapping = loadMapping(o.mapping);
      const gh = process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}` : null;
      const { files, warnings } = buildSite(mapping, {
        docsRoot,
        version,
        outDir: o.out || 'site',
        floor: o.floor,
        themes: o.themes ? o.themes.split(',').map((s) => s.trim()).filter(Boolean) : null,
        includeDeprecated: o['include-deprecated'],
        repoUrl: o['repo-url'] || gh || DEFAULT_REPO_URL,
        docsRepo: o['docs-repo'],
      });
      warn(warnings);
      files.forEach((f) => {
        const rel = path.relative(process.cwd(), f);
        process.stderr.write(`Wrote ${rel.startsWith('..') ? f : rel}\n`);
      });
      return 0;
    }
    case 'coverage':
    case 'diff': {
      const mapping = loadMapping(o.mapping);
      const r = coverageReport(mapping, { docsRoot, version, since: o.since, all: o.all });
      write(o.format === 'json' ? JSON.stringify(r, null, 2) + '\n' : coverageToMarkdown(r));
      r.errors.forEach((e) => process.stderr.write(`error: ${e}\n`));
      warn(r.warnings);
      return r.errors.length || (o.strict && r.warnings.length) ? 1 : 0;
    }
    default:
      process.stderr.write(`Unknown command "${cmd}"\n\n${HELP}`);
      return 2;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  process.stderr.write(`error: ${e.message}\n`);
  process.exitCode = 2;
}
