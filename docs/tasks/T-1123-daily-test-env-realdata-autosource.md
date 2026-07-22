---
id: T-1123
title: daily-test.sh 가 untracked .env.realdata 존재 시 자동 source — 루틴 SSH env source 의존 제거 + executable bash spec + CI hook
phase: P5
status: DONE
completedAt: 2026-07-22T09:53:54Z
mergedAs: f888b321
prNumber: 1016
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-037]
estimatedDiff: 190
estimatedFiles: 3
created: 2026-07-22
dependsOn: []
independentStream: realdata-e2e-github-live-eval-wiring
touchesFiles:
  - deploy/daily-test.sh
  - deploy/daily-test-step-env-source.test.sh
  - .github/workflows/ci.yml
plannerNote: "issue #1013 slice C-1 (Q-0054 오너 지시 2026-07-22). daily-test.sh 가 untracked .env.realdata 자동 source(B-5 대체). ORDER/cascade-gate 불변 → drift-guard-neutral, 3파일 cap 내. 다음 planner fire 는 C-2 큐잉."
---

# T-1123 — daily-test.sh 가 untracked .env.realdata 존재 시 자동 source

## Why

issue #1013(실 github myungjoo/leemgs 평가 e2e LIVE wiring)의 자동화 loop 인계 slice **C-1** 이다(오너 Q-0054 지시, 2026-07-22, `docs/STATE.json` RESOLVED). 현재 nightly 러너는 gating env 7종(`REALDATA_E2E_*`) + test-DB `DATABASE_URL` 을 Claude Desktop 루틴의 SSH 커맨드가 수동으로 source 해 넘겨야 동작한다(오너 수행 항목 B-5). 본 task 는 `deploy/daily-test.sh` 가 배포 기기의 untracked `.env.realdata`(chmod 600, `$REPO_DIR/.env.realdata`) 존재 시 이를 자동 source 하도록 배선해 그 루틴측 수동 의존을 제거한다(B-5 대체). credential/env 파일 부재 환경(cloud CI·일반 LAN)은 파일이 없으므로 아무 것도 source 하지 않고 그대로 진행 — 기존 SKIP-guard(gating 부재 → no-op) 동작이 그대로 보존된다.

