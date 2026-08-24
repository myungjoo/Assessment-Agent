---
id: T-1671
title: S2 조회 부하의 devset dataset 교체 설계를 집행 이전에 사전 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 80
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T08:40:00Z
dependsOn: [T-1661, T-1669]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: PLAN 144 행 R-91 chain 52/N — backlogNote 잔여 "s2/s3 dataset 교체" 의 설계를 코드 착수 전에 고정
---

# T-1671 — S2 조회 부하의 devset dataset 교체 설계를 집행 이전에 사전 박제

## Why

PLAN.md `144 행` 오너 지시("R-91 k6 최우선·즉시 착수") chain 의 잔여 후보 중 `create.personId` 가드는 T-1670 으로 닫혔고, STATE `backlogNote` 에 남은 것은 **`s2-read.js` / `s3-concurrent.js` 의 dataset 교체** 다. 그런데 S2 교체는 코드 1 파일로 끝나지 않는다 — `s2-read.js` 의 `setup()` / `teardown()` 이 만들고 지우는 합성 person 30 명을 devset 133 명 조회로 바꾸면 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 T-1623 · T-1634 블록 단언(seed `http.post` 3 종 · teardown `http.del` 3 회 · `K6_SEED_PERSONS` parity)이 **동시에** 바뀌어야 하고, `K6_SEED_PERSONS` 의 의미(적재 규모 → 표본 상한)까지 재정의된다. 설계를 코드 task 안에서 즉석 판단하면 cap(300 LOC / 5 파일) 초과와 사후 정당화 위험이 함께 온다. T-1668(규칙 사전 박제) → T-1669(기계 적용) 가 이미 검증한 순서를 그대로 재사용해, 본 slice 는 **교체 범위 · 보존 계약 · env 의미 · drift-guard 단언 대체 목록 · 임계 취급 · 집행 split** 6 축을 문서에 먼저 고정한다. 코드 · 워크플로 · 임계 상수 변경은 0 이고 실측 dispatch 도 0 이다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `### S2. 조회 API 응답 지연 (REQ-048)` 절(`58~66 행` 부근) — 신설 소절이 붙을 자리. 그리고 `§3` 표의 S2 축 임계(p95 3000ms, "baseline 후 fix" 상태)와 `§5` item 5 의 잔여 ① 서술.
- `test/load/s2-read.js` — `SEED_PERSONS` 선언(`33 행` 부근 정규화 표현), `setup()` 의 person 30 · group 1 · part 1 seed POST 와 signup/login, `default()` 의 route tag 4 종, `teardown()` 의 DELETE 3 루프.
- `test/load/s1-batch.js` `setup()` 의 `GET /api/persons` + `DEVSET_EMAIL_DOMAIN` 필터 + `slice(0, SAMPLE_PERSONS)` 와 `teardown()` 의 "person 회수 0" 주석 — S2 가 따라야 할 **T-1661 선례** 원문.
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — T-1623 블록(`702 행` 부근: seed 3 종 POST · teardown `http.del` 3 회 · `K6_SEED_PERSONS` parity)과 T-1634 블록(`2005 행` 부근: 정규화 표현 + 기본값 `30` parity), 그리고 `2088 행` 옛 취약 표현 금지 단언. **읽기만 — 본 task 에서 수정 금지**.
- `.github/workflows/load-k6.yml` `k6 S2 조회 부하 시나리오 실행` step(`196~203 행` 부근)의 `K6_SEED_PERSONS: "30"` 주입과, 그보다 앞선 `133 로그인 실 dataset seed 적재` step(`114 행`).

## Acceptance Criteria

- [x] `docs/ops/load-resilience-test-plan.md` 의 `### S2. 조회 API 응답 지연 (REQ-048)` 절 바로 아래에 소절 **"S2 dataset 교체 설계 (사전 박제)"** 를 신설하고, 아래 6 축을 각각 식별 가능한 항목으로 적는다.
  - [x] **① 교체 범위** — person leg 만 devset 조회로 전환(`GET /api/persons` + devset email 도메인 필터 + 표본 상한 slice, T-1661 의 S1 선례와 동형). `group` / `part` leg 는 **합성 seed 유지** 이유를 한 줄로 명시(devset seed 는 `Person` · `ServiceIdentity` 두 leg 만 적재하므로 Group / Part row 가 0 이라 목록 조회가 빈 배열이 된다).
  - [x] **② 공유 dataset 보존 계약** — `teardown()` 의 person DELETE 루프를 제거한다(지우면 뒤따르는 S3 step 과 다음 run 이 빈 DB 위에서 돈다 — T-1661 이 S1 에서 이미 확정한 계약). group / part DELETE 루프와 "user row 는 남긴다" 예외는 그대로 유지.
  - [x] **③ `K6_SEED_PERSONS` 의미 재정의** — "생성할 person 수" 에서 "**조회 결과에서 취할 표본 상한**" 으로 바뀐다는 점, 그럼에도 workflow 주입값 ↔ 스크립트 `__ENV` 기본값 **parity 는 유지**(drift-guard 3 자 대조 불변)한다는 점, 그리고 그 값을 이번 교체에서 **바꾸는지 여부와 근거**를 한 줄로 확정한다(숫자를 바꾼다면 그 숫자를 여기서 못 박고, 안 바꾼다면 "무변경" 을 명시 — 코드 task 의 즉석 판단 금지).
  - [x] **④ drift-guard 단언 대체 목록** — 교체와 **같은 commit 에서** 갱신돼야 하는 smoke 단언을 사전 열거한다(최소: T-1623 블록의 seed `http.post` 3 종 단언 · `http.del` 3 회 개수 단언 · `K6_SEED_PERSONS` parity 단언, T-1634 블록의 기본값 parity 단언). 각 항목에 "무엇으로 대체되는가"(예: POST 개수 단언 → devset 조회 + 필터 문자열 단언)를 한 줄씩 붙인다.
  - [x] **⑤ 임계 취급** — `§3` 표의 S2 축 p95 **3000ms 는 무변경**(S2 실측 0 회이므로 "baseline 후 fix" 상태 유지)이고, 측정 의미가 합성 30 → 실 dataset 133 으로 바뀌는 사실은 **S2 첫 실측 회차 기록에서** 다룬다는 것을 명시. 본 교체 자체는 임계 숫자 변경 0.
  - [x] **⑥ 집행 경로 split** — 예상 파일 수(`s2-read.js` + drift smoke spec + 필요 시 `load-k6.yml`)를 세고, cap(300 LOC / 5 파일) 안에서 **몇 개 task 로 나눌지**와 그 순서를 못 박는다. 코드·워크플로·spec 은 `pr`, 문서 반영은 `direct` 로 분리한다는 §3.1 판정도 함께 명시.
