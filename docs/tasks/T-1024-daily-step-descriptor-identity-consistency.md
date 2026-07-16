---
id: T-1024
title: daily-step issue descriptor 의 title·marker 를 run 식별자(dateToken@gitSha)로부터 독립 재유도해 정합 검증하는 전용 identity-consistency 순수 가드 신설 (요약축 T-0709 mirror, REQ-032 멱등 불변식 focused oracle, body 축과 disjoint)
phase: P5
status: DONE
mergedAs: 29493a668411bd76ec24edb22790911d88abb523
prNumber: 918
reviewRounds: 1
completedAt: 2026-07-16T05:37:35Z
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 560
estimatedFiles: 2
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.spec.ts
independentStream: realdata-e2e-daily-report-issue-outcome-report
sizeExempt: true
exemptReason: "consistency 가드 신설(독립 oracle + comprehensive spec) 카테고리 — 요약축 T-0709 mirror 로 guard ~210 LOC + colocated spec ~350 LOC. 스트림 선례 guard신설(T-1017 실측 653, T-1020 실측 760, T-1016 490, T-1019 430) 이 전부 sizeExempt 로 통과. 2 파일 file-disjoint, split 불가(가드+짝 spec 원자)."
plannerNote: "P5 §109 test-hardening — daily-step issue descriptor 의 title·marker identity(멱등 search-or-update, REQ-032) 를 전용 독립 oracle 로 검증. 요약축은 descriptor consistency 를 body(T-0646)·identity(T-0709) 2 disjoint 가드로 분리하나 daily 는 combined 가드(T-0988) 뿐 → genuine 구조 미동형 gap(pre-check: origin/main daily 에 DescriptorIdentityConsistent 부재 확인). pr test-only 2파일 file-disjoint dep[] stage5b 병렬-claimable, guard신설 sizeExempt."
---

# T-1024 — daily-step issue descriptor identity-consistency 전용 순수 가드 신설 (요약축 T-0709 mirror)

## Why

[PLAN.md](../PLAN.md) 109행(실 github myungjoo/leemgs 공개 활동 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 **step ④ 결과 박제 leg** 의 build-time chain 정합 구조를 요약축(`result-issue-*`)과 동형으로 맞추는 slice. 직전 T-1016~T-1023 이 command-args·search·publish-plan·command-plan 층을 전부 "consistency 가드 + self-wire + 위임" 삼단으로 요약축과 동형화했다. 본 task 는 아직 남은 **마지막 구조 미동형 축** — descriptor 층의 identity(title·marker 멱등 식별자) 검증을 전용 독립 oracle 로 분리 — 을 요약축과 맞춘다.

요약축은 issue descriptor 정합을 **2 개의 disjoint 순수 가드**로 나눈다:
- `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646) — `descriptor.body` 의 3 블록 구조(marker → 빈 줄 → 한 줄 요약 → 빈 줄 → markdown) 불변식만 검증. **title·marker 합성 규칙 재검증은 책임 경계에서 명시적으로 제외**(body 축 전담).
- `assertRealDataResultIssueDescriptorIdentityConsistent`(T-0709) — 위 body 가드가 비운 자리를 채운다. `descriptor.title`·`descriptor.marker` 가 run 식별자(`${dateToken}@${gitSha}`)로부터 **독립 재유도**한 expected 와 byte-identical 정합한지 검증하는 **전용 identity oracle**. 멱등 search-or-update(REQ-032)의 핵심 — title 과 marker 가 동일 run token 을 공유해야 rolling 이슈가 멱등하게 매칭된다 — 을 focused 하게 지킨다.

daily-step 축은 이 identity 검증을 **전용 oracle 로 갖고 있지 않다**. 현재 daily descriptor 정합은 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`(T-0988) 단일 combined 가드가 `{title, marker, body}` 를 한꺼번에 재유도·대조한다. 즉 요약축이 body 축과 **분리**해 유지하는 idempotency(identity) 전용 oracle 이 daily 축에는 부재하다. issue-still-relevant pre-check(origin/main grep): daily helper 에 `DescriptorIdentityConsistent` 심볼 **부재** 확인 → genuine 구조 미동형 gap(중복 아님). 요약축 body 가드가 title·marker 를 재유도하지 않음(disjoint) 확인.

본 task 는 그 빈 자리를 채운다 — `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)` 전용 순수 가드를 신설한다. producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896)를 **재호출하지 않고**, combined 가드(T-0988)를 **import 하지 않고**, `report` 의 gitSha·dateToken 만으로 expected title·marker 를 **독립 재구현 재유도**한 뒤 실제 descriptor 의 title·marker 와 byte-identical 대조한다. body 3 블록 구조는 본 가드의 관심사가 아니다(combined 가드 T-0988 및 마크다운 renderer domain 이 담당 — 본 identity oracle 은 title·marker 축만).

