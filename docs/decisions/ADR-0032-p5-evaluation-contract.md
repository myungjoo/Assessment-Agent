---
id: ADR-0032
title: P5 단위 평가 계약 — commit/document/issue 통합 평가 입력 + LLM scoring + 난이도·기여도·양 산출 + 평가-side dedup/self-follow-up 제외
status: PROPOSED
date: 2026-06-08
relatedTask: T-0286
supersedes: null
---

# ADR-0032 — P5 단위 평가 계약 박제

> 본 ADR 은 **P5 평가(evaluation) 파이프라인의 설계 결정만** 박제하며 production code 0 LOC 다 — 평가 단위 계약(commit / document / GitHub Issue → 공통 평가 입력) · LLM scoring 입력 shape · 난이도·기여도·양 output 산출 계약 · dedup + self-follow-up(R-30) 제외 위치의 4 결정을 **decide** 하되 구현하지 않는다. 구현은 task §Follow-ups 의 후속 slice 가 각각 ≤300 LOC / ≤5 파일 + mocked unit test(R-112)로 강제한다. 사용자가 [Q-0027](../STATE.json) 를 (2) P5 진입으로 승인하며 박제한 scoping 4 종 (a) commit/document/issue 통합 평가 계약 / (b) self-follow-up 제외=평가-side dedup / (c) ADR-first design-only / (d) 새 외부 dependency 0(내장 fetch) 이 본 ADR 의 외력이다.

## Context

P4 수집(collection) layer 는 [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) / [ADR-0030](ADR-0030-assessment-collection-enumerate.md) / [ADR-0031](ADR-0031-collection-manual-trigger.md) 로 완결됐다 — GitHub 3 instance(com/sec/ecode) × org × repo 의 commit/PR/issue + Confluence 지정 SPACE 의 page 를 typed `Activity`([src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts)) 로 매핑하고, 수집-side dedup(commit SHA earliest-wins / page-id+version latest-wins)·author 귀속까지 박제됐다. LLM provider 추상화도 P4 milestone-1 에서 완결 — `LlmHttpGateway`([src/llm/llm-http-gateway.service.ts](../../src/llm/llm-http-gateway.service.ts)) 가 5 provider(azure_openai/custom/openai/anthropic/google_gemini) dispatch + 난이도 routing([ADR-0011](ADR-0011-difficulty-model-assignment.md))을 구현해 머지됐다. **그러나 수집 산출물(`Activity`)을 실제로 점수화(scoring)하는 평가 layer 가 0 이다** — `LlmHttpGateway` 는 자기 test 외 caller 가 0, [PLAN.md](../PLAN.md) Phase P5(L94~106) "단위 commit/document 평가(난이도·기여도·양)" bullet 은 미진입이다.

또한 P4 의 마지막 미완 bullet [L82](../PLAN.md)(GitHub Issue 평가 R-30 + self-follow-up 소비 제외)는 stale doc 가 아니라 진짜 미구현 backlog 인데, [Q-0027](../STATE.json) 결정으로 이를 P4 수집-side 에 끼우지 않고 **P5 평가 계약 안으로 흡수**한다. 핵심 risk 는 "평가 단위를 무엇으로 정의하고(commit/document/issue 를 어떻게 통일), 어떤 입력 shape 로 LLM 에 넘기며, 난이도·기여도·양을 어떻게 산출하고, 중복제거·self-follow-up 제외를 어디에 두는가"이므로 — 본 ADR 이 이 설계를 먼저 박제(de-risk)하고 구현 slice 로 분해한다.

### 외력

