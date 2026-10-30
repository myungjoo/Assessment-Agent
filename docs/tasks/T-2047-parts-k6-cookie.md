---
id: T-2047
title: parts guard 선행 ④ — k6 s2-read parts seed POST · 측정 GET · 회수 DELETE 인증 cookie
phase: P5
status: DONE
completedAt: 2026-10-30
mergedAs: d316849d
prNumber: 1608
reviewRounds: 2
commitMode: pr
coversReq: [REQ-043, REQ-048]
estimatedDiff: 77
estimatedFiles: 2
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: []
touchesFiles: [test/load/s2-read.js, test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2047 — parts guard 선행 ④ — k6 s2-read parts seed POST · 측정 GET · 회수 DELETE 인증 cookie

## Why

`s2-read.js` 의 parts 3 지점만 무 cookie 로 남아 있다. guard 가 붙으면 401 이 `http_req_failed` 와 route:parts p95 를 오염시키고 seed 실패가 teardown 까지 번진다. groups 축 T-2036 동형이고, 자격은 T-2038 의 SuperAdmin bootstrap 그대로라 Admin+ write 를 통과한다.

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [test/load/s2-read.js](../../test/load/s2-read.js)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts)

## Acceptance Criteria

- [x] 변경 파일은 `test/load/s2-read.js` · drift smoke 2 개
- [x] parts 3 지점 cookie 부착, tag 는 seed · parts · teardown 그대로
- [x] 새 `__ENV` 키 · route tag · 임계 재산정 0
- [x] drift smoke 가 무 cookie 옛 형태 잔존을 red 로 잡는다
- [x] `pnpm test:smoke` green (CI)

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- 없음.
