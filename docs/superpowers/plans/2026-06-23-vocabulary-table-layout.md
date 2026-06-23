# Vocabulary Table Layout Implementation Plan

Goal: replace the low-density vocabulary cards with a compact table that shows every vocabulary item for the selected level, its status color, meaning, and linked example sentence.

Architecture: keep vocabulary rendering in `src/app.js`, keep answer persistence in `src/scheduler.js`, and style the table in `src/styles.css`. Preserve the existing single-page app and IndexedDB state model, adding only `lastAnswer` as an optional progress field.

Tech Stack: vanilla JavaScript, CSS, Node test runner, GitHub Pages static deployment.

---

## Task 1: Persist answer category

Files: `src/scheduler.js`, `tests/scheduler.study.test.js`

Test first: add an assertion that `applyScreeningAnswer` records `lastAnswer` as `known`, `uncertain`, or `unknown`.

Expected red result: test fails because `lastAnswer` is absent.

Implementation: set `lastAnswer` on each progress record during `applyScreeningAnswer` and initialize it as `null` in `createInitialProgress`.

Verification: `npm test tests/scheduler.study.test.js`.

## Task 2: Render compact vocabulary table

Files: `src/app.js`, `tests/static.test.js`

Test first: assert the app source contains `renderVocabularyRow`, `getItemExample`, `vocabulary-table`, and the sentence example marker.

Expected red result: test fails because the current view renders `inventory-grid` cards.

Implementation: make vocabulary view default to vocabulary-only, replace card rendering with a table, and resolve the first linked verse for the example sentence.

Verification: `npm test tests/static.test.js`.

## Task 3: Style the table for dense scanning

Files: `src/styles.css`, `tests/static.test.js`

Test first: assert CSS contains `vocabulary-table-wrap`, `vocab-state-bar`, and color classes for known, unknown, not learned, and weak.

Expected red result: test fails because current CSS only has card styles.

Implementation: add table wrapper, compact cell spacing, state color bar, horizontal mobile overflow, and concise row actions.

Verification: `npm test tests/static.test.js`.

## Task 4: Verify and deploy

Files: static output from `npm run web:prepare`

Verification: run `npm test`, run `npm run web:prepare`, commit focused changes, push to `main`, then confirm GitHub Pages contains `renderVocabularyRow` and `vocabulary-table`.
