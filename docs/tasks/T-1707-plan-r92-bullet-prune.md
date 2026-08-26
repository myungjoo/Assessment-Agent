---
id: T-1707
title: PLAN R-92 mega-narrative bullet prune — 46k 자 1 줄을 ≤ 10 줄 요약본 + 정본 pointer 로 압축 (오너 지시 PLAN 146 행)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 15
estimatedFiles: 2
independentStream: plan-doc-hygiene
dependsOn: []
touchesFiles:
  - docs/PLAN.md
  - docs/decisions/ADR-0057-s1-batch-load-io-isolation.md
created: 2026-08-26
plannerNote: P5 — 오너 지시 PLAN 146 행(미체크) 집행. R-92 bullet(142 행, 46156 자)을 ≤10 줄 요약 + test/perf/README.md 정본 pointer 로 압축
---

# T-1707 — PLAN R-92 mega-narrative bullet prune

## Why

[T-1706](T-1706-real-collection-roundtrip-resolution-path.md) 로 부하계획 `§5` 잔여 축이 닫혀
"다음 회차는 `§5` 잔여 축 밖에서 고른다" 는 이월 상태다. 그 밖의 축 중 **오너가 직접 지시했고
아직 미착수인 항목** 이 [PLAN.md](../PLAN.md) `146 행` — **🟡 [오너 결정 2026-07-30] PLAN R-92
bullet prune (문서 smell)** 이다. 지시 본문은 "현 R-92 sub-bullet 이 단일 줄 mega-narrative 로
비대화. 요약본(≤ 10 줄: 구조 축 · p95 3000ms 임계 · 정본 pointer `test/perf/README.md`)으로
압축하고 slice 별 상세는 README 로 외화. direct doc-only" 이며, 현재 `142 행` 은 **46,156 자
1 줄** 로 여전히 그대로다 (오너 관측 시점 ~67,000 자 대비 줄었으나 압축은 미집행).

본 slice 는 **정보를 새로 쓰지 않는다** — slice 1~29 상세 · 체크인 baseline 게이트 상세는 이미
[test/perf/README.md](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)`
(`618 행` ~) · `## 체크인 baseline 게이트` (`108 행` ~) 에 외화돼 있으므로, **PLAN 쪽 서술만**
요약본으로 대체하고 정본 pointer 를 남긴다. `test/` 는 §3.1 상 `pr` 컬럼이라 README 는 건드리지
않는다 (건드릴 필요가 없음을 AC 에서 먼저 검증한다). 이로써 오너 지시 `146 행` checkbox 가
닫히고, PLAN.md 의 문서 smell 이 R-92 축에서 제거된다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `140 행` ~ `146 행` — 편집 대상 bullet(`142 행`) 과 오너 지시 2 개
  (`145 행` churn 중단 · `146 행` 본 prune 지시). `141 행`(R-91) 은 **읽기만** — 본 task 대상 아님.
- [test/perf/README.md](../../test/perf/README.md) 의 목차 수준 (`## ` / `### ` 헤더 행만) —
  요약본이 가리킬 정본 section 이 실제로 존재하는지 확인용. 본문 전량 read 금지 (1302 행).
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md)
  `251 행` — `docs/PLAN.md` `144 행` 을 가리키는 pointer. 본 prune 으로 행 좌표가 밀리므로 정정 대상.
