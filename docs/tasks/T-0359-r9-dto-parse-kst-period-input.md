---
id: T-0359
title: ADR-0039 KST impl chain 4/5 — R-9 사용자 지정 기간 입력이 parseKstPeriodInput 경유 (offset 미명시 → Asia/Seoul default)
phase: P5
status: DONE
mergedAs: b68822c
prNumber: 291
reviewRounds: 1
commitMode: pr
coversReq: [REQ-004, REQ-034]
estimatedDiff: 150
estimatedFiles: 3
independentStream: adr-0039-kst-impl
dependsOn: [T-0356, T-0357, T-0358]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
created: 2026-06-12
plannerNote: "ADR-0039 KST chain 4/5 — R-9 입력 parseKstPeriodInput 소비: 실코드 확인 결과 helper 는 박제됐으나 production 소비자 0, 컨트롤러가 raw new Date(periodStart) 사용 — §Decision3(d) offset-default KST 미적용 (R-112 backbone × 1.0 ≈ 150 LOC); T-0355 교집합 0"
---

# T-0359 — ADR-0039 KST impl chain 4/5: R-9 사용자 지정 기간 입력이 `parseKstPeriodInput` 경유

## Why

[ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) §Status impl chain 4번째 = §Decision5 의 helper 경유 의무 컴포넌트 (iii) **R-9 사용자 지정 기간 DTO parsing** (입력 timezone 해석) 이다. 실코드 확인 결과: T-0356 helper 의 `parseKstPeriodInput` (§Decision3 (d) — offset 명시 시 그대로, **미명시 시 Asia/Seoul 해석**) 은 완전 구현·unit-test 됐으나 **production 소비자가 0** 이다. R-9 입력 surface (`PeriodBridgeDto.periodStart`) 를 받는 controller `period()` (chain 3/5 가 배선한 `normalizeKstPeriodStart`) 와 `evaluate()` 의 context 조립은 둘 다 여전히 **raw `new Date(dto.periodStart)`** 로 파싱한다 — 이는 offset 미명시 ISO string 을 JS 엔진 default (UTC 또는 locale, **Asia/Seoul 아님**) 로 해석해 §Decision3 (d) 와 9 시간 drift 를 만든다.

본 slice 는 그 raw `new Date(...)` 호출을 `parseKstPeriodInput(...)` 으로 교체해, offset 미명시 사용자 입력이 §Decision3 (d) 의 Asia/Seoul default 로 해석되게 한다. 효과: (1) `2026-06-10T15:00` (offset 없음) 같은 입력이 사용자 직관 (KST 15시 = `2026-06-10T06:00:00Z`) 으로 해석돼 이후 KST boundary snap (chain 3/5) 과 정합, (2) 잘못된 입력 (달력 불가능 값 / 범위 외 offset) 이 helper 의 명시적 error 로 거부돼 silent Invalid Date 진입 차단. helper 1 점 집중 (§Decision5) 을 R-9 입력 surface 까지 완결한다.

## Required Reading

- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` — §Decision3 (d) (R-9 입력 offset 명시 권장 / 미명시 시 Asia/Seoul 해석 — 예 `2026-06-10T15:00` → `2026-06-10T06:00:00Z`), §Decision5 (helper 경유 의무 컴포넌트 (iii) R-9 DTO parsing, boundary/해석 중복 금지)
- `src/common/period-boundary.ts` — T-0356 helper. `parseKstPeriodInput(input: string): Date` (offset 명시 → 그대로, 미명시 → Asia/Seoul, malformed → TypeError/RangeError), `getKstPeriodRangeByPeriod(period, instant)` (chain 3/5 가 snap 에 사용)
- `src/common/period-boundary.spec.ts` L109~141 — `parseKstPeriodInput` 의 happy/negative 계약 (본 task 는 helper spec 을 변경하지 않고 controller-level 소비만 검증)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 수정 대상. `normalizeKstPeriodStart` (L214~216, `new Date(periodStart)` 사용) + `evaluate()` 의 context 조립 (L184, `new Date(dto.periodStart)`)
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — colocated spec (배선 정합 검증 패턴 — 본 KST 해석 검증 추가 대상)
- `docs/decisions/ADR-0012-cross-cutting-field-policy.md` §1 — 저장 timezone = UTC single source (본 task 변경 금지 — 입력 해석 출력은 UTC Date instant)

## 구현 가이드

- **교체 지점 = controller 의 raw `new Date(periodStart)` 2 곳**:
  - (a) `normalizeKstPeriodStart(period, periodStart)` 내부 — 현재 `getKstPeriodRangeByPeriod(period, new Date(periodStart)).start`. `new Date(periodStart)` 를 `parseKstPeriodInput(periodStart)` 로 교체해, snap 입력 instant 가 §Decision3 (d) Asia/Seoul-default 로 해석된 UTC Date 가 되게 한다. (period() 의 Admin/User 양 분기가 이 helper 1 곳을 공유하므로 한 곳 교체로 둘 다 수렴.)
  - (b) `evaluate()` 의 context 조립 (`periodStart: new Date(dto.periodStart)`) — `parseKstPeriodInput(dto.periodStart)` 로 교체. (evaluate 는 boundary snap 을 하지 않는 직접 평가 경로지만, periodStart 좌표 해석은 동일하게 R-9 KST default 를 따라야 좌표 정합.)
- **helper 1 점 집중 (§Decision5)** — controller 안에서 `new Date(...)` 로 R-9 입력 string 을 재파싱하지 않는다. 모든 R-9 입력 string → Date 변환은 `parseKstPeriodInput` 1 곳 경유. import 1 줄 추가 (`parseKstPeriodInput`).
- **error 전파 정합** — `parseKstPeriodInput` 은 malformed (형식 위반 / 달력 불가능 / 범위 외 offset) 입력에 `RangeError`, 비문자열/빈 입력에 `TypeError` 를 throw 한다. DTO `@IsISO8601` 이 형식을 1차 거부하므로 도달 입력은 대부분 valid 하나, helper error 는 raw 전파 (swallow 0) 한다 — NestJS 가 응답 매핑. `new Date` 의 silent Invalid Date (NaN) 보다 명시적 error 가 안전.
- **공개 contract 불변** — `period()` / `evaluate()` 의 path/메서드/요청 DTO (`PeriodBridgeDto` / `EvaluateActivitiesDto`)/응답 shape 유지. service signature 변경 0. 해석은 controller orchestration 안에서만.
- **jsdoc 동기** — `normalizeKstPeriodStart` jsdoc 의 "raw `dto.periodStart`(ISO string)이 가리키는 instant" 표현을 "`parseKstPeriodInput` 으로 §Decision3 (d) Asia/Seoul-default 해석한 instant" 로 한 줄 동기 (도큐 정합 — 동작 서술 갱신).
- **새 dependency 0** — helper 가 Node 내장 Intl 만 사용. `package.json` 변경 금지.

## Acceptance Criteria

- [ ] controller 가 R-9 입력 `periodStart` string 을 `parseKstPeriodInput` 1 곳 경유로 Date 변환한다 — `normalizeKstPeriodStart` 와 `evaluate()` context 조립 양쪽에서 raw `new Date(dto.periodStart)` / `new Date(periodStart)` 가 제거됨 (inspect: controller 에 `parseKstPeriodInput` import + 두 호출 지점에서 사용).
- [ ] happy-path test 1+ — offset 미명시 입력 (`2026-06-10T15:00`) 이 Asia/Seoul 로 해석돼 KST 좌표/snap 으로 흐름을 검증 (예: `period()` Admin 분기 또는 `evaluate()` 의 context `periodStart` 가 `2026-06-10T06:00:00.000Z` 기반으로 산출). offset 명시 입력 (`...Z` / `+09:00`) 은 그대로 해석됨 1+.
- [ ] error path test 1+ — malformed `periodStart` (예 달력 불가능 값 / 범위 외 offset) 가 helper 의 `RangeError` 로 전파 (위임 미호출) + 비-ISO 류 입력 거부. helper TypeError 전파 경로 1+.
- [ ] 분기 cover — `period()` Admin vs User dispatch 가 둘 다 KST-default 해석된 좌표를 사용 각 1+, `evaluate()` 경로의 context periodStart KST 해석 1+, offset 명시 vs 미명시 입력 분기 각 1+.
- [ ] negative cases 충분 cover — offset 미명시 KST 자정 경계 입력 (`2026-06-10` → `2026-06-09T15:00:00.000Z` KST 자정), 미명시 시 UTC 가 아니라 KST 로 해석됨 (drift 회귀 차단) 검증, malformed 입력 거부, 빈/type mismatch 성 입력 거부 각 1+.
- [ ] `normalizeKstPeriodStart` jsdoc 이 `parseKstPeriodInput` 경유 §Decision3 (d) Asia/Seoul-default 해석을 반영 (inspect — 도큐 동기).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) + `pnpm lint && pnpm build` green (push 후 PR CI green 확인).

## Out of Scope

- chain 5/5 — view-layer formatter (조회 endpoint 응답 직렬화 / P6 Web UI 표시 layer, §Decision4 default Asia/Seoul). 본 task 는 **입력** 해석만 (출력 표시 0).
- `parseKstPeriodInput` 의 내부 로직 / `period-boundary.spec.ts` 변경 — helper 는 T-0356 에서 완결됐고 본 task 는 controller-level 소비만 추가 (helper spec 변경 0).
- `PeriodBridgeDto` / `EvaluateActivitiesDto` 의 `@IsISO8601` 형식 검증 외 추가 boundary 강제 — DTO 는 형식만, 해석은 controller orchestration.
- `collection-trigger.service.ts` L75 의 `new Date(periodStart)` — R-9 사용자 입력 surface 가 아니라 collection trigger 내부 좌표 (도출된 since) 라 본 task 밖. R-9 입력 해석은 controller 의 사용자-facing 입력 지점만. (필요 판단 시 Follow-up.)
- `SinceDerivationService` 변경 (boundary 산술 0 — ADR-0039 도 Out of scope) / 1 주 재수집 window (Q-0026 잔여, ADR-0029/0035 후속).
- 새 외부 dependency 추가 (`date-fns-tz` 등) — §5 BLOCKED 게이트.
- **T-0355 (credential 보류 중) 의 touchesFiles 일절 금지** — `.github/workflows/ci.yml` / `scripts/check-spec-presence*` / `package.json` / `test/smoke/web-static*` / `docs/architecture/directory.md` / `web/` 변경 0 (교집합 0 유지).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0039 가 design 박제 완료, helper 소비 배선 위치만 implementer 결정).

## Follow-ups

(생성 시점 비어 있음)
