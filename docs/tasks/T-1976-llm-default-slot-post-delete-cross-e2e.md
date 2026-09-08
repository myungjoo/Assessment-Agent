---
id: T-1976
title: 기본 슬롯 존재 상태의 POST · DELETE 교차 계약 + T-1975 잔여 2 건 e2e 고정
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051, REQ-043]
estimatedDiff: 250
estimatedFiles: 1
dependsOn: [T-1975]
touchesFiles: [test/e2e/llm-provider-configs.e2e-spec.ts]
independentStream: llm-provider-config-e2e
created: 2026-09-08
plannerNote: P5 · T-1975 Follow-up 2 건 + POST/DELETE describe 의 슬롯 seed 0 — 기본 슬롯 잔존 계약이 e2e 미고정
---

# T-1976 — 기본 슬롯 존재 상태의 POST · DELETE 교차 계약 + T-1975 잔여 2 건 e2e 고정

## Why

T-1975(PR #1549 → main squash `70d20c18`)가 "기본 슬롯이 걸린 row 를 `PATCH` 할 때 파생·슬롯이 유지되는가" 를 닫으면서 provider config 6 route 의 단일 route 계약 + PATCH × 슬롯 교차가 e2e 로 고정됐다. 남은 공백은 **같은 "슬롯 존재" 상태를 나머지 두 쓰기 route(`POST` 생성 · `DELETE` 비기본 row)가 흔들지 않는가** 이고, 여기에 T-1975 가 §3 300 LOC cap 때문에 `Follow-ups` 로 넘긴 2 건이 붙는다. 둘을 한 slice 로 묶는 이유는 절단면이 diff 크기가 아니라 상태 축(**기본 슬롯이 seed 된 fixture**)으로 같기 때문이다(PLAN `182 행` 소비처 동반·과분할 차단 지시 정합) — 잔여 2 건만 따로 큐잉하면 30 LOC slice 1 건이 된다.

issue-still-relevant pre-check(origin/main `de636b79` 기준, 명령과 실측치 그대로 박제):

- `git grep -n "llmDefaultProvider.create" origin/main -- test/e2e/llm-provider-configs.e2e-spec.ts` → **3 hit(`390`·`429`·`1461 행`)뿐**. 즉 슬롯을 실제로 seed 하는 곳은 T-1970 describe 2 곳(GET 파생 분기 · DELETE 409)과 T-1975 describe 1 곳이 전부다.
- POST describe 구간(`575~845 행`)에서 `llmDefaultProvider` 매칭은 `621 행` `afterEach` 의 `deleteMany` **1 줄뿐** — 슬롯이 이미 존재하는 상태에서 새 config 를 생성하는 조합이 e2e 에 **0** 이다. 구현은 [`llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `203 행` `return this.sanitize(row, await this.readDefaultConfigId());` 로 생성 응답의 `isDefault` 도 슬롯 재조회 파생인데, 이 인자가 유실돼 신규 row 가 `true` 로 표시되거나 생성이 슬롯을 덮어써도 실 HTTP 왕복에서 red 가 되지 않는다.
- GET/DELETE describe 의 `.delete(` 는 `341`(슬롯 없는 happy) · `370`(응답 본문 security) · `416`(부재 id 404) · `434 행`(**슬롯이 가리키는 config** 삭제 → 409) **4 곳뿐**이다. 슬롯이 **다른 row(A)** 를 가리키는 상태에서 **비기본 row(B)** 를 삭제하는 조합은 **0** — `remove` 의 P2003→409 분기(`304~305 행`)가 과차단 쪽으로 회귀해 비기본 row 삭제까지 409 가 되어도 잡히지 않고, 삭제가 슬롯을 흔들지 않는다는 반대 방향 계약도 미고정이다.
- T-1975 가 넘긴 2 건은 그대로 미해소다 — T-1975 describe 구간(`1396~1660 행`)에 `SuperAdmin` 매칭 **0**(actor seed 도 `1421~1422 행` User · Admin **2 명뿐**), `지원하지 않` / 허용 집합 밖 `provider` literal 매칭 **0**(같은 구간의 `INVALID_PATCH_BODIES` it.each 는 빈 문자열 · wrong type · allow-list 밖 **키** 3 종이라 provider **값** 축이 아니다).
- 인접 후보 "기본 row A 의 DELETE 409" 는 **이미 `434 행` 이 고정**했다 → 본 task 에서 다시 만들지 않는다(중복 slice 차단).
- `git ls-tree origin/main docs/tasks/ | grep -c T-1976` → **0**(ID 미사용). `git log --oneline origin/main -5` 최상단은 `de636b79`(T-1975 bookkeeping)로, 본 의도를 선점한 commit 없음.

## Required Reading

- [`test/e2e/llm-provider-configs.e2e-spec.ts`](../../test/e2e/llm-provider-configs.e2e-spec.ts)
  - 모듈 상수(재사용 대상, 유사 상수 신설 금지): `48 행` `PROVIDERS_URL`, `51 행` `VIEW_FIELDS` 7 key, `505 행` `ENC_KEY_ENV`, `509 행` `SECRET_CREATE` + `512 행` `VALID_CREATE_PAYLOAD`, `1086~1087 행` `SECRET_DEFAULT_A` · `SECRET_DEFAULT_B`, `1114 행` `DEFAULT_RBAC_CASES` 3 조건 표.
  - T-1975 describe `1396~1660 행` — `1416~1434 행` `beforeAll`(env 키 주입 + `createAuthenticatedE2EApp` actor 2 명: User · Admin) · `1446~1465 행` `beforeEach`(config A · B + A 를 가리키는 슬롯 prisma 직접 seed) · `1466~1471 행` `afterEach` 정리 순서(`truncateAll` → 자식 → 부모) · `1473~1494 행` 내부 helper 3 종 `patchAs` · `expectSlotStillA` · `expectRowAUnchanged`(본 task 의 site 1 이 그대로 재사용) · `1624~1660 행` 말미 `it.each` 2 블록(`INVALID_PATCH_BODIES` · `PATCH_RBAC_CASES`, append 지점 직전).
  - T-1972 POST describe `575~845 행` — `594 행` SuperAdmin actor seed 형태, `776 행` SuperAdmin 201 케이스 문구, `621 행` `afterEach` 정리 순서.
  - T-1973 PATCH describe `1008~1017 행` — 허용 집합 밖 provider literal(`"not_a_provider"`) 400 케이스의 단언 형태(site 1 (b) 가 기본 row 기준으로 mirror).
  - T-1970 describe `434~441 행` — 기본 슬롯이 가리키는 config DELETE 409 + `llmDefaultProvider.count()` 단언(중복 금지 대상 + 대조 기준).
- [`src/llm/llm-provider-config.service.ts`](../../src/llm/llm-provider-config.service.ts) `105~117 행` `readDefaultConfigId`, `119~138 행` `sanitize`, `139~143 행` `findAll`(목록 파생), `180~203 행` `create`, `295~310 행` `remove`(P2025→404 / P2003→409 분기).
- [`src/llm/llm-provider-config.controller.ts`](../../src/llm/llm-provider-config.controller.ts) `95 행` `@Post()` · `199 행` `@Delete(":id")` 의 상태코드 · Admin+ tier 계약.
- [`prisma/schema.prisma`](../../prisma/schema.prisma) `484~492 행` `LlmDefaultProvider`(고정 PK `default` · `llmProviderConfigId @unique` · `onDelete: Restrict`) — `LlmProviderConfig` 에는 `@unique` 가 없어 payload 중복 생성이 P2002 를 유발하지 않는다.
- [`test/helpers/auth-e2e-helper.ts`](../../test/helpers/auth-e2e-helper.ts) `106 행` `buildAuthCookie` · `132 행` `createAuthenticatedE2EApp`.

## Acceptance Criteria

변경은 **`test/e2e/llm-provider-configs.e2e-spec.ts` 1 파일 · 2 site** 다. 기존 top-level describe 1~5 (T-1967 · T-1970 · T-1972 · T-1973 · T-1974) 는 무수정.

**site 1 — T-1975 describe(`1396~1660 행`) 안에 잔여 2 건 append**

- [ ] `beforeAll` 의 actor 목록에 SuperAdmin 1 명 추가 + 쿠키 변수 1 개(기존 User · Admin 배선 형태 그대로). 그 외 scaffold · 기존 12 case 는 무수정.
- [ ] happy(과차단 없음): SuperAdmin 쿠키로 **기본 row A** 를 `PATCH` → **200** + `isDefault: true` 유지 + `expectSlotStillA()` — RolesGuard escalation 이 403 으로 과차단되지 않음.
- [ ] negative(error path): 기본 row A 에 허용 집합 밖 `provider` literal(`"not_a_provider"`) 전송 → **400** + `expectRowAUnchanged()` + `expectSlotStillA()` — 실패한 PATCH 가 row 도 슬롯도 흔들지 않음.

**site 2 — 파일 하단에 일곱 번째 top-level describe append**

- [ ] scaffold 는 T-1975 describe 를 mirror: spec-local 일회용 `LLM_APIKEY_ENC_KEY`(`randomBytes(32)`, `afterAll` 원값 복원) · `createAuthenticatedE2EApp`(User · Admin · SuperAdmin 은 필요한 만큼만) · `beforeEach` 에서 config A · B + **A 를 가리키는 슬롯 1 건** 을 prisma 직접 seed(쓰기 route 경유 0) · `afterEach` 정리 순서(자식 → 부모) 동일. CI env · `.env` · 워크플로 무접촉, 커밋되는 secret 0.
- [ ] happy(POST): 슬롯이 A 를 가리키는 상태에서 Admin 이 `POST /api/llm/providers` → **201** + view 7 key + 신규 row 의 `isDefault: false`(자동 승격 0) + `llmDefaultProvider.count()` 1 + 슬롯 `llmProviderConfigId` 여전히 A.
- [ ] 소비처 배선(POST): 생성 직후 목록 `GET /api/llm/providers` 가 3 건이고 `isDefault: true` 는 **정확히 1 개(=A)** — `findAll` 파생이 신규 row 로 옮겨가지 않음.
- [ ] negative(POST error path): 허용 집합 밖 `provider` literal → **400** + config row 수 2 유지 + 슬롯 count 1 · target A 불변.
- [ ] happy/branch(DELETE): Admin 이 **비기본 row B** 를 `DELETE` → **204** + 빈 body + B 는 404/부재 + A 잔존 + 슬롯 count 1 · target A(= `remove` 의 P2003→409 가 비기본 row 로 과차단 확산하지 않음). 기본 row A 의 409 는 `434 행` 이 이미 고정하므로 **재작성 금지**.
- [ ] 소비처 배선(DELETE): 삭제 직후 목록 `GET` 이 1 건이고 그 row 의 `isDefault: true`.
- [ ] negative(RBAC): 기존 `DEFAULT_RBAC_CASES` 재사용 `it.each` 3 종(User 쿠키 403 / 쿠키 부재 401 / 변조 JWT 401)으로 **비기본 row B 의 DELETE** 를 시도 → 각 기대 status + config row 수 2 유지 + 슬롯 count 1 · target A + 응답 본문에 seed 평문(`SECRET_DEFAULT_A` · `SECRET_DEFAULT_B`) 미노출.
- [ ] 신규 모듈 상수 신설 0 을 기본값으로 하고, 부득이한 경우에만 최소 1 개(신규 config 생성 payload 용)까지 허용한다.

**공통**

- [ ] `pnpm lint && pnpm build && pnpm test` green(R-110). production 코드 0 LOC 변경이라 unit 계수는 불변이어야 한다.
- [ ] `pnpm test:cov` 통과 — line ≥ 80% / function ≥ 80%(`package.json` `coverageThreshold.global`). test-only slice 라 임계 하락 0 임을 확인.
- [ ] e2e 는 실 DB 가 필요하므로 CI `pnpm test:e2e`(R-113) 에서 본 spec PASS 및 e2e 합계 suite/case 증가를 확인해 journal 에 실측 기재.
- [ ] 실 diff 가 §3 cap(300 LOC)에 닿으면 **축소 순서**: (1) RBAC `it.each` 3 종 → User 403 1 종으로 축소 (2) POST 400 케이스 제거 (3) site 1 (b) 제거. 각 site 에 happy 1+ · negative 1+ 는 반드시 남기고, 뺀 항목은 `Follow-ups` 에 파일 · 단언 단위로 박제한다.

## Out of Scope

- `src/` · `web/` · `prisma/` · `.github/workflows/` · `package.json` 변경(구현은 이미 main 에 실재 — 본 task 는 계약 고정 test-only).
- 기본 슬롯이 가리키는 config 의 `DELETE` 409 재작성(`434~441 행` 이 이미 고정).
- `PUT /api/llm/providers/default` 축 보강(T-1974 describe 가 담당) 및 기존 describe 1~5 의 케이스 수정.
- `docs/requirements.md` REQ 상태 재판정(once-rule 상 T-1971 이 이미 수행).
- `test/perf/` · `test/load/` 신규 slice(PLAN `156~157 행` 오너 금지) · `web` 렌더 축 · 신규 공용 helper 추출.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견 시 append)
