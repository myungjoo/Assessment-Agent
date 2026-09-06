---
id: T-1932
title: 좌표 기준 다중 person Summary 조회 primitive + service 위임 (REQ-036 배선 1/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-036]
estimatedDiff: 330
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 backbone 카테고리 × 1.5 (base 220 → 330). repository primitive + service 위임 + colocated spec 2 개의 4 layer 동시 박제이며, 본 module 의 colocated spec 실측 밀도(summary.repository.spec.ts `564 행` / 4 메서드 ≈ 140 행/메서드)가 LOC 의 지배 항이다. 파일 수 4 는 cap(≤ 5) 안."
created: 2026-09-07
independentStream: p5-req036-relative-comparison
dependsOn: [T-1931]
touchesFiles:
  - src/user/summary.repository.ts
  - src/user/summary.repository.spec.ts
  - src/user/summary.service.ts
  - src/user/summary.service.spec.ts
plannerNote: "P5 REQ-036 배선 1/3 — 좌표(period, periodStart) 기준 다중 person Summary 조회 부재. repository primitive + service 위임 동시 박제"
---

# T-1932 — 좌표 기준 다중 person Summary 조회 primitive + service 위임 (REQ-036 배선 1/3)

## Why

[docs/requirements.md](../requirements.md) `55 행` REQ-036 의 마지막 미충족 축인 "개발자 간 상대 비교 전용 산출 경로" 는 [T-1931](T-1931-summary-relative-comparison-helper.md) 이 순수 helper `computeRelativeComparison` (`src/assessment-evaluation/domain/summary-relative-comparison.ts` `223 행`) 로 산출 규칙을 닫았으나, **그 helper 에 먹일 다중 person 입력 집합을 만드는 조회 경로가 없다**. 현 조회 표면은 전부 person 단일 축이다 — [`summary.repository.ts`](../../src/user/summary.repository.ts) `95~118 행` `findByPerson` 은 `where` 가 항상 `personId` (또는 `personId` + `period`) 이고 정렬은 `periodStart: "desc"` 시계열뿐이며, [`summary.service.ts`](../../src/user/summary.service.ts) `111~124 행` 도 그 forward 다. 본 slice 는 좌표 `(period, periodStart)` 를 축으로 한 **다중 person 조회 primitive** 를 repository 에 신설하고, 같은 PR 에서 그 소비처인 service 위임 메서드까지 배선한다. [T-1931](T-1931-summary-relative-comparison-helper.md) `Follow-ups (a)` 의 ① + ② 중 ① 과 ②의 전제(조회 표면)에 해당하는 1/3 slice 다.

**issue-still-relevant pre-check (origin/main `62e46a1c` 실측)**:

1. `git grep -n "findByCoordinate" -- src web test` 히트 **0 행** — repository · service · spec 어디에도 좌표 축 조회 메서드가 없다.
2. `git grep -n "computeRelativeComparison" -- src | grep -v spec` 의 히트는 helper **자기 파일 6 행** (`1`·`74`·`114`·`142`·`147`·`156 행`) 뿐 — production 소비처 **0**. T-1931 이 남긴 배선 구멍이 그대로 유효하다.
3. [`summary.repository.ts`](../../src/user/summary.repository.ts) 의 public 메서드는 `85 행` `create` · `91 행` `findById` · `104 행` `findByPerson` · `125 행` `delete` **4 개뿐** 이고, [`summary.service.ts`](../../src/user/summary.service.ts) 도 `create` / `103 행` `findById` / `116 행` `findByPerson` / `remove` 4 개뿐이다 — 좌표 축 표면 부재 확인.
4. 즉 main 에 같은 의도가 이미 안착한 중복 task 가 아니다.

**소비처 방향 결정 (본 slice 가 helper 를 직접 호출하지 않는 이유)** — [docs/architecture/modules.md](../architecture/modules.md) `176 행` 금지 조항이 `UserModule → AssessmentModule` 을 "User 는 메타데이터, 평가 결과를 모른다" 로 금지하고 `179 행` 이 평가 module 을 하위 consumer 로 못박는다. 따라서 `src/user/summary.service.ts` 가 `src/assessment-evaluation/domain/` 의 helper 를 import 하면 의존 방향이 역전된다. `computeRelativeComparison` 호출은 **평가 쪽 read-adapter** 가 맡아야 하며 (선례: [`evaluation-persisted-records-reader.service.ts`](../../src/assessment-evaluation/evaluation-persisted-records-reader.service.ts) `32 행` 이 `AssessmentService` 를 주입하는 `evaluation → user` 단방향), 본 slice 는 그 adapter 가 호출할 **user 쪽 조회 표면만** 박제한다. helper 호출 배선은 `Follow-ups (a)`.

