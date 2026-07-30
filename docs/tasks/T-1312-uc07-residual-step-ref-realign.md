---
id: T-1312
title: UC-07 잔여 §5 step 참조 +2 재정렬 + 재발 차단 규약 한 줄 박제
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 26
estimatedFiles: 2
created: 2026-07-30
independentStream: import-restore-engine
dependsOn: [T-1311]
touchesFiles:
  - docs/use-cases/UC-07-export-import.md
  - docs/decisions/ADR-0046-export-dump-materialization-storage.md
plannerNote: "T-1311 +2 재정렬의 문서층 잔여 6 참조 마감 + step 참조 규약 박제. doc-only inline-amend x0.64 = 26 LOC / 2 파일"
---

# T-1312 — UC-07 잔여 §5 step 참조 +2 재정렬 + 재발 차단 규약 한 줄 박제

## Why

[T-1311](T-1311-uc07-sequence-preview-step-sync.md) (merge `e141fbfb`) 이 [UC-07](../use-cases/UC-07-export-import.md) §5 sequence 에 preview 왕복 arrow 2 개를 step 2·3 위치에 삽입해 기존 step 2~15 가 **4~17 로 일괄 +2** 됐다. 그 fire 는 `docs/architecture/api.md` 의 참조 6 곳만 맞췄고, **UC-07 문서 자신이 들고 있는 §5 step 참조 5 곳과 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md) 의 1 곳은 옛 번호 그대로** 남았다 — `git grep -n "§5 step 5\|§5 step 7·11\|§5 step 11 Note" origin/main -- docs/use-cases/UC-07-export-import.md` 가 5 hit, ADR-0046 128 행이 `§5 step5·13` 1 hit 으로 pre-check 확인했다. 즉 UC-07 의 §4 invariant 문단과 §10 traceability 표가 **자기 문서 §5 의 존재하지 않는 흐름을 가리키는** 상태다.

본 task 는 이 잔여 6 참조를 닫고, 같은 사고의 재발을 막는 **step 참조 규약 한 줄** 을 §5 mermaid 블록 직후에 박제한다 (번호는 arrow 순번이라 arrow 삽입 시 통째로 밀린다 — 참조 시 이름 병기). §3.1 상 둘 다 **기존 문서의 inline 수정** 이라 direct 1 commit 이 맞다 (ADR *신설* 만 pr 이고, 기존 ADR 의 참조 한 줄 수정은 §3.1 4 항의 status 한 줄 수정과 동형).

## Required Reading

- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 53~101 행 — `## 5. Main flow (sequence diagram)` mermaid 블록. **수정 대상이 아니라 번호 판정의 근거**. 현재 arrow 는 정확히 17 개이며 순서는 (1) 화면 접근/action 선택, (2)(3) preview 왕복 `opt`, (4) confirmation dialog, (5) confirmation 응답, (6) 취소 시 화면 복귀, (7) `POST /api/admin/export` 또는 `POST /api/admin/import` 요청, (8) AuthModule 검증, (9) `exportDump(scope)` 또는 `importRestore(file)`, (10)(11) Export alt, (12)(13) Import alt, (14) Audit log insert, (15) 결과 응답, (16) BackendAPI→WebUI, (17) 결과 표시. `Note over ...` 는 번호 대상이 아니다.
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 49 행 — §4 마지막 invariant 문단의 `§5 step 7·11`. **옛 번호** (옛 7 = `exportDump/importRestore` 호출, 옛 11 = 복원 row count / rollback).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 166 · 168 · 169 · 171 행 — §10 traceability 표의 `§5 step 5·7` (REQ-030) · `§5 step 5` (REQ-045) · `§5 step 11 Note` (REQ-037 인접) · `§5 step 5` (REQ-043 인접).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 143 행 — `[UC-06](UC-06-evaluation-delete-reeval.md) §5 step 11 동일 패턴`. **UC-06 자신의 번호라 0 수정** (본 task 의 +2 대상 아님 — 오탐 차단용으로 반드시 읽는다).
- [docs/use-cases/UC-07-export-import.md](../use-cases/UC-07-export-import.md) 91 행 · 100 행 — mermaid 안의 두 `Note`. 91 행은 Import 분기의 `atomic — all-or-nothing`, 100 행은 마지막 `UC-01 의 다음 cron 발화 시 ... 자동 재수집`. 169 행 REQ-037 참조가 **실제로 어느 Note 를 가리켜야 하는지** 판정하는 근거.
- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](../decisions/ADR-0046-export-dump-materialization-storage.md) 128 행 — `§5 step5·13 (Export 다운로드)` 참조 1 곳. 옛 5 = 요청 arrow, 옛 13 = 결과 표시(다운로드 완료).

