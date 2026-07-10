---
id: T-0886
title: ReEvaluationTriggerPanel 을 AdminView 에 배선 (POST /api/schedules/recent-deletion/:personId 컨테이너) — P6 deferred wiring 완결
phase: P6
status: DONE
mergedAs: 532df2d3
prNumber: 780
reviewRounds: 1
completedAt: 2026-07-10T15:20:00Z
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-10
dependsOn: []
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
independentStream: p6-admin-wiring
plannerNote: "P6 deferred wiring 완결(PLAN line120/123) — T-0885(SchedulePanel) 의 짝. ReEvaluationTriggerPanel↔POST /api/schedules/recent-deletion/:personId(Admin+) 배선. backend 계약 shipped, T-0885 Follow-up. dependency-free 마지막 P6 잔여."
---

# T-0886 — ReEvaluationTriggerPanel 을 AdminView 에 배선 (재평가 트리거 컨테이너 slice)

## Why

PLAN line 120/123 이 명시한 P6 **의도적 defer 잔여** 두 패널(재평가 ReEvaluationTriggerPanel · 스케줄 SchedulePanel) 중 SchedulePanel 은 직전 T-0885(PR #779, squash 74d00f40)로 배선 완결됐다. 본 task 는 그 짝인 **ReEvaluationTriggerPanel** 을 AdminView 컨테이너에 mount 하고 backend 계약 `POST /api/schedules/recent-deletion/:personId`(Admin+, ADR-0038 reeval chain / RecentDeletionController T-0428)에 배선한다. 두 패널의 defer 사유("backend 계약 미shipped")는 P7 scheduler 완결로 이미 해소됐고, 본 endpoint 는 `src/scheduling/recent-deletion.controller.ts` 에 shipped 이다.

이는 make-work 가 아니라 backend blocker 가 걷힌 실 deferred PLAN 항목의 완결이자 T-0885 Out of Scope 가 명시적으로 Follow-up 으로 큐잉한 slice(R-74 / REQ-041 재평가 트리거의 frontend fragment)다. S2 perf-spec vein 은 소진됐으므로(T-0884 경계 note) 조직-구조 read 배선 make-work 대신 이 genuine·dependency-free·비게이트 잔여를 착수한다. 본 slice 완결 후 PLAN P6 deferred wiring 두 항목이 모두 마운트된다.

## Required Reading

- `web/src/views/AdminView.tsx` — 배선 대상 컨테이너(현재 1192행). `useApiResource`(ADR-0041 native fetch resource)·`request`(`../api/apiClient`)·`toErrorMessage`·controlled lift-up 패턴 확인. 특히 T-0885 이 방금 추가한 **SchedulePanel 배선 블록**(`runApply`/`runTrigger`/`ScheduleMutationDeps`/`handleApply` 등, 966~1049행)과 ④e `runImport`/`ImportDeps`(559~612행) 를 mirror 대상 convention 으로 삼는다("컨테이너가 fetch·상태 소유, 패널은 props 만 소비, mutation 은 *Deps 주입 순수 async 러너로 캡슐화"). 기존 group 선택 `<select>` + `deriveMembers`(members 파생, 765행)를 재사용해 person 선택을 얹는다.
- `web/src/components/ReEvaluationTriggerPanel.tsx` — mount 대상 순수 presentational 컴포넌트(수정 금지 — props 배선만). props: `windows: ReEvaluationWindow[]`(각 `{ days, label }`) / `selectedDays: number` / `onSelect(days)` / `onTrigger(days)` / `submitting?` / `error?` / `confirmText?`. windows 빈 배열·submitting·error 분기는 컴포넌트가 이미 박제(수정 0). named(`ReEvaluationWindow`/`ReEvaluationTriggerPanelProps`) + default export.
- `web/src/components/ReEvaluationTriggerPanel.test.tsx` — 패널 자체 계약(이미 R-112 cover 완료). 본 task 는 패널을 수정하지 않으므로 이 파일은 수정 불요 — props 배선 convention 참고용.
- `src/scheduling/recent-deletion.controller.ts` — backend 계약: `@Post("recent-deletion/:personId")` `@HttpCode(202)` `@Roles("Admin")`. path param `personId`, body `RecentDeletionDto`. 결과 `{ personId, deletedCount, recollected }` 를 202 로 반환.
- `src/scheduling/dto/recent-deletion.dto.ts` — body DTO: `instants: string[]`(ISO 8601, **빈 배열 [] 허용** — no-op 정상 경로) + `days?: number`(선택, 양수 정수). 본 slice 는 panel 의 `days` 선택값을 `days` 로, `instants` 는 빈 배열 `[]` 로 공급한다(instants 자동 도출은 Out of Scope / Follow-up — 별도 GET 필요).
- `web/src/api/apiClient.ts` — `request` 시그니처(호출만, POST + JSON body).

## Acceptance Criteria

- [ ] **Happy-path (mount + trigger POST)**: AdminView 의 Admin+ gating 블록(`isAdmin ?` 분기) 안에 ReEvaluationTriggerPanel 이 실제 mount 되고, panel `onTrigger(days)` 콜백이 선택된 personId 로 `POST /api/schedules/recent-deletion/:personId` 를 `{ instants: [], days }` body 로 발사한 뒤 성공 시 사람-친화 완료 문구를 panel 이 소비할 상태(예: error 없음 + confirmText/기본 문구 유지, 또는 컨테이너 message 파생)로 반영한다. 패널이 AdminView 안에 mount 됨을 렌더 test 로 검증. happy-path unit test 1+.
- [ ] **person 선택 배선**: 컨테이너가 person 선택 상태(selectedPersonId)를 소유하고, 기존 그룹 선택→`deriveMembers` 파생 members 를 person `<select>` 옵션으로 노출한다(controlled lift-up — 그룹 선택 `<select>` 동형). 선택된 personId 가 POST path param 으로 쓰임을 test 로 검증.
- [ ] **windows 배선**: frontend-local 재수집 window 후보 목록(예: `{days:1,label:'최근 1일'}`·`{days:7,label:'최근 1주'}`·`{days:30,label:'최근 30일'}`, EXPORT_SCOPE_OPTIONS 동형 상수)을 windows props 로 내려보내고, `onSelect(days)` 가 컨테이너 selectedDays 상태를 갱신함을 test 로 검증.
- [ ] **Error path**: POST 실패 시 `toErrorMessage` 로 파생한 문구를 panel `error` props 로 안전 표시(throw 없음). Admin+ 미만 403 / 400(잘못된 body) / 404 / 비-2xx / 네트워크 0 모두 이 경로. error path unit test 1+.
- [ ] **Flow / branch coverage** — 분기마다 test 분리: (1) trigger in-flight 중 `submitting=true` 로 진행 표시 우선, (2) windows 후보가 항상 비지 않으므로 빈 상태는 N/A 이나 windows 상수가 실제로 props 로 전달되는지, (3) `onSelect` 로 selectedDays 갱신 후 그 값이 `onTrigger` 로 발사되는지. 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) person 미선택(selectedPersonId 빈 값)에서 trigger 시 POST 미발사(발사 억제) 또는 안전 안내 문구 표시 — 택1 구현하고 그 분기 test, (b) trigger 이중 발사 가드(submitting 중 재발사 → 재-POST 안 함, runTrigger busy 가드 동형), (c) selectedDays 가 windows 에 없는 경계값에서 panel 이 트리거 버튼 비활성(컴포넌트 박제) + 컨테이너 crash 없음, (d) 초기 렌더(person·days 미선택) crash 없이 안전 렌더. 단일 negative 만으로 부족 — 위 예외 분기마다 cover.
- [ ] **web 스위트 green**: `pnpm --filter web test`(vitest) 통과 + `pnpm --filter web build`(tsc --noEmit + vite build) green. web 은 backend jest `coverageThreshold`(line/func ≥80%) 게이트 대상이 아니므로(별도 vitest runner), 본 항목은 신규 wiring 의 happy/error/branch/negative 를 `AdminView.test.tsx`(colocated, `web/src/views/`)에서 충분 cover 하는 것으로 R-112 를 충족한다(backend `pnpm test:cov` 는 web 무관 무회귀).
- [ ] **backend 무변경 확인**: `git diff --stat` 에 `src/**` / `package.json` / `pnpm-lock.yaml` 변경 0(신규 dependency 0). 변경은 `web/src/views/AdminView.tsx` + `web/src/views/AdminView.test.tsx` 2 파일에 한정.

