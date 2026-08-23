---
id: T-1656
title: 133 로그인 seed 의 CLI 본체 (client 주입형 exit-code 반환) 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T01:20:00Z
independentStream: load-r91
dependsOn: [T-1655]
touchesFiles:
  - test/helpers/realdata-devset-seed-cli.ts
  - test/helpers/realdata-devset-seed-cli.spec.ts
plannerNote: R-91 chain 37/N — seed 실행 경로 6 번째 slice: runDevsetSeed 를 감싸는 CLI 본체(분기·exit code·disconnect)만.
---

# T-1656 — 133 로그인 seed 의 CLI 본체 (client 주입형 exit-code 반환) 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 37 번째 slice 다. 직전 slice T-1655 (main `7bc054a7`, PR #1323) 가 `runDevsetSeed(client, count?)` top-level 조립 함수를 박제해 **순수 라이브러리 층은 완성**됐다. 그러나 그 함수를 실제로 부르는 주체가 아직 없다 — `git grep runDevsetSeed` 결과가 자기 spec 뿐이다.

`.github/workflows/load-k6.yml` 이 seed 를 태우려면 (1) 실 `PrismaClient` 를 만들고 (2) `runDevsetSeed` 를 호출하고 (3) 요약을 stdout 으로 남기고 (4) 실패를 exit code 로 CI 에 전달하고 (5) 연결을 반드시 닫는 **CLI 층** 이 필요하다. 본 slice 는 그중 **분기를 전부 담는 본체 하나만** 가져간다 — 실 `PrismaClient` 인스턴스화와 `process.exit` 은 다음 slice 의 얇은 entrypoint (`scripts/*.ts`, 분기 0) 로 미룬다. 이 "본체(테스트 가능) + entrypoint(trivial)" 분리는 [`src/llm/encrypt-token-cli.ts`](../../src/llm/encrypt-token-cli.ts) ↔ [`scripts/encrypt-token.ts`](../../scripts/encrypt-token.ts) (T-0206) 의 이미 증명된 선례를 그대로 mirror 한 것이고, CLAUDE.md `§3.2` R-112 "entrypoint 안에 분기 두지 말고 helper 로 분리" 룰의 직접 집행이다.

