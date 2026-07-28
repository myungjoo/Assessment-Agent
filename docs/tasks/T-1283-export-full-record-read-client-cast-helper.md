---
id: T-1283
title: PrismaService → ExportFullRecordReadClient 캐스팅을 이름 있는 helper 로 통합 (실행 slice 3c-2d)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 190
estimatedFiles: 4
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1282]
touchesFiles:
  - src/export/export-full-record-read-client.ts
  - src/export/export-full-record-read-client.spec.ts
  - src/export/export-job.service.ts
  - src/import/import-restore.service.ts
plannerNote: "cap-bend 없음: R-112 backbone x1.5 = 190 LOC / 4 파일 — T-1281 이월 nit (iii) 를 신규 파일 1 겹으로 닫는 동작 변화 0 refactor"
---

# T-1283 — PrismaService → ExportFullRecordReadClient 캐스팅을 이름 있는 helper 로 통합 (실행 slice 3c-2d)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 [T-1281](T-1281-import-restore-orchestrator.md) reviewer 가 낸 이월 NIT 3 건 중 앞의 2 건은 [T-1282](T-1282-import-module-restore-orchestrator-provider.md) (slice 3c-2c, PR #1173 머지 `e57034ab`) 가 닫았고, 남은 **1 건 (iii)** 이 본 slice 의 대상이다: `this.prisma as unknown as ExportFullRecordReadClient` 라는 **같은 캐스팅 표현이 production 2 곳** ([export-job.service.ts](../../src/export/export-job.service.ts) 519 행 · [import-restore.service.ts](../../src/import/import-restore.service.ts) 56 행) 으로 확산됐다. `as unknown as` 는 타입 안전을 끄는 표현이라 확산될수록 "왜 안전한가" 의 근거가 주석 사본으로 갈라진다 — T-1282 가 cap 초과 (`src/export/**` 를 더 여는 7 파일) 를 이유로 별도 slice 로 예고한 그 정리다.

본 slice 는 그 캐스팅을 **이름 있는 helper 한 곳** (`asExportFullRecordReadClient`) 으로 모으고 두 호출처를 그 helper 호출로 교체한다. helper 는 **신규 파일** [src/export/export-full-record-read-client.ts](../../src/export/export-full-record-read-client.ts) 에 둔다 — [export-full-record-collect.ts](../../src/export/export-full-record-collect.ts) 안에 넣으면 (a) T-1280 이 헤더 주석으로 박제한 "helper 는 Prisma 타입을 모른다" 경계가 깨지고, (b) `import-restore.service.spec.ts` 23~25 행의 `jest.mock("../export/export-full-record-collect", () => ({ collectFullExportRecords: jest.fn() }))` factory 가 신규 export 를 누락해 `undefined` 호출로 깨진다. 파일을 나누면 두 문제가 동시에 사라지고 기존 spec 은 한 줄도 손대지 않는다.

런타임 의미는 **identity** 다 — 캐스팅은 컴파일 타임 표현이라 helper 는 인자를 그대로 돌려준다. 따라서 본 commit 의 동작 변화는 **0** (read 경로 · 조립 · 예외 전파 · 호출 횟수 전부 불변) 이고, 다음 slice 3c-3 (controller / job service 재배선) 이 열릴 때 캐스팅 근거를 한 곳에서만 읽으면 된다.

**estimate 근거** — production 은 신규 helper 파일 ~35 LOC (헤더 주석 포함) + 호출처 2 곳 각 ~8 LOC (import 교체 · 미사용 type import 제거 · 호출 한 줄). spec 은 colocated 신규 ~135 LOC. R-112 backbone × 1.5 로 **~190 LOC / 4 파일** — cap (300 LOC / 5 파일) **안** 이라 `sizeExempt` 불요. 선례 T-1279 실측 150 LOC / 3 파일, T-1282 실측 4 파일.

## Required Reading

- [src/export/export-full-record-collect.ts](../../src/export/export-full-record-collect.ts) 33~48 행 — `ExportFullRecordReadDelegate` (findMany 1 개) 와 `ExportFullRecordReadClient` (`Readonly<Record<ExportEntityDelegate, ...>>`) 정의 + "실 `PrismaService` 캐스팅은 호출자 몫" 주석. 본 task 는 이 타입을 **재정의하지 않고 import 만** 한다 (사본 0).
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 75~82 행 (collect helper import 블록) · 511~522 행 (`private async collectFullExportRecords()` 위임부 + 캐스팅 주석) — 교체 대상 1.
- [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts) 24~31 행 (import 블록) · 52~58 행 (`restoreFromDump` 의 (1) 단계 캐스팅) — 교체 대상 2. 헤더 주석의 "(1) … 캐스팅은 **호출자 몫** 이라 본 service 의 이 한 줄에서만 일어난다" 서술도 helper 경유로 동기 갱신 대상.
- [src/import/import-restore.service.spec.ts](../../src/import/import-restore.service.spec.ts) 23~25 행 (module mock factory) · 61 행 (`sentinel prisma`) · 130 행 (`expect(collect).toHaveBeenCalledWith(prisma)`) — helper 가 identity 여야 이 단언이 **그대로 통과** 함을 확인하기 위한 읽기. 본 spec 은 **수정 대상이 아니다**.
- [docs/tasks/T-1280-export-full-record-collect-helper.md](T-1280-export-full-record-collect-helper.md) §Why — "client 를 인자로 받아 cross-module DI 결합 0" 설계 의도. 본 helper 도 그 경계를 깨지 않는다 (`ImportModule` 이 `ExportModule` 을 import 하지 않는다 — 함수 import 만).

