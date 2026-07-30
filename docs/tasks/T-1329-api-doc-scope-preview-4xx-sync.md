---
id: T-1329
title: api.md 의 export scope preview 2 종 실패 status 서술을 500 → 400 실측 정합
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-030, REQ-045]
estimatedDiff: 14
estimatedFiles: 1
created: 2026-07-30
completedAt: 2026-07-30T18:39:09Z
commit: b4908b35
independentStream: export-scope-input-4xx
dependsOn: [T-1328]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "T-1328(PR #1206, main a10ae22d) 이 400 매핑을 박제해 api.md 132·133 행이 stale — doc-only inline-amend x0.64 = 14 LOC / 1 파일"
---

# T-1329 — api.md 의 export scope preview 2 종 실패 status 서술을 400 으로 정합

## Why

[T-1328](T-1328-export-scope-preview-input-4xx-filter.md) (PR #1206, main `a10ae22d`) 이 `ScopeInputExceptionFilter` 를 배선해 `POST /api/admin/export/describe-scope` · `POST /api/admin/export/preview-selection` 의 **호출자 입력 결함을 400 으로 매핑** 했다. 그런데 [docs/architecture/api.md](../architecture/api.md) 132 행 · 133 행은 여전히 "**현재는 500** 으로 나간다 (사용자 대면 4xx 매핑 미도입)" / "`RangeError` / `TypeError` raw propagate → 500" 이라고 적고 있어 **문서가 main 의 실제 동작과 어긋난다**. api.md 는 endpoint 계약의 문서 정본이므로 이 stale 서술은 web UI 배선·후속 slice 가 잘못된 status 를 전제하게 만든다.

본 task 는 T-1328 이 §3.1 rule 3 (direct + pr 혼합 금지) 에 따라 **의도적으로 Out of Scope 로 분리해 둔 문서 slice** 를 회수한다. 문서 문장만 고치며 코드·spec 은 1 줄도 건드리지 않는다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) **132 행** (`POST /api/admin/export/describe-scope` 행) + **133 행** (`POST /api/admin/export/preview-selection` 행) — 수정 대상 두 셀. 각 행의 "controller 자체 분기 0 — ... 현재는 500" / "오류 전파는 describe-scope 와 동형 (... → 500)" 및 꼬리의 "실패 401 / 403" 부분이 갱신 지점이다.
- [src/export/scope-input-exception.filter.ts](../../src/export/scope-input-exception.filter.ts) **1~23 행 헤더 주석** — 박제된 매핑 규칙 4 분기 (HttpException passthrough / `RangeError` 400 / `TypeError` 400 / unknown 500) 의 정본. 문서 문장은 이 4 분기를 그대로 반영해야 한다.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) **196~220 행** · **240~260 행** — `@UseFilters(ScopeInputExceptionFilter)` 가 이 두 핸들러에만 부착됐다는 사실 확인 (다른 핸들러 행의 status 서술은 건드리면 안 되는 근거).

## Acceptance Criteria

