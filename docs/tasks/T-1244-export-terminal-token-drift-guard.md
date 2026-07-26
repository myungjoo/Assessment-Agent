---
id: T-1244
title: exportJobFlow terminal-token drift-guard spec 신설 — web 종결 상수 ↔ prisma JobStatus enum 기계 검증
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-030, REQ-032]
estimatedDiff: 130
estimatedFiles: 1
created: 2026-07-26
independentStream: p6-export-contract-fix
dependsOn: [T-1243]
touchesFiles: [web/src/api/exportJobFlow.contract-guard.test.ts]
plannerNote: P6 export-contract-fix stream — T-1243 reviewer 가 flag 한 drift-guard follow-up. exportJobFlow 종결 상수(SUCCEEDED/FAILED)가 prisma JobStatus enum 과 일치하는지 기계 검증하는 회귀 앵커. file-disjoint 신규 spec 1개(exportJobFlow.ts·AdminView 무접촉). pr.
---

# T-1244 — exportJobFlow terminal-token drift-guard spec 신설

## Why

T-1243 이 신설한 `web/src/api/exportJobFlow.ts` 는 backend job lifecycle 를 poll 하며 종결 판정을 위해 web-local 상수 `SUCCEEDED_STATUS='SUCCEEDED'` / `FAILED_STATUS='FAILED'` 를 하드코딩한다(주석: "backend JobStatus enum(prisma/schema.prisma) 그대로 박제"). 이 상수는 **런타임에 `getExportJob(id)` (= backend `GET /api/admin/export/:id`, raw `ExportJob` 반환 → Prisma `JobStatus` enum uppercase 표기)의 `status` 와 문자열 비교**되므로, 만약 backend `enum JobStatus` 가 rename/추가/삭제되거나 web 상수에 오타가 나면 poll loop 가 **성공 job 을 영원히 종결로 인식하지 못해 timeout** 하는 조용한 실사용 버그가 된다(빌드·기존 unit test 로는 안 잡힘 — web/backend 별도 빌드라 타입 링크 없음).

T-1243 의 reviewer 와 task Follow-up 이 이 위험을 명시적으로 drift-guard spec 후속(T-1234~T-1236 contract-guard 패턴)으로 지목했다. 본 task 는 그 회귀 앵커 — **web 종결 상수 집합이 `prisma/schema.prisma` 의 `enum JobStatus` 를 정확히 반영하는지** 를 CI 에서 기계 검증한다. 신규 spec 1개만 추가하고 `exportJobFlow.ts`·`AdminView.tsx`·backend 는 전혀 건드리지 않아 file-disjoint 하다.

## Required Reading

- `web/src/api/exportJobFlow.ts` — **읽기만**(수정 0). export 심볼 `SUCCEEDED_STATUS`·`FAILED_STATUS` 를 spec 이 직접 import 해 검증 대상으로 삼는다(이미 `export { runExportJob, SUCCEEDED_STATUS, FAILED_STATUS }` 로 노출됨 — L84). 내부 `isTerminal` 이 이 둘의 합집합을 종결로 보고 `PENDING`/`RUNNING` 을 진행중으로 본다는 판정 규약(L37~40, L64~78)을 확인.
- `prisma/schema.prisma` L549~554 — **읽기만**(fs 로 test 시점 read, import 금지 — web/backend 별도 빌드). `enum JobStatus { PENDING RUNNING SUCCEEDED FAILED }` 가 권위 소스. spec 은 이 파일 텍스트를 읽어 enum 멤버를 파싱한다.
- `web/src/views/__contract-guard__/contract-extractors.ts` — **읽기만**(참고). 기존 contract-guard spec 들이 backend 소스를 fs 로 읽어 파싱하는 관례(파일 경로 해석·정규식 추출·정렬 비교) mirror 대상. 다만 본 guard 는 enum 파싱이라 기존 추출기 재사용이 어색하면 spec-local 소형 파서를 두어도 무방(공용 helper 오염 금지).
- `web/src/api/exportJob.test.ts` — **읽기만**(참고). 같은 디렉토리의 colocated spec 작성 관례(vitest `describe`/`it`, import 스타일) 정합용.

## Acceptance Criteria

