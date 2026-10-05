# AGENTS.md: instructions for AI agents working on this repo

Read this file before changing anything. Follow the playbooks exactly. Do not redesign the tool.

## 1. Purpose

This repo builds **one artifact**: a Markdown table of the 4D *classic* language commands that have an *OOP* equivalent, with:

- doc links
- a classification (Drop-in / Refactor / Partial)
- a one-sentence note

Output: `output/classic-to-oop.md`.

Pipeline (CLI `node bin/c2o.js <cmd>`):

| Step | Command | What it does |
|---|---|---|
| 1 | `extract` | Parses the 4D docs clone into a catalog. Commands: name, theme, url, addedIn, deprecated, summary. Class members: class, member, kind, url, addedIn. |
| 2 | `candidates` | Heuristic proposals: theme→class rules in `src/rules.js`, doc cross-links, name similarity. Only used to help curate. |
| 3 | `mapping.yaml` | **Curated source of truth.** Edited by hand (or by you, following the rules below). |
| 4 | `render` | Turns `mapping.yaml` + catalog into Markdown (General table + separate ORDA table). |
| 5 | `coverage` (alias `diff`) | Lists docs items not yet covered and validates every target. Exit 1 on errors. |

## 2. Hard rules (never break these)

1. **The docs clone is READ-ONLY.** Never write, delete, `git checkout`, or `git reset` anything inside it. You may only run `git pull` there when a playbook says so.
   - Its path comes from `--docs-root` or `$C2O_DOCS_ROOT` (default `../docs`).
2. **`mapping.yaml` is the source of truth.** Never hand-edit `output/*.md`; always regenerate it with `render`.
3. **Never set `reviewed: true`.** Only a human does that. Every entry you add or change gets `reviewed: false`.
   - If you substantively change a `reviewed: true` entry, set it back to `false`. This covers `targets`, `classification` and `note`.
   - Do this only when the human asked for the change.
4. **Never delete an entry that has `reviewed: true`.** Never move one to `ignore`. Ask the human instead.
5. **`note` is ONE sentence**, plain English, ≤ ~160 characters, with no trailing list. `note_ja` is optional, also one sentence.
6. **Only include credible equivalents.** If the OOP API does not really replace the command, put the command in `ignore:`; do not map it.
   - A weak "Partial" is worse than nothing.
7. **Target ID syntax** (exactly one of):
   - `Class.function()`: a function, e.g. `File.setText()`, `EntitySelection.orderBy()`
   - `Class.property`: a property, e.g. `File.size`, `Folder.platformPath` (no parentheses)
   - `4D.Class.new()`: a constructor, e.g. `4D.SystemWorker.new()`, `4D.Blob.new()`
   - `command:Name`: an object-returning / modern command used as the target, e.g. `command:File`, `command:New collection`, `command:JSON Parse`
   - Class names are the docs aliases (`File`, `FileHandle`, `EntitySelection`, `HTTPRequest`, …), not page names (`FileClass`).
   - Command names are the exact docs titles (case-insensitive match).
8. A command appears **at most once**: either in `mappings:` or in `ignore:`, never both. `loadMapping` rejects duplicates.
9. **Do not add dependencies.** The only runtime dependency is `yaml`.

## 3. Design decisions (already agreed; do not revisit)

### Classifications

| Value | Meaning | Examples |
|---|---|---|
| `Drop-in` | 1:1 replacement with the same semantics. You can swap the call and keep the surrounding code. | `TEXT TO DOCUMENT` → `File.setText()`; `Document to text` → `File.getText()`; `COPY DOCUMENT` → `File.copyTo()` |
| `Refactor` | Equivalent feature, **different model**. Surrounding code must change. | `SEND PACKET` → `FileHandle.writeText()` (document ref → FileHandle object); `SORT ARRAY` → `Collection.sort()` (arrays → collections); `ORDER BY` → `EntitySelection.orderBy()` (current selection → entity selection) |
| `Partial` | The OOP API covers only part of the command's features or parameters. | A command with several modes, of which only one exists in OOP |

### Decision tree (apply in order)

1. Is there an OOP API that does the same job? **No** → put the command in `ignore:` and stop.
2. Does it need a different data model? Examples:
   - document reference → `FileHandle`
   - array → collection
   - current selection / set / named selection / record → entity / entity selection
   - process variable → `Signal` / `Storage`
   - **Yes** → `Refactor`.
3. Does it cover every main feature of the command (all common parameters/modes)? **No** → `Partial`.
4. Otherwise → `Drop-in`.