**오너 지시 게이트 pre-check**:

- [PLAN](../PLAN.md) `157 행` (R-91 k6 최우선): 본 slice 는 `test/load/` · `.github/workflows/` · `package.json` 미접촉. R-91 의 잔여 축은 `161 행` 이 밝히듯 자격증명 0 · `LOAD_TEST_STUB=1` 로 **자율 집행 불가** 라 경합이 아니다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 중단): `test/perf/` 에 파일을 만들지도 고치지도 않는다.
- [PLAN](../PLAN.md) `182 행` (소비처 동반 의무): 본 slice 는 repository primitive 의 **소비처(service 위임)를 같은 PR 에 포함** 해 의무를 충족한다. 그보다 상위 소비처(평가 read-adapter + controller endpoint)까지 합치면 파일 7 · 약 700 LOC 로 cap 이중 초과라 `Follow-ups (a)`/`(b)` 에 파일 · 심볼 단위로 명시한다.
- [PLAN](../PLAN.md) `183 행` (REQ 재판정 1 회): 본 slice 는 `docs/requirements.md` 를 건드리지 않는다. REQ-036 재판정은 배선 3/3 머지 뒤 **1 회만** (`Follow-ups (d)`).

## Required Reading

- [src/user/summary.repository.ts](../../src/user/summary.repository.ts) `44~50 행` (import · PrismaService 주입) · `72~77 행` (`SummaryFindByPersonOptions` 형식) · `95~118 행` (`findByPerson` 주석 + 2 분기 body) — 신설 메서드가 1:1 mirror 할 서술 · 반환 계약(매칭 0 → `[]`) 원본.
- [src/user/summary.service.ts](../../src/user/summary.service.ts) `56 행` (`VALID_PERIODS`) · `111~124 행` (`findByPerson` 의 literal 검증 후 forward 패턴) · `142~152 행` (`assertValidPeriod` private helper) — 신설 위임 메서드가 재사용할 검증 경로.
- [src/user/summary.repository.spec.ts](../../src/user/summary.repository.spec.ts) `66~69 행` (`buildPrismaMock` 셋업) · `384~532 행` (`describe("findByPerson()")`) — colocated spec 의 mock 인자 단언 방식 mirror 대상.
- [src/user/summary.service.spec.ts](../../src/user/summary.service.spec.ts) `84~88 행` (repository mock 셋업) · `269~326 행` (`describe("findByPerson()")`) — service spec 의 검증 · forward 단언 mirror 대상.
- [prisma/schema.prisma](../../prisma/schema.prisma) `361~380 행` `Summary` model — `377 행` `@@unique([personId, period, periodStart])` (좌표당 person 1 행 보장 = 하류 helper 의 중복 personId 계약 근거) · `379 행` `@@index([personId, period, periodStart])` (leftmost prefix 가 `personId` 라는 사실이 아래 설계 계약의 index 자인 근거). **본 task 에서 수정 금지.**
- [src/assessment-evaluation/domain/summary-relative-comparison.ts](../../src/assessment-evaluation/domain/summary-relative-comparison.ts) `54~83 행` (`RelativeComparisonEntry` / `PersonRelativeStanding` / `RelativeComparisonResult` 필드) — 하류 소비 형태 확인용 **read-only** (본 task 에서 import 금지 · 수정 금지).
- [docs/architecture/modules.md](../architecture/modules.md) `176`·`179 행` — 의존 방향 금지 조항 (위 Why 의 소비처 방향 결정 근거).
- [CLAUDE.md](../../CLAUDE.md) `§3.2` (R-110 · R-112) · `§12` (언어 정책 · `§ 12.76` 행 범위 표기).

## 설계 계약 (구현자가 임의로 바꾸지 않는다)

### (1) `SummaryRepository.findByCoordinate`

```
async findByCoordinate(period: string, periodStart: Date): Promise<Summary[]>
```

