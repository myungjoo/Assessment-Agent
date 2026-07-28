---
id: T-1277
title: 복원 Prisma error → HTTP exception 매핑 순수 helper (실행 slice 3b-2c-1)
phase: P5
status: DONE
completedAt: 2026-07-28T02:38:58Z
mergedAs: d8f94a3e
prNumber: 1168
reviewRounds: 2
actualDiff: 292
actualFiles: 2
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-07-28
independentStream: import-restore-engine
dependsOn: [T-1276]
touchesFiles:
  - src/import/import-restore-error.ts
  - src/import/import-restore-error.spec.ts
plannerNote: "3b-2c 를 둘로 쪼갠 앞 절반 — 순수 매핑 helper + spec 만 (service 배선·e2e 갱신은 3b-2c-2). prod ~85 : spec ~175 = 260"
---

# T-1277 — 복원 Prisma error → HTTP exception 매핑 순수 helper (실행 slice 3b-2c-1)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 3b-2a ([T-1275](T-1275-import-restore-transaction-service.md)) 가 단일 `$transaction` 배선을 닫고, 3b-2b ([T-1276](T-1276-import-restore-rollback-e2e.md), PR #1167) 가 실 DB rollback 을 실증했다. 그 e2e 의 164 행 단언이 **"전파된 error 는 아무도 감싸지 않는다"** 를 pin 하고 있는데, 이는 현재 복원 실패가 controller 까지 raw Prisma error 로 올라가 **HTTP 500** 이 된다는 뜻이다 — 중복 키 위반 (사용자 dump 문제) 과 DB 장애가 같은 500 으로 뭉개진다.

본 slice 는 그 매핑의 **순수 함수 한 겹만** 만든다: Prisma known error code → NestJS HTTP exception. 배선 (service 가 이 helper 를 실제로 호출) 과 T-1276 e2e 단언 갱신은 후속 3b-2c-2 로 분리한다 — 한 slice 에서 helper + 배선 + e2e 갱신을 함께 하면 T-1270 (est 340 → 실측 573) 재발이다. REQ-032 (raw 미노출) 정합이 본 helper 의 핵심 제약이다: Prisma error 본문에는 위반한 **값** 이 실릴 수 있으므로 그 문구를 그대로 응답에 태우면 안 된다.

**estimate 근거** — 본 chain 의 실측 비율 (production : spec ≈ 1 : 2.1). 매핑 표 3 종 + code 추출 + 안전 메시지 조립 ≈ **production 85 LOC**, 그 spec ≈ **175 LOC** → 총 **260**. 자체 sub-limit **270** (cap 300 대비 30 여유). `sizeExempt` 를 쓰지 않는다.

## Required Reading

- [src/import/import-restore-transaction.service.ts](../../src/import/import-restore-transaction.service.ts) 8~17 행 + 61~86 행 — 본 helper 의 미래 호출처. "error 를 감싸지 않고 그대로 전파" 계약과 "보상 로직 0" 경계. **본 task 는 이 파일을 수정하지 않는다** (3b-2c-2 몫).
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) 44~57 행 — `getPrismaErrorCode` duck-typing precedent (실 `PrismaClientKnownRequestError` 인스턴스 생성 없이 `code` 만 추출). 본 helper 도 같은 방식으로 code 를 얻는다. **사본을 또 만들지 말고** 본 helper 안에 1 개만 두고, 기존 service 들의 사본 통합은 별도 위생 slice 로 남긴다.
- [src/assessment-evaluation/evaluation-result-persist.service.ts](../../src/assessment-evaluation/evaluation-result-persist.service.ts) 120~140 행 + 185~195 행 — "P2002 만 `ConflictException`, 그 외는 무차별 삼키지 않고 전파" 선례. 본 helper 의 **미매핑 → undefined** 규약이 이 선례와 동형이다.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) 185~200 행 — 복원 경로가 최종적으로 던지는 exception 종류 (`BadRequestException` 400 / `ConflictException` 409) 와 raw propagate 주석. 매핑 결과가 이 경계와 어긋나면 안 된다.
- [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 160~180 행 — "감싼 것이 아님" pin 단언. **본 task 에서 이 파일을 수정하지 않는다** — 배선이 없으므로 단언은 그대로 유효하다 (갱신은 3b-2c-2).
- [prisma/schema.prisma](../../prisma/schema.prisma) 55~62 행 (`Person.email @unique`) + 97~105 행 (`Group`) — 복원 경로에서 실제로 발생 가능한 제약 위반 종류 (P2002 unique / P2003 FK).
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) §2 (raw 미저장 invariant) + §3 (REPLACE atomic 복원) — 매핑 메시지가 raw payload 를 실을 수 없는 근거.

