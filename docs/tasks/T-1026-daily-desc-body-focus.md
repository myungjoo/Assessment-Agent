---
id: T-1026
title: daily-step issue descriptor combined 가드(T-0988)를 body-focus 로 좁혀 title·marker 재유도를 identity oracle 에 위임 (요약축 body-consistency mirror, disjoint 2-가드 구조 복원)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts
independentStream: realdata-e2e-daily-report-issue-descriptor
plannerNote: "P5 §109 test-hardening — combined 가드 T-0988 을 body-focus 로 좁혀 title·marker 독립 재유도를 identity oracle(T-1024, T-1025 로 producer self-wire 완료)에 위임. 요약축 -body-consistency mirror 로 daily 축 body/identity disjoint 2-가드 구조 복원. pre-check: origin/main combined 가드가 title(122행)·marker(124행) 재유도·대조(181~190행) 유지 확인(gap). pr test-only 2파일 dep[] stage5b."
---

# T-1026 — daily-step issue descriptor combined 가드 body-focus 축소 (요약축 body-consistency mirror)

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** build-time chain 정합 구조를 요약축(`result-issue-*`)과 완전 동형으로 맞추는 마무리 slice 다. 요약축은 descriptor 정합을 **두 개의 disjoint 가드**로 나눠 갖고 있다 — `realdata-e2e-result-issue-descriptor-body-consistency.ts`(T-0646, body 블록 구조 전담; `title`/`marker` 자체 재유도 **하지 않음** — marker 는 body 첫 라인과의 일치만 비교) + `realdata-e2e-result-issue-descriptor-identity-consistency.ts`(T-0709, title·marker 식별자 재유도 전담). daily 축은 이와 달리 **combined 가드**(T-0988, `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`)가 title·marker·body 세 필드를 모두 재유도·대조하고, 그 위에 **identity 가드**(T-1024)를 나중에 추가해 title·marker 재유도가 **양 가드에 중복** 존재한다.

