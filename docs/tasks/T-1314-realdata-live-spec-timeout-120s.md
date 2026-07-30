---
id: T-1314
title: realdata live smoke spec 3종의 jest.setTimeout 을 120s 로 상향 (Ollama 콜드 로드 64.5s 대응)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-061]
estimatedDiff: 16
estimatedFiles: 4
created: 2026-07-30
independentStream: realdata-live-timeout
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-live.smoke-spec.ts
  - test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts
  - test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts
  - docs/ops/daily-deploy-test.md
plannerNote: "PLAN.md 운영 backlog 오너 결정 항목(2026-07-30 ff57cce9) 을 pr task 1개로 변환 — 3 spec 리터럴 + 런북 §G-4 정합, 약 16 LOC / 4 파일"
---

# T-1314 — realdata live smoke spec 3종의 jest.setTimeout 을 120s 로 상향

## Why

배포 기기 gating 활성화 이후 daily-test 가 realdata live leg 을 실제로 돌리기 시작했고, 오너가 [PLAN.md](../PLAN.md) 운영 정책 backlog 에 **"realdata live spec timeout 120s 상향 (오너 결정 2026-07-30, 즉시 task 변환 대상)"** 항목을 큐잉했다 (commit `ff57cce9`). 본 task 는 그 항목을 그대로 이행하는 유일한 조각이다.

문제의 실체: 로컬 Ollama 의 **콜드 로드가 실측 64.5s** (예열 후 warm 은 8.8s) 인데 현재 live spec 상한은 `realdata-e2e-live` 30s / `realdata-e2e-github-collection-live` 30s / `realdata-e2e-eval-chain-live` 45s 다. 예열이 빠지는 경우 (예: docker 재빌드로 redeploy 가 Ollama `keep_alive` 5분을 넘김) 첫 LLM 호출이 로직 결함 없이 **타임아웃만으로 fail** 한다 — daily-test 결과가 실제 회귀와 구분되지 않는 노이즈가 된다. 세 spec 을 이미 `realdata-e2e-daily-step-dual-leg-run-report-publish-live` / `...-rediscovery-search-live` 가 쓰는 컨벤션 값 **120000** 으로 맞춘다 (콜드 64.5s 대비 2배 여유). 5분 이상은 hang 감지가 과도하게 둔해져 (live it 6개 × 5분 = 최악 30분) 오너가 기각했다.

`commitMode: pr` 근거 — 변경 대상이 `test/` 파일이므로 CLAUDE.md §3.1 판정 규칙 2 에 따라 pr. [docs/ops/daily-deploy-test.md](../ops/daily-deploy-test.md) §G-4 는 `jest.setTimeout(45000)` 리터럴을 그대로 인용하고 있어 상향 후 즉시 stale 이 되는 **코드-결합 런북 문장** 이라 같은 PR 안에서 정합을 맞춘다 (진행상황 bookkeeping 문서가 아니므로 §3.1 규칙 3 의 split 대상이 아니다). ADR 은 불요 — 기존 결정 (live gating · timeout 컨벤션) 안의 값 조정이다.

## Required Reading

