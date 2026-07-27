---
id: T-1261
title: Import 복원 FK 안전 실행 순서 helper (insert 순서 상수 + phase 별 정렬)
phase: P5
status: DONE
completedAt: 2026-07-27T11:28:00Z
prNumber: 1152
mergeCommit: dbbd0c88
reviewRounds: 2
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1260]
touchesFiles:
  - src/import/import-restore-order.ts
  - src/import/import-restore-order.spec.ts
sizeExempt: true
exemptReason: R-112 backbone (production ~80 + spec ~240, 실측 spec:production 3:1) — 본 chain 최근 4 slice 실측 289/398/432/639 대비 최소 규모이며 2 파일 유지. 20 LOC 초과분은 spec 밀도 때문. **실측 갱신 (2026-07-27, reviewer round 2 MINOR-1 반영)**: production 106 / spec 489 (round 2 nit-closure +221 포함) / 총 595 — 위 근거 320 의 약 1.9 배. nit-closure 분량이 추정 밖이었던 것이 초과의 주 원인이며, estimate-model.md sub-multiplier 후속에 합산 대상.
plannerNote: P5 ADR-0055 §Follow-up(b) 일곱 번째 slice — $transaction 복원의 FK 안전 실행 순서만 순수 상수+정렬로 분리 (그룹핑/DB 는 다음 slice)
---

# T-1261 — Import 복원 FK 안전 실행 순서 helper (insert 순서 상수 + phase 별 정렬)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → 복원 plan 산출 → **FK 안전 실행 순서** → [ADR-0044](../decisions/ADR-0044-export-import-job-persistence.md) §3 atomic `$transaction` 복원 → controller 재배선) 의 **일곱 번째 slice** 다. 직전 slice (T-1260) 로 업로드 buffer 하나에서 `ImportRestorePlan` (`toDelete` / `toInsert` / `toKeep`) 까지 산출하는 단일 계약이 생겼지만, 그 plan 을 실제 `$transaction` 으로 옮기려면 **어느 entity 부터 지우고 어느 entity 부터 넣을지** 가 먼저 정해져야 한다 — `Assessment.personId` 가 `Person` 을 가리키는 필수 FK (`prisma/schema.prisma` L307, `onDelete: Cascade`) 라서 삽입은 `Person` 이 먼저, 삭제는 `Assessment` 가 먼저여야 부분 실패 없이 all-or-nothing 이 성립한다. 본 task 는 그 **실행 순서 한 겹만** 순수 상수 + 정렬 함수로 박제해, 다음 slice (plan → entity 별 operation 그룹핑) 와 그 다음 slice (실 `$transaction`) 가 순서를 재추론하지 않게 한다. 순서는 `prisma/schema.prisma` 의 relation 사실에서 도출한 파생물이라 새 정책 결정 0 (ADR 신설·amend 불요). REQ-030 (Import) / REQ-032 (raw 미저장) 을 cover 한다.

## Required Reading

- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) 16~29·58~65 행 — `ExportEntity` union 5 literal (`Assessment` / `Person` / `Group` / `LlmConfig` / `AuditLog`) 과 `VALID_EXPORT_ENTITIES` 상수. 본 helper 가 정렬 대상으로 재사용하며 **새 union 신설 0**. 수정 0.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 29~39·89~99 행 — `ImportRestorePlan` 의 3 배열 의미와 `buildImportRestorePlan` 의 **throw 계약** (`TypeError` / `RangeError` + 한국어 메시지 convention). 본 helper 가 mirror 할 throw 계약·메시지 톤의 정본. 호출·수정 0. (git 이 binary 로 표시할 수 있다 — Read 도구 사용.)
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 1~55 행 — 직전 slice 의 header 주석 구성 (chain 위치 명시 + 순수·non-mutating 선언 + REQ-032 정합 문단). 본 helper 의 header 가 mirror 할 서술 패턴. 호출·수정 0.
- `prisma/schema.prisma` 55~59·294~308·406~412·513~522 행 — 5 export entity 중 FK 사실: `Assessment.personId → Person` (필수 FK, `onDelete: Cascade`) 만이 5 entity 사이의 유일한 직접 FK 이고, `Group` ↔ `Person` 은 join entity (`PersonGroupMembership`, export 대상 아님) 경유라 직접 FK 0, `LlmProviderConfig` / `PermissionDeniedRecord` 는 나머지 넷과 FK 0. `Person.partId → Part` 의 `Part` 는 export 5 entity 밖이라 본 순서의 고려 대상이 아니다 (주석에 명시). 수정 0.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) §3·§6 — `$transaction` all-or-nothing 불변식과 `ExportEntity` → Prisma model 매핑표. 본 helper 는 §3 의 실행 전제 (순서) 만 담당하고 §6 매핑 (delegate 이름) 은 건드리지 않는다.

