---
id: T-0817
title: PLAN.md P5 timezone=KST 확정 bullet implemented-on-main checkbox 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-034, REQ-031, TBD]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-reconcile
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5 line110 timezone=KST 확정 bullet — ADR-0050/0051/0052 + period-boundary.ts + user.timezone 컬럼 전량 shipped-on-main, T-0812~0816 drift 패턴 mirror, direct doc-only
---

# T-0817 — PLAN.md P5 timezone=KST 확정 bullet implemented-on-main checkbox 정합

## Why

PLAN.md Phase P5 의 line 110 "timezone = KST(Asia/Seoul) 확정 반영" bullet 이 아직 `[ ]` (미완) 로 표기돼 있으나, 사용자 결정(2026-06-11)의 적용 대상 — 일/주/월 요약 경계·주간/월간 시작 판정·R-9 기간 해석·시각화 표시 — 이 전부 origin/main 에 shipped 됐다. 이 bullet 은 "ADR-first 로 처리"를 명시했고 그 ADR(ADR-0050/0051/0052) 및 구현 chain(T-0798~T-0803, `src/common/period-boundary.ts`, `period-evaluable.ts`, user.timezone 컬럼/migration)이 모두 머지 완료 상태다. 최근 진행 중인 plan-drift-reconcile 스트림(T-0809/0811~0816 이 P3/P4/P5/P7 bullet 을 동일 방식으로 정합)의 자연스러운 다음 정합 대상이다. checkbox `[ ]`→`[x]` + implemented-on-main 근거 절 append 로 PLAN↔shipped-code drift 를 교정한다.

## Required Reading

- `docs/PLAN.md` line 110 (P5 timezone=KST 확정 bullet — 본 task 의 유일 편집 대상)
- `docs/PLAN.md` line 96~97 (인접 P5 bullet 의 implemented-on-main 절 서술 포맷 참조 — mirror 할 문체)
- `docs/decisions/ADR-0050-timezone-kst-period-boundary.md` (KST 기간 경계 표준, ACCEPTED, relatedTask T-0798)
- `docs/decisions/ADR-0051-user-configurable-timezone.md` (user-configurable timezone)
- `docs/decisions/ADR-0052-user-timezone-storage.md` (per-user timezone 저장)
- `src/common/period-boundary.ts` (KST(Asia/Seoul) 경계 계산 helper — 실측 확인용)
- `src/assessment-evaluation/domain/period-evaluable.ts` (요약 경계 KST 판정 — 실측 확인용)
- `prisma/schema.prisma` line 178~186 (User.timezone 컬럼, `@default("Asia/Seoul")`)

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 110 의 timezone=KST bullet checkbox `[ ]` → `[x]` 로 변경.
- [ ] 해당 bullet 에 **implemented-on-main** 근거 절 append — 다음 shipped 경로를 각 1+ 근거로 명시: (1) ADR-0050 (KST 기간 경계 표준: 저장=UTC timestamptz 유지 + 경계 계산·표시만 +09:00 KST 변환, 주 시작=월요일 ISO 8601, 반열림 `[start, end)`), (2) ADR-0051 (user-configurable timezone) + ADR-0052 (per-user timezone 저장), (3) `src/common/period-boundary.ts` (KST 경계 계산 helper) + `src/assessment-evaluation/domain/period-evaluable.ts` (일/주/월 요약 경계 KST 판정), (4) `prisma/schema.prisma` User.timezone 컬럼(`@default("Asia/Seoul")`, migration `20260706000000_user_timezone`, ADR-0052). 인접 line 96~97 의 implemented-on-main 절 문체를 mirror.
- [ ] 편집은 line 110 **국한** — 인접 bullet(line 106/107/108/109) 및 P5 헤더 무손상 (append-only, `[ ]`→`[x]` + 절 추가만).
- [ ] 근거로 인용하는 모든 경로(ADR-0050/0051/0052 파일, period-boundary.ts, period-evaluable.ts, schema.prisma:186)를 origin/main 에서 `git grep`/`git ls-tree` 로 실존 재확인 후 박제 — false-positive flip 0 (실제 shipped 확인 없이 checkbox flip 금지).
- [ ] `docs/STATE.json` 의 `nextTask`/`currentTask` 등은 driver 가 갱신하므로 본 task executor 는 PLAN.md 만 편집.

## Out of Scope

- 코드 변경 일절 없음 (direct doc-only). `src/`·`prisma/`·`test/`·ADR 신설/수정 금지.
- line 110 외 다른 미완 bullet(line 98 R-9 custom period / line 106 R-64 부분 완료 / line 108 live-LLM bridge / line 109 실 e2e github 데이터)의 checkbox 는 건드리지 않는다 — 각각 별도 판정 필요(일부는 genuinely 미구현).
- ADR-0050/0051/0052 의 status 나 내용 수정 금지 (이미 ACCEPTED, 참조만).
- STATE.json counters 갱신은 driver 책임 (§9 single-writer).

## Suggested Sub-agents

direct doc-only tiny task — executor 가 직접 편집 (implementer/tester 불요). driver 가 direct commit + main push.

## Follow-ups

(none at creation)
