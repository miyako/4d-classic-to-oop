# AGENTS.md: instructions for AI agents working on this repo

Read this file before changing anything. Follow the playbooks exactly. Do not redesign the tool.

## 1. Purpose

This repo builds a mapping of the 4D *classic* language commands that have an *OOP* equivalent. It publishes it as Markdown (en + ja + fr) and as a web site. The mapping is a table of the 4D *classic* language commands that have an *OOP* equivalent, with:

- doc links
- a classification (Drop-in / Refactor / Partial)
- a one-sentence note, in English (`note`), Japanese (`note_ja`) and French (`note_fr`)
- in French: the classic command under its official **French name**, with the English name in small

Outputs:

- `output/classic-to-oop.md` (en)
- `output/classic-to-oop.ja.md` (ja)
- `output/classic-to-oop.fr.md` (fr)
- the site <https://miyako.github.io/4d-classic-to-oop/> (built into `site/`, which is git-ignored, and deployed by `.github/workflows/pages.yml`)

Pipeline (CLI `node bin/c2o.js <cmd>`):

| Step | Command | What it does |
|---|---|---|
| 1 | `extract` | Parses the 4D docs clone into a catalog. Commands: name, theme, url, addedIn, deprecated, summary. Class members: class, member, kind, url, addedIn. |
| 2 | `candidates` | Heuristic proposals: theme→class rules in `src/rules.js`, doc cross-links, name similarity. Only used to help curate. |
| 3 | `mapping.yaml` | **Curated source of truth.** Edited by hand (or by you, following the rules below). |
| 4 | `render` | Turns `mapping.yaml` + catalog into Markdown (General table + separate ORDA table). |
| 5 | `coverage` (alias `diff`) | Lists docs items not yet covered and validates every target. Exit 1 on errors. Warns `missing note_ja` / `missing note_fr`. |
| 6 | `site` | Static single-page site: `site/index.html` + `site/ja/index.html` + `site/fr/index.html` + `data.json`. Same rows as `render`. |
| – | `import-names` | Imports the French classic command names from a 4D app (`4D_CommandsFR.xlf`) into `data/command-names.fr.json`. Run only when a new 4D version is installed (playbook f). |

## 2. Hard rules (never break these)

1. **The docs clone is READ-ONLY.** Never write, delete, `git checkout`, or `git reset` anything inside it. You may only run `git pull` there when a playbook says so.
   - Its path comes from `--docs-root` or `$C2O_DOCS_ROOT` (default `../docs`).
2. **`mapping.yaml` is the source of truth.** Never hand-edit `output/*.md` or `site/`; always regenerate them (`npm run sample`, `npm run site`).
3. **Never set `reviewed: true`.** Only a human does that. Every entry you add or change gets `reviewed: false`.
   - If you substantively change a `reviewed: true` entry, set it back to `false`. This covers `targets`, `classification` and `note`.
   - Do this only when the human asked for the change.
4. **Never delete an entry that has `reviewed: true`.** Never move one to `ignore`. Ask the human instead.
5. **`note` is ONE sentence**, plain English, ≤ ~160 characters, with no trailing list.
   - **`note_ja` is MANDATORY** for every entry that has a `note`: the same content as one natural Japanese sentence.
   - Rules for `note_ja`:
     - Keep command/class/function/property names in English as-is (`File.open()`, `FileHandle`, `QUERY`).
     - Use the 4D Japanese doc terminology (look it up in `i18n/ja/docusaurus-plugin-content-docs/current`): エンティティセレクション, カレントセレクション, カレントレコード, ドキュメント参照, コレクション, 配列, `FileHandle` オブジェクト, データクラス, データストア, プライマリーキー, オプティミスティックロック / ペシミスティックロック, 命名セレクション, 共有オブジェクト, 文字セット, 改行モード, HTTP リクエストハンドラー, スケーラブルセッション, フォーミュラオブジェクト.
     - End with 「。」 and use the です/ます style.
   - **`note_fr` is MANDATORY** too: the same content as one natural French sentence.
   - Rules for `note_fr`:
     - Keep class/function/property names in English (`File.open()`, `FileHandle`, `EntitySelection.orderBy()`).
     - **Classic commands mentioned in the note use their French name** (look it up in `data/command-names.fr.json`): `Créer collection` (New collection), `Fichier(...)` / `Dossier(...)` (File / Folder), `Formule sur chaîne` (Formula from string), `WEB Serveur` (WEB Server), `UTILISER ENTITY SELECTION`, `CRYPTER BLOB`, `RÉGLER SÉRIE` (SET CHANNEL), `Pour chaque` (For each). Unchanged: `JSON Parse`, `JSON Stringify`, `Storage`, `Session`, `HTTP Request`.
     - Use the 4D French doc terminology (`i18n/fr/docusaurus-plugin-content-docs/current`): entity selection (kept in English, feminine: « une entity selection »), sélection courante, enregistrement courant, référence de document, tableau, collection, clé primaire, verrouillage optimiste / pessimiste, objet partagé, jeu de caractères, fin de ligne, sélection temporaire, ensemble, dataclass, datastore, entité, objet formule, variable process, sessions évolutives, gestionnaire de requêtes HTTP, alterable / partageable.
     - French typography: a space before `;` and `:`; vouvoiement / imperative (« Utilisez… », « Passez… »).
   - When you change `note`, update `note_ja` and `note_fr` in the same edit.
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
- With `--lang ja`:
  - Notes come from `note_ja`.
  - Themes come from the ja `commands/theme` index pages; if a theme has none, its English name is used.
  - Classifications are shown as そのまま置換 / リファクタリング要 / 部分的. The YAML values stay `Drop-in|Refactor|Partial`.
  - Links use `https://developer.4d.com/docs/ja/...`. Never `/ja/docs/`, which returns 404.
