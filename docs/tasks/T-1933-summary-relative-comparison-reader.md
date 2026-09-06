---
id: T-1933
title: 좌표 상대 비교 read-adapter 신설 + module DI 배선 (REQ-036 배선 2/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-036]
estimatedDiff: 330
estimatedFiles: 4
sizeExempt: true
exemptReason: "R-112 backbone 카테고리 × 1.5 (base 220 → 330). 동형 선례 read-adapter 의 main 실측 mass 가 evaluation-persisted-records-reader.service.ts `116 행` + colocated spec `192 행` = 308 행이고, 여기에 module provider/export 등록(+14) · module.spec DI resolve 단언(+30) 이 더해져 cap 을 구조적으로 넘는다. 파일 수 4 는 cap(≤ 5) 안."
created: 2026-09-06
independentStream: p5-req036-relative-comparison
dependsOn: [T-1931, T-1932]
touchesFiles:
  - src/assessment-evaluation/summary-relative-comparison-reader.service.ts
  - src/assessment-evaluation/summary-relative-comparison-reader.service.spec.ts
  - src/assessment-evaluation/assessment-evaluation.module.ts
  - src/assessment-evaluation/assessment-evaluation.module.spec.ts
plannerNote: "P5 REQ-036 배선 2/3 — T-1931 helper 와 T-1932 조회 표면을 잇는 평가 쪽 read-adapter + module DI 등록"
---

# T-1933 — 좌표 상대 비교 read-adapter 신설 + module DI 배선 (REQ-036 배선 2/3)

## Why

[docs/requirements.md](../requirements.md) `55 행` REQ-036 의 마지막 미충족 축 "개발자 간 상대 비교 전용 산출 경로" 는 양 끝이 이미 박제됐으나 **가운데가 비어 있다** — [T-1931](T-1931-summary-relative-comparison-signal.md) 이 산출 규칙을 순수 helper `computeRelativeComparison` 으로 닫았고, [T-1932](T-1932-summary-coordinate-cohort-query.md) 가 그 helper 에 먹일 다중 person 입력 집합의 조회 표면 (`SummaryService.findByCoordinate`) 을 닫았지만, **둘을 잇는 배선이 없어 helper 의 production 소비처가 여전히 0** 이다. 본 slice 는 평가 module 쪽에 얇은 read-adapter 를 신설해 `findByCoordinate` → `Decimal` → `number` 매핑 → `computeRelativeComparison` 위임의 한 경로를 닫고, 같은 PR 에서 그 adapter 를 module provider/export 로 등록해 DI 로 resolve 되게 만든다. [T-1932](T-1932-summary-coordinate-cohort-query.md) `Follow-ups (a)` 그대로다.

**issue-still-relevant pre-check (origin/main `ca4b07ba` 실측)**:

1. `git grep -n "computeRelativeComparison" origin/main -- src | grep -v spec` 의 히트는 helper **자기 파일 6 행** (`1`·`74`·`114`·`142`·`147`·`156 행`) 뿐 — production 소비처 **0**. T-1931 이 남긴 배선 구멍이 그대로 유효하다.
2. `git grep -rn "RelativeComparisonReader|relative-comparison" origin/main -- src` 의 히트는 helper 파일과 그 colocated spec **2 개뿐** — read-adapter 심볼 · 파일 부재 확인.
3. 반대로 전제 2 개는 **이미 main 에 안착** 했다 — `git grep -n "findByCoordinate" origin/main -- src/user/summary.repository.ts src/user/summary.service.ts` 가 repository `120`·`137 행` · service `126`·`136`·`146 행` 을 반환한다 (T-1932, main `14db8ff7`). 즉 본 slice 는 재큐잉이 아니라 **미착수 잔여 구간** 이다.
4. DI 전제도 충족 — [`user.module.ts`](../../src/user/user.module.ts) `205 행` 이 `SummaryService` 를 export 하고, [`assessment-evaluation.module.ts`](../../src/assessment-evaluation/assessment-evaluation.module.ts) `79 행` 이 이미 `UserModule` 을 import 중이라 **새 module import 0** 으로 주입이 resolve 된다.

**의존 방향** — [docs/architecture/modules.md](../architecture/modules.md) `176`·`179 행` 이 `UserModule → AssessmentModule` 을 금지하고 평가 module 을 하위 consumer 로 못박으므로, helper 호출은 평가 쪽이 맡는다. 본 adapter 는 그 단방향 (`evaluation → user`) 선례인 [`evaluation-persisted-records-reader.service.ts`](../../src/assessment-evaluation/evaluation-persisted-records-reader.service.ts) `49 행` 의 constructor DI 패턴을 그대로 mirror 한다.

**오너 지시 게이트 pre-check**:

- [PLAN](../PLAN.md) `157 행` (R-91 k6 최우선): 본 slice 는 `test/load/` · `.github/workflows/` · `package.json` 미접촉. R-91 잔여 축은 자격증명 0 이라 자율 집행 불가 — 경합 아님.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 중단): `test/perf/` 에 파일을 만들지도 고치지도 않는다.
- [PLAN](../PLAN.md) `182 행` (소비처 동반 의무): 본 slice 는 adapter 신설과 **그 DI 소비 지점 (module provider/export 등록 + module.spec resolve 단언)** 을 같은 PR 에 넣어 "미배선 채로 파일만 늘리는" 과분할을 차단한다. HTTP 소비처 (controller endpoint + query DTO + colocated spec) 까지 합치면 파일 7 · 약 650 LOC 로 cap 이중 초과라 `Follow-ups (a)` 에 파일 · 심볼 단위로 명시한다 (§3 예외 조항의 수치 제시 요건 충족).
- [PLAN](../PLAN.md) `183 행` (REQ 재판정 1 회): 본 slice 는 `docs/requirements.md` 를 건드리지 않는다. REQ-036 재판정은 배선 3/3 머지 뒤 **1 회만** (`Follow-ups (c)`).

## Required Reading

- [src/assessment-evaluation/evaluation-persisted-records-reader.service.ts](../../src/assessment-evaluation/evaluation-persisted-records-reader.service.ts) `1~28 행` (책임 · 경계 주석 서술 형식) · `29~34 행` (import 배치) · `47~49 행` (`@Injectable` + constructor DI) · `78 행` (public 메서드 시그니처) — 본 adapter 가 1:1 mirror 할 **동형 선례**. 본 task 에서 수정 금지.
- [src/assessment-evaluation/evaluation-persisted-records-reader.service.spec.ts](../../src/assessment-evaluation/evaluation-persisted-records-reader.service.spec.ts) `22 행` (최상위 `describe`) · `36~103 행` (happy-path / branch describe 분할) · `104~178 행` (`negative cases` describe) — colocated spec 의 mock 주입 · 단언 형식 mirror 대상. 수정 금지.
- [src/assessment-evaluation/domain/summary-relative-comparison.ts](../../src/assessment-evaluation/domain/summary-relative-comparison.ts) `54~59 행` (`RelativeComparisonEntry`) · `74~83 행` (`RelativeComparisonResult`) · `142~160 행` (`computeRelativeComparison` 시그니처 + 2 종 `TypeError` 계약) — 소비 계약. **read-only, 본 task 에서 수정 금지.**
- [src/user/summary.service.ts](../../src/user/summary.service.ts) `126~148 행` (`findByCoordinate` 주석 + 검증 2 단계 + 무가공 반환) — 본 adapter 의 유일한 상류 의존. 수정 금지.
- [prisma/schema.prisma](../../prisma/schema.prisma) `361~380 행` `Summary` model — `367 행` `metricScore Decimal` (매핑 대상 타입) · `377 행` `@@unique([personId, period, periodStart])` (좌표당 person 1 행 = helper 의 중복 personId 계약이 정상 경로에서 성립하는 근거). **수정 금지.**
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `47 행` (선례 import 위치) · `79 행` (`imports` 배열 — `UserModule` 이미 존재) · `137~141 행` (선례 provider 등록 + 주석 형식) · `197 행` (선례 export 등록).
- [src/assessment-evaluation/assessment-evaluation.module.spec.ts](../../src/assessment-evaluation/assessment-evaluation.module.spec.ts) `113 행` (import) · `220~226 행` (선례 DI resolve 단언 블록) — 신설 단언이 mirror 할 형식.
- [docs/architecture/modules.md](../architecture/modules.md) `176`·`179 행` — 의존 방향 금지 조항.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` (R-110 · R-112) · `§12` (언어 정책 · `§ 12.76` 행 범위 표기).

## 설계 계약 (구현자가 임의로 바꾸지 않는다)

### (1) `SummaryRelativeComparisonReader` (신규 파일)

파일: `src/assessment-evaluation/summary-relative-comparison-reader.service.ts`

```
@Injectable()
export class SummaryRelativeComparisonReader {
  constructor(private readonly summaryService: SummaryService) {}

