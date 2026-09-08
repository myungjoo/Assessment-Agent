---
id: T-1983
title: 전 route 인증 guard 적용률 census drift smoke spec 신설 (미보호 route 집합 정확 일치 · APP_GUARD 부재 고정)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-043]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts]
independentStream: route-auth-guard-census-smoke
created: 2026-09-08
plannerNote: P5 · T-1379 Follow-ups 가 명시 이월한 별도 slice — 신규 미보호 route 를 red 로 잡는 census 가 저장소에 0
---

# T-1983 — 전 route 인증 guard 적용률 census drift smoke spec 신설

## Why

[T-1379](T-1379-requirements-auth-protection-coverage-status-rejudge.md) `## Follow-ups` 세 번째 bullet 이 **"e2e 가 group · part · person 의 미보호를 fail 로 잡지 못함 — 전 route 보호 적용률을 강제하는 drift-guard spec 도입 검토 (별도 slice)"** 로 본 slice 를 명시 이월했다. 같은 follow-up 의 첫 bullet 은 **guard 를 실제로 배선하는 일은 인증 흐름 변경이라 CLAUDE.md §5 상 별도 ADR / 오너 승인 대상**이라고 분리해 뒀다 — 본 task 는 그 배선이 아니라 **현 보호 표면을 기계가 감시하게 만드는 관측 slice** 다. [docs/requirements.md](../requirements.md) `62 행` REQ-043 이 `IN_PROGRESS` 로 남은 유일한 사유가 "전 기능 보호 적용률 축 미완" 이고, 지금은 그 축이 **사람이 grep 할 때만 보인다** — 새 controller 가 guard 없이 추가돼도 CI 는 초록이다.

issue-still-relevant pre-check (origin/main `37da6882`, 실측):

