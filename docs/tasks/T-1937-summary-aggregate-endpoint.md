---
id: T-1937
title: 좌표 종합 코멘트 생성 endpoint 신설 (DTO 소비처 배선 2/2)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-004]
estimatedDiff: 410
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-summary-aggregate-http
dependsOn: [T-1936]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone × 1.5 = 410 LOC (route 1 개 + 생성자 13 번째 param + DTO→도메인 매퍼 4 분기 + colocated spec 확장), T-1934 선례(+528, 동일 controller 에 route 1 개 추가). 파일 2 ≤ 5 이고 초과분 전량이 spec mass — controller.spec.ts 의 `new AssessmentEvaluationController(` construction site 6 곳(`174`·`298`·`432`·`3042`·`3847`·`4072 행`)이 13 번째 인자 때문에 전부 수정되는 고정비가 포함된다"
plannerNote: "P5 REQ-004 — T-1936 DTO 의 유일 소비처(HTTP 진입점) 배선 2/2, PLAN 182 행 소비처 동반 의무 충족"
---

# T-1937 — 좌표 종합 코멘트 생성 endpoint 신설 (DTO 소비처 배선 2/2)

## Why

[docs/requirements.md](../requirements.md) `23 행` REQ-004 의 잔여 축 **"좌표 종합 코멘트의 HTTP 진입점 부재"** 를 닫는 배선 2/2 다. 직전 slice [T-1936](T-1936-summary-aggregate-request-dto.md) 이 입력 계약(`SummaryAggregateRequestDto`)만 세웠고 그 DTO 를 읽는 production 소비처가 아직 0 이라, 좌표 종합 코멘트 chain(`SummaryNarrativeService` → `SummaryPersistService` → `SummaryAggregateOrchestratorService.evaluateAndPersist`)이 여전히 프로세스 안에만 있다. 본 task 는 그 chain 을 HTTP 로 노출만 한다 — 새 결정 0 · 새 dependency 0 · module 배선 0 (PLAN.md `94 행` Phase P5 evaluation pipeline).

**issue-still-relevant pre-check (origin/main `909e10a1` 실측)** — ① `git grep '@Post("summary")' -- 'src/**/*.controller.ts'` **히트 0 행**. ② `assessment-evaluation.controller.ts` 의 route 는 `247`·`400`·`614`·`675`·`752 행` `@Post` 5 개 + `803 행` `@Get("relative-comparison")` 1 개뿐이라 요약 route 여전히 0. ③ `SummaryAggregateOrchestratorService` 의 spec 제외 참조는 `assessment-evaluation.module.ts` `53`·`110`·`192 행`(등록) + `summary-batch-orchestrator.service.ts` `120`·`152 행`(sibling 주입) + domain 주석뿐 — **controller 주입 0** 확인. ④ 반대로 전제인 DTO 는 안착 확인(`dto/summary-aggregate-request.dto.ts` `93 행` `SummaryAggregateRequestDto`, T-1936 main `fff2edfd`)이라 재큐잉이 아니라 미착수 잔여 구간이다.

**오너 지시 게이트** — PLAN `157 행` R-91 · `158 행` R-92 는 **미접촉**(`test/perf/` 변경 0 파일, 신규 route 의 perf-spec 도 만들지 않는다 — R-92 신규 per-route baseline slice 금지 준수). `182 행` 소비처 동반 의무는 **본 task 가 바로 그 소비처** 라 정면 충족한다(T-1936 이 `Follow-up (a)` 로 파일·배선 단위 명시해 둔 slice). `183 행` REQ 재판정 once-rule — REQ-004 재판정은 본 PR 머지 뒤 **1 회**(Follow-up (c))이고 본 task 는 `docs/requirements.md` 를 건드리지 않는다.

## Required Reading

