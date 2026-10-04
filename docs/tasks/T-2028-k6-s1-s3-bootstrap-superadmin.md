---
id: T-2028
title: persons guard 배선 선행 8 — k6 s1·s3 공유 bootstrap SuperAdmin 자격으로 s3 write 왕복 Admin+ 선확보
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043, REQ-048, REQ-073]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-10-03
independentStream: q0056-persons-guard
dependsOn: [T-2025, T-2026, T-2027]
touchesFiles:
  [
    test/load/s1-batch.js,
    test/load/s3-concurrent.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ④b 선행 — s3 write 왕복이 User tier cookie 라 Admin+ 배선 즉시 403. 자격 tier 를 먼저 올린다
---

# T-2028 — k6 s1 · s3 공유 bootstrap SuperAdmin 자격 (Q-0056 ④b 선행)

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시 아래 도는 Q-0056 persons guard arc 는 지금 ④a (read 축 2 route, [T-2027](T-2027-persons-read-tier-guard-wiring.md) 머지 `d8e7bebb`) 를 끝내고 **④b write 축 Admin+ 배선** 바로 앞에 서 있다. T-2027 `## Follow-ups` 가 ④b 착수 조건으로 **"write 축을 호출하는 소비처를 다시 전수 실측"** 을 명시했고, 본 task 는 그 실측에서 새로 드러난 **단 하나의 미준비 소비처**를 닫는다.

issue-still-relevant pre-check (planner, 2026-10-03, `origin/main` = `55a17f2d`):

- [src/user/person.controller.ts](../../src/user/person.controller.ts) 의 `@Post()` `113 행` · `@Patch(":id")` `126 행` · `@Delete(":id")` `136 행` 에는 여전히 `@UseGuards` · `@Roles` 가 **0** 이다 (`@Get()` `88~89 행` · `@Get(":id")` `104~105 행` 만 T-2027 로 배선됨) → ④b 는 미안착이고 본 선행 slice 도 유효하다.
- **write 축 소비처 전수 실측 결과** — jest 축은 전부 준비 완료다: `test/e2e/persons.e2e-spec.ts` (POST · PATCH · DELETE 전 호출이 `adminCookie`), `test/smoke/persons.smoke-spec.ts` (`33 행` 주석대로 GET 은 `userCookie` · 그 외 `adminCookie`), `test/e2e/person-identity-continuation.e2e-spec.ts` (`76 행` 등 write 전 호출 `adminCookie`), `test/perf/*` 는 persons write 를 때리는 spec 이 0 (`person-detail-read-realdb.perf-spec.ts` `465 행` 은 HTTP 가 아니라 `prisma.person.delete` 직접 호출).
- **미준비 소비처 1 건 = k6 S3** — [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 의 default function 은 `162 행` POST `/api/persons` · `182 행` DELETE `/api/persons/:id` 를 때리는데, T-2025 가 심은 setup 부트스트랩이 만드는 계정은 **`User` 등급**이다. [load-k6.yml](../../.github/workflows/load-k6.yml) 이 한 job · 한 DB 에서 smoke → S1 → S2 → S3 순으로 돌아 **이 run 의 첫 user 는 S1 의 signup** 이고 (`132~137 행` 주석이 그 순서 의존을 명시), `POST /api/users` 는 `countAll === 0` 일 때만 `SuperAdmin` 을 준다 ([api.md](../architecture/api.md) `75 행`). 따라서 ④b 가 머지되는 순간 S3 의 write 2/3 왕복이 **403** 이 되어 `http_req_failed: rate<0.01` 임계가 통째로 깨진다. 부하 job 은 `workflow_dispatch` 전용이라 **상시 CI 는 green 인 채로 침묵**하는 유형의 파손이라, arc 가 T-2023 ~ T-2026 에서 지켜온 "배선 전에 소비처를 먼저 준비한다" 순서를 여기서도 지킨다.
- 오너 지시 대조 — PLAN `158 행` 은 신규 per-route **perf baseline slice** 만 금지하며 본 slice 는 부하 harness 자격 배선이라 저촉 0. `182 행` 소비처 동반 의무는 아래 `## Follow-ups` 판정으로 충족.

## Required Reading

- [test/load/s1-batch.js](../../test/load/s1-batch.js) `88~107 행` — setup 머리 주석 (`이 run 의 첫 user = SuperAdmin` 의존 서술) + `95~98 행` stamp 자격증명 객체 + `99 행` signup + `100~106 행` login · `authCookie` 조립. **본 slice 의 변경 지점 1**.
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `111~147 행` (`export function setup`) — `115~121 행` stamp 자격증명 + signup, `122~130 행` login · `authCookie`, `135~141 행` 표본 조회, `146 행` return. 그리고 `149~187 행` (`export default function`) 의 `161~167 행` POST · `180~186 행` DELETE — **Admin+ 로 올라가야 하는 왕복 2 개** (수정 대상 아님, 자격만 바뀐다). **본 slice 의 변경 지점 2**.
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `4706~4723 행` (T-2025 describe 머리 주석 + 3 정규식 상수), `4724~4745 행` (`①` happy — 특히 `4738~4740 행` 의 `const stamp = Date.now();` · `load-s3-auth-${stamp}@example.com` · `load-s3-pass-${stamp}` **3 핀이 본 slice 로 실측과 어긋난다**), `4747~4770 행` (`②` cookie 2 지점 — 무변경 유지 대상). 같은 파일 `3639~3690 행` (T-2024 s1 describe) 은 cookie 축만 보고 자격증명 리터럴을 핀하지 않으므로 **s1 변경으로 깨지지 않음을 확인만** 한다. **본 slice 의 변경 지점 3**.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `126~137 행` (smoke → S1 순서와 "첫 user = SuperAdmin" 의존 주석) · `195~217 행` (S2 · S3 step 의 `if: ${{ !cancelled() }}` leg 독립성) — **읽기 전용**. 본 slice 는 workflow 를 수정하지 않는다 (`## Out of Scope`).
- [docs/architecture/api.md](../architecture/api.md) `75 행` (`POST /api/users` 의 `countAll === 0 → SuperAdmin` / 그 외 `User` + 중복 email `409`) · `80 행` · `82 행` · `83 행` (persons write 3 route = **Admin+**) — 등급 판정의 정본.

## Acceptance Criteria

- [ ] `test/load/s1-batch.js` 와 `test/load/s3-concurrent.js` 가 **같은 bootstrap 자격증명 리터럴 1 쌍** (email · password) 을 각자 파일 상단 상수로 선언한다. 두 파일의 값은 **문자 단위로 동일**해야 하고, email 은 `@example.com` 도메인, password 는 길이 8 이상 (`AddUserDto` 의 `@MinLength(8)`) 이다. 외부 secret · 실 자격증명 · 토큰 리터럴은 0 이며 (CLAUDE.md §8), 값의 성격이 "부하 job 전용 일회성 계정" 임을 주석 1 줄로 남긴다.
- [ ] `s1-batch.js` setup 이 stamp 파생 자격증명 대신 그 bootstrap 자격증명으로 `POST /api/users` → `POST /api/auth/login` 을 탄다. 왕복 수 · tag (`auth`) · `authCookie` 조립 위치 · return 형태는 **무변경**이고, S1 이 여전히 run 의 첫 signup 이라 그 계정이 `SuperAdmin` 이 되는 의존 관계를 머리 주석에서 갱신한다 (stamp 근거 문장을 "결정적 bootstrap 계정 + 재실행 시 409 무시" 로 교체).
- [ ] `s3-concurrent.js` setup 이 같은 bootstrap 자격증명으로 `POST /api/users` (이미 존재하면 409 — 응답을 분기 없이 버린다) → `POST /api/auth/login` 을 타, S1 이 만든 **SuperAdmin 세션 cookie** 를 얻는다. 그 결과 `authCookie` 가 persons write 2 왕복에 Admin+ 자격으로 실린다. setup 의 왕복 수 · `seed` / `auth` tag 분리 · 표본 조회 순서 (`login → authCookie → persons 조회`) 는 **무변경**이며, default function 의 `stamp` (person email `@unique` 회피용) 는 **그대로 유지** 한다 — 바꾸는 것은 인증 자격증명뿐이다.
- [ ] **분기 0 유지** — 두 스크립트 어디에도 `if (` · `} else` · ` ? ` · `&&` 가 새로 생기지 않는다 (409 는 조건 분기 없이 무시). s1 의 `||` 개수는 현행 `2` 그대로 (drift spec `3675~3684 행` 단언이 그대로 green).
- [ ] 임계 오염 0 을 주석으로 박제한다 — bootstrap signup 이 재실행 DB 에서 내는 **409 1 건**은 `auth` / `seed` tag 이고 run 당 1 회라 전역 `http_req_failed: rate<0.01` 대비 무시 가능 수준임을 각 스크립트 1 줄로 남긴다. 판정 tag (`read` · `write` · `batch`) 로의 누수는 0 이다.
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 T-2025 describe `①` 안에서 **실측과 어긋나게 된 3 핀** (`const stamp = Date.now();` · `load-s3-auth-${stamp}@example.com` · `load-s3-pass-${stamp}`) 을 bootstrap 자격증명 핀으로 **1:1 치환**하고, 치환분 중 1 개는 **s1 ↔ s3 리터럴 parity 단언** (두 파일에서 읽은 같은 상수가 동일) 으로 쓴다. 치환 사유를 `(T-2028)` 주석 1 줄로 남긴다. **신규 `it` · 신규 `describe` 신설 0** — 본 변경은 test 도구 코드 (k6 harness) 를 대상으로 하므로 사용자 지시에 따라 테스트를 새로 늘리지 않고, 실측과 어긋난 기존 단언만 갱신한다. 같은 describe 의 `②` 이후 단언과 T-2024 (s1) · T-2026 (s3 default) describe 는 **문자 단위 무변경**이다.
- [ ] production 코드 (`src/`) 변경 **0 LOC** — 본 slice 는 부하 harness 자격 tier 선확보 전용이다. 따라서 R-112 의 신규 public symbol 이 없고 (해당 항목 생략), 기존 suite 가 회귀 없이 전부 통과하는 것으로 검증한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` green (특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전건). `pnpm test:e2e` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일은 `touchesFiles` **3 개**를 넘지 않고 diff 는 300 LOC 이하다. 초과가 보이면 중단하고 `## Follow-ups` 에 실측 수치를 적는다 (cap 우회 금지).

## Out of Scope

- **④b write 축 guard 배선 그 자체** (`src/user/person.controller.ts` 의 `@Post` · `@Patch` · `@Delete` + `person.controller.spec.ts` + census `KNOWN_GAP_REQ_043` 18 → 15 · allowlist 23 → 20 · `MIN.guarded` 66 → 69) — 본 slice 머지 직후의 다음 task.
- `.github/workflows/load-k6.yml` 변경 (env 주입 · step 순서 · 새 input). 본 slice 는 **스크립트 안 기본값만**으로 닫아 workflow ↔ script parity 단언을 건드리지 않는다.
- `test/load/s2-read.js` 의 stamp 자격증명 — S2 는 `GET /api/persons` (User+) · `GET /api/auth/me` (User+) 만 때려 등급 승격이 불필요하다.
- 실 k6 run 발화 · 부하 workflow dispatch · 실측 수치 기록 (`docs/ops/load-resilience-test-plan.md` `§3` 회차 추가).
- `docs/ops/load-resilience-test-plan.md` · `docs/ops/runbook.md` · `docs/ops/realdata-scale-devset.md` 의 인증 부트스트랩 서술 doc-sync — CLAUDE.md §3.1 판정대로 persons 축 ④ 완결 뒤 direct doc-only slice 1 개로 묶는다 ([T-2027](T-2027-persons-read-tier-guard-wiring.md) `## Out of Scope` 예약분에 흡수).
- `UserService.signup` 의 `countAll === 0` race window · 전용 seed 계정 endpoint 신설 · role 승격 API 사용 — 새 ADR 없이는 건드리지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, CLAUDE.md §3 소비처 동반 의무) 본 slice 는 helper 신설이 아니라 **기존 소비처 2 개 (s1 · s3 setup) 의 자격 tier 를 실제로 바꾸는 배선 그 자체**이고, 그 변경으로 어긋나는 판정면 1 곳 (T-2025 drift describe) 을 같은 PR 에서 닫는다 → 하한 충족, 별 소비처 slice 예약 없음.
- (planner, arc 계획) 본 slice 머지 후 큐잉 순서는 **④b write 축 배선 → ④c e2e 인가 단언 → persons 축 doc-sync 1 slice** 다. ④b 착수 시 write 소비처 재실측은 본 slice 의 `## Why` 실측표를 기준점으로 삼으면 된다.
