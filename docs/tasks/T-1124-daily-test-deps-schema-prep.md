---
id: T-1124
title: daily-test.sh gating 활성 시 pnpm install --frozen-lockfile + prisma migrate deploy 선행 — B-3 수동 반복 대체 + executable bash spec + CI hook
phase: P5
status: DONE
completedAt: 2026-07-22T11:07:12Z
mergedAs: af1ba2dcfd20555f95fd2b88eac997b4ca064dd0
prNumber: 1017
reviewRounds: 2
commitMode: pr
coversReq: [REQ-030, REQ-037]
estimatedDiff: 210
estimatedFiles: 3
created: 2026-07-22
dependsOn: []
independentStream: realdata-e2e-github-live-eval-wiring
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-deps-schema.test.sh
  - .github/workflows/ci.yml
plannerNote: "issue #1013 slice C-2 (Q-0054 오너 지시). gating 활성 시 install+migrate 선행 헬퍼(B-3 대체). ORDER/cascade-gate 불변 → drift-guard-neutral, 3파일. 다음 planner fire 는 C-3 큐잉."
---

# T-1124 — daily-test.sh gating 활성 시 pnpm install + prisma migrate deploy 선행

## Why

issue #1013(실 github myungjoo/leemgs 평가 e2e LIVE wiring)의 자동화 loop 인계 slice **C-2** 이다(오너 Q-0054 지시, 2026-07-22, `docs/STATE.json` RESOLVED, T-1123 C-1 머지 f888b321 후속). 현재 nightly 러너의 live smoke(step_eval/collect/rediscovery/eval_chain)는 배포 기기의 `node_modules` 최신화(`pnpm install --frozen-lockfile`)와 test-DB 스키마 적용(`prisma migrate deploy`)이 선행돼 있어야 jest 가 정상 동작한다 — 지금은 오너가 SSH 루틴에서 이 둘을 매번 수동 수행(항목 B-3)한다. 본 task 는 `deploy/daily-test.sh` 가 gating 활성(공유 `realdata_eval_gating_enabled` = 7종 env 모두 present) 일 때 install+migrate 를 자동 선행하도록 배선해 그 수동 의존을 제거한다(B-3 대체).

gating 부재 환경(cloud CI · 일반 LAN)은 install/migrate 를 수행하지 않고 그대로 no-op — 기존 SKIP-guard 동작이 보존된다. C-1(env 자동 source)과 상보로, C-1 이 넘긴 `DATABASE_URL`/gating env 를 전제로 스키마·의존성을 준비한다.

## Required Reading

- `deploy/daily-test.sh` (164~183행 `realdata_eval_gating_enabled` 정의 — 본 헬퍼의 no-op 게이트 재사용 / 296~326행 `source_realdata_env`(C-1) — 본 task 가 추가할 `ensure_realdata_deps_and_schema` 헬퍼는 이와 동형으로 source-guard(333행) **앞** 에 정의 / 337~341행 실행 블록 시작 + `source_realdata_env` 호출 지점 — 본 헬퍼는 이 호출 **직후**, 첫 step 실행 이전에 1회 호출 / 287행 `ORDER` 배열·372~384행 eval SKIP-guard 구조 — 본 task 는 일절 변경하지 않는다)
- `deploy/daily-test-step-env-source.test.sh` (T-1123 — 본 executable bash spec 이 정확히 mirror 할 정본: self-contained(네트워크 0 / 실 install·migrate spawn 0 / 실 credential echo 0) + PATH-shim 으로 `pnpm` 대체 + WORKDIR 격리(mktemp -d, trap EXIT cleanup) + 마지막 `RESULT: PASS` 출력 패턴)
- `.github/workflows/ci.yml` (daily-test step_env_source(.env.realdata 자동 source) 배선 검증 CI step — T-1123 이 추가한 마지막 daily-test 검증 step. 본 task 가 추가할 다음 step 의 위치·형식 참고)

## 설계 메모 (구현 가이드 — self-contained)

- **헬퍼**: source-guard 앞에 `ensure_realdata_deps_and_schema` 함수 정의. 동작:
  - **gating 부재면 no-op**: `if ! realdata_eval_gating_enabled; then log "deps/schema: gating 부재 — no-op (install/migrate 미수행)"; return 0; fi`. cloud CI / 일반 LAN 은 여기서 즉시 반환(install·migrate 미실행).
  - **install**: `pnpm install --frozen-lockfile` 실행. 실패(`if ! ...`)면 진단 로그 1줄 후 `return 1`(migrate 미실행 — short-circuit).
  - **migrate**: install 성공 시 `pnpm exec prisma migrate deploy` 실행. 실패면 진단 로그 1줄 후 `return 1`.
  - 둘 다 성공이면 완료 로그 1줄 후 `return 0`.
- **호출 위치**: 실행 블록에서 `source_realdata_env` **직후**, `step_redeploy` 이하 step 체인 **이전**에 1회 호출. **cascade-gate·ORDER·mark 로직은 일절 변경하지 않는다** — 호출 결과로 어떤 `mark` 도 하지 않고, 실패 시엔 `|| log "deps/schema: 준비 실패 — 이후 eval-group 이 자연 FAIL 로 표면화"` 로 로그만 남기고 진행(gating 활성인데 install/migrate 실패면 후속 step_eval 이 자연스럽게 FAIL 로 신호). 이로써 drift-guard smoke spec 3종(T-0791/T-0944/T-0947)의 ORDER·상태집계·cascade 계약이 불변 → 6파일 cap 회피.
- **§9**: install/migrate 명령·성공여부·실패단계만 로그. `DATABASE_URL` 등 env 값은 로그/JSON/stdout 어디에도 echo 0.

