---
id: T-1935
title: REQ-036 상대 비교 arc doc-sync — api.md §5 route 행 + 합계 재집계 + REQ-036 재판정 1 회
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-036]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-req036-relative-comparison
dependsOn: [T-1931, T-1932, T-1933, T-1934]
touchesFiles:
  - docs/architecture/api.md
  - docs/requirements.md
plannerNote: "P5 REQ-036 arc closeout — T-1931~T-1934 머지로 4 단이 닫혀 api.md route 행 + 55 행 재판정 1 회 (doc-only, PLAN 183 행 once-rule)"
---

# T-1935 — REQ-036 상대 비교 arc doc-sync — api.md §5 route 행 + 합계 재집계 + REQ-036 재판정 1 회

## Why

[T-1931](T-1931-summary-relative-comparison-signal.md)(순수 helper) → [T-1932](T-1932-summary-coordinate-cohort-query.md)(좌표 조회 표면) → [T-1933](T-1933-summary-relative-comparison-reader.md)(read-adapter + DI) → [T-1934](T-1934-relative-comparison-endpoint.md)(HTTP endpoint) 4 단이 모두 main 에 머지돼 REQ-036 의 마지막 미충족 축 "개발자 간 상대 비교 전용 산출 경로" 가 실제로 닫혔다. 그러나 **문서 두 곳이 코드보다 뒤처져 있다** — 계약 정본인 [api.md](../architecture/api.md) `§ 5` 에 신규 route 행이 없고, [requirements.md](../requirements.md) `55 행` REQ-036 은 여전히 `IN_PROGRESS` 이며 그 판정 본문이 "비교 전용 산출 경로는 **부재**" 라는 **이제 거짓인 서술**을 담고 있다. 본 slice 가 두 문서를 코드 실측으로 동기해 arc 를 종결한다. [T-1934](T-1934-relative-comparison-endpoint.md) `Follow-ups (a)` + `(b)` 를 한 task 로 묶은 것이며, `(b)` 원문이 "(a) 와 같은 direct doc-only 라 한 task 로 묶어도 된다" 고 허용한 형태 그대로다.

**issue-still-relevant pre-check (origin/main `ed9cf7be` 실측)**:

1. `git grep -n "relative" origin/main -- docs/architecture/api.md` 히트 **0 행** — `§ 5` 표에 상대 비교 route 행이 아직 없다 (재큐잉 아님). 현 합계는 `169 행` 의 `84 endpoint / shipped 79 / 18 prefix`, 집계 규칙 `171 행` 의 `(현재 84)` · `(현재 표 84 / shipped 79)` 이고, `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 실측도 **84** 라 표와 표기가 일치한 상태다 (즉 본 task 가 더할 것은 정확히 1).
2. `docs/requirements.md` `55 행` 은 `IN_PROGRESS` 이며 판정 본문 말미가 "상대 비교 축은 … **비교 전용 산출 경로는 부재** 다: 순위 · 백분위 · person 간 비교 심볼이 `src/` 전체에 없고 …" 로 끝난다 — T-1931~T-1934 머지 전 사실이라 현재는 거짓. 재판정 미수행 상태 확인.
3. 반대로 **코드 4 단은 전부 main 에 안착**: helper `src/assessment-evaluation/domain/summary-relative-comparison.ts` `142 행` `computeRelativeComparison` + 타입 3 종(`54`·`62`·`75 행`), 조회 표면 `src/user/summary.repository.ts` `137 행` · `src/user/summary.service.ts` `136 행` `findByCoordinate`, adapter `src/assessment-evaluation/summary-relative-comparison-reader.service.ts` `72 행` 클래스 · `90 행` `readForCoordinate`, endpoint `src/assessment-evaluation/assessment-evaluation.controller.ts` `803~813 행` `@Get("relative-comparison")` + `@Roles("Admin")`, query DTO `src/assessment-evaluation/dto/relative-comparison-query.dto.ts`. 즉 문서만 미착수 잔여 구간이다.
4. `docs/PLAN.md` `59 행` 의 상대 비교 bullet 은 이미 `- [x]` 라 PLAN checkbox 변경은 불요 (§Out of Scope).

**오너 지시 게이트 pre-check**:

- [PLAN](../PLAN.md) `157 행` (R-91 k6 최우선): 본 slice 는 `test/load/` · `.github/workflows/` · `package.json` 을 건드리지 않는다. R-91 잔여 축(실 수집 · 실 LLM 왕복)은 자격증명 0 이라 자율 집행 불가 구간이므로 경합이 아니다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 중단): `test/perf/` 파일을 신설 · 수정하지 않는다. 본 slice 는 코드 0 LOC 다.
- [PLAN](../PLAN.md) `182 행` (소비처 동반 의무): 신설 helper · factory · 어댑터가 0 이라 해당 없음 — 이미 머지된 배선을 문서에 기록만 한다.
- [PLAN](../PLAN.md) `183 행` (REQ status 재판정은 구현 slice 머지 뒤 REQ 당 1 회): 구현 arc (T-1931~T-1934) 가 `ed9cf7be` 기준 전부 머지 완료라 게이트가 열렸고, REQ-036 재판정 task 는 본 task **1 회뿐** 이다 (`git log --oneline --all | grep -i "REQ-036 재판정"` 히트 0 — 선행 재판정 task 부재).
- [CLAUDE.md](../../CLAUDE.md) `§3.1`: 두 파일 모두 기존 문서의 **사실 동기**(shipped route 기록 · REQ status 재판정) 이고 새 결정 · 새 ADR · 코드 변경이 0 이라 `direct` 다.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) `115 행` (`/api/assessment-evaluation` 그룹 헤더) · `116~117 행` (같은 그룹의 기존 2 행 — 셀 5 개 형식 · 상세 셀의 서술 밀도 · auth tier 컬럼 표기 선례) · `169 행` (**합계** 문단 — 누적 서술의 문장 접합 형식) · `171 행` (**집계 규칙** 3 항 — 재집계 명령과 두 수 병기 규칙).
- [docs/requirements.md](../requirements.md) `55 행` (REQ-036 행 전체 — 현 `IN_PROGRESS` 판정 본문과 그 "부재" 서술) · `54 행` (REQ-035) · `56 행` (REQ-037 — `DONE (implemented-on-main — …)` 판정 본문의 서술 형식 · 심볼 좌표 인용 관행 · `한계 —` 절 형식의 직전 선례).
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `145 행` (`@Controller("api/assessment-evaluation")` — full path 조립 근거) · `146~152 행` (controller-scope ValidationPipe 3 옵션 — 400 사유의 출처) · `775~802 행` (route 주석 — 계약 서술의 정본) · `803~813 행` (decorator stack + handler).
- [src/assessment-evaluation/dto/relative-comparison-query.dto.ts](../../src/assessment-evaluation/dto/relative-comparison-query.dto.ts) 전체 — query 축 2 개와 각 decorator (api.md 상세 셀의 요청 계약 서술 근거).
- [src/assessment-evaluation/domain/summary-relative-comparison.ts](../../src/assessment-evaluation/domain/summary-relative-comparison.ts) `62~72 행` (`PersonRelativeStanding`) · `75~83 행` (`RelativeComparisonResult`) · `142 행` (`computeRelativeComparison` 시그니처) — 응답 필드 서술과 rank/percentile 규약의 근거.
- [src/assessment-evaluation/summary-relative-comparison-reader.service.ts](../../src/assessment-evaluation/summary-relative-comparison-reader.service.ts) `72 행` · `75~93 행` — adapter 위임 계약 (전파 예외 2 종).
- [src/user/summary.service.ts](../../src/user/summary.service.ts) `126~148 행` (`findByCoordinate` 2 단계 검증 + `BadRequestException`) · [src/user/summary.repository.ts](../../src/user/summary.repository.ts) `120~137 행` — 400 의 실제 발생 지점과 빈 좌표가 오류가 아니라는 근거.
- [CLAUDE.md](../../CLAUDE.md) `§3.1` (commitMode) · `§12` (언어 정책 · `§ 12.76` R1~R7 행 범위 표기).

## 작업 계약 (구현자가 임의로 바꾸지 않는다)

### (1) `docs/architecture/api.md` — route 행 1 개 + 합계 2 곳

- `117 행` 바로 아래(= `/api/assessment-evaluation` 그룹의 마지막)에 **행 1 개만** 추가한다. 셀 5 개 형식 준수: `| GET | \`/api/assessment-evaluation/relative-comparison\` | <UC 참조> | <상세> | Admin+ |`.
- UC 컬럼: 본 route 를 §5 sequence 에서 호명하는 UC 가 없으면 `/api/run-status` 행(`GET /api/run-status`) 이 쓴 `— (9 UC §5 sequence 호명 0)` 표기를 mirror 한다. **§ 7 UC cross-reference 표에 행을 새로 만들지 않는다** (호명 0 이면 만들지 않는 것이 T-1827 선례).
- 상세 셀에 최소 포함: 요청 표면(`RelativeComparisonQueryDto` — `period` `@IsString`+`@IsNotEmpty` / `periodStart` `@IsString`+`@IsNotEmpty`+`@IsISO8601`, body 없음) · 성공 200(`@Get` 기본값, `@HttpCode` 미부착) + 응답 `RelativeComparisonResult` `{ cohortSize, mean, byPerson[] }` 및 `byPerson` 원소 4 필드(`personId`/`metricScore`/`rank`/`percentile`) · **빈 좌표는 404 가 아니라 `{ cohortSize: 0, mean: 0, byPerson: [] }` 200** · error 400(ValidationPipe 형식 위반 · 허용 외 period literal · Invalid Date — 후 2 자는 `SummaryService.findByCoordinate` 소유) / 401 / 403 · T-1931~T-1934 박제 + PR 번호(#1515 / #1516 / #1517 / #1518) · **RBAC 가 Admin+ 인 사유**(응답이 좌표 내 모든 person 의 rank·percentile 이라 요청자 밖의 상대 위치를 노출 — 같은 controller 의 evaluate/reset stack mirror).
- **합계 동기 (`169 행`)** — endpoint `84 → 85` / shipped `79 → 80` / **prefix 는 18 불변**. 불변 사유를 기존 문장 접합 형식대로 한 절 추가: `/api/assessment-evaluation` 은 이미 누계에 반영된 기존 prefix 이고 본 route 는 그 안의 정적 sub-path 라 새 최상위 prefix 가 아니다 (바로 앞 `PUT /api/llm/providers/default` T-1865 절과 동형). 그룹 헤더 수 **14 불변**(헤더 신설 0).
- **집계 규칙 동기 (`171 행`)** — (1) 항의 `(현재 84)` → `(현재 85)`, (3) 항의 `(현재 표 84 / shipped 79)` → `(현재 표 85 / shipped 80)`. (2) 항의 헤더 14 / prefix 18 은 손대지 않는다.
- `conceptual placeholder` 5 행 목록은 **불변** (본 route 는 shipped 라 placeholder 가 아니다).
- `246 행` `Refs:` 줄에 `REQ-036` 이 이미 있으므로 중복 추가하지 않는다.

### (2) `docs/requirements.md` `55 행` — REQ-036 재판정 1 회

- status 를 `IN_PROGRESS` → **`DONE (implemented-on-main — …)`** 로 재판정한다. 형식은 같은 파일 `56 행`(REQ-037) 의 `DONE (implemented-on-main — <축별 실측> … 검증은 … 한계 — …)` 서술을 mirror 한다.
- 기존 본문에서 **이제 거짓인 서술을 폐기**한다 — 최소 다음 3 종: (i) "비교 전용 산출 경로는 부재" (ii) "순위 · 백분위 · person 간 비교 심볼이 `src/` 전체에 없고" (iii) "`metricScore` sort / 다중 person 집계 없음". 각각을 **심볼 · 파일 · 행 좌표**로 교체한다(위 §Required Reading 의 4 단 좌표).
- 유지할 참 서술은 남긴다 — schema 축(`prisma/schema.prisma` `361`·`366`·`367`·`377`·`379 행`) · LLM 정성 축(`summary-narrative.service.ts`) · Metric 수치 축(`domain/summary-aggregate.ts`) · 한 row 결합 영속(`summary-persist.service.ts`) 은 이미 실측된 사실이라 재확인 후 보존한다 (재작성 최소화).
- 검증 근거를 spec 좌표로 박제한다 — 4 단 각각의 colocated spec (`domain/summary-relative-comparison.spec.ts` · `src/user/summary.repository.spec.ts` · `src/user/summary.service.spec.ts` · `summary-relative-comparison-reader.service.spec.ts` · `dto/relative-comparison-query.dto.spec.ts` · `assessment-evaluation.controller.spec.ts`). **파일명과 it 수는 실측해서 적는다** — 추정 금지.
- `한계 —` 절을 유지하되 현재 사실로 갱신한다. 최소 후보: (a) e2e 실 부팅 왕복 spec 0 (T-1934 `Follow-ups (c)`), (b) RBAC 가 Admin+ 라 User self-view 경로 0 (`Follow-ups (d)`), (c) `web/` 소비 · UI 노출 0, (d) 좌표 축 조회의 전용 index 미검토(T-1932 `Follow-ups (c)`). **실측으로 확인한 것만 적는다.**
- **다른 REQ 행은 건드리지 않는다** (한 행 재판정).

## Acceptance Criteria

- [ ] `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 결과가 **85** 이고, 그 증가분이 `GET /api/assessment-evaluation/relative-comparison` 행 정확히 1 개다 (`git diff` 로 확인 — 다른 route 행 추가 · 삭제 0).
- [ ] 신규 행이 `§ 5` 표의 `/api/assessment-evaluation` 그룹 안(`115 행` 헤더 아래)에 있고 셀이 5 개이며 auth tier 컬럼이 `Admin+` 다. 상세 셀이 위 §작업 계약 (1) 의 필수 항목(요청 DTO 2 축 · 200 + 응답 3 필드 · 빈 좌표 200 · 400/401/403 · 박제 task + PR · Admin+ 사유) 을 모두 담는다.
- [ ] `169 행` 합계가 `85 endpoint` / `shipped 기준 80` / `18 resource prefix` (prefix 불변) 로 갱신되고, prefix 불변 사유 한 절이 기존 문장 접합 형식으로 추가됐다. `9 UC cover` 는 불변.
- [ ] `171 행` 집계 규칙의 `(현재 84)` → `(현재 85)`, `(현재 표 84 / shipped 79)` → `(현재 표 85 / shipped 80)` 두 곳이 갱신되고 헤더 14 / prefix 18 표기는 불변이다.
- [ ] `docs/requirements.md` `55 행` REQ-036 이 `DONE (implemented-on-main — …)` 로 재판정되고, 거짓 서술 3 종(§작업 계약 (2) (i)(ii)(iii)) 이 **파일 · 행 좌표를 동반한 참 서술로 교체**됐다 (`grep -n "비교 전용 산출 경로는 부재" docs/requirements.md` 히트 **0**).
- [ ] 재판정 본문이 인용한 **모든** 심볼 · 행 좌표 · spec it 수가 실측이다 — 최소한 `computeRelativeComparison` · `findByCoordinate`(repository + service) · `readForCoordinate` · `@Get("relative-comparison")` 5 심볼의 파일 · 행이 실제 코드와 일치함을 `grep -n` 으로 확인한 결과가 본문 표기와 같다.
- [ ] `한계 —` 절이 존재하고, 적힌 항목이 전부 실측 근거를 가진다 (예: `git grep -c "relative-comparison" -- test/e2e/` · `-- web/` 결과가 0 임을 확인한 뒤에만 "e2e 0" · "web 소비 0" 을 적는다).
- [ ] 변경 파일이 정확히 **2 개** (`docs/architecture/api.md` · `docs/requirements.md`) 다 — `git diff --name-only` 로 확인 (task 파일 status 갱신은 별개). `src/` · `web/` · `test/` **0 LOC**.
- [ ] `docs/PLAN.md` · ADR · `docs/architecture/data-model.md` 는 **무변경** (`59 행` bullet 은 이미 `- [x]`, data-model.md `30`·`158 행` 의 REQ-036 인용은 schema 축 서술이라 본 arc 로 바뀌지 않는다).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 준수 — 본문 한국어, 식별자 · 경로 · `REQ-NNN` / `T-NNNN` / `PR-NN` 은 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `55 행`, `L` prefix 금지).
- [ ] R-112 4 종은 **비적용** — 본 task 는 `commitMode: direct` 인 doc-only 이고 `src/` · `web/` · `test/` 변경이 0 LOC 이라 happy-path / error path / 분기별 / negative case unit test 대상 public symbol 이 신설되지 않는다. `pnpm test:cov` 임계도 코드 변경 0 이라 영향받지 않는다 (CLAUDE.md `§3.2` R-110 의 "direct doc-only commit 만 면제" 조항 적용). **단** 문서 표기의 mechanical 검증으로 위 `grep -c` 항목들이 그 자리를 대신한다.

## Out of Scope

- **코드 변경 전면 금지** — `src/` · `web/` · `test/` · `prisma/` 어느 파일도 건드리지 않는다. 문서와 코드가 어긋나면 문서를 코드에 맞춘다 (반대 방향 금지). 코드 결함으로 판단되면 본 task 를 BLOCKED 로 세우고 별도 slice.
- **다른 REQ 행 재판정 금지** — `55 행` REQ-036 한 행만. 인접 행이 stale 해 보여도 `Follow-ups` 에만 적는다 (PLAN `183 행` once-rule 은 REQ 당 1 회다).
- **api.md 의 다른 route 행 · §4 auth tier 표 · §6 status code 표 · §7 UC cross-reference 표 수정 금지** — §5 신규 행 1 개 + `169`·`171 행` 표기 동기만.
- `docs/PLAN.md` checkbox · ADR 신설 · ADR status 변경 (새 결정 0 — 기존 ADR-0032 controller 계약 + ADR-0035 좌표 계약 안이다).
- `docs/architecture/data-model.md` · `modules.md` 갱신 (본 arc 는 새 entity · 새 module 을 만들지 않았다).
- e2e · smoke · perf spec 신설 (T-1934 `Follow-ups (c)` — 별도 `pr` task).
- RBAC tier 완화(User self-view) 검토 (T-1934 `Follow-ups (d)` — auth 정책 변경은 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트).
- `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 접촉 (PLAN `157`·`158 행` 게이트).

## Suggested Sub-agents

`implementer`

## Follow-ups
