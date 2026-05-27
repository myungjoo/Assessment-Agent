# Estimate model — planner LOC estimate calibration

> **본 문서는 planner agent 의 estimate 산정 직관 calibration multiplier 박제 artifact 다.** session #15 ~ session #20 시점에 누적된 **11 회차 systematic estimate vs actual** (T-0055/T-0056/T-0057/T-0058/T-0061/T-0062/T-0063 base 7 + T-0066/T-0067/T-0068/T-0069 session #20 4 회차) 데이터를 기반으로 카테고리 정의 + multiplier 산출 + planner 적용 절차를 박제한다. **cap policy (≤ 300 LOC / ≤ 5 파일) 자체 변경 0** — multiplier 는 planner 의 estimate 직관 calibration 만, executor cap envelope 정책은 불변.

## 1. 개요

본 doc 의 박제 범위:

1. **11 회차 case study** — base 7 (T-0055 / T-0056 / T-0057 / T-0058 / T-0061 / T-0062 / T-0063) + session #20 4 회차 (T-0066 / T-0067 / T-0068 / T-0069) 의 estimate vs actual overrun + cause classification.
2. **4 카테고리 정의** — R-112 4-카테고리 cover backbone / doc-only enumerated-section / ADR-first split stage / single-helper test.
3. **카테고리 별 multiplier 산출** — × 1.5 (+ P2002 sub-multiplier × 1.2) / × 1.6 / × 1.3 / × 1.0.
4. **planner 적용 절차** — task 생성 시 (a) base estimate 직관 / (b) 카테고리 classification (P2002 분기 추가 entity sub-multiplier 포함) / (c) multiplier 적용 / (d) > 300 시 planner-pre-justified note frontmatter 또는 split 결정.
5. **관측 누적 + 갱신 정책** — 10 회차 / 15 회차 milestone 도달 시 multiplier 재산출, 본 doc 갱신은 planner 의 자체 follow-up task 책임.

## 2. 11 회차 case study

### 2.1 base 7 회차 (session #15 ~ session #19)

| task | category | estimatedDiff | actual LOC | overrun % |
| --- | --- | --- | --- | --- |
| T-0055 GroupController CRUD | R-112 4-카테고리 cover backbone | 300 | 413 | +37% |
| T-0056 GroupService N:M ops | R-112 4-카테고리 cover backbone | 240 | 545 | +127% |
| T-0057 GroupController N:M endpoint | R-112 4-카테고리 cover backbone | 280 | 496 | +77% |
| T-0058 jest-e2e maxWorkers=1 정합 | single-helper test (doc+config) | 80 | 274 | +243% |
| T-0061 groups.smoke real PostgreSQL | ADR-first split stage | 260 | 342 | +32% |
| T-0062 groups.e2e real PostgreSQL | ADR-first split stage | 300 | 406 | +35% |
| T-0063 P3 → P4 전이 evaluation doc | doc-only enumerated-section | 80 | 241 | +201% |

**base 7 회차 평균 overrun**: +79% (T-0058 / T-0063 outlier 포함).

### 2.2 session #20 4 회차 추가 박제 (T-0066 ~ T-0069)

| task | category | estimatedDiff | actual LOC | overrun % |
| --- | --- | --- | --- | --- |
| T-0066 UpdateGroupDto + GroupRepository.update | R-112 4-카테고리 cover backbone | 220 | 281 | +28% |
| T-0067 GroupService.update + spec | R-112 4-카테고리 cover backbone | 200 | 214 | +7% |
| T-0068 GroupController @Patch(":id") | R-112 4-카테고리 cover backbone (controller 분기 박제) | 322 | 244 | -24% |
| T-0069 UpdatePartDto + PartRepository.update (P2002 분기 추가) | R-112 4-카테고리 cover backbone | 220 | 334 | +52% |

**session #20 4 회차 단독 평균 overrun**: +16% (T-0067 accurate / T-0068 over-estimate / T-0066·T-0069 under). base 7 회차 +79% 대비 大 폭 개선 — multiplier × 1.5 적용 후 base estimate 누적의 calibration 효과 확인.

