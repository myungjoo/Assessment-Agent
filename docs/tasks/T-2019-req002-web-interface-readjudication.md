---
id: T-2019
title: REQ-002 재판정 + PLAN P6 deferred 잔여 stale 정정 — Web Interface 축 실측 반영
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-002]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-09-11
independentStream: req-002-web-interface-readjudication
dependsOn: [T-1849]
touchesFiles: [docs/requirements.md, docs/PLAN.md]
plannerNote: P6 · REQ-002 맨 IN_PROGRESS(T-0401 이후 근거 0)의 잔여 3 건 전부 머지 → 1 회 재판정 + PLAN 124·126·127 행 stale, direct
---

# T-2019 — REQ-002 재판정 + PLAN P6 deferred 잔여 stale 정정 (Web Interface 축 실측 반영)

## Why

README `6 행` 은 "AA (Assessment-Agent)는 Web Interface를 제공하는 Agent System 이다" 이다. 이 행에 대응하는 요구표 행과 PLAN P6 절이 실측과 어긋나 있다.

- [requirements.md](../requirements.md) `21 행` **REQ-002** 의 상태 칸은 근거 문장 없이 맨 `IN_PROGRESS` 뿐이다. 이 값은 [T-0401](T-0401-requirements-md-p6-status-doc-sync.md)(2026-06-14)이 적었다. 당시 사유는 "backend-게이트 잔여(ReEval/Schedule/auto-polling) + perf 검증(P7) 미완이라 부분 완료" 였다(T-0401 AC 의 REQ-002 항목). 그 뒤 이 행은 한 번도 재판정되지 않았다(`git log origin/main -G '^\| REQ-002 ' -- docs/requirements.md` 결과는 파일을 통째로 들인 `74263daf` 1 건뿐이고, 그 뒤 행 내용 변경은 0 이다).
- T-0401 이 든 backend-게이트 잔여 3 건은 **전부 머지됐다** (origin/main `f837d5ba` 실측):
  - SchedulePanel 배선 — [T-0885](T-0885-wire-schedule-panel-adminview.md) DONE, `web/src/views/AdminView.tsx` `169~173 행` import.
  - ReEvaluationTriggerPanel 배선 — [T-0886](T-0886-wire-reevaluation-trigger-panel-adminview.md) DONE, 같은 파일 `174 행` 이후.
  - 평가 진행 배너 자동 polling — [T-1849](T-1849-appshell-run-status-polling.md) DONE, `web/src/AppShell.tsx` `41 행` `fetchRunStatus` import · `406 행` 호출 · `416 행` `visibilitychange`.
- T-0401 의 나머지 사유 "perf 검증(P7) 미완" 은 REQ-047(`66 행`) · REQ-048(`67 행`) 이 따로 추적한다. README `6 행` 은 시스템 형태 선언이라 성능 축을 이 행에서 다시 셀 근거가 없다.
- PLAN P6 절도 같은 잔여를 아직 미해소로 적는다. `124 행` 은 "자동 polling 은 backend status 계약 미shipped 로 defer", `126 행` 은 "남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer" 라고 적는다. 그런데 같은 PLAN `134 행` ④ 는 T-1849 로 "2026-09-02 shipped" 라고 적는다. `127 행` 은 "web vitest CI 배선(T-0355)은 `onHold: credential-workflow-scope` 로 게이트됨" 이라고 적는다. 실제로는 [T-0405](T-0405-p6-ci-web-build-test-step.md) DONE 이 `.github/workflows/ci.yml` `217~224 행`(`Web 빌드` · `Web 단위 test` step)을 배선했다. 한 문서 안에서 서로 모순된다.