- [docs/tasks/T-1314-realdata-live-spec-timeout-120s.md](T-1314-realdata-live-spec-timeout-120s.md) — 본 파일
- `test/smoke/realdata-e2e-live.smoke-spec.ts` — 72행 `jest.setTimeout(30000)` 과 그 위 2줄 주석
- `test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts` — 52행 `jest.setTimeout(30000)` 과 그 위 2줄 주석
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` — 64행 `jest.setTimeout(45000)` 과 그 위 2줄 주석
- `test/smoke/realdata-e2e-daily-step-dual-leg-run-report-publish-live.smoke-spec.ts` — 187행 근처, 따라갈 120000 컨벤션 + 그 주석 문투
- `docs/ops/daily-deploy-test.md` — §G-4 "gating 활성 후에는 LLM 예열이 필수" (292행 부근) 의 리터럴 인용 문장

## Acceptance Criteria

- [x] 위 3개 live smoke spec 의 `jest.setTimeout` 값이 모두 정확히 `120000` 이다. `grep -n "jest.setTimeout" test/smoke/realdata-e2e-live.smoke-spec.ts test/smoke/realdata-e2e-github-collection-live.smoke-spec.ts test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 결과 3줄 모두 `120000`.
- [x] 각 `jest.setTimeout` 위의 한국어 주석이 상향 근거를 담는다 — **콜드 로드 실측 64.5s (warm 8.8s) 대비 2배 여유 + publish/rediscovery live spec 과 동일 컨벤션** 이 읽히면 충분 (§12 한국어). 주석은 각 spec 2줄 이내 유지.
- [x] `docs/ops/daily-deploy-test.md` §G-4 의 `jest.setTimeout(45000)` 인용이 `jest.setTimeout(120000)` 으로 갱신되고, **예열이 여전히 필수라는 결론이 유지** 된다 (120s 여유는 보험이지 예열 생략 허가가 아니다 — 이 취지가 문장에 남아야 한다).
- [x] gating 판정 구조 (`describeLive = gating.enabled ? describe : describe.skip`) 는 세 spec 모두 **한 글자도 변경되지 않는다** — public CI 에서 여전히 전 it skip 이라 CI 시간 증가 0. `git diff` 에 `describeLive` / `resolveRealDataE2eLiveGating` 관련 변경 라인이 0 이어야 한다.
- [x] **신규/수정 public symbol 0 · 분기 추가 0** 이므로 R-112 의 happy-path / error-path / branch / negative 4항목은 **신규 test 작성 대상이 없다** — 본 task 는 기존 spec 의 timeout 리터럴만 조정한다. 이 근거를 PR 본문에 명시하고, 대신 아래 3줄 검증으로 R-110 을 충족한다.
- [x] `pnpm lint` 통과 (변경 3 spec 의 prettier 포맷 유지).
- [x] `pnpm build` 통과.
- [x] `pnpm test` 통과 + `pnpm test:smoke` 통과 — gating env 부재 상태에서 세 live describe 가 **skip 으로 집계** 됨을 smoke 출력으로 확인 (fail·error 0).
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production code 변경 0 이라 커버리지 수치 변동이 없어야 한다.

## Out of Scope

- `start-llm.ps1` 의 `-NoWarm` 제거 / 예열 루틴 변경 — 오너 note 가 "루틴 쪽 별건" 으로 분리했다. 손대지 않는다.
- `realdata-e2e-daily-step-dual-leg-run-report-publish-live` / `...-rediscovery-search-live` 의 기존 120000 값 — 이미 목표값이라 diff 0.
- 다른 live smoke (`llm-live` · `github-live` · `confluence-live` · `period-bridge-live`) 의 timeout — 본 결정 범위 밖.
- `deploy/daily-test.sh` 의 leg 구성 / jest argv 변경 — leg 을 건드리면 drift-guard spec 3종 (T-0791 / T-0944 / T-0947) 동반 수정으로 5 파일 cap 이 깨진다. 본 task 는 spec 내부 리터럴만 만진다.
- timeout 리터럴을 감시하는 신규 drift-guard spec 신설 — 현재 그런 guard 는 없음을 확인했고 (spec source 를 읽는 guard 0 hit), 신설은 별건.
- `jest.config` / `test:smoke` script 의 전역 timeout 조정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 관측) `PLAN.md` 운영 backlog 의 realdata live timeout 항목 checkbox 가 아직 미체크 — shipped(`6b0b2aee`) 반영은 다음 doc 정합 slice 에서.
- (본 slice 관측) 로컬 `pnpm test:smoke` 는 postgres/docker 부재로 실행 불가해 CI 집계로만 검증했다. 로컬 smoke 실행 가능 조건 문서화는 별도 slice 후보.

## 완료 기록

- 완료: 2026-07-30T07:51Z. PR [#1196](https://github.com/myungjoo/Assessment-Agent/pull/1196) squash merge `6b0b2aee`, reviewer VERDICT=APPROVE (round 1), CI green (PR run 30524026366 · main run 30524361840).
- 결과: live spec 3종 (`realdata-e2e-live` 30s · `realdata-e2e-github-collection-live` 30s · `realdata-e2e-eval-chain-live` 45s) 의 `jest.setTimeout` 을 모두 **120000** 으로 상향 + 상향 근거 한국어 주석 2줄씩 교체. `docs/ops/daily-deploy-test.md` §G-4 의 `45000` 인용 리터럴 정합 + "120s 여유는 보험이지 예열 생략 허가가 아니다" 취지 명문화로 예열 필수 결론 유지. 4 파일 +13/-11.
- gating 구조 (`describeLive` / `resolveRealDataE2eLiveGating`) 변경 라인 0 — 신규 public symbol·분기 0 이라 R-112 신규 test 대상 없음 (근거 PR 본문 명시).
