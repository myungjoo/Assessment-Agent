---
id: T-2018
title: modules.md 의존성 표 · 그래프를 실 imports 배열과 정합 — 평가 · 수집 · 스케줄링 edge 누락 + RunStatusModule 각주 보강
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004, REQ-040, REQ-083]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-09-10
independentStream: modules-md-import-drift
dependsOn: [T-2016]
touchesFiles: [docs/architecture/modules.md]
plannerNote: P5 · T-2016 Follow-ups (a) 회수 — modules.md 그래프 · deps 칸이 실 imports 4 edge 누락, direct 1 파일
---

# T-2018 — modules.md 의존성 표 · 그래프를 실 imports 배열과 정합 (평가 · 수집 · 스케줄링 edge 누락 + RunStatusModule 각주 보강)

## Why

[T-2016](T-2016-req004-period-window-arc-readjudication.md) `## Follow-ups` (a) 가 [modules.md](../architecture/modules.md) 의존성 그래프에서 `assessmentEvaluation --> assessmentCollection` edge 가 빠졌다고 기록했다. CLAUDE.md `§7` 은 `src/` 탐색 대신 modules.md 인덱스를 먼저 보라고 한다. 그런데 이 인덱스가 실제 DI 의존을 빠뜨리고 있다. 그러면 planner · architect 가 cycle 위험과 변경 영향 범위를 잘못 판단하게 된다.

**issue-still-relevant pre-check (origin/main `e2e9a6a5` 실측, 전부 재현 가능)**

