---
id: T-1737
title: DashboardView 에 기간 평가 성공 후 결과 재조회 배선
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-077]
independentStream: web-dashboard-period-evaluation
dependsOn: [T-1736]
touchesFiles:
  - web/src/views/DashboardView.tsx
  - web/src/views/DashboardView.period-evaluation.test.tsx
estimatedDiff: 300
estimatedFiles: 3
sizeExempt: true
exemptReason: 초과분은 전부 R-112 강제 spec — production 순증 ≤60 LOC 로 억제. T-1734(455) · T-1735(419) · T-1736(356) 선례 승계.
created: 2026-08-28
completedAt: 2026-08-27T16:01:41Z
resultCommit: 5e37019e
resultPr: 1367
plannerNote: 오너 지시 PLAN 131 행 ④ / REQ-077 slice 5b — T-1736 이 신설한 reload 를 제출 성공 분기에 실제로 배선.
---

# T-1737 — DashboardView 에 기간 평가 성공 후 결과 재조회 배선

## Why

오너 지시 [PLAN.md](../PLAN.md) `131 행` ④ (대시보드 실동작 — 기간 지정 평가 UI 호출 경로, REQ-077) 의 분해 **slice 5b** 다. T-1735 가 `DashboardView` 에 기간 평가 제출을 배선했고 T-1736 이 `useApiResource` 에 `reload` 재조회 계약을 신설했으나, `origin/main` 실측상 [DashboardView.tsx](../../web/src/views/DashboardView.tsx) 는 어느 `useApiResource` 호출에서도 `reload` 를 destructuring 하지 않는다 (`grep reload` 결과가 `70 행` 주석 1 건뿐). 즉 사용자가 기간 평가를 요청해 성공해도 결과 표·추이는 **옛 데이터를 그대로** 들고 있어 요청이 반영됐는지 화면으로 확인할 수 없다. 본 slice 는 그 마지막 한 칸을 닫아 REQ-077 의 "UI 호출 경로" 를 사용자 관점에서 완결시킨다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `131 행` (오너 지시 — 대시보드 실동작 ④)
- [docs/requirements.md](../requirements.md) `96 행` (REQ-077)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) — 특히 `442~535 행` (컨테이너 진입 + 5 개 `useApiResource` 호출), `397~440 행` (`derivePeriodEvaluationNotice` · `runPeriodEvaluation`), `655~675 행` (`handlePersonSelect` · `handlePeriodSubmit`)
- [web/src/api/useApiResource.ts](../../web/src/api/useApiResource.ts) — `ApiResourceHandle<T>` (T-1736 이 신설한 `reload` 계약, `path` falsy 시 no-op)
- [web/src/views/DashboardView.period-evaluation.test.tsx](../../web/src/views/DashboardView.period-evaluation.test.tsx) — 본 task 가 확장할 colocated spec (`useApiResource` · `periodEvaluationSubmit` 를 `vi.mock` 으로 치환하는 기존 관례)
- [docs/tasks/T-1736-use-api-resource-reload.md](T-1736-use-api-resource-reload.md) — 선행 slice 5a 의 계약 범위

## Acceptance Criteria

