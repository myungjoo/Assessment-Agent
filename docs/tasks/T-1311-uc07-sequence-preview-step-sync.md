---
id: T-1311
title: UC-07 §5 sequence 에 확정 전 preview 왕복 반영 + step 참조 재정렬
phase: P5
status: DONE
completedAt: 2026-07-30T02:44:00Z
commit: e141fbfb
commitMode: direct
coversReq: [REQ-030, REQ-032]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1302, T-1309]
touchesFiles:
  - docs/use-cases/UC-07-export-import.md
  - docs/architecture/api.md
plannerNote: "P5 문서 정본 drift — §5 sequence 에 preview 왕복 0. doc-only inline-amend x0.64 = 45 LOC / 2 파일"
---

# T-1311 — UC-07 §5 sequence 에 확정 전 preview 왕복 반영 + step 참조 재정렬

## Why

[T-1297](T-1297-restore-preview-dry-run.md)~[T-1302](T-1302-import-preview-mode-echo.md) 가 `POST /api/admin/import/preview` 를 shipped 시켰고, [T-1307](T-1307-import-confirm-step-panel.md)~[T-1309](T-1309-adminview-import-confirm-wiring.md) 이 web 을 **preview 우선** 으로 배선해 실사용 소비자까지 붙었다. 그런데 흐름 정본인 [UC-07](UC-07-export-import.md) §5 sequence 에는 **preview 왕복이 한 줄도 없다** — `git grep -n preview docs/use-cases/UC-07-export-import.md` 가 §6.5 · §7.4 만 hit 하고 §5 mermaid 블록은 0 hit 임을 pre-check 로 확인했다. 즉 §5 는 "파일 선택 → 곧바로 confirmation dialog → 실행" 이라는 **더 이상 사실이 아닌 흐름** 을 그린다.

같은 §5 의 요청 arrow 문자열도 drift 다 — `GET /api/admin/export?scope=... 또는 POST /api/admin/restore` 로 적혀 있으나 shipped 정본은 [api.md](../architecture/api.md) 124·125 행의 `POST /api/admin/export` · `POST /api/admin/import` 이고, `POST /api/admin/restore` 는 backup 복원용 **별개 미구현 endpoint** (api.md 137 행) 라 두 경로를 한 arrow 에 합쳐두면 오독을 부른다.

본 task 는 이 두 drift 를 닫는다. 이전 fire 들이 "autonumber 재정렬 동반" 을 이유로 두 번 이월했던 항목이라, **재정렬 자체를 본 task 의 명시 범위** 로 넣어 이월을 끝낸다 — arrow 2 개 삽입으로 기존 step 2~15 가 4~17 로 **일괄 +2** 되므로, api.md 가 들고 있는 `UC-07 §5 step N` 참조를 같은 commit 에서 함께 맞춘다 (§3.1 상 둘 다 기존 문서 inline 수정이라 direct 1 commit 이 맞다).

## Required Reading

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 51~96 행 — `## 5. Main flow (sequence diagram)` mermaid 블록 전체. **주 수정 대상**. 현재 message arrow 는 **정확히 15 개** 이고 순서는 (1) Admin→WebUI 화면 접근/action 선택, (2) WebUI→Admin confirmation dialog, (3) Admin→WebUI confirmation 응답, (4) WebUI→Admin 화면 복귀(alt 취소), (5) WebUI→BackendAPI 요청, (6) BackendAPI→AuthModule, (7) BackendAPI→AssessmentModule, (8)(9) Export alt, (10)(11) Import alt, (12) Audit log insert, (13) AssessmentModule→BackendAPI 결과 응답, (14) BackendAPI→WebUI 응답, (15) WebUI→Admin 결과 표시. `Note over ...` 는 autonumber 대상이 아니다 (번호는 arrow 만 센다).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 117~120 행 — `### 6.5 실행 전 preview (dry-run)`. 계약 (i)(ii)(iii) 의 정본이며 본 task 가 §5 에 그릴 내용의 **출처**. 본문 서술은 유지하고 `§5 sequence 64 행` 이라는 **행 번호 참조만** 안정 참조로 교체한다 (본 task 가 §5 에 줄을 추가하는 순간 그 숫자가 틀리므로).
- [docs/architecture/api.md](../architecture/api.md) 124~126 행 — `POST /api/admin/export` · `POST /api/admin/import` · `POST /api/admin/import/preview` row. §5 arrow 에 적을 **shipped 경로 정본**. 126 행 안의 `64 행 confirmation` 도 위와 같은 이유로 안정 참조로 교체 대상.
- [docs/architecture/api.md](../architecture/api.md) 128 · 130 · 132 · 133 행 — 각각 `UC-07 §5 step 2` (modes) · `step 13` (download) · `step 2` (describe-scope) · `step 2` (preview-selection) 참조. **+2 재정렬 대상**.
- [docs/architecture/api.md](../architecture/api.md) 189 · 192 행 — UC-07 traceability row (`step 1 + step 2 (확정 전 preview) + step 13 (다운로드)`) 와 그 아래 제외 근거 각주 (`§5 sequence 의 step 1` · `§5 step 2 호출`). **재정렬 + 신설 preview arrow 반영 대상**.
- [docs/architecture/api.md](../architecture/api.md) 137 행 — `POST /api/admin/restore` row. 본 task 는 이 row 를 **0 수정** 한다 (별개 backup 복원 경로임을 확인하는 용도로만 읽는다).

