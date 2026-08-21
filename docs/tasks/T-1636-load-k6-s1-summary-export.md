---
id: T-1636
title: load-k6.yml S1 step 에 k6 summary JSON export + job summary 실측 기록 step 배선
phase: P5
status: DONE
prNumber: 1313
completedAt: 2026-08-21T05:53:08Z
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1633, T-1634]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 17/N — 오너 PLAN 144 행 ②. baseline 실측(계획 §5 item 5) 의 수치 회수 경로 부재를 메우는 선행 slice."
---

# T-1636 — load-k6.yml S1 step 에 k6 summary JSON export + job summary 실측 기록 step 배선

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행`, ADR-0054 ACCEPTED) 의 R-91 chain 은 S1 스크립트 · workflow step · npm script 배선까지 끝났고([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 3·4), 잔여는 item 5 **baseline 확정 + 임계 fix** 하나다. 그런데 현재 S1 step 은 k6 결과를 stdout 으로만 흘려 **실측 수치가 run log 안에만 남고 기계 판독 가능한 형태로 회수되지 않으며**, 같은 문서 `§3` 이 요구하는 "각 run 은 환경 메타(하드웨어·동시성·데이터 규모)를 함께 기록해 비교 가능하게 한다" 도 충족되지 않는다. 본 slice 는 S1 실행에 `--summary-export` 를 붙이고 그 JSON + 환경 메타를 `$GITHUB_STEP_SUMMARY` 에 always() 로 적재해 **baseline 실측 run 이 실제로 수치를 남기도록** 만든다 (임계 위반으로 k6 가 exit 1 이 나도 수치는 남아야 baseline 을 잡을 수 있다).

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 특히 "k6 S1 평가 배치 부하 시나리오 실행" step 과 always() teardown step ("부하 대상 정리").
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 파일 머리의 helper (`extractStep` · `extractStepBlock` · `extractKey` · `stepIndexOf` · `dockerEnvValue`) 와 T-1633 / T-1634 describe 블록 (신규 describe 는 이 패턴을 그대로 따른다).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` (측정 지표·임계 + 환경 고정 요구) · `§5` item 5 (baseline 미착수).
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D4` (축소 표본 + 외삽 임계 산식 — 요약에 함께 기록할 동시성·데이터 규모 메타의 출처).

## Acceptance Criteria

- [x] `load-k6.yml` 의 "k6 S1 평가 배치 부하 시나리오 실행" step 이 `--summary-export=<repo 상대 경로>` 로 S1 결과 JSON 을 파일에 남긴다 (경로는 workflow 안에서 단일 리터럴로 고정 — 뒤 step 과 문자열이 일치해야 한다).
- [x] S1 step 바로 뒤에 실측 기록 step 1 개를 추가한다. 조건은 `if: always()` — k6 가 임계 위반으로 exit 1 이어도 수치가 남아야 baseline 을 잡을 수 있다.
- [x] 그 step 은 `$GITHUB_STEP_SUMMARY` 에 다음을 append 한다: (a) 환경 메타 — runner 커널·아키텍처, vCPU 수, 메모리, PostgreSQL image 태그, 부하 대상 image 태그, (b) 동시성·데이터 규모 메타 — `K6_S1_PERSONS` 주입값, (c) S1 summary JSON 전문 (fenced block). `jq` 등으로 JSON 을 파싱해 특정 metric 을 뽑는 로직은 두지 않는다 (k6 summary schema 변동에 깨지지 않게 원문 그대로 적재).
- [x] summary export 파일이 없을 때 (k6 가 그 이전 단계에서 죽은 경우) 기록 step 이 fail 하지 않고 "요약 파일 없음" 을 명시한다 — 즉 파일 존재 분기 1 개.
- [x] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 T-1636 describe 1 블록을 추가한다. 아래 R-112 4 종을 모두 cover:
  - [ ] **happy-path**: S1 step 의 run 명령에 `--summary-export` 가 있고 그 경로가 기록 step 의 참조 경로와 **정확히 같은 문자열**임을 단언 (parity). 기록 step 이 존재하고 `if: always()` 이며 S1 step **뒤**에 온다는 순서 단언 1+.
  - [ ] **error path**: 기록 step 이 `$GITHUB_STEP_SUMMARY` 로 append (`>>`) 하고 덮어쓰기 (`>`) 하지 않음을 단언 (앞 step 의 요약을 지우는 회귀 차단). export 경로가 workflow 안에서 2 곳(생성·소비)에만 등장함을 단언.
  - [ ] **분기 cover**: 요약 파일 존재/부재 두 분기가 모두 script 안에 있음을 단언 (존재 시 본문 적재, 부재 시 부재 메시지 — 각 1 단언).
  - [ ] **negative cases 충분 cover**: ① 기록 step 에 `jq` 파싱 로직이 없음, ② `K6_S1_PERSONS` 주입값이 `s1-batch.js` 의 `__ENV` 기본값과 여전히 동일 (T-1633 parity 회귀 차단), ③ 기록 step 이 S2/S3 step 보다 앞에 옴 (S1 실측이 뒤 시나리오 실패에 가려지지 않음), ④ export 파일 경로가 `test/load/` 밑이 아님 (스크립트 디렉토리 오염 차단), ⑤ 기록 step 이 실 secret / credential 리터럴을 출력하지 않음 (`AUTH_JWT_SECRET` · `LLM_APIKEY_ENC_KEY` 값이 요약에 실리지 않음).
- [x] `pnpm lint && pnpm build` 통과.
- [x] `pnpm test` 통과 — 특히 대상 drift-guard smoke spec 의 기존 describe (T-1620/21/22/23/25/31/32/33/34) 회귀 0.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 변동은 없어야 한다.

## Out of Scope

- **실제 부하 run 을 dispatch 하지 않는다** — `gh workflow run load-k6.yml` 실행 및 baseline 수치 확정 (`§5` item 5, `§3` "baseline 후 fix" 임계 확정) 은 별도 slice.
- S2 / S3 / smoke step 에 같은 export·기록 배선을 확장하지 않는다 (S1 우선, 나머지는 follow-up).
- k6 임계값 (`thresholds`) · 표본 인원 기본값 · step 순서 자체를 바꾸지 않는다.
- `test/load/*.js` 스크립트 본문 변경 (`handleSummary()` 도입 등) 금지 — 본 slice 는 workflow 측 배선만.
- artifact upload action (`actions/upload-artifact` 등) 신규 도입 금지 (새 외부 action = CLAUDE.md §5 게이트 대상). `$GITHUB_STEP_SUMMARY` 만 쓴다.
- `docs/ops/load-resilience-test-plan.md` · `PLAN.md` doc-sync 는 direct-mode 라 본 pr task 에 섞지 않는다 (§3.1 rule 3).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)

## 완료 기록

- **Status: DONE** — 2026-08-21T05:53Z (cron@aa-local-89e7f979 fire).
- `commitMode: pr` — PR [#1313](https://github.com/myungjoo/AA_S1/pull/1313) round 1 APPROVE → squash merge `b21d2bdc` (branch 삭제 완료).
- 결과: `load-k6.yml` S1 step 에 `--summary-export=k6-s1-summary.json` (생성·소비 2 곳 단일 리터럴) + 직후 `if: always()` 실측 기록 step 1 개 배선 — 환경 메타(커널·아키텍처·vCPU·메모리·PostgreSQL/부하대상 image 태그) · `K6_S1_PERSONS` 주입값 · summary JSON 전문을 `$GITHUB_STEP_SUMMARY` 에 append(`>>`, `jq` 파싱 0). 요약 파일 부재 분기는 fail 없이 부재를 명시 (+237/-3, 2 파일).
- 검증: drift-guard smoke 에 T-1636 describe 4 블록 추가 (happy 3 · error 3 · 분기 2 · negative 5) — smoke 132 케이스 전원 green, unit 12738 통과, lint · build · `test:cov` 통과. `src/` 변경 0 이라 coverage 수치 불변. PR CI run 32451776387 + 승인게이트 rerun 32451848662 둘 다 success.
- 잔여: [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 (baseline 확정 + 임계 fix) — 본 slice 가 수치 회수 경로를 열었으므로 다음은 실제 baseline run.
