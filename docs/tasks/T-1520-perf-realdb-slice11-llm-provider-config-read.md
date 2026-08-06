---
id: T-1520
title: 실 DB round-trip perf-spec slice 11 — LLM provider config 조회 p95 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1519]
touchesFiles:
  - test/perf/llm-provider-config-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 9 개) 에서 split — 열 번째 endpoint 도메인 + secondary index 0 테이블 / service sanitize 변환 / null→404 축"
---

# T-1520 — 실 DB round-trip perf-spec slice 11 (LLM provider config 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` 의 잔여 절이 "실측 범위가 endpoint **9 개(조회 route 17)** 뿐" 이라고
적고 "남은 endpoint 의 실 DB cutover 는 endpoint 단위 후속 slice 로 이어간다" 를 남겨 뒀다. slice
1~10 (T-1500 · T-1502 · T-1504 · T-1506 · T-1508 · T-1510 · T-1512 · T-1514 · T-1516 · T-1518) 은
`src/user/` 7 controller 와 `PermissionDeniedRecordController` · `ExportController` 를 소진했다. 본
task 는 그 잔여를 한 칸 좁혀 **열 번째 endpoint 도메인** 인 `LlmProviderConfigController` 의 조회
2 route (`GET /api/llm/providers` · `GET /api/llm/providers/:id`) 를 실 Postgres 위에서 측정한다
([REQ-048](../requirements.md) 조회 p95 < 3s).

앞 slice 와의 질적 차이는 **구조 축 3 개** 다 — ① **secondary index 가 0 인 테이블**:
`LlmProviderConfig` 는 `@id` 외에 `@unique` · `@@unique` · `@@index` 가 **하나도 없는 첫 실측
대상** 이고, 목록은 무필터 전량 `findMany()` · 단건은 **PK 직행 `findUnique({ where: { id } })`**
다 (slice 7 은 필터 컬럼만 무-index 였고 테이블에는 다른 index 가 있었으며, 8 = 단일 컬럼
`@unique`, 9 = index 후보 2 개, 10 = `@@index` 선두 컬럼). ② **service-layer per-row sanitize +
읽고 버리는 컬럼**: 앞 10 slice 는 repository row 를 그대로 직렬화 forward 했지만 본 경로는
service 가 row 마다 명시 field pick 으로 `apiKey` 를 제거한 **새 view 객체** 를 만든다 — 즉 DB 에서
읽어오는 payload 가 **응답 payload 보다 크고**(AES-256-GCM envelope ciphertext 를 읽어서 버린다),
row 수에 비례한 변환 CPU 가 latency 에 처음 섞인다. ③ **null 분기 기반 404**: slice 10 의 404 는
`findUniqueOrThrow` 의 P2025 **예외 기반** 변환이었지만, 본 경로는 repository 가 `findUnique` 로
**null 을 반환** 하고 service 가 그 null 을 분기해 `NotFoundException` 을 던지는 **application 분기
기반** 이다 — 같은 404 여도 발생 메커니즘이 다르다.

부수적으로 본 slice 는 ④ 대상 테이블이 `truncateAll` 의 `TRUNCATE_TABLES` 에 **없고** `User` FK 도
없어 **spec-local `deleteMany` 정리가 필요한 첫 대상** 이고, ⑤ 역방향 relation
(`DifficultyMapping[]`, FK `onDelete: Restrict`) 이 있는데도 조회는 `include` 0 인 **relation 미조인
SELECT** 이며, ⑥ 도메인 데이터가 아닌 **운영 secret 보관 config 테이블** 이라는 점에서 갈린다.
guard 는 두 route 모두 `@Roles("Admin")` 이라 403 layer 자체는 slice 10 과 동일하므로 **새 축으로
주장하지 않고** negative cover 로만 유지한다. slice 1~10 과 마찬가지로 **측정만 하고 production
code · schema · 임계값은 건드리지 않는다**.

## Required Reading

- [test/perf/export-read-realdb.perf-spec.ts](../../test/perf/export-read-realdb.perf-spec.ts) —
  **구조 정본** (`276 행`). 헤더 주석 형식 · `jest.setTimeout(120_000)` ·
  `createAuthenticatedE2EApp` 2 actor seed (`85 행` ~ `93 행`) · `buildAuthCookie` · 변조 cookie ·
  `beforeAll`/`afterEach` 의 `truncateAll` + `reseedAuthenticatedActors` (`97 행`, 원본 id 그대로) ·
  `collectLatencySamples` + `assertS2Threshold` 사용법을 그대로 승계한다. **이 파일은 수정 금지**.