## Acceptance Criteria

- [ ] **49 행 (§4 invariant 문단) +2** — `§5 step 7·11` → `§5 step 9·13`. 문단의 나머지 서술 (raw 미저장 전파 · atomic transaction · UC-01 재수집 3 invariant) 은 0 수정.
- [ ] **166 행 (REQ-030 row) +2** — `§5 step 5·7` → `§5 step 7·9`. 같은 cell 의 다른 절 참조 (`§1` / `§3 trigger 1·2` / `§6.1` / `§6.2` / `§6.5` / `§7.3` / `§7.4` / `§8` / `§9`) 는 0 수정.
- [ ] **168 행 (REQ-045 row) · 171 행 (REQ-043 인접 row) +2** — 각각 `§5 step 5` → `§5 step 7`. 두 행의 나머지 cell 은 0 수정.
- [ ] **169 행 (REQ-037 인접 row) 은 기계적 +2 가 아니라 의미 판정으로 교정** — 현재 `§5 step 11 Note conceptual reference` 인데, 옛 step 11 (= 새 13, 복원 row count) 에 붙은 Note 는 91 행의 `atomic — all-or-nothing` 이라 **REQ-037 (평가 없는 부분 일괄 평가 + Reset & Reeval) 취지와 맞지 않는다**. REQ-037 이 실제로 기대는 것은 100 행의 마지막 Note (`UC-01 의 다음 cron 발화 ... 자동 재수집`) 이므로, 참조를 `§5 마지막 Note (step 17 뒤 — UC-01 자동 재수집)` 취지의 **이름 기반 표현** 으로 고친다. 판정 근거를 commit body 에 한 줄 남긴다.
- [ ] **ADR-0046 128 행 +2** — `§5 step5·13 (Export 다운로드)` → `§5 step 7·15 (Export 다운로드)` (공백 없는 `step5` 표기도 `step 7` 로 정규화). 같은 bullet 의 `§8 NFR` 참조와 ADR 본문 (Context / Decision / Consequences) 은 0 수정. ADR status 도 0 수정.
- [ ] **step 참조 규약 1 줄 박제 (재발 차단)** — UC-07 §5 mermaid 블록이 끝난 직후에 **최대 2 줄** 의 주석 문장을 넣는다: (a) step 번호는 mermaid `autonumber` 의 arrow 순번이라 arrow 를 삽입하면 뒤 번호가 통째로 밀린다는 사실, (b) 그래서 다른 문서 · 코드 주석이 본 §5 를 참조할 때는 **번호와 step 이름을 병기** 한다 (예: `§5 step 15 (결과 표시 — 다운로드 완료)`) 는 규약. 3 줄 이상으로 늘리거나 별도 소절 (`### 5.1` 등) 을 신설하지 않는다.
- [ ] **잔여 0 확인 (검증 명령)** — `git grep -n "§5 step 5\b\|§5 step 7·11\|§5 step 11 Note\|§5 step5" -- docs/use-cases/UC-07-export-import.md docs/decisions/ADR-0046-export-dump-materialization-storage.md` 가 **0 hit**.
- [ ] **arrow 총수 불변 확인** — `awk '/^```mermaid/,/^```$/' docs/use-cases/UC-07-export-import.md | grep -c -- '->>'` 가 여전히 **17**. 본 task 는 mermaid 블록 안을 0 수정한다 (규약 문장은 블록 **밖**).
- [ ] **R-112 4 항목 — direct doc-only (production code 0 LOC) 라 §3.2 상 unit test 의무 면제.** 대신 동형 검증 4 종을 모두 실행해 통과시키고 결과를 commit body 에 남긴다: (a) *happy path* — 위 잔여 0 hit 명령이 0 출력 + arrow 카운트 17, (b) *error path* — 과잉 치환 0 확인: `git grep -n "UC-06.*§5 step 11" -- docs/use-cases/UC-07-export-import.md` 가 **여전히 1 hit** (143 행 UC-06 참조는 살아있어야 한다), (c) *branch* — 새 번호가 실제 arrow 를 가리키는지 대조: 새 7 = 요청 arrow, 새 9 = `exportDump/importRestore`, 새 13 = 복원 row count, 새 15 = 결과 응답, 새 17 = 결과 표시 임을 §5 본문과 1:1 확인, (d) *negative* — 표 무결: `awk -F'|' 'NF>1 && NF!=6' docs/use-cases/UC-07-export-import.md | head` 로 §10 표 행의 열 수 붕괴 0 (열 수는 실제 표에 맞춰 판단) + 링크 상대경로 오타 0.
- [ ] **범위 밖 0 수정 확인** — `git diff --stat` 이 정확히 2 파일 (`docs/use-cases/UC-07-export-import.md`, `docs/decisions/ADR-0046-export-dump-materialization-storage.md`) 이고 합계 diff ≤ 300 LOC.
- [ ] **언어 규율 (§12)** — 서술 · 규약 문장은 한국어, `§5 step N` · endpoint path · mermaid 키워드는 영어/기호 그대로.