직전 T-1025(PR #919, squash 2f642584)가 identity 가드를 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 반환 직전에 self-wire 배선했으므로, 이제 title·marker 식별자 정합은 identity 가드가 **live 트립와이어로 이미 담당**한다. 따라서 combined 가드의 title·marker 재유도는 순수 잉여이며, 이를 제거해 combined 가드를 **body-focus 로 좁히면** daily 축이 요약축과 정확히 동형인 body/identity disjoint 2-가드 구조로 복원된다(T-1025 Follow-up ① / T-1024 Follow-up ②).

issue-still-relevant pre-check(origin/main grep, 본 planner 확인): combined 가드 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` 는 origin/main 에서 `composeExpectedDescriptor` 안에 `title = ${ISSUE_TITLE_PREFIX} ${token}`(122행)·`marker = ${ISSUE_MARKER_PREFIX} ${token} -->`(124행)를 재유도하고 `descriptor.title !== expected.title`(181행)·`descriptor.marker !== expected.marker`(186행) RangeError 분기를 유지한다 → **title·marker 재유도 중복이 실재**(make-work 아님). identity 가드(T-1024)는 이미 producer 에 self-wire(T-1025) 돼 title·marker 를 live 로 재유도·대조하고 있어 combined 가드에서 그 로직을 제거해도 live 방어 손실 0.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` (T-0988, 본 task 에서 body-focus 로 좁힐 대상 가드) — `composeExpectedDescriptor`(118~132행)가 title·marker·body 를 재유도하고, export 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent(report, descriptor, label?)`(162행)가 title(181행)·marker(186행)·body(191행) 3 필드 RangeError 대조를 수행한다. body 는 2 블록 구조 `[marker, "", renderMarkdown(report)].join("\n")`(126~130행).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.spec.ts` (T-0988 colocated spec — 본 task 에서 함께 갱신) — title/marker RangeError 케이스를 body-focus 로 재편(제거 또는 body-first-line 검증으로 대체).
- `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` (요약축 T-0646, body-focus mirror 선례 — 읽기만, 수정 금지) — 책임 경계 주석(35~36행): "`title` / `marker` 자체 구조 검증 0 — 본 가드는 body 3 블록 구조에 한정 (marker 는 body 첫 라인과의 일치만 비교, marker 합성 규칙 자체 재검증 아님)". daily 축은 body **2 블록**(marker → 빈 줄 → markdown)이므로 요약축의 3 블록을 2 블록으로 축소 적용한다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts` (T-1024, title·marker 재유도를 위임받는 identity oracle — 읽기만, 수정 금지) — combined 가드가 놓게 될 title·marker 식별자 정합을 이 가드가 전담하고 있음을 확인(중복 제거 안전성 근거).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896 producer — 읽기만, 수정 금지) — combined 가드(165~168행 self-wire)와 identity 가드(179행~ self-wire, T-1025) 가 **둘 다** producer 반환 직전에 배선돼 있음을 확인. 본 task 는 combined 가드 로직만 좁히고 **producer self-wire 배선은 변경 0**(combined 가드는 여전히 body 를 검증하므로 호출 유지).

## Acceptance Criteria

- [ ] combined 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent` 를 **body-focus 로 좁힌다**: `composeExpectedDescriptor` 의 title 재유도(`${ISSUE_TITLE_PREFIX} ${token}`)와 marker 를 runToken 으로 재유도하는 로직을 **제거**하고, body 재유도만 남긴다. title RangeError 대조(181행) 제거. marker 는 요약축과 동형으로 **body 첫 라인과의 일치만 비교**(marker prefix·runToken·`-->` 종결 규약 자체 재유도는 identity oracle 에 위임 — combined 가드에서 재구현 0).
- [ ] body 검증은 유지: `descriptor.body` 가 report 로부터 재유도한 2 블록 구조(`[<marker 라인>, "", renderMarkdown(report)].join("\n")`)와 byte-identical 함을 RangeError 로 대조. body 첫 블록(첫 라인) == `descriptor.marker` 일치 검증 유지(marker 가 body 안에 정확히 1 회 최상단 등장). markdown 블록은 렌더러 T-0895 위임(재구현 0).
- [ ] 파일·함수 상단 주석과 JSDoc 을 body-focus 책임으로 갱신 — title·marker 재유도를 identity oracle(T-1024)에 위임했음을 명시(요약축 body-consistency 35~36행 톤 mirror). 함수명·파일명·export 시그니처는 **유지**(producer import·self-wire 배선 무변경 위해) — 개명은 Follow-up.
- [ ] **Happy-path unit test 1+**: 정상 `report`(비어있지 않은 gitSha/dateToken, 다양한 leg status·overallStatus 조합) 에서 body-focus 가드가 throw 없이 통과. 동일 run 이면 body 2 블록 구조·marker-첫라인 일치가 status 무관하게 정합함을 검증 1+.
- [ ] **Error path unit test 1+**: body drift(markdown 블록 오염 / 빈 줄 구분 결손 / marker 라인이 body 첫 라인과 불일치)에 RangeError 전파 검증. descriptor null/undefined·비-객체·body 비-string 구조 결손에 TypeError 검증(구조 vs 값 분리 유지).
- [ ] **Flow / branch coverage**: 좁혀진 가드의 각 분기 cover — (1) 구조 검증 TypeError 분기(body/marker 필드 결손), (2) 비식별 식별자 assertNonBlank Error 분기(빈/공백 gitSha·dateToken), (3) body 정합 RangeError 분기, (4) 정상 void 반환 분기. **title 재유도 분기가 제거됐으므로 title RangeError 케이스는 삭제**(더 이상 combined 가드 책임 아님 — identity oracle 로 이동).
- [ ] **Negative cases 충분 cover (각 1+ test)**: (a) body markdown 블록 drift → RangeError. (b) body 빈 줄 구분(2 블록 사이) 결손 → RangeError. (c) marker 가 body 첫 라인과 불일치 → RangeError(또는 marker 결손 시 해당 정책 분기). (d) 빈/공백 gitSha·dateToken → assertNonBlank Error(재유도 전 차단). (e) descriptor 구조 결손(body 비-string) → TypeError. 단일 negative 만 작성 금지 — 분기마다 cover. **회귀 방지**: title·marker 식별자 정합은 이제 combined 가드가 검증하지 **않음**을 명시적으로 못 박는 test 1+(예: title 이 drift 해도 body-focus 가드는 통과 — identity oracle 이 별도로 잡음). 
- [ ] 기존 combined 가드 colocated spec 의 title·marker 재유도 대조 test 는 **제거 또는 body-first-line 검증으로 재편**(identity oracle 로 책임 이동). identity 가드(T-1024)의 spec 은 **변경 0**(그 가드는 이미 title·marker 를 검증). producer(T-0896)의 self-wire 검증 spec 은 **변경 0**(combined 가드는 여전히 호출됨 — body 검증 유지).
- [ ] `src/` 무변경(test helper 단독). identity 가드 본체(T-1024)·producer(T-0896)·마크다운 renderer(T-0895)·컴포저(T-0894) 본문 변경 0. `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%) — 좁혀진 combined 가드 파일 cov 보존(가급적 100%, 제거한 title 분기로 인한 미커버 라인 0). 전체 unit suite green.

## Out of Scope

- identity 가드 본체 `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts`(T-1024) 수정 — 이 가드가 title·marker 식별자 정합을 이미 전담. 본 task 는 combined 가드에서 title·marker 재유도를 **제거**만(identity 가드에 로직 추가·이동 0 — 이미 존재).
- producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896) 본문·self-wire 배선 변경 0 — combined 가드는 좁혀진 뒤에도 body 를 검증하므로 self-wire 호출(165~168행)은 유지. identity self-wire(T-1025, 179행~)도 유지. producer 산출 descriptor 는 byte-identical 보존.
- combined 가드 함수명·파일명·export 시그니처 개명 0 — 요약축은 `-body-consistency` 로 명명돼 있으나, 개명은 producer import·self-wire·spec 다수 파일을 건드려 blast radius 를 키운다. 본 task 는 **behavior 축소만**(body-focus). `-consistency` → `-body-consistency` 개명은 별도 Follow-up slice(원하면).
- `ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX`·`runToken` 합성 규칙·`assertNonBlank` 정책 변경 0(body 재유도에 필요한 marker prefix·runToken 은 identity oracle 이 검증하므로 combined 가드는 body 안 marker 라인 위치·markdown 위임만 검증).
- 마크다운 renderer(T-0895)·컴포저(T-0894) 본문 수정 0 — read-only.
- publish-plan(T-1016~T-1023)·command-plan·command-args·search·outcome-report seam 변경 0 — 별도 seam.
- 종단 post-execution gh-command-plan(T-0997) seam 변경 0 — 별개 seam(post-실행 leg).
- 실 gh 호출 / `gh search issues` 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- `src/` production code 변경 / DB write·migration / live LLM 호출 / zod·ajv 등 외부 validation 라이브러리 도입 — 전부 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: combined 가드 개명(`-consistency` → `-body-consistency`) 으로 파일명까지 요약축과 완전 동형화 — producer import·self-wire·spec 다수 파일 동시 갱신(별도 slice, blast radius 관리). 예상 후속 ②: descriptor 축 body/identity disjoint 2-가드 구조가 완전 복원됐으므로, 요약축 대비 아직 남은 issue-박제 sub-helper vein 의 구조 미동형 축 재survey(build-time chain 정합 봉합이 거의 완결 → 다음 자연 stream 은 live 도달). 예상 후속 ③: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉(§5 게이트, 사용자 승인 필요).
