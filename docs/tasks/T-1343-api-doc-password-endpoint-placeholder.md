---
id: T-1343
title: api.md § 5 75 행 PATCH /api/users/:id/password 를 conceptual placeholder 로 표기 + 153·155 합계 동기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 6
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1342]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1342 이월 '전수 shipped 재검증' 의 § 5 축 결과 — 75 행 password endpoint 가 미구현인데 shipped 로 집계돼 68 ≠ 67"
---

# T-1343 — api.md § 5 75 행 `PATCH /api/users/:id/password` 를 conceptual placeholder 로 표기 + 153·155 합계 동기

## Why

[T-1342](T-1342-api-doc-crossref-never-built-marking.md) (main `b2c90d5c`) 가 § 7 cross-reference 표의 미shipped-표기 gap 을 전부 닫으면서 Out of Scope 에 "**186~189 행 (UC-02~UC-05) route 전수 shipped 재검증** — 전수 재검증이 필요하다고 판단되면 별도 slice" 를 이월했다. 본 task 는 그 재검증을 **§ 5 축에서 먼저** 수행한 결과 발견된 **실 gap 1 건** 을 닫는다 (§ 7 축은 별도 slice — Out of Scope 참조).

발견 내용: § 5 **75 행** 의 `PATCH /api/users/:id/password` 는 미구현 표기가 **0** 이라 shipped endpoint 처럼 읽히지만 실제 route 는 **존재하지 않는다**. `src/user/user.controller.ts` 의 route 는 `@Post()` · `@Get()` · `@Get(":id")` · `@Patch(":id/role")` **4 개뿐** 이고, 같은 파일 36 행 주석이 `- PATCH /api/users/:id/password endpoint 부재 — api.md L72 박제, 별도 task.` 로 부재를 명시 박제한다. service 층에도 `changePassword` / `resetPassword` / `updatePassword` 심볼이 `src/` · `test/` · `web/` 통틀어 **0 hit** 이다.

파급도 있다 — 153 행 합계와 155 행 집계 규칙 (3) 항이 `표 72 / shipped 68` 로 적혀 있으나, 미구현 행이 하나 더 있으므로 실제 shipped 는 **67** 이다. [T-1339](T-1339-api-doc-backup-restore-placeholder.md) 가 backup/restore 로 같은 어긋남 (70 → 68) 을 이미 한 번 바로잡았는데, 본 건이 남아 T-1306 집계 규칙이 다시 자기 숫자로 반증되는 상태다.

## Required Reading

