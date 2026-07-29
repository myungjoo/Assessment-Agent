---
id: T-1307
title: DataImportExportPanel 에 import 실행 전 확인 단계 추가 — 영향 범위 요약 + 실행/취소 (presentational)
phase: P6
status: DONE
prNumber: 1192
completedAt: 2026-07-29T11:50:15Z
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-07-29
independentStream: p6-import-confirm
dependsOn: []
touchesFiles:
  - web/src/components/DataImportExportPanel.tsx
  - web/src/components/DataImportExportPanel.test.tsx
plannerNote: "R-112 backbone x1.5 = 약 160 LOC / 2 파일. UC-07 §5 64 행 '강한 confirmation(영향 범위+명시 확인)' 이 web 에 0 인 gap 의 presentational 절반. 배선은 후속 slice"
---

# T-1307 — DataImportExportPanel 에 import 실행 전 확인 단계 추가 (presentational)

## Why

[UC-07](../use-cases/UC-07-export-import.md) 38 행과 §5 sequence 64 행은 Import 에 대해 **"강한 confirmation dialog 필수 — destructive 명시 + 영향 범위 표시 + 기존 데이터 삭제 경고 + 사용자 명시 확인"** 을 요구한다. 그런데 현재 web 의 실제 동작은 그 반대다 — `DataImportExportPanel` 의 `<input type="file">` 에서 **파일을 고르는 순간** `AdminView.runImport` 가 곧바로 `POST /api/admin/import` 를 발사한다 (`web/src/views/AdminView.tsx` 935~975 행). REPLACE 가 default 인 파괴적 복원에서 확인 단계 0 은 오조작 1 회로 전체 DB 가 교체될 수 있다는 뜻이고, 컴포넌트 머리 주석도 `confirm 흐름은 후속 container slice 책임` 이라고 그 미완을 스스로 박제해 뒀다.

backend 쪽 준비는 이미 끝났다. T-1297(service dry-run) → [T-1299](T-1299-import-preview-endpoint.md)(`POST /api/admin/import/preview` endpoint) → [T-1300](T-1300-import-preview-e2e.md)(실 HTTP e2e) → [T-1302](T-1302-import-preview-mode-echo.md)(`mode` echo) 4 겹으로 **"실행 전 영향 범위 수치 + 기준 mode"** 가 shipped 됐는데 ([UC-07](../use-cases/UC-07-export-import.md) §6.5), 그 응답의 **소비자가 아직 0** 이다 — web 에 표시할 자리 자체가 없기 때문이다. 본 task 는 그 자리를 만드는 presentational 절반이다: 패널이 `importConfirmText`(컨테이너가 preview 응답으로 합성한 영향 범위 요약) 를 받으면 파일 입력 대신 **경고 + 요약 + [실행]/[취소]** 확인 단계를 렌더한다.

[ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 의 presentational → wiring 순서를 그대로 따른다. 본 task 는 **presentational 만** — preview 호출·pendingFile 상태·확인 후 실제 실행 chain 은 후속 `AdminView` 배선 slice (`AdminView.tsx` + `AdminView.test.tsx` 2 파일) 로 분리했다. 한 task 로 합치면 4 파일 · 약 335 LOC 로 §3 cap (300 LOC) 을 넘긴다.

경고/확인 문구·fallback 규율은 같은 Admin 패널의 파괴적 형제인 [`ReEvaluationTriggerPanel.tsx`](../../web/src/components/ReEvaluationTriggerPanel.tsx) (`DEFAULT_CONFIRM_TEXT` + 빈 문자열 fallback) convention 을 그대로 차용해 두 파괴적 흐름의 표현을 일관시킨다.

**estimate 근거** — 컴포넌트 +약 45 LOC (props 3 개 + 상수 3 개 + 분기 1 개) + spec +약 110 LOC (happy/error/branch/negative 9~11 케이스) → base ~105, R-112 backbone (구현 + spec 동시 박제) × 1.5 = **~160 LOC / 2 파일** (cap 안, `sizeExempt` 불요).

## Required Reading

- [web/src/components/DataImportExportPanel.tsx](../../web/src/components/DataImportExportPanel.tsx) — 94 행 전체. 본 task 의 **유일한 구현 대상**. 현재 렌더 우선순위는 `busy`(role="status") → `error`(role="alert") → 기본 패널(export 버튼 + 파일 입력 + `message`) 3 분기. 머리 주석 6 행의 `confirm 흐름은 후속 container slice 책임` 문장은 본 task 가 절반을 닫으므로 함께 갱신한다.
- [web/src/components/DataImportExportPanel.test.tsx](../../web/src/components/DataImportExportPanel.test.tsx) — 204 행 전체. **검증 convention 이 특수하다**: jsdom·@testing-library 없이 `react-dom/server` 의 `renderToStaticMarkup` 으로 **정적 markup 문자열만** assert 한다 (ADR-0040 §5 dep 게이트). 이벤트가 발화되지 않으므로 **콜백 실호출은 검증 대상이 아니고**, 렌더 유무 · `role` 속성 · 라벨 텍스트 · `disabled` 속성으로 분기를 증명한다. 파일명은 `.test.tsx` 고정 (root jest `testRegex` pickup 충돌 회피).
- [web/src/components/ReEvaluationTriggerPanel.tsx](../../web/src/components/ReEvaluationTriggerPanel.tsx) 20~28 행 · 76~77 행 · 93~94 행 — 파괴적 동작 경고 상수 (`DEFAULT_CONFIRM_TEXT`) 와 `confirmText ? confirmText : DEFAULT_CONFIRM_TEXT` 빈-문자열 fallback 패턴. 본 task 가 mirror 할 convention. **0 수정**.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 38 행 · §5 sequence 64~65 행 · §6.5 — 요구의 원문 (강한 confirmation = destructive 명시 + 영향 범위 + 삭제 경고 + 확정/취소 응답) 과 preview 3 계약 (수치 일치 / DB write 0 / `mode` echo). **0 수정** — 본 task 는 계약을 바꾸지 않는다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 905~975 행 (`ImportDeps` + `runImport`) — 파일 선택 즉시 POST 가 발사되는 **현재 배선**. 다음 slice 의 수정 대상이자 본 task 의 props 설계 근거 (컨테이너가 어떤 값을 내려줄 수 있는지). **본 task 에서는 0 수정**.

## Acceptance Criteria

- [ ] **props 3 개 신설** — `DataImportExportPanelProps` 에 다음 optional props 를 추가하고 각각에 한국어 주석을 단다: (1) `importConfirmText?: string` — 확인 단계에 표시할 영향 범위 요약 문구. truthy 면 확인 단계로 진입한다. (2) `onConfirmImport?: () => void` — 실행 확정 콜백. (3) `onCancelImport?: () => void` — 취소 콜백. 기존 props 7 개의 이름·타입·의미는 **0 수정**.
- [ ] **상수 3 개 신설** — `DEFAULT_IMPORT_CONFIRM_TEXT` (파괴적 경고 기본 문구 — 기존 데이터가 삭제되고 파일 내용으로 대체된다는 사실 + 되돌릴 수 없다는 사실을 한국어로 명시), `CONFIRM_LABEL` (예: `'실행'`), `CANCEL_LABEL` (예: `'취소'`). 정확한 문안은 구현이 정하되 `ReEvaluationTriggerPanel` 의 `DEFAULT_CONFIRM_TEXT` 어조와 일관시킨다.
- [ ] **확인 단계 분기 삽입 (렌더 우선순위 명시)** — 분기 순서는 `busy` → `error` → **확인 단계** → 기본 패널. 즉 `busy === true` 면 기존대로 진행 표시만, `busy` 가 아니고 `error` 가 truthy 면 기존대로 alert 만, 그 다음으로 `importConfirmText` 가 truthy 면 확인 단계를 렌더한다. 확인 단계 markup 은 `role="alertdialog"` 컨테이너 안에 (a) 파괴적 경고 문구 (`DEFAULT_IMPORT_CONFIRM_TEXT`), (b) `importConfirmText` 요약, (c) 실행 버튼, (d) 취소 버튼을 담는다.
- [ ] **확인 대기 중 트리거 억제** — 확인 단계에서는 **export 버튼과 파일 입력을 렌더하지 않는다** (`busy` 정책과 동형 — 확인 대기 중 새 파일 선택·동시 export 트리거 차단). `message` 도 확인 단계에서는 렌더하지 않는다 (직전 안내가 파괴적 확인 문구와 섞이지 않도록).
- [ ] **콜백 미전달 방어** — `onConfirmImport` 미전달이면 실행 버튼을 `disabled`, `onCancelImport` 미전달이면 취소 버튼을 `disabled` 로 렌더한다 (기존 `onExport`/`onImportFile` 의 "콜백 없으면 비활성" convention 동형). `onClick` 은 `() => onConfirmImport?.()` 형태의 optional call 로 둔다.
- [ ] **하위 호환 0 회귀** — 신규 props 를 하나도 전달하지 않으면 (`importConfirmText === undefined`) 렌더 결과가 **현재와 완전히 동일** 해야 한다. 기존 test 파일의 기존 케이스는 **한 줄도 수정하지 않고** 그대로 통과해야 한다 (수정이 필요하다면 설계가 틀린 것 — 분기 순서를 재검토).
- [ ] **Happy-path unit test 1+** — `importConfirmText` + 두 콜백을 모두 전달 → `role="alertdialog"` 렌더 · 기본 경고 문구 포함 · 전달한 요약 문구 포함 · 실행/취소 두 버튼 활성(`disabled` 미포함) · `type="file"` 미렌더 · export 라벨 미렌더.
- [ ] **Error path unit test 2+** — (a) `busy=true` + `importConfirmText` 동시 전달 → `role="status"` 진행 표시만, `alertdialog` 미렌더 (busy 우선 정책 보존). (b) `error` truthy + `importConfirmText` 동시 전달 → `role="alert"` 만, `alertdialog` 미렌더 (error 우선 보존).
- [ ] **Flow / branch coverage** — 신설 분기마다 1+ test: (a) 확인 단계 진입 분기, (b) `onConfirmImport` 미전달 → 실행 버튼 `disabled`, (c) `onCancelImport` 미전달 → 취소 버튼 `disabled`, (d) 두 콜백 모두 미전달 → 두 버튼 모두 `disabled`, (e) `importConfirmText` falsy → 기본 패널 분기 유지.
- [ ] **Negative cases 충분 cover (예외 상황 분기마다 1+)** — (a) `importConfirmText=""` (빈 문자열 경계값) → 확인 단계 **미진입**, 기본 패널(export 버튼 + 파일 입력) 렌더. (b) `importConfirmText` + `message` 동시 전달 → 확인 단계 우선, `message` 문자열 미노출. (c) `importConfirmText` 만 전달하고 `onImportFile`·`onExport` 는 미전달 → 여전히 확인 단계 렌더 (기본 패널 콜백 유무와 무관). (d) 요약 문구에 `<`, `&` 같은 특수문자가 포함돼도 React 기본 escape 로 안전하게 렌더 (raw HTML 주입 0). 단일 negative 만 작성 금지 — 위 각각 1+.
- [ ] **테스트 실행 통과** — `pnpm --filter web test` 전량 green (`vitest run`), `pnpm --filter web build` 통과 (`tsc --noEmit -p tsconfig.json && vite build` — 타입 오류 0). backend 는 변경 0 이지만 CI 가 함께 도는 `pnpm lint && pnpm build && pnpm test` 도 green 이어야 한다.
- [ ] **coverage 기준 명시** — `web/` 은 vitest `coverageThreshold` 가 아직 없어 (PLAN.md P6 "게이트된 backlog — web coverage threshold", T-1165 reviewer MINOR-2) line/function ≥ 80% 를 기계로 강제하지 못한다. 따라서 본 task 는 **신설 분기 전수 cover 를 위 test 항목으로 대체 강제** 한다 — 새로 추가한 `if` 분기와 `disabled` 조건 각각에 대응하는 케이스가 spec 에 존재함을 PR body 에서 1:1 로 대조해 보인다. backend `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 는 변경 0 이라 기존 수치가 그대로 유지돼야 한다.
- [ ] **머리 주석 갱신** — `DataImportExportPanel.tsx` 6 행의 `confirm 흐름은 후속 container slice 책임 (Out of Scope)` 문장을 현재 사실로 고친다 — 확인 단계 **표시** 는 본 컴포넌트 책임이고, preview 호출·pendingFile 보관·확정 후 POST 발사는 여전히 컨테이너 책임임을 1~2 줄로 구분해 박제 (T-1307 표기 포함).
- [ ] **언어 규율 (§12)** — 주석 · test 의 `it` 문구 · 사용자 노출 문구는 한국어, 식별자 · props 명 · `role` 값 · 명령어는 영어.

## Out of Scope

- **`web/src/views/AdminView.tsx` · `AdminView.test.tsx` 0 수정** — preview 호출(`POST /api/admin/import/preview`) · 선택 파일 보관 · 확인 후 실제 import 발사 · 요약 문구 합성은 **후속 배선 slice** 책임 (본 task 의 Follow-ups 에 명시). 본 task 를 머지해도 사용자 동작은 변하지 않는다 (신규 props 를 아무도 전달하지 않으므로) — 그것이 의도된 상태다.
- **`src/**` · `test/**` 0 수정** — backend 계약은 T-1299/T-1302 로 이미 shipped. 서버 변경이 필요하다고 느껴지면 설계가 틀린 것이다.
- **문서 0 수정** — `docs/architecture/api.md` · `UC-07` 은 이미 preview 계약을 정본으로 담고 있어 drift 가 없다. §3.1 rule 3 (direct/pr 혼합 금지) 상 문서 수정이 필요해지면 별도 direct task 로 분리한다.
- **새 dependency 0** — `@testing-library/react` · `jsdom` · `@vitest/coverage-*` 도입 금지 (§5 새 외부 dependency = BLOCKED). 검증은 기존 `renderToStaticMarkup` convention 안에서 한다.
- **export 쪽 확인 흐름 0** — export 는 파괴적이지 않다. 본 task 는 import 확인만 다룬다.
- **`web/package.json` coverageThreshold 도입 0** — PLAN.md 의 게이트된 backlog 항목이라 별도 task (새 dep 필요).
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종(T-0791/T-0944/T-0947) 동반 수정으로 6 파일이 되어 cap 이 깨진 Q-0054 선례가 있다.
- **모달·포커스 트랩·키보드 ESC 처리 0** — 접근성 심화는 별도 slice. 본 task 는 `role="alertdialog"` + 두 버튼의 정적 markup 까지만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **(본 task 직후 큐잉 대상) AdminView import 확인 배선 slice** — `runImportPreview` 러너 신설(`POST /api/admin/import/preview` multipart, `ImportDeps` 주입 convention 차용) + 응답(`RestorePlanSummary` + `mode`) → 사람-친화 요약 문구 합성 helper + 선택 파일 보관 state + 확정 시 기존 `runImport` 호출 · 취소 시 상태 초기화. 대상 2 파일(`AdminView.tsx` / `AdminView.test.tsx`), 예상 ~200 LOC.
- (T-1306 이월) 다른 문서 (`docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md`) 의 endpoint 수 언급 drift 점검 — grep 으로 존재 여부부터 확인 후 slice 판단.
- (T-1306 이월) `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 의 처분 — 구현할지 표에서 제거하고 `/api/permission-denied-records` 로 일원화할지 제품 판단 대상.
- (T-1304 이월) UC-07 §5 mermaid sequence 에 preview step (import dry-run + export scope preview) 반영 — autonumber 재정렬 동반이라 별도 slice.
- (T-1305 이월) export preview 2 종 (`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단 — 사용자 대면 status 결정이라 제품 판단 대상 (T-1291 이월 `RangeError` 항목과 함께 처리 가능).
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. 본 task + 배선 slice 가 **실행 전 수치 표시** 로 오조작 위험을 크게 줄이지만, 차단/경고 정책 자체는 여전히 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 (line/function ≥ 80% 기계 강제) — `@vitest/coverage-*` 새 dep 필요라 §5 승인 게이트.