## Acceptance Criteria

- [ ] `src/import/import-restore-order.ts` 신설 — 다음 2 심볼을 export 한다.
      (1) `IMPORT_RESTORE_INSERT_ORDER: ReadonlyArray<ExportEntity>` — FK 안전 **삽입** 순서 `["Person", "Group", "LlmConfig", "AuditLog", "Assessment"]`. 5 entity 를 빠짐없이 정확히 1 번씩 담고, `Person` 이 `Assessment` 보다 앞선다는 것이 유일한 FK 제약이며 나머지 상대 순서는 결정론적 고정값임을 주석에 명시한다. 상수는 동결 (`Object.freeze`) 하고 `Record`/`ReadonlyArray` 타입으로 새 entity 추가 시 누락이 드러나도록 한다.
      (2) `orderImportRestoreEntities(entities: ReadonlyArray<ExportEntity>, phase: "insert" | "delete"): ExportEntity[]` — 주어진 entity 집합을 phase 순서로 정렬한 **새 배열** 로 돌려준다. `phase: "insert"` 는 위 상수 순서, `phase: "delete"` 는 그 **정확한 역순** (역순 배열을 손으로 다시 적지 않고 상수에서 파생 — DRY). 입력 중복은 제거 (같은 entity 는 1 번만), 입력에 없는 entity 는 결과에도 없다.
- [ ] 입력 방어는 sibling `buildImportRestorePlan` 과 **동형 throw 계약** (한국어 메시지): `entities` 가 배열이 아니면 `TypeError`, 원소가 5 literal 밖 값 (비-string / 오타 / 소문자 / null / 숫자) 이면 그 index 를 메시지에 담은 `RangeError`, `phase` 가 `"insert"`/`"delete"` 밖이면 `RangeError`. 상류 (`prepareImportRestorePlan`) 가 이미 verdict 로 걸러낸 입력을 받는 위치라 verdict wrapper 를 한 겹 더 두지 않고 throw 계약을 택했음을 header 주석에 명시한다 (흡수는 하류 `$transaction` slice 책임).
- [ ] 순수·non-mutating — 입력 `entities` 배열 변형 0, 반환 배열은 항상 새 배열, 모듈 상수는 호출로 변하지 않는다. DB · Prisma client · repository · `$transaction` · file I/O · REST 배선 0 (`@prisma/client` import 0). plan 산출·mode 매핑·delegate 이름 매핑 등 인접 helper 규칙 재구현 0 — 본 helper 는 **순서** 만 담당한다 (DRY).
- [ ] **Happy-path unit test 1+**: `IMPORT_RESTORE_INSERT_ORDER` 가 5 entity 를 정확히 1 번씩 담고 `VALID_EXPORT_ENTITIES` 와 집합이 같다 (누락·중복 0), `Person` index < `Assessment` index. `orderImportRestoreEntities` 가 뒤섞인 5 entity 입력을 insert 순서로 정렬하고, 같은 입력을 `"delete"` 로 부르면 정확히 그 역순을 돌려준다. 부분 집합 입력 (예: `["Assessment", "Person"]`) 도 두 phase 각각 올바른 순서.
- [ ] **Error path unit test 1+**: `entities` 가 배열 아님 (`null` / `undefined` / 문자열 / 객체) → `TypeError`, 원소가 `"person"` (소문자) / `"Part"` / `""` / `null` / `42` / 객체 → index 를 담은 `RangeError`, `phase` 가 `"upsert"` / `""` / `undefined` / `null` / 숫자 → `RangeError`. 각 메시지가 한국어이고 함수명을 포함한다.
- [ ] **분기 cover**: (1) `phase: "insert"` / (2) `phase: "delete"` / (3) 빈 배열 입력 (두 phase 모두 빈 배열 반환, error 아님) / (4) 중복 원소 입력 (dedupe) / (5) 배열 방어 실패 / (6) 원소 방어 실패 / (7) phase 방어 실패 — 모든 분기 각 1+ test.
- [ ] **Negative cases 충분 cover** — 각 1+ test: 입력 배열이 호출 후 변형되지 않음 (길이·원소 동일, `Object.freeze` 된 배열로 호출해도 통과), 반환 배열이 입력 배열과 다른 참조이고 반환 배열을 변형해도 모듈 상수가 오염되지 않음 (두 번째 호출 결과 동일 — idempotent), 상수 자체를 변형하려는 시도 (`push` / index 대입) 가 원본을 바꾸지 못함, 원소 방어 실패 시 **앞쪽 유효 원소가 이미 정렬돼 있어도 부분 결과를 돌려주지 않고 throw** 함, 중복 + 부분 집합 + 역순 입력이 섞인 조합에서도 결과가 상수 순서의 부분 수열임.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 파일 2종은 line / branch / function 100% 목표.
- [ ] 새 외부 dependency 0 — `package.json` 변경 없음. Prisma schema 변경 0.

