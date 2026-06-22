---
id: T-0584
title: 실 평가 e2e 결과 이슈 search response → create-or-update action 순수 resolver
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-037]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-22
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-action.ts
  - test/helpers/realdata-e2e-result-issue-action.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step④ 박제 직전 분기 layer — gh issue search response + marker → create vs update 결정 순수 resolver. cloud-safe·dependency-free."
---

# T-0584 — 실 평가 e2e 결과 이슈 search response → create-or-update action 순수 resolver

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 build-time chain 은 step ①(seed) → step ①→②(upsert-args / personId 치환) → step ②(수집 호출-args / 입력 매핑) → step ②→③(`Activity[]` → `EvaluationInput[]`) → step ③(`EvaluationInput[]` + modelId → `scoreUnit` 호출-args 묶음) → step ③→④ 경계(`EvaluationResult[]` → `RealDataResultSummary`, T-0580) → step ④ 박제 직전 표현 layer(마크다운 본문, T-0581) → step ④ 박제 직전 식별 layer(`RealDataResultIssueDescriptor` {title, marker, body}, T-0582) → step ④ 박제 직전 명령 layer(`RealDataResultIssueCommandArgs` {searchQuery, createArgs, updateArgs}, T-0583) 까지 박제됐다. 본 task 는 그 다음 자연 경계 — **step ④(결과 박제) 직전 분기 layer** — 를 순수 함수로 분해한다.

T-0583 의 Out of Scope 는 "search-or-update 의 실 분기 실행(기존 이슈 존재 여부 판단·실 issue number 해석 — 본 helper 는 create/update 양쪽 args 를 모두 산출만; 어느 쪽을 실행할지는 caller 의 live wiring 책임)" 을 명시했다. 본 task 는 그 분기 결정 의 **순수 부분**을 분해한다 — 실 `gh search issues --json number,title,body` 호출은 여전히 deferred(credential gate)로 두되, **그 응답이 주어졌을 때 어느 분기(create vs update)를 어느 이슈 번호에 실행할지** 를 결정하는 순수 resolver 를 추가한다. 즉 caller(live wiring)는 (1) `gh search issues` 를 실 호출해 JSON 응답을 얻고, (2) 본 resolver 에 그 응답 + marker 를 입력해 action descriptor 를 받고, (3) action 에 따라 T-0583 의 createArgs / updateArgs 중 하나로 `gh issue create` 또는 `gh issue edit` 을 실행한다. 본 helper 는 (2) 만 순수 함수로 박제한다.

본 task 는 순수 함수 `resolveRealDataResultIssueAction(searchHits: RealDataResultIssueSearchHit[], marker: string): RealDataResultIssueAction` 을 추가한다. 입력 `searchHits` 는 `gh search issues --json number,title,body` 응답의 최소 shape(`{number: number, title: string, body: string}[]`) 이고, `marker` 는 T-0582 의 멱등 marker 다. 동작:

- 후보(`searchHits` 중 `body` 가 정확히 marker 라인을 포함하는 hit) 0건 → `{action: 'create'}`(신규 생성).
- 후보 1건 → `{action: 'update', issueNumber: <그 hit 의 number>}`(기존 이슈 갱신).
- 후보 2건 이상 → `{action: 'update', issueNumber: <가장 작은 number — 가장 오래된 이슈>}` 로 결정(멱등 회귀 보호 — gh search 가 우연히 marker 매칭 이슈 다수 반환했을 때도 최초 박제분에 누적 갱신).

이 결정은 T-0583 의 `RealDataResultIssueCommandArgs` 와 어떻게 결합되는지: caller 는 본 resolver 의 결과 action 에 따라 (createArgs 또는 updateArgs) 를 골라 `gh issue create` / `gh issue edit <issueNumber>` 를 실행한다. 본 resolver 는 **그 분기 결정만** 순수 함수로 박제 — 실 gh 호출은 여전히 deferred.

