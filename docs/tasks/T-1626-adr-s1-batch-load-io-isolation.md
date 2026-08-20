---
id: T-1626
title: S1 배치 부하의 외부 I/O 격리 전략 ADR-0057 박제 (S1 harness 선행 결정)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 215
estimatedFiles: 2
created: 2026-08-20
createdAt: 2026-08-20T14:35:00Z
completedAt: 2026-08-20T15:58:04Z
prNumber: 1303
independentStream: load-harness-k6
dependsOn: [T-1625]
touchesFiles:
  - docs/decisions/ADR-0057-s1-batch-load-io-isolation.md
  - docs/ops/load-resilience-test-plan.md
plannerNote: P5 R-91 chain 7/N — S1(REQ-047 배치 1h) harness 를 막고 있는 외부 I/O 격리 전략을 ADR 로 확정. 스크립트·src 구현은 후속 slice.
---

# T-1626 — S1 배치 부하의 외부 I/O 격리 전략 ADR-0057 박제

## Why

[docs/PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선·즉시 착수)의 chain 7/N 이다. T-1620~T-1625 로 k6 job 골격 · 부하 대상 기동 · S2 조회(seed · 인증) · S3 동시성까지 닫혔고, 계획 `§2` 의 3 시나리오 중 남은 것은 **S1(평가 배치 부하 = REQ-047 본체)** 하나다. 그런데 S1 은 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) `108 행`·`131 행`·`157 행` 과 계획 `§4.2` 가 반복해서 명시하듯 **LLM · GitHub/Confluence 수집 I/O 격리(stub / record-replay / 격리 endpoint) 결정이 선행돼야** 스크립트를 쓸 수 있다 — credential 0 인 CI 수동 job 에서 실 LLM 을 때릴 수 없고, 격리 없이 재면 측정치가 외부 대기시간이라 REQ-047 의 "서버가 1h 안에 배치를 끝내는가" 를 판정하지 못한다.

본 slice 는 그 선행 결정만 ADR 1 개로 박제해 후속 S1 harness slice 의 ambiguity 를 0 으로 만든다. 구현(`src/` stub 배선 · `test/load/s1-batch.js` · workflow step)은 전부 후속 slice 로 남긴다 — 결정과 구현을 한 PR 에 섞으면 cap 을 깨고 reviewer 판단 대상도 흐려진다(ADR-0054 = T-0827 의 결정-전용 PR 선례 승계).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2` S1 정의와 "주의"(외부 I/O 지배 → 격리 필요), `§3` 표의 S1 두 행(≤ 1h · error rate < 1%), `§4.2` 격리 문단, `§5` follow-up 인덱스 `131 행`(item 3).
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md) — `§Decision`(k6 + supertest 2-계층), `§Consequences` 의 격리 병행 항목, `§후속 task 전망`, `§범위 밖`. 본 ADR 은 그 "범위 밖" 으로 미뤄둔 격리 축을 이어받는다.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — 최근 ADR 의 섹션 구성·분량·한국어 서술 톤 선례(Status / Context / Decision / Consequences / Alternatives / References).
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — LLM 호출 경계(격리 지점 후보 1). 인터페이스 형태만 확인하고 **수정하지 않는다**.
- [src/assessment-collection/assessment-collection.controller.ts](../../src/assessment-collection/assessment-collection.controller.ts) — `POST /api/assessment-collection/collect` 등 배치 진입점 후보(격리 지점 후보 2). 노출 route 와 guard 유무만 확인하고 **수정하지 않는다**.
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — 후속 S1 스크립트가 승계할 harness 규약(`__ENV` 기본값 · route tag · setup/teardown · 조건 분기 0). ADR 이 전제로 삼을 제약.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0057-s1-batch-load-io-isolation.md` 신설 — 제목·번호는 그대로(다음 미사용 번호가 0057 임을 `ls docs/decisions/` 로 확인).
- [ ] `## Status` — 결정이 **신규 dependency 0 · DB schema 변경 0 · 인증/권한 모델 변경 0** 을 만족하면 `ACCEPTED`, 셋 중 하나라도 걸리면 `PROPOSED` 로 두고 그 사유를 Status 아래 한 줄로 명시한다(CLAUDE.md `§5` BLOCKED 경계 존중).
- [ ] `## Context` — 계획 `§2` S1 · `§3` 표 S1 두 행 · `§4.2` 격리 문단과 ADR-0054 의 미결 항목을 인용해 "왜 지금 격리 결정이 필요한가" 를 서술한다. 현 코드 사실 2 개를 박제: (1) UC-06 batch 연산 endpoint 는 아직 미노출(`src/user/assessment.controller.ts` 주석), (2) 부하 job 은 credential 0 환경이라 실 LLM·실 GitHub/Confluence 호출이 불가.
- [ ] `## Decision` — 아래 4 축을 **각각 하나의 값으로 확정**한다(양자택일을 미루지 않는다):
  - [ ] (D1) **격리 방식 택 1** — ① env 기반 stub gateway 주입, ② record-replay fixture 재생, ③ 외부 I/O 를 제외한 격리 endpoint(저장·조립 경로만) 중 하나. 나머지 둘은 `## Alternatives considered` 로 내린다.
  - [ ] (D2) **S1 부하 대상 진입점** — k6 가 때릴 route(또는 "현재 미노출이므로 후속 slice 에서 노출 필요" 라는 결론) 를 경로 문자열 수준으로 확정.
  - [ ] (D3) **측정 분해 규칙** — 순수 서버 처리량과 외부 I/O 대기를 어떻게 분리 보고할지(예: route tag 분리 · 단계별 지표 이름) 를 한 문단으로 확정.
  - [ ] (D4) **1h 게이트 판정 방식** — 133명 full run 을 그대로 잴지, 축소 표본 + 외삽으로 잴지, 그리고 그 판정을 수동 job 안에서 어떻게 pass/fail 로 만들지 확정. 계획 `§3` 의 임계 값(≤ 1h · error rate < 1%)은 **재산정 0**.
