---
id: T-1125
title: REALDATA_E2E gating env 셋업 절차 문서화 (issue #1013 C-3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, TBD]
estimatedDiff: 95
estimatedFiles: 3
created: 2026-07-22
independentStream: realdata-live-wiring
dependsOn: [T-1123, T-1124]
touchesFiles: [docs/ops/daily-deploy-test.md, deploy/env.prod.example, test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts]
plannerNote: P5 issue#1013 C-3 — REALDATA gating env 셋업 절차를 daily-deploy-test.md + env.prod.example 에 박제. C-1(T-1123)/C-2(T-1124) 완료 후 마지막 loop slice.
---

# T-1125 — REALDATA_E2E gating env 셋업 절차 문서화 (issue #1013 C-3)

## Why

github issue #1013 (실 github LIVE-wiring 진행판) 의 loop-인계 슬라이스 **C-3** 이다. C-1(`.env.realdata` 자동 source — T-1123 머지 PR #1016)·C-2(gating 활성 시 `pnpm install --frozen-lockfile` + `prisma migrate deploy` 선행 — T-1124 머지 PR #1017)이 배포 기기측 자동화를 완성했으나, **운영자가 무엇을 셋업해야 하는지** 를 설명하는 문서가 아직 없다 — 현재 `docs/ops/daily-deploy-test.md` 와 `deploy/env.prod.example` 둘 다 REALDATA 언급이 0 이다. Q-0054 오너 결정(RESOLVED 2026-07-22)이 C-1→C-2→C-3 순차 큐잉을 명시했고, 본 task 가 그 마지막 슬라이스다. REQ-059(§9 credential 비-커밋)를 준수해 실 secret 은 문서에 담지 않고 placeholder 만 박제한다.

## Required Reading

구현자는 아래 파일만 읽는다 (광범위 read 금지):

- `docs/tasks/T-1125-realdata-gating-env-setup-docs.md` (본 파일)
- `docs/ops/daily-deploy-test.md` — 기존 A~D 섹션 + 루틴 등록. 여기에 REALDATA gating env 셋업 절차 섹션을 신설한다.
- `deploy/env.prod.example` — 기존 env 템플릿. 여기에 REALDATA_E2E gating 키 문서화(주석 블록)를 추가한다.
- `deploy/daily-test.sh` 의 라인 150~183 (`REALDATA_E2E_REQUIRED_ENV` 7종 정의 + `realdata_eval_gating_enabled`), 296~361 (`source_realdata_env` + deps/schema prep) — 문서가 설명할 **정본 동작**. 문서는 이 동작을 서술하되 daily-test.sh 자체는 **변경하지 않는다**.
- `test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` — `env.prod.example` 을 검증하는 **live smoke 파리티 계약**. env.prod.example 변경이 이 spec 을 green 으로 유지하는지 반드시 확인한다 (아래 Acceptance Criteria).
- `README.md` (해당 시 issue #1013 배경 참조는 불요 — 본 task 파일에 요약됨)

## 핵심 배경 (구현 전 필독)

- **gating env 7종** (`REALDATA_E2E_*`, 정본 `test/helpers/realdata-e2e-live-gating.ts`, daily-test.sh 가 이름 mirror): `REALDATA_E2E_LIVE_TEST`, `REALDATA_E2E_LLM_BASE_URL`, `REALDATA_E2E_LLM_API_KEY`, `REALDATA_E2E_LLM_MODEL`, `REALDATA_E2E_LLM_PROVIDER`, `REALDATA_E2E_LLM_API_VERSION`, `REALDATA_E2E_GITHUB_READ_PAT`. 7종이 **모두 present+non-blank** 여야 live smoke leg(eval/collect/rediscovery/eval_chain)이 실행되고, 하나라도 부재면 조용히 SKIP.
- **파일 위치**: 이 gating env + test-DB `DATABASE_URL` 은 배포 기기의 **untracked `/opt/assessment-agent/.env.realdata` (chmod 600)** 에 둔다 — `.env` 가 아니다. daily-test.sh `source_realdata_env` 가 gating 검사 이전 1회 자동 source 한다(C-1). 파일 경로 override: `ENV_REALDATA_FILE`.
- **⚠️ test-DB 강제 경고 (문서에 반드시 박제)**: `.env.realdata` 의 `DATABASE_URL` 은 **반드시 별도 test DB `assessment_test`** 를 가리켜야 한다. jest smoke globalSetup(`test/helpers/jest-smoke-setup.ts`)이 대상 DB 를 `truncateAll` 하므로, 운영 DB(`assessment_agent`)를 지정하면 매일 02:00 운영 DB 가 통째로 지워진다.
- **§9 준수**: 실 PAT / Ollama URL / 실 DB 자격은 문서·코드·journal 어디에도 적지 않는다. `<...>` placeholder 만 사용한다.

## Acceptance Criteria

체크리스트 (각 항목은 명령 실행 또는 특정 파일/심볼 검사로 검증 가능):

- [ ] `docs/ops/daily-deploy-test.md` 에 REALDATA_E2E gating env 셋업 절차 섹션이 신설된다. 최소 포함: (1) gating env 7종 목록 + 각 의미 한 줄, (2) `.env.realdata` 파일 위치(`/opt/assessment-agent/.env.realdata`, chmod 600, untracked) 와 daily-test.sh 자동 source(C-1) 서술, (3) gating 활성 시 자동 `pnpm install --frozen-lockfile` + `prisma migrate deploy` 선행(C-2) 서술, (4) **test-DB `assessment_test` 강제 경고**(운영 DB 소실 위험), (5) gating 부재 시 조용히 SKIP 되는 동작.
- [ ] `deploy/env.prod.example` 에 REALDATA_E2E gating 키 7종 + test-DB `DATABASE_URL` 가 **주석 처리된 참조 블록**(`# REALDATA_E2E_...=<placeholder>`)으로 추가된다. 이 블록은 "이 키들은 `.env` 가 아니라 별도 `.env.realdata` 에 둔다" 를 명시하고, DATABASE_URL 은 `assessment_test` test-DB 를 가리키라는 경고를 담는다. **모든 값은 `<...>` placeholder** — 실 secret 0 (§9).
- [ ] `deploy/env.prod.example` 의 **active(주석 아닌) 대입은 변경하지 않는다** — 필수 active 키 6종(POSTGRES_USER·POSTGRES_PASSWORD·POSTGRES_DB·DATABASE_URL·PORT·AUTH_JWT_SECRET) 의 기존 active 행·값·순서·placeholder 를 그대로 유지한다. REALDATA 키는 **주석 처리로만** 추가한다(active DATABASE_URL 두 번째 행 추가 금지).
- [ ] env.prod.example smoke 파리티 계약 spec 이 **green**: `pnpm exec jest --config ./test/jest-smoke.json --runTestsByPath test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` 통과. (7 불변식 유지 확인 — REALDATA 키 주석 추가는 GATED_KEYS/SEED_LLM 파리티/§9 leakPattern 어느 것도 건드리지 않아야 함. `REALDATA_E2E_GITHUB_READ_PAT` 은 `ghp_`/`GH_TOKEN=`/`Bearer`/`Authorization:` 어휘를 담지 않는 placeholder 로.)
- [ ] (R-112 happy-path) spec 검증: 위 env.prod.example smoke spec 이 REALDATA 키 추가 후에도 7 불변식 전부 true 로 green. **선택**: 구현자가 파리티 강화를 원하면 REALDATA_E2E_* 키가 주석-규율(gated discipline)로만 존재함을 검증하는 focused assertion 1개를 이 spec 에 추가할 수 있다(cap 내). 추가 시 happy(주석 존재)/negative(주석-해제 시 실패) 2 분기 cover.
- [ ] (R-112 error/negative) 위 선택 assertion 을 추가한 경우, active 로 위장한 mutant 사본으로 negative 1+ 를 cover. 추가하지 않은 경우 — 기존 spec 의 negative(a~g) 가 이미 충분 cover 하므로 신규 negative 불요(본 항목은 "분기 없음 — 신규 assertion 미추가 시 생략" 처리).
- [ ] (R-112 branch) 신규 코드 분기 없음(문서/템플릿 추가 + 선택 spec assertion). 선택 assertion 추가 시 그 안의 있음/없음 2 분기만 cover — 그 외 신규 분기 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). (본 task 는 신규 production 심볼 0 이라 coverage 영향 없음 — 기존 임계 유지 확인만.)
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` (+ 위 smoke spec) 실행 결과를 확인한다 (R-110 pr-mode tester 의무).

## Out of Scope

- **`deploy/daily-test.sh` 실행 로직 변경 금지** — 본 task 는 순수 문서화다. 새 leg / ORDER 벡터 / gating 함수 추가 0. (그래서 ORDER-벡터 drift-guard 파리티 spec 3종 T-0791/T-0944/T-0947 은 **트리거되지 않는다** — 이들을 건드리지 말 것. 만약 스코핑상 daily-test.sh 실행부나 그 drift-guard spec 을 수정해야 한다면 그것은 mis-scope 이므로 중단하고 Follow-ups 에 기록.)
- `deploy/env.prod.example` 의 **active 키/값 변경 금지** (POSTGRES_*/DATABASE_URL/PORT/AUTH_JWT_SECRET active 행 불변). REALDATA 키는 주석으로만.
- 실 credential / PAT / Ollama URL / 실 DB 자격 기입 금지 (§9 — placeholder `<...>` 만).
- issue #1013 의 C-4(앱 컨테이너측 encrypt-token GithubModule LIVE collection wiring)·B 항목(오너 수행) 은 본 task 밖.
- `docs/ops/daily-deploy-test.md` 의 기존 A~D 섹션·루틴 등록 절차 재작성 금지 (신규 섹션 append 만).

## Suggested Sub-agents

`implementer → tester`
(architect 불요 — 새 아키텍처 결정 없음. 문서화 + 기존 gating 계약 서술.)

## 머지 후 driver 후속 (Q-0054 오너 지시)

- 본 PR 머지 시 driver 는 `gh issue edit 1013` 으로 **C-3 checkbox 를 check** 하고, 해당 PR 링크를 이슈에 코멘트한다 (Q-0054 결정: "각 slice 머지 시 driver 는 gh issue edit 1013 으로 해당 checkbox 를 check 하고 PR 링크를 코멘트한다").
- C-3 이 issue #1013 의 마지막 loop-인계 slice(C-1/C-2 완료)이므로, driver 는 머지 후 Q-0054 를 `processedByPlanner: true` 로 마킹하는 것을 고려할 수 있다(C-4 는 별도 후속 — 아래 Follow-ups).

## Follow-ups

(생성 시 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append.)
- (planner note) issue #1013 C-4 — 앱 컨테이너측 encrypt-token → `GITHUB_<KEY>_TOKEN_ENC` GithubModule LIVE collection wiring 은 별도 후속 task. 본 C-3 머지 후 planner 가 필요 시 큐잉.