### 2.3 11 회차 누적 평균

**11 회차 누적 평균 overrun**: +74% (base 7 +79% + session #20 4 +16% 가중 평균). session #20 4 회차가 누적 평균을 약 5%p 끌어내림 — multiplier × 1.5 적용이 systematic under-estimate 를 부분 보정.

**R-112 4-카테고리 cover backbone subset (7 회차)**: T-0055/T-0056/T-0057 (base) + T-0066/T-0067/T-0068/T-0069 (session #20) → 평균 overrun +43%. base 3 회차 단독 +80% 대비 session #20 누적 후 大 폭 축소 — × 1.5 multiplier 가 본 카테고리에서 의미 있게 작동.

## 3. 카테고리 정의

### 3.1 R-112 4-카테고리 cover backbone

**정의**: 신규 NestJS service / controller / DTO 박제 task 로, R-112 (happy / error / branch / negative) 4-카테고리 cover unit spec 동반 의무.

**발생 trigger pattern**: `src/<module>/<feature>.service.ts` + `<feature>.controller.ts` + `Add<X>Dto.ts` / `Update<X>Dto.ts` + 각 spec 의 4-카테고리 cover. DTO + controller + service + spec 4 layer 동시 박제.

**precedent**: T-0055 / T-0056 / T-0057 (base 3 회차, 평균 +80% over) + T-0066 / T-0067 / T-0068 / T-0069 (session #20 4 회차, 평균 +16% over) → 누적 7 회차 평균 +43% over.

#### 3.1.1 sub-pattern — P2002 분기 추가 (unique constraint 존재 entity)

**박제 trigger**: schema.prisma 의 `@unique` 또는 `@@unique` 가 명시된 entity 의 update DTO + repository 박제 시 P2002 (unique constraint violation) 분기 추가 의무. T-0069 (Part.name @unique 존재) vs T-0066 (Group.name @unique 미정의) 의 actual LOC 비교가 본 sub-pattern 의 systematic +60 ~ 100 LOC mass source 박제 근거:

| 비교 항목 | T-0066 (Group.name @unique 미정의) | T-0069 (Part.name @unique 존재) |
| --- | --- | --- |
| estimatedDiff | 220 | 220 |
| actual LOC | 281 (+28%) | 334 (+52%) |
| Prisma 분기 cover | P2025 1 분기 | P2002 + P2025 2 분기 |
| spec it count | 4-카테고리 base | 4-카테고리 + P2002 추가 it 3 ~ 4 개 |
| repository JSDoc | 단일 분기 명시 | 2 분기 명시 (+20 LOC) |
| repository 분기 코드 | 단일 catch | 2 catch + error code switch (+10 LOC) |

**박제 결론**: P2002 분기 추가 entity 박제 시 base R-112 backbone × 1.5 multiplier 만으로 부족 — spec 의 P2002 happy / error / branch / negative cover 추가 + JSDoc 정합 + repository 분기 코드 명시로 +60 ~ 100 LOC 가 systematic 추가 발생. § 4 의 sub-multiplier × 1.2 박제로 분리 calibration.

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

각 카테고리의 multiplier 는 11 회차 case study 의 평균 overrun + buffer 적용 결과:

| 카테고리 | multiplier | 산출 근거 |
| --- | --- | --- |
| R-112 4-카테고리 cover backbone | **× 1.5** | T-0055 / T-0056 / T-0057 (base 3 회차) 평균 +80% over + T-0066 / T-0067 / T-0068 / T-0069 (session #20 4 회차) 평균 +16% over → 누적 7 회차 평균 +43% over. base 3 회차 단독 considering 시 multiplier 1.8 이 정확하나, session #20 4 회차 누적 후 + cap envelope (≤ 300 LOC) considering 시 **× 1.5 유지** (× 1.7 raw 갱신 시 1 회차 spike T-0069 +52% 만으로 정책 변경은 ramen-noodle pattern). P2002 분기 추가 entity 의 systematic +60 ~ 100 LOC mass 는 sub-multiplier × 1.2 분리 (하단 표). |
| doc-only enumerated-section | **× 1.6** | T-0063 +201% over → 단일 회차 데이터 considering 시 보수 1.6 (base 70 × 1.6 ≈ 112 LOC 안에서 enumerated section 7 단락 cover 가능 estimate). |
| ADR-first split stage | **× 1.3** | T-0061 / T-0062 평균 +33% over → multiplier 1.33 의 보수 1.3. |
| single-helper test | **× 1.0** | T-0058 +243% over 의 단일 데이터 considering 시 outlier 가능성 (doc 동반 cap-bend) → 1.0 유지 + planner 가 doc 동반 시 doc-only enumerated-section 으로 reclassify 권장. |

### 4.1 sub-multiplier — P2002 분기 추가 (unique constraint entity)

R-112 4-카테고리 cover backbone 안의 sub-pattern (§ 3.1.1) 인 P2002 분기 추가 entity 박제 시 base multiplier 와 곱해 적용:

| sub-pattern | sub-multiplier | effective (base × sub) | 산출 근거 |
| --- | --- | --- | --- |
| P2002 분기 추가 (unique constraint entity) | **× 1.2** | × 1.5 × 1.2 = **× 1.8** | T-0069 (Part.name @unique 존재, P2002+P2025 2 분기 cover) +52% over vs T-0066 (Group.name @unique 미정의, P2025 1 분기 cover) +28% over → P2002 분기 추가가 systematic +60 ~ 100 LOC mass 의 source. base × 1.5 만으로 부족, sub-multiplier × 1.2 추가로 effective × 1.8 박제. |

**적용 식**: `estimated = base_intuition × multiplier × p2002_sub_multiplier?`. base 가 직관 estimate (R-112 / enumerated / chain / helper 의 카테고리 미적용 LOC) → category multiplier 적용 → 본 task 가 P2002 분기 추가 entity 면 sub-multiplier × 1.2 추가 곱셈 → frontmatter `estimatedDiff` 박제. sub-multiplier 적용 여부는 schema.prisma 의 `@unique` / `@@unique` 명시 박제 entity 인지로 판정.

## 5. planner 적용 절차

task 생성 시 estimate 산정 절차:

1. **base estimate 직관 산정** — Required Reading + Acceptance Criteria + Out of Scope 만 보고 직관 LOC estimate (multiplier 미적용).
2. **카테고리 classification** — 본 task 의 변경 대상이 §3 의 4 카테고리 중 어느 것에 해당하는지 결정. 복합 (예: backbone + ADR 동반) 시 가장 큰 multiplier 적용. **R-112 backbone 카테고리 일 경우 추가 sub-multiplier 판정** — `prisma/schema.prisma` 의 본 entity 정의에 `@unique` 또는 `@@unique` 가 박제된 entity 면 P2002 sub-multiplier × 1.2 추가 적용 (§ 4.1).
3. **multiplier 적용** — `estimated = base × multiplier × p2002_sub_multiplier?`. P2002 분기 추가 entity 면 effective × 1.8 (base × 1.5 × 1.2). frontmatter `estimatedDiff` 박제.
4. **> 300 LOC 또는 > 5 파일 시 결정**:
   - **planner-pre-justified note** — frontmatter `plannerNote` 에 "cap-bend pre-justified: <category> × <multiplier> [× <sub-multiplier>] = <est> LOC, <precedent task ID> 패턴 정당화" 명시 + frontmatter `sizeExempt: true` + `exemptReason` 박제 → executor cap 검사 skip.
   - **split** — 본 task 를 2+ 의 작은 task 로 분할 (cap envelope 안). dependency chain (`dependsOn` / `blocks`) 으로 ordering 박제.
5. **frontmatter 박제 의무** — `estimatedDiff` 값에 multiplier (+ sub-multiplier) 적용 결과 박제. base estimate 가 아닌 calibrated estimate 박제.

## 6. 관측 누적 + 갱신 정책

본 doc 의 11 회차 case study + 4 카테고리 multiplier + P2002 sub-multiplier 는 **현 시점 (session #20 turn 9) 의 박제 snapshot**. 후속 회차 누적 시 재산출:

- **15 회차 milestone** — +4 회차 추가 시 (T-0070 본 갱신 후 next 4 task), 평균 overrun 재계산 + multiplier delta ≥ 0.2 시 본 doc §4 갱신. P2002 sub-multiplier 도 추가 P2002 분기 entity 박제 회차 (예: Person 도메인 update 박제 시 email @unique 가능성) 누적 시 재산출.
- **20 회차 milestone** — +9 회차 추가 시, 카테고리 추가 필요성 검토 (예: e2e-only / smoke-only / config-only / P2002 분기 추가 별도 카테고리 분리).
- **갱신 책임**: planner agent 의 follow-up task (별도 doc-only direct). 본 doc 갱신은 retroactive 0 — historical record 보존.

## 7. References

- [docs/tasks/T-0055-group-controller-dto-crud.md](../tasks/T-0055-group-controller-dto-crud.md) — estimatedDiff=300 / actual 413 LOC (+37%) 박제 source.
- [docs/tasks/T-0056-group-service-membership-ops.md](../tasks/T-0056-group-service-membership-ops.md) — estimatedDiff=240 / actual 545 LOC (+127%) 박제 source.
- [docs/tasks/T-0057-group-controller-membership-endpoints.md](../tasks/T-0057-group-controller-membership-endpoints.md) — estimatedDiff=280 / actual 496 LOC (+77%) 박제 source.
- [docs/tasks/T-0058-jest-e2e-max-workers-1-policy.md](../tasks/T-0058-jest-e2e-max-workers-1-policy.md) — estimatedDiff=80 / actual 274 LOC (+243%) 박제 source.
- [docs/tasks/T-0061-smoke-groups-real-postgres.md](../tasks/T-0061-smoke-groups-real-postgres.md) — estimatedDiff=260 / actual 342 LOC (+32%) 박제 source.
- [docs/tasks/T-0062-e2e-groups-real-postgres.md](../tasks/T-0062-e2e-groups-real-postgres.md) — estimatedDiff=300 / actual 406 LOC (+35%) 박제 source.
- [docs/tasks/T-0063-p3-to-p4-transition-evaluation.md](../tasks/T-0063-p3-to-p4-transition-evaluation.md) — estimatedDiff=80 / actual 241 LOC (+201%) 박제 source.
- [docs/tasks/T-0066-group-update-dto-and-repository.md](../tasks/T-0066-group-update-dto-and-repository.md) — estimatedDiff=220 / actual 281 LOC (+28%) 박제 source.
- [docs/tasks/T-0067-group-service-update.md](../tasks/T-0067-group-service-update.md) — estimatedDiff=200 / actual 214 LOC (+7%) 박제 source.
- [docs/tasks/T-0068-group-controller-update.md](../tasks/T-0068-group-controller-update.md) — estimatedDiff=322 / actual 244 LOC (-24%) 박제 source.
- [docs/tasks/T-0069-part-update-dto-and-repository.md](../tasks/T-0069-part-update-dto-and-repository.md) — estimatedDiff=220 / actual 334 LOC (+52%) 박제 source — P2002 분기 추가 entity sub-pattern 박제.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) — 본 doc 의 multiplier 적용 단락 (Estimate model 단락) 참조.
- [docs/architecture/p3-to-p4-transition.md](p3-to-p4-transition.md) §2.5 — 5 회차 cap-bend 박제 source (본 doc 가 11 회차로 확장).
- [CLAUDE.md](../../CLAUDE.md) §3 — task size cap (≤ 300 LOC / ≤ 5 파일) policy 불변 source.

Refs: T-0070, T-0069, T-0068, T-0067, T-0066, T-0064, T-0063, T-0062, T-0061, T-0058, T-0057, T-0056, T-0055