## Acceptance Criteria

- [ ] `deploy/daily-test.sh` 에 `ensure_realdata_deps_and_schema` 헬퍼가 source-guard **앞** 에 정의되어, source 시 함수만 노출되고 실행 블록 부작용 0(네트워크·redeploy·실 install/migrate spawn 0)임을 spec 이 검증.
- [ ] **Happy-path**: gating 7종 env 가 모두 set(활성) 이고 PATH-shim `pnpm` 이 성공(exit 0) 반환 시 → `ensure_realdata_deps_and_schema` 가 `install --frozen-lockfile` 그 다음 `exec prisma migrate deploy` 순서로 호출하고 `return 0` 함을 검증하는 bash test 1+.
- [ ] **Negative/branch (gating 부재)**: gating env 미충족 시 → 헬퍼가 no-op `return 0`(install/migrate shim 이 한 번도 호출되지 않음 — invocation 기록 파일 비어있음) + 진단 로그는 "no-op" 문구만 출력함을 검증. 기존 SKIP 동작 보존.
- [ ] **Negative/branch (install 실패)**: gating 활성 + `pnpm install` shim 이 exit 1 → 헬퍼가 `return 1` 이고 `prisma migrate deploy` 는 호출되지 않음(short-circuit)을 invocation 기록으로 검증.
- [ ] **Negative/branch (migrate 실패)**: gating 활성 + install 성공 + `prisma migrate deploy` shim 이 exit 1 → 헬퍼가 `return 1` 임을 검증.
- [ ] **순서 결정론**: happy-path 에서 install invocation 이 migrate invocation **보다 먼저** 기록됨을 순번으로 assert(install→migrate 고정 순서).
- [ ] **§9 값-echo 0**: 더미 `DATABASE_URL=postgres://dummy-not-a-real-secret@x/y` 를 gating env 로 set 한 뒤 헬퍼를 돌려도, 로그(stderr) 어디에도 그 값 문자열이 나타나지 않음을 grep 으로 검증.
- [ ] executable bash spec `deploy/daily-test-step-deps-schema.test.sh` 신설 — T-1123 spec 과 동형으로 self-contained(네트워크 0 / 실 install·migrate spawn 0 / PATH-shim `pnpm`), WORKDIR 격리(`mktemp -d`, trap EXIT cleanup), 마지막에 `RESULT: PASS` 출력 + 실패 시 exit 1.
- [ ] `.github/workflows/ci.yml` 에 `daily-test step_deps_schema(install+migrate 선행) 배선 검증` CI step 추가(step_env_source 검증 step 다음, `run: bash deploy/daily-test-step-deps-schema.test.sh`).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(line ≥ 80% / function ≥ 80% — 본 task 는 bash/CI 만 변경, TS coverage 회귀 0 확인) + `bash deploy/daily-test-step-deps-schema.test.sh` exit 0.
- [ ] 분기: `ensure_realdata_deps_and_schema` 는 (gating 부재 / install 실패 / migrate 실패 / 전부 성공) 4분기를 가지므로 각 분기 1+ test 로 cover(위 4항목).

## Out of Scope

- **ORDER 배열 / cascade-gate 구조 / mark 로직 변경 금지** — 본 task 는 leg 를 추가하지 않으므로 `ORDER=(...)` 벡터·cascade-gate 개수·step SKIP-guard 를 바꾸지 않는다. drift-guard smoke spec 3종(T-0791/T-0944/T-0947)은 건드리지 않으며(변경 시 6파일 > 5-파일 cap), ORDER/gate 변경이 불가피하다고 판단되면 즉시 중단하고 Follow-ups 에 기록 후 planner 에 재-scope 요청.
- `.env.realdata` 자동 source(C-1, T-1123 완료) 재구현 금지 — 본 헬퍼는 C-1 이 넘긴 env 를 전제로 install/migrate 만 담당.
- test-DB(`assessment_test`) 자체의 생성/선택 로직(`createdb` 등)은 본 task 밖 — `DATABASE_URL` 이 이미 유효한 test-DB 를 가리킨다고 전제(운영 DB 오삭제 방지는 C-1 journal 주의사항 참조, `.env.realdata` 가 test-DB 를 지정).
- `docs/ops/daily-deploy-test.md` / `deploy/env.prod.example` 문서화는 본 task 밖(C-3 slice).
- 앱 컨테이너측 `GITHUB_INSTANCES` / LIVE collection wiring 은 본 task 밖(C-4 후속).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (planner) issue #1013 slice C-3 — `docs/ops/daily-deploy-test.md` + `deploy/env.prod.example` REALDATA gating env 셋업 절차 문서화(B-1/B-2 인계). C-2 머지 후 다음 planner fire 가 큐잉.
- (planner) issue #1013 slice C-4 — 앱 컨테이너측 `GITHUB_INSTANCES` / `GITHUB_<KEY>_TOKEN_ENC` LIVE collection wiring. C-3 이후 큐잉.
