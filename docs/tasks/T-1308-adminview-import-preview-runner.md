---
id: T-1308
title: AdminView 에 import preview 러너 + 영향 범위 요약 문구 helper 신설 (배선 전 순수 slice)
phase: P6
status: DONE
prNumber: 1193
completedAt: 2026-07-29T13:00:14Z
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-07-29
independentStream: p6-import-confirm
dependsOn: [T-1307]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "R-112 backbone x1.5 = 약 200 LOC / 2 파일. T-1307 확인 단계의 배선 절반 중 순수 러너+문구 helper. pendingFile state·props 전달은 후속 slice (T-1307 실측 +38% over 감안 분할)"
---

# T-1308 — AdminView 에 import preview 러너 + 영향 범위 요약 문구 helper 신설

## Why

[T-1307](T-1307-import-confirm-step-panel.md)(PR #1192 머지) 이 `DataImportExportPanel` 에 **확인 단계 표시** 를 박제했다 — `importConfirmText` 가 truthy 면 `role="alertdialog"` 안에 파괴적 경고 + 영향 범위 요약 + 실행/취소 버튼을 렌더한다. 그런데 그 props 를 **내려주는 컨테이너가 아직 없어** 사용자 동작은 여전히 "파일 선택 즉시 `POST /api/admin/import` 발사" 그대로다 ([web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 934~967 행 `runImport`). [UC-07](../use-cases/UC-07-export-import.md) §5 64 행의 "강한 confirmation(영향 범위 + 명시 확인)" gap 은 배선이 붙어야 닫힌다.

backend 는 이미 준비돼 있다 — `POST /api/admin/import/preview` 가 **DB write 0 / job row 미생성** 으로 `deleted`/`inserted`/`kept` 3 그룹 breakdown + 해석된 `mode` 를 반환한다 ([docs/architecture/api.md](../architecture/api.md) 126 행, T-1299/T-1300/T-1302). 본 task 는 그 응답을 **부르고 사람-친화 문구로 합성하는 순수 절반** 만 박제한다: `runImportPreview` 러너 + `formatRestorePlanConfirmText` helper. 이미 같은 파일에 있는 `runImport` + `formatImportJobDetail` 쌍의 convention 을 그대로 mirror 하므로 새 패턴 0 이다.

**분할 근거** — T-1307 의 후속 follow-up 은 "러너 + 문구 합성 + `pendingFile` state + props 전달" 을 한 slice(~200 LOC)로 예상했으나, T-1307 자체가 estimate 160 → **실측 221 LOC(+38%)** 로 벗어났다. 같은 편차를 적용하면 합본 slice 는 300 LOC cap 을 넘길 공산이 크다. 그래서 (1) 순수 러너·helper(본 task) → (2) 컨테이너 state·props 전달(후속 slice) 로 나눈다. 두 slice 는 같은 2 파일을 건드리므로 순차 진행이며 동시 claim 대상이 아니다.

**estimate 근거** — 구현 +약 70 LOC(상수 1 + deps interface 1 + 러너 1 + 문구 helper 1 + 주석), spec +약 65 LOC(happy/error/branch/negative 8~10 케이스) → base ~135, R-112 backbone(구현 + spec 동시 박제) × 1.5 = **~200 LOC / 2 파일** (cap 안, `sizeExempt` 불요).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 245~283 행 — `ADMIN_IMPORT_PATH` · `IMPORT_FILE_FIELD` · `IMPORT_DONE_TEXT` 상수와 `formatImportJobDetail` 의 **방어적 narrowing convention**(비객체 → 정적 fallback, 필드는 타입 확인 후에만 노출, throw 0). 본 task 의 문구 helper 가 mirror 할 원본.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 913~967 행 — `ImportDeps` + `runImport`. 가드 2 종(falsy file 미발사 / in-flight 미발사) · 시작 시 error·message 비움 · `FormData` 조립 · `finally` 진행 off 의 러너 골격. 본 task 의 러너가 그대로 차용한다. **본 task 에서 `runImport` 본문은 0 수정**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 4730~4745 행 부근의 named export 블록 — `runImport` · `formatImportJobDetail` 이 test 직접 호출용으로 export 되는 자리. 신설 심볼도 같은 블록에 추가한다.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 3030~3120 행 — `runImport` 검증 harness(`makeImportDeps` — setter 호출을 배열로 캡처, `request` mock 주입, `FormData` body 단언). 본 task 의 spec 이 mirror 할 convention. **jsdom·@testing-library 없이** 러너를 직접 호출해 검증한다.
- [docs/architecture/api.md](../architecture/api.md) 126 행 — `POST /api/admin/import/preview` 계약 원문: 요청은 `create` 와 동일한 multipart(`file` + optional `mode`), 응답 201 의 key 집합은 정확히 `deleted`/`inserted`/`kept`/`mode` 4 개이고 3 그룹은 각각 `{ total, perEntity }`. 실패 400/401/403/413. **0 수정**.
- [web/src/components/DataImportExportPanel.tsx](../../web/src/components/DataImportExportPanel.tsx) 의 `importConfirmText` props 주석(T-1307 신설분) — 본 task 가 합성하는 문구의 **소비처 계약**(요약 문구 문자열 1 개). **0 수정**.

## Acceptance Criteria

- [ ] **상수 신설** — `ADMIN_IMPORT_PREVIEW_PATH = '/api/admin/import/preview'` 와 요약 합성 실패 시 fallback 문구 상수 1 개(예: `IMPORT_PREVIEW_UNKNOWN_TEXT` — 영향 범위를 확인할 수 없다는 사실 + 진행 시 기존 데이터가 대체된다는 경고를 한국어로 명시)를 `ADMIN_IMPORT_PATH` 인근에 추가한다. 기존 상수 값은 **0 수정**.
- [ ] **`formatRestorePlanConfirmText(preview: unknown): string` 신설** — preview 응답을 사람-친화 한국어 요약 1 줄로 합성한다. `formatImportJobDetail` 의 방어적 narrowing 을 그대로 따른다: 비객체(`null`·배열·string 등) 또는 3 그룹 `total` 이 하나도 number 가 아니면 fallback 상수 반환(throw 0, `[object Object]` 노출 0). number 인 `total` 만 골라 "삭제 N 건 / 삽입 M 건 / 보존 K 건" 형태로 표기하고, `mode` 가 비어있지 않은 string 이면 "(모드 REPLACE)" 처럼 덧붙인다. `perEntity` 세부는 본 task 에서 노출하지 않는다.
- [ ] **`ImportPreviewDeps` interface 신설** — `ImportDeps` 동형 주입 계약: `post` · `describeError` · `importing`(in-flight 여부) · `setImporting` · `setImportError` · `setImportMessage` + 신규 `setImportConfirmText: (next: string | undefined) => void`. 각 필드에 한국어 주석. 기존 `ImportDeps` 는 **0 수정**.
- [ ] **`runImportPreview(file: File, deps: ImportPreviewDeps): Promise<void>` 신설** — 동작: (a) falsy `file` → POST 미발사·즉시 return, (b) `deps.importing === true` → 미발사·즉시 return(이중 발사 차단), (c) 발사 시 `setImporting(true)` + 직전 `error`·`message`·`confirmText` 비움 → `FormData` 에 `IMPORT_FILE_FIELD` 로 file append → `post(ADMIN_IMPORT_PREVIEW_PATH, { method: 'POST', body: formData })`, (d) 성공 → `setImportConfirmText(formatRestorePlanConfirmText(res))`, (e) 실패 → `setImportError(describeError(e))` + `setImportConfirmText(undefined)`, throw 0, (f) `finally` 에서 `setImporting(false)`. `mode` form field 는 붙이지 않는다(미지정 = backend `REPLACE` 해석, 실행 경로와 동일 기준).
- [ ] **named export 추가** — `runImportPreview` · `formatRestorePlanConfirmText` · `ImportPreviewDeps`(type) 를 기존 `runImport`/`formatImportJobDetail`/`ImportDeps` 와 같은 export 블록에 추가한다. 기존 export 목록은 **0 수정**.
- [ ] **Happy-path unit test 1+** — `runImportPreview` 호출 → `post` 가 `/api/admin/import/preview` 로 1 회, `method: 'POST'` + body 가 `FormData`(`file` 필드에 전달한 File) 로 호출됨을 단언. 성공 응답(`deleted/inserted/kept` 각 `{ total, perEntity }` + `mode: 'REPLACE'`) → `setImportConfirmText` 에 삭제·삽입·보존 수치와 모드가 모두 포함된 문구가 전달되고, `importing` 전이가 `[true, false]` 임을 단언.
- [ ] **Error path unit test 2+** — (a) `post` 가 403 `ApiError` 로 reject → `setImportError` 에 사람-친화 문구 설정, `setImportConfirmText(undefined)` 호출, throw 0, `importing` `[true, false]`. (b) 네트워크 실패(비-`ApiError` throw) → 동일하게 error 문구 표면화 + throw 0.
- [ ] **Flow / branch coverage** — 신설 분기마다 1+ test: (a) falsy file(빈 값 캐스팅) → `post` 미호출 · setter 전부 미호출, (b) `importing: true` → `post` 미호출 · setter 전부 미호출, (c) 발사 시작 시 error·message·confirmText 를 `undefined` 로 먼저 비우는지, (d) 성공 분기, (e) 실패 분기.
- [ ] **Negative cases 충분 cover (예외 상황 분기마다 1+)** — `formatRestorePlanConfirmText` 단독 호출로: (a) `null` · (b) 배열 · (c) 문자열 같은 비객체 → fallback 상수 반환(throw 0), (d) `total` 이 string 등 비-number 인 손상 응답 → fallback 반환, (e) 3 그룹 `total` 이 모두 **0** 인 경계값 → 0 을 그대로 표기(0 을 falsy 로 흘려 fallback 으로 빠지지 않는지 — 회귀 위험 지점), (f) `mode` 누락/빈 문자열 → 수치 부분만 합성하고 모드 표기 생략. 단일 negative 만 작성 금지 — 위 각각 1+.
- [ ] **하위 호환 0 회귀** — 기존 `runImport` · `formatImportJobDetail` · 컨테이너 렌더 결과는 **변하지 않는다**. `AdminView.test.tsx` 의 기존 케이스는 한 줄도 수정하지 않고 그대로 통과해야 한다(수정이 필요하면 설계가 틀린 것).
- [ ] **테스트 실행 통과** — `pnpm --filter web test` 전량 green(`vitest run`), `pnpm --filter web build` 통과(`tsc --noEmit -p tsconfig.json && vite build` — 타입 오류 0). backend 변경 0 이지만 CI 가 함께 도는 `pnpm lint && pnpm build && pnpm test` 도 green 이어야 한다.
- [ ] **coverage 기준 명시** — `web/` 에는 vitest `coverageThreshold` 가 아직 없으므로(PLAN.md P6 게이트된 backlog) 신설 분기 전수 cover 를 위 test 항목으로 대체 강제한다 — 새로 추가한 `if` 분기와 fallback 경로 각각에 대응하는 케이스가 spec 에 존재함을 PR body 에서 1:1 로 대조해 보인다. backend `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 는 변경 0 이라 기존 수치가 유지돼야 한다.
- [ ] **언어 규율 (§12)** — 주석 · `it` 문구 · 사용자 노출 문구는 한국어, 식별자 · path · 상수명 · 명령어는 영어.

## Out of Scope

- **컨테이너 state·props 전달 0** — `pendingImportFile` / `importConfirmText` `useState`, `handleImport` 의 preview 우선 전환, `onConfirmImport`/`onCancelImport` 핸들러, `importExportPanelProps` 에 3 props 추가는 **후속 배선 slice** 책임(Follow-ups 에 명시). 본 task 를 머지해도 사용자 동작은 변하지 않는다 — 의도된 상태다.
- **`runImport` 본문 수정 0** — 확정 후 실행 경로는 기존 러너를 그대로 재사용한다. 시그니처·가드·문구를 건드리지 않는다.
- **`web/src/components/**` 0 수정** — T-1307 이 확인 단계 표시를 이미 shipped 했다. 컴포넌트 수정이 필요하다고 느껴지면 설계가 틀린 것이다.
- **`src/**` · `test/**` 0 수정** — preview 계약은 T-1299/T-1300/T-1302 로 shipped. 서버 변경 불요.
- **문서 0 수정** — `api.md` · UC-07 은 preview 계약 정본을 이미 담고 있어 drift 0. 문서 수정이 필요해지면 §3.1 rule 3 상 별도 direct task 로 분리한다.
- **새 dependency 0** — `@testing-library/react` · `jsdom` · `@vitest/coverage-*` 도입 금지(§5 새 외부 dependency = BLOCKED).
- **`perEntity` 세부 표기 · mode 선택 UI 0** — 요약은 3 그룹 total + mode 한 줄까지. entity 별 breakdown 표시와 mode 선택(REPLACE/MERGE) 컨트롤은 별도 slice.
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(본 task 직후 큐잉 대상) AdminView import 확인 배선 마감 slice** — `pendingImportFile` + `importConfirmText` state 신설, `handleImport` 를 `runImportPreview` 우선으로 전환(파일 보관 + 요약 문구 설정), `onConfirmImport` = 보관 파일로 기존 `runImport` 호출 후 상태 초기화, `onCancelImport` = 보관 파일·문구 초기화, `importExportPanelProps` 에 `importConfirmText`/`onConfirmImport`/`onCancelImport` 3 props 추가. 대상 2 파일(`AdminView.tsx` / `AdminView.test.tsx`), 예상 ~180 LOC. 이 slice 가 머지돼야 UC-07 §5 64 행 gap 이 닫힌다.
- (T-1306 이월) 다른 문서(`docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md`) 의 endpoint 수 언급 drift 점검 — grep 으로 존재 여부부터 확인 후 slice 판단.
- (T-1306 이월) `conceptual placeholder` 2 행(`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 의 처분 — 제품 판단 대상.
- (T-1304 이월) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (T-1305 이월) export preview 2 종(`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단 — 제품 판단 대상.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — 실행 전 수치 표시로 위험은 줄지만 차단/경고 정책 자체는 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화 확인 후 flaky 하면 포기 선택지 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected`/`excluded` 를 `readonly TRecord[]` 로 좁히는 slice — 소비처 4 곳 동반 수정.
- (T-1291 이월) `selectExportRecords` 의 `RangeError` 가 download 경로에서 500 으로 나가는 문제의 status 매핑 판단.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외하는데 schema 는 not-null. **§5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) Export/Import Audit log row 영속화 0 — schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 — 새 dep 필요라 §5 승인 게이트.

---

## 결과 (2026-07-29 DONE)

PR [#1193](https://github.com/myungjoo/Assessment-Agent/pull/1193) squash merge `3516c228` (13:00:14Z), merge 후 main CI run `30454043419` = success.

- `AdminView.tsx` 에 상수 2(`ADMIN_IMPORT_PREVIEW_PATH` · `IMPORT_PREVIEW_UNKNOWN_TEXT`) + `ImportPreviewDeps` interface + 순수 러너 `runImportPreview` + 문구 helper `formatRestorePlanConfirmText` 신설, named export 추가. 기존 심볼 수정 0 (배선은 후속 slice T-1309).
- `AdminView.test.tsx` 에 러너 6 · helper 8 = 14 케이스 추가 (falsy file · in-flight 가드 · total narrowing · parts 공집합 · mode 표기 · fallback 1:1 cover). web vitest 2045 pass, backend jest 12271 pass, lint/build green.
- 초기 구현이 410 LOC 로 cap 초과라 spec 을 `it.each` 표 기반으로 통합하고 주석을 압축해 정확히 +300 LOC / 2 파일로 축소 — AC 가 요구한 분기·negative 케이스 누락 0.
- reviewer round 1 APPROVE, 4-게이트(APPROVE + PR comment 외화 + integrator 자체 점검 + CI green) 전부 충족.
