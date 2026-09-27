---
id: T-2025
title: persons guard 배선 선행 6 — k6 s3-concurrent.js 에 인증 부트스트랩 신설 + setup·teardown 표본 조회 cookie 선탑재
phase: P5
status: TODO
commitMode: pr
coversReq: [REQ-043, REQ-045, REQ-048, REQ-073]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-09-27
independentStream: q0056-persons-guard
dependsOn: [T-2024]
touchesFiles:
  [
    test/load/s3-concurrent.js,
    test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts,
  ]
hqOrigin: Q-0056
plannerNote: P5 · Q-0056 ① persons 선행 6 — T-2024 Follow-up ③c 를 둘로 쪼갠 앞 조각(부트스트랩 + 준비·정리 2 지점)
---

# T-2025 — k6 s3-concurrent.js 인증 부트스트랩 신설 + setup·teardown 표본 조회 cookie 선탑재

## Why

[PLAN.md](../PLAN.md) `157 행` 오너 최우선 지시(R-91 k6 부하검증) 아래 진행 중인 Q-0056 persons guard 배선 arc 의 선행 slice 다. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups` 이고, ①②(T-2020 ~ T-2022) 와 ③a·③b(T-2023 · T-2024) 가 머지돼 남은 조각은 ③c `s3-concurrent.js` 뿐이다. s3 는 셋 중 유일하게 인증 부트스트랩이 **아예 없어** signup → login → cookie 를 신설해야 하고, drift guard 가 s3 를 "auth-guarded prefix 0 · `/api/users` 0 · `/api/persons` 단일 route" 로 못박아 둔 단언 3 지점이 함께 깨진다. 한 PR 로는 cap 초과라 본 task 는 **부트스트랩 + 준비/정리 2 지점** 만 맡고, default function 의 persons 3 지점은 후속 slice(③c-2) 로 넘긴다.

이 선행이 끝나야 ④ persons guard 실배선 시점에 k6 시나리오 3 종이 401 로 무너지지 않는다.

## Required Reading

- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) — 머리 주석 규약 `5 행`(guard-free 전제), `31~32 행`(`SEED_PARAMS` · `TEARDOWN_PARAMS` tag), `setup()` 의 표본 조회 + `return` 블록, `teardown(data)` 의 표본 조회 블록.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `91~115 행` — signup → login → `authCookie` 부트스트랩의 선례 형태(분기 0 · stamp 자격증명 · `login.cookies["access_token"][0].value`).
- [test/load/s2-read.js](../../test/load/s2-read.js) `93~122 행` — 같은 부트스트랩을 표본 조회 **앞** 에 두고 지역 const 로 재사용하는 배치(T-2023 에서 확정).
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — `449 행` `GUARDED_PREFIXES` 정의와 `/api/users` 가 목록에서 빠진 이유, 깨질 단언 3 지점(`1414 행` negative (4) · `4624 행` `apiRoutesOf(script)).toEqual(["/api/persons"])` · `4637 행` negative (4)), 그리고 **그대로 green 을 유지해야 하는** 인접 단언(`4533 행` · `4683 행` route tag 집합, `4887 행` `S3_ROUTE_TAG_VALUES`, `5078 행` · `5338 행` 분기 토큰 · `||` 1 회 규약).
- [docs/tasks/T-2024-k6-s1-persons-cookie-preattach.md](T-2024-k6-s1-persons-cookie-preattach.md) `## Follow-ups` — ③c 의 원 지시와 "추정치를 넉넉히" 주의.

## Acceptance Criteria

