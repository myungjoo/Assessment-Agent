---
id: T-1683
title: S3 행 수 로그 배선(T-1682)을 계획 문서와 PLAN 에 동기
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 80
estimatedFiles: 2
size: S
created: 2026-08-25
createdAt: 2026-08-25T00:40:00Z
independentStream: load-harness-r91
dependsOn: []
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
plannerNote: PLAN 141 행 R-91 chain 63/N — T-1682 Follow-up ①(코드→문서 split 뒷단), doc-only 2 파일 · 새 dispatch 0
---

# T-1683 — S3 행 수 로그 배선(T-1682)을 계획 문서와 PLAN 에 동기

## Why

[T-1682](T-1682-s3-persons-row-count-log.md)(PR #1336 → main `a5f84cb1`)가 [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 에 `setup()` · `teardown()` 각 1 회의 `GET /api/persons` **행 수 로그**를 배선했는데, 계획 문서 축은 **그 이전 상태 그대로** 남아 있다. 구체적 drift 는 세 군데다 — ① `§2` `### S3. 동시 요청 내성` 에는 행 수 로그 계약이 **한 줄도 없다**(S2 는 `§2` `86~94 행` ② 에 같은 계약을 박제해 뒀다), ② `§3.1` `#### S2 2 회차` 의 `945~947 행` 은 "행 수를 직접 찍는 **로그가 없어** … 직접 검증은 S3 leg 에 표본 로그를 심는 **별도 slice 소관**" 이라 적혀 있는데 그 slice 는 이미 끝났다, ③ `§3.1` `#### S3 1 회차` 의 `1014~1020 행` 은 자기정리 판정 근거로 `http_reqs` **22752** = `iterations` **7584** × **3** 배수 관계를 쓰는데, 배선 후로는 항등식이 `3 × iterations + 2` 라 **다음 회차 분석자가 그대로 적용하면 오판**한다. ②·③ 은 다음 dispatch 판단을 잘못 유도할 수 있는 **규범 서술**이라 이력 분류로 방치할 수 없다([T-1679](T-1679-not-cancelled-gate-doc-sync.md) 가 `817 행` 을 무효화 표기로 닫은 선례 동형). 본 slice 는 코드→문서 split 의 **뒷단**이며 [CLAUDE.md §3.1](../../CLAUDE.md) rule 1 에 따라 `direct` 다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `160~167 행` `### S3. 동시 요청 내성 (Resilience)` — 편집 대상 ①. 현재 부하 · 목표 · 관찰 3 bullet 뿐이고 행 수 로그 계약이 없다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `86~94 행` `**② 공유 dataset 보존 계약**` — S2 가 같은 성격의 로그 계약을 어떤 문장 톤(무엇을 왜 찍는가 · 민감값 0 · 수치만)으로 박제했는지의 **서식 정본**. **읽기만 하고 편집하지 않는다**(S2 dataset 교체 설계는 이미 집행 완료 이력이다).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `938~977 행` `#### S2 2 회차` 의 보존 계약 bullet + 꼬리 `(c)` 회수 완료 표기 — 편집 대상 ②. 특히 `975~977 행` 의 `**[회수 완료 (T-1681) — …]**` 대괄호 표기가 **이력 보존 + 현행 pointer** 를 동시에 만족시키는 정본 서식이다. 본 slice 는 `945~947 행` 에 같은 서식을 적용한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `1014~1024 행` `#### S3 1 회차` 의 `**write leg 자기정리 확인**` bullet + `**§3 표 S3 축 무변경 판정**` — 편집 대상 ③. `http_reqs` 배수 관계와 "잔여 0 을 단정하지 않는다" 서술의 정확한 문장을 확인한다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `1191~1210 행` 부근 `§5` item 5 꼬리(T-1680 · T-1681 집행 문단) — 편집 대상 ④. 새 문단은 이 뒤에 append 하며 앞 문단의 서술 톤 · 링크 표기를 승계한다.
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — T-1682 가 실제로 박제한 로그 prefix 문자열 · route tag 이름 · 항등식 주석의 **원문 확인용**. 문서에 옮겨 적는 값은 반드시 이 파일에서 읽은 그대로여야 한다(추정 · 재구성 금지). **읽기만 한다.**
- [docs/PLAN.md](../PLAN.md) `140~141 행` — 편집 대상 ⑤. `141 행` 꼬리에 1~2 문장 append 하며, `140 행` checkbox 는 조건(LLM stub · 실 수집 왕복 0) 불변이라 `[ ]` 유지다.

## Acceptance Criteria

- [ ] `§2` `### S3. 동시 요청 내성 (Resilience)` 에 **행 수 로그 계약** 서술을 추가한다(bullet 1 개 또는 짧은 문단 1 개). 담을 사실은 ⓐ `setup()` 이 S3 시작 시점의 `GET /api/persons` 행 수를, `teardown()` 이 종료 시점 행 수와 시작 행 수를 각 1 줄로 찍는다 ⓑ 준비/정리 왕복은 판정 tag `read` / `write` 와 **겹치지 않는 별도 route tag** 라 p95 오염이 0 이다 ⓒ 로그에는 **수치만** 싣고 email 원문 · 자격증명 · `/api/` 경로 리터럴은 싣지 않는다(T-1666 규약 승계) — 세 항목 모두 [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 원문에서 확인한 값으로 적는다.
- [ ] `§3.1` `#### S2 2 회차` 의 `945~947 행` "행 수를 직접 찍는 로그가 없어 … 별도 slice 소관" **규범 서술**에 `**[배선 완료 (T-1682) — …]**` 대괄호 표기를 부여한다. 원 문장은 **삭제하지 않고 이력으로 보존**하고, 대괄호 안에는 ⓐ T-1682(PR #1336 → main `a5f84cb1`)가 배선을 끝냈다는 사실 ⓑ 따라서 **다음 dispatch 부터** 133 행 잔존이 정황(`data_received`)이 아니라 **직접 카운트**로 회수된다 ⓒ 본 회차(run 32780975839)의 로그에는 그 줄이 **존재하지 않는다**(배선 이전 run) 는 사실을 적는다.
- [ ] `§3.1` `#### S3 1 회차` 의 `**write leg 자기정리 확인**` bullet 에 항등식 pointer 를 **1~2 줄** 추가한다 — 본 회차의 `http_reqs` **22752** = `iterations` **7584** × **3** 은 배선 **이전** 값이며, T-1682 이후 run 에서는 `3 × iterations + 2`(setup · teardown 각 1 왕복) 이므로 **같은 배수식을 다음 회차에 그대로 적용하면 안 된다**는 사실. 본 회차의 **수치 22752 · 7584 · 0.00% 는 한 글자도 바꾸지 않는다**.
- [ ] `§5` item 5 꼬리(T-1681 문단 뒤)에 **T-1682 집행 문단 1 개**를 append 한다 — 배선 대상 2 파일(`test/load/s3-concurrent.js` · drift-guard smoke spec), PR #1336 → main `a5f84cb1`, drift-guard `T-1682` describe **12 케이스**(R-112 4 종), **새 dispatch 0 이라 실측 회차는 증가하지 않음**(S1 12 · S2 2 · S3 1 유지) 을 담는다.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 위 사실을 **1~2 문장**으로 append 한다. **실측 회차 개수 표기(총 12 회 / 실 scale dispatch 10 회 / 수치 회수 9 회)는 무변경**이고, `140 행` checkbox 는 `[ ]` 유지다.
- [ ] `§3` 임계 표 · `§3.1` 각 회차의 **측정 수치** · `§2` S2 dataset 교체 설계(`67~159 행`) · `§4` 는 **문자 단위 0 변경**이다. 편집 후 `git diff` hunk 좌표로 이를 확인해 그 사실을 완료 요약에 적는다([CLAUDE.md §12](../../CLAUDE.md) 소급 치환 금지 · 규칙 ③ 승계).
- [ ] 변경 파일은 **정확히 2 개**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`), diff ≤ 300 LOC. 3 번째 파일이 필요하다고 판단되면 Follow-ups 로 넘긴다.
- [ ] production code 0 LOC 인 doc-only 변경이라 [CLAUDE.md §3.2](../../CLAUDE.md) R-110 은 면제다. 확인용으로 `pnpm lint` 만 돌려 무경고임을 본다(`test` · `build` 는 불요 — 코드 · spec 변경 0).

## Out of Scope

- **워크플로 dispatch 일체** — `gh workflow run` · rerun · 재시도 **0**. 행 수 로그의 **실 수치 회수**는 다음 측정 slice 소관이며, 본 slice 는 문서 축 drift 만 닫는다.
- `test/load/*` · `test/smoke/*` · `.github/workflows/load-k6.yml` · `package.json` 편집(원문 확인용 **읽기만**).
- `§3` 임계 표의 어떤 값도 재산정 · fix 하지 않는다(표본 1 회 — T-1668 2 단계 규칙 승계). S3 축 `latency cliff 부재` · error rate 판정도 무변경.
- `§3.1` 기존 회차 소절의 **수치 · 판정 문장 재작성**(추가하는 것은 pointer 표기뿐이며 이력은 보존).
- `K6_SEED_PERSONS` 30 → 133 상향 판단(Follow-ups ①), 단계별 percentile export step(Follow-ups ②).
- `docs/STATE.json` · journal 편집(driver 소관).

## Suggested Sub-agents

`implementer`

## Follow-ups

- ① `K6_SEED_PERSONS` 30 → 133 상향 판단 (T-1682 Follow-up ② 승계) — S2 2 회차가 설계 ③ 을 실증했으므로 상향의 실익 유무를 판단해 문서/워크플로 동기.
- ② 단계별 percentile export step (T-1682 Follow-up ③ 승계) — 현 k6 기본 요약으로는 latency cliff 단계 분해도 `p99` 회수도 불가.