- [src/llm/llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts)
  `73 행` (`@Controller("api/llm/providers")` — base path) · `91 행` ~ `96 행` (`@Get()` +
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`) · `106 행` ~ `111 행`
  (`@Get(":id")` 단건, service raw forward).
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `76 행`
  (`LlmProviderConfigView = Omit<LlmProviderConfig, "apiKey">`) · `93 행` ~ `101 행` (`sanitize` 의
  명시 field pick) · `109 행` ~ `112 행` (`findAll` 이 row 마다 sanitize) · `124 행` ~ `129 행`
  (`findById` 의 **null → `NotFoundException`** 분기).
- [src/llm/llm-provider-config.repository.ts](../../src/llm/llm-provider-config.repository.ts)
  `65 행` ~ `72 행` (`findUnique` 의 null 반환 · `findMany` 의 무필터 전량 조회).
- [prisma/schema.prisma](../../prisma/schema.prisma) `406 행` ~ `418 행` (`LlmProviderConfig` —
  `@id @default(cuid())` 외 index/unique **전무** · `apiKey` 필수 String · 역방향
  `difficultyMappings DifficultyMapping[]`). **수정 금지** (schema 변경은
  [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) `43 행` ~ `51 행` —
  `TRUNCATE_TABLES` 에 `"LlmProviderConfig"` 가 **없고** 해당 테이블은 `"User"` 를 참조하지도
  않으므로 CASCADE 로 지워지지 않는다. **helper 를 수정하지 말고** spec 안에서 정리한다 (helper
  수정은 drift-guard spec 동반 수정을 유발해 파일 수 상한이 깨진다).
- [test/perf/README.md](../../test/perf/README.md) 의
  `## 실 DB round-trip baseline (slice 목록)` 절 — **slice 10** bullet (`612 행`) 과 **잔여** bullet
  (`631 행`). 본 task 가 갱신할 정본 위치.

## Acceptance Criteria

- [ ] **AC 1 — spec 신설.** `test/perf/llm-provider-config-read-realdb.perf-spec.ts` 를 추가한다.
  slice 10 과 동일하게 **mock override 0 · guard override 0** 으로 `createAuthenticatedE2EApp` 이
  `AppModule` 을 실 부트스트랩하고, actor 는 `User` tier 1 명 + `Admin` tier 1 명을 seed 해 실 JWT
  cookie 로만 인증한다. seed 는 `prisma.llmProviderConfig.create`(또는 `createMany`) 로 직접
  넣고 **POST endpoint · `LlmApiKeyCipher` 실 호출은 쓰지 않는다** (암호화 key env 의존 회피) —
  `apiKey` 에는 envelope ciphertext 를 모사한 **긴 base64 유사 문자열** 을 넣어 "읽고 버리는 컬럼"
  축을 만든다. 임계 단언은 `assertS2Threshold` (기본 p95 < 3000ms) 를 쓰고 임계값을 재정의하지
  않는다.
- [ ] **AC 2 — happy-path test 2+.** ① Admin actor 의 `GET /api/llm/providers` → 200 + seed 한
  config 가 모두 담기고 (`id`/`provider`/`modelId` 대조로 실 query 발화 입증) p95 < 3000ms,
  ② Admin actor 의 `GET /api/llm/providers/:id` → 200 + 해당 config 의 `provider`/`endpointUrl`/
  `modelId` 가 seed 값과 일치하고 p95 < 3000ms. 검증은 `toHaveBeenCalledTimes` 가 아니라 **body 의
  seed 값 대조** 로 한다.
- [ ] **AC 3 — 분기 test 3+.** (a) config **0 건** 상태의 목록 조회 → 200 + **빈 배열** (404 로
  변환되지 않음), (b) config **다건**(3+) 상태의 목록 조회 → 무필터 전량 SELECT 가 seed 한 row 를
  빠짐없이 반환, (c) 목록·단건 **양쪽 응답 body 에 `apiKey` 키가 존재하지 않음** 을 단언 (service
  sanitize 경로 — 읽고 버리는 컬럼 축의 직접 증거). 각 갈래를 별도 `it` 으로 두고 (a)·(b) 는
  p95 < 3000ms 를 함께 단언한다. **0 건 표본과 다건 표본의 latency 대소 관계는 단언하지 않는다**
  (slice 3 선례 — wall-clock 비결정성).
- [ ] **AC 4 — error / negative test 4+ (예외 분기마다 1+).** (a) Cookie **부재** → 401
  (`JwtAuthGuard`), (b) **변조 토큰** cookie → 401, (c) **User tier actor** 의 두 route 접근 →
  **403** (`RolesGuard` 가 DB 미도달로 거절 — 두 route 각각 확인), (d) **미존재 id** 의 `:id`
  조회 → **404** (`findUnique` 의 **null → `NotFoundException`** 분기 — 본 slice 의 핵심 축, 응답
  body 에 `apiKey` 흔적이 없음도 함께 확인). 401/403 분기는 DB 미도달이라 `p95MaxMs: 0` 로 측정
  시간 무의존 단언을 쓴다.
- [ ] **AC 5 — 정리 invariant 준수.** `afterEach` 는 `truncateAll` 후 `reseedAuthenticatedActors` 로
  actor 를 **원본 id 그대로** 재-seed 한다 (JWT `sub` 매칭 유지 — 새 id·token 재발급 금지). 추가로
  `LlmProviderConfig` 는 truncate 대상이 아니므로 **각 test 정리 단계에서
  `prisma.llmProviderConfig.deleteMany()`** 로 흡수한다 (`test/helpers/db-truncate.ts` 수정 금지).
  `DifficultyMapping` 은 seed 하지 않아 `onDelete: Restrict` 위반이 발생하지 않음을 전제한다.
- [ ] **AC 6 — README slice 목록 갱신.** `test/perf/README.md` 의
  `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 11** bullet 을 추가한다 — 파일명 ·
  task ID · 조회 2 route · **구조 축 3 개** (secondary index 0 테이블의 무필터 전량 + PK 직행 /
  service per-row sanitize 로 DB payload > 응답 payload / `findUnique` null 분기 기반 404 —
  slice 10 의 P2025 예외 기반 404 와 메커니즘 상이) + 부수 축 (truncate helper 미커버 →
  spec-local `deleteMany` · 역방향 relation 있으나 미조인 · 운영 secret config 테이블) ·
  **소규모 표본이라 REQ-047 실 scale 부하가 아님** 을 적는다. 이어 **잔여** bullet 의 계수를
  실측값으로 갱신한다 — endpoint **9 → 10** (조회 route **17 → 19**), read glob **39 → 40**,
  실 DB read **9 → 10**, 그리고 **mock 잔존 30 개는 불변** (파일명에 `read` 가 있어 피감수·감수가
  함께 +1). 개수는 추정 금지 — `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts` 실측값만 쓴다.
- [ ] **AC 7 — 검증 명령.** `pnpm lint` · `pnpm build` · `pnpm test:perf` 가 모두 green 이어야 한다
  (새 spec 이 실 Postgres 로 통과). 아울러 `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를
  유지함을 확인한다 (본 task 는 production code 0 LOC 변경이라 coverage 수치가 내려가서는 안 된다).
- [ ] **AC 8 — 크기 상한.** `git diff --stat` 이 **2 파일 / ≤ 300 LOC** 임을 확인한다. 초과가
  예상되면 test 수를 줄이지 말고 **헤더 주석과 test 내 설명 주석을 축약** 해 맞춘다 (AC 2~4 의
  test 종류는 필수). 그래도 초과하면 진행하지 말고 Follow-ups 에 split 필요를 적고 BLOCKED 로
  넘긴다.
- [ ] **AC 9 — 범위 표기 규약.** 본 task 가 새로 추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md)
  §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`,
  단일 행은 `98 행`, `L` prefix 금지. 기존 표기의 소급 치환은 금지.

## Out of Scope

- **production code 변경 일체** (`src/`) — 본 task 는 **측정만** 한다. `LlmProviderConfig` index
  추가 · `findAll` pagination/정렬 도입 · sanitize 구현 변경 · 404 매핑 변경 모두 금지.
- **`prisma/schema.prisma` · migration 변경** — [CLAUDE.md](../../CLAUDE.md) §5 DB schema 게이트
  (BLOCKED 대상). index 필요 판단이 서면 Follow-ups 에만 적는다.
- **`POST` / `PATCH` / `DELETE` config CRUD 경로 측정** — 본 slice 는 **조회 2 route** 만 잰다.
  쓰기 경로는 latency 계약과 seed 전제가 달라 별도 slice 로 이월한다.
- **실 `LlmApiKeyCipher` 암호화 호출 · encryption key env 설정** — seed 는 Prisma 직접 insert 로
  하고 `apiKey` 는 ciphertext 를 모사한 문자열을 쓴다 (secret 취급 변경 0).
- **`DifficultyMappingController` (`GET /api/llm/difficulty-mappings`) 측정** — 같은 `src/llm/`
  도메인이지만 FK 조인 축이 달라 **별도 slice** 다 (한 task 2 route 원칙 유지).
- **`test/helpers/db-truncate.ts` 에 `"LlmProviderConfig"` 추가** — drift-guard spec 동반 수정으로
  파일 수 상한이 깨진다. spec-local `deleteMany` 로 흡수한다.
- **앞 slice spec 수정** (`*-realdb.perf-spec.ts` 10 개) 및 `latency-*.ts` primitive 수정 — 본
  task 는 신설 1 파일 + README 만 건드린다.
- **PLAN · 부하계획 `§ 5` · REQ-048 doc-sync** — [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr
  mixed 금지) 에 따라 **머지 후 별도 direct task** 로 이월한다 (T-1501 · T-1503 · T-1505 · T-1507 ·
  T-1509 · T-1511 · T-1513 · T-1515 · T-1517 · T-1519 선례).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 불변, baseline 파일 write 금지
  (`buildBaselineReport` 는 관찰 전용).
- **REQ-047 실 scale 부하 주장** — seed 는 상대 비교용 소규모 표본이다. spec 주석·README 어디에도
  REQ-047 충족으로 읽히는 표현을 쓰지 않는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip** — 잔여 축이 살아 있으므로 금지.
- **regression test 항목** — 본 task 는 patch 가 아니다 (`hqOrigin` 없음).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, slice 1~10 의 확립된 구조 승계).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