**once-rule 정합** — REQ-002 를 `coversReq` 로 둔 구현 slice 의 잔여가 모두 머지된 뒤의 첫 재판정이다(CLAUDE.md §3.1, REQ 당 1 회). 구현 전 재판정이 끼어든 적도 없다. PLAN `124` · `126` · `127 행` 정정은 같은 잔여를 가리키는 arc 무관 drift 정정이다. 두 파일 모두 같은 실측(잔여 3 건 머지 + web CI 배선)에 근거하므로 한 task 로 묶는다. 나누면 같은 실측을 두 번 반복하게 된다(PLAN `183 행` 오너 지시의 왕복 제거 취지).

**status 는 미리 정하지 않는다.** 아래 AC 의 축별 실측이 결정한다. 다만 판정 원칙은 하나로 고정한다.

- README `6 행` 은 "Web Interface 를 제공한다" 는 시스템 형태 선언이다. 인증(REQ-043) · 권한(REQ-045 · 046 · 073) · 성능(REQ-047 · 048) · 개별 화면 기능(REQ-038 · 075~083 등)은 각자 행이 따로 추적한다. 그 행들의 잔여를 REQ-002 에 **다시 세지 않는다**. 특히 인원 · 그룹 · 파트 20 route guard 부재(T-2017 Follow-ups (a))는 REQ-043 계열 잔여다.
- 검증 위치 칸은 `smoke + e2e` 다. 브라우저 구동 e2e(Playwright 류)는 신규 외부 dependency 라 CLAUDE.md §5 게이트 대상이다. 그 부재를 잔여로 볼지 범위 밖 hardening 으로 볼지를 셀에 **명시적으로 분류**한다(선례: [T-2015](T-2015-req050-switch-e2e-readjudication.md) 가 실 gateway e2e 를 범위 밖 hardening 으로 분류).

**cap 근거** — 2 파일에서 기존 행을 셀 · 문장 단위로 고친다. doc-only enumerated-section × 1.6 × inline-amend × 0.4 = × 0.64 이고, base 약 45 LOC 이므로 약 30 LOC 다. 행 교체라 diff 는 +4/-4 안팎이다. helper · 소비처 신설이 0 이라 CLAUDE.md §3 소비처 동반 의무에 걸리지 않는다.

## Required Reading

- [README.md](../../README.md) `6 행` — 대상 요구 원문
- [docs/requirements.md](../requirements.md) `1~19 행`(운영 룰 · 상태 enum · 검증 위치 enum · 7 컬럼 헤더), `21 행` REQ-002(수정 대상), `62 행` REQ-043 · `66 행` REQ-047 · `67 행` REQ-048(중복 계상 금지 확인용 — 수정 대상 아님)
- [docs/tasks/T-0401-requirements-md-p6-status-doc-sync.md](T-0401-requirements-md-p6-status-doc-sync.md) — AC 의 REQ-002 항목(현 `IN_PROGRESS` 의 원 사유)
- [docs/PLAN.md](../PLAN.md) `124 행` · `126 행` · `127 행`(수정 대상), `128 행`(web coverage threshold 게이트 — 여전히 유효, 수정 대상 아님), `134 행` ④(auto polling shipped 서술)
- SPA 실재 축: `web/src/main.tsx` · `web/src/App.tsx` · `web/src/AppShell.tsx`(`41 행` · `406 행` · `416 행`) · `web/src/views/AdminView.tsx`(`169~174 행`)
- backend serve 축: [src/web/web.module.ts](../../src/web/web.module.ts) `30 행` `resolveServeStaticOptions` · `47 행` `@Module`, [src/app.module.ts](../../src/app.module.ts) `49~50 행`
- smoke 축: [test/smoke/web-static.smoke-spec.ts](../../test/smoke/web-static.smoke-spec.ts) `70` · `80` · `90` · `101` · `121 행`(it 5 개 — happy · SPA fallback · API 우선 · 404 negative · dist 부재 skip 분기)
- e2e 축: [test/e2e/app.e2e-spec.ts](../../test/e2e/app.e2e-spec.ts) `33 행` · `42~43 행`
- CI 축: [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `217~224 행`(Web 빌드 · Web 단위 test), `243 행`(`pnpm test:smoke`), `321 행` · `358~367 행`(Docker 빌드 + 컨테이너 런타임 smoke, GET / 200)
- [docs/tasks/T-2017-req045-046-073-rbac-person-group-part-readjudication.md](T-2017-req045-046-073-rbac-person-group-part-readjudication.md) — 직전 재판정의 셀 작성 형식(축 나열 · 좌표 재현 · 구조 보존 AC)

## Acceptance Criteria

**공통 · 구조 보존**

- [ ] [docs/requirements.md](../requirements.md) 는 `21 행` **1 행만** 수정한다. `git diff -U0 docs/requirements.md` 의 hunk 가 이 행에만 걸린다(다른 REQ 행 · 헤더 · 운영 룰 무접촉).
- [ ] 표 구조를 보존한다. 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84**, `wc -l < docs/requirements.md` = **121**(수정 전과 동일), `sed -n '21p' docs/requirements.md | tr -cd '|' | wc -c` = **8** 이다. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] `21 행` 은 **상태 칸만** 바꾼다. REQ ID · README 행(`6`) · 요약 · kind(`FR`) · 구현 위치(`P6 / P3`) · 검증 위치(`smoke + e2e`) 5 칸은 글자 그대로 둔다.

