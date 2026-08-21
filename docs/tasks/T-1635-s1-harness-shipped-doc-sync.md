---
id: T-1635
title: S1 배치 부하 harness shipped 사실을 PLAN 141 행 · 부하계획 4 곳에 doc-sync
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 80
estimatedFiles: 2
independentStream: r91-load-harness
dependsOn: [T-1634]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
created: 2026-08-21
plannerNote: P5 R-91 chain 16/N — T-1627~T-1634 로 harness 가 실제 shipped 라 PLAN 141 "미착수" 서술이 drift, doc-only 현행화
---

# T-1635 — S1 배치 부하 harness shipped 사실을 PLAN 141 행 · 부하계획 4 곳에 doc-sync

## Why

[PLAN.md](../PLAN.md) `144 행` 오너 지시(R-91 k6 최우선) chain 16/N 이다. T-1627 ~ T-1634 로
S1 harness 는 실제로 **shipped** 상태다 — stub gating helper(`src/common/load-test-stub-gating.ts`) ·
module binding(`assessment-evaluation.module.ts` 의 `LLM_GATEWAY` 분기) · 스크립트
(`test/load/s1-batch.js`, D2~D5 집행) · workflow step(`load-k6.yml` 의 "k6 S1 평가 배치 부하
시나리오 실행" + `LOAD_TEST_STUB=1` · 더미 `LLM_APIKEY_ENC_KEY` 주입) · `package.json` 의
`test:load:s1` 이 모두 main 에 있다. 그런데 문서 2 곳은 여전히 **착수 전 사실**을 말한다 —
[PLAN.md](../PLAN.md) `141 행` 은 "**미착수**: 배치 부하 측정 harness·실측이 모두 없어" 라 적고
ADR-0054 를 "PROPOSED 대기" 로 가리키며(실제 `status: ACCEPTED`),
[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) 는 `§2` S1 "주의" 가 격리
설계를 아직 미결로 두고 `§4.2` 가 "선행 설계해야 한다(도구 ADR 에서 함께 결정)" 로, `§5` item 1
이 ADR-0054 를 PROPOSED 로, item 3 이 "스크립트·배선은 후속 slice" 로 남아 있다.

본 slice 는 **사실 서술만 현행화**한다. 새 판단 · 새 임계 · 완료 선언은 만들지 않는다 — 실측
(baseline)이 아직 없으므로 REQ-047 은 여전히 **미검증** 이고 `140 행` checkbox 는 `[ ]` 유지다.
드리프트를 방치하면 다음 planner turn 이 이미 shipped 인 harness 를 다시 큐잉하는 중복 작업
위험이 생긴다.

## Required Reading

- `docs/PLAN.md` — `139 ~ 141 행`(성능 검증 bullet)과 `144 행`(오너 지시) 만. 파일 전체 read 금지.
- `docs/ops/load-resilience-test-plan.md` — `§2` S1(`45 ~ 53 행` 부근) · `§4.2`(`108 ~ 120 행` 부근) ·
  `§5` item 1 · item 3 · item 4(`122 행` 이하). `§3` 임계 표와 `§5` item 5 의 R-92 perf 서술은 읽되 수정 금지.
- `docs/decisions/ADR-0057-s1-batch-load-io-isolation.md` — `## Decision` `D1` · `D5` 만(현행화 문구의 근거 pointer).
- `test/load/s1-batch.js` — 머리 주석 `1 ~ 18 행`(무엇이 이미 배선됐는지 사실 확인용, 수정 금지).
- `.github/workflows/load-k6.yml` — step 이름 목록만(`98 행` 부근 S1 step 존재 확인, 수정 금지).

## Acceptance Criteria

- [ ] `docs/PLAN.md` `141 행` 의 "**미착수**: 배치 부하 측정 harness·실측이 모두 없어" 서술이
      현행 사실로 교체된다 — (a) harness shipped(스크립트 `test/load/s1-batch.js` + `load-k6.yml`
      S1 step + `package.json` `test:load:s1` + stub 배선 T-1627 ~ T-1629, 근거 task ID · merge sha 표기),
      (b) **잔여 = 실측(baseline)** 이라 REQ-047 은 여전히 미검증, (c) `140 행` checkbox `[ ]` 유지
      근거는 그 잔여 실측이라는 3 점이 한 줄 안에 드러난다.
- [ ] 같은 줄의 ADR-0054 pointer 가 "PROPOSED 대기" 에서 **ACCEPTED**(2026-07-08, k6 승인)로 정정되고,
      `§5 item 1·3` pointer 는 유지하되 현행 상태를 반영한다.
- [ ] `docs/ops/load-resilience-test-plan.md` `§2` S1 의 "주의" 항목에 **격리 결정이 ADR-0057 `D1`
      (env `LOAD_TEST_STUB` 정확히 `1` 일 때만 stub gateway, fail-safe default OFF)로 닫혔고 배선까지
      완료** 라는 pointer 1 줄이 추가된다(기존 "주의" 문장 자체는 보존 — 계획 원문 삭제 금지).
- [ ] `docs/ops/load-resilience-test-plan.md` `§4.2` 의 "LLM/외부 수집 의존 격리" 항목이 "선행
      설계해야 한다(도구 ADR 에서 함께 결정)" 에서 **ADR-0057 `D1` 이 결정 완료 + 구현 완료** 로
      현행화되고, 수집(GitHub/Confluence) 축은 **아직 stub 미배선**(현 S1 표본 person 은
      ServiceIdentity 가 없어 외부 수집 왕복 0)이라는 사실이 함께 적힌다.
- [ ] `docs/ops/load-resilience-test-plan.md` `§5` item 1 의 ADR-0054 상태가 **ACCEPTED** 로,
      item 3 의 "스크립트·배선은 후속 slice" 가 **스크립트 · workflow step · npm script 배선 완료**
      (T-1631 ~ T-1634 및 각 merge sha)로, item 4(CI 통합)가 **`load-k6.yml` 별도 수동 job 으로 편입
      완료** 로 정정된다. item 5(baseline 확정)는 **미착수 유지** 임이 명시된다.
- [ ] 변경 파일이 위 2 개뿐이다 — `git diff --name-only` 로 확인(`docs/PLAN.md`,
      `docs/ops/load-resilience-test-plan.md`).
- [ ] 문서 표기 규약 준수: 행 범위는 물결 `~` 표기, `L` prefix 미사용, 본문 한국어(CLAUDE.md `§12`).
- [ ] doc-only 변경이라 `src/` · `test/` · workflow · `package.json` diff 가 0 임을
      `git diff --stat` 으로 확인한다(코드 무변경 → R-112 test 항목은 본 task 에 해당 없음 —
      `commitMode: direct` doc-only 이므로 CLAUDE.md `§3.2` R-110 면제 대상).

## Out of Scope

- **baseline 실측** — `load-k6.yml` 수동 job 실행 · 실 수치 수집 · `§3` 표 임계 fix 는 별도 slice
  (`§5` item 5). 본 task 는 문서 서술만 만진다.
- `docs/requirements.md` 의 REQ-047 상태 전이 — 실측이 없으므로 전이 근거가 아직 없다.
- `PLAN.md` `140 행` checkbox 를 `[x]` 로 바꾸는 것 — 금지(실측 미완).
- `test/load/*.js` · `.github/workflows/load-k6.yml` · `package.json` · `src/` 수정 — 본 task 는 doc-only.
- 수집(GitHub/Confluence) 축 stub 배선 — 사실 서술만 적고 구현은 하지 않는다.
- ADR-0054 / ADR-0057 본문 수정 — 본 task 는 pointer 인용만 한다.
- `§5` item 5 의 R-92 실 DB perf slice 서술 — 오너 지시(신규 R-92 slice 큐잉 금지) 범위라 손대지 않는다.

## Suggested Sub-agents

`implementer` (doc-only edit) — architect · tester 불요(`commitMode: direct`, 코드 0 LOC).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

## 완료 기록

- **Status: DONE** — 2026-08-21T04:40Z (cron@AKIHA-7d1cb06b fire).
- `commitMode: direct` doc-only — main 직접 commit `91ed6dcd` (PR · reviewer 없음, CLAUDE.md §3.1).
- 결과: [PLAN.md](../PLAN.md) `141 행` 을 "미착수" → harness shipped 사실(근거 task ID · 머지 sha · 잔여 실측 명시)로 교체하고 ADR-0054 pointer 를 ACCEPTED 로 정정, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2` S1 주의에 ADR-0057 D1 격리 완료 pointer 1 줄 추가 · `§4.2` LLM 격리 항목을 결정·구현 완료로 현행화 · `§5` item 1·3·4 정정 + item 5(baseline 실측) 미착수 유지 (+19/-9, 2 파일).
- 검증: 코드 diff 0(`src/` · `test/` · workflow · `package.json` 무변경) — R-110 면제 대상 direct doc-only. `140 행` checkbox 는 실측 부재로 `[ ]` 유지.
