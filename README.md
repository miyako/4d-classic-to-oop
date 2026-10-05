# 4d-classic-to-oop

`c2o` is a command-line tool that builds a Markdown table of the 4D classic language commands that have an
object-oriented equivalent: class functions or properties (`File.setText()`, `EntitySelection.orderBy()`, …) or
commands that return objects (`File`, `Folder`, `New collection`, …). Each row has links to the docs, a classification and a short note.

Sample output (latest docs, English): [`output/classic-to-oop.md`](output/classic-to-oop.md).

## How it works

```
4D docs clone (read-only) ──extract──▶ catalog (commands + class members, with History "addedIn")
                                 │
                                 ├─candidates──▶ heuristic proposals (to help curate)
mapping.yaml (curated) ──────────┼─render──────▶ Markdown table (general + ORDA sections)
                                 └─coverage────▶ what is not covered yet / invalid targets
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
node bin/c2o.js render --docs-version 21 --lang ja     # links to https://developer.4d.com/docs/ja/21/...
node bin/c2o.js render --themes "System Documents,BLOB" --show-since
node bin/c2o.js render --include-deprecated

# Maintenance
node bin/c2o.js coverage                               # Markdown report; exit code 1 if a target is invalid
node bin/c2o.js coverage --since "21 R2"               # also list what was added after 21 R2
node bin/c2o.js coverage --docs-version 20 --format json
node bin/c2o.js candidates --out build/candidates.md   # proposals for commands not yet in mapping.yaml (--all for every command)
node bin/c2o.js extract --docs-version 21-R3 --out build/catalog.json
node bin/c2o.js versions
```

| Option | Commands | Description |
|---|---|---|
| `--docs-root <dir>` | all | Path to the 4D docs clone (default: `$C2O_DOCS_ROOT`, then `../docs`) |
| `--docs-version <v>` | all | `latest` (default) or a version from `versions.json` (`21-R4`, `21-R3`, `21`, `20`, `19`, `18`). The catalog is built from that version and links use `/docs/<v>/`. |
| `--lang <en\|ja>` | all | Link language (`/docs/ja/...`), Japanese summaries/headers, `note_ja` when present |
| `--floor <release>` | render | Drop OOP targets added after `<release>`, then drop commands that have no target left |
| `--themes <a,b>` | render | Only include these command themes |
| `--include-deprecated` | render | Include commands flagged deprecated (detected heuristically or set with `deprecated:` in the mapping) |
| `--show-since` | render | Show the release each OOP target was added in |
| `--since <release>` | coverage | List commands and members added after `<release>` and whether they are mapped |
| `--all` | coverage, candidates | Coverage: list every untriaged command in OOP-related themes and members of all classes. Candidates: include commands already in `mapping.yaml` |
| `--strict` | coverage | Return a non-zero exit code on warnings too |
| `--format <md\|json>` | coverage, candidates | Output format |
| `--mapping <file>` | render, coverage, candidates | Mapping file (default: `mapping.yaml`) |
| `--out <file>` | all | Write to a file instead of stdout |

Notes on docs versions:

* Versions 18, 19 and 20 of the docs have no command pages, so command links point to the latest docs and the tool prints a warning.
  Version 18 has no class pages either.
* If a target was added after the selected docs version (for example `File.open()`, added in 19 R7, with `--docs-version 19`), render drops it
  without a warning, and coverage lists it under "Targets added after docs version".
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
    note_ja: ...                       # optional
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
2. Run `node bin/c2o.js coverage --since "<previous release>"` and look at:
   * **Errors**: targets that were renamed or removed.
   * **Commands with OOP candidates not in mapping.yaml**: add each one to `mappings` or `ignore`.
   * **New since …** and **Class members not referenced**: new APIs that may replace classic commands.
3. Regenerate the sample: `npm run sample`.

## Development

```sh
npm test          # node:test: release parsing/ordering, markdown parsing, extraction/render/coverage on fixtures
```

Code layout: `src/release.js` (4D release parsing), `src/markdown.js` (front matter, History, REF blocks),
`src/extract.js` (catalog), `src/rules.js` and `src/candidates.js` (heuristics), `src/mapping.js`, `src/render.js`, `src/coverage.js`, `bin/c2o.js` (CLI).