If both "different model" and "partial coverage" apply, use `Partial` and explain the gap in the note.

### Other decisions

- **ORDA mappings go in a separate table.** An entry goes there automatically when its command theme is an ORDA theme (`ORDA_THEMES` in `src/rules.js`) or any target is an ORDA class (`DataStore`, `DataClass`, `Entity`, `EntitySelection`). Force it with `orda: true` or `orda: false`.
- **Modern object-returning commands are valid targets** (`command:File`, `command:Folder`, `command:New collection`, `command:JSON Parse`, `command:HTTP Request`, `command:Session`, `command:Formula`, …).
  - The commands that *are* the modern API themselves belong in `ignore:` as sources.
- `deprecated: true|false` overrides the deprecation flag detected from the docs. Deprecated commands are hidden unless `--include-deprecated` is passed.
- Release ordering is 4D's: `18 < 18 R2 < … < 18 R6 < 19 < 19 R2 < … < 20 R10 < 21 < 21 R2 …` (`src/release.js`).

### Note examples

| Good | Bad (why) |
|---|---|
| `Writes text to a file in one call; charset and line-break mode are parameters.` | `Use File.setText().` (repeats the target, adds nothing) |
| `Use File.open("append") to get a FileHandle positioned at the end of the file instead of a document reference.` | `This is similar but there are many differences such as ... ; also ... ; see docs.` (several clauses, vague) |
| `Only the HTTP GET/POST part is covered; client certificates are set on HTTPAgent.` | `Probably works.` (no information, speculative) |

## 4. Setup (every session)

```sh
cd <this repo>
npm install
export C2O_DOCS_ROOT=/path/to/4D/docs        # e.g. /Users/miyako/.copilot/repos/docs
node bin/c2o.js versions                     # expected: latest, 21-R4, 21-R3, 21, 20, 19, 18 (one per line)
npm test                                     # expected: all tests pass ("ℹ fail 0")
```

Exit codes: `0` = OK, `1` = coverage errors (or warnings with `--strict`), `2` = bad options/docs root.

## 5. Playbooks

### (a) Regenerate the table for given parameters

```sh
node bin/c2o.js render [--floor "<release>"] [--docs-version <v>] [--lang en|ja] [--themes "A,B"] [--include-deprecated] [--show-since] --out output/<name>.md
```

- Release format for `--floor` / `--since`: `"19 R7"`, `"20"`, `"21 R2"` (quote values with spaces).
- `--docs-version` takes a value from `versions`. Use `21-R3` with a hyphen, not `21 R3`.
- Expected stderr: `Wrote output/<name>.md`.
  - With 18/19/20 you also get `warning: docs version "20" has no command pages; command links point to the latest docs`.
  - That warning is normal.
- Check the header line of the output, e.g. `Docs version: \`latest\` · Language: \`en\` · Commands: N (general X, ORDA Y)`.
- The canonical sample is `npm run sample` (latest, en → `output/classic-to-oop.md`). Only commit other outputs if the human asks.

### (b) New 4D release

1. `git -C "$C2O_DOCS_ROOT" pull`. This is the only write allowed in the docs clone.
2. `node bin/c2o.js versions`. Note any new version.
3. `node bin/c2o.js coverage --since "<previous release>" --out build/coverage.md`. Read these sections in this order:
   1. `## Errors`: fix them first (playbook e).
   2. `## Commands with OOP candidates not in mapping.yaml`: for each command, apply the decision tree. Add it to `mappings:` with `reviewed: false`, or add it to `ignore:`.
   3. `## New since <release>` → `### Members`: new OOP APIs. For each one, search the docs for the classic command it replaces. If there is one, add or extend a mapping (append to `targets`).
   4. `## Class members not referenced by any mapping`: same as above, but optional. Many members legitimately have no classic counterpart; leave them.
4. Optional help: `node bin/c2o.js candidates --out build/candidates.md` lists scored target suggestions per untriaged command.
   - Verify each suggestion by reading the docs pages. Never copy a suggestion blindly.
5. Validate:
   - `node bin/c2o.js coverage` exits 0 and shows `## Errors (0)`.
   - `## Commands with OOP candidates not in mapping.yaml (0)`.
6. `npm test`, then `npm run sample`.
7. Commit (see §7).

New entries go next to the existing ones of the same theme (the file is grouped by `# --- Theme ---` comments). Template:

```yaml
  - command: TEXT TO DOCUMENT
    targets: [File.setText()]
    classification: Drop-in
    note: Writes text to a file in one call; charset and line-break mode are parameters.
    reviewed: false
```

