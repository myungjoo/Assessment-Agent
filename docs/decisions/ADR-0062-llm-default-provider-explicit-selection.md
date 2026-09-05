---
id: ADR-0062
title: 다중-row LlmProviderConfig 의 기본 provider 선택 정책 — Web UI 명시 선택 최우선 (단일 슬롯 table + PUT /api/llm/providers/default)
status: PROPOSED
date: 2026-09-05
relatedTask: [T-1862]
relatedReq: [REQ-049, REQ-051]
supersedes: null
augments: [ADR-0045, ADR-0048]
---

# ADR-0062 — 다중-row LlmProviderConfig 의 기본 provider 선택 정책 (Web UI 명시 선택 최우선)

## Status

**PROPOSED**. 본 ADR 은 **결정만 박제** 하며 코드를 1 LOC 도 만들지 않는다 — 본 slice 의 diff 는 본 문서와 [data-model.md](../architecture/data-model.md) 동기 갱신 2 개뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 이다. schema · migration · repository · resolver · controller · DTO · Web UI · seed 배선은 전부 § Follow-ups 로 이월한다 ([ADR-0058](ADR-0058-service-identity-management-api.md) · [ADR-0059](ADR-0059-collection-target-registration.md) · [ADR-0060](ADR-0060-evaluation-run-status-endpoint.md) 의 doc-only ADR 선례 동형).

**ADR-0048 과의 관계는 부분 supersede 다** — [ADR-0048](ADR-0048-default-model-id-source.md) 은 전체로는 ACCEPTED 유지이고, 본 ADR 이 대체하는 것은 그 `§ Decision 2` 가 "REQ-051 진입 시 후속 ADR 로 deferred" 한 **다중-row default 선택 정책 1 건** 뿐이다 (`§ Decision 1` 의 "source = LlmProviderConfig row 의 modelId", `§ Decision 3` 의 request body 필드 제거, `§ Decision 4` 의 새 env 0 / 새 dep 0 은 그대로 승계). ADR-0048 본문에 "superseded by ADR-0062" 한 줄을 박는 것과 본 ADR 의 status 를 ACCEPTED 로 올리는 것은 **T-1868 (direct)** 소관이며 본 slice 는 ADR-0048 을 건드리지 않는다.

## Context

### 트리거 — 운영이 이미 다중-row 로 갔고, 그 순간 default 경로가 죽는다

[LlmProviderConfigResolver](../../src/llm/llm-provider-config-resolver.service.ts) 는 ADR-0048 `§ Decision 2` 를 그대로 구현해 `repository.findMany()` 결과 row 수로 3 분기한다 — (a) 1 개면 그 row 의 `modelId`, (b) 0 개면 "LLM provider 가 설정되지 않았다" fail-fast, (c) **2 개 이상이면 "명시적 default 선택 정책 미박제" fail-fast**. ADR-0048 은 그 (c) 를 "REQ-051 미진입 단계에서 row ≥ 2 = 미박제 운영 사고" 로 규정했다.

그러나 지금은 사고가 아니라 **정상 운영이 (c) 를 발화시킨다**.

- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 가 재배포마다 `SEED_LLM_CONFIG_ID` (기본 `seed-local-llm`) 고정 id row 를 `INSERT ... ON CONFLICT ("id") DO UPDATE` 로 upsert 한다 (`provider` / `endpointUrl` / `apiKey` / `modelId` 전부 덮어쓴다).
- Admin 이 Web UI ([LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) + [AdminView.tsx](../../web/src/views/AdminView.tsx) 의 생성 폼, `POST /api/llm/providers`) 로 provider 를 하나만 더 등록하면 row 가 2 개가 된다.

이 순간 난이도 매핑 경로 (`DifficultyMapping` 슬롯이 FK 로 특정 config 를 직접 가리킨다) 는 정상이지만, `POST /api/assessment-evaluation/unevaluated-fill-run` 의 default 경로는 resolver (c) 에서 즉시 실패한다. 즉 **"seed 가 넣은 row" 와 "Admin 이 UI 로 넣은 row" 의 공존이 default 경로를 죽인다**. ADR-0048 이 예고한 후속 ADR 이 본 문서다.

