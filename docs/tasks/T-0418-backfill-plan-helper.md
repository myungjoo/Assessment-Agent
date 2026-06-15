---
id: T-0418
title: 신규 인원 1년치 backfill plan 산출 순수 helper (P7 ⑤ slice 1)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-027]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-15
independentStream: p7-backfill
dependsOn: []
touchesFiles:
  - src/scheduling/backfill-plan.ts
  - src/scheduling/backfill-plan.spec.ts
plannerNote: "P7 ⑤(R-50 REQ-027 신규 인원 1년치 1회 backfill) backlogNote split — slice 1 = 1년치 weekly window 산출 순수 helper(DB/배선 0), pr"
---

# T-0418 — 신규 인원 1년치 backfill plan 산출 순수 helper (P7 ⑤ slice 1)

## Why

PLAN.md Phase P7 의 "신규 인원 추가 시 1년치 평가 1회 (R-50 / REQ-027) — 일반 인원의 매일 1주일 단위 평가와 분리" bullet 의 첫 slice. 신규 인원이 추가되면 일반 주기(매주 1회) 와 별도로 과거 ~1년치를 1회 backfill 해야 한다. 본 task 는 그 backfill 의 **무엇을 평가할지** — 즉 기준 시점(신규 인원 add 시점 또는 "now") 으로부터 직전 ~1년을 **주 단위 window 목록**으로 산출하는 순수 함수를 박제한다. DB·trigger·실 평가 호출은 본 task 밖(아래 Follow-ups slice 2~3). slice 1 을 순수 helper 로 분리해 단위 테스트로 경계값·중복·역순 정렬을 완전 cover 한 뒤, 후속 slice 가 이 helper 출력을 소비하도록 한다.

## Required Reading

- `docs/PLAN.md` (Phase P7 — "신규 인원 추가 시 1년치 평가 1회 (R-50)" bullet)
- `docs/requirements.md` (REQ-027 행 — "신규 인원 1년치 평가 1회 (일반은 1주 단위)")
- `src/common/period-boundary.ts` — `startOfKstWeek` / `getKstPeriodRange` / `PeriodRange` / `KST_TIMEZONE`. 본 helper 는 주 경계 산출을 반드시 이 KST helper 로 위임한다 (ADR-0039 §Decision5 — boundary 계산 single source, hardcoded +09:00 산술 금지).
- `src/scheduling/cron-schedule.service.ts` — colocated spec 패턴·주석 스타일 참고 (동일 module 내 신규 파일이 따를 convention).

## Acceptance Criteria

- [ ] `src/scheduling/backfill-plan.ts` 신설. export 하는 순수 함수 `buildBackfillPlan(reference: Date, weeks?: number): PeriodRange[]` 1개 (weeks 기본값 = 52 — 약 1년). 동작:
  - 기준 instant `reference` 가 속한 KST 주를 포함해 직전 `weeks` 개의 주 단위 `PeriodRange` (`{ start, end }` 반열림 [start, end)) 를 산출한다. 주 경계는 `period-boundary.ts` 의 `startOfKstWeek` / `getKstPeriodRange("weekly", ...)` 로만 도출한다 (자체 offset 산술 금지).
  - 반환 배열은 **시간순 (가장 오래된 주가 index 0)** 으로 정렬한다. 인접 window 는 경계가 맞닿되 겹치지 않는다 (앞 window 의 `end` == 다음 window 의 `start`).
  - 반환 길이는 정확히 `weeks` 개.
- [ ] `weeks` 인자 검증 분기: 정수가 아니거나 ≤ 0 이면 `RangeError` (또는 명시 예외) throw. 상한 가드(예: > 520 = 10년 초과) 도 분기로 두고 거부 — abuse / 과도 backfill 방지.
- [ ] `reference` 가 `Date` instance 가 아니거나 Invalid Date 면 `TypeError` throw (period-boundary 의 `assertValidDate` 동형 — 직접 검증 또는 helper 호출로 전파).
- [ ] colocated spec `src/scheduling/backfill-plan.spec.ts` 신설. R-112 4종 + negative cover:
  - happy-path: 기본 호출(`weeks` 생략 = 52) 이 52개 window 반환, index 0 이 가장 오래된 주, 마지막이 reference 주, 인접 window 경계 맞닿음(앞 end == 다음 start) 단언.
  - error-path: Invalid Date / 비-Date `reference` → `TypeError`, `weeks` = 0 / 음수 / 소수 / NaN / 상한 초과 → 각각 throw 단언 (negative case 분기마다 1+ — 단일 negative 금지).
  - flow/branch: `weeks` 명시(예: 1, 4) 케이스로 길이·정렬 분기 cover. `weeks` = 1 (경계: 단일 window = reference 주) 단언.
  - negative 충분 cover: 윤년·월말 경계를 가로지르는 reference(예: 3월 첫째 주 → 직전 해 겹침) 로 window 가 KST 주 경계로 정확히 snap 되는지(겹침·누락 0) 검증.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 본 파일 분기 전수 cover 로 100% 목표).

## Out of Scope

- DB persistence / Prisma schema 변경 — backfill 결과를 어디에 영속화할지(별도 Assessment row? flag?) 는 slice 3 책임. 본 task 는 schema 무변경.
- "신규 인원 추가" 이벤트 hook / PersonService 연동 / trigger 배선 — slice 2 책임 (본 helper 출력을 소비). `src/user/` 무변경.
- 실 평가/수집 호출 (`collectForPerson` / 평가 pipeline) 결선 — slice 2~3. 본 helper 는 window 목록만 산출하고 아무 것도 실행하지 않는다.
- cron / SchedulerRegistry 연동 — 일반 주기와 분리된 1회성 backfill 이므로 cron 등록 불요. SchedulingModule 의 module wiring 변경 0 (순수 helper 파일만 추가, provider 등록은 slice 2 에서 필요 시).
- timezone 재논의 — KST 는 ADR-0039 로 확정. 본 helper 는 그 helper 를 재사용만 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
- (예상 slice 2) 신규 인원 추가 시 backfill 1회 trigger 배선 — PersonService create hook 또는 별도 manual backfill endpoint 가 `buildBackfillPlan` 출력을 `collectForPerson`/평가 경로로 소비. "1회만" 보장(중복 backfill 방지) 정책 동반.
- (예상 slice 3) backfill 결과 영속화 + 일반 주기와의 분리 표식(REQ-027 "일반은 1주 단위" 와 구분). schema 게이트 재확인.
- (예상 slice 4) api.md / data-model.md doc-sync.
