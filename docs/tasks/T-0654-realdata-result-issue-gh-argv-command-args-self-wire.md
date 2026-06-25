---
id: T-0654
title: buildRealDataResultIssueGhArgv 산출 직전 gh argv↔명령-args round-trip 정합 가드 self-wire 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — T-0653 신설 gh argv↔명령-args round-trip 가드를 builder 산출 직전 self-assert. T-0650/T-0652 command-args self-wire 의 argv-side mirror. T-0653 Follow-up ①. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-argv.ts
  - test/helpers/realdata-e2e-result-issue-gh-argv.spec.ts
---

# T-0654 — gh argv↔명령-args round-trip 정합 가드 self-wire 배선

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 argv-layer 가드 self-wire slice. realdata-e2e-result-summary-line stream 은 한 줄 요약 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·descriptor body 3블록 구조 가드 신설(T-0646)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)·command-args body marker-first 가드 신설(T-0649)·그 가드 builder self-wire(T-0650)·command-args labels·title 정합 가드 신설(T-0651)·그 가드 builder self-wire(T-0652)·한 단계 downstream argv layer 의 round-trip 정합 가드 신설(T-0653, `assertRealDataResultIssueGhArgvPreservesCommandArgs`)까지 닿았다. 이로써 **command-args layer** 의 두 불변식(body marker-first + labels·title)은 모두 빌더 산출 직전 self-assert 로 박혔고, 그 한 단계 downstream 인 **argv layer** 의 round-trip 정합 불변식은 순수 가드로 신설됐다.

