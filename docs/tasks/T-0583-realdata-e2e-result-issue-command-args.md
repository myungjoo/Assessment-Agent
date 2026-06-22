---
id: T-0583
title: 실 평가 e2e 결과 이슈 descriptor → gh issue 멱등 명령-args 순수 빌더
phase: P5
status: DONE
completedAt: 2026-06-22T22:38:30Z
mergedAs: b9ba896
prNumber: 496
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-command-args.ts
  - test/helpers/realdata-e2e-result-issue-command-args.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 명령 layer — 이슈 descriptor → gh issue 멱등 search-or-update 명령-args 순수 빌더. cloud-safe·dependency-free."
---

# T-0583 — 실 평가 e2e 결과 이슈 descriptor → gh issue 멱등 명령-args 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 step ①(seed) → step ①→②(upsert-args / personId 치환) → step ②(수집 호출-args / 입력 매핑) → step ②→③(`Activity[]` → `EvaluationInput[]`) → step ③(`EvaluationInput[]` + modelId → `scoreUnit` 호출-args 묶음) → step ③→④ 경계(`EvaluationResult[]` → `RealDataResultSummary`, T-0580) → step ④ 박제 직전 표현 layer(`RealDataResultSummary` → 마크다운 본문, T-0581) → step ④ 박제 직전 식별 layer(요약 + run 식별자 → `RealDataResultIssueDescriptor` {title, marker, body}, T-0582) 까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 명령 layer** — 를 순수 함수로 분해한다.

T-0582 의 Out of Scope 는 "gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 검색·갱신(step ④ live wiring — credential gate)" 를 명시했다. 본 task 는 그 live wiring **직전**의 마지막 순수 slice 다 — 실 호출은 여전히 deferred 로 두되, **어떤 명령으로 / 어떤 인자로 / 어떤 search query 로** 이슈를 멱등 박제할지를 결정하는 순수 명령-args descriptor 빌더를 추가한다. T-0574(upsert-args) / T-0577(collect-call-args) / T-0579(scoring-call-args) 와 동형 패턴 — 실 부수효과(호출) 직전의 "호출-args 순수 빌더" 다.

본 task 는 순수 함수 `buildRealDataResultIssueCommandArgs(descriptor: RealDataResultIssueDescriptor): RealDataResultIssueCommandArgs` 를 추가한다. T-0582 의 `RealDataResultIssueDescriptor` {title, marker, body} 를 입력받아, daily-test 결과 이슈의 멱등 search-or-update 에 필요한 (a) `searchQuery`(marker 기반 — 동일 run 의 기존 이슈를 찾는 검색 문자열), (b) `createArgs`(`gh issue create` 의 title/body/labels), (c) `updateArgs`(기존 이슈가 있을 때 `gh issue edit` 의 title/body) 를 묶은 명령-args descriptor 를 산출한다. marker 가 createArgs/updateArgs 양쪽 body 에 포함됨을 보장해 later live wiring 의 search-or-update 멱등성을 떠받친다.