- body 는 `this.prisma.summary.findMany({ where: { period, periodStart }, orderBy: { personId: "asc" } })` **한 문장** — 분기 0. 기존 `findByPerson` 과 달리 옵션 분기가 없으므로 `SummaryFindByCoordinateOptions` 같은 새 interface 를 만들지 않는다.
- 정렬이 `personId: "asc"` 인 이유를 주석으로 박제 — 하류 `computeRelativeComparison` 의 **동점 내부 순서 = 입력 최초 등장 순서** 규약이 결정적이려면 입력 배열 순서 자체가 결정적이어야 한다 (`periodStart` 는 좌표로 고정되므로 시계열 정렬은 의미 없음).
- 매칭 row 0 시 Prisma `findMany` native 동작대로 빈 배열 `[]` 반환 (throw 0 · null 0). `period` literal 검증은 하지 않는다 (service-layer 책임, `findByPerson` 과 동일 경계).
- **index 자인 주석 의무** — `379 행` `@@index([personId, period, periodStart])` 의 leftmost prefix 는 `personId` 라서 `where: { period, periodStart }` 는 이 index 를 타지 못한다. 새 index 추가는 schema 변경이라 [CLAUDE.md](../../CLAUDE.md) `§5` DB schema 게이트 대상 → **본 slice 에서 하지 않는다**. 그 사실을 주석 2~3 행으로 자인하고 `Follow-ups (c)` 로 넘긴다 (미소비 자인 주석의 선례 형식은 T-1925 → T-1926 arc).

### (2) `SummaryService.findByCoordinate`

```
async findByCoordinate(period: string, periodStart: Date): Promise<Summary[]>
```

- (a) `this.assertValidPeriod(period)` 로 기존 literal 검증 재사용 (`146 행` 의 private helper — **새 검증 helper 를 만들지 않는다**). 허용 집합 밖이면 기존 메시지 형식 그대로 `BadRequestException`.
- (b) `periodStart` 방어 — `periodStart instanceof Date` 가 false 이거나 `Number.isNaN(periodStart.getTime())` 이면 `BadRequestException` (한국어 아닌 기존 service 의 영문 메시지 관행을 따르되 `invalid periodStart:` prefix 로 통일). 이 분기가 본 메서드의 유일한 신규 분기다.
- (c) 검증 통과 시 `return this.repository.findByCoordinate(period, periodStart)` — 결과 가공 0 · Decimal 변환 0 · 정렬 재조정 0.
- 매칭 0 시 빈 배열 그대로 반환 (`NotFoundException` 던지지 않음 — 컬렉션 조회의 정상 결과, `findByPerson` 정합). repository rejection 은 변환 없이 전파 (본 경로에 P2003/P2025 발생 표면 없음).

### (3) LOC 예산 (초과 시 주석 · spec 케이스를 줄여 맞춘다)

| 파일 | 예산 |
| --- | --- |
| `src/user/summary.repository.ts` | +30 |
| `src/user/summary.repository.spec.ts` | +120 |
| `src/user/summary.service.ts` | +35 |
| `src/user/summary.service.spec.ts` | +120 |

## Acceptance Criteria