- modules.md 의 최신 commit 은 `fbc41cba`(T-2016)다. 이 commit 은 `40 행` 에 `period-window-filter` 를 등록했을 뿐이고 그래프는 건드리지 않았다.
- [assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `80 행` 은 `imports: [LlmModule, AssessmentCollectionModule, UserModule, RunStatusModule]` 이다. 반면 modules.md `41 행` deps 칸은 `LlmModule` · `AuthModule` 만 적는다. 그래프 `116~118 행` 에도 `assessmentEvaluation --> llm` · `--> auth` 두 edge 만 있다.
- [assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts) `92~98 행` 은 `GithubModule, ConfluenceModule, UserModule, AuthModule, RunStatusModule` 을 import 한다. modules.md `40 행` deps 칸에는 `RunStatusModule` 이 없다. 그래프 `111~114 행` 에는 `--> auth` edge 가 없다(표 칸에는 AuthModule 이 있다).
- [scheduling.module.ts](../../src/scheduling/scheduling.module.ts) `52 행` 은 `imports: [AssessmentCollectionModule]` 이다. modules.md `42 행` deps 칸은 이것을 적는다. 하지만 그래프 `100~102 행` 에는 `scheduler --> assessmentCollection` edge 가 없다.
- `grep -c RunStatus docs/architecture/modules.md` 는 **0** 이다. 그런데 [app.module.ts](../../src/app.module.ts) `86 행` 은 `RunStatusModule` 을 AppModule 에 등록한다. [api.md](../architecture/api.md) `60 행` 도 `/api/run-status` 의 책임 module 로 `RunStatusModule` 을 적는다. `46~47 행` 의 "정본 표 미기재 실 shipped module" 각주는 Export · Import · UserInstanceAccess 3 개만 센다. 그 각주가 인용한 app.module.ts `77 · 78 행` 좌표도 지금은 `84 · 85 행` 으로 밀려 있다.
- `STATE.currentTask` · `nextTask` 는 모두 null 이다. modules.md 를 건드리는 진행 중 task 는 없다.

**범위 판단** — 이 task 는 **실제 코드에 이미 있는 import 를 문서에 옮겨 적는 것** 이다. 새 의존 방향을 결정하지 않는다. 그래서 CLAUDE.md `§3.1` 의 "기존 architecture 문서의 비-결정 수정" 에 해당하는 `direct` 다. 표에 row 를 추가할지(12 module 계상 기준)는 각주가 스스로 "별도 slice 소관" 이라고 적어 둔 판정이다([REQ-COVERAGE-AUDIT § 12.23](../use-cases/REQ-COVERAGE-AUDIT.md)). 그래서 본 task 는 표 row 를 늘리지 않고 각주 사실만 보강한다. 그래프에 있지만 실제 imports 에는 없는 edge(아래 Out of Scope)를 지우는 일은 P1 conceptual edge 인지 drift 인지 판정이 필요하다. 그래서 본 task 는 **add-only** 로 진행한다.

**cap 근거** — 1 파일에서 기존 행 약 5 개를 칸 단위로 고치고 그래프 edge 4 줄을 추가한다. doc-only enumerated-section × 1.6 × inline-amend × 0.4 = × 0.64 이고, base 약 45 LOC 에서 약 30 LOC 가 나온다. helper · 소비처 신설이 0 이므로 CLAUDE.md `§3` 소비처 동반 의무에 걸리지 않는다.

**참고 — 본 task 와 별개인 오너 결정 대기 항목** — [T-2017](T-2017-req045-046-073-rbac-person-group-part-readjudication.md) `## Follow-ups` (a) 의 인원 · 그룹 · 파트 20 route guard 배선은 CLAUDE.md `§5` 인증 변경이다. 본 task 는 그 항목과 무관하다. 그 항목은 오너 승인(humanQuestion) 경로로 따로 처리된다.

## Required Reading

- [docs/architecture/modules.md](../architecture/modules.md) `28~47 행`(module 표 · `44 행` 12 module 산문 · `46~47 행` 미기재 module 각주), `51~132 행`(mermaid 그래프), `141~160 행`(Topological order), `162~179 행`(금지 방향 표 — 참조만 한다)
- [src/assessment-evaluation/assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `60~80 행` — imports 4 개와 각 import 의 도입 task 주석(T-0316 · T-0317 · T-1842)
- [src/assessment-collection/assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts) `92~98 행` — imports 5 개
- [src/scheduling/scheduling.module.ts](../../src/scheduling/scheduling.module.ts) `52 행`
- [src/run-status/run-status.module.ts](../../src/run-status/run-status.module.ts) — imports 0 개(leaf) 확인용
- [src/app.module.ts](../../src/app.module.ts) `10~12 행` · `84~86 행` — Export · Import · RunStatus 등록 좌표
- [docs/tasks/T-2016-req004-period-window-arc-readjudication.md](T-2016-req004-period-window-arc-readjudication.md) `## Follow-ups` (a) — 본 task 의 출처

## Acceptance Criteria

**표 deps 칸 (add-only)**

- [ ] `41 행` **AssessmentEvaluationModule** 의 "주요 dependency (imports)" 칸에 `AssessmentCollectionModule`(T-0316, ADR-0037 period bridge — evaluation → collection 단방향) · `UserModule`(T-0317, `PersonService` 재사용) · `RunStatusModule`(T-1842, ADR-0060 실행 카운터)을 추가한다. 기존 `LlmModule` · `AuthModule` 서술은 지우지 않는다. 좌표 `assessment-evaluation.module.ts` `80 행` 을 함께 적는다.
- [ ] `40 행` **AssessmentCollectionModule** 의 deps 칸에 `RunStatusModule` 을 추가한다. 좌표는 `assessment-collection.module.ts` 의 `RunStatusModule,` 행이다. 기존 4 개 서술은 보존한다.
- [ ] 두 칸 모두 셀 본문에 `|` 문자를 새로 넣지 않는다. 수정 후 `sed -n '40p;41p' docs/architecture/modules.md | awk -F'|' '{print NF}'` 가 수정 전과 같다.

**mermaid 그래프 (add-only)**

- [ ] 다음 4 edge 를 해당 comment 블록 아래에 추가한다. 각 edge 또는 블록 comment 에 근거 module 파일과 행을 적는다.
  - `assessmentEvaluation --> assessmentCollection`
  - `assessmentEvaluation --> user`
  - `assessmentCollection --> auth`
  - `scheduler --> assessmentCollection`
- [ ] 기존 edge 는 한 줄도 지우지 않는다. `git diff -U0 docs/architecture/modules.md` 의 그래프 구간에 `-    ` 로 시작하는 edge 삭제 줄이 0 개다(comment 줄 수정은 허용).
- [ ] `RunStatusModule` 은 그래프 node 로 추가하지 않는다. 표 row 가 없는 module 은 그래프에도 없다는 기존 규칙(Export · Import · UserInstanceAccess 동일)을 따른다. 대신 평가 · 수집 edge comment 에 "RunStatusModule(표 미기재, 각주 참조)도 import" 를 1 구절로 적는다.
- [ ] mermaid fence 구조를 보존한다. 수정 후 파일 전체의 ```` ``` ```` 줄 수가 수정 전과 같다(`grep -c '^```' docs/architecture/modules.md`).

**Topological order · DAG**

- [ ] `154 행` AssessmentEvaluationModule 괄호 설명을 실 imports(Llm + AssessmentCollection + User + RunStatus)로 고친다. 순서 자체는 이미 AssessmentCollectionModule 다음이므로 줄 순서는 바꾸지 않는다. `156 행` SchedulerModule 괄호에는 AssessmentCollectionModule 을 추가한다.
- [ ] 새 4 edge 가 cycle 을 만들지 않음을 기계로 확인한다. `git grep -n "AssessmentEvaluationModule" -- src/assessment-collection/ src/user/ src/auth/ src/scheduling/` 의 **module 파일 import 문 히트가 0** 이어야 한다. 결과를 commit body 에 1 줄로 적는다.

**각주 (`46~47 행`)**

- [ ] 미기재 실 shipped module 목록에 `RunStatusModule`(`src/run-status/run-status.module.ts`, T-1841~T-1846 · ADR-0060)을 추가한다. AppModule 등록 좌표(`app.module.ts` `86 행`)와 import 하는 module 2 개(평가 `80 행` · 수집)를 적는다. 개수 서술 "**3 개**" · "본 각주의 3 개" 를 실측 개수로 고친다.
- [ ] 같은 각주의 stale 좌표 `src/app.module.ts` `77 · 78 행` 을 실측 좌표로 고친다(현재 `84 · 85 행`).
- [ ] `44 행` 의 "위 12 module" 산문과 표 row 수는 바꾸지 않는다. `grep -c '^| \*\*' docs/architecture/modules.md` 가 수정 전과 같다.

**공통 · 기계 검증**

- [ ] 적는 모든 좌표는 `sed -n '<n>p' <file>` 로 1 건씩 재현 확인한다. 이 task 파일의 행 번호를 그대로 옮기지 말고 실행 시점에 다시 센다. 실측이 이 파일과 다르면 실측을 적고 차이를 `## Follow-ups` 에 남긴다.
- [ ] 본 task 는 `direct` **doc-only** 다. `src/` · `web/` · `test/` · `prisma/` 변경이 0 이므로 R-110 tester 호출과 R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 적고, 위 grep · sed · awk 기계 검증으로 대신한다.
- [ ] `git diff --stat` 이 `docs/architecture/modules.md` 1 파일이다. 여기에 이 task 파일의 `status: DONE` 플립만 추가로 허용한다(direct 1-commit).

## Out of Scope

- **표 row 신설** — Export · Import · UserInstanceAccess · RunStatus 4 module 을 표 row 로 올리는 일, "12 module" 계상 기준 변경, Components ↔ Modules mapping(`193 행` 이후) 수정. [REQ-COVERAGE-AUDIT § 12.23](../use-cases/REQ-COVERAGE-AUDIT.md) 의 별도 판정 대상이다.
- **실제 imports 에 없는 기존 edge 삭제** — 예: `assessmentEvaluation --> auth`(평가 module `80 행` 에 AuthModule 없음), `scheduler --> assessment` · `scheduler --> persistence`(스케줄링 module `52 행` 은 AssessmentCollectionModule 만 import), `42 행` deps 칸의 PersistenceModule · AssessmentModule · AuthModule 서술. 이 edge 들이 P1 conceptual 설계인지 drift 인지 판정이 필요하다. 발견한 좌표를 `## Follow-ups` 에 적기만 한다.
- `162~179 행` 금지 방향 표에 `AssessmentCollectionModule → AssessmentEvaluationModule` 금지 row 를 추가하는 일. 규칙 서술이라 본 task 에서는 하지 않는다. 필요하면 Follow-ups 에 적는다.
- `UserModule` 의 `forwardRef(() => AuthModule)` 과 `189 행` "forwardRef 회피" 정책의 충돌 판정.
- 인원 · 그룹 · 파트 20 route guard 배선(T-2017 Follow-ups (a), CLAUDE.md `§5` 오너 승인 대상). 코드 · e2e · census 무접촉.
- [requirements.md](../requirements.md) 수정 전부. T-2016 Follow-ups (b)(REQ-004 셀 · UC-09 stale 좌표)와 T-2017 Follow-ups (c)(REQ-043 셀 `19 행` → `20 행`)도 포함한다.
- [api.md](../architecture/api.md) · PLAN.md · ADR · UC 문서 무접촉.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed · awk 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

- (a) 그래프에 있으나 실 imports 에 없는 edge — `assessmentEvaluation --> auth`, `scheduler --> assessment`, `scheduler --> persistence`, 그리고 `42 행` SchedulerModule deps 칸의 Persistence · Assessment · Auth 서술. P1 conceptual edge 인지 drift 인지 판정 필요 (본 task Out of Scope).
- (b) Topological order `153 행` 의 AssessmentCollectionModule 괄호에 실 imports 인 Auth · RunStatus 누락 (순서 자체는 성립). 후순위 doc 정정 후보.