- [ ] `test/load/s3-concurrent.js` 의 `setup()` 이 **표본 조회보다 앞** 에서 signup(`POST /api/users`) → login(`POST /api/auth/login`) → `access_token` cookie 문자열을 지역 const `authCookie` 로 조립한다. 자격증명은 매 run 새로 만드는 stamp 기반이고 고정 리터럴 · secret 은 0 이다.
- [ ] `setup()` 의 persons 표본 조회와 `teardown(data)` 의 persons 표본 조회가 각각 `Cookie: authCookie` / `Cookie: data.authCookie` 를 싣는다. `setup()` 의 반환 객체에 `authCookie` 가 포함되고 JSON 직렬화 가능한 형태만 유지된다.
- [ ] 인증 왕복(signup · login) 은 **판정 tag `read` · `write` 를 오염시키지 않는다**. 기존 준비 왕복 전용 tag(`route: "seed"`) 를 재사용해 `S3_ROUTE_TAG_VALUES`(`4887 행`) 4 값 집합과 `thresholds` 4 종이 문자 단위 그대로 남는다 — 새 tag 신설 · 새 임계 추가 0.
- [ ] 머리 주석 규약 ⑤(조건 분기 0) 유지 — 스크립트에 `if (` · `} else` · ` ? ` · ` && ` · `switch (` 토큰이 들어가지 않고 `||` 는 `__ENV` fallback 1 회 그대로다. 머리 주석 `5 행` 규약 ① 의 "guard-free 만 타격" 서술을 cookie 선탑재 사실에 맞게 갱신한다.
- [ ] drift guard 의 깨지는 단언 3 지점(`1414 행` · `4624 행` · `4637 행`) 을 같은 PR 에서 재정의한다: `banned` 목록에서 `/api/users` 를 빼되 **왜 정당한지**(signup 은 guard 없는 public endpoint — `449 행` 주석과 동형) 를 주석으로 남기고, `apiRoutesOf` 기대값을 `/api/auth/login` · `/api/persons` · `/api/users` 3 종으로 갱신한다. `GUARDED_PREFIXES` 3 종 금지는 유지한다.
- [ ] **happy-path** — 부트스트랩 배선을 직접 검증하는 positive 단언 1+ 추가: signup → login → cookie 조립이 표본 조회보다 **앞** 에 오는 순서, `setup()` 반환에 `authCookie` 포함, setup · teardown 두 표본 조회에 `Cookie` 헤더가 붙은 형태(정규식 단언).
- [ ] **error path / 예외 분기 negative** — 각 1+ 로 cover: (a) 부트스트랩이 표본 조회 **뒤** 로 밀린 합성 본문이 red 가 된다, (b) `Cookie` 헤더를 뗀 합성 본문이 red 가 된다, (c) `GUARDED_PREFIXES` 조회가 섞인 합성 본문이 red 가 된다, (d) 판정 tag(`read`/`write`) 로 인증 왕복이 새는 합성 본문이 red 가 된다, (e) 조건 분기를 끼운 합성 본문이 red 가 된다. 각 negative 는 대조군(변조본 ≠ 원본) 을 동반해 tautology 가 아님을 보인다.
- [ ] **분기별 test** — 본 slice 가 추가하는 spec helper 에 분기가 생기면 분기마다 test 1+. 분기를 추가하지 않았으면 task `## Follow-ups` 에 "분기 없음 — 이 항목 생략" 을 명시한다.
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` green (특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 전건).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 파일은 `touchesFiles` 2 개를 넘지 않는다.

## Out of Scope

- `export default function` 의 persons 3 지점(생성 POST · 목록 GET · 삭제 DELETE) cookie 부착 — 후속 slice ③c-2 책임.
- ④ persons guard 실배선(`person.controller.ts` 등) — ③c 완결 뒤.
- `route: "auth"` 같은 **새 tag 신설** 과 새 임계 추가 — 판정면 변경 0 규약(ADR-0054 §3 재산정 0) 유지.
- `docs/ops/load-resilience-test-plan.md` · `test/perf/README.md` 의 "cookie 없이 측정" 전제 doc-sync — [T-2022](T-2022-persons-realdb-perf-cookie-preattach.md) `## Follow-ups` 가 예약한 ④ 머지 후 direct doc-only slice 로 한 번에.
- `load-k6.yml` workflow · `package.json` script 변경.
- s1-batch.js · s2-read.js 재손질.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (planner, arc 계획 — Q-0056 persons 축 잔여) 본 task 머지 후 **③c-2**: `s3-concurrent.js` `export default function` 의 persons 3 지점(`http.post` 생성 · `http.get` 목록 · `http.del` 삭제)에 `data.authCookie` 를 싣는다. `WRITE_PARAMS` 는 이미 `headers` 를 쓰므로 병합 형태에 주의하고, drift guard 의 본문 정규식 단언(생성 · 목록 · 삭제 왕복 형태를 고정한 것들)이 함께 갱신 대상인지 착수 전에 센다. 그 뒤 ④ persons guard 실배선. 정본 순서는 [T-2020](T-2020-persons-guard-precursor-cookie-preattach.md) `## Follow-ups`.
