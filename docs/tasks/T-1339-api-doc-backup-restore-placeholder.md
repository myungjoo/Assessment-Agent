---
id: T-1339
title: api.md § 5 136~137 행 backup·restore 를 conceptual placeholder 로 표기 + 합계 shipped 동기
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-030]
estimatedDiff: 10
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1338]
touchesFiles:
  - docs/architecture/api.md
completedAt: 2026-07-31T03:39:25Z
resultSummary: "api.md § 5 136·137 행에 conceptual placeholder 3 요소 표기 + 153·155 행 합계 shipped 70→68 동기. 1 파일 +4/-4, commit f593116b. 실측: api/admin controller 2 종(export·import) 뿐, backup·restore route 0 · prisma model 0."
plannerNote: "T-1338 Out of Scope 이월분 — 136~137 행은 미구현인데 placeholder 표기 0 이라 shipped 70 이 실제 68 과 어긋난다"
---

# T-1339 — api.md § 5 136~137 행 backup·restore 를 conceptual placeholder 로 표기 + 합계 shipped 동기

## Why

[T-1338](T-1338-api-doc-export-create-statuses.md) 이 § 5 124 행 (`POST /api/admin/export`) 에 status 를 채우면서 Out of Scope 에 "**§ 5 의 나머지 UC-07 행** (`POST /api/admin/backup` · `POST /api/admin/restore` 등) 의 status 서술 보강 — 본 task 는 124 행 하나만 다룬다" 로 이월했다. 그 이월분을 실측해 보면 **status 를 보강할 일이 아니라 미구현 사실을 표기할 일** 이다 — `/api/admin` prefix 의 실 controller 는 `src/export/export.controller.ts` (`api/admin/export`) 와 `src/import/import.controller.ts` (`api/admin/import`) **2 종뿐** 이고, backup·restore 는 controller 도 service 도 Prisma model 도 없다. [docs/requirements.md](../requirements.md) 49 행이 `REQ-030 | Export/backup + Restore | FR | **P7** | e2e | **PLANNED**` 로 못박은 그대로 아직 오지 않은 phase 의 계획이다.

문제는 § 5 표가 이 사실을 **한 글자도 적지 않는다** 는 점이다. 139~140 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 은 같은 미구현 상태를 `**conceptual placeholder** (…, 미구현)` 으로 명시하는데, 136~137 행은 `DB backup 생성` · `backup 으로 reset & restore` 라는 한 구절만 두어 shipped endpoint 와 시각적으로 구별되지 않는다. 그 결과 153 행 합계의 `shipped 기준 70` 과 155 행 집계 규칙 (3) 의 `표 72 / shipped 70` 이 실제 (68) 과 **2 만큼 어긋난다** — 방금 T-1306 이 세운 집계 규칙 자체가 자기 숫자로 반증되고 있는 상태다.

## Required Reading

