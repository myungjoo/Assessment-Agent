---
id: T-1309
title: AdminView import 확인 배선 마감 — preview 우선 전환 + pendingFile 보관 + 패널 3 props 전달
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-07-29
independentStream: p6-import-confirm
dependsOn: [T-1307, T-1308]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "R-112 backbone x1.5 = 약 220 LOC / 2 파일. T-1308 순수 러너의 배선 절반 — UC-07 §5 64 행 confirmation gap 을 닫는 마지막 조각"
---

# T-1309 — AdminView import 확인 배선 마감 (preview 우선 전환 + 확정/취소 배선)

## Why

[UC-07](../use-cases/UC-07-export-import.md) 38 행 · §5 sequence 64 행이 요구하는 **"강한 confirmation — 파괴적 명시 + 영향 범위 표시 + 사용자 명시 확인"** 은 지금 두 조각으로 나뉜 채 서로 닿지 않는다. [T-1307](T-1307-import-confirm-step-panel.md)(PR #1192) 이 `DataImportExportPanel` 에 확인 단계 **표시** 를(`importConfirmText` truthy → `role="alertdialog"` + 실행/취소), [T-1308](T-1308-adminview-import-preview-runner.md)(PR #1193) 이 `AdminView` 에 **preview 러너 + 요약 문구 helper** 를(`runImportPreview` / `formatRestorePlanConfirmText`) 박제했지만, 둘을 잇는 컨테이너 배선이 없어 **호출처·소비자 모두 여전히 0** 이다. 실제 사용자 동작은 그대로 "파일 선택 즉시 `POST /api/admin/import` 발사"(`web/src/views/AdminView.tsx` 3564~3575 행 `handleImport`) — REPLACE 가 default 인 파괴적 복원이 오조작 1 회로 전체 DB 를 교체할 수 있는 상태다.

본 task 는 그 마지막 한 겹을 잇는다: `handleImport` 를 **preview 우선** 으로 전환해 선택 파일을 보관하고 요약 문구를 상태로 올린 뒤, 확인 단계의 3 props(`importConfirmText` / `onConfirmImport` / `onCancelImport`) 를 패널에 전달한다. 확정 시에는 보관 파일로 **기존 `runImport` 를 그대로 재사용** 해 실행 경로를 바꾸지 않는다. 이 slice 가 머지되면 UC-07 §5 64 행 gap 이 닫히고, T-1297~T-1302 로 shipped 된 `POST /api/admin/import/preview` 계약이 처음으로 실사용 소비자를 갖는다.

**설계 규율** — 확정/취소 로직은 컨테이너 closure 에 인라인하지 않고 **순수 러너로 추출해 export** 한다. `web/` 검증이 jsdom·@testing-library 없이 `renderToStaticMarkup` 정적 markup 만 assert 하는 convention(ADR-0040 §5 dep 게이트) 이라 **이벤트가 발화되지 않기 때문** — 콜백 본체를 순수 함수로 빼야 R-112 분기 cover 가 성립한다. 이는 `runImport` / `runImportPreview` / `runAssign` 이 이미 쓰는 `*Deps` 주입 convention 그대로이므로 새 패턴 0 이다.

**estimate 근거** — 구현 +약 100 LOC(deps interface 1 + 확정 러너 1 + 초기화 helper 1 + state 2 + handler 3 + props Pick 확장 + `initialImportConfirmText` 주입 + 한국어 주석), spec +약 120 LOC(러너 8~9 케이스 + 정적 렌더 3 케이스) → base ~145, R-112 backbone(구현 + spec 동시 박제) × 1.5 = **~220 LOC / 2 파일**. 같은 stream 의 실측 편차(T-1307 est 160 → 221 `+38%`, T-1308 est 200 → 300 `+50%`)를 감안해 T-1308 보다 scope 를 한 단계 더 좁혔다(확정 러너 + 취소 helper 까지만, mode 선택·`perEntity` 표기 0).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 966~1018 행 — `ImportDeps` + `runImport`. 본 task 의 확정 러너가 **위임할 실행 러너**. 가드 2 종(falsy file / in-flight) · 시작 시 error·message 비움 · `finally` 진행 off 는 그대로 재사용한다. **본 task 에서 본문 0 수정**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 1020~1074 행 — `ImportPreviewDeps` + `runImportPreview`(T-1308). 컨테이너가 주입해야 할 7 필드(특히 신규 `setImportConfirmText`)와 성공/실패 시 확인 문구 처리 규약. **0 수정**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 3541~3595 행 — `importing`/`importMessage`/`importError` state, `handleImport` `useCallback`, `importExportPanelProps` 의 `Pick<DataImportExportPanelProps, ...>` 합성(busy → error → message 우선순위 주석 포함). **본 task 의 유일한 수정 구역**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 449~471 행 — `AdminViewProps` 의 `initial*` 주입 convention(`initialScheduleBusy` 등). 정적 렌더로 분기를 증명하기 위한 초기값 주입 affordance 를 같은 형태로 1 개 추가한다.
- [web/src/components/DataImportExportPanel.tsx](../../web/src/components/DataImportExportPanel.tsx) 44~60 행 · 86~110 행 — 소비처 계약: `importConfirmText?: string` / `onConfirmImport?: () => void` / `onCancelImport?: () => void`, 렌더 우선순위 `busy` → `error` → 확인 단계 → 기본 패널, 콜백 미전달 시 버튼 `disabled`. **0 수정**.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 3030~3120 행 부근 `runImport` 검증 harness(`makeImportDeps` — setter 호출을 배열로 캡처, `request` mock 주입) 와 270~340 행의 `renderToStaticMarkup(<AdminView ... />)` 정적 렌더 convention. 본 task 의 spec 이 그대로 mirror 한다.

## Acceptance Criteria

- [ ] **`ConfirmImportDeps` 신설** — `ImportDeps` 를 확장(`extends`)해 `setImportConfirmText: (next: string | undefined) => void` 와 `setPendingImportFile: (next: File | undefined) => void` 2 필드를 더한다. 각 필드에 한국어 주석. 기존 `ImportDeps` · `ImportPreviewDeps` 는 **0 수정**.
- [ ] **`runConfirmedImport(file: File | undefined, deps: ConfirmImportDeps): Promise<void>` 신설** — 동작 순서: (a) `!file` 또는 `deps.importing === true` → **아무 setter 도 호출하지 않고 즉시 return**(확인 상태 보존 + 이중 확정 차단), (b) 확인 단계 종료 — `setImportConfirmText(undefined)` + `setPendingImportFile(undefined)`, (c) 기존 `runImport(file, deps)` 에 위임해 `POST /api/admin/import` 를 발사한다(진행 표시·완료 문구·에러 표면화·`finally` 해제는 전부 기존 러너 책임 — 재구현 0), (d) throw 0.
- [ ] **`clearImportConfirm(deps)` 신설** — 취소용 초기화 helper. `setImportConfirmText(undefined)` + `setPendingImportFile(undefined)` 만 수행한다(POST 0 · error/message 는 건드리지 않음). deps 타입은 `Pick<ConfirmImportDeps, 'setImportConfirmText' | 'setPendingImportFile'>` 로 좁혀 오용을 막는다.
- [ ] **컨테이너 state 2 개 신설** — `importConfirmText: string | undefined`(초기값은 아래 `initialImportConfirmText` props), `pendingImportFile: File | undefined`(초기 `undefined`). 각각 한국어 주석으로 소유 근거를 박제한다.
- [ ] **`initialImportConfirmText?: string` props 추가** — `AdminViewProps` 에 기존 `initial*` 주입 convention 과 동형으로 추가(한국어 주석 포함). 미주입 시 `undefined` — 즉 **현재 동작과 완전히 동일**.
- [ ] **`handleImport` 를 preview 우선으로 전환** — 파일 선택 시 (a) `setPendingImportFile(file)` 로 선택 파일을 보관하고, (b) `runImport` 대신 `runImportPreview(file, { ... , setImportConfirmText })` 를 호출한다. 확인 단계 진입 여부는 오직 `importConfirmText` 가 결정하므로 preview 실패·가드 no-op 시 보관 파일은 도달 불가(무해)임을 주석 1~2 줄로 박제한다. `useCallback` 의존성 배열도 실제 참조에 맞게 갱신한다.
- [ ] **확정·취소 핸들러 배선** — `handleConfirmImport = () => runConfirmedImport(pendingImportFile, { post: request, describeError: toErrorMessage, importing, setImporting, setImportError, setImportMessage, setImportConfirmText, setPendingImportFile })`, `handleCancelImport = () => clearImportConfirm({ setImportConfirmText, setPendingImportFile })`. 둘 다 `useCallback` + 정확한 의존성 배열.
- [ ] **패널 props 3 개 전달** — `importExportPanelProps` 의 `Pick<DataImportExportPanelProps, ...>` union 에 `'importConfirmText' | 'onConfirmImport' | 'onCancelImport'` 를 더하고 값 3 개를 채운다. 기존 5 props(`onExport`/`onImportFile`/`busy`/`error`/`message`) 의 값 합성은 **0 수정**(`busy: exporting || importing` 유지 — preview 진행 중에는 패널이 busy 표시, 완료 후 확인 단계로 전환된다).
- [ ] **named export 추가** — `runConfirmedImport` · `clearImportConfirm` · `ConfirmImportDeps`(type) 를 기존 `runImport`/`runImportPreview` 와 같은 export 블록에 추가한다. 기존 export 목록은 **0 수정**.
- [ ] **Happy-path unit test 1+** — 보관 파일 + deps 로 `runConfirmedImport` 호출 → `setImportConfirmText(undefined)` · `setPendingImportFile(undefined)` 가 각 1 회, `post` 가 `/api/admin/import` 로 1 회(`method: 'POST'` + `FormData` body), 성공 시 `setImportMessage` 에 완료 안내, `importing` 전이가 `[true, false]` 임을 단언.
- [ ] **Error path unit test 2+** — (a) `post` 가 403 `ApiError` 로 reject → `setImportError` 에 사람-친화 문구, throw 0, `importing` `[true, false]`, 확인 상태는 이미 비워진 채 유지. (b) 비-`ApiError`(네트워크 실패) throw → 동일하게 문구 표면화 + throw 0.
- [ ] **Flow / branch coverage** — 신설 분기마다 1+ test: (a) `file === undefined` → `post` 미호출 **및 setter 전부 미호출**, (b) `importing: true` → `post` 미호출 + `setImportConfirmText`/`setPendingImportFile` 미호출(확인 상태 보존 — 회귀 위험 지점), (c) 성공 분기, (d) 실패 분기, (e) `clearImportConfirm` → 두 setter 가 각각 `undefined` 로 1 회씩 호출되고 `post` 는 0 회.
- [ ] **Negative cases 충분 cover (예외 상황 분기마다 1+)** — (a) `file` 미보관(`undefined`) 확정 시도 → no-op(위 (a) 와 동일 케이스로 겸용 가능하나 단언은 setter 미호출까지), (b) 이중 확정(`importing: true`) → 실행 미발사, (c) `post` 가 비-`ApiError` 로 throw → 문구 표면화 + throw 0, (d) 정적 렌더에서 `initialImportConfirmText=""`(빈 문자열 경계값) → 확인 단계 **미진입**, 기본 패널(export 버튼 + 파일 입력) 렌더, (e) 확인 단계 렌더 시 `type="file"` 입력과 export 버튼이 **미렌더**(확인 대기 중 트리거 억제 배선 회귀). 단일 negative 만 작성 금지 — 위 각각 1+.
- [ ] **정적 렌더 배선 증명 3 케이스** — `renderToStaticMarkup(<AdminView ... />)` 으로: (1) `initialImportConfirmText` 주입 → `role="alertdialog"` 렌더 + 주입한 요약 문구 노출 + 실행/취소 버튼이 **활성**(`disabled` 미포함 — 3 props 가 실제로 전달됐다는 증거), (2) 미주입 → 확인 단계 미렌더 + 기존 파일 입력·export 버튼 그대로(회귀 0), (3) 빈 문자열 → 기본 패널(위 negative (d) 와 겸용 가능).
- [ ] **하위 호환 0 회귀** — 기존 `runImport` · `runImportPreview` · `formatRestorePlanConfirmText` 는 0 수정이고, `AdminView.test.tsx` 의 기존 케이스는 **한 줄도 수정하지 않고** 그대로 통과해야 한다(수정이 필요하면 설계가 틀린 것 — 분기 순서·props 합성을 재검토).
- [ ] **테스트 실행 통과** — `pnpm --filter web test` 전량 green(`vitest run`), `pnpm --filter web build` 통과(`tsc --noEmit -p tsconfig.json && vite build` — 타입 오류 0). backend 변경 0 이지만 CI 가 함께 도는 `pnpm lint && pnpm build && pnpm test` 도 green 이어야 한다.
- [ ] **coverage 기준 명시** — `web/` 에는 vitest `coverageThreshold` 가 아직 없으므로(PLAN.md P6 게이트된 backlog) 신설 분기 전수 cover 를 위 test 항목으로 대체 강제한다 — 새로 추가한 `if` 분기와 no-op 경로 각각에 대응하는 케이스가 spec 에 존재함을 PR body 에서 1:1 로 대조해 보인다. backend `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 는 변경 0 이라 기존 수치가 유지돼야 한다.
- [ ] **cap 준수** — 합계 diff ≤ 300 LOC / 2 파일. 초안이 300 을 넘으면 (1) 정적 렌더 케이스 (3) 을 negative (d) 로 흡수 → (2) 주석 압축 순으로 줄이고 축약 내역을 PR body 에 박제한다(T-1299 선례).
- [ ] **언어 규율 (§12)** — 주석 · `it` 문구 · 사용자 노출 문구는 한국어, 식별자 · props 명 · path · 명령어는 영어.

## Out of Scope

- **`web/src/components/**` 0 수정** — 확인 단계 표시는 T-1307 이 이미 shipped 했다. 컴포넌트 수정이 필요하다고 느껴지면 배선 설계가 틀린 것이다.
- **`runImport` · `runImportPreview` · `formatRestorePlanConfirmText` 본문 0 수정** — 본 task 는 이들을 **조립만** 한다. 문구·가드·시그니처를 건드리지 않는다.
- **`src/**` · `test/**` 0 수정** — preview/실행 계약은 T-1299/T-1300/T-1302 로 shipped. 서버 변경 불요.
- **문서 0 수정** — `api.md` · UC-07 은 preview 계약 정본을 이미 담고 있어 drift 0. 수정이 필요해지면 §3.1 rule 3 상 별도 direct task 로 분리한다.
- **새 dependency 0** — `@testing-library/react` · `jsdom` · `@vitest/coverage-*` 도입 금지(§5 새 외부 dependency = BLOCKED). 검증은 기존 `renderToStaticMarkup` + `*Deps` 주입 convention 안에서 한다.
- **mode 선택 UI · `perEntity` 세부 표기 0** — 확인 문구는 3 그룹 total + mode 한 줄까지(T-1308 확정). REPLACE/MERGE 선택 컨트롤과 entity 별 breakdown 표시는 별도 slice.
- **모달·포커스 트랩·ESC 키 처리 0** — 접근성 심화는 별도 slice(T-1307 Out of Scope 승계).
- **web e2e/통합 테스트 신설 0** — 브라우저 이벤트 왕복 검증은 jsdom 도입 게이트에 묶인다.
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 머지 후 관측) UC-07 §5 64 행 gap 종료 여부 확인 — 닫혔다면 UC-07 §5/§6.5 의 "web 미배선" 서술을 현재 사실로 고치는 **direct doc task** 1 개 큐잉(§3.1 rule 3 대로 코드와 분리).
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
