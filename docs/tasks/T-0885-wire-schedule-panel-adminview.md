---
id: T-0885
title: SchedulePanel 을 AdminView 에 배선 (GET/PUT /api/schedules + POST trigger 데이터 컨테이너) — P6 deferred wiring 재개
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-072, REQ-073]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-07-10
dependsOn: []
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
independentStream: p6-admin-wiring
plannerNote: "P6 deferred wiring 재개(PLAN line120/123) — P7 scheduler backend shipped 로 unblock. SchedulePanel↔api/schedules GET/PUT/trigger 컨테이너 배선. Q-0051 opt3 P6 승인."
---

# T-0885 — SchedulePanel 을 AdminView 에 배선 (스케줄 컨테이너 slice)

## Why

S2 latency perf-spec vein 이 T-0884 로 소진됐고(그 Follow-up 이 명시), owner 결정 Q-0051(2026-07-07)이 개방한 5 개 방향 중 옵션 5(overwrite/재평가)·옵션 4(P7 Scheduler)는 이미 main 에 shipped(PLAN §P7 전량 `[x]`, ADR-0038 reeval chain 완결), 옵션 2(실 github.com 평가 e2e)의 dependency-free 코드 표면은 소진(build-time step-args surface 가 20+ "Nway assembly" spec 으로 과빌드됨 — 남은 leg 은 운영 credential 게이트). Q-0051 권장 착수 순서 `5 → 4 → 2 → P6` 에서 P6 만이 genuine·dependency-free·비게이트 잔여다.

본 task 는 그 P6 의 **의도적 defer 잔여**(PLAN line 120/123: "재평가(ReEvaluationTriggerPanel)·스케줄(SchedulePanel) 은 backend 계약 미shipped 로 미마운트 defer")를 재개한다. 두 패널의 backend 계약(P7 `@Controller("api/schedules")` cron 등록·수동 trigger, ADR-0042)이 이제 shipped 이므로 defer 사유가 해소됐다. 이번 slice 는 그중 **SchedulePanel** 을 AdminView 컨테이너에 mount 하고 `GET/PUT /api/schedules` + `POST /api/schedules/trigger` 에 배선한다(R-72 cron 주기 지정 / R-73 manual trigger 의 frontend fragment). make-work 가 아니라 backend blocker 가 걷힌 실 deferred PLAN 항목의 완결이다.

## Required Reading

- `web/src/views/AdminView.tsx` — 배선 대상 컨테이너(현재 934행). `useApiResource`(native fetch resource, ADR-0041)·`request`/`requestRaw`(`../api/apiClient`)·controlled lift-up 패턴 확인. 기존 wired 패널(DifficultyModelSelector·DataImportExportPanel·GroupMemberList)의 "컨테이너가 fetch·상태 소유, 패널은 props 만 소비" convention 을 그대로 mirror.
- `web/src/components/SchedulePanel.tsx` — mount 대상 순수 presentational 컴포넌트(수정 금지 — props 배선만). props: `cronExpression?` / `onCronChange?(value)` / `onApply?()` / `onManualTrigger?()` / `busy?` / `error?` / `message?` / `applyLabel?` / `triggerLabel?`. 콜백/값 미전달 시 해당 컨트롤 비활성(읽기 표시). named + default export.
- `web/src/components/SchedulePanel.test.tsx` — 패널 자체 계약(이미 R-112 cover 완료). 본 task 는 패널을 수정하지 않으므로 이 파일도 수정 불요 — props 배선 convention 참고용.
- `src/scheduling/cron-schedule.controller.ts` — backend 계약(`@Controller("api/schedules")`, Admin+ `@Roles("Admin")`): `@Get()` → `string[]`(등록된 schedule name 목록) / `@Put()` body `{ name, cronExpression }` 200 / `@Delete(":name")` 204 / `@Post("trigger")` 202 Accepted(body 없음). PUT 은 `name` 을 요구하는데 SchedulePanel 은 `cronExpression` 만 노출 → 컨테이너가 **단일 default schedule name 상수**(예: `"daily-evaluation"`)를 PUT 에 공급하는 것으로 본 slice 를 bound(다중-named schedule 관리는 Out of Scope / Follow-up).
- `web/src/api/apiClient.ts` + `web/src/api/useApiResource.ts` — `request`/`requestRaw`/`useApiResource`/`toErrorMessage` 시그니처(호출만).

## Acceptance Criteria

