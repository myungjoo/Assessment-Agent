---
id: T-2081
title: 최근 N일 재수집 ⑬ — 재수집 요청 본문에서 instants 를 제거한다
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-041]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-11-04
independentStream: recent-refresh
dependsOn: [T-2080]
touchesFiles: [src/scheduling/dto/recent-deletion.dto.ts, src/scheduling/dto/recent-deletion.dto.spec.ts, src/scheduling/recent-deletion.controller.ts, src/scheduling/recent-deletion.controller.spec.ts, test/e2e/schedules-recent-deletion.e2e-spec.ts]
plannerNote: P7 · 오너 지시 — 최근 N일 재수집 arc ⑬. 설계 결정은 T-2069. web 전환(T-2078) 뒤 DTO 의 instants 제거
---

# T-2081 — instants 제거

## Why

T-2069 arc 의 ⑬ 조각이다 (README `74 행`). 대상 row 는 서버가 찾으므로 `instants` 는 runner 로 전달되지 않는다. T-2075 가 선택으로 바꾸고 T-2078 이 web 을 `{ days }` 본문으로 옮겼으므로, 이제 DTO 에서 필드를 지운다. 필드가 남아 있으면 형식 검증만 하는 무의미한 입력면이 계약에 남는다.

issue-still-relevant 확인: origin/main `32f10aaa` 의 `src/scheduling/dto/recent-deletion.dto.ts` `23 행` 에 `instants?: string[]` 가 남아 있다. `web/src` 에서 `instants` 를 보내는 곳은 없다 (계약 guard test 의 fixture 만 있다).

## Required Reading

- T-2069 "설계 결정", T-2075 Acceptance Criteria.
- `src/scheduling/dto/recent-deletion.dto.ts` 와 colocated spec `src/scheduling/dto/recent-deletion.dto.spec.ts`.
- `src/scheduling/recent-deletion.controller.ts` (`1 행` ~ `3 행` 주석, `33 행` ValidationPipe 옵션, `49 행` `@Body`) 와 colocated spec `src/scheduling/recent-deletion.controller.spec.ts` (`61 행` ~ `90 행`, `150 행` ~ `270 행`, `330 행` ~ `440 행` 의 `.send` 본문).
- `test/e2e/schedules-recent-deletion.e2e-spec.ts` (`95 행` ~ `285 행`, 특히 `140 행` ~ `160 행` 의 `invalidPayloads` table).

## Acceptance Criteria

DTO:

- [ ] `RecentDeletionDto` 에서 `instants` 필드 · `INSTANTS_MAX_SIZE` · 더 이상 쓰지 않는 class-validator import 를 지운다. `days` 검증은 그대로다.
- [ ] 본문에 `instants` 가 있으면 controller-scope ValidationPipe (`forbidNonWhitelisted`) 가 400 으로 거부한다. runner 는 호출되지 않는다.
- [ ] `recent-deletion.controller.ts` 상단 주석에서 "instants 는 받지만 무시" 문구를 지우고 현재 계약 (`{ days }` 만) 으로 고친다.

기존 test 정리:

- [ ] controller spec · e2e spec 의 `.send({ instants: ... })` 본문을 `{}` 또는 `{ days }` 로 바꾼다. 각 test 가 원래 검증하던 분기 (404 · 409 · 400 · 202 · RBAC 등) 는 그대로 유지한다.
- [ ] `instants` 형식 검증 test (`@IsArray` · `@IsISO8601 each` · `@ArrayMaxSize` · "runner 로 전달되지 않는다") 는 "`instants` 포함 시 400" test 로 바꾼다. 형식 검증 test 를 남겨 두지 않는다.

R-112 (spec 위치: 위 colocated 두 파일 + e2e 파일):

- [ ] Happy-path: `{ days: 7 }` · `{}` 본문이 DTO 검증을 통과하고 controller 가 202 를 반환한다 각 1+.
- [ ] Error path: `days` 형식 위반 (0 · 음수 · 소수) 이 계속 400 이다 1+.
- [ ] 분기: `days` 지정 / 미지정, ValidationPipe 거부 / 통과 각 1+.
- [ ] Negative (예외 분기마다 1+, test 이름은 `_n` 으로 끝남): `instants` 빈 배열 포함, `instants` ISO 배열 포함, 정의되지 않은 다른 키 포함 — 모두 400 이고 runner 미호출 · Assessment 미생성.
- [ ] Regression: 예전 web 처럼 `{ instants: [], days: 1 }` 을 보내면 400 이 되는 것을 e2e 로 고정한다 (조용히 무시되던 필드가 되살아나면 fail).
- [ ] `pnpm lint && pnpm build && pnpm test` green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%), `pnpm test:e2e` green, PR CI green.

## Out of Scope

- `docs/architecture/api.md` `170 행` 과 `docs/use-cases/UC-06-evaluation-delete-reeval.md` `119 행` 의 `instants` 설명 갱신 (파일 cap — T-2082 의 주석 · 문서 범위).
- `web/src/views/AdminView.recent-deletion-contract.test.ts` 변경. T-2075 가 이 guard 를 instants 제거에도 수정이 필요 없게 만들었다. `10 행` 의 stale 주석은 T-2082.
- `buildRecentDeletionPlan` · `selectInDeletionWindow` · `RecentDeletionInputExceptionFilter` 의 instants 관련 코드와 주석 (사용처 정리는 T-2082).
- web 변경, runner · backend 동작 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (T-2082 범위 메모) api.md `170 행` 의 "선택 `instants` (형식만 검증하고 무시한다. 후속 task 에서 제거)" 문구 삭제, UC-06 `119 행` 의 `RecentDeletionDto` 설명 갱신, `AdminView.recent-deletion-contract.test.ts` `10 행` 주석의 "instants 필수" 정정.
