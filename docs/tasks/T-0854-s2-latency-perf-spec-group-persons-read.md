---
id: T-0854
title: S2 조회 latency perf-spec 를 GroupController GET /api/groups/:id/persons sub-resource read 에 배선
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/group-persons-read.perf-spec.ts
  - test/perf/README.md
estimatedDiff: 235
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 #2 — S2 latency harness 25번째 perf-spec, 첫 sub-resource(:id/persons) read 배선 (group-detail T-0845 mirror, guard-free)"
---

# T-0854 — S2 조회 latency perf-spec 를 GroupController GET /api/groups/:id/persons sub-resource read 에 배선

## Why

P8 load-resilience-test-plan §5 follow-up #2(조회 endpoint latency harness 배선)의 스물다섯 번째 slice다. T-0830~T-0853 이 24 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user·llm-config·export·import :id detail 10)에 collector 를 배선했다. 본 task 는 지금까지의 단건 detail(:id) read 를 넘어 **첫 sub-resource read** 인 `GroupController` 의 `GET /api/groups/:id/persons`(`findPersons` → `service.findPersonsByGroupId(id)` — 지정 Group 소속 Person 목록, Group 부재 시 service 가 404 강제, Group 있으나 membership 0 이면 200 + 빈 배열)에 harness 를 배선해 sub-resource 조회 경로에서의 재사용을 실증한다. REQ-048(조회 p95 < 3s) 를 cover 한다.

## Required Reading

- `test/perf/group-detail-read.perf-spec.ts` — 본 spec 의 mirror 원본(GroupController + guard-free 부트스트랩, GroupService mock 패턴). 본 slice 는 이 파일의 구조를 따르되 배선 대상 메서드를 `findById` → `findPersonsByGroupId` 로 치환.
- `test/perf/latency-collector.ts` — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처(호출·배선 대상, 변경 금지).
- `src/user/group.controller.ts` (line 104~111) — `@Get(":id/persons") findPersons(@Param("id") id)` → `service.findPersonsByGroupId(id)` raw forward. controller 자체 분기 없음.
- `src/user/group.service.ts` (line 242~256) — `findPersonsByGroupId` 가 Group 사전 존재 검증(findById null 시 NotFoundException) 후 Person[] 반환. list 반환이라 정상 시 배열(빈 배열 가능).
- `test/perf/README.md` — perf-spec 카운트 표(24 → 25 갱신 대상).

## Acceptance Criteria

- [ ] `test/perf/group-persons-read.perf-spec.ts` 신설 — `GET /api/groups/:id/persons` 를 `collectLatencySamples`/`assertS2Threshold` 에 배선. GroupController 는 guard 미적용이므로 `overrideGuard` 없이 순수 부트스트랩(group-detail T-0845 mirror), `GroupService` 는 `findPersonsByGroupId: jest.fn()` mock(`useValue`)로 주입.
- [ ] **Happy-path test 1+**: mock `findPersonsByGroupId` 가 Person[] 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, 그리고 `findPersonsByGroupId` 가 요청 id 로 `toHaveBeenCalledWith` 실증(@Param raw forward).
- [ ] **Empty-list happy-path 1+**: mock 이 빈 배열 `[]` 반환(membership 0) → 여전히 200 성공 분류(빈 배열은 404 아님) → `failures===0`, `pass===true`. sub-resource 고유 특성(list read) 커버.
- [ ] **Error path test 1+**: mock `findPersonsByGroupId` 가 `NotFoundException`(Group 부재) → 404 N회 → 전부 `failures`, `samplesMs.length===0`, `assertS2Threshold(result).pass===false` + `errorRate 임계 초과` 사유 포함.
- [ ] **Flow / branch coverage**: controller 자체 분기 없음(service 결과 raw forward) → 이 항목은 collector 의 성공(2xx)/실패(non-2xx) 분기를 service 반환(200) vs 예외(404·500)로 커버함을 spec 주석에 명시.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) 존재하지 않는 groupId 조회 → NotFoundException(404) failures 분류, (b) 일반 Error → 500 응답(404 와 구분되는 500) failures 분류, (c) mixed 부분 실패(N회 중 1회만 404) → `failures` 부분 집계 정확성, (d) `iterations===1` 경계에서 harness 정상 동작.
- [ ] `pnpm test:perf` 통과 — 신규 spec 포함 25 suites green(`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 `.spec.ts$` 밖이라 unit coverage gate 에 회귀 무영향임을 tester 가 확인.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트 24 → 25 갱신, 첫 sub-resource(:id/persons) read 명시.

## Out of Scope

- 실 DB round-trip baseline 실측 / 실 Prisma / k6 등 부하 발생기 / CI perf job 상시 편입(§5 별도 follow-up).
- `collector`·`assert` 순수 로직 자체 변경(본 spec 은 primitive 를 호출·배선만).
- `PartController` 의 `GET /api/parts/:id/persons` sub-resource 배선(별도 slice).
- `export/:id/download`·`export/:id/status-view` 등 남은 detail 변형 배선(별도 slice).
- POST/PATCH/DELETE write route perf 배선(본 spec 은 조회에 집중).
- 실 PersonGroupMembership N:M 네비게이션·RBAC 검증(service/e2e spec 소관 — 본 spec 은 service mock).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 신규 생성 시점)