- [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 1 · rule 5 (direct 판정 근거) + `§12` 범위 좌표 표기.

## Acceptance Criteria

- [ ] **(사전 검증) 외화 확인** — `test/perf/README.md` 에 `## 실 DB round-trip baseline (slice 목록)`
      과 `## 체크인 baseline 게이트 (`checkin-baseline-*.ts`)` section 이 존재하고 slice 번호가
      **1 ~ 29** 까지 등장함을 `grep -n '^### \|^## \|slice 29' test/perf/README.md` 로 확인.
      확인되지 않으면 **prune 을 진행하지 말고** Follow-ups 에 결손 항목을 적고 종료 (정보 손실 금지).
- [ ] **요약본 대체** — `docs/PLAN.md` `142 행` 단일 줄을 **≤ 10 줄** 의 요약 bullet 묶음으로 교체.
      요약본은 아래 **6 개 사실 축을 모두** 담는다 (하나라도 누락 시 미달):
      1. R-92 정의(이미 저장된 결과 조회 3 초 이내) 와 임계 **p95 3000ms** (REQ-048).
      2. harness 규모 — `test/perf/*.perf-spec.ts` **63 개**(read 경로 **51 개**) + 순수 primitive
         **4 파일**(`latency-metrics.ts` · `latency-collector.ts` · `latency-baseline.ts` ·
         `latency-baseline-io.ts`).
      3. CI 강제 경로 — [`ci.yml`](../../.github/workflows/ci.yml) `perf test` step 의 `pnpm test:perf` (T-0878).
      4. 실 DB round-trip baseline 이 **slice 29 까지** 도달했다는 사실 + **정본 pointer** =
         [`test/perf/README.md`](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)`.
      5. 체크인 baseline 게이트 — [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md),
         `PERF_CHECKIN_BASELINE: "1"` 토글(T-1584), baseline JSON **5 route** 확정,
         **상대 회귀는 관찰만 · exit code 불변**, `§Follow-ups (c)` 임계 fix 미완.
      6. 오너 결정 승계 — 신규 per-route baseline slice 큐잉 **금지**(`145 행`) · `140 행`
         checkbox 가 `[ ]` 로 유지되는 근거(체크인 게이트 임계 fix 미완).
- [ ] **삭제 안전성** — 교체로 사라지는 서술 중 위 6 축과 `test/perf/README.md` 어느 쪽에도 없는
      사실이 있으면 **삭제하지 말고** 요약본 안에 1 줄로 남기거나 Follow-ups 에 박제. 판단 근거를
      commit body 에 1 줄 기록.
- [ ] **오너 지시 checkbox 닫기** — `146 행` bullet 을 `- [x]` 로 바꾸고 꼬리에 집행 사실
      (교체 전 `46,156 자` → 교체 후 줄 수 · 정본 pointer) 1 문장 append. `145 행`(churn 중단
      상한) 은 **무변경** — 그 지시는 상시 유효한 상한이라 닫지 않는다.
- [ ] **행 좌표 pointer 정정** — prune 으로 밀린 행 번호를 실제 값으로 재계산해
      `docs/decisions/ADR-0057-*.md` `251 행` 의 `` `144 행` `` 을 새 좌표로 정정.
      정정 후 `grep -rn 'PLAN[^\n]\{0,40\}1[4-6][0-9] 행' docs/decisions docs/architecture docs/ops
      docs/requirements.md CLAUDE.md README.md` 로 **다른 stale pointer 가 0 건** 임을 확인
      (`docs/tasks/*` · `docs/progress/*` 는 §12 범위 밖이라 **소급 정정 금지**).
- [ ] **판정면 · 범위 불변** — `141 행`(R-91 bullet) · `140 행` checkbox `[ ]` · `144 행` · `148 행` ·
      `156 행` 본문은 **문자 단위 무변경**. `test/` · `src/` · `web/` · `.github/workflows/` ·
      `package.json` diff **0 파일** (`git diff --stat` 로 확인).
- [ ] `pnpm lint` 무경고. direct doc-only 이므로 R-110 tester 호출 면제 (코드 변경 0 LOC).
- [ ] 변경 2 파일 · ≤ 300 LOC · ≤ 5 파일 (`git diff --stat` 로 확인).

## Out of Scope

- **`141 행` R-91 bullet 의 prune** — 같은 mega-narrative smell(28,540 자)이지만 오너 지시
  `146 행` 은 **R-92 축만** 지목한다. 별도 slice 소관 (Follow-ups 에 기록).
- **`test/perf/README.md` 편집** — `test/` 는 §3.1 상 `pr` 컬럼. 본 slice 를 `direct` 로 유지하기
  위해 README 는 읽기만 한다. README 보강이 필요하다고 판단되면 Follow-ups 로 넘긴다.
- **새 perf-spec 추가 · 임계 재조정 · 체크인 baseline JSON 갱신** — `145 행` 오너 상한 위반.
- **`docs/ops/load-resilience-test-plan.md` 편집** — 본 slice 는 R-92(PLAN) 축이며 부하계획
  문서와 무관. 새 `workflow_dispatch` · `gh run rerun` · 실측 **0**.
- **`docs/tasks/*` · `docs/progress/*` 의 행 좌표 소급 정정** — §12 소급 치환 금지.
- **REQ-048 판정 상태 변경** (`docs/requirements.md`) — 본 slice 는 PLAN 서술 압축일 뿐 판정
  이동 0.

## Suggested Sub-agents

`implementer` (문서 압축 단독 — architect · tester 불요, direct doc-only)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

---

## 완료 기록

- **완료 시각**: 2026-08-26T00:47Z (cron fire `cron@aa-local-e69b69e4`)
- **commit**: `9cba851f` (direct → main), +9/-3, 2 파일
- **결과**: `docs/PLAN.md` `142 행` 의 46,156 자 단일 줄 R-92 mega-narrative 를 6 사실 축을 보존한 **7 줄 요약본 + `test/perf/README.md` 정본 pointer** 로 교체했다. 사라진 서술은 전량이 README `618 행` · `108 행` · `1244 행` 쪽에 이미 외화돼 있어 신규 정보 손실 0. 오너 지시 checkbox(구 `146 행` → 현 `152 행`)를 `[x]` 로 닫고 집행 사실 1 문장을 붙였으며, prune 으로 밀린 +6 행 좌표 때문에 [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `251 행` 의 PLAN pointer 를 `144 행` → `150 행` 으로 정정했다. `ADR-0056` 의 `PLAN 142 행` pointer 는 bullet 머리 행이 `142` 로 불변이라 stale 아님(무변경).
- **범위 불변 확인**: `test/` · `src/` · `web/` · `.github/workflows/` · `package.json` diff 0 파일, 새 perf-spec · 임계 재조정 · 실측 0. `pnpm lint` 무경고.