- [ ] `web/src/api/exportJobFlow.contract-guard.test.ts` 신설(colocated). `fs.readFileSync` 로 저장소 루트 기준 `prisma/schema.prisma` 를 읽어 `enum JobStatus { ... }` 블록의 멤버 집합(`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`)을 파싱하는 spec-local helper 를 둔다(경로는 `__dirname` 기준 상대 해석 — CI·로컬 양쪽에서 안정).
- [ ] **Happy-path(멤버십)**: `SUCCEEDED_STATUS`·`FAILED_STATUS` 가 각각 파싱된 `JobStatus` enum 멤버 집합에 **포함**됨을 검증(web 상수가 backend enum 에 실재하는 토큰임 — 오타·rename drift 차단).
- [ ] **종결/비종결 분할 검증**: web 이 종결로 보는 집합 `{ SUCCEEDED_STATUS, FAILED_STATUS }` 이 enum 전체에서 정확히 `{ SUCCEEDED, FAILED }` 와 **일치**하고, 나머지 비종결 멤버가 정확히 `{ PENDING, RUNNING }` 임을 검증(enum 이 종결/진행중 두 부분으로 web 규약대로 분할됨). enum 에 새 멤버가 추가되면(예: `CANCELLED`) 이 단언이 fail 해 web 종결 규약 재검토를 강제한다.
- [ ] **Error/negative(파싱 견고성) 각 1+**: (a) enum 파싱 helper 가 `JobStatus` 블록을 못 찾으면(정규식 미매칭) **명확한 실패**(빈 집합을 성공으로 오판하지 않음) — 파싱 결과가 비어있지 않음을 별도 단언으로 방어(빈 enum 을 "모두 일치"로 통과시키는 false-green 차단). (b) 파싱된 enum 이 최소 4개 멤버를 포함함을 단언(부분 파싱으로 인한 누락 drift 방지 — 경계값). (c) `SUCCEEDED_STATUS !== FAILED_STATUS` (두 종결 토큰이 서로 다른 값임 — 상수 중복 붙여넣기 오류 방지).
- [ ] **분기/flow cover**: 위 (멤버십)·(분할 일치)·(파싱 견고성) 각 분기를 별도 `it` 로 분리(단일 거대 assert 금지). enum 멤버 파싱은 순서 무관 집합 비교(정렬 후 비교 또는 Set 동치)로 — schema 내 나열 순서 변경에 취약하지 않게.
- [ ] **exportJobFlow.ts·prisma/schema.prisma·export.controller.ts·AdminView.tsx 수정 0** — 본 task 는 신규 spec 파일 1개만 추가(순수 회귀 앵커). 어떤 production/schema 파일도 변경하지 않는다.
- [ ] `pnpm --dir web test`(vitest) green — 신규 spec pass, 기존 spec 무회귀. `pnpm --dir web build`(tsc --noEmit + vite) green(TS6133 unused 0, 타입 에러 0). web coverageThreshold 는 T-1165 게이트로 미강제이나 본 spec 은 test-only 라 커버리지 영향 없음(검증 대상 상수는 이미 T-1243 unit test 로 cover).

## Out of Scope

- **AdminView.tsx 배선 금지** — `runExport`(현 GET 모델) 를 `runExportJob`(create→poll→download) 호출 + `response.blob()` 파일 저장으로 교체하는 **최종 wiring slice** 는 별도 task(Follow-up). 그 slice 는 4875-LOC hub 편집 + 다수 기존 test 재작업이라 cap 상 별도(필요 시 split)로 다룬다. 본 task 는 그와 file-disjoint 한 회귀 앵커만.
- **exportJobFlow.ts·exportJob.ts 수정 금지** — 이미 확정된 계약. 상수/함수 리팩터 없음.
- **backend `export.controller.ts`·`export-job.service.ts`·`prisma/schema.prisma`·api.md 수정 금지** — 이들이 권위 소스이며 web 이 정합 대상. 본 guard 는 web 이 backend 를 반영하는지 단방향 검증만.
- **공용 `contract-extractors.ts` 확장 금지** — 본 guard 는 enum 파싱이라 기존 라우트/DTO 추출기와 형태가 달라, 재사용이 어색하면 spec-local 파서로 격리한다(공용 helper 를 enum 파싱까지 넓혀 다른 spec 에 결합면을 늘리지 않음). 2개 이상 spec 이 enum 파서를 공유할 필요가 생기면 그때 helper 추출(별도 Follow-up).
- **status-view lowercase 매핑(`describeExportJobStatus`/`JOB_STATUS_TO_VIEW`) 검증은 본 slice 미포함** — `GET :id/status-view` 의 사람-친화 view 계약은 별도 관심사(web 은 raw `GET :id` 만 poll 하므로 무관). 필요 시 대칭 Follow-up.
- **cap 유의**: 신규 파일 1개(약 130 LOC) — cap 여유. 300 LOC / 5 파일 초과 위험 없음.

## Suggested Sub-agents

`tester`

## Follow-ups

- **최종 wiring slice(필수, 다음 우선)**: `AdminView.tsx` 의 `runExport`(GET 모델) 를 `runExportJob`(create→poll→download) 호출 + `response.blob()` 파일 저장으로 교체해 실제 export 404 버그를 최종 해소. `ExportDeps.getRaw` → job primitive 주입 전환 + `makeExportDeps` 및 runExport 관련 기존 test(AdminView.test.tsx L2905~3330, ~40 it) 재작업 동반 → **hub 파일 대규모 편집이라 cap 상 split 검토 필수**(예: (1) 컨테이너 job-flow 어댑터 + handleExport 배선 + 신규 test, (2) 구 GET 모델 runExport·dead test 제거 로 2 slice 분할해 각 commit green 유지). planner 가 슬라이싱 판단.
- 후보: import 측 대칭 orchestration(`runImportJob`, `POST /api/admin/import` multipart) — export 배선 안정화 후.