- [ ] `src/user/summary.repository.ts` 에 위 계약의 `findByCoordinate` 가 신설되고, `where: { period, periodStart }` + `orderBy: { personId: "asc" }` 단일 호출임을 spec 이 mock 인자로 단언한다. 기존 4 메서드 시그니처 · body 변경 **0**.
- [ ] `src/user/summary.service.ts` 에 위 계약의 `findByCoordinate` 가 신설되고, 기존 `assertValidPeriod` 를 재사용한다 (새 검증 helper · 새 상수 **0**). 기존 4 메서드 변경 **0**.
- [ ] **happy-path unit test** — public symbol 별 1+ : (i) repository — person 3 명 row 를 반환하는 Prisma mock 에서 반환 배열이 mock 반환값과 동일하고 `findMany` 가 정확히 1 회, 위 인자 형태로 호출됨 (ii) service — 유효 `period` + 유효 `Date` 입력에서 repository 반환이 가공 없이 그대로 전달됨.
- [ ] **error path unit test** — (i) service `period` 가 허용 집합 밖(`"year"`) 일 때 `BadRequestException` 이고 repository 호출 **0** (ii) `periodStart` 가 `Date` 아님(문자열) 일 때 `BadRequestException` + repository 호출 0 (iii) `periodStart` 가 `Invalid Date` 일 때 `BadRequestException` + repository 호출 0 (iv) repository 가 reject 할 때 service 가 그 rejection 을 변환 없이 전파. 각 1+ 케이스.
- [ ] **분기별 test** — service 의 분기 3 개(literal 실패 / `periodStart` 실패 / 정상 forward) 각 1+ `it`. repository 는 분기가 없으므로 (본문 단일 문장) 해당 항목은 happy-path + 빈 결과 2 케이스로 대체하고 그 사실을 spec 주석에 명시한다.
- [ ] **negative case test (예외 분기마다 1+)** — 최소 5 종: ① 매칭 row 0 일 때 repository 가 `[]` 를 반환하고 throw 하지 않음 ② 같은 조건에서 service 도 `[]` 를 반환하고 `NotFoundException` 을 던지지 않음 ③ repository 가 `period` literal 검증을 **하지 않음** (허용 집합 밖 값이 그대로 `where` 로 forward 됨 — layer 경계 단언) ④ service 가 반환 배열의 순서 · 원소를 재가공하지 않음(반환 참조 동일성 또는 deep-equal) ⑤ `VALID_PERIODS` 3 값(`"day"`/`"week"`/`"month"`) 각각이 통과함.
- [ ] spec 은 신규 파일 없이 기존 colocated spec 2 개(`src/user/summary.repository.spec.ts` · `src/user/summary.service.spec.ts`)에 `describe("findByCoordinate()")` 를 각각 1 개씩 추가하는 방식으로 확장한다 (`test/helpers/` 추가 **0**).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`), 변경 파일 2 개는 statement · branch · function · line 100% 유지.
- [ ] `git diff --stat` 의 변경 파일이 frontmatter `touchesFiles` 4 개뿐이다 (`prisma/schema.prisma` · `src/assessment-evaluation/**` · `docs/requirements.md` · `docs/PLAN.md` 전부 미접촉, task 파일 status 갱신은 별개).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 준수 — 주석 · spec describe/it 문자열은 한국어, 식별자 · 경로는 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `104 행`, `L` prefix 금지).

## Out of Scope

- **`computeRelativeComparison` 호출 금지** — `src/user/**` 에서 `src/assessment-evaluation/**` 을 import 하지 않는다 ([modules.md](../architecture/modules.md) `176`·`179 행` 의존 방향). helper 배선은 `Follow-ups (a)`.
- **Decimal → number 변환 금지** — `Summary.metricScore` 는 `Decimal` 그대로 반환한다. 변환은 helper 를 호출하는 평가 쪽 adapter 책임 (`Follow-ups (a)`).
- controller endpoint · query DTO · RBAC 신설 (`Follow-ups (b)`).
- `prisma/schema.prisma` 변경 · 새 index · migration ([CLAUDE.md](../../CLAUDE.md) `§5` DB schema 게이트 — 필요해지면 BLOCKED 대상, `Follow-ups (c)`).
- 기존 `findByPerson` / `create` / `findById` / `delete` / `remove` 의 시그니처 · 정렬 · 분기 변경.
- `docs/requirements.md` REQ-036 재판정 · `docs/PLAN.md` checkbox 승격 (PLAN `183 행` once-rule — `Follow-ups (d)`).
- `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 접촉 (PLAN `157`·`158 행` 게이트).
- ADR 신설 (기존 ADR-0006 repository 경계 + ADR-0035 좌표 계약 안의 조회 표면 추가라 새 결정 없음).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **배선 2/3 — 평가 쪽 read-adapter**: `src/assessment-evaluation/` 에 `SummaryRelativeComparisonReader`(가칭) 신설 — `SummaryService`(UserModule 이 `205 행` 에서 export) 주입 → `findByCoordinate` 호출 → `Summary.metricScore`(Decimal) 를 `Number()` 로 `RelativeComparisonEntry` 로 매핑 → `computeRelativeComparison` 위임. 파일: 신규 service + colocated spec + `assessment-evaluation.module.ts` provider/export 등록 3 개.
- (b) **배선 3/3 — HTTP 표면**: 좌표 조회 endpoint 1 개 + query DTO 1 개 + colocated spec (RBAC 는 기존 `summary.controller.ts` `@Roles` 관행 mirror). 배치 module 은 (a) 의 결론을 따른다.
- (c) **좌표 축 index 검토** — `where: { period, periodStart }` 가 `@@index([personId, period, periodStart])` 의 leftmost prefix 를 못 타는 문제. schema 변경이라 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트 — 실 데이터 규모에서 지연이 관측된 뒤에만 ADR + BLOCKED 경유로 판단한다 (선제 index 추가 금지).
- (d) **REQ-036 재판정 1 회** — (a)·(b) 가 머지된 뒤에만 `docs/requirements.md` `55 행` 1 회 (PLAN `183 행` once-rule). 본 slice 및 중간 단계에서는 재판정하지 않는다.
