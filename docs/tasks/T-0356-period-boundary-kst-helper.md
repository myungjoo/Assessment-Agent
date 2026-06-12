---
id: T-0356
title: ADR-0039 KST impl chain 1/5 — src/common/period-boundary.ts boundary helper 신설 (R-112 4종)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004, REQ-034]
estimatedDiff: 280
estimatedFiles: 2
independentStream: adr-0039-kst-impl
dependsOn: []
touchesFiles:
  - src/common/period-boundary.ts
  - src/common/period-boundary.spec.ts
created: 2026-06-13
plannerNote: "ADR-0039 KST chain 1/5 — boundary helper 신설 (single-helper × 1.0 ≈ 280 LOC·2파일); T-0355 credential 보류와 touchesFiles 교집합 0"
---

# T-0356 — ADR-0039 KST impl chain 1/5: `src/common/period-boundary.ts` boundary helper 신설

## Why

[ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) (ACCEPTED, Q-0036 결정 2) 의 §Status impl chain 1번째 — §Decision5 가 권장한 helper 1 점 집중 (`src/common/period-boundary.ts`) 을 실제 박제한다. 이후 chain 2~5 (SinceDerivation / PeriodBridge / R-9 DTO / view-layer formatter) 가 전부 본 helper 를 경유하므로 가장 기반이 되는 slice 다. boundary 계산 중복 (각자 `new Date(...)` / hardcoded `+09:00`) 으로 인한 drift 차단이 목적 (§Decision5).

## Required Reading

- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` — §Decision1 (IANA `Asia/Seoul` 식별자 의무, 단순 `"KST"` string 금지), §Decision3 (4 surface boundary 정의 + 반열림 `[start, end)`), §Decision5 (helper 1 점 집중 + API shape 는 본 task 책임)
- `docs/decisions/ADR-0012-cross-cutting-field-policy.md` §1 — 저장 timezone = UTC single source (본 task 가 **변경 금지** — helper 는 UTC `Date` instant 입출력, boundary 계산만 Asia/Seoul)
- `src/parse-port.ts` + `src/parse-port.spec.ts` — 기존 순수 helper + colocated spec 패턴 (본 task 의 형태 참고)

## 구현 가이드 (ADR-0039 박제 사항)

- **새 dependency 0** — `date-fns-tz` / `Luxon` 등 외부 라이브러리 추가는 §5 BLOCKED 게이트. Node 내장 `Intl.DateTimeFormat`(`timeZone: 'Asia/Seoul'`) 으로 KST wall-clock 변환. hardcoded `+09:00` offset 산술 금지 (§Decision1 — IANA 식별자가 single source).
- **export 권장 shape** (최종 API shape 는 implementer 결정, §Decision5):
  - `KST_TIMEZONE = 'Asia/Seoul'` 상수 export
  - 일별: KST 자정 기준 `[T00:00+09:00, 다음날 T00:00+09:00)` (§Decision3 (a))
  - 주간: KST **월요일** 00:00 시작 (§Decision3 (b), 일요일 시작 금지)
  - 월간: KST 매월 1일 00:00 시작, 28~31일 가변 길이 산술 (§Decision3 (c))
  - period range 산출: granularity(daily/weekly/monthly) + 임의 instant → 반열림 `{ start, end }` (ADR-0035 §Decision3 `[periodStart, periodStart + 1 granularity)` 정합)
  - R-9 입력 parser: ISO string 의 offset 명시 (`Z` / `+09:00`) 시 그대로, **미명시 시 Asia/Seoul 로 해석** (§Decision3 (d)), malformed 입력은 명시적 error
- 모든 함수의 입출력 `Date` 는 UTC instant — KST 는 계산 내부에만 존재 (ADR-0012 §1 보존).

## Acceptance Criteria

- [ ] `src/common/period-boundary.ts` 신설 — `Asia/Seoul` IANA 상수 + 일/주/월 boundary 계산 + period range (반열림) + R-9 default 해석 parser export. `package.json` 변경 0 (새 dependency 0).
- [ ] §Decision3 semantics 검증 가능: 예 `2026-06-10T15:00:00Z` (= KST 6/11 자정) 가 6/11 일별 구간의 start 가 되는 등 UTC↔KST 9시간 drift 경계가 spec 으로 박제.
- [ ] colocated `src/common/period-boundary.spec.ts` — 모든 export public symbol 에 happy-path test 1+.
- [ ] 각 symbol 의 error path test 1+ — `Invalid Date` 입력 / malformed ISO string / 미지원 granularity 값 등.
- [ ] 분기마다 test 분리 — offset 명시 vs 미명시 parse, daily/weekly/monthly 각 granularity, 월 길이 28~31 (2월 포함) / 연·월·주 경계 넘어가는 instant.
- [ ] negative cases 충분 cover — 빈 문자열, type mismatch 성 입력, KST 자정 직전/직후 (UTC 14:59:59.999Z vs 15:00:00Z) 경계값, 일요일 시작이 아님(월요일 시작) 검증 각 1+.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green (CI 전 step — push 후 PR CI green 확인).

## Out of Scope

- chain 2~5: `SinceDerivationService` / `PeriodBridge*` / R-9 DTO parsing / view-layer formatter 의 helper 경유 refactor — 후속 task (본 task 는 helper 신설만, 호출처 결선 0).
- 새 외부 dependency 추가 (`date-fns-tz` 등) — §5 게이트, 필요 판단 시 BLOCKED.
- 사용자별 timezone preference / multi-tenant 확장 (ADR-0039 §Alternatives (3) 기각).
- 1주 재수집 window 보정 (Q-0026 잔여 — ADR-0029/0035 후속 책임).
- **T-0355 (credential 보류 중) 의 touchesFiles 일절 금지** — `.github/workflows/ci.yml` / `scripts/check-spec-presence*` / `package.json` (coverage 설정 포함) / `test/smoke/web-static*` / `docs/architecture/directory.md` / `web/` 변경 0 (동시 진행 대비 교집합 0 유지).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0039 가 design 박제 완료, API shape 만 implementer 결정).

## Follow-ups

(생성 시점 비어 있음)
