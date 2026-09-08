---
id: T-1985
title: 전 route e2e 왕복 커버리지 census drift smoke spec 신설 (미커버 route 집합 정확 일치)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 290
estimatedFiles: 1
dependsOn: []
touchesFiles: [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts]
independentStream: route-e2e-coverage-census-smoke
created: 2026-09-08
plannerNote: P5 · PLAN 166 행 e2e 커버리지 축 — 40 여 slice 로 닫은 route 공백이 신규 route 유입 시 조용히 다시 열린다
---

# T-1985 — 전 route e2e 왕복 커버리지 census drift smoke spec 신설

## Why

[docs/PLAN.md](../PLAN.md) `166 행` 의 "E2E 시나리오 커버리지" 축은 T-1960~T-1982 40 여 slice 가 route 별 실 부팅 왕복 e2e 를 하나씩 채워 **미커버 route 를 사실상 0 으로** 만든 결과다. 그런데 그 성과를 지키는 장치가 저장소에 없다 — 새 controller · 새 route 가 e2e 없이 들어와도 어느 spec 도 red 가 되지 않는다(부재 축 미검출). 직전 [T-1983](T-1983-route-auth-guard-coverage-census-smoke.md) 이 **guard 적용률** 축에 같은 성격의 census 를 세웠고, 본 slice 는 **e2e 왕복 커버리지** 축에 같은 계약을 세워 스냅샷을 불변식으로 바꾼다.

**issue-still-relevant pre-check (origin/main `9e1a0bb4`, 본 fire 실측)**:

- 신설 대상 파일 부재 — `ls test/smoke | grep route-e2e` 히트 **0**. `test/smoke/` 153 개 중 census 계열은 [route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) **1 개뿐이고 그 축은 guard 배선**이라 e2e 커버리지를 세지 않는다(중복 0).
- 실측 census — `src/**/*.controller.ts` **23 개** · route decorator **89 개** · `test/e2e/*.e2e-spec.ts` **38 개**. controller prefix + route suffix 를 e2e 파일 본문과 대조하면 e2e 왕복이 0 인 route 는 정확히 **2 개**: `GET /api/admin/import/running`([import.controller.ts](../../src/import/import.controller.ts) `350 행`) · `GET /api/admin/import/modes`(같은 파일 `367 행`).
- 그 2 개는 누락이 아니라 **의도된 이월**이다 — [T-1981](T-1981-summary-aggregate-post-e2e-contract.md) `## Why` 가 "`import-detail-read-realdb` perf-spec 이 mock 0 · override 0 으로 이미 덮어 중복" 이라고 명시 이월했고, 실제로 [test/perf/import-detail-read-realdb.perf-spec.ts](../../test/perf/import-detail-read-realdb.perf-spec.ts) `78~79 행` 이 두 경로를 상수로 잡아 실 왕복한다. 그래서 본 spec 은 이 2 건을 **카운트 가능한 allowlist** 로만 박고 새 커버를 만들지 않는다.
- T-1985 ID 미사용(`docs/tasks/` 1984 개, `T-1985` 없음).

즉 본 task 의 의도는 main 에 아직 안착돼 있지 않고, 커버 공백을 메우는 slice 가 아니라 **회귀 감지 장치**를 세우는 slice 다.

## Required Reading

- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `1~70 행` — controller 재귀 발견 · 주석 제거 토크나이저 · `@Controller` prefix 추출 · route decorator 정규식 · `MIN` 하한/allowlist 정확 일치의 판정 비대칭 규약. 본 spec 이 승계할 골격.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) `175 행`(`@Controller("api/admin/import")`) · `350 행` · `367 행` — allowlist 2 건의 좌표.
- [test/perf/import-detail-read-realdb.perf-spec.ts](../../test/perf/import-detail-read-realdb.perf-spec.ts) `78~79 행` — allowlist reason 의 근거(실 DB 왕복 대체 커버).
- [test/e2e/export-job-status-read.e2e-spec.ts](../../test/e2e/export-job-status-read.e2e-spec.ts) `27 행` · `100~102 행` — e2e 가 URL 을 `const BASE` + 템플릿 리터럴로 조립하는 대표 형태. 전체 경로 리터럴 단순 매칭이 왜 거짓 미커버를 내는지의 근거.
- [docs/PLAN.md](../PLAN.md) `166 행` — 본 slice 가 지키는 커버리지 축.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` — R-110 · R-112 · R-113.

## Acceptance Criteria

- [ ] `test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts` **1 파일**을 신설한다. `src/` · `test/e2e/` · `prisma/` · 워크플로 · `package.json` 변경 **0 LOC**.
- [ ] census 산출은 spec 파일 안의 순수 함수 3 개 이하로 두고 같은 파일에서 소비한다(공유 helper 신설 0, Nest 부팅 0 · DB 0 · 네트워크 0 — 파일 read 만).
- [ ] **happy-path** — controller 발견 수 · route decorator 수 · e2e spec 파일 수 · e2e 커버 route 수 네 축에 **하한**(`>=` 23 / 89 / 38 / 87)을 건다(증가는 정상, 감소는 red). 각 축 1+ it.
- [ ] **미커버 집합 정확 일치** — 실측 미커버 집합이 allowlist 2 건(`GET /api/admin/import/running` · `GET /api/admin/import/modes`)과 **양방향 정확 일치**(초과 = 신규 유입, 미달 = stale 잔존 둘 다 red). allowlist 항목마다 reason 태그(`realdb-perf-spec-covered`)를 문자열로 남긴다.
- [ ] **분기 커버** — 매칭기의 분기마다 1+ it: (a) 동적 세그먼트(`:id`)가 e2e 의 템플릿 치환(`${...}`)과 실 문자열 양쪽에 매칭 (b) route suffix 가 빈 문자열인 경우(`@Get()` — prefix 만으로 판정) (c) prefix 는 있으나 suffix 가 없는 파일은 미커버로 남는지 (d) 접두 충돌 방지 — `/running` 이 `/running-xyz` 를 커버로 오판하지 않음.
- [ ] **error path** — 합성 입력으로 1+ it: 존재하지 않는 디렉터리 경로를 넘기면 throw, `@Controller` 데코레이터가 없는 합성 소스는 route 0 으로 조용히 흡수되지 않고 throw.
- [ ] **negative case** — 예외 분기마다 1+ it: (1) 주석 안 `@Get("...")` 문자열이 route 로 오집계되지 않음 (2) 문자열 리터럴 안의 `@Controller` 유사 텍스트가 prefix 로 오집계되지 않음 (3) e2e 가 아닌 파일(`*.perf-spec.ts` · `*.spec.ts`)을 커버 근거로 세지 않음 (4) allowlist 에 실재하지 않는 route 를 넣으면 정확 일치가 깨져 red 가 되는 자기검증 (5) 회귀 감지 능력 자체 검증 — 합성 controller 1 개를 주입하면 미커버 집합이 늘어 red 가 된다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). `src/` 0 LOC 라 전역 coverage 는 불변이어야 한다.
- [ ] 신규 suite 가 `pnpm test:smoke` 로 발견·통과(R-113). CI `smoke test` leg green 확인.

## Out of Scope

- 미커버 2 건(`import/running` · `import/modes`)에 e2e 를 **새로 작성**하지 않는다 — realdb perf-spec 중복이라 T-1981 이 명시 이월한 축이다. 본 slice 는 세기만 한다.
- guard 배선 · RBAC 변경 · controller 수정 등 `src/` 변경 금지(§5 인증 변경은 오너 승인 대상).
- [route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) 본문 수정 금지 — 공통 추출은 별도 slice(아래 Follow-ups).
- `docs/requirements.md` REQ status 재판정 금지(§3.1 판정 규칙 6 — 구현 후 1 회).
- it 케이스는 **14 개 이내**로 묶어 cap(≤ 300 LOC / ≤ 5 파일) 안에 둔다. 초과가 보이면 분기 it 을 `it.each` 로 합친다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