## Acceptance Criteria

- [ ] 신규 파일 2 개만 추가한다: [src/import/import-restore-error.ts](../../src/import/import-restore-error.ts) + colocated spec [src/import/import-restore-error.spec.ts](../../src/import/import-restore-error.spec.ts). 그 외 `src/` · `test/` · 설정 파일 **0 수정**.
- [ ] 파일 상단 주석에 chain 위치 (3b-2c-1) · 책임 (Prisma code → HTTP exception 매핑 **판정만**) · **하지 않는 것** (service 배선 0 · try/catch 0 · 로깅 0 · e2e 갱신 0 — 3b-2c-2 위임) · REQ-032 제약을 **14 행 이내** 로 적는다.
- [ ] **공개 계약** — 순수 함수 1 개를 export 한다: `toImportRestoreHttpException(error: unknown): HttpException | undefined`. 매핑 대상이면 새 exception 인스턴스를, 아니면 **`undefined`** 를 돌려준다 (throw 0 — 던질지 말지는 호출측 결정). 부수효과 0 · 입력 비변형 · Prisma / DB / NestJS DI 의존 0 (`@nestjs/common` exception 클래스 import 만).
- [ ] **매핑 표** — 코드 3 종만 매핑하고 표를 주석 1 개로 박제한다: `P2002` (unique 위반 — dump 가 이미 있는 행을 다시 넣음) → `ConflictException` 409, `P2003` (FK 위반 — 참조 대상 부재) → `BadRequestException` 400, `P2025` (대상 row 부재 — 복원 도중 경합) → `ConflictException` 409. 그 외 code (`P2028` 등) · code 없는 error · non-object · `null` / `undefined` 는 전부 **`undefined`** (매핑 0 → 호출측이 원본을 그대로 전파 → 500). 무차별 흡수 금지가 본 표의 핵심이다.
- [ ] **REQ-032 (raw 미노출)** — 반환 exception 의 메시지는 **본 helper 가 조립한 한국어 문구** 여야 한다. 원본 `error.message` · `meta.cause` · stack · plan payload · record `fields` 값을 메시지에 **싣지 않는다**. `meta.target` 이 `string[]` (컬럼명 목록) 인 경우에 한해 컬럼명만 문구에 포함할 수 있다 (값이 아니라 스키마 이름이므로 안전) — 그 외 형태의 `meta` 는 무시한다. 원본 error 를 `cause` 로 붙이지 않는다 (직렬화 경로로 Prisma 문구가 새는 것 차단).
- [ ] **happy-path unit test 1+** — 세 code 각각에 대해 (a) 반환이 `undefined` 가 아니고, (b) 기대한 exception 클래스이며, (c) `getStatus()` 가 409 / 400 / 409 이고, (d) 메시지가 한국어 안내라는 것을 단언한다. 반복 단언은 `it.each` 표 1 개로 압축한다.
- [ ] **error path unit test 1+** — 매핑 밖 입력에서 `undefined` 를 돌려주는지 단언한다: (a) `code: "P2028"` 같은 미매핑 Prisma code, (b) 평범한 `new Error("boom")`, (c) `null` / `undefined`, (d) `code` 가 문자열이 아닌 객체 (`{ code: 42 }`), (e) 문자열 · 숫자 같은 non-object. throw 0 임을 함께 단언한다 (`expect(() => ...).not.toThrow()`).
- [ ] **분기 cover** — 분기마다 1+: (a) code 추출 성공 + 매핑 적중, (b) code 추출 성공 + 매핑 미적중, (c) code 추출 실패, (d) `meta.target` 이 `string[]` → 컬럼명이 문구에 포함, (e) `meta` 부재 또는 `meta.target` 이 비-배열 → 컬럼명 없는 일반 문구.
- [ ] **negative cases 충분 cover** — 예외 분기마다 1+: (a) `meta.target` 안에 값처럼 보이는 문자열이 섞여 있어도 helper 는 그것을 **그대로 컬럼명으로 취급할 뿐** 원본 message 는 절대 싣지 않음 (message 누출 0 단언), (b) 원본 error 를 mutate 하지 않음 (호출 전후 deep-equal + `Object.isFrozen` 입력도 통과), (c) 같은 입력을 두 번 불러도 **매번 새 인스턴스** 이며 서로 영향 0 (공유 mutable 싱글턴 0), (d) 메시지에 `"leak-me"` marker 를 심은 `error.message` / `meta.cause` / `fields` 가 반환 문구 · `getResponse()` 직렬화 결과 어디에도 나타나지 않음 (REQ-032 회귀 차단), (e) prototype 오염성 입력 (`{ code: { toString: () => "P2002" } }`) 이 매핑을 우회하지 못함 → `undefined`.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일은 statement / branch / function / line **100%** 를 목표로 한다 (순수 함수라 달성 가능).
- [ ] `scripts/check-spec-presence.sh` 통과 (신규 `src/` 파일에 colocated spec 존재), `prettier --check` 통과.
- [ ] **diff 규율** — **총 diff ≤ 270 LOC / 2 파일**. 초과가 예상되면 임의로 넘기지 말고 negative (e) → (a) 순으로 덜어내고 그 사실을 PR body + 본 task Follow-ups 에 박제한다. 그래도 초과면 planner 에게 split 을 요청한다.