T-0653 이 신설한 `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 는 **순수 가드 helper 로만 존재** 한다 — `buildRealDataResultIssueGhArgv(action, commandArgs)` (T-0585, `realdata-e2e-result-issue-gh-argv.ts`) 의 산출 경로에 아직 배선되지 않았다. 따라서 빌더가 argv 를 합성하는 중 회귀(예: `--title` flag 뒤 값이 body 와 뒤바뀌거나, labels flag-pair 의 순서·개수가 어긋나거나, create action 인데 `issue edit` argv 가 나오거나, update 의 `String(issueNumber)` 가 drift 하도록 변형)해도 빌더는 손상 argv 를 그대로 반환해 `execFile('gh', argv)` live wiring 시 잘못된 gh 명령이 실행된다 — T-0653 가드는 그 회귀를 검출할 수 있으나 산출 경로에 박혀있지 않아 호출되지 않는다.

본 task 는 그 빈칸을 채운다 — `buildRealDataResultIssueGhArgv` 가 argv 를 반환하기 **직전에** `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 를 self-assert 한다. 빌더에는 두 반환 지점(create 분기 · update 분기)이 있으므로 두 지점 모두에서 각자 산출한 argv 를 가드에 넘겨 self-assert 한다. 정상 합성이면 가드는 void 이므로 byte-identical 보존(반환값·동작 불변), 회귀 시 빌더가 손상 argv 를 반환하기 전에 fail-fast throw 한다. 이는 T-0649→T-0650(body 가드 self-wire)·T-0651→T-0652(labels·title 가드 self-wire) 와 **동형 패턴의 argv-side mirror** 다 — T-0653 Follow-up ① 이 명시한 자연 후속 slice. 같은 모듈 디렉토리 함수 호출이라 runtime cycle 0.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-gh-argv.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv.ts) (T-0585) — `buildRealDataResultIssueGhArgv(action, commandArgs)` (L104~) 가 self-wire 대상. **두 반환 지점**에 배선: ① create 분기 — L122 `return argv;` 직전에 `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` self-assert. ② update 분기 — L134~143 의 `return [...]` 을 지역 변수(`const argv = [...]`)로 받아 `return argv;` 직전에 동일 가드 self-assert. 식별자 guard(`assertNonBlank`/`assertPositiveIssueNumber`)·labels 전개 규칙·argv 합성 순서·순수성/결정성 주석 본문 변경 0. command-args 빌더의 self-wire(T-0650/T-0652) 패턴 동형.
- [test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts) (T-0653) — self-wire 할 가드. `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv: string[], action: RealDataResultIssueAction, commandArgs: RealDataResultIssueCommandArgs): void` — 정상이면 void, 불변식 위반(create/update argv 위치 정합·동사 분기 정합·labels round-trip)이면 fail-fast throw(구조 결손=TypeError / 값 정합 위반=RangeError). **본문 변경 0** — 호출만. import 경로는 같은 `test/helpers/` 디렉토리.
- [test/helpers/realdata-e2e-result-issue-gh-argv.spec.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv.spec.ts) — 기존 빌더 colocated spec. 본 task 는 이 파일에 argv 가드 self-wire 검증 describe 를 append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). 기존 fixture·action/commandArgs 생성 패턴 재사용. `jest.spyOn` 으로 가드가 빌더 반환 직전 `(argv, action, commandArgs)` 인자로 호출됨을 검증하는 패턴 참조. T-0653 가드 helper 자체 spec(`...-gh-argv-consistency.spec.ts`) 은 본 task 에서 변경 0.
- 참조만(본문 변경 0): T-0652 의 labels·title self-wire(import 1줄 + 호출 1지점, 반환값/동작 불변) — mirror 할 self-wire 패턴. 본 task 는 빌더에 두 반환 지점이 있어 호출 2지점인 점만 다르다.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-gh-argv.ts` — `buildRealDataResultIssueGhArgv` 가 argv 를 반환하기 **직전에** `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` 를 self-assert. import 1줄 추가 + 호출 2지점 배선(create 분기 `return argv;` 직전 · update 분기 `return [...]` 을 지역 변수로 받아 `return argv;` 직전). 식별자 guard·labels 전개 규칙·argv 합성 순서·순수성/결정성 주석 본문 변경 0.
- [ ] **동작 불변 (byte-identical 보존)** — 정상 action/commandArgs → 가드 void → 빌더가 기존과 byte-identical argv 반환(create·update 양쪽). self-wire 전후 정상 입력 반환값 변화 0(가드는 정상 경로에서 부수효과 0).
- [ ] **회귀 fail-fast** — 빌더 합성이 회귀(argv 위치 정합·동사 분기·labels round-trip 중 하나)하면 빌더가 손상 argv 를 반환하기 **전에** fail-fast throw. 손상 argv 가 caller(live wiring, `execFile('gh', argv)`)로 새 나가지 않음.
- [ ] **순수성·R-59 보존** — self-wire 후에도 빌더는 순수 함수 유지(부수효과 0 · 입력 mutate 0 · 매 호출 새 배열 반환 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · raw 미저장). 가드 호출은 runtime cycle 0(같은 모듈 디렉토리 함수 참조).
- [ ] **Happy-path test 1+**: 정상 action/commandArgs(create 분기 · update 분기 · 다양한 labels 개수(0개·1개·다수)·title/body 변형) → 빌더가 가드 통과 후 정상 argv 반환(throw 0). 반환값이 self-wire 전과 byte-identical. create·update 각 1+.
- [ ] **Error path test 각 1+**: ① create 분기 — `jest.spyOn` 으로 가드를 throw 모사하거나 빌더 회귀를 모사해 self-assert 가 손상 argv 반환 전 throw 함을 검증 ② update 분기 — 동일 검증 ③ 기존 식별자 guard(title/body 빈/공백·issueNumber 비양수) throw 보존(self-wire 가 기존 식별자 guard 동작을 깨지 않음). 각 1+.
- [ ] **Flow/branch test**: ① create 정상 입력 → 가드 void → 정상 argv 반환 분기 ② update 정상 입력 → 가드 void → 정상 argv 반환 분기 ③ 식별자 guard throw 분기(create title/body 빈 · update issueNumber 비양수 각각, self-assert 도달 전 먼저 throw) ④ create 분기에서 가드가 빌더 반환 직전 `(argv, action, commandArgs)` 인자로 호출됨을 `jest.spyOn` 으로 검증 ⑤ update 분기에서 동일 검증 — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 action/commandArgs 2회 빌드 → 둘 다 byte-identical 정상 반환(self-wire 가 결정성 깨지지 않음) ② **입력 비변형** — 빌드 후 입력 action/commandArgs 변경 0 assert ③ **self-wire 호출 인자 정합** — spyOn 으로 가드가 create·update 각 분기에서 빌더 반환 직전 정확히 `(반환할 argv, 원본 action, 원본 commandArgs)` 인자로 1회 호출됨 검증 ④ **식별자 guard 우선** — title/body 빈·issueNumber 비양수 입력 시 가드 self-assert 도달 전 식별자 guard 가 먼저 throw(분기 순서 보존) ⑤ **무공유** — 반환 argv 가 매 호출 새 배열(가드 self-wire 가 무공유 깨지 않음) ⑥ **R-59** — self-wire 후에도 빌더가 raw narrative 미접촉(title/body string 만 전파). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec append** — `test/helpers/realdata-e2e-result-issue-gh-argv.spec.ts` 에 argv 가드 self-wire 검증 describe append(신규 spec 파일 신설 아님 — 기존 빌더 colocated spec 확장). T-0653 가드 helper 자체 spec(`...-gh-argv-consistency.spec.ts`) 은 본 task 에서 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 변경 대상 빌더·spec 의 커버리지 유지(빌더 line/branch/function 100%).
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `assertRealDataResultIssueGhArgvPreservesCommandArgs` (T-0653) 가드 helper **본문 변경** — 본 task 는 그 가드를 빌더 산출 경로에 self-wire 만(호출 2지점 + import 1줄). 가드 로직 변경 0.
- `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649)·`assertRealDataResultIssueCommandArgsLabelsTitleConsistent`(T-0651) command-args 가드 self-wire(T-0650/T-0652) 변경 — 이미 배선됨. 본 task 는 그 한 단계 downstream argv 빌더 self-wire 단독.
- `RealDataResultIssueAction`/`RealDataResultIssueCommandArgs`/`...CreateArgs`/`...UpdateArgs` 타입 정의 변경 — 본 task 는 self-wire 만(타입 재사용).
- `buildRealDataResultIssueGhArgv` 의 argv 합성 규칙(create/update 분기 argv 위치·labels 전개·`String(issueNumber)` 문자열화) 변경 — 본 task 는 가드 self-wire 만, argv shape 불변.
- gh issue 실 호출 · `execFile('gh', argv)` 실 실행 · `gh issue create`/`edit`/`search` 실행 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·argv 재합성 — self-wire 된 가드는 위반 검출 시 fail-fast throw 만(부정합 수선 0).
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 argv 빌더 self-wire 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 argv layer 의 round-trip 정합 불변식이 빌더 산출 직전 self-assert 로 박힌다 — command-args layer 의 body marker-first(T-0649→T-0650)·labels·title(T-0651→T-0652) 가드 self-wire 와 함께 결과 이슈 명령 chain 의 구조 무결성이 descriptor→command-args→argv 3단계 모두 빌더 산출 직전 self-assert 로 닫힌다. 자연 후속 후보: gh issue 실배선 — `execFile('gh', argv)` + `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)

---

## Status: DONE (2026-06-25)

- **결과**: PR #568 squash merge `c28cf95`. reviewer round1 APPROVE (8-check, BLOCKER 0/MAJOR 0/MINOR 0) + 외부 PR comment #4795663890, 4-게이트 PASS, CI green.
- **변경**: `buildRealDataResultIssueGhArgv` 의 create·update 두 반환 지점에 `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)` self-assert 배선 (import 1줄 + 호출 2지점). 정상 입력 byte-identical 보존, 회귀 fail-fast throw. 가드 helper 본문·식별자 guard·labels 전개·argv 합성 순서 변경 0.
- **검증**: 신규 self-wire describe (spec append, 신규 spec 파일 신설 아님). 7641 tests green, 전역 line 99.95%/function 100% (≥80% AND ≥80%). 새 dep 0, migration 0, src 변경 0, raw 미저장(R-59).
- **trail**: commit `c28cf95` body 의 agent-trail blob 참조.