잔여 좌표는 [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ① — "133 로그인을 소비해 `Person` + 각자 github `ServiceIdentity` 를 적재하는 seed 실행 경로".

## Required Reading

- [`test/helpers/realdata-devset-seed-run.ts`](../../test/helpers/realdata-devset-seed-run.ts) — 본 CLI 가 호출할 유일한 seed 함수. `DevsetSeedClient` 교차 타입 · `DevsetSeedRunResult` (`personCount` · `identityCount` · 두 Map) · 에러 정책 (하위 helper 의 `TypeError` / `RangeError` / `Error` 무가공 전파, leg 단위 부분 적재 경계).
- [`test/helpers/realdata-devset-seed-run.spec.ts`](../../test/helpers/realdata-devset-seed-run.spec.ts) — colocated spec 의 mock client 패턴과 서술 형식 선례. 본 task 의 spec 도 같은 형식을 따른다.
- [`src/llm/encrypt-token-cli.ts`](../../src/llm/encrypt-token-cli.ts) — **CLI 본체의 정본 패턴**: 실 io 를 인자로 주입받고 `process` 를 직접 만지지 않으며 exit code 를 `return` 한다. 본 task 는 이 구조를 그대로 승계한다.
- [`scripts/encrypt-token.ts`](../../scripts/encrypt-token.ts) — 다음 slice 가 만들 얇은 entrypoint 의 형태 (본 task 에서는 **만들지 않는다**, 경계 확인용으로만 읽는다).
- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 — seed 실행 경로 잔여 항목의 정확한 범위.

## Acceptance Criteria

- [ ] `test/helpers/realdata-devset-seed-cli.ts` 신설. public symbol 은 정확히 3 개:
  - `DevsetSeedCliClient` — `DevsetSeedClient & { $disconnect(): Promise<void> }` 교차 타입 (실 `PrismaClient` 가 상위집합이 되도록 구조적 타입만 요구, 자체 필드 재선언 0).
  - `DevsetSeedCliDeps` — `{ client: DevsetSeedCliClient; count?: number; log: (line: string) => void; logError: (line: string) => void }` 주입 계약 interface.
  - `runDevsetSeedCli(deps: DevsetSeedCliDeps): Promise<number>` — exit code (성공 `0` / 실패 `1`) 를 **return** 하는 본체.
- [ ] **`process` 직접 접근 0** — `process.exit` · `process.env` · `process.argv` · `console.*` 를 본 파일에서 쓰지 않는다 (전부 `deps` 주입). `@prisma/client` 값 import 0 (`import type` 만), 새 dependency 0, 실 DB/네트워크 접속 0.
- [ ] **seed 로직 재구현 0** — 본체는 `runDevsetSeed(deps.client, deps.count)` 를 정확히 1 회 호출할 뿐이며, upsert args 조립 · placeholder 치환 · 검증을 직접 하지 않는다.
- [ ] 성공 경로 — `runDevsetSeed` 가 resolve 하면 `personCount` · `identityCount` 를 담은 요약 줄을 `log` 로 남기고 `0` 을 반환한다. 반환 Map 의 **원소 전량을 로그로 덤프하지 않는다** (R-59 raw 활동 데이터 0, 133 건 로그 폭주 차단 — count 요약만).
- [ ] 실패 경로 — `runDevsetSeed` 가 reject/throw 하면 에러 메시지를 `logError` 로 남기고 `1` 을 반환한다. **본체는 새로 throw 하지 않는다** (CI 는 exit code 로만 판정). 단 에러 메시지에 secret 을 싣지 않는다 (CLAUDE.md `§9` — 메시지 문자열만, 객체 덤프 금지).
- [ ] `$disconnect()` 는 성공·실패 **양쪽 모두에서 정확히 1 회** 호출된다 (`finally`). `$disconnect()` 자체가 reject 해도 그 실패는 `logError` 로 기록만 하고 **원래 exit code 를 바꾸지 않는다** (성공이면 `0` 유지, 실패면 `1` 유지).
- [ ] colocated spec `test/helpers/realdata-devset-seed-cli.spec.ts` 신설 (mock client 만 사용). R-112 4 종 전량 cover:
  - **happy-path** — (a) 소량 `count` 성공 시 반환값 `0`, (b) 요약 줄에 `personCount` · `identityCount` 실제 값이 포함, (c) `$disconnect` 1 회 호출, (d) `logError` 호출 0 회. public symbol `runDevsetSeedCli` 에 happy-path 1+.
  - **error path** — `person.upsert` rejection · `serviceIdentity.upsert` rejection · 치환 단계 `Error` 각각에 대해 반환값 `1` + `logError` 1+ 호출 + `$disconnect` 여전히 1 회 호출을 단언 (각 1+ test).
  - **분기 cover** — `count` 명시 vs 미지정(기본 133 경로가 `runDevsetSeed` 로 그대로 전달되는지 인자 단언) · 성공 + `$disconnect` 성공 · 성공 + `$disconnect` reject (반환 `0` 유지) · 실패 + `$disconnect` reject (반환 `1` 유지) 각 1+ test.
  - **negative cases 충분 cover** — `deps` 자체가 `undefined` / `null`, `client` 결손, `log` 가 비-함수, `logError` 가 비-함수, `$disconnect` 가 비-함수, `count` 가 음수 / 소수 / `NaN` / 133 초과 — **각 1+ test**. `count` 위반군은 하위 helper 의 `RangeError` 메시지가 `logError` 에 실리고 반환값이 `1` 인지, client 의 `upsert` 호출은 0 회인지 (부분 적재 0) 까지 단언. `deps` 결손군은 로깅 수단 자체가 없으므로 `TypeError` 전파를 허용하되 그 동작을 spec 이 명시적으로 고정한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- 얇은 entrypoint (`scripts/seed-devset.ts` 등) 신설 · `package.json` 스크립트 추가 · 실 `PrismaClient` 인스턴스화 · `process.exit` 호출 — 다음 slice.
- `.github/workflows/load-k6.yml` 의 seed step 배선, `test/load/s1-batch.js` `setup()` 의 실 dataset 교체 — 그 다음 slice.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 종 T-0791/T-0944/T-0947 동반 갱신이 필요해 5 파일 cap 초과 — T-1122 BLOCKED / Q-0054 선례).
- 기존 `realdata-devset-seed-*.ts` · `realdata-e2e-seed-*.ts` 본문 수정 (읽기 전용 재사용).
- teardown(적재 데이터 정리) 경로 · 재시도 · 트랜잭션 래핑 · 배치 튜닝.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 진척 doc-sync (별도 direct doc-sync slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

---

## 완료 기록

- 완료 시각: 2026-08-23T02:55:50Z (squash merge)
- PR: #1324 → merge commit `1a7ace68` (2 파일 +300/-0, feature branch 삭제)
- 결과: `test/helpers/realdata-devset-seed-cli.ts` 신설 — public symbol 정확히 3 개 (`DevsetSeedCliClient` · `DevsetSeedCliDeps` · `runDevsetSeedCli`). `runDevsetSeed` 를 정확히 1 회 호출하는 얇은 본체로 seed 로직 재구현 0, `process` 직접 접근 0, `@prisma/client` 값 import 0, 새 dependency 0. 성공 경로는 count 요약 로그 + `0` 반환, 실패 경로는 `logError` + `1` 반환이며 `$disconnect` 는 양쪽 경로 정확히 1 회 호출되고 그 실패가 exit code 를 바꾸지 않는다.
- Test: colocated spec 20 케이스로 R-112 4 종 (happy · error · 분기 · negative) 전량 cover. 신규 모듈 line/branch/function 100%, 전체 line 99.95 · function 100. lint / build / test (451 suites, 12945 케이스) 전량 green.
