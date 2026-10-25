---
id: T-2038
title: groups guard 배선 ⑤b 선행 — k6 s2 bootstrap 자격을 s1·s3 공유 SuperAdmin 계정으로 올려 groups write 왕복 Admin+ 선확보
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-048, REQ-073]
estimatedDiff: 70
estimatedFiles: 2
created: 2026-10-25
independentStream: q0056-groups-guard
dependsOn: [T-2028, T-2036, T-2037]
touchesFiles:
  [
    test/load/s2-read.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 groups ⑤b 선행 — s2 seed/teardown groups write 가 User cookie 라 ⑤b 즉시 403, T-2028 동형
---

# T-2038 — k6 s2 bootstrap SuperAdmin 자격 (Q-0056 groups ⑤b 선행)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 (R-91 k6) 아래 도는 Q-0056 arc 의 groups 축은 ⑤a (read 4 route `User+`, [T-2037](T-2037-groups-read-tier-guard-wiring.md) 머지 `62dd40b4`) 까지 끝났다. T-2037 `## Follow-ups` 첫 항목이 정한 다음 순서는 **"s2 bootstrap SuperAdmin 자격 상향 선행 (T-2028 동형) → ⑤b write 5 route `Admin+`"** 다. [T-2036](T-2036-k6-s2-groups-cookie-preattach.md) `## Follow-ups` 둘째 항목도 같은 이유를 적어 두었다.

이유는 이렇다. `s2-read.js` 의 인증 계정은 stamp 파생 email 이라 이 run 의 첫 user 가 아니므로 **`User` 등급** 이다 ([api.md](../architecture/api.md) `75 행` — `countAll === 0` 일 때만 `SuperAdmin`). 그런데 s2 의 groups seed POST (setup) 와 회수 DELETE (teardown) 는 write tier (`Admin+`, api.md `90 행` POST · `92 행` DELETE) 다. 그래서 ⑤b 가 머지되는 순간 cookie 가 있어도 **403** 이 된다. seed POST 가 403 이면 `group.json("id")` 가 깨지고 teardown 까지 연쇄로 틀어지며, 전역 `http_req_failed: rate<0.01` 도 오염된다. 부하 job 은 `workflow_dispatch` 전용이라 상시 CI 는 green 인 채로 침묵하는 유형의 파손이다. arc 규약 ("배선 전에 소비처를 먼저 준비한다") 대로 ⑤b 앞에서 닫는다. s1 · s3 는 [T-2028](T-2028-k6-s1-s3-bootstrap-superadmin.md) (`246b2d0f`) 이 이미 같은 bootstrap 계정 (`BOOTSTRAP_CREDENTIALS`) 을 쓰고 있고, 본 slice 는 s2 를 그 계정에 합류시킨다. 지금은 group write 에 guard 가 없어 tier 상향이 no-op 이므로 단독 green 으로 머지된다. 이 상향은 이후 parts 축 write (s2 parts seed/teardown) 에도 그대로 쓰인다.

부수 효과: load-k6.yml 은 smoke → S1 → S2 → S3 순서이고 S2 는 `if: ${{ !cancelled() }}` 로 앞 leg 와 독립이다. S1 이 setup 전에 죽은 run 에서도 S2 의 bootstrap signup 이 첫 signup 이 되어 같은 계정이 SuperAdmin 이 되므로, 자격 판정이 step 성패와 무관하게 결정적이 된다.

issue-still-relevant pre-check (planner, 2026-10-25, `origin/main` = `b55e1e30`):

- `test/load/s2-read.js` 에 `BOOTSTRAP_CREDENTIALS` hit **0**. `106~109 행` 이 여전히 `email: \`load-auth-${stamp}@example.com\`` · `password: \`load-pass-${stamp}\`` 다 → 의도 미안착, 착수 유효.
- `test/load/s1-batch.js` `71~74 행` · `test/load/s3-concurrent.js` `53~56 행` 에 `BOOTSTRAP_CREDENTIALS` 선언 (email `load-bootstrap@example.com` · password `load-bootstrap-pw`) 이 문자 단위로 같게 있다. drift smoke `4745~4746 행` 의 `BOOTSTRAP_CREDENTIALS_DECL` 이 그 원문 정본이다.
- `src/user/group.controller.ts` 의 write 5 route 에는 아직 guard 가 없다 (T-2037 은 read 4 route 만 배선) → ⑤b 미착수, 선행 순서가 유효하다.
- T-2037 이후 main commit 은 bookkeeping 1 건 (`b55e1e30`) 뿐이다. 본 slice 를 금지하는 owner 지시는 없다 (PLAN `158 행` 은 per-route perf baseline **신설** 금지라 저촉 0).

## Required Reading

- `docs/STATE.json` 의 `humanQuestions` Q-0056 `decision` — 오너 승인 원문과 조건
- **선례 (그대로 따른다)**: [docs/tasks/T-2028-k6-s1-s3-bootstrap-superadmin.md](T-2028-k6-s1-s3-bootstrap-superadmin.md) 와 머지 commit `246b2d0f` — 상수 선언 형태 · 머리 주석 · drift 핀 1:1 치환 방식
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `47~56 행` (`(T-2028)` 주석 + `BOOTSTRAP_CREDENTIALS` 선언) · `120~139 행` (setup 의 `const credentials = BOOTSTRAP_CREDENTIALS;` + 409 무시 주석) — **읽기 전용**, s2 가 복제할 형태
- [test/load/s2-read.js](../../test/load/s2-read.js) — `1~40 행` (머리 주석, T-1624 단락의 "stamp 로 run 마다" 서술 위치 확인), `55~64 행` (`DEVSET_EMAIL_DOMAIN` · `SEED_PARAMS` · `TEARDOWN_PARAMS` — 새 상수를 이 근처에 둔다), `95~121 행` (setup 의 `stamp` · 인증 부트스트랩 주석 · `credentials` · signup · login · `authCookie`), `146~158 행` (groups · parts seed POST 의 `${stamp}` 이름 — **stamp 는 여기서 계속 쓰이므로 유지**)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 본 변경으로 실측과 어긋나는 기존 단언 (실행 시점에 다시 확인한다):
  - `968~970 행` (T-1624 describe happy 첫 `it`) — `email: \`...${stamp}...@` · `password: \`...${stamp}\`` 2 핀
  - `1217~1235 행` (T-2023 describe negative (6) 합성 mutation) — `"  const credentials = {"` 를 치환 anchor 로 쓴다. s2 의 선언이 `const credentials = BOOTSTRAP_CREDENTIALS;` 로 바뀌면 `.replace` 가 no-op 이 되어 합성 소스가 원본과 같아지고 단언이 red 가 된다
  - `4738~4746 행` (`BOOTSTRAP_CREDENTIALS_DECL` 상수 + docstring) · `4760~4765 행` (T-2025 describe 의 s1 ↔ s3 parity 단언) — s2 parity 단언을 넣을 때 재사용한다
  - `1048~1054 행` (T-1624 negative (2) `/api/users` 1 회) · `1084~1093 행` (negative (5) `__ENV.` 2 회) · `1095~1103 행` (negative (6) 분기 토큰 0) · `4040 행` / `4201 행` (`S2_LOG_FORBIDDEN` — log 인자 한정) — 본 변경 뒤에도 **그대로 green 이어야 하는** 단언이다
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `133~138 행` (S1 이 첫 signup 이어야 하는 이유 주석) · `194~213 행` (S2 · S3 step 의 `!cancelled()` 독립성) — **읽기 전용, 무변경**
- [docs/architecture/api.md](../architecture/api.md) `75 행` (`POST /api/users` 첫 user = SuperAdmin, 그 외 User, 중복 email 409) · groups 표 `89~93 행` — 등급 판정 정본 (**수정 금지**)

## Acceptance Criteria

**s2-read.js 자격증명 상향**

- [ ] `s2-read.js` 상단 상수 영역에 s1 · s3 와 **문자 단위로 같은** `BOOTSTRAP_CREDENTIALS` 선언 (email `load-bootstrap@example.com` · password `load-bootstrap-pw`) 을 추가한다. 위에 `(T-2038)` 주석으로 "부하 job 전용 일회성 bootstrap 계정 · s1 · s3 와 같은 1 쌍 · run 의 첫 signup 이라 SuperAdmin · 실 자격증명 / 외부 secret 0 · 재실행 DB 409 1 건은 seed tag 라 판정 tag 누수 0" 을 적는다 (s3 `47~52 행` 주석 형태).
- [ ] setup 의 `const credentials = { email: \`load-auth-${stamp}...\`, password: \`load-pass-${stamp}\` };` 를 `const credentials = BOOTSTRAP_CREDENTIALS;` 로 바꾼다. signup → login 왕복 수 · `SEED_PARAMS` 사용 · `authCookie` 조립 위치 (표본 조회보다 앞) · return 형태는 **무변경** 이다. signup 이 이미 있는 계정에서 내는 409 는 분기 없이 버린다.
- [ ] `const stamp = Date.now();` 는 **유지** 한다 (groups · parts seed 이름의 `@unique` 회피용). 그 위 주석 (`96~97 행`) 은 "Part.name / Group.name 의 @unique 충돌 회피" 로 좁히고, 인증 부트스트랩 주석 (`99~103 행`) 의 "자격증명은 stamp 로 run 마다 새로 만든다" 서술은 "s1 · s3 와 공유하는 결정적 bootstrap 계정 — groups write (seed POST · 회수 DELETE) 가 ⑤b 이후 Admin+ gate 를 통과해야 한다" 취지로 바꾼다. 머리 주석에 `(T-2038)` 단락 1 개를 더한다.
- [ ] **분기 0 유지** — `if (` · `} else` · ` ? ` · ` && ` 신규 0. 새 `__ENV` 키 · 새 route tag · 임계 (`p(95)<3000` 5 회 · `rate<0.01` 1 회) · `vus: 5` · `duration: "20s"` · cookie 부착 지점 6 곳 · `SEED_PARAMS` 3 회 변경 0. `/api/users` 등장은 여전히 1 회.

**drift smoke — 기존 단언 갱신만 (신규 `it` · `describe` 0)**

- [ ] 본 slice 는 test 도구 코드 (k6 harness) 가 대상이므로 사용자 지시에 따라 **신규 `it` · 신규 `describe` 를 만들지 않는다** (T-2028 · T-2036 선례). 실측과 어긋난 기존 단언만 갱신한다:
  - `969~970 행` 의 stamp 2 핀을 1:1 치환한다 — 하나는 `expect(setup).toContain("const credentials = BOOTSTRAP_CREDENTIALS;")`, 다른 하나는 **s2 ↔ s1 리터럴 parity** `expect(s2Script()).toContain(BOOTSTRAP_CREDENTIALS_DECL)` 이다. `968 행` 주석을 갱신하고 `(T-2038)` 사유 1 줄을 둔다.
  - `1222~1228 행` 합성 mutation 의 치환 anchor 를 `"  const credentials = {"` 에서 `"  const credentials = BOOTSTRAP_CREDENTIALS;"` (또는 동등한 실재 anchor) 로 바꿔, 합성 소스가 실제로 원본과 달라지게 한다. 단언 2 개 (순서 역전 검출) 는 그대로 둔다. 원본과 같은 합성 소스로 조용히 통과하지 않도록 `expect(reverted).not.toBe(setup)` 1 줄을 같은 `it` 에 넣는다 (기존 단언 강화, 신규 `it` 아님).
  - `BOOTSTRAP_CREDENTIALS_DECL` docstring (`4741~4744 행`) 의 "s1 · s3 가 공유" 를 "s1 · s2 · s3 가 공유" 로 고친다.
  - 위 지점 외에 실행 시점에 red 가 되는 기존 단언이 더 있으면 같은 원칙 (실측 일치 + 대체 단언 동반) 으로 갱신하고, 그 목록을 PR body 에 적는다.
- [ ] T-2025 (s3) · T-2024 (s1) · T-2036 groups cookie · T-1672 devset · T-1623 seed/teardown describe 의 단언은 **문자 단위 무변경** 으로 green 이다. drift smoke 전체 `it` 개수는 변경 전과 **같다**.

**R-110 / R-112 판정**

- [ ] R-112 (1)~(4) 적용 판정: production 코드 (`src/`) 변경 **0 LOC**, 신규 · 수정 public symbol 0, production 분기 0 인 부하 harness 자격 상향이다 (T-2028 동형). happy-path · 분기 cover 는 갱신된 drift 단언 (bootstrap 선언 parity · credentials 참조 · 분기 토큰 0) 이 green 인 것으로 충족한다. error path 는 기존 추출기 계약 단언 (블록 부재 `null` · non-string `TypeError`) 이 그대로 green 인 것으로 충족한다. negative 는 ① `/api/users` 1 회 (Admin+ 목록 GET 유입 0) ② `eyJ` · `Bearer ` · `Authorization` 리터럴 0 ③ `__ENV.` 2 회 ④ 임계 프로파일 무변경 ⑤ log 인자에 `credentials` · `password` 유출 0 — 모두 기존 단언 재사용 — 이 green 인 것으로 충족한다. 무 cookie 401 · User cookie 403 은 ⑤b · ⑤c 몫이다.
- [ ] regression (`hqOrigin` Q-0056): s2 ↔ s1 parity 단언이 regression 가드다. 누가 s2 를 stamp 계정으로 되돌리거나 세 파일 중 하나의 리터럴만 바꾸면 ⑤b 배선 전에 drift smoke 가 먼저 red 가 된다. PR body 에 바뀐 s2 지점과 갱신한 drift 단언을 파일 · 행 표로 적는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production 변경 0 이라 수치 불변.
- [ ] `pnpm test:smoke` 통과 (특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전 구간). `pnpm test:e2e` 통과. 실 k6 실행 · 부하 job 발화 0.
- [ ] 동작 무변경 경계: `git diff --stat origin/main -- src prisma web test/helpers .github` 가 비어 있고, `git diff --stat` 이 `touchesFiles` 2 파일 이내 · diff ≤ 300 LOC 다. 초과가 보이면 중단하고 실측 수치를 `## Follow-ups` 에 적는다 (cap 우회 금지).

## Out of Scope

- ⑤b groups write 5 route `Admin+` 배선 (`group.controller.ts` · `group.controller.spec.ts` · census `KNOWN_GAP_REQ_043` 11 → 6 · `MIN.guarded` 73 → 78) 과 그 tier 행 누락 2 route (`POST :id/members` · `DELETE :id/members/:membershipId`) 판정 — 본 slice 머지 직후의 다음 task.
- ⑤c e2e 무 cookie 401 · User cookie 403 단언.
- `s1-batch.js` · `s3-concurrent.js` · `.github/workflows/load-k6.yml` · `package.json` 변경, s2 의 parts 3 지점 cookie 부착 (parts 축 몫), 임계 · 프로파일 · route tag 변경.
- `UserService.signup` 의 `countAll === 0` race · 전용 seed endpoint · role 승격 API — 새 ADR 없이는 건드리지 않는다.
- `test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` · api.md · `docs/requirements.md` doc-sync — 3 controller arc 머지 후 REQ 당 1 회 (CLAUDE.md §3.1).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 groups 축 잔여) 본 task 머지 후 순서는 **⑤b write 5 route `Admin+`** (T-2029 동형, census 11 → 6 · `MIN.guarded` 73 → 78) → **⑤c e2e 401 · 403** (T-2030 동형) 이다. ⑤b 착수 전에는 write 축을 cookie 없이 또는 User cookie 로 부르는 소비처를 다시 전수 실측한다 (e2e · smoke · perf 6 spec · web 은 T-2031 ~ T-2035 로 준비됨, k6 는 본 slice 로 닫힘).
- (planner 판정, CLAUDE.md §3 소비처 동반 의무) helper · factory 신설이 없다. 기존 소비처 1 개 (s2 setup) 의 자격 tier 를 실제로 바꾸는 배선이고, 그로 어긋나는 판정면 (drift smoke) 을 같은 PR 에서 닫는다 → 하한 충족.
- (planner 판정, cap) base 약 70 LOC (s2-read.js: 상수 + 주석 ~20 · credentials 치환 + 주석 갱신 ~15 · drift spec: 핀 2 개 치환 + mutation anchor + docstring ~25 · 주석 ~10). test harness 수정이라 multiplier × 1.0 (T-2028 est 130 은 2 스크립트 + 3 핀이라 본 task 가 더 작다). `estimatedFiles` 2 → cap 안, `sizeExempt` 불요.