### (c) Apply a human's review feedback

1. For each point, edit only the entry concerned:
   - `targets`, `classification`, `note` / `note_ja`, `orda`, `deprecated`
   - or move the command to `ignore:`
2. If the human says an entry is **approved/OK**, you may set `reviewed: true` for exactly that entry. This is the only case where you set `reviewed: true`: on the human's explicit instruction.
3. Do not touch entries the feedback does not mention.
4. Run `node bin/c2o.js coverage` (exit 0), `npm test` and `npm run sample`. Commit as `mapping: apply review feedback (<scope>)`.

### (d) Add a theme→class rule

1. Edit `THEME_RULES` in `src/rules.js`: `'<Theme name as in docs>': ['ClassAlias', ...]`.
   - Use the theme name exactly as shown in the catalog (`node bin/c2o.js extract | grep '"theme"' | sort -u`).
2. If the theme is ORDA-related, also add it to `ORDA_THEMES`. If a new class is ORDA, add it to `ORDA_CLASSES`.
3. Run `node bin/c2o.js candidates --out build/candidates.md`. New candidates for that theme should appear.
4. Then run `coverage`. The theme's commands now show under "Commands with OOP candidates not in mapping.yaml". Triage them as in (b).3.2.
5. `npm test`. Commit as `rules: add <Theme> → <Classes>`.

### (e) Fix a coverage error (missing target)

| Message | Cause | Fix |
|---|---|---|
| `X: target "T" not found in docs version "v"` | Typo, wrong syntax, or member renamed/removed | Find the right ID: `node bin/c2o.js extract --docs-version v \| grep -i '<member>'` (look at `"class"`/`"member"`). Fix the target. If a class was renamed across versions, add the pair to `CLASS_RENAMES` in `src/extract.js` (like Formula↔Function). |
| `unknown command: X` | Command title changed or removed | Find the new title (`extract \| grep -i`). Rename `command:`; if it was removed, ask the human. |
| `ignore: unknown command "X"` (warning) | Same, in `ignore:` | Rename or remove it from `ignore:`. |
| `X: target "T" not documented in docs version "v"` (warning) | Target exists in other versions but not this one | Usually fine for old versions. Leave it unless the human requires `--strict`. |
| `mapping.yaml: … duplicate command` / `classification must be one of` | Schema error | Fix the YAML entry. |

Listed under "Targets added after docs version" → **not an error** (the target is newer than that version, and render drops it).

## 6. Known caveats

- **Deprecation** is heuristic (`_o_` titles, deprecated History rows, deprecation sentences near the top). Most deprecated commands are not flagged. Use `deprecated:` in mapping.yaml to override.
- **Docs versions 18/19/20 have no command pages.** Command links fall back to the latest docs, with a warning. Version 18 has no class pages either.
- **Version 21** uses `commands/` + `commands-legacy/` without slugs. This is already handled in `src/extract.js`.
- **The local clone can be ahead of the website.** A version that exists locally (e.g. `21-R4` at the time of writing) may return 404 on developer.4d.com until it is published. Check with `curl -sI https://developer.4d.com/docs/<v>/` before publishing links for a new version.
- Members without their own History inherit the class History or the earliest release in the class (`addedInInferred: true` in the catalog).
- The `ja` output uses the English catalog with Japanese summaries/links overlaid.

## 7. Definition of done

- [ ] `npm test` passes (`ℹ fail 0`).
- [ ] `node bin/c2o.js coverage` exits 0 (`## Errors (0)`) for `latest`.
- [ ] `node bin/c2o.js coverage --docs-version <v>` exits 0 for every docs version the task mentions.
- [ ] `npm run sample` was run, and `output/classic-to-oop.md` is committed with the changes.
- [ ] Every new or changed mapping entry has `reviewed: false`, unless the human approved it explicitly.
- [ ] Nothing changed in the docs clone (`git -C "$C2O_DOCS_ROOT" status` is clean apart from your `pull`).
- [ ] Commits are small and prefixed:
  - `mapping:` (mapping.yaml changes)
  - `rules:` (heuristics)
  - `extract:` / `render:` / `coverage:` (code)
  - `docs:` (README/AGENTS)
  - `output:` (sample only)
  - Body: what changed and why.
  - Include the `Co-authored-by` trailer if your environment requires it.
- [ ] Open a PR against `main`. Its description lists the entries added or changed and states that they are `reviewed: false`.