- `docs/architecture/api.md` **136 행** — 첫 수정 대상. 현재 전문: `| POST | \`/api/admin/backup\` | UC-07 §5 | DB backup 생성 | Admin+ |`. 기존 `DB backup 생성` 문구와 `UC-07 §5` · `Admin+` 컬럼은 **보존** 하고 placeholder 표기를 **뒤에 이어 붙인다**.
- `docs/architecture/api.md` **137 행** — 둘째 수정 대상. 현재 전문: `| POST | \`/api/admin/restore\` | UC-07 §5 | backup 으로 reset & restore | Admin+ |`. 위와 동일 처리.
- `docs/architecture/api.md` **139~140 행** — placeholder 표기의 **문체 정본**. 139 행이 `**conceptual placeholder** (§5 sequence audience-split 표현, 미구현). 실제 shipped 된 통합 audit endpoint 는 …` 형태로 (a) bold placeholder 토큰 + (b) 괄호 안 사유 + 미구현 + (c) 대체 경로 안내 3 요소를 갖는다. 136~137 행의 새 문장을 이 3 요소 형식에 맞춘다. **읽기 전용 — 139~140 행은 한 글자도 수정 금지.**
- `docs/architecture/api.md` **153 행 (§ 5 합계 문단)** — `**합계**: 72 endpoint 행 (그 중 \`conceptual placeholder\` 2 행 — \`GET /api/me/permission-denied\` · \`GET /api/admin/permission-denied\` — 은 미구현이라 shipped 기준 70) / 16 resource prefix / 8 UC cover (…` 로 시작한다. **이 선두 괄호 절 하나만** 고친다 (그 뒤의 T-0117~T-1306 연혁 나열은 글자 그대로 보존).
- `docs/architecture/api.md` **155 행 (집계 규칙 문단) 의 (3) 항** — `(3) \`conceptual placeholder\` 로 표시된 미구현 행은 **표 행 수에는 포함하되 shipped 수에서는 제외** 해 두 수를 함께 표기한다 (현재 표 72 / shipped 70).` 의 **괄호 안 숫자만** 고친다. (1)·(2) 항과 재집계 명령 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` (현재 72) 는 **불변** — 136~137 행은 여전히 METHOD 행이라 표 행 수 72 는 바뀌지 않는다.
- `docs/architecture/api.md` **125 행** (`POST /api/admin/import`) — restore 의 "대체 경로" 근거. 실 복원 capability 는 이 endpoint 가 `mode=REPLACE` (dump 로 기존 데이터를 지우고 삽입) 로 이미 shipped 이고, 126 행 preview 가 그 dry-run 이다. **읽기 전용 — 125·126 행 수정 금지.**
- `docs/requirements.md` **49 행** — `| REQ-030 | 57 | Export/backup + Restore | FR | P7 | e2e | PLANNED |`. 136~137 행 placeholder 사유의 1 차 근거 (phase **P7** · status **PLANNED**). **읽기 전용 — requirements.md 수정 금지.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — task 본문을 그대로 믿지 말 것. 불일치 시 **실측이 정본**):
  - `git grep -n "@Controller(\"api/admin" -- src/` → **2 hit 뿐** (`src/export/export.controller.ts` 143 행 `api/admin/export` · `src/import/import.controller.ts` 175 행 `api/admin/import`). backup·restore controller **0**.
  - `git grep -rniE "backup|/restore" -- src/ test/ web/` → 잡히는 것은 spec fixture 문자열 (`backup-2026-06-17.json` 등) · 주석 · `set/restore` 같은 무관 어휘뿐. **route 선언 0.**
  - `git grep -niE "backup" -- prisma/` → **0 hit** (backup job / snapshot model 부재).
  - `grep -cE '^\| (GET\|POST\|PATCH\|PUT\|DELETE) \|' docs/architecture/api.md` → 편집 전후 모두 **72** (표 행 수 불변 확인).

## Acceptance Criteria

- [ ] **136 행** 설명 셀 (`DB backup 생성`) 뒤에 placeholder 표기를 이어 붙인다 — 139~140 행과 같은 3 요소: (a) **`**conceptual placeholder**`** bold 토큰, (b) 미구현 사유 (`/api/admin` prefix 의 실 controller 는 export·import 2 종뿐 — backup controller · service · Prisma model 전부 부재, [docs/requirements.md](../requirements.md) 의 **REQ-030 이 phase P7 / status PLANNED**), (c) 현재 대체 수단 (전량 dump 는 `POST /api/admin/export` 의 `scope=FULL` + `GET /api/admin/export/:id/download` 로 이미 가능 — 별도 backup endpoint 없이도 artifact 를 얻는다).
- [ ] **137 행** 설명 셀 (`backup 으로 reset & restore`) 뒤에 같은 3 요소를 붙인다. (c) 대체 수단은 **`POST /api/admin/import` 의 `mode=REPLACE`** — dump 로 기존 데이터를 지우고 삽입하는 실 복원 경로가 125 행에 이미 shipped 이며 126 행 preview 가 그 dry-run 이다. "restore endpoint 가 없다 = 복원 capability 가 없다" 로 오독되지 않게 한 구절로 못박는다.
- [ ] **153 행 합계 선두 괄호 절 동기** — `conceptual placeholder` **2 행 → 4 행**, 열거에 `POST /api/admin/backup` · `POST /api/admin/restore` **2 개 추가**, `shipped 기준 70` → **`shipped 기준 68`**. **`72 endpoint 행` 은 불변** (placeholder 도 표 행 수에는 포함 — 155 행 규칙 (3) 그대로). 153 행의 나머지 연혁 나열 (T-0117~T-1306) 은 **한 글자도 건드리지 않는다**.
- [ ] **155 행 (3) 항 숫자 동기** — `(현재 표 72 / shipped 70)` → `(현재 표 72 / shipped 68)`. (1)·(2) 항 및 재집계 명령·헤더 12·prefix 16 표기는 **불변**.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본 task 본문의 주장 (controller 2 종뿐 · route 선언 0 · prisma 0 hit · METHOD 행 72) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 **전** `awk 'NR==136 || NR==137 {print gsub(/\|/,"|")}' docs/architecture/api.md` 값을 찍어 두고 편집 **후** 같은 명령이 **동일한 값** 을 내는지 비교한다 (§ 5 표 컬럼 수 유지 — 행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지). `docs/architecture/api.md` 의 **총 행 수** 도 편집 전후 동일하다.
- [ ] 검증 grep — (a) `git grep -c "conceptual placeholder" -- docs/architecture/api.md` 가 편집 전 **4** → 편집 후 **6**, (b) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72**, (c) `git grep -n "shipped 기준 70\|shipped 70" -- docs/architecture/api.md` 가 편집 후 **0 hit**, (d) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 변경 행이 **136 · 137 · 153 · 155 정확히 4 개** 다 (125·126·139·140·191 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1334](T-1334-api-doc-status-code-table-realign.md)·[T-1335](T-1335-api-doc-status-code-202-204-rows.md)·[T-1336](T-1336-api-doc-status-code-413-row.md)·[T-1337](T-1337-api-doc-import-create-failure-statuses.md)·T-1338 선례) — 대신 위 검증 grep 4 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`src/` 코드 변경 전면 금지** — 특히 backup·restore controller/service 신설. REQ-030 은 phase **P7 / PLANNED** 이고 새 endpoint 는 ADR + `pr` task 소관이다 (§3.1 rule 3·4). 본 task 는 **문서를 현실에 맞추는 것** 이지 현실을 문서에 맞추는 것이 아니다.
- **§ 7 cross-reference 표 (191 행) 의 UC-07 행 수정** — 그 행이 `POST /api/admin/backup`, `POST /api/admin/restore` 를 미구현 표기 없이 열거하고 있으나, § 7 은 별도 절이라 본 task 밖이다. Follow-ups 에 1 줄 기록만 한다.
- **124~135 행 재수정** — [T-1331](T-1331-export-scope-preview-httpcode-200.md)·[T-1332](T-1332-import-preview-httpcode-200.md)·T-1337·T-1338 이 방금 정합을 끝냈다. 대칭을 맞추려고 그 행들의 문구를 손대지 않는다.
- **§ 6 표 (163~176 행) 수정** — 136~137 행은 미구현이라 § 6 status 정책과 애초에 접점이 없다. § 6 은 열지도 않는다.
- **139~140 행 (UC-08 placeholder 2 행) 재작성** — 문체 정본으로 **읽기만** 한다.
- **`docs/use-cases/UC-07-export-import.md` · `docs/requirements.md` · `docs/PLAN.md` 동기화** — REQ-030 의 P7 표기가 사실이므로 고칠 것이 없고, UC 문서 동기는 별도 slice 다.

## Suggested Sub-agents

`implementer` (doc-only 4 행 amend — architect·tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

- **§ 7 cross-reference 표 191 행 UC-07 동기** — `POST /api/admin/backup` · `POST /api/admin/restore` 가 미구현 표기 없이 열거 중. § 5 136·137 행이 placeholder 로 바뀐 뒤 두 절이 어긋난다 → [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) 로 큐잉됨.
