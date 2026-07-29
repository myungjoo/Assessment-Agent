---
id: T-1310
title: import 실행 결과 문구에 실제 복원 영향 요약 반영 (restoreSummary 소비)
phase: P6
status: DONE
commitMode: pr
prNumber: 1195
completedAt: 2026-07-29T14:48:52Z
coversReq: [REQ-030, REQ-045]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-07-29
independentStream: p6-import-confirm
dependsOn: [T-1296, T-1308, T-1309]
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: "P6 deferred 'import 결과 상세' — T-1296 restoreSummary 의 web 소비자 0 해소. R-112 backbone x1.5 = 약 230 LOC / 2 파일"
---

# T-1310 — import 실행 결과 문구에 실제 복원 영향 요약 반영

## Why

[T-1296](T-1296-import-response-restore-summary.md) 이 `POST /api/admin/import` 응답에 `restoreSummary`(deleted / inserted / kept 3 그룹 수치)를 additive 로 실었고, [T-1307](T-1307-import-confirm-step-panel.md)~[T-1309](T-1309-adminview-import-confirm-wiring.md) 으로 **실행 전** preview 수치는 확인 단계에 표시되게 됐다. 그런데 **실행 후** 응답의 `restoreSummary` 는 web 에서 여전히 **소비자 0** 이다 — `web/src/views/AdminView.tsx` 의 `formatImportJobDetail` 이 `id / status / mode` 3 필드만 읽고 요약을 버려, 사용자는 "가져오기 요청됨 — job …, 상태 PENDING, 모드 REPLACE" 만 보고 **실제로 무엇이 지워지고 들어갔는지** 를 알 수 없다. `git grep restoreSummary -- web/` 결과가 origin/main 에서 0 hit 임을 pre-check 로 확인했다.

본 task 는 그 마지막 소비 구간을 닫는다: 실행 응답에 읽을 수 있는 `restoreSummary` 가 있으면 결과 문구 뒤에 **실제 반영 수치 한 조각** 을 덧붙인다. 이로써 [PLAN.md](../PLAN.md) P6 deferred 잔여의 "import 결과 상세" 항목이 실질 진전하고, 확인 단계에서 본 preview 수치와 실행 후 실제 수치를 사용자가 같은 화면에서 대조할 수 있다([UC-07](../use-cases/UC-07-export-import.md) §6.5 계약 (i) "preview 수치 == 실행 응답 `restoreSummary`" 가 사용자에게 관측 가능해진다).

**설계 규율** — 3 그룹 total 을 훑어 `삭제 N 건 / 삽입 N 건 / 보존 N 건` 을 만드는 로직은 이미 `formatRestorePlanConfirmText`(T-1308) 안에 있다. 같은 스캔을 복제하지 않고 **순수 helper 1 개로 추출해 두 곳이 공유** 한다 — 단 `formatRestorePlanConfirmText` 의 **외부 동작은 한 글자도 바뀌지 않아야** 하며, 그 증거는 T-1308 기존 spec 을 **한 줄도 수정하지 않고** 통과시키는 것이다. `web/` 검증은 jsdom 없이 `renderToStaticMarkup` + 순수 helper 직접 호출 convention(ADR-0040 §5 dep 게이트) 안에서 한다.

**estimate 근거** — 구현 +약 60 LOC(공유 helper 1 + `formatImportJobDetail` 분기 1 + 상수 1 + 한국어 주석), spec +약 90 LOC(helper 직접 호출 케이스 + `runImport` 왕복 1~2 케이스) → base ~150, R-112 backbone(구현 + spec 동시 박제) × 1.5 = **~230 LOC / 2 파일**. 같은 stream 실측 편차(T-1307 `+38%`, T-1308 `+50%`, T-1309)를 감안해 표시 범위를 **3 그룹 total 까지만** 으로 좁혔다(perEntity breakdown 0).

## Required Reading

- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 263~294 행 — `IMPORT_DONE_TEXT` 상수 + `formatImportJobDetail(job: unknown)`. 본 task 의 **주 수정 대상**. 방어적 narrowing 순서(비객체 → id 부재 → parts 합성)와 fallback 규약을 그대로 유지한 채 뒤에 한 조각만 덧붙인다.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 296~334 행 — `formatRestorePlanConfirmText`(T-1308) 의 3 그룹 스캔 루프(`deleted`/`inserted`/`kept` × `total` 유한 number 판정, `0` 은 유효 수치라 falsy 로 흘리지 않음). 본 task 가 **공유 helper 로 추출할 원본**.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 989~1022 행 — `runImport`. `deps.post` 응답 전체(= job 필드 + `restoreSummary`)를 그대로 `formatImportJobDetail` 에 넘기므로 **본 task 에서 `runImport` 본문 수정은 불필요**. 0 수정.
- [web/src/views/AdminView.tsx](../../web/src/views/AdminView.tsx) 4941~4955 행 부근 `export { ... }` 블록 — named export 목록. 신설 helper 를 여기에만 추가하고 기존 항목은 0 수정.
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 3267~3340 행 — `formatImportJobDetail` 기존 describe(정확 문자열 단언 다수). 본 task 는 이 케이스들이 **무수정 통과** 해야 한다(요약 부재 입력의 출력 불변).
- [web/src/views/AdminView.test.tsx](../../web/src/views/AdminView.test.tsx) 3474~3525 행 — `formatRestorePlanConfirmText` 기존 describe. helper 추출 후에도 **무수정 통과** 가 리팩터 안전성의 증거다.
- [src/import/import.controller.spec.ts](../../src/import/import.controller.spec.ts) 239~250 행 · 927~935 행 — 실 응답 envelope(`{ ...job, restoreSummary }`)의 정확한 shape. spec fixture 를 이 사실에 맞춘다. **0 수정**.

