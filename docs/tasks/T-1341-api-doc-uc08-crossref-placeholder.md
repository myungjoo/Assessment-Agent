---
id: T-1341
title: api.md § 7 192 행 UC-08 cross-reference 의 permission-denied 2 종을 미구현 placeholder 로 표기
phase: P5
status: DONE
completedAt: 2026-07-31T05:45:00Z
resultCommit: 16d6e71b
commitMode: direct
coversReq: [REQ-008, REQ-016]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1340]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1340 이월분 — § 7 192 행 UC-08 이 § 5 139~140 placeholder 2 종을 미구현 표기 0 으로 나열해 두 절이 어긋난다"
---

# T-1341 — api.md § 7 192 행 UC-08 cross-reference 의 permission-denied 2 종을 미구현 placeholder 로 표기

## Why

[T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) (main `10715686`) 이 § 7 cross-reference 표의 **191 행 (UC-07)** 에서 `POST /api/admin/backup` · `POST /api/admin/restore` 를 `**conceptual placeholder**` 로 표기해 § 5 136~137 행과 정합시켰다. 그 task 는 Out of Scope 에 "**192 행 (UC-08 행) 동기** — `GET /api/me/permission-denied` · `GET /api/admin/permission-denied` 도 § 5 139~140 행 기준 미구현 placeholder 지만 … Follow-ups 에 1 줄 기록만 하고 다음 task 로 넘긴다" 로 명시 이월했다. 본 task 가 그 이월분이며, § 7 표에 남은 **마지막 미구현-표기 gap** 이다.

현 상태의 문제는 191 행과 같은 부류다 — **같은 문서 안에서 두 절이 어긋난다**. § 5 139~140 행은 두 route 를 `**conceptual placeholder** (§5 sequence audience-split 표현, 미구현)` 로 못박고 실 shipped 대체 endpoint 가 141 행 `GET /api/permission-denied-records` (단일 endpoint 가 `actor.role` 로 audience 차등, T-0214 박제 · [ADR-0023](../decisions/ADR-0023-permission-denied-audit-query-rbac-contract.md)) 임을 명시한다. 그런데 § 7 192 행은 미구현 2 종**만** 표기 없이 나열하고 실 shipped route 는 아예 등장하지 않아, 구현 여부를 확인하려는 독자가 먼저 보는 표에서 **UC-08 이 통째로 미구현인 것처럼 읽히는 정반대의 오독** 까지 유발한다 (191 행보다 오독 비용이 크다 — UC-08 은 실제로 shipped 다).

## Required Reading