- **[CLAUDE.md §5](../../CLAUDE.md)** — 새 외부 dependency / DB schema migration / live credential 은 BLOCKED. 본 평가 설계는 Node 내장 fetch(`LlmHttpGateway` backbone, 이미 머지) + 기존 `Activity` 도메인만 재사용하므로 새 dep · 새 credential · 새 migration 0(평가 결과 영속화 schema 는 후속 task §5 schema 게이트 재확인으로 deferred).
- **[Q-0027 decision](../STATE.json)** — 본 ADR 의 입력 제약 4 종(a/b/c/d). 특히 (a) 통합 평가 계약 · (b) self-follow-up 제외=평가-side dedup 는 본 ADR 의 §1·§4 가 직접 cover.
- **R-30 / R-21 / R-37 / R-38 / R-97**(README 행 번호 표기 — ADR-0011 의 `R-NN = README line` 관행 준수. 숫자는 [README.md](../../README.md) 행이며 canonical [docs/requirements.md](../requirements.md) 의 `REQ-NNN` ID 와 무관) — Issue 문서 기여 평가(R-30) + Fork/Rebase/Meld·시간적 중복 earlier-date 우선 제거(R-21) + 품질 분류 zero/high contribution(R-37·38) + 3 난이도 모델 routing(R-97). 본 ADR 의 평가 계약이 이 enumerate 를 cover.
- **REQ-032 (raw-not-stored invariant)**([data-model.md §4](../architecture/data-model.md)) — 평가 입력에 raw 본문(commit message 전문 / page 본문 HTML / issue body) 미포함. `Activity` 가 이미 typed 필드 + `metadata`(scalar only)만 보유하므로, 평가 입력은 그 typed surface 위에서만 구성된다 — 본 invariant 를 application-layer 에서 보존.

## Decision

### (1) 평가 단위 계약 — commit/document/issue → 공통 평가 입력(common evaluation input)

**채택: 기존 `Activity` discriminated union 을 평가 입력의 source 로 재사용 + 평가-layer 신규 타입 `EvaluationInput` 으로 정규화(normalize)**.

- 평가 단위(evaluation unit)의 source 는 수집 산출물 `Activity`(= `GithubActivity`(kind=commit/pr/issue) | `ConfluenceActivity`) 그대로다 — 평가 layer 는 수집을 재구현하지 않고 consume 만 한다(ADR-0029 SRP 경계 존중). **GitHub Issue 는 별도 source type 이 아니라 `GithubActivity` 의 `kind="issue"` 변형으로 이미 수집된다**([github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) resolveKind (c)) — L82 "Issue 를 문서 기여로 평가"는 평가 layer 가 `kind="issue"` 활동을 문서 기여 category 로 점수화하는 routing 으로 충족한다.
- **신규 평가-layer 타입 `EvaluationInput`**(예: `src/assessment-evaluation/domain/evaluation-input.ts`, 후속 slice) — commit / document / issue 를 단일 평가 파이프라인이 다루도록 공통 shape 로 정규화한다. 핵심 필드:
  - `unitId: string` — 평가 단위 고유 식별(= `Activity.externalId` 또는 `<sourceType>:<instanceKey>:<externalId>` 합성, dedup key 와 정합).
  - `contributionKind` — 평가 category discriminator. **`"code" | "document"` 2 종으로 정규화**: GitHub commit/PR → `code`, GitHub issue + Confluence page → `document`. 이 정규화가 "Issue 를 문서 기여로 평가"(L82/R-30)를 계약 차원에서 박제한다.
  - `sourceType` / `instanceKey` / `author` / `timestamp` — `Activity` 에서 그대로 전사(귀속·시간적 dedup·since 기준값 보존).
  - `metadata: ActivityMetadata` — `Activity.metadata`(scalar only — REQ-032)를 그대로 전달. 평가 입력의 정량 신호(title 길이 등) source.
- **신규 vs 재사용 경계**: source 타입(`Activity`)은 재사용, 평가 정규화 타입(`EvaluationInput`)은 신규다. 이유 — `Activity` 의 discriminator(`sourceType`=github/confluence, `kind`=commit/pr/issue)는 **수집 출처** 축이고, 평가는 **기여 category**(code/document) 축으로 다뤄야 통합 scoring 이 가능하다. 두 축을 한 타입에 묶으면 평가 routing 이 출처 분기로 오염된다. `Activity` → `EvaluationInput` 변환은 별도 순수 함수 mapper layer(후속 slice)가 단독 책임(github-activity.mapper 패턴 mirror).

### (2) LLM scoring 입력 shape — typed 필드만으로 prompt 구성, generate 시그니처 재사용

**채택: 평가 단위 1 건당 `LlmGateway.generate(prompt, options)` 1 회 호출 + prompt 는 `EvaluationInput` 의 typed 필드로만 조립(raw 본문 0)**.

