---
id: T-1992
title: e2e 커버리지 census 매칭기 — 동적 시작 chain 까지 앵커 확대 (잔여 느슨함 소진)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 150
estimatedFiles: 2
estimatedLoc: 150
independentStream: route-e2e-census-matcher-precision
dependsOn: [T-1988, T-1989]
touchesFiles:
  [
    test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts,
    test/e2e/service-identities.e2e-spec.ts,
  ]
created: 2026-09-09
plannerNote: P5 · T-1988 Follow-ups 의 잔여 느슨함 — 동적 시작 chain 37/89 이 앵커 없이 남의 경로 꼬리를 빌릴 수 있다
---

# T-1992 — e2e 커버리지 census 매칭기: 동적 시작 chain 까지 앵커 확대

## Why

[T-1988](T-1988-e2e-census-matcher-adjacency-tightening.md) `## Follow-ups` 가 남긴 잔여 느슨함을 닫는다. 현행 [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `88~90 행` 의 `anchor` 는 **suffix 첫 segment 가 정적일 때만** chain 앵커(`prefix` 바로 뒤 또는 `FRESH` 자리)를 요구하고, 첫 segment 가 동적(`:id`)이면 앵커를 빈 문자열로 둔다. 그래서 그 chain 은 파일 안 어디에 붙어 있어도 — 남의 경로 꼬리 뒤여도 — 커버 근거가 된다.

**issue-still-relevant pre-check (origin/main `d569a039` 실측)**:

- 분기 잔존 — `anchor` 삼항의 `segments[0].startsWith(":") ? ""` 가 그대로 있다(위 `88 행`). 미해소.
- 영향 규모 — planner 가 helper [route-census.ts](../../test/helpers/route-census.ts) 로 실 census 를 돌린 결과 **route 89 개 중 37 개**의 suffix 가 동적 segment 로 시작한다(= 앵커 없이 판정되는 route 가 전체의 42%). e2e spec 39 개 · 현행 미커버 0 은 불변.
- 실제로 새는 사례 1 건 — 같은 스캐너로 앵커를 전 chain 에 적용하면 미커버가 `0 → 1` 이 되고 그 1 건이 `POST /api/persons/:personId/identities/:identityId/primary` 다. 현행 유일 근거는 [service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) `118 행` 한국어 주석의 `PATCH/DELETE/primary` **우연 매치**(planner 가 매칭 히트 위치까지 실측)라서, 주석 표현만 바뀌어도 census 가 red 가 되는 취약한 계약이다.
- 해소 경로 검증 — 같은 파일 `122~124 행` `primaryEndpointFor` 를 중첩 builder(`` `${identityEndpointFor(personId, identityId)}/primary` ``) 대신 `` `${endpointFor(personId)}/${identityId}/primary` `` 로 인라인하면 (**산출 문자열 동일**) 앵커를 전 chain 에 적용해도 그 route 가 다시 커버로 잡힌다 — planner 가 패치 소스를 정규식에 실제로 물려 `anchored-chain: false → true` 로 확인했다.

즉 e2e 표기 1 줄을 실 경로가 드러나게 바꾸고 매칭기 앵커를 전 chain 으로 확대하면, PLAN `166 행` 이 박제한 "미커버 0" 불변식이 **우연 매치가 아니라 실 경로 등장**을 근거로 서게 된다. 두 변경은 분리 시 census 가 red 이거나(앵커 먼저) 느슨함이 그대로라(e2e 먼저) CLAUDE.md §3 소비처 동반 의무로 한 PR 이다.

## Required Reading

- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) — 헤더 주석 `12~17 행`(매칭기 정밀도 서술), `46~50 행`(`CLOSED_BY_T1989`), `52~60 행`(`BOUNDARY`/`FRESH`/`DYNAMIC`), `64~92 행`(`isCoveredBy` 와 앵커 삼항), `171~216 행`(Flow 분기 (a)~(d)), `217~250 행`(T-1988 거짓 커버 negative).
- [test/e2e/service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) `114~125 행` — `endpointFor` · `identityEndpointFor` · `primaryEndpointFor` 3 builder.
- [test/helpers/route-census.ts](../../test/helpers/route-census.ts) — `RouteRecord`(`prefix`/`suffix`/`label`) 계약. 본 task 는 helper 를 **수정하지 않는다**.
- [docs/tasks/T-1988-e2e-census-matcher-adjacency-tightening.md](T-1988-e2e-census-matcher-adjacency-tightening.md) `## Follow-ups` — 본 task 의 출처 2 줄.
- [docs/PLAN.md](../PLAN.md) `166 행` — 본 census 가 지키는 E2E 커버리지 불변식.