## Acceptance Criteria

- [ ] **공유 helper `formatRestoreTotalsPhrase(value: unknown): string | undefined` 신설** — `deleted`/`inserted`/`kept` 3 그룹의 `total` 을 훑어 `삭제 N 건 / 삽입 N 건 / 보존 N 건` 형태 문자열을 반환한다. 규약: (a) 비객체 · `null` · 배열 → `undefined`, (b) 그룹이 비객체면 그 그룹만 생략, (c) `total` 이 유한 number 일 때만 노출(`0` 은 유효 수치라 반드시 표기), (d) 어느 그룹도 못 읽으면 `undefined`, (e) throw 0. 각 규약에 한국어 주석.
- [ ] **`formatRestorePlanConfirmText` 를 공유 helper 로 재작성** — 3 그룹 스캔을 위 helper 호출로 대체하고, `undefined` 반환 시 기존 `IMPORT_PREVIEW_UNKNOWN_TEXT` fallback · mode suffix 규약은 그대로 유지한다. **외부 동작(반환 문자열) 은 모든 입력에 대해 변경 0** — 증거는 T-1308 기존 spec 무수정 통과.
- [ ] **`formatImportJobDetail` 에 실제 반영 수치 append 분기 추가** — 응답 record 의 `restoreSummary` 를 위 helper 에 넘겨 문자열이 나오면 기존 상세 문구 뒤에 한 조각을 덧붙인다(예: `가져오기 요청됨 — job x1, 상태 PENDING, 모드 REPLACE (반영 결과 — 삭제 3 건 / 삽입 5 건 / 보존 2 건)`). 접두 문구는 상수 1 개로 박제해 spec 과 문자열을 공유한다.
- [ ] **기존 우선순위·fallback 규약 보존** — (a) 비객체 · `null` · `id` 부재 · 빈 `id` → 여전히 `IMPORT_DONE_TEXT`(`'가져오기 완료'`) 만 반환하고 **요약을 덧붙이지 않는다**(job 식별 불가 상태에서 수치만 표시하면 오독), (b) `restoreSummary` 가 없거나 읽을 수 없으면 **덧붙이지 않는다** — preview 와 달리 경고 문구 fallback 을 쓰지 않는 이유(실행은 이미 발사됐고 수치 부재가 위험 신호가 아님)를 주석 1~2 줄로 박제.
- [ ] **named export 추가** — `formatRestoreTotalsPhrase` 를 기존 export 블록에 추가(기존 목록 0 수정).
- [ ] **Happy-path unit test 2+** — (1) `formatRestoreTotalsPhrase({deleted:{total:3},inserted:{total:5},kept:{total:2}})` → `삭제 3 건 / 삽입 5 건 / 보존 2 건`. (2) `formatImportJobDetail({id:'x1',status:'PENDING',mode:'REPLACE',restoreSummary:{...}})` → job 상세 + 반영 결과 조각이 **둘 다** 포함된 정확 문자열.
- [ ] **Error path unit test 2+** — (a) `restoreSummary` 가 비객체(`'ok'` · `42` · `null`) → 예외 없이 job 상세만 반환. (b) `restoreSummary` 가 배열 → 동일하게 job 상세만 반환(throw 0).
- [ ] **Flow / branch coverage** — 신설·수정 분기마다 1+ test: (a) 요약 읽힘 → append, (b) 요약 부재(key 자체 없음) → 기존 문자열 그대로, (c) 요약 있으나 3 그룹 모두 판독 불가 → append 0, (d) 일부 그룹만 판독 가능(`inserted` 만 number) → 그 그룹만 표기, (e) `id` 부재 + 요약 존재 → `IMPORT_DONE_TEXT` 만(요약 미표기).
- [ ] **Negative cases 충분 cover (예외 상황 분기마다 1+)** — (a) 3 그룹 total 이 전부 `0` → `삭제 0 건 / 삽입 0 건 / 보존 0 건` 이 **표기됨**(경계값 — `0` 이 falsy 로 사라지지 않음), (b) `total` 이 `NaN` · `Infinity` → 그 그룹 생략, (c) `total` 이 문자열 `'3'`(type mismatch) → 그 그룹 생략, (d) 그룹이 `null` → 그 그룹만 생략하고 나머지는 표기, (e) 빈 `id`(`''`) + 정상 요약 → `IMPORT_DONE_TEXT` 만. 단일 negative 만 작성 금지 — 위 각각 1+.
- [ ] **runImport 왕복 test 1+** — `post` mock 이 `{ id:'j1', status:'PENDING', mode:'MERGE', restoreSummary:{...} }` 를 resolve → `setImportMessage` 가 **반영 결과 조각을 포함한** 문구로 1 회 호출되고, `importing` 전이가 `[true,false]`, throw 0 임을 단언(기존 `makeImportDeps` harness 재사용, `runImport` 본문 0 수정).
- [ ] **하위 호환 0 회귀** — `AdminView.test.tsx` 의 **기존 케이스를 한 줄도 수정하지 않고** 전량 통과해야 한다(수정이 필요하면 helper 추출이 동작을 바꾼 것 — 재설계). `runImport` · `runImportPreview` · `runConfirmedImport` · `clearImportConfirm` 본문 0 수정.
- [ ] **테스트 실행 통과** — `pnpm --filter web test` 전량 green, `pnpm --filter web build` 통과(타입 오류 0). backend 변경 0 이지만 CI 가 함께 도는 `pnpm lint && pnpm build && pnpm test` 도 green.
- [ ] **coverage 기준 명시** — `web/` 에는 vitest `coverageThreshold` 가 아직 없으므로(PLAN P6 게이트된 backlog) 신설 분기 전수 cover 를 위 test 항목으로 대체 강제한다 — 새로 추가한 `if`/루프 분기와 no-op 경로 각각에 대응하는 케이스가 spec 에 존재함을 PR body 에서 1:1 대조로 보인다. backend `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 는 변경 0 이라 기존 수치 유지.
- [ ] **cap 준수** — 합계 diff ≤ 300 LOC / 2 파일. 초안이 300 을 넘으면 (1) 유사 케이스를 `it.each` 표로 통합(T-1308 선례) → (2) 주석 압축 순으로 줄이고 축약 내역을 PR body 에 박제한다. **케이스 자체를 버리지 않는다**.
- [ ] **언어 규율 (§12)** — 주석 · `it` 문구 · 사용자 노출 문구는 한국어, 식별자 · path · 명령어는 영어.

## Out of Scope

- **`web/src/components/**` 0 수정** — 결과 문구는 기존 `message` props 경로로 그대로 흐른다. 컴포넌트 수정이 필요하다고 느껴지면 배선 설계가 틀린 것이다.
- **`src/**` · `test/**` 0 수정** — 응답 envelope 는 T-1296 으로 shipped. 서버 변경 불요.
- **문서 0 수정** — `api.md` · UC-07 은 `restoreSummary` 계약 정본을 이미 담고 있어 drift 0. 필요해지면 §3.1 rule 3 상 별도 direct task.
- **`perEntity` breakdown 표시 0** — entity 별 수치 표기는 문구 길이·레이아웃 판단이 필요한 별도 slice. 본 task 는 3 그룹 total 까지.
- **preview 수치 ↔ 실행 수치 자동 대조 UI 0** — 두 값 비교·불일치 경고는 별도 slice(제품 판단 포함).
- **`runImport` 시그니처·가드·에러 처리 변경 0** — 응답 소비 helper 만 바꾼다.
- **새 dependency 0** — `@testing-library/react` · `jsdom` · `@vitest/coverage-*` 도입 금지(§5 새 외부 dependency = BLOCKED).
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1309 이월) UC-07 §5 mermaid sequence 에 preview step 반영 — autonumber 재정렬 동반이라 별도 slice.
- (본 slice 후보) `perEntity` breakdown 표시 slice — 확인 단계·결과 문구 중 어디에 붙일지 제품 판단 선행.
- (T-1306 이월) `docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md` 의 endpoint 수 언급 drift 점검.
- (T-1306 이월) `conceptual placeholder` 2 행(`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 처분 — 제품 판단 대상.
- (T-1305 이월) export preview 2 종(`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — 차단/경고 정책 자체는 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화 확인 후 flaky 하면 포기 선택지 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected`/`excluded` 를 `readonly TRecord[]` 로 좁히는 slice.
- (T-1291 이월) `selectExportRecords` 의 `RangeError` 가 download 경로에서 500 으로 나가는 문제의 status 매핑 판단.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외하는데 schema 는 not-null. **§5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) Export/Import Audit log row 영속화 0 — schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 — 새 dep 필요라 §5 승인 게이트.

## 결과 (2026-07-29 DONE)

- PR [#1195](https://github.com/myungjoo/Assessment-Agent/pull/1195) — reviewer round 1 `APPROVE`, 4-게이트 충족 후 squash merge `36cdbaa7` @14:48:52Z. `+233/-27` / 2 파일 (cap 준수).
- 공유 helper `formatRestoreTotalsPhrase` 신설 → `formatRestorePlanConfirmText`(T-1308) 를 그 helper 호출로 재작성(외부 동작 0 변경) + `formatImportJobDetail` 에 실제 반영 수치 append 분기 1 + 접두 상수 1 + named export 1. `runImport` 본문 0 수정.
- 검증: web 2082 test 전량 green + lint / build / web build green. 기존 T-1132 · T-1308 spec 무수정 통과가 리팩터 안전성의 증거.
