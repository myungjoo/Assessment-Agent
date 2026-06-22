---
id: T-0582
title: 실 평가 e2e 결과 요약 → daily-test 결과 이슈 식별자/본문 descriptor 순수 빌더
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor.ts
  - test/helpers/realdata-e2e-result-issue-descriptor.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 식별 layer — 결과 요약 + run 식별자 → 멱등 이슈 식별자/본문 descriptor 순수 빌더. cloud-safe·dependency-free."
---

# T-0582 — 실 평가 e2e 결과 요약 → daily-test 결과 이슈 식별자/본문 descriptor 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 step ①(seed) → step ①→②(upsert-args / personId 치환) → step ②(수집 호출-args / 입력 매핑) → step ②→③(`Activity[]` → `EvaluationInput[]`) → step ③(`EvaluationInput[]` + modelId → `scoreUnit` 호출-args 묶음) → step ③→④ 경계(`EvaluationResult[]` → `RealDataResultSummary`, T-0580) → step ④ 박제 직전 표현 layer(`RealDataResultSummary` → 마크다운 본문, T-0581) 까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 식별 layer** — 를 순수 함수로 분해한다.

T-0581 의 Out of Scope 는 "daily-test result/rolling 이슈의 **이슈 식별자 결정 / 기존 이슈 검색·갱신 / 멱등 박제 policy** — 별도 후속 slice(본 helper 는 본문 문자열만 산출)" 를 명시했다. 본 task 가 그 후속 slice 다. PLAN step ④ 는 "결과를 daily-test result/rolling 이슈에 박제 = 자율 nightly 실 평가 e2e" 를 지시하므로, 실 wiring(`gh issue create` / search-or-update) 전에 **어떤 이슈 제목으로 / 어떤 멱등 marker 로 / 어떤 본문으로 박제할지**를 결정하는 순수 descriptor 빌더가 필요하다.

본 task 는 순수 함수 `buildRealDataResultIssueDescriptor(summary: RealDataResultSummary, run: RealDataResultIssueRunRef): RealDataResultIssueDescriptor` 를 추가한다. run 식별자(예: gitSha + 날짜 token)와 결과 요약 descriptor 를 입력받아, daily-test 결과 이슈의 (a) 결정론적 제목, (b) 멱등 검색·갱신용 marker(이슈 본문에 박을 안정적 식별 토큰), (c) 본문(T-0581 의 `renderRealDataResultSummaryMarkdown` 위임 + marker 라인) 을 묶은 descriptor 를 산출한다. marker 덕에 later live wiring slice 가 동일 run 의 이슈를 검색→갱신(멱등)할 수 있다.

