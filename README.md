# 4d-classic-to-oop

`c2o` is a command-line tool that builds a Markdown table of the 4D classic language commands that have an
object-oriented equivalent: class functions or properties (`File.setText()`, `EntitySelection.orderBy()`, …) or
commands that return objects (`File`, `Folder`, `New collection`, …). Each row has links to the docs, a classification and a short note.

**Web site:** <https://miyako.github.io/4d-classic-to-oop/> (English) · <https://miyako.github.io/4d-classic-to-oop/ja/> (日本語) · <https://miyako.github.io/4d-classic-to-oop/fr/> (Français).
The site has search, filters, sortable columns, and is rebuilt from the upstream docs on every push to `main`.

Sample output (latest docs): [`output/classic-to-oop.md`](output/classic-to-oop.md) (English) · [`output/classic-to-oop.ja.md`](output/classic-to-oop.ja.md) (日本語) · [`output/classic-to-oop.fr.md`](output/classic-to-oop.fr.md) (Français).

## Why this tool exists

4D developers moving classic code to the OOP / ORDA APIs need a reliable list of which classic commands have a modern equivalent,
and how hard each replacement is. The original requirements were:

* A table of every classic command with a credible OOP equivalent. Each row links the classic command and the OOP target(s) to developer.4d.com.
  Each row also has a classification (**Drop-in** / **Refactor** / **Partial**) and a one-sentence note. ORDA mappings go in a separate table.
* Generated from the official docs sources (a local, read-only clone), not written by hand. It must be repeatable for any docs version
  (`--docs-version`), language (`--lang en|ja|fr`), minimum 4D release (`--floor`) and theme selection (`--themes`).
* A curated, reviewable `mapping.yaml` as the source of truth. The first draft was AI-assisted, and every entry stays `reviewed: false` until a human checks it.
* A coverage/diff report so the mapping can be kept current when new 4D releases add classes or functions.

## How it works

```
4D docs clone (read-only) ──extract──▶ catalog (commands + class members, with History "addedIn")
                                 │
                                 ├─candidates──▶ heuristic proposals (to help curate)
mapping.yaml (curated) ──────────┼─render──────▶ Markdown table (general + ORDA sections), en, ja or fr
data/command-names.fr.json ──────┤  (French classic command names, imported from the 4D app)
                                 ├─site────────▶ static web site (en + ja + fr) + data.json → GitHub Pages
                                 └─coverage────▶ what is not covered yet / invalid targets / missing note_ja, note_fr
```