- `LlmHttpGateway` 의 기존 [generate 시그니처](../../src/llm/llm-gateway.interface.ts)(`generate(prompt: string, options: LlmGenerateOptions): Promise<LlmGenerateResult>`)를 **변경 없이 재사용**한다 — 평가 layer 는 prompt 문자열을 조립하는 책임만 추가한다(gateway 확장 0). 호환/확장 경계: `LlmGenerateOptions.difficulty`(선택)에 (3)의 난이도 분류 결과를 넣어 난이도 routing(R-97, ADR-0011)을 그대로 활용한다. `modelId` 는 difficulty 미제공 fallback 경로용.
- **prompt 입력 typed 필드(raw 본문 미포함, REQ-032)**: `contributionKind`(code/document) + `sourceType` + `metadata` 의 scalar 신호(예: titleLength) + `timestamp` 만. **commit message 전문 / issue body / page 본문 HTML 은 prompt 에 절대 포함하지 않는다** — `Activity`/`EvaluationInput` 이 애초에 raw 본문 필드를 보유하지 않으므로(REQ-032 schema-level 부재) 구조적으로 불가능. 정성 평가의 source 텍스트가 필요하면 그 확장은 raw-not-stored invariant 와 충돌하므로 **별도 ADR 필수**(본 ADR 은 typed-metadata-only 전제).
- **batch 경계**: 본 계약은 평가 단위 1 건당 generate 1 회를 default 로 박제한다(단순·결정적·실패 격리). 일/주/월 aggregate 평가(PLAN P5 L97)의 batch prompting 은 본 단위 평가의 상위 layer 책임으로 후속 slice 에서 별도 설계(본 ADR 범위 밖).

### (3) 난이도·기여도·양 output 산출 — LLM 정성 + metric 수치 결합

**채택: `EvaluationResult` 신규 타입에 (i) LLM narrative + (ii) metric 수치 + (iii) 난이도 분류를 결합**.

- output 타입 `EvaluationResult`(후속 slice) 핵심 필드:
  - `narrative: string` — `LlmGenerateResult.narrative`(LLM 정성 평가문) 그대로. raw 아님(생성 결과물, REQ-032 적용 외).
  - `difficulty: string` — 난이도 분류 결과(easy/medium/hard, [llm/difficulty.ts](../../src/llm/difficulty.ts) `DIFFICULTIES` 정합). **이 값이 generate 호출 전 `options.difficulty` 로 주입**되어 난이도 모델 routing(R-97, ADR-0011)을 driving 한다 — 즉 난이도는 scoring **입력이자 output** 양쪽에 나타난다(분류 → routing → 결과 기록).
  - `contribution` — 기여도(품질 분류, R-37·38). zero-contribution(단순 보고/copy-paste) ~ high-contribution(새 알고리즘/외부 연구 도입)의 정성 판정. LLM narrative 에서 도출하거나 별도 structured 출력 — 구체 산출 방식(narrative 파싱 vs 별도 prompt)은 후속 impl slice 결정(본 ADR 은 output 필드 존재만 박제).
  - `volume` — 양(quantitative metric). `metadata` 의 scalar 신호(변경 파일 수 / titleLength 등)에서 산출하는 **deterministic 수치**(LLM 무관 — abusing 방지 metric R-26/40 의 기반). LLM 정성과 분리해 결정적으로 계산.
- **결합 원칙**: `difficulty`·`contribution` 은 LLM 정성 출력 + 분류 routing 산물, `volume` 은 metadata 기반 deterministic 수치. 셋을 한 `EvaluationResult` 로 묶어 평가 단위 1 건의 결과를 구성한다. 영속화 매핑(`EvaluationResult` → `Assessment`/`Contribution` row, [data-model.md](../architecture/data-model.md))은 schema migration 동반 가능성이 있어 **후속 task §5 schema 게이트 재확인으로 deferred**(본 ADR 에서 `prisma/schema.prisma` 변경 0).

### (4) dedup + self-follow-up(R-30) 제외 위치 — 평가-side dedup 에 배치

**채택: self-follow-up 제외 + 시간적 중복(R-21) 처리를 평가-side 순수 도메인 로직에 배치(수집-side filter 아님, Q-0027 (b))**.

