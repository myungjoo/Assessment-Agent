---
id: T-1267
title: 복원 plan 의 conflictKey 구분자 NUL 이스케이프 표기 전환
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-07-27T17:35:00Z
mergedAs: dcc374fd
prNumber: 1158
reviewRounds: 2
coversReq: [REQ-030, REQ-032]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-07-27
independentStream: import-restore-engine
dependsOn: [T-1266]
touchesFiles:
  - src/export/import-restore-plan.ts
  - src/export/import-restore-plan.spec.ts
plannerNote: "review 위생 slice — conflictKey 의 raw NUL 1 바이트가 파일을 git binary 로 만들어 chain PR diff 가 UI 에서 안 보임"
---

# T-1267 — 복원 plan 의 conflictKey 구분자 NUL 이스케이프 표기 전환

## Why

`src/export/import-restore-plan.ts` 70 행의 `conflictKey` 가 구분자로 **raw NUL 바이트를 소스에 직접** 품고 있어 git 이 이 파일을 binary 로 취급한다 (`Bin ... bytes`). 그 결과 이 파일을 건드리는 모든 PR 에서 **reviewer 가 GitHub UI 로 production diff 를 볼 수 없다** — [ADR-0055](../decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원 엔진 chain 이 T-1255~T-1266 동안 계속 이 모듈을 수정해 온 만큼, §3.3 4-게이트의 reviewer 검토 품질을 직접 깎아먹는 조건이다 (T-1266 머지 시 integrator 관측).

본 slice 는 그 한 겹만 닫는다 — 구분자 문자를 **`\u0000` 이스케이프 표기로 바꿔 동일한 문자열을 만들되 소스는 순수 ASCII 텍스트가 되게** 한다. 런타임 동작·key 의미·계약은 **0 변경** 이며, 복원 엔진 chain 의 다음 leg (상류 타입 전파 → 실 `$transaction` 실행 → controller 재배선) 은 손대지 않고 그대로 남긴다.

## Required Reading

- [src/export/import-restore-plan.ts](../../src/export/import-restore-plan.ts) — 본 task 의 수정 대상. 70 행 `conflictKey` 의 template literal 구분자 1 문자만이 실 변경 지점.
- [src/export/import-restore-plan.spec.ts](../../src/export/import-restore-plan.spec.ts) — 기존 계약 pinning test (본 slice 가 회귀 0 을 증명해야 할 기준선). merge 충돌/비충돌 분기 test 위치 확인.
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportRecord` / `ExportEntity` 정의 (`entity` 필드의 타입 — 구분자 모호성 negative test 설계 근거).
- [docs/decisions/ADR-0055-import-multipart-file-upload.md](../decisions/ADR-0055-import-multipart-file-upload.md) — §Follow-up (b) 복원 엔진 chain 의 slice 경계 (본 slice 는 그 chain 의 위생 branch 이며 leg 순서를 바꾸지 않는다).

## Acceptance Criteria

- [x] `conflictKey` 의 구분자를 **소스상 `\u0000` 이스케이프 표기** 로 바꾼다. 산출 문자열은 이전과 **바이트 단위로 동일** 해야 하며 (`entity` + U+0000 + instant millis), 다른 문자 (예: `|`, `:`) 로 바꾸지 않는다 — 본 slice 는 표기 전환일 뿐 key 설계 변경이 아니다. 왜 이스케이프 표기를 쓰는지 (git binary 오탐 방지 / review diff 가시성) 를 주석 1~2 줄로 남긴다.
- [x] 변경 후 `src/export/import-restore-plan.ts` 에 **raw 제어 바이트가 0 개** 임을 확인한다 — `git diff` 가 이 파일을 텍스트로 표시하고 (`Bin` 표기 소멸) 라인 단위 diff 가 나와야 한다.
- [x] **런타임 동작 0 변경** — replace/merge 분기, 충돌 판정 결과, 입력 순서 보존, 새 배열 반환, non-mutating 계약, throw 계약 (비-배열 `existing`/`incoming` → TypeError, 원소 `instant` 가 비-Date/Invalid Date → index 를 담은 TypeError, mode 가 replace/merge 밖 → RangeError) 과 한국어 메시지 문구가 모두 그대로다. `conflictKey` 외 실행 문장 변경 0.
- [x] T-1266 이 도입한 `ImportRestorePlan<TInsert>` 타입 파라미터·기본값은 건드리지 않는다. 다른 소비처 파일은 **한 파일도 수정하지 않는다** (`pnpm build` 가 다른 파일 변경 없이 통과).
- [x] **happy-path unit test 1+** — (a) `entity` + `instant` 가 같은 replace/merge 입력에서 충돌 판정이 이전과 동일함을 단언, (b) merge 에서 비충돌 원소가 그대로 `toInsert` 에 순서 보존되어 실림을 단언.
- [x] **회귀 test (소스 위생 pinning) 1+** — spec 이 `import-restore-plan.ts` 소스를 읽어 **U+0000 을 포함한 raw 제어 문자가 존재하지 않음** 을 단언한다 (다시 raw 바이트가 들어오면 test 가 fail 하도록). 동시에 `conflictKey` 산출 문자열에는 U+0000 이 **실제로 들어있음** 을 (동작 보존) 별도 test 로 단언해, 위생 test 가 동작을 바꾸는 방향으로 오독되지 않게 한다.
- [x] **error path unit test 1+** — 비-배열 `existing` / 비-배열 `incoming` / `incoming` 원소의 `instant` 가 Invalid Date / 비-Date 각각이 기존과 **동일한 error 종류와 동일한 한국어 메시지** 로 throw 됨을 단언 (메시지 문자열 회귀 pinning).
- [x] **분기 cover** — replace / merge 2 분기, merge 의 충돌/비충돌 2 분기, mode 무효 분기, `existing` / `incoming` 각각의 배열 판정 분기 각 1+ test.
- [x] **negative cases 충분 cover** — 예외 · 경계 분기마다 1+: (a) 구분자 모호성 — naive 문자열 이어붙이기라면 충돌로 오판할 `entity`/`instant` 조합 (예: entity 문자열 끝이 숫자와 이어붙는 경우) 이 **충돌로 판정되지 않음**, (b) 같은 `entity` + 같은 millis 지만 서로 다른 Date instance 는 여전히 충돌, (c) millis 가 다르면 (1 ms 차이 경계) 비충돌, (d) 빈 `incoming` / 빈 `existing` 경계, (e) freeze 된 배열·원소로 호출해도 throw 0 · 결과 동일 · 입력 불변, (f) mode 가 `null` / `"REPLACE"` (대소문자 mismatch) / 숫자 / 객체일 때 RangeError 와 메시지, (g) 같은 입력 2 회 호출 시 동일 결과 (idempotent), (h) error 메시지에 record payload 값이 실리지 않음.
- [x] `pnpm lint && pnpm build && pnpm test` 통과, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 변경 파일은 statement/branch/function/line 100% 목표 (동일 chain 선례 T-1255~T-1266 동형).
- [x] `scripts/check-spec-presence.sh` 통과, `prettier --check` 통과.

## Out of Scope

- 구분자 문자 자체의 설계 변경 (`|` / `:` / JSON key 등으로 교체) — 본 slice 는 표기 전환만.
- 나머지 raw NUL 보유 tracked 파일 9 개 (`src/assessment-evaluation/**` 6 개, `test/helpers/**` 1 개, `test/smoke/**` 1 개 등) 의 일괄 정리 — cap (5 파일) 초과라 별도 slice (Follow-ups).
- raw 제어 바이트를 repo 전역으로 금지하는 CI 가드 script / `.gitattributes` 추가 — 위 9 개 파일 정리 후에만 green 이므로 후속 slice.
- ADR-0055 §Follow-up (b) chain 의 다음 leg 전부 — 상류 타입 전파 (`import-restore-input.ts` / `import-restore-plan-prepare.ts`), 하류 타입 전파 (`import-restore-ops.ts` / `import-restore-steps.ts`), 실 `$transaction` 실행 helper, merge 의 delete 타게팅, controller 재배선.
- `describeReceived` / `describeFieldsKind` 공용 module 추출 (별도 refactor slice).
- DB schema 변경 · migration · 새 외부 dependency 추가 (0 건).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 task 유래) raw NUL 을 품은 나머지 tracked 파일 9 개 (`src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts`, `summary-batch-plan.ts`, `summary-batch-roster-input-consistency.ts` 와 각 spec, `summary-batch-orchestrator.service.spec.ts`, `summary-batch-pipeline.spec.ts`, `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-markdown-consistency.spec.ts`, `test/smoke/realdata-e2e-daily-step-eval-command-plan-assembly.smoke-spec.ts`) 를 같은 방식으로 정리하는 slice (cap 때문에 2 회 분할 필요) → 그 뒤 raw 제어 바이트 금지 CI 가드 추가.
- (T-1266 이월) chain 잔여 leg: ① 상류 타입 전파, ② 하류 타입 전파, ③ 실 `$transaction` 실행 helper (ADR-0044 §3), ④ merge mode 의 delete 타게팅 (row 식별 key 부재 — ADR 대상 가능성), ⑤ controller interim guard 교체.
- (T-1265 reviewer round 1 MINOR-3 이월) controller 배선 slice 이전에 legacy dump (`fields` 부재) 정책 결정.
- (T-1264 reviewer NIT-2 이월) `describeReceived` / `describeFieldsKind` 4 사본의 공용 module 추출.
- (T-1261 reviewer round 2 MINOR-1 이월) `docs/architecture/estimate-model.md` 에 chain 실측치 합산 (T-1261 595, T-1262 628, T-1265 805) + nit-closure 분량 포함 항목.
- (reviewer round 1 NIT-5 유래) 나머지 9 개 파일 정리 slice 를 설계할 때, `.gitattributes` 에 `*.ts diff` 를 넣는 대안을 함께 저울질한다 — `text` attribute 는 EOL 정규화만 제어하고 diff 판정은 `diff` attribute 소관이라, **소스를 건드리지 않고도** UI diff 가시성이 회복될 수 있다.
- (reviewer round 1 MINOR-2 유래) 위생 pinning test 의 구분자 단언 일부가 production 을 호출하지 않는 tautology 다. `conflictKey` 가 module-private 이라 직접 단언이 불가한 사정은 인정되며, 관측 가능한 동작(비충돌 판정)으로 간접 증명하는 현 방향을 유지하되 향후 정리 시 재검토.
- (reviewer round 2 NIT-6 유래) 위생 test 를 `readFileSync(SOURCE_PATH)` Buffer + `buffer.includes(0)` 방식으로 바꾸면 eol 무관하면서 더 정확하다. 현 방식은 CRLF 쌍으로 나타나는 raw CR 을 예외로 흘리는데, 실패 모드가 NUL 기반이라 실질 영향은 0 이므로 후속 정리 항목.
- (본 fire 운영 관측) PR body / 코멘트에 raw NUL 을 그대로 넣으면 GitHub 이 caret notation(`^@`) 으로 sanitize 한다. 이 계열 slice 의 PR 본문에서는 반드시 `U+0000` 또는 `\u0000` 처럼 **코드포인트 표기**로 적는다.
