---
id: T-1344
title: api.md § 7 188 행 UC-04 의 PATCH /api/users/:id/password 를 conceptual placeholder 로 표기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-043, REQ-044]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-07-31
independentStream: api-status-code-table
dependsOn: [T-1343]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1343 Follow-up — § 5 75 행이 placeholder 확정됐는데 § 7 188 행만 표기 0 이라 같은 route 를 두 절이 다르게 서술"
---

# T-1344 — api.md § 7 188 행 UC-04 의 `PATCH /api/users/:id/password` 를 conceptual placeholder 로 표기

## Why

[T-1343](T-1343-api-doc-password-endpoint-placeholder.md) (main `e3e04b69`) 이 § 5 **75 행** 의 `PATCH /api/users/:id/password` 를 **conceptual placeholder (미구현)** 로 확정하고 153·155 행 합계를 `shipped 기준 67` 로 동기했다. 그 task 의 Follow-ups 첫 항목이 "**§ 7 188 행 (UC-04 cross-reference) 동기** — 188 행이 여전히 표기 0 으로 나열한다. T-1339 → T-1340 · T-1341 순서대로 다음 slice 에서 § 7 축을 닫는다" 로 본 slice 를 이월했다.

현재 § 7 **188 행** (UC-04) 의 셋째 셀은 `` `/api/auth/login`, `/api/auth/me`, `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/password` `` 5 종을 **아무 구별 없이** 나열한다. 앞 4 종은 실제 shipped 인데 (`src/auth/auth.controller.ts` 의 `@Post("login")` · `@Get("me")`, `src/user/user.controller.ts` 의 `@Post()` · `@Patch(":id/role")`) 마지막 1 종만 미구현이라, 지금 표를 읽는 독자는 5 종 전부 shipped 로 오독한다. T-1340 (191 행 UC-07) · T-1341 (192 행 UC-08) 이 같은 부류의 gap 을 이미 닫았으므로 본 행이 § 7 표에 남은 마지막 placeholder 미표기 행이다.

191·192 행과 다른 점이 하나 있다 — **대체 수단이 없다**. backup/restore 는 export/import 로, permission-denied 2 종은 `GET /api/permission-denied-records` 로 우회 가능했지만, password 변경은 `changePassword` / `resetPassword` / `updatePassword` 계열 심볼이 `src/` · `test/` · `web/` 전역 **0 hit** 이라 HTTP surface 자체가 없다 (§ 5 75 행이 이미 이 사실을 박제). 본 행의 표기는 그 차이가 드러나야 한다.

## Required Reading

- `docs/architecture/api.md` **188 행** — 유일한 수정 대상. 현재 셋째 셀은 `` `/api/auth/login`, `/api/auth/me`, `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/password` `` 로 끝난다. 첫 셀 (UC-04 링크) · 둘째 셀 (`step 1 (login 또는 user mutation)`) · 기존 5 종의 **표기와 순서** 는 **불변** — 나열 끝에 한 구절만 append 한다.
- `docs/architecture/api.md` **191 행 · 192 행** — 문체 정본 (T-1340 · T-1341 확정). 구조를 그대로 따른다: `— 이 중 <route> 1 종은 **conceptual placeholder** (미구현 — § 5 <행> 행이 사유와 …의 정본; …)`. **읽기 전용 — 수정 금지.**
- `docs/architecture/api.md` **75 행** — 사유의 정본 (T-1343 이 확정). 본 task 는 이 행의 사유 전문을 § 7 로 **복제하지 않고** pointer 만 남긴다. **읽기 전용 — 수정 금지.**
- 실측 명령 4 종 (executor 가 직접 실행해 본문 주장을 재확인한다 — 불일치 시 **실측이 정본**):
  - `git grep -n "@Post(\|@Get(\|@Patch(" -- src/auth/auth.controller.ts src/user/user.controller.ts` → `@Post("login")` · `@Get("me")` · `@Post()` · `@Patch(":id/role")` 이 모두 존재 (188 행의 앞 4 종은 shipped), `:id/password` route 는 **0**.
  - `git grep -rln "changePassword\|resetPassword\|updatePassword" -- src/ test/ web/` → **0 hit** (대체 수단 부재의 근거).
  - `sed -n '188p' docs/architecture/api.md` → 편집 대상 행 전문 확인 (행 번호 drift 시 실측 행 번호를 따르고 Follow-ups 에 기록).
  - `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` → 편집 전후 모두 **72** (§ 7 은 METHOD 행이 아니므로 불변).

## Acceptance Criteria