- [ ] `DashboardView` 의 assessments 조회(`path`) 와 summaries 조회(`summariesPath`) 두 `useApiResource` 호출에서 `reload` 를 destructuring 한다 (`reload` / `trendReload` 처럼 기존 변수명 prefix 관례를 따라 상태 오염 없이 분리). 나머지 3 개 호출(contributions · permission-denied · persons)은 본 slice 범위 밖 — diff 0.
- [ ] 기간 평가 제출이 **성공한 경우에만** 위 두 재조회를 호출한다. 판정은 컨테이너가 export 하는 **순수 함수** `shouldReloadAfterPeriodEvaluation(notice)` 이 담당한다 — `success` 문구가 비어있지 않고 `error` 가 비어있을 때만 `true`. throw 0 · 입력 mutation 0 · `react` import 0.
- [ ] 실패·미상 응답(`error` 문구 존재) 에서는 재조회를 호출하지 않는다 — 실패 후 표가 흔들리지 않는다.
- [ ] 재조회 호출은 `reload` 가 함수가 아닐 때(구 mock · 미주입) 값으로 흡수해 컨테이너가 **절대 throw 하지 않는다**.
- [ ] Happy-path test 1+: 성공 notice 로 제출이 끝나면 assessments · summaries 재조회가 각각 1 회 호출됨.
- [ ] Error path test 1+: 제출 모듈이 reject 하는 경우 / 실패 notice 인 경우 각각 재조회 호출 0 회.
- [ ] 분기 test: `shouldReloadAfterPeriodEvaluation` 의 분기 각 1+ — ① 성공 문구만 존재 ② 에러 문구만 존재 ③ 둘 다 빈 값(초기 상태) ④ 둘 다 존재(방어적 — 재조회 안 함).
- [ ] Negative cases 충분 cover (각 1+): ① `notice` 가 `null`/`undefined` ② `notice` 가 문자열·숫자 등 비객체 ③ `success`/`error` 가 문자열이 아닌 타입 ④ `reload` 가 `undefined` 인 handle ⑤ `reload` 가 함수가 아닌 값(문자열 등) ⑥ 제출이 reject 한 뒤에도 컨테이너가 throw 하지 않음.
- [ ] 기존 5 개 `useApiResource` 호출부와 3 개 DashboardView spec(`DashboardView.test.tsx` · `DashboardView.person-selector.test.tsx` · `DashboardView.period-evaluation.test.tsx`) 의 mock 이 **수정 없이 또는 최소 보강만으로** 통과한다 — 호환성 회귀 게이트.
- [ ] `cd web && pnpm test` (vitest) 전량 green.
- [ ] `cd web && pnpm build` (tsc + vite) 성공.
- [ ] 루트 `pnpm lint` 통과.
- [ ] 루트 `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` diff 0 이라 backend coverage 는 불변이어야 한다.
- [ ] `DashboardView.tsx` 의 **production 순증 ≤ 60 LOC**. 초과분은 전부 colocated spec 이어야 하며, §3 상한 초과 시 그 사실을 PR 본문·reviewer comment 에 명시 박제한다 (T-1735 · T-1736 선례).

## Out of Scope

- `web/src/api/useApiResource.ts` 수정 — T-1736 이 확정한 계약을 소비만 한다 (diff 0).
- `web/src/api/periodEvaluationSubmit.ts` · `evaluationPeriod.ts` · `assessmentRow*.ts` 수정.
- `web/src/components/**` 수정 (presentational 컴포넌트 diff 0).
- contributions · permission-denied · persons 조회의 재조회 배선 (별도 필요 시 follow-up).
- 자동 polling · interval 재조회 도입 (`useApiResource` 책임 밖 — ADR-0041 Decision 3).
- `src/` · `prisma/` · `package.json` · lockfile · CI workflow 변경. 새 dependency 0.
- jsdom / @testing-library 도입 (새 dep — ADR-0040 §5 게이트). 기존 `renderToStaticMarkup` + 순수 함수 직접 호출 관례를 유지한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음)

## 결과 (DONE)

- 2026-08-27T16:01:41Z 완료 — PR [#1367](https://github.com/myungjoo/Assessment-Agent/pull/1367) squash 머지 → main `5e37019e`, reviewer round 2/7 APPROVE 후 4-게이트 충족.
- 3 파일 `+330/-3` — production 순증 **59 LOC**(AC 상한 60 준수), 나머지는 전부 colocated spec. 순수 판정 `shouldReloadAfterPeriodEvaluation` + 흡수 호출 `invokeResourceReload` + 조합 `reloadAfterPeriodEvaluation` 신설 후 `handlePeriodSubmit` 에 배선.
- test: web vitest 83 파일 2524 case green, 루트 `pnpm test:cov` 453 suite 13009 case green(backend diff 0), `pnpm lint` · web build 통과. R-112 4 종 전부 cover(happy · error path · 분기 4 종 · negative 6 종 + 배선 source guard 4 종).
- reviewer MINOR-1 은 [CLAUDE.md](../../CLAUDE.md) §3 Nit-in-PR closure 로 같은 PR round 2 에서 완결 — follow-up task 0.
