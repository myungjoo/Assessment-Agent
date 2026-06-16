---
id: T-0445
title: export-scope VALID_SCOPES/VALID_ENTITIES 단일 source-of-truth 통합
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
dependsOn: []
independentStream: export-import-r57
touchesFiles:
  - src/export/export-scope-select.ts
  - src/export/export-scope-validate.ts
  - src/export/export-scope-select.spec.ts
  - src/export/export-scope-validate.spec.ts
estimatedDiff: 70
estimatedFiles: 4
created: 2026-06-16
plannerNote: P7 R-57 — T-0444 reviewer MINOR nit follow-up. export-scope-validate 가 mirror 한 VALID_SCOPES/VALID_ENTITIES 를 select 의 export 상수로 통합(DRY).
hqOrigin: T-0444-reviewer-nit
---

# T-0445 — export-scope VALID_SCOPES/VALID_ENTITIES 단일 source-of-truth 통합

## Why

T-0444(`validateExportScope`, PR #355) reviewer 가 MINOR nit 으로 지적: `export-scope-validate.ts` 의 `VALID_SCOPES` / `VALID_ENTITIES` 상수가 `export-scope-select.ts` 의 미-export `VALID_SCOPES` 상수와 `ExportEntity` union 을 **mirror** 해 둔 중복 source-of-truth 다(두 파일이 각자 `["full","range","partial"]` · 5 entity 목록을 따로 들고 있어, 한쪽이 바뀌면 다른 쪽이 silent 하게 어긋날 위험). T-0444 는 새-파일-only scope 라 in-PR 처리하지 못해 follow-up 으로 박제됐다(STATE backlogNote / journal 2026-06-16). 본 task 는 허용 scope 값과 허용 entity 목록을 `export-scope-select.ts` 에서 한 번만 정의·export 하고 `export-scope-validate.ts` 가 그것을 재사용하도록 통합해 중복을 제거한다 — UC-07 §6.1 3 차원 옵션 규칙(scope enum / entitySelector entity 목록)의 단일 진실 원천 확보. persistence/schema/repository/REST 변경 0 인 순수 리팩터라 게이트-free.

## Required Reading

- `src/export/export-scope-select.ts` — 미-export `VALID_SCOPES`(L47 `ReadonlySet<string>`) + `ExportEntity` union(L16~21). export 할 상수의 원천.
- `src/export/export-scope-validate.ts` — mirror 된 `VALID_SCOPES`(L25~29) / `VALID_SCOPE_SET`(L31) / `VALID_ENTITIES`(L36~42) / `VALID_ENTITY_SET`(L44). 통합 대상.
- `src/export/export-scope-select.spec.ts` — select helper 의 colocated spec. export 상수 추가가 기존 동작을 깨지 않는지 검증 위치.
- `src/export/export-scope-validate.spec.ts` — validate helper 의 colocated spec. 통합 후에도 scope/entity 검증 verdict 가 불변임을 검증 위치.

## Acceptance Criteria

- [ ] `export-scope-select.ts` 가 허용 scope 값 집합과 허용 `ExportEntity` 목록을 **export 가능한 named const** 로 한 번 정의(예: `export const VALID_EXPORT_SCOPES` / `export const VALID_EXPORT_ENTITIES`, 또는 set 형태)하고, 본 파일의 `selectExportRecords` 내부 검증도 그 export 상수를 사용하도록 정리(기존 `VALID_SCOPES` 동작 불변).
- [ ] `export-scope-validate.ts` 가 자체 `VALID_SCOPES` / `VALID_SCOPE_SET` / `VALID_ENTITIES` / `VALID_ENTITY_SET` mirror 선언을 제거하고 `export-scope-select.ts` 의 export 상수를 import 해 재사용. validate 의 verdict(valid/errors/normalized) 동작은 1 비트도 바뀌지 않는다.
- [ ] (happy-path) `selectExportRecords` 와 `validateExportScope` 의 기존 happy-path test 가 통합 후에도 모두 green — 통합이 정상 입력 분류·정규화 결과를 바꾸지 않음을 검증.
- [ ] (error path) 두 helper 의 기존 error/negative test(허용 외 scope → RangeError/scope error, 허용 외 entity → entitySelector error, dateRange 역전 등)가 통합 후에도 모두 green — export 상수 재사용이 거부 동작을 보존함을 검증.
- [ ] (branch) export 상수가 set/array 어느 형태로 통합되든, validate 의 `VALID_SCOPE_SET.has` / `VALID_ENTITY_SET.has` 분기와 select 의 `VALID_SCOPES.has` 분기가 동일 멤버십 판정을 유지(각 분기 cover 하는 기존 test 가 green).
- [ ] (negative 충분 cover) 허용 외 scope 값(빈 문자열·대문자·undefined·비-string), 허용 외 entity 값(오타·null·숫자), 비-object input 등 기존 negative case 가 모두 green — 단일 source-of-truth 통합으로 어느 거부 경로도 누락되지 않음. 본 task 는 순수 리팩터라 신규 public symbol 0 이나, export 상수 추가에 대한 명시적 assertion(예: `VALID_EXPORT_SCOPES` 가 정확히 3 값, `VALID_EXPORT_ENTITIES` 가 정확히 5 entity)을 colocated spec 에 1+ 추가.
- [ ] (regression) 본 nit follow-up 의 regression test — select 의 export 상수와 validate 가 사용하는 집합이 **동일 멤버십**임을 직접 단언하는 test 1+(예: 두 파일이 같은 scope/entity 집합을 본다는 assertion). 향후 한쪽만 바뀌면 fail 하도록.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 기존 100% cov 유지.

## Out of Scope

- 실 DB dump query / export 직렬화 / Import transaction restore / Audit row insert / REST controller (전부 schema·repository 게이트 — 별도 후속 sub-slice).
- `ExportEntity` union 정의 자체의 변경(entity 추가/삭제). 본 task 는 기존 5 entity 를 export 가능 상수로 묶을 뿐, 목록 멤버는 불변.
- 다른 export helper(`export-dump.ts` · `import-*.ts` 등)로의 상수 통합 확산. 본 nit 범위(`export-scope-select`↔`export-scope-validate`)에 한정.
- 검증 message 문구 변경(한국어 표현 손질 등) — 동작 불변 리팩터에 집중.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)

## Result (DONE)

- 완료: 2026-06-16T13:42Z (PR #356 squash-merge 3df9027, reviewer round1 APPROVE, 4-게이트 PASS, CI green).
- select 에 `VALID_EXPORT_SCOPES`/`VALID_EXPORT_ENTITIES` export named const 신설(내부 VALID_SCOPES Set 도 그것에서 파생). validate 의 mirror 4 선언(VALID_SCOPES/VALID_SCOPE_SET/VALID_ENTITIES/VALID_ENTITY_SET) 제거 후 export 상수 import 해 Set 파생 — verdict(valid/errors/normalized) 동작 1 비트 불변.
- 두 colocated spec 에 export 상수 명시 assertion(정확히 3 scope/5 entity) + regression test(두 파일 동일 멤버십 집합 직접 단언) 추가. 변경 파일 각 100% line/branch/func 유지, 전체 line 99.96%/func 100%, 3543 test green(+30/-29 LOC).
- AC 전 항목 ok. UC-07 §6.1 옵션 규칙 단일 source-of-truth 확보 — T-0444 reviewer nit 정리 완결.
