---
id: T-1672
title: S2 조회 부하의 person leg 를 실 devset 조회로 교체하고 drift-guard 단언을 같은 commit 에서 갱신
phase: P5
status: DONE
prNumber: 1333
completedAt: 2026-08-24T14:14:41Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T10:20:00Z
dependsOn: [T-1671]
touchesFiles:
  - test/load/s2-read.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
independentStream: load-harness-r91
plannerNote: PLAN 141 행 R-91 chain 53/N — T-1671 설계 ⑥ 의 첫 slice(pr) 집행, 코드+spec 2 파일 같은 commit
---

# T-1672 — S2 조회 부하의 person leg 를 실 devset 조회로 교체하고 drift-guard 단언을 같은 commit 에서 갱신

## Why

[T-1671](T-1671-s2-devset-dataset-swap-design.md) 이 `docs/ops/load-resilience-test-plan.md` 의
`#### S2 dataset 교체 설계 (사전 박제)` 소절에 ①~⑥ 6 축을 이미 고정했고, 그 **⑥ 이 집행 순서를
`pr`(코드 + spec 2 파일 같은 commit) → `direct`(문서) 2 task 로 못 박았다**. 본 task 는 그 첫
slice 다 — 판단은 전부 끝났고 남은 것은 기계적 적용이라, 설계 문서를 정본으로 삼아 그대로 옮긴다
(T-1668 규칙 박제 → T-1669 기계 적용 이 검증한 순서 승계). 미착수 상태 확인도 마쳤다:
`test/load/s2-read.js` `setup()` 은 여전히 `POST /api/persons` 를 `SEED_PERSONS` 회 반복하는 합성
seed 이고 `teardown()` 은 person DELETE 루프를 돌린다 — main 에 선반영된 부분 0.

두 파일을 **같은 commit** 으로 묶는 이유는 설계 ④ 가 명시한 대로다. `s2-read.js` 만 고치면
`load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 T-1623 블록(seed `http.post` 5 회 단언 ·
teardown `http.del` 3 회 단언)이 즉시 red 가 되어 CI 가 막힌다. PLAN `141 행` 의 R-91 성능 검증
축(REQ-048)은 S2 가 합성 person **30** 위에서 도는 한 "조회 3 초 이내" 를 실 규모로 입증하지
못하므로, 본 교체가 S2 첫 실측의 전제다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` 의 `#### S2 dataset 교체 설계 (사전 박제)` 소절
  (`67 행` 부근부터 `S3.` 절 직전까지) — **본 task 의 정본 명세**. ① 교체 범위 / ② 보존 계약 /
  ③ env 의미 · 숫자 무변경 / ④ 단언 대체 목록 `(a)~(g)` / ⑤ 임계 무변경 / ⑥ split 을 그대로
  집행한다. 설계와 다른 판단이 필요해 보이면 **즉석 변경 금지** — Follow-ups 에 적는다.
- `test/load/s2-read.js` 전문 — 교체 대상. `SEED_PERSONS` 정규화 선언(`33 행` 부근), `setup()` 의
  person 반복 POST / group · part POST / signup · login, `default()` 의 route tag 4 종,
  `teardown()` 의 DELETE 3 루프.
- `test/load/s1-batch.js` `setup()` 의 `(c)` 블록(`126~141 행` 부근) — 따라야 할 **T-1661 선례
  원문**: `DEVSET_EMAIL_DOMAIN` 상수 리터럴 선언(`45~47 행`), `http.get` → `.json().filter(...)
  .slice(0, N).map(...)` **단일 식**, T-1666 의 표본 로그 1 줄. 표현을 새로 발명하지 말고 이
  형태를 옮긴다.
- `test/helpers/realdata-devset-seed-descriptors.ts` 의 `DEVSET_EMAIL_DOMAIN` — 도메인 **정본**.
  k6 쪽은 그 사본 상수이며 정본 경로를 주석으로 지목한다(설계 ④ (f) — 새 `__ENV` 키 금지).
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 의 T-1623 블록
  (`702~740 행`: seed POST 5 회 · `S2_ROUTES` · teardown `http.del` 3 회 · `K6_SEED_PERSONS`
  parity), T-1634 블록(`1988~2015 행`: 정규화 표현 + 기본값 `30` parity), `2088 행` 옛 취약 표현
  금지 단언, 그리고 신설 블록의 형태 모델인 T-1661 블록(`3278 행` 부근) · T-1666 블록
  (`3470 행` 부근).