실 gh search issues 호출 / daily-test.sh step_eval wiring / LAN Ollama round-trip 은 전부 deferred(ADR-0045 LAN gate) 그대로 — 본 slice 는 네트워크/DB/LLM/env/credential 접근 0 의 순수 분기 resolver 라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0583-realdata-e2e-result-issue-command-args.md` — 직전 chain slice(명령 layer)의 패턴·범위 경계·문서 스타일·Out of Scope 표기 컨벤션. 본 task 가 그 Out of Scope "search-or-update 의 실 분기 실행" 의 **순수 분기 결정 직전 slice** 임을 확인.
- `test/helpers/realdata-e2e-result-issue-command-args.ts` — 명령 layer(T-0583) 의 createArgs / updateArgs / searchQuery shape 확인. 본 resolver 의 action 이 caller 단에서 그 args 중 하나의 선택을 결정함을 mirror.
- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — marker 의 생성 규칙(gitSha+dateToken 안정 합성) 확인. 본 resolver 는 marker 가 어떻게 만들어졌는지 알 필요 없이 **문자열로서의 marker** 만 보고 body 안 포함 여부로 매칭한다(분리 책임).
- PLAN.md 109행 step ④ — "결과를 daily-test result/rolling 이슈에 박제", raw 미저장(R-59) 명시. 본 resolver 가 body 안의 marker 라인만 보고(narrative 본문·raw 미참조) 분기를 결정함을 확인.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-action.ts` 에 순수 함수 `resolveRealDataResultIssueAction(searchHits: RealDataResultIssueSearchHit[], marker: string): RealDataResultIssueAction` 추가. 산출 action 은 `{action: 'create'}` 또는 `{action: 'update', issueNumber: number}` 의 discriminated union.
- [ ] **신규 타입 최소 정의** — 입력 `RealDataResultIssueSearchHit`(`{number: number, title: string, body: string}` — `gh search issues --json number,title,body` 최소 shape) + 출력 `RealDataResultIssueAction` discriminated union 만 정의. 기존 helper 의 타입 재사용 의무 없음(본 resolver 는 marker 를 문자열로만 보므로 descriptor 타입 import 불요 — 분리 책임 명시).
- [ ] **marker 매칭 정책 (정확 포함)** — hit 의 `body` 가 marker 문자열을 **부분 문자열로 포함**(`body.includes(marker)`)하면 후보로 분류. marker 가 빈 문자열이면 모든 hit 가 매칭되어 의미 없는 결과가 나오므로, marker 빈/공백 시 명시적 throw.
- [ ] **후보 0건 → create 분기** — `searchHits` 가 빈 배열이거나, 모든 hit 의 body 가 marker 미포함이면 `{action: 'create'}` 반환. spec 으로 (a) 빈 배열, (b) hit 1건이지만 body marker 미포함, (c) hit 다수지만 모두 marker 미포함 각각 검증.
- [ ] **후보 1건 → update 분기** — 매칭 hit 1건이면 `{action: 'update', issueNumber: <그 number>}` 반환. spec 으로 검증.
- [ ] **후보 다수 → 최소 번호 update (멱등 회귀 보호)** — 매칭 hit 2+ 면 `issueNumber = Math.min(...candidates.map(h => h.number))` 로 결정(가장 오래된 이슈). 신규 만들지 않고 항상 최초 박제분에 누적 갱신해 이슈 중복 방지. spec 으로 (a) 2건, (b) 3건 (순서 섞임) 각각 검증.
- [ ] **결정론적 출력 (동일 입력 → 동일 출력)** — 동일 `searchHits` + `marker` 입력에 대해 두 번 호출한 결과가 byte-identical 임을 spec 으로 검증(시각·랜덤·env 의존 0). 후보 다수 시 입력 순서가 달라져도 동일 issueNumber(최소값) 가 나옴을 검증.
- [ ] **빈/공백 marker guard** — `marker` 가 빈 문자열·공백-only 면 명시적 throw(전체 매칭 사고 차단). spec 으로 빈 / 공백-only 각각 별도 case 검증.
- [ ] **음수/0 issue number guard** — hit 의 `number` 가 0 이하면(gh 응답이 정상이라면 항상 양수) **명시적 throw**(파싱 사고 차단). spec 으로 0 / 음수 각각 별도 case 검증.
- [ ] **raw 미저장 정합(R-59)** — 본 resolver 는 hit 의 body 를 marker 포함 여부 판정에만 쓰고 **반환하지 않는다**(action descriptor 에 body / title 보유 0 — issueNumber 만). 헤더 주석에 R-59 정합 + step ④ 박제 경계 + "실 gh search 는 deferred(본 helper 는 분기 결정만)" 명시.
- [ ] **입력 mutate 0 / 무공유 보장** — 본 resolver 는 입력 `searchHits` 배열·각 hit 객체를 변형하지 않는다(읽기만). 호출마다 새 action 객체를 반환. spec 으로 입력 참조·키·값 불변 검증.
- [ ] **Happy-path unit test 1+** — (a) 빈 `searchHits` → create, (b) 매칭 hit 1건 → update(그 number), (c) 매칭 hit 2건 (number 200, 100) → update(100, 최소값), 각각 검증.
- [ ] **Error/negative path test** — (a) 빈 `marker` throw, (b) 공백-only `marker` throw, (c) hit number = 0 throw, (d) hit number = -1 throw — 각각 별도 case. 단일 negative 만으로 부족(필드별·종류별 분기마다 cover).
- [ ] **Flow / branch coverage** — guard 분기(marker 빈/공백, number 0 이하) + 후보 0 / 1 / 다수 정상 분기 각 1+ test. 분기마다 cover.
- [ ] **무공유 회귀 test** — 호출 후 입력 `searchHits` 배열 길이·각 hit 의 키·값이 호출 전과 동일함 검증.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 resolver 만이므로 100% 지향.

## Out of Scope

- gh issue 실 호출 / `gh search issues` / `gh issue list` / `gh issue create` / `gh issue edit` 실 실행(step ④ live wiring — credential gate). 본 resolver 는 분기 결정만 산출(부수효과 0).
- gh search response 의 실 JSON 파싱 / `--json` 옵션 합성 / stdout 디코딩 — caller(live wiring)가 `gh ... --json number,title,body` 의 결과를 `JSON.parse` 해서 `RealDataResultIssueSearchHit[]` 로 본 resolver 에 전달하는 책임.
- `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 실 읽기·연동(step ④ live wiring, ADR-0045 LAN gate).
- 실 `EvaluationScoringService.scoreUnit` 호출 / scoring 실행 / 실 `EvaluationResult` 산출(step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
- 명령-args 합성 자체(T-0583 위임만 — searchQuery / createArgs / updateArgs 재합성 금지). 본 resolver 는 action 분기 + issueNumber 결정만.
- title 매칭 / labels 매칭 — marker(body 안의 안정 문자열) 단일 기준만. 본 resolver 는 title / labels 를 참조하지 않는다(분리 책임 — 멱등은 marker 가 책임).
- repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth — 실 wiring 의 환경 책임.
- 외부 템플릿/해시/CLI 라이브러리 도입(새 dependency 0, 내장 string 합성만).
- production `src/` 코드 변경 — 본 task 는 test helper 단독.
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