- **경계 구분**: 수집-side dedup([commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) / [page-dedup.ts](../../src/assessment-collection/domain/page-dedup.ts))는 **재수집/cross-repo 구조적 중복**(같은 SHA · 같은 page-id+version)을 제거하는 pre-persistence 연산으로 유지한다(ADR-0029 §4 재설계 금지). 평가-side dedup 은 그 위에서 **평가 의미의 중복**을 추가 처리한다 — 두 layer 는 책임이 다르므로 공존한다.
- **평가-side dedup 책임 2 종**(후속 slice, 순수 도메인 함수):
  1. **시간적 중복 earlier-date 우선(R-21)** — 2 월 결과물이 3 월 timestamp 로 재등장하면 2 월 기여로 판단. 수집-side commit-dedup 의 earliest-wins 가 같은 SHA 만 cover 하므로, 평가-side 는 **동일 활동의 시간적 재귀속**을 평가 기간 경계에서 처리.
  2. **self-follow-up 제외(R-30)** — 'A 가 자기 issue 에 자기 follow-up 을 남기고 자기가 소비'하는 케이스를 평가 카운트에서 제외.
- **self-follow-up 검출 semantics(박제)**:
  - **'follow-up' 의 정의** = 같은 issue(같은 `externalId` 의 GitHub `kind="issue"` 활동) 안에서 **issue 작성자와 동일 author** 가 남긴 후속 활동(comment 등). 즉 "issue 생성 + 그 issue 에 단 동일-author 후속" 쌍.
  - **'본인이 소비' 의 식별 기준** = author 동일성. self 의 식별은 [author-filter.ts](../../src/assessment-collection/domain/author-filter.ts) 의 Person↔identity 귀속(`(service, externalId)` ↔ `(instanceKey, author)`)을 기준으로 한다 — 같은 Person 의 identity 가 issue author 이자 follow-up author 이면 self-follow-up. cross-source false-match 방지(GitHub login == Confluence accountId)는 author-filter 의 instance-namespace 분리가 이미 보장.
  - **제외 동작** = self-follow-up 쌍 안의 self-comment(후속)는 평가 카운트에서 제외하되, issue 생성 자체는 문서 기여(R-30)로 카운트. 즉 "자기 issue + 자기 후속" 으로 기여 숫자만 부풀리는 abusing(R-26/40 인접)을 평가 단계에서 차단.
- **issue comment thread 수집 필요 여부**: 현 수집 mapper 는 **issue list item 만 매핑하고 comment thread 는 미수집**([github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts))이다. self-follow-up 의 "후속 comment" 검출에 comment 데이터가 필요하면 **수집 mapper 확장이 선행**돼야 한다 — 이는 ADR-0029 수집 경계를 건드리므로 **별도 Follow-up slice 에서 수집 확장으로 처리**(평가 layer 가 수집을 재구현하지 않음). comment 미수집 상태에서 검출 가능한 범위(issue 단위 author 동일성 기반 휴리스틱)부터 박제하고, comment-level 정밀 검출은 수집 확장 후 강화한다.

## Consequences

### 긍정

- commit / document / GitHub Issue 가 **단일 평가 계약**(`EvaluationInput` → `generate` → `EvaluationResult`)으로 통일돼 L82(Issue 평가)가 P5 scoring 안에서 자연스럽게 cover 된다 — 수집-side 에 억지로 끼우는 재작업 risk 제거(Q-0027 recommendation 정합).
- self-follow-up 제외가 평가-side 에 위치해 "어떤 활동을 어떻게 점수화·중복제거하는가"의 책임 일원화 — 수집 layer 는 source-of-truth 유지(ADR-0029 SRP 보존).
- `LlmHttpGateway.generate` 시그니처 무변경 재사용 + 난이도 routing(ADR-0011) 그대로 활용 — 새 외부 dependency 0, gateway 확장 0.
- REQ-032 raw-not-stored 가 평가 입력 차원에서도 구조적으로 보존(typed-metadata-only prompt).

### 부정 / trade-off