## Acceptance Criteria

- [ ] **`test/load/s2-read.js` — 설계 ① · ② · ③ 적용**
  - [ ] `setup()` 의 `POST /api/persons` × `SEED_PERSONS` 반복문을 제거하고, `GET /api/persons`
        **1 회** → `.json().filter(row 의 email 이 `@<devset 도메인>` 으로 끝남)` →
        `.slice(0, SEED_PERSONS)` → `.map(id 추출)` 을 잇는 **단일 식**으로 대체한다
        (중간 변수 0 · 조건 분기 0 · `Math.min` 0 — T-1620 규약 승계, `s1-batch.js` 동형).
  - [ ] devset 도메인은 **상수 리터럴**로 선언하고 정본
        (`test/helpers/realdata-devset-seed-descriptors.ts` 의 `DEVSET_EMAIL_DOMAIN`) 경로를
        주석으로 지목한다. **새 `__ENV` 키를 만들지 않는다** — 스크립트의 `__ENV.` 총 개수는
        `2`(`K6_BASE_URL` · `K6_SEED_PERSONS`) 그대로.
  - [ ] `group` / `part` seed POST 와 signup → login 인증 부트스트랩, `default()` 의 route tag
        4 종(persons / groups / parts / me)은 **무변경**.
  - [ ] `teardown()` 의 **person DELETE 루프를 제거**한다(공유 dataset 보존 — 지우면 뒤따르는 S3
        step 과 다음 run 이 빈 DB 위에서 돈다). `group` / `part` DELETE 루프와 "user row 는 삭제
        endpoint 가 없어 남긴다" 예외 주석은 유지.
  - [ ] 표본 로그 1 줄을 T-1666 동형으로 둔다 — **devset 필터 통과 총 건수**와 실제로 취한
        **표본 수**를 함께 찍는다(슬라이스 이전 건수가 곧 seed 완전성 신호). 로그에 email 원문 ·
        자격증명 · 경로는 싣지 않는다. 조건 없이 매 run 1 회(분기 0).
  - [ ] `SEED_PERSONS` 의 정규화 표현(`Math.max(1, Math.trunc(Number(__ENV.K6_SEED_PERSONS)) || 30)`)
        과 기본값 **`30` 은 무변경**. 의미가 "생성 인원" → "표본 상한" 으로 바뀐 사실은 **주석만**
        갱신한다(설계 ③ — 숫자 상향은 S2 첫 실측 이후 별도 판단, 본 task 에서 금지).
  - [ ] `options.thresholds` 의 임계 배열(전역 2 + route 별 4 종)에 **한 글자도 손대지 않는다**
        (설계 ⑤ — p95 3000ms 무변경).
- [ ] **`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` — 설계 ④ (a)~(g) 를
      같은 commit 에서 전부 반영**
  - [ ] (a) T-1623 블록의 `setup` 안 `http.post(` 개수 단언 `5` → **`4`**(group · part · signup ·
        login). 대체물로 `GET /api/persons` **1 회** 단언 + devset 도메인 필터 문자열 단언 +
        `filter → slice(0, SEED_PERSONS) → map` **단일 식** 정규식 단언을 추가한다.
  - [ ] (b) 같은 블록의 `S2_ROUTES` 3 종 route 문자열 단언은 **표현 무변경**(`/api/persons` 가 GET
        으로 남는다). "생성" 을 전제하던 주석 1 줄만 갱신.
  - [ ] (c) teardown 단언 2 종 갱신 — `http.del(` 개수 `3` → **`2`**, `${route}/` 포함 단언은
        **`groups` · `parts` 2 종으로 축소**. 추가로 **negative 단언 신설**: teardown 본문에
        `personIds` 와 person DELETE 반복문이 **잔존 0** 임을 못 박아 보존 계약 되돌림을 차단.
  - [ ] (d) parity 단언과 T-1634 블록의 정규화 표현 · 기본값 `30` parity 단언은 **표현 그대로
        유지**하고, 값의 의미가 바뀐 사실을 **주석만** 갱신.
  - [ ] (e) 리터럴 `"30"` 직접 대조 단언 3 곳과 `2088 행` 의 옛 취약 표현 금지 단언은 **전부
        무변경**.
  - [ ] (f) `__ENV.` 개수 `2` 단언 **무변경** — 새 env 키를 만들지 않았음이 이 단언으로 지켜진다.
  - [ ] (g) **신설 describe 블록 1 개**(T-1661 의 s1 판 `3278 행` 부근과 동형의 s2 판)를 추가하고,
        아래 R-112 4 종을 이 블록이 채운다.
