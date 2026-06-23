---
id: T-0604
title: CollectionTriggerService 의 since 도출을 R-58 backoff variant 로 wiring
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-031, REQ-040, REQ-058]
estimatedDiff: 90
estimatedFiles: 2
created: 2026-06-23
independentStream: p5-recollection-window
dependsOn: []
touchesFiles:
  - src/assessment-collection/collection-trigger.service.ts
  - src/assessment-collection/collection-trigger.service.spec.ts
plannerNote: "P5 R-58 chain 다음 slice — CollectionTriggerService.triggerCollection 의 deriveSince 호출을 deriveSinceWithRecollectionWindow 로 교체(T-0603 wiring), 재수집 backoff 실효화"
---

# T-0604 — CollectionTriggerService 의 since 도출을 R-58 backoff variant 로 wiring

## Why

PLAN P5 재수집 정책(100행 R-58/REQ-031)의 chain — T-0602 가 순수 `applyRecollectionWindow` backoff 함수를, T-0603 이 `SinceDerivationService.deriveSinceWithRecollectionWindow(personId, windowDays?)` variant 메서드를 박제했으나, 두 task 모두 Out of Scope 에서 "service 배선(caller 채택)은 별도 follow-up slice" 로 deferred 했다. 현재 `CollectionTriggerService.triggerCollection`(manual trigger, REQ-040)은 여전히 backoff 없는 `deriveSince` 를 호출해 재수집 시 최근 1주 겹침이 발생하지 않는다. 본 task 는 그 단일 호출 지점을 R-58-aware variant 로 교체해 "최근 1주 재수집 OK + 저장 부분 중복 방지(dedup 흡수)" 정책을 manual-trigger 수집 경로에서 실효화한다.

## Required Reading

- `src/assessment-collection/collection-trigger.service.ts` — 변경 대상. line 61 의 `deriveSince(dto.personId)` 호출 1개를 교체한다.
- `src/assessment-collection/collection-trigger.service.spec.ts` (colocated spec) — 변경 대상. mock `SinceDerivationService` 주입 구조(`deriveSpy`)를 확인하고, 위임 변경에 맞춰 spec 의 검증 대상 메서드를 갱신한다.
- `src/assessment-collection/since-derivation.service.ts` — `deriveSinceWithRecollectionWindow(personId, windowDays?)` variant 시그니처·계약(T-0603 박제) 확인. 본 task 는 이 메서드를 호출만 하고 재구현하지 않는다.
- `src/assessment-collection/domain/recollection-window.ts` — backoff 의 undefined 패스스루(full collection 보존)·방어 fallback 계약 확인(behavior 이해용, 변경 0).

## Acceptance Criteria

- [ ] `CollectionTriggerService.triggerCollection` 의 since 도출이 `this.sinceDerivationService.deriveSince(dto.personId)` → `this.sinceDerivationService.deriveSinceWithRecollectionWindow(dto.personId)` 로 교체됨(windowDays 미지정 → 기본 7일 backoff). 다른 5단계(Person resolve · serviceIdentities 매핑 · Assessment create · collectForPerson · summary)는 변경 0.
- [ ] `since` 가 `undefined`(신규 인원, 직전 Assessment 0건)일 때 backoff 패스스루로 여전히 `undefined`(= full collection, summary 의 `since: null`)가 유지됨을 검증하는 happy-path test 1+ (위임 메서드가 undefined 반환하도록 mock).
- [ ] `since` 가 유효 ISO 문자열일 때 `deriveSinceWithRecollectionWindow` 의 반환값(backoff 된 ISO)이 그대로 `collectForPerson` 의 since 인자 + summary `since` 로 흐름을 검증하는 happy-path test 1+ (위임 메서드 spy 가 backoff 된 값 반환).
- [ ] error path test 1+ — `deriveSinceWithRecollectionWindow` 가 reject(findByPerson 의존성 실패 전파) 시 `triggerCollection` 이 그 throw 를 잡지 않고 그대로 전파(fail-fast 계약 보존)함을 검증.
- [ ] 분기 cover — since=undefined 분기와 since=정의값 분기 각각 별도 test 로 분리(summary `since: null` vs 실 ISO). 본 task 가 추가하는 새 분기는 없음(위임 메서드명 교체) — 기존 since 분기 검증을 새 메서드명 기준으로 유지.
- [ ] negative cases 충분 cover — (a) 위임 메서드가 reject 하는 의존성 실패, (b) 빈/비정상 personId 도 검증 없이 위임으로 그대로 전달(deriveSinceWithRecollectionWindow 동형 fail-fast), (c) Person 404 / Assessment create P2002 409 등 기존 다른 단계 throw 전파가 backoff wiring 교체 후에도 깨지지 않음 각 1+ test.
- [ ] `deriveSinceWithRecollectionWindow` 가 `dto.personId` 단일 인자로 정확히 1회 호출되고, 구 `deriveSince` 는 더 이상 `triggerCollection` 에서 직접 호출되지 않음을 spy 로 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경된 `collection-trigger.service.ts` 의 since 도출 분기가 colocated spec 으로 cover.

## Out of Scope

- `SinceDerivationService` / `applyRecollectionWindow` / `recollection-window.ts` 변경 — 본 task 는 caller wiring 만. 이미 박제된 variant 호출만 한다.
- `windowDays` 를 dto / 설정에서 동적으로 받아 전달하는 것 — 본 task 는 기본 7일 backoff 만(windowDays 인자 미전달). 동적 window 정책은 별도 후속 slice / ADR.
- `assessment-backfill-checker.service.ts` 등 다른 `deriveSince` 소비처 변경 — 그곳은 "직전 Assessment 존재 여부 판정" proxy 라 backoff 와 무관(undefined vs 정의값 구분만 사용). 본 task 는 manual-trigger 수집 경로(REQ-040)만.
- scheduling 경로(cron 자동 수집)의 since wiring — P7 SchedulerModule 진입 시 별도 slice.
- 실 DB · 실 token · 실 네트워크 · live-LLM 도입 — Q-0025 deferred 정합(mock-injected unit-test 표면만).
- timezone(KST/UTC) 경계 보정 — ADR-first 별도(PLAN 110행).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
