---
id: T-0650
title: buildRealDataResultIssueCommandArgs 산출 직전 command-args body marker-first 구조 가드 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — T-0649 신설 command-args body marker 가드를 builder 산출 직전 self-assert. T-0647 descriptor builder self-wire 의 command-args-side mirror. T-0649 Follow-up ①. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args.ts
  - test/helpers/realdata-e2e-result-issue-command-args.spec.ts
---

# T-0650 — command-args body marker-first 구조 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 consumer-side 가드 self-wire slice. realdata-e2e-result-summary-line stream 은 한 줄 요약을 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·descriptor body 3블록 구조 불변식 순수 가드 신설(T-0646)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)·command-args body marker-first 구조 가드 신설(T-0649, `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`)까지 닿았다.

T-0649 가 신설한 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` 는 **순수 가드 helper 로만 존재** 한다 — `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 의 산출 경로에 아직 배선되지 않았다. 따라서 빌더가 명령-args 를 합성하는 중 회귀(예: createArgs/updateArgs 에 서로 다른 body 를 담거나, marker 라인이 body 머리에서 빠지거나, searchQuery 가 body 의 marker 와 어긋나도록 배선)해도 빌더는 부정합 명령-args 를 그대로 반환해 gh issue 실배선·rolling 이슈 surface 로 멱등성이 깨진 채 새 나간다 — T-0649 가드는 그 회귀를 검출할 수 있으나 산출 경로에 박혀있지 않아 호출되지 않는다.