## Acceptance Criteria

- [ ] **§5 mermaid 에 preview 왕복 arrow 2 개 삽입** — 기존 arrow (1) 바로 뒤, 기존 confirmation dialog arrow **앞** 에 `opt` 블록 1 개로 넣는다 (preview 는 Import 분기에서만 도는 경로라 Export 에도 도는 것처럼 그리면 안 된다). 두 arrow 는 (a) `WebUI->>BackendAPI: POST /api/admin/import/preview (multipart file + optional mode) — 복원 미실행 dry-run (§6.5)`, (b) `BackendAPI-->>WebUI: 영향 요약 (deleted / inserted / kept 3 그룹 + 해석된 mode) — DB write 0 · ImportJob row 0` 취지. `opt` 헤더 문구에 §6.5 링크 또는 절 번호를 남긴다.
- [ ] **confirmation dialog arrow 문구 갱신** — 기존 "영향 범위" 표현이 **어디서 온 수치인지** 가 드러나도록 한 조각 (예: `§6.5 preview 응답의 3 그룹 수치`) 을 덧붙인다. 나머지 문구 (destructive 명시 · 삭제 경고) 는 0 수정.
- [ ] **요청 arrow 의 endpoint 문자열을 shipped 정본으로 교체** — 기존 `GET /api/admin/export?scope=... 또는 POST /api/admin/restore (multipart file upload) — 구체 endpoint 는 P2 api.md` 를 `POST /api/admin/export` (scope body) · `POST /api/admin/import` (multipart file upload) 로 바꾸고, 꼬리 문구는 "구체 endpoint 는 [api.md](../architecture/api.md) UC-07 표" 취지로 정리한다. **`POST /api/admin/restore` 를 §5 에서 지우는 것이 곧 그 endpoint 의 폐기 선언은 아님** 을 오독하지 않도록, api.md 137 행 row 는 0 수정으로 남긴다.
- [ ] **arrow 총수 = 17 확인** — 수정 후 §5 mermaid 의 message arrow (`->>` 또는 `-->>`) 개수가 **정확히 17** 이고, 신설 2 개가 **step 2 · step 3** 위치임을 확인한다. 검증: `awk '/^```mermaid/,/^```$/' docs/use-cases/UC-07-export-import.md | grep -c -- '->>'` 가 `17` (§5 가 문서의 유일한 mermaid 블록임도 함께 확인).
- [ ] **api.md 의 `UC-07 §5 step N` 참조 일괄 +2 재정렬** — 128 행 `step 2` → `step 4`, 130 행 `step 13` → `step 15`, 132 행 `step 2` → `step 4`, 133 행 `step 2` → `step 4`. 재정렬 후 `git grep -n "UC-07 §5 step 2\|UC-07 §5 step 13" docs/architecture/api.md` 가 **0 hit**.
- [ ] **189 행 traceability cell 갱신** — `step 2 (확정 전 preview)` 는 신설 arrow 를 가리키도록 `step 2–3 (확정 전 import preview)` 로, 기존 confirmation dialog 를 가리키던 몫은 `step 4 (scope · mode 확인 dialog)` 로, `step 13 (다운로드)` 는 `step 15` 로 고친다. endpoint 목록 자체는 0 수정 (이미 preview 2 종 · download 포함).
- [ ] **192 행 각주 갱신** — `§5 sequence 의 step 1` 은 그대로 유효 (arrow 1 은 이동 0), `§5 step 2 호출` 만 `§5 step 4 호출` 로 고친다. 제외 근거 논지 자체는 0 수정.
- [ ] **행 번호 참조 제거 (재발 차단)** — UC-07 119 행의 `§5 sequence 64 행` 과 api.md 126 행의 `64 행 confirmation` 을 **행 번호 없는 안정 참조** (예: `§5 sequence 의 confirmation dialog step (step 4)`) 로 교체한다. 검증: `git grep -n "sequence 64 행\|64 행 confirmation" docs/` 가 `docs/progress/` · `docs/tasks/` (과거 기록이라 불변) 를 제외하고 **0 hit**.
- [ ] **R-112 4 항목 — direct doc-only (production code 0 LOC) 라 §3.2 상 unit test 의무 면제.** 대신 동형의 검증 4 종을 **모두 실행해 통과** 시키고 결과를 commit body 에 남긴다: (a) *happy path* — 위 arrow 총수 17 카운트 명령이 `17` 출력, (b) *error path* — 옛 문자열이 남지 않았는지 `git grep -n "admin/restore (multipart\|UC-07 §5 step 2\|UC-07 §5 step 13" docs/architecture/api.md docs/use-cases/UC-07-export-import.md` 가 0 hit, (c) *branch* — 신설 경로가 Import 분기에만 걸렸는지 `opt` ~ `end` 블록 안에 preview arrow 2 개가 모두 들어있고 Export alt 블록은 0 수정임을 diff 로 확인, (d) *negative* — 표 열 무결 (`awk -F'|' 'NF>1 && NF!=8' docs/architecture/api.md | head` 로 endpoint 표 행의 열 수 붕괴 0) + 링크 경로 오타 0 (`docs/architecture/api.md` 상대경로가 UC-07 에서 `../architecture/api.md`).
- [ ] **mermaid 문법 유효성** — 수정된 블록이 렌더 가능한 mermaid 인지 육안 검사 (`opt` 마다 대응 `end` 존재, participant 이름 오타 0, `:` 뒤 문구에 mermaid 예약 문자 `;` 미사용). 기존 `alt` / `else` / `end` 구조는 0 수정.
- [ ] **범위 밖 0 수정 확인** — `git diff --stat` 이 정확히 2 파일 (`docs/use-cases/UC-07-export-import.md`, `docs/architecture/api.md`) 이고 합계 diff ≤ 300 LOC.
- [ ] **언어 규율 (§12)** — 서술 · arrow 문구는 한국어, endpoint path · mermaid 키워드 (`opt` / `alt` / `end`) · 식별자는 영어.

