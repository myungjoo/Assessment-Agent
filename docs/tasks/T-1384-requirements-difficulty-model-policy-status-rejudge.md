---
id: T-1384
title: requirements.md 69 행 REQ-050 3 난이도 모델 매핑·항목 난이도 결정 정책 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 30
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1384-requirements-difficulty-model-policy-status-rejudge.md
plannerNote: "requirements-status-resync 30 번째 slice — T-1383 이 남긴 잔여 PLANNED row 중 동형 ADR-필수 row (REQ-050), ADR-0011 실재·매핑 구현·항목 판정 3 축 전수 실측 가능, doc-only direct"
---

# T-1384 — requirements.md 69 행 REQ-050 3 난이도 모델 매핑·항목 난이도 결정 정책 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 69 행 REQ-050 (README 97 행 — "난이도에 따라 3가지 모델을 고를 수 있어야 하며, 어떤 항목이 어떤 난이도를 가지는 지를 구현하면서 결정하여야 한다") 는 kind = `Constraint`, 구현 위치 = `P4 (ADR 필수)`, 검증 위치 = `policy + unit` 인 **ADR 필수 row** 인데 상태 컬럼이 아직 `PLANNED` 다. 그러나 main 에는 `docs/decisions/ADR-0011-difficulty-model-assignment.md` (frontmatter 4 행 `status: ACCEPTED`) 가 이미 존재하고 `src/llm/difficulty-mapping.*` 3 layer + `prisma/schema.prisma` 441 행 `model DifficultyMapping` 까지 머지돼 있어 표-저장소 drift 가 남아 있다. 직전 slice T-1383 (REQ-017 재판정) 은 Out of Scope 에 "REQ-050 등 다른 `PLANNED` row 재판정 — 각각 별도 slice" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 30 번째 slice 로 **ADR 실재 축 · 슬롯 매핑 구현 축 · 항목 난이도 판정 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 69 행 (REQ-050) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-049 (68 행, 이미 `DONE`) · REQ-051 (70 행, 이미 `DONE (...)`) 은 필드 수 비교 및 서술 포맷 참고용으로만 쓴다.
- `docs/tasks/T-1383-requirements-confluence-traversal-policy-adr-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` + `한계 —` 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (심볼명 · 행 번호 · it 개수) 을 본 task 근거로 복사하지 않는다** — 그것은 Confluence 탐색 정책 축 (REQ-017) 의 근거다. 본 task 는 처음부터 직접 실측한다.
- `README.md` 97 행 — REQ-050 원문. 축 분해 = (a) **ADR 실재 축**: 난이도 모델 할당 정책 ADR 이 실재하고 status 가 무엇인지, (b) **슬롯 매핑 구현 축**: "3가지 모델을 고를 수 있어야" 를 충족하는 3 슬롯 고정 + 슬롯 ↔ model 지정 경로가 schema · service · controller 에 실재하는지, (c) **항목 난이도 판정 축**: "어떤 항목이 어떤 난이도를 가지는지" 를 결정하는 실 판정 경로가 코드에 실재하고 그 결정 근거가 ADR 또는 코드에 명시돼 있는지.
- `docs/decisions/ADR-0011-difficulty-model-assignment.md` — ADR 실재 축 + 결정 내용 축. frontmatter 의 `id` · `status` · `date` · `relatedTask` 를 행 인용으로 확정하고, Decision 절에서 **슬롯 cardinality (3 고정) · 매핑 의미 (슬롯 ↔ model N:1) · fallback 규칙** 각각을 행 번호와 함께 인용한다. 추측한 결정 요약을 적지 않는다. status 가 `ACCEPTED` 가 아니면 그 값을 그대로 적고 ADR 축을 충족으로 판정하지 않는다. 본 ADR 이 "어떤 항목이 어떤 난이도인지" (축 (c)) 까지 결정했는지 아니면 그 결정을 다른 곳에 위임했는지도 행 인용으로 확정한다.
- `src/llm/difficulty.ts` · `src/llm/difficulty-mapping.service.ts` · `src/llm/difficulty-mapping.repository.ts` · `src/llm/difficulty-mapping.controller.ts` — 슬롯 매핑 구현 축. 난이도 enum / 상수 정의 지점 (3 값 고정 여부), 슬롯별 재지정 메서드, 컨트롤러 route 를 각각 파일 · 행 인용으로 확정한다. 3 슬롯이 코드 상수로 고정돼 있지 않으면 그 사실을 그대로 적는다.
- `prisma/schema.prisma` 441 행 부근 `model DifficultyMapping` — 영속 축. 슬롯 식별 컬럼 · `llmProviderConfigId` FK · unique 제약을 행 인용한다.
- `src/assessment-evaluation/domain/evaluation-prompt.ts` — 항목 난이도 판정 축. 평가 단위 1 건의 난이도를 실제로 정하는 함수 (예: `classifyNarrative`) 의 정의 행과, 그 판정이 **결정 규칙 기반인지 LLM 응답 파싱 기반인지** 를 한 줄로 확정한다. 규칙이 코드에 없고 LLM 출력에 위임돼 있으면 "구현하면서 결정" 의 충족 여부를 그 사실대로 판정한다 (과대 해석 금지).
- 검증 위치 실 근거용 — 표의 검증 위치 컬럼이 `policy + unit` 이므로 (i) ADR 문서 실재 · status (policy 축), (ii) unit spec 실측 (`src/llm/difficulty.spec.ts` · `difficulty-mapping.service.spec.ts` · `difficulty-mapping.repository.spec.ts` · `difficulty-mapping.controller.spec.ts` · `src/assessment-evaluation/domain/evaluation-prompt.spec.ts` 각각의 `grep -c "^\s*it(" ` 개수) 를 각각 실측해 인용한다. 파일이 없으면 0 으로 적는다.

