# langtu

Langtu is a browser-based Russian learning app for reading and speaking from the Gospel of John. It is not a generic vocabulary app. Its core design is level-based cumulative vocabulary learning from A0 through C2, with Gospel-of-John verses used as the shared corpus for vocabulary, grammar, expression, comprehension, and text to speech practice.

The public app is intended to be deployable on GitHub Pages. Restricted Bible text, private study bundles, and user progress are not committed to this repository. Each user imports their own private study content into the browser.

## Core Goal

The goal is to help the learner progress from basic Russian recognition to active understanding of the Gospel of John in Russian.

The central learning loop is:

- learn level-based Russian vocabulary from A0 through C2
- use Gospel-of-John verses as the example and test context
- repeatedly study the grammar needed to understand those verses
- repeatedly study reusable expressions from those verses
- avoid wasting time on words and skills the learner already knows
- require vocabulary, grammar, and expression mastery before level advancement

A0 is an internal pre-A1 level, not a formal CEFR level. It is used for very basic words and recognition tasks that may be too easy for many learners but still need quick screening.

## Public App And Private Data

The app code can be public. The study data stays private.

The public GitHub Pages deployment should include:

- app source code
- public documentation
- schemas and validation rules
- tiny artificial fixtures for tests
- no restricted Bible text
- no private user bundle
- no copyrighted audio

The user provides the actual study content after opening the app. The app must process imported content locally in the browser and must not upload it to a backend server.

## Private Study Bundle

The first version uses a single text-only study bundle selected by the user. The bundle can be a JSON file or a ZIP-like container later, but the MVP should avoid audio files.

The bundle should contain:

- Russian Gospel of John text supplied by the user
- optional English Gospel of John text supplied by the user
- verse identifiers
- optional translation alignment metadata
- vocabulary entries from A0 through C2
- grammar skill entries by level
- expression skill entries by level
- links from vocabulary to verses
- links from grammar skills to verses
- links from expression skills to verses
- English notes for grammar and expressions
- initial scheduling metadata when useful

The bundle should not contain audio in the MVP. Audio is handled by browser text to speech.

## Learning Units

The app tracks three independent learning unit types.

```text
vocabulary item
  level: A0 to C2
  lemma
  forms
  meaning
  linked verse ids
  grammar tags
  expression tags
  mastery state

grammar skill
  level: A0 to C2
  name
  prerequisite skill ids
  linked verse ids
  recognition test
  interpretation test
  mastery state

expression skill
  level: A0 to C2
  phrase or pattern
  meaning
  linked verse ids
  reuse prompt
  mastery state
```

Verses are not merely examples. They are evidence for whether the learner can process a word, grammar feature, or expression in context.

```text
verse
  book
  chapter
  verse
  russian text
  optional english text
  vocabulary item ids
  grammar skill ids
  expression skill ids
  comprehension prompts
  speaking prompts
```

## Level Progression

Level progression is strict.

```text
level pass = vocabulary pass + grammar pass + expression pass
```

The learner cannot advance to the next level by passing vocabulary alone. Each level requires evidence across all three areas.

The recommended gate is:

- vocabulary pass means the learner knows enough core words for the level in verse context
- grammar pass means the learner recognizes and interprets enough grammar skills for the level in verse context
- expression pass means the learner interprets and can reuse enough expression skills for the level
- delayed audit means recently passed items are sampled again after time has passed

The exact thresholds should be configurable, but the starting design should use high thresholds rather than full perfection. For example, vocabulary may require about 90 percent confirmed mastery while grammar and expression may require about 85 percent confirmed mastery. Full 100 percent mastery is too brittle for daily learning.

## Placement And Screening

The learner should not be forced to study easy A-level material that they already know.

At first setup, and after importing a new bundle, the app runs placement screening from A0 upward.

```text
A0 screening
  pass enough items -> continue to A1 screening
  fail enough items -> start A0 learning

A1 screening
  pass enough items -> continue to A2 screening
  fail enough items -> start A1 learning
```

The same pattern continues until the app finds the learner's current working level.

Screening should be fast. It should classify items instead of teaching them. The learner can mark an item as known, uncertain, or unknown. Known items leave the daily learning queue. Uncertain and unknown items become learning or review candidates.

## Cumulative Coverage, Not Cumulative Exposure

The app uses cumulative level coverage, but it must not repeatedly show already mastered items without reason.

Cumulative coverage means every item from A0 through the current level remains eligible for later audit. It does not mean every old item appears every day.

The daily queue should prioritize:

- failed vocabulary
- failed grammar
- failed expressions
- uncertain items
- due reviews
- long-unverified audit samples
- a small number of new items from the current level

Mastered items should be shown rarely. Repeatedly confirmed items can be retired from normal study and sampled only during delayed audits.

## Mastery States

Each vocabulary item, grammar skill, and expression skill should have its own mastery state.

```text
new
screening
learning
weak
known
retired
audit_due
```

The app should also record why an item was hard when that information is available.

```text
word_unknown
verse_hard
grammar_hard
expression_hard
```

