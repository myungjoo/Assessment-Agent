---
id: T-1342
title: api.md § 7 185·190 행 UC-01·UC-06 cross-reference 의 never-built route 4 종을 미shipped 로 표기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-037, REQ-040, REQ-041]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1341]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1341 Out of Scope 이월 — § 7 185·190 행이 never-built route 4 종을 표기 0 으로 나열해 § 5 96~99 행과 어긋난다"
---

# T-1342 — api.md § 7 185·190 행 UC-01·UC-06 cross-reference 의 never-built route 4 종을 미shipped 로 표기

## Why

[T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) (main `10715686`) 과 [T-1341](T-1341-api-doc-uc08-crossref-placeholder.md) (main `16d6e71b`) 이 § 7 cross-reference 표의 191·192 행에서 **conceptual placeholder** 부류 (backup/restore · permission-denied audience-split) 를 § 5 와 정합시켰다. 그러나 T-1341 이 Out of Scope 에 "**185 행 (UC-01) · 190 행 (UC-06) 의 never-built route 표기** — `POST /api/assessments/run` 등은 § 5 96 행이 'shipped 아님 (never-built), capability 는 대체 route 로 이관' 으로 박제한 **별개 부류** … 본 task 에서 손대지 않는다" 로 명시 이월한 gap 이 남아 있다. 본 task 가 그 이월분이며, 이것으로 § 7 표의 미shipped-표기 gap 이 전부 닫힌다.

문제의 성질은 191·192 행과 같되 **오독 비용은 더 크다**. § 5 96~99 행은 4 route (`POST /api/assessments/run` · `DELETE /api/assessments` · `POST /api/assessments/reeval` · `POST /api/assessments/reset`) 를 모두 `**이 path 는 shipped 아님 (never-built). capability 는 … 로 implemented-on-main 이관.**` 으로 못박고 각각의 실 대체 route 까지 지정한다. 그런데 § 7 185 행 (UC-01) 은 never-built route **하나만** 표기 없이 적고, 190 행 (UC-06) 은 never-built route **셋만** 적는다 — 두 행 모두 셀 전체가 미구현 경로뿐이라, 구현 여부를 먼저 확인하는 독자에게 **UC-01 · UC-06 이 통째로 미구현인 것처럼 읽힌다**. 실제로는 둘 다 shipped 다 (수집·평가 manual trigger 는 `POST /api/assessment-collection/collect` + `POST /api/assessment-evaluation/period`, 재평가/삭제는 `POST /api/assessment-evaluation/unevaluated-fill-run` · `POST /api/schedules/recent-deletion/:personId`).

## Required Reading