- [x] **132 행 (`describe-scope`) 정합** — "현재는 500 으로 나간다 (사용자 대면 4xx 매핑 미도입 — 현재 동작 그대로의 기술이며 개선은 별건)" 서술을 **400 매핑 사실** 로 교체: 잘못된 scope 조합 (RANGE + `dateRange` 누락 · `start>=end` · PARTIAL + 빈 `entitySelector` · 허용 외 entity) 의 helper `RangeError` 와 Invalid Date 의 `TypeError` 를 `ScopeInputExceptionFilter` (T-1328) 가 **400 BadRequest** 로 매핑하며, 그 외 unknown 예외는 **500 을 보존** 한다는 점을 함께 적는다. 근거 파일 링크 [src/export/scope-input-exception.filter.ts](../../src/export/scope-input-exception.filter.ts) 1 개 추가.
- [x] **133 행 (`preview-selection`) 정합** — "오류 전파는 describe-scope 와 동형 (helper `RangeError` / `TypeError` raw propagate → 500)" 을 "동형 — 같은 `ScopeInputExceptionFilter` 로 400 매핑" 취지로 교체.
- [x] **두 행의 실패 status 목록 갱신** — 꼬리의 "실패 401 / 403" 을 "실패 **400** (scope 입력 결함) / 401 / 403 / 500 (그 외 unknown 보존)" 형태로 보강. 401/403 이 filter 의 `HttpException` passthrough 분기로 **원 status 그대로 유지** 된다는 사실도 한 구절로 명시 (재매핑 0).
- [x] **박제 task 번호 표기** — 두 행 모두 기존 "T-1305 문서화" 표기는 유지하되 본 갱신분에 `T-1328` 을 함께 병기해 어느 commit 이 동작을 바꿨는지 추적 가능하게 한다.
- [x] **stale 문구 0 확인** — `grep -n "raw propagate 해 \*\*현재는 500" docs/architecture/api.md` 와 `grep -n "raw propagate → 500" docs/architecture/api.md` 가 **각각 0 hit**.
- [x] **범위 확인** — `git diff --stat` 결과가 `docs/architecture/api.md` **1 파일** 이고 변경 행이 132·133 두 행뿐 (다른 행·다른 endpoint 서술 0 수정).
- [x] **표 구조 무손상** — 두 행 모두 markdown 표의 `|` 컬럼 개수가 변경 전과 동일 (method / path / UC / 비고 / 권한 5 컬럼). 파일을 열어 표가 깨지지 않았는지 육안 확인.
- [x] **언어 규율 (§12)** — 본문 서술은 한국어, HTTP status·식별자·경로·클래스명은 영어 유지.

## Out of Scope

- **코드·spec 수정 0** — `src/` · `test/` 어느 파일도 건드리지 않는다 (건드리면 §3.1 rule 3 위반 → pr-mode 로 split 필요).
- **`download` 경로의 `RangeError` (손상 job row) status 서술 변경 0** — [T-1291](T-1291-export-download-scope-select-wire.md) 이월 항목이며 아직 동작이 바뀌지 않았다. 문서도 현재 사실 그대로 둔다.
- **api.md 의 다른 endpoint 행 갱신 0** — 73 행 (`POST /api/users`) · 151 행 (`recent-deletion`) 등 다른 행의 500 서술은 실제 동작이므로 stale 아님. 손대지 않는다.
- **§5 endpoint 합계·집계 각주 재계산 0** — endpoint 수 변화 0 이라 [T-1306](T-1306-api-md-endpoint-count-recount.md) 이 박제한 합계는 그대로.
- **UC-07 문서 갱신 0** — UC-07 은 status code 를 서술하지 않으므로 정합 대상이 아니다 (grep 확인 완료).
- **api.md 표 구조·컬럼 재설계 0**, **다른 stale 항목 일괄 sweep 0** — 발견 시 Follow-ups 에만 적는다.

## Suggested Sub-agents

`implementer` (doc-only — architect/tester 불요. direct-mode 이므로 §3.2 R-110 면제 대상)

## Follow-ups

## 완료 요약 (2026-07-30)

main direct commit `b4908b35` (+2/-2, `docs/architecture/api.md` 1 파일). [api.md](../architecture/api.md) 132·133 행의 export scope preview 2 종(`describe-scope` · `preview-selection`) 실패 서술을 [T-1328](T-1328-export-scope-preview-input-4xx-filter.md) 의 `ScopeInputExceptionFilter` 실동작에 정합 — 입력 결함(`RangeError` / `TypeError`)은 **400**, 그 외 unknown 은 **500 보존**, `HttpException`(401 / 403) 은 passthrough 로 **재매핑 0**. 실패 status 목록을 `400 / 401 / 403 / 500` 으로 보강하고 `T-1305` 표기 유지 + `T-1328` 병기. stale 문구 grep 각각 0 hit, 표 5 컬럼 무손상, 코드·spec 0 수정.
