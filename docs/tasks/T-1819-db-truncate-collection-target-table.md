---
id: T-1819
title: Add CollectionTarget to the truncateAll table list
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-070, REQ-072, REQ-073]
independentStream: collection-target-backend
dependsOn: [T-1808]
touchesFiles:
  - test/helpers/db-truncate.ts
  - test/helpers/db-truncate.spec.ts
estimatedDiff: 90
estimatedFiles: 2
created: 2026-08-31
plannerNote: ADR-0059 Follow-ups (d) e2e 의 선행 격리 조각 — truncateAll 명단에 CollectionTarget 추가로 @@unique 누수 차단
---

# T-1819 — truncateAll 대상 테이블 명단에 CollectionTarget 추가

## Why

[ADR-0059](../decisions/ADR-0059-collection-target-registration.md) `§Follow-ups` chain 의 (a)
schema · (b) repository/service · (c) DTO+controller 5 route 가 T-1808 ~ T-1818 로 전량 머지되어
다음 조각은 **(d) e2e 로 오류 계약 고정** 이다. 그런데 그 e2e 는 `CollectionTarget` row 를 직접
seed 해야 하고, 본 model 에는 `@@unique([type, instanceKey])`(`prisma/schema.prisma` `706 행`) 가
걸려 있는데 [db-truncate.ts](../../test/helpers/db-truncate.ts) 의 `TRUNCATE_TABLES` 7 테이블
명단에 `"CollectionTarget"` 이 **없다**. 이 상태로 e2e 를 쓰면 앞선 test 가 남긴 row 때문에 뒤
test 의 등록이 의도치 않은 409 로 깨지는 test 간 state leak 이 구조적으로 발생한다 (`P2002` →
409 를 검증해야 할 slice 에서 특히 치명적 — 진짜 409 와 잔여 row 로 인한 409 를 구분할 수 없다).

따라서 (d) 본체를 쓰기 전에 **격리 기반만 먼저** 확정한다. 본 slice 는 `"PermissionDeniedRecord"`
를 명단에 추가했던 T-0208 선례와 동형이며, `TRUNCATE_TABLES` 를 `toEqual` 로 고정하는 drift guard
spec 이 같은 commit 에서 함께 갱신돼야 한다 (helper 1 개 + drift guard 1 개 = 2 파일 확정 diff).
본 조각이 머지되면 후속 e2e slice 는 **1 파일 diff** 로 cap 300 LOC 전량을 test 에 쓸 수 있다.

## Required Reading

- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `TRUNCATE_TABLES` 상수와
  `truncateAll` 본체, 그리고 테이블 추가 근거를 병기해 온 주석 관례 (T-0087 `"User"` / T-0208
  `"PermissionDeniedRecord"`).
- [test/helpers/db-truncate.spec.ts](../../test/helpers/db-truncate.spec.ts) — `51 행` 부근의
  `expect(TRUNCATE_TABLES).toEqual([...])` drift guard 와 R-112 4 종 구성.
- [prisma/schema.prisma](../../prisma/schema.prisma) `690~707 행` — `model CollectionTarget`
  (`@@map` 부재 → 실 테이블명은 PascalCase `"CollectionTarget"`) 과 `@@unique([type, instanceKey])`.
- [docs/decisions/ADR-0059-collection-target-registration.md](../decisions/ADR-0059-collection-target-registration.md)
  `§Decision 4` (유일성 제약 근거) 와 `§Follow-ups (d)` (본 slice 가 선행하는 e2e 조각).

## Acceptance Criteria

- [ ] `TRUNCATE_TABLES` 에 `'"CollectionTarget"'` 을 **8 번째 원소로 append** 하고, 기존 7 원소의
      값과 순서는 그대로 보존한다 (`"Person"` ~ `"PermissionDeniedRecord"`).
- [ ] [db-truncate.ts](../../test/helpers/db-truncate.ts) 주석의 테이블 개수 표기(`7 테이블` /
      `7 도메인 테이블`)를 8 로 정정하고, 추가 근거 1~2 줄을 T-0208 주석 관례대로 병기한다
      (`@@unique([type, instanceKey])` 때문에 잔여 row 가 후속 test 의 등록을 409 로 깨뜨림 —
      ADR-0059 `§Follow-ups (d)` e2e 의 격리 전제).
