---
id: T-0825
title: PLAN.md P8 E2E 시나리오 커버리지 bullet implemented-on-main checkbox 정합
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-113]
touchesFiles: [docs/PLAN.md]
dependsOn: []
independentStream: plan-shipped-drift-sync
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
plannerNote: P8 line145 E2E 시나리오 커버리지 bullet [ ] stale — test/e2e/ 19 e2e-spec 전량 shipped-on-main, T-0809~0824 drift 패턴 mirror, direct doc-only
---

# T-0825 — PLAN.md P8 E2E 시나리오 커버리지 bullet implemented-on-main checkbox 정합

## Why

PLAN.md line 145 의 `- [ ] E2E 시나리오 커버리지` bullet 이 미완료 `[ ]` 로 표기돼 있으나, 실제로는 origin/main 의 `test/e2e/` 에 19 개 e2e-spec 파일(auth·assessments·contributions·groups·parts·persons·summaries·period-bridge 3종·permission-denied·users·export-download·unevaluated-fill 2종·user-instance-access 2종·assessment-collection-trigger·app)이 이미 shipped 돼 있어 **PLAN↔shipped-code drift** 상태다. 이는 README R-113 (unit 외 smoke + end-to-end test 도 CI 에서 함께 수행) 을 cover 하는 e2e 시나리오 커버리지가 광범위하게 완결됐음에도 checkbox 가 stale 하게 남은 것으로, T-0809~T-0824 fire 들이 교정해 온 것과 **동일한 drift 패턴**이다. 미교정 시 미래 planner 가 이미 완결된 e2e 시나리오 방향을 재큐잉하는 make-work risk 가 있다. 본 task 는 checkbox 를 `[x]` 로 정합하고 implemented-on-main 근거 절을 append 한다.

## Required Reading

- `docs/PLAN.md` line 145 (교정 대상 bullet) 및 인접 line 146 (보안 점검, implemented-on-main 근거 절 형식 참고), line 147 (운영 문서 implemented-on-main 근거 절) — append-only 로 인접 bullet 무손상 유지, 근거 절 서술 형식 mirror.
- `docs/tasks/T-0823-plan-p8-import-export-restore-implemented-on-main.md` (직전 drift-correction task 의 근거 절 서술·검증 절차 패턴 참고).
- `test/e2e/` 디렉토리 목록 — 교정 근거로 인용할 대표 e2e-spec 파일 실존 확인용. 대표: `auth.e2e-spec.ts`, `assessments.e2e-spec.ts`, `groups.e2e-spec.ts`, `persons.e2e-spec.ts`, `summaries.e2e-spec.ts`, `period-bridge-admin-persist.e2e-spec.ts`, `permission-denied-records.e2e-spec.ts`, `export-download.e2e-spec.ts`, `user-instance-access.e2e-spec.ts`.
- `.github/workflows/ci.yml` (e2e step `pnpm test:e2e` 가 CI 에서 실행됨을 근거 절에 명시하기 위해 — R-113 "CI 에서 함께 수행" cover 확인).

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 145 의 `- [ ] E2E 시나리오 커버리지` 를 `- [x]` 로 변경. (`grep -n "E2E 시나리오 커버리지" docs/PLAN.md` 로 `[x]` 확인)
- [ ] 같은 bullet 에 `**implemented-on-main**:` 근거 절 append — 다음을 명시: `test/e2e/` 에 19 e2e-spec 시나리오 커버리지(인증 `auth.e2e-spec.ts` · 평가 `assessments.e2e-spec.ts` · 기여 `contributions.e2e-spec.ts` · 그룹/파트/인원 `groups`/`parts`/`persons.e2e-spec.ts` · 요약 `summaries.e2e-spec.ts` · 임의기간 평가 `period-bridge-admin-persist`/`ephemeral`/`reevaluate.e2e-spec.ts` · 권한거부 audit `permission-denied-records.e2e-spec.ts` · export streaming `export-download.e2e-spec.ts` · 미평가 채움 `unevaluated-fill-plan`/`run.e2e-spec.ts` · 인스턴스 접근 `user-instance-access`/`audit-roundtrip.e2e-spec.ts` · 수집 트리거 `assessment-collection-trigger.e2e-spec.ts`) + `.github/workflows/ci.yml` 의 `pnpm test:e2e` step 으로 CI 에서 자동 수행(R-113). 대표 시나리오만 나열하되 전체 shipped 임을 명시.
- [ ] 교정 전 `git ls-tree origin/main test/e2e/` 로 e2e-spec 파일 실존 재확인 — false-positive flip 방지 (executor 가 실측 후 flip). 근거 절에 인용하는 파일은 반드시 실존 확인된 것만.
- [ ] 인접 bullet(line 146 보안 점검 / line 147 운영 문서 / line 148 부하·내성 테스트) 무손상 — append-only, diff 는 line 145 국한 (근거 절 append 로 소폭 증가).
- [ ] `docs/PLAN.md` 파일이 유효한 markdown 유지 (체크박스 렌더링 정상).

분기 없음 — 단일 doc-only checkbox+근거 절 정합이라 R-112 코드 test 항목 비적용 (direct doc-only commit, CLAUDE.md §3.2 doc-only 면제).

## Out of Scope

- `test/e2e/` 코드 변경 금지 — 본 task 는 PLAN.md 문서 정합만. 새 e2e-spec 작성 금지.
- line 148 (부하·내성 테스트) 정합 금지 — 실제 부하 테스트 인프라 미shipped 판정 대상으로, 별도 검토 필요 (의도적 `[ ]` 유지).
- P7 line 137 (성능 검증 R-91/R-92) 정합 금지 — 별개 phase bullet, 별도 판정.
- 새 ADR 작성 금지 (링크만).
- STATE.json counters / flags 변경 금지 (driver 담당).

## Suggested Sub-agents

`implementer` 만 (direct doc-only 1 파일 정합 — architect/tester 불요). executor 가 직접 처리 가능.

## Follow-ups

(없음 — 생성 시 비어있음)