## 완료 기록 (2026-08-02)

- **ADR 실재 축 (충족)** — `docs/decisions/ADR-0011-difficulty-model-assignment.md` frontmatter 2 행 `id: ADR-0011` · 4 행 `status: ACCEPTED` · 5 행 `date: 2026-06-01` · 6 행 `relatedTask: T-0136`. 값 그대로 인용, 승격 해석 0.
- **결정 내용 축 (3/3 명시)** — Decision §1 (47~51 행) 49 행 "정확히 3 row" + 50 행 `@@unique([difficulty])`, Decision §2 (53~58 행) 55 행 FK `llmProviderConfigId` 참조 + 56 행 resolve 순서, Decision §3 (60~64 행) 62 행 fail-fast 4xx + 63 행 silent-fallback 기각.
- **슬롯 매핑 구현 축 (충족)** — `src/llm/difficulty.ts` 20 행 union / 26~30 행 `DIFFICULTIES` / 36 행 `isDifficulty`, `src/llm/difficulty-mapping.service.ts` 93 행 `resolveModel` · 153 행 `assignProviderConfig` (repository 89 행 `updateProviderConfig`), `src/llm/difficulty-mapping.controller.ts` 58 행 `@Controller("api/llm/difficulty-mappings")` · 75 행 `@Get()` · 92 행 `@Patch(":difficulty")` (94~95 행 Admin guard), `prisma/schema.prisma` 441 행 `model DifficultyMapping` (443 · 444 · 451 행). 소비처는 `src/llm/llm-http-gateway.service.ts` 112~116 행.
- **항목 난이도 판정 축 (미충족)** — `src/assessment-evaluation/domain/evaluation-prompt.ts` 155 행 `classifyNarrative` 는 **LLM 응답 파싱 기반** (50 행 marker regex + 32 행 `DEFAULT_DIFFICULTY` 중앙값 fallback) 이며 항목→난이도 결정 규칙은 코드·ADR-0011 어디에도 없다 → Acceptance Criteria 규정대로 상태를 `IN_PROGRESS` 로 낮췄다.
- **검증 위치 실 근거** — policy 축 = ADR-0011 실재 · `ACCEPTED`. unit 축 = 5 spec 합계 **105 it** (difficulty 3 / service 20 / repository 21 / controller 24 / evaluation-prompt 37).
- **표 갱신** — 69 행 상태 컬럼 `PLANNED` → `IN_PROGRESS (…)`. 근거에 ADR 1 개 + 소스 파일 8 개 (difficulty.ts · service · repository · controller · schema.prisma · llm-http-gateway · evaluation-prompt · evaluation-scoring) 포함. 한계 = routing 미발화 (scoring 99~101 행 `difficulty` 미주입, ADR-0032 56 행 서술과 drift) · 3 row seed 부재 · e2e cover 0.
- **불변 확인** — `wc -l docs/requirements.md` = 97, `grep -c "^| REQ-"` = 66, 68 · 69 · 70 행 필드 수 = 9 로 편집 전후 동일. 상태 문자열 안에 리터럴 파이프 문자 0.

## Acceptance Criteria

