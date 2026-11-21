---
id: T-2090
title: 최근 N일 재수집 — scheduling.module.ts · recent-deletion-window.ts 의 옛 "삭제 → 재수집" 주석을 현재 동작으로 고친다
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 16
estimatedFiles: 2
created: 2026-11-20
independentStream: recent-refresh
dependsOn: [T-2089]
touchesFiles: [src/scheduling/scheduling.module.ts, src/scheduling/recent-deletion-window.ts]
plannerNote: P7 · T-2089 Follow-up — 재수집 arc 후 남은 src 주석 2 파일의 runRecentDeletion · manual delete 서술 정정 (주석만)
commitModeNote: 오너 scheduled-prompt 지시(문서·코멘트 변경은 PR·리뷰 없이 direct commit)에 따라 driver 가 pr → direct 로 조정. 주석 외 변경이 생기면 pr 로 되돌린다
---

# T-2090 — 최근 N일 재수집 src 주석 정합

## Why

T-2089 의 planner Follow-up 이다. 최근 N일 재수집 arc (T-2069 ~ T-2089, README `74 행` R-74 / REQ-041) 가 끝나 runner 는 `startRefresh` · `refreshStatus` 로 동작한다. 저장본을 먼저 지우지 않고, 좌표별로 다시 수집 · 평가한 뒤 끝난 좌표만 교체한다. 그런데 `src/` 주석 두 곳은 아직 옛 모델을 설명한다. 주석만 고치는 변경이지만 `src/` 를 건드리므로 §3.1 상 `pr` 이다.

issue-still-relevant 확인 (origin/main `fbfc8483`): `git grep -n "runRecentDeletion\|manual delete" -- src/scheduling` 결과가 아래 4 줄이다. 아직 고쳐지지 않았으므로 본 task 는 유효하다.

- `src/scheduling/scheduling.module.ts` `61 행` ~ `64 행`: RecentDeletionController 주석이 "최근 N일 결과 manual delete → 재수집 REST 진입점", "runRecentDeletion 을 호출한다" 고 쓴다. 실제 controller 는 `startRefresh` (POST, `recent-deletion.controller.ts` `51 행`) 와 `refreshStatus` (GET, 같은 파일 `60 행`) 를 호출한다.
- `src/scheduling/scheduling.module.ts` `94 행` ~ `95 행`: exports 주석이 "후속 sub-slice(manual delete REST controller)가 inject 받아 runRecentDeletion 을 호출한다" 고 쓴다. 그 controller 는 이미 같은 module 에 있다.
- `src/scheduling/recent-deletion-window.ts` `1 행` ~ `5 행`: 머리 주석이 "manual delete 대상 기간 window", "manual delete → 재수집", "실 삭제/재수집은 후속 slice 가 본 출력을 소비한다" 고 쓴다. 현재 소비처는 `recent-deletion-coordinates.ts` `10 행` · `34 행` (`buildClosedDaysWindow`) 이다.
- 같은 파일 `20 행`: "초과 요청은 과도 삭제 window 로 보고 거부" — 삭제가 아니라 재수집 범위다.

## Required Reading

- `src/scheduling/scheduling.module.ts` `55 행` ~ `101 행` (고칠 곳).
- `src/scheduling/recent-deletion-window.ts` `1 행` ~ `25 행` (고칠 곳).
- `src/scheduling/recent-deletion.controller.ts` `45 행` ~ `60 행` — `startRefresh` · `refreshStatus` 호출 위치 (읽기만).
- `src/scheduling/recent-deletion-runner.service.ts` 머리 주석 (`1 행` ~ `25 행`) — 현재 동작 서술의 정본 (읽기만).
- `src/scheduling/recent-deletion-coordinates.ts` `1 행` ~ `40 행` — window helper 의 현재 소비처 (읽기만).
- 문구 선례: `src/scheduling/scheduling.module.ts` `91 행` ~ `93 행` (RecentDeletionRunnerService provider 주석, T-2069 재설계 문구).

