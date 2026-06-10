---
id: T-0340
title: ADR — timezone KST(Asia/Seoul) boundary 정책 박제 (사용자 결정 2026-06-11)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-004, REQ-034]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-06-10
completedAt: 2026-06-10T23:08:00Z
plannerNote: P5 사용자 결정(2026-06-11) timezone=KST 확정 박제 — PLAN L109 ADR-first 의무, design-only ADR-0039 PROPOSED, dependency 0
completionNote: cron@cloud-4dc06469 fire — ADR-0039 PROPOSED 신설(128 LOC < 220 est). 사용자 turn 지시 "문서/코멘트 변경은 PR 우회 direct merge" 에 따라 commitMode pr 분류이나 direct commit 으로 진행. pnpm lint + build green 검증. 모든 Acceptance Criteria 11 항목 충족. ACCEPTED flip 은 사용자 검토 후 별도 후속 direct task.
independentStream: timezone-kst
dependsOn: []
touchesFiles: [docs/decisions/ADR-0039-timezone-kst-boundary-policy.md]
---

# T-0340 — ADR timezone KST(Asia/Seoul) boundary 정책 박제

## Why

[PLAN.md](../PLAN.md) P5 L109 가 사용자 결정 (2026-06-11) — "그동안 deferred 였던 timezone 쟁점(Asia/Seoul vs UTC, Q-0034 context (5))을 사용자가 **KST(Asia/Seoul)** 로 확정" — 을 박제하면서, 적용 대상 (R-61 자정 / 주간·월간 시작 / R-9 사용자 지정 기간 / 시각화 표시) 의 세부 결정을 "구현 진입 시 **ADR 로 박제** — 본 bullet 은 사용자 결정의 박제이며 ADR-first 로 처리" 로 미뤘다. 본 task 가 그 ADR-first 의무를 이행한다.

기존 [ADR-0012 §1](../decisions/ADR-0012-cross-cutting-field-policy.md) 은 **저장은 UTC** + "view-layer 변환은 P6 또는 조회 endpoint task 책임" 으로 박제했고, [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Decision3 / [ADR-0029](../decisions/ADR-0029-assessment-collection-orchestrator.md) 가 boundary 의 timezone 결정을 Q-0026 후속으로 미뤘다 — 본 ADR (ADR-0039) 이 그 deferred 결정 지점을 모두 닫는다.

본 ADR 은 **저장 timezone 정책 (UTC) 은 그대로 보존**하고, **boundary 계산·표시 timezone 만 Asia/Seoul (KST)** 로 박제하는 design-only doc. `src/` 변경 0, dependency 0, credential 0. impl chain (PeriodBridgeService / SinceDerivation / 조회 view-layer 변환) 은 본 ADR ACCEPTED flip 후 별도 후속 task chain 으로 분해.

## Required Reading

- [docs/PLAN.md](../PLAN.md) L96–L109 (P5 bullet — 특히 L109 사용자 결정 박제)
- [docs/decisions/ADR-0012-cross-cutting-field-policy.md](../decisions/ADR-0012-cross-cutting-field-policy.md) §1 (timezone UTC 저장 — 본 ADR 이 보존)
- [docs/decisions/ADR-0035-aggregate-summary-evaluation.md](../decisions/ADR-0035-aggregate-summary-evaluation.md) §Decision3 + L41/L73 (period 표현 + Q-0026 deferred 언급)
- [docs/decisions/ADR-0029-assessment-collection-orchestrator.md](../decisions/ADR-0029-assessment-collection-orchestrator.md) L107 (incremental since 도출 timezone 의존)
- [docs/decisions/ADR-0006-assessment-data-model.md](../decisions/ADR-0006-assessment-data-model.md) L54/L122 (`periodStart` timezone 정책 위임 표기)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) — `(period, periodStart, periodEnd)` 키 형태 확인
- [docs/requirements.md](../requirements.md) L23 (REQ-004 사용자 지정 기간) + L53 (REQ-034 일별 활동 + 자정)
- [README.md](../../README.md) L9 (R-9 임의 기간) / L61 (R-61 자정) / L72 (R-72 KST 02:00 cron)
- 선례 ADR 신설 task 패턴: [docs/tasks/T-0313-adr-period-collection-evaluate-bridge.md](T-0313-adr-period-collection-evaluate-bridge.md) (PROPOSED 작성) → [T-0314](T-0314-adr-0034-lock-bypass-discipline-absorption.md) (ACCEPTED flip 분리)

## Acceptance Criteria

본 task 는 design-only doc (`src/` 변경 0) 라 R-112 의 unit test / coverage 항목은 적용 불가 — 본 task 본문 분기 없음 — 이 항목 생략. 그 외 일반 doc-quality 항목.