## Out of Scope

- `ImportRestorePlan` → entity 별 operation 그룹 (`{ entity, instants }` 묶음) 산출 — **다음 slice**. 본 task 는 순서만 다루며 `ImportRestorePlan` 을 import 하지도 않는다.
- `ExportEntity` → Prisma delegate 이름 매핑 (ADR-0044 §6, 현재 `src/export/export-job.service.ts` 의 private `EXPORT_ENTITY_SOURCES`) 의 공용 module 추출·재사용 — 별도 slice (본 task 는 delegate 이름을 알 필요가 없다).
- ADR-0044 §3 atomic `$transaction` 복원 실행 (deleteMany / createMany / Prisma repository / row ↔ entity 매핑), `import.controller.ts` interim guard (T-1254) 교체, `ImportJobService` 변경 — 후속 slice. 본 helper 는 어디에도 배선하지 않는다 (caller 0 인 채 머지).
- 기존 helper (`buildImportRestorePlan` / `prepareImportRestorePlan` / `selectExportRecords` / `export-job.service.ts`) 의 signature·본문 수정, ADR 신설·amend (순서는 schema relation 사실의 파생이라 새 결정 0 — 필요 시 follow-up).
- export 5 entity 밖 model (`Part` / `PersonGroupMembership` / `Contribution` / `DifficultyMapping`) 의 순서 처리, cascade 동작 검증, e2e / smoke spec, `docs/architecture/*` 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-1258 reviewer round 2 지적, T-1259 · T-1260 미회수 이월) [src/export/import-dump-validate.ts](../../src/export/import-dump-validate.ts) 53 행 주석 / 93 행 issue 메시지가 `generatedAt` 을 "ISO 파싱 가능한 string" 이라고 표현하지만 실제 판정은 `new Date(value)` 기준이라 ISO 8601 이 아닌 형식 (RFC 2822 등) 도 통과한다 — 문구 부정확. comment / 메시지 문구만 정정하는 fix 로 회수 (해당 spec 의 문구 assertion 동반 갱신 필요, 2 파일). 인접 slice 의 PR nit-closure 로 흡수하거나 별도 소형 task 로 큐잉.
- (T-1260 reviewer 권고) planner 의 `estimatedDiff` 산정 heuristic — 본 chain 실측 spec:production 비율이 대략 3:1 이라 production 120 LOC 초과 slice 는 총 diff 가 cap 을 넘는다. 본 task 부터 production ≤ ~80 LOC 로 쪼개 적용 중이며, 누적 3 회차 실측 후 `docs/architecture/estimate-model.md` 에 sub-multiplier 로 박제.
- ADR-0055 §Follow-up (b) 잔여 slice = plan → entity 별 operation 그룹핑 → delegate 매핑 공용화 → ADR-0044 §3 `$transaction` 복원 엔진 → controller interim guard 교체 재배선.
- (본 task reviewer round 1 NIT-1) `orderImportRestoreEntities` 의 `"insert" | "delete"` union 을 named type (`ImportRestorePhase`) 으로 export 해 다음 slice 들이 손으로 재선언하지 않게 한다 — sibling `ImportRestoreMode` ([src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 25 행) 패턴 정합. production 변경이라 본 PR nit-closure 4 종 밖이므로 다음 slice 에서 흡수.
- (본 task reviewer round 2 NIT-1) [src/import/import-restore-order.spec.ts](../../src/import/import-restore-order.spec.ts) 의 `ENTITY_TO_PRISMA_MODEL` 은 `src/export/export-job.service.ts` private `EXPORT_ENTITY_SOURCES` 의 손복사본이라 매핑이 다른 model 로 바뀌면 조용히 drift 한다. delegate 매핑 공용 module 추출 slice 의 acceptance 에 "본 spec 이 공용 상수를 import 하도록 전환" 을 포함한다.
- (본 task reviewer round 2 MINOR-1) 위 T-1260 권고의 estimate heuristic 후속에 본 회차 실측 합산 — production 106 / spec 489 / 총 595, `sizeExempt` 근거 320 의 약 1.9 배. **nit-closure 분량 (+221) 이 추정 밖이었던 것이 초과의 주 원인** 이므로 sub-multiplier 박제 시 "nit-closure 예상 분량도 estimatedDiff 에 포함" 항목을 함께 넣는다.