실 gh issue 호출 / daily-test.sh step_eval wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 명령-args 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0582-realdata-e2e-result-issue-descriptor.md` — 직전 chain slice(식별 layer)의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션. 본 task 가 그 Out of Scope "gh issue 실 호출 / 검색·갱신" 의 **순수 명령-args 직전 slice** 임을 확인.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — 입력 타입 `RealDataResultIssueDescriptor`(`{title, marker, body}`) + `RealDataResultIssueRunRef` import 소스(중복 정의 금지). 헤더 주석 컨벤션·결정론 정책·무공유 정책 mirror. marker 의 search-or-update 멱등 역할 명시 부분 재확인.
- `test/helpers/realdata-e2e-scoring-call-args.ts` — 동형 "호출-args 순수 빌더" 패턴(T-0579) 참조 — 입력 import 재사용·새 객체 반환·무공유·guard throw 컨벤션의 mirror 기준.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 명령-args 가 descriptor 의 title/marker/body 만 전달(narrative/raw 미보유)하는 근거.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-command-args.ts` 에 순수 함수 `buildRealDataResultIssueCommandArgs(descriptor: RealDataResultIssueDescriptor): RealDataResultIssueCommandArgs` 추가. 산출 명령-args 는 (a) `searchQuery`(descriptor.marker 기반 — 동일 run 의 기존 이슈를 찾는 검색 문자열), (b) `createArgs`(`{title, body, labels}` — `gh issue create` 인자), (c) `updateArgs`(`{title, body}` — 기존 이슈 발견 시 `gh issue edit` 인자) 를 담는다.
- [ ] **타입 재사용** — `RealDataResultIssueDescriptor` 는 `realdata-e2e-result-issue-descriptor.ts` 에서 import 재사용(새 type 정의 0). 신규 타입은 본 helper 의 출력 `RealDataResultIssueCommandArgs`(+ 내부 `createArgs`/`updateArgs` shape) 만 정의.
- [ ] **marker 멱등 정합** — `searchQuery` 가 `descriptor.marker`(또는 그로부터 결정론적으로 도출된 안정 토큰)를 포함해, later live wiring 이 동일 run 의 기존 이슈를 marker 로 검색할 수 있음을 spec 으로 검증. `createArgs.body` 와 `updateArgs.body` 모두 marker 라인을 포함(descriptor.body 그대로 전달 — 멱등 검색 토큰이 양쪽 경로에 보존)을 검증.
- [ ] **결정론적 출력 (동일 입력 → 동일 출력)** — 동일 `descriptor` 입력에 대해 두 번 호출한 결과(`searchQuery` / `createArgs` / `updateArgs`)가 byte-identical 임을 spec 으로 검증(시각·랜덤·env 의존 0). labels 는 고정 결정론 집합(예: 고정 상수 배열) — 호출마다 동일.
- [ ] **빈/공백 입력 guard** — `descriptor.title` 또는 `descriptor.marker` 가 빈 문자열·공백-only 면 명시적 throw(조용한 통과 차단 — 비식별 이슈 명령 생성 방지). 각 필드 별 throw 분기 spec 으로 검증.
- [ ] **raw 미저장 정합(R-59)** — 본 명령-args 는 descriptor 의 title/marker/body 만 전달한다(narrative 본문·raw 활동 본문 입력 0 — 받지도 못함). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh 호출은 deferred(본 helper 는 명령-args 만 산출)" 명시.
- [ ] **입력 mutate 0 / 무공유 보장** — 본 빌더는 입력 `descriptor` 객체를 변형하지 않고(읽기만) 호출마다 새 명령-args 객체(중첩 `createArgs`/`updateArgs`/`labels` 배열 포함 새로 생성)를 반환한다. spec 으로 입력 참조·키·값 불변 + 출력 무공유(반환 labels 배열 mutate 가 입력·다음 호출에 누설 안 됨) 검증.
- [ ] **Happy-path unit test 1+** — 정상 `descriptor`(비어있지 않은 title/marker/body) 에 대해 `searchQuery`(marker 포함) / `createArgs`(title=descriptor.title, body=descriptor.body, labels=고정 집합) / `updateArgs`(title=descriptor.title, body=descriptor.body) 가 정확히 산출됨을 검증.
- [ ] **Error/negative path test** — (a) 빈 `title` throw, (b) 공백-only `title` throw, (c) 빈 `marker` throw, (d) 공백-only `marker` throw — 각각 별도 case. 단일 negative 만으로 부족(필드별·빈/공백별 분기마다 cover).
- [ ] **Flow / branch coverage** — guard 분기(title 빈/공백, marker 빈/공백)와 정상 경로 각 1+ test. createArgs/updateArgs 양쪽 body 에 marker 라인이 포함됨(누락 0) 검증.
- [ ] **무공유 회귀 test** — 빌드 호출 후 입력 `descriptor` 의 키·값이 호출 전과 동일함 검증 + 반환 `createArgs.labels` 배열에 push 해도 다음 호출 결과의 labels 가 영향받지 않음 검증(빌더가 매 호출 새 배열 반환).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 빌더만이므로 100% 지향.

## Out of Scope

- gh issue 실 호출 / `gh issue create` / `gh issue edit` / `gh issue list` / `gh search issues` 실 실행(step ④ live wiring — credential gate). 본 helper 는 명령-args descriptor 만 산출(부수효과 0).
- `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기·연동(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / 실 `EvaluationResult` 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- search-or-update 의 실 분기 실행(기존 이슈 존재 여부 판단·실 issue number 해석 — 본 helper 는 create/update 양쪽 args 를 모두 산출만; 어느 쪽을 실행할지는 caller 의 live wiring 책임).
- 마크다운 렌더 / 이슈 descriptor 합성 로직(T-0581 / T-0582 위임만 — 중복 구현 금지).
- repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth — 실 wiring 의 환경 책임(본 helper 는 title/body/labels/searchQuery 만).
- 외부 템플릿/해시/CLI 라이브러리 도입(새 dependency 0, 내장 string 합성만).
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