본 task 는 그 빈칸을 채운다 — `buildRealDataResultIssueCommandArgs` 가 명령-args 를 반환하기 **직전에** `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` 를 self-assert 한다. 정상 합성이면 가드는 void 이므로 byte-identical 보존(반환값·동작 불변), 회귀 시 빌더가 손상 명령-args 를 반환하기 전에 fail-fast throw 한다. 이는 T-0646(descriptor body 가드 신설)→T-0647(descriptor builder self-wire) self-wire 와 **동형 패턴의 command-args-side mirror** 다 — T-0649 Follow-up ① 이 명시한 자연 후속 slice. 가드는 type-only import 로 소비되던 출력 타입을 runtime 호출로 바꾸지만, 같은 모듈 내 함수 호출이라 runtime cycle 0.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) — `buildRealDataResultIssueCommandArgs(descriptor)` (L117~138) 가 self-wire 대상. 현재 L124~137 의 `return { searchQuery, createArgs, updateArgs }` 직전에 가드 self-assert 1지점 배선. 식별자 guard(`assertNonBlank`, L96~102)·body 전파 규칙·labels 복제·순수성/무공유 주석 본문 변경 0. 반환 객체를 const 로 받아 가드에 넘긴 뒤 그대로 반환하는 패턴(T-0647 builder self-wire 동형) 권장.
- [test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts](../../test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts) (T-0649) — self-wire 할 가드. `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args: RealDataResultIssueCommandArgs, descriptor: RealDataResultIssueDescriptor): void` — 정상이면 void, 불변식 위반(createArgs/updateArgs body byte 불일치·marker-first 위반·searchQuery 불일치)이면 fail-fast throw. **본문 변경 0** — 호출만. import 경로는 같은 `test/helpers/` 디렉토리.
- [test/helpers/realdata-e2e-result-issue-command-args.spec.ts](../../test/helpers/realdata-e2e-result-issue-command-args.spec.ts) — 기존 빌더 colocated spec. 본 task 는 이 파일에 self-wire 검증 describe 를 append (신규 spec 파일 신설 아님). 기존 fixture·descriptor 생성 패턴 재사용. `jest.spyOn` 으로 가드가 빌더 반환 직전 `(args, descriptor)` 인자로 호출됨을 검증하는 패턴 참조.
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) (T-0647) — mirror 할 **참조만**: builder 가 산출 직전 가드를 self-assert 하는 self-wire 패턴(import 1줄 + 호출 1지점, 반환값/동작 불변, type-only 였던 import 가 runtime 호출로). 본문 변경 0.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args.ts` — `buildRealDataResultIssueCommandArgs` 가 명령-args 객체를 반환하기 **직전에** `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` 를 self-assert. import 1줄 추가 + 호출 1지점 배선. 반환 객체를 const 로 받아 가드 통과 후 그대로 반환(T-0647 동형). 식별자 guard(`assertNonBlank`)·body 전파 규칙·labels 복제·순수성/무공유 주석 본문 변경 0.
- [ ] **동작 불변 (byte-identical 보존)** — 정상 descriptor → 가드 void → 빌더가 기존과 byte-identical 명령-args 반환. self-wire 전후 정상 입력 반환값 변화 0 (가드는 정상 경로에서 부수효과 0).
- [ ] **회귀 fail-fast** — 빌더 합성이 회귀(가드가 검출하는 불변식 위반)하면 빌더가 손상 명령-args 를 반환하기 **전에** fail-fast throw. 손상 args 가 caller(live wiring)로 새 나가지 않음.
- [ ] **순수성·무공유·R-59 보존** — self-wire 후에도 빌더는 순수 함수 유지(부수효과 0 · 입력 mutate 0 · 매 호출 새 객체 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw 미저장). 가드 호출은 runtime cycle 0 (같은 모듈 디렉토리 함수 호출).
- [ ] **Happy-path test 1+**: 정상 descriptor(단일/다수 result·다양한 분포·빈 results 변형) → 빌더가 가드 통과 후 정상 명령-args 반환(throw 0). 반환값이 self-wire 전과 byte-identical. 1+.
- [ ] **Error path test 각 1+**: ① 식별자 guard(title/marker 빈/공백) → 기존 throw 보존(가드 self-wire 가 기존 식별자 guard 동작을 깨지 않음) ② 가드가 검출하는 불변식 위반 시나리오(예: 빌더가 회귀해 createArgs/updateArgs body 불일치를 산출하는 상황을 `jest.spyOn` 또는 가드 직접 호출로 모사) → fail-fast throw. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 가드 void → 정상 반환 분기 ② 식별자 guard throw 분기(title 빈 / marker 빈 각각) ③ 가드 self-assert 가 빌더 반환 직전 `(args, descriptor)` 인자로 호출됨을 `jest.spyOn` 으로 검증(self-wire 가 실제 배선됐음 증명) — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 descriptor 2회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음) ② **입력 비변형** — 빌드 후 입력 descriptor 변경 0 assert ③ **self-wire 호출 인자 정합** — spyOn 으로 가드가 빌더 반환 직전 정확히 (반환할 args, 원본 descriptor) 인자로 1회 호출됨 검증 ④ **식별자 guard 우선** — title/marker 빈 입력 시 가드 self-assert 도달 전 식별자 guard 가 먼저 throw(분기 순서 보존) ⑤ **R-59** — self-wire 후에도 빌더가 raw narrative 미접촉. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` 에 self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). T-0649 가드 helper 자체 spec(`...-body-marker.spec.ts`) 은 본 task 에서 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 대상 빌더·spec 의 커버리지 유지(빌더 line/branch/function 100%).
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor` (T-0649) 가드 helper **본문 변경** — 본 task 는 그 가드를 빌더 산출 경로에 self-wire 만 (호출 1지점 + import 1줄). 가드 로직 변경 0.
- `RealDataResultIssueCommandArgs`/`RealDataResultIssueCreateArgs`/`RealDataResultIssueUpdateArgs` 출력 타입 정의 변경 · `RealDataResultIssueDescriptor` 타입 변경 — 본 task 는 self-wire 만.
- `buildRealDataResultIssueDescriptor` (T-0582/T-0645/T-0647) 본문 · descriptor body 합성 규칙 변경 — 본 task 는 command-args 빌더 self-wire 단독.
- `createArgs.labels`/`title` 정합 가드 신설·배선 — 본 task 는 body marker-first 가드 self-wire 에 한정(labels·title 정합 가드는 별도 slice 후보, T-0649 Follow-up ②).
- gh issue 실 호출 · `gh issue create`/`edit`/`list`/`search` 실 실행 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·args 재합성 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만 (부정합 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 command-args 빌더 self-wire 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 command-args consumer 경계의 body marker-first 불변식이 빌더 산출 직전 self-assert 로 박힌다(T-0646→T-0647 descriptor-side self-wire 의 command-args-side mirror 완결). 자연 후속 후보: ① `createArgs.labels`/`title` 정합 가드 신설 + self-wire — 본 가드가 cover 하지 않는 labels·title 전파 구조 검증(T-0649 Follow-up ②). ② gh issue 실배선 — `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
