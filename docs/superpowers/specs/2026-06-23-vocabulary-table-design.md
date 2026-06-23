# Vocabulary Table Design

## Goal

Replace the current vocabulary card list with a compact study table that shows all vocabulary items for the selected level, their learning state, meaning, and an example sentence from the linked verse.

## Problem

The current vocabulary view uses large cards. It wastes vertical space and makes it hard to scan the whole level. It also shows state as a small badge and does not expose the linked example sentence, so the list is not useful as a word table.

## Selected Approach

Use a compact table layout.

Each row represents one vocabulary item. The row includes:

- a narrow state color bar
- Russian lemma or phrase
- forms when available
- meaning or explanation
- first linked example sentence
- state label
- quick actions: drill, known, uncertain, unknown

## State Colors

State color is used for fast scanning, not decoration.

- known: green
- weak or learning: amber
- new or screening: neutral gray
- unknown: red, when the most recent answer was `unknown`
- retired or audit due: muted brown

The scheduler currently stores both uncertain and unknown answers as `weak`. To make the color category honest, this iteration adds `lastAnswer` to progress records when an answer is applied. Existing saved records without `lastAnswer` fall back to their stored state: `known` becomes known, `new` becomes not learned, and `weak` becomes weak review.

## Data Flow

The vocabulary view calls `getInventoryItems` for the selected level and type `vocabulary` by default. It resolves the first linked verse with the existing bundle data. The example sentence comes from `verse.russianText`, with optional `verse.reference` shown in compact muted text. Row display state is derived from `record.lastAnswer` when available and otherwise from `record.state`.

## Layout

Desktop uses a real table for density. Mobile keeps the same information but allows horizontal scrolling rather than dropping the example sentence. This preserves the central requirement that word plus example stay visible in the vocabulary list.

Filters remain above the table but default to vocabulary-only. The type filter can remain for later grammar and expression inspection, but the primary screen title and default content are vocabulary.

## Testing

Add a scheduler test that verifies `lastAnswer` is recorded for known, uncertain, and unknown answers. Add a static test that verifies the vocabulary view contains the table markers and example sentence rendering helper. Run `npm test` and `npm run web:prepare` before deployment.

## Non-Goals

This change does not add search or pagination. Those can be added after the compact table is validated in use.