## Out of Scope

- **`src/**` · `web/**` · `test/**` 0 수정** — 본 task 는 문서 정본 동기뿐이다. 코드가 바뀌어야 한다고 느껴지면 판단이 틀린 것이다 (구현은 T-1297~T-1310 으로 이미 shipped).
- **`POST /api/admin/restore` · `POST /api/admin/backup` row 처분 0** — 미구현 endpoint 의 존치 / 삭제 판단은 제품 결정 대상이라 별건. §5 arrow 에서 빠지는 것과 api.md row 존치는 별개다.
- **`docs/progress/**` · `docs/tasks/**` 의 과거 `64 행` 표현 0 수정** — 작성 시점 사실의 기록이라 소급 수정하지 않는다 (§12 "과거와의 호환" 과 동형).
- **§5 이외 절의 서술 재작성 0** — §6.5 는 **행 번호 참조 한 조각만** 고치고 계약 (i)(ii)(iii) 본문은 0 수정. §7 · §8 도 0 수정.
- **mermaid 를 leg-count-agnostic 하게 만드는 리팩터 0** — step 번호 참조를 이름 기반 anchor 로 전면 전환하는 작업은 부피가 본 slice 를 넘는다. 본 task 는 (a) 신설 지점의 행 번호 참조 2 곳만 제거하고 (b) 나머지는 +2 재정렬로 맞춘다.
- **web 결과 화면 문구 변경 0** — 결과 표시 arrow (기존 15 → 17) 문구는 0 수정. `restoreSummary` 표시는 T-1310 으로 shipped 이며 문서화가 더 필요하면 별도 slice.
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## 결과 (2026-07-30 완료)

- direct commit `e141fbfb` (main), +16/-10 / 2 파일 — cap(300 LOC / 5 파일) 준수. main CI run 30509097121 = **success** (본 fire 안에서 conclusion 확정, R-114 이월 0).
- UC-07 §5 mermaid 에 `opt(Import 확정 전 preview)` 블록 + arrow 2 개 삽입(총 17). confirmation dialog arrow 에 §6.5 3 그룹 수치 출처 명시, 요청 arrow endpoint 를 shipped 정본(`POST /api/admin/export` · `POST /api/admin/import`)으로 교체 — `POST /api/admin/restore` 혼재 오독 제거.
- api.md 의 §5 step 참조 +2 재정렬 (step 2→4 3 곳 · 13→15 · 189 행 traceability cell · 192 행 각주), 행 번호 참조 2 곳을 step 4 안정 참조로 교체.
- 검증 4 종 통과: arrow 총수 17 / 옛 문자열 0 hit / preview arrow 2 개가 opt~end 안이며 Export alt 0 수정 / 표 열 무결(NF=7 · NF=5).

## Suggested Sub-agents

`implementer`

## Follow-ups

- (본 slice 후보) `perEntity` breakdown 표시 slice — 확인 단계 · 결과 문구 중 어디에 붙일지 제품 판단 선행.
- (T-1306 이월) `docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md` 의 endpoint 수 언급 drift 점검.
- (T-1306 이월) `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 처분 — 제품 판단 대상.
- (T-1305 이월) export preview 2 종 (`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단.
- (본 task 관측) api.md 137 행 `POST /api/admin/restore` · 136 행 `POST /api/admin/backup` 의 미구현 상태 표기 (예: `계획` 마커) 추가 여부 — 표 전반 관례 결정이라 별건.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — 차단 / 경고 정책 자체는 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화 확인 후 flaky 하면 포기 선택지 보고.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외하는데 schema 는 not-null. **§5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) Export / Import Audit log row 영속화 0 — schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 — 새 dep 필요라 §5 승인 게이트.
