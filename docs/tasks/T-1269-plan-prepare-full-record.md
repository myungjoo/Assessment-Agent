---
id: T-1269
title: 복원 plan 준비 verdict 를 FullExportRecord 로 전파 (하류 leg 2/2)
phase: P5
status: DONE
prNumber: 1160
mergedAs: 592c672a
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 330
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1268]
touchesFiles:
  - src/import/import-restore-plan-prepare.ts
  - src/import/import-restore-plan-prepare.spec.ts
sizeExempt: true
exemptReason: "production 증분은 타입 표기 + import + 주석 동기 ~25 LOC 로 cap 안. 초과분은 전량 spec (직전 leg T-1268 실측 311 중 spec 294, T-1266 실측 342 중 spec 313)."
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 330 LOC, 선례 T-1268 실측 311 — 상류 타입 전파 leg 2/2 (하류 plan-prepare)"
---

# T-1269 — 복원 plan 준비 verdict 를 FullExportRecord 로 전파 (하류 leg 2/2)

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 **타입 전파 leg 마지막 조각**이다. T-1265 가 `hydrateImportDumpRecords` 를 `FullExportRecord[]` (= `ExportRecord` + `fields` payload) 로 좁혔고, T-1266 이 plan 을 `ImportRestorePlan<TInsert>` 로 일반화했고, 직전 T-1268 이 `prepareImportRestoreInput` 의 성공 갈래를 `FullExportRecord[]` 로 좁혔다. 그런데 그 세 조각을 합성하는 [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 만 아직 `plan: ImportRestorePlan` (기본 파라미터 = `ExportRecord`) 과 `records: ExportRecord[]` 로 **넓게 선언**돼 있어, chain 을 통과한 `fields` 가 여기서 다시 타입 상 사라진다.

본 slice 는 그 마지막 한 겹만 닫는다 — verdict 성공 갈래를 `plan: ImportRestorePlan<FullExportRecord>` + `records: FullExportRecord[]` 로 좁히고 (런타임 문장 변경 0 — 이미 그 값이 흐른다), 좁힘·넓힘 양방향 대입을 spec 으로 pin 한다. 이로써 다음 slice (실 `$transaction` 복원) 가 `plan.toInsert[i].fields` 를 캐스팅 없이 `createMany({ data })` 에 넣을 수 있다. 아울러 T-1268 reviewer NIT-4 가 지적한 **파일 상단 주석의 stale 표기** (5 행 "buffer → `ExportRecord[]` + version 판정") 를 같은 slice 에서 동기한다.

## Required Reading

- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) — 본 task 의 유일한 production 수정 대상. 실 변경 지점은 5 행 (stale 주석), 21~35 행 (import), 47~54 행 (`ImportRestorePlanPrepareResult`), 142 행 (`let plan` annotation) 뿐이다.
- [src/import/import-restore-plan-prepare.spec.ts](../../src/import/import-restore-plan-prepare.spec.ts) — colocated spec (본 task 의 test 추가 위치). 상단 `sampleDump` / `legacyDump` / `toBuffer` fixture 를 재작성하지 말고 재사용한다.
- [src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) 33~46 행 — 직전 leg 가 좁힌 상류 verdict (`records: FullExportRecord[]`). 본 slice 가 이어받을 근거.
- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) 39~55 행 / 114~120 행 — `ImportRestorePlan<TInsert extends ExportRecord = ExportRecord>` 정의와 `buildImportRestorePlan` 의 `TInsert` 추론. `toInsert` 만 파라미터화돼 있고 `toDelete` / `toKeep` 은 `ExportRecord[]` 고정임에 유의.
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) 23~30 행 — `FullExportRecord extends ExportRecord` 정의 (`fields` shape).
- [docs/tasks/T-1268-restore-input-full-record.md](T-1268-restore-input-full-record.md) — 직전 leg 의 타입-전용 slice 선례 (양방향 대입 pin 방식 + ts-jest diagnostics 로 spec 의 type error 가 곧 suite fail 이 되는 경로 + NIT-4 원문).

## Acceptance Criteria