- `docs/architecture/api.md` **185 행** — 수정 대상 1. 현재 전문은 `` | [UC-01](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram) | manual trigger 의 alt block (Admin→AssessmentModule) | `POST /api/assessments/run` | `` . 첫 셀 (UC 링크) · 둘째 셀 (`manual trigger 의 alt block (Admin→AssessmentModule)`) 은 **불변**.
- `docs/architecture/api.md` **190 행** — 수정 대상 2. 현재 전문은 `` | [UC-06](../use-cases/UC-06-evaluation-delete-reeval.md#5-main-flow-sequence-diagram) | step 1 (DELETE 또는 POST reeval/reset) | `DELETE /api/assessments`, `POST /api/assessments/reeval`, `POST /api/assessments/reset` | `` . 첫 셀 · 둘째 셀 (`step 1 (DELETE 또는 POST reeval/reset)`) 은 **불변**.
- `docs/architecture/api.md` **96~99 행** — 표기 정본이자 이관 경로의 source. 96 행 = `/api/assessments/run` → `POST /api/assessment-collection/collect` ([ADR-0031](../decisions/ADR-0031-collection-manual-trigger.md), T-0271~T-0275) + `POST /api/assessment-evaluation/period`, 97 행 = `DELETE /api/assessments` → `POST /api/schedules/recent-deletion/:personId` (T-0428), 98 행 = `/api/assessments/reeval` → `POST /api/assessment-evaluation/unevaluated-fill-run` (T-0565), 99 행 = `/api/assessments/reset` → `POST /api/assessment-evaluation/period` 의 `reevaluate` flag ([ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md)). **읽기 전용 — 네 행 모두 한 글자도 수정 금지.**
- `docs/architecture/api.md` **191~192 행** — 바로 아래 이웃 행이자 문체 선례 (T-1340·T-1341 이 확정). 나열 끝에 `` — 이 중 A · B 2 종은 **conceptual placeholder** (미구현 — § 5 NNN 행이 사유와 대체 경로의 정본; 실 대체 수단은 …) `` 형태로 한 구절을 이어 붙인 구조를 따르되, 본 task 는 **부류가 다르므로 토큰이 달라야 한다** — `conceptual placeholder` 가 아니라 § 5 96~99 행의 어휘인 `**shipped 아님 (never-built)**` 을 쓴다 (backup/restore 는 "아직 안 만든 개념 route", 본 4 종은 "만들지 않기로 하고 capability 를 다른 route 로 이관한 경로" 라 성격이 다르다). **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **153·155 행** — 합계·집계 규칙. `conceptual placeholder` 4 행 목록과 `표 72 / shipped 68` 숫자는 § 5 기준이며 § 7 은 집계 대상이 아니다. 본 task 로 숫자가 바뀌지 않는다. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **194 행 이하 § 7 주석 문단** — 기존 관습 확인용. 본 task 는 문단을 **신설하지 않고** 셀 안 인라인 표기만 쓴다 (문단 신설 = § 5 사유와 중복 → drift 원인). **읽기 전용.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Get(\|@Post(\|@Delete(\|@Patch(" -- src/user/assessment.controller.ts` → `@Get()` · `@Get(":id")` · `@Post()` · `@Delete(":id")` **4 개뿐** (`run` · `reeval` · `reset` route 0, bulk `@Delete()` 0). 즉 185·190 행의 4 route 는 실제로 미구현.
  - `git grep -n "@Post(\"collect\")\|@Post(\"period\")\|@Post(\"unevaluated-fill-run\")" -- src/` → 3 hit (`src/assessment-collection/assessment-collection.controller.ts:54` · `src/assessment-evaluation/assessment-evaluation.controller.ts:339` · `:599`). 대체 경로 3 종은 실제로 shipped.
  - `git grep -n "@Post(\"recent-deletion/:personId\")" -- src/` → 1 hit (`src/scheduling/recent-deletion.controller.ts:96`, `@Controller("api/schedules")`). 네 번째 대체 경로도 shipped.
  - `awk 'NR==185{print gsub(/\|/,"|")} NR==190{print gsub(/\|/,"|")}' docs/architecture/api.md` → 편집 전후 모두 **4 / 4** (§ 7 표 3 컬럼 구조 유지 확인).

## Acceptance Criteria

- [ ] **185 행 세 번째 셀** — `` `POST /api/assessments/run` `` 을 **삭제하지 말고** (UC-01 §5 alt block 이 호명하는 개념 step 이라 빠지면 cross-reference 가 끊긴다) 나열 끝에 한 구절을 이어 붙인다: bold `**shipped 아님 (never-built)**` 토큰 + 사유의 정본이 § 5 **96 행** 임을 pointer 로 명시 + 실 capability 가 `` `POST /api/assessment-collection/collect` `` + `` `POST /api/assessment-evaluation/period` `` 로 이관됐음을 한 구절로 밝힌다.
- [ ] **190 행 세 번째 셀** — 기존 3 route 나열을 **삭제·순서 변경 없이** 보존한 뒤 같은 형식의 구절을 이어 붙인다: `**shipped 아님 (never-built)**` 토큰 + § 5 **97~99 행** pointer + route 별 대체 경로 3 종 (`DELETE /api/assessments` → `` `POST /api/schedules/recent-deletion/:personId` ``, `reeval` → `` `POST /api/assessment-evaluation/unevaluated-fill-run` ``, `reset` → `` `POST /api/assessment-evaluation/period` `` 의 `reevaluate` flag).
- [ ] **부류 구분 유지** — 두 행 어디에도 `conceptual placeholder` 토큰을 쓰지 않는다 (191·192 행의 backup/restore·permission-denied 와 성격이 다르다 — 본 4 종은 capability 이관 완료 경로). 반대로 191·192 행에 `never-built` 토큰을 역주입하지도 않는다.
- [ ] **중복 서술 금지** — ADR 링크 전문 · T-NNNN 박제 번호 · REQ 번호 같은 상세는 § 5 96~99 행에만 두고 § 7 에 복제하지 않는다 (중복은 다음 갱신 때 두 절이 다시 어긋나는 원인). § 7 셀에는 route 이름과 § 5 행 pointer 만 남긴다.
- [ ] **첫 셀 · 둘째 셀 불변** — 185 행의 `[UC-01](../use-cases/UC-01-evaluation-execution.md#5-main-flow-sequence-diagram)` · `manual trigger 의 alt block (Admin→AssessmentModule)`, 190 행의 `[UC-06](../use-cases/UC-06-evaluation-delete-reeval.md#5-main-flow-sequence-diagram)` · `step 1 (DELETE 또는 POST reeval/reset)` 는 한 글자도 바뀌지 않는다.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본 task 본문의 주장 (`assessment.controller.ts` route 4 개뿐 · 대체 경로 4 종 전부 shipped · 185/190 행 pipe 4) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==185{print gsub(/\|/,"|")} NR==190{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **4 / 4** 로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 추가 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `git grep -c "never-built" -- docs/architecture/api.md` 가 편집 전 **6** → 편집 후 **8**, (b) `git grep -c "conceptual placeholder" -- docs/architecture/api.md` 가 편집 전후 모두 **8** (본 task 는 placeholder 부류를 건드리지 않는다), (c) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72** (§ 7 행은 첫 셀이 METHOD 가 아니라 집계 불변), (d) `git grep -n "shipped 기준 68" -- docs/architecture/api.md` 가 여전히 **1 hit** (153 행 합계 불변), (e) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 변경 행이 **185 · 190 행 정확히 2 개** 다 (96~99 · 153 · 155 · 186~189 · 191 · 192 · 194 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · `docs/use-cases/UC-01-*` · `docs/use-cases/UC-06-*` · `docs/decisions/ADR-0031-*` · `ADR-0038-*` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1339](T-1339-api-doc-backup-restore-placeholder.md)·[T-1340](T-1340-api-doc-uc07-crossref-placeholder.md)·[T-1341](T-1341-api-doc-uc08-crossref-placeholder.md) 선례) — 대신 위 검증 grep 5 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **§ 7 표에 대체 route 를 독립 항목으로 승격** — 본 task 는 이관 pointer 를 구절 **안에서 한 번 언급** 할 뿐, 세 번째 셀의 나열 항목 수 (185 행 1 개 · 190 행 3 개) 를 늘리지 않는다. § 7 은 "UC §5 sequence step 이 호명하는 endpoint" 표라 실 shipped route 를 정식 항목으로 승격할지는 UC-01/UC-06 §5 sequence 재독이 필요한 별개 판단이다 — Follow-ups 에 1 줄만 남긴다.
- **§ 5 96~99 행 재수정** — 네 행은 이미 정본이다. § 7 과 문장을 맞추겠다고 § 5 를 다시 열지 않는다.
- **191·192 행 (UC-07 · UC-08) 재수정** — T-1340·T-1341 이 방금 확정했다. 문체 참조용 읽기 전용이며 토큰 역주입 금지.
- **186~189 행 (UC-02~UC-05) 점검·수정** — 네 행의 route 는 전부 shipped 라 표기 대상이 아니다. 전수 재검증이 필요하다고 판단되면 별도 slice 로 Follow-ups 에 남긴다.
- **153·155 행 합계·집계 규칙 갱신** — § 7 은 집계 대상이 아니고 두 행의 숫자는 § 5 기준이라 불변이다. 두 행은 열지도 않는다.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 bold 문단은 § 5 사유와 중복돼 drift 원인이 된다.
- **`docs/use-cases/UC-01-*` · `UC-06-*` 동기** — UC 문서의 sequence 가 never-built route 를 어떻게 호명하는지는 별도 slice 다. 본 task 는 `api.md` 안 두 절의 정합만 다룬다.
- **`/api/assessments/run` · `/reeval` · `/reset` · bulk `DELETE` 의 실 구현 (`src/` 코드)** — 신규 endpoint 는 ADR + `pr` task 소관이고, § 5 96~99 행이 이미 "capability 는 다른 route 로 이관 완료" 로 결론냈다. 본 task 는 **문서를 현실에 맞추는 것** 이지 현실을 문서에 맞추는 것이 아니다.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집 — architect · tester 불요, T-1339~T-1341 선례)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
