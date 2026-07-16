---
id: T-1025
title: daily-step issue descriptor identity-consistency 가드(T-1024)를 producer 반환 직전 self-wire 배선 (요약축 T-0710 mirror, 기존 combined 가드 self-assert 옆 identity self-assert 1줄 추가)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts
independentStream: realdata-e2e-daily-report-issue-descriptor
plannerNote: "P5 §109 test-hardening — T-1024 가 신설한 identity 가드를 producer buildRealData...IssueDescriptor 반환 직전 self-wire(기존 combined 가드 T-0989 self-assert 옆). 요약축 T-0710 mirror(body self-assert 옆 identity self-assert). arg order (descriptor, report) 주의 — combined 가드는 (report, descriptor). pre-check: origin/main producer 에 IdentityConsistent 심볼 부재 확인(gap). pr test-only 2파일 dep[] stage5b."
---

# T-1025 — daily-step issue descriptor identity 가드 producer self-wire 배선 (요약축 T-0710 mirror)

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 구조를 요약축(`result-issue-*`)과 동형으로 맞추는 slice 다. 직전 T-1024 가 daily-step issue descriptor 의 title·marker identity(멱등 search-or-update 식별자, REQ-032) 를 run 식별자(`${dateToken}@${gitSha}`)로부터 독립 재유도해 대조하는 전용 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)` 를 **신설만** 했다(PR #918, squash 29493a66). 그 가드는 현재 colocated spec 에서만 검증되고 producer 산출 경로(반환 직전)에는 **미배선**이다.

본 task 는 T-1024 Follow-up ① 이 예고한 **self-wire 짝**을 닫는다 — producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(`test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`, T-0896)의 **단일 return 직전**(약 169행 `return descriptor;`)에 identity 가드를 self-assert 로 배선해, title·marker 식별자 drift(title 과 marker 의 run token 어긋남 / prefix 변형 / marker 가 다른 run token 을 담아 멱등 search-or-update 가 깨지는 회귀)를 build-time fail-fast trip-wire 로 차단한다. spec 커버리지에 의존하지 않는 live 방어를 모든 호출 경로(unit spec·이슈 박제 재사용)에 얻는다.

producer 는 이미 같은 return 직전에 **combined 가드**(T-0988 을 T-0989 에서 self-wire) `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor)` self-assert 를 갖고 있다(약 164~167행). 본 배선은 그 옆에 identity self-assert 1 줄을 더하는 동형 패턴이다 — 요약축 T-0710(PR #626, squash 0b8b9ede)이 컴포저 단일 return 직전 body-consistency self-assert(T-0646) 옆에 identity self-assert(T-0709)를 더한 것과 정확히 동형. combined 가드가 title·marker 를 이미 재유도하는 것과의 overlap 은 본 스트림의 정상 belt-and-suspenders 패턴(전용 focused identity oracle 이 멱등 불변식에 granular 방어를 추가)이며, 요약축도 body/identity 두 self-assert 를 나란히 유지한다.

**⚠️ 인자 순서 주의**: identity 가드 시그니처는 `(descriptor, report)` 이고 기존 combined 가드는 `(report, descriptor)` 로 **인자 순서가 반대**다(가드 신설 시 요약축 T-0709 template 을 따라 descriptor-first). self-wire 시 identity 가드는 반드시 `assertRealData...IdentityConsistent(descriptor, report)` 순서로 호출한다(swap 하면 구조 검증에서 TypeError). Required Reading 에서 양 가드 시그니처를 확인해 순서를 정확히 맞춘다.

issue-still-relevant pre-check(origin/main grep, 본 planner 확인): `git grep -n -i "IdentityConsistent" origin/main -- test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` → **매칭 0**(producer 본체에 identity 가드 self-wire 호출·import 부재 확인 — make-work 아님). 가드 본체 `-issue-descriptor-identity-consistency.ts` + `.spec.ts` 는 origin/main 존재(T-1024 머지). 본 task 는 그 가드를 producer return-path 에 배선만.

circular-dep 부재: T-1024 identity 가드는 producer 로부터 **type-only import**(`import type { RealDataDailyStepDualLegRunReportIssueDescriptor, RealDataDailyStepDualLegRunReport }`)만 쓰고 prefix 상수는 독립 재정의(`EXPECTED_ISSUE_TITLE_PREFIX`·`EXPECTED_ISSUE_MARKER_PREFIX`·`MARKER_CLOSE_TOKEN`)한다 — producer 의 runtime value 를 import 하지 않는다. type-only import 는 컴파일 시 erase 되므로 producer 가 가드를 top-level import 해도 CommonJS 런타임 순환 의존이 형성되지 않는다(기존 combined 가드 T-0988 도 동일하게 top-level import 되어 있음 — 본 task 는 그 import 블록에 1 줄, return 직전 self-assert 1 줄 추가).

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896, 대상 producer — 본 task 에서 배선 수정) — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 는 **단일 return 사이트**(약 169행 `return descriptor;`)를 가진다. 그 직전(약 159~167행)에 이미 combined 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor)` self-wire(T-0989) 가 있음 — 본 task 의 identity self-assert 는 그 옆(동일 위치, return 직전)에 둔다. 기존 import 블록(79~81행)에 identity 가드 import 1 줄 추가. **descriptor 객체는 약 157행에서 `const descriptor = { title, marker, body }` 로 이미 조립돼 있음** — 그 descriptor 를 identity 가드에 넘긴다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts` (T-1024, 호출할 가드 — 읽기만, 수정 금지) — 시그니처: `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor, report: RealDataDailyStepDualLegRunReport): void` (약 208행 export). **인자 순서 = (descriptor, report)** — combined 가드(report, descriptor)와 반대이므로 반드시 확인. title·marker drift → RangeError, 구조·타입 결손 → TypeError, gitSha/dateToken 빈/공백 → Error. producer 로부터 type-only import 만 쓰므로 top-level import 에 circular dep 없음.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` (T-0896, producer colocated spec — 본 task 에서 self-wire 검증 describe 추가) — 기존 combined 가드 self-wire 검증 describe(T-0989)의 spy 호출 증명·throw 전파 패턴을 참고해 identity self-wire 검증 describe 를 동형으로 추가한다.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` + `.spec.ts` (요약축 T-0710 self-wire 선례 — 참조만) — 단일 return 직전 body self-assert 옆 identity self-assert 배선 + top-level import 패턴, spec 의 spy 호출 증명(양 가드 모두 1 회 호출됨) + throw 전파 검증 방식을 참고. 본 task 의 단일-return 구조와 동형.

## Acceptance Criteria

- [ ] producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 의 **단일 return 직전**(기존 combined 가드 self-assert T-0989 옆)에 `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)` self-assert 를 추가한다 — **인자 순서 (descriptor, report)** 정확히(combined 가드의 (report, descriptor)와 swap 금지). 정상 합성이면 가드는 void 반환하므로 동작·반환값 byte-identical 보존.
- [ ] producer 는 identity 가드를 **top-level import**(`import { assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency"`) 한다 — 가드가 producer 로부터 type-only import 만 쓰므로 circular dep 없음(lazy require 불요). 가드 본체(T-1024) 수정 0. combined 가드 self-wire(T-0989) 및 그 import 는 그대로 유지(제거·변경 0).
- [ ] **Happy-path unit test 1+**: 정상 `report` 입력(비어있지 않은 gitSha/dateToken, 다양한 leg status 조합) 시 identity self-assert 가 throw 없이 통과하고, 반환 descriptor(`{ title, marker, body }`) 가 self-wire 전과 byte-identical(기존 happy-path 회귀 없음). 동일 run 이면 leg status 가 달라도 동일 title·marker(멱등) 검증 1+.
- [ ] **Error path unit test 1+**: identity self-assert 가 실제로 호출됨을 증명 — `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent` 를 jest spy/mock 으로 가로채 producer 가 그것을 정상 경로에서 **1 회, (descriptor, report) 인자로** 호출함을 검증(인자 순서 회귀 차단).
- [ ] **Flow / branch coverage**: producer 는 단일 return 경로(분기 없음 — `assertNonBlank` 빈/공백 거부는 return 도달 전 throw). 따라서 (1) 정상 경로(양 self-assert 통과 후 return) 와 (2) `assertNonBlank` 거부 경로(빈/공백 gitSha·dateToken → identity self-assert 도달 전 throw)를 각각 cover. self-assert 자체에 분기 없음 → "분기 없음 — 가드 호출/throw 전파로 cover" 명시.
- [ ] **Negative cases 충분 cover (각 1+ test)**: (a) identity 가드를 spy 로 RangeError throw 시키면 producer 가 삼키지 않고 전파(값 정합 위반 시 손상 descriptor 미반환). (b) identity 가드를 spy 로 TypeError throw 시키는 구조 결손 시나리오 전파. (c) combined 가드(T-0989)와 identity 가드가 **둘 다** return 직전에 호출됨을 검증(한쪽만 배선한 회귀 차단 — 두 spy 모두 1 회 호출 확인). (d) 빈/공백 gitSha·dateToken report → producer `assertNonBlank` 가 identity self-assert 도달 전에 거부(throw)함을 검증. 단일 negative 만 작성 금지 — 분기마다 cover.
- [ ] 기존 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.spec.ts` 의 기존 test 가 회귀 없이 모두 통과(self-wire 가 정상 입력에서 반환값/순수성을 바꾸지 않음).
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. identity 가드 본체(T-1024)·combined 가드(T-0988)·마크다운 renderer(T-0895)·컴포저(T-0894) 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%) — producer `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` cov 보존(가급적 100%). 전체 unit suite green.

## Out of Scope

- identity 가드 본체 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts`(T-1024) 수정 — 본 task 는 producer 배선 + producer colocated spec self-wire 검증 describe 추가만. 가드 로직(독립 재유도·byte-identical 대조·에러 정책·빈/공백 거부) 변경 0.
- combined 가드 self-wire(T-0989) 및 그 import·호출 변경/제거 0 — 그대로 유지(본 task 는 identity self-assert 를 그 옆에 추가만). combined 가드를 body-focus 로 좁혀 요약축 disjoint 구조를 완전 복원하는 것은 **후속 slice**(T-1024 Follow-up ②).
- `ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX`·`runToken` 합성 규칙·`assertNonBlank` 정책 변경 0(반환 결과 byte-identical 보존).
- lazy require 도입 금지 — 본 가드는 circular dep 없으므로 top-level import 가 정합.
- 마크다운 renderer(T-0895)·컴포저(T-0894) 본문 수정 0 — read-only.
- body 3 블록 구조 재검증·publish-plan(T-1016~T-1023)·command-plan·command-args·search·outcome-report seam 변경 0 — 별도 seam.
- 종단 post-execution gh-command-plan(T-0997) seam 변경 0 — 별개 seam(post-실행 leg).
- 실 gh 호출 / `gh search issues` 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code 변경 / DB write·migration / live LLM 호출 / zod·ajv 등 외부 validation 라이브러리 도입 — 전부 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: combined 가드 T-0988 을 body-focus 로 좁혀(title·marker 재유도를 identity oracle 로 위임/제거) 요약축의 body/identity disjoint 2-가드 구조를 daily 축에 완전 복원 — 그러면 descriptor 축까지 양축 완전 disjoint 동형(T-1024 Follow-up ②). 예상 후속 ②: descriptor 축 self-wire 완결 후, 요약축 대비 아직 남은 issue-박제 sub-helper vein 의 구조 미동형 축 재survey(build-time chain 정합 봉합이 거의 완결됐으므로 다음 자연 stream 은 live 도달). 예상 후속 ③: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉(§5 게이트, 사용자 승인 필요).

---

**완료 (2026-07-16T06:04:56Z)** — PR #919 merged (squash 2f642584). identity 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)` 를 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 단일 return 직전에 self-assert 배선(기존 combined 가드 self-assert 옆) + top-level import 1줄. arg order (descriptor, report) — combined 가드(report, descriptor)와 반대, spy+TS 로 swap 방지. test-only 2파일(+237/-0), src·CI·dep 0, 403 suite/10927 test green, threshold 무회귀. reviewer round1 APPROVE(0/0/0) 4-게이트 PASS. claim prune([]). next=T-1026.