## Out of Scope

- **`ImportRestoreTransactionService` 배선** (`restore()` 에 try/catch 를 넣어 본 helper 를 호출) · 그 mock unit spec 갱신 · [test/e2e/import-restore-transaction.e2e-spec.ts](../../test/e2e/import-restore-transaction.e2e-spec.ts) 164 행 pin 단언 갱신 — 후속 slice **3b-2c-2**. 본 task 는 **호출처 0** 인 helper 만 만든다 (chain 의 기존 slice 들과 동일한 패턴).
- **`import.module.ts` provider 등록 · `import-job.service.ts` / `import.controller.ts` 재배선 · T-1254 interim false-success guard 교체 · HTTP / RBAC e2e** — 실행 slice **3c**.
- 기존 service 4 곳 (`import-job` / `export-job` / `evaluation-result-persist` / `summary-persist`) 의 `getPrismaErrorCode` 사본 통합 — 별도 위생 slice (본 task 는 자기 파일 안 1 개만 둔다).
- 매핑 대상 code 확장 (`P2028` transaction timeout → 504, `P1001` 연결 실패 → 503 등) · 재시도 정책 · 로깅 · 관측 metric — 별도 slice. 본 task 는 복원 경로에서 실제로 관측된 3 종만 닫는다.
- Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- 사용자 안내 문구의 i18n · 문구 카탈로그화 — 별도 slice.
- 성능 측정 · 대용량 dump 부하 — 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (예고) 실행 slice **3b-2c-2** — `ImportRestoreTransactionService.restore()` 가 본 helper 를 호출하도록 배선 (매핑되면 그 exception 을, 아니면 원본을 전파) + mock unit 갱신 + T-1276 e2e 의 "감싸지 않음" pin 단언을 "매핑된다" 로 의도적 갱신.
- (예고) 실행 slice **3c** — `import.module.ts` provider 등록 + `import-job.service.ts` / `import.controller.ts` 재배선 (T-1254 interim `markFailed` guard → 실 복원 pipeline) + import UI false-success 해소.
- (완료 기록) **자체 sub-limit 270 초과** — 실측 누적 **292 LOC / 2 파일**. round 1 은 266 LOC 로 sub-limit 이내였고, 초과분 26 LOC 는 전부 round 2 의 reviewer MINOR-1 / MINOR-2 대응 (CLAUDE.md §3 Nit-in-PR closure 가 본 PR 안 처리를 의무화한 4 종 중 test 추가 + 주석 정밀화) 이다. CLAUDE.md §3 cap (300 LOC / 5 파일) 이내이며 AC 52 행이 요구한 대로 PR body 에도 박제했다. 단언을 덜어내는 대신 pin test 를 `Object.defineProperty` 조립으로 압축해 negative cover 를 유지했다.
- (관측, PR #1168 reviewer MINOR-3) Prisma 실 `meta` 형태는 code 마다 다르다 — 컬럼명을 `target` 에 채우는 것은 사실상 `P2002` 뿐이고 `P2003` 은 `field_name`, `P2025` 는 `cause` 를 쓴다. 따라서 `columnHint` 의 컬럼명 접미사는 P2002 전용으로 동작하고 P2003 / P2025 는 항상 일반 안내로 떨어진다 (기능 결함 아님 — 안전측 fallback). 3b-2c-2 배선 후 실 error 표본으로 확인해, 필요하면 code 별 meta 독해 (`P2003` → `field_name`) 를 추가하는 별도 slice 를 연다.