- `src/assessment-evaluation/assessment-evaluation.controller.ts` `150~160 행`(`@Controller` + controller-scope `ValidationPipe` 설정) · `164~239 행`(생성자 12 param — 본 task 는 **맨 끝에 13 번째만 추가**하고 기존 순서 불변) · `740~772 행`(`@Post("reset")` — `@HttpCode(200)` + Admin+ stack 의 최근 POST 선례) · `803~814 행`(`@Get("relative-comparison")` — T-1934 의 thin delegate + RBAC 사유 주석 밀도 기준).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `689`·`731 행` — `runStatus.begin("evaluation")` 를 try **밖**, `end("evaluation")` 를 `finally` 에 두는 ADR-0060 §Decision 4 전이 shape(본 route 가 복제할 형태). `RunStatusService` 는 `221 행` 으로 **이미 주입돼 있어 추가 param 0**.
- `src/assessment-evaluation/dto/summary-aggregate-request.dto.ts` `93~138 행` — 본 route 의 입력 계약 6 필드(`personId` / `period` / `periodStart`(ISO string) / `mode` / `modelId` / `results`). `periodStart` → `Date` 변환과 허용 literal 판정이 **소비처 책임**임이 파일 머리 주석에 박제돼 있다.
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` `59~127 행` — 위임 대상 `evaluateAndPersist(context, results, mode, options, now)` 5 인자 계약 + 반환 `SummaryAggregateResult`(`{ evaluated, result? }`). skip(`evaluated: false`)은 오류가 아니다.
- `src/assessment-evaluation/domain/summary-batch-prompt.ts` `27~32 행` — `SummaryBatchContext`(`personId` / `period` / `periodStart: Date`).
- `src/assessment-evaluation/domain/evaluation-result.ts` `31~47 행`(`ContributionLevel` + `isContributionLevel` type-guard) · `53~70 행`(`EvaluationResult` 5 필드 — `difficulty: Difficulty` · `contribution: ContributionLevel` 은 **literal union** 이라 DTO 의 `string` 에서 그냥 cast 되지 않는다).
- `src/llm/difficulty.ts` — `isDifficulty` type-guard(허용 난이도 literal 단일 출처). `src/assessment-evaluation/domain/evaluation-prompt.ts` `23`·`27 행` 이 두 guard 를 함께 import 하는 선례.
- `src/assessment-evaluation/summary-persist.service.ts` `43~48 행`(`SummaryPersistResult`) · `50~58 행`(`SummaryPersistOptions.modelId`), `src/assessment-evaluation/evaluation-result-persist.service.ts` `45 행`(`PersistMode = "fill" | "reeval"`).
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `174`·`298`·`432`·`3042`·`3847`·`4072 행` — `new AssessmentEvaluationController(` construction site **6 곳**(13 번째 인자 추가로 전부 수정) + `4038~4090 행` — "관측 mock 1 개 + 나머지 의존 throw mock" 격리 패턴(T-1934) 과 RBAC/route metadata 단언 관행.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/assessment-evaluation.controller.ts` 에 `@Post("summary")` route 1 개 신설 — `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`(인접 `evaluate` / `reset` route stack mirror, 새 auth 결정 0), 핸들러 시그니처는 `@Body() dto: SummaryAggregateRequestDto` → `Promise<SummaryAggregateResult>`.
- [ ] 생성자에 `SummaryAggregateOrchestratorService` 를 **맨 끝 13 번째 param** 으로 추가(기존 12 param 위치·순서 불변). `assessment-evaluation.module.ts` 는 `110`·`192 행` 에서 이미 provider·export 등록 완료라 **module 파일 변경 0**.
- [ ] DTO → 도메인 변환을 핸들러 안(또는 같은 파일의 private 메서드)에서 수행: `context = { personId, period, periodStart: new Date(dto.periodStart) }` · `results` 는 원소별로 `isDifficulty` / `isContributionLevel` guard 로 좁혀 `EvaluationResult[]` 구성 · `mode` 는 `"fill" | "reeval"` 검증 후 전달 · `options = { modelId: dto.modelId }` · `now = new Date()`.
- [ ] 허용 literal 집합을 controller 에 **재구현하지 않는다** — 판정은 위 domain guard(`src/llm/difficulty.ts` · `domain/evaluation-result.ts`) 호출로만 하고, `mode` 는 `PersistMode` 타입 좁히기용 리터럴 2 개 비교만 허용. 미허용 값은 `BadRequestException`(400)으로 거부하고 그 사유를 주석에 좌표로 박제(무검증 `as unknown as` cast 금지).
- [ ] `runStatus.begin("evaluation")` 를 try **밖**, `end("evaluation")` 를 `finally` 에 둔다(`689`·`731 행` shape 복제). 단 400 으로 거부되는 매핑 실패는 begin **이전** 에 일어나게 배치해 "짝 없는 end" 와 "실행 아님인데 카운터 증가" 를 모두 피한다.
- [ ] orchestrator 반환값 가공 0 — `{ evaluated: false }` skip 신호를 404 / 409 로 바꾸지 않고 200 본문 그대로 통과시키고, service reject 는 raw 전파(swallow 0 · 자체 status 매핑 0).
- [ ] `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 확장(다른 위치 신규 spec 파일 금지) — 기존 construction site 6 곳에 13 번째 인자를 추가하되 본 route 를 부르지 않는 site 는 throw mock(`forbid` 관행)으로 격리:
  - [ ] **happy path** 1+ : 정상 payload → `evaluateAndPersist` 가 정확히 1 회, 5 인자(`context.periodStart` 가 `Date` instance · `results` 가 좁혀진 5 필드 · `mode` · `{ modelId }` · `now` 가 `Date`)로 호출되고 반환 객체가 그대로 응답.
  - [ ] **error path** 1+ : orchestrator reject(예: persist 실패)가 controller 에서 삼켜지지 않고 그대로 전파 + 그 경우에도 `end("evaluation")` 가 호출됨.
  - [ ] **분기별** 1+ : `evaluated: true`(result 존재) 분기와 `evaluated: false`(skip, result 부재) 분기 각각 200 응답 단언 / `results` 빈 배열 분기 위임 단언 / 매핑 실패 400 분기.
  - [ ] **negative case 를 예외 분기마다** 1+ : `difficulty` 미허용 literal · `contribution` 미허용 literal · `mode` 미허용 literal 각각 `BadRequestException` 이고 **orchestrator 미호출** + `begin` 미호출 · orchestrator throw 시 `begin`/`end` 짝 유지 · `begin` 이 throw 하면 `end` 미호출 — 각 1+ (총 5 종 이상).
  - [ ] **route metadata / RBAC** 단언 1+ : path `summary` · `@HttpCode(200)` · guard 2 종 · `@Roles("Admin")`(기존 metadata 단언 관행 mirror).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%), 변경 파일 `assessment-evaluation.controller.ts` 는 line · function 100% 유지.
- [ ] 새 외부 dependency 0 (`package.json` 변경 0).

## Out of Scope

- `src/assessment-evaluation/assessment-evaluation.module.ts` 변경 — orchestrator 는 `110`·`192 행` 에 이미 provider·export 등록됨.
- `SummaryAggregateRequestDto` 필드 추가·수정, `@IsIn` 도입 (허용 literal 단일 출처 계약 유지).
- `SummaryAggregateOrchestratorService` / `SummaryPersistService` / `SummaryNarrativeService` 본문 · 시그니처 변경.
- `SummaryBatchOrchestratorService`(배치 축) 의 HTTP 노출 — 별도 arc.
- `docs/architecture/api.md` route 표 갱신 · endpoint 합계 재집계 (Follow-up (a), direct doc-only).
- `docs/requirements.md` REQ-004 재판정 (PLAN `183 행` once-rule — Follow-up (b), 본 PR 머지 뒤 1 회).
- e2e / smoke / perf spec 추가 (PLAN `158 행` R-92 신규 per-route perf-spec 금지 포함).
- 응답 DTO / mapper 신설 — `SummaryAggregateResult` 는 이미 JSON-safe(`boolean` + `{ summaryId: string, created: boolean }`).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **doc-sync** — `docs/architecture/api.md` `§ 5` 의 `/api/assessment-evaluation` 그룹에 `POST /api/assessment-evaluation/summary` 행 1 개 추가 + 합계 `85 → 86` endpoint / shipped `80 → 81` 재집계(prefix 18 · 그룹 헤더 14 불변 여부 확인, `171 행` 집계 규칙 두 수 동기).
- (b) **REQ-004 재판정 1 회** — 본 PR 머지 뒤 `docs/requirements.md` `23 행` 의 "좌표 종합 코멘트의 HTTP 진입점 부재" 서술을 실측 좌표로 갱신. 프런트 노출 축 · 기간 종료 경계 축이 남으면 `DONE` 승격 여부는 그때 실측 판단.
- (c) **좌표 자동 산출 축** — 현 endpoint 는 caller 가 `results` 를 실어 보내는 형태다. 저장된 단위 평가를 좌표로 조회해 서버가 `results` 를 구성하는 변형(`SummaryBatchOrchestratorService` 축)은 별도 정책 결정 대상.
