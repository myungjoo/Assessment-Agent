---
id: T-0649
title: 실 평가 e2e 결과 이슈 command-args body marker-first 구조 불변식 검증 순수 가드 assertRealDataResultIssueCommandArgsBodyPreservesDescriptor 신설
phase: P5
status: DONE
commitMode: pr
mergedAs: 7c694e8
prNumber: 563
completedAt: 2026-06-25T00:20:00Z
coversReq: [REQ-005]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-25
plannerNote: "P5 PLAN 109행 step④ — command-args consumer 경계의 descriptor-only body 구조 가드 신설(marker-first 보존). T-0648 Follow-up ① — command-args 는 summary 미보유 → full body-consistency 불가, descriptor-only marker 가드. T-0646 의 command-args-side mirror. single-helper-test ×1.0, dependsOn []"
independentStream: realdata-e2e-result-summary-line
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts
  - test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts
---

# T-0649 — command-args body marker-first 구조 불변식 검증 순수 가드 신설

## Why

[PLAN.md](../PLAN.md) P5 109행 — **실 평가 e2e step ④ 결과 박제 chain** 의 consumer-side 구조 가드 신설 slice. realdata-e2e-result-summary-line stream 은 한 줄 요약을 정의(T-0642)·형태검증(T-0643)·formatter self-guard(T-0644)·이슈 body caller-surface 실배선(T-0645)·body 3블록 구조 불변식 순수 가드 신설(T-0646, `assertRealDataResultIssueDescriptorBodyConsistent`)·builder self-wire(T-0647)·종단 컴포저 self-wire(T-0648)까지 닿았다.

그 다음 consumer 경계는 `buildRealDataResultIssueCommandArgs(descriptor)` (T-0583) 다 — descriptor 를 gh issue 멱등 search-or-update 명령-args(`{ searchQuery, createArgs, updateArgs }`)로 변환한다. 이 빌더는 `descriptor.body` 를 `createArgs.body` 와 `updateArgs.body` **양쪽 모두에 그대로 전달**하고, `descriptor.marker` 를 `searchQuery` 로 전달한다 — create 든 update 든 marker 라인이 양 경로에 보존돼야 search-or-update 멱등성이 성립한다.

그러나 이 멱등 정합 불변식 — ① `createArgs.body` 가 `descriptor.body` 와 byte-identical / ② `updateArgs.body` 가 `descriptor.body` 와 byte-identical / ③ 두 body 의 첫 라인이 `descriptor.marker` (marker-first) / ④ `searchQuery` 가 `descriptor.marker` 와 byte-identical (양 body 안에 박힌 검색 토큰과 일치) — 은 빌더 본문 주석과 T-0583 spec happy-path 단언으로만 박제돼 있고 **런타임에서 강제되는 독립 불변식 가드가 부재** 하다. 미래에 빌더 합성이 회귀(예: createArgs 와 updateArgs 가 서로 다른 body 를 담거나, marker 라인이 body 머리에서 빠지거나, searchQuery 가 body 의 marker 와 어긋나도록 배선)해도 빌더는 부정합 명령-args 를 그대로 산출해 gh issue 실배선·rolling 이슈 surface 로 멱등성이 깨진 채 새 나간다.

본 task 는 그 빈칸을 채우는 **순수 가드 helper** 를 신설한다 — `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args, descriptor)` 가 명령-args 의 두 body 가 descriptor body 를 marker-first 로 byte-identical 보존하고 searchQuery 가 marker 와 일치함을 fail-fast 검증한다. 이는 T-0646 이 descriptor body 3블록 구조 불변식을 순수 가드로 박은 패턴의 **command-args-side mirror** 다 — 단, T-0648 Follow-up ① 이 명시하듯 **command-args 는 `summary` 를 in-scope 로 갖지 않아 full body-consistency 가드(summary 재유도 비교) 직접 배선이 불가** 하다. 따라서 본 가드는 summary 재유도 없이 **descriptor-only** 로 동작한다 — descriptor.body / descriptor.marker 를 single-source 로 삼아 명령-args 의 body 전파·searchQuery 가 그것을 보존하는지만 비교한다. 본 task 는 가드 helper 신설까지만 — 빌더 산출 직전 self-wire 는 별도 follow-up slice(T-0646→T-0647 self-wire 와 동형 패턴).

## Required Reading