- [ ] **Happy-path (mount + GET)**: AdminView 가 `useApiResource` 로 `GET /api/schedules`(Admin+)를 조회하고, 그 결과(등록 schedule name `string[]`)와 컨테이너 로컬 cron 입력 state 를 SchedulePanel 에 props(`cronExpression`·`message` 등)로 내려 렌더한다. SchedulePanel 이 AdminView 안에 실제 mount 됨을 렌더 test 로 검증(현재는 line 9 주석 참조뿐 — 미마운트).
- [ ] **Apply (PUT)**: SchedulePanel `onApply` 콜백이 `PUT /api/schedules` 를 `{ name: <default 상수>, cronExpression: <현재 입력값> }` body 로 발사하고, 성공 시 사람-친화 완료 문구를 `message` props 로 내려보낸다. happy-path unit test 1+.
- [ ] **Manual trigger (POST)**: SchedulePanel `onManualTrigger` 콜백이 `POST /api/schedules/trigger`(body 없음, 202 Accepted)를 발사하고 성공 문구를 표시한다. happy-path unit test 1+.
- [ ] **Error path**: (a) GET 실패 시 `toErrorMessage` 로 error 를 패널 `error` props 에 전달, (b) PUT 실패 시 error 표시, (c) POST trigger 실패 시 error 표시 — 각 error path unit test 1+ (의존성 실패 = fetch reject/non-2xx).
- [ ] **Flow / branch coverage**: 분기마다 test 분리 — (1) in-flight 중 `busy=true` 로 apply/trigger 컨트롤 억제(진행 표시 우선), (2) 빈 schedule 목록(GET 이 `[]`) 안전 표시, (3) cron 입력 변경(`onCronChange`)이 컨테이너 state 를 갱신. 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) apply 이중 발사 가드(busy 중 재클릭 → 재-POST 안 함), (b) trigger 이중 발사 가드, (c) cronExpression 빈 값으로 apply 시 컨테이너 처리(발사 억제 또는 backend 400 error 표면화 — 택1 구현하고 그 분기 test), (d) GET 진행 중(loading) 초기 상태에서 crash 없이 안전 렌더. 단일 negative 만으로 부족 — 위 예외 분기마다 cover.
- [ ] **web 스위트 green**: `pnpm --filter web test`(vitest) 통과 + `pnpm --filter web build`(tsc --noEmit 타입검사 + vite build) green. web 은 backend jest 의 `coverageThreshold`(line/func ≥80%) 게이트 대상이 아니므로(별도 vitest runner), 본 항목은 신규 wiring 의 happy/error/branch/negative 를 AdminView.test.tsx 에서 충분 cover 하는 것으로 R-112 를 충족한다(backend `pnpm test:cov` 는 web 무관 무회귀).
- [ ] **backend 무변경 확인**: `git diff --stat` 에 `src/**` / `package.json` / `pnpm-lock.yaml` 변경 0(신규 dependency 0 — react/react-dom/vite 는 web 에 기존재). 변경은 `web/src/views/AdminView.tsx` + `web/src/views/AdminView.test.tsx` 2 파일에 한정.

## Out of Scope

- `web/src/components/SchedulePanel.tsx` 및 그 test 수정 — 패널은 fetch 를 모른다(ADR-0041 §1). props 배선만.
- **ReEvaluationTriggerPanel 배선** — 같은 deferred 잔여지만 별도 slice(`POST /api/schedules/recent-deletion/:personId`, personId 선택 coupling). 본 task 는 SchedulePanel 만. Follow-up 으로 큐잉.
- **다중-named schedule 관리 UI** — schedule name 목록 CRUD(추가/삭제 `@Delete(":name")`)·이름별 편집. 본 slice 는 단일 default name 1 개 upsert + trigger 로 bound.
- `src/`(backend) 수정 / 새 endpoint / api.md 갱신 — backend 계약은 이미 shipped.
- 진행률 polling / EvaluationGuardBanner 자동 polling / DELETE schedule / App.tsx 라우팅 변경 — 별도 slice.
- 새 외부 dependency / package.json 변경 — 0.

## Suggested Sub-agents

`implementer → tester` — SchedulePanel 은 기존 presentational 컴포넌트(수정 0), 본 task 는 AdminView 컨테이너 wiring + AdminView.test.tsx 확장뿐. 신규 아키텍처 결정 없음(ADR-0040 frontend stack + ADR-0041 composition-wiring 이 이미 지배) → architect 불요.

## Follow-ups

- (비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
