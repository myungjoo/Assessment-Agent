---
id: T-0581
title: 실 평가 e2e 결과 요약 descriptor → daily-test 이슈 마크다운 본문 순수 렌더러
phase: P5
status: DONE
completedAt: 2026-06-22T20:39Z
mergedAs: 2e60a4e
prNumber: 494
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-22
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-summary-markdown.ts
  - test/helpers/realdata-e2e-result-summary-markdown.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 표현 layer — RealDataResultSummary → 이슈 마크다운 본문 순수 렌더러. cloud-safe·dependency-free."
---

# T-0581 — 실 평가 e2e 결과 요약 descriptor → daily-test 이슈 마크다운 본문 순수 렌더러

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 step ①(seed) → step ①→②(upsert-args / personId 치환) → step ②(수집 호출-args / 입력 매핑) → step ②→③(`Activity[]` → `EvaluationInput[]`) → step ③(`EvaluationInput[]` + modelId → `scoreUnit` 호출-args 묶음) → step ③→④ 경계(`EvaluationResult[]` → `RealDataResultSummary` 결과 요약 descriptor, T-0580) 까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 표현 layer** — 를 순수 함수로 분해한다.

T-0580 의 `RealDataResultSummary`(`count` / `byDifficulty` / `byContribution` / `totalVolume`) 는 결정론적 집계 descriptor 다. PLAN step ④ 는 "결과를 daily-test result/rolling 이슈에 박제 = 자율 nightly 실 평가 e2e" 를 지시하므로, gh issue 본문에 박제할 **마크다운 문자열**로 그 descriptor 를 렌더링하는 순수 함수가 필요하다. T-0580 의 Out of Scope (`realdata-e2e-result-summary.ts` 헤더 주석)에 "daily-test result/rolling 이슈 실 박제 / gh issue 호출 / 마크다운 렌더링 / 이슈 본문 포맷 문자열 생성 — 표현 layer 는 별도 후속 slice" 가 명시돼 있고, 본 task 가 그 후속 slice 다.

본 task 는 순수 함수 `renderRealDataResultSummaryMarkdown(summary: RealDataResultSummary): string` 을 추가한다. 입력 요약 descriptor 를 사람이 읽을 수 있는 결정론적 마크다운 본문(총 단위 수 + difficulty 분포 표 + contribution 분포 표 + 총 volume 합산)으로 변환한다. raw 미저장(R-59) 불변에 정합하게 본 렌더러는 `narrative` 본문·raw 활동 본문을 입력으로 받지 않으며(받지도 못함 — T-0580 descriptor 가 이미 식별자·분류 enum 카운트·정량 합산만), 슬롯 single source(`DIFFICULTIES` / `CONTRIBUTION_LEVELS`)에 정합한 고정 순서로 렌더링한다.