* **extract** parses the [4D docs](https://github.com/4D/docs) Docusaurus sources:
  * Commands: every page with a `/commands/<id>` slug (`docs/language-legacy/<Theme>/*.md`, `commands/`, `commands-legacy/`).
    Each command gets a name, theme, URL, `addedIn` (from its History table), a deprecation flag (heuristic) and a summary (`<!--REF #_command_.X.Summary-->`).
  * Class members: `API/*Class.md` member tables (`[<!-- INCLUDE #key.Syntax -->](#anchor)`). The member's
    History/summary is resolved from the section that defines it (including the shared `Document.md`/`Directory.md`/`Transporter.md` pages).
    Class names come from `preprocessing.conf` (`FileClass` → `File`).
  * Release ordering follows 4D numbering: `18 < 18 R2 < … < 18 R6 < 19 < 19 R2 < … < 20 R10 < 21 < 21 R2`.
* **candidates** suggests OOP targets for each command from theme → class rules ([`src/rules.js`](src/rules.js)), cross-links in both directions
  (a command page linking to a class member, or a class member linking to a command) and name similarity.
* **mapping.yaml** is the curated source of truth (see below).
* **render** combines `mapping.yaml` with the catalog of the requested docs version and language.
  With `--lang ja` it uses `note_ja`, Japanese theme names from the ja `commands/theme` index pages, and Japanese classification labels.
  The labels are そのまま置換 (Drop-in), リファクタリング要 (Refactor) and 部分的 (Partial).
  Links point to `https://developer.4d.com/docs/ja/...`.
  With `--lang fr` it uses `note_fr`, French theme names, the labels Remplacement direct / Refactorisation / Partiel, and links to
  `https://developer.4d.com/docs/fr/...`. Classic commands are shown under their **French name**, followed by the English name in small
  (`[TEXTE VERS DOCUMENT](…) <sub>TEXT TO DOCUMENT</sub>`); the same applies to object-returning commands used as targets
  (`Créer collection`, `Fichier`, `Dossier`). Class names, functions and properties are the same in every language.
  See [French command names](#french-command-names).
* **site** builds the same rows as a static web page (see [Web site](#web-site-github-pages)).
* **coverage** (alias **diff**) lists commands that have candidates but are neither mapped nor ignored, plus class members
  that no mapping references. It also checks that every target exists in the selected docs version, so it can run in CI.

The docs clone is only ever read.

## Install

Requires Node.js ≥ 18.

```sh
npm install
export C2O_DOCS_ROOT=/path/to/4D/docs     # or pass --docs-root every time (default: ../docs)
```

## Usage

```sh
# Markdown table (stdout or --out)
node bin/c2o.js render --out output/classic-to-oop.md
node bin/c2o.js render --floor "19 R7"                 # only OOP targets available in 4D 19 R7 or earlier
node bin/c2o.js render --lang ja --out output/classic-to-oop.ja.md   # Japanese notes, themes and labels
node bin/c2o.js render --docs-version 21 --lang ja     # links to https://developer.4d.com/docs/ja/21/...
node bin/c2o.js render --lang fr --out output/classic-to-oop.fr.md   # French command names, notes, themes and labels
node bin/c2o.js render --themes "System Documents,BLOB" --show-since
node bin/c2o.js render --include-deprecated
npm run sample                                         # regenerate the three output/*.md files (en, ja, fr)

# Web site (site/index.html, site/ja/index.html, site/fr/index.html, data.json)
node bin/c2o.js site --out site [--floor "20"] [--docs-version 21]

# Maintenance
node bin/c2o.js coverage                               # Markdown report; exit code 1 if a target is invalid
node bin/c2o.js coverage --since "21 R2"               # also list what was added after 21 R2
node bin/c2o.js coverage --docs-version 20 --format json
node bin/c2o.js candidates --out build/candidates.md   # proposals for commands not yet in mapping.yaml (--all for every command)
node bin/c2o.js extract --docs-version 21-R3 --out build/catalog.json
node bin/c2o.js versions
node bin/c2o.js import-names --xlf "/Applications/4D 21 R4/4D.app/Contents/Resources/fr.lproj/4D_CommandsFR.xlf"   # refresh French command names
```

| Option | Commands | Description |
|---|---|---|
| `--docs-root <dir>` | all | Path to the 4D docs clone (default: `$C2O_DOCS_ROOT`, then `../docs`) |
| `--docs-version <v>` | all | `latest` (default) or a version from `versions.json` (`21-R4`, `21-R3`, `21`, `20`, `19`, `18`). The catalog is built from that version and links use `/docs/<v>/`. |
| `--lang <en\|ja\|fr>` | all | Link language (`/docs/ja/...`, `/docs/fr/...`), localized summaries/headers/themes, `note_ja` / `note_fr`; fr also uses French command names |
| `--floor <release>` | render, site | Drop OOP targets added after `<release>`, then drop commands that have no target left |
| `--themes <a,b>` | render, site | Only include these command themes |
| `--include-deprecated` | render, site | Include commands flagged deprecated (detected heuristically or set with `deprecated:` in the mapping) |
| `--show-since` | render | Show the release each OOP target was added in |
| `--since <release>` | coverage | List commands and members added after `<release>` and whether they are mapped |
| `--all` | coverage, candidates | Coverage: list every untriaged command in OOP-related themes and members of all classes. Candidates: include commands already in `mapping.yaml` |
| `--strict` | coverage | Return a non-zero exit code on warnings too |
| `--format <md\|json>` | coverage, candidates | Output format |
| `--mapping <file>` | render, coverage, candidates | Mapping file (default: `mapping.yaml`) |
| `--out <file>` | all | Write to a file instead of stdout (`site`: output folder, default `site`) |
| `--repo-url <url>` | site | Link back to this repository (default: from `$GITHUB_REPOSITORY`, else this repo) |
| `--docs-repo <owner/name>` | site | Docs repository used to link the docs commit (default `doc4d/docs`) |
| `--xlf <file>` | import-names | `4D_Commands<LANG>.xlf` from a 4D application's `Resources/<lang>.lproj` |
| `--lang <fr>` / `--source <text>` / `--out <file>` | import-names | Target language (default `fr`), provenance recorded in the JSON, output file (default `data/command-names.<lang>.json`) |

Notes on docs versions:

* Versions 18, 19 and 20 of the docs have no command pages, so command links point to the latest docs and the tool prints a warning.
  Version 18 has no class pages either.
* If a target was added after the selected docs version (for example `File.open()`, added in 19 R7, with `--docs-version 19`), render drops it
  without a warning, and coverage lists it under "Targets added after docs version".
* Japanese and French pages live under `https://developer.4d.com/docs/ja/` and `/docs/fr/` (for example `/docs/fr/21/API/FileClass`).
  `https://developer.4d.com/ja/docs/...` returns 404.
* The local clone can be ahead of the website. For example, `21-R4` may already exist locally before https://developer.4d.com/docs/21-R4/ is published.

## mapping.yaml

```yaml
schema: 1
ignore:                     # reviewed: no OOP equivalent (or already an OOP command)
  - CLOSE DOCUMENT
mappings:
  - command: TEXT TO DOCUMENT          # docs title of the classic command
    targets: [File.setText()]          # Class.function(), Class.property, 4D.Class.new(), command:Name
    classification: Drop-in            # Drop-in | Refactor | Partial
    note: Writes text to a file in one call; charset and line-break mode are parameters.
    note_ja: 一度の呼び出しでテキストをファイルに書き込みます。  # required: coverage warns when missing
    note_fr: Écrit du texte dans un fichier en un seul appel.   # required: coverage warns when missing
    orda: false                        # optional: force section (default: ORDA themes / ORDA classes)
    deprecated: false                  # optional: override the detected flag
    reviewed: false                    # rendered with † until reviewed
```

Classifications:

* **Drop-in**: a 1:1 replacement with the same semantics (`TEXT TO DOCUMENT` → `File.setText()`).
* **Refactor**: an equivalent feature with a different model, such as document reference → `FileHandle` (`SEND PACKET` → `FileHandle.writeText()`),
  arrays → collections, or current selection → entity selection.
* **Partial**: the OOP API covers only part of the command.

Mappings whose command belongs to an ORDA theme (Records, Queries, Selection, Sets, Named Selections, Relations, Record Locking, Transactions, …)
or that target ORDA classes are rendered in a separate **ORDA** table.

The current file is an **AI-assisted first draft**: every entry has `reviewed: false`, so rendered rows carry a † marker.
To review an entry, check it, edit it if needed and set `reviewed: true`.

### Keeping it current for a new 4D release

1. Update the docs clone (`git pull`).
2. Run `node bin/c2o.js coverage --since "<previous release>"` and look at the following. Every new entry needs a `note_ja` and a `note_fr`;
   coverage warns `missing note_ja` / `missing note_fr` otherwise.
   * **Errors**: targets that were renamed or removed.
   * **Commands with OOP candidates not in mapping.yaml**: add each one to `mappings` or `ignore`.
   * **New since …** and **Class members not referenced**: new APIs that may replace classic commands.
3. If a new 4D version is installed, refresh the French command names (see below).
4. Regenerate the samples: `npm run sample`.

### French command names

4D classic commands have official French names (used when 4D runs in French), but the French docs keep the English titles.
The names therefore come from the 4D application itself: `4D.app/Contents/Resources/fr.lproj/4D_CommandsFR.xlf`
(group `STR#8`, where each `trans-unit id` is the command number). `c2o import-names` converts it to
[`data/command-names.fr.json`](data/command-names.fr.json) (committed, one command per line), which records its source (currently 4D 21 R4).

* Commands are matched by **command number** (the `Command number` row of each docs page), then by English name, so commands renamed
  in English (for example `Get last query plan` → `Last query plan`) still get their French name.
* Commands without a French name (newer commands are not localized, and database methods) are shown in English.
* To refresh after a new 4D release:
  `node bin/c2o.js import-names --xlf "/Applications/4D <version>/4D.app/Contents/Resources/fr.lproj/4D_CommandsFR.xlf"`,
  then `npm run sample` and review the diff.

## Web site (GitHub Pages)

`node bin/c2o.js site --out site` writes a dependency-free static site:

* `site/index.html`, `site/ja/index.html` and `site/fr/index.html`, with all CSS/JS inline and no CDN.
* `site/data.json`, `site/ja/data.json` and `site/fr/data.json`, with the same rows for reuse
  (`command` is the English name; `commandLocal` / target `localLabel` hold the French names).

The pages have:

* a language switcher (English / 日本語 / Français) that keeps the current filters;
* text search (in French, both the French and the English command names match);
* theme, classification, General/ORDA and "unreviewed only" filters (kept in the URL query string);
* sortable columns;
* colored classification badges and a † marker on unreviewed entries;
* light/dark mode: follows the system setting by default, and a toggle cycles Auto → Light → Dark (the choice is saved in `localStorage`);
* the generation metadata: docs version, floor, date and the docs commit.

Deployment is done by [`.github/workflows/pages.yml`](.github/workflows/pages.yml):

* It runs on every push to `main`, or manually via **Actions → Pages → Run workflow**.
  A manual run can override `docs_repo` (default `doc4d/docs`), `docs_ref`, `docs_version` and `floor`.
* It checks out this repo plus a shallow, sparse (Markdown-only) checkout of the docs.
* It then runs `npm ci`, `npm test` and `coverage` (invalid targets fail the build), builds the site and deploys it with `actions/deploy-pages`.
* Pages is configured with source "GitHub Actions".

To preview locally: `npm run site && (cd site && python3 -m http.server 8000)` and open <http://localhost:8000/>.

## Process / maintenance

The full step-by-step process is in [`AGENTS.md`](AGENTS.md); [`.github/copilot-instructions.md`](.github/copilot-instructions.md) summarizes it.
Humans and AI agents should both follow it. It covers:

* the design decisions and hard rules (read-only docs clone; only humans set `reviewed: true`);
* playbooks: regenerating the table, handling a new 4D release, applying review feedback, adding theme rules, fixing coverage errors;
* a classification decision tree;
* the definition of done.

## Development

```sh
npm test          # node:test: release parsing/ordering, markdown parsing, extraction/render/coverage on fixtures
```

Code layout: `src/release.js` (4D release parsing), `src/markdown.js` (front matter, History, REF blocks),
`src/extract.js` (catalog), `src/rules.js` and `src/candidates.js` (heuristics), `src/mapping.js`, `src/render.js`, `src/coverage.js`, `src/site.js` (static site), `bin/c2o.js` (CLI).
