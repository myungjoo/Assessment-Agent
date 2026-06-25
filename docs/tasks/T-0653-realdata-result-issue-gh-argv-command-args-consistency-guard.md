---
id: T-0653
title: 실 평가 e2e 결과 이슈 gh argv 가 명령-args 를 정합 전파하는지 검증하는 순수 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005]
estimatedDiff: 170
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — buildRealDataResultIssueGhArgv(T-0585) 산출 argv 가 명령-args 의 title/body/labels 를 argv 위치로 정합 round-trip 하는지 검증하는 가드 신설. T-0649(command-args body 가드)의 argv-side mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts
  - test/helpers/realdata-e2e-result-issue-gh-argv-consistency.spec.ts
---

# T-0653 — gh argv 가 명령-args 를 정합 전파하는지 검증하는 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 argv-layer 구조 무결성 보강 slice. realdata-e2e-result-summary-line stream 은 한 줄 요약 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·descriptor body 3블록 구조 가드 신설(T-0646)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)·command-args body marker-first 가드 신설(T-0649)·그 가드 builder self-wire(T-0650)·command-args labels·title 정합 가드 신설(T-0651)·그 가드 builder self-wire(T-0652)까지 닿았다. 이로써 **명령-args layer** 의 두 구조 불변식(body marker-first + labels·title)이 모두 빌더 산출 직전 self-assert 로 박혔다.

그 한 단계 downstream 인 **argv layer** — `buildRealDataResultIssueGhArgv(action, commandArgs)` (T-0585, `realdata-e2e-result-issue-gh-argv.ts`) — 는 action(create/update) + 명령-args 를 실 `gh` 명령에 그대로 넘길 인자-벡터(argv, `string[]`)로 변환한다. 이 빌더는 `assertNonBlank`·`assertPositiveIssueNumber` 같은 **inline 식별자 guard 만** 보유하고, **산출 argv 가 입력 명령-args 의 title/body/labels 를 argv 의 올바른 위치로 정합 round-trip 했는지 검증하는 독립 불변식 가드는 부재** 하다. 즉 빌더가 회귀(예: `--title` flag 뒤 값이 body 와 뒤바뀌거나, labels flag-pair 의 순서·개수가 어긋나거나, create 분기인데 `issue edit` argv 가 나오는 등)해도 argv 구조 불변식을 런타임에서 강제하는 가드가 없어, 손상 argv 가 `execFile('gh', argv)` live wiring 으로 새면 잘못된 gh 명령이 실행된다.

본 task 는 그 빈칸을 채운다 — argv layer 의 구조 불변식을 검증하는 **순수 가드 helper 를 신설** 한다: `assertRealDataResultIssueGhArgvPreservesCommandArgs(argv, action, commandArgs)`. 정상이면 void, 위반이면 (구조 결손 = TypeError / 값 정합 위반 = RangeError) 한국어 명세형 에러로 fail-fast throw. 이는 T-0649(command-args body marker 가드 신설)·T-0651(labels·title 가드 신설)과 **동형 패턴의 argv-side mirror** 이며, T-0585 빌더 산출물에 대한 자연 후속 구조 가드 slice 다. 본 task 는 **가드 신설만** — `buildRealDataResultIssueGhArgv` 산출 경로 self-wire 는 별도 후속(T-0650/T-0652 이 가드를 self-wire 한 것과 동형 패턴, 본 task 의 Follow-up 으로 박제).

본 slice 는 build-time 순수·dependency-free 라 live wiring(`execFile`) deferred(LAN/credential gate, PLAN 108~109행)와 독립이다 — argv 의 실 실행이 아니라 argv 구조 정합 검증이므로 credential 0 으로 cloud cron 자율 진행 가능하다.

## Required Reading