T-1122(PR #1015 머지, 86d1c2c1)로 8번째 leg step_eval_chain 배선까지 완료된 상태이며, 본 C-1 은 leg 를 추가하지 않고 env 주입 경로만 자동화한다.

## Required Reading

- `deploy/daily-test.sh` (44~64행 env override 기본값 + log() 헬퍼 / 150~183행 gating env 이름 배열 + realdata_eval_gating_enabled / 283~303행 source-guard 구조 — 본 task 가 추가할 `source_realdata_env` 헬퍼는 source-guard **앞**에 정의해야 spec 이 함수 단위로 호출 가능. 실행 블록에서는 gating 검사 이전 시점에 1회 호출)
- `deploy/daily-test-step-eval.test.sh` (T-0612 — 본 executable bash spec 이 정확히 mirror 할 정본: self-contained(네트워크 0 / jest 실 spawn 0 / 실 credential echo 0) 구조 + WORKDIR 격리 + §9 값-echo 0 검증 패턴 + pass/failtest 집계)
- `.github/workflows/ci.yml` (130~160행 — daily-test step_eval/collect/rediscovery/eval_chain 검증 CI step 4개 형태. 본 task 가 추가할 5번째 step 의 정확한 위치·형식 참고)

## 설계 메모 (구현 가이드 — self-contained)

- **헬퍼**: source-guard(`if [ "${BASH_SOURCE[0]}" != "${0}" ]` 앞)에 `source_realdata_env` 함수를 정의한다. 동작:
  - env 파일 경로는 override 가능: `ENV_REALDATA_FILE="${ENV_REALDATA_FILE:-$REPO_DIR/.env.realdata}"`.
  - 파일이 **존재하지 않으면** 진단 로그 1줄(경로만) 후 `return 0` — run 을 실패시키지 않는다(부재 = 정상 no-op, 기존 SKIP-guard 가 gating 부재를 처리).
  - 파일이 존재하지만 **읽을 수 없으면**(`! [ -r ... ]`) 진단 로그(경로만) 후 `return 0` — run 을 실패시키지 않는다(안전 우선).
  - 파일이 존재+readable 이면 `set -a; source "$file"; set +a` 로 auto-export(자식 jest 프로세스가 상속) 후 로그 1줄(파일 경로 + "sourced" — **값은 절대 echo 0**). source 는 파일에 든 값을 env 로 반영하며, 이 override 우선순위(파일 값이 반영됨)는 결정론적임을 주석으로 명시.
- **호출 위치**: 실행 블록에서 `daily-test 시작` 로그 직후, gating 검사(step eval 이하) **이전**에 1회 호출. ORDER 배열·cascade-gate·mark 로직은 **일절 변경하지 않는다**(drift-guard-neutral).
- **§9**: 파일 경로·"sourced" 여부만 로그. 파일 내용(PAT / Ollama URL / DATABASE_URL 값)은 로그/JSON/stdout 어디에도 echo 0. `.env.realdata` 는 git 에 추가하지 않는다(untracked 유지).

## Acceptance Criteria

- [ ] `deploy/daily-test.sh` 에 `source_realdata_env` 헬퍼가 source-guard **앞**에 정의되어, source 시 함수만 노출되고 실행 블록 부작용 0(네트워크·redeploy·jest spawn 0)임을 spec 이 검증.
- [ ] **Happy-path**: `.env.realdata` 파일이 존재+readable 이고 gating 7종 더미값을 담으면 → `source_realdata_env` 호출 후 그 7종 env 가 set/export 되어 `realdata_eval_gating_enabled` 가 enabled(exit 0)로 전환됨을 검증하는 bash test 1+.
- [ ] **Negative/branch (파일 부재)**: `.env.realdata` 부재 시 → `source_realdata_env` 가 `return 0`(run 미실패) + env 불변 + 진단 로그는 경로만 출력함을 검증. gating 은 여전히 disabled(부재) 로 남아 기존 no-op 동작 보존.
- [ ] **Negative/branch (읽기 불가)**: 파일이 존재하지만 unreadable(chmod 000 또는 동등)일 때 → `source_realdata_env` 가 `return 0`(run 미실패) + env 불변 + 진단 로그는 경로만 출력함을 검증(값 노출 0).
- [ ] **§9 값-echo 0**: 파일에 더미 secret 문자열(예: `dummy-not-a-real-secret`)을 담아 source 한 뒤, `source_realdata_env` 의 로그(stderr) 어디에도 그 값 문자열이 나타나지 않음을 grep 으로 검증(경로/"sourced" 만 보고).
- [ ] **override 우선순위 결정론**: 이미 set 된 env 가 있는 상태에서 파일이 같은 키를 정의하면 source 후 파일 값이 반영됨(결정론적 override)을 검증 — silently-partial/surprising override 가 아님을 assert.
- [ ] executable bash spec `deploy/daily-test-step-env-source.test.sh` 신설 — T-0612 와 동형으로 self-contained(네트워크 0 / jest 실 spawn 0 / 실 credential echo 0), WORKDIR 격리(`mktemp -d`, trap EXIT cleanup), 마지막에 `RESULT: PASS` 출력 + 실패 시 exit 1.
- [ ] `.github/workflows/ci.yml` 에 `daily-test step_env_source(.env.realdata 자동 source) 배선 검증` CI step 추가(step_eval_chain 검증 step 다음, `run: bash deploy/daily-test-step-env-source.test.sh`).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(line ≥ 80% / function ≥ 80% — 본 task 는 bash/CI 만 변경, TS coverage 회귀 0 확인) + `bash deploy/daily-test-step-env-source.test.sh` exit 0.
- [ ] 분기: `source_realdata_env` 는 (파일 부재 / 읽기 불가 / 존재+readable) 3분기를 가지므로 각 분기 1+ test 로 cover(위 3항목).

## Out of Scope

- **ORDER 배열 / cascade-gate 구조 변경 금지** — 본 task 는 leg 를 추가하지 않으므로 `ORDER=(...)` 벡터도 cascade-gate 개수도 바꾸지 않는다. drift-guard smoke spec 3종(T-0791 order-driven / T-0944 status-aggregation / T-0947 step-chain-cascade)은 건드리지 않으며(변경 시 6파일 > 5-파일 cap), 만약 구현 중 ORDER/gate 변경이 불가피하다고 판단되면 즉시 중단하고 Follow-ups 에 기록 후 planner 에 재-scope 요청(재-BLOCKED 방지).
- test-DB(`assessment_test`) 선택/생성이나 `pnpm install --frozen-lockfile` + `prisma migrate deploy` 선행은 본 task 밖(C-2 slice). C-1 은 env 자동 source 만 담당한다.
- `docs/ops/daily-deploy-test.md` / `deploy/env.prod.example` 문서화는 본 task 밖(C-3 slice).
- 앱 컨테이너측 `GITHUB_INSTANCES` / `GITHUB_<KEY>_TOKEN_ENC` LIVE collection wiring 은 본 task 밖(C-4 후속).
- `.env.realdata` 자체를 git 에 추가/커밋 금지(§9 — untracked chmod 600 유지).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (planner) issue #1013 slice C-2 — daily-test.sh gating 활성 시 `pnpm install --frozen-lockfile` + test-DB `prisma migrate deploy` 선행(B-3 반복 수행 대체). C-1 머지 후 다음 planner fire 가 큐잉.
- (planner) issue #1013 slice C-3 — `docs/ops/daily-deploy-test.md` + `deploy/env.prod.example` REALDATA gating env 셋업 절차 문서화. C-2 이후 큐잉.