## Acceptance Criteria

- [ ] 파일 **4 개만** 변경한다: 신규 [src/export/export-full-record-read-client.ts](../../src/export/export-full-record-read-client.ts) · 신규 [src/export/export-full-record-read-client.spec.ts](../../src/export/export-full-record-read-client.spec.ts) · [src/export/export-job.service.ts](../../src/export/export-job.service.ts) · [src/import/import-restore.service.ts](../../src/import/import-restore.service.ts). `export-full-record-collect.ts` 및 그 spec · `export-job.service.spec.ts` · `import-restore.service.spec.ts` · `import.module.ts` · `import.controller.ts` · `import-job.service.ts` · `test/**` · `prisma/**` **0 수정**.
- [ ] **helper 계약** — 신규 파일이 `asExportFullRecordReadClient(prisma: PrismaService): ExportFullRecordReadClient` **하나만** export 한다. `ExportFullRecordReadClient` 타입은 `./export-full-record-collect` 에서 import (재정의 · 사본 0). 본문은 **캐스팅 1 줄 + return** 뿐 — 검증 · 정규화 · 복제 · Proxy · 캐시 · 로깅 · throw **0**.
- [ ] **캐스팅 단일화** — `git grep "as unknown as ExportFullRecordReadClient" -- "src/**" ':!*.spec.ts'` 결과가 **정확히 1 건** (신규 helper 안) 이다. 두 호출처는 `asExportFullRecordReadClient(this.prisma)` 형태로 바뀌고, 그 결과 미사용이 되는 `type ExportFullRecordReadClient` import 는 **제거** 한다 (TS6133 · lint 무경고).
- [ ] **동작 변화 0** — `collectFullExportRecords` 에 넘어가는 인자는 여전히 `this.prisma` **같은 인스턴스** 다 (identity). 두 호출처의 메서드 이름 · 시그니처 · 반환 타입 · 호출 순서 · 예외 전파는 **불변**. `import-restore.service.spec.ts` 130 행 `expect(collect).toHaveBeenCalledWith(prisma)` 와 `export-job.service.spec.ts` 의 기존 export 경로 test 가 **한 줄도 수정 없이** 통과한다.
- [ ] **주석 동기** — 신규 helper 헤더에 (a) 왜 `as unknown as` 가 필요한지 (Prisma delegate 의 `findMany` 시그니처가 model 마다 다른 union 이라 구조적 호환이 성립하지 않음), (b) 왜 안전한지 (helper 가 요구하는 surface 는 5 delegate 의 projection-only `findMany` 뿐이고 `PrismaService` 가 그 전부를 실제로 제공), (c) 경계 (검증 0 · 런타임 identity) 를 한국어로 박제한다 (§12). 두 호출처의 기존 캐스팅 근거 주석은 **helper 참조로 축약** 해 사본 서술을 남기지 않는다.
- [ ] **happy-path unit test 1+** — (a) 임의 client 객체를 넣으면 **같은 참조** 가 반환된다 (`toBe`), (b) 반환값의 5 delegate key (`user` · `group` · `part` 등 `EXPORT_ENTITY_SOURCES` 가 요구하는 실제 key) 가 입력 그대로 접근 가능하고 그 `findMany` 를 호출하면 입력 mock 이 호출된다 (실제로 read 가 통하는 client 임).
- [ ] **error path unit test 1+** — (a) `null` / `undefined` 를 넘겨도 helper 자체는 **throw 하지 않고** 그대로 돌려준다 (검증 책임이 helper 에 없음을 pin — 방어 로직을 나중에 몰래 넣으면 fail), (b) delegate 의 `findMany` 가 reject 하는 client 를 넘겨도 helper 단계에서는 아무 일도 일어나지 않는다 (reject 는 실제 호출 시점에만 발생).
- [ ] **분기 cover** — helper 본문에 **분기가 없다** (조건문 · 삼항 · optional chaining 0). 따라서 분기별 test 대신 입력 형태별 case (객체 · 빈 객체 · frozen 객체 · 배열 · 원시값 · null · undefined) 가 모두 **동일하게 identity 로** 통과함을 단언해 "분기 없음" 을 test 로 고정한다. 그 사실을 PR body 에도 1 줄 명시한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+: (a) 입력 객체가 **변형되지 않는다** (호출 전후 `Object.keys` 동일 · `Object.isFrozen` 인 입력도 통과 · 신규 key 0), (b) helper 호출만으로 어떤 delegate 도 **호출되지 않는다** (mock `findMany` call count 0 · `$transaction` call count 0), (c) getter 로 정의된 property 를 가진 입력에서 **property 접근 자체가 0 회** (getter spy 미호출 — Proxy · 복제 · 얕은 read 를 도입하지 않았음), (d) 같은 입력으로 두 번 호출하면 두 반환값이 서로 `toBe` 동일 (캐시 · 새 wrapper 생성 0), (e) delegate 가 **일부 누락된** 부분 client 를 넘겨도 runtime throw 0 (타입 차원 계약일 뿐임을 pin), (f) 반환값에 `apiKey` 같은 secret key 나 진단 문자열이 **추가되지 않는다** (REQ-032 부정 단언 — 입력에 없던 key 가 반환값에 0 개).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper 파일은 line · branch · function **100%** 를 목표로 한다.
- [ ] `scripts/check-spec-presence.sh` 통과 (신규 production 파일에 colocated spec 존재), `prettier --check` 통과. 신규 spec 은 실 DB 0 · 실 `PrismaService` 인스턴스화 0 (좁은 mock 객체만).
- [ ] **diff 규율** — **총 diff ≤ 210 LOC / 4 파일** (cap 300 대비 자체 sub-limit). 초과가 예상되면 negative (f) → (c) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`import.controller.ts` / `import-job.service.ts` 재배선** — `ImportRestoreService` inject · T-1254 interim `markFailed` guard 교체 · `markRunning` → 복원 → `markSucceeded` 전이 · `restoredRowCount` 영속화 · import UI false-success 해소 — 실행 slice **3c-3**. 본 slice 는 캐스팅 정리 한 겹뿐이며 호출처 0 상태를 그대로 둔다.
- **캐스팅을 없애는 방향의 타입 재설계** — `ExportFullRecordReadClient` 를 Prisma generated 타입에서 파생시키거나 `PrismaService` 에 인터페이스를 implement 시키는 변경 0. delegate 별 `findMany` union 을 다루는 일은 본 slice 의 범위를 훨씬 넘고 export 경로 전체 회귀 위험이 있다 — 필요하면 별도 ADR.
- **helper 안에 런타임 검증 추가 0** — "5 delegate key 가 실제로 있는지" 를 확인해 throw 하는 guard 는 **의도적으로 넣지 않는다** (동작 변화 0 원칙 + 부분 mock 을 쓰는 기존 spec 다수가 깨진다). 필요성이 보이면 Follow-ups 에 적고 별도 slice 로.
- `collectFullExportRecords` · `export-full-record-collect.ts` 의 **본문 · 타입 정의 수정 0**, `ExportJobService` 의 다른 메서드 · `materializeFullExportDownload` 경로 수정 0, `ImportRestoreService` 의 **4 단계 본문 구조 변경 0** (본 task 가 만지는 실행 문은 (1) 단계의 인자 표현 1 곳뿐).
- e2e / smoke / `daily-test.sh` leg 추가 · 수정 0 (동작 변화가 0 이라 실 DB 왕복 실증이 불필요), Prisma schema · migration 0, 새 외부 dependency 0, 성능 최적화 0, 기존 spec 의 의미 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3c-3** — `import.controller.ts` / `import-job.service.ts` 재배선 (T-1254 interim guard → 실 복원 pipeline, `markRunning` / `markSucceeded` / `markFailed` 전이 + `restoredRowCount`) + HTTP 경계 e2e (400 / 409 응답 body) + import UI false-success 해소. `ImportRestoreService` 가 T-1282 로 DI 등록을 마쳤으므로 inject 만 하면 착수 가능하다. 규모상 (controller + job service + 두 spec + e2e) cap 초과가 예상되니 planner 가 3c-3a (service 배선) / 3c-3b (controller · HTTP 경계) 로 쪼갤 것.

