# Estimate model — planner LOC estimate calibration

> **본 문서는 planner agent 의 estimate 산정 직관 calibration multiplier 박제 artifact 다.** session #15 ~ session #27 시점에 누적된 **31 회차 systematic estimate vs actual** (base 15 회차 — session #15~#22 + 신규 16 회차 — session #23~#27 T-0083 / T-0084 / T-0086 / T-0087 / T-0088 / T-0089 / T-0091 / T-0093 / T-0094 / T-0095 / T-0096 / T-0097 / T-0098 / T-0099 / T-0100 / T-0101) 데이터를 기반으로 카테고리 정의 + multiplier 산출 + planner 적용 절차를 박제한다. **100 task milestone (counters.tasksCompleted=100) 도달 시점 박제** — T-0101 머지 (PR-101 432974a) 시점. **cap policy (≤ 300 LOC / ≤ 5 파일) 자체 변경 0** — multiplier 는 planner 의 estimate 직관 calibration 만, executor cap envelope 정책은 불변.

## 1. 개요

본 doc 의 박제 범위:

1. **31 회차 case study** — base 15 회차 (§2.1~§2.4) + 신규 16 회차 (§2.5 — session #23~#27).
2. **4 카테고리 정의 + 신규 sub-pattern 후보 2 종** — R-112 4-카테고리 cover backbone / doc-only enumerated-section / ADR-first split stage / single-helper test + §3.5 single-file-create (T-0100 1 회차) + §3.6 cleanup-only (T-0098 1 회차).
3. **카테고리 별 multiplier 산출** — × 1.5 (+ P2002 sub-multiplier × 1.2) / × 1.6 (+ inline-amend sub-multiplier × 0.4) / × 1.3 / × 1.0. **partial-backbone ×1.3 → ×2.0 재산출 후보** (§4 footnote 박제, 8 회차 평균 ×2.14 데이터, value 변경은 별도 follow-up task).
4. **planner 적용 절차** — task 생성 시 (a) base estimate 직관 / (b) 카테고리 classification (P2002 분기 추가 entity sub-multiplier + partial-backbone subset 포함) / (c) multiplier 적용 / (d) > 300 시 planner-pre-justified note frontmatter 또는 split 결정.
5. **관측 누적 + 갱신 정책** — 20 회차 / 30 회차 / 50 회차 milestone 도달 시 multiplier 재산출, 본 doc 갱신은 planner 의 자체 follow-up task 책임. **31 회차 milestone 본 doc (session #27, T-0102) 도달** — 100 task milestone (counters.tasksCompleted=100) cross-ref.

## 2. 31 회차 case study

### 2.1 base 7 회차 (session #15 ~ session #19)

| task                                | category                        | estimatedDiff | actual LOC | overrun % |
| ----------------------------------- | ------------------------------- | ------------- | ---------- | --------- |
| T-0055 GroupController CRUD         | R-112 4-카테고리 cover backbone | 300           | 413        | +37%      |
| T-0056 GroupService N:M ops         | R-112 4-카테고리 cover backbone | 240           | 545        | +127%     |
| T-0057 GroupController N:M endpoint | R-112 4-카테고리 cover backbone | 280           | 496        | +77%      |
| T-0058 jest-e2e maxWorkers=1 정합   | single-helper test (doc+config) | 80            | 274        | +243%     |
| T-0061 groups.smoke real PostgreSQL | ADR-first split stage           | 260           | 342        | +32%      |
| T-0062 groups.e2e real PostgreSQL   | ADR-first split stage           | 300           | 406        | +35%      |
| T-0063 P3 → P4 전이 evaluation doc  | doc-only enumerated-section     | 80            | 241        | +201%     |

**base 7 회차 평균 overrun**: +79% (T-0058 / T-0063 outlier 포함).

### 2.2 session #20 4 회차 추가 박제 (T-0066 ~ T-0069)

| task                                                           | category                                               | estimatedDiff | actual LOC | overrun % |
| -------------------------------------------------------------- | ------------------------------------------------------ | ------------- | ---------- | --------- |
| T-0066 UpdateGroupDto + GroupRepository.update                 | R-112 4-카테고리 cover backbone                        | 220           | 281        | +28%      |
| T-0067 GroupService.update + spec                              | R-112 4-카테고리 cover backbone                        | 200           | 214        | +7%       |
| T-0068 GroupController @Patch(":id")                           | R-112 4-카테고리 cover backbone (controller 분기 박제) | 322           | 244        | -24%      |
| T-0069 UpdatePartDto + PartRepository.update (P2002 분기 추가) | R-112 4-카테고리 cover backbone                        | 220           | 334        | +52%      |

**session #20 4 회차 단독 평균 overrun**: +16% (T-0067 accurate / T-0068 over-estimate / T-0066·T-0069 under). base 7 회차 +79% 대비 大 폭 개선 — multiplier × 1.5 적용 후 base estimate 누적의 calibration 효과 확인.

### 2.3 session #20 turn 9 + session #21-22 4 회차 추가 박제 (T-0070 ~ T-0073 + T-0076)

| task                                                            | category                                                   | estimatedDiff | actual LOC | overrun % |
| --------------------------------------------------------------- | ---------------------------------------------------------- | ------------- | ---------- | --------- |
| T-0070 estimate-model.md multiplier refinement                  | doc-only enumerated-section (inline-amend sub-pattern)     | 140           | 52         | -63%      |
| T-0071 PartService.update + spec (P2002 sub × 1.2 첫 사용 사례) | R-112 4-카테고리 cover backbone + P2002 sub-pattern        | 360           | 325        | -10%      |
| T-0072 ADR-0005 신설 + reviewer.md amend                        | doc-only enumerated-section (NEW-doc creation sub-pattern) | 240           | 234        | -3%       |
| T-0073 integrator.md + CLAUDE.md §3.3/§4/§11 amend              | doc-only enumerated-section (inline-amend sub-pattern)     | 280           | 38         | -86%      |
| T-0076 p3-to-p4-transition.md refresh                           | doc-only enumerated-section (inline-amend sub-pattern)     | 120           | 119        | -1%       |

**session #20-21-22 5 회차 단독 평균 overrun**: -33% (T-0071 accurate-pass / T-0072 accurate-pass / T-0076 accurate-pass / T-0070 + T-0073 inline-amend systematic over-estimate). multiplier × 1.5 + sub × 1.2 P2002 의 calibration 정확성 확인 + **doc-only enumerated-section 의 bi-modal 박제** (NEW-doc creation accurate vs inline-amend variance 큼 — T-0076 의 -1% accurate-pass 가 inline-amend sub-pattern 의 -86% ~ -1% range ~85 percentage point variance 박제의 직접 trigger).

### 2.4 15 회차 누적 평균 (milestone 도달)

**15 회차 누적 평균 overrun**: +30% (base 7 +79% + session #20 4 +16% + session #20-21-22 5 회차 추가 -33% 가중 평균). 본 회차에서 §6 의 **15 회차 milestone 도달 marker** 박제 — 향후 갱신 정책은 20 회차 milestone (+5 task) 으로 이행. session #20-21-22 후속 5 회차의 over-estimate 가 누적 평균을 약 11%p 추가로 끌어내림 (14 회차 +41% → 15 회차 +30%) — inline-amend sub-pattern 의 systematic over 가 박제 source 로 재확정.

**R-112 4-카테고리 cover backbone subset (8 회차)**: T-0055/T-0056/T-0057 (base) + T-0066/T-0067/T-0068/T-0069 (session #20) + T-0071 (session #21) → 평균 overrun +32%. T-0071 의 -10% (effective × 1.8 P2002 sub-multiplier × 1.2 첫 사용 사례 accurate-pass) 가 backbone subset 평균을 +43% → +32% 로 추가 축소. **P2002 sub-multiplier × 1.2 의 첫 사용 사례 검증 데이터 1 회차 확정** — session #22 까지 추가 P2002 entity 박제 회차 누적 0, 추가 검증 회차는 차기 unique-constraint entity update task (예: Person.email @unique) 까지 보류.

**doc-only enumerated-section subset (5 회차)**: T-0063 (+201% NEW-doc) + T-0070 (-63% inline-amend) + T-0072 (-3% NEW-doc accurate) + T-0073 (-86% inline-amend) + T-0076 (-1% inline-amend accurate) → 평균 +10% over. **bi-modal + variance 박제**: NEW-doc creation 2 회차 평균 +99% (T-0063 outlier 가 평균 끌어올림, T-0072 accurate) vs inline-amend **3 회차 평균 -50%** (T-0070 -63% / T-0073 -86% / T-0076 -1% — **range ~85 percentage point, standard-deviation 큼**). 본 variance 큼 marker 는 §3.2.2 + §4.2 의 sub-multiplier × 0.4 calibration band 가 "정확한 평균값" 보다 **systematic over-estimate 의 일관성** (3 회차 모두 over 또는 accurate, under 0 회차) 박제 근거로 재해석되는 출발점.

### 2.5 session #23~#27 16 회차 추가 박제 (T-0083 ~ T-0101)

| task                                        | category                                    | estimatedDiff | actual LOC | overrun %     |
| ------------------------------------------- | ------------------------------------------- | ------------- | ---------- | ------------- |
| T-0083 RolesGuard + @Roles + ROLE_HIERARCHY | R-112 backbone (partial-backbone subset)    | 600           | 1062       | +77%          |
| T-0084 api.md /api/auth/* 4 row amend       | doc-only enumerated-section (inline-amend)  | 51            | 19         | -63%          |
| T-0086 UserService.changeRole               | R-112 backbone (partial-backbone subset)    | 260           | 594        | +128%         |
| T-0087 UserController PATCH role + e2e      | R-112 backbone (partial-backbone subset)    | 540           | 1076       | +99%          |
| T-0088 api.md SuperAdmin row amend          | doc-only enumerated-section (inline-amend)  | 32            | 6          | -81%          |
| T-0089 ADR-0008 §6 retroactive amend        | doc-only enumerated-section (inline-amend)  | 35            | 32         | -9% (정확)    |
| T-0091 auth-e2e-helper.ts 추출              | R-112 backbone (partial-backbone subset)    | 260           | 519        | +100%         |
| T-0093 UC-04 §5 inline-amend                | doc-only enumerated-section (inline-amend)  | 35            | 8          | -77%          |
| T-0094 AuthController.signup + e2e          | R-112 backbone (partial-backbone subset)    | 260           | 569        | +119%         |
| T-0095 UserResponseDto private constructor  | R-112 backbone (partial-backbone subset)    | 200           | 469        | +135%         |
| T-0096 api.md/modules.md SuperAdmin sync    | doc-only enumerated-section (inline-amend)  | 35            | 6          | -83%          |
| T-0097 UC-04 §5+§8 UserResponseDto amend    | doc-only enumerated-section (inline-amend)  | 25            | 4          | -84%          |
| T-0098 stale cron PR cleanup × 13           | cleanup-only (신규 sub-pattern 후보 §3.6)   | 20            | 3          | -85%          |
| T-0099 GET /api/users list + fromEntities   | R-112 backbone (partial-backbone subset)    | 260           | 660        | +154%         |
| T-0100 .gitattributes 신설                  | single-file-create (신규 sub-pattern §3.5)  | 15            | 31         | +107%         |
| T-0101 GET /api/users/:id detail + e2e      | R-112 backbone (partial-backbone subset)    | 260           | 516        | +98%          |

**session #23~#27 16 회차 단독 평균 overrun**: +37% (가중 평균, 큰 LOC partial-backbone 들이 평균을 끌어올림). category-wise:

- **partial-backbone subset (8 회차)** — T-0083 +77% / T-0086 +128% / T-0087 +99% / T-0091 +100% / T-0094 +119% / T-0095 +135% / T-0099 +154% / T-0101 +98% → **평균 +114% over (× 2.14 effective)**. envelope partial-backbone × 1.3 의 R-112 spec mass underestimate 패턴 박제 — production source 약 100 LOC envelope 정합 vs 실 LOC 의 ~75% 가 spec / e2e mass. § 3.1 의 backbone 카테고리 안 **partial-backbone subset** 박제 (DTO / repository 재활용 + service / controller 신규만 박제) + § 4 multiplier 표 footnote 의 **× 1.3 → × 2.0 재산출 후보** marker (value 변경은 별도 follow-up).
- **doc-only inline-amend (7 회차)** — T-0084 -63% / T-0088 -81% / T-0089 -9% (정확-pass) / T-0093 -77% / T-0096 -83% / T-0097 -84% → **평균 -66% over-estimate** (systematic over 일관성 7/7 유지, under-estimate 0 회차). 기존 § 3.2.2 3 회차 (T-0070 / T-0073 / T-0076) + 본 7 회차 = **누적 10 회차 sub-multiplier × 0.4 calibration band 강화**. value 변경 0 (CLAUDE.md §3 ramen-noodle 회피).
- **single-file-create (T-0100 1 회차)** — × 2.07 over. 기존 inline-amend (× 0.4) 와 NEW-doc creation (× 1.6) 사이 별도 sub-pattern 후보 — § 3.5 박제, 1 회차 만으로 multiplier 분리 보류 (다음 2 회차 발생 후 박제).
- **cleanup-only (T-0098 1 회차)** — × 0.15 over. 13 PR close + 13 branch delete = 26 외부 effect, repo state pollution 정화 task. § 3.6 박제, 1 회차 만으로 multiplier 분리 보류.

### 2.6 31 회차 누적 평균 (milestone 도달)

**31 회차 누적 평균 overrun**: +34% (base 15 회차 +30% + session #23~#27 16 회차 +37% 가중 평균). 본 회차에서 §6 의 **31 회차 milestone 도달 marker** 박제 — 향후 갱신 정책은 50 회차 milestone (+19 task) 으로 이행. session #23~#27 의 partial-backbone subset 평균 +114% 가 누적 평균을 약 4%p 끌어올림 (15 회차 +30% → 31 회차 +34%) — R-112 spec mass underestimate 패턴 박제 source 가 재확정. inline-amend sub-pattern 의 7 회차 추가 누적 평균 -66% 가 partial-backbone 의 +114% 와 양쪽 끝에서 calibration spread 확장.

## 3. 카테고리 정의

### 3.1 R-112 4-카테고리 cover backbone

**정의**: 신규 NestJS service / controller / DTO 박제 task 로, R-112 (happy / error / branch / negative) 4-카테고리 cover unit spec 동반 의무.

**발생 trigger pattern**: `src/<module>/<feature>.service.ts` + `<feature>.controller.ts` + `Add<X>Dto.ts` / `Update<X>Dto.ts` + 각 spec 의 4-카테고리 cover. DTO + controller + service + spec 4 layer 동시 박제.

**precedent**: T-0055 / T-0056 / T-0057 (base 3 회차, 평균 +80% over) + T-0066 / T-0067 / T-0068 / T-0069 (session #20 4 회차, 평균 +16% over) → 누적 7 회차 평균 +43% over.

#### 3.1.2 sub-pattern — partial-backbone (DTO / repository 재활용 + service / controller 신규)

**박제 trigger**: backbone 카테고리 의 변형 — DTO 또는 repository 가 이미 박제되어 재활용 + service 또는 controller 만 신규. T-0095 의 UserResponseDto private constructor + fromEntity / T-0099 의 GET list + fromEntities / T-0101 의 GET detail + UserService.findById + self OR Admin+ 분기 / T-0083 의 RolesGuard + @Roles + ROLE_HIERARCHY / T-0086 의 UserService.changeRole / T-0087 의 UserController PATCH + e2e / T-0091 의 auth-e2e-helper.ts / T-0094 의 AuthController.signup + e2e 가 본 sub-pattern 의 8 회차 precedent.

**precedent (8 회차)**: T-0083 +77% / T-0086 +128% / T-0087 +99% / T-0091 +100% / T-0094 +119% / T-0095 +135% / T-0099 +154% / T-0101 +98% → **평균 +114% over (× 2.14 effective)**. production source 약 100 LOC envelope 정합, 실 LOC 의 ~75% 가 spec / e2e mass 본질 — R-112 4 카테고리 cover (happy / error / branch / negative) + negative cases 충분 cover 의무 (분기 마다 1+ test) 가 spec mass 누적의 systematic source.

**박제 결론**: partial-backbone subset 은 base × 1.5 multiplier 만으로 부족 — 8 회차 평균 ×2.14 데이터 → **× 1.3 (현 partial-backbone) → × 2.0 재산출 후보** § 4 multiplier 표 footnote 박제. value 변경 0 (별도 follow-up task 검증 8 회차 → 10 회차 누적 + reviewer 합의 후).

#### 3.1.1 sub-pattern — P2002 분기 추가 (unique constraint 존재 entity)

**박제 trigger**: schema.prisma 의 `@unique` 또는 `@@unique` 가 명시된 entity 의 update DTO + repository 박제 시 P2002 (unique constraint violation) 분기 추가 의무. T-0069 (Part.name @unique 존재) vs T-0066 (Group.name @unique 미정의) 의 actual LOC 비교가 본 sub-pattern 의 systematic +60 ~ 100 LOC mass source 박제 근거:

| 비교 항목            | T-0066 (Group.name @unique 미정의) | T-0069 (Part.name @unique 존재)       |
| -------------------- | ---------------------------------- | ------------------------------------- |
| estimatedDiff        | 220                                | 220                                   |
| actual LOC           | 281 (+28%)                         | 334 (+52%)                            |
| Prisma 분기 cover    | P2025 1 분기                       | P2002 + P2025 2 분기                  |
| spec it count        | 4-카테고리 base                    | 4-카테고리 + P2002 추가 it 3 ~ 4 개   |
| repository JSDoc     | 단일 분기 명시                     | 2 분기 명시 (+20 LOC)                 |
| repository 분기 코드 | 단일 catch                         | 2 catch + error code switch (+10 LOC) |

**박제 결론**: P2002 분기 추가 entity 박제 시 base R-112 backbone × 1.5 multiplier 만으로 부족 — spec 의 P2002 happy / error / branch / negative cover 추가 + JSDoc 정합 + repository 분기 코드 명시로 +60 ~ 100 LOC 가 systematic 추가 발생. § 4 의 sub-multiplier × 1.2 박제로 분리 calibration.

### 3.2 doc-only enumerated-section

**정의**: 신규 architecture doc 신설 또는 inline amend task 로, frontmatter 의 `§1 개요 / §2 ... / §N References` 의 enumerated section 패턴 박제. **bi-modal 박제** (§3.2.1 NEW-doc creation vs §3.2.2 inline-amend).

**발생 trigger pattern**: `docs/architecture/<topic>.md` 또는 `docs/decisions/ADR-NNNN.md` 신설 + INDEX.md row 1 줄 추가, OR 기존 doc 의 section 단위 inline amend (`.claude/agents/*.md`, `CLAUDE.md` 의 §N 추가).

**precedent (4 회차)**: T-0063 NEW-doc +201% / T-0070 inline-amend -63% / T-0072 NEW-doc -3% / T-0073 inline-amend -86%.

#### 3.2.1 sub-pattern — NEW-doc creation

**박제 trigger**: 새 .md / ADR 파일 신설. 본문이 7~10 단락 enumerated 구조 → 단락별 박제 desire 가 LOC 자연 증가 유발. precedent: T-0063 (+201%) / T-0072 (-3% accurate). T-0072 의 accurate-pass 가 NEW-doc 의 첫 calibration. multiplier × 1.6 유지 (T-0063 1 회차 outlier 가능성 + T-0072 1 회차 accurate 의 평균 +99% 박제 → buffer 보수 1.6).

#### 3.2.2 sub-pattern — inline-amend (기존 doc 의 section 단위 수정)

**박제 trigger**: 기존 doc (`.claude/agents/*.md`, `CLAUDE.md`, `docs/architecture/*.md`) 의 section 단위 inline amend — wholesale replacement 불요 (source ADR 또는 task spec 박제 → mapping 만 적용 inline). precedent: T-0070 (-63%) + T-0073 (-86%) + T-0076 (-1%) + T-0084 (-63%) + T-0088 (-81%) + T-0089 (-9%) + T-0093 (-77%) + T-0096 (-83%) + T-0097 (-84%) → **10 회차 누적 평균 -55% over-estimate, under-estimate 0 회차 (systematic over 일관성 10/10)**. 본 sub-pattern 의 LOC mass 효율적 — ADR 또는 task spec 이 source 일 때 inline edit 가 wholesale replacement 의 ~1/3 ~ 1/1 LOC 으로 가능 (T-0076 의 -1% accurate-pass 가 lower bound, T-0088 의 -81% / T-0096 의 -83% / T-0097 의 -84% 가 upper bound cluster).

**박제 결론**: inline-amend sub-pattern 은 NEW-doc creation 의 × 1.6 multiplier 부족 — sub-multiplier × 0.4 분리 calibration 필요 (§ 4.2 박제). 적용 식: NEW-doc 은 base × 1.6, inline-amend 는 base × 1.6 × 0.4 = effective × 0.64.

**variance 큼 박제 (3 회차 누적)**: T-0070 -63% / T-0073 -86% / T-0076 -1% 의 spread = **range ~85 percentage point**, standard-deviation 큼 — sub-multiplier × 0.4 의 calibration band 가 "정확한 평균값" 보다 **systematic over-estimate 의 일관성** (3 회차 모두 over 또는 accurate, under-estimate 0 회차) 박제로 재해석. NEW-doc creation 의 spread (T-0063 +201% / T-0072 -3% = range ~204 percentage point) 와 비교 시 inline-amend 의 variance 가 절대값으로 작거나 비슷 — bi-modal 양쪽 모두 outlier 큼이 정상. **sub-multiplier × 0.4 값 자체 변경 0** (CLAUDE.md §3 ramen-noodle pattern 회피 + 3 회차만으로 정책 변경 금지) — 본 variance 큼 박제는 calibration 의 본질 재해석 only, multiplier value invariant.

### 3.3 ADR-first split stage

**정의**: ADR 박제 후 CI infra → smoke → e2e 의 4-stage chain cascading 의 개별 stage task.

**발생 trigger pattern**: ADR-0004 (T-0051) → CI Postgres services (T-0052) → smoke real PostgreSQL (T-0053 / T-0059 / T-0061) → e2e real PostgreSQL (T-0054 / T-0060 / T-0062). 각 stage 가 ADR 결정의 직접 적용 + R-113 smoke/e2e cover 의무 + jest-e2e 정합 동반.

**precedent**: T-0061 / T-0062 (2 회차, 평균 +33% over).

### 3.4 single-helper test

**정의**: shared test helper (예: `test/helpers/prisma-mock.ts`) 추출 또는 jest config 단일 변경 task.

**발생 trigger pattern**: jest config / jest-e2e config / shared mock helper 신설 + 본문 doc 박제 정합.

**precedent**: T-0058 (1 회차, +243% over).

### 3.5 single-file-create (신규 sub-pattern 후보, 1 회차 박제)

**정의**: doc-only direct 의 단일 신설 파일 task — inline-amend (× 0.4 effective) 와 NEW-doc enumerated-section (× 1.6) 사이 중간 패턴. 기존 doc 의 amend 가 아니라 새 파일 신설이라 LOC mass 가 inline-amend 보다 무거움, 그러나 NEW-doc enumerated 처럼 7~10 단락 박제 desire 가 없음 — 단일 파일 / 단일 개념 박제.

**박제 trigger**: 기존 doc 에 amend 하기 부적합한 단일 신설 (예: `.gitattributes`, `.editorconfig`, `.npmrc`, IDE config) 또는 단일 헬퍼 / 단일 ADR 박제 시. precedent: T-0100 (`.gitattributes` 신설) estimatedDiff=15 actual=31 +107% over (× 2.07 effective).

**박제 결론**: 1 회차 데이터 만으로 multiplier 분리 보류 (CLAUDE.md §3 ramen-noodle 회피). 다음 2 회차 발생 후 박제 — single-file-create 후보 task (예: `.editorconfig` / `.npmrc` 신설 / 새 헬퍼 mod 신설) 누적 시 별도 sub-multiplier × ~1.5 calibration 후보.

### 3.6 cleanup-only (신규 sub-pattern 후보, 1 회차 박제)

**정의**: code 변경 0 + 외부 effect (gh API 호출 / branch delete / PR close) 만 수행하는 task. STATE / journal bookkeeping 의 small commit + 큰 외부 effect mass 가 본질.

**박제 trigger**: stale PR / branch / cache / lock 정화 task — cron driver 의 systemic breakage 잔재 (HQ-0006/8/9/10/13 cron-env-gh-absent 등) 또는 manual /loop 의 race-condition 잔재 cleanup. precedent: T-0098 (stale cron PR cleanup × 13 PR + 13 branch = 26 외부 effect) estimatedDiff=20 actual=3 -85% over-estimate (× 0.15 effective).

**박제 결론**: 1 회차 데이터 만으로 multiplier 분리 보류. 다음 2 회차 발생 후 박제 — cleanup-only 후보 task (예: stale worktree cleanup / cache 정화) 누적 시 별도 sub-multiplier × ~0.2 calibration 후보. 외부 effect 가 본질이므로 LOC mass 가 본질 아닌 task — multiplier 자체보다 외부 effect count 박제가 더 유의미할 가능성.

## 4. multiplier 산출

각 카테고리의 multiplier 는 11 회차 case study 의 평균 overrun + buffer 적용 결과:

| 카테고리                        | multiplier | 산출 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-112 4-카테고리 cover backbone | **× 1.5**  | T-0055 / T-0056 / T-0057 (base 3 회차) 평균 +80% over + T-0066 / T-0067 / T-0068 / T-0069 (session #20 4 회차) 평균 +16% over → 누적 7 회차 평균 +43% over. base 3 회차 단독 considering 시 multiplier 1.8 이 정확하나, session #20 4 회차 누적 후 + cap envelope (≤ 300 LOC) considering 시 **× 1.5 유지** (× 1.7 raw 갱신 시 1 회차 spike T-0069 +52% 만으로 정책 변경은 ramen-noodle pattern). P2002 분기 추가 entity 의 systematic +60 ~ 100 LOC mass 는 sub-multiplier × 1.2 분리 (하단 표). |
| doc-only enumerated-section     | **× 1.6**  | T-0063 +201% over → 단일 회차 데이터 considering 시 보수 1.6 (base 70 × 1.6 ≈ 112 LOC 안에서 enumerated section 7 단락 cover 가능 estimate).                                                                                                                                                                                                                                                                                                                                                      |
| ADR-first split stage           | **× 1.3**  | T-0061 / T-0062 평균 +33% over → multiplier 1.33 의 보수 1.3.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| single-helper test              | **× 1.0**  | T-0058 +243% over 의 단일 데이터 considering 시 outlier 가능성 (doc 동반 cap-bend) → 1.0 유지 + planner 가 doc 동반 시 doc-only enumerated-section 으로 reclassify 권장.                                                                                                                                                                                                                                                                                                                          |

**§4 footnote (31 회차 milestone 시점)**:

- **partial-backbone subset × 1.3 → × 2.0 재산출 후보** — § 3.1.2 의 8 회차 precedent 평균 ×2.14 데이터. value 변경은 본 task scope 0, 별도 follow-up (검증 8 → 10 회차 누적 + reviewer 합의 후). 갱신 시 base × 1.5 × partial-backbone-sub × 1.3 = effective × 1.95 ≈ × 2.0 calibration.
- **single-file-create 1 회차 (T-0100 ×2.07)** — § 3.5 박제, multiplier 분리 보류 (다음 2 회차 발생 후 박제).
- **cleanup-only 1 회차 (T-0098 ×0.15)** — § 3.6 박제, multiplier 분리 보류 + 외부 effect count 박제가 더 유의미할 가능성.

### 4.1 sub-multiplier — P2002 분기 추가 (unique constraint entity)

R-112 4-카테고리 cover backbone 안의 sub-pattern (§ 3.1.1) 인 P2002 분기 추가 entity 박제 시 base multiplier 와 곱해 적용:

| sub-pattern                                | sub-multiplier | effective (base × sub)  | 산출 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2002 분기 추가 (unique constraint entity) | **× 1.2**      | × 1.5 × 1.2 = **× 1.8** | T-0069 (Part.name @unique 존재, P2002+P2025 2 분기 cover) +52% over vs T-0066 (Group.name @unique 미정의, P2025 1 분기 cover) +28% over → P2002 분기 추가가 systematic +60 ~ 100 LOC mass 의 source. base × 1.5 만으로 부족, sub-multiplier × 1.2 추가로 effective × 1.8 박제. **T-0071 (PartService.update, P2002 sub × 1.2 첫 사용 사례)** 의 actual 325 LOC vs envelope 360 LOC (-10% within tolerance) accurate-pass — sub-multiplier × 1.2 검증 데이터 1 회차 확정. |

**적용 식**: `estimated = base_intuition × multiplier × p2002_sub_multiplier?`. base 가 직관 estimate (R-112 / enumerated / chain / helper 의 카테고리 미적용 LOC) → category multiplier 적용 → 본 task 가 P2002 분기 추가 entity 면 sub-multiplier × 1.2 추가 곱셈 → frontmatter `estimatedDiff` 박제. sub-multiplier 적용 여부는 schema.prisma 의 `@unique` / `@@unique` 명시 박제 entity 인지로 판정.

### 4.2 sub-multiplier — doc-only inline-amend (기존 doc section 단위 수정)

doc-only enumerated-section 카테고리 (§ 3.2) 안의 inline-amend sub-pattern (§ 3.2.2) 박제 시 base multiplier 와 곱해 적용:

| sub-pattern                      | sub-multiplier | effective (base × sub)   | 산출 근거                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| doc-only inline-amend (기존 doc) | **× 0.4**      | × 1.6 × 0.4 = **× 0.64** | T-0070 (estimate-model.md +52 actual / 140 envelope -63% over) + T-0073 (integrator.md + CLAUDE.md amend +38 actual / 280 envelope -86% over) + T-0076 (p3-to-p4-transition.md refresh +119 actual / 120 envelope -1% accurate-pass) → **3 회차 평균 -50% over-estimate, range ~85 percentage point variance 큼**. ADR 또는 task spec 이 source 라서 inline edit 가 wholesale replacement 의 약 1/3 ~ 1/1 LOC 으로 가능 (T-0076 lower bound / T-0073 upper bound). **sub-multiplier × 0.4 값 자체 변경 0** — 3 회차 spread 큼이 systematic over-estimate 일관성 (under-estimate 0 회차) 박제이며 정확한 평균값 calibration 보다 본질적. effective × 0.64 mass envelope invariant. |

**적용 식**: `estimated = base_intuition × multiplier × inline_amend_sub_multiplier?`. base 가 직관 estimate (NEW-doc 의 wholesale section 단위) → doc-only enumerated × 1.6 → 본 task 가 inline-amend (기존 doc section 단위 수정) 면 sub-multiplier × 0.4 추가 곱셈 → frontmatter `estimatedDiff` 박제. sub-multiplier 적용 여부는 task 의 변경 대상이 NEW 파일 vs 기존 파일의 inline 수정인지로 판정.

## 5. planner 적용 절차

task 생성 시 estimate 산정 절차:

1. **base estimate 직관 산정** — Required Reading + Acceptance Criteria + Out of Scope 만 보고 직관 LOC estimate (multiplier 미적용).
2. **카테고리 classification** — 본 task 의 변경 대상이 §3 의 4 카테고리 중 어느 것에 해당하는지 결정. 복합 (예: backbone + ADR 동반) 시 가장 큰 multiplier 적용. **R-112 backbone 카테고리 일 경우 P2002 sub-multiplier 판정** — `prisma/schema.prisma` 의 본 entity 정의에 `@unique` 또는 `@@unique` 가 박제된 entity 면 P2002 sub-multiplier × 1.2 추가 적용 (§ 4.1). **doc-only enumerated-section 카테고리 일 경우 inline-amend sub-multiplier 판정** — 본 task 의 변경 대상이 기존 doc 의 section 단위 inline 수정 (`.claude/agents/*.md`, `CLAUDE.md`, `docs/architecture/*.md` 의 기존 파일 amend) 면 inline-amend sub-multiplier × 0.4 추가 적용 (§ 4.2).
3. **multiplier 적용** — `estimated = base × multiplier × sub_multiplier?`. P2002 분기 추가 entity 면 effective × 1.8 (base × 1.5 × 1.2). doc-only inline-amend 면 effective × 0.64 (base × 1.6 × 0.4). frontmatter `estimatedDiff` 박제.
4. **> 300 LOC 또는 > 5 파일 시 결정**:
   - **planner-pre-justified note** — frontmatter `plannerNote` 에 "cap-bend pre-justified: <category> × <multiplier> [× <sub-multiplier>] = <est> LOC, <precedent task ID> 패턴 정당화" 명시 + frontmatter `sizeExempt: true` + `exemptReason` 박제 → executor cap 검사 skip.
   - **split** — 본 task 를 2+ 의 작은 task 로 분할 (cap envelope 안). dependency chain (`dependsOn` / `blocks`) 으로 ordering 박제.
5. **frontmatter 박제 의무** — `estimatedDiff` 값에 multiplier (+ sub-multiplier) 적용 결과 박제. base estimate 가 아닌 calibrated estimate 박제.

## 6. 관측 누적 + 갱신 정책

본 doc 의 31 회차 case study + 4 카테고리 multiplier + 2 신규 sub-pattern 후보 + P2002 sub-multiplier × 1.2 + doc-only inline-amend sub-multiplier × 0.4 는 **현 시점 (session #27 turn 11, T-0102) 의 박제 snapshot**. **31 회차 milestone 도달** — 본 task (T-0102) 가 milestone marker 박제, 100 task milestone (counters.tasksCompleted=100) cross-ref. 후속 회차 누적 시 재산출:

- **50 회차 milestone** — +19 회차 추가 시, 평균 overrun 재계산 + multiplier delta ≥ 0.2 시 본 doc §4 갱신. **partial-backbone × 1.3 → × 2.0 재산출 결정** marker (8 회차 → 10+ 회차 누적 + reviewer 합의 후 별도 follow-up task). single-file-create / cleanup-only sub-pattern 도 추가 2+ 회차 발생 시 별도 sub-multiplier 분리 박제 후보.
- **75 회차 milestone** — +25 회차 추가 시, 카테고리 추가 필요성 검토 (e2e-only / smoke-only / config-only / 다른 entity P2002 sub-pattern / inline-amend NEW-doc 별도 카테고리 승격 §3.2.1 / §3.2.2 → §3.7 / §3.8 후보).
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
- [docs/tasks/T-0070-estimate-model-multiplier-refinement.md](../tasks/T-0070-estimate-model-multiplier-refinement.md) — estimatedDiff=140 / actual 52 LOC (-63%) 박제 source — doc-only inline-amend sub-pattern 첫 발화 (T-0073 와 함께 §4.2 sub-multiplier × 0.4 박제 근거).
- [docs/tasks/T-0071-part-service-update.md](../tasks/T-0071-part-service-update.md) — estimatedDiff=360 / actual 325 LOC (-10%) 박제 source — P2002 sub-multiplier × 1.2 첫 사용 사례 검증 데이터 (effective × 1.8 multiplier accurate-pass).
- [docs/tasks/T-0072-adapt-agents-to-mcp.md](../tasks/T-0072-adapt-agents-to-mcp.md) — estimatedDiff=240 / actual 234 LOC (-3%) 박제 source — doc-only NEW-doc creation accurate-pass (§3.2.1 sub-pattern), T-0063 outlier 후 첫 calibration.
- [docs/tasks/T-0073-integrator-md-and-claude-md-mcp-amend.md](../tasks/T-0073-integrator-md-and-claude-md-mcp-amend.md) — estimatedDiff=280 / actual 38 LOC (-86%) 박제 source — doc-only inline-amend sub-pattern 2 회차 (§3.2.2), § 4.2 sub-multiplier × 0.4 박제 근거.
- [docs/tasks/T-0076-p3-to-p4-transition-refresh.md](../tasks/T-0076-p3-to-p4-transition-refresh.md) — estimatedDiff=120 / actual 119 LOC (-1% accurate-pass) 박제 source — doc-only inline-amend sub-pattern 3 회차 (§3.2.2), variance 큼 (range ~85 percentage point) 박제 직접 trigger.
- [docs/tasks/T-0077-estimate-model-15-milestone-variance-refinement.md](../tasks/T-0077-estimate-model-15-milestone-variance-refinement.md) — 15 회차 milestone marker + variance 큼 박제 refinement (doc-only inline-amend sub-multiplier × 0.4 dogfood 4 회차).
- [docs/tasks/T-0083-rbac-roles-decorator-and-guard.md](../tasks/T-0083-rbac-roles-decorator-and-guard.md) — estimatedDiff=600 / actual 1062 LOC (+77%) 박제 source — partial-backbone subset 첫 회차.
- [docs/tasks/T-0084-api-md-auth-routes-amend.md](../tasks/T-0084-api-md-auth-routes-amend.md) — estimatedDiff=51 / actual 19 LOC (-63%) 박제 source — inline-amend sub-pattern 4 회차.
- [docs/tasks/T-0086-user-service-change-role.md](../tasks/T-0086-user-service-change-role.md) — estimatedDiff=260 / actual 594 LOC (+128%) 박제 source — partial-backbone subset 2 회차.
- [docs/tasks/T-0087-user-controller-patch-role.md](../tasks/T-0087-user-controller-patch-role.md) — estimatedDiff=540 / actual 1076 LOC (+99%) 박제 source — partial-backbone subset 3 회차 (within-round 2 fix push).
- [docs/tasks/T-0088-api-md-superadmin-row-amend.md](../tasks/T-0088-api-md-superadmin-row-amend.md) — estimatedDiff=32 / actual 6 LOC (-81%) 박제 source — inline-amend sub-pattern 5 회차.
- [docs/tasks/T-0089-adr-0008-rbac-backbone-amend.md](../tasks/T-0089-adr-0008-rbac-backbone-amend.md) — estimatedDiff=35 / actual 32 LOC (-9%, 정확-pass) 박제 source — inline-amend sub-pattern 6 회차.
- [docs/tasks/T-0091-auth-e2e-helper-jwt-issue.md](../tasks/T-0091-auth-e2e-helper-jwt-issue.md) — estimatedDiff=260 / actual 519 LOC (+100%) 박제 source — partial-backbone subset 4 회차.
- [docs/tasks/T-0093-uc-04-uc-05-sequence-diagram-amend.md](../tasks/T-0093-uc-04-uc-05-sequence-diagram-amend.md) — estimatedDiff=35 / actual 8 LOC (-77%) 박제 source — inline-amend sub-pattern 7 회차.
- [docs/tasks/T-0094-auth-controller-signup.md](../tasks/T-0094-auth-controller-signup.md) — estimatedDiff=260 / actual 569 LOC (+119%) 박제 source — partial-backbone subset 5 회차.
- [docs/tasks/T-0095-user-response-dto.md](../tasks/T-0095-user-response-dto.md) — estimatedDiff=200 / actual 469 LOC (+135%) 박제 source — partial-backbone subset 6 회차.
- [docs/tasks/T-0096-api-md-modules-md-superadmin-sync.md](../tasks/T-0096-api-md-modules-md-superadmin-sync.md) — estimatedDiff=35 / actual 6 LOC (-83%) 박제 source — inline-amend sub-pattern 8 회차.
- [docs/tasks/T-0097-uc-04-userresponsedto-amend.md](../tasks/T-0097-uc-04-userresponsedto-amend.md) — estimatedDiff=25 / actual 4 LOC (-84%) 박제 source — inline-amend sub-pattern 9 회차.
- [docs/tasks/T-0098-stale-cron-pr-cleanup.md](../tasks/T-0098-stale-cron-pr-cleanup.md) — estimatedDiff=20 / actual 3 LOC (-85%) 박제 source — cleanup-only sub-pattern 첫 회차 (§3.6).
- [docs/tasks/T-0099-get-users-list-endpoint-admin-tier.md](../tasks/T-0099-get-users-list-endpoint-admin-tier.md) — estimatedDiff=260 / actual 660 LOC (+154%) 박제 source — partial-backbone subset 7 회차.
- [docs/tasks/T-0100-gitattributes-eol-lf-permanent-fix.md](../tasks/T-0100-gitattributes-eol-lf-permanent-fix.md) — estimatedDiff=15 / actual 31 LOC (+107%) 박제 source — single-file-create sub-pattern 첫 회차 (§3.5).
- [docs/tasks/T-0101-get-user-detail-endpoint-self-or-admin.md](../tasks/T-0101-get-user-detail-endpoint-self-or-admin.md) — estimatedDiff=260 / actual 516 LOC (+98%) 박제 source — partial-backbone subset 8 회차.
- [docs/tasks/T-0102-estimate-model-100-task-milestone-refinement.md](../tasks/T-0102-estimate-model-100-task-milestone-refinement.md) — 본 task, 31 회차 milestone marker + 100 task milestone cross-ref + partial-backbone subset 박제 + 2 신규 sub-pattern (single-file-create / cleanup-only) 후보 박제.
- [.claude/agents/planner.md](../../.claude/agents/planner.md) — 본 doc 의 multiplier 적용 단락 (Estimate model 단락) 참조.
- [docs/architecture/p3-to-p4-transition.md](p3-to-p4-transition.md) §2.5 — 5 회차 cap-bend 박제 source (본 doc 가 31 회차로 확장).
- [CLAUDE.md](../../CLAUDE.md) §3 — task size cap (≤ 300 LOC / ≤ 5 파일) policy 불변 source.

Refs: T-0102, T-0101, T-0100, T-0099, T-0098, T-0097, T-0096, T-0095, T-0094, T-0093, T-0091, T-0089, T-0088, T-0087, T-0086, T-0084, T-0083, T-0077, T-0076, T-0073, T-0072, T-0071, T-0070, T-0069, T-0068, T-0067, T-0066, T-0064, T-0063, T-0062, T-0061, T-0058, T-0057, T-0056, T-0055