**REQ-002 축별 실측 (각 축은 좌표 1 개 이상을 셀에 적고, executor 가 origin/main 에서 재현 확인한다)**

- [ ] ① **SPA 실재 축** — `web/src/main.tsx` 진입점 · `web/src/AppShell.tsx` 셸 · Dashboard · Admin view 가 main 에 있다. 좌표를 재현한다.
- [ ] ② **backend serve 축** — `src/web/web.module.ts` `resolveServeStaticOptions`(dist 존재 시에만 ServeStatic 등록)와 `src/app.module.ts` 의 WebModule 등록 좌표를 재현한다.
- [ ] ③ **T-0401 잔여 해소 축** — T-0401 이 든 잔여 3 건(SchedulePanel · ReEvaluationTriggerPanel · 자동 polling)이 T-0885 · T-0886 · T-1849 로 머지됐음을 task ID 와 코드 좌표로 적는다. "perf 검증(P7)" 사유는 REQ-047 · REQ-048 행이 추적한다고 한 문장으로 분리한다.
- [ ] ④ **smoke 축** — `test/smoke/web-static.smoke-spec.ts` 의 it 5 개 좌표를 재현한다. 그리고 CI 에서 dist 부재 skip 분기가 발화하지 않는다는 사실을 `ci.yml` step 순서(`Web 빌드` `219 행` 이 `pnpm test:smoke` `243 행` 보다 앞)로 확인해 적는다. Docker 런타임 smoke(`358~367 행`, GET / 200)도 좌표로 적는다. 순서가 실측과 다르면 그 사실을 그대로 적고 ④ 를 미충족으로 둔다.
- [ ] ⑤ **e2e 축** — `test/e2e/app.e2e-spec.ts` 의 HTTP 계약 단언(`33 행` · `43 행`)을 재현한다. e2e 환경은 dist 부재라 SPA serve 단언을 smoke 가 맡는다는 `42 행` 주석을 근거로 적는다. 브라우저 구동 e2e 0 건은 신규 dependency(§5) 게이트 대상임을 적고, 잔여인지 범위 밖 hardening 인지 **한쪽으로 명시 분류**한다.
- [ ] ⑥ **web CI 축** — `ci.yml` `222~224 행` `pnpm --filter web test` step 이 T-0405 로 배선돼 web vitest 가 CI 에서 돈다는 사실을 적는다.
- [ ] **판정** — ①~⑥ 이 모두 재현되고 ⑤ 의 브라우저 e2e 를 범위 밖 hardening 으로 분류하면 `DONE`, 하나라도 재현이 안 되거나 브라우저 e2e 를 잔여로 분류하면 `IN_PROGRESS` 로 두고 잔여를 이름과 좌표로 특정한다. 어느 쪽이든 셀 첫머리에 "T-2019 재판정 — T-0401 잔여 3 건(T-0885 · T-0886 · T-1849) 머지 후 1 회" 를 적는다.
- [ ] **중복 계상 금지** — 셀에 인원 · 그룹 · 파트 20 route guard 부재, 성능 임계, 개별 화면 기능 잔여를 REQ-002 의 미충족 사유로 적지 않는다. 필요하면 "REQ-043 · 045 · 046 · 073 · 047 · 048 행이 추적" 이라는 pointer 한 문장만 둔다.

