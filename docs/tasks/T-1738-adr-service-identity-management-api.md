---
id: T-1738
title: ADR — 인원별 ServiceIdentity 관리 API 계약 (route shape · primary invariant · RBAC · 오류 계약)
phase: P6
status: DONE
commitMode: pr
prNumber: 1368
coversReq: [REQ-078, REQ-079]
independentStream: p6-service-identity-api
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0058-service-identity-management-api.md
estimatedDiff: 225
estimatedFiles: 1
created: 2026-08-27
completedAt: 2026-08-27T16:57:18Z
plannerNote: "PLAN 132 행(REQ-078/079) 진입 — 오너가 'API 설계는 architect ADR 동반' 을 명시한 축의 ADR-우선 첫 slice (doc-only 신규 ADR × 1.6)"
---

# T-1738 — ADR: 인원별 ServiceIdentity 관리 API 계약

## Why

[PLAN.md](../PLAN.md) `132 행` 의 오너 지시(2026-08-26, REQ-078 / REQ-079)는 아직 `[ ]` 이고 착수
slice 가 **0** 이다. 지시의 실측 근거는 `origin/main` 에서 그대로 재확인된다 — `prisma/schema.prisma`
`257~275 행` 에 `ServiceIdentity` model 이 있고 [service-identity.repository.ts](../../src/user/service-identity.repository.ts)
가 `findByPersonId` / `create` / `setPrimary` / `delete` 4 primitive 를 이미 제공하지만,
`git grep "identities" -- "src/**/*.controller.ts"` 결과가 **0 건** 이라 HTTP 로 노출된 경로가 없다.
즉 UI 로 추가한 인원은 이름 / email 만 갖고 GitHub · Confluence 수집 대상으로 연결되지 않는다.

직전 완결된 [PLAN.md](../PLAN.md) `131 행` chain(T-1722 ~ T-1737)과 달리 본 축은 **backend API 신설**
이 선행이라, 첫 slice 를 코드가 아니라 **결정 박제** 로 잡는다. 근거 두 가지:

