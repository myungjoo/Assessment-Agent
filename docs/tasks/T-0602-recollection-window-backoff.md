---
id: T-0602
title: 재수집 정책 — 최근 1주 재수집 window backoff 순수 도메인 함수 (R-58)
phase: P5
status: DONE
mergedAs: e0beedd
prNumber: 515
reviewRounds: 1
commitMode: pr
coversReq: [REQ-031]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-23
independentStream: p5-recollection-window
dependsOn: []
touchesFiles:
  - src/assessment-collection/domain/recollection-window.ts
  - src/assessment-collection/domain/recollection-window.spec.ts
plannerNote: "P5 PLAN 100행(R-58/REQ-031) 재수집 정책 slice — SinceDerivationService Out-of-Scope(L17~18)가 deferred 한 '최근 1주 재수집 window' 의 순수 backoff 함수. 서비스 wiring 은 별도 follow-up"
---

# T-0602 — 재수집 정책: 최근 1주 재수집 window backoff 순수 도메인 함수 (R-58)

## Why

PLAN.md 100행(P5)의 **재수집 정책** bullet — "평가 자료 재수집 시 저장 부분 중복 방지. **최근 1주 는 재수집·중복 제거 OK** (data sync 보호, R-58)" = [docs/requirements.md](../requirements.md) REQ-031 (PLANNED, P5, unit).

현재 incremental 수집 경계는 [src/assessment-collection/since-derivation.service.ts](../../src/assessment-collection/since-derivation.service.ts) 의 `deriveSince(personId)` 가 직전 Assessment 의 `periodStart`(마지막 수집 경계)를 그대로 ISO 문자열로 반환한다. 이 service 의 Out of Scope(파일 L17~18)는 명시적으로 적는다 — "**1 주 재수집 window** / timezone 보정은 P5/P7(REQ-058) — 본 service 는 직전 periodStart 단순 도출만." 즉 R-58 이 요구하는 "최근 1주는 항상 재수집(겹쳐 fetch → dedup 이 중복 제거)" backoff 가 아직 비어 있다.

본 task 는 그 gap 을 **순수 도메인 함수 1 개**로 채운다 — 도출된 `since` 경계를 **최근 1주만큼 뒤로 물려(backoff)** 반환해, 다음 수집이 직전 경계의 최근 1주를 다시 가져오게 한다. 이 겹침은 이미 main 에 박제된 dedup(`commit-dedup.ts` earliest-wins / `page-dedup.ts` latest-wins)이 흡수하므로 "저장 부분 중복 방지 + 최근 1주 재수집 OK" 가 동시에 성립한다. 함수는 순수(부수효과 0 / DB·네트워크·env·LLM 0)라 cloud cron 자율·dependency-free 다. service 가 본 함수를 소비하도록 배선하는 것은 service-layer + DB 호출 경계라 **별도 follow-up slice**(commitMode 동일 pr, 본 task 의 Out of Scope).

## Required Reading