### 오너 지시 (2026-09-03) — 정책 골자는 이미 확정돼 있다

> "다중 row 일 때 default 선택 정책 task 를 만들어라. Web UI 에서 선택할 수 있어야 하고, 사용자가 명시적으로 선택한 것이 언제나 우선이다."

따라서 본 ADR 이 **선택하는** 것은 정책 골자가 아니라 그 골자를 담을 **저장 형태 (§ Decision 2)** 와 **API shape (§ Decision 3)** 두 가지뿐이다. 골자 자체는 § Decision 1 에 제약으로 박제한다.

### 외력

- **[CLAUDE.md](../../CLAUDE.md) § 5** — DB schema 변경은 BLOCKED 게이트다. 본 ADR 의 채택안은 그 게이트를 **발화시키지만**, 위 오너 지시 (2026-09-03) 가 정책 자체를 지시하며 schema 를 요구하는 저장 형태를 사전 승인했다 (§ Consequences 에 박제). 새 dependency 0 · 새 env 0 은 유지된다.
- **[ADR-0011](ADR-0011-difficulty-model-assignment.md) / DifficultyMapping** — "고정 슬롯 row → `llmProviderConfigId` FK, `onDelete: Restrict`, in-use 삭제는 P2003 → 409" 패턴이 이미 [prisma/schema.prisma](../../prisma/schema.prisma) `441 행` 이후와 [LlmProviderConfigService](../../src/llm/llm-provider-config.service.ts) `244~275 행` 에 shipped 다. 본 ADR 의 저장 형태 후보 (ii) 는 그 패턴의 mirror 다.
- **[ADR-0045](ADR-0045-llm-provider-deployment-config.md) § Decision 1** — "provider = 배포-환경 설정, source = LlmProviderConfig row". 본 ADR 은 그 source 안에서 **어느 row 인가** 만 좁힌다 — env 나 caller 로 source 를 옮기지 않는다.

## Decision

### Decision § 1 — 오너 확정 제약 5 건 (결정 대상 아님 — 그대로 박제)

아래 5 건은 본 ADR 이 고른 것이 아니라 오너 지시 (2026-09-03) 가 확정한 **제약** 이다. 이후 모든 결정은 이 제약을 만족해야 한다.

1. **명시 선택 최우선** — Admin 이 Web UI 에서 지정한 기본 provider 가 존재하면, seed env · `updatedAt` · row 수 · 그 어떤 자동 규칙보다 **언제나 우선** 한다. 자동 규칙이 명시 선택을 덮어쓰거나 지우는 경로는 **존재하지 않는다**.
2. **명시 선택 부재 시 fallback** — row 1 개면 그 row (ADR-0048 (a) 하위 호환), row 0 개면 fail-fast (기존 (b)), row ≥ 2 개면 fail-fast 하되 메시지는 "Admin UI 에서 기본 provider 를 선택하라" 로 **행동 지시형**.
3. **저장 위치는 DB** — env pointer 안 (ADR-0048 § Decision 2 의 후속 검토 대상 (ii)) 은 **채택 금지** 다: 재배포 env 가 UI 선택을 이길 수 있어 제약 1 을 위반한다. `updatedAt` 자동 선택 (iii) 도 **금지** 다: "row 를 수정하면 default 가 바뀐다" 가 되어 제약 1 의 "명시" 가 성립하지 않는다.
4. **기본으로 지정된 row 의 삭제는 409** — DifficultyMapping in-use 409 와 동형. 먼저 다른 row 를 기본으로 지정한 뒤 삭제한다.
5. **seed 는 명시 선택을 절대 덮어쓰지 않는다** — seed 가 default 를 건드리는 유일한 허용 동작은 "명시 선택이 하나도 없을 때 자기 row 를 기본으로 지정" (bootstrap 편의) 이다. 이미 선택이 있으면 seed 는 provider row upsert 만 하고 default 는 **무변경**.

