---
id: T-0652
title: buildRealDataResultIssueCommandArgs 산출 직전 command-args labels·title 정합 가드 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — T-0651 신설 command-args labels·title 정합 가드를 builder 산출 직전 self-assert. T-0650 body-marker self-wire 의 labels·title-side mirror. T-0651 Follow-up. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args.ts
  - test/helpers/realdata-e2e-result-issue-command-args.spec.ts
---

# T-0652 — command-args labels·title 정합 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 consumer-side 가드 self-wire slice. realdata-e2e-result-summary-line stream 은 한 줄 요약 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·descriptor body 3블록 구조 불변식 가드 신설(T-0646)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)·command-args body marker-first 가드 신설(T-0649)·그 가드 builder self-wire(T-0650)·command-args labels·title 정합 가드 신설(T-0651, `assertRealDataResultIssueCommandArgsLabelsTitleConsistent`)까지 닿았다.

T-0651 이 신설한 `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, expectedLabels)` 는 **순수 가드 helper 로만 존재** 한다 — `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 의 산출 경로에 아직 배선되지 않았다. 따라서 빌더가 명령-args 를 합성하는 중 회귀(예: createArgs.title/updateArgs.title/descriptor.title 3자 정합이 깨지거나, createArgs.labels 가 고정 상수와 어긋나거나, labels 가 상수와 같은 참조로 새 나가 무공유 불변식이 깨지도록 배선)해도 빌더는 부정합 명령-args 를 그대로 반환해 gh issue 실배선 시 같은 run 이 두 제목으로 갈라지거나 labels drift 가 새 나간다 — T-0651 가드는 그 회귀를 검출할 수 있으나 산출 경로에 박혀있지 않아 호출되지 않는다.

본 task 는 그 빈칸을 채운다 — `buildRealDataResultIssueCommandArgs` 가 명령-args 를 반환하기 **직전에** `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, RESULT_ISSUE_LABELS)` 를 self-assert 한다. 정상 합성이면 가드는 void 이므로 byte-identical 보존(반환값·동작 불변), 회귀 시 빌더가 손상 명령-args 를 반환하기 전에 fail-fast throw 한다. 이는 T-0649(body 가드 신설)→T-0650(body 가드 builder self-wire) self-wire 와 **동형 패턴의 labels·title-side mirror** 다 — T-0651 Follow-up 이 명시한 자연 후속 slice. 빌더는 self-wire 시 이미 보유한 고정 labels 상수 `RESULT_ISSUE_LABELS` 를 expectedLabels 로 가드에 넘긴다(같은 모듈 내 상수). 같은 모듈 내 함수 호출이라 runtime cycle 0.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) — `buildRealDataResultIssueCommandArgs(descriptor)` (L118~) 가 self-wire 대상. 현재 L146 의 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` self-assert 직후(또는 그와 나란히), `return args` 직전에 labels·title 가드 self-assert 1지점 배선. 빌더가 보유한 고정 상수 `RESULT_ISSUE_LABELS` (L63) 를 expectedLabels 인자로 넘긴다. 식별자 guard(`assertNonBlank`)·body 전파 규칙·labels 복제(`[...RESULT_ISSUE_LABELS]`)·순수성/무공유 주석 본문 변경 0. body 가드 self-wire(T-0650, L146) 패턴 동형.
- [test/helpers/realdata-e2e-result-issue-command-args-labels-title.ts](../../test/helpers/realdata-e2e-result-issue-command-args-labels-title.ts) (T-0651) — self-wire 할 가드. `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args: RealDataResultIssueCommandArgs, descriptor: RealDataResultIssueDescriptor, expectedLabels: readonly string[]): void` — 정상이면 void, 불변식 위반(title 3자 byte 불일치·labels 고정상수 불일치·labels 무공유 위반)이면 fail-fast throw. **본문 변경 0** — 호출만. import 경로는 같은 `test/helpers/` 디렉토리.
- [test/helpers/realdata-e2e-result-issue-command-args.spec.ts](../../test/helpers/realdata-e2e-result-issue-command-args.spec.ts) — 기존 빌더 colocated spec. 본 task 는 이 파일에 labels·title self-wire 검증 describe 를 append (신규 spec 파일 신설 아님). 기존 fixture·descriptor 생성 패턴 재사용. `jest.spyOn` 으로 가드가 빌더 반환 직전 `(args, descriptor, RESULT_ISSUE_LABELS 와 동치 배열)` 인자로 호출됨을 검증하는 패턴 참조.
- 참조만(본문 변경 0): T-0650 의 body-marker self-wire(L140~146 주석 + 호출 1지점) — mirror 할 self-wire 패턴(import 1줄 + 호출 1지점, 반환값/동작 불변).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args.ts` — `buildRealDataResultIssueCommandArgs` 가 명령-args 객체를 반환하기 **직전에** `assertRealDataResultIssueCommandArgsLabelsTitleConsistent(args, descriptor, RESULT_ISSUE_LABELS)` 를 self-assert. import 1줄 추가 + 호출 1지점 배선(기존 body 가드 self-assert L146 직후, `return args` 직전). 식별자 guard(`assertNonBlank`)·body 전파 규칙·labels 복제·순수성/무공유 주석 본문 변경 0.
- [ ] **동작 불변 (byte-identical 보존)** — 정상 descriptor → 가드 void → 빌더가 기존과 byte-identical 명령-args 반환. self-wire 전후 정상 입력 반환값 변화 0 (가드는 정상 경로에서 부수효과 0).
- [ ] **회귀 fail-fast** — 빌더 합성이 회귀(title 3자 불일치·labels 고정상수 불일치·labels 무공유 위반 중 하나)하면 빌더가 손상 명령-args 를 반환하기 **전에** fail-fast throw. 손상 args 가 caller(live wiring)로 새 나가지 않음.
- [ ] **순수성·무공유·R-59 보존** — self-wire 후에도 빌더는 순수 함수 유지(부수효과 0 · 입력 mutate 0 · 매 호출 새 객체 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw 미저장). 가드 호출은 runtime cycle 0 (같은 모듈 디렉토리 함수/상수 참조).
- [ ] **Happy-path test 1+**: 정상 descriptor(다양한 title·marker 변형) → 빌더가 두 가드(body + labels·title) 통과 후 정상 명령-args 반환(throw 0). 반환값이 self-wire 전과 byte-identical. 1+.
- [ ] **Error path test 각 1+**: ① 식별자 guard(title/marker 빈/공백) → 기존 throw 보존(labels·title self-wire 가 기존 식별자 guard 동작을 깨지 않음) ② labels·title 가드가 검출하는 불변식 위반 시나리오(예: title 3자 불일치·labels 상수 불일치를 `jest.spyOn` 으로 빌더 회귀 모사 또는 가드 직접 호출로 모사) → fail-fast throw. 각 1+.
- [ ] **Flow/branch test**: ① 정상 입력 → 두 가드 void → 정상 반환 분기 ② 식별자 guard throw 분기(title 빈 / marker 빈 각각) ③ labels·title 가드 self-assert 가 빌더 반환 직전 `(args, descriptor, expectedLabels)` 인자로 호출됨을 `jest.spyOn` 으로 검증(self-wire 가 실제 배선됐음 증명) — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 descriptor 2회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음) ② **입력 비변형** — 빌드 후 입력 descriptor 변경 0 assert ③ **self-wire 호출 인자 정합** — spyOn 으로 labels·title 가드가 빌더 반환 직전 정확히 (반환할 args, 원본 descriptor, RESULT_ISSUE_LABELS 동치 배열) 인자로 1회 호출됨 검증 ④ **식별자 guard 우선** — title/marker 빈 입력 시 가드 self-assert 도달 전 식별자 guard 가 먼저 throw(분기 순서 보존) ⑤ **labels 무공유** — 반환 createArgs.labels mutate 가 고정 상수·다음 호출에 누설 안 됨(가드의 무공유 불변식이 정상 경로에서 통과) ⑥ **R-59** — self-wire 후에도 빌더가 raw narrative 미접촉. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-result-issue-command-args.spec.ts` 에 labels·title self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). T-0651 가드 helper 자체 spec(`...-labels-title.spec.ts`) 은 본 task 에서 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 대상 빌더·spec 의 커버리지 유지(빌더 line/branch/function 100%).
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueCommandArgsLabelsTitleConsistent` (T-0651) 가드 helper **본문 변경** — 본 task 는 그 가드를 빌더 산출 경로에 self-wire 만 (호출 1지점 + import 1줄). 가드 로직 변경 0.
- `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor` (T-0649) body 가드 self-wire(T-0650, L146) 변경 — 이미 배선됨. 본 task 는 그와 나란히 labels·title 가드를 추가 self-wire 만.
- `RealDataResultIssueCommandArgs`/`...CreateArgs`/`...UpdateArgs` 출력 타입 정의 변경 · `RealDataResultIssueDescriptor` 타입 변경 · `RESULT_ISSUE_LABELS` 상수 값 변경 — 본 task 는 self-wire 만.
- `buildRealDataResultIssueDescriptor` (T-0582/T-0645/T-0647) 본문 · descriptor body 합성 규칙 변경 — 본 task 는 command-args 빌더 self-wire 단독.
- gh issue 실 호출 · `gh issue create`/`edit`/`list`/`search` 실 실행 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·args 재합성 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만 (부정합 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 command-args 빌더 self-wire 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 command-args consumer 경계의 두 불변식(body marker-first + labels·title 정합)이 모두 빌더 산출 직전 self-assert 로 박힌다(T-0649→T-0650 body-side, T-0651→T-0652 labels·title-side self-wire 완결). 자연 후속 후보: gh issue 실배선 — `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
