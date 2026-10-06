# Copilot instructions

**Read [`AGENTS.md`](../AGENTS.md) first and follow its playbooks exactly.** It has the full design, playbooks and definition of done.

Summary:

- This repo generates `output/classic-to-oop.md`, `.ja.md` and `.fr.md`, plus the GitHub Pages site (`c2o site`, deployed by `.github/workflows/pages.yml`): 4D classic commands → OOP equivalents.
  - Classifications: `Drop-in` (same semantics), `Refactor` (different model, e.g. document ref → FileHandle, arrays → collections, selection → entity selection), `Partial` (covers part).
  - ORDA rows go in a separate table.
- French output shows classic commands under their official French name (from `data/command-names.fr.json`, imported from the 4D app with `c2o import-names`) with the English name in small; classes/functions are never translated.
- CLI: `node bin/c2o.js extract | candidates | render | coverage | site | import-names`. Docs path: `--docs-root` or `$C2O_DOCS_ROOT`.
- Hard rules:
  - The 4D docs clone is **read-only**.
  - `mapping.yaml` is the source of truth; never hand-edit `output/`.
  - **Never set `reviewed: true`** unless a human explicitly approves that entry.
  - Never delete reviewed entries.
  - Notes are one sentence, and every entry needs `note` (en), `note_ja` (ja, 4D Japanese doc terminology) and `note_fr` (fr, French command names + 4D French terminology).
  - Only credible equivalents; otherwise use `ignore:`.
- Target IDs: `Class.fn()`, `Class.prop`, `4D.Class.new()`, `command:Name`.
- Done means:
  - `npm test` passes.
  - `node bin/c2o.js coverage` exits 0 (latest + requested versions).
  - `npm run sample` is regenerated (en + ja + fr).
  - `npm run site` builds.
  - Commits are prefixed `mapping:` / `rules:` / `docs:` / …
  - A PR to `main` is open.
