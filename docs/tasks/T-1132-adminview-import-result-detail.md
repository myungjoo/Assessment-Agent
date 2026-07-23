---
id: T-1132
title: AdminView import 결과 상세 표면화 (POST 응답 ImportJob 소비)
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-049]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-07-23
independentStream: p6-admin-import-detail
dependsOn: []
touchesFiles: [web/src/views/AdminView.tsx, web/src/views/AdminView.test.tsx]
plannerNote: P6 deferred(PLAN line123) — GroupMember add·remove 완결 후 잔여 "import 결과 상세". POST 응답 ImportJob(id/status/mode) 소비, backend shipped.
---

# T-1132 — AdminView import 결과 상세 표면화

## Why

PLAN.md line 123 의 P6 deferred 잔여 목록 중 GroupMember add·remove mutation 은 T-1130/T-1131 로 완결됐고, 남은 항목은 **"import 결과 상세"** 와 EvaluationGuardBanner 자동 polling 두 개다. 후자는 `assessments` rows 의 status 필드가 backend 에 아직 없어 여전히 backend-계약 블록 상태이지만, **import 결과 상세는 backend 계약이 이미 shipped** 상태다 — `POST /api/admin/import` 는 생성된 `ImportJob`(id / status(PENDING) / mode)를 그대로 반환한다(`src/import/import.controller.ts` L109~120).

현재 `runImport`(`web/src/views/AdminView.tsx` L673~705)는 그 응답을 **소비하지 않고 버리며**(L693~694 주석: "응답 body 형태(건수/리포트)는 본 slice 가 소비하지 않으므로(import 결과 상세 표시는 후속) 성공 사실만 확인한다") 항상 정적 문구 `IMPORT_DONE_TEXT = '가져오기 완료'`(L168)만 표시한다. 이는 실제로는 job 이 **PENDING(비동기 큐잉)** 인데 "완료"라고 표시해 사람에게 약간 오해를 준다.

본 task 는 그 POST 응답 `ImportJob` 을 안전하게 소비해 job **id·status·mode** 를 사람-친화 한국어 상세 문구로 합성하고, `DataImportExportPanel` 의 `message` props 로 내려보낸다. presentational 컴포넌트는 손대지 않는다(controlled lift-up, ADR-0041 Decision 1 — 컨테이너가 상세 문자열을 합성, 패널은 표시만). 새 dependency 0, backend/schema/panel 컴포넌트 변경 0.

## Required Reading

- `web/src/views/AdminView.tsx` — 특히 (1) `runImport`/`ImportDeps`(L652~705) 의 성공 분기 `deps.setImportMessage(IMPORT_DONE_TEXT)`(L697) 를 상세 문구 합성으로 대체할 것, (2) `ADMIN_IMPORT_PATH`/`IMPORT_FILE_FIELD`/`IMPORT_DONE_TEXT` 상수(L157~168), (3) `ImportDeps.post` 반환 타입이 `Promise<unknown>`(L663) 이므로 응답은 `unknown` — 안전한 narrowing 필수, (4) `importExportPanelProps` 의 `message` 조립부(L1327 부근 `runImport(file, {...})` deps 주입 및 L1610 `<DataImportExportPanel {...importExportPanelProps} />`).
- `web/src/views/AdminView.test.tsx` — 기존 `runImport` 단위 테스트 패턴(deps 주입, jsdom/렌더러 없이 러너 본체를 직접 검증, mock `post` 가 resolve/reject) 을 확장.
- `src/import/import.controller.ts` L94~120 — `@Post() → create` 가 생성된 `ImportJob`(status=PENDING) 을 그대로 반환하는 계약. body 는 JSON `{mode}` 만 소비(FormData 의 file 은 backend 가 아직 미소비 — T-0489 Out of Scope, mode 미지정 시 schema `@default(REPLACE)`).
- `prisma/schema.prisma` L649~666 — `ImportJob` 모델 필드(id/status(`JobStatus` enum)/mode(`ImportMode` REPLACE·MERGE)/requestedById/createdAt/startedAt/finishedAt/error/artifactRef/restoredRowCount). 상세 문구에 쓸 필드는 최소 id·status·mode.

## Acceptance Criteria

