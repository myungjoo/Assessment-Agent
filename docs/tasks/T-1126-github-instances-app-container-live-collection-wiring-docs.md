---
id: T-1126
title: 앱 컨테이너 LIVE GitHub collection env 셋업 문서화 + env.prod.example 참조블록 (issue #1013 C-4)
phase: P5
status: DONE
prNumber: 1019
mergedAs: 0b5c21e5
commitMode: pr
coversReq: [REQ-044]
estimatedDiff: 90
estimatedFiles: 3
independentStream: issue-1013-live-wiring
dependsOn: []
touchesFiles:
  - docs/ops/daily-deploy-test.md
  - deploy/env.prod.example
  - test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts
created: 2026-07-22
plannerNote: P5/issue#1013 loop slice C-4 — 앱 컨테이너 LIVE GitHub collection(GITHUB_INSTANCES + encrypt-token _TOKEN_ENC) 운영자 셋업 문서화, C-3(T-1125) 패턴 mirror
---

# T-1126 — 앱 컨테이너 LIVE GitHub collection env 셋업 문서화 + env.prod.example 참조블록 (issue #1013 C-4)

## Why

issue #1013 (실 github.com `myungjoo`/`leemgs` 평가 e2e LIVE wiring) 의 loop 인계 C-series 중 **C-4** 슬라이스다. C-1(`.env.realdata` 자동 source, T-1123)·C-2(deps/schema 선행, T-1124)·C-3(REALDATA gating env 문서화, T-1125)가 모두 머지돼 **daily-test.sh 의 smoke live-leg 경로**(호스트측 평문 `REALDATA_E2E_GITHUB_READ_PAT` 소비)는 닫혔다.

C-4 는 그와 **별개 경로**인 **앱 컨테이너측 LIVE collection**(`GithubModule` 이 런타임에 실 GitHub 활동을 수집하는 경로)을 운영자가 켤 수 있게 문서·template 을 완결한다. 수집 코드 경로(`resolveGithubInstances` → `decryptGithubInstanceConfigToken` → `GithubInstanceClient` → `GithubCollectionSpecService`)는 이미 main 에 shipped 되어 있으나, 그것을 활성화하는 **운영 env 셋업 절차**(`GITHUB_INSTANCES` 활성 key 열거 + `scripts/encrypt-token.ts` 로 `GITHUB_PUBLIC_TOKEN_ENC` 암호문 생성)가 `deploy/env.prod.example`·`docs/ops/daily-deploy-test.md` 어디에도 박제돼 있지 않다(현재 두 문서 모두 `GITHUB_INSTANCES` 언급 0). 본 task 가 그 gap 을 C-3(T-1125)와 동형 패턴(문서 §추가 + env template 주석 참조블록)으로 닫는다.

PLAN P5 "실 평가 e2e 테스트 데이터 = github.com myungjoo + leemgs 공개 활동" bullet 의 잔여 운영 전제(`GITHUB_<KEY>_TOKEN_ENC` 주입 경로 문서화)를 cover 한다.

## Required Reading

- `docs/tasks/T-1125-realdata-gating-env-setup-docs.md` — 직전 C-3 task 정의(본 task 가 mirror 할 패턴: 문서 §추가 + env.prod.example 주석 참조블록, 실값 0 placeholder only §9).
- `docs/ops/daily-deploy-test.md` — §E(REALDATA gating env 셋업) 바로 뒤에 §F(앱 컨테이너 LIVE GitHub collection 셋업) 를 신설한다. §E 의 서술 톤·구조를 그대로 따른다.
- `deploy/env.prod.example` — 파일 끝의 "REALDATA_E2E gating env" 주석 참조블록(C-3 이 추가) 직후에 `GITHUB_INSTANCES` app-container LIVE collection 주석 참조블록을 추가한다.
- `src/github/github-instance-config.ts` — `GITHUB_INSTANCES` / `GITHUB_<KEY>_HOST` / `_ORG` / `_REPOS` / `_TOKEN_ENC` env 이름 규약(정확한 키 이름·필수/선택 구분·대문자 정규화). 문서에 적을 키 이름의 정본.
- `scripts/encrypt-token.ts` (header 주석 6~11행) — 평문 PAT → `_TOKEN_ENC` 암호문 생성 CLI 사용법(`LLM_APIKEY_ENC_KEY` 필요). 문서 §F 가 이 명령을 인용한다.
- `test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` — env.prod.example 의 active/commented 대입·placeholder·secret-safety 계약을 검증하는 parity smoke spec. **line 563 부근의 secret-safety 정규식**(`ghp_`/`GITHUB_TOKEN`/`GH_TOKEN`/`Bearer`/`Authorization`/`sk-`)을 반드시 확인 — 새 주석블록의 키/placeholder 가 이 패턴에 걸리지 않게 작성해야 한다.

## Acceptance Criteria

- [ ] `docs/ops/daily-deploy-test.md` 에 **§F "앱 컨테이너 LIVE GitHub collection 셋업 (선택)"** 신설. 내용: (1) 이 경로가 §E(smoke live-leg, 호스트 평문 PAT)와 **별개**임을 1줄 명시, (2) 활성화 env — `GITHUB_INSTANCES=public`, `GITHUB_PUBLIC_HOST=github.com`, `GITHUB_PUBLIC_ORG`/`GITHUB_PUBLIC_REPOS`(myungjoo/leemgs 지정 예), `GITHUB_PUBLIC_TOKEN_ENC`(암호문), (3) 암호문 생성 절차 — `LLM_APIKEY_ENC_KEY` 를 세팅한 뒤 `scripts/encrypt-token.ts` 로 read-scope PAT 를 암호화(§9: 평문 PAT·키는 git/journal 커밋 금지, env/컨테이너 주입만), (4) `_HOST`/`_TOKEN_ENC` 부재 시 그 instance 는 조용히 reject(수집 no-op)됨을 명시.
- [ ] `deploy/env.prod.example` 에 **주석 참조블록** 추가(모두 `#` 주석, active key 0 — C-3 REALDATA 블록과 동형). 키: `GITHUB_INSTANCES` / `GITHUB_PUBLIC_HOST` / `GITHUB_PUBLIC_ORG` / `GITHUB_PUBLIC_REPOS` / `GITHUB_PUBLIC_TOKEN_ENC`. placeholder 는 실 secret 처럼 보이지 않게(예: `<encrypt-token_으로_생성한_암호문>`), secret-safety 정규식(`ghp_`/`GITHUB_TOKEN`/`GH_TOKEN`/`Bearer`/`sk-`)에 걸리지 않게 작성.
- [ ] `pnpm test:smoke` 통과 — env.prod.example parity smoke spec(위 Required Reading 의 spec)이 새 주석블록을 **placeholder-secret-safety + optional-gated discipline** 계약 위반 없이 green 으로 수용. 필요 시 그 spec 에 새 블록을 인지하는 assertion 을 추가(happy: 주석블록 present + 모든 대입이 commented + placeholder 안전 / negative: 주석블록의 임의 키를 active 화하거나 실 secret 형태 값으로 바꾼 mutant → 계약 위반 검출). **분기별 test 분리** — required-active vs optional-commented 규율 각 1+.
- [ ] negative cases 충분 cover — 새 블록에 대해 최소 (a) active 화 mutant 검출, (b) secret-safety 정규식 매칭 값 mutant 검출 2종 이상(단일 negative 금지).
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 는 production `src/` 코드 무변경이므로 coverage 는 기존 유지 — 새 실행 코드 추가 없음(spec 만 amend 가능).
- [ ] 머지 후 driver 가 issue #1013 의 C-4 checkbox check + PR 링크 코멘트(C-1/C-2/C-3 선례).

## Out of Scope

- **daily-test.sh 변경 금지** — 본 task 는 문서·env template·parity spec 만. daily-test.sh leg 추가는 drift-guard parity spec 3종(T-0791/T-0944/T-0947) 동반 갱신을 강제해 5파일 cap 을 깨므로 절대 손대지 않는다(known hazard).
- `src/github/*` / `src/assessment-collection/*` 수집 코드 변경 금지 — 이미 main 에 shipped. 본 task 는 그 활성화 절차만 문서화.
- 실 PAT / `LLM_APIKEY_ENC_KEY` / 암호문 실값을 repo·env.prod.example·문서에 기입 금지(§9) — 전부 placeholder.
- `deploy/README.md` / `docs/ops/runbook.md` / cross-artifact parity(deploy-readme-runbook) 대규모 동기화 — 만약 env.prod.example 변경이 cross-artifact parity smoke spec 을 깨서 runbook/README 동기가 필요하고 총 파일이 5개를 넘으면 **손대지 말고 Follow-ups 로 분할**.
- C-4 원문의 다중 GitHub host(sec/ecode) / Confluence instance LIVE wiring — github.com public 1 instance 만. 나머지는 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