- `docs/architecture/api.md` **192 행** — 유일한 수정 대상. 현재 전문은 `` | [UC-08](../use-cases/UC-08-permission-denied.md#5-main-flow-sequence-diagram) | step 1 (user / admin audience filter) | `GET /api/me/permission-denied`, `GET /api/admin/permission-denied` | `` 로, 세 번째 셀이 미구현 2 종만 **표기 없이** 나열한다. 첫 셀 (UC 링크) 과 둘째 셀 (`step 1 (user / admin audience filter)`) 은 **불변**.
- `docs/architecture/api.md` **139~141 행** — 표기 정본이자 사유의 source. 139 행 = `본인 관련 권한 부족 event 조회 (REQ-008 — user audience) — **conceptual placeholder** (§5 sequence audience-split 표현, 미구현). 실제 shipped 된 통합 audit endpoint 는 아래 /api/permission-denied-records (단일 endpoint 가 actor.role 로 audience 차등).`, 140 행 = `시스템 전체 권한 부족 event 조회 (REQ-016 — admin audience) — **conceptual placeholder** (위와 동일, 미구현).`, 141 행 = 실 shipped `GET /api/permission-denied-records` 행. **읽기 전용 — 세 행 모두 한 글자도 수정 금지.**
- `docs/architecture/api.md` **191 행** — 바로 위 이웃 행이자 본 task 의 문체 선례 (T-1340 이 방금 확정). 나열 끝에 `` — 이 중 A · B 2 종은 **conceptual placeholder** (미구현 — § 5 NNN 행이 사유와 대체 경로의 정본; 실 대체 수단은 …) `` 형태로 한 구절을 이어 붙인 형식을 **그대로 따른다**. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **153 행** — 합계 문장. `conceptual placeholder` 4 행 목록에 이미 `GET /api/me/permission-denied` · `GET /api/admin/permission-denied` 가 들어 있어 **§ 5 기준 숫자는 이미 맞다**. § 7 은 집계 대상이 아니므로 본 task 로 숫자가 바뀌지 않는다. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **194 행 이하 § 7 주석 문단** — "왜 넣고/뺐는지" 를 표 아래 bold 문단으로 쓰는 기존 관습. 본 task 는 이 문단들을 **건드리지 않고** 셀 안 인라인 표기만 쓴다 (문단 신설 = § 5 사유와 중복 → drift 원인). **읽기 전용.**
- 실측 명령 3 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Controller(\"api/me\|@Controller(\"api/admin" -- src/` → `api/me/permission-denied` controller **0 hit** (admin 측은 export · import 2 종뿐). 즉 192 행의 두 route 는 실제로 미구현.
  - `git grep -n "@Controller(\"api/permission-denied-records\")" -- src/` → **1 hit** (`src/permission-denied/permission-denied-record.controller.ts` 78 행). 대체 endpoint 는 실제로 shipped.
  - `awk 'NR==192{print gsub(/\|/,"|")}' docs/architecture/api.md` → 편집 전후 모두 **4** (§ 7 표 3 컬럼 구조 유지 확인).

## Acceptance Criteria

- [ ] **192 행 세 번째 셀** 의 `` `GET /api/me/permission-denied` `` · `` `GET /api/admin/permission-denied` `` 2 개가 미구현임을 셀 안에서 식별 가능하게 만든다 — 두 항목을 나열에서 **삭제하지 말고** (UC-08 §5 sequence 가 호명하는 audience-split 개념 step 이라 빠지면 cross-reference 가 끊긴다) 나열 끝에 한 구절을 이어 붙인다. bold `**conceptual placeholder**` 토큰을 § 5 · 191 행과 **같은 표기** 로 쓰고, 사유의 정본이 § 5 139~140 행임을 pointer 로 남긴다.
- [ ] **실 shipped 대체 경로 pointer** — 같은 구절 안에 `` `GET /api/permission-denied-records` `` 를 한 번 적어, 단일 endpoint 가 `actor.role` 로 audience 를 차등한다는 점 (= 두 placeholder route 가 하나로 합쳐진 실 구현) 을 한 구절로 밝힌다. **RBAC 계약 전문 (allowlist 필터 · query param · 401/200 매핑 · ADR-0023 · T-0214 박제) 은 § 5 141 행에만 두고 § 7 에 복제하지 않는다** — 중복 서술은 다음 갱신 때 두 절이 다시 어긋나는 원인이다.
- [ ] **첫 셀 · 둘째 셀 불변** — `[UC-08](../use-cases/UC-08-permission-denied.md#5-main-flow-sequence-diagram)` 링크와 `step 1 (user / admin audience filter)` 는 한 글자도 바뀌지 않는다. 기존 2 개 route 의 표기 · 순서도 불변.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 3 종을 실제로 실행하고 본 task 본문의 주장 (`api/me/permission-denied` controller 0 · `api/permission-denied-records` controller 1 · 192 행 pipe 4) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==192{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **4** 로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `git grep -c "conceptual placeholder" -- docs/architecture/api.md` 가 편집 전 **7** → 편집 후 **8**, (b) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72** (§ 7 행은 첫 셀이 METHOD 가 아니라 집계 불변), (c) `git grep -c "permission-denied-records" -- docs/architecture/api.md` 가 편집 전 **3** → 편집 후 **4**, (d) `git grep -n "shipped 기준 68" -- docs/architecture/api.md` 가 여전히 **1 hit** (153 행 합계 불변), (e) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 변경 행이 **192 행 정확히 1 개** 다 (139·140·141·153·155·191·194 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · `docs/use-cases/UC-08-permission-denied.md` · `docs/decisions/ADR-0023-*` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1338](T-1338-api-doc-export-create-statuses.md)·[T-1339](T-1339-api-doc-backup-restore-placeholder.md)·[T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) 선례) — 대신 위 검증 grep 5 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **§ 7 표에 `GET /api/permission-denied-records` 를 독립 endpoint 항목으로 추가** — 본 task 는 placeholder 표기 구절 **안에서 pointer 로 한 번 언급** 할 뿐, 세 번째 셀의 나열 항목을 2 → 3 으로 늘리지 않는다. § 7 은 "UC §5 sequence step 이 호명하는 endpoint" 표라 그 route 를 정식 항목으로 승격할지는 § 5 141 행 · UC-08 §5 sequence 재독이 필요한 별개 판단이다 — Follow-ups 에 1 줄만 남긴다.
- **§ 5 표 (139~141 행) 재수정** — 세 행은 이미 정본이다. § 7 과 문장을 맞추겠다고 § 5 를 다시 열지 않는다.
- **191 행 (UC-07) 재수정** — T-1340 이 방금 확정했다. 문체 참조용 읽기 전용.
- **153·155 행 합계·집계 규칙 갱신** — § 7 은 집계 대상이 아니고 153 행의 placeholder 4 행 목록은 이미 두 route 를 포함한다. 두 행은 열지도 않는다.
- **185 행 (UC-01) · 190 행 (UC-06) 의 never-built route 표기** — `POST /api/assessments/run` 등은 § 5 96 행이 "shipped 아님 (never-built), capability 는 대체 route 로 이관" 으로 박제한 **별개 부류** (미구현 placeholder 가 아니라 경로 이관) 라 문구 자체가 달라야 한다. 본 task 에서 손대지 않는다.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 bold 문단은 § 5 사유와 중복돼 drift 원인이 된다.
- **`docs/use-cases/UC-08-permission-denied.md` 동기** — UC 문서가 audience-split 을 어떻게 서술하는지는 별도 slice 다. 본 task 는 `api.md` 안 두 절의 정합만 다룬다.
- **`/api/me/permission-denied` · `/api/admin/permission-denied` 실 구현 (`src/` 코드)** — 신규 endpoint 는 ADR + `pr` task 소관이며, § 5 139 행이 이미 "통합 audit endpoint 가 실 구현" 이라 결론냈다. 본 task 는 **문서를 현실에 맞추는 것** 이지 현실을 문서에 맞추는 것이 아니다.

## Suggested Sub-agents

`implementer` (doc-only 1 행 amend — architect·tester 불요)

## Follow-ups

- **§ 7 표에 `GET /api/permission-denied-records` 를 독립 항목으로 승격할지** — 본 task 는 placeholder 구절 안의 pointer 로만 언급했다. § 5 141 행 · UC-08 §5 sequence 재독이 필요한 별개 판단이라 이월한다.
- **185 행 (UC-01) · 190 행 (UC-06) never-built 표기** — Out of Scope 로 이월한 마지막 § 7 gap. planner 가 [T-1342](T-1342-api-doc-crossref-never-built-marking.md) 로 큐잉했다 (`**shipped 아님 (never-built)**` 토큰으로 placeholder 와 분리).

## 결과 요약 (2026-07-31 driver fire)

`docs/architecture/api.md` 192 행 셋째 셀 나열 끝에 conceptual placeholder 구절 1 개를 append (+1/-1, 1 파일, main direct commit `16d6e71b`). 사유 전문은 § 5 139~140 행에 두고 pointer 만, 실 대체 경로는 `GET /api/permission-denied-records` (단일 endpoint 가 `actor.role` 로 audience 차등) 를 한 번만 언급했다. 검증 grep 6 종 (conceptual placeholder 7→8 · METHOD 행 72 불변 · permission-denied-records 3→4 · `shipped 기준 68` 1 hit 불변 · 192 행 pipe 4 불변 · diff hunk 192 행 단 1 개) 전부 기대치 일치. § 7 표의 미구현-표기 gap 중 placeholder 부류는 이로써 전부 닫혔다 (never-built 부류는 T-1342 소관).
