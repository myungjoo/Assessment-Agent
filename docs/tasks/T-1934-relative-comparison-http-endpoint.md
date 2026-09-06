---
id: T-1934
title: 좌표 상대 비교 조회 endpoint + query DTO 신설 (REQ-036 배선 3/3)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-036]
estimatedDiff: 460
estimatedFiles: 4
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone(controller + DTO + 양 colocated spec 4 layer) × 1.5 = base 305 → 460 LOC, T-1933 패턴 정당화. 수치 근거 — 같은 module 의 2 축 query/body DTO 선례 `reset-by-period-request.dto.ts` 45 행 + 그 colocated spec 213 행 = 258 행이 DTO 쌍의 실측 mass 이고(본 task 는 spec 을 160 행으로 눌러 240), 여기에 controller endpoint(+75: 주석 25 · handler 15 · 12 번째 생성자 param 10 · import 8 · 여유)와 controller spec(+175: 신규 builder 35 · unit describe 90 · RBAC metadata describe 40 + **기존 `new AssessmentEvaluationController(...)` 5 개 site 전부에 12 번째 인자 추가** +10) 이 더해져 cap 을 구조적으로 넘는다. 파일 수 4 는 cap(≤ 5) 안이고, DTO 만 떼어내면 소비처 0 인 파일 신설이 되어 PLAN `182 행` 오너 지시(소비처 동반 의무)와 정면 충돌하므로 split 대신 예외를 택한다."
created: 2026-09-07
independentStream: p5-req036-relative-comparison
dependsOn: [T-1931, T-1932, T-1933]
touchesFiles:
  - src/assessment-evaluation/dto/relative-comparison-query.dto.ts
  - src/assessment-evaluation/dto/relative-comparison-query.dto.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: "P5 REQ-036 배선 3/3 — T-1933 read-adapter 의 HTTP 소비처(GET relative-comparison + query DTO)로 arc 종결"
---

# T-1934 — 좌표 상대 비교 조회 endpoint + query DTO 신설 (REQ-036 배선 3/3)

## Why

[docs/requirements.md](../requirements.md) `55 행` REQ-036 의 마지막 미충족 축 "개발자 간 상대 비교 전용 산출 경로" 는 helper([T-1931](T-1931-summary-relative-comparison-signal.md)) → 좌표 조회 표면([T-1932](T-1932-summary-coordinate-cohort-query.md)) → read-adapter + DI 등록([T-1933](T-1933-summary-relative-comparison-reader.md)) 까지 3 단이 쌓였으나 **외부에서 부를 수 있는 표면이 아직 없다** — adapter 의 HTTP caller 가 0 이라 산출 경로가 프로세스 안에만 존재한다. 본 slice 가 `AssessmentEvaluationController` 에 조회 endpoint 1 개와 그 query DTO 를 붙여 arc 를 종결한다. [T-1933](T-1933-summary-relative-comparison-reader.md) `Follow-ups (a)` 그대로다.

**issue-still-relevant pre-check (origin/main `eb9a21bd` 실측)**:

1. `git grep -n "SummaryRelativeComparisonReader" origin/main -- src | grep -v "\.spec\."` 의 히트는 **module 등록 3 행** (`assessment-evaluation.module.ts` `57`·`153`·`208 행` — import · provider · export) 과 **adapter 자기 파일 2 행** (`1`·`72 행`) 뿐이다. 즉 provider 로 살아 있으나 **주입받아 호출하는 production 소비처가 0** — 배선 3/3 구멍이 그대로 유효하다 (재큐잉 아님).
2. `git grep -rn "relative" origin/main -- "src/**/*.controller.ts"` 히트 **0 행** — 어떤 controller 에도 상대 비교 route 가 없다.
3. `src/assessment-evaluation/dto/` 에 `relative-comparison-query.dto.ts` 부재 (`ls` 실측 — 해당 디렉터리 40 파일 중 매칭 0).
4. [docs/architecture/api.md](../architecture/api.md) `§ 5` 의 `/api/assessment-evaluation` 그룹(`115~117 행` 헤더 + evaluate + period)에도 상대 비교 행이 없어 계약 자체가 미박제다.
5. 반대로 **전제 3 단은 모두 main 에 안착** 했다 — adapter public 메서드는 `summary-relative-comparison-reader.service.ts` `90 행` `readForCoordinate(period, periodStart)` 이고, module `208 행` 이 이미 `exports` 에 올려 뒀으며(같은 module 의 controller 는 provider 로 바로 주입 가능), 상류 `SummaryService.findByCoordinate` 는 `summary.service.ts` `136~148 행` 에 실재한다. 본 task 는 미착수 잔여 구간이다.