- `src/assessment-collection/since-derivation.service.ts` — `deriveSince` 가 반환하는 `since`(직전 `periodStart` 의 `.toISOString()`, 또는 신규 인원 `undefined`) 의 정확한 형태·의미. 본 함수의 입력 계약이 이것과 정합해야 한다(특히 `undefined` = full collection 패스스루).
- `src/assessment-collection/domain/commit-dedup.ts` — `isEarlier` 의 `Date.parse` 우선 + NaN 사전식 fallback 패턴(파싱 불가 timestamp 방어). 본 함수도 동형 방어 처리로 비정상 ISO 문자열을 결정적으로 다룬다. 순수 도메인 함수의 JSDoc·주석·입력 비변형 스타일 직접 모델.
- `src/assessment-collection/domain/page-dedup.ts` (head) — 같은 domain 디렉토리의 순수 함수 파일 구조·colocated spec 명명·describe/it 패턴 참고(가장 가까운 대칭).

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/recollection-window.ts` 신설. 순수 함수 export — 예: `applyRecollectionWindow(since: string | undefined, windowDays?: number): string | undefined`. 부수효과 0 / DB·네트워크·env·LLM·Prisma·`@Injectable` 0 / 외부 dependency 0 / 입력 mutate 0. `windowDays` 기본값은 R-58 의 "최근 1주" = 7(상수로 명명, magic number 금지).
- [ ] **backoff 의미**: 유효 ISO `since` 가 주어지면 그 timestamp 에서 `windowDays` 일을 뺀 새 ISO-8601 문자열(UTC, `.toISOString()` 형식)을 반환한다 — 다음 수집이 직전 경계의 최근 `windowDays` 일을 다시 fetch 하게 만든다. 시각 산술은 `Date` 의 epoch millis(`getTime() - windowDays*86400000`) 기반으로 결정적.
- [ ] **`undefined` 패스스루**: 입력 `since === undefined`(신규 인원 = full collection) 이면 backoff 없이 `undefined` 그대로 반환(full collection 의미 보존).
- [ ] **happy-path test 1+**: 유효 ISO `since`(예: `2026-06-23T00:00:00.000Z`) + 기본 window → 정확히 7일 이전 ISO 문자열 반환을 `toBe` 로 검증. 명시 `windowDays`(예: 3) 케이스도 1+.
- [ ] **error/negative path test 1+ (각 분기별)**:
  - `since === undefined` → `undefined` 반환(패스스루 분기).
  - 파싱 불가 ISO 문자열(예: `"not-a-date"`) → `commit-dedup.ts` `isEarlier` 동형 방어 정책에 따른 **결정적** 동작(원본 반환 또는 명시적 throw — 구현 시 택1하고 JSDoc·spec 에 의미 박제. 비결정·`NaN` ISO 출력 금지). 택한 정책을 test 로 고정.
  - `windowDays` 가 음수/0/비정수 등 비정상 값 → 결정적 처리(0 또는 음수 backoff 의 의미를 JSDoc 에 박제하고 test 로 고정 — 예: ≤0 이면 backoff 0 = 원본 그대로).
- [ ] **flow / branch cover**: `undefined` 분기 / 유효 ISO 분기 / 파싱 불가 분기 / 비정상 `windowDays` 분기 각 1+ test 로 모든 분기 실행.
- [ ] **negative cases 충분 cover**: `undefined` · 빈 문자열 · 공백-only · 파싱 불가 문자열 · 음수 windowDays · 0 windowDays · 비정수 windowDays 각 1+ test. 단일 negative 만 작성 금지 — 분기마다 cover.
- [ ] **결정론·무공유 test**: 동일 입력 두 번 호출 → 동일 결과(`toBe`/`toEqual`). 입력은 primitive 라 mutate 표면 없음(검증 불요 명시) — 단 반환이 항상 새 문자열/`undefined` 임을 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper 의 line/branch/func 전 분기 cover.

## Out of Scope

- **SinceDerivationService 배선** — `deriveSince` 가 본 함수를 소비해 backoff 된 since 를 반환하도록 service 를 고치는 것은 service-layer + 기존 spec 영향이라 **별도 follow-up slice**(commitMode pr). 본 task 는 순수 함수 + colocated spec 만.
- 실 수집 호출 / `CollectionEntryService.collectForPerson` 변경 — 인자로 흐를 since 의 산술만, 실 fetch 0.
- dedup 자체 변경 — `commit-dedup.ts` / `page-dedup.ts` 는 이미 겹침을 흡수하므로 그대로. 본 함수는 겹침을 *만드는* backoff 만 담당.
- timezone(KST/UTC) 경계 보정 — PLAN 110행(KST 확정)의 ADR-first 처리 대상. 본 함수는 UTC epoch 산술만(`.toISOString()`). KST 경계 보정은 그 ADR 진입 시 별도.
- 신규 인원 1년치 1회 평가(REQ-027, P7) — 본 함수와 무관(full collection `undefined` 패스스루로만 접점).
- 외부 라이브러리(date-fns / dayjs 등) 도입 — 새 dependency 0, Node 내장 `Date` 만.
- production `src/` 다른 파일 변경 — 신규 domain 파일 1 + spec 1 단독.
- DB schema / migration — 없음(순수 함수).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시점)
