---
id: T-1690
title: 단계별 값 회수 경로 재확정 — 설계 조항 ⑥ 사전 박제 (tag 만으로는 요약 값이 생기지 않는 caveat)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
independentStream: load-resilience-plan
dependsOn: [T-1687, T-1688, T-1689]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 115
estimatedFiles: 2
created: 2026-08-25T07:30:00Z
completedAt: 2026-08-25T07:47:00Z
plannerNote: P5 성능 검증(PLAN 141 행) — T-1689 Follow-up ①, 조항 ④ 코드 배선 전에 단계별 값 생성 수단 caveat 를 설계로 먼저 굳힘
---

# T-1690 — 단계별 값 회수 경로 재확정 (설계 조항 ⑥ 사전 박제)

## Why

[docs/PLAN.md](../PLAN.md) `141 행` R-91 성능 검증 bullet 의 부하 harness 축에서, T-1687 이 사전 박제한
`#### 단계별 percentile export 설계` 소절이 정의한 두 공백 중 **(a) `p99` 미확보** 는 T-1688 이
(`summaryTrendStats`), **(b) 의 앞 조각인 단계 축 부여** 는 T-1689 가 (`stage` tag key) 닫았다. 그러나
T-1689 가 Follow-up ① 로 남긴 caveat — **k6 종료 요약은 tag 를 자동 분해하지 않아 `stage` 축을 달아도
단계별 값 자체가 요약에 생기지 않는다** — 는 조항 ① 의 후보 A · B 어느 쪽으로도 닫히지 않는, 설계가
예상하지 못한 공백이다. 이 공백을 **코드 배선 전에** 조항 ⑥ 으로 굳혀, 다음 `pr` slice 가 수단 선택을
재추론하거나 조항 ② (판정 임계 문자 단위 0 변경) 를 깨는 경로로 흘러가지 않게 한다 (T-1668 규칙 사전
박제 → T-1676 코드 집행, T-1687 설계 → T-1688 · T-1689 코드 집행 선례 동형).

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `281~349 행`
  (`#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절 전문 — 문제 정의 (a)·(b) 와 조항 ①~⑤)
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `2418~2425 행`
  (`§5` item 5 꼬리의 T-1687 pointer 문단 — 본 task 문단을 그 뒤에 append)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `34~60 행` ·
  `68 행` 이하 (`STAGE_TAG_KEY` · `stageTagOf` · `withStage` · `summaryTrendStats` · `thresholds` —
  **읽기 전용**, 본 task 는 이 파일을 수정하지 않는다)
- [docs/PLAN.md](../PLAN.md) `140~141 행` (성능 검증 bullet 과 R-91 꼬리 — checkbox 는 `[ ]` 유지)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` (commit mode 판정) · `§12` 언어 정책과 범위 좌표 표기 규약

## Acceptance Criteria

- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 의
      `#### 단계별 percentile export 설계` 소절 **조항 ⑤ 문단 끝 뒤 · `### 3.1` 헤더 앞**
      (삽입 전 기준 `349 행` 과 `350 행` 사이) 에 조항 **⑥** 항목 1 개를 신설한다. 새 소절 헤더를
      만들지 않고 기존 조항 목록의 여섯째 항목으로 붙인다.
- [ ] 조항 ⑥ 본문이 다음 5 요소를 모두 담는다 (항목 순서 자유, 각 요소가 문장으로 식별 가능해야 함):
      **(가) caveat 정의** — k6 종료 요약과 `handleSummary()` 가 받는 요약 객체는 request tag 를 자동
      분해하지 않으므로 `stage` 축(T-1689 배선)만으로는 단계별 값이 요약에 나타나지 않는다.
      **(나) 경로 α (thresholds 에 관찰 전용 sub-metric selector 선언) 는 채택하지 않는다** — 조항 ②
      의 "`thresholds` 배열 · 임계 숫자 문자 단위 0 변경" 과 정면 충돌하고 판정면 오염 risk 가 있다.
      **(다) 경로 β (k6 런타임 내장 `k6/metrics` 의 `Trend` custom metric 에 단계별 duration 을 직접
      record) 를 채택한다** — 새 외부 dependency **0** 이라 조항 ① 의 제약을 그대로 지킨다.
      **(라) 조항 ② · ④ 재확인** — custom Trend 는 threshold 를 갖지 않아 pass/fail 판정면 변화 0 이고,
      회수 경로는 run log 하나(고정 prefix 1 줄 또는 요약 표 grep)로 유지하며 artifact · 외부 저장소는
      범위 밖이다. **(마) 집행 경로** — 코드 `pr` 1 slice(스크립트 + drift-guard spec 동기), 문서
      `direct` 는 실 run 값 회수 뒤.
- [ ] 조항 ⑥ 이 **후보 A · B 를 폐기하지 않는다** 는 점을 명시한다 — A · B 는 값의 **표시** 수단이고
      경로 β 는 단계 축 값의 **생성** 수단이라 층위가 다르며, T-1688 이 배선한 `summaryTrendStats` 의
      `p(99)` 열이 custom Trend 에도 그대로 적용된다.
- [ ] 인용하는 행 좌표는 **삽입 후 값**으로 적고, 삽입 전 값이 다르면 같은 줄에 병기한다
      ([CLAUDE.md](../../CLAUDE.md) `§12` 범위 좌표 표기 — 신규 작성분만, 소급 치환 0).
- [ ] `§5` item 5 꼬리의 T-1687 pointer 문단 뒤에 **T-1690 문단 1 개**를 append 한다 (조항 ⑥ 이 정본
      이라는 pointer + 실 배선은 후속 `pr` slice 소관이라는 한 줄).
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 **1 문장**을 append 한다. `140 행` checkbox 는
      `[ ]` 를 유지한다 (실 수집 축 미검증 조건 불변).
- [ ] `git diff -U0` 결과가 **순수 삽입**임을 확인한다 — `§3` 임계 표 · `§3.1` 회차 기록 수치 · `§2` ·
      `§4` · 조항 ①~⑤ 본문은 **문자 단위 0 변경**.
- [ ] 변경 파일 2 개 (`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`) 뿐이고
      `src/` · `test/` · `.github/workflows/` · `package.json` 변경이 **0** 임을 `git status` 로 확인한다.
- [ ] 확인용 `pnpm lint` 무경고. production code 0 LOC 인 doc-only direct commit 이라
      [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 의 tester 의무는 면제이며, R-112 4 항목은 코드 변경이
      없어 해당 없음 (본 task 는 `commitMode: direct`).

## Out of Scope

- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 를 포함한 **모든 코드 변경** — custom
  Trend 실배선은 후속 `pr` slice 소관이다 (drift-guard spec 동기 포함).
- `thresholds` · 임계 숫자 · 판정 `route` tag · `options.stages` · `summaryTrendStats` 의 어떤 수정도 금지.
- 새 `workflow_dispatch` · rerun · 실측 수치 회수 — 본 task 는 **새 측정 0**.
- `§3.1` 회차 기록의 "미확보" 표기 갱신 (실 run 후 별도 `direct` slice — 조항 ⑤ (ii)).
- `§4.2` 신규 도구 축 · artifact 업로드 · 외부 시계열 저장소 설계.
- [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status 변경, 새 ADR 신설.
- 새 외부 dependency 추가 검토 (조항 ① 유지 — 발견 시 CLAUDE.md `§5` BLOCKED).

## Suggested Sub-agents

`implementer` (doc-only 편집 · 좌표 정합 확인). architect · tester 미호출 (설계 판단은 조항 ①~⑤ 승계,
production code 0 LOC).

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 append)

## Result (2026-08-25T07:47Z)

**DONE (direct, main `52f9fb6e`) — 2 파일 `+37/-1`.** [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
`§3` 의 `#### 단계별 percentile export 설계` 소절 조항 ⑤ 뒤(`349~375 행`)에 **조항 ⑥** 27 줄을
신설했다 — (가) k6 종료 요약과 `handleSummary()` 요약 객체가 request tag 를 **자동 분해하지 않는**
caveat 정의, (나) 경로 α(`thresholds` 에 관찰 전용 selector 선언) **불채택**(조항 ② 의 "임계 문자 단위
0 변경" 과 정면 충돌 + 판정면 오염 risk), (다) 경로 β(k6 런타임 내장 `k6/metrics` 의 `Trend`
custom metric 직접 record) **채택**(새 외부 dependency 0 — 조항 ① 유지), (라) 조항 ②·④ 재확인
(threshold 미부착 → 판정면 변화 0, 회수는 run log 1 경로), (마) 집행 split. 후보 A·B 는 **표시**
수단이고 β 는 **생성** 수단이라 층위가 달라 폐기가 아님을 명시했다. 부수로 `§5` item 5 꼬리에 본 slice
문단 1 개, [PLAN.md](../PLAN.md) `141 행` 에 1 문장을 append 했다.

**불변 확인**: `§3` 임계 표 · `§3.1` 회차 수치 · `§2` · `§4` 는 **문자 단위 0 변경**(부하계획은 삭제 0 의
순수 삽입, PLAN 은 기존 `141 행` 이 새 행의 접두사인 tail append — 181 행 불변). 새 `workflow_dispatch` ·
rerun · 측정 수치 산정 · 코드 · spec · 워크플로 변경이 **전부 0** 이고, 실측 회차도 S1 **13 회** ·
S2 **3 회** · S3 **2 회** 그대로다. LLM stub · 실 수집 왕복 0 조건이 유지되므로 `140 행` checkbox 는
계속 `[ ]`. doc-only direct 라 R-110 tester 면제 — `pnpm lint` 무경고만 확인했다.
