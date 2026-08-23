---
id: T-1665
title: seed fix 머지 후 재 dispatch 실측 — load-k6 를 s1_persons=133 으로 1 회 재실행해 8 회차 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T19:40:00Z
completedAt: 2026-08-23T20:58:00Z
dependsOn: [T-1664]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 47/N — T-1664 fix 머지 후 s1_persons=133 재 dispatch 1 회로 T-1663 이 회수 실패한 3 축을 8 회차로 실측."
---

# T-1665 — seed fix 머지 후 재 dispatch 실측 (`s1_persons=133`, 8 회차)

## Why

[T-1663](T-1663-load-k6-devset-seeded-run.md) 의 첫 실 dataset run (`load-k6.yml` run `32652307813`) 은 `133 로그인 실 dataset seed 적재` step 이 ``Argument `person` is missing.`` 로 죽어 **① 적재 인원 수 ② `setup()` 의 적재분 조회 소비 경로 ③ S1 THRESHOLDS 수치** 3 축을 전부 회수 실패로 남겼다. 그 결함은 [T-1664](T-1664-devset-seed-identity-create-person-fix.md) (PR #1330 → main `61f616a1`) 가 `resolveRealDataPersonId` 에서 `create.personId` 를 배선해 닫았고, T-1663 Follow-ups 3 번이 "수정 머지 후 `-f s1_persons=133` 재 dispatch 1 회" 를 명시적으로 남겨두었다.

본 slice 는 오너 지시 (PLAN `144 행` "R-91 k6 최우선·즉시 착수") chain 47/N 으로, 스크립트·워크플로 변경 0 인 **순수 측정 + doc-sync** 다 (T-1663 과 같은 형식). 실측 결과를 [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 8 회차 · `§5` item 5 잔여 ① · [docs/PLAN.md](../PLAN.md) `141 행` 에 박제한다. 결함이 또 나와도 **본 slice 에서 고치지 않고 기록만 하고 후속 slice 로 넘긴다** (T-1647 · T-1663 선례).

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — input `s1_persons` 정의 (default `"10"`), T-1659 툴체인 3 step, `114 행` 근처 `133 로그인 실 dataset seed 적재` step (`run: pnpm seed:devset-logins`), S1 실행 step, "S1 실측 요약 기록" step (`if: always()` · `tee -a` 환경 메타 7 항목).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `setup()` — T-1661 이 바꾼 (c) 단계 (`GET /api/persons` + `@load.devset.test` 접미사 필터 · 표본 수만큼 취하기) 와 표본 부족 시 동작. `STUB_BASELINE_PERSONS = 133` · `STUB_BASELINE_P95_MS = 900` 조건부 임계 (T-1645) 도 함께 확인 — 실측 해석의 근거. **읽기만.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `128 행` `§3.1` 헤더 (`baseline 실측 기록 (S1, 7 회분)` — 본 slice 가 `8 회분` 으로 갱신) + `347~402 행` 7 회차 소절 (본 slice 가 같은 형식으로 8 회차를 덧붙일 자리) + `§5` item 5 의 잔여 ① 문단 (`486~503 행` 부근 — "seed 실행 성공 0 회 · 결함 1 건 수정 대기" 서술을 본 실측 결과로 갱신할 대상).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — REQ-047 checkbox 와 R-91 실측 상태 서술 (본 slice 가 `141 행` 꼬리에 8 회차 문장을 덧붙일 자리), `144 행` 오너 지시.
- [docs/tasks/T-1663-load-k6-devset-seeded-run.md](T-1663-load-k6-devset-seeded-run.md) `## Follow-ups` — 본 slice 가 집행하는 3 번 항목 (회수 실패 3 축의 정의).
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `## seed 실행 경로` 절 — T-1662 가 박은 배선 좌표. **읽기만 하고 편집하지 않는다** (`§A`/`§B` 표는 drift guard 파싱 대상).

## Acceptance Criteria

- [ ] `gh workflow run load-k6.yml --ref main -f s1_persons=133` 으로 **정확히 1 회** dispatch 하고 run id 를 확보한다 (`gh run list --workflow=load-k6.yml --limit 3`). 재 dispatch · 재시도 금지 — 실패해도 그 사실 자체를 실측 결과로 기록한다. dispatch 시각 · head sha 를 함께 기록한다.
- [ ] run conclusion 을 확인한다 (`gh run view <id>` 또는 `gh run watch <id>`). **45 분** 초과 미종료면 대기를 중단하고 그 시점의 진행 중 step 이름과 함께 기록한다.
- [ ] `gh run view <id> --log` 에서 **`133 로그인 실 dataset seed 적재` step 의 conclusion 과 출력**을 회수한다 — T-1664 fix 로 이 step 이 실제로 통과하는지가 본 회차의 1 순위 관측 대상이다. 적재 인원 수를 인용하고, 여전히 fail 이면 에러 메시지 원문 (secret · `DATABASE_URL` 값 제외) 을 그대로 기록한다.
- [ ] S1 실행 로그에서 **`setup()` 이 적재분을 조회해 썼는지** 확인한다 — `GET /api/persons` 로 얻은 표본 인원 수가 `133` 인지, 부족하면 몇 명이었는지. `POST /api/persons` 로 합성 인원이 생성된 흔적이 있으면 T-1661 배선 결함으로 기록한다.
- [ ] k6 `THRESHOLDS` 블록에서 `http_req_duration{route:batch}` 임계가 **2 개** (`p(95)<3600000` 판정 임계 + `p(95)<900` stub baseline 게이트) 로 나타나는지와 각 `✓`/`✗` 를 그대로 인용한다. `http_req_failed` · `iteration_duration` 수치도 함께 회수한다.
- [ ] 위에서 batch p95 를 회수했다면 **실 scale 표본 5 개** (3~6 회차 760.91 · 730.81 · 711.23 · 792.27 + 본 회차) 의 평균 · 범위 · 표본표준편차 · 변동계수 · 평균 + 3σ 를 재계산하고, `900ms` 임계 **재확정 필요 여부** 를 명시 판정한다 (평균 + 3σ ≤ 900ms 면 재확정 불요). 회수 실패면 "표본 4 개 그대로 · 재확정 불요" 를 그 사유와 함께 적는다.
- [ ] "S1 실측 요약 기록" step 의 환경 메타 7 항목을 회수해 3~7 회차와 동일 조건인지 대조 기록한다 (다르면 어느 항목이 어떻게 다른지).
- [ ] [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3.1` 에 **8 회차 소절** 을 7 회차와 같은 형식 (run id · head sha · conclusion · seed step 결과 · setup 소비 경로 · THRESHOLDS 인용 · 기술통계 · 환경 메타 · 의미/한계) 으로 추가하고, `128 행` 헤더의 `7 회분` 을 `8 회분` 으로 갱신한다.
- [ ] 같은 문서 `§5` item 5 의 **잔여 ①** 을 본 실측 결과로 갱신한다 — seed step 이 통과했으면 "seed 실행 성공 0 회" 서술을 실제 성공 run id 기준으로 고치고, 남은 미검증 축 (LLM stub · 수집 왕복 0 · 단일 iteration) 은 그대로 유지한다. 잔여 ② · ③ 표기는 무변경.
- [ ] [docs/PLAN.md](../PLAN.md) `141 행` 꼬리에 8 회차 결과 1~3 문장을 덧붙인다 — run id · seed step 결과 · 회수한 수치 (또는 회수 실패 사유) · checkbox 유지 근거. **`140 행` checkbox `[ ]` 는 무변경** (LLM stub · 수집 왕복 0 · 단일 iteration 조건이 그대로면 REQ-047 완료 조건 미달).
- [ ] 문서에 적는 run id · sha · 수치는 전부 `gh run view` 실 출력에서 인용한 값이어야 한다 — 추정치 · 허구 SHA 0.
- [ ] `pnpm test` green (drift guard `realdata-devset-logins-doc-consistency.spec.ts` 가 `RangeError` 없이 통과 = `§A`/`§B` 표 무변경 확인). doc-only direct 라 PR · reviewer 미경유 (§3.1).
- [ ] 변경 파일 **2 개** (`load-resilience-test-plan.md` · `PLAN.md`) 유지. 3 번째 파일 수정이 필요하다고 판단되면 Follow-ups 로 넘긴다.

## Out of Scope

- **코드 · 워크플로 변경 0** — `test/load/*.js` · `.github/workflows/load-k6.yml` · `scripts/seed-devset-logins.ts` · `test/helpers/realdata-*` 수정 금지. 본 slice 는 순수 측정 + doc-sync 다 (`commitMode` 가 갈리므로 §3.1).
- **실측에서 발견한 결함의 수정 금지** — 기록만 하고 Follow-ups 로 넘긴다 (T-1647 · T-1663 선례).
- **2 회 이상 dispatch 금지** — 표본 오염 방지. 1 회 결과가 곧 8 회차다.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 편집 — `§A`/`§B` 표는 drift guard 파싱 대상이라 편집 금지.
- `§3` 임계 표의 숫자 변경 — 재확정 판정만 문서에 적고, 실제 숫자 변경이 필요하다는 결론이 나오면 별도 slice.
- `s2-read.js` / `s3-concurrent.js` 의 devset dataset 교체 · S2/S3 실측.
- `realdata-devset-seed-identity-upsert-runner.ts` 의 `flattenPlan` placeholder 결손 가드 추가 (T-1664 Out of Scope 승계).
- `deploy/daily-test.sh` leg 추가 — drift-guard smoke 3 종 동반으로 cap 초과 (T-1122 / Q-0054 선례).

## Suggested Sub-agents

`implementer` (측정 + doc-sync) → `tester` (`pnpm test` drift guard 확인)

## Follow-ups

1. **`s1-batch.js` `setup()` 표본 인원 수 로그 1 줄 추가** (pr-mode) — 8 회차에서 seed 적재 수(133)와 `http_reqs` 7 로 **간접** 확인은 됐지만 `setup()` 이 실제로 취한 표본 수를 직접 찍는 로그가 없어 회차마다 간접 추론이 필요하다. `console.log` 1 줄(`personIds.length`)이면 이후 모든 회차가 직접 회수된다. R-112 대상은 스크립트라 spec 부재 — 워크플로 dry-run 으로 검증.
2. **실 수집 왕복 축(`§5` item 5 잔여 ① 의 남은 내용)** — 133 건 `ServiceIdentity` 는 적재됐으나 부하 job 에 GitHub/Confluence 자격증명이 없어 50~100 repo · ~1000 page 왕복이 여전히 0 이다. 자격증명 주입은 CLAUDE.md §5 의 BLOCKED 사유(외부 자격증명)라 **오너 결정이 선행**돼야 한다 — 별도 planner slice 에서 humanQuestion 으로 올릴지 stub 수집기로 대체할지 판정.