## Acceptance Criteria

- [ ] `isCoveredBy` 의 앵커 삼항을 제거해 **모든 chain**(정적 시작 · 동적 시작 무관)이 `prefix` 바로 뒤 또는 `FRESH` 자리에서 시작하도록 요구한다.
- [ ] [service-identities.e2e-spec.ts](../../test/e2e/service-identities.e2e-spec.ts) 의 `primaryEndpointFor` 를 `` `${endpointFor(personId)}/${identityId}/primary` `` 로 인라인한다 — 산출 문자열은 종전과 **동일**해야 하며(기존 it 전부 무수정 통과), 왜 실 경로를 드러내는지 한국어 주석 1~2 줄로 남긴다.
- [ ] 실측 4 축 수치가 불변임을 spec 실행으로 확인 — controller 23 · route 89 · e2eSpecs 39 · covered 89, 미커버 **0 건 == 빈 allowlist**. `MIN` 재기준선과 allowlist 재도입은 하지 않는다.
- [ ] happy-path 1+ — 동적 시작 chain 이 **제 자리**(prefix 바로 뒤 또는 새 경로 조각 시작)에 있으면 여전히 커버로 잡힌다는 합성 입력 it.
- [ ] negative 1+ — 동적 시작 chain 이 **남의 경로 꼬리**(예: `/api/other/xyz/primary` 류) 에만 있으면 이제 커버가 아니라는 합성 입력 it. 종전 매칭기라면 true 가 되던 입력을 쓴다(회귀 감지력 자체 검증).
- [ ] negative 1+ — 주석 안 우연 매치(`PATCH/DELETE/primary` 형태의 슬래시 나열)가 더 이상 단독 근거가 되지 않는다는 합성 입력 it.
- [ ] 분기별 1+ — `suffix` 빈 문자열(prefix 만) · 정적 시작 chain · 동적 시작 chain · 접두 충돌(`BOUNDARY`) 각 축의 기존 it 이 새 앵커 아래에서도 통과하도록 유지 · 보강한다.
- [ ] error path 1+ — 기존 `Error path` describe(없는 디렉터리 · `@Controller` 부재 · 비-string)가 그대로 통과한다(helper 계약 승계, 새 흡수 분기 도입 금지).
- [ ] 헤더 주석 `12~17 행` 의 "동적 시작 chain 은 앵커 미적용" 서술을 현행 사실로 갱신하고, 기각으로 남아 있는 "전체 경로 통째 인접 매칭" 안의 기각 근거는 유지한다.
- [ ] [T-1989](T-1989-import-job-read-e2e-census-close.md) reviewer MINOR 이월분 — `CLOSED_BY_T1989` 에 `readonly string[]` 타입 표기를 붙인다(동작 영향 0, 같은 파일 nit).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:cov` 의 coverage 임계(line ≥ 80% / function ≥ 80%) 통과.
- [ ] production diff **0** — `src/` · `web/` · `package.json` · workflow 변경 없음.

## Out of Scope

- [route-census.ts](../../test/helpers/route-census.ts) helper 수정 — 스캐너 본체 · 정적 추출 정규식은 무접촉(두 census 공유 출처).
- guard 축 census([route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts))의 `KNOWN_GAP_REQ_043` 20 건 배선 — auth 변경이라 CLAUDE.md §5 오너 승인 대상.
- `MIN` 하한 재기준선 · allowlist 재도입 · 신규 e2e spec 신설.
- 신규 per-route perf baseline slice(PLAN `158 행` 오너 지시로 금지) 및 REQ status 재판정(PLAN `183 행`).
- `service-identities.e2e-spec.ts` 의 테스트 시나리오 · 단언 변경 — 경로 builder 표기 외 수정 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
