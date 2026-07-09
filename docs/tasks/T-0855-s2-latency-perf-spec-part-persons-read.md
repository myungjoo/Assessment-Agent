---
id: T-0855
title: S2 조회 latency perf-spec 를 PartController GET /api/parts/:id/persons sub-resource read 에 배선
phase: P8
status: DONE
completedAt: 2026-07-09T09:52:00Z
commitMode: pr
coversReq: [REQ-048, REQ-028]
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/part-persons-read.perf-spec.ts
  - test/perf/README.md
estimatedDiff: 235
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 #2 — S2 latency harness 26번째 perf-spec, 두 번째 sub-resource(:id/persons) read 배선 (part-detail T-0839 / group-persons T-0854 mirror, guard-free)"
---

# T-0855 — S2 조회 latency perf-spec 를 PartController GET /api/parts/:id/persons sub-resource read 에 배선

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up #2(조회 endpoint latency harness 배선)의 스물여섯 번째 slice다. T-0830~T-0854 이 25 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user·llm-config·export·import :id detail 10 + group :id/persons sub-resource 1)에 collector 를 배선했다. 본 task 는 직전 T-0854(GroupController `:id/persons`)가 연 **sub-resource read** 계열의 두 번째 slice 로, `PartController` 의 `GET /api/parts/:id/persons`(`findPersons` → `service.findPersonsByPartId(id)` — 지정 Part 소속 Person 목록, Part 부재 시 service 가 `findById(partId)` 재호출로 404 강제, Part 있으나 소속 Person 0 이면 200 + 빈 배열)에 harness 를 배선한다. controller 자체 분기 없음(`service.findPersonsByPartId(id)` raw forward). GroupController 와 동형인 **guard 미부착 sub-resource** 라 `overrideGuard` 없이 순수 부트스트랩(group-persons T-0854 mirror)하고 `PartService` 의 `findPersonsByPartId` 만 mock·호출 검증한다. T-0854 Out of Scope 가 "PartController 의 GET /api/parts/:id/persons sub-resource 배선(별도 slice)" 로 명시한 잔여 slice 다. REQ-048(조회 p95 < 3s) + REQ-028(reverse query — 지정 Part 소속 Person 목록)을 cover 한다.

## Required Reading

- [test/perf/group-persons-read.perf-spec.ts](../../test/perf/group-persons-read.perf-spec.ts) — 직전 sub-resource slice(T-0854). guard-free 순수 부트스트랩 + `findPersonsByGroupId` mock + happy/empty-list/404/500/mixed/n=1 분기 배선 패턴(mirror 원본 — 본 task 는 Group→Part controller/service, `findPersonsByGroupId`→`findPersonsByPartId` 로 치환).
- [test/perf/part-detail-read.perf-spec.ts](../../test/perf/part-detail-read.perf-spec.ts) — 같은 Part 모듈 sibling spec(T-0839). PartController + `PartService` mock(`useValue`) shape·부트스트랩 참고(본 spec 은 detail 대신 sub-resource `findPersonsByPartId` 호출).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처(호출·배선 대상, 변경 금지).
- [src/user/part.controller.ts](../../src/user/part.controller.ts) (line 75~80) — `@Get(":id/persons") async findPersons(@Param("id") id)` → `service.findPersonsByPartId(id)` raw forward. controller 자체 분기 없음.
- [src/user/part.service.ts](../../src/user/part.service.ts) (line 119~123) — `findPersonsByPartId` 가 `findById(partId)` 재호출로 Part 존재 검증(null 시 NotFoundException) 후 `personRepository.findByPartId` → Person[] 반환. list 반환이라 정상 시 배열(빈 배열 가능).
- [test/perf/README.md](../../test/perf/README.md) — perf-spec 카운트/목록 표(25 → 26 갱신 대상, 상단 목록 + 하단 endpoint 설명 둘 다).

## Acceptance Criteria

- [ ] `test/perf/part-persons-read.perf-spec.ts` 신설 — `GET /api/parts/:id/persons` 를 `collectLatencySamples`/`assertS2Threshold` 에 배선. PartController 는 guard 미적용이므로 `overrideGuard` 없이 순수 부트스트랩(group-persons T-0854 mirror), `PartService` 는 `findPersonsByPartId: jest.fn()` mock(`useValue`)로 주입.
- [ ] **Happy-path test 1+**: mock `findPersonsByPartId` 가 Person[] 반환 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`, 그리고 `findPersonsByPartId` 가 요청 id 로 `toHaveBeenCalledWith` 실증(@Param raw forward).
- [ ] **Empty-list happy-path 1+**: mock 이 빈 배열 `[]` 반환(소속 Person 0) → 여전히 200 성공 분류(빈 배열은 404 아님) → `failures===0`, `pass===true`. sub-resource 고유 특성(list read) 커버.
- [ ] **Error path test 1+**: mock `findPersonsByPartId` 가 `NotFoundException`(Part 부재) → 404 N회 → 전부 `failures`, `samplesMs.length===0`, `assertS2Threshold(result).pass===false` + "error rate 임계 초과" 사유 포함.
- [ ] **Flow / branch coverage**: controller 자체 분기 없음(service 결과 raw forward) → 이 항목은 collector 의 성공(2xx)/실패(non-2xx) 분기를 service 반환(200) vs 예외(404·500)로 커버함을 spec 주석에 명시.
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) 존재하지 않는 partId 조회 → `NotFoundException`(404) failures 분류(2xx 아님), (b) 일반 Error → 500 응답(404 와 구분되는 non-2xx) failures 분류, (c) mixed 부분 실패(N회 중 1회만 404 → `failures===1` 부분 집계 정확성), (d) `iterations===1` 경계에서 harness 정상 동작.
- [ ] `pnpm test:perf` 통과 — 신규 spec 포함 26 suites green(`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 `.spec.ts$` 밖이라 unit coverage gate 에 회귀 무영향임을 tester 가 확인.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 25 → 26(part :id/persons 추가)으로 갱신, 두 번째 sub-resource(:id/persons) read 명시(상단 목록 괄호 + 하단 endpoint 설명 항목 둘 다).

## Out of Scope

- 실 DB round-trip baseline 실측 / 실 Prisma / k6 등 부하 발생기 / CI perf job 상시 편입(§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- `export/:id/download`·`export/:id/status-view` 등 남은 detail 변형 배선(별도 slice).
- POST/PATCH/DELETE write route perf 배선(본 spec 은 조회에 집중).
- 실 PersonPartMembership 네비게이션·`personRepository.findByPartId` reverse query·RBAC 검증(service/e2e spec 소관 — 본 spec 은 service mock).
- `PartController.findAll`(list)·`findById`(:id detail) 재배선(각각 part-read / part-detail-read spec 이 이미 존재) — 본 spec 은 `:id/persons` sub-resource 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)

## Result (DONE 2026-07-09T09:52Z)

PR #749 squash-merged (`09c1dfe0`), reviewer APPROVE round 1/7, 4-게이트 all PASS.
`test/perf/part-persons-read.perf-spec.ts` 신설 + `test/perf/README.md` 배선 count 25→26.
group-persons(T-0854) mirror — Group→Part controller/service, `findPersonsByGroupId`→`findPersonsByPartId`.
happy/empty-list/404/500/mixed/n=1 분기 cover(신규 7 tests). +298/-6, 2 files.
`pnpm test:perf` 26 suites/161 green, `pnpm test:cov` line 99.95%/func 100%/branch 99.25%(≥80% 게이트 통과), lint·build green. 신규 외부 dependency 0.