- **오너 지시가 명시** — `132 행` 본문이 "API 설계는 architect ADR 동반" 이라고 못 박았다.
- **[CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저"** — route shape(nested vs flat) · primary
  invariant 를 어느 layer 가 강제하는가 · PATCH 의 갱신 축 · `P2002` / `P2025` 를 어떤 HTTP status 로
  변환하는가는 서로 얽혀 있고, slice 마다 재추론하면 controller · service · web 패널이 각자 다른 가정을
  갖게 된다. [ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md)(T-1559) 과 동형으로 1 회 박제한다.

본 task 는 **결정 전용(코드 0 LOC)** 이다. DTO · service · controller · e2e · AdminView 패널은 전부
본 ADR 의 §Follow-ups 로 이월한다. DB schema 변경은 **하지 않는다**(model 이 이미 존재 — [CLAUDE.md §5](../../CLAUDE.md)
의 schema-변경 BLOCKED 게이트에 닿지 않음을 ADR 본문이 명시한다).

## Required Reading

- [prisma/schema.prisma](../../prisma/schema.prisma) `249~275 행` — `ServiceIdentity` model
  (`personId` · `service` · `externalId` · `isPrimary` · `@@unique([personId, service])` ·
  `onDelete: Cascade`). 본 ADR 이 결정할 API 의 데이터 계약 정본. **수정 금지**(schema 변경 0).
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — 이미 존재하는
  4 primitive 시그니처와 그 헤더 주석의 책임 경계(“invariant 강제는 service layer 책임”,
  `P2002` / `P2025` 를 catch 하지 않고 propagate). **`update` 메서드가 없다** 는 사실이 §Decision 3
  (PATCH 갱신 축) 의 입력. **수정 금지**.
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `1~50 행` — `@Controller("api/persons")`
  + controller-scope `ValidationPipe({whitelist, forbidNonWhitelisted, transform})` 관례와 헤더 주석의
  "ServiceIdentity nested endpoint 미노출" 문구. route 를 붙일 자리의 현행 규약. **수정 금지**.
- [docs/architecture/api.md](../architecture/api.md) `76~81 행`(UC-03 `/api/persons` 5 행 + 권한 컬럼)
  과 `166 행` · `168 행`(201 / 204 status 실측 표). 신규 endpoint 가 따라야 할 표기·status 관례.
  **수정 금지** — api.md 동기는 별도 slice.
- [docs/architecture/data-model.md](../architecture/data-model.md) `23 행` · `66 행` — REQ-023(1:N) /
  REQ-024(1 primary) / REQ-025(absent row 로 NULL 표현) 의 정본 서술. **수정 금지**.
- [docs/requirements.md](../requirements.md) `97~98 행` — REQ-078 / REQ-079 row 본문과 verification 컬럼.
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md)
  — frontmatter · 절 구성(Status / Context / Decision / Consequences / Alternatives considered /
  Out of scope / References / Follow-ups) mirror 대상.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0058-service-identity-management-api.md` 신설. frontmatter 는 ADR-0056 과 동형
      (`id: ADR-0058`, `title`, `status: ACCEPTED`, `date: 2026-08-27`, `relatedTask: [T-1738]`,
      `relatedReq: [REQ-078, REQ-079]`, `supersedes: null`) + 절 구성 동형.
- [ ] **§Decision 1 — route shape**: `/api/persons/:personId/identities` nested 안과 `/api/service-identities`
      flat 안 중 **하나** 를 채택하고 나머지를 §Alternatives 로 내린다. 채택안의 method × path 목록
      (조회 · 추가 · 수정 · 삭제 + primary 지정 경로)을 표 1 개로 못 박고, 각 행의 성공 status 를
      api.md `166 행` · `168 행` 관례(POST 201 / DELETE 204)에 정합하게 명시.
- [ ] **§Decision 2 — primary invariant 강제 지점**: REQ-024 "1 인원 1 primary" 를 **service layer** 가
      강제한다는 것을 못 박고, repository 의 `setPrimary` transaction 을 재구현하지 않고 재사용함을 명시.
      **0 primary 상태의 허용 여부**(첫 identity 추가 시 자동 primary 승격 여부, 마지막 primary 삭제 시
      동작)를 명시적으로 결정한다 — "미결" 로 남기지 않는다.
- [ ] **§Decision 3 — PATCH 의 갱신 축**: 무엇을 수정 가능하게 할지(`externalId` · `isPrimary` ·
      `service` 각각)를 축별로 허용/금지로 결정하고 근거를 1 구절씩 붙인다. repository 에 `update`
      메서드가 없다는 사실을 근거로 **repository 확장이 후속 slice 에서 필요한지** 를 §Follow-ups 로 연결.
      부분 갱신 semantic 은 person PATCH(api.md `80 행` RFC-7396 merge patch)와 정합시킨다.
- [ ] **§Decision 4 — RBAC**: 조회 `User+` / 편집(추가 · 수정 · 삭제 · primary 지정) `Admin+` 로
      REQ-073 · api.md `77~81 행` 권한 컬럼과 일관되게 결정하고, 적용 수단(`@Roles` + `RolesGuard`)을 명시.
- [ ] **§Decision 5 — 오류 계약**: Prisma error → HTTP 변환표를 박제한다. 최소 (a) `P2002`
      (`personId+service` 중복) → 409, (b) `P2025`(row 부재) → 404, (c) 미존재 `personId` 로의 추가 요청
      처리, (d) `service` 값 검증 실패 → 400. 응답 body 형태는 [signupError.ts](../../web/src/api/signupError.ts)
      가 이미 소비하는 class-validator `message` 계약과 충돌하지 않아야 함을 1 구절로 명시.
- [ ] **§Decision 6 — `service` 값의 허용 목록 정본**: schema 가 `String` 이고 enum 이 아니라는 사실을
      전제로, 허용 값의 정본을 어디에 둘지(예: 상수 목록 / 자유 문자열 + 형식 검증)를 결정한다.
      Prisma enum 격상은 **비채택** 으로 두고 근거를 명시(기존 enum-as-String 관례 정합).
- [ ] **§Consequences** 에 부정적 귀결 2+ — 최소 (a) nested route 채택 시 person 부재 검사 1 회 추가로
      인한 query 증가, (b) `service` 를 자유 문자열로 두면 오타 매핑이 수집 0 건으로 조용히 이어지는 잔여 위험.
- [ ] **§Alternatives considered** 에 미채택 2+ 안을 근거와 함께 박제(예: flat route / person PATCH body
      안에 identities 배열을 통째로 넣는 replace-all 안 / Prisma enum 격상).
- [ ] **§Out of scope** 에 명시: DB schema 변경 0 · 수집 파이프라인([collection-entry.service.ts](../../src/assessment-collection/collection-entry.service.ts))
      변경 0 · web 패널 신설 0 · api.md 동기 0.
- [ ] **§Follow-ups** 에 후속 slice 를 순서와 함께 나열: (a) DTO + service(invariant 강제),
      (b) controller + RBAC 배선, (c) e2e 로 오류 계약 고정, (d) AdminView 편집 UI, (e) api.md ·
      requirements.md doc-sync. 각 항목에 ≤300 LOC / ≤5 파일 + R-112 준수 의무를 1 구절씩 병기.
- [ ] **완료 선언 0** — 본 ADR 은 PLAN `132 행` 을 `[x]` 로 바꾸지 않고 REQ-078 / REQ-079 의
      `PLANNED` status 도 바꾸지 않는다. 그 사실을 ADR 본문에 1 구절로 명시.
- [ ] **§12 범위 표기 규약 준수** — 행 범위는 물결 `~` 하나(`249~275 행`), 단일 행은 `80 행`,
      `L` prefix 금지. ADR 은 규약 적용 5 문서군에 속한다.
- [ ] `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경 **0**
      (결정 전용). 신규 public symbol 신설 0 · 분기 0 이므로 **R-112 의 happy-path / error path /
      분기 cover / negative cases 4 항목은 본 doc-only ADR 에 미적용** — 그 사실을 task Result 에 명시한다.
- [ ] `tester` 가 **R-110 검증** 수행: `pnpm lint && pnpm build && pnpm test` 실행으로 회귀 0 확인
      (코드 변경 0 이어도 pr-mode 는 tester 호출 의무). 기존 coverage 게이트(line ≥ 80% / function ≥ 80%)가
      본 변경으로 흔들리지 않음을 함께 확인.

## Out of Scope

- **코드 1 LOC 도 쓰지 않는다** — DTO · service · controller · repository `update` 메서드 · spec 신설 전부 금지.
- **`prisma/schema.prisma` 수정 금지** — model 이 이미 존재하므로 schema 변경 0 (변경하면 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 대상).
- **`docs/architecture/api.md` · `docs/requirements.md` · `docs/PLAN.md` 수정 금지** — doc-sync 는 별도 slice.
- **web 패널(AdminView · PersonList) 수정 금지** — REQ-079 UI 는 후속 slice.
- **새 외부 dependency 추가 금지** — 본 축은 기존 NestJS · Prisma · class-validator 만으로 성립한다.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