- [ ] `ImportRestorePlanPrepareResult` 의 `ok: true` 갈래를 `plan: ImportRestorePlan<FullExportRecord>` + `records: FullExportRecord[]` 로 좁힌다. `FullExportRecord` 는 `../export/export-full-record` 에서 **type-only import** 한다. 왜 좁히는지 (다음 slice 의 `$transaction` 이 `plan.toInsert[i].fields` 를 캐스팅 없이 소비해야 함) 를 주석 1~2 줄로 남긴다. 142 행 `let plan: ImportRestorePlan` annotation 도 함께 좁힌다.
- [ ] **T-1268 reviewer NIT-4 동기** — 파일 상단 5 행 주석의 `prepareImportRestoreInput (buffer → ExportRecord[] + version 판정)` 표기를 현재 계약 (`FullExportRecord[]`) 에 맞게 고친다. 같은 문단에 stale 표기가 더 있으면 함께 동기한다 (주석만, 문장 재작성 금지).
- [ ] **런타임 동작 0 변경** — 단락 평가 4 단계, stage 분류 (`"deserialize" | "structure" | "version" | "records" | "mode" | "plan"`), issues 문구, throw 0 계약, idempotent 성질, 입력 (`buffer` / `existing` / `options`) 비변형이 모두 그대로다. 실행 문장 변경 0 (타입 표기 + import + 주석만).
- [ ] **다른 파일 0 수정** — `ExportRecord` 를 쓰는 기존 소비처 (`import-restore-ops.ts` / `import-restore-plan-summary` / `import-merge-conflict` 등) 를 한 줄도 고치지 않고 `pnpm build` 통과 (넓힘 대입 covariance 로 흡수).
- [ ] **happy-path unit test 1+** — 정상 dump buffer + `ImportMode.REPLACE` → `ok: true` 이고 `plan.toInsert[i].fields` 가 dump 원문 값과 동일하게 **끝까지 실려 나옴** 을 런타임 단언 (입력 순서 보존 포함). `MERGE` 로도 1+ (충돌 1 건 + 비충돌 1 건 fixture 로 `toInsert` / `toDelete` / `toKeep` 분류가 기존과 동일함까지).
- [ ] **타입 pin test 2+ (ts-jest diagnostics 활용)** — (a) 좁힘 방향: `ok: true` 갈래의 `plan` 을 `ImportRestorePlan<FullExportRecord>` 변수에, `records` 를 `FullExportRecord[]` 변수에 **type assertion 없이** 대입하고 `plan.toInsert[0].fields` 를 캐스팅 없이 읽는다. (b) 넓힘 방향: 같은 값들을 `ImportRestorePlan` (기본 파라미터) / `ExportRecord[]` 변수와 **인자 위치** 양쪽에 대입해 기존 소비처 배선이 깨지지 않음을 spec 이 먼저 잡게 한다. 두 pin 모두 런타임 단언을 동반해 vacuous 하지 않게 한다.
- [ ] **error path unit test 1+** — mode 매핑 실패 (`stage: "mode"`), 상류 입력 실패 (`"deserialize"` / `"structure"` / `"version"` / `"records"`), plan 산출 throw 흡수 (`stage: "plan"`) 가 각각 기존과 **동일한 stage 와 동일한 한국어 issues 배열** 로 돌아옴을 단언 (문구 회귀 pinning). 실패 갈래에는 `plan` / `records` 필드가 존재하지 않음도 단언.
- [ ] **분기 cover** — 4 분기 (mode 실패 / 입력 실패 / plan throw / 전부 통과) 각 1+ test. 추가로 단락 평가 실증: mode 실패 시 buffer 파싱이 시도되지 않음, 입력 실패 시 `buildImportRestorePlan` 이 호출되지 않음을 spy 로 단언.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+: (a) `fields` 없는 legacy dump → `"records"` stage 실패이며 부분 결과 미반환, (b) allow-list 밖 key 혼입 → 거부, (c) 빈 `records` 배열 (0 개) 경계에서 `ok: true` + `toInsert: []`, (d) 비-배열 `existing` / `Invalid Date` 원소 → `stage: "plan"` 으로 흡수 (throw 0), (e) enum 밖 mode (소문자 `"replace"` / `"PATCH"` / null / undefined / number / 객체) 각각 `stage: "mode"`, (f) version 이 `migrate` 판정이어도 차단하지 않고 `ok: true` + version 전달, (g) 입력 `buffer` / `existing` 을 호출 후 비교해 **비변형** 확인, (h) 같은 입력 2 회 호출 시 동일 결과 (idempotent) 이며 반환 배열은 서로 다른 instance, (i) issues 문자열에 `fields` 안 값이나 stack 이 실리지 않음 (REQ-032 정합).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1268 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.

## Out of Scope

