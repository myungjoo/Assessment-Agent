---
id: T-1340
title: api.md § 7 191 행 UC-07 cross-reference 의 backup·restore 를 미구현 placeholder 로 표기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-030]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1339]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1339 Follow-up 이월분 — § 5 136·137 이 placeholder 로 바뀐 뒤 § 7 191 행만 미구현 표기 0 으로 남아 두 절이 어긋난다"
---

# T-1340 — api.md § 7 191 행 UC-07 cross-reference 의 backup·restore 를 미구현 placeholder 로 표기

## Why

[T-1339](T-1339-api-doc-backup-restore-placeholder.md) (main `f593116b`) 이 § 5 의 **136 행 `POST /api/admin/backup`** 과 **137 행 `POST /api/admin/restore`** 를 `**conceptual placeholder**` 로 표기하고 153·155 행 합계를 `shipped 70 → 68` 로 동기했다. 그 task 는 Out of Scope 에 "**§ 7 cross-reference 표 (191 행) 의 UC-07 행 수정** — 그 행이 `POST /api/admin/backup`, `POST /api/admin/restore` 를 미구현 표기 없이 열거하고 있으나, § 7 은 별도 절이라 본 task 밖이다" 로 명시 이월했다. 본 task 가 그 이월분이다.

지금 상태의 문제는 **같은 문서 안에서 두 절이 서로 어긋난다** 는 점이다. § 5 를 읽은 사람은 backup·restore 가 미구현 (controller · service · Prisma model 전부 부재, [docs/requirements.md](../requirements.md) REQ-030 이 phase **P7** / status **PLANNED**) 임을 알지만, § 7 191 행만 보면 UC-07 §5 step 1 이 호출하는 shipped endpoint 8 개 중 2 개인 것처럼 읽힌다 — § 7 은 "UC §5 sequence step ↔ endpoint cross-reference" 라 오히려 **구현 여부를 확인하려는 독자가 먼저 보는 표** 다. § 5 137 행이 실 복원 경로 (`POST /api/admin/import` 의 `mode=REPLACE`) 를 이미 못박았으므로 § 7 에는 **미구현 사실 + § 5 참조 pointer** 한 구절만 붙이면 정합이 끝난다 (사유 전문 중복 금지 — 정본은 § 5).

## Required Reading

- `docs/architecture/api.md` **191 행** — 유일한 수정 대상. 현재 세 번째 셀 (endpoint group) 이 `` `POST /api/admin/export`, `POST /api/admin/import`, `POST /api/admin/import/preview`, `POST /api/admin/export/describe-scope`, `POST /api/admin/export/preview-selection`, `POST /api/admin/backup`, `POST /api/admin/restore`, `GET /api/admin/export/:id/download` `` 8 개를 **미구현 표기 없이 평평하게 나열** 한다. 첫 셀 (`[UC-07](...)`) 과 둘째 셀 (step 나열) 은 **불변**.
- `docs/architecture/api.md` **136~137 행** — 표기 정본이자 사유의 source. 136 행이 `DB backup 생성 — **conceptual placeholder** (… REQ-030 이 phase **P7** / status **PLANNED** … 미구현). 현재 대체 수단은 …`, 137 행이 `backup 으로 reset & restore — **conceptual placeholder** (… 미구현). 단 **복원 capability 자체가 없다는 뜻이 아니다** — 실 복원 경로는 POST /api/admin/import 의 mode=REPLACE …`. **읽기 전용 — 136·137 행은 한 글자도 수정 금지** (T-1339 가 방금 확정).
- `docs/architecture/api.md` **194 행 (§ 7 표 아래 첫 주석 문단)** — § 7 의 기존 서술 관습. `**UC-07 의 import 조회 3 종 … 은 본 표에 넣지 않는다**` 처럼 "왜 넣고/뺐는지" 를 표 아래 bold 문단으로 설명하는 형식이다. 본 task 는 이 문단을 **건드리지 않고** 셀 안 인라인 표기만 쓴다 (문단 신설은 diff 를 키우고 § 5 사유와 중복). **읽기 전용.**
- `docs/architecture/api.md` **192 행 (UC-08 행)** — 같은 문제를 가진 이웃 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied` 는 § 5 139~140 행이 placeholder 로 표기한 미구현 2 종인데 § 7 에는 표기 0). **본 task 범위 밖 — 읽기 전용이며 Follow-ups 에 1 줄만 기록** 한다 (Out of Scope 참조).
- `docs/architecture/api.md` **153·155 행** — 합계·집계 규칙. § 7 은 집계 대상이 아니므로 (§ 5 표의 METHOD 행만 셈) 본 task 로 **숫자가 바뀌지 않는다**. **읽기 전용 — 수정 금지.**
- 실측 명령 3 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Controller(\"api/admin" -- src/` → **2 hit 뿐** (`src/export/export.controller.ts` · `src/import/import.controller.ts`). backup·restore controller **0** — T-1339 의 실측과 동일한지 재확인.
  - `git grep -niE "backup" -- prisma/` → **0 hit**.
  - `awk 'NR==191{print gsub(/\|/,"|")}' docs/architecture/api.md` → 편집 전후 모두 **4** (§ 7 표 3 컬럼 구조 유지 확인).