## Out of Scope

- `web/src/components/ReEvaluationTriggerPanel.tsx` 및 그 test 수정 — 패널은 fetch 를 모른다(ADR-0041 §1). props 배선만.
- **instants 자동 도출** — 선택 person 의 최근 N일 실제 평가 instant 를 GET 으로 조회해 body `instants` 에 채우는 것은 별도 slice(추가 fetch·응답 형태 결정 필요). 본 slice 는 `instants: []`(DTO 가 빈 배열 허용, no-op 정상 경로)로 bound. Follow-up 으로 큐잉.
- POST 결과 상세 표시(`deletedCount`/`recollected` 요약 렌더) — 본 slice 는 성공/실패 사실만 표면화. 응답 body 파싱·건수 표시는 후속.
- 진행률 polling / EvaluationGuardBanner 자동 polling / App.tsx 라우팅 변경 — 별도 slice.
- `src/`(backend) 수정 / 새 endpoint / api.md 갱신 — backend 계약은 이미 shipped.
- 새 외부 dependency / package.json 변경 — 0.

## Suggested Sub-agents

`implementer → tester` — ReEvaluationTriggerPanel 은 기존 presentational 컴포넌트(수정 0), 본 task 는 AdminView 컨테이너 wiring + `AdminView.test.tsx` 확장뿐. 신규 아키텍처 결정 없음(ADR-0040 frontend stack + ADR-0041 composition-wiring 이 이미 지배, T-0885 이 recent 선례) → architect 불요.

## Follow-ups

- (비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
