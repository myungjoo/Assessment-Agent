---
id: T-2016
title: REQ-004 재판정 — 기간 상한 arc(T-1939~T-1942) 머지 실측 반영 + modules.md · UC-09 좌표 정정
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 45
estimatedFiles: 3
created: 2026-09-10
independentStream: period-window-upper-bound
dependsOn: [T-1942]
touchesFiles: [docs/requirements.md, docs/architecture/modules.md, docs/use-cases/UC-09-user-defined-period-evaluation.md]
plannerNote: P5 · T-1942 Follow-ups (b) 가 등록한 REQ-004 arc 종단 재판정이 미집행 — 머지 후 1 회, direct doc-only 3 파일
---

# T-2016 — REQ-004 재판정 (기간 상한 arc 머지 실측 반영)

## Why

[requirements.md](../requirements.md) `23 행` REQ-004 는 T-1938 재판정 결과 **IN_PROGRESS** 로 남아 있다. 그 셀은 DONE 승격을 막는 축을 **"기간 종료 경계 입력 부재" 하나** 로 적었다. 근거는 둘이었다. 첫째, `PeriodBridgeDto` 에 종료 필드가 없다. 둘째, `buildCollectionSpec(person, since?)` 가 시작만 받아 수집이 open-ended 다. 이 축을 닫는 구현 arc 4 slice 는 모두 머지됐다.