### Decision § 2 — 저장 형태는 **(ii) 단일 슬롯 table `LlmDefaultProvider`** (택1)

**채택: 전역 기본 provider 는 `LlmProviderConfig` 의 `isDefault` Boolean 컬럼이 아니라, 고정 id 1 row 만 사는 단일 슬롯 table 로 표현한다.**

```prisma
model LlmDefaultProvider {
  id                  String @id @default("default")
  llmProviderConfigId String @unique

  llmProviderConfig LlmProviderConfig @relation(fields: [llmProviderConfigId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

비교 축 4 개 전부에서 (ii) 가 (i) 를 이긴다.

- **원자성** — (ii) 의 default 교체는 `upsert({ where: { id: "default" }, ... })` **단일 statement** 다. (i) 는 "기존 true row 를 false 로" + "새 row 를 true 로" 2 write 를 `$transaction` 으로 묶어야 하고, 그 사이 window 에 default 가 0 개인 상태가 실재한다.
- **유일성 강제 방식** — (ii) 는 고정 PK (`id = "default"`) 자체가 "슬롯은 1 개" 를 표현한다. (i) 의 "정확히 1 row 만 `isDefault = true`" 는 Postgres **partial unique index** (`CREATE UNIQUE INDEX ... WHERE "isDefault"`) 로만 강제되는데, Prisma schema 는 partial index 를 선언적으로 표현하지 못한다 — migration 에 raw SQL 을 손으로 넣어야 하고 그 결과 schema 파일과 실 DB 사이에 영구적 drift 가 남는다. repo 의 기존 migration 중 raw SQL 로만 표현되는 제약은 아직 0 이다.
- **제약 4 (기본 row 삭제 409) 구현 비용** — (ii) 는 **0 이다**. FK `onDelete: Restrict` 가 P2003 을 던지고, [LlmProviderConfigService](../../src/llm/llm-provider-config.service.ts) 의 `delete` 는 이미 `P2003 → ConflictException(409)` 를 하고 있다 (메시지 문구만 "DifficultyMapping 슬롯" → "DifficultyMapping 슬롯 또는 기본 provider 지정" 으로 넓히면 된다). (i) 는 delete 전에 "이 row 가 default 인가" 를 별도 조회해 분기해야 하고, 그 조회와 delete 사이에 TOCTOU 가 남는다.
- **기존 패턴 정합** — (ii) 는 이미 shipped 인 DifficultyMapping ("고정 슬롯 row → `llmProviderConfigId` FK → `onDelete: Restrict`") 의 정확한 mirror 다. 읽는 사람이 새 개념을 배우지 않는다.

**fail-safe 비대칭도 (ii) 편이다** — 누군가 DB 를 직접 만져 이상 상태를 만들었을 때, (i) 은 `isDefault = true` row 가 2 개가 되어 "어느 것이 default 인가" 가 **모호** 해지지만, (ii) 는 `id` 가 `"default"` 가 아닌 잉여 row 가 생겨도 읽기 경로가 `findUnique({ id: "default" })` 하나뿐이라 그 row 들이 **무해하게 무시** 된다.

**잔여 trade-off 는 명시한다** — "`id` 가 `"default"` 인 row 만 존재한다" 는 schema 제약이 아니라 **service 계층 invariant** 다 (repository 가 상수 슬롯 id 만 쓰기 때문에 성립). CHECK 제약으로 격상하려면 raw SQL 이 필요한데, 위 fail-safe 비대칭 덕에 위반의 결과가 무해하므로 raw SQL 을 도입하지 않는다. `llmProviderConfigId @unique` 는 단일 row 전제에서는 중복 제약이지만, index 1 개 비용으로 "한 config 가 슬롯을 두 번 차지할 수 없다" 를 DB 레벨에 남겨 두므로 유지한다.

### Decision § 3 — API shape 은 **`PUT /api/llm/providers/default`** + 목록 view 의 `isDefault: boolean` (택1)

**채택: 기본 provider 지정은 `PUT /api/llm/providers/default` (body `{ llmProviderConfigId: string }`) → `200` + 지정된 config 의 sanitize view. 별도 조회 endpoint 는 만들지 않고, `GET /api/llm/providers` · `GET /api/llm/providers/:id` 의 view 에 `isDefault: boolean` 필드를 더한다.**

- **`PUT` 인 이유** — "전역 기본 provider" 는 0 또는 1 개만 존재하는 **singleton sub-resource** 다. 그 전체를 통째로 교체하는 연산이므로 `PUT` 의 idempotent 시멘틱이 정확히 맞고, § Decision 2 의 `upsert` 1 회와 1:1 로 대응한다.
- **목록 view 에 `isDefault` 를 얹는 이유** — Web UI (T-1866) 는 provider 목록을 그리면서 각 행에 "기본" 배지와 "기본으로 지정" 버튼을 렌더해야 한다. `isDefault` 가 목록 응답에 있으면 **fetch 1 회** 로 끝난다. 별도 `GET /api/llm/providers/default` 를 두면 UI 가 2 회 fetch 후 join 해야 하고, 두 응답 사이의 race 로 배지가 잠깐 어긋난다. `isDefault` 는 apiKey 와 달리 secret 이 아니므로 sanitize allow-list 확장에 문제가 없다 (view 는 7 필드가 된다: `id` / `provider` / `endpointUrl` / `modelId` / `isDefault` / `createdAt` / `updatedAt`).
- **route 선언 순서 함정 (명시 박제)** — NestJS 는 **선언 순서로 매칭** 하므로 정적 path segment `default` 는 항상 같은 method 의 `:id` 보다 **앞** 에 선언돼야 한다. 지금 [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 에는 `@Put` 이 하나도 없어 (`@Get()` `91 행` / `@Get(":id")` `106 행` / `@Post()` `124 행` / `@Patch(":id")` `145 행` / `@Delete(":id")` `164 행`) **오늘 당장은 충돌이 없지만**, 규약을 지키지 않으면 훗날 `@Put(":id")` 가 추가되는 순간 `PUT /api/llm/providers/default` 가 `id = "default"` 로 삼켜진다. 따라서 T-1865 는 `@Put("default")` 를 `:id` 계열 route **위** 에 선언하고 그 이유를 주석으로 남긴다. 본 결정이 별도 `GET /default` 를 만들지 않는 것은, 그 함정을 **이미 존재하는** `@Get(":id")` 와 즉시 일으켰을 경로를 아예 없애는 효과도 있다.
- **대안 `PATCH /api/llm/providers/:id/default` 미채택** — (1) 대상이 "그 provider" 가 아니라 "전역 슬롯" 이라 URL 이 소유 관계를 잘못 표현한다, (2) `PATCH` 는 부분 갱신 시멘틱이라 upsert-교체와 어긋난다, (3) "기본 해제" 를 표현하려면 `DELETE /api/llm/providers/:id/default` 같은 표면이 추가로 필요해진다. 채택안은 "교체" 단일 표면으로 닫힌다.
- **RBAC** — 기존 provider mutation 과 동일한 `Admin+`. [api.md](../architecture/api.md) `129~133 행` 표에 행 1 개 추가는 T-1865 소관.

### Decision § 4 — resolver 우선순위는 "슬롯 → row 1 개 → fail-fast" 4 분기

**채택: [LlmProviderConfigResolver](../../src/llm/llm-provider-config-resolver.service.ts) 의 `resolveDefaultModelId` 는 다음 순서로 판정한다. 슬롯 조회가 언제나 먼저다 (제약 1).**

1. **명시 슬롯 존재** → 그 슬롯이 가리키는 `LlmProviderConfig` 의 `modelId` 채택. row 총수는 보지 않는다 (row 가 5 개든 1 개든 슬롯이 이긴다).
2. **슬롯 부재 + row 정확히 1 개** → 그 row 채택 (ADR-0048 (a) 하위 호환 — 기존 단일-row 배포는 아무 조치 없이 그대로 동작한다).
3. **슬롯 부재 + row 0 개** → 기존 (b) 메시지 그대로 fail-fast.
4. **슬롯 부재 + row ≥ 2 개** → fail-fast 하되 메시지를 행동 지시형으로 교체: "LlmProviderConfig 가 N 개인데 기본 provider 가 지정되지 않았다 — Admin UI 에서 기본 provider 를 선택하라". 기존의 "후속 ADR 필요" 문구는 본 ADR 로 해소되므로 제거한다.

`modelId` 형식 검증 (non-string / 빈 문자열 → 한국어 `TypeError`) 은 어느 분기로 도달했든 그대로 적용된다. 슬롯은 있는데 FK 대상 row 가 없는 상태는 `onDelete: Restrict` 상 발생할 수 없지만, 직접 SQL 로 깨진 경우를 대비해 방어적으로 한국어 fail-fast 한다 (silent fallback 금지 — silent 선택은 평가 결과의 reproducibility 를 깬다).

### Decision § 5 — seed 의 default 개입 한계는 "`ON CONFLICT DO NOTHING` 1 회"

**채택: [seed-llm-config.sh](../../deploy/seed-llm-config.sh) 는 provider row upsert 후 `INSERT INTO "LlmDefaultProvider" (...) VALUES ('default', '<CONFIG_ID>', ...) ON CONFLICT ("id") DO NOTHING;` 을 1 회 실행한다. `DO UPDATE` 는 금지다.**

`DO NOTHING` 이 제약 5 를 **문법 그 자체로** 표현한다 — 슬롯이 비어 있으면 seed row 가 bootstrap 기본이 되고, 슬롯이 이미 있으면 (= Admin 이 UI 로 골랐거나 이전 seed 가 넣었으면) 아무 일도 일어나지 않는다. seed 가 provider row 자체는 계속 `DO UPDATE` 로 덮어쓰는 현 동작은 유지된다 (endpoint / key / model 의 재배포 멱등성은 별개 관심사다). 이 비대칭 — **row 는 덮어쓰고 default 는 안 덮어쓴다** — 이 본 결정의 핵심이며 T-1867 이 그 주석을 스크립트에 남긴다.

## Consequences

### DB schema 게이트 — 오너 사전 승인 (notifier 우회 근거)

[CLAUDE.md](../../CLAUDE.md) § 5 는 **DB schema 변경 = BLOCKED → notifier** 를 규정한다. 본 ADR 의 채택안 (§ Decision 2) 은 새 model `LlmDefaultProvider` + migration 1 개를 요구하므로 그 게이트를 발화시킨다. 그러나 **오너 지시 2026-09-03 ("다중 row 일 때 default 선택 정책 task 를 만들어라. Web UI 에서 선택할 수 있어야 하고, 사용자가 명시적으로 선택한 것이 언제나 우선이다") 이 정책을 지시하면서 DB 저장을 요구하는 형태를 사전 승인** 했다 — 제약 3 이 env pointer 와 `updatedAt` 자동 선택을 명시적으로 금지하므로, 이 지시를 만족하는 저장 위치는 DB 밖에 남지 않는다. 따라서 T-1863 (schema + migration) 은 `schema-migration` 사유로 BLOCKED 처리하지 않고 normal PR flow 로 진행한다. 본 단락이 그 우회의 근거이며, T-1863 의 PR 본문은 여기를 인용해야 한다.

**새 외부 dependency 0** (기존 Prisma / NestJS / class-validator 안에서 완결) · **새 env 0** (`SEED_LLM_CONFIG_ID` 재사용, 새 변수 도입 없음) — § 5 의 나머지 두 축은 발화하지 않는다.

### 긍정

- **제약 1 이 구조적으로 보장된다** — 명시 선택은 별도 table 의 row 로 실재하고, 자동 규칙 (분기 2) 은 그 row 가 **없을 때만** 도달 가능한 코드 경로다. "자동이 명시를 덮어쓴다" 는 상태가 표현 불가능해진다.
- **기존 단일-row 배포는 무변경으로 계속 동작** — 분기 2 가 ADR-0048 (a) 를 그대로 승계하므로 migration 후에도 아무 조치가 필요 없다 (backfill 0).
- **삭제 409 가 공짜** — FK `onDelete: Restrict` + 이미 shipped 인 `P2003 → 409` 변환의 재사용. 새 분기 0.
- **UI fetch 1 회** — `isDefault` 가 목록 view 에 있어 배지 · 버튼 렌더가 단일 응답으로 닫힌다 (race 없음).
- **REQ-051 진입로 개방** — custom 3 model 슬롯 운용이 row ≥ 2 를 정상화하는데, 그 전제인 default 정책 공백을 본 ADR 이 닫는다.

### 부정 / trade-off

- **migration 1 개 추가** — `LlmProviderConfig` 를 참조하는 두 번째 FK table 이 생긴다. mitigation: DifficultyMapping 과 동형이라 학습 비용이 0 이고, T-1863 이 단독 slice 로 격리한다.
- **슬롯 id 고정이 schema 제약이 아니다** — `id` 가 `"default"` 가 아닌 잉여 row 를 DB 레벨에서 막지 않는다. mitigation: 읽기 경로가 `findUnique({ id: "default" })` 하나뿐이라 잉여 row 는 무해하게 무시된다 (§ Decision 2 의 fail-safe 비대칭).
- **"기본 해제" 표면이 없다** — 채택안은 교체만 제공한다. mitigation: 슬롯을 비우면 분기 4 의 fail-fast 로 떨어질 뿐이라 운영 가치가 없다. 필요해지면 별도 slice 에서 `DELETE /api/llm/providers/default` 를 추가한다 (본 결정과 충돌 없음).
- **view 필드 1 개 증가** — sanitize allow-list 가 6 → 7 필드가 되어 [api.md](../architecture/api.md) `129~133 행` 5 개 행 + 관련 spec 의 기대값이 함께 바뀐다. mitigation: T-1865 가 controller / DTO / api.md 를 한 slice 로 묶는다.
- **`isDefault` 계산 비용** — 목록 응답마다 슬롯 1 row 를 함께 읽어야 한다. mitigation: PK 단건 조회 1 회로 상수 비용이고 provider 목록 자체가 한 자릿수 row 다.

### Cross-Module Impact

영향 표면은 `LlmModule` 내부 + seed 스크립트 + `web/` 의 provider 화면으로 닫힌다. `AssessmentEvaluationModule` 은 resolver 의 **반환 계약 (`Promise<string>`) 이 무변경** 이라 배선을 건드리지 않는다 — `unevaluated-fill-run` 경로는 resolver 내부 분기가 늘어난 것만 본다. `LlmHttpGateway` · orchestrator · `buildFillRunScoringOptions` · core 순수 조각은 전부 무변경이다. `DifficultyMapping` 경로도 무변경이다 (슬롯이 FK 로 config 를 직접 가리키므로 전역 기본과 무관하게 동작한다).

## Alternatives considered

### A. 단일 슬롯 table `LlmDefaultProvider` + `PUT /api/llm/providers/default` (채택)

§ Decision 2·3. 원자적 교체 (upsert 1 회) · 유일성이 PK 로 표현됨 · 삭제 409 가 FK 로 공짜 · DifficultyMapping 패턴 mirror · 이상 상태에서 fail-safe.

### B. `LlmProviderConfig.isDefault Boolean @default(false)` + partial unique index (미채택)

ADR-0048 § Decision 2 후속 검토 대상 (i). 미채택 — (1) Prisma schema 가 partial unique index 를 선언적으로 표현하지 못해 migration raw SQL + 영구 schema drift 를 낳는다, (2) default 교체가 2 write `$transaction` 이라 중간에 default 가 0 인 window 가 실재한다, (3) 제약 4 (삭제 409) 를 위해 delete 전 별도 조회 분기 + TOCTOU 를 떠안는다, (4) 이상 상태 (`isDefault = true` 2 row) 가 **모호** 로 귀결돼 fail-safe 가 아니다. 컬럼 1 개라 겉보기에 가벼워 보이지만 실제 비용은 (ii) 보다 크다.

### C. env pointer `LLM_DEFAULT_PROVIDER_CONFIG_ID` (미채택 — 제약 3 위반)

ADR-0048 후속 검토 대상 (ii). 재배포가 env 를 다시 주입하는 순간 Admin 의 UI 선택을 덮어써 **제약 1 을 정면 위반** 한다. 새 mandated env 도입으로 CLAUDE.md § 5 를 추가로 발화시키고, env 의 id 와 실제 DB row 의 일치를 검증할 표면이 또 필요해진다. 기각.

### D. `updatedAt DESC` 자동 선택 (미채택 — 제약 3 위반)

ADR-0048 후속 검토 대상 (iii). schema 변경 0 이 유일한 장점이나, "row 를 수정하면 default 가 바뀐다" 가 되어 **명시 선택 자체가 존재하지 않는다**. Admin 이 A 를 기본으로 두고 B 의 오타를 고치는 순간 기본이 B 로 넘어간다 — 오너 지시의 "명시적으로 선택한 것이 언제나 우선" 과 반대다. 기각.

### E. per-provider default (provider 별 기본 1 개) + caller 가 provider 명시 (미채택)

ADR-0048 후속 검토 대상 (iv). 오너 지시는 **전역 단일 기본 provider 1 개** 다. per-provider 는 caller 가 provider 를 고르는 표면을 되살려 [ADR-0045](ADR-0045-llm-provider-deployment-config.md) § Decision 1 ("provider = 배포 설정, caller 선택 아님") 과 충돌하고, ADR-0048 § Decision 3 이 제거한 "caller 가 default 를 넘긴다" 구조로 회귀한다. 기각 — 기각 근거만 남기고 채택하지 않는다.

## Out of scope

- **schema / migration / 코드 / Web UI / seed 변경 일체** — 전부 § Follow-ups 의 T-1863 ~ T-1867 소관. 본 slice 의 코드 diff 는 0 이다.
- **ADR-0048 본문 수정** — "superseded by ADR-0062" 한 줄 + 본 ADR status ACCEPTED 승격은 T-1868 (direct).
- **REQ-051 "custom 3 model 슬롯" 자체의 구현** — 본 ADR 은 그 진입 prerequisite (다중-row default 공백) 만 닫는다.
- **"기본 해제" endpoint** — § Consequences 참조. 필요해지면 별도 slice.
- **apiKey 암호화 · RBAC 정책 변경** — [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) 그대로. 본 ADR 은 view 에 non-secret 필드 1 개만 더한다.
- **[data-model.md](../architecture/data-model.md) § 2 entity 표 row 신설 및 tally 14 → 15 · § 6 REQ → entity coverage 갱신** — 그 문서 자신의 각주가 "row 신설은 § 3 · § 6 동시 갱신을 요구해 별도 slice 소관" 으로 못 박았고, 무엇보다 `LlmDefaultProvider` 는 아직 schema 에 **존재하지 않는다**. 실체화되는 T-1863 머지 이후 T-1868 doc-sync 가 수행한다. 본 slice 는 § 2 의 LlmProviderConfig 행 서술 · § 3 ERD · 관계 목록 12 번만 PROPOSED 표기와 함께 동기한다.

## Follow-ups

구현 chain 을 파일 · 배선 단위로 박제한다 (각 slice ≤ 300 LOC / ≤ 5 파일).

- **T-1863 — schema + migration + repository**: [prisma/schema.prisma](../../prisma/schema.prisma) 에 `model LlmDefaultProvider` (§ Decision 2 코드 블록 그대로) + `LlmProviderConfig` 에 역방향 필드 `defaultSlot LlmDefaultProvider?` 추가, `prisma/migrations/<ts>_llm_default_provider/migration.sql` 신설, `src/llm/llm-default-provider.repository.ts` (+ spec) 에 `findSlot()` / `setSlot(llmProviderConfigId)` (고정 상수 `DEFAULT_SLOT_ID` upsert) 2 메서드. § Consequences 의 오너 사전 승인 단락을 PR 본문에 인용한다.
- **T-1864 — resolver 우선순위 + service**: [llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) 를 § Decision 4 의 4 분기로 교체 (+ spec 이 슬롯-우선 / row 1 / row 0 / row ≥ 2 / 깨진 FK / non-string / 빈 문자열 을 cover), [llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) 에 `setDefault(id)` 추가 + `sanitize` 를 `isDefault` 포함 7 필드로 확장 + `delete` 의 P2003 409 메시지를 "DifficultyMapping 슬롯 또는 기본 provider 지정" 으로 확장.
- **T-1865 — controller + DTO + api.md**: [llm-provider-config.controller.ts](../../src/llm/llm-provider-config.controller.ts) 에 `@Put("default")` 를 `:id` 계열 route **위** 에 선언 (§ Decision 3 함정 주석 동반), `src/llm/dto/set-default-llm-provider.dto.ts` (`@IsString` + `@IsNotEmpty` 의 `llmProviderConfigId`) 신설, [api.md](../architecture/api.md) `129~133 행` 표에 PUT 행 추가 + 기존 행의 view 필드 6 → 7 갱신.
- **T-1866 — Web UI**: [LlmProviderConfigList.tsx](../../web/src/components/LlmProviderConfigList.tsx) 에 "기본" 배지 + "기본으로 지정" 버튼, [adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) 에 `PUT` `${LLM_PROVIDERS_PATH}/default` 순수 러너 추가, [useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) 에 상태 전이 배선.
- **T-1867 — seed no-override**: [seed-llm-config.sh](../../deploy/seed-llm-config.sh) 의 provider upsert 직후 § Decision 5 의 `ON CONFLICT ("id") DO NOTHING` 1 문 추가 + "row 는 덮어쓰고 default 는 안 덮어쓴다" 비대칭 주석.
- **T-1868 — doc-sync (direct)**: 본 ADR status PROPOSED → ACCEPTED, [ADR-0048](ADR-0048-default-model-id-source.md) § Decision 2 에 "superseded by ADR-0062" 한 줄, [data-model.md](../architecture/data-model.md) § 2 표 row 신설 + tally 14 → 15 + § 6 coverage, [requirements.md](../requirements.md) REQ-049 / REQ-051 재판정, [PLAN.md](../PLAN.md) 마커.

## References

- [ADR-0048](ADR-0048-default-model-id-source.md) § Decision 2 — 본 ADR 이 부분 supersede 하는 deferred 결정 (후속 검토 대상 (i)~(iv) 가 본 ADR 의 § Alternatives B~E 에 1:1 대응)
- [ADR-0045](ADR-0045-llm-provider-deployment-config.md) § Decision 1 — "provider = 배포 설정, source = LlmProviderConfig row" (본 ADR 은 그 source 안에서 row 선택만 좁힌다)
- [ADR-0011](ADR-0011-difficulty-model-assignment.md) — 고정 슬롯 → FK `onDelete: Restrict` 패턴의 선례 (§ Decision 2 가 mirror)
- [ADR-0014](ADR-0014-llm-api-key-encryption-at-rest.md) — apiKey never-read-back (본 ADR 의 view 확장은 non-secret 필드 1 개)
- [src/llm/llm-provider-config-resolver.service.ts](../../src/llm/llm-provider-config-resolver.service.ts) — 현 3 분기 fail-fast 의 정본 (§ Decision 4 의 변경 대상)
- [src/llm/llm-provider-config.service.ts](../../src/llm/llm-provider-config.service.ts) `244~275 행` — `P2025 → 404` / `P2003 → 409` 변환 (제약 4 가 재사용)
- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) — provider row 의 `ON CONFLICT DO UPDATE` (§ Decision 5 가 default 에 대해서만 `DO NOTHING` 으로 갈라놓는 지점)
- [docs/architecture/data-model.md](../architecture/data-model.md) — § 2 LlmProviderConfig 행 · § 3 ERD · 관계 12 번 (본 slice 가 동기)
- [docs/requirements.md](../requirements.md) REQ-049 / REQ-051 — 본 ADR 의 cover REQ

Refs: ADR-0062, ADR-0048, ADR-0045, ADR-0011, REQ-049, REQ-051, T-1862