- With `--lang fr`:
  - Notes come from `note_fr`; themes from the fr `commands/theme` pages; classifications are Remplacement direct / Refactorisation / Partiel.
  - Classic commands (and `command:` targets) are shown as `[NOM FRANÇAIS](url) <sub>ENGLISH NAME</sub>`, using `data/command-names.fr.json`. Commands without a French name stay in English. Class members are never translated.
  - Links use `https://developer.4d.com/docs/fr/...`.
- The canonical samples come from `npm run sample` (latest → `output/classic-to-oop.md`, `.ja.md` and `.fr.md`). Only commit other outputs if the human asks.

### (a2) Rebuild / deploy the web site

- Local build: `npm run site` (= `node bin/c2o.js site --out site`). It accepts `--floor`, `--docs-version`, `--themes`, `--include-deprecated`.
  - Expected stderr: `Wrote site/index.html`, `site/data.json`, `site/ja/index.html`, `site/ja/data.json`, `site/fr/index.html`, `site/fr/data.json`.
  - `site/` is git-ignored. Never commit it.
- Local preview: `(cd site && python3 -m http.server 8000)`, then:
  - `curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/ja/` and `…/fr/` → `200`.
  - Open the page and check for no console errors. Search, filters and sort must work.
- Deploy: merging to `main` triggers `.github/workflows/pages.yml` (test → coverage → site → deploy-pages).
  - To publish with other parameters, run it manually: **Actions → Pages → Run workflow**.
  - Manual inputs: `docs_repo` (default `doc4d/docs`), `docs_ref`, `docs_version`, `floor`.
  - CLI equivalent: `gh workflow run pages.yml -f docs_version=21 -f floor="20 R2"`.
- If the deploy fails on `coverage`, fix the mapping (playbook e). Upstream `doc4d/docs` can be ahead of your local clone.
- Do not change the site to use frameworks, CDNs or Jekyll. It is a single dependency-free page by design.

### (b) New 4D release

1. `git -C "$C2O_DOCS_ROOT" pull`. This is the only write allowed in the docs clone.
2. `node bin/c2o.js versions`. Note any new version.
3. `node bin/c2o.js coverage --since "<previous release>" --out build/coverage.md`. Read these sections in this order:
   1. `## Errors`: fix them first (playbook e).
   2. `## Commands with OOP candidates not in mapping.yaml`: for each command, apply the decision tree. Add it to `mappings:` with `reviewed: false` **and `note`, `note_ja` and `note_fr`**, or add it to `ignore:`.
   3. `## New since <release>` → `### Members`: new OOP APIs. For each one, search the docs for the classic command it replaces. If there is one, add or extend a mapping (append to `targets`).
   4. `## Class members not referenced by any mapping`: same as above, but optional. Many members legitimately have no classic counterpart; leave them.
4. Optional help: `node bin/c2o.js candidates --out build/candidates.md` lists scored target suggestions per untriaged command.
   - Verify each suggestion by reading the docs pages. Never copy a suggestion blindly.
5. Validate:
   - `node bin/c2o.js coverage` exits 0 and shows `## Errors (0)`.
   - `## Commands with OOP candidates not in mapping.yaml (0)`.
   - No `missing note_ja` / `missing note_fr` warning on stderr.
6. If the release ships a new 4D application, refresh the French command names (playbook f).
7. `npm test`, then `npm run sample` (en + ja + fr) and `npm run site` (build check only).
8. Commit (see §7).

New entries go next to the existing ones of the same theme (the file is grouped by `# --- Theme ---` comments). Template:

