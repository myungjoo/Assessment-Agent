---
id: T-0965
title: deploy/README.md 배포 runbook cross-artifact 정본 계약(OnCalendar 03:00 ↔ timer·DATABASE_URL host:port ↔ compose·named volume·PORT 3000·systemd unit 파일명 실존·cp env.prod.example .env·SEED_LLM_* 키셋 ↔ seed-llm-config.sh 소비셋·redeploy→seed 호출 문서화) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 430
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0964(env.prod.example 내부 템플릿, 420 LOC)·T-0963(Dockerfile 내부 멀티스테이지, 460 LOC)·T-0962(docker-compose 내부 오케스트레이션, 420 LOC)·T-0961(systemd unit 내부 directive, 642 LOC) 동형. R-112 4종 cover 위한 다수 assert(cross-artifact 정본 앵커 8종·SEED_LLM_* 키셋 parity·negative mutant a~h 8종·원본 read-only·§9 secret-safety) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·deploy/README.md 및 대조 artifact 미변경."
independentStream: realdata-e2e-deploy-readme-runbook-cross-artifact-parity-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-deploy-readme-runbook-cross-artifact-parity-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §109 재배포 runner chain 의 documentation single-source leg — deploy/README.md 배포 runbook 이 문서화한 cross-artifact 값(OnCalendar 03:00·DB host:port·named volume·PORT·unit 파일명·cp 명령·SEED_LLM_* 키셋)이 실 artifact 와 parity 미봉(grep NONE for deploy/README in test/smoke). compose/entrypoint/systemd/Dockerfile/env internal split(T-0960~T-0964)의 문서 counterpart — runbook drift→운영자 오배포."
---