**오너 지시 게이트 pre-check**:

- [PLAN](../PLAN.md) `157 행` (R-91 k6 최우선): 본 slice 는 `test/load/` · `.github/workflows/` · `package.json` 을 건드리지 않는다. R-91 잔여 축(실 수집·실 LLM 왕복)은 자격증명 0 이라 자율 집행 불가 구간이므로 경합이 아니다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 중단): `test/perf/` 에 파일을 신설하지도 수정하지도 않는다. 신규 route 를 만들지만 그 route 의 perf-spec 은 **만들지 않는다** (금지 조항 정합).
- [PLAN](../PLAN.md) `182 행` (소비처 동반 의무): 본 slice 는 DTO 신설과 그 **유일한 소비처(controller endpoint)** 를 같은 PR 에 넣는다. DTO 만 떼어내는 분할은 오너 지시가 지목한 "미배선 파일만 늘리는" 안티패턴이라 택하지 않으며, 그 대신 frontmatter `exemptReason` 에 수치 근거를 제시했다.
- [PLAN](../PLAN.md) `183 행` (REQ 재판정 1 회): 본 slice 는 `docs/requirements.md` 를 **건드리지 않는다**. REQ-036 재판정은 본 PR 머지 뒤 `Follow-ups (b)` 에서 딱 1 회.

## Required Reading