```yaml
  - command: TEXT TO DOCUMENT
    targets: [File.setText()]
    classification: Drop-in
    note: Writes text to a file in one call; charset and line-break mode are parameters.
    note_ja: "任意の文字セットと改行モードを指定して、1 回の呼び出しでテキストをファイルに書き込みます。"
    note_fr: "Écrit du texte dans un fichier en un seul appel, avec jeu de caractères et mode de fin de ligne facultatifs."
    reviewed: false
```

### (c) Apply a human's review feedback

1. For each point, edit only the entry concerned:
   - `targets`, `classification`, `note` + `note_ja` + `note_fr` (always keep all three in sync), `orda`, `deprecated`
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
| `X: missing note_ja (Japanese translation of note)` (warning) | New/changed entry without Japanese | Add `note_ja` (rule 5). |
| `X: missing note_fr (French translation of note)` (warning) | New/changed entry without French | Add `note_fr` (rule 5). |

Listed under "Targets added after docs version" → **not an error** (the target is newer than that version, and render drops it).

### (f) Refresh the French command names (new 4D version installed)

The French docs keep English command titles, so French names come from the 4D application, not from the docs.

1. `node bin/c2o.js import-names --xlf "/Applications/4D <version>/4D.app/Contents/Resources/fr.lproj/4D_CommandsFR.xlf"`
   - Expected stderr: `Wrote …/data/command-names.fr.json (<N> command names, fr)` with N ≈ 1430 or more.
   - The file records its `source` (e.g. `4D 21 R4 4D_CommandsFR.xlf`). Never edit it by hand.
2. `git diff data/command-names.fr.json`: expect only additions or a few renamed entries. If hundreds of lines change, stop and ask the human.
3. `npm run sample`, then check `output/classic-to-oop.fr.md`: mapped commands show a French name except new, non-localized commands.
4. Commit as `data: import French command names from 4D <version>`.

Matching is by command number (`| Command number | N |` in each docs page), then by English name. Do not "fix" a French name that looks outdated: it is what 4D accepts in French mode.

## 6. Known caveats

- **Deprecation** is heuristic (`_o_` titles, deprecated History rows, deprecation sentences near the top). Most deprecated commands are not flagged. Use `deprecated:` in mapping.yaml to override.
- **Docs versions 18/19/20 have no command pages.** Command links fall back to the latest docs, with a warning. Version 18 has no class pages either.
- **Version 21** uses `commands/` + `commands-legacy/` without slugs. This is already handled in `src/extract.js`.
- **The local clone can be ahead of the website.** A version that exists locally (e.g. `21-R4` at the time of writing) may return 404 on developer.4d.com until it is published. Check with `curl -sI https://developer.4d.com/docs/<v>/` before publishing links for a new version.
- Members without their own History inherit the class History or the earliest release in the class (`addedInInferred: true` in the catalog).
- The `ja` / `fr` outputs use the English catalog with localized summaries, theme names and links overlaid.
- **French command names** come from the 4D app XLIFF (currently 4D 21 R4), not the docs. Commands added after that version, commands 4D no longer localizes (recent ones such as `Trim`, `throw`) and database methods fall back to English.
- Some docs summary tables link a member to the wrong anchor (e.g. `findIndex` → `#find`). The extractor prefers the member's own section heading when it is on the same page.
- The upstream docs repo is **`doc4d/docs`** (the local clone may be a fork such as `EmikoToda/docs`). The Pages workflow clones upstream, so its results can differ slightly from your local run.

## 7. Definition of done

- [ ] `npm test` passes (`ℹ fail 0`).
- [ ] `node bin/c2o.js coverage` exits 0 (`## Errors (0)`) for `latest`.
- [ ] `node bin/c2o.js coverage --docs-version <v>` exits 0 for every docs version the task mentions.
- [ ] `npm run sample` was run, and `output/classic-to-oop.md`, `.ja.md` and `.fr.md` are committed with the changes.
- [ ] `coverage` prints no `missing note_ja` / `missing note_fr` warning. Every entry has `note`, `note_ja` and `note_fr`.
- [ ] `npm run site` succeeds; `site/` itself is not committed. If `src/site.js` changed, preview locally (playbook a2) with no JS console errors.
- [ ] Every new or changed mapping entry has `reviewed: false`, unless the human approved it explicitly.
- [ ] Nothing changed in the docs clone (`git -C "$C2O_DOCS_ROOT" status` is clean apart from your `pull`).
- [ ] Commits are small and prefixed:
  - `mapping:` (mapping.yaml changes)
  - `data:` (data/command-names.*.json)
  - `rules:` (heuristics)
  - `extract:` / `render:` / `coverage:` / `site:` (code)
  - `ci:` (workflow)
  - `docs:` (README/AGENTS)
  - `output:` (sample only)
  - Body: what changed and why.
  - Include the `Co-authored-by` trailer if your environment requires it.
- [ ] Open a PR against `main`. Its description lists the entries added or changed and states that they are `reviewed: false`.
