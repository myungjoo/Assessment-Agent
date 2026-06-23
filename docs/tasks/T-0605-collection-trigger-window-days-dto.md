---
id: T-0605
title: 재수집 정책 R-58 chain — manual-trigger windowDays 동적 전달(DTO + service thread)
phase: P5
status: DONE
mergedAs: 4beec46
prNumber: 518
reviewRounds: 1
commitMode: pr
coversReq: [REQ-031, REQ-040]
estimatedDiff: 130
estimatedFiles: 4
created: 2026-06-24
plannerNote: "P5 PLAN 100행 R-58/REQ-031 chain 다음 slice — T-0604 가 deferred 한 windowDays 동적 전달을 DTO optional 필드 + service thread 로 닫음"
independentStream: p5-recollection-window
dependsOn: []
touchesFiles:
  - src/assessment-collection/dto/collect-trigger.dto.ts
  - src/assessment-collection/dto/collect-trigger.dto.spec.ts
  - src/assessment-collection/collection-trigger.service.ts
  - src/assessment-collection/collection-trigger.service.spec.ts
---

# T-0605 — 재수집 정책 R-58 chain — manual-trigger windowDays 동적 전달(DTO + service thread)

## Why

P5 PLAN 100행(R-58 / REQ-031 "재수집 정책 — 최근 1주 재수집·중복 제거 OK")의 recollection-window
stream 이 manual-trigger 경로까지 wiring 됐으나(T-0602 순수 함수 → T-0603 service variant 메서드 →
T-0604 `CollectionTriggerService` wiring), 현재 `triggerCollection` 은
`deriveSinceWithRecollectionWindow(dto.personId)` 를 **windowDays 미전달**로 호출해 항상 기본 7일
backoff 만 적용한다. T-0604 의 Follow-up 이 명시 deferred 한 "windowDays 동적 전달"을 본 slice 가
닫는다 — `CollectTriggerDto` 에 optional `windowDays?` 형식-검증 필드를 추가하고, `triggerCollection`
이 그 값을 기존 위임 메서드의 2번째 인자로 thread 한다. 이로써 caller(향후 Admin manual re-collect,
R-74 "최근 N일" 예시 window 1/7/30 의 forward-support)가 재수집 겹침 폭을 지정할 수 있다. 미전달 시
`applyRecollectionWindow` 의 기본 7일이 그대로 유지되어 기존 동작 불변(non-breaking).

## Required Reading

- `src/assessment-collection/dto/collect-trigger.dto.ts` — 변경 대상 DTO. `@IsOptional()` /
  `@IsISO8601()` 패턴(periodStart) 및 class-validator import 라인 참조.
- `src/assessment-collection/dto/collect-trigger.dto.spec.ts` — colocated DTO spec(검증 패턴 mirror 대상).
- `src/assessment-collection/collection-trigger.service.ts` — 변경 대상 service. L65~68 의
  `deriveSinceWithRecollectionWindow(dto.personId)` 단일 호출 1개가 thread 지점.
- `src/assessment-collection/collection-trigger.service.spec.ts` — colocated service spec(mock 주입 패턴 mirror 대상).
- `src/assessment-collection/since-derivation.service.ts` L46~60 — `deriveSinceWithRecollectionWindow(personId, windowDays?)`
  시그니처(2번째 optional 인자가 thread target). **변경 금지 — 호출만**.
- `src/assessment-collection/domain/recollection-window.ts` L50~72 — `applyRecollectionWindow` 의
  windowDays 계약(undefined → 기본 7, 비정수/≤0 → no-op). **변경 금지 — 동작 확인용**.
- `src/llm/dto/create-llm-provider-config.dto.ts` — `@IsInt()` / `@Min()` 등 정수 검증 decorator
  사용 선례(새 dependency 0 확인용).

## Acceptance Criteria

- [ ] `CollectTriggerDto` 에 optional `windowDays?: number` 필드 추가 — `@IsOptional()` +
      정수 검증 decorator(`@IsInt()` 권장, class-validator 기존 import 재사용, 새 dependency 0).
      필드 주석은 한국어(§12): R-58 재수집 겹침 폭(일), 미제공 시 service 기본 7일 backoff 의미 명시.
- [ ] `CollectionTriggerService.triggerCollection` 이 `deriveSinceWithRecollectionWindow(dto.personId, dto.windowDays)`
      로 `dto.windowDays` 를 2번째 인자로 thread. 다른 5단계 변경 0 · 위임 재구현 0.
- [ ] **Happy-path unit test**: DTO spec — `windowDays` 정수 제공 시 validation 통과;
      service spec — `dto.windowDays` 가 `deriveSinceWithRecollectionWindow` 의 2번째 인자로
      전달됨을 mock spy 로 검증(예: `windowDays=30` thread).
- [ ] **Error path unit test**: DTO spec — `windowDays` 비정수(예: `"7"` 문자열 · `7.5` · `NaN`)
      → validation 실패(400). service spec — 위임 메서드 reject(findByPerson reject 전파) 시
      `triggerCollection` 이 잡지 않고 그대로 전파(fail-fast 계약 보존).
- [ ] **Flow / branch 분기 cover**: `windowDays` 미제공(undefined) 경로 — DTO 통과 + service 가
      `deriveSinceWithRecollectionWindow(personId, undefined)` 호출 → 기본 7일 backoff(기존 동작 불변)
      검증. 제공 경로(정수 값 thread) 와 미제공 경로(undefined thread) 각 1+ test.
- [ ] **Negative cases 충분 cover**: `windowDays` = 0 · 음수 · 비정수 · 문자열 · null 각 1+ —
      형식-검증 실패(decorator 정책)는 DTO spec, 값 의미(≤0/비정수 no-op)는 `applyRecollectionWindow`
      책임이라 본 slice 변경 0(주석으로 명시). 단 DTO 가 `@IsInt()` 로 비정수/문자열을 400 차단함을 검증.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 변경 symbol(DTO 필드 · service thread) 신규 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- `since-derivation.service.ts` / `recollection-window.ts` 변경 금지 — 이미 `windowDays?` 를
  받는 시그니처라 호출만 한다(재구현 0).
- `AssessmentCollectionController` 의 route 배선 변경 금지 — `@Body() CollectTriggerDto` 가 새 필드를
  자동 수용하므로 controller 코드 변경 0(controller spec 에 windowDays case 추가도 본 slice 밖).
- API contract 문서(`docs/architecture/api.md`) 의 windowDays 필드 박제는 별도 direct doc-sync follow-up.
- `windowDays` 의 default 값 정책 변경(7 → 다른 값) 금지 — `applyRecollectionWindow` 의 기본 7 유지.
- scheduling 경로(`SchedulerModule`, P7) wiring 금지 — manual-trigger(REQ-040) 단일 경로만.
- timezone(KST/UTC) 경계 보정 — ADR-first 별도(PLAN 110행).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)