- 실 `$transaction` 복원 실행 helper 신설 / Prisma client 호출 / `createMany` 배선 — 다음 slice.
- `import-restore-ops.ts` / `import-restore-steps.ts` / `import-restore-order.ts` 의 타입 파라미터화 — 이들은 기존 row (`ExportRecord`) 축이라 본 leg 의 대상이 아니다. 필요해지면 실행 slice 에서 판단.
- `ImportRestorePlan` 의 `toDelete` / `toKeep` 파라미터화 — T-1266 이 "`toInsert` 하나만 연다" 로 결정한 범위 유지.
- `buildImportRestorePlan` / `hydrateImportDumpRecords` 의 검증 규칙 변경 (allow-list · plain object 판정 · conflictKey 등) — source-of-truth 는 각 helper, 본 slice 는 재구현 0.
- controller 재배선 / `ExportController`·`ImportController` 신설 / DTO 변경 / Prisma schema 변경 · migration · 새 외부 dependency (0 건).
- legacy dump (`fields` 부재) 수용 정책 결정 — controller 배선 slice 이전 별도 판단 (T-1265 reviewer MINOR-3 이월).
- `describeUnknown` / `describeReceived` 사본 공용 module 추출 — 별도 refactor slice.
- raw NUL 보유 나머지 tracked 파일 정리 / 제어 바이트 금지 CI 가드 / `.gitattributes` 대안 — 별도 위생 slice (T-1267 Follow-ups).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- T-1268 reviewer NIT-5 (비차단 이월) — [src/import/import-restore-input.spec.ts](../../src/import/import-restore-input.spec.ts) fixture helper 의 `entity in entityCounts` 를 `Object.prototype.hasOwnProperty.call(entityCounts, entity)` 로 바꾸면 prototype chain key (`toString` 등) 오탐을 피할 수 있다. 본 task 의 touchesFiles 밖이라 별도 위생 slice 에서 처리.
- reviewer round 1 NIT-1 (비차단) — 본 spec 의 `dumpWithRecords` fixture helper 가 [src/import/import-restore-input.spec.ts](../../src/import/import-restore-input.spec.ts) / [src/import/import-dump-records-hydrate.spec.ts](../../src/import/import-dump-records-hydrate.spec.ts) 의 동형 helper 와 거의 같은 3 번째 사본이다. 본 사본은 T-1268 NIT-5 권고대로 `Object.prototype.hasOwnProperty.call` 을 이미 쓰고 있어 조치 불요지만, 사본 간 판정 규칙 drift 전에 test fixture 공용 module 추출을 별도 위생 slice 로 잡아두는 편이 좋다.
- reviewer round 1 MINOR-1 (비차단, planner 앞) — 실측 +344 가 사전 정당화치 `estimatedDiff: 330` 을 약 4% 초과했다. 초과분이 전량 spec 이라 머지를 막지 않았으나, 본 chain 이 3 slice 연속 cap-bend 중이므로 다음 slice (실 `$transaction` 실행) 는 production 비중이 커질 것을 감안해 planner 가 estimate 를 spec 실측 기반으로 재보정할 것.
- reviewer round 1 NIT-2 / NIT-3 (조치 불요) — 상류 stage pinning 의 self-consistency 성격 (문구 회귀는 상류 spec 이 잡고, `records` stage · allow-list 위반은 리터럴로도 고정돼 실질 공백 0), 넓힘 test 의 `sizeOf === 7` magic number (같은 test 안에서 분류가 함께 단언됨).

## 결과 요약 (2026-07-27)

- PR [#1160](https://github.com/myungjoo/Assessment-Agent/pull/1160) squash merge (`592c672a`). reviewer round 1 APPROVE (BLOCKER 0 / MAJOR 0 / MINOR 1 / NIT 3) — reviewer 가 §3 nit-in-PR closure 4 종 (test 추가 / style / typo / describe 명확화) 해당 없음을 명시 판정해 round 2 없이 마감.
- 실측 +344/-4, 2 파일. production 증분은 `import type { FullExportRecord }` 1 줄 + verdict 성공 갈래 타입 표기 + 142 행 `let plan` annotation + 상단 주석 stale 동기 (T-1268 NIT-4 회수) 뿐이며 실행 문장 변경 0, 하류 파일 0 수정 (배열 covariance + generic 추론 흡수).
- 4-게이트 (reviewer APPROVE + PR comment 외부 1 건 + integrator 자체 점검 6 항목 + CI green) 모두 통과. ADR-0036 §D8(c): head 가 origin/main `41703f1a` 를 미포함이라 `gh pr update-branch` 로 갱신 (새 head `f9b3108d`) 후 재-CI (run 30295865038) green 재확인하고 머지.