## Out of Scope

- **`src/**` · `web/**` · `test/**` 0 수정** — `src/export/**` · `src/import/**` 의 코드 주석 41 곳이 아직 옛 번호 (`§5 step 2 / 5 / 7 / 11 / 12 / 13`) 를 참조하지만 **26 파일** 이라 5 파일 cap 을 통째로 넘고, 게다가 **기계적 +2 가 아니다** — 예: `src/export/import-restore-preview.ts` 의 `§5 step 7 "강한 confirmation"` 은 T-1311 이전 번호에서도 confirmation dialog (옛 2) 가 아닌 곳을 가리키던 **선행 drift** 다. 별도 pr-mode slice 여러 개로 의미 판정하며 처리한다 (Follow-ups 참조).
- **`docs/architecture/api.md` 0 수정** — T-1311 이 이미 +2 재정렬 완료. 다시 건드리면 이중 +2 위험.
- **UC-07 143 행의 UC-06 §5 step 11 0 수정** — 다른 UC 의 자체 번호다.
- **다른 UC 문서 (`UC-01` ~ `UC-06`) 의 `§5 step` 참조 0 수정** — 각 문서 자신의 sequence 번호이며 본 재정렬과 무관.
- **step 참조를 이름 기반 anchor 로 전면 전환하는 리팩터 0** — 본 task 는 (a) 잔여 6 참조 번호 교정 + (b) 규약 1~2 줄 박제까지다. 전면 전환은 부피가 본 slice 를 넘는다 (T-1311 Out of Scope 와 동일 판단).
- **ADR-0046 의 status · 본문 재작성 0** — 참조 한 줄만 고친다.
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## Suggested Sub-agents

`implementer`

## Follow-ups

- (T-1311 이월, 본 task 가 분석 완료) **`src/export/**` · `src/import/**` 코드 주석 41 곳 / 26 파일의 UC-07 §5 step 참조 재정렬** — 5 파일 cap 상 최소 6 slice 필요하고 기계적 +2 불가 (선행 drift 혼재). 권장 처리: (i) 먼저 "옛 번호 → 새 step 이름" 대응표를 한 slice 에서 확정하고, (ii) 이후 slice 들이 파일 묶음별로 **이름 병기 형태** 로 교체. 또는 planner 가 cap-bend pre-justify (`sizeExempt`) 로 주석-only 41 줄 단일 pr slice 를 승인하는 선택지도 있다 — 제품 판단 대상.
- (본 slice 후보) `perEntity` breakdown 표시 slice — 확인 단계 · 결과 문구 중 어디에 붙일지 제품 판단 선행.
- (T-1306 이월) `docs/architecture/modules.md` · `directory.md` · `docs/PLAN.md` 의 endpoint 수 언급 drift 점검.
- (T-1306 이월) `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 처분 — 제품 판단 대상.
- (T-1305 이월) export preview 2 종 (`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단.
- (T-1311 이월) api.md 137 행 `POST /api/admin/restore` · 136 행 `POST /api/admin/backup` 의 미구현 상태 표기 (예: `계획` 마커) 추가 여부 — 표 전반 관례 결정이라 별건.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — 차단 / 경고 정책 자체는 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화 확인 후 flaky 하면 포기 선택지 보고.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외하는데 schema 는 not-null. **§5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) Export / Import Audit log row 영속화 0 — schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 — 새 dep 필요라 §5 승인 게이트.
