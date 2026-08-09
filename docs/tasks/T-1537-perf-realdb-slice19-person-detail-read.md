---
id: T-1537
title: 실 DB perf slice 19 — person 단건 상세 조회 실측
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-026]
estimatedDiff: 320
estimatedFiles: 2
created: 2026-08-09
createdAt: 2026-08-09T01:10:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1536]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~340 LOC (T-1526 274 / T-1528 339 / T-1530 345 / T-1500 275 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/person-detail-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 19(GET /api/persons/:id). T-1536 인벤토리 (B) 4 후보 중 첫 소진. soft-delete 목록↔단건 가시성 비대칭 첫 실측. Person 은 slice 1 도메인이라 도메인 14 불변 · route 27 → 28. pr · 2 파일 약 320 LOC."
---

# T-1537 — 실 DB perf slice 19: person 단건 상세 조회 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB
round-trip cutover 는 slice 1~18 로 **endpoint 도메인 14 개 · 조회 route 27 개** 에 도달했다. 직전
T-1536 이 [부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 에 잔여를 route 단위로
인벤토리화하면서 **진짜 잔여 cutover 후보는 (B) 4 route** 임을 확정했다 —
`GET /api/persons/:id` · `GET /api/parts/:id` · `GET /api/admin/import/:id` · `GET /api`.
본 task 는 그중 **첫 후보** 를 slice 19 로 소진한다.

`GET /api/persons/:id` 를 먼저 고르는 이유는 세 가지다. ① **가장 오래된 미해소 짝** — slice 1
([`person-read-realdb.perf-spec.ts`](../../test/perf/person-read-realdb.perf-spec.ts), T-1500) 가
`GET /api/persons` 목록을 실측하며 같은 controller 의 `:id` 를 **부재 id 404 negative 로만** 두드렸고
happy-path 는 남겨뒀다. ② 그 결과 T-1536 인벤토리가 이 route 를 **"보수 분류"** 로 (B) 에 넣었는데,
본 slice 의 실측이 그 유보를 **측정으로 해소** 한다. ③ 구조 축이 새롭다 — 같은 테이블의 목록은
`findActive` 가 `active: true` (REQ-026 soft-delete invariant) 를 강제하는데 단건
[`findById`](../../src/user/person.service.ts) 는 **필터가 없어 비활성 row 도 200 으로 반환** 한다.
즉 **한 테이블의 목록 route 와 단건 route 가 서로 다른 가시성 규칙을 갖는 첫 실측 대상** 이다
(slice 7 의 soft-delete 는 자식 목록에만 걸렸고 대응하는 단건 경로가 없었다).

Person 은 slice 1 의 도메인이므로 **실측 endpoint 도메인은 14 불변** 이고 조회 route 만
**27 → 28** 로 는다 (slice 15·17·18 과 같은 셈법). 본 task 는 `test/` 만 건드리는 `pr` 이며 3 문서
동기(PLAN · 부하계획 · requirements + 인벤토리 (A)/(B) 재분류) 는 slice 13~18 선례대로 **머지 후 별도
`direct` task** 로 이월한다 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 mixed 금지).

## Required Reading

- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) —
  slice 1 정본 구조 (`createE2EApp()` mock override 0 부트스트랩 · `moduleRef.get(PrismaService)`
  seed · `afterEach(truncateAll)` · `jest.setTimeout(60_000)` · 관찰 전용 baseline 한 줄).
  `118 행` 부근이 본 slice 의 대상 route 를 **404 negative 로만** 두드리는 지점이다. **수정 금지.**
- [test/perf/person-detail-read.perf-spec.ts](../../test/perf/person-detail-read.perf-spec.ts) —
  mock 짝 (T-0847). route 계약과 헤더 서술 형식 참고. **수정 금지 · 인용만.**
- [test/perf/group-members-read-realdb.perf-spec.ts](../../test/perf/group-members-read-realdb.perf-spec.ts)
  — 직전 slice 18 의 AC 대응 구조 (페어 측정 · 규모 관찰 · negative 묶음) mirror.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의
  slice 1~18 bullet 과 그 뒤 `- **잔여**` bullet — 갱신 대상 1 (append + 계수 갱신).
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `41 행` `@Controller("api/persons")`
  · `53 행` `@Get()` · `60 행` `@Get(":id")` — guard 미부착 확인. **수정 금지 · 읽기만.**
- [src/user/person.service.ts](../../src/user/person.service.ts) `90~97 행` `findById`
  (repository null → `NotFoundException` 변환) 와 그 위 `findActive` — 목록/단건의 **필터 비대칭**
  근거. **수정 금지 · 읽기만.**
- [src/user/person.repository.ts](../../src/user/person.repository.ts) `72~74 행` `findById`
  (`prisma.person.findUnique({ where: { id } })` — `include` 0 · active 필터 0). **수정 금지.**
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 의
  **잔여 read route 인벤토리** (B) 4 항목과 **보수 분류 표기** 단락 — 본 slice 가 해소하는 유보.
  **본 task 에서 수정하지 않는다** (doc-sync 는 후속 `direct`).

## Acceptance Criteria

