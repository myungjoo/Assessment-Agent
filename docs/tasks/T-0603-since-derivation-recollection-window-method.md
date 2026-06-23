---
id: T-0603
title: 재수집 정책 — SinceDerivationService 의 R-58 backoff variant 메서드 박제
phase: P5
status: DONE
completedAt: 2026-06-23T16:55:00Z
mergedAs: 0d05788
prNumber: 516
reviewRounds: 1
commitMode: pr
coversReq: [REQ-031]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-06-23
independentStream: p5-recollection-window
dependsOn: []
touchesFiles:
  - src/assessment-collection/since-derivation.service.ts
  - src/assessment-collection/since-derivation.service.spec.ts
plannerNote: "P5 PLAN 100행(R-58/REQ-031) 재수집 정책 chain 다음 slice — SinceDerivationService 에 applyRecollectionWindow(T-0602) thread 한 backoff variant 메서드 추가. 기존 deriveSince 불변, caller 0"
---

# T-0603 — 재수집 정책: SinceDerivationService 의 R-58 backoff variant 메서드 박제

## Why

PLAN.md 100행(P5)의 **재수집 정책** bullet — "평가 자료 재수집 시 저장 부분 중복 방지. **최근 1주 는 재수집·중복 제거 OK** (data sync 보호, R-58)" = [docs/requirements.md](../requirements.md) REQ-031. 직전 task **T-0602** 가 그 backoff 의 순수 도메인 함수 [`applyRecollectionWindow`](../../src/assessment-collection/domain/recollection-window.ts) (since 경계를 7일 뒤로 물려 다음 수집이 최근 1주를 겹쳐 fetch → dedup 이 흡수)을 박제했고, Out of Scope §1 에 "SinceDerivationService 배선" 을 별도 follow-up slice 로 명시했다.

본 task 는 그 wiring 의 **최소 표면 slice** 를 박제한다 — [`SinceDerivationService`](../../src/assessment-collection/since-derivation.service.ts) 에 **새 메서드** `deriveSinceWithRecollectionWindow(personId, windowDays?)` 를 추가해, 기존 `deriveSince` 결과를 `applyRecollectionWindow` 로 thread 한 R-58-aware variant 를 노출한다. **기존 `deriveSince` 는 그대로 두고** 신규 caller 만 본 variant 를 호출하도록 한다 — 기존 caller(scheduling/assessment-backfill-checker / collection-trigger 등 6 파일) 변경 0, spec 추가만으로 끝나 cap 안 (~80 LOC / 2 파일). caller(스케줄러 · manual trigger)가 본 variant 를 채택하는 wiring 은 cap 분리상 **별도 follow-up slice** 다.

cloud-safe (DB / 네트워크 / live-LLM / credential / env 0 — `findByPerson` 호출은 기존 `deriveSince` 와 동형 mock-주입 unit-test 표면), dependency-free, `dependsOn: []`.

## Required Reading

- `src/assessment-collection/since-derivation.service.ts` — 현 service 본체(43 줄). 기존 `deriveSince(personId)` 의 정확한 형태(직전 Assessment 의 `periodStart` ISO 반환, 신규 인원 `undefined`). 본 task 는 본 파일에 **메서드 1개만 추가** 한다.
- `src/assessment-collection/domain/recollection-window.ts` — T-0602 박제 순수 함수. `applyRecollectionWindow(since: string | undefined, windowDays?: number): string | undefined` 시그너처와 4 분기 계약(`undefined` 패스스루 · 유효 ISO backoff · 파싱 불가 fallback · 비정상 windowDays no-op). 본 메서드의 두 번째 step.
- `src/assessment-collection/since-derivation.service.spec.ts` — 기존 spec(148 줄)의 describe/it 패턴, `makeService(findImpl)` mock 주입 helper, `assessment(periodStart)` minimal fixture. 신규 메서드의 spec 도 본 패턴으로 추가.

## Acceptance Criteria

