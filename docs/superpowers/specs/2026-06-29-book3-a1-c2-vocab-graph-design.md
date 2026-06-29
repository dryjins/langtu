# Book3 A1~C2 Vocabulary Graph Design

## Goal

Create a reusable graph that connects `data/bible-kids-03.json` (Book 3 text) to A1~C2 vocabulary from `data/openrussian-vocab-a1-c2.json`, and produce chapter-level coverage metrics for progress control.

The chapter-to-word relation is explicitly **N:M** (and naturally also M:N):

- one chapter links to many words
- one word links to many chapters

The output therefore should never imply one-to-one chapter-word pairing.

## Why this exists

Progress gating currently works on a private study bundle format but lacks a precomputed dependency map for the current Book 3 corpus. A vocabulary graph lets us answer:

- 어떤 장에서 어떤 레벨 단어가 먼저 필요한지
- 레벨별 진도 조절에 필요한 미커버 단어가 어디에 분포하는지
- 같은 장을 반복할 때 이미 알고 있는 단어/미포함 단어 비중을 빠르게 계산

## Success Criteria

- Book 3 전체 챕터를 누락 없이 순회하고 챕터 단위 커버리지(유니크/토큰 기준) 계산
- A1~C2 누적 레벨 기준(`A1`, `A2`, `A1,A2`, ... `A1..C2`)의 결과가 기존 누적 보고서(총 token/unique 통계)와 모순 없이 정합
- 단어-본문 연결은 최소한 다음을 포함:
  - `exact`: 정규화된 표면형(`normalization` 후) 매칭
  - `surface-accented`: `accented`에서 강세기호(ʼ,') 제거 후 매칭
  - `stem-fallback`(선택): 간단한 형태복원 후보 생성(`-ть` 계열/굴절종결어미 제거)로 보조 매칭
- 결과 파일이 deterministic 하게 생성되고, 진행량 계산 파이프라인에서 사용 가능한 형태로 노출

## Scope

- 범위: `book 3` 본문 토큰과 A1~C2 어휘만
- 범위 밖: 앱 런타임 스케줄러 수정, Android 번들 패키징 변경

## Data Inputs

- `data/bible-kids-03.json`
  - `chapters[].chapter`, `chapters[].title`, `chapters[].textLines`
- `data/openrussian-vocab-a1-c2.json`
  - `itemsByLevel.A1..C2[].items[].bare`
  - `itemsByLevel.A1..C2[].items[].accented`

## Output Artifact

Create:

`data/bible-kids-03-a1-c2-vocab-graph.json`

with structure:

- `metadata`
  - generation time/version/source identifiers
- `levels`: `['A1','A2','B1','B2','C1','C2']`
- `nodes.chapters`: 챕터 메타
  - `id`, `chapter`, `title`, `lineCount`, `tokenCount`
- `nodes.vocabulary`: 단어 노드
  - `id`, `word`, `normalized`, `level`, `wordId`, `matchKeys`
- `edges`: 챕터-단어 연결 목록 (N:M)
  - `sourceChapter`, `targetWord`, `level`, `count`
  - `locations`: 최소 { `chapter`, `lineIndex`, `tokenIndex`, `surface`, `matchMethod` }
  - `matchConfidence` (`1.0` for exact, `<1` for fallback)
- `edgesByLine` (옵션): 문장/행 단위로 확장할 수 있는 동일 구조의 보조 링크
- `chapterCoverageByLevel`: 챕터 단위 커버리지
  - 레벨별 `coveredUnique`, `missingUnique`, `coveredTokenRate`, `missingTokenRate`
  - 누적 기준 레벨(`A1` 누적, `A2` 누적, ... `C2` 누적) 계산
- `globalCoverage`: 기존 missing-by-level 통계와 cross-check 가능한 전체 통계

## Matching Rules (Hybrid / Mixed Strategy)

### 1) Normalization (공통)

- 소문자 변환
- `ё -> е`
- 결합 문자 제거( combining marks )
- 앞뒤 공백, 구두점 제거
- 토큰화: 유니코드 문자열에서 키릴릭 글자 추출 (`[\\p{L}]+` 기준), 실행 환경에서 미지원 시 폴백 정규식을 사용
- 매칭은 N:M 집계를 전제로 하며, 하나의 단어가 같은 챕터 내에서 여러 번 등장하면 하나의 챕터-단어 엣지에 `count` 누적, `locations` 배열로 대표 위치를 유지합니다.

### 1-b) Relation Interpretation

- `chapter -> word` and `word -> chapter` are both first-class queries.
- 단일 챕터의 진도 판정은 해당 챕터 엣지의 카운트/커버리지에서 읽고,
  단일 단어의 재방문 우선순위는 `edges`에서 해당 단어가 등장한 챕터들의 미커버 비중으로 계산합니다.

### 2) Exact Match

- 토큰 정규형이 `openrussian.itemsByLevel[*].bare` 키와 동일하면 `exact`으로 기록
- 동일 단어가 여러 레벨에 걸쳐 존재하면 후보를 모두 보존(레벨별 연결)

### 3) Secondary Surface Match

- token-side / vocab-side 표기 차이(강세표기) 보정:
  - `accented`에서 `',ʼ` 제거 후 동일화한 키로 매칭
- `matchConfidence = 0.90`

### 4) Fallback Stem Match (선택, 저신뢰)

- 형태 추정 후보 생성(미리 정한 짧은 접미사 제거/교체 규칙)
- 매칭된 경우 `matchMethod: "stem-fallback"`, `matchConfidence: 0.70`
- 진도 계산 기본값에서는 `>= 0.85`만 신뢰 레벨로 합산(설정 가능)
- 낮은 신뢰 연결은 그래프에는 남기되, 진도 지표에서 제외 가능

## Coverage Calculation

- 챕터 `v`의 토큰 커버리지는 연결된 occurrence count로 계산
- 유니크 커버리지: 챕터 내 연결된 단어 유니크 수
- 누적 레벨 기준은 `A1` ~ 현재 레벨까지 어휘 리스트를 누적 집합으로 확장
- 미커버 단어는 `globalCoverage`와 `chapterCoverageByLevel.missingByLevel`에 추출

### Revisit Signal

To support revisit decisions without forcing 1:1 pairing, export a compact `revisitHints` section:

- `candidateWord`: 낮은 커버리지/높은 빈도 미커버 단어 또는 미흡 레벨 단어
- `candidateChapters`: 해당 단어의 핵심 출현 챕터 top-k
- `priority`: 단어 중요도 가중치 (예: 출현 빈도, 현재 레벨 적합성, 직전 진도 반영도) 기반 정렬

This section is intentionally optional and can be empty in the initial pass. It is a separate object so we can add richer scheduling logic later without changing core coverage fields.

## Script Design

Create script:

`scripts/build-book3-a1-c2-vocab-graph.mjs`

- 실행: `node ./scripts/build-book3-a1-c2-vocab-graph.mjs`
- 옵션:
  - `--input-bible data/bible-kids-03.json`
  - `--input-vocab data/openrussian-vocab-a1-c2.json`
  - `--output data/bible-kids-03-a1-c2-vocab-graph.json`
  - `--min-confidence 0.85`

## Non-goals (현재 단계)

- 문장/절 단위 의미 분석(형태소 정확도 100%)
- 앱 실행 중 실시간 매칭(이 단계는 오프라인 precompute)
- openrussian 전체 CEFR 외 단어군 확장

## Testing

Add focused tests:

- 매칭 테스트: 같은 표면형 단어가 `exact`로 연결되는지
- 정규화 테스트: `ё/е`, 강세기호 제거로 secondary match가 생기는지
- 커버리지 테스트: 작은 fixture로 챕터별 커버리지 합이 토큰/유니크 기준으로 합리적임
- 회귀 테스트: 기존 보고서(`data/bible-kids-03-missing-by-level-a1-c2.json`)의 누적 커버율과 `globalCoverage.coverageUniqueRate`가 일치/근접한지 비교

## Implementation Notes

- 기존 `collect-bible-by-kids.mjs`와 분리해 `scripts/build-book3-a1-c2-vocab-graph.mjs`만 추가
- 결과 파일은 코드/테스트에 포함할 수 있게 JSON으로 저장
- 향후 스케줄러 연동 시 `chapterCoverageByLevel`에서 레벨별 진도 조건을 읽어 시작 레벨/주차 진도 추천에 사용