실 gh issue 호출 / daily-test.sh step_eval wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 문자열 descriptor 빌더라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0581-realdata-e2e-result-summary-markdown.md` — 직전 chain slice 의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션. 본 task 가 그 Out of Scope "이슈 식별자 결정 / 멱등 박제 policy" slice 임을 확인.
- `test/helpers/realdata-e2e-result-summary-markdown.ts` — 본 helper 가 본문 렌더링을 위임할 `renderRealDataResultSummaryMarkdown(summary)` import 소스(중복 렌더 로직 0). 헤더 주석 컨벤션·결정론 정책 mirror.
- `test/helpers/realdata-e2e-result-summary.ts` — 입력 타입 `RealDataResultSummary` import 소스(중복 정의 금지).
- `deploy/daily-test.sh` (L18·L46·L196~L211) — daily-test 의 머신 요약 JSON(`latest-result.json`: `ts` / `gitSha` / `result` / `failedStep` 필드) 박제 패턴. run 식별자(gitSha·ts) 컨벤션의 컨텍스트 — 본 helper 의 `RealDataResultIssueRunRef` shape 근거. (본 task 가 이 스크립트를 wiring 하지는 않음.)
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 descriptor 가 narrative 본문을 박제하지 않는 근거.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-descriptor.ts` 에 순수 함수 `buildRealDataResultIssueDescriptor(summary: RealDataResultSummary, run: RealDataResultIssueRunRef): RealDataResultIssueDescriptor` 추가. 산출 descriptor 는 (a) `title`(결정론적 이슈 제목 — 고정 prefix + run 식별 token), (b) `marker`(멱등 검색·갱신용 안정 식별 토큰 — 동일 run 이면 동일 marker), (c) `body`(marker 라인 + `renderRealDataResultSummaryMarkdown(summary)` 본문) 를 담는다.
- [ ] **타입 재사용 / 위임** — `RealDataResultSummary` 는 `realdata-e2e-result-summary.ts` 에서 import 재사용(새 type 정의 0), 본문 렌더링은 `renderRealDataResultSummaryMarkdown` 위임(마크다운 렌더 로직 중복 0). 신규 타입은 본 helper 의 입력 `RealDataResultIssueRunRef`(예: `{ gitSha: string; dateToken: string }`) + 출력 `RealDataResultIssueDescriptor`(`{ title; marker; body }`) 만 정의.
- [ ] **결정론적 출력 (동일 입력 → 동일 출력)** — 동일 `(summary, run)` 입력에 대해 두 번 호출한 결과 descriptor(`title` / `marker` / `body`)가 byte-identical 임을 spec 으로 검증(시각·랜덤·env 의존 0).
- [ ] **멱등 marker 안정성** — 동일 `run`(동일 gitSha+dateToken)이면 `summary` 가 달라도 `marker` 가 동일함을 spec 으로 검증(later live wiring 의 search-or-update 멱등 기반). 서로 다른 run 은 서로 다른 marker 를 산출함도 검증.
- [ ] **빈/공백 run 식별자 guard** — `run.gitSha` 또는 `run.dateToken` 이 빈 문자열·공백-only 면 명시적 throw(조용한 통과 차단 — 비식별 이슈 박제 방지). 각 필드 별 throw 분기 spec 으로 검증.
- [ ] **raw 미저장 정합(R-59)** — 본 descriptor 는 입력 summary 의 식별자 카운트·분류 enum 분포·정량 합산(렌더 위임)과 run 식별자만 담는다. narrative 본문·raw 활동 본문 입력 0(받지도 못함). 헤더 주석에 R-59 정합 + step ④ 박제 경계 명시.
- [ ] **입력 mutate 0 / 무공유 보장** — 본 빌더는 입력 `summary` / `run` 객체를 변형하지 않고(읽기만) 호출마다 새 descriptor 객체를 반환한다. spec 으로 입력 참조·키·값 불변 + 출력 무공유 검증.
- [ ] **Happy-path unit test 1+** — 정상 `summary`(difficulty/contribution 섞임, totalVolume>0) + 정상 `run`(gitSha+dateToken) 에 대해 `title`(prefix+token 포함) / `marker`(안정 토큰) / `body`(marker 라인 + 렌더 본문 포함) 가 정확히 산출됨을 검증.
- [ ] **Error/negative path test** — (a) 빈 `gitSha` throw, (b) 공백-only `gitSha` throw, (c) 빈 `dateToken` throw, (d) 공백-only `dateToken` throw — 각각 별도 case. 단일 negative 만으로 부족(필드별·빈/공백별 분기마다 cover).
- [ ] **Flow / branch coverage** — guard 분기(gitSha 빈/공백, dateToken 빈/공백)와 정상 경로 각 1+ test. body 에 marker 라인이 정확히 1회 포함됨(중복·누락 0) 검증.
- [ ] **무공유 회귀 test** — 빌드 호출 후 입력 `summary` / `run` 의 키·값이 호출 전과 동일함 검증(빌더가 입력을 mutate 하지 않음).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 빌더만이므로 100% 지향.

## Out of Scope

- gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 검색·갱신(step ④ live wiring — credential gate).
- `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기·연동(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / 실 `EvaluationResult` 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- 실 run 식별자 도출(실 gitSha·실 timestamp 읽기 — 본 helper 는 주어진 run 식별자를 받아 descriptor 만 산출; 식별자 source 는 caller 책임).
- 마크다운 렌더 로직 자체(T-0581 `renderRealDataResultSummaryMarkdown` 위임만 — 중복 구현 금지).
- Person 별 / 기간 별 group-by 이슈 분해(본 helper 는 단일 결과 1 이슈 descriptor 만).
- 마크다운 외 포맷(plain text / HTML / JSON 등) 본문.
- 외부 템플릿/해시 라이브러리 도입(handlebars / mustache / crypto 외부 패키지 — 새 dependency 0, 내장 template literal 만; marker 는 안정 string 합성으로 충분).
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입·렌더 함수 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

## Result (DONE 2026-06-22T21:38Z, PR #495 r1 squash a8d82e4)

순수 빌더 `buildRealDataResultIssueDescriptor()` 추가 — `RealDataResultSummary`(T-0580) + run 식별자(`RealDataResultIssueRunRef`) → `RealDataResultIssueDescriptor` {title, marker, body}. body 는 T-0581 `renderRealDataResultSummaryMarkdown` 위임(렌더 중복 0), marker 는 run token 안정 합성(멱등 — 동일 run 동일 marker, 상이 run 상이), gitSha/dateToken 빈·공백 guard throw. 결정론적(byte-identical) 출력, 입력 mutate 0·무공유, R-59 정합(raw 미보유). DB/네트워크/env/live-LLM 접근 0(build-time 순수, cloud-safe). `test/helpers/realdata-e2e-result-issue-descriptor.ts`(+colocated spec) +130 LOC, reviewer r1 APPROVE, 4-게이트 PASS, CI green(275 suite/6438 test), 신규 helper line/branch/func/stmt 100%.