- [ ] `src/assessment-collection/since-derivation.service.ts` 에 새 메서드 `deriveSinceWithRecollectionWindow(personId: string, windowDays?: number): Promise<string | undefined>` 추가. 본문은 기존 `this.deriveSince(personId)` 호출 후 결과를 `applyRecollectionWindow(raw, windowDays)` 로 thread — 재구현 0, **위임만**. `windowDays` 인자 미지정 시 `applyRecollectionWindow` 의 default `RECOLLECTION_WINDOW_DAYS = 7` 가 적용된다.
- [ ] **기존 `deriveSince` 메서드는 변경 0**. 본 task 는 추가만 — 본 service 의 기존 caller(scheduling/assessment-backfill-checker / collection-trigger 등) 동작 불변.
- [ ] `applyRecollectionWindow` 는 `./domain/recollection-window` 에서 named import. 새 외부 dependency 0 (Node 내장 + 기존 모듈만).
- [ ] **happy-path test 1+**: 직전 Assessment 가 있는 personId → 기존 `deriveSince` 가 반환할 ISO 의 정확히 7일 이전 ISO 를 본 variant 가 반환함을 `toBe` 검증. 명시 `windowDays`(예: 3) 케이스도 1+.
- [ ] **신규 인원 패스스루 test**: 직전 Assessment 가 없는 personId → 본 variant 도 `undefined` 반환 (full collection 의미 보존, `applyRecollectionWindow` 의 `undefined` 패스스루 분기 cover).
- [ ] **분기 cover (flow)**: 본 variant 안의 2 step(`deriveSince` 위임 → `applyRecollectionWindow` 위임) 각각에 대해 입력 분기마다 1+ test. `deriveSince` 측 분기는 기존 spec 이 cover (재검증 불요 명시). `applyRecollectionWindow` 측 분기 — `undefined` 패스스루 / 유효 ISO backoff / 비정상 `windowDays` (예: 0 / 음수) 각 1+ test.
- [ ] **negative cases 충분 cover**: 빈 Assessment 배열(신규 인원) / `windowDays = 0` (no-op = 원본 그대로) / `windowDays = -1` (음수, no-op) / `windowDays` 비정수(예: `1.5`, no-op) 각 1+ test. `findByPerson` reject 가 throw 0 으로 그대로 전파됨도 test 1+ (fail-fast 계약 보존, 기존 `deriveSince` 와 동형).
- [ ] **위임 검증 test**: 본 variant 호출 시 `findByPerson` 이 정확히 1회 호출됨을 `toHaveBeenCalledTimes(1)` + `toHaveBeenCalledWith(personId)` 검증 — 위임이 기존 `deriveSince` 를 그대로 거치는지 확인 (재구현이 끼어들지 않음).
- [ ] **결정론 test**: 동일 personId · 동일 mock 응답 두 번 호출 → 동일 결과(`toBe`/`toEqual`).
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 메서드의 line/branch/func 전 분기 cover.

## Out of Scope

- **caller(scheduling/assessment-backfill-checker / collection-trigger 등) 의 `deriveSince` → `deriveSinceWithRecollectionWindow` 채택 wiring** — 그건 6 파일 영향 + 각 caller spec 갱신이라 cap 초과 risk. **별도 follow-up slice**(commitMode pr) 로 분리. 본 task 는 service-layer variant 메서드 1개 + 그 spec 만.
- `applyRecollectionWindow` 자체 변경 / 추가 분기 — T-0602 의 4 분기 계약 그대로 thread 만. 본 함수에 새 인자나 분기 추가 0.
- `deriveSince` 기존 메서드 변경 — caller 영향 0 보장이 본 task 의 핵심 가드. 기존 spec 갱신 0 (필요 시 새 it 만 append).
- 새 외부 dependency 도입 — Node 내장 + 기존 import 만. 새 package 0.
- timezone(KST/UTC) 경계 보정 — PLAN 110행(KST 확정)의 ADR-first 처리 대상. 본 메서드는 UTC ISO 만(`applyRecollectionWindow` 가 UTC `.toISOString()` 보장).
- DB schema / Prisma migration — 없음(service 메서드 추가만).
- realdata-e2e / live LLM / credential — 본 task 와 무관.
- production 다른 파일 변경 — `since-derivation.service.ts` 1 파일 + colocated spec 1 파일 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