동형화의 실익: (1) 요약축이 유지하는 body/identity **관심사 분리**(separation of concerns)를 daily 축에 복원 — idempotency(REQ-032) 불변식이 body-structure 불변식과 독립적으로 진화·검증 가능한 전용 oracle 을 얻는다. (2) 이 스트림의 defense-in-depth 독립 oracle 철학과 정합 — 스트림의 모든 가드(예: publish-plan consistency T-1017 은 composer 자기 합성과 overlap)는 producer 와 coverage 가 겹치는 독립 oracle 이다. combined 가드 T-0988 이 title·marker 를 이미 재유도하는 것과의 overlap 은 본 스트림의 정상 패턴(belt-and-suspenders)이며, 전용 focused oracle 이 멱등 불변식에 대한 granular 방어를 추가한다. (3) 요약축 T-0709 의 daily-step mirror 완성 — descriptor 축까지 양축 구조 동형 도달.

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.ts` (요약축 T-0709, **직접 template** — 참조만, 본문 변경 0) — 전용 identity 가드의 구조: 헤더 topology 주석·검증 불변식 ①~④·prefix/token 독립 재구현(`EXPECTED_ISSUE_TITLE_PREFIX`·`EXPECTED_ISSUE_MARKER_PREFIX`·`MARKER_CLOSE_TOKEN`)·`assertDescriptorStructure`(TypeError 분기)·`isBlank`(빈/공백 gitSha·dateToken 거부, ④)·title/marker 독립 재유도 후 byte-identical 대조(RangeError 분기)·`describe`/`isPlainRecord` helper. daily 는 이 패턴을 mirror 하되 source 가 run ref 대신 단일 `report` 이고 prefix·마커 상수는 daily descriptor 규약을 따른다.
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts` (T-0896, producer — 참조·type import 만, 본문 변경 0) — `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report) → {title, marker, body}` 시그니처·title 합성 규칙(prefix + `${dateToken}@${gitSha}` runToken)·marker 합성 규칙(marker prefix + runToken + 닫는 토큰)·`assertNonBlank`(gitSha/dateToken 빈/공백 거부) 상수·규칙. 본 가드가 독립 재구현할 prefix·runToken·marker 종결 토큰의 **정확한 문자열**을 여기서 확인(module-private 상수라 import 불가 — 독립 재정의). `RealDataDailyStepDualLegRunReportIssueDescriptor` type·`RealDataDailyStepDualLegRunReport` type import 재사용(type 재정의 0).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-consistency.ts` (T-0988 combined 가드 — 참조만, 본문 변경 0) — 현재 combined 가드가 title·marker·body 를 어떻게 재유도하는지 확인해 identity 축(title·marker) 재유도 규칙을 daily 규약과 정합하게 재구현. 본 task 는 이 combined 가드를 **변경하지 않는다**(Out of Scope — 후속 slice 에서 body-focus 로 좁혀 요약축 disjoint 구조 복원).
- `test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.spec.ts` (요약축 T-0709 colocated spec, **spec template** — 참조만) — spec 이 실 `build...Descriptor` 산출물을 happy-path fixture 로 재사용하는 **paired 교차 검증**(재유도가 producer 와 byte-identical 함을 spec 이 증명, 독립 재구현의 drift 위험 차단) 구조·describe/it 구성. daily colocated spec 도 실 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 산출물을 fixture 로 재사용.

## Acceptance Criteria

- [ ] 신설 `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts` — 전용 순수 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(descriptor, report)` export. (1) `report` 의 gitSha·dateToken 으로 expected title(`${TITLE_PREFIX} ${dateToken}@${gitSha}`)·expected marker(`${MARKER_PREFIX} ${dateToken}@${gitSha}${MARKER_CLOSE}`)를 **독립 재구현 재유도**(producer T-0896 재호출 0, combined 가드 T-0988 import 0 — prefix·runToken·marker 종결 토큰은 daily descriptor 규약을 mirror 재정의). (2) `descriptor.title`·`descriptor.marker` 와 byte-identical 대조. `RealDataDailyStepDualLegRunReportIssueDescriptor`·`RealDataDailyStepDualLegRunReport` type 은 producer 에서 import 재사용(재정의 0). body 3 블록 검증은 **미포함**(identity 축만 — body 는 combined 가드 T-0988 domain).
- [ ] **검증 불변식 ①~④(요약축 T-0709 mirror)** — ① `descriptor.title` === 재유도 expected title(byte-identical). ② `descriptor.marker` === 재유도 expected marker(byte-identical, 닫는 종결 토큰 포함). ③ title·marker 가 동일 run token(`${dateToken}@${gitSha}`)을 공유(멱등 불변식 — ①∧② 가 각각 동일 expectedToken 기반 expected 와 대조하므로 token 동치는 ①∧② 에 의해 함의; 별도 dead 교차 분기 두지 않음). ④ `report.gitSha`/`report.dateToken` 이 빈/공백-only 면 비식별 이슈 박제 방지로 거부(재유도 단계 throw). 공백·줄바꿈·대소문자 민감.
- [ ] **에러 정책(구조 결손 = TypeError / 값 drift = RangeError)** — descriptor 가 null/undefined·비-객체·title/marker 필드 부재·비-string → 한국어 TypeError(재유도 대조 도달 전 short-circuit). 독립 재유도 expected 와 title/marker drift(prefix/token/marker 종결 토큰 어긋남) → 한국어 RangeError(기대 vs 실측 노출). `report.gitSha`/`report.dateToken` 빈/공백 → producer 와 동형 Error(④, 비식별 박제 방지). silent 통과 0, fail-fast.
- [ ] **결정론·무변형·순수 보존** — 가드는 순수 함수(부수효과 0 · 입력 `descriptor`/`report` 비변형 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0 · zod/ajv 등 외부 validation 도입 0). raw 활동 본문 미저장(R-59 / REQ-032) — title·marker 식별자 문자열만 재유도·대조(narrative/raw 미접촉). 동일 (descriptor, report) → 동일 동작(정상이면 항상 void, 손상이면 항상 동일 위치 throw).
- [ ] **Happy-path test 1+**: 실 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)` 산출 descriptor(비어있지 않은 gitSha/dateToken, 다양한 status 조합) → 가드가 throw 없이 정상 반환(void). **paired 교차 검증** — 재유도 expected 가 실 producer 산출 title·marker 와 byte-identical 함을 spec 이 증명(독립 재구현 drift 차단). 1+.
- [ ] **Error path test 각 1+**: ① descriptor null/undefined 또는 title/marker 비-string/필드 부재 → TypeError. ② title drift(prefix/token 어긋남) → RangeError. ③ marker drift(prefix/token/닫는 종결 토큰 어긋남) → RangeError. ④ `report.gitSha`/`report.dateToken` 빈/공백-only → 비식별 거부 throw(④, RangeError/Error). 각 1+.
- [ ] **Flow/branch test**: ① 정합 → void 분기. ② title drift → RangeError 분기. ③ marker drift → RangeError 분기. ④ 구조 결손 → TypeError 분기(재유도 대조 미도달). ⑤ 빈/공백 식별자 → 비식별 거부 분기(재유도 단계 short-circuit). 각 1+.
- [ ] **Negative cases 충분 cover (각 1+)**: (a) title 은 정합인데 marker 만 다른 run token → 멱등 깨짐 catch(RangeError, ②/③). (b) marker 는 정합인데 title 만 prefix 변조 → RangeError(①). (c) title/marker 가 서로 **다른** dateToken@gitSha 조합(token 불일치) → ①∨② 중 먼저 catch(멱등 불변식 위반). (d) descriptor.title/marker 앞뒤 공백·대소문자·닫는 `-->` 누락 등 경계 변형 → RangeError(공백·종결 민감). (e) 입력 비변형 — 가드 호출 후 `descriptor`/`report` 필드 변경 0. (f) 결정성 — 동일 입력 2회 호출 → 두 번 다 동일 동작. 단일 negative 만 작성 금지 — 분기마다 cover.
- [ ] **colocated spec 신설** — `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.spec.ts` 에 위 R-112 4종 + negative cases 충분 cover. happy-path 는 실 producer 산출 fixture 재사용 paired 교차 검증. spec 위치는 colocated(helper 옆) 필수.
- [ ] `src/` 무변경(test helper 단독). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0. producer(T-0896)·combined 가드(T-0988)·마크다운 renderer(T-0895)·descriptor.ts self-wire 본문 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(전역 line ≥ 80% AND function ≥ 80%). 신설 identity 가드 커버리지 line/branch/function 100% 목표. 전체 unit suite green(기존 descriptor·combined 가드·producer spec 무회귀).

## Out of Scope

- combined 가드 `assertRealDataDailyStepDualLegRunReportIssueDescriptorConsistent`(T-0988) 본문 변경 — 본 task 는 identity 전용 oracle **신설**만. combined 가드를 body-focus 로 좁혀 요약축 disjoint 구조를 완전 복원하는 것은 **후속 slice**(Follow-up ②).
- 가드를 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896) return 직전 self-wire 배선 — **후속 slice**(Follow-up ①, 요약축 identity self-wire mirror). 본 task 는 가드 신설 + spec 만(스트림 guard신설→self-wire 2-task cadence, T-1017/T-1020 선례 동형).
- producer(T-0896)·마크다운 renderer(T-0895)·컴포저(T-0894) 본문 수정 — 본 가드는 type import·재유도 대조·throw 만.
- body 3 블록 구조 재검증 — identity oracle 은 title·marker 축만. body 는 combined 가드(T-0988)·renderer domain.
- publish-plan(T-1016~T-1023)·command-plan·command-args·search·outcome-report seam 변경 0 — 별도 seam.
- 종단 post-execution gh-command-plan(T-0997) seam 변경 0 — 별개 seam(post-실행 leg).
- 실 gh 호출 / `gh search issues` 실행 · `deploy/daily-test.sh` step ④ 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred(PLAN 108~109행).
- 자동 복구·정규화·기본값 채움 — 가드는 정합 판정만(silent 수선 0, fail-fast).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 추가.) 예상 후속 ①: 신설 identity 가드를 producer(T-0896) return 직전 self-wire 배선(요약축 descriptor identity self-wire mirror, 스트림 guard신설→self-wire cadence). 예상 후속 ②: combined 가드 T-0988 을 body-focus 로 좁혀(title·marker 재유도를 identity oracle 로 위임/제거) 요약축의 body/identity disjoint 2-가드 구조를 daily 축에 완전 복원 — 그러면 descriptor 축까지 양축 완전 disjoint 동형. 예상 후속 ③: §109 credential/env 게이트(실 credentialed live run 1회, `deploy/daily-test.sh` step ④ 재배선)는 별도 큐잉(§5 게이트, 사용자 승인 필요) — build-time chain 정합 봉합이 거의 완결됐으므로 다음 자연 stream 은 live 도달.
