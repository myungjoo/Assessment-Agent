---
id: T-2046
title: parts guard 선행 ③ — mock 부트 perf 3 spec guard override + realdb perf 2 spec 인증 cookie
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-048]
estimatedDiff: 179
estimatedFiles: 5
created: 2026-10-30
independentStream: q0056-parts-guard
dependsOn: []
touchesFiles: [test/perf/part-read.perf-spec.ts, test/perf/part-detail-read.perf-spec.ts, test/perf/part-persons-read.perf-spec.ts, test/perf/part-read-realdb.perf-spec.ts, test/perf/part-detail-read-realdb.perf-spec.ts]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 parts 축 — 오너 승인 완료, groups 축 T-2031 ~ T-2040 선례 동형
---

# T-2046 — parts guard 선행 ③ — mock 부트 perf 3 spec guard override + realdb perf 2 spec 인증 cookie

## Why

parts guard 를 붙이면 mock 부트 3 spec 은 guard 때문에 깨지고 realdb 2 spec 은 전 요청 401 이 된다. groups 축 T-2034 · T-2035 를 cap 안에서 한 slice 로 묶었다. PLAN `158 행` 이 금지하는 per-route baseline 신설은 아니고 기존 spec 의 부트 · 요청 수정이다.

## Required Reading

- `docs/STATE.json` `humanQuestions` Q-0056 `decision` — 오너 결정 정본.
- groups 축 선례 커밋 (T-2031 ~ T-2040, `git log --oneline`).
- [test/perf/part-read.perf-spec.ts](../../test/perf/part-read.perf-spec.ts)
- [test/perf/part-detail-read.perf-spec.ts](../../test/perf/part-detail-read.perf-spec.ts)
- [test/perf/part-persons-read.perf-spec.ts](../../test/perf/part-persons-read.perf-spec.ts)
- [test/perf/part-read-realdb.perf-spec.ts](../../test/perf/part-read-realdb.perf-spec.ts)
- [test/perf/part-detail-read-realdb.perf-spec.ts](../../test/perf/part-detail-read-realdb.perf-spec.ts)

## Acceptance Criteria

- [ ] 변경 파일은 `test/perf/part-*.perf-spec.ts` 5 개
- [ ] mock 3 spec 에 `overrideGuard(JwtAuthGuard)` · `overrideGuard(RolesGuard)` 부착
- [ ] realdb 2 spec 의 `/api/parts` 요청 전부 인증 cookie 부착, truncate 뒤 actor 재-seed
- [ ] 임계값 · 반복 수 · 측정 로직 무변경, guard 부재를 전제한 옛 주석 제거
- [ ] `pnpm test:perf` green (mock 은 로컬, realdb 는 CI)

## Out of Scope

- 위 파일 밖의 변경. 새 dependency · guard class. `docs/requirements.md` REQ 재판정 (arc 뒤 별 task).

## Suggested Sub-agents

`implementer → tester → reviewer`

## Follow-ups

- `test/perf/README.md` 의 parts slice 서술 (guard 미부착) doc-sync 는 groups 축 선례처럼 arc 뒤로 미룬다.