- [ ] `## Consequences` — 긍정 / 부정·trade-off 를 나눠 쓰고, 부정 쪽에 "stub 은 실 LLM latency 를 재지 않으므로 REQ-047 의 어떤 부분이 여전히 미검증인가" 를 명시한다.
- [ ] `## Alternatives considered` — D1 에서 탈락한 2 안을 각각 채택 안 한 이유와 함께 표 또는 목록으로 박제.
- [ ] `## 범위 밖 (deferred)` — 본 ADR 이 하지 않는 것을 열거: `src/` stub 배선 구현, `test/load/s1-batch.js` 신설, `load-k6.yml` step 추가, 133명 실 seed 투입, baseline 실측·임계 fix. 각 항목이 후속 slice 임을 명시.
- [ ] `## References` — ADR-0054 · 계획 문서 · REQ-047 · PLAN `144 행` 오너 지시를 링크.
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 3(`131 행`) 에 본 ADR pointer 를 **1 줄 이내**로 덧붙인다(ADR-0054 가 item 1 에 붙인 형태 그대로). 그 밖의 본문·임계 표 수정은 0.
- [ ] 신규 dependency 0 · `package.json` 무변경 · `src/` 변경 0 · 워크플로 변경 0 — `git diff --stat` 이 위 `touchesFiles` 2 개만 보여야 한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 (R-110 — 코드 변경이 0 이어도 tester 가 실행 결과를 확인한다).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` 통과 — 기존 it 전량 green(본 slice 는 smoke 대상 파일을 건드리지 않으므로 신규 it 0).
- [ ] R-112 4 항목: 본 task 는 **production code 변경 0 · 신규 public symbol 0 · 분기 0** 이라 happy-path / error path / 분기 / negative unit test 항목은 **해당 없음**(문서 전용). 대신 위 lint/build/test/cov/smoke 4 종 green 이 R-110·R-111 검증을 대신한다 — PR 본문에 이 사실을 한 줄로 명시한다.
- [ ] diff ≤ 300 LOC · 변경 파일 ≤ 2 개. 초과 예상 시 `## Context` 의 배경 서술을 먼저 줄이고 Decision 4 축은 유지한다.

## Out of Scope

- `src/` 변경 일체 — stub gateway / 격리 endpoint 의 **구현**은 후속 pr slice. 본 task 는 결정만.
- `test/load/*` 신설·수정 — S1 스크립트는 본 ADR 이 머지된 뒤의 slice.
- `.github/workflows/*` 변경 — S1 실행 step 추가는 후속 slice(`ci.yml` 은 절대 열지 않는다, T-1122 파일 cap 전례).
- `package.json` · lockfile 변경 — dependency 추가는 CLAUDE.md `§5` BLOCKED.
- 계획 `§3` 임계 재산정 · 신규 지표 임계 도입 — 표 밖 숫자 금지.
- 실 133명 dataset seed · 실 LLM/수집 호출 · 실 k6 run trigger — 본 task 는 문서 전용이며 외부 발화 0.
- ADR-0054 본문 수정 — 그 결정은 유효하며 본 ADR 이 이어받을 뿐이다(status flip 도 없음).
- R-92 per-route perf-spec 신규 slice — 오너 지시로 큐잉 금지 상태 유지.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

- **S1 stub 배선 구현** — ADR-0057 D1(stub 주입) 을 `src/` 에 실제로 배선한다. 기본 OFF 이며 env 로만 켜지고, OFF 일 때 프로덕션 경로가 그대로임을 확인하는 negative test 를 포함한다.
- **`test/load/s1-batch.js` 신설** — ADR-0057 D2(fill-run 진입점) · D3(tag 분해) · D4(축소표본 외삽) 를 따르는 S1 배치 부하 스크립트.
- **`load-k6.yml` step 재배치** — smoke → S1 → S2 → S3 순서로 정리하고 S1 step 에 stub env 를 주입한다.
