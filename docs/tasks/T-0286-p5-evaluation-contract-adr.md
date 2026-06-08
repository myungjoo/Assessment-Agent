---
id: T-0286
title: Write ADR-0032 — P5 단위 평가 계약 (commit/document/issue 통합 + 평가-side dedup)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-009, REQ-021, REQ-037, REQ-038, REQ-097]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-08
plannerNote: "P5 entry first slice (Q-0027 opt2 P5 진입) — 평가 계약 ADR-first de-risk. issue/commit/document 통합 평가 입력 + self-follow-up 제외=평가-side dedup. doc-only enumerated-section ×1.6."
---

# T-0286 — Write ADR-0032 — P5 단위 평가 계약

## Why

Q-0027 결정(2026-06-08, option 2)으로 P5 평가 파이프라인에 진입한다. 사용자 결정의 핵심은 commit / document / GitHub Issue 를 **단일 평가 계약(unified evaluation contract)** 으로 다루고, self-follow-up 제외(R-30, L82)를 수집-side 가 아닌 **평가-side dedup** 에 배치하는 것이다. P5 의 가장 큰 risk 는 "평가 단위를 무엇으로 정의하고, 어떤 입력 shape 로 LLM 에 넘기며, 난이도·기여도·양을 어떻게 산출하고, 중복제거·self-follow-up 제외를 어디에 두는가"이므로 — 이 설계 결정을 **ADR 로 먼저 박제(de-risk)** 한 뒤 구현 slice 로 분해한다. 본 task 는 PLAN P5 의 첫 bullet("단위 commit/document 평가 (난이도·기여도·양)")과 L82(GitHub Issue 평가 + self-follow-up 제외)를 동시에 cover 하는 설계 backbone 이다. 구현은 본 task 의 Follow-ups 로 분리해 size cap 을 지킨다.

## Required Reading

- `docs/STATE.json` 의 Q-0027 entry (decision 본문 — scoping 4종 a/b/c/d 가 본 ADR 의 입력 제약)
- `docs/PLAN.md` Phase P5 섹션 (L94~106 — 평가 파이프라인 bullet 전체) + Phase P4 L82 (GitHub Issue 평가 R-30 self-follow-up 제외)
- `src/llm/llm-gateway.interface.ts` (LlmGateway 추상 계약 + LlmProvider enum — 평가 scoring 의 LLM 호출처)
- `src/llm/llm-http-gateway.service.ts` (LlmHttpGateway — 이미 머지된 backbone, generate dispatch 시그니처. 평가 service 가 이 위에서 동작)
- `src/assessment-collection/domain/activity.ts` (Activity / GithubActivity / GithubActivityKind union — "issue" 포함. 평가 입력 매핑의 source 타입)
- `src/assessment-collection/domain/github-activity.mapper.ts` (raw → typed Activity 매퍼 — kind="issue" 산출 분기. 평가 입력이 어디서 오는지)
- `src/assessment-collection/domain/author-filter.ts` (Person↔identity 귀속 — self-follow-up 의 "본인" 식별 기준이 여기서 시작)
- `src/assessment-collection/domain/commit-dedup.ts` + `page-dedup.ts` (기존 수집-side dedup 패턴 — 평가-side dedup 과의 경계를 ADR 에서 구분)
- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` (수집 layer 책임 경계 — 평가 layer 와의 SRP 분리 인용)
- `docs/architecture/data-model.md` §4 (REQ-032 raw-not-stored 불변 — 평가 입력에 raw 본문 미포함 제약)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0032-p5-evaluation-contract.md` 신설. status PROPOSED (또는 ACCEPTED — architect 판단). 표준 ADR 구조(Context / Decision / Consequences / Alternatives, 본문 한국어 §12).
- [ ] **평가 단위 계약(evaluation unit contract)** 명시 — commit / document(Confluence page) / GitHub Issue 가 어떻게 **공통 평가 입력(common evaluation input)** 으로 매핑되는지 정의. 셋의 discriminated union 또는 공통 shape, source 식별 필드, 기존 `Activity`(domain) 와의 관계(재사용 vs 신규 평가-layer 타입) 명확화.
- [ ] **LLM scoring 입력 shape** 정의 — 평가 단위 1건(또는 batch)을 LlmGateway 로 넘길 때의 입력 구조(prompt 입력에 포함되는 typed 필드 — raw 본문 미포함 REQ-032 준수). LlmHttpGateway 의 기존 generate 시그니처와의 호환/확장 경계 명시.
- [ ] **난이도·기여도·양(difficulty / contribution / volume) output 산출** 계약 — LLM 정성 출력 + metric 수치를 어떻게 결합해 평가 결과를 구성하는지(R-97 난이도 모델 routing 과의 연계 포함), output 타입 shape.
- [ ] **dedup + self-follow-up(R-30) 제외 위치** 명시 — 제외 로직이 **평가-side dedup** 에 위치함을 박제(수집-side filter 아님, Q-0027 결정 (b)). self-follow-up 의 검출 semantics 정의('follow-up' 의 의미 = 같은 issue 내 동일 author 의 후속 활동 등, '본인이 소비'의 식별 기준 — author-filter 의 Person 귀속을 기준으로), 그리고 issue comment thread 수집이 필요한지 여부 + 그 처리 위치를 명시(필요 시 수집 확장은 별도 Follow-up).
- [ ] ADR 에 **구현을 본 task 밖으로 분리**함을 명시 — 본 ADR 은 design only, impl slice 는 Follow-ups(아래) 로 분해됨을 Consequences 에 박제.
- [ ] `git diff` 로 변경 파일이 ADR 1개(+ 필요 시 `docs/architecture/modules.md` 또는 `overview` 의 P5 평가 layer 참조 1줄 amend) 만임을 확인 — production code(`src/`) 변경 0.
- [ ] tester: `pnpm lint && pnpm build && pnpm test` 가 green(R-110 — pr-mode 는 코드 0 LOC 이어도 tester 가 build/test 통과 확인). ADR 추가만이라 spec 변경 0 예상.