## Acceptance Criteria

- [ ] `scheduling.module.ts` `61 행` ~ `64 행` 주석을 현재 사실로 바꾼다. controller 는 최근 N일 재수집 REST 진입점이고, POST 는 `startRefresh` 로 재수집을 시작하며 (202) GET 은 `refreshStatus` 로 상태를 돌려준다. 역사 사실 (T-0428 로 처음 등록) 과 "새 provider 0 — controller 등록만", "BackfillController 와 같은 prefix" 문구는 남긴다.
- [ ] `scheduling.module.ts` `94 행` ~ `95 행` exports 주석에서 "후속 sub-slice(manual delete REST controller) … runRecentDeletion" 서술을 지운다. 대신 export 이유를 현재 사실로 한 줄 적는다. 외부 소비처가 없으면 "같은 module 의 RecentDeletionController 가 inject 한다" 처럼 사실만 적는다. 외부 소비처 유무는 `git grep -n "RecentDeletionRunnerService" -- src` 로 확인한다.
- [ ] `recent-deletion-window.ts` `1 행` ~ `5 행` 머리 주석을 고친다. 이 helper 는 최근 N일 재수집의 대상 기간 window 를 산출하고, `recent-deletion-coordinates.ts` 의 `buildClosedDaysWindow` 가 소비한다. "manual delete" · "실 삭제/재수집은 후속 slice" 문구를 지운다. 역사 사실 (T-0424, R-74 / REQ-041) 과 "DB·trigger·repository 호출 0" 은 남긴다.
- [ ] `recent-deletion-window.ts` `20 행` 의 "과도 삭제 window" 를 "과도한 재수집 window" 류로 고친다. `MAX_DAYS` 값과 에러 메시지 문자열은 바꾸지 않는다 (`recent-deletion-input-exception.filter.spec.ts` `58 행` · `180 행` 이 그 문자열을 단언한다).
- [ ] 검증 명령: `git grep -n "runRecentDeletion\|manual delete\|과도 삭제" -- src/scheduling` 결과가 0 줄이다.
- [ ] 동작 변경 0: 주석 외 diff 0 줄. 심볼 · 파일 이름 (`RecentDeletion*`, `recent-deletion-*`) 은 바꾸지 않는다.
- [ ] R-112 — public symbol 추가 · 수정 0 이고 분기 변화 0 이라 (1) happy-path (2) error path (3) 분기별 (4) negative test 신규 항목은 해당 없다. 대신 기존 spec 이 그대로 통과함을 확인한다: `pnpm test -- src/scheduling` green.
- [ ] R-110 — tester 가 `pnpm lint && pnpm build && pnpm test` 를 돌려 green 을 확인한다. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 주석 변경이라 coverage 수치는 바뀌지 않아야 한다.
- [ ] 행 범위 표기는 §12 규칙 (`~`, `N 행`, `L` prefix 금지) 을 새로 쓴 주석에만 적용한다.
- [ ] 2 파일 외 변경 0.

## Out of Scope

- 심볼 · 파일 · route 이름 변경 (`RecentDeletionController`, `recent-deletion/:personId`, `buildRecentDeletionWindow` 등). 이름 정리는 API 계약 · web 소비처 · 문서까지 번지므로 별도 판단이 필요하다.
- `src/scheduling/dto/recent-deletion.dto.ts` · `recent-deletion-input-exception.filter.ts` 의 주석 (이미 현재 사실과 맞다).
- `src/import/*instants*` (import 복원 경로의 다른 개념이라 이 arc 와 무관).
- `test/` · `web/` · `docs/` 변경.
- T-2069 Follow-ups 의 owner 항목 (자동 tick 의 최근 1 주 재수집 · 재수집 후 Summary 재생성) 구현.

## Suggested Sub-agents

implementer → tester (주석만이라 architect 불필요).

## Follow-ups