- [test/helpers/realdata-e2e-result-issue-command-args.ts](../../test/helpers/realdata-e2e-result-issue-command-args.ts) — `buildRealDataResultIssueCommandArgs(descriptor)` 와 출력 타입 `RealDataResultIssueCommandArgs`(L88~92: `{ searchQuery, createArgs, updateArgs }`) / `RealDataResultIssueCreateArgs`(L68~72: `{ title, body, labels }`) / `RealDataResultIssueUpdateArgs`(L77~80: `{ title, body }`). 본 가드는 이 출력 타입과 입력 `RealDataResultIssueDescriptor` 를 **type-only import** 로 소비한다. 빌더 본문·타입 정의 변경 0(import 재사용만). L124~137 의 body 전파 규칙(`createArgs.body = descriptor.body`, `updateArgs.body = descriptor.body`, `searchQuery = descriptor.marker`)이 본 가드가 검증할 불변식의 source.
- [test/helpers/realdata-e2e-result-issue-descriptor.ts](../../test/helpers/realdata-e2e-result-issue-descriptor.ts) — `RealDataResultIssueDescriptor` 타입(`{ title, marker, body }`, L86 부근) + body 합성 규칙(L128~139: marker 가 body 첫 라인, `[marker, "", 한줄요약, "", markdown].join("\n")`). 본 가드가 검증할 marker-first 불변식의 source. **type-only import** — 본문 변경 0.
- [test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts](../../test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts) (T-0646) — mirror 할 패턴 **참조만**: 순수 함수 / null·undefined fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError 구분 / single-source 재유도 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동 배선 0. 본 가드는 그 **에러 정책·가드 관례·JSDoc 톤을 mirror** 하되, summary 재유도 비교 대신 descriptor.body/marker single-source 만으로 command-args body 전파를 검증(summary 미import). 본문 변경 0.
- [test/helpers/realdata-e2e-result-issue-command-args.spec.ts](../../test/helpers/realdata-e2e-result-issue-command-args.spec.ts) — 기존 command-args 빌더의 spec 구조 참조(테스트 fixture·descriptor 생성 패턴). 본 task 는 신규 colocated spec 파일을 만들되 동형 fixture 작성 관례를 참고.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args-body-marker.ts` 신설 — 순수 가드 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor(args: RealDataResultIssueCommandArgs, descriptor: RealDataResultIssueDescriptor): void` export. 정상이면 void 반환, 불변식 위반이면 fail-fast throw. **type-only import 만** — command-args 빌더·descriptor 빌더 본문 변경 0.
- [ ] **불변식 검증 로직** — 다음 4 불변식을 single-source(descriptor.body / descriptor.marker) 재유도로 검증: ① `args.createArgs.body === descriptor.body` (byte-identical) ② `args.updateArgs.body === descriptor.body` (byte-identical) ③ 두 body 의 첫 라인(`.split("\n")[0]`)이 `descriptor.marker` 와 일치 (marker-first) ④ `args.searchQuery === descriptor.marker` (양 body 안 marker 와 검색 토큰 일치). **summary 재유도 0** — command-args 는 summary 를 in-scope 로 갖지 않으므로 본 가드는 descriptor.body/marker single-source 만 비교(`formatRealDataResultSummaryLine`·`renderRealDataResultSummaryMarkdown`·`RealDataResultSummary` 미import).
- [ ] **에러 정책 (T-0646 mirror)** — 구조/타입 결손(args 또는 descriptor 가 null/undefined, createArgs/updateArgs 부재, body/marker/searchQuery 가 string 아님)은 **TypeError** + 한국어 메시지. 값 정합 위반(body byte 불일치·marker-first 위반·searchQuery 불일치)은 **RangeError** + 한국어 메시지(어느 불변식이 깨졌는지 명시). fail-fast — 자동 복구·정규화·기본값 채움·silent 수선 0.
- [ ] **순수성·무공유·R-59 보존** — 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · DB write 0 · migration 0 · raw 미저장 (R-59 — 가드는 body string·marker 만 비교, narrative/raw 미접촉). 입력 `args`/`descriptor` 읽기만 (mutate 0). 동일 입력 → 동일 동작(정상이면 항상 void, 위반이면 항상 동일 위치 throw). 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 string 비교만.
- [ ] **Happy-path test 1+**: 정상 descriptor(marker-first body, 단일/다수 result·다양한 분포·빈 results 변형) → `buildRealDataResultIssueCommandArgs` 로 산출한 정상 args → 가드 void 반환(throw 0). 1+.
- [ ] **Error path test 각 1+**: ① args null/undefined → TypeError ② descriptor null/undefined → TypeError ③ createArgs/updateArgs 부재 또는 body 가 string 아님 → TypeError ④ createArgs.body 가 descriptor.body 와 불일치 → RangeError ⑤ updateArgs.body 가 descriptor.body 와 불일치 → RangeError ⑥ body 첫 라인이 marker 가 아님(marker-first 위반) → RangeError ⑦ searchQuery 가 descriptor.marker 와 불일치 → RangeError. 각 1+ (불변식별·필드별 분기마다 cover).
- [ ] **Flow/branch test**: ① 정상 args → void 분기 1 ② createArgs.body 위반 분기 1 ③ updateArgs.body 위반 분기 1 ④ marker-first 위반 분기 1 ⑤ searchQuery 위반 분기 1 ⑥ 구조 결손(null/undefined/타입) TypeError 분기 1+ — 각 1+ test 로 분기 격리.
- [ ] **Negative cases 충분 cover (각 1+)**: ① **결정성** — 동일 (args, descriptor) 2회 호출 → 둘 다 동일 동작(정상 void / 위반 동일 throw) ② **입력 비변형** — 호출 후 args 객체·descriptor 객체 변경 0 assert ③ **createArgs/updateArgs 비대칭 손상** — 한쪽 body 만 손상돼도 검출(둘 다 검사함을 증명) ④ **공백/빈 marker 위반** — searchQuery 가 빈 문자열인데 marker 는 비어있지 않으면 RangeError(또는 그 역) ⑤ **marker 부분일치 함정** — body 첫 라인이 marker 를 prefix 로만 포함(전체 일치 아님)하면 marker-first 위반 검출 ⑥ **R-59** — 가드가 body 의 marker/string 만 비교, raw narrative 키/본문 미접촉. 단일 negative 만 작성 금지 — 위 분기마다 cover.
- [ ] **colocated spec** — `test/helpers/realdata-e2e-result-issue-command-args-body-marker.spec.ts` 신규 colocated spec 신설(NestJS·test helper convention: 가드 helper 옆 colocated). 신규 가드 helper 의 자체 spec.
- [ ] `pnpm lint && pnpm build && pnpm test` green. 신규 가드 helper line/branch/function/statement 커버 100%.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%).