## Out of Scope

- **production code 구현 금지** — 평가 입력 매퍼 / scoring service / dedup·self-follow-up 제외 로직 / controller / DTO / spec 전부 본 task 밖(Follow-ups). 본 task 는 ADR 설계만.
- **live LLM run 금지** — 실 LLM endpoint / API key 주입은 §5 credential 게이트, 별도 후속 task. 본 ADR 은 mocked LLM 전제로 계약만 박제.
- **DB schema migration 금지** — 평가 결과 영속화 schema 가 필요하면 ADR 에 "후속 task 에서 schema 결정(§5 schema 게이트 재확인)" 으로 deferred 명시만. 본 task 에서 `prisma/schema.prisma` 변경 0. schema 게이트가 surface 하면 그 후속 task 진입 시 §5 재확인.
- **새 외부 dependency 금지** — Node 내장 fetch + 이미 머지된 LlmHttpGateway backbone 만 전제(§5 dependency 게이트 미발화 유지). ADR 에서 새 dep 를 제안하면 §5 발화 — 그 경우 BLOCKED.
- 수집 layer(ADR-0029) 변경 금지 — 평가 layer 는 수집 산출물(Activity)을 consume 만. 수집-side dedup(commit-dedup/page-dedup) 재설계 금지.

## Suggested Sub-agents

`architect → tester` (architect 가 ADR 작성, tester 가 build/test green 확인. 코드 변경 0 이라 implementer 불요.)

## Follow-ups

(생성 시점 비어있음 — sub-agent 가 관련 작업 발견 시 append. 예상 P5 impl slice — ADR 확정 후 planner 가 별도 task 로 분해:)

- (예상) 평가 입력 매퍼 slice — Activity(commit/document/issue) → 공통 평가 입력 변환 순수 함수 + colocated spec.
- (예상) LLM scoring service slice — 평가 입력 → LlmHttpGateway 호출 → 난이도·기여도·양 output (mocked LLM unit).
- (예상) 평가-side dedup + self-follow-up(R-30) 제외 slice — earlier-date 우선 시간적 중복(R-21) + self-follow-up 제외 순수 도메인 로직 + spec.
- (예상) issue comment thread 수집 확장(필요 판정 시) — self-follow-up 검출에 comment 가 필요하면 수집 mapper 확장(ADR-0029 경계 존중).
- (예상) 평가 controller / DTO slice — 사용자 지정 기간 평가문 요청(R-9) endpoint.
- (예상) live LLM run task — §5 credential 게이트, 실 endpoint/key 주입 시 진입(deferred).