- [ ] **188 행 셋째 셀 append** — 기존 5 종 나열을 **삭제·재배열하지 말고** 끝에 한 구절만 이어 붙인다. 3 요소: (a) 마지막 1 종 `` `PATCH /api/users/:id/password` `` 만 **conceptual placeholder** (미구현) 임을 명시 (앞 4 종은 shipped 라는 대비가 읽혀야 한다), (b) 사유 정본 pointer — `§ 5 75 행이 사유의 정본`, (c) **대체 수단 부재** — `changePassword` 계열 service 심볼이 `src/` 전역 0 이라 password 변경 HTTP surface 가 하나도 없음 (191·192 행이 대체 경로를 제시하는 것과 다른 점).
- [ ] **부류 유지** — 토큰은 `**conceptual placeholder**` 다. 185·190 행의 `never-built` 토큰을 188 행에 역주입하지 않고, 반대로 188 행 편집을 핑계로 185·190 행에 placeholder 토큰을 넣지도 않는다.
- [ ] **사유 전문 복제 금지** — § 5 75 행의 route 4 개 열거 · controller 주석 인용 · bcrypt/RBAC 서술을 § 7 로 옮겨 적지 않는다. § 7 은 pointer + 한 구절 요약만 (191·192 행 선례).
- [ ] **153 · 155 행 불변** — 합계는 § 5 표 행 기준이라 § 7 편집의 영향을 받지 않는다. `shipped 기준 67` · `표 72 / shipped 67` 은 편집 후에도 각각 1 hit 그대로여야 한다.
- [ ] 실측 재확인 — Required Reading 의 실측 명령 4 종을 실제로 실행하고 본문 주장 (앞 4 종 shipped · password route 0 · password 심볼 0 hit · METHOD 행 72) 과 일치함을 확인한 뒤 문장을 확정한다. 불일치 시 **실측을 따르고** 그 차이를 Follow-ups 에 1 줄 기록한다.
- [ ] 표 구조 무손상 — 편집 후 `awk 'NR==188{print gsub(/\|/,"|")}' docs/architecture/api.md` 가 **4** 로 편집 전과 동일하고 (행 병합 · 줄바꿈 삽입 · 컬럼 증감 금지), `wc -l docs/architecture/api.md` 가 편집 전후 모두 **229** 다.
- [ ] 검증 grep — (a) `grep -c "conceptual placeholder" docs/architecture/api.md` 가 편집 전 **9** → 편집 후 **10**, (b) `grep -c "never-built" docs/architecture/api.md` 가 편집 전후 모두 **8**, (c) `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 가 편집 전후 모두 **72**, (d) `git diff --stat` 이 `docs/architecture/api.md` **1 파일** 만 보이고 `git diff` 의 hunk 가 `@@ -188 +188 @@` **단 1 개** 다 (75 · 153 · 155 · 185 · 190 · 191 · 192 · 194 행은 diff 에 등장하지 않는다).
- [ ] `src/` · `test/` · `web/` · `prisma/` · `docs/use-cases/UC-04-*` · `docs/requirements.md` · 그 외 어떤 파일도 수정하지 않는다 (§3.1 rule 3 — direct task 는 doc 만). `git status --porcelain` 결과가 `docs/architecture/api.md` 단 1 개 (driver 의 STATE/journal bookkeeping 제외).
- [ ] doc-only 라 R-110 tester 면제 (production code 0 LOC · 신규 symbol/분기 0 → R-112 신규 test 대상 없음, [T-1340](T-1340-api-doc-uc07-crossref-placeholder.md)~[T-1343](T-1343-api-doc-password-endpoint-placeholder.md) 선례) — 대신 위 검증 grep 4 종 + 표 구조 self-check 로 대체한다. `pnpm lint` 는 doc 변경 무영향이라 실행 불요.

## Out of Scope

- **186 · 187 · 189 행 (UC-02 · UC-03 · UC-05) 전수 재검증** — T-1342 가 이월한 재검증 중 UC-04 축만 본 task 로 닫는다. 나머지 세 행의 route 실재 여부 확인은 별도 slice (실측 결과 gap 이 나오면 그때 task 화).
- **`PATCH /api/users/:id/password` 실 구현 (`src/` 코드)** — password 정책 · self/Admin 분기 RBAC · bcrypt 재적용 경계 결정이 필요하므로 ADR + `pr` task 소관. 본 task 는 **문서를 현실에 맞추는 것** 이지 그 반대가 아니다.
- **`docs/use-cases/UC-04-account-auth.md` 동기** — UC 문서의 step 4 서술이 password 변경을 전제하는지는 별개 판단이며, use-case 문서 수정은 본 § 7 slice 밖이다 (필요하면 Follow-ups → 별도 task).
- **75 · 153 · 155 행 재수정** — T-1343 이 방금 확정했다. 문체 참조용 읽기 전용.
- **185 · 190 · 191 · 192 행 재수정** — T-1340 ~ T-1342 가 확정했다. 토큰 역주입 금지.
- **`src/user/user.controller.ts` 36~38 행 주석 stale 2 건** — T-1343 Follow-ups 가 박제한 `pr` 소관 항목 (행 번호 `api.md L72` drift + `GET /api/users` 부재 서술 stale). doc-only task 가 `src/` 를 열지 않는다.
- **194 행 이하 주석 문단 신설/확장** — 셀 인라인 표기로 충분하다. 새 문단은 § 5 사유 서술과 중복돼 drift 원인이 된다.
- **`docs/requirements.md` 에 password 변경 REQ 신설** — README 지시 해석이 필요한 별개 판단 (T-1343 이 이미 Out of Scope 로 판정).

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 · 단일 행 편집 — architect · tester 불요, T-1340 ~ T-1343 선례)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