## Out of Scope

- `buildRealDataResultIssueCommandArgs` (T-0583) 본문·`buildRealDataResultIssueDescriptor` (T-0582/T-0645/T-0647) 본문·출력 타입 변경 — 본 task 는 신규 순수 가드 helper 신설만 (type-only import 재사용). 빌더 본문 변경 0.
- **산출 경로 자동 배선 (self-wire)** — `buildRealDataResultIssueCommandArgs` 산출 직전 본 가드 self-assert 배선 0. 본 task 는 순수 가드 helper 까지만 (T-0646→T-0647 self-wire 와 동형, self-wire 는 자연 follow-up slice).
- **summary 재유도 비교** — full body-consistency 가드(T-0646)는 summary 로 한 줄 요약·markdown 을 재유도해 byte-identical 검증하지만, 본 가드는 command-args 가 summary 를 미보유하므로 descriptor.body/marker single-source 만 비교(`RealDataResultSummary`·`formatRealDataResultSummaryLine`·`renderRealDataResultSummaryMarkdown` 미import). full 재유도가 필요하면 descriptor 단계(T-0646)가 이미 cover.
- `createArgs.labels` 구조 검증 / `title` 자체 구조 검증 — 본 가드는 body marker-first 전파·searchQuery 정합에 한정 (labels·title 정합은 별도 slice 후보).
- gh issue 실 호출 · `gh issue create`/`edit`/`list`/`search` 실 실행 · `deploy/daily-test.sh` step_eval 배선 · 실 Ollama LLM round-trip — LAN/credential gate deferred (PLAN 108~109행).
- 자동 복구·정규화·기본값 채움·silent 수선·args 재합성 — 가드는 위반 검출 시 fail-fast throw 만 (본 task 는 가드 신설, 부정합 수선 0).
- JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 — 순수 string 비교만.
- 새 dependency·migration·schema 변경·raw 저장 (R-59) — 전부 금지.
- production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
- summary-batch surface (plan / outcome / report / consistency 가드 / 합성 진입점) 본문 변경 — 본 task 는 realdata-e2e 측 command-args body 가드 신설만.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가. 본 task 닫히면 command-args consumer 경계의 body marker-first 불변식이 순수 가드로 신설된다. 자연 후속 후보: ① `buildRealDataResultIssueCommandArgs` 산출 직전 본 가드 self-wire 배선 — T-0646→T-0647 self-wire 와 동형 패턴(빌더가 args 반환 직전 자기 산출을 self-assert). ② `createArgs.labels`/`title` 정합 가드 — 본 가드가 cover 하지 않는 labels·title 전파 구조 검증이 필요하면 별도 slice. ③ gh issue 실배선 — `gh issue create`/`edit`/`search` + daily-test step_eval + 실 Ollama LLM round-trip, LAN/credential gate deferred (PLAN 108~109행) — realdata-e2e-result-summary-line stream 의 live wiring slice.)