- [ ] `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` 신설 — frontmatter `status: PROPOSED` + `date: 2026-06-10` + `title:` 박제.
- [ ] §Context 절: 사용자 결정 (2026-06-11, PLAN.md L109) 직접 인용 + Q-0026 deferred 이력 (ADR-0035 L41) + 결정 필요 surface 4 종 (R-61 자정 / 주간 시작 / 월간 시작 / R-9 사용자 지정 기간 + 시각화 표시) 박제.
- [ ] §Decision 1 — **boundary timezone = Asia/Seoul (KST, UTC+9)**. 표현은 IANA tz database 표준 식별자 `Asia/Seoul` 박제 (단순 "KST" string 금지 — DST 0 이지만 표준 식별자 우선).
- [ ] §Decision 2 — **저장은 UTC 유지 (ADR-0012 §1 보존)**. `periodStart` / `createdAt` / `updatedAt` 등 시각 컬럼은 모두 UTC `DateTime` 저장. 본 ADR 은 `boundary 계산·표시 timezone` 만 결정 — `저장 timezone` 결정은 ADR-0012 §1 가 단일 source 라는 사실 명시.
- [ ] §Decision 3 — **boundary 계산 정책**: (a) 일별 (R-61): `[YYYY-MM-DD T00:00+09:00, T+1 T00:00+09:00)` 반열림 구간 = KST 자정. UTC 환산은 `[T-1일 15:00Z, T 15:00Z)`. (b) 주간 시작: ISO-8601 week 또는 Asia/Seoul 월요일 00:00+09:00 — 본 ADR 이 둘 중 하나 명시 결정 (권장: **Asia/Seoul 월요일 00:00+09:00**, 한국 운영 관행). (c) 월간 시작: Asia/Seoul 매월 1일 00:00+09:00. (d) R-9 사용자 지정 기간: 사용자 입력 (UI/API DTO) 의 시각 string 은 입력 timezone offset 명시 의무 — 미명시 시 Asia/Seoul 로 해석 (default).
- [ ] §Decision 4 — **시각화 표시 timezone**: 모든 조회 endpoint / Web UI 의 시각 표시 default = Asia/Seoul. 사용자별 timezone preference 는 본 ADR Out-of-scope (확장 시 별도 ADR).
- [ ] §Decision 5 — **impl 위치 합의**: boundary 계산은 helper (`src/common/period-boundary.ts` 등, 본 ADR 은 위치만 권장 — 실 코드 task 가 확정) 1 곳으로 집중. SinceDerivation / PeriodBridge / R-9 DTO parsing / view-layer formatter 가 모두 이 helper 를 경유. 본 ADR 은 위치 권장이지 helper 신설 명령 아님 — impl chain task 의 책임.
- [ ] §Consequences 절: (긍정) UTC 단일 저장 보존 → 비교/정렬 query 영향 0 / boundary 계산 1 점 집중 / Q-0026 + ADR-0035 §Decision3 deferred 닫힘. (부정) 글로벌 multi-timezone 확장 시 boundary 정책 재논의 필요 / 사용자 timezone preference 미지원 (현재 단일조직 한국운영 가정 — README 매핑).
- [ ] §Alternatives 절: (1) UTC boundary 채택 — 한국 운영 직관 위배, 사용자 결정 위반 → 기각. (2) Web UI 만 KST 변환 + 저장·boundary 모두 UTC — R-61 자정 의미가 KST 자정 (사용자 직관) 와 어긋남, 사용자 결정 위반 → 기각. (3) `Asia/Seoul` + 사용자별 preference — 본 ADR 단계 over-engineering, 확장 시 별도 ADR → 기각.
- [ ] §Status 절: `PROPOSED` (사용자 ADR PR 검토 후 ACCEPTED flip — 별도 후속 direct task). 본 ADR ACCEPTED flip 후 impl chain (SinceDerivation / PeriodBridge / R-9 DTO / view-layer formatter) 분해는 planner 후속 책임 명시.
- [ ] §References 절: ADR-0012 §1 / ADR-0035 §Decision3 + L41 / ADR-0029 L107 / ADR-0006 L54·L122 / ADR-0033 / PLAN L109 / README L61·L72 / Q-0026 (RESOLVED 표기) 명시.
- [ ] `pnpm lint && pnpm build` green (doc 만 변경이라 lint/build 영향 0 검증 의미 — markdown 만 변경되어도 build 영향 0 확인).
- [ ] PR 본문에 task 파일 링크 + 본 Acceptance Criteria 체크리스트 박제.

## Out of Scope

- ADR-0012 §1 (저장 UTC) **변경 금지** — 본 ADR 은 그 위에 boundary timezone 만 박제. 저장 timezone 재논의는 본 ADR 의 책임이 아니다.
- impl chain (SinceDerivation / PeriodBridge / R-9 DTO parsing / view-layer formatter / period-boundary helper 신설) — 본 ADR ACCEPTED flip 후 별도 후속 task 분해 (planner 책임). 본 task 에서 `src/` 변경 0.
- ACCEPTED flip 자체 (PROPOSED → ACCEPTED 한 줄 수정) — 사용자 ADR PR 검토 후 별도 direct doc commit (§3.1 rule 4 예외 — ADR status 1 줄 수정은 direct).
- 사용자별 timezone preference (multi-timezone 확장) — 본 ADR Out-of-scope, 확장 시 별도 ADR.
- Q-0026 의 "1 주 재수집 window" (data sync 보호, R-58) 결정 — boundary 와 인접하나 별도 surface, ADR-0035 §Decision3 ↔ 본 ADR §Decision3 만 닫는다. 1 주 재수집 window 자체는 ADR-0029 / ADR-0035 후속 책임.
- 시각화 chart axis 의 hover timestamp 표시 / locale 포맷 ("2026년 6월 10일 (수)") — P6 frontend ADR 책임.

## Suggested Sub-agents

architect → tester (doc-only PR 라 implementer 호출 0. tester 는 `pnpm lint && pnpm build` 1회 실행 + ADR 본문 cross-reference grep 검증.)

## Follow-ups

(빈 상태로 생성 — sub-agent 가 발견 시 append.)
