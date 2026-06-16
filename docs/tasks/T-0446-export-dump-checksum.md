---
id: T-0446
title: UC-07 Export dump 무결성 checksum 산출·검증 순수 helper computeDumpChecksum/verifyDumpChecksum
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-06-16
plannerNote: P7 Export/Import(R-57) 10번째 게이트-free 단추 — UC-07 §5 step5·§7.4 payload 무결성 hash 의 순수 결정 로직(crypto 내장, 새 dep 0)
---

# T-0446 — UC-07 Export dump 무결성 checksum 산출·검증 순수 helper computeDumpChecksum / verifyDumpChecksum

## Why

P7 PLAN "Import/export/restore (R-57)" bullet 의 게이트-free 순수 helper stream — T-0437(scope select)→T-0438(dump envelope)→T-0439(version gate)→T-0440(구조 gate)→T-0441(영향 요약)→T-0442(복원 plan)→T-0443(audit 항목)→T-0444(scope validate)→T-0445(상수 DRY) 9 building block 완비 후, 9개 helper 가 cover 못 한 [UC-07](../use-cases/UC-07-export-import.md) §5 step 5 Note ("Import: file ... 무결성 hash — REQ-030, REQ-032") + §7.4 ("payload 무결성 hash 검증 실패" → 400, transaction 시작 전 reject) 의 **무결성 checksum 산출·검증 결정 로직**을 순수 함수로 박제한다. validateImportDumpStructure(T-0440)는 구조(필드 shape·entityCounts cross-check)만 검사하므로 payload 가 전송 중 손상·변조됐는지(byte-level corruption)는 검출 불가 — 결정적 checksum 이 그 gap 을 메운다.

본 helper 는 persistence/repository/DB query/file parse/REST 호출 0 인 순수 결정 로직이며, Node 내장 `crypto` (`createHash('sha256')`) 만 사용해 **새 외부 dependency 0** 이다 (BLOCKED 사유 회피). REQ-032(raw 미저장)는 입력 dump 의 직렬화 표현만 hash 하고 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` — §5 step 5 Note(무결성 hash) / §7.4(payload 무결성 hash 검증 실패, transaction 전 reject) / §6.3(version mismatch) / §1 invariant (a) raw 미저장
- `src/export/export-dump.ts` — buildExportDump 가 산출하는 `ExportDump` envelope shape(schemaVersion/generatedAt/scope/entityCounts/recordCount/records) + `EXPORT_SCHEMA_VERSION`. 본 helper 의 checksum 대상.
- `src/export/export-dump.spec.ts` — colocated spec 작성 패턴(describe/it 한국어, non-mutating·error path 단언 convention)
- `src/export/import-dump-validate.ts` — verdict 반환 패턴(비-throw 누적 vs 입력 방어 throw)의 sibling 참조. 본 helper 의 verify 측 verdict 형태 정합 참조.
- `src/export/export-scope-select.ts` — `assertValidDate` mirror convention(한국어 message), `ExportRecord` 타입

## Acceptance Criteria

신규 파일 `src/export/export-dump-checksum.ts` + colocated spec `src/export/export-dump-checksum.spec.ts` 만 추가. 두 함수 export:

- `computeDumpChecksum(dump: ExportDump): string` — `ExportDump` 의 **결정적 정규화 직렬화**(record 순서 보존 + key 순서 고정 — JSON.stringify 의 key 순서 비결정성 회피를 위해 명시적 canonical 직렬화) 후 Node 내장 `crypto.createHash('sha256')` 으로 hex digest 산출. 같은 입력 → 항상 같은 digest(결정성), 한 field 라도 다르면 다른 digest.
- `verifyDumpChecksum(dump: ExportDump, expected: string): { valid: boolean; computed: string; expected: string }` — 재계산한 checksum 과 expected 를 case-insensitive 비교해 verdict 반환(비-throw — §7.4 의 검증 verdict). 다중 정보(computed/expected) 반환으로 호출측이 mismatch 진단 가능.

- [ ] `computeDumpChecksum` happy-path test 1+ — 정상 `ExportDump` 입력에 대해 64자 hex(sha256) digest 반환.
- [ ] `computeDumpChecksum` 결정성 test — 동일 입력(별 인스턴스로 재구성) 두 번 호출 시 같은 digest. record 1개라도 다르면(instant/entity/순서 변경) digest 달라짐을 단언.
- [ ] `computeDumpChecksum` error path test 1+ — null/undefined dump, dump.records 비-배열, generatedAt/schemaVersion 누락 등 잘못된 입력에 대해 TypeError(한국어 message). 입력 record 의 instant 가 Invalid Date 인 경우도 cover.
- [ ] `verifyDumpChecksum` happy-path test 1+ — 직접 산출한 checksum 을 expected 로 넘기면 `valid:true` + computed==expected.
- [ ] `verifyDumpChecksum` negative test — expected 가 1 char 다름 / 대소문자만 다름(대소문자는 valid:true) / 빈 문자열 / 비-string expected / 변조된 dump(한 field 변경 후 옛 checksum) 에 대해 각각 올바른 verdict. **예외 상황 분기마다 1+ test**(빈/비-string/대소문자/변조/길이불일치 각각).
- [ ] branch coverage — 두 함수의 모든 분기(정상/방어 throw/대소문자 정규화/mismatch) 각 1+ test.
- [ ] non-mutating 검증 — `Object.freeze` 된 dump(및 records)로 호출해도 통과, 입력 변형 0.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` green + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% line/branch/func cover 목표.