This distinction matters. If the learner knows a word but fails the verse because of grammar, the app should review the grammar skill rather than repeatedly drilling the word.

## Daily Session

The default daily target is about five new vocabulary items. Reviews and tests can add more cards, but the app should remain session-sized and mobile-friendly.

A daily session should include:

- due weak vocabulary
- due weak grammar
- due weak expressions
- due verse comprehension prompts
- long-unverified audit samples
- about five new vocabulary items from the current level
- connected Gospel-of-John verses
- short English grammar and expression notes
- browser text to speech when available

The daily queue should be adaptive. If the learner fails grammar or expression items, the app should reduce new vocabulary pressure and spend more time on the failed area.

## Gospel Of John As Corpus

The Gospel of John is the primary corpus for examples and assessment.

The app should prefer vocabulary, grammar, and expression items that are actually connected to John. This keeps the learning objective coherent: the learner studies Russian in order to understand and speak about this text.

There is a design tension between complete A0 to C2 vocabulary coverage and exclusive use of John. John will not contain every general-purpose word or every advanced expression. The preferred MVP resolution is:

- use John-connected items first
- classify those items by A0 through C2 level
- allow the bundle to include non-John items only when explicitly marked as supplemental
- keep supplemental items separate from the strict John-reading gate unless the user enables them

## Grammar And Expression Skill Map

Vocabulary levels alone cannot guarantee grammar or expression competence. The app therefore needs a separate skill map.

The recommended skill map strategy is:

- use general Russian learning progression as the backbone
- include only grammar and expression skills that have evidence in the imported John corpus for the MVP
- attach each skill to concrete verse examples
- test each skill in context, not only through abstract explanations
- require grammar and expression pass results before level advancement

The app should not claim official CEFR grammar certification. A defensible claim is level-based vocabulary progression with evidence-based grammar and expression mastery tracking.

## Text To Speech

The MVP does not store or ship audio files.

Russian pronunciation is provided through browser text to speech, primarily the `Web Speech API` and `speechSynthesis`. The app asks the browser for available voices and prefers Russian voices such as `ru` or `ru-RU` when present.

Actual voice availability depends on the user's browser, operating system, and installed speech services. Chrome, Edge, Android, and iOS may expose different voices. If no Russian voice is available, the app should clearly show that Russian TTS is unavailable on the current device.

Open-source Russian TTS can be evaluated later, but it is not part of the MVP because model size, browser performance, and mobile compatibility would slow down the first useful version.

## Browser Storage

Imported study data is stored locally in the browser.

- `IndexedDB` stores verses, vocabulary items, grammar skills, expression skills, notes, review state, test results, and progress
- `localStorage` stores only small preferences such as selected voice, reading speed, current level, or UI settings
- clearing browser data may delete imported texts and progress
- export and backup should be supported after the MVP foundation is stable

The app should work as a static web app without a backend server.

## Android APK

The web MVP can be wrapped with Capacitor to produce a native Android debug APK.

### Prerequisites

- Node.js 18+
- Capacitor CLI dependencies installed via `npm install`
- Android SDK and JDK 17 installed

Set these environment variables when building:

- `JAVA_HOME` pointing to a JDK 17 installation
- `ANDROID_HOME` and `ANDROID_SDK_ROOT` for your Android SDK
- Ensure `adb`, `gradle`, and Android SDK tools are accessible from `PATH` if needed

### Build Commands

- Install dependencies

```
npm install
```

- Sync latest web bundle into Android assets

```
```

- Build debug APK

```
```

### Artifact

Generated debug APK path:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

### Notes

- `index.html` and `src/*` are copied to `www/` by `npm run web:prepare` before each Android sync/assemble.
- The repository does not include copyrighted bundle content or text/audio files.
- If you do not have Android Studio available, use an existing CI runner with the same repository and run `npm run android:assemble`.

## MVP Scope

The first useful version should include:

- GitHub Pages-compatible static app
- private study bundle import
- schema validation for imported data
- local persistence with `IndexedDB`
- placement screening from A0 upward
- current-level learning queue
- strict vocabulary, grammar, and expression gates
- John verse browser
- daily vocabulary target of about five new words
- adaptive review for weak vocabulary, grammar, and expressions
- basic delayed audit for known or retired items
- English grammar and expression notes
- browser TTS for Russian text when available
- clear fallback when Russian TTS is unavailable

Non-goals for the MVP:

- bundled licensed Bible text
- bundled audio files
- backend sync
- user accounts
- open-source neural TTS in the browser
- full multi-book Bible support
- official CEFR certification claims

## Data Boundary

The repository should include only public and safe project material.

The repository should not include:

- NRP text
- NIV text
- copyrighted Bible audio
- user-created private study bundles
- local mirror data under `refs/`

The `refs/` directory is reserved for local research material and is ignored by Git.

## Current Status

The product direction is fixed as a public static app with private user-imported study data. The most important design constraint is that A0 through C2 vocabulary progression is the backbone, while grammar and expression mastery are tracked separately and must pass strict level gates together with vocabulary.
