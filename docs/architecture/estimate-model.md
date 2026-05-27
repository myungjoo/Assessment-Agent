# Estimate model — planner LOC estimate calibration

> **본 문서는 planner agent 의 estimate 산정 직관 calibration multiplier 박제 artifact 다.** session #15 ~ session #19 turn 5 시점에 누적된 **7 회차 systematic underestimate** (T-0055/T-0056/T-0057/T-0058/T-0061/T-0062/T-0063) 의 estimate vs actual 데이터를 기반으로 카테고리 정의 + multiplier 산출 + planner 적용 절차를 박제한다. **cap policy (≤ 300 LOC / ≤ 5 파일) 자체 변경 0** — multiplier 는 planner 의 estimate 직관 calibration 만, executor cap envelope 정책은 불변.

## 1. 개요

본 doc 의 박제 범위:

1. **7 회차 case study** — T-0055 / T-0056 / T-0057 / T-0058 / T-0061 / T-0062 / T-0063 의 estimate vs actual overrun + cause classification.
2. **4 카테고리 정의** — R-112 4-카테고리 cover backbone / doc-only enumerated-section / ADR-first split stage / single-helper test.
3. **카테고리 별 multiplier 산출** — × 1.5 / × 1.6 / × 1.3 / × 1.0.
4. **planner 적용 절차** — task 생성 시 (a) base estimate 직관 / (b) 카테고리 classification / (c) multiplier 적용 / (d) > 300 시 planner-pre-justified note frontmatter 또는 split 결정.
5. **관측 누적 + 갱신 정책** — 10 회차 / 15 회차 milestone 도달 시 multiplier 재산출, 본 doc 갱신은 planner 의 자체 follow-up task 책임.

## 2. 7 회차 case study

| task | category | estimatedDiff | actual LOC | overrun % |
| --- | --- | --- | --- | --- |
| T-0055 GroupController CRUD | R-112 4-카테고리 cover backbone | 300 | 413 | +37% |
| T-0056 GroupService N:M ops | R-112 4-카테고리 cover backbone | 240 | 545 | +127% |
| T-0057 GroupController N:M endpoint | R-112 4-카테고리 cover backbone | 280 | 496 | +77% |
| T-0058 jest-e2e maxWorkers=1 정합 | single-helper test (doc+config) | 80 | 274 | +243% |
| T-0061 groups.smoke real PostgreSQL | ADR-first split stage | 260 | 342 | +32% |
| T-0062 groups.e2e real PostgreSQL | ADR-first split stage | 300 | 406 | +35% |
| T-0063 P3 → P4 전이 evaluation doc | doc-only enumerated-section | 80 | 241 | +201% |

**관측 평균 overrun**: +79% (7 회차).

## 3. 카테고리 정의

### 3.1 R-112 4-카테고리 cover backbone

**정의**: 신규 NestJS service / controller / DTO 박제 task 로, R-112 (happy / error / branch / negative) 4-카테고리 cover unit spec 동반 의무.

**발생 trigger pattern**: `src/<module>/<feature>.service.ts` + `<feature>.controller.ts` + `Add<X>Dto.ts` / `Update<X>Dto.ts` + 각 spec 의 4-카테고리 cover. DTO + controller + service + spec 4 layer 동시 박제.

**precedent**: T-0055 / T-0056 / T-0057 (3 회차, 평균 +80% over).

### 3.2 doc-only enumerated-section

**정의**: 신규 architecture doc 신설 task 로, frontmatter 의 `§1 개요 / §2 ... / §N References` 의 enumerated section 패턴 박제.

**발생 trigger pattern**: `docs/architecture/<topic>.md` 또는 `docs/decisions/ADR-NNNN.md` 신설 + INDEX.md row 1 줄 추가. 본문이 7 ~ 10 단락 (개요 / 1+ 핵심 박제 / 옵션 / 권장 / References) 의 enumerated 구조 → 단락별 박제 desire 가 LOC 자연 증가 유발.

**precedent**: T-0063 (1 회차, +201% over).

### 3.3 ADR-first split stage

**정의**: ADR 박제 후 CI infra → smoke → e2e 의 4-stage chain cascading 의 개별 stage task.

**발생 trigger pattern**: ADR-0004 (T-0051) → CI Postgres services (T-0052) → smoke real PostgreSQL (T-0053 / T-0059 / T-0061) → e2e real PostgreSQL (T-0054 / T-0060 / T-0062). 각 stage 가 ADR 결정의 직접 적용 + R-113 smoke/e2e cover 의무 + jest-e2e 정합 동반.

**precedent**: T-0061 / T-0062 (2 회차, 평균 +33% over).

### 3.4 single-helper test

**정의**: shared test helper (예: `test/helpers/prisma-mock.ts`) 추출 또는 jest config 단일 변경 task.

**발생 trigger pattern**: jest config / jest-e2e config / shared mock helper 신설 + 본문 doc 박제 정합.

**precedent**: T-0058 (1 회차, +243% over).

## 4. multiplier 산출

각 카테고리의 multiplier 는 7 회차 case study 의 평균 overrun + buffer 적용 결과:

| 카테고리 | multiplier | 산출 근거 |
| --- | --- | --- |
| R-112 4-카테고리 cover backbone | **× 1.5** | T-0055 / T-0056 / T-0057 평균 +80% over → multiplier 1.8 이 정확하나, cap envelope (≤ 300 LOC) considering 시 1.5 로 보수 적용 + > 300 시 split 결정 유도. |
| doc-only enumerated-section | **× 1.6** | T-0063 +201% over → 단일 회차 데이터 considering 시 보수 1.6 (base 70 × 1.6 ≈ 112 LOC 안에서 enumerated section 7 단락 cover 가능 estimate). |
| ADR-first split stage | **× 1.3** | T-0061 / T-0062 평균 +33% over → multiplier 1.33 의 보수 1.3. |
| single-helper test | **× 1.0** | T-0058 +243% over 의 단일 데이터 considering 시 outlier 가능성 (doc 동반 cap-bend) → 1.0 유지 + planner 가 doc 동반 시 doc-only enumerated-section 으로 reclassify 권장. |

**적용 식**: `estimated = base_intuition × multiplier`. base 가 직관 estimate (R-112 / enumerated / chain / helper 의 카테고리 미적용 LOC) → category multiplier 적용 후 frontmatter `estimatedDiff` 박제.

## 5. planner 적용 절차

task 생성 시 estimate 산정 절차:

1. **base estimate 직관 산정** — Required Reading + Acceptance Criteria + Out of Scope 만 보고 직관 LOC estimate (multiplier 미적용).
2. **카테고리 classification** — 본 task 의 변경 대상이 §3 의 4 카테고리 중 어느 것에 해당하는지 결정. 복합 (예: backbone + ADR 동반) 시 가장 큰 multiplier 적용.
3. **multiplier 적용** — `estimated = base × multiplier`. frontmatter `estimatedDiff` 박제.
4. **> 300 LOC 또는 > 5 파일 시 결정**:
   - **planner-pre-justified note** — frontmatter `plannerNote` 에 "cap-bend pre-justified: <category> × <multiplier> = <est> LOC, <precedent task ID> 패턴 정당화" 명시 + frontmatter `sizeExempt: true` + `exemptReason` 박제 → executor cap 검사 skip.
   - **split** — 본 task 를 2+ 의 작은 task 로 분할 (cap envelope 안). dependency chain (`dependsOn` / `blocks`) 으로 ordering 박제.
5. **frontmatter 박제 의무** — `estimatedDiff` 값에 multiplier 적용 결과 박제. base estimate 가 아닌 calibrated estimate 박제.

## 6. 관측 누적 + 갱신 정책

본 doc 의 7 회차 case study + 4 카테고리 multiplier 는 **현 시점 (session #19 turn 6) 의 박제 snapshot**. 후속 회차 누적 시 재산출:

- **10 회차 milestone** — +3 회차 추가 시 (T-0064 본 doc 머지 후 next 3 task), 평균 overrun 재계산 + multiplier delta ≥ 0.2 시 본 doc §4 갱신.
- **15 회차 milestone** — +5 회차 추가 시, 카테고리 추가 필요성 검토 (예: e2e-only / smoke-only / config-only).
- **갱신 책임**: planner agent 의 follow-up task (별도 doc-only direct). 본 doc 갱신은 retroactive 0 — historical record 보존.

## 7. References

- [docs/tasks/T-0055-group-controller-dto-crud.md](../tasks/T-0055-group-controller-dto-crud.md) — estimatedDiff=300 / actual 413 LOC (+37%) 박제 source.
- [docs/tasks/T-0056-group-service-membership-ops.md](../tasks/T-0056-group-service-membership-ops.md) — estimatedDiff=240 / actual 545 LOC (+127%) 박제 source.
- [docs/tasks/T-0057-group-controller-membership-endpoints.md](../tasks/T-0057-group-controller-membership-endpoints.md) — estimatedDiff=280 / actual 496 LOC (+77%) 박제 source.
- [docs/tasks/T-0058-jest-e2e-max-workers-1-policy.md](../tasks/T-0058-jest-e2e-max-workers-1-policy.md) — estimatedDiff=80 / actual 274 LOC (+243%) 박제 source.
- [docs/tasks/T-0061-smoke-groups-real-postgres.md](../tasks/T-0061-smoke-groups-real-postgres.md) — estimatedDiff=260 / actual 342 LOC (+32%) 박제 source.
- [docs/tasks/T-0062-e2e-groups-real-postgres.md](../tasks/T-0062-e2e-groups-real-postgres.md) — estimatedDiff=300 / actual 406 LOC (+35%) 박제 source.
- [docs/tasks/T-0063-p3-to-p4-transition-evaluation.md](../tasks/T-0063-p3-to-p4-transition-evaluation.md) — estimatedDiff=80 / actual 241 LOC (+201%) 박제 source.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) — 본 doc 의 multiplier 적용 단락 (Estimate model 단락) 참조.
- [docs/architecture/p3-to-p4-transition.md](p3-to-p4-transition.md) §2.5 — 5 회차 cap-bend 박제 source (본 doc 가 7 회차로 확장).
- [CLAUDE.md](../../CLAUDE.md) §3 — task size cap (≤ 300 LOC / ≤ 5 파일) policy 불변 source.

Refs: T-0064, T-0063, T-0062, T-0061, T-0058, T-0057, T-0056, T-0055