  async readForCoordinate(period: string, periodStart: Date): Promise<RelativeComparisonResult>
}
```

- 흐름은 **3 단계 고정** — (a) `const rows = await this.summaryService.findByCoordinate(period, periodStart)` (b) `rows` 를 입력 순서 그대로 `RelativeComparisonEntry[]` 로 map (c) `return computeRelativeComparison(entries)`.
- **입력 검증 0** — `period` literal · `periodStart` 유효성 검증을 본 adapter 가 **중복 수행하지 않는다**. `SummaryService.findByCoordinate` (`137~146 행`) 가 단일 검증 출처이고 그 `BadRequestException` 은 **변환 없이 전파** 한다 (선례 `evaluation-persisted-records-reader.service.ts` `40~46 행` 주석의 "값 검증은 본 adapter 가 하지 않고 forward" 규약 mirror). 새 검증 helper · 새 상수 신설 0.
- **`toEntryScore` private 매핑 helper (본 파일 내부, export 금지)** — `Summary.metricScore` 는 Prisma `Decimal` 이라 그대로 `number` 계약에 넣을 수 없다. 분기 4 개로 고정한다:
  1. `typeof value === "number"` → 그대로.
  2. object 이며 `typeof value.toNumber === "function"` → `value.toNumber()` (Prisma `Decimal` 정상 경로).
  3. `typeof value === "string"` → `Number(value)` (Decimal 직렬화 fallback).
  4. 그 외 (`null` / `undefined` / boolean 등) → `Number.NaN` 을 반환해 helper 의 `normalizeScore` (`99~113 행`) 가 **0 으로 절하** 하게 맡긴다. 여기서 throw 하지 않는다 — 절하 규약의 단일 출처는 helper 다.
  - 위 분기 선택 이유를 주석 3~4 행으로 박제한다 (특히 4 번이 "은폐" 가 아니라 helper 의 보수 규약에 위임하는 것임).
- **정렬 재조정 0** — `findByCoordinate` 가 `personId: "asc"` 로 결정적 순서를 보장하므로 (`summary.repository.ts` `137 행` 이후) adapter 는 재정렬하지 않는다. helper 의 "동점 내부는 입력 최초 등장 순서" 규약이 그 순서에 얹힌다.
- **중복 personId** — `@@unique([personId, period, periodStart])` 로 정상 경로에서는 발생하지 않으나, 발생 시 helper 의 `TypeError` 를 **변환 없이 전파** 한다 (은폐 금지).
- 빈 좌표 (`rows` 가 `[]`) → helper 의 빈 입력 규약대로 `{ cohortSize: 0, mean: 0, byPerson: [] }` 가 그대로 반환된다. adapter 에 별도 분기를 두지 않는다.
- 파일 상단에 선례 형식의 책임 · 경계 주석 (책임 / 경계(Out of Scope) / 패턴 mirror 3 절) 을 한국어로 박제한다.

### (2) module DI 등록

- [`assessment-evaluation.module.ts`](../../src/assessment-evaluation/assessment-evaluation.module.ts) 의 `providers` 와 `exports` 양쪽에 `SummaryRelativeComparisonReader` 를 추가하고, 선례 (`137~141 행`) 형식의 등록 사유 주석 2~4 행을 단다 — 유일한 생성자 의존 `SummaryService` 가 **이미 import 중인 `UserModule` (`79 행`) 의 export (`user.module.ts` `205 행`)** 로 resolve 된다는 사실 포함. **`imports` 배열 변경 0.**
- [`assessment-evaluation.module.spec.ts`](../../src/assessment-evaluation/assessment-evaluation.module.spec.ts) 의 기존 DI resolve 테스트에 선례 (`220~226 행`) 와 같은 형식의 단언 블록을 추가한다 — `moduleRef.get(SummaryRelativeComparisonReader)` 가 정의되고 해당 클래스 instance 임을 확인 (provider 등록 누락 시 fail 하는 배선 게이트).

### (3) LOC 예산 (초과 시 주석 · spec 케이스를 줄여 맞춘다)

| 파일 | 예산 |
| --- | --- |
| `summary-relative-comparison-reader.service.ts` | +115 |
| `summary-relative-comparison-reader.service.spec.ts` | +175 |
| `assessment-evaluation.module.ts` | +15 |
| `assessment-evaluation.module.spec.ts` | +30 |

## Acceptance Criteria

- [ ] `src/assessment-evaluation/summary-relative-comparison-reader.service.ts` 가 위 계약대로 신설된다 — `@Injectable` + `SummaryService` 단일 생성자 주입, public 메서드는 `readForCoordinate` **1 개뿐**, 내부 매핑 helper 는 export 하지 않는다.
- [ ] `assessment-evaluation.module.ts` 의 `providers` · `exports` 양쪽에 신규 adapter 가 등록되고 `imports` 배열은 **무변경** 이다 (`git diff` 로 확인).
- [ ] **happy-path unit test** — public symbol 별 1+ : (i) person 3 명 row (서로 다른 `metricScore`) 를 반환하는 `SummaryService` mock 에서 `readForCoordinate` 의 반환이 `cohortSize` 3 · `byPerson` rank 오름차순이고, `findByCoordinate` 가 정확히 1 회, 인자 `(period, periodStart)` 그대로 호출됨 (ii) module spec 에서 신규 adapter 가 DI 로 resolve 되고 해당 클래스 instance 임.
- [ ] **error path unit test** — (i) `SummaryService.findByCoordinate` 가 `BadRequestException` 으로 reject 할 때 adapter 가 그 예외를 **변환 없이** 전파하고 helper 호출 결과를 만들지 않음 (ii) 일반 rejection (의존성 실패) 도 그대로 전파 (iii) 같은 `personId` 가 2 행 섞인 비정상 입력에서 helper 의 `TypeError` 가 그대로 전파됨. 각 1+ 케이스.
- [ ] **분기별 test** — `toEntryScore` 4 분기 각 1+ `it` : ① plain `number` ② `toNumber()` 를 가진 Decimal 유사 객체 ③ 문자열 `"1.5"` ④ `null` / `undefined` 같은 그 외 값이 helper 의 0 절하로 귀결됨.
- [ ] **negative case test (예외 분기마다 1+)** — 최소 5 종: ① 빈 좌표 (`[]` 반환) → `{ cohortSize: 0, mean: 0, byPerson: [] }` 이고 throw 0 ② adapter 가 `period` / `periodStart` 를 **자체 검증하지 않음** (허용 집합 밖 문자열이 그대로 `findByCoordinate` 로 forward 되는 layer 경계 단언) ③ 비유한 `metricScore` (`NaN` / `Infinity`) 가 0 으로 절하돼 산출에 실림 ④ adapter 가 반환 row 배열 · 원소를 mutate 하지 않음 ⑤ 전원 동점 좌표에서 rank 가 전부 1 이고 순서가 `findByCoordinate` 반환 순서를 보존함 (결정성).
- [ ] spec 은 신규 colocated 파일 1 개 (`src/assessment-evaluation/summary-relative-comparison-reader.service.spec.ts`) + 기존 `assessment-evaluation.module.spec.ts` 확장으로만 구성한다 (`test/helpers/` 추가 **0**, e2e · smoke 파일 추가 **0**).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`), 신규 adapter 파일은 statement · branch · function · line 100%.
- [ ] `git diff --stat` 의 변경 파일이 frontmatter `touchesFiles` 4 개뿐이다 (`src/user/**` · `src/assessment-evaluation/domain/**` · `prisma/schema.prisma` · `docs/requirements.md` · `docs/PLAN.md` 전부 미접촉, task 파일 status 갱신은 별개).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 준수 — 주석 · spec describe/it 문자열은 한국어, 식별자 · 경로는 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `137 행`, `L` prefix 금지).