- **census spec 부재 재확인** — `git grep -c "UseGuards" origin/main -- test/` 히트는 `test/perf/*.perf-spec.ts` 의 `overrideGuard`(가드 무력화) 와 `test/load/s2-read.js` 뿐이고, `test/smoke/` 에 guard 적용률을 세는 spec 은 **0** 이다. 신설 대상 파일 `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 도 부재. T-1983 ID 미사용.
- **현 보호 표면 (본 fire 실측)** — `src/**/*.controller.ts` **23 개** · route decorator **89 개** · 보호 **64** / 미보호 **25**. 미보호 25 의 내역은 `src/app.controller.ts` 1(`15 행` `@Get()`) · `src/auth/auth.controller.ts` 3(`148`·`194`·`218 행`) · `src/user/user.controller.ts` 1(`156 행` signup) · `src/user/group.controller.ts` 9 · `src/user/part.controller.ts` 6 · `src/user/person.controller.ts` 5 다. 클래스 레벨 `@UseGuards` 는 23 controller 중 **0** — 모든 보호가 메서드 레벨이다.
- **전역 guard 등록 없음** — `git grep -c "APP_GUARD" origin/main -- src/ test/` 히트 **0**. 즉 미참조 controller 의 route 는 실제로 미보호이며, 이 전제가 뒤집히면(누가 `APP_GUARD` 를 등록하면) census 의 판정 규칙 자체가 달라지므로 spec 이 그 부재를 함께 고정해야 한다.
- **기존 커버는 원리적으로 이 축을 못 잡는다** — `Reflect.getMetadata("__guards__", ...)` 로 guard 를 단언하는 colocated controller spec 은 **7 개**(`collection-target` · `assessment-evaluation` · `export` · `import` · `run-status` · `user-instance-access` · `service-identity`) 뿐이고 전부 **자기 controller 의 자기 route** 만 본다. 새 controller 가 guard 없이 추가되면 그 파일의 spec 도 미보호를 정상으로 적을 뿐이라 어느 spec 도 red 가 되지 않는다. e2e 도 마찬가지로 "존재하는 route 를 친다" 라서 **부재 축(빠뜨린 guard)** 을 검출하지 못한다.
- **drift 가 실재하는 표면임을 시계열이 증명** — T-1379 실측 시점(2026-08-02)은 controller 20 · route 74 · 미보호 25 였고, 지금은 controller 23 · route 89 · 미보호 25 다. 5 주 만에 route 가 **+15** 늘었고 그 증가분이 전부 보호된 것은 결과적으로 다행이었을 뿐 **강제 장치가 없었다** — 본 spec 이 그 우연을 계약으로 바꾼다.
- 오너 게이트 침범 0 — `test/perf` · `test/load` 신규 slice 0(PLAN `157`·`158 행`), 공유 helper 신설 0(PLAN `182 행` 소비처 동반 의무 — 추출 함수는 spec 파일 안에 두고 그 자리에서 소비), `docs/requirements.md` 무접촉(PLAN `183 행` REQ 재판정 once-rule — 머지 후 1 회로 이월).
- **본 task 는 guard 를 붙이지 않는다** — 미보호 20 route(group · part · person)의 실 배선은 §5 인증 변경이라 오너 승인 전까지 착수 금지. 본 spec 은 그 20 route 를 `known-gap-REQ-043` 태그로 **명시 부채**로 기록해, 승인 후 배선 slice 가 census 를 함께 줄이도록 강제한다(조용한 blessing 이 아니라 카운트 가능한 부채).

## Required Reading

- [docs/tasks/T-1379-requirements-auth-protection-coverage-status-rejudge.md](T-1379-requirements-auth-protection-coverage-status-rejudge.md) `## Follow-ups` (본 slice 의 출처 3 bullet) + `## 완료 기록` 의 **적용률 축 (미충족)** 문단 (2026-08-02 census 수치)
- [docs/requirements.md](../requirements.md) `62 행` REQ-043 상태 문자열의 "적용률 축은 미완" 문단 — **읽기 전용, 본 task 에서 수정 금지**
- [src/user/group.controller.ts](../../src/user/group.controller.ts) `51 행`(AuthGuard 미적용 = 후속 task 책임 주석) · `79~87 행`(`@Controller("api/groups")` + `@UsePipes` + `export class`, guard 0)
- [src/user/part.controller.ts](../../src/user/part.controller.ts) `28 행`, [src/user/person.controller.ts](../../src/user/person.controller.ts) `20 행` — 같은 "후속 task 책임" 주석
- [src/user/user.controller.ts](../../src/user/user.controller.ts) `142~144 행`(signup = Public tier 의도 명시) · [src/app.controller.ts](../../src/app.controller.ts) `1~2`·`15 행`(sanity 용도 `@Get()`) · [deploy/daily-test.sh](../../deploy/daily-test.sh) `84`·`101 행`(무인증 `GET /api` 폴링 — app root 가 public 이어야 하는 실 근거)
- [src/auth/auth.controller.ts](../../src/auth/auth.controller.ts) `148`·`194`·`218 행`(login / logout / refresh — 인증 진입 경로라 public)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `10~14 행`(`readFileSync` + `REPO_ROOT` 관용구) · `326~340 행`(Error path 관용구) — 정적 drift smoke 의 저장소 표준 형태
- [test/jest-smoke.json](../../test/jest-smoke.json) (`testRegex` = `.*\.smoke-spec\.ts$`, `rootDir` = 저장소 루트)

## Acceptance Criteria

