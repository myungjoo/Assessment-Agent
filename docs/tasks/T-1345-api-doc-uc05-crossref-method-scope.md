---
id: T-1345
title: api.md § 7 189 행 UC-05 의 difficulty-mappings method 범위 명확화 + 186·187 행 재검증 결과 박제
phase: P5
status: DONE
completedAt: 2026-07-31T09:52:00Z
commit: f5316187
commitMode: direct
coversReq: [REQ-049, REQ-050]
estimatedDiff: 6
estimatedFiles: 2
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1344]
touchesFiles:
  - docs/architecture/api.md
  - docs/tasks/T-1345-api-doc-uc05-crossref-method-scope.md
plannerNote: "T-1342·T-1344 가 이월한 § 7 186·187·189 행 전수 재검증 — 실 gap 은 189 행 method 범위 1 건뿐이라 그것만 닫고 축을 종결"
---

# T-1345 — api.md § 7 189 행 UC-05 의 difficulty-mappings method 범위 명확화 + 186·187 행 재검증 결과 박제

## Why

[T-1342](T-1342-api-doc-crossref-never-built-marking.md) 가 이월하고 [T-1344](T-1344-api-doc-uc04-crossref-password-placeholder.md) Out of Scope 첫 항목이 다시 못박은 잔여 축이 **§ 7 표 186 · 187 · 189 행 (UC-02 · UC-03 · UC-05) 의 route 실재 전수 재검증** 이다. § 7 표에서 미shipped 표기가 필요한 행 (185 · 188 · 190 · 191 · 192) 은 T-1340 ~ T-1344 가 전부 닫았고, 남은 세 행만 실측 대조가 안 된 채 남아 있다.

planner 가 세 행을 실측 대조한 결과 **shipped 여부 gap 은 0** 이다 — 186 행의 `/api/assessments` · `/api/contributions` · `/api/summaries`, 187 행의 `/api/persons` · `/api/groups` · `/api/parts` 는 열거된 method 가 controller 에 전부 실재한다. 실 gap 은 **189 행 1 건**이며 부류가 다르다: **shipped 여부가 아니라 method 범위** 다. 189 행은 `` `/api/llm/providers`, `/api/llm/difficulty-mappings[/:difficulty]` `` 를 같은 문법으로 나란히 두는데, 앞은 `GET` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id` **5 종 전량 shipped** 인 반면 뒤는 `src/llm/difficulty-mapping.controller.ts` 에 `@Get()` 과 `@Patch(":difficulty")` **2 종뿐** 이다 (POST · DELETE · `GET /:difficulty` 없음 — 난이도 슬롯 easy/medium/hard 3 개가 고정이라 신설·삭제 개념이 없고 재지정만 한다). 둘째 셀이 `provider · difficulty-mapping mutation` 이라 적힌 탓에 독자는 양쪽이 같은 CRUD 폭을 가진 것으로 읽고, 프런트엔드에서 "난이도 매핑 추가/삭제" 화면을 설계하는 오독으로 이어진다.

본 slice 는 189 행에 method 범위 한 구절만 append 해 그 오독을 닫고, 186 · 187 행 재검증 결과 (gap 0) 를 본 task 파일 Follow-ups 에 박제해 **후속 planner 가 같은 축을 다시 열지 않도록** 종결한다.

## Required Reading

- `docs/architecture/api.md` **189 행** — 유일한 api.md 수정 대상. 현재 전문:
  `` | [UC-05](../use-cases/UC-05-llm-config.md#5-main-flow-sequence-diagram) | step 2 (provider · difficulty-mapping mutation) | `/api/llm/providers`, `/api/llm/difficulty-mappings[/:difficulty]` | ``
  첫 셀 (UC-05 링크) · 둘째 셀 (`step 2 (provider · difficulty-mapping mutation)`) · 기존 두 prefix 의 **표기와 순서** 는 **불변** — 셋째 셀 나열 끝에 한 구절만 append 한다.
- `docs/architecture/api.md` **121 · 122 행** — 사유의 정본. 121 = `GET /api/llm/difficulty-mappings` (3 난이도 슬롯 배열 조회, `findAllMappings`), 122 = `PATCH /api/llm/difficulty-mappings/:difficulty` (slot 별 `llmProviderConfigId` 재지정). 이 두 행이 § 5 에 있는 difficulty-mapping 행의 **전부** 다. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **191 · 192 행** — append 문체 정본 (T-1340 · T-1341 확정). `— 이 중 …` 로 시작해 pointer 한 구절로 끝내는 구조만 차용한다. 단 **본 행은 placeholder / never-built 부류가 아니다** (두 prefix 모두 shipped). **읽기 전용 — 수정 금지.**
- 실측 명령 5 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Get(\|@Post(\|@Patch(\|@Delete(" -- src/llm/difficulty-mapping.controller.ts` → `@Get()` · `@Patch(":difficulty")` **2 개만** (POST · DELETE · `@Get(":difficulty")` 는 0).
  - `git grep -n "@Get(\|@Post(\|@Patch(\|@Delete(" -- src/llm/llm-provider-config.controller.ts` → `@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")` **5 개** 전량 실재.
  - `git grep -n "@Get(\|@Post(\|@Patch(\|@Delete(" -- src/user/assessment.controller.ts src/user/contribution.controller.ts src/user/summary.controller.ts` → **186 행 재검증** (열거 route 전부 실재).
  - `git grep -n "@Get(\|@Post(\|@Patch(\|@Delete(" -- src/user/person.controller.ts src/user/group.controller.ts src/user/part.controller.ts` → **187 행 재검증** (persons · groups · parts 각각 GET · GET/:id · POST · PATCH/:id · DELETE/:id 실재).
  - `sed -n '189p' docs/architecture/api.md` → 편집 대상 행 전문 확인 (행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록).

