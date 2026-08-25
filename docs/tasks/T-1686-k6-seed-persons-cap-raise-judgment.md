---
id: T-1686
title: K6_SEED_PERSONS 상한 30→133 상향 여부를 S2 실측 3 회차 근거로 판단·박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048, REQ-047]
independentStream: load-resilience
dependsOn: [T-1685]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
estimatedDiff: 120
estimatedFiles: 2
created: 2026-08-25
plannerNote: P5 부하 harness — T-1685 승계 Follow-up ①, S2 3 회차 근거로 상한 상향 판단만 박제 (코드 변경 0, direct)
---

# T-1686 — K6_SEED_PERSONS 상한 30→133 상향 여부 판단·박제

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§2` `#### S2 dataset 교체 설계` 의 조항 **③** 이 `K6_SEED_PERSONS` 값을 `30` 으로 고정하면서 "상한 상향(예: devset 정본 규모 `133`)은 **S2 첫 실측 이후 별도 판단**이며, 코드 task 안에서의 즉석 변경은 금지한다" 고 못 박아 두었다 (`104~105 행`). S2 실측은 이제 **3 회차**(`§3.1` `#### S2 1 회차` · `#### S2 2 회차` · `#### S2 3 회차`) 가 쌓였고, 그중 2 · 3 회차는 표본 로그 원문(`취득 30명 / 필터 통과 133건 / 상한 30명`)까지 회수돼 있어 그 "별도 판단" 의 전제가 모두 충족됐다. 본 slice 는 T-1685 가 승계한 Follow-up **①** 로, 그 판단을 **근거와 함께 문서에 박제**한다. 실제 값 변경(workflow env · 스크립트 기본값 · drift-guard 단언 3 자 parity)은 `pr` slice 소관이라 본 slice 에서는 **하지 않는다** (CLAUDE.md §3.1 rule 3 split — T-1668 규칙 박제 → T-1676 코드 적용 선례 동형).

## Required Reading

