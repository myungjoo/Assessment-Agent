---
id: T-1679
title: T-1678 not-cancelled 게이트 배선을 부하계획 문서와 PLAN 141 행에 동기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 55
estimatedFiles: 2
independentStream: load-k6-r91
dependsOn: [T-1678]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain — T-1678 승계 Follow-up ②(817 행 무효화) + PLAN 141 행 T-1676~T-1678 drift 동기, doc-only direct
---

# T-1679 — T-1678 not-cancelled 게이트 배선을 부하계획 문서와 PLAN 141 행에 동기

## Why

오너 지시(PLAN `141 행` R-91 최우선) chain 의 직전 slice [T-1678](T-1678-load-k6-s2-s3-step-not-cancelled-gate.md)(PR #1335 → main `8af5b06d`)이 `.github/workflows/load-k6.yml` 의 S2 · S3 step 에 `if: ${{ !cancelled() }}` 를 배선해, S1 leg 게이트가 red 인 동안 두 leg 가 통째로 skip 되던 구조 결함을 닫았다. 그런데 문서 축은 아직 그 이전 상태다 — [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `817 행` 근처 `S2 1 회차` 소절 (d) 는 여전히 "**S1 step 이 fail 하는 한 S2 step 은 계속 skip** 되므로, 다음 S2 dispatch 는 S1 게이트 처리 뒤여야 의미가 있다" 로 서술돼 있어 **현재 main 의 워크플로 사실과 어긋난다**(다음 dispatch 판단을 잘못 유도할 수 있는 규범 서술이라 이력 분류로 방치 불가). 또한 `docs/PLAN.md` `141 행` 은 T-1675 까지만 기록돼 있고 **T-1676(임계 코드 동기) · T-1677(임계 문서 동기) · T-1678(게이트 배선) 3 slice 가 0 회 언급**이라 chain 서술이 3 회차 뒤처져 있다. 본 slice 는 이 두 drift 만 닫는 문서 전용 작업이며, 코드 · 워크플로 · spec · `§3` 임계 숫자 · 실 dispatch 는 전부 건드리지 않는다.

## Required Reading

- `docs/tasks/T-1678-load-k6-s2-s3-step-not-cancelled-gate.md` — 배선된 내용 · 무엇이 0 변경인지(집행 사실의 정본)
- `docs/ops/load-resilience-test-plan.md` `758~821 행` — `#### S2 1 회차 (T-1674, run 32746598803 …)` 소절, 특히 (d) 문장
- `docs/ops/load-resilience-test-plan.md` `853~965 행` — `## 5. Follow-up 인덱스` item 5 의 잔여 서술(T-1675 문단 끝까지)
- `docs/progress/journal-2026-08-25.md` 의 `T-1678 DONE` 항목 — PR 번호 · squash sha · 승계 Follow-up 3 건
- `.github/workflows/load-k6.yml` `190~215 행` — 실제 배선된 `if: ${{ !cancelled() }}` 2 곳 (읽기 전용, 변경 금지)

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` `S2 1 회차` 소절 (d) 의 "S1 step 이 fail 하는 한 S2 step 은 계속 skip" 규범 서술이 **무효화 표기**로 갱신된다 — 원 문장을 T-1674 시점 이력으로 명시하고, T-1678(PR #1335 → main `8af5b06d`)이 두 step 에 `if: ${{ !cancelled() }}` 를 얹어 **S1 leg red 여도 S2 · S3 가 실행된다**는 현행 사실과 그 pointer 를 덧붙인다. 문장 삭제가 아니라 이력 보존 + 현행 표기 방식(`§ 12.76` 소급 치환 금지 관행 승계).
- [ ] 같은 문서 `§5` item 5 의 T-1675 문단 뒤(② 항목 시작 전)에 **T-1676 · T-1677 · T-1678 집행 사실 문단 1 개**가 append 된다 — 코드 `STUB_BASELINE_P95_MS = 1100`(T-1676 `ebe6d8f8`) · 문서 임계 동기(T-1677) · S2 · S3 step 게이트 배선(T-1678 `8af5b06d`) 3 종과, 그럼에도 **잔여 ① 은 미해소 유지 · 잔여 개수 1 개 · ② · ③ 표기 무변경**임을 명시(실 수집 왕복 0 · LLM stub · S2 축 실측 0 회 조건 불변).
- [ ] `docs/PLAN.md` `141 행` 꼬리에 T-1676 · T-1677 · T-1678 3 slice 의 집행 사실이 append 된다 — 각각 (a) 관찰용 게이트 상수 900 → 1100 코드 동기, (b) `§3` 표 · 각주 문서 동기, (c) S2 · S3 step `if: ${{ !cancelled() }}` 배선 + drift-guard 12 test. 같은 줄의 **`140 행` checkbox `[ ]` 유지 근거**(LLM stub · 실 수집 왕복 0 · 단일 iteration)를 재확인해 마커 승격이 없음을 문장으로 남긴다.
- [ ] 위 3 항목 외 문서 변경 0 — `§3` 임계 표의 숫자(`p(95)<1100` · S2 `< 3s` · error rate `< 1%`), `§3.1` 1~11 회차 회차 기록 본문, `#### S2 dataset 교체 설계` 소절, `§4` 는 문자 단위 무변경. `git diff --stat` 이 정확히 2 파일만 보여야 한다.
- [ ] 코드 · 워크플로 · spec · `package.json` 변경 0 — `git diff --name-only` 결과에 `src/` · `test/` · `.github/` · `prisma/` 경로가 **한 건도** 없어야 한다.
- [ ] 확인용으로 `pnpm lint` 를 1 회 실행해 무경고임을 확인한다(doc-only 라 R-110 tester 의무는 면제 — production code 0 LOC).
- [ ] 링크 무결성: 본 갱신에서 새로 적는 상대 경로 링크(`../../.github/workflows/load-k6.yml` · `../PLAN.md` · task 파일 링크)가 실제 존재하는 파일을 가리킨다.

R-112 4 항목은 본 task 에 적용되지 않는다 — `commitMode: direct` 의 doc-only 변경이라 새 public symbol · 분기 · 실행 경로가 0 이다(테스트 대상 부재).

## Out of Scope

- **실 dispatch 금지** — `load-k6.yml` 을 `workflow_dispatch` 로 발화하지 않는다. S2 · S3 첫 실측(T-1678 승계 Follow-up ①)은 별도 slice 소관이다.
- `.github/workflows/load-k6.yml` 재편집(컨테이너 기동 실패 게이트 `steps.<id>.outcome` 검토는 T-1678 Follow-up ③ 로 별도 slice).
- `§3` 임계 숫자 재산정 · 상향 · 하향 — T-1668 재확정 규칙의 트리거는 새 실측 표본이 있을 때만 평가한다(본 slice 는 실측 0 회).
- `§3.1` 기존 회차 소절(1~11 회차 · S2 1 회차의 (a)~(c)) 본문 재작성 · 표기 소급 치환.
- `140 행` checkbox 승격, REQ-047 / REQ-048 완료 판정.
- `docs/STATE.json` · counters · journal 갱신(driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). tester 불요 — 확인용 `pnpm lint` 는 implementer 가 직접 실행.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