- `docs/architecture/api.md` **75 행** — 수정 대상 1. 현재 전문은 `` | PATCH | `/api/users/:id/password` | UC-04 §5 step 4, §6.3 | user password 재설정 (`:id == self` → User 본인 변경 허용; `:id != self` → Admin+ 만) | User (self) / Admin+ (other) | `` . 첫 셀 (`PATCH`) · 둘째 셀 (path) · 셋째 셀 (UC pointer) · 다섯째 셀 (auth tier) 은 **불변** — 넷째 셀 (설명) 에만 표기를 덧댄다.
- `docs/architecture/api.md` **136 행 · 139 행** — 표기 문체의 정본 (T-1339 · 기존 UC-08 행이 확정). 3 요소 구조를 그대로 따른다: bold `**conceptual placeholder**` 토큰 + 괄호 안 미구현 **사유/근거** + 뒤이어 **대체 수단** 서술. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **153 행** — 수정 대상 2. `**합계**: 72 endpoint 행 (그 중 `conceptual placeholder` 4 행 — `POST /api/admin/backup` · `POST /api/admin/restore` · `GET /api/me/permission-denied` · `GET /api/admin/permission-denied` — 은 미구현이라 shipped 기준 68)` 로 시작하는 선두 괄호 절만 손댄다. 그 뒤의 prefix 16 / UC 8 / T-NNNN 박제 이력 서술은 **한 글자도 바꾸지 않는다**.
- `docs/architecture/api.md` **155 행** — 수정 대상 3. 집계 규칙 (3) 항의 `(현재 표 72 / shipped 68)` 숫자만 동기. (1) 항의 `(현재 72)` 는 **METHOD 행 수** 라 불변이고, (2) 항 헤더/prefix 서술도 불변이다.
- `src/user/user.controller.ts` **36 행 주석** — 부재 박제의 1 차 source (`PATCH /api/users/:id/password endpoint 부재 … 별도 task`). **읽기 전용 — `src/` 는 direct task 가 손대지 않는다.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Get(\|@Post(\|@Patch(\|@Delete(" -- src/user/user.controller.ts` → decorator 는 `@Patch(":id/role")` · `@Post()` · `@Get()` · `@Get(":id")` **4 개뿐** (`:id/password` route **0**). 주석 줄이 함께 잡힐 수 있으니 decorator 실 부착 줄만 센다.
  - `git grep -rln "changePassword\|resetPassword\|updatePassword" -- src/ test/ web/` → **0 hit** (service·spec·frontend 어디에도 password 변경 경로 없음).
  - `git grep -n "@Patch(" -- "src/**/*.controller.ts"` → `difficulty-mappings/:difficulty` · `llm/providers/:id` · `groups/:id` · `parts/:id` · `persons/:id` · `users/:id/role` — password PATCH route **미포함**.
  - `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` → 편집 전후 모두 **72** (행 삭제 금지 — 미구현 행도 표에는 남는다, T-1306 집계 규칙 (3)).

## Acceptance Criteria

- [ ] **75 행 넷째 셀** — 기존 서술 (`user password 재설정 (…)`) 을 **삭제하지 말고** 뒤에 3 요소를 이어 붙인다: (a) bold `**conceptual placeholder**` 토큰, (b) 미구현 근거 — `src/user/user.controller.ts` 의 route 가 `@Post()` · `@Get()` · `@Get(":id")` · `@Patch(":id/role")` 4 개뿐이고 같은 파일 주석이 `endpoint 부재 … 별도 task` 로 박제한 사실, (c) **대체 수단 부재** 를 명시 — `changePassword` 계열 service 심볼이 `src/` 전역 0 이라 현재 password 변경 HTTP surface 가 **하나도 없다** (backup/restore 처럼 우회 경로가 있는 경우와 다르다는 점이 독자에게 드러나야 한다).
- [ ] **부류 선택 근거 유지** — 토큰은 `never-built` 가 아니라 `**conceptual placeholder**` 다. 본 행은 "만들지 않기로 하고 capability 를 다른 route 로 이관한 경로" (§ 5 96~99 행 부류) 가 아니라 "아직 만들지 않은, 계약만 선언된 route" 이므로 136·139 행과 같은 부류다. 96~99 행이나 § 7 185·190 행에 `conceptual placeholder` 토큰을 역주입하지 않는다.
- [ ] **153 행 선두 괄호 절 동기** — `conceptual placeholder` **4 행 → 5 행**, 열거에 `` `PATCH /api/users/:id/password` `` 1 개 추가 (기존 4 개의 표기·순서 보존), `shipped 기준 68` → **`shipped 기준 67`**. **`72 endpoint 행` 은 불변** (미구현 행도 표 행 수에는 포함 — T-1306 집계 규칙 (3)). 괄호 절 뒤 서술 (prefix 16 / UC 8 / T-NNNN 박제 이력 / never-built 4 건 설명) 은 무수정.
- [ ] **155 행 (3) 항 동기** — `(현재 표 72 / shipped 68)` → `(현재 표 72 / shipped 67)`. (1) 항의 `(현재 72)` 와 (2) 항 숫자 (헤더 12 / prefix 16) 는 **불변**.
- [ ] **중복 서술 금지** — 신규 REQ 번호 발명 금지 (`docs/requirements.md` 에 password 항목이 **없다** — 실측 `grep -n "password\|비밀번호" docs/requirements.md` 0 hit). 구현 계획·phase 추정을 § 5 에 적지 않고, 부재 사실과 대체 수단 부재만 적는다.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본문 주장 (route 4 개뿐 · password 심볼 0 hit · PATCH route 목록에 password 없음 · METHOD 행 72) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==75{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **6** 으로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 증감 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `grep -c "conceptual placeholder" docs/architecture/api.md` 가 편집 전 **8** → 편집 후 **9** (75 행 1 줄 추가, 153 행은 이미 해당 문자열을 포함하므로 줄 수는 1 만 는다), (b) `grep -c "never-built" docs/architecture/api.md` 가 편집 전후 모두 **8** (본 task 는 never-built 부류를 건드리지 않는다), (c) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72**, (d) `git grep -c "shipped 기준 68\|표 72 / shipped 68" -- docs/architecture/api.md` 가 편집 후 **0 hit** 이고 `shipped 기준 67` · `표 72 / shipped 67` 이 각각 1 hit, (e) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 변경 행이 **75 · 153 · 155 정확히 3 개** 다 (69~74 · 76 · 136~140 · 185~192 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/requirements.md` · `docs/use-cases/UC-04-*` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1339](T-1339-api-doc-backup-restore-placeholder.md)~[T-1342](T-1342-api-doc-crossref-never-built-marking.md) 선례) — 대신 위 검증 grep 5 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **§ 7 188 행 (UC-04 cross-reference) 동기** — 188 행도 `PATCH /api/users/:id/password` 를 표기 0 으로 나열하지만, T-1339 → T-1340 · T-1341 이 세운 순서 (§ 5 먼저 확정 → 다음 slice 에서 § 7 cross-reference 정합) 를 따른다. 본 task 는 188 행을 **열지 않고** Follow-ups 에 1 줄만 남긴다.
- **186 · 187 · 189 행 (UC-02 · UC-03 · UC-05) 전수 재검증** — 본 task 는 UC-04 축 1 건만 닫는다. 나머지 세 행의 route 실재 여부 전수 확인은 별도 slice (실측 결과 gap 이 나오면 그때 task 화).
- **`PATCH /api/users/:id/password` 실 구현 (`src/` 코드)** — 신규 endpoint 는 password 정책 · self/Admin 분기 RBAC · 기존 bcrypt hash 재적용 경계까지 결정해야 하므로 ADR + `pr` task 소관이다. 본 task 는 **문서를 현실에 맞추는 것** 이지 현실을 문서에 맞추는 것이 아니다.
- **`docs/requirements.md` 에 password 변경 REQ 신설** — requirements 표 신설은 README 지시 해석이 필요한 별개 판단이며 본 doc-only slice 밖이다.
- **`src/user/user.controller.ts` 36 행 주석 갱신** — 주석은 여전히 정확하다 (endpoint 부재 사실 불변). 같은 주석 블록의 `GET /api/users` · `GET /api/users/:id` "부재" 서술은 그 사이 shipped 되어 stale 하지만, `src/` 수정은 `pr` 소관이라 본 task 가 손대지 않고 Follow-ups 로 남긴다.
- **§ 4 auth tier 표 · § 6 status code 표 갱신** — 75 행은 두 표 어디에도 별도 행이 없어 (실측 `grep -n "password" docs/architecture/api.md` 가 69 · 73 · 75 · 188 행 4 hit) 동기 대상이 아니다.
- **136~140 · 185~192 행 재수정** — T-1339~T-1342 가 방금 확정했다. 문체 참조용 읽기 전용이며 토큰 역주입 금지.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 bold 문단은 기존 사유 서술과 중복돼 drift 원인이 된다.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집 — architect · tester 불요, T-1339~T-1342 선례)

## Follow-ups

- **§ 7 188 행 (UC-04 cross-reference) 동기** — 188 행이 `PATCH /api/users/:id/password` 를 여전히 표기 0 으로 나열한다. 본 task 가 § 5 75 행을 확정했으므로 T-1339 → T-1340 · T-1341 순서대로 다음 slice 에서 § 7 축을 닫는다 (direct, 1 파일).
- **`src/user/user.controller.ts` 주석 stale 2 건** (`pr` 소관 — 본 doc-only task 밖) — (a) 36 행이 가리키는 `api.md L72` 는 현재 **75 행** 이라 행 번호가 어긋난다, (b) 37~38 행의 `GET /api/users` · `GET /api/users/:id` "부재" 서술은 그 사이 shipped 되어 (같은 파일 203 · 253 행 `@Get()` · `@Get(":id")`) stale 하다.
- 실측 4 종은 task 본문 주장과 **전부 일치** — 불일치 0 (route 4 개뿐 · password 심볼 0 hit · PATCH route 목록에 password 없음 · METHOD 행 72).