## Acceptance Criteria

- [ ] **191 행 세 번째 셀** 의 `` `POST /api/admin/backup` `` · `` `POST /api/admin/restore` `` 2 개가 미구현임을 셀 안에서 식별 가능하게 만든다 — 두 항목을 나열에서 **삭제하지 말고** (UC-07 §5 sequence 가 호명하는 개념 step 이라 표에서 빠지면 cross-reference 가 끊긴다) 나열 끝에 한 구절을 이어 붙인다: `` `POST /api/admin/backup` · `POST /api/admin/restore` 2 종은 **conceptual placeholder** (미구현 — § 5 136~137 행이 사유와 대체 경로의 정본)``. bold `**conceptual placeholder**` 토큰을 § 5 와 **같은 표기** 로 쓴다.
- [ ] **대체 경로 pointer 1 구절** — 위 구절 안에 실 shipped 대체 수단을 한 번만 적는다 (backup → `POST /api/admin/export` `scope=FULL` + `GET /api/admin/export/:id/download`, restore → `POST /api/admin/import` `mode=REPLACE`). **사유 전문 (controller/service/Prisma 부재 · REQ-030 P7 PLANNED) 은 § 5 에만 두고 § 7 에 복제하지 않는다** — 중복 서술은 다음 갱신 때 두 절이 다시 어긋나는 원인이다.
- [ ] **첫 셀 · 둘째 셀 불변** — `[UC-07](../use-cases/UC-07-export-import.md#5-main-flow-sequence-diagram)` 링크와 `step 1 (Admin → export 또는 import) + step 2–3 (확정 전 import preview) + step 4 (scope · mode 확인 dialog) + step 15 (다운로드)` 는 한 글자도 바뀌지 않는다. 나머지 6 개 endpoint (`export` · `import` · `import/preview` · `describe-scope` · `preview-selection` · `:id/download`) 의 표기·순서도 불변.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 3 종을 실제로 실행하고 본 task 본문의 주장 (admin controller 2 종뿐 · prisma backup 0 hit · 191 행 pipe 4) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==191{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **4** 로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `git grep -c "conceptual placeholder" -- docs/architecture/api.md` 가 편집 전 **6** → 편집 후 **7**, (b) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72** (§ 7 행은 첫 셀이 METHOD 가 아니라 집계 불변), (c) `git grep -n "shipped 기준 68" -- docs/architecture/api.md` 가 여전히 **1 hit** (153 행 합계 불변), (d) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 변경 행이 **191 행 정확히 1 개** 다 (136·137·139·140·153·155·192·194 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · `docs/use-cases/UC-07-export-import.md` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1336](T-1336-api-doc-status-code-413-row.md)·[T-1337](T-1337-api-doc-import-create-failure-statuses.md)·[T-1338](T-1338-api-doc-export-create-statuses.md)·T-1339 선례) — 대신 위 검증 grep 4 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **192 행 (UC-08 행) 동기** — `GET /api/me/permission-denied` · `GET /api/admin/permission-denied` 도 § 5 139~140 행 기준 미구현 placeholder 지만, UC-08 은 별도 UC 이고 § 5 141 행의 실 shipped 대체 endpoint (`GET /api/permission-denied-records`) 설명까지 따라붙어야 해 slice 가 커진다. **Follow-ups 에 1 줄 기록만** 하고 다음 task 로 넘긴다.
- **185 행 (UC-01) · 190 행 (UC-06) 의 never-built route 표기** — `POST /api/assessments/run` · `DELETE /api/assessments` · `/reeval` · `/reset` 은 § 5 96 행이 "shipped 아님 (never-built), capability 는 대체 route 로 이관" 으로 박제한 별개 부류다 (미구현 placeholder 가 아니라 **경로 이관**). 표기 문구 자체가 달라야 하므로 본 task 에서 손대지 않는다.
- **§ 5 표 (124~137 행) 재수정** — T-1337·T-1338·T-1339 가 방금 정합을 끝냈다. § 7 과 문장을 맞추겠다고 § 5 를 다시 열지 않는다.
- **153·155 행 합계·집계 규칙 갱신** — § 7 은 집계 대상이 아니라 숫자가 바뀌지 않는다. 두 행은 열지도 않는다.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 bold 문단을 만들면 § 5 사유와 중복돼 다음 갱신 때 drift 원인이 된다.
- **`docs/use-cases/UC-07-export-import.md` 동기** — UC 문서가 backup·restore 를 어떻게 서술하는지는 별도 slice 다. 본 task 는 `api.md` 안 두 절의 정합만 다룬다.
- **backup·restore 실 구현 (`src/` 코드)** — REQ-030 은 phase **P7 / PLANNED** 이고 새 endpoint 는 ADR + `pr` task 소관이다 (§3.1 rule 3·4). 본 task 는 **문서를 현실에 맞추는 것** 이지 현실을 문서에 맞추는 것이 아니다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 amend — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