- [ ] 신규 [`test/perf/person-detail-read-realdb.perf-spec.ts`](../../test/perf/person-detail-read-realdb.perf-spec.ts)
  를 추가한다. 파일명에 `read` 와 `realdb` 를 모두 포함해 README 의 glob 계수 규칙(slice 14~18 선례)을
  유지한다. **mock override 0** — `createE2EApp()` 로 AppModule 을 실 부트스트랩하고
  `moduleRef.get(PrismaService)` 의 실 client 로 seed 한다 (`overrideProvider` / `overrideGuard` 금지).
- [ ] **happy path** — seed 한 활성 Person 의 `GET /api/persons/:id` 를 반복 호출하면 200 이고
  `collectLatencySamples` + `assertS2Threshold` 로 p95 **< 3000ms** 를 실측 pass 한다 (test 1+).
  응답 body 의 `id` · `fullName` · `email` · `active` 가 seed 값과 일치함을 단언해 **실 query 발화**
  를 증거화한다 (mock 배선이 아님).
- [ ] **soft-delete 가시성 비대칭 (새 축 1)** — `active: false` 인 Person 을 seed 한 뒤 (a) 목록
  `GET /api/persons` 응답에는 그 row 가 **없고**, (b) 같은 시점 단건 `GET /api/persons/:id` 는
  **200 + `active: false` row 를 반환** 함을 같은 test 안에서 단언하고, 그 단건 경로의 p95 도
  3000ms 미만임을 실측한다. 이 비대칭이 REQ-026 soft-delete invariant 와 모순이 아니라 **route 별
  가시성 규칙 차이** 임을 spec 헤더 주석에 1~2 줄로 적는다.
- [ ] **페어 측정 (새 축 2)** — **같은 seed 상태** 에서 목록(`GET /api/persons`, slice 1 대조군) 과
  단건(`GET /api/persons/:id`) 을 각각 측정해 두 p95 를 **모두 3000ms 미만** 으로 단언하고, 두 값을
  `buildBaselineReport` / `formatBaselineLine` 한 줄로 **관찰 기록만** 남긴다. **대소 관계를 assert
  하지 않는다** (slice 3 선례 — wall-clock 비결정성).
- [ ] **규모 관찰 (새 축 3)** — 테이블 총 row 수가 소규모(예: 5 건) 와 상대적 대규모(예: 100 건) 인
  두 상태에서 **같은 `:id`** 를 조회해 두 p95 를 모두 3000ms 미만으로 단언한다. 목록은 결과 집합이
  규모에 비례하지만 단건은 **응답이 1 row 고정** 이라 규모 축의 의미가 route 마다 갈린다는 점을 1 구절로
  적고, **두 값의 대소 관계·증가율은 단언하지 않고 관찰 기록만** 남긴다.
- [ ] **error path** — 존재하지 않는 id 로 호출하면 repository 의 null 을 service 가
  `NotFoundException` 으로 변환해 **404** 이고, 표본이 0 · `errorRate` 가 1 임을 단언한다 (test 1+).
  응답 body 에 raw stack / Prisma 메시지가 노출되지 않음도 함께 단언한다.
- [ ] **분기 cover** — 분기마다 별도 `it` 로 둔다: (a) row 존재 → 200 + row 반환, (b) row 부재 → 404,
  (c) row 는 존재하나 `active: false` → **404 가 아니라 200**(새 축 1 과 공유 가능). 세 분기가 각각
  구분돼야 한다.
- [ ] **negative cases 충분 cover** — 예외 상황마다 각 1+ test: (a) 다른 Person 의 row 가 응답에
  **혼입되지 않음**(2 건 seed 후 각각 조회 — 격리), (b) 형식이 유효하지 않은 id(빈 문자열 대체 토큰 ·
  비-cuid 문자열) 에서도 500 이 아니라 **404** 로 결정론적 분기, (c) 삭제된 Person 의 id 로 재조회 시
  200 → 404 로 전이(같은 id 두 시점), (d) 응답에 **비노출 컬럼이 새지 않음**(관계 객체 키
  `serviceIdentities` / `memberships` 부재 — `include` 0 증거), (e) path 변형
  (`/api/persons/:id/extra`) 이 200 이 아닌 4xx, (f) 비현실적 임계 주입(`p95MaxMs: 0`) 시
  `assertS2Threshold` 가 **실패로 판정** 됨(측정 시간 무의존 fail 분기 — slice 2 선례).
  **인증·인가(401/403) negative 는 `PersonController` 에 guard 가 없어 구조적으로 부재하므로 만들지
  않는다** — 그 사실을 spec 헤더 주석에 명시한다.
- [ ] **정리 · 격리** — `afterEach` 는 `truncateAll(prisma)` 로 도메인 테이블을 비워 각 test 가 자기
  seed 만 보게 한다 ([test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) **수정 0**).
  `Person.email` 은 `@unique` 이므로 seed 시 index 접미로 충돌을 회피한다. `afterAll` 에서
  `app.close()` + `prisma.$disconnect()` 로 open handle 0.
