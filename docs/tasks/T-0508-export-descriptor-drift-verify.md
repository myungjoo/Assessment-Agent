---
id: T-0508
title: ADR-0046 Decision §3 descriptor single-source — descriptor.byteSizeHint 와 실 직렬화 byte / plan.totalBytes 의 drift 를 검증하는 순수 함수 verifyExportDumpDescriptorDrift 신설
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 225
estimatedFiles: 2
created: 2026-06-19
independentStream: uc07-export-import-helpers
dependsOn: []
touchesFiles:
  - src/export/export-descriptor-drift-verify.ts
  - src/export/export-descriptor-drift-verify.spec.ts
hqOrigin: null
plannerNote: "P7 ADR-0046 §Decision 3 descriptor single-source 강제 — backlogNote chain 의 'descriptor-actual drift verifier'. 순수 helper+spec, dep 0, dependsOn []."
---

# T-0508 — descriptor.byteSizeHint 와 실 직렬화 byte / plan.totalBytes 의 drift 를 검증하는 순수 함수 verifyExportDumpDescriptorDrift

## Why

머지된 [ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md)(b718bb8) Decision §3 invariant 박제는 다음을 요구한다: "**descriptor single-source** — 다운로드 메타(fileName / contentType / Content-Length / Content-Disposition)는 [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 산출물을 그대로 직렬화 — controller 가 헤더값을 새로 계산하지 않는다(drift 0)". 또 §Decision 1 은 descriptor 의 `byteSizeHint = Buffer.byteLength(JSON.stringify(dump), "utf8")` 가 곧 materialization 의 직렬화 방식임을 박제했다 — 즉 descriptor 의 hint, 실 materialization 의 byte length, 그리고 chunk plan 의 `totalBytes` 셋이 모두 같은 값이어야 한다는 invariant 가 성립한다.

직전 chain 은 [materializeExportDump](../../src/export/export-dump-materialize.ts)(T-0506, 08a010f)와 [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507) 이 직렬화·byte slice piece 를 박제했고, T-0507 은 자기 안에서 `Buffer.byteLength(serialized) === plan.totalBytes` 만 강제했다. 그러나 **descriptor 의 `byteSizeHint` 가 실 직렬화 byte / plan.totalBytes 와 어긋나는지(stale descriptor 가 잘못된 Content-Length 헤더를 만드는 drift)** 를 controller/service 가 배선 전에 사전 검증하는 순수 helper 는 33+ helper 중 0회 cover 된 gap 이다(`git grep verifyExportDumpDescriptor|DescriptorDrift|descriptorByteDrift src/export` → 0 매칭, main 미박제 확인). 본 task 는 그 gap 을 **순수 함수 1개** 로 닫는다 — `ExportArtifactDescriptor` + `ExportDump`(+ 선택적 `ExportChunkPlan`)를 받아 hint·실 byte·plan.totalBytes 의 일치 여부와 drift 수치를 derive 하는 pure helper. controller/service/repository/stream pipe 배선은 후속 task 책임([UC-07 §5 step13 / §8 NFR](../use-cases/UC-07-export-import.md), REQ-030 다운로드 / REQ-032 raw 미저장).

## Required Reading

- `docs/decisions/ADR-0046-export-dump-materialization-storage.md` — 특히 Decision §1 (`byteSizeHint = Buffer.byteLength(JSON.stringify(dump), "utf8")` 가 곧 materialization 직렬화 방식) + Decision §3 invariant ("descriptor single-source / drift 0", chunk helper 산정값만 소비 — 재계산 금지).
- `src/export/export-artifact-descriptor.ts` — `ExportArtifactDescriptor` interface (입력 1, 새 타입 신설 금지 — import 재사용) + `estimateByteSize`(L104~110) 가 `Buffer.byteLength(JSON.stringify(dump), "utf8")` 으로 hint 를 산정하는 방식(본 helper 의 "실 byte" 산정과 정확히 같은 방식이어야 drift 판정이 의미를 가짐).
- `src/export/export-dump.ts` — `ExportDump` interface (입력 2, 새 타입 신설 금지 — import 재사용).
- `src/export/export-chunk-plan.ts` — `ExportChunkPlan` interface (선택적 입력 3, 새 타입 신설 금지 — import 재사용). 특히 `totalBytes` 필드.
- `src/export/export-dump-chunk-slice.ts` (T-0507) — `Buffer.byteLength(serialized) === plan.totalBytes` invariant 를 자기 안에서 강제하는 패턴 + 한국어 `TypeError`/`RangeError` convention + `isPlainObject`/입력 방어 골격(mirror 대상).

## Acceptance Criteria