- [ ] **R-112 test 4 종** (본 task 의 "public symbol" 은 `s2-read.js` 의 `setup` / `teardown` /
      `default` 와 devset 상수이며, k6 스크립트는 jest 런타임에서 실행되지 않으므로 기존 drift
      smoke 와 동일하게 **원문 파싱 단언**으로 cover 한다 — T-1661 · T-1666 선례 승계)
  - [ ] **happy-path 1+**: devset 도메인 리터럴 ↔ 정본
        (`realdata-devset-seed-descriptors.ts` 의 `DEVSET_EMAIL_DOMAIN`) **parity** 단언 +
        `setup()` 이 조회 1 회로 표본을 취하고 `personIds` 를 return 한다는 단언 +
        표본 로그 1 줄 존재 단언.
  - [ ] **error path 1+**: 도메인 상수가 정본과 어긋나면(조회가 0 건이 되어 부하가 조용히 빈 run
        이 되는 갈래) 단언이 red 가 됨을 대조군 문자열로 검증 + `SEED_PERSONS` 오입력 정규화
        표현이 잔존함을 검증(NaN 표본으로 0 행 위에서 p95 를 통과하는 착시 차단).
  - [ ] **분기 cover**: 표본 상한이 조회 결과보다 **많은 갈래 / 적은 갈래**를 같은 단일 식 하나가
        처리함(스크립트 쪽 분기 0)을 정규식으로 못 박고, 파싱 helper 쪽 분기(블록 종료 조건 ·
        대상 부재)는 기존 블록이 이미 cover 함을 확인한다.
  - [ ] **negative cases 충분 cover** — 각 1+ test: ① teardown 에 person DELETE 반복문 잔존 0
        (보존 계약 되돌림) ② `setup` 에 `POST /api/persons` 잔존 0 (합성 seed 회귀) ③ 단일 식이
        중간 변수 · `Math.min` · 조건 분기로 쪼개짐 0 ④ 새 `__ENV` 키 추가 0 ⑤ 로그에 email 원문 ·
        자격증명 · 경로 미포함 ⑥ 임계 배열 숫자 변경 0.
  - [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build && pnpm test` green — 특히 drift smoke spec 전체가 green
      (교체와 단언 갱신이 같은 commit 에 있어야 red 구간이 생기지 않는다).
- [ ] `git diff --name-only origin/main` 결과가 위 **2 파일뿐**임을 확인한다
      (`.github/workflows/load-k6.yml` 은 설계 ⑥ 이 **불요**로 확정 — 건드리면 scope 위반).

## Out of Scope

- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 갱신 — 설계 ⑥ 의 **두 번째 slice
  (`direct`)** 소관이다. 본 task 에 섞으면 CLAUDE.md §3.1 rule 3 위반.
- `.github/workflows/load-k6.yml` 변경 — 숫자 무변경 · 새 env 금지 · step 순서 충족이라 불요.
- `K6_SEED_PERSONS` 값 상향(예: `133`) — 설계 ③ 이 **S2 첫 실측 이후 별도 판단**으로 미뤘다.
- `load-k6.yml` dispatch 로 S2 실측을 뽑는 것 — **실 run 0**. 실측과 `§3.1` 회차 기록은 세 번째
  task 소관.
- `test/load/s3-concurrent.js` dataset 교체 — 설계가 "범위 밖" 으로 명시한 별도 slice.
- `§3` 표의 임계 숫자 변경(S1 축 900ms 포함) — T-1669 의 "무변경" 결론 그대로.

## Suggested Sub-agents

`implementer → tester` (설계가 T-1671 에서 이미 고정돼 architect 불요. tester 는 drift smoke
신설 블록의 R-112 4 종 작성 + `pnpm lint && pnpm build && pnpm test && pnpm test:cov` 실행).

## Follow-ups

(작성 시점 없음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