## Out of Scope

- 실 file artifact 생성/streaming/다운로드, multipart upload parse, JSON.parse(file→dump 역직렬화) — repository/REST 게이트된 후속 sub-slice.
- 압축 archive 해제(§7.4) / file 크기 한계 검증 — 본 helper 는 이미 메모리에 올라온 `ExportDump` 객체만 다룬다.
- schema version 호환 판정(T-0439 checkSchemaVersionCompat 이 cover) / 구조 무결성(T-0440 validateImportDumpStructure 가 cover) 재구현.
- HMAC / 서명(signature) / 암호화 — 본 helper 는 단순 결정적 checksum(전송 손상·변조 검출용)만. 인증된 무결성(secret key)은 security 게이트 → 별도 ADR.
- 새 외부 dependency 추가 금지 — Node 내장 `crypto` 만 사용. crypto 외 의존 필요 시 BLOCKED 후 ADR.
- ExportDump envelope 에 checksum 헤더 field 영속 추가(envelope shape 변경) — 본 task 는 산출/검증 함수만, envelope 통합은 후속 follow-up.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어있음)

## Result (DONE)

- 완료: 2026-06-16T14:55Z (PR #357 squash-merge 7372165, reviewer round1 APPROVE, 4-게이트 PASS, CI green).
- 신규 `src/export/export-dump-checksum.ts`(+200 LOC): `computeDumpChecksum(dump)` = ExportDump canonical 직렬화(JSON.stringify key 순서 비결정성 회피) 후 Node 내장 `crypto` sha256 64자 hex digest(결정적, 입력 방어 throw). `verifyDumpChecksum(dump, expected)` = `{valid, computed, expected}` verdict(비-throw, case-insensitive) — export-dump.ts / import-dump-validate.ts mirror 패턴. ExportDump 타입 재사용(새 타입 0), 새 외부 dependency 0(crypto 내장만).
- 신규 colocated `export-dump-checksum.spec.ts`: line/branch/func 100% cov. happy(64자 hex)·결정성(field/record/순서 변경 시 digest 변화)·error path(null·누락 헤더·records 비-배열·Invalid Date·비-number)·negative(1자·대소문자·빈·비-string·길이·변조 dump)·non-mutating(freeze) 전부 cover(R-112 4종 충분). unit 3577 green. smoke/e2e 는 CI(DATABASE_URL)에서.
- AC 전 항목 ok. UC-07 §5 step5 Note(무결성 hash) + §7.4(payload 무결성 hash 검증 실패→400, transaction 전 reject)의 byte-level 손상·변조 검출 gap 충족. REQ-032(raw 미저장)는 입력 dump 직렬화만 hash·raw 미fetch 로 자연 유지. 실 file streaming/HMAC·서명/envelope checksum 영속은 Out of Scope(후속 게이트).