- [src/assessment-evaluation/summary-relative-comparison-reader.service.ts](../../src/assessment-evaluation/summary-relative-comparison-reader.service.ts) `72 행` (클래스 선언) · `75~89 행` (JSDoc 계약 — 검증 forward · 전파 예외 2 종) · `90~93 행` (`readForCoordinate` 시그니처) — 본 endpoint 의 유일한 위임 대상. **수정 금지.**
- [src/assessment-evaluation/domain/summary-relative-comparison.ts](../../src/assessment-evaluation/domain/summary-relative-comparison.ts) `62~72 행` (`PersonRelativeStanding`) · `75~83 행` (`RelativeComparisonResult`) — 응답 타입. 이미 JSON-safe(number/string 만)라 response mapper 가 필요 없다는 판단의 근거. **수정 금지.**
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `145 행` (`@Controller("api/assessment-evaluation")`) · `146~152 행` (controller-scope ValidationPipe 3 옵션) · `159 행`~`222 행` (생성자 — 11 param 과 각 param 의 등록 사유 주석 형식) · `722~760 행` (`resetByPeriod` — 가장 최근·가장 얇은 endpoint 선례: 주석 구조 · decorator stack · thin delegate 본문).
- [src/assessment-evaluation/assessment-evaluation.controller.spec.ts](../../src/assessment-evaluation/assessment-evaluation.controller.spec.ts) `166~178 행` (`new AssessmentEvaluationController(...)` 11 인자 호출 형태 — **본 파일에 같은 호출이 5 곳**) · `3867~3985 행` (`resetByPeriod` unit describe — builder + happy + negative 형식) · `3986 행`~파일 끝 (RBAC / HttpCode metadata describe 형식).
- [src/assessment-evaluation/dto/reset-by-period-request.dto.ts](../../src/assessment-evaluation/dto/reset-by-period-request.dto.ts) 전체 45 행 — 2 축 DTO 의 최소 선례(주석 구조 + decorator 조합 + `@IsIn` 미적용 관행).
- [src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts](../../src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts) `63~66 행` — ISO-8601 축(`@IsString` + `@IsNotEmpty` + `@IsISO8601`) 의 선례와 "비-ISO 를 boundary 에서 400 으로 거부해 Invalid Date 가 하류로 흘러가는 opaque 실패를 막는다" 는 사유.
- [src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.spec.ts](../../src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.spec.ts) `1~40 행` — DTO spec 의 `plainToInstance` + `validate` helper 형식.
- [src/user/summary.service.ts](../../src/user/summary.service.ts) `126~148 행` (`findByCoordinate` 의 2 단계 검증 + `BadRequestException`) — 값 검증의 **단일 출처**. 본 task 에서 수정 금지.
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `146~153 행` (adapter provider 등록) · `205~208 행` (export) — **이미 등록돼 있으므로 본 task 의 module 변경은 0** 임을 확인하는 용도.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) `98~103 행` — 조회 route 의 RBAC 관행(User+ tier) 참고. 본 task 는 아래 §설계 계약 (2) 사유로 Admin+ 를 택하므로 **그대로 따르지 않는다**.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` (R-110 · R-112) · `§12` (언어 정책 · `§ 12.76` 행 범위 표기).

## 설계 계약 (구현자가 임의로 바꾸지 않는다)

### (1) `RelativeComparisonQueryDto` (신규 파일)

파일: `src/assessment-evaluation/dto/relative-comparison-query.dto.ts`

- 축 **2 개만** — `period!: string` (`@IsString` + `@IsNotEmpty`) · `periodStart!: string` (`@IsString` + `@IsNotEmpty` + `@IsISO8601`).
- **`@IsIn` 미적용** — 허용 literal(day/week/month) 검증은 `SummaryService.assertValidPeriod` 가 단일 출처다 (같은 module 의 `period-bridge.dto.ts` / `reset-by-period-request.dto.ts` 관행 정합). 형식만 boundary 에서 막는다.
- `@Type` / class-transformer 변환 **0** — string→Date 변환은 controller 책임 (아래 (2)). DTO 는 문자열 축만 소유한다.
- 파일 상단에 선례 형식의 한국어 주석 (책임 / controller-scope ValidationPipe 와 결합했을 때 자동 강제되는 400 2 종 / 책임 경계 3 절) 을 단다.
- 새 외부 dependency **0** — `class-validator` 는 이미 의존이다.

### (2) endpoint (기존 controller 확장)

```
@Get("relative-comparison")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("Admin")
async readRelativeComparison(
  @Query() dto: RelativeComparisonQueryDto,
): Promise<RelativeComparisonResult>
```

- 본문은 **한 문장 thin delegate** — `return this.relativeComparisonReader.readForCoordinate(dto.period, new Date(dto.periodStart));`. 분기 · 재정렬 · 필터 · 가공 **0**.
- **response mapper 불요** — `RelativeComparisonResult` 는 number/string 만으로 구성돼 이미 JSON-safe 다 (`domain/summary-relative-comparison.ts` `75~83 행`). Date 직렬화 축이 없으므로 `unevaluated-fill-plan` 의 response mapper 패턴을 복제하지 않는다.
- `@HttpCode` **미부착** — GET 의 NestJS 기본 200 을 그대로 쓴다 (POST route 들이 `@HttpCode(200)` 을 다는 이유는 기본값이 201 이기 때문이며, GET 에는 해당 없음).
- **RunStatus 전이 0** — 본 route 는 읽기이지 평가 실행이 아니다 (`resetByPeriod` 주석의 ADR-0060 §Decision 4 판단과 동형).
- **입력 검증 중복 0** — 잘못된 period literal · Invalid Date 는 adapter 를 거쳐 `SummaryService` 의 `BadRequestException` 으로 400 이 된다. controller 는 자체 검증 분기 · 자체 예외 매핑을 만들지 않는다. adapter/service reject 는 **raw 전파**(swallow 0).
- **RBAC 는 Admin+** — 본 응답은 한 좌표의 **모든 person 의 rank·percentile** 이라 요청자 자신 밖의 상대 위치를 노출한다. 같은 controller 의 `evaluate` / `reset` 이 쓰는 Admin+ stack 을 mirror 하고 (새 auth 결정 0), User self-view tier 는 별도 결정 대상으로 `Follow-ups (d)` 에 남긴다. `src/user/summary.controller.ts` `98~103 행` 의 User+ 관행을 따르지 않는 사유를 endpoint 주석에 2~3 행으로 박제한다.
- **생성자 param 은 맨 끝에 1 개만 추가** — `private readonly relativeComparisonReader: SummaryRelativeComparisonReader`. 기존 11 param 의 위치 · 순서 **불변** (T-1842 / T-1916 이 지킨 규약). 등록 사유 주석은 선례 형식으로 3~5 행 — 특히 `assessment-evaluation.module.ts` `153 행` provider 등록이 이미 끝나 **module 파일 변경이 0** 이라는 사실 포함.
- **`assessment-evaluation.module.ts` 는 건드리지 않는다** (`touchesFiles` 4 개에 없음).

### (3) LOC 예산 (초과 시 주석 · spec 케이스를 줄여 맞춘다)

| 파일 | 예산 |
| --- | --- |
| `dto/relative-comparison-query.dto.ts` | +50 |
| `dto/relative-comparison-query.dto.spec.ts` | +160 |
| `assessment-evaluation.controller.ts` | +75 |
| `assessment-evaluation.controller.spec.ts` | +175 |

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/relative-comparison-query.dto.ts` 가 위 계약대로 신설된다 — 축 2 개 (`period` · `periodStart`), `@IsIn` 미적용, `@Type` 변환 0.
- [ ] `assessment-evaluation.controller.ts` 에 `@Get("relative-comparison")` route 1 개가 추가되고 본문이 **한 문장 위임** 이며, 생성자 param 은 맨 끝에 1 개만 늘고 기존 11 param 의 순서가 그대로다 (`git diff` 로 확인). `assessment-evaluation.module.ts` 는 **무변경**.
- [ ] **happy-path unit test** — public symbol 별 1+ : (i) `readRelativeComparison` 이 mock reader 의 반환을 **가공 없이 그대로** 반환하고, `readForCoordinate` 가 정확히 1 회, 인자 `(dto.period, new Date(dto.periodStart))` — 즉 두 번째 인자가 `Date` instance 이며 `getTime()` 이 원문 ISO 와 동일 — 으로 호출됨 (ii) `RelativeComparisonQueryDto` 가 정상 payload 에서 validation error 0.
- [ ] **error path unit test** — (i) reader 가 `BadRequestException` 으로 reject 하면 controller 가 **변환 없이** 전파 (ii) reader 가 `TypeError`(중복 personId 좌표 계약 위반) 로 reject 해도 그대로 전파 (iii) 일반 rejection(의존성 실패) 도 그대로 전파. 각 1+ 케이스이며 어느 경우에도 controller 가 자체 status 를 만들지 않음.
- [ ] **분기별 test** — controller handler 는 분기 0 (thin delegate) 이므로 이 항목은 **DTO decorator 분기** 로 충족한다: `period` 의 `@IsNotEmpty` · `periodStart` 의 `@IsISO8601` 각각이 실패/통과하는 케이스를 분리해 constraint key 로 단언한다 (분기 없는 handler 임을 controller 주석에 명시).
- [ ] **negative case test (예외 분기마다 1+)** — 최소 5 종: ① `period` 누락 → `isNotEmpty` constraint ② `periodStart` 비-ISO(`"2026-13-99"`) → `isISO8601` constraint ③ 정의 외 query 필드 → `forbidNonWhitelisted` 400 (`whitelist: true, forbidNonWhitelisted: true` ValidationPipe 로 검증) ④ 비-string 타입(number 등) 주입 → `isString` constraint ⑤ 빈 좌표에서 reader 가 `{ cohortSize: 0, mean: 0, byPerson: [] }` 를 줄 때 controller 가 404 로 바꾸지 않고 200 본문으로 그대로 통과시킴 ⑥ controller 가 reader 반환 객체 · `byPerson` 배열을 mutate/재정렬하지 않음(참조 동일성 또는 순서 보존 단언).
- [ ] **RBAC metadata 단언** — `Reflector` 로 신규 route 에 `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` 가 부착됐음을 확인하는 `it` 1+ (기존 `resetByPeriod (RBAC / HttpCode metadata)` describe 형식 mirror).
- [ ] spec 은 신규 colocated DTO spec 1 개 + 기존 `assessment-evaluation.controller.spec.ts` 확장으로만 구성한다 (`test/helpers/` 추가 **0**, e2e · smoke · perf 파일 추가 **0**).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`), 신규 DTO 파일과 신규 route 는 statement · branch · function · line 100%.
- [ ] `git diff --stat` 의 변경 파일이 frontmatter `touchesFiles` 4 개뿐이다 (`assessment-evaluation.module.ts` · `src/user/**` · `domain/**` · `docs/requirements.md` · `docs/architecture/api.md` 전부 미접촉, task 파일 status 갱신은 별개).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 준수 — 주석 · spec describe/it 문자열은 한국어, 식별자 · 경로는 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `153 행`, `L` prefix 금지).

## Out of Scope

- **`assessment-evaluation.module.ts` 변경 금지** — adapter 는 `153 행` provider · `208 행` export 로 이미 등록돼 있다. 추가 등록이 필요하다고 판단되면 잘못 읽은 것이다.
- **`src/user/**` · `domain/summary-relative-comparison.ts` · adapter 수정 금지** — 산출 규칙 · 절하 규약 · 검증 위치를 바꾸지 않는다 (읽기 전용 소비). 부족하면 본 task 를 BLOCKED 로 세우고 별도 slice.
- [docs/architecture/api.md](../architecture/api.md) `§ 5` endpoint 행 신설 · 합계 재집계 (`Follow-ups (a)` — doc-only direct).
- `docs/requirements.md` REQ-036 재판정 · `docs/PLAN.md` checkbox 승격 (PLAN `183 행` once-rule — `Follow-ups (b)`).
- e2e(supertest 실 부팅) · smoke spec 신설 (`Follow-ups (c)`).
- RBAC tier 완화(User self-view) · 응답 필드 마스킹 정책 (`Follow-ups (d)` — auth 정책 변경은 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트).
- 프런트(`web/`) 소비 · 시각화.
- `prisma/schema.prisma` 변경 · 새 index · migration (`§5` DB schema 게이트 — T-1932 `Follow-ups (c)` 좌표 축 index 검토는 여전히 보류).
- `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 접촉 (PLAN `157`·`158 행` 게이트 — 신규 route 의 perf-spec 도 만들지 않는다).
- ADR 신설 (기존 ADR-0032 controller 계약 + ADR-0035 좌표 계약 안의 route 추가라 새 결정 없음).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **api.md doc-sync** — `§ 5` 의 `/api/assessment-evaluation` 그룹(`115 행` 헤더 아래)에 신규 GET route 행 1 개 추가 + `169 행` 합계 재집계(endpoint 84 → 85, prefix 18 불변 — 기존 prefix 안의 정적 sub-path). direct doc-only, 1 파일.
- (b) **REQ-036 재판정 1 회** — (a) 또는 본 PR 머지 뒤 `docs/requirements.md` `55 행` 을 helper→조회→adapter→endpoint 4 단 실측으로 **딱 1 회** 재판정 (PLAN `183 행` once-rule). (a) 와 같은 direct doc-only 라 한 task 로 묶어도 된다.
- (c) **e2e 통합 spec** — supertest 실 부팅으로 401/403/400/200 4 경로 + 실 DB 좌표 fixture 상대 비교 결과 검증.
- (d) **RBAC tier 재검토** — 요청자 자신의 standing 만 돌려주는 User+ 변형 route 의 필요성. 노출 범위 결정이라 auth 정책 변경 게이트(`§5`) 대상이며 ADR 선행 여부부터 판단.