- T-1939 (PR #1521 → `a09699a1`) — `filterActivitiesByPeriodWindow` helper 신설 + ephemeral 소비처 배선.
- T-1940 (PR #1522 → `9b7ebd82`) — User ephemeral 경로 controller 가 `until` 을 산출해 전달.
- T-1941 (PR #1523 → `bc6285e2`) — Admin full-persist 경로에 창 필터 배선.
- T-1942 (PR #1524 → `5b8bde93`) — Admin 경로 controller 가 `until` 을 전달.

그런데 요구표는 이 arc 를 한 줄도 반영하지 않았다. arc 종단 slice T-1942 의 `## Follow-ups` (b) 가 "REQ-004 재판정 1 회 + `docs/architecture/modules.md` 에 `period-window-filter` helper 인덱스 등록" 을 등록했지만, 다음 planner 가 REQ-009 arc(T-1943)로 넘어가면서 집행되지 않았다. 본 task 가 그 미집행분이다.

**once-rule 정합 (CLAUDE.md §3.1 · [PLAN.md](../PLAN.md) `183 행`)** — 규칙은 "그 REQ 를 구현하는 slice 가 머지된 **뒤** REQ 당 1 회" 다. T-1939~T-1942 는 모두 `coversReq: [REQ-004]` 인 구현 slice 이고 T-1938 재판정 **이후** 에 머지됐다. 그 뒤 머지된 T-1981(`coversReq: [REQ-004, REQ-043, REQ-045]`, summary aggregate POST e2e 계약)도 `71 행` Out of Scope 에서 REQ 재판정을 "머지 후 1 회로 이월" 했다. 따라서 본 task 는 **두 이월분을 합친 1 회** 다. 추가 왕복을 막으려고 한 가지를 정해 둔다. IN_PROGRESS 를 유지하면 잔여를 이름 · 좌표로 **1 개** 특정한다. 그 잔여를 구현하는 slice 가 머지되기 전까지 REQ-004 재판정 task 는 다시 큐잉하지 않는다.

**issue-still-relevant pre-check (origin/main `fe434fd7` 실측, 전부 재현 가능)** — 문서 쪽 반영은 **0 %** 다.

- `git show origin/main:docs/requirements.md | grep '^| REQ-004 '` 의 셀(약 12,900 byte)에서 `filterActivitiesByPeriodWindow` · `period-window-filter` · `until` · `computePeriodEnd` · `T-1939`~`T-1942` · `T-1981` 은 **모두 0 hit** 다. 셀이 인용하는 task 는 `T-1936` · `T-1937` · `T-1938` 3 개뿐이다.
- `git log origin/main --oneline -6 -- docs/requirements.md` 에는 REQ-050 · REQ-048 · REQ-043 행 commit 만 있고 REQ-004 행 commit 은 없다.
- `git grep -n 'period-window-filter\|filterActivitiesByPeriodWindow' origin/main -- docs/architecture/` → **0 hit** (T-1942 Follow-ups (b) 의 modules.md 인덱스 등록 미집행).
- [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) 에서 `until|filterActivitiesByPeriodWindow|T-1939|T-1940` 도 **0 hit** 이다. 최신 commit 은 `fb5c8f3c`(T-1421)로 arc 이전이다. 그런데 `42 행` 은 여전히 "downstream 값은 `{ since }` 하나뿐" 이라고, `116~119 행` §7.5 는 "종료 경계 입력 부재 · 프런트 UI 부재 · 좌표 종합 코멘트 진입점 0" 이라고 적는다.
- 코드 실측: [controller](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `367 행` `normalizeKstPeriodRange` 가 `{ start, end }` 를 반환한다. `535 행` · `549 행` 은 User 분기, `587 행` · `620 행` 은 Admin 분기이고, 두 분기 모두 `until` 을 전달한다. [ephemeral](../../src/assessment-evaluation/period-bridge-ephemeral.service.ts) `136 행` · [admin-persist](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) `179 행` 이 `filterActivitiesByPeriodWindow` 를 호출한다. 반면 `PeriodBridgeDto` 는 여전히 5 키(`43` · `49` · `55` · `64` · `84 행`)이고 종료 **입력** 필드는 없다. 상한은 `period` granularity 에서 **도출** 된다.
- 검증 분포: `until` 히트는 unit spec 4 파일에 있다 — `period-window-filter.spec.ts` 21 · controller spec 49 · admin-persist spec 14 · ephemeral spec 7. e2e(`test/e2e/period-bridge-ephemeral.e2e-spec.ts` · `period-bridge-admin-persist.e2e-spec.ts`)에는 **0 hit** 다.
- 진행 중인 다른 task 가 REQ-004 행을 건드리지 않는다(`STATE.currentTask` · `nextTask` 모두 null).

status 를 DONE 으로 올릴지는 **미리 정해 두지 않는다**. 아래 AC 의 축별 실측이 결정한다(T-2013 · T-2015 선례).

**cap 근거** — 3 파일, 기존 셀 · 행 · 절 단위 inline 정정이다(doc-only enumerated-section × 1.6 × inline-amend × 0.4 = × 0.64, base ~70 LOC → 약 45 LOC). requirements.md 는 단일 행 교체라 +1/-1 이다. modules.md 는 `40 행` 단일 행 교체, UC-09 는 5 곳 이내 add-only 주석이다. helper · 소비처 신설이 0 이라 CLAUDE.md §3 소비처 동반 의무에 걸리지 않는다.

## Required Reading

- [docs/requirements.md](../requirements.md) `23 행` — REQ-004 행 전문(수정 대상, 단일 행 · 파이프 8 개). 정정 대상은 두 곳이다. ① status 괄호 앞머리의 "기간 종료 경계 입력만 부재". ② 끝부분 "한계 (T-1938 재판정 후 잔여) — `DONE` 승격을 막는 축은 **기간 종료 경계 입력 부재** 하나다" 문단. 이 셀에 인용된 controller 좌표(`339~342 행` `@Post("period")` 등)는 현재 `429 행` 으로 밀려 있다.
- [docs/requirements.md](../requirements.md) `1~20 행` — 운영 룰 · 상태 enum · 표 헤더(구조 보존 확인용)
- [docs/tasks/T-1942-admin-persist-until-controller-wiring.md](T-1942-admin-persist-until-controller-wiring.md) — `85~91 행` `## Follow-ups` (a)~(c) (본 task 는 (b) 집행, (a) · (c) 는 범위 밖)
- [docs/tasks/T-1938-req004-summary-endpoint-doc-sync.md](T-1938-req004-summary-endpoint-doc-sync.md) — 직전 재판정의 판정 형식(축 나열 · 한계 박제)
- [src/assessment-collection/domain/period-window-filter.ts](../../src/assessment-collection/domain/period-window-filter.ts) — `10~34 행` 경계 의미론 주석(반열림 `[since, until)` · 빈 창 · 수집 query 축 `until` 은 별도 판단) · `41 행` `ActivityPeriodWindow` · `70 행` `filterActivitiesByPeriodWindow`
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) — `338~366 행` 주석 (a)~(d) · `367~377 행` `normalizeKstPeriodRange` · `429 행` `@Post("period")` · `535~551 행` User 분기 · `587~622 행` Admin 분기
- [src/assessment-evaluation/period-bridge-ephemeral.service.ts](../../src/assessment-evaluation/period-bridge-ephemeral.service.ts) `89 행` · `136 행`, [src/assessment-evaluation/period-bridge-admin-persist.service.ts](../../src/assessment-evaluation/period-bridge-admin-persist.service.ts) `108~127 행` · `179 행` — 창 필터 소비 지점
- [src/assessment-evaluation/dto/period-bridge.dto.ts](../../src/assessment-evaluation/dto/period-bridge.dto.ts) — `36 행` 클래스 · 5 키 좌표(종료 **입력** 필드 부재 재확인)
- [docs/decisions/ADR-0037-period-collection-evaluate-bridge.md](../decisions/ADR-0037-period-collection-evaluate-bridge.md) `24 행` · `40 행`(R-9 "임의 기간" 출처) — 기간 계약이 `period` granularity + `periodStart` 로 정의됐는지 판정할 때만
- [docs/architecture/modules.md](../architecture/modules.md) `40 행` — AssessmentCollectionModule 행(인덱스 등록 대상)
- [docs/use-cases/UC-09-user-defined-period-evaluation.md](../use-cases/UC-09-user-defined-period-evaluation.md) — `38~43 행` 기간 계약 · `116~119 행` §7.5 · `158 행` status 단언

## Acceptance Criteria

**requirements.md (핵심)**

- [ ] [docs/requirements.md](../requirements.md) `23 행` REQ-004 행 **하나만** 수정한다. `git diff -U0 docs/requirements.md` 의 hunk 가 REQ-004 행에만 걸림을 확인한다(다른 REQ 행 · 헤더 무접촉).
- [ ] 표 구조를 보존한다. 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84**, `sed -n '23p' docs/requirements.md | tr -cd '|' | wc -c` = **8** 이고 `wc -l < docs/requirements.md` 는 수정 전과 같다. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] **상한 축 실측 반영** — "종료 경계 입력 부재 · 수집 open-ended" 서술을 실측으로 대체한다. 적을 내용은 네 가지다. ① T-1939~T-1942 의 PR 번호 · 머지 commit. ② controller `normalizeKstPeriodRange` 가 `period` granularity 로 반열림 상한 `end` 를 도출하고 User · Admin 두 분기가 그 값을 `until` 로 전달하는 좌표. ③ 두 bridge service 의 `filterActivitiesByPeriodWindow` 호출 좌표. ④ 수집 spec(`buildCollectionSpec`)은 여전히 시작만 받고 상한은 **in-memory 창 필터에서만** 강제된다는 사실(`period-window-filter.ts` `33~34 행`). 좌표는 `sed -n '<n>p' <file>` 로 1 건씩 재현 확인하고, 재현되지 않는 좌표는 적지 않는다.
- [ ] **"입력" 해석 분류 (명시 1 문장 이상)** — 요청자는 여전히 종료 instant 를 **직접 입력하지 않는다**. 상한은 `period`(day / week / month) + `periodStart` 에서 도출된다. 이것이 README `9 행` "사용자가 지정한 기간" 을 충족하는지 분류하고 근거를 단다(판단 재료는 ADR-0037 과 UC-09 `§3` 의 기간 계약 정의). 충족으로 보면 그 근거를 적는다. 임의 종료 입력이 README 상 필수라고 보면, 그것은 DTO 계약 변경이라 **새 ADR 선행 대상** 이라고 명시한다(설계는 하지 않는다).
- [ ] **검증 축 재검산** — 검증 위치 `unit + e2e` 의 실 근거를 실행 시점에 다시 센다. unit 은 `until` 을 단언하는 spec 4 파일의 it 수를 행두 `it(` · `it.each` 합산으로 센다. e2e 는 period-bridge e2e 2 파일에 상한 단언이 있는지 센다(pre-check 실측은 0 hit). T-1981 의 [assessment-evaluation-summary-aggregate.e2e-spec.ts](../../test/e2e/assessment-evaluation-summary-aggregate.e2e-spec.ts) 가 좌표 종합 코멘트 진입점의 HTTP 계약을 잠갔다는 사실도 좌표와 함께 추가한다. task 파일 · journal 의 수치를 옮기지 말고 **실측을 적는다**. 기존 셀이 적은 "happy case 평가 결과가 빈 배열이라 수치 값과 LLM 코멘트 본문은 e2e 가 검증하지 않는다" 한계가 여전히 유효한지도 확인해 유지하거나 정정한다.
- [ ] **status 재판정** — 위 실측을 근거로 `IN_PROGRESS` 유지와 `DONE` 승격 중 하나를 고르고, **선택 사유를 같은 셀에 명시** 한다.
  - 승격 시: 수치 · 기간(시작 + 상한) · LLM 코멘트 · API 노출 · 좌표 종합 코멘트 진입점 · 프런트 노출 6 축이 각각 어느 좌표로 충족되는지 적는다. e2e 가 상한 · 수치 · 코멘트 값을 cover 하지 않는 점을 **잔여가 아닌 hardening** 으로 보는 근거 1 문장도 단다.
  - 유지 시: 잔여 축 **1 개** 를 이름과 좌표로 특정한다(예: "상한 e2e 축 — period-bridge e2e 2 파일 `until` 단언 0"). "일부 미흡" 같은 모호한 표현은 쓰지 않는다.
- [ ] **add-only 정정 원칙** — 기존 셀의 수치 축 · 기간 축(시작 snap) · LLM 코멘트 축 · API 노출 축 · 좌표 종합 코멘트 축 · 프런트 노출 축 서술과 T-1938 재판정 기록은 **삭제하지 않고 보존** 한다. 삭제는 두 가지에 한한다. ① 종료 경계 부재를 단언하는 문장. ② status 괄호의 "기간 종료 경계 입력만 부재" 표기. stale 해진 controller 행 좌표(`339~342 행` 등)는 본 task 가 새로 적는 좌표 근처에서만 현재 값으로 고치고, 셀 전체의 좌표 일괄 갱신은 하지 않는다. 본 회차는 "T-1939~T-1942 + T-1981 머지 후 1 회, period-window-upper-bound stream 종결 판정" 으로 표기한다.

**modules.md**

- [ ] [docs/architecture/modules.md](../architecture/modules.md) `40 행` AssessmentCollectionModule 행에 `src/assessment-collection/domain/period-window-filter.ts` 의 `filterActivitiesByPeriodWindow`(반열림 `[since, until)` in-memory 창 필터, T-1939)를 **1~2 문장** 으로 등록한다. 소비처는 AssessmentEvaluation 쪽 period bridge service 2 개(T-1939 · T-1941)라는 사실을 함께 적는다. 행 1 개만 수정한다(`git diff -U0 docs/architecture/modules.md` hunk 1 개). 의존성 그래프(mermaid) · Acyclic 절은 건드리지 않는다. bridge 는 이미 수집 모듈을 소비하므로 새 edge 판단이 필요 없다. 기존 edge 가 없다고 확인되면 수정하지 말고 `## Follow-ups` 에 적는다.

**UC-09**

- [ ] [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) 에서 사실과 어긋난 단언만 **add-only 주석** 으로 정정한다. 대상은 세 곳이다.
  - `42 행` 항목 3 — downstream 값이 `{ since, until }` 짝임.
  - `116~119 행` §7.5 (a)(b)(c) — 각 항목 끝에 "해소 — <task · 좌표>" 1 줄. (a) 는 T-1939~T-1942, (b) 는 REQ-077 T-1732~T-1735 의 `web/src/components/DashboardPeriodSelector.tsx`, (c) 는 T-1937 이다. 좌표는 requirements.md REQ-004 셀이 이미 실측한 값을 재현 확인 후 사용한다.
  - `158 행` — "REQ-004 status 는 IN_PROGRESS 로 유지된다" 문장 뒤에 본 재판정 결과를 가리키는 1 문장.
  - 원문은 지우지 않는다(작성 시점 기록 보존). `135 행` · `150 행` 의 §7.5 (b) pointer 는 건드리지 않는다.

**공통**

- [ ] `git diff --stat` 이 정확히 `touchesFiles` **3 파일** 이고 task 파일 `status: DONE` 플립만 추가로 허용한다(direct 1-commit).
- [ ] R-110 / R-112 — 본 task 는 `direct` **doc-only** 이고 `src/` · `web/` · `test/` · `prisma/` 변경이 0 이다. 그래서 tester 호출과 R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 적고, 위 grep · sed 기계 검증으로 대신한다.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 는 어떤 변경도 하지 않는다(doc-only `direct`).
- 상한 e2e 신설 · 종료 입력 필드(`periodEnd` 류) DTO 추가 · 수집 query 축 `until`(GitHub commits 만 지원, T-1942 Follow-ups (c)) 은 하지 않는다. 필요하다고 판정하면 잔여 / 새 ADR 대상으로 **분류만** 한다.
- T-1942 Follow-ups (a) — 제거된 `normalizeKstPeriodStart` 를 이름으로 언급하는 주석 2 곳(`unevaluated-fill-plan-request.mapper.ts` `14 행` · `test/e2e/period-bridge-admin-persist.e2e-spec.ts` `67 행`)은 코드 파일이라 direct 범위 밖이다.
- REQ-043 · REQ-045 재판정 — T-1981 이 함께 cover 했지만 각 REQ 는 자기 구현 arc 기준으로 따로 판단한다. 본 task 는 REQ-004 **1 행** 만 고친다.
- ADR-0066 `## Follow-ups` (c)(period bridge 경로의 난이도 스위치 · `modelId` source 미지정 정리)는 REQ-050 종결 이후 별개 축이다. 본 재판정에서 관측되더라도 `## Follow-ups` 후보로만 적는다.
- [docs/PLAN.md](../PLAN.md) · [api.md](../architecture/api.md) · `REQ-COVERAGE-AUDIT.md` 무접촉.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
