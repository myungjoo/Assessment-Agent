---
id: T-1687
title: 단계별 percentile export 설계를 부하계획 문서에 사전 박제
phase: P5
status: DONE
completedAt: 2026-08-25T04:52:00Z
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-resilience-plan
dependsOn: [T-1686]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 120
estimatedFiles: 2
created: 2026-08-25T04:37:35Z
plannerNote: P5 성능 검증(PLAN 141 행) — T-1686 승계 Follow-up ②, 코드 배선 전 설계 사전 박제(T-1668 선례), doc-only direct
---

# T-1687 — 단계별 percentile export 설계를 부하계획 문서에 사전 박제

## Why

T-1686 이 승계한 Follow-up **②**(단계별 percentile export step) 는 [docs/PLAN.md](../PLAN.md) `141 행` 성능 검증 bullet 의 잔여 공백이다. 현재 k6 기본 요약이 `p(90)` · `p(95)` 까지만 출력해 **모든 회차에서 `p99` 가 "미확보"** 로 이월돼 있고([`load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `805` · `884` · `1032` · `1119` · `1246` · `1316 행`), S3 축은 구간별 export 가 없어 `§3` 임계 표의 **"latency cliff 부재"** 판정 근거를 기계적으로 만들 수 없다(`1261` · `1328 행`). 본 slice 는 코드를 건드리기 **전에** 회수 수단 · 불변식 · 출력 규약 · 집행 경로를 문서에 굳혀, 다음 `pr` slice 가 설계 재추론 없이 배선만 하도록 한다 — T-1668 이 임계 재확정 규칙을 사전 박제하고 T-1676(코드) · T-1677(문서) 이 집행한 선례와 동형이다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§3` 지표·임계 표(`187~280 행`), 그중 `S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)` 소절(서식·조항 열거 방식의 원본), `### 3.1` 헤더(`281 행`), `§5` item 5 꼬리
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `1149` · `1261` · `1316` · `1328 행` — "단계별 percentile export 부재" 로 이월된 서술 4 군데 (본 소절이 답해야 할 공백의 좌표)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — `options.stages` · `thresholds` · route tag(`read`/`write`) 와 준비/정리 전용 tag(`seed`/`teardown`) 분리 구조 (읽기만 — 본 task 는 변경 0)
- [test/load/s1-batch.js](../../test/load/s1-batch.js) — `thresholds` 배열과 `route:batch` tag 구조 (읽기만)
- [docs/PLAN.md](../PLAN.md) `140~141 행` — 성능 검증 bullet 과 꼬리 append 지점
- [docs/tasks/T-1686-k6-seed-persons-cap-raise-judgment.md](T-1686-k6-seed-persons-cap-raise-judgment.md) — 승계 Follow-up ② 문구와 "판단 기준 먼저 → 결론 → 트리거" 서식 선례

## Acceptance Criteria

- [ ] [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§3` 에 `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절을 신설한다. 위치는 T-1668 재확정 규칙 소절 **뒤**, `### 3.1` 헤더 **앞**.
- [ ] 소절 앞머리에 **문제 정의 2 항** 을 둔다 — (a) `p99` 미확보(기박제 좌표 `805` · `884` · `1032` · `1119` · `1246` · `1316 행` 인용), (b) S3 저하 곡선의 단계 분해 불가로 `§3` 표 "latency cliff 부재" 행의 판정 근거를 기계화할 수 없음(`1261` · `1328 행` 인용). **새 측정 수치 · 추정치는 쓰지 않는다** — 기박제 서술의 인용만.
- [ ] 설계 조항을 **① ~ ⑤ 번호로 열거**한다:
  - ① **회수 수단은 k6 내장 기능 한정** — 새 외부 dependency 0([CLAUDE.md](../../CLAUDE.md) `§5` 새-dep 게이트 회피). 후보 2 종(`options.summaryTrendStats` 에 `p(99)` 추가 / `handleSummary()` 로 요약 통계를 stdout 1 줄로 출력)을 열거하고, 각 후보가 위 문제 (a) · (b) 중 **무엇을 cover 하고 무엇을 못 하는지** 를 1 줄씩 대응시킨다.
  - ② **판정 임계 불변** — `thresholds` 배열 · 임계 숫자 · route tag · `stages` 정의는 배선 시에도 **문자 단위 0 변경**이며 export 는 **관찰 전용** 이다(S1 관찰용 게이트의 성격 구분 서술과 동형).
  - ③ **단계 분해 원칙** — S3 `stages` 구간을 어떻게 가를지 원칙 1 개를 굳힌다(부하 단계별 전용 tag 부여 방식 · 준비/정리 tag 분리 선례 T-1682 승계). 판정 tag `read`/`write` 의 p95 를 오염시키지 않아야 한다는 제약을 명시.
  - ④ **출력 규약** — run log 에 **고정 prefix 1 줄 · 수치만**(T-1666 로그 규약 승계). artifact 업로드 · 외부 저장은 본 설계 범위 밖임을 명시.
  - ⑤ **집행 경로 split** — [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정에 따라 **(i) 코드 `pr`**([`test/load/*.js`](../../test/load) + drift-guard smoke 단언을 **같은 commit** 에서 동기), **(ii) 문서 `direct`**(회차 기록의 "미확보" 표기 · `§3` 각주 갱신) 로 나누며 **한 task 로 합치지 않는다**.
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 1 개를 append 하고, [`docs/PLAN.md`](../PLAN.md) `141 행` 꼬리에 1 문장을 append 한다. `140 행` checkbox 는 실 수집 축 미검증이므로 `[ ]` **유지**.
- [ ] `git diff -U0` 로 확인 — `§3` 임계 표 · `§3.1` 각 회차 측정 수치 · `§2` · `§4` 는 **문자 단위 0 변경**(순수 삽입 hunk 만).
- [ ] `git status --short` 로 확인 — 변경 파일은 위 2 개뿐이고 `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0 파일**. 새 `workflow_dispatch` · rerun **0 회**.
- [ ] 확인용 `pnpm lint` 무경고(production code 0 LOC 이라 R-110 tester 의무 면제 — doc-only direct commit).

## Out of Scope

- **실제 코드 배선 금지** — `test/load/*.js` 의 `summaryTrendStats` · `handleSummary` 추가, drift-guard smoke 단언 추가는 전부 후속 `pr` slice 소관.
- **새 `workflow_dispatch` · rerun 금지** — 본 slice 는 새 실측 0 회. 회차 기록(`§3.1`) 신설도 하지 않는다.
- **임계 숫자 변경 금지** — `§3` 표의 S1/S2/S3 임계, `STUB_BASELINE_P95_MS`, `baseline 후 fix` 표기는 그대로.
- **기존 "미확보" 표기의 소급 치환 금지** — 배선 완료 후 후속 문서 slice 가 갱신한다([CLAUDE.md](../../CLAUDE.md) `§12` 소급 치환 금지).
- `K6_SEED_PERSONS` 상한 재판단 금지 — T-1686 결론(**30 유지**)과 트리거 `T1`~`T4` 를 그대로 둔다.
- artifact 업로드 · 외부 시계열 저장소 · 새 dependency 도입 검토 금지.

## Suggested Sub-agents

`implementer` (문서 편집만) → 확인용 `pnpm lint`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## Result

- **DONE** (2026-08-25T04:52Z, direct commit `d912da8a`) — `docs/ops/load-resilience-test-plan.md` `§3` 에 `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절을 신설(문제 정의 2 항 → 조항 ①~⑤), `§5` item 5 · `docs/PLAN.md` `141 행` 꼬리 append. 2 파일 `+79/-1` 순수 삽입, `§3` 임계 표 · `§3.1` 회차 수치 · `§2` · `§4` 문자 단위 0 변경, 새 `workflow_dispatch` · rerun · 측정 수치 0, 확인용 `pnpm lint` 무경고.

## Follow-ups (승계)

1. 조항 ①~⑤ 설계의 **코드 배선** slice (`pr`) — k6 내장 수단으로 단계별 percentile 을 실제 출력하고 drift-guard parity 확보.
2. 배선 완료 후 기존 "미확보" 표기 6 군데를 실측 `p99` 로 갱신하는 문서 slice (`direct`).