- [test/helpers/realdata-e2e-result-issue-gh-argv.ts](../../test/helpers/realdata-e2e-result-issue-gh-argv.ts) (T-0585) — 가드가 검증할 빌더 산출 argv 의 정확한 shape. create 분기: `["issue", "create", "--title", createArgs.title, "--body", createArgs.body, ...("--label", <label>) 순서 전개]`. update 분기: `["issue", "edit", String(issueNumber), "--title", updateArgs.title, "--body", updateArgs.body]`. **본 task 는 이 파일을 변경하지 않는다** — 입력 타입을 import 재사용 + argv 구조 기준만 참조. self-wire 도 본 task 범위 밖(Follow-up).
- [test/helpers/realdata-e2e-result-issue-action.ts](../../test/helpers/realdata-e2e-result-issue-action.ts) (T-0584) — `RealDataResultIssueAction` 타입(`action: 'create' | 'update'`, update 시 `issueNumber`) import 재사용. 가드의 분기(create/update) 판정 기준. 본문 변경 0.
- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) (T-0583) — `RealDataResultIssueCommandArgs`(searchQuery / createArgs{title,body,labels} / updateArgs{title,body}) 타입 import 재사용. 가드의 title/body/labels round-trip 검증 기준(single source). 본문 변경 0.
- [test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts](../../test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts) (T-0649) — mirror 할 **참조**: 순수 가드 helper 의 구조(구조 결손 = TypeError / 값 정합 위반 = RangeError 구분 · null/undefined fail-fast 한국어 TypeError · import 타입 재사용 · 한국어 JSDoc·책임 경계 주석 · 자동 복구 0 · 산출 경로 자동 배선 0). 본 task 가 신설할 argv 가드는 이 가드의 에러 정책·관례·JSDoc 톤을 mirror 한다. **본 가드 본문 변경 0**(참조만).
- [test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts](../../test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts) (T-0649) — mirror 할 spec 구조 참조: 정상 통과(void)·각 불변식 위반별 throw·결정성·비변형·negative 분기 cover 패턴. 신설 spec 은 colocated(`...-gh-argv-consistency.spec.ts`).

## Acceptance Criteria