- [ ] happy-path test 1+ — `truncateAll` 이 만든 SQL 안에 `"CollectionTarget"` 이 **quoted
      identifier 형태로** 포함된다 (기존 "모든 테이블 substring 포함" test 와 별개로 신규 원소를
      직접 지목하는 anchor 1 개).
- [ ] drift guard 갱신 — `expect(TRUNCATE_TABLES).toEqual([...])` 를 8 원소로 갱신하고, spec 의
      개수 표기 주석(`7 테이블` 등)도 함께 정정한다.
- [ ] error path test — 기존 2 종(`$executeRawUnsafe` reject propagate / `prisma` null 시
      TypeError)이 테이블 8 개 상태에서도 그대로 통과함을 유지한다. 본 slice 는 helper 시그니처를
      바꾸지 않으므로 새 error path 는 추가하지 않는다 (변경 없음을 spec 실행으로 확인).
- [ ] 분기 cover — `truncateAll` 은 단일 `await` 로 **분기 없음**. 본 항목은 해당 없음으로
      생략하며, 그 사실을 spec 머리 주석에 명시한다.
- [ ] negative cases 충분 cover — 각 1+ test: (1) `TRUNCATE_TABLES` 에 `"CollectionTarget"` 이
      **중복 등장하지 않는다**(정확히 1 회), (2) 기존 7 원소가 **prefix 로 보존**된다(순서 회귀
      차단), (3) SQL 이 따옴표 없는 맨몸 `CollectionTarget` 토큰을 단독으로 포함하지 않는다
      (quoted identifier 누락 회귀 차단), (4) 명단 길이가 정확히 8 이다(초과 append 차단).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green (기존 spec 회귀 0).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `test/helpers/*` 는 `src/**` coverage
      scope 밖이라 수치 영향은 없어야 하며, 임계 하락이 없음을 확인한다.
- [ ] CI 의 `test:smoke` · `test:e2e` step 이 green — truncate 대상 확대가 기존 smoke/e2e 의 seed
      전제를 깨지 않음을 실 DB 경로에서 확인한다 (특히 `"CollectionTarget"` 은 FK 가 0 이라
      CASCADE 파급이 없어야 한다).

## Out of Scope

- **`test/e2e/collection-targets.e2e-spec.ts` 신설 자체** — ADR-0059 `§Follow-ups (d)` 본체는
  후속 slice 소관이다. 본 task 는 격리 기반만 만든다.
- `test/e2e/persons.e2e-spec.ts` · `test/smoke/{groups,parts,persons}.smoke-spec.ts` 4 개 파일의
  `7 도메인 테이블` **주석** 정정 — 6 파일이 되어 cap 을 넘긴다. Follow-ups 로 이월.
- `LlmProviderConfig` 등 현재 명단 밖 다른 테이블 추가 — 각자 별도 근거·slice 소관.
- `src/` · `prisma/` · `docs/architecture/` 변경 0. schema · migration · route · service 는 모두
  불변이다.
- api.md · requirements.md doc-sync (`§Follow-ups (f)`) 는 `direct` 라 본 `pr` slice 와 혼합 금지
  ([CLAUDE.md](../../CLAUDE.md) §3.1 규칙 3).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (본 slice 머지 후) ADR-0059 `§Follow-ups (d)` — `test/e2e/collection-targets.e2e-spec.ts` 로
  `§Decision 5` 오류 표 a ~ e 5 행을 실 HTTP 로 고정. 분량상 auth·RBAC 축(401 / 403)과 도메인
  오류 축(409 / 404 / 400) 2 slice 로 나눌 것을 권장.
- `7 도메인 테이블` 주석이 stale 로 남는 4 개 spec(`persons.e2e-spec.ts`,
  `groups.smoke-spec.ts`, `parts.smoke-spec.ts`, `persons.smoke-spec.ts`) 의 표기 정정 — 인접
  PR 의 nit-closure 로 흡수 가능.