- [x] **ADR 실재 축** 을 실측한다 — `docs/decisions/ADR-0011-difficulty-model-assignment.md` 의 frontmatter `id` · `status` · `date` · `relatedTask` 값을 행 인용으로 확정하고, status 값을 상태 문자열에 그대로 적는다 (해석 · 승격 금지).
- [x] **결정 내용 축** 을 실측한다 — ADR-0011 Decision 절에서 (1) 3 슬롯 cardinality 고정, (2) 슬롯 ↔ model 매핑 의미, (3) fallback 규칙 3 항목을 각각 행 인용으로 확정한다. 셋 중 명시되지 않은 항목이 있으면 "명시 없음" 을 그대로 적는다.
- [x] **슬롯 매핑 구현 축** 을 실측한다 — `src/llm/difficulty.ts` 의 난이도 값 집합 정의 행, `difficulty-mapping.service.ts` 의 슬롯 재지정 메서드 행, `difficulty-mapping.controller.ts` 의 route decorator 행, `prisma/schema.prisma` 의 `model DifficultyMapping` 행 4 개를 파일 · 행으로 인용한다.
- [x] **항목 난이도 판정 축** 을 실측한다 — `src/assessment-evaluation/domain/evaluation-prompt.ts` 의 난이도 판정 함수 정의 행을 인용하고, 판정 근거가 (규칙 기반 / LLM 응답 파싱 / 양쪽 혼합) 중 무엇인지 한 줄로 확정한다. 항목 → 난이도 결정 규칙이 코드·ADR 어디에도 명시되지 않았으면 본 축을 충족으로 판정하지 않고 상태를 `IN_PROGRESS` 로 낮춘다.
- [x] **검증 위치 컬럼 (`policy + unit`) 의 실 근거** 를 확인한다 — 위 unit spec 5 개 파일의 `it` 개수를 각각 실측해 합계와 함께 인용하고, policy 축은 ADR 실재 · status 로 인용한다. 존재하지 않는 spec 파일은 0 으로 적는다.
- [x] REQ-050 (69 행) 의 상태 컬럼을 실측 결과에 따라 `PLANNED` → `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. 근거에는 ADR 문서 경로 1 개 + 실재하는 소스 파일 경로 3 개 이상이 포함돼야 한다.
- [x] 실측으로 확인되지 않은 부분 (예: 항목→난이도 결정 규칙의 문서화 공백 · 3 슬롯 seed 경로 부재 · e2e cover 0) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [x] `grep -n "REQ-050" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-049 · REQ-051) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 에서 grep 패턴의 `\|` 로 필드 수가 부풀었던 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [x] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **ADR-0011 본문 수정 또는 status 변경** — 본 task 는 ADR 을 읽고 인용만 한다. 결정 공백 (예: 항목→난이도 규칙 미박제) 을 발견해도 ADR 을 고치거나 새 ADR 을 쓰지 않는다.
- **`docs/architecture/api.md` · `data-model.md` · `modules.md` · `INDEX.md` 수정** — 문서측 서술 drift 를 발견해도 인용 · 부기만 하고 고치지 않는다.
- **REQ-049 (68 행) · REQ-051~055 (70~74 행) 재서술** — 이미 `DONE` 으로 판정된 row 다. LLM provider 축이 겹쳐 보여도 본 task 의 상태 문자열에 섞지 않는다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice 다. 근거 부재를 발견해도 컬럼 값은 건드리지 않고 상태 문자열의 "한계 —" 로만 부기한다.
- 난이도 정책의 공백 (예: 3 슬롯 seed 부재 · 항목→난이도 규칙 미문서화 · drift-guard spec 부재) 을 발견해도 **고치지 않는다** — 본 task 는 실측·기록만 한다. 발견 사항은 Follow-ups 에만 적는다.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · schema · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- REQ-001 (20 행) · REQ-047 (66 행) · REQ-048 (67 행) · REQ-056 (75 행) 등 남은 `PLANNED` row 재판정 — 각각 별도 slice.
- T-1383 Follow-ups (ADR-0013 drift-guard spec 부재 · List API type 필터 · hierarchy 메타) 의 구현 또는 재서술.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- **난이도 routing 미발화 drift** — `src/assessment-evaluation/evaluation-scoring.service.ts` 99~101 행이 `gateway.generate(prompt, { modelId })` 로만 호출해 `options.difficulty` 를 주입하지 않는다 (production 전수 주입 호출 0). 반면 ADR-0032 56 행은 "이 값이 generate 호출 전 `options.difficulty` 로 주입되어 난이도 모델 routing 을 driving 한다" 고 서술한다. 사전 분류가 불가능한 순서 (난이도가 narrative 산물) 라 설계 자체를 재검토해야 하므로 코드 수정 또는 ADR-0032 서술 정정 중 무엇인지 별도 slice 에서 결정.
- **항목→난이도 결정 규칙 미박제** — README 97 행의 "어떤 항목이 어떤 난이도를 가지는지를 구현하면서 결정" 이 현재는 prompt instruction (evaluation-prompt.ts 109 행) 으로 LLM 에 위임돼 있다. 결정 규칙을 ADR 로 박제할지 (예: activity 종류 · 규모 기반 사전 분류) 여부는 별도 ADR slice.
- **3 슬롯 seed 경로 부재** — ADR-0011 Decision §1 · §3 운영 함의가 전제한 3 row (easy / medium / hard) seed script 가 `prisma/` 에 없다. 셋업 전 전 난이도 평가가 fail-fast 4xx 로만 귀결.
- **difficulty-mappings e2e cover 0** — `test/e2e/` 에 해당 route 참조가 0 (perf 축 `test/perf/difficulty-mapping-read.perf-spec.ts` 만 존재). Admin PATCH 슬롯 재지정의 실경로 검증이 unit 밖에 없다.
