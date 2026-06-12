---
id: T-0360
title: ADR-0039 KST impl chain 5/5 — view-layer formatter (저장 UTC instant → Asia/Seoul 표시 포맷) helper 박제
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004, REQ-034, REQ-038]
estimatedDiff: 165
estimatedFiles: 2
independentStream: adr-0039-kst-impl
dependsOn: [T-0356, T-0357, T-0358, T-0359]
touchesFiles:
  - src/common/period-boundary.ts
  - src/common/period-boundary.spec.ts
created: 2026-06-13
plannerNote: "ADR-0039 KST chain 5/5 — view-layer formatter(§Decision4/§Decision5 comp(iv)): 실코드 확인 결과 helper 에 KST 표시 formatter 미존재·read endpoint 는 raw UTC ...Z 직렬화·P6 Web UI consumer 미존재 → 보수 scope = helper 1점집중에 formatKst display formatter 신설(R-112 backbone × 1.0 ≈ 165 LOC); T-0359 controller 파일·T-0355 교집합 0"
---

# T-0360 — ADR-0039 KST impl chain 5/5: view-layer formatter (저장 UTC instant → Asia/Seoul 표시 포맷)

## Why

[ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) §Status impl chain 의 **마지막 5번째 = §Decision5 의 helper 경유 의무 컴포넌트 (iv) view-layer formatter** (조회 endpoint 응답 / Web UI 표시 layer) 다. chain 1~4 (T-0356 helper / T-0357 period-evaluable / T-0358 PeriodBridge snap / T-0359 R-9 **입력** 해석) 가 전부 머지됐고, 본 slice 는 **출력/표시 side** 를 닫는다 — §Decision4 "모든 조회 endpoint / Web UI 의 시각 표시 default = Asia/Seoul (KST)".

실코드 확인 결과: (1) `src/common/period-boundary.ts` 에는 boundary 계산 (`startOfKstDay` 등) + 입력 파싱 (`parseKstPeriodInput`) 은 있으나 **저장 UTC instant 를 Asia/Seoul 기준 사람-가독 문자열로 포맷하는 exported formatter 가 부재**하다. (2) read endpoint (`GET /api/assessments`, `GET /api/assessments/:id`, contribution/summary 조회) 는 Prisma row 를 가공 0 으로 forward 해 Date 필드가 default JSON 직렬화로 **UTC `...Z`** 만 노출한다 (offset 명시 안 됨). (3) P6 Web UI 의 표시 consumer 는 아직 bare scaffold (web/ 최소 SPA, ADR-0040) 라 실 표시 component 0 이다.

§Decision4 는 응답 JSON 의 시각 필드는 UTC `...Z` 그대로 또는 `+09:00` 명시 (어느 쪽이든 동일 instant) 를 허용하되 **사용자 가독 표시 (UI label / formatted string) 는 Asia/Seoul 기준 포맷을 default** 로 쓰라고 박제한다. 따라서 view-layer/P6 Web UI 가 소비할 **KST 표시 formatter 를 §Decision5 helper 1 점 집중 위치 (`src/common/period-boundary.ts`) 에 신설**하는 것이 본 chain 의 마지막 backbone wire 다 — boundary/입력/표시 4 컴포넌트가 모두 helper 1 곳을 경유한다는 §Decision5 요구를 완결한다. 본 slice 는 helper 의 표시 formatter 박제 + R-112 unit test 까지이며, P6 Web UI 의 실 표시 component 배선은 P6 frontend (ADR-0040) 책임으로 둔다 (Out of Scope).

## Required Reading

- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` — §Decision4 (시각화 표시 timezone default = Asia/Seoul: 응답 JSON 은 UTC `...Z` 또는 `+09:00` 어느 쪽이든 가능, **가독 표시 string 은 Asia/Seoul 기준 default**; 포맷/locale 분리는 P6 frontend 책임), §Decision5 (helper 1 점 집중 + 경유 의무 컴포넌트 (iv) view-layer formatter — boundary/표시 중복 산술 금지), §Decision2 (저장 UTC 보존 — formatter 입력은 UTC Date instant, 변환 0)
- `src/common/period-boundary.ts` L1~70 — 기존 helper 구조. `KST_TIMEZONE = "Asia/Seoul"` const, module-level `kstFormatter` (Intl.DateTimeFormat, h23 hourCycle), `assertValidDate(value, fnName)` (Invalid Date / 비-Date → TypeError), `toKstWallClock(instant)` (UTC instant → KST wall-clock). **본 task 의 formatter 는 이 기존 const/helper 를 재사용** (새 Intl formatter 중복 생성 / hardcoded `+09:00` 산술 금지 — §Decision5 drift 차단)
- `src/common/period-boundary.spec.ts` — colocated spec. 기존 boundary/parse 함수의 happy/negative 패턴 (테스트 구조 mirror 대상)
- `docs/decisions/ADR-0012-cross-cutting-field-policy.md` §1 — 저장 timezone = UTC single source (본 task 변경 금지 — formatter 는 저장값 미변경, 표시 string 만 산출)

## 구현 가이드

- **신설 위치 = `src/common/period-boundary.ts` 1 곳** (§Decision5 helper 1 점 집중). 새 파일 / 새 모듈 생성 0 — 기존 helper 에 exported display formatter 함수를 추가한다.
- **함수 시그니처 (implementer 결정 — 아래는 권장 형태)**: 저장 UTC `Date` instant 를 받아 Asia/Seoul 기준 사람-가독 문자열을 반환하는 exported 함수. 예: `formatKstDisplay(instant: Date): string` — `"2026-06-10 15:00:00"` 같은 KST wall-clock 표시. (Locale-aware 한글 포맷 "2026 년 6 월 10 일 (수)" / chart axis 형식은 §Decision4 가 명시적으로 P6 frontend 책임으로 분리 → 본 task 밖. 본 task 는 **기계적으로 안정적인 KST wall-clock 표시 string** 1 형태만 — 추가 format variant 는 P6 frontend ADR 결정.)
- **선택: `+09:00` offset 명시 ISO string formatter** — §Decision4 가 "응답 JSON 의 시각 필드는 `...Z` 또는 `+09:00` 명시 어느 쪽이든 동일 instant" 를 허용하므로, 표시 string 외에 **Asia/Seoul offset 을 명시한 ISO-8601 string** (예 `2026-06-10T15:00:00+09:00`) 을 산출하는 보조 formatter 도 같은 helper 에 둘 수 있다 (view-layer 가 offset-명시 JSON 을 선택할 때 사용). implementer 가 두 formatter 모두 필요로 판단하면 박제하되, **cap (≤ 300 LOC / ≤ 5 파일) 안**에서. 불필요하다 판단되면 가독 표시 formatter 1 종으로 한정 (Out of Scope 에 보조 formatter 명시).
- **기존 helper 재사용 (§Decision5)** — `kstFormatter` / `toKstWallClock` / `KST_TIMEZONE` const / `assertValidDate` 를 재사용한다. 새 `Intl.DateTimeFormat` 인스턴스를 중복 생성하거나 hardcoded `+09:00` 산술로 offset 을 더하지 않는다 (drift 차단 backbone — §Decision1 IANA 식별자 single source).
- **저장값 불변 (§Decision2 / ADR-0012 §1)** — formatter 는 입력 `Date` 를 변형하지 않고 string 만 산출한다. 저장 timezone (UTC) 정책 변경 0 — read endpoint 의 raw row 직렬화도 본 task 가 바꾸지 않는다 (formatter 신설만; controller 배선은 Out of Scope — P6 Web UI 가 helper 를 import 해 표시 시 적용).
- **error 전파 정합** — Invalid Date / 비-Date 입력은 기존 `assertValidDate` 패턴으로 명시 `TypeError` (silent `Invalid Date` 문자열 반환 금지 — R-112 negative 분기).
- **새 dependency 0** — Node 내장 `Intl` 만 사용. `package.json` 변경 금지.

## Acceptance Criteria

- [ ] `src/common/period-boundary.ts` 에 저장 UTC `Date` instant 를 Asia/Seoul 기준 사람-가독 string 으로 포맷하는 exported formatter 가 박제됨 (inspect: `export function formatKst...`). 기존 `KST_TIMEZONE` / `kstFormatter` / `toKstWallClock` 를 재사용 (새 Intl 인스턴스 중복 생성 0 / hardcoded `+09:00` 산술 0 — §Decision5).
- [ ] happy-path test 1+ — 알려진 UTC instant 가 Asia/Seoul wall-clock 표시로 정확히 포맷됨 검증 (예: `2026-06-10T06:00:00Z` → KST `2026-06-10 15:00:00` 류 표시 — UTC+9 적용 확인). 서로 다른 시각대 (자정/정오/저녁) 각 1+.
- [ ] error path test 1+ — Invalid Date (`new Date("nope")`) / 비-Date (null·undefined·string) 입력이 `TypeError` 로 거부됨 (silent `"Invalid Date"` string 반환 안 함) 1+.
- [ ] 분기 cover — formatter 가 다루는 분기 (예: 보조 offset-명시 formatter 도 박제 시 그 경로 / valid vs invalid 입력 분기) 각 1+. (단일 무분기 formatter 면 "valid vs invalid 입력 2 분기" 로 cover; 분기 없는 부분은 본문에 "분기 없음" 명시.)
- [ ] negative cases 충분 cover — KST 자정 경계 (`2026-06-09T15:00:00Z` → KST `2026-06-10 00:00:00`, 자정이 `24` 아닌 `00` 으로 표시 — h23 정합) / UTC 가 아니라 KST 로 표시됨 (UTC `...Z` 그대로 노출 회귀 차단) / Invalid Date 거부 / type mismatch (비-Date) 거부 각 1+.
- [ ] (보조 formatter 박제 시) Asia/Seoul offset 명시 ISO string formatter 가 `+09:00` 를 명시하고 동일 instant 를 보존함 (round-trip: 산출 string 을 다시 `parseKstPeriodInput` 또는 `new Date` 로 파싱 시 원 instant 와 동등) 1+. 보조 formatter 미박제 시 본 항목 생략 (본문 명시).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) + `pnpm lint && pnpm build` green (push 후 PR CI green 확인).

## Out of Scope

- **read endpoint / controller 배선 변경** (`src/user/assessment.controller.ts` 등의 응답 직렬화에 formatter 적용) — 본 task 는 helper formatter **신설** 만. read endpoint 의 raw UTC `...Z` 직렬화는 §Decision4 가 허용 (응답 JSON 은 `...Z` 가능) 하므로 변경 0. 표시 적용은 P6 Web UI 가 helper 를 import 해 수행.
- **P6 Web UI 표시 component 배선** (web/ SPA 에서 formatter 호출해 label 렌더) — P6 frontend (ADR-0040) 책임. 본 task 는 backend helper 까지.
- **locale-aware 한글 포맷** ("2026 년 6 월 10 일 (수)") / chart axis hover timestamp 형식 / 다양한 format variant — §Decision4 가 명시적으로 P6 frontend ADR 책임으로 분리. 본 task 는 기계적 KST wall-clock 표시 string 1 형태 (+ 선택적 offset-명시 ISO 1 형태) 만.
- **사용자별 timezone preference** (multi-tenant / 조직별 tz 선택) — ADR-0039 §Alternatives (3) 기각, 별도 ADR + schema migration 게이트.
- **저장 timezone 정책 변경** (`@db.Timestamptz` 격상 등) — ADR-0012 §1 책임, 본 ADR/본 task 밖.
- **기존 boundary/parse 함수 (`startOfKstDay` / `getKstPeriodRange` / `parseKstPeriodInput`) 로직 변경** — chain 1~4 에서 완결. 본 task 는 표시 formatter 추가만 (기존 함수 signature/동작 불변).
- **새 외부 dependency 추가** (`date-fns-tz` / `Luxon` 등) — §5 BLOCKED 게이트. Node 내장 `Intl` 만.
- **T-0355 (credential 보류 중) 의 touchesFiles 일절 금지** — `.github/workflows/ci.yml` / `scripts/check-spec-presence*` / `package.json` / `test/smoke/web-static*` / `web/` / `docs/architecture/directory.md` 변경 0 (교집합 0 유지 — 본 task 는 `src/common/period-boundary.{ts,spec.ts}` 2 파일만).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0039 §Decision4/§Decision5 가 design 박제 완료, formatter shape/위치만 implementer 결정. helper 는 기존 파일이라 colocated spec `src/common/period-boundary.spec.ts` 1 곳에 test 추가).

## Follow-ups

(생성 시점 비어 있음)