- [ ] **새 축 중복 주장 금지 검산** — spec 헤더에 새 축 3 개를 근거와 함께 적되, **새 축으로 주장하지
  않는** 항목도 명시한다 — PK 직행 `findUnique` 자체는 slice 11·14 와 동일, repository null 분기
  기반 404 는 slice 11 과 동일, guard 부재는 slice 1·2·7 과 동일, 미조인 SELECT 는 slice 11 과 동일.
- [ ] `DEFAULT_P95_MAX_MS = 3000` (REQ-048) 를 변경하지 않고 baseline 파일을 확정하지 않는다 —
  `buildBaselineReport` / `formatBaselineLine` 은 관찰 전용 한 줄로만 쓰고 `writeBaselineFile` /
  `confirmOrCompareBaseline` 은 호출하지 않는다 (디스크 write 0).
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 slice 목록에 `- **slice 19**` 항목을
  slice 18 뒤에 append 한다. 위 새 축 3 개와 "새 축이 아닌" 항목을 함께 기술하고, 본 slice 가
  **T-1536 인벤토리 (B) 의 보수 분류 1 건을 측정으로 해소** 함을 1 구절로 밝힌다.
- [ ] [test/perf/README.md](../../test/perf/README.md) 의 `- **잔여**` 계수를 실검산대로 갱신한다 —
  perf-spec **52 → 53**, read glob **47 → 48**, 실 DB round-trip **18 → 19**(그중 read **17 → 18**),
  mock 잔존 read perf-spec 은 `48 − 18 = 30` 으로 **불변**, 실측 endpoint 도메인 **14 불변**(Person 은
  slice 1 도메인), 조회 route **27 → 28**. `ls test/perf/*.perf-spec.ts | wc -l` 등으로 실검산해
  어긋나면 문서가 아니라 계수를 고친다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 통과. `pnpm test:cov` 통과 (line ≥ 80% /
  function ≥ 80% — `src/` 변경 0 이므로 기존 수치 유지).
- [ ] 로컬 실 DB 전제(`docker compose up -d postgres` + `DATABASE_URL` export +
  `pnpm prisma migrate deploy`) 하에 `pnpm test:perf` 로 신규 spec 이 picking 되어 통과.
  `jest-perf.json` 의 `testRegex` 가 자동 매칭하므로 workflow / config 편집 0. 로컬 Postgres 부재 시
  CI 의 postgres service `perf test` step success 로 확정한다.

## Out of Scope

- **doc-sync** — [docs/PLAN.md](../PLAN.md) `142 행` · [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  `§ 5` item 5(잔여 인벤토리의 (A) 26 → 27 / (B) 4 → 3 재분류 포함) · [docs/requirements.md](../requirements.md)
  REQ-048 반영은 **머지 후 별도 `direct` task** 로 이월한다 (slice 13~18 선례 T-1525 / T-1527 /
  T-1529 / T-1531 / T-1533 / T-1535 동형). 본 task 는 `test/` 만 건드린다.
- **나머지 (B) 3 후보**(`GET /api/parts/:id` · `GET /api/admin/import/:id` · `GET /api`) 의 실 DB
  cutover — 각각 후속 slice.
- **slice 1 spec 수정** — [`person-read-realdb.perf-spec.ts`](../../test/perf/person-read-realdb.perf-spec.ts)
  는 인용만 하고 편집하지 않는다. 목록 route 는 본 spec 안에서 **페어 대조군으로만** 호출한다.
- **mock 짝 [`person-detail-read.perf-spec.ts`](../../test/perf/person-detail-read.perf-spec.ts) 의
  retire · 삭제 · 통합** — (A) 부류 mock spec 처리 판단은 T-1536 이 명시적으로 유보한 별도 주제다.
- `src/` production code 수정 일체 — 특히 `findById` 에 active 필터 추가 · `include` 추가 · guard 부착
  · 404 메시지 변경 금지 (측정만 한다).
- `prisma/schema.prisma` 수정 · migration — index 추가 판단은 실측 결과 기반 **별도 task**
  ([CLAUDE.md](../../CLAUDE.md) §5 DB schema 게이트).
- write route(`POST` / `PATCH` / `DELETE /api/persons`) 의 latency 측정 — seed 와 삭제는 Prisma 직접
  write 로 준비한다.
- `test/helpers/*` 수정 · 기존 mock perf-spec 수정 · 임계값(3000ms) 변경 · baseline 파일 확정 ·
  부하 발생기(k6 등) 도입 · REQ-047 실 scale 부하 측정.
- `.github/workflows/ci.yml` · `jest-perf.json` · `package.json` 편집 · 새 dependency.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **doc-sync (direct, 다음 slice 전 필요)** — 위 Out of Scope 로 이월한 3 문서 동기 +
  [부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 인벤토리의 (A) **26 → 27** / (B)
  **4 → 3** 재분류와 보수 분류 단락 갱신(person-detail 유보 해소). 계수는 perf-spec 53 / read 48 /
  실 DB 19(read 18) / 도메인 14 불변 / 조회 route 27 → 28. **완료 선언 0 유지**(PLAN `140 행` `[ ]` ·
  REQ-048 `IN_PROGRESS` · 잔여 4 축 보존).