- `docs/ops/load-resilience-test-plan.md` — `§2` 의 `#### S2 dataset 교체 설계` 조항 **②**·**③**(`88~105 행` 부근, 특히 `30` 유지 근거 (a)(b)(c) 와 "별도 판단" 유예 문장), `§3.1` 의 `#### S2 1 회차` · `#### S2 2 회차`(`994 행~`) · `#### S2 3 회차`(`1078 행~`) 표본 로그 원문과 지표, `§5` item 5(`1309 행~`) 꼬리.
- `test/load/s2-read.js` — `SEED_PERSONS` 정의(`34~41 행` 부근 `Math.max(1, Math.trunc(Number(__ENV.K6_SEED_PERSONS)) || 30)`), `setup()` 의 `GET /api/persons` → 필터 → `slice(0, SEED_PERSONS)` → `map` 경로, `default()` 가 실제로 인가하는 요청 3 종의 route tag. **읽기 전용 — 수정 금지.**
- `.github/workflows/load-k6.yml` `193~206 행` — S2 step 의 `K6_SEED_PERSONS: "30"` 주입 지점. **읽기 전용 — 수정 금지.**
- `docs/PLAN.md` `140~141 행` — P5 성능 검증 항목 꼬리.

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` `§3.1` 의 `#### S2 3 회차` 소절 **뒤**에 `#### K6_SEED_PERSONS 상한 상향 판단 (T-1686)` 소절을 신설하고, 다음 4 블록을 순서대로 담는다.
  - [ ] **(1) 판단 기준** — 상향/유지를 가르는 조건을 사전 열거한다. 최소 3 개: ⓐ 상한이 실제로 binding 인가(취득 `N` == 상한 < 필터 통과 `M`), ⓑ 상한 값이 **측정 지표에 영향을 주는가**(조항 ③ 근거 (b) 의 "표본 상한은 `setup()` 메모리 배열 길이일 뿐" 주장이 3 회차 실측으로 유지되는지 — `default()` 가 `personIds` 를 소비하는지 여부를 `test/load/s2-read.js` 원문으로 확인), ⓒ 상향 시 임계(`p(95)<3000`) 여유가 충분한가(3 회차 실측 p95 대비).
  - [ ] **(2) 증거** — `#### S2 1·2·3 회차` 에 이미 박제된 수치·로그 원문만 인용한다(**새 수치 창작 0 · 새 dispatch 0 · rerun 0**). 최소: 2·3 회차의 `취득 N / 필터 통과 M / 상한 30` 세 수, 각 회차 전역 p95, `http_req_failed`. 1 회차가 수치 미확보면 그 사실을 그대로 적는다.
  - [ ] **(3) 결론** — `상향(30→133)` 또는 `유지(30)` 중 **하나를 명시적으로 선택**하고, (1) 의 각 기준별로 어떻게 판정됐는지 1 줄씩 대응시킨다. 결론은 (2) 의 증거에서 기계적으로 도출돼야 하며, 증거 없이 "안전해 보인다" 류의 서술로 대체하지 않는다.
  - [ ] **(4) 후속 slice 범위** — 결론이 `상향` 이면 후속 `pr` slice 가 같은 commit 에서 갱신해야 할 **3 자 parity** 대상을 파일·지점 단위로 열거한다(`.github/workflows/load-k6.yml` S2 step 주입값 / `test/load/s2-read.js` `__ENV` 기본값 / `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 대응 단언). 결론이 `유지` 이면 재판단 트리거 조건(어떤 관측이 나오면 다시 본다)을 열거한다.
- [ ] `§2` 조항 **③** 의 "S2 첫 실측 이후 별도 판단" 문장 꼬리에 판단 완료 pointer 1 줄을 추가한다 — 원 문장은 **삭제하지 않고** 이력 보존하며, 결론과 위 신설 소절 위치를 가리킨다 (T-1679 가 `817 행` 을 무효화 표기로 닫은 서식 승계).
- [ ] `§5` item 5 꼬리에 본 slice 문단 1 개를 append 하고, `docs/PLAN.md` `141 행` 꼬리에 1 문장을 append 한다. `140 행` checkbox 는 실 수집 축 미검증이라 `[ ]` **유지**.
- [ ] `§3` 임계 표의 숫자, `§3.1` 각 회차의 측정 수치, `§2` S2 dataset 교체 설계 조항 ①·②·④·⑤ 본문, `§4` 는 문자 단위 **0 변경** — `git diff -U0` hunk 좌표로 확인 가능해야 한다.
- [ ] `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0 파일** — `git status --porcelain` 이 위 `touchesFiles` 2 개만 보여야 한다.
- [ ] 확인용 `pnpm lint` 무경고. doc-only(production 0 LOC) 라 R-110 tester 호출 면제, coverage 영향 0.

## Out of Scope

- `K6_SEED_PERSONS` **값 자체의 변경**(workflow / 스크립트 / drift-guard 단언) — 결론이 `상향` 이어도 본 slice 는 문서 판단만. 값 변경은 별도 `pr` slice.
- 새 `workflow_dispatch` · rerun · 재시도 — 본 slice 는 **이미 박제된 회차 기록의 재해석만**. 새 run 을 만들지 않는다.
- `§3` 임계 숫자 fix / 재산정, `STUB_BASELINE_P95_MS` 관련 T-1668 규칙 재계수 (S1 축 소관, 본 slice 무관).
- 승계 Follow-up ②(단계별 percentile export step / `p99` 미확보 해소) — 별도 slice.
- 기존 회차 기록의 수치 수정·소급 치환 (§12 소급 치환 금지).

## Suggested Sub-agents

`implementer` (doc 편집 단독). architect / tester 불요 — 새 아키텍처 결정 0, production 코드 0 LOC.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

## 완료 기록

- 완료: 2026-08-25T03:55Z (cron fire `cron@aa-local-fafeb05e-19657`, direct commit `9f49d8a8`)
- 결론: **상향 없이 `K6_SEED_PERSONS=30` 유지**. `§3.1` 에 `#### K6_SEED_PERSONS 상한 상향 판단 (T-1686)` 소절을 신설해 판단 기준 3 종(ⓐ binding · ⓑ 측정 영향 · ⓒ 임계 여유) → 기박제 증거 인용 → 결론 → 재판단 트리거 `T1`~`T4` 순으로 박제했고, `§2` 조항 ③ 꼬리에 판단 완료 pointer 1 줄, `§5` item 5 · `PLAN.md` `141 행` 꼬리에 append 했다.
- 범위 준수: doc-only 2 파일 `+100/-1` 순수 삽입 hunk, `§3` 임계 표 · `§3.1` 회차 수치 · `§2` 조항 ①②④⑤ · `§4` 는 문자 단위 **0 변경**. 새 `workflow_dispatch` · rerun · 값 변경 **0**. `src/` · `test/` · `.github/workflows/` · `package.json` 변경 **0 파일**. R-110 면제(production 0 LOC), 확인용 `pnpm lint` 무경고.
- Follow-ups 승계: ① 재판단 트리거 `T1`~`T4` 중 하나라도 발화하면 상향 배선 `pr` slice (workflow env · 스크립트 기본값 · drift-guard 단언 **3 자 parity**) ② 단계별 percentile export step.
