---
id: T-0452
title: UC-07 Import 사전 검증 결과 통합 go/no-go 순수 helper summarizeImportPreflight
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
dependsOn: []
independentStream: export-import-helpers
touchesFiles:
  - src/export/import-preflight-summary.ts
  - src/export/import-preflight-summary.spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-17
plannerNote: "P7 R-57 UC-07 §7.4 — 14 helper 의 개별 verdict 를 transaction 전 단일 go/no-go 로 통합하는 게이트-free 순수 aggregator, dependsOn []"
---

# T-0452 — UC-07 Import 사전 검증 결과 통합 go/no-go 순수 helper summarizeImportPreflight

## Why

PLAN.md P7(R-57 Export/Import) building block chain — T-0437~T-0451 14 helper 가 Import 사전 검증을
**개별 verdict 단위**로 박제했으나(version gate / 구조 gate / size gate / checksum gate / merge-conflict
report), UC-07 §7.4("transaction 시작 전 reject — DB 변경 0") + §7.3(payload 검증 실패 → 400 + 검증
메시지)가 요구하는 **"이 모든 검증을 한데 모은 단일 go/no-go 결정"** 은 14 helper 중 0회 cover 됐다.
실 Import 배선은 transaction 을 시작할지 말지를 결정하기 위해 5 verdict 를 일일이 풀어 보는 분기를
중복 작성해야 한다. summarizeImportPreflight 는 이미 산출된 sub-verdict 들을 입력으로 받아(재실행 0 —
순수 DRY 합성) `{ proceed, blockingIssues, warnings, summary }` 단일 보고로 통합한다 — REQ-030(Import
검증) + REQ-032(raw 미저장은 입력 verdict 만 다뤄 자연 유지) cover.

## Required Reading

- `src/export/import-dump-validate.ts` — `ImportDumpValidation { valid, issues }` (구조 gate verdict 입력).
- `src/export/schema-version-compat.ts` — `SchemaVersionCompat { compatible, action, uploadedVersion, currentVersion, reason? }` (version gate verdict 입력).
- `src/export/import-dump-size-validate.ts` — `ImportDumpSizeVerdict { valid, errors, totals }` (size gate verdict 입력).
- `src/export/export-dump-checksum.ts` — `DumpChecksumVerification { valid, computed, expected }` (checksum gate verdict 입력).
- `src/export/import-merge-conflict.ts` — `ImportMergeConflictReport { hasConflict, conflicts, perEntity, total }` (merge-conflict report 입력).
- `docs/use-cases/UC-07-export-import.md` §7.3 / §7.4 — payload 검증 실패 + transaction 전 reject(본 helper 가 통합하는 결정의 근거).
- `src/export/export-scope-select.ts` — `ExportEntity` 타입(재사용, 새 타입 신설 금지 확인용).

## Acceptance Criteria

- [ ] `src/export/import-preflight-summary.ts` 신설. `summarizeImportPreflight(verdicts)` 순수 함수 + `ImportPreflightReport` interface(+ 입력 묶음 interface, 예: `ImportPreflightVerdicts`) export. 새 도메인 타입은 위 5 sub-verdict + `ExportEntity` 재사용 외 최소화.
- [ ] 입력 계약: structure(`ImportDumpValidation`) + version(`SchemaVersionCompat`) + size(`ImportDumpSizeVerdict`) + checksum(`DumpChecksumVerification`) 4 verdict 를 받고, mergeConflict(`ImportMergeConflictReport`)는 **선택 입력**(merge mode 일 때만 제공 — replace mode 면 부재).
- [ ] 합성 규칙(UC-07 §7.4 정합): structure.valid===false OR size.valid===false OR checksum.valid===false OR version.action==="reject" → `proceed: false` 이고 각 위반 사유를 `blockingIssues: string[]` 에 누적(즉시 throw 0 — 전부 모아서 보고). version.action==="migrate" 와 mergeConflict.hasConflict===true 는 진행 차단이 아니라 `warnings: string[]` 에 누적(§6.2 file 우선 / §6.3 (i) migration 후보 — 사용자 confirmation 영역).
- [ ] `proceed === (blockingIssues.length === 0)`. `summary` 는 사람이 읽을 한국어 요약 1줄(예: blocking 0 + warning N → "사전 검증 통과 (경고 N건)", blocking M → "사전 검증 실패 (차단 M건)").
- [ ] non-mutating — freeze 된 입력 verdict 로 호출해도 통과, 반환은 새 객체(입력 배열/객체 미변형).
- [ ] **Happy-path test 1+**: 4 verdict 모두 valid + version accept + mergeConflict 부재 → `proceed: true`, blockingIssues `[]`, warnings `[]`, summary 정상. merge mode 에서 mergeConflict.hasConflict===false 추가 케이스도 happy.
- [ ] **Error path test 1+**: 입력 묶음이 null/undefined, 또는 필수 sub-verdict(structure/version/size/checksum) 부재·shape 불일치(예: `valid` 비-boolean, `action` 미허용 값) → 한국어 메시지 TypeError. 각 필수 verdict 부재마다 별도 케이스.
- [ ] **분기 cover**: blocking 분기 4종(structure invalid / size invalid / checksum invalid / version reject) 각 1+ test, warning 분기 2종(version migrate / mergeConflict hasConflict) 각 1+ test, blocking+warning 동시 누적 1+ test, mergeConflict 부재(replace mode) vs 제공(merge mode) 양 분기 1+ test.
- [ ] **Negative cases 충분 cover**: blocking 다중 동시(여러 verdict 동시 invalid → blockingIssues 다중 누적), version action 미허용 enum(예: `"accept" | "migrate" | "reject"` 외) → TypeError, sub-verdict 가 object 아님(string/number/배열) → TypeError, mergeConflict 가 제공됐으나 shape 불일치(`hasConflict` 비-boolean) → TypeError, freeze 된 입력 non-mutating 단언 — **각 1+ test**(단일 negative 금지).
- [ ] colocated spec `src/export/import-preflight-summary.spec.ts` 작성(NestJS convention — helper 와 같은 디렉토리). 공유 fixture 가 필요하면 본 spec 내부 factory 로 충분(별도 helper 추출 불필요).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test` green(전체 suite 회귀 0).
- [ ] `pnpm test:cov` 통과 — 신규 파일 line ≥ 80% / function ≥ 80%(기존 helper 들처럼 신규 파일 100% 목표).

## Out of Scope

- 실 Import 배선(controller / service / repository / Prisma transaction 호출) — repository/schema 게이트(별도 후속 task).
- sub-verdict 의 **재계산** — 본 helper 는 이미 산출된 verdict 를 합성만 한다. validateImportDumpStructure / checkSchemaVersionCompat / validateImportDumpSize / verifyDumpChecksum / detectImportMergeConflicts 를 본 helper 안에서 호출 금지(입력으로만 받음 — 게이트-free·새 dep 0 유지).
- REST endpoint(`POST /api/admin/restore`) · 400/409 직렬화 · multipart 파싱 — repository/REST 게이트.
- schema 변경 / migration table 실행(§6.3 (i)) · Audit row insert(§8 (e)) · DB persistence.
- 새 외부 dependency 추가(BLOCKED — §9). 새 도메인 타입 신설(기존 5 sub-verdict + ExportEntity 재사용).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시 비어있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