- [ ] `src/export/export-descriptor-drift-verify.ts` 에 순수 함수 `verifyExportDumpDescriptorDrift(descriptor: ExportArtifactDescriptor, dump: ExportDump, plan?: ExportChunkPlan): ExportDumpDescriptorDriftReport` 를 신설한다. 반환 타입 `ExportDumpDescriptorDriftReport` 는 `{ consistent: boolean; hintBytes: number; actualBytes: number; planTotalBytes: number | null; hintActualDelta: number; hintPlanDelta: number | null; headline: string }` 한 종류로 export. `ExportArtifactDescriptor` 는 `./export-artifact-descriptor`, `ExportDump` 는 `./export-dump`, `ExportChunkPlan` 는 `./export-chunk-plan` 에서 import — 새 타입 신설은 `ExportDumpDescriptorDriftReport` 만, 새 외부 dependency 0 (Node 내장 `Buffer`/`JSON` 만).
- [ ] 구현은 다음을 강제한다: (a) `actualBytes = Buffer.byteLength(JSON.stringify(dump), "utf8")` 로 산정 ([estimateByteSize](../../src/export/export-artifact-descriptor.ts) L104~110 과 정확히 같은 직렬화 방식 — drift 판정의 전제), (b) `hintBytes = descriptor.byteSizeHint`, (c) `hintActualDelta = hintBytes - actualBytes`, (d) `plan` 제공 시 `planTotalBytes = plan.totalBytes` / `hintPlanDelta = hintBytes - planTotalBytes`, `plan` 미제공 시 둘 다 `null`, (e) `consistent = (hintActualDelta === 0) && (plan 미제공 ? true : hintPlanDelta === 0)`. 입력 객체·중첩 구조를 변형하지 않고(non-mutating — freeze 된 입력 통과) 새 report 객체를 반환한다.
- [ ] 입력 방어: (a) `descriptor` 가 plain object 아님(null / undefined / 숫자 / 문자열 / 배열) → 한국어 `TypeError`(`verifyExportDumpDescriptorDrift: descriptor 는 ...` 형태). (b) `descriptor.byteSizeHint` 가 비-음수 정수 아님(음수 / 소수 / NaN / Infinity / 비-number) → 한국어 `TypeError`. (c) `dump` 가 plain object 아님 → 한국어 `TypeError`. (d) `plan` 이 제공됐는데 plain object 아님 → 한국어 `TypeError`. (e) `plan` 제공됐는데 `plan.totalBytes` 가 비-음수 정수 아님 → 한국어 `TypeError`. (drift 자체는 throw 가 아니라 `consistent: false` 로 보고 — 검증 helper 는 판정만, throw 결정은 후속 controller 책임.)
- [ ] **Happy-path unit test 1+** — (a) [buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 로 만든 실 descriptor + 같은 dump → `consistent: true`, `hintActualDelta: 0`, `planTotalBytes: null` 검증. (b) plan 도 제공(plan.totalBytes === actualBytes) → `consistent: true`, `hintPlanDelta: 0`. (c) 멀티바이트 한글 record 포함 dump 도 hint·actual 일치 검증(UTF-8 byte 정확성).
- [ ] **Error path unit test 1+** — (a) `descriptor` 비-object(null / 숫자 / 배열) → `TypeError`. (b) `descriptor.byteSizeHint` 음수 / NaN / 소수 → `TypeError`. (c) `dump` 비-object → `TypeError`. (d) `plan` 제공됐는데 비-object → `TypeError`. (e) `plan.totalBytes` 비-음수정수 아님 → `TypeError`.
- [ ] **분기마다 test 분리 (branch coverage)** — (i) 입력 방어 분기(각 throw), (ii) plan 미제공 분기(`planTotalBytes: null` / `hintPlanDelta: null` / consistent 는 hint-actual 만으로 판정), (iii) plan 제공 + 전부 일치 분기(`consistent: true`), (iv) hint≠actual drift 분기(`consistent: false`, delta≠0), (v) hint===actual 이나 plan.totalBytes 어긋남 분기(`consistent: false`, `hintPlanDelta`≠0) 각 1+ test.
- [ ] **Negative cases 충분 cover** — (a) stale descriptor: `byteSizeHint` 가 실 byte 보다 작음 → `consistent: false`, `hintActualDelta` 음수. (b) stale descriptor: `byteSizeHint` 가 실 byte 보다 큼 → `consistent: false`, `hintActualDelta` 양수. (c) plan.totalBytes 가 hint 와 어긋남(hint===actual 이나 plan stale) → `consistent: false`. (d) `byteSizeHint: 0` + 빈 envelope 의 실 byte > 0 → `consistent: false`(0 hint 도 정상 number 라 throw 아님, drift 보고). (e) **non-mutating** — `Object.freeze(descriptor)` + `Object.freeze(dump)` + `Object.freeze(plan)` 로 호출해도 throw 0 + 결과 정확. (f) **결정성** — 동일 입력 2회 호출의 결과가 모든 필드까지 동일. (g) `headline` 이 `consistent` true/false 각 경우에 적절한 한국어 요약(일치 시 "일치", 불일치 시 delta 수치 포함) 을 담는지 1+ test.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — colocated spec `src/export/export-descriptor-drift-verify.spec.ts` 로 작성.

## Out of Scope

- drift 발견 시 실 `throw` / HTTP 400·409 응답 / 헤더 보정 — 후속 controller task. 본 helper 는 `consistent` boolean + delta 수치 보고만(판정 layer, 강제 layer 아님).
- 실 `Readable` stream / Content-Length·Content-Range 헤더 직렬화 — 후속 task (ADR-0046 §Decision 1 맞물림 (ii)). 본 task 는 byte 일치 검증만.
- chunk 단위 직렬화 / chunk 별 drift 검증 — 본 task 는 전체 dump 의 hint vs actual vs plan.totalBytes 만. chunk 별 byte slice 는 [sliceMaterializedDumpByChunkPlan](../../src/export/export-dump-chunk-slice.ts)(T-0507) 책임.
- chunk 무결성 (checksum / hash) — `export-chunk-integrity-reconcile.ts`(T-0472) 별도 helper. 본 task 와 책임 분리(본 task 는 size byte drift, 그쪽은 content 무결성).
- DB / repository / Prisma query / persistence 배선 — 후속 task (ADR-0046 §Out of scope). 본 task 는 메모리에 있는 descriptor + dump (+ plan) 만 입력.
- REST controller 배선 — 후속 task.
- 새 외부 dependency / 압축 lib — 도입 시 §5 BLOCKED. 본 task 는 Node 내장 `Buffer`/`JSON` 만.
- `STATE.json` / journal / counter 변경 — driver 책임.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