- [ ] **신규 가드 helper 파일** `test/helpers/realdata-e2e-result-issue-gh-argv-consistency.ts` 신설 — `export function assertRealDataResultIssueGhArgvPreservesCommandArgs(argv: string[], action: RealDataResultIssueAction, commandArgs: RealDataResultIssueCommandArgs): void`. 정상이면 void, 불변식 위반이면 한국어 명세형 에러로 fail-fast throw. 입력 타입은 T-0584/T-0583 helper 에서 import 재사용(신규 type 0).
- [ ] **create 분기 정합 검증** — `action.action === 'create'` 일 때: argv 가 `["issue", "create"]` 로 시작하고, `--title` 다음 원소가 `commandArgs.createArgs.title` 와 byte-identical, `--body` 다음 원소가 `commandArgs.createArgs.body` 와 byte-identical, 이어지는 `--label`/<label> flag-pair 들이 `commandArgs.createArgs.labels` 와 순서·개수·원소까지 정확히 일치함을 검증. 어긋나면 어느 위치·어느 값이 drift 했는지 명시한 한국어 RangeError 로 throw.
- [ ] **update 분기 정합 검증** — `action.action === 'update'` 일 때: argv 가 `["issue", "edit", String(action.issueNumber)]` 로 시작하고, `--title` 다음 원소가 `commandArgs.updateArgs.title` 와, `--body` 다음 원소가 `commandArgs.updateArgs.body` 와 byte-identical 임을 검증. issueNumber 문자열화 정합(`String(issueNumber)`) 포함. 어긋나면 한국어 RangeError 로 throw.
- [ ] **분기 정합 검증** — argv 의 동사(`create` vs `edit`)가 `action.action`(`create` vs `update`)과 일치함을 검증. create action 인데 argv 가 `issue edit` 로 나오거나 그 반대면 한국어 RangeError 로 throw.
- [ ] **구조 결손 = TypeError** — `argv`(null/undefined·비배열·원소 비-string)·`action`(null/undefined)·`commandArgs`(null/undefined·필수 하위 필드 비-string) 결손은 RangeError 가 아니라 한국어 TypeError 로 구분 throw(값 정합 위반과 분리).
- [ ] **순수성·부수효과 0·runtime cycle 0** — 가드는 입력(`argv`/`action`/`commandArgs`)을 읽기만(mutate 0)·반환값 0(void)·매 호출 동일 판정(결정성)·`@Injectable` 0·Prisma 0·LLM 0·새 외부 dependency 0. 같은 디렉토리 타입 import 라 runtime cycle 0. raw 미저장(R-59) — title/body/label string 만 비교(narrative/raw 본문 미접촉).
- [ ] **Happy-path test 1+**: 정상 argv(T-0585 빌더가 산출한 create argv + 그 입력 action/commandArgs) → 가드 void(throw 0). update argv 경로도 1+. 다양한 labels 개수(0개·1개·다수)·title/body 변형 포함.
- [ ] **Error path test 각 1+**: ① create argv 의 `--title` 값이 createArgs.title 와 불일치 → throw ② `--body` 값이 createArgs.body 와 불일치 → throw ③ labels flag-pair 순서변경/누락/추가 → throw ④ update argv 의 `--title`/`--body` 값 불일치 → throw ⑤ update argv 의 issueNumber 문자열이 action.issueNumber 와 불일치 → throw ⑥ 동사 불일치(create action 인데 `issue edit` argv) → throw. 각 1+.
- [ ] **Flow/branch test**: 가드 안 각 분기(create 분기 정합 · update 분기 정합 · 동사 분기 판정 · 정상 void 분기 · 구조 결손 TypeError 분기)마다 1+ test 로 분기 격리. 어느 분기가 throw 했는지 에러 메시지로 식별 가능(RangeError vs TypeError 구분 assert 포함).
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 입력 2회 호출 → 둘 다 동일 판정(정상→void, 위반→동일 throw) ② **입력 비변형** — 가드 호출 후 argv/action/commandArgs 변경 0 assert(읽기만) ③ **빈 labels 경계** — createArgs.labels 가 빈 배열이고 argv 에 `--label` flag-pair 가 0개면 void, argv 에 잉여 `--label` 이 있으면 throw ④ **부분/초과 labels 거부** — argv 의 label flag-pair 가 createArgs.labels 의 진부분집합/초과집합이면 throw(정확 일치만 통과) ⑤ **공백·대소문자 민감** — title/body/label 비교는 byte-identical(trim·case-fold 0) ⑥ **R-59** — 가드가 raw narrative 미접촉(title/body string 비교만). 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — `test/helpers/realdata-e2e-result-issue-gh-argv-consistency.spec.ts` 신설(신규 가드 helper 의 colocated spec). 실제 `buildRealDataResultIssueGhArgv`(T-0585) 산출 argv 를 happy-path fixture 로 재사용해 round-trip 정합을 교차 검증(빌더↔가드 paired test). 신규 가드 helper line/branch/function 100%.
- [ ] `pnpm lint && pnpm build && pnpm test` green.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `buildRealDataResultIssueGhArgv` (T-0585) 산출 경로에 본 신규 가드 self-wire — 본 task 는 **가드 신설만**(T-0649/T-0651 이 가드를 신설만 하고 T-0650/T-0652 이 self-wire 한 것과 동형 분리). self-wire 는 본 task 의 Follow-up.
- `test/helpers/realdata-e2e-result-issue-gh-argv.ts` 본문 변경(빌더·inline 식별자 guard·labels 전개 규칙) — 본 task 는 신규 가드 helper + spec 단독, 입력 타입 import 재사용만.
- `RealDataResultIssueAction`/`RealDataResultIssueCommandArgs`/`RealDataResultIssueCreateArgs`/`RealDataResultIssueUpdateArgs` 타입 정의 변경 — 본 task 는 가드 신설만(타입 재사용).
- `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649)·`assertRealDataResultIssueCommandArgsLabelsTitleConsistent`(T-0651) command-args 가드 본문·spec 변경 — 본 task 는 그 한 단계 downstream 인 argv layer 가드 신설 단독(command-args↔descriptor 정합은 그 가드들이 이미 cover).
- `--repo owner/repo` 인자 / repo slug 정합 검증 — T-0585 빌더가 issue create/edit 핵심 인자만 산출하고 repo 컨텍스트는 caller 책임(본 가드는 빌더가 실제 산출하는 argv 범위만 검증).
- 실 gh 호출 / `execFile('gh', argv)` 실 실행 / `gh issue create`·`edit`·`search` 실행 / `deploy/daily-test.sh` step_eval 배선 / 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·argv 재합성·silent 수선 — 가드는 위반 검출 시 fail-fast throw 만(수선 0).
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 — 순수 배열·string 비교만.
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독.
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 argv layer 가드 신설 단독.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 argv layer 의 round-trip 정합 불변식이 순수 가드로 박힌다 — command-args layer 의 body marker-first(T-0649)·labels·title(T-0651) 가드와 함께 결과 이슈 명령 layer 의 구조 무결성이 descriptor→command-args→argv 3단계로 닫힌다. 자연 후속 후보: ① **argv 가드 builder self-wire** — `buildRealDataResultIssueGhArgv` 가 argv 반환 직전 본 신규 가드를 self-assert(T-0650/T-0652 이 command-args 가드를 self-wire 한 것과 동형 패턴). ② gh issue 실배선 — `execFile('gh', argv)` + `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
