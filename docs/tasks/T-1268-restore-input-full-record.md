---
id: T-1268
title: 복원 입력 verdict 의 records 타입을 FullExportRecord[] 로 좁힘
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 350
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1267]
touchesFiles:
  - src/import/import-restore-input.ts
  - src/import/import-restore-input.spec.ts
sizeExempt: true
exemptReason: "production 증분은 타입 표기 + 주석 ~30 LOC 로 cap 안. 초과분은 전량 spec (동일 chain 선례 T-1266 실측 342 중 spec 313)."
plannerNote: "cap-bend pre-justified: R-112 backbone x 1.5 = 350 LOC, 선례 T-1266 실측 342 — 상류 타입 전파 leg 1/2 (input)"
---

# T-1268 — 복원 입력 verdict 의 records 타입을 FullExportRecord[] 로 좁힘

## Why

[ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 의 **상류 타입 전파 leg** 첫 조각이다. T-1265 가 `hydrateImportDumpRecords` 를 `FullExportRecord[]` (= `entity` + `instant` + **`fields` payload**) 로 좁혔고 T-1266 이 하류 plan 을 `ImportRestorePlan<TInsert>` 로 일반화했는데, 그 사이에 낀 `prepareImportRestoreInput` 만 아직 `records: ExportRecord[]` 로 **넓게 선언**돼 있다 ([src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) 38 행). 런타임에는 `fields` 가 실려 흐르지만 타입 경계에서 사라지므로, 실 `$transaction` 실행 slice 가 `createMany({ data })` 에 넣을 row 값을 타입 상 볼 수 없다.

본 slice 는 그 한 겹만 닫는다 — verdict 성공 갈래의 `records` 타입을 `FullExportRecord[]` 로 좁히고 (런타임 문장 변경 0 — `hydrated.records` 가 이미 그 값), 좁힘·넓힘 양방향 대입을 spec 으로 pin 한다. 하류 `import-restore-plan-prepare.ts` 전파는 **다음 slice** 로 남긴다.

## Required Reading

- [src/import/import-restore-input.ts](../../src/import/import-restore-input.ts) — 본 task 의 유일한 production 수정 대상. 16 행 import 와 38 행 `records: ExportRecord[]` 가 실 변경 지점.
- [src/import/import-restore-input.spec.ts](../../src/import/import-restore-input.spec.ts) — colocated spec (본 task 의 test 추가 위치). 상단 `sampleDump` fixture 가 이미 `fields` 를 담고 있으니 재작성하지 말고 재사용한다.
- [src/import/import-dump-records-hydrate.ts](../../src/import/import-dump-records-hydrate.ts) 51~53 행 — 상류 verdict 가 이미 `FullExportRecord[]` 임을 확인할 근거.
- [src/export/export-full-record.ts](../../src/export/export-full-record.ts) 23~30 행 — `FullExportRecord extends ExportRecord` 정의 (`fields` 필드 shape).
- [src/import/import-restore-plan-prepare.ts](../../src/import/import-restore-plan-prepare.ts) 47~54 행 / 142~147 행 — 유일한 하류 소비처. 본 slice 로 **수정 없이** 계속 compile 돼야 하는 대상 (넓힘 대입 covariance).
- [docs/tasks/T-1266-restore-plan-generic.md](T-1266-restore-plan-generic.md) — 직전 leg 의 타입-전용 slice 선례 (양방향 대입 pin 방식 + ts-jest diagnostics 로 type error 가 suite fail 이 되는 경로).

## Acceptance Criteria

- [ ] `ImportRestoreInputResult` 의 `ok: true` 갈래를 `records: FullExportRecord[]` 로 좁힌다. `FullExportRecord` 는 `../export/export-full-record` 에서 **type-only import** 한다. 왜 좁히는지 (하류 `$transaction` 이 `fields` 를 봐야 함) 를 주석 1~2 줄로 남긴다.
- [ ] **런타임 동작 0 변경** — 단락 평가 3 단계, stage 분류 (`"deserialize" | "structure" | "version" | "records"`), issues 전달, throw 0 계약, idempotent 성질, 입력 비변형이 모두 그대로다. 실행 문장 변경 0 (타입 표기 + import + 주석만).
- [ ] **다른 파일 0 수정** — `import-restore-plan-prepare.ts` 를 포함해 어떤 소비처도 고치지 않고 `pnpm build` 통과 (넓힘 대입 covariance 로 흡수).
- [ ] **happy-path unit test 1+** — 정상 dump buffer → `ok: true` 이고 `records[i].fields` 가 dump 원문 값과 동일하게 **끝까지 실려 나옴** 을 런타임 단언 (5 entity 혼합 fixture, 입력 순서 보존 포함).
- [ ] **타입 pin test 2+ (ts-jest diagnostics 활용)** — (a) 좁힘 방향: `ok: true` 갈래의 `records` 를 `FullExportRecord[]` 변수에 **type assertion 없이** 대입, (b) 넓힘 방향: 같은 값을 `ExportRecord[]` 변수와 `ExportRecord[]` 인자 위치에 대입 (하류 배선이 깨지지 않음을 spec 이 먼저 잡도록). 두 pin 모두 런타임 단언을 동반해 vacuous 하지 않게 한다.
- [ ] **error path unit test 1+** — screening 실패 (비-Buffer / 손상 JSON / 구조 위반 / 호환 불가 version) 와 hydrate 실패 (`records` stage) 각각이 기존과 **동일한 stage 와 동일한 한국어 issues 배열** 로 돌아옴을 단언 (문구 회귀 pinning). 실패 갈래에는 `records` 필드가 존재하지 않음도 단언.
- [ ] **분기 cover** — 3 분기 (screening 실패 → 그대로 전달 / hydrate 실패 → `"records"` stage / 전부 통과) 각 1+ test, 그리고 screening 실패 시 hydrate 가 **호출되지 않음** (단락 평가) 을 spy 로 단언.
- [ ] **negative cases 충분 cover** — 예외·경계 분기마다 1+: (a) `fields` 가 없는 legacy dump record → `"records"` stage 실패이며 부분 결과 미반환, (b) allow-list 밖 key (`apiKey` 등) 혼입 → 거부, (c) 빈 `records` 배열 (0 개) 경계에서 `ok: true` + `records: []`, (d) version 이 `migrate` 판정이어도 **차단하지 않고** `ok: true` + version 전달, (e) 입력 buffer 를 호출 후 비교해 **비변형** 확인, (f) 같은 buffer 2 회 호출 시 동일 결과 (idempotent) 이며 반환 배열은 서로 다른 instance, (g) `fields` 안 값 (nested object / Date / null) 이 **identity 보존** 되어 전달됨, (h) issues 문자열에 `fields` 안 값이나 stack 이 실리지 않음 (REQ-032 정합).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1267 동형).
- [ ] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.

## Out of Scope

- 하류 `src/import/import-restore-plan-prepare.ts` 의 타입 전파 (`ImportRestorePlanPrepareResult.plan` 을 `ImportRestorePlan<FullExportRecord>` 로, `records` 를 `FullExportRecord[]` 로) — **다음 slice**. 본 slice 는 상류 한 겹만.
- `import-restore-ops.ts` / `import-restore-steps.ts` 의 하류 타입 전파, 실 `$transaction` 실행 helper, merge mode 의 delete 타게팅, controller 재배선 — chain 잔여 leg 전부.
- `hydrateImportDumpRecords` 의 검증 규칙 변경 (allow-list · plain object 판정 등) — source-of-truth 는 그 helper 이며 본 slice 는 재구현 0.
- legacy dump (`fields` 부재) 수용 정책 결정 — controller 배선 slice 이전 별도 판단 (T-1265 reviewer MINOR-3 이월).
- raw NUL 보유 나머지 tracked 파일 9 개 정리 / 제어 바이트 금지 CI 가드 / `.gitattributes` 대안 — 별도 위생 slice (T-1267 Follow-ups).
- `describeReceived` / `describeFieldsKind` 4 사본 공용 module 추출 — 별도 refactor slice.
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