## 결과 (2026-07-28 완료)

- PR [#1174](https://github.com/myungjoo/Assessment-Agent/pull/1174) → squash merge `d062519e`. reviewer round **1/7** APPROVE, §3.3 4-게이트 전부 통과 (reviewer comment 외부 존재 · CI 2 check pass · acceptance 재점검).
- 실측 **+210/-20 (210 LOC) / 4 파일** — 자체 sub-limit(210) 안, cap(300 LOC / 5 파일) 안. 신규 [src/export/export-full-record-read-client.ts](../../src/export/export-full-record-read-client.ts) 의 `asExportFullRecordReadClient` 는 캐스팅 1 줄 + return 뿐 — 검증 · 복제 · Proxy · 캐시 · 로깅 0 이라 런타임 identity 이고 **동작 변화 0**.
- T-1281 이월 nit 3 건 중 마지막 (iii) closure: `export-job.service.ts` · `import-restore.service.ts` 두 곳으로 갈라져 있던 `as unknown as ExportFullRecordReadClient` 를 helper 호출로 교체해 production 캐스팅 grep 이 정확히 **1 건**으로 수렴했다. 미사용이 된 type import 도 함께 제거.
- 신규 helper line/branch/function **100%**, 전체 **427 suite / 12161 test** green. 기존 export / import spec 은 **0 수정**으로 통과 — identity 보존의 외부 증거.
- 본 task 는 cron multi-task fire(N=2, `FIRE-BATCH: T-1282+T-1283`)의 두 번째 task 로 수행됐다.