# T-0965 — deploy/README.md 배포 runbook cross-artifact 정본 계약 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh 내부 부팅: T-0960, systemd unit 내부 directive: T-0961, docker-compose.yml 내부 오케스트레이션: T-0962, Dockerfile 내부 멀티스테이지: T-0963, env.prod.example 내부 템플릿: T-0964)에서, 그 스택 전체를 운영자가 **손으로 배포·트리거·seed 하는 절차의 정본(single-source)** 인 `deploy/README.md` 배포 runbook 의 **cross-artifact 문서-값 parity 계약** 은 아직 미봉이다(origin/main grep 확인 — `test/smoke/` 에 `deploy/README` 참조 spec NONE). runbook 은 각 sealed artifact 의 **핵심 값·경로·명령을 산문으로 재기술**하므로, 그 문서-값이 실 artifact 와 어긋나면(drift) — 운영자가 문서를 신뢰해 잘못된 스케줄/포트/DB호스트/키셋/파일명으로 배포한다. 이는 각 artifact 의 내부 계약(T-0960~T-0964)이 봉해져도 **문서가 그 artifact 를 잘못 가리키면 배포가 조용히 틀어지는** distinct 표면이다 — docker-entrypoint.sh 가 parity(T-0797) 뒤에도 T-0960 이, env.prod.example 이 parity(T-0795) 뒤에도 T-0964 가 별도로 필요했던 것과 동형으로, runbook 도 별도 정본 앵커가 필요하다. 구체적으로 runbook 은 다음을 문서화한다(각각 실 artifact 와 parity 대상): (1) 야간 트리거 스케줄 `OnCalendar=*-*-* 03:00:00`(§5) ↔ `deploy/assessment-agent-redeploy.timer`, (2) `DATABASE_URL` 예시의 host `postgres`:port `5432`(§3) ↔ `docker-compose.yml` postgres 서비스명·포트, (3) named volume `assessment-agent-postgres-data`(§4) ↔ compose `volumes.name`, (4) 기본 포트 `3000`(§4) ↔ compose `${PORT:-3000}`, (5) systemd unit 파일명 `assessment-agent-redeploy.{service,timer}`(§5 cp 명령) ↔ `deploy/` 실 파일 실존, (6) `cp deploy/env.prod.example .env`(§3) ↔ env.prod.example 실존, (7) `SEED_LLM_*` 키셋(§5.2 — `SEED_LLM_ENDPOINT_URL`/`PROVIDER`/`MODEL_ID`/`API_KEY`/`CONFIG_ID`) ↔ `deploy/seed-llm-config.sh` 소비셋, (8) redeploy.sh 가 seed-llm-config.sh 를 호출한다는 문서 서술(§5.2) ↔ redeploy.sh 실 호출 행. runbook 정본이 변질되면 — OnCalendar 문서가 실 timer 와 어긋나면 운영자가 "매일 03:00" 라 믿지만 실제는 다른 시각 / DB host 문서가 compose 서비스명과 어긋나면 컨테이너 DB 연결 실패 / named volume 문서가 어긋나면 백업·영속성 오해 / unit 파일명 오타면 `cp` 실패 / 문서화된 `SEED_LLM_*` 키셋이 스크립트 소비셋과 어긋나면 운영자가 잘못된 키로 seed 실패 — 무인 배포가 조용히 오구성으로 진행된다. 본 task 는 그 documentation single-source leg 의 cross-artifact 정본을 정적 앵커로 봉해 재배포 runner chain 을 완결에 한 걸음 더 붙인다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `deploy/README.md` 전체 — §3(`cp deploy/env.prod.example .env`·`DATABASE_URL` 예시 `postgresql://assessment_agent:<비밀번호>@postgres:5432/assessment_agent?schema=public`)·§4(기본 포트 `3000`·named volume `assessment-agent-postgres-data`)·§5(systemd unit cp: `assessment-agent-redeploy.service`/`assessment-agent-redeploy.timer`·`OnCalendar=*-*-* 03:00:00`)·§5.2(`SEED_LLM_ENDPOINT_URL`/`SEED_LLM_PROVIDER`/`SEED_LLM_MODEL_ID`/`SEED_LLM_API_KEY`/`SEED_LLM_CONFIG_ID`·redeploy.sh→seed-llm-config.sh 호출 서술). 본 task 는 이 산문에서 정본 토큰을 정적 추출한다(재구현/변경 0 — read-only).
- `deploy/assessment-agent-redeploy.timer` — `OnCalendar=*-*-* 03:00:00` 실값. README §5 OnCalendar 문서-값과 parity 대조.
- `docker-compose.yml` — postgres 서비스명(`postgres`)·DB 포트(`5432`)·named volume(`assessment-agent-postgres-data`)·app 포트(`${PORT:-3000}`). README §3/§4 문서-값과 parity 대조.
- `deploy/seed-llm-config.sh` — 실제 소비하는 `SEED_LLM_[A-Z_]+` 키셋. README §5.2 문서화 키셋과 집합 parity 대조(readFileSync 정적 추출 — T-0964 와 동형이나 대조 방향은 README↔script).
- `deploy/redeploy.sh` — seed-llm-config.sh 호출 행(`bash "$REPO_DIR/deploy/seed-llm-config.sh"`) 실존. README §5.2 "redeploy.sh 가 seed-llm-config.sh 를 호출" 서술과 parity 대조.
- `test/smoke/realdata-e2e-env-prod-example-internal-template-single-source-required-active-key-presence-placeholder-secret-safety-optional-gated-discipline-seed-llm-key-parity-contract.smoke-spec.ts` — 형제 T-0964 패턴(readFileSync 정적 추출·repo-root `__dirname` cwd-robust 해석·선언적 토큰 존재/값/키셋 parity assert·합성 mutant drift-detection·원본 read-only·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 README↔artifact cross-parity 에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-deploy-readme-runbook-cross-artifact-parity-contract.smoke-spec.ts` 신설. `deploy/README.md`·`deploy/assessment-agent-redeploy.timer`·`docker-compose.yml`·`deploy/seed-llm-config.sh`·`deploy/redeploy.sh` 를 `readFileSync` 로 읽어 정본 토큰을 정적 추출한다(실 배포/실 컨테이너/실 systemd/실 seed 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0964 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만. 실 마크다운/systemd/yaml 파서 라이브러리 도입 0 — node 내장 `fs`/`path` + 정규식/행 슬라이스만.
- [ ] **Happy-path**: runbook cross-artifact 정본 불변식 각각에 대해 성공 assert 1+ —
  - README §5 의 `OnCalendar=*-*-* 03:00:00` 문서-값이 `deploy/assessment-agent-redeploy.timer` 의 실 `OnCalendar` 값과 byte-동일,
  - README §3 `DATABASE_URL` 예시의 host(`postgres`)·port(`5432`)가 `docker-compose.yml` 의 postgres 서비스명·DB 포트와 일치,
  - README §4 의 named volume `assessment-agent-postgres-data` 문서-값이 compose `volumes.*.name` 과 일치,
  - README §4 의 기본 포트 `3000` 문서-값이 compose `${PORT:-3000}` 기본값과 일치,
  - README §5 cp 명령이 가리키는 systemd unit 파일명(`assessment-agent-redeploy.service`·`assessment-agent-redeploy.timer`)이 `deploy/` 에 실 파일로 존재,
  - README §3 의 `cp deploy/env.prod.example .env` 명령이 가리키는 `deploy/env.prod.example` 이 실 파일로 존재,
  - README §5.2 가 문서화한 `SEED_LLM_*` 키셋과 redeploy.sh→seed-llm-config.sh 호출 서술이 실 파일과 정합(아래 별도 assert).
- [ ] **SEED_LLM_* 키셋 cross-artifact parity 계약**: `deploy/seed-llm-config.sh` 를 readFileSync 로 읽어 `SEED_LLM_[A-Z_]+` 토큰을 정적 추출한 소비 키셋과, README §5.2 가 문서화한 `SEED_LLM_*` 키셋이 **정확히 동일 집합**(누락·잉여 0)임을 단언하는 assert 1+ (README 가 스크립트 미소비 키를 문서화하거나 스크립트 소비 키를 문서화 누락하면 drift — 운영자 오타/누락 유발).
- [ ] **redeploy→seed 호출 문서 parity 계약**: `deploy/redeploy.sh` 가 `deploy/seed-llm-config.sh` 를 실제 호출하는 행이 존재함과, README §5.2 가 "redeploy.sh 가 seed-llm-config.sh 를 호출" 이라 서술함이 **양방향 정합**임을 단언하는 assert 1+ (문서가 호출을 주장하나 스크립트에 호출 없으면 / 반대면 drift).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~h 8종):
  - (a) README §5 의 `OnCalendar=*-*-* 03:00:00` 을 `OnCalendar=*-*-* 04:00:00` 로 바꾼 mutant → 스케줄 문서-값 drift(timer 와 불일치) 검출,
  - (b) README §3 `DATABASE_URL` 예시의 host 를 `postgres` 에서 `localhost` 로 바꾼 mutant → DB host 문서-값 drift(compose 서비스명 불일치) 검출,
  - (c) README §4 의 named volume 을 `assessment-agent-postgres-data` 에서 `pgdata` 로 바꾼 mutant → volume 문서-값 drift 검출,
  - (d) README §4 의 기본 포트 `3000` 을 `8080` 으로 바꾼 mutant → 포트 문서-값 drift(compose 기본값 불일치) 검출,
  - (e) README §5 cp 명령의 unit 파일명을 `assessment-agent-redeploy.timer` 에서 `redeploy.timer` 로 바꾼 mutant → 존재하지 않는 파일 가리킴(cp 실패 유발) 검출,
  - (f) README §5.2 에서 `SEED_LLM_MODEL_ID` 문서화를 제거한 mutant → seed-llm-config.sh 소비셋 ⊋ README 문서화셋 parity drift 검출,
  - (g) seed-llm-config.sh 소비 키셋 fixture 에 스크립트가 안 읽는 `SEED_LLM_TEMPERATURE` 를 추가한 합성 mutant → README 문서화셋 ⊊ 소비셋(잉여 키) drift 검출,
  - (h) redeploy.sh 의 seed-llm-config.sh 호출 행을 제거한 mutant → 문서(§5.2 호출 서술) ↔ 스크립트(호출 없음) 양방향 drift 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 README/timer/compose/seed-llm-config/redeploy 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/토큰/실 DATABASE_URL 자격/실 endpoint 가 등장하지 않음(OnCalendar 값·서비스명·볼륨명·포트·파일명·`<...>` placeholder·`SEED_LLM_*` 키 이름·비시크릿 값 `assessment_agent`/`3000`/`5432` 만)을 단언하는 test 1+. mutant 에 쓰는 합성 값조차 명백한 dummy(`04:00:00`·`localhost`·`pgdata`·`8080`)로 한정 — 실 자격 0. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: 각 정본 앵커의 일치/drift 분기(OnCalendar·DB host·volume·port·unit 파일명·env.example 존재·SEED_LLM_* 키셋·redeploy→seed 호출)를 각 test 로 분리. README/artifact 는 조건 분기 없는 선언적 문서·설정 — "런타임 분기 없음(선언적 runbook·설정) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 배포/실 seed/실 컨테이너/실 systemd 0, 대조 artifact 5종(`deploy/README.md`·timer·`docker-compose.yml`·seed-llm-config.sh·redeploy.sh) 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/README.md`·`deploy/assessment-agent-redeploy.timer`·`docker-compose.yml`·`deploy/seed-llm-config.sh`·`deploy/redeploy.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- T-0961(systemd unit 내부 directive) smoke 재구현/변경 0 — T-0961 은 timer/service 파일 **자신의 내부 directive**(OnCalendar 실존·Persistent·RandomizedDelaySec·timer↔service pairing)를 봉함. 본 task 는 README **문서-값** 이 그 timer 실값과 **parity** 인지(cross-artifact) — timer 내부 계약 재검증 0.
- T-0962(docker-compose 내부 오케스트레이션) smoke 재구현/변경 0 — compose 내부 계약(depends_on·healthcheck·named volume 선언 등)은 T-0962 봉함. 본 task 는 README 문서-값(DB host·port·volume명)이 compose 실값과 parity 인지만.
- T-0964(env.prod.example 내부 템플릿)·T-0959(seed-llm-config 런타임 gating) smoke 재구현/변경 0 — 본 task 의 `SEED_LLM_*` 키셋 parity 는 **README 문서화셋 ↔ seed-llm-config 소비셋** cross-artifact 집합 대조만(env.prod.example 템플릿 키셋 parity 는 T-0964, 스크립트 gating semantic 은 T-0959 봉함).
- 실 마크다운 렌더/실 `cp`/실 systemd install/실 docker compose up 실측 도입 0 — 정적 텍스트 앵커만(runbook 문서-값 ↔ artifact 실값 parity).
- ADR-0043/ADR-0040/ADR-0003 등 README 가 링크하는 ADR 본문 계약 검증 0 — 본 task 는 배포 절차 정본 값 parity 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
