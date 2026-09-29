---
id: T-2026
title: persons guard 배선 선행 7 — k6 s3-concurrent.js default function 의 persons 3 왕복에 cookie 선탑재
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-09-29
independentStream: q0056-persons-guard
dependsOn: [T-2025]
touchesFiles:
  [
    test/load/s3-concurrent.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons 선행 7 — T-2025 Follow-up ③c-2(default function persons 3 지점) 큐잉
---

# T-2026 — k6 s3-concurrent.js default function persons 3 왕복 cookie 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시(R-91 k6 부하검증) 아래 진행 중인 Q-0056 persons guard 배선 arc 의 **마지막 선행 slice** 다. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups`, 직전 지시는 [T-2025](T-2025-k6-s3-auth-bootstrap.md) `## Follow-ups` 의 **③c-2** 다. T-2025 가 `setup()` 에 인증 부트스트랩을 신설하고 setup · teardown 표본 조회 2 지점에 cookie 를 실었으므로, 남은 것은 실제 판정 표본을 만드는 `export default function` 의 persons 3 왕복(생성 `http.post` · 목록 `http.get` · 삭제 `http.del`) 뿐이다.

issue-still-relevant pre-check (planner, 2026-09-29): `origin/main` 의 [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 최신 commit 은 `57502dc7`(T-2025) 이고, `Cookie` 문자열이 박제된 지점은 `128 행`(setup 표본 조회) · `137 행`(return) · `177 행`(teardown 표본 조회) **셋뿐**이다. `140~168 행` default function 에는 `authCookie` · `Cookie` 토큰이 0 이라 본 task 의 의도는 main 에 미안착 — 착수 유효. 최근 owner commit(PLAN `157 행` · `158 행`)은 k6 축 착수를 **촉구**하고 per-route perf churn 만 금지하므로 본 slice 를 무효화하지 않는다.

이 slice 가 머지되면 ④ persons guard 실배선 시점에 k6 시나리오 3 종(s1 · s2 · s3) 전부가 401 없이 돌고, `http_req_failed rate<0.01` 임계가 인가 실패로 오염되지 않는다.

## Required Reading

- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — `27~32 행`(`WRITE_PARAMS` 는 `headers` 보유 · `DELETE_PARAMS` · `READ_PARAMS` 는 `headers` 부재), `64~69 행`(`withStage(params, startedAt)` 의 `Object.assign` 2 단 병합 · 분기 0), `102~137 행`(`setup()` 의 부트스트랩과 `return { startRows, startedAt: Date.now(), authCookie }`), `140~168 행`(default function 의 persons 3 왕복 + `STAGE_TRENDS[...].add`), `5~10 행`(머리 주석 규약 ①~⑤).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `184 행` · `195 행` — `data.authCookie` 를 기존 `headers` 에 **병합**하는 선례 형태(`{ "Content-Type": "application/json", Cookie: data.authCookie }`, 분기 0).
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — **본 변경으로 깨지는 단언 2 지점**: `5138~5140 행`(T-1689 block) 과 `5425~5427 행`(T-1691 block) 의 `expect(...).toContain(\`withStage(${params}, data.startedAt)\`)` 리터럴 3×2. 그대로 green 을 유지해야 하는 인접 단언: `1274~1291 행`(baseline body token 목록 + `tags: { route: "read" }` · `"write"` 리터럴), `1414~1425 행`(negative (4) `banned` — `Authorization` · 분기 토큰 금지, `/api/users` 는 T-2025 가 이미 제외), `5101 행`(`S3_ROUTE_TAG_VALUES` 4 값), `4724 행~`(T-2025 block 의 cookie 선탑재 단언군), `5160~5163 행` · `5421~5424 행`(임계 4 종 · `p(95)<3000` 3 회 · `rate<0.01` 1 회 판정면).
- [docs/tasks/T-2025-k6-s3-auth-bootstrap.md](T-2025-k6-s3-auth-bootstrap.md) `## Follow-ups` — ③c-2 의 원 지시("`WRITE_PARAMS` 는 이미 `headers` 를 쓰므로 병합 형태에 주의").

## Acceptance Criteria

- [ ] `test/load/s3-concurrent.js` 의 `export default function` 이 persons 3 왕복(생성 `http.post` · 목록 `http.get` · 삭제 `http.del`) 모두에 `data.authCookie` 를 `Cookie` 헤더로 싣는다. `WRITE_PARAMS` 의 기존 `Content-Type` 헤더는 **덮이지 않고 병합**되며(s1-batch `184 행` 동형), `headers` 가 없던 `READ_PARAMS` · `DELETE_PARAMS` 에도 `Cookie` 만 담긴 `headers` 가 생긴다.
- [ ] 모듈 수준 `WRITE_PARAMS` · `READ_PARAMS` · `DELETE_PARAMS` 원본 객체는 **변형(mutate)되지 않는다** — cookie 병합은 `withStage` 와 동형인 `Object.assign` 사본 경로로만 하고, VU 별 공유 상태 오염이 없음을 주석 1 줄로 남긴다.
- [ ] 단계 tag 축(T-1689) · 단계별 Trend 기록(T-1691) 경로가 보존된다: 3 왕복이 여전히 요청에 실제로 붙은 `tags[STAGE_TAG_KEY]` 값으로 `STAGE_TRENDS[...].add(...)` 를 호출하고, `stageTagOf(` 재호출은 default function 안에 0 이다.
- [ ] 판정면 0 변경: `route` tag 값 집합 4 종(`read` · `write` · `seed` · `teardown`) 과 `thresholds` 4 종이 문자 단위 그대로다. 새 tag · 새 임계 · `Authorization` 헤더 0.
- [ ] 머리 주석 규약 ⑤(조건 분기 0) 유지 — 스크립트에 `if (` · `} else` · ` ? ` · ` && ` · `switch (` 토큰이 들어가지 않고 `||` 는 `__ENV` fallback 1 회 그대로다. 머리 주석 `5~8 행` 의 "persons 표본 왕복에는 cookie 를 선탑재" 서술을 **판정 표본 3 왕복까지 포함**하도록 갱신한다.
- [ ] 깨지는 drift guard 단언 2 지점(`5138~5140 행` · `5425~5427 행`)을 같은 PR 에서 재정의한다 — 새 중첩 호출 형태를 리터럴로 고정하고, 왜 3 왕복이 cookie 병합 사본을 받는지(persons guard 실배선 뒤 401 차단) 주석 1 줄을 남긴다. 단계 tag 배선 검증력은 약화시키지 않는다(`[STAGE_TAG_KEY]:` 및 `data.startedAt` 전달 확인 유지).
- [ ] **happy-path** — 부착 사실을 직접 검증하는 positive 단언 1+ 추가: default function 본문에서 `http.post` · `http.get` · `http.del` 각 왕복이 `data.authCookie` 를 싣는 형태(정규식 단언) + `WRITE_PARAMS` 경로에서 `Content-Type` 과 `Cookie` 가 **함께** 살아있음.
- [ ] **error path / 예외 분기 negative** — 각 1+ 로 cover: (a) 3 왕복 중 하나라도 `Cookie` 가 빠진 합성 본문이 red 가 된다, (b) `Content-Type` 이 `Cookie` 로 덮인 합성 본문이 red 가 된다, (c) 원본 params 를 직접 mutate 하는 합성 본문이 red 가 된다, (d) `STAGE_TRENDS[...].add` 가 요청에 붙지 않은 tag 값을 쓰는(= 단계 축이 갈리는) 합성 본문이 red 가 된다, (e) 판정 tag(`read`/`write`) 또는 임계가 변형된 합성 본문이 red 가 된다, (f) 조건 분기를 끼운 합성 본문이 red 가 된다. 각 negative 는 대조군(변조본 ≠ 원본) 을 동반해 tautology 가 아님을 보인다.
- [ ] **분기별 test** — 본 slice 가 추가하는 spec helper 에 분기가 생기면 분기마다 test 1+. 분기를 추가하지 않았으면 task `## Follow-ups` 에 "분기 없음 — 이 항목 생략" 을 명시한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` green (특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전건 — T-1625 · T-1682 · T-1689 · T-1691 · T-2025 block 모두).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일은 `touchesFiles` 2 개를 넘지 않는다.

## Out of Scope

- ④ persons guard 실배선(`src/**/person.controller.ts` 등 `@UseGuards` 부착) — 본 선행 chain 완결 뒤 별 slice.
- `route: "auth"` 같은 **새 tag 신설** · 새 임계 추가 · `summaryTrendStats` 변경 — 판정면 재산정 0 규약(ADR-0054 §3) 유지.
- `docs/ops/load-resilience-test-plan.md` · `test/perf/README.md` 의 "cookie 없이 측정" 전제 doc-sync — [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) `## Follow-ups` 가 예약한 ④ 머지 후 direct doc-only slice 로 한 번에.
- `.github/workflows/load-k6.yml` · `package.json` script 변경.
- s1-batch.js · s2-read.js 재손질, s3 의 `setup()` · `teardown()` 블록 재손질(T-2025 가 이미 닫음).
- 실 k6 run 발화(부하 job 은 수동 발화 전용) 및 baseline 수치 갱신.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner 판정, §3 소비처 동반 의무) 본 slice 는 helper 신설이 아니거나 신설해도 **같은 PR 안에서 3 왕복 소비처를 전부 배선**하므로 하한 충족 — 별 소비처 slice 예약 없음.