**PLAN P6 절 stale 정정 (`docs/PLAN.md`)**

- [ ] `124 행` 의 "단 **자동 polling 은 backend status 계약 미shipped 로 defer**" 서술을 add-only 로 정정한다 — 옛 문장은 남기고 뒤에 "2026-09-02 shipped — [T-1849] (`web/src/AppShell.tsx` 좌표), `134 행` ④ 참조" 류 주석을 붙인다. checkbox 는 이미 `[x]` 이므로 그대로 둔다.
- [ ] `126 행` 의 "남은 1 항목(EvaluationGuardBanner 자동 polling)만이 실제 defer 다" 를 정정한다 — 이 항목도 T-1849 로 배선 완료돼 **실제 defer 0 건** 임을 적는다. 기존 "목록에서 내린 항목" 문장 형식(T-1313 선례)을 따른다.
- [ ] `127 행` 의 "web vitest CI 배선(T-0355)은 `onHold: credential-workflow-scope` 로 게이트됨" 을 정정한다 — T-0405 가 `ci.yml` `222~224 행` 으로 배선해 게이트가 해소됐음을 좌표와 함께 적는다.
- [ ] `docs/PLAN.md` 는 위 3 행만 수정한다. `git diff -U0 docs/PLAN.md` 의 hunk 가 `124` · `126` · `127 행` 에만 걸리고 `wc -l < docs/PLAN.md` = **196** 이 유지된다. `128 행`(web coverage threshold — 신규 dep 게이트 유효)은 무접촉이다.

**검증 · 형식**

- [ ] doc-only `direct` commit 이라 CLAUDE.md §3.2 tester 면제다. `pnpm` 명령은 불요하다.
- [ ] 새로 적는 행 범위 표기는 CLAUDE.md §12 규칙(구분자 `~`, 단일 행 `20 행`, `L` prefix 금지)을 따르고, 본문은 한국어다.
- [ ] 커밋 diff 는 `docs/requirements.md` · `docs/PLAN.md` 2 파일이다(task 파일 `status:` 플립은 driver bookkeeping commit 이 처리).

## Out of Scope

- 인원 · 그룹 · 파트 20 route guard 배선 — CLAUDE.md §5 인증 변경이라 오너 승인 대상이다([T-2017](T-2017-req045-046-073-rbac-person-group-part-readjudication.md) Follow-ups (a)).
- 브라우저 구동 e2e 도입(Playwright 등) · web coverage threshold(`@vitest/coverage-v8`) — 신규 외부 dependency 라 §5 게이트 대상이다.
- REQ-043 · 045 · 046 · 047 · 048 · 073 행 수정. REQ-043 셀의 person 주석 좌표 stale(T-2017 Follow-ups (c))도 이번에 고치지 않는다.
- `docs/PLAN.md` 의 `124` · `126` · `127 행` 외 수정(P6 checkbox 추가 · 삭제 포함), `docs/architecture/*` 수정.
- `src/` · `web/` · `test/` · `.github/workflows/` 변경.

## Suggested Sub-agents

`implementer` (doc-only 2 파일 행 단위 edit). direct doc-only 라 architect · tester 불요. executor 가 direct commit 분기로 main 에 직접 push 한다.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
