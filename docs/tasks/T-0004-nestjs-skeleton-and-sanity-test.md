---
id: T-0004
title: NestJS minimal src skeleton + 첫 sanity test
phase: P0
status: BLOCKED
commitMode: pr
estimatedDiff: 120
estimatedFiles: 5
created: 2026-05-23
plannerNote: T-0001 split의 세 번째 task. NestJS 의 가장 작은 동작 단위 (main + module + controller + service + 그 service에 대한 spec) 만 작성.
dependsOn: [T-0003]
blocks: [T-0005]
---

# T-0004 — NestJS minimal src skeleton + 첫 sanity test

## Why

[T-0003](T-0003-project-config.md) 으로 셋업된 config 위에 NestJS 의 최소 동작 src 코드를 작성한다. "비어있지만 빌드·테스트 통과하는 NestJS 앱" 을 만드는 것이 목표. 도메인 로직(`Assessment`, `User`, GitHub 통합 등) 은 본 task에 절대 들어가지 않는다 — Phase P1/P2 의 일.

본 task 가 끝나면:

- `pnpm build` 가 `dist/` 를 만들고 성공.
- `pnpm test` 가 sanity spec 1개를 실행하고 통과.

이로써 [T-0005](T-0005-ci-workflow.md) 의 CI workflow 가 검증할 수 있는 토대가 마련된다.

## Required Reading

- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md)
- [T-0003](T-0003-project-config.md) 의 acceptance criteria (config 의 가정을 알아야 src 가 맞물림)
- `package.json` (T-0003 의 산출물), `tsconfig.json`, `tsconfig.build.json`
- [CLAUDE.md](../../CLAUDE.md) §3, §9 (안전장치 — 새 dep 금지), §12 (코드 주석 한국어, 식별자 영어)
- 참고: NestJS 공식 quickstart 페이지 (architect 가 필요 시 WebFetch)

## Acceptance Criteria

- [ ] `src/main.ts` 존재. NestFactory.create + listen(port) 의 표준 부트스트랩.
- [ ] `src/app.module.ts` 존재. `@Module` 데코레이터로 AppController/AppService 등록.
- [ ] `src/app.controller.ts` 존재. 루트 `GET /` 가 service 결과 (예: "Assessment-Agent" 문자열) 반환.
- [ ] `src/app.service.ts` 존재. health 문자열 반환 메서드 (예: `getStatus(): string`) 하나.
- [ ] `src/app.service.spec.ts` 존재. `getStatus()` 가 약속된 문자열을 반환하는지 검증하는 sanity test (Jest, ts-jest). negative test 1개 (예: 메서드가 undefined 를 반환하지 않음) 도 포함 — README 112행 negative test 요구사항 부분 반영.
- [ ] `pnpm build` 가 성공한다.
- [ ] `pnpm test` 가 위 spec 1개를 실행하고 통과한다.
- [ ] 코드 안 주석은 한국어로, 식별자·NestJS API·decorator 이름은 영어로 (§12).
- [ ] 단일 commit 으로 staged 된다 (5 파일).

## Out of Scope

- 도메인 모듈 (`AssessmentModule`, `UserModule`, etc.) — Phase P2 이후.
- DB 연결, 외부 API 호출, env 변수 로딩 (`@nestjs/config`) — 별도 ADR 후 후속 task.
- Validation pipe, exception filter, auth guard 등의 cross-cutting — Phase P2 이후 ADR + task.
- e2e test (supertest 기반) 인프라 — 별도 task 로 분리 (T-0005 끝나고 P0.5 또는 P1 초반).
- `package.json` 의 dependencies/devDependencies 추가 — T-0003 에서 모두 끝났다는 전제. 만약 부족한 dep 가 발견되면 BLOCKED (CLAUDE.md §5).

## Suggested Sub-agents

`implementer` (NestJS 최소 src 작성) → `tester` (sanity spec 작성·실행 + `pnpm build` 확인)

architect 는 호출하지 않는다 (ADR-0001 의 결정만 적용; 새 결정 없음).

## Follow-ups

(빈 칸)

## Blocker

- reason: requirement-ambiguity
- humanQuestion: HQ-0002
- stashRef: stash@{0} ("T-0004 draft pre-decision ... — recoverable with: git stash apply stash@{0}"). T-0001 stash 는 stash@{1} 로 밀려남.
- 한 줄 요약: T-0003 의 `package.json` 의 `jest.roots` 가 부재 디렉토리 `<rootDir>/test` 를 요구해서 `pnpm test` 가 jest Validation Error 로 즉시 종료 — acceptance `pnpm test 성공` 불가.

## Resolution (2026-05-23)

- HQ-0002 결정: `t-0003-patch` (사용자 결정 (b)).
- [T-0006](T-0006-jest-roots-patch.md) 가 1줄 patch (`jest.roots` 에서 `"<rootDir>/test"` 제거) 로 결함을 fix.
- T-0006 가 main 에 merge 되면 본 task 는 자동으로 unblock — driver 의 다음 turn 에서 STATE.nextTask = T-0004 로 복귀해 본 task 재개.
- stash@{0} 의 T-0004 draft 는 그대로 보존. T-0006 merge 후 implementer 가 `git stash apply stash@{0}` 로 복구해서 재사용 가능 (반드시는 아님 — 새로 작성도 OK).
- 본 task 의 status 를 PENDING 으로 되돌리는 것은 T-0006 merge 시점에 driver/planner 가 자동 처리해야 한다 (W2 보강 후의 planner 가 처리하면 더 매끄러움).

## Follow-ups (T-0004 가 unblock 된 후의 후속 사항)

- reviewer agent 의 jest config 검증 강화: 본 결함이 T-0003 PR-3 round 1 에서 reviewer 가 catch 했어야 함. README 117–128행 reviewer charter 의 "기존 기능이나 성능을 해치지 않는지 검사" 와 "타 모듈에 Regression 을 일으킬 수 있는지 점검" 항목을 더 구체적인 checklist 로 보강하는 ADR 또는 reviewer.md 갱신 task 필요.