## Out of Scope

- **`src/user/**` 변경 금지** — `summary.service.ts` / `summary.repository.ts` 의 시그니처 · 검증 · 정렬 · 분기를 건드리지 않는다 (읽기 전용 소비).
- **helper 수정 금지** — `domain/summary-relative-comparison.ts` 의 산출 규칙 · 절하 규약 · `TypeError` 메시지를 바꾸지 않는다. 부족하면 본 task 를 BLOCKED 로 세우고 별도 slice.
- controller endpoint · query DTO · RBAC · response DTO 신설 (`Follow-ups (a)`).
- orchestrator / batch 파이프라인에 본 adapter 를 끼워 넣기 (`Follow-ups (b)`) — 본 slice 는 DI 등록까지만.
- `prisma/schema.prisma` 변경 · 새 index · migration ([CLAUDE.md](../../CLAUDE.md) `§5` DB schema 게이트 — T-1932 `Follow-ups (c)` 좌표 축 index 검토는 여전히 보류).
- `docs/requirements.md` REQ-036 재판정 · `docs/PLAN.md` checkbox 승격 (PLAN `183 행` once-rule — `Follow-ups (c)`).
- `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 접촉 (PLAN `157`·`158 행` 게이트).
- ADR 신설 (기존 ADR-0035 좌표 계약 + modules.md 의존 방향 안의 adapter 추가라 새 결정 없음).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **배선 3/3 — HTTP 표면**: 좌표 상대 비교 조회 endpoint 1 개 + query DTO (`period` · `periodStart`) + colocated spec. 배치 module 은 본 adapter 를 export 하는 `AssessmentEvaluationModule` 쪽이 자연스럽고, RBAC 는 기존 `summary.controller.ts` `@Roles` 관행을 mirror 한다. 예상 파일 3 · 약 320 LOC.
- (b) **파이프라인 소비 검토** — summary batch / aggregate orchestrator 가 좌표 확정 직후 상대 비교 산출을 함께 만들어 둘지 여부. 산출 영속화가 필요해지면 schema 변경 게이트 (`§5`) 대상이므로 ADR 선행.
- (c) **REQ-036 재판정 1 회** — (a) 머지 뒤에만 `docs/requirements.md` `55 행` 1 회 (PLAN `183 행` once-rule). 본 slice 및 중간 단계에서는 재판정하지 않는다.