실 gh issue 호출 / daily-test.sh step_eval wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 문자열 렌더링이라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0580-realdata-e2e-result-summary.md` — 직전 chain slice 의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션. `RealDataResultSummary` interface 정의 소스.
- `test/helpers/realdata-e2e-result-summary.ts` — 본 helper 의 입력 타입 `RealDataResultSummary` import 소스(중복 정의 금지). 헤더 주석 컨벤션·slot single source 정합 정책 mirror.
- `src/llm/difficulty.ts` (L17~L38) — `Difficulty` union(easy/medium/hard) + `DIFFICULTIES` const. difficulty 분포 렌더링의 고정 순서 기준.
- `src/assessment-evaluation/domain/evaluation-result.ts` — `ContributionLevel` union(zero/low/medium/high) + `CONTRIBUTION_LEVELS` const. contribution 분포 렌더링의 고정 순서 기준.
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 렌더러가 narrative 본문을 박제하지 않는 근거.
- `deploy/daily-test.sh` — daily-test 의 result/rolling 이슈 박제 패턴 컨텍스트(본 task 가 wiring 하지는 않지만, 렌더 출력의 소비처가 어떤 형태인지 이해용).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-summary-markdown.ts` 에 순수 함수 `renderRealDataResultSummaryMarkdown(summary: RealDataResultSummary): string` 추가. 입력 요약 descriptor 를 결정론적 마크다운 본문 문자열로 변환한다 — (a) 총 단위 수 헤더, (b) difficulty 분포 섹션 (DIFFICULTIES 순서대로 슬롯 + 카운트), (c) contribution 분포 섹션 (CONTRIBUTION_LEVELS 순서대로 슬롯 + 카운트), (d) 총 volume 합산.
- [ ] **타입 재사용** — `RealDataResultSummary` 는 `realdata-e2e-result-summary.ts` 에서, `Difficulty` / `DIFFICULTIES` 는 `src/llm/difficulty.ts` 에서, `ContributionLevel` / `CONTRIBUTION_LEVELS` 는 `src/assessment-evaluation/domain/evaluation-result.ts` 에서 import 재사용(새 type / 슬롯 배열 정의 0).
- [ ] **슬롯 single source 정합 (고정 순서)** — difficulty 분포 행은 반드시 `DIFFICULTIES` 의 순서대로(easy → medium → hard), contribution 분포 행은 반드시 `CONTRIBUTION_LEVELS` 의 순서대로(zero → low → medium → high) 렌더링한다. 미등장 슬롯도 카운트 0 으로 렌더링(슬롯 누락 0 — descriptor 에 키 존재 보장된 슬롯을 모두 렌더). 슬롯 hard-code 금지 — 반드시 `for (const d of DIFFICULTIES)` / `for (const c of CONTRIBUTION_LEVELS)` 같은 single-source 순회.
- [ ] **결정론적 출력 (동일 입력 → 동일 출력)** — 동일 입력 descriptor 에 대해 두 번 호출한 결과 문자열이 byte-identical 임을 spec 으로 검증(공백·줄바꿈·순서 고정).
- [ ] **raw 미저장 정합(R-59)** — 본 렌더러는 입력 descriptor 가 가진 식별자 카운트·분류 enum 분포·정량 합산만 렌더링한다. narrative 본문·raw 활동 본문 입력 0(descriptor 에 부재). 헤더 주석에 R-59 정합 + step ④ 박제 경계 명시.
- [ ] **입력 mutate 0 / 무공유 보장** — 본 렌더러는 입력 `summary` 객체 / 하위 `byDifficulty` / `byContribution` 객체를 변형하지 않는다(읽기만). spec 으로 입력 참조 / 키 / 값 불변 검증.
- [ ] **Happy-path unit test 1+** — difficulty / contribution 이 다양하게 섞인 fixture descriptor 입력(예: easy 2 / medium 1 / hard 0, zero 1 / low 1 / medium 1 / high 0, totalVolume 42, count 3)에 대해 렌더링 출력이 모든 슬롯·카운트·총 volume·count 헤더를 정확히 담음을 검증.
- [ ] **Error/negative path test** — (a) 빈 요약(`count: 0`, 모든 슬롯 0, `totalVolume: 0`) 에 대해 슬롯 누락 없는 0-only 렌더링 검증, (b) 단일 슬롯 집중(예: 모두 hard, 모두 high) 에서 나머지 슬롯이 0 으로 명시 렌더링됨 검증, (c) 큰 volume 합산(예: 1_000_000) 의 정확한 수치 렌더링 검증, (d) 슬롯 순서가 입력 객체의 키 enumeration 순서가 아니라 `DIFFICULTIES` / `CONTRIBUTION_LEVELS` 순서를 따름 검증(키 enumeration 순서를 의도적으로 뒤집은 fixture 로). 단일 negative 만으로 부족.
- [ ] **Flow / branch coverage** — descriptor 의 각 분포 슬롯 / count / totalVolume 분기마다 1+ test. 본 렌더러의 추가 분기는 슬롯 순회 외 없음을 spec 주석으로 명시. (분포 슬롯은 항상 같은 키 집합 — 미등장 슬롯도 0 으로 키 존재이므로 "키 부재" 분기는 발생하지 않음).
- [ ] **무공유 회귀 test** — 렌더 호출 후 입력 `summary` 의 `byDifficulty` / `byContribution` 객체에 대해 키 / 값이 호출 전과 동일함 검증(렌더러가 입력을 mutate 하지 않음).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 렌더링 함수만이므로 100% 지향.

## Out of Scope

- gh issue 실 호출 / `gh issue create` / `gh issue comment` / 실 이슈 박제(step ④ live wiring — credential gate).
- `deploy/daily-test.sh` 의 `step_eval` wiring(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / 실 `EvaluationResult` 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- daily-test result/rolling 이슈의 **이슈 식별자 결정 / 기존 이슈 검색·갱신 / 멱등 박제 policy**(별도 후속 slice — 본 helper 는 본문 문자열만 산출).
- Person 별 / 기간 별 group-by 렌더링(본 helper 는 전체 descriptor 1 회 렌더만 — T-0580 의 단일 집계와 동형). Person · 기간 차원 분해는 별도 후속 slice(입력에 차원 식별자 동반 필요).
- 마크다운 외 포맷(plain text / HTML / JSON 등) 출력.
- 외부 템플릿 엔진 도입(handlebars / mustache 등 — 새 dependency 0, 내장 template literal 만).
- production `src/` 코드 변경 — 본 task 는 test helper 단독(타입·슬롯 배열 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