- [ ] `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` **1 파일만** 신설한다. 파일 안에서 (a) `src/` 를 재귀 순회해 `*.controller.ts` 를 **발견**하고(하드코딩 목록 금지 — 신규 controller 자동 편입이 본 spec 의 핵심), (b) `@Controller("prefix")` 와 route decorator(`@Get`/`@Post`/`@Put`/`@Patch`/`@Delete`)를 추출해 full-path 를 조립하며, (c) 클래스 레벨 `@UseGuards` 또는 해당 route 의 decorator 블록 `@UseGuards` 유무로 보호 여부를 판정한다.
- [ ] **happy-path** — 위 3 함수(파일 발견 · prefix 추출 · route/guard census) 각각에 대해 실 `src/` 소스 기준 happy-path test 1+ 를 둔다. controller 발견 수 ≥ 23, route 수 ≥ 89, 보호 route 수 ≥ 64 를 **하한(`toBeGreaterThanOrEqual`)** 으로 단언한다 — 정확 일치로 고정하면 보호된 route 를 정상 추가할 때마다 CI 가 red 가 되므로, **정확 일치는 미보호 집합에만** 적용한다(이 선택의 근거를 파일 head 주석에 남긴다).
- [ ] **negative — 미보호 집합 정확 일치(본 spec 의 핵심 단언)**: 실측 미보호 full-path 집합이 spec 안 allowlist 와 **정확히 같음**을 단언한다(집합 양방향 비교 — allowlist 초과 = 새 미보호 route 유입, allowlist 미달 = stale 항목). allowlist 는 route 별 `reason` 태그를 갖는다: `public-by-design` **5 건**(`GET /api` · `POST /api/auth/login` · `POST /api/auth/logout` · `POST /api/auth/refresh` · `POST /api/users`) / `known-gap-REQ-043` **20 건**(`api/groups` 9 · `api/parts` 6 · `api/persons` 5). 두 태그의 건수(5 / 20)도 각각 단언한다.
- [ ] **negative — 전역 guard 전제**: `src/` 전체에서 `APP_GUARD` 히트가 **0** 임을 단언한다(전역 등록이 생기면 "미참조 = 미보호" 판정 전제가 깨지므로 census 재도출을 강제).
- [ ] **error path** — (1) 존재하지 않는 경로에 `readFileSync` 시 throw 함을 단언(silent fallback 금지), (2) `@Controller` 가 없는 합성 소스 문자열을 prefix 추출 함수에 넣으면 **명시적으로 throw**(빈 문자열 반환 금지) 함을 단언.
- [ ] **flow / 분기 cover** — 합성 소스 문자열로 (a) 클래스 레벨 `@UseGuards` 만 있는 controller → 전 route 보호로 분류, (b) 메서드 레벨 `@UseGuards` 만 있는 route → 보호, guard 없는 형제 route → 미보호, (c) 인자 없는 `@Get()` → full-path 가 prefix 자신, (d) `@Roles`/`@HttpCode` 등 다른 decorator 가 섞인 블록에서도 오판 없음 — 4 분기 각각 test 1+.
- [ ] **negative — 회귀 감지 능력 자체 검증**: 합성 소스에 guard 없는 route 를 하나 더한 입력을 census 함수에 넣으면 그 route 가 미보호로 분류됨을 단언한다(=실제 회귀가 들어오면 위 정확-일치 단언이 red 가 된다는 증명).
- [ ] `pnpm test:smoke` 통과(신규 suite PASS). `pnpm lint` · `pnpm build` · `pnpm test` 통과.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `src/` 변경 0 LOC 이라 전역 coverage 는 불변이어야 한다.
- [ ] 신설 파일이 **≤ 300 LOC** 이고 변경 파일이 **1 개**임을 commit 전 확인. 초과가 예상되면 분기 cover 합성 케이스부터 줄이지 말고 **head 주석을 압축**한다(단언은 유지).

## Out of Scope

- **guard 실 배선** — `group` · `part` · `person` controller 20 route 에 `@UseGuards` 를 붙이는 일. 인증 흐름 변경이라 CLAUDE.md §5 상 오너 승인 + ADR 선행 대상이며 본 task 에서 **절대 손대지 않는다**. `src/` 는 0 LOC 변경.
- `@Roles` / RBAC 역할 축 census(어느 route 가 Admin 전용인가) — 별도 축, 본 spec 은 **인증(JwtAuthGuard) 적용 여부**만 센다.
- controller 별 기대 route 수 표 · route path 89 개 전수 고정 — cap 안에 들어가지 않고, 미보호 집합 정확 일치가 이미 보안 불변식을 잡는다.
- 런타임 `Reflect.getMetadata("__guards__", ...)` 방식 도입 — 기존 colocated controller spec 7 개의 몫으로 유지(본 spec 은 파일 발견 기반 정적 추출이라 **신규 controller 자동 편입**이 성립).
- `web/` · `prisma/` · `.github/workflows/` · `package.json` · 기존 spec 본문 수정. `test/perf/` · `test/load/` 접촉(PLAN `157`·`158 행`).
- `docs/requirements.md` REQ-043 재판정(PLAN `183 행` once-rule — 머지 후 1 회로 이월) 및 `docs/PLAN.md` bullet 갱신.
- 공유 test helper 신설(PLAN `182 행`) — 추출 함수는 본 spec 파일 안에 두고 같은 파일에서 소비한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