- [x] `s3-concurrent.js` 는 본 설계의 범위 밖임을 소절 안에 한 줄로 명시한다(S3 는 iteration 안에서 자기 정리하는 write 혼합이라 dataset 전제가 다르다 — 별도 slice).
- [x] `docs/PLAN.md` `141 행` 꼬리에 본 설계 박제 사실을 1~2 문장으로 append 한다. `140 행` 의 checkbox 상태(`[ ]`)는 **변경하지 않는다**(실측·집행이 아니므로).
- [x] `docs/ops/load-resilience-test-plan.md` `§5` item 5 의 잔여 서술에 본 소절을 가리키는 pointer 를 1 문장 추가한다(잔여 항목 자체의 해소 표기는 하지 않는다 — 설계만 박제됐고 집행은 미완).
- [x] **코드 · 워크플로 · spec · 임계 상수 변경 0** — `git diff --name-only` 결과가 `docs/` 2 파일뿐임을 확인한다.
- [x] `pnpm test` 가 기존과 동일하게 green(453 suite 규모) — 문서만 바꿨으므로 drift-guard smoke 를 포함한 어떤 spec 도 영향받지 않아야 한다.
- [x] 분기 없는 doc-only 변경이라 R-112 의 unit test 4 항목(happy / error / branch / negative)은 **해당 없음 — 이 항목 생략**(production code 변경 0, `commitMode: direct`).

## Out of Scope

- `test/load/s2-read.js` · `s3-concurrent.js` · `load-k6.yml` · drift smoke spec 을 **실제로 고치는 것** — 본 task 는 설계 문서만. 집행은 위 ⑥ 이 정한 후속 task 들.
- `load-k6.yml` 을 dispatch 해 S2 실측을 뽑는 것(실 run 0).
- `§3` 표의 임계 숫자 변경(S1 축 900ms 포함) — T-1669 가 "무변경" 으로 결론한 상태 그대로 둔다.
- S3 dataset 교체 설계 — 본 task 에서는 "범위 밖" 한 줄만 적고 별도 slice 로 남긴다.
- `docs/ops/realdata-scale-devset.md` 갱신 — devset seed 경로 자체는 이번에 바뀌지 않는다.

## Suggested Sub-agents

`implementer → tester` (doc-only 라 architect 불요. tester 는 `pnpm test` green + 변경 파일 2 개 확인만).

## 결과 (2026-08-24T09:45Z DONE)

- direct commit `f70f12c5` → `main` push. 변경 2 파일 `+95/-1`(cap 300 LOC / 5 파일 안).
- `docs/ops/load-resilience-test-plan.md` `S2` 절 아래 **"S2 dataset 교체 설계 (사전 박제)"** 소절 신설 — 6 축(① person leg 만 devset 조회 전환 / group · part 는 합성 seed 유지 ② `teardown()` person DELETE 제거로 공유 dataset 보존 ③ `K6_SEED_PERSONS` 를 표본 상한으로 재정의하되 숫자 `30` 무변경 + parity 유지 ④ drift-guard 단언 대체 목록 `(a)~(g)` ⑤ `§3` 표 S2 p95 3000ms 무변경 ⑥ `pr`(`s2-read.js` + drift spec 2 파일) → `direct`(문서) 2 task split) + S3 범위 밖 1 줄.
- `docs/PLAN.md` `141 행` 꼬리 append(`140 행` checkbox `[ ]` 불변), `§5` item 5 잔여 서술에 pointer(해소 표기 없음).
- 코드 · 워크플로 · spec · 임계 상수 변경 **0**, 실 dispatch **0**. `pnpm test` 453 suite / 13,009 test green · `pnpm lint` 무경고.

## Follow-ups

(작성 시점 없음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
