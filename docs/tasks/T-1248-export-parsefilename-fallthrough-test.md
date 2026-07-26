---
id: T-1248
title: exportJobDownload parseFilename malformed-percent-encoding fallthrough 테스트 보강
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-057]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-07-26
touchesFiles: [web/src/api/exportJobDownload.test.ts]
dependsOn: []
independentStream: p6-export-contract-fix
plannerNote: "P6 export-contract-fix stream — T-1245 reviewer MINOR nit(cap-deferred) 종결: parseFilename fallthrough 분기 미검증 커버, single-helper test ×1.0"
---

# T-1248 — exportJobDownload parseFilename malformed-percent-encoding fallthrough 테스트 보강

## Why

T-1245 reviewer 가 남긴 MINOR nit(cap 초과로 다음 slice 이연): `web/src/api/exportJobDownload.ts` 의 `parseFilename` 는 `filename*=UTF-8''<percent-encoded>` 형태를 우선 파싱하지만, percent-encoding 이 malformed 여서 `decodeURIComponent` 가 throw 하는 경우(line 30 catch) 또는 decode 결과가 빈 문자열인 경우(line 27 `if (decoded)` false) **일반 `filename="..."` 분기로 fallthrough** 한다. 기존 spec(`exportJobDownload.test.ts` line 69–89)은 happy-path(정상 percent-decode·일반 filename·null/빈 헤더)만 커버하고 이 fallthrough 분기는 미검증이다. P6 export-contract-fix stream 의 배선·dead-code 청소(T-1242~T-1247)가 끝난 지금, 이 잔여 coverage 갭을 닫는 것이 논리적 후속 slice다.

## Required Reading

- `web/src/api/exportJobDownload.ts` (line 15–40 — `parseFilename` 정의, 특히 line 22–39 두 정규식 분기 + catch fallthrough)
- `web/src/api/exportJobDownload.test.ts` (line 69–89 — 기존 `로컬 상수/parseFilename` describe 블록; 여기에 fallthrough case 추가)

## Acceptance Criteria

프로덕션 코드는 **변경하지 않는다**(test-only). 아래는 기존 `exportJobDownload.test.ts` 의 `parseFilename` describe 블록에 추가할 case다.

- [ ] happy-path(기존): `filename*=UTF-8''` 정상 percent-decode 우선 케이스가 여전히 pass(회귀 없음).
- [ ] error/negative — malformed percent-encoding fallthrough: `filename*=UTF-8''%` 처럼 `decodeURIComponent` 가 throw 하는 헤더에서 **일반 `filename="..."` 이 같이 존재하면 그 값으로 fallthrough** 됨을 검증(예: `attachment; filename*=UTF-8''%E4%A%; filename="fallback.json"` → `fallback.json`). throw 가 표면화되지 않음(안전 파싱)도 함께 확인.
- [ ] error/negative — malformed percent-encoding + 일반 filename 부재: `filename*=` 만 있고 malformed 이며 뒤에 `filename=` 이 없으면 `undefined` 반환(throw 없이).
- [ ] branch — decode 결과 빈 문자열 fallthrough: `filename*=UTF-8''` 값이 decode 후 빈 문자열이 되는 경우(line 27 분기 false) 일반 `filename=` 분기로 넘어가거나 `undefined` 반환하는 경로 1+ 검증.
- [ ] flow/branch: 위 분기(정상 decode / catch fallthrough / 빈-decode fallthrough / 일반 filename / undefined)가 각각 1+ test 로 분리 cover.
- [ ] `pnpm --dir web test`(vitest) 전체 green — 신규 case pass + 기존 web 전체 무회귀.
- [ ] `pnpm --dir web build`(tsc + vite) green.

> 참고: web 은 `coverageThreshold` 미도입(PLAN.md P6 게이트된 backlog — `@vitest/coverage-v8` 새-dep 게이트)이라 `test:cov` line/function ≥ 80% 게이트는 web 에 기계적으로 강제되지 않는다. 본 task 는 그 대신 위 분기별 test 명시로 R-112 의도(happy/error/branch/negative 충분 cover)를 충족한다.

## Out of Scope

- `parseFilename` 프로덕션 로직 수정(정규식·catch 구조 변경 금지 — test 만 추가).
- `web/src/views/AdminView.tsx` 및 그 test(AdminView.test.tsx) 접촉 — file-disjoint 유지(concurrent driver 안전).
- T-1247 잔여 NIT(AdminView convention-reference 주석 ~233/508/894/1132/2200, `requestRawMock` dead-weight mock 정리) — 별도 slice.
- web `coverageThreshold`(@vitest/coverage-v8) 도입 — 새-dep 게이트(사용자 승인 필요, PLAN.md P6 backlog).

## Suggested Sub-agents

`tester` (test-only slice — implementer 불요, tester 가 case 추가 + 실행 검증).

## Follow-ups

(작성 시 비어 있음)
