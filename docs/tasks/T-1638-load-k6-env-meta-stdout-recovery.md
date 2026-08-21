---
id: T-1638
title: load-k6.yml S1 실측 기록 step 의 환경 메타·요약을 job 로그(stdout)에도 남겨 API 회수 가능하게
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-21
dependsOn: [T-1636, T-1637]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 19/N — 오너 PLAN 144 행 ②. T-1637 이 실증한 메타 회수 실패(§5 item 5 잔여 ③)를 닫는 선행 slice."
---

# T-1638 — S1 실측 기록 step 의 환경 메타·요약을 job 로그에도 남긴다

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행`, ADR-0054 ACCEPTED) 의 R-91 chain 은 T-1637 이 S1 baseline 을 1 회 실측(run `32459501970`)하면서 **구체적 결함 1 건을 실증**했다 — "S1 실측 요약 기록" step 이 커널·아키텍처·vCPU·메모리를 `$GITHUB_STEP_SUMMARY` 에만 append 해서, driver 가 REST API·job 로그로는 그 수치를 회수하지 못했고 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 "회수되지 않았다" 는 사실만 남았다. 같은 문서 `§3` 은 "각 run 은 환경 메타를 함께 기록해 **비교 가능하게** 한다" 를 요구하는데, 사람이 run 페이지를 열어야만 읽히는 적재는 잔여 ①(실 scale 실측)·②(반복 run 기반 임계 fix)의 자동 비교를 막는다. 본 slice 는 같은 블록을 **stdout 에도 흘려**(append 의미 보존) 이후 모든 run 의 메타가 로그 API 로 회수되게 만든다 — `§5` item 5 잔여 ③ 을 닫는 선행 slice 다.

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — 특히 `112 행` 부근 "S1 실측 요약 기록" step 전문(메타 블록 · 요약 파일 존재/부재 분기).
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 파일 머리 helper (`loadYml` · `extractStep` · `extractStepBlock` · `extractKey` · `stepIndexOf` · `unquote`) 와 `1934 행` 부터의 T-1636 describe 블록(`S1_SUMMARY_STEP_NAME` · `STEP_SUMMARY_ENV` · `summaryStepText` 재사용 대상).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 각주 + `§3.1`(회수 실패 사실이 박제된 지점) · `§5` item 5 잔여 ③.
- [docs/tasks/T-1637-load-k6-dispatch-s1-baseline.md](T-1637-load-k6-dispatch-s1-baseline.md) `## Follow-ups` 첫 항목 — 본 slice 가 그대로 승계하는 지시.

## Acceptance Criteria

- [x] `load-k6.yml` 의 "S1 실측 요약 기록" step 이 환경 메타 블록을 **stdout 과 `$GITHUB_STEP_SUMMARY` 양쪽**에 남긴다 (예: 블록 출력을 `| tee -a "$GITHUB_STEP_SUMMARY"` 로 통과시켜 job 로그에도 찍히게). **append 의미(`-a` / `>>`)는 반드시 보존** — 앞 step 이 적은 요약을 덮어쓰면 회귀다.
- [x] 요약 파일 **존재 분기의 JSON 전문**과 **부재 분기의 안내 문구** 둘 다 같은 방식으로 stdout 에도 남는다 (분기 어느 쪽이든 로그만 보고 run 을 재구성할 수 있어야 한다).
- [x] 메타 항목 집합은 **불변** — runner 커널(`uname -sr`) · 아키텍처(`uname -m`) · vCPU(`nproc`) · 메모리 · PostgreSQL image · 부하 대상 image · `K6_S1_PERSONS`. 항목을 늘리거나 줄이지 않는다(본 slice 는 **회수 경로**만 바꾼다).
- [x] 같은 문자열을 두 번 적는 방식(메타 블록을 echo 로 복제해 한 번은 로그, 한 번은 summary)은 **금지** — 단일 출력이 두 목적지로 갈라지게 한다(복제는 즉시 drift 원인).
- [x] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 T-1638 describe 1 블록을 추가하고, 아래 R-112 4 종을 모두 cover 한다 (helper 신설은 최소 1 개 이내, 나머지는 기존 helper 재사용):
  - [x] **happy-path**: ① 기록 step script 가 `tee` 를 경유해 `$GITHUB_STEP_SUMMARY` 로 간다는 단언, ② 메타 7 항목(커널·아키텍처·vCPU·메모리·PostgreSQL image·부하 대상 image·`K6_S1_PERSONS`)이 여전히 모두 script 안에 있다는 단언, ③ 기록 step 이 여전히 `if: always()` 이고 S1 step 뒤에 온다는 순서 단언.
  - [x] **error path**: ① `tee` 가 `-a` 없이 쓰여 summary 를 덮어쓰는 형태가 **없음**, ② script 안에 `$GITHUB_STEP_SUMMARY` 를 `>` (단일 리다이렉트)로 여는 표현이 **없음**, ③ 기록 step 이 여전히 요약 파일 부재에도 fail 하지 않는 형태(부재 분기 존재)임을 단언.
  - [x] **분기 cover**: 요약 파일 **존재** 분기와 **부재** 분기 각각에 대해 "stdout 으로도 나간다" 는 단언 1 개씩(분기당 1+ test).
  - [x] **negative cases 충분 cover**: ① 메타 블록 문자열이 script 안에 **2 회 이상 복제**돼 있지 않음(중복 echo 금지 — 예: `uname -sr` 등장 횟수 1), ② `jq` 파싱 로직 신규 유입 0(T-1636 계약 유지), ③ `K6_S1_PERSONS` 주입값이 `test/load/s1-batch.js` 의 `__ENV` 기본값과 여전히 parity, ④ 기록 step 이 secret 리터럴(`AUTH_JWT_SECRET` · `LLM_APIKEY_ENC_KEY` 값)을 출력하지 않음 — 로그 공개 범위가 넓어진 만큼 이 단언이 본 slice 의 핵심 negative 다, ⑤ 다른 step(S2 · S3 · 정리)의 run 본문은 무변경(본 slice 가 건드리지 않았음을 정적으로 고정).