- comment thread 미수집 상태에서 self-follow-up 검출 정밀도가 제한적 — issue 단위 휴리스틱부터 시작하고 comment-level 은 수집 확장 Follow-up 으로 deferred(정밀도 점진 강화).
- 평가 결과 영속화 schema(`EvaluationResult` → DB)는 본 ADR 에서 미결 — 후속 task 가 §5 schema 게이트를 재확인해야 진행(설계 backbone 만 박제, 영속 컬럼은 deferred).
- 단위 1 건당 generate 1 회는 batch 대비 LLM 호출 수가 많음 — aggregate batch prompting 은 상위 layer 후속 slice 가 별도 최적화(본 ADR 범위 밖).

### 구현 분리(design-only 박제)

본 ADR 은 **design only** — production code(`src/`) 변경 0 다. 평가 입력 매퍼 / scoring service / dedup·self-follow-up 제외 로직 / controller / DTO / spec 은 전부 본 task 밖이며 아래 Follow-ups 로 분해된다. 각 slice 는 ≤300 LOC / ≤5 파일 + mocked LLM unit test(R-112 4 종 + negative cases 충분 cover)로 강제한다. live LLM run 은 §5 credential 게이트로 deferred(별도 후속 task — 실 endpoint/API key 주입 시 진입). 본 ADR status 는 PROPOSED — reviewer/사용자 검토 후 ACCEPTED 전환은 별도(status 한 줄 수정 direct).

## Alternatives

### A. commit/document/issue 를 출처별 분리 평가 파이프라인 (미채택)

GitHub 평가 / Confluence 평가를 별도 service 로 분리하는 안. 미채택 — Issue 를 "문서 기여"로 평가하려면 출처(GitHub)와 category(document)가 어긋나(GitHub issue == document) 출처 분리가 오히려 routing 을 복잡화한다. 통합 `EvaluationInput` + `contributionKind`(code/document) 정규화가 Q-0027 (a) 통합 계약 의도에 정합.

### B. self-follow-up 제외를 수집-side filter 에 배치 (미채택)

수집 단계에서 self-follow-up 을 걸러내는 안. **Q-0027 (b) 가 명시적으로 평가-side dedup 을 지정**해 미채택 — 수집은 source-of-truth 를 보존(나중에 정책이 바뀌어도 재수집 불요)하고, "무엇을 카운트할지"는 평가 정책이라 평가 layer 책임이 정합. 수집-side 에 끼우면 issue comment 수집 확장 + 제외 정책이 평가 맥락과 분리돼 drift(Q-0027 context 박제).

### C. raw 본문을 prompt 에 포함해 정성 평가 정밀도 향상 (미채택)

issue body / commit message 전문을 prompt 에 넣어 LLM 정성 평가를 강화하는 안. **REQ-032 raw-not-stored invariant 와 정면 충돌**해 미채택 — `Activity`/`EvaluationInput` 이 raw 본문 필드를 schema 차원에서 보유하지 않으므로 구조적으로 불가. 정성 source 텍스트가 정말 필요하면 invariant 재검토 별도 ADR 이 선결(CLAUDE.md §5 기존 ADR 충돌 = BLOCKED).

## Follow-ups

(ADR 확정 후 planner 가 별도 P5 impl task 로 분해 — 본 ADR 의 backbone 을 구현)

- 평가 입력 매퍼 slice — `Activity`(commit/document/issue) → `EvaluationInput` 변환 순수 함수(contributionKind code/document 정규화 포함) + colocated spec.
- LLM scoring service slice — `EvaluationInput` → prompt 조립 → `LlmHttpGateway.generate`(difficulty routing) → `EvaluationResult`(난이도·기여도·양) + mocked LLM unit.
- 평가-side dedup + self-follow-up(R-30) 제외 slice — earlier-date 우선 시간적 중복(R-21) + self-follow-up(author 동일성 기반) 제외 순수 도메인 로직 + spec.
- issue comment thread 수집 확장 slice(필요 판정 시) — self-follow-up comment-level 검출에 comment 가 필요하면 수집 mapper 확장(ADR-0029 경계 존중).
- 평가 controller / DTO slice — 사용자 지정 기간 평가문 요청(R-9) endpoint.
- 평가 결과 영속화 schema slice — `EvaluationResult` → Assessment/Contribution row(§5 schema 게이트 재확인 동반).
- live LLM run task — §5 credential 게이트, 실 endpoint/key 주입 시 진입(deferred).
