---
id: T-1662
title: 133 로그인 seed 실행 경로 배선 완료를 정본 문서 3 곳에 doc-sync
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 85
estimatedFiles: 3
created: 2026-08-23
createdAt: 2026-08-23T13:30:00Z
independentStream: load-r91
dependsOn: [T-1661]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/ops/realdata-scale-devset.md
  - docs/PLAN.md
plannerNote: "R-91 chain 44/N — T-1651~T-1661 seed 실행 경로 11 slice 머지 사실이 정본 3 곳에 0 회 반영 (direct doc-only)"
---

# T-1662 — 133 로그인 seed 실행 경로 배선 완료를 정본 문서에 반영

## Why

오너 지시 ([PLAN.md](../PLAN.md) `144 행` "R-91 k6 최우선·즉시 착수") chain 의 44 번째 slice 다. 직전 11 slice (T-1651 `4e0697c6` ~ T-1661 `499df531`) 가 **133 로그인 fixture → `Person` + github `ServiceIdentity` 적재 → k6 소비** 까지의 seed 실행 경로를 전부 main 에 박았다. 그런데 정본 문서 셋 (`grep -c "T-165[1-9]\|T-166"` 이 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) · [realdata-scale-devset.md](../ops/realdata-scale-devset.md) · [PLAN.md](../PLAN.md) 모두 `0`) 은 여전히 **"잔여 = seed 실행 경로 (실행 0 회)"** 라고만 적혀 있어, 이미 닫힌 배선 축을 미착수로 오독하게 만든다 — 다음 turn 의 planner 가 이미 머지된 배선을 중복 큐잉할 위험이 실재한다 (superseded-PR 안티패턴).

본 slice 는 **문서를 머지된 현실에 맞춘다** — 배선 축은 닫혔고 **실 dataset 을 태운 run 은 여전히 0 회** 라 `§5` item 5 잔여 ① 자체는 **미해소 유지** 임을 같은 문단에서 분명히 한다. 측정 0 · 코드 0 의 순수 doc-sync 라 REQ-047 재판정도 아니다.

## Required Reading

- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `415~425 행` — `§5` item 5 잔여 ① 의 "따라서 **잔여는 seed 실행 경로** 로 좁혀졌다 … seed 실행은 여전히 **0 회**라 **① 자체는 미해소**다" 문장. **본 slice 가 고치는 주 지점** 이며, 잔여 개수 (1 개) 와 ①/②/③ 번호 체계는 건드리지 않는다.
- [`docs/ops/realdata-scale-devset.md`](../ops/realdata-scale-devset.md) `157~172 행` — `## 기계 판독 사본 · drift guard` 절. 새 서술은 이 절 **뒤에** 붙인다. `## A.` / `## B.` 표는 **문자 하나도 건드리지 않는다** (아래 Out of Scope 참조).
- [`docs/PLAN.md`](../PLAN.md) `141 행` 끝부분 — "잔여는 그 133 로그인으로 `Person` + github `ServiceIdentity` 를 적재해 실 수집 왕복을 태우는 **seed 실행 경로** 1 개다(실행 0 회)." 이 꼬리에 이어 붙인다. `140 행` checkbox `[ ]` 는 **유지** (LLM stub · 수집 왕복 0 · 단일 iteration 이라 REQ-047 미달은 그대로).
- 반영할 머지 사실 (SHA 는 `git log origin/main --oneline` 확인분):
  - helper chain — T-1651 `4e0697c6` (descriptor 빌더) · T-1652 `bcce5516` (upsert-args 조립) · T-1653 `26a9e8f9` (Person leg runner) · T-1654 `53ebe0aa` (ServiceIdentity leg runner) · T-1655 `7bc054a7` (두 leg top-level 진입점) · T-1656 `1a7ace68` (CLI 본체) · T-1657 `1e44f562` (실 `PrismaClient` 팩토리), 파일은 `test/helpers/realdata-devset-seed-*.ts` 7 종 + colocated spec.
  - 실행 진입점 — T-1658 `609c937b`: [`scripts/seed-devset-logins.ts`](../../scripts/seed-devset-logins.ts) + `package.json` `27 행` `"seed:devset-logins": "ts-node scripts/seed-devset-logins.ts"`.
  - workflow 배선 — T-1659 `f9da3e7f` (툴체인 3 step: pnpm `9.12.0` · Node `20` · `--frozen-lockfile`) · T-1660 `73100c77` ([`load-k6.yml`](../../.github/workflows/load-k6.yml) `114~122 행` `133 로그인 실 dataset seed 적재` step).
  - 소비 경로 — T-1661 `499df531`: [`s1-batch.js`](../../test/load/s1-batch.js) `setup()` 이 `POST /api/persons` 합성 생성 대신 `GET /api/persons` + `@load.devset.test` 접미사 필터로 적재분을 겨냥하고, `teardown()` 은 공유 dataset 을 보존한다.

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` `§5` item 5 잔여 ① 에 **배선 축 해소** 서술이 들어간다 — (a) helper chain 7 종 (T-1651~T-1657), (b) 실행 진입점 + `pnpm seed:devset-logins` (T-1658), (c) workflow 툴체인 + seed step (T-1659/T-1660), (d) k6 소비 경로 (T-1661) 네 축을 각각 task ID + main SHA 와 함께 적는다.
- [ ] 같은 문단에서 **① 은 여전히 미해소** 임을 명시한다 — 이유는 "실 dataset 을 태운 run 이 0 회" 이고, 잔여 내용이 *배선* 에서 **실행·실측** 으로 좁혀졌을 뿐임을 적는다. `§5` item 5 의 잔여 **개수는 1 개 그대로** 이며 ② · ③ 의 해소 표기는 무변경.
- [ ] `docs/ops/realdata-scale-devset.md` 에 seed 실행 경로 소절 (예: `## seed 실행 경로`) 을 `## 기계 판독 사본 · drift guard` 절 뒤에 추가한다 — 133 로그인 fixture 가 어떤 helper/entrypoint 를 거쳐 DB 에 적재되는지 (`pnpm seed:devset-logins`), workflow 의 어느 step 이 그걸 부르는지, k6 가 어떤 email 접미사 (`@load.devset.test`) 로 적재분을 겨냥하는지 3~8 줄로 적는다.
- [ ] `docs/PLAN.md` `141 행` 꼬리에 같은 사실을 1~3 문장으로 잇는다 — 배선 4 축 완료 + 실행 0 회 + `140 행` checkbox `[ ]` 유지 근거 (LLM stub · 수집 왕복 0 · 단일 iteration). **checkbox 문자는 변경 금지**.
- [ ] 세 문서에 적은 task ID · main SHA · 파일 경로 · `pnpm` 스크립트 이름이 실제 main 과 **문자 그대로** 일치한다 — `git log origin/main --oneline | grep T-16NN` 와 `grep -n "seed:devset-logins" package.json` 으로 각 1 회 대조 (허구 SHA · 오타 경로 0).
- [ ] `pnpm test` 전량 green — 특히 [`realdata-devset-logins-doc-consistency.spec.ts`](../../test/helpers/realdata-devset-logins-doc-consistency.spec.ts) 가 `realdata-scale-devset.md` 의 `## A.` / `## B.` 표를 파싱하므로, 본 편집이 그 표의 길이 · 원소 · 순서를 건드리지 않았음이 `RangeError` 부재로 확인돼야 한다.
- [ ] 최종 diff **≤ 300 LOC · 3 파일**, `commitMode: direct` (doc 전용 — `src/` · `test/` · workflow · `package.json` 변경 0).

## Out of Scope

- `docs/ops/realdata-scale-devset.md` 의 `## A.` / `## B.` 로그인 표 수정 일체 — fixture ([`test/load/realdata-devset-logins.json`](../../test/load/realdata-devset-logins.json)) 동시 갱신이 강제돼 direct-mode 를 벗어나고 drift guard 가 `pnpm test` 를 깬다 (같은 문서 `§편집 규칙`).
- `test/load/s2-read.js` · `test/load/s3-concurrent.js` 의 dataset 교체 — 별도 pr-mode slice (s2 는 머리 주석이 "133 명 실 seed 는 S1 소관" 이라 교체 여부 판단부터 필요).
- 실 workflow dispatch 실행 및 `§3.1` 7 회차 실측 기록 — 별도 slice. 본 slice 는 **측정 0** 이다.
- `§3` 임계 숫자 · `§2` 시나리오 정의 · ADR-0054 / ADR-0057 본문 변경.
- `scripts/daily-test.sh` 의 leg 추가 — drift-guard smoke 3 종 (T-0791/T-0944/T-0947) 동반 수정으로 5 파일 cap 초과 (T-1122 BLOCKED / Q-0054 선례). 계속 Out of Scope.
- REQ-047 / REQ-048 상태 flip (`PLANNED` 유지) 및 `PLAN.md` `140 행` checkbox 변경.

## Suggested Sub-agents

`implementer`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