- [ ] `runImport` 성공 분기에서 `deps.post(...)` 의 반환값(응답 `ImportJob`)을 받아 사람-친화 한국어 상세 문구로 합성해 `deps.setImportMessage(...)` 에 전달한다 — 최소 job **id·status·mode** 포함(예: `가져오기 요청됨 — job <id>, 상태 <status>, 모드 <mode>`). 정적 `IMPORT_DONE_TEXT` 단독 대체.
- [ ] 상세 문구 합성은 별도 **순수 helper**(예: `formatImportJobDetail(job: unknown): string`)로 분리하고, 응답이 기대 shape(최소 `id` string) 가 아니면(예: `null`/비객체/`id` 부재) 기존 `IMPORT_DONE_TEXT` 로 **안전 fallback**(방어적 narrowing — backend 응답 형태 변화·비정상 응답에도 throw·`[object Object]` 노출 0).
- [ ] **happy-path unit test 1+**: `post` 가 `{ id, status: 'PENDING', mode: 'REPLACE' }` 형태로 resolve 할 때 `setImportMessage` 가 그 id·status·mode 를 포함하는 상세 문구로 호출됨을 검증(정적 '가져오기 완료' 아님).
- [ ] **error path unit test 1+**: `post` 가 reject(ApiError 403/400/네트워크 0 중 대표) 할 때 기존과 동일하게 `setImportError` 로 사람-친화 문구 표면화 + `setImportMessage` 미호출(상세 문구 미노출) + throw 없음.
- [ ] **flow/branch cover**: (a) 정상 shape 응답 → 상세 문구, (b) 기대 shape 아님(응답 `null` / 비객체 / `id` 없음) → `IMPORT_DONE_TEXT` fallback, (c) 선택 필드(`restoredRowCount` 등) 유무에 따른 문구 분기가 있다면 각 1+ test. 각 분기 1+ test.
- [ ] **negative cases 충분 cover** — 각 1+ test: 응답 `null`/`undefined` → fallback / 응답이 string·number(비객체) → fallback / `id` 필드 부재 → fallback / `status` 필드 부재 시 안전 처리(누락 필드에 대한 기본/생략 문구) / 빈 file 미발사(기존 가드 유지 회귀) / `importing` 중 재호출 미발사(기존 가드 유지 회귀).
- [ ] `pnpm --dir web test` (vitest) 및 `pnpm --dir web build`(tsc --noEmit + vite build) green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 변경분(runImport 성공 분기 + 신규 helper) R-112 4종 cover, web 커버리지 게이트 무회귀.

## Out of Scope

- **GET /api/admin/import/:id status polling 도입 금지** — 본 slice 는 POST 응답(status=PENDING)의 즉시 상세만 표시한다. job 완료까지의 반복 polling + `restoredRowCount`/`finishedAt` 최종 리포트 표시는 별도 후속(Follow-up).
- **DataImportExportPanel presentational 컴포넌트 변경 금지** — 상세 문구는 AdminView(컨테이너)가 합성해 기존 `message` props 로 내려보낸다(controlled lift-up, ADR-0041 Decision 1). 패널은 `message` 표시 책임만 유지(새 props 도입 0).
- **multipart(file) vs JSON(`{mode}`) body 계약 불일치 수정 금지** — 현재 `runImport` 는 FormData 로 file 을 보내지만 backend `@Post()` 는 JSON `{mode}` 만 소비한다(mode 미지정 → schema `@default(REPLACE)`, file 은 T-0489 Out of Scope 로 아직 미소비). 이 pre-existing 불일치는 본 slice 밖 — Follow-up 에 기록만.
- backend controller/service/DTO/schema 변경 0 — 이미 shipped 계약 재사용.
- EvaluationGuardBanner 자동 polling(assessments status 필드 부재로 여전히 backend 블록) 손대지 않음.
- 낙관적 업데이트·토스트·라우팅 도입 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — sub-agent 가 관련 작업 발견 시 여기 append. 후보: ① GET /api/admin/import/:id status polling 으로 최종 `restoredRowCount` 리포트 표시. ② runImport 의 multipart file vs backend JSON `{mode}` body 계약 불일치 정합(backend 의 실 artifact upload 는 T-0489 Out of Scope). ③ EvaluationGuardBanner 자동 polling — assessments status 필드 backend 계약 shipped 후.)