## Acceptance Criteria

- [ ] **189 행 셋째 셀 append** — 기존 두 prefix 나열을 **삭제·재배열하지 말고** 끝에 한 구절만 이어 붙인다. 3 요소: (a) `` `/api/llm/difficulty-mappings` `` 는 **method 범위가 좁다** — `GET` (슬롯 배열 조회) 과 `PATCH /:difficulty` (슬롯 재지정) **2 종만 shipped**, 신설 (POST) · 삭제 (DELETE) · 단건 조회 (`GET /:difficulty`) route 는 **없다**, (b) 사유 — 난이도 슬롯 (easy/medium/hard) 3 개가 고정이라 생성·삭제 개념이 없고 재지정만 한다 + 정본 pointer `§ 5 121~122 행`, (c) 대비 — `` `/api/llm/providers` `` 는 `GET` · `GET /:id` · `POST` · `PATCH /:id` · `DELETE /:id` **5 종 전량 shipped** 라 같은 셀 안에서도 폭이 다르다.
- [ ] **부류 오염 금지** — 두 prefix 모두 실재하므로 `conceptual placeholder` · `never-built` · `shipped 아님` 토큰을 189 행에 **넣지 않는다**. 검증: 편집 후 `grep -c "conceptual placeholder" docs/architecture/api.md` = **10**, `grep -c "never-built" docs/architecture/api.md` = **8** (둘 다 편집 전과 동일).
- [ ] **186 · 187 행 재검증 결과 박제** — Required Reading 의 실측 명령 3·4 번을 실행하고, 결과를 **본 task 파일 Follow-ups 에 각 1 줄** 로 남긴다 (예: `186 행 재검증 — /api/assessments GET·GET/:id, /api/contributions, /api/summaries 전부 controller 실재, gap 0`). **gap 이 0 이면 api.md 를 건드리지 않는다** (없는 gap 을 표기하려 문장을 만들지 않는다 — make-work 금지). 실측이 planner 주장과 다르면 **실측을 정본** 으로 Follow-ups 에 기록하고 api.md 수정은 하지 않은 채 후속 slice 로 이월한다.
- [ ] **§ 5 121 · 122 행 불변** — 사유 정본이라 읽기 전용. 두 행이 편집 후에도 `git diff` 에 등장하지 않아야 한다. 사유 전문 (`findAllMappings` · 4xx 매핑 · `AssignDifficultyMappingDto` · T-0139/PR-135 박제 표기) 을 § 7 로 복제하지 않는다.
- [ ] **153 · 155 행 불변** — 합계는 § 5 표 행 기준이라 § 7 편집의 영향을 받지 않는다. `shipped 기준 67` · `표 72 / shipped 67` 이 편집 후에도 각각 1 hit 그대로여야 한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==189{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **4** 로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 증감 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72**, (b) `git diff --stat` 이 `docs/architecture/api.md` · 본 task 파일 **2 개만** 보이고, (c) api.md 의 `git diff` hunk 가 `@@ -189 +189 @@` **단 1 개** 다 (121 · 122 · 153 · 155 · 185 ~ 188 · 190 ~ 192 · 194 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/use-cases/UC-05-*` · `docs/requirements.md` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 위 2 파일뿐 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md) ~ [T-1344](T-1344-api-doc-uc04-crossref-password-placeholder.md) 선례) — 대신 위 검증 grep + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **`POST` · `DELETE /api/llm/difficulty-mappings` 실 구현** — 슬롯 고정 설계 (3 난이도) 를 바꾸는 결정이라 ADR + `pr` 소관. 본 task 는 **문서를 현실에 맞추는 것** 이지 그 반대가 아니다.
- **§ 5 121 · 122 행 보강** (status code 열거 · RBAC 서술 추가 등) — 본 slice 는 § 7 축만 닫는다. § 5 두 행은 이미 4xx 매핑까지 박제돼 있어 잔여 gap 이 보이지 않는다.
- **185 · 188 · 190 · 191 · 192 행 재수정** — T-1340 ~ T-1344 가 확정했다. 토큰 역주입 · 문체 재작성 금지.
- **186 · 187 행 문구 손질** (gap 0 이 확인된 경우) — 재검증 결과만 Follow-ups 에 남기고 표는 건드리지 않는다. 실측에서 **실 gap 이 나오면** api.md 수정 대신 Follow-ups 이월 후 별도 slice.
- **153 · 155 행 합계 재계산** — § 7 편집은 § 5 표 행 수를 바꾸지 않는다.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 문단은 § 5 서술과 중복돼 drift 원인이 된다 (T-1344 와 동일 판단).
- **`docs/use-cases/UC-05-llm-config.md` 동기** — UC 문서의 step 2 서술이 매핑 신설을 전제하는지는 별개 판단이며 use-case 문서 수정은 본 § 7 slice 밖이다 (필요하면 Follow-ups → 별도 task).

## Suggested Sub-agents

`implementer` (doc-only · api.md 단일 행 편집 + task 파일 Follow-ups 기록 — architect · tester 불요, T-1340 ~ T-1344 선례)

## Follow-ups

- **186 행 재검증 (실측, gap 0)** — `src/user/assessment.controller.ts` · `contribution.controller.ts` · `summary.controller.ts` 각각 `@Get()` · `@Get(":id")` · `@Post()` · `@Delete(":id")` 4 종 실재. 186 행이 열거한 `GET /api/assessments` · `GET /api/assessments/:id` · `/api/contributions` · `/api/summaries` 는 전부 shipped 이며 표기 gap 0 → api.md 무수정.
- **187 행 재검증 (실측, gap 0)** — `person.controller.ts` 는 `@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")` 5 종, `group.controller.ts` · `part.controller.ts` 는 그 5 종에 더해 `@Get(":id/persons")` 등 하위 route 까지 실재. 187 행의 `POST/GET/PATCH/DELETE /api/persons[/:id]` · `/api/groups` · `/api/parts` 표기는 실측과 일치하며 (표기가 오히려 보수적) gap 0 → api.md 무수정.
- **189 행 실측 (본 slice 가 닫은 실 gap)** — `difficulty-mapping.controller.ts` 는 `@Get()` (75 행) · `@Patch(":difficulty")` (92 행) **2 종뿐**, `llm-provider-config.controller.ts` 는 `@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")` **5 종**. planner 주장과 실측이 완전히 일치해 189 행 셋째 셀에 method 범위 구절 1 개만 append 했다 (행 번호 drift 없음 — 편집 전후 파일 229 행 불변).
- **§ 7 route 실재 재검증 축 종결** — 185 ~ 192 행 8 행 전수가 T-1340 ~ T-1345 로 확정됐다. 후속 planner 는 같은 축 (§ 7 표 route 실재 대조) 을 다시 열지 않는다. 잔여 관심사가 있다면 `docs/use-cases/UC-05-llm-config.md` step 2 서술이 매핑 신설을 전제하는지 여부 (별도 use-case 문서 slice) 뿐이다.