- [x] `pnpm lint && pnpm build` 통과.
- [x] `pnpm test` 통과 — 대상 drift-guard smoke spec 의 기존 describe(T-1620/21/22/23/25/31/32/33/34/36) 회귀 0.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 변동은 없어야 한다.

## Out of Scope

- **실제 부하 run 을 dispatch 하지 않는다** — 본 배선이 실제로 로그에 찍히는지 확인하는 dispatch + `§3.1` 갱신은 별도 direct slice.
- 표본 인원 상향(`K6_S1_PERSONS` → 133) · `workflow_dispatch` input 신설 · 임계 숫자 변경 금지 — `§5` item 5 잔여 ①·② 는 각각 별도 slice.
- S2 / S3 / smoke step 에 같은 기록·회수 배선을 확장하지 않는다 (S1 우선).
- `test/load/*.js` 스크립트 본문 변경(`handleSummary()` 도입 등) 금지 — 본 slice 는 workflow 측 배선만.
- `actions/upload-artifact` 등 새 외부 action 도입 금지 (CLAUDE.md §5 새-dep 게이트). `tee` 는 runner 기본 coreutils 라 의존성 추가 0.
- `actions/checkout@v4` Node 20 deprecation 경고 해소(T-1637 Follow-ups 3 번째 항목) 는 본 slice 에 섞지 않는다.
- `docs/ops/load-resilience-test-plan.md` · `PLAN.md` doc-sync 는 direct-mode 라 본 pr task 에 섞지 않는다 (CLAUDE.md §3.1 rule 3).

## Suggested Sub-agents

`implementer → tester`

## Result (2026-08-21)

PR **#1314** round 1 APPROVE → squash 머지 **55b81dea** (CI green — 기본 검사 + 배포 산출물 검증 2 종 pass).
`load-k6.yml` 의 "S1 실측 요약 기록" step 이 갖던 `>> "$GITHUB_STEP_SUMMARY"` append 3 곳(환경 메타 블록 ·
요약 파일 존재 분기의 JSON 전문 · 부재 분기 안내 문구)을 전부 `| tee -a "$GITHUB_STEP_SUMMARY"` 로 전환해
**단일 출력이 stdout 과 job summary 두 목적지로 갈라지게** 했다 — 문자열 복제 0, append 의미(`-a`) 보존,
메타 7 항목 집합 불변, 새 의존성 0(`tee` 는 runner 기본 coreutils).
`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 T-1638 describe 1 블록(it 11 개)을 추가해
happy 3 · error 4 · 분기 2 · negative 5 를 고정했다 — 특히 **기록 step 이 secret 리터럴을 출력하지 않음** 단언이
로그 공개 범위 확대에 대응하는 핵심 negative 다. T-1636 의 append 단언은 `>>` · `tee -a` 두 형태를 모두
허용하도록 취지 유지한 채 넓혔다. 대상 spec 146 test 전건 green(T-1620~36 회귀 0), `src/` 변경 0 이라
coverage 수치 변동 없음(line 99.95% / function 100%). 총 2 파일 +192/-4.

## Follow-ups

- **실제 dispatch 로 stdout 회수 확인** — 본 slice 는 배선만 바꿨다. `load-k6.yml` 을 1 회 dispatch 해
  커널 · 아키텍처 · vCPU · 메모리가 실제로 job 로그 API 로 회수되는지 확인하고
  [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 의 "회수되지 않았다" 문장을
  갱신하는 direct slice 가 필요하다 (`§5` item 5 잔여 ③ 의 실증 마무리).
- **tee 파이프라인 exit status** — reviewer round 1 의 minor(정보성): `set -o pipefail` 부재 하에서 파이프라인의
  exit status 는 `tee` 것이 된다. 기록 step 은 `if: always()` 이고 실패해선 안 되는 성격이라 현 동작이 의도된
  것이나, 워크플로 전반의 shell 옵션 정책을 손볼 때 함께 검토할 항목.
