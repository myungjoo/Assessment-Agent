---
id: T-1411
title: REQ-004 gap 해소 — UC-09 (사용자 지정 기간 임의 평가문 요청) 본문 신설
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 210
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1410]
touchesFiles:
  - docs/use-cases/UC-09-user-defined-period-evaluation.md
  - docs/tasks/T-1411-uc-09-user-defined-period-evaluation.md
plannerNote: "uc-doc-audit-resync 23 번째 slice — T-1410 Follow-up 1 채택, 유일 gap REQ-004 를 권장 (a) UC-09 본문 신설로 해소. 신규 UC 본문이라 pr (T-0020~T-0028 동급)"
driverNote: "commitMode 를 planner 의 pr 에서 direct 로 하향 (driver 판정, 2026-08-03 cron@aa-local-d097040f). 근거 3 가지 — (1) 본 schedule 진입점의 상시 지시 '문서·코멘트 변경은 PR/리뷰 없이 direct commit merge', (2) CLAUDE.md §3.1 pr 컬럼은 docs/architecture/* · docs/decisions/* 추가만 열거하며 docs/use-cases/* 는 미포함, (3) 같은 stream 직전 slice T-1408 · T-1409 · T-1410 이 모두 direct 로 처리된 선례. 변경 대상 2 파일 전부 문서라 동작 변경 0."
---

# T-1411 — UC-09 (사용자 지정 기간 임의 평가문 요청) 본문 신설

## Why

[T-1410](T-1410-req004-gap-recommendation-staleness-rejudge.md) 이 REQ-004 gap 의 권장 처리 서술을 4 축으로 재판정한 결과 — 축 A (UC-09 신설) · 축 B (UC-01 확장) **양쪽 미착수**, 축 C 책임 task 지목 **stale** (T-0030 · T-0031 은 각각 api.md · data-model.md 로 소진), 축 D 권장 자체는 **유효** — 였다. 즉 REQ-004 는 audit 이 검출한 **유일한 gap 이면서 승계 task 가 0 인 상태**로 남아 있다.

본 slice 는 그 잔여를 실제로 닫는 첫 산출물로, [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) §6 이 우선 권장한 **(a) 새 UC-09 신설** 을 수행한다. 문서화 대상 흐름은 이미 main 에 실재한다 — [requirements.md](../requirements.md) 23 행 REQ-004 row 가 `POST /api/assessment-evaluation/period` 의 User (ephemeral) / Admin (persist) role 분기, KST 기간 snap, `since` 단독 계약, e2e 2 spec 을 실측으로 박제하고 있다. 따라서 본 UC-09 는 설계 창작이 아니라 **실코드 근거 위의 use case 분해** 이며, 동시에 requirements.md 가 기록한 미충족 축 (종료 경계 · 프런트 UI · 좌표 종합 코멘트 진입점) 을 UC 문서의 error / 한계 절에 정직하게 남긴다.

PLAN.md Phase P2 셋째 bullet 이 참조하는 gap 1 건이 본 문서로 UC 축에서 해소되며, audit 매트릭스 재분류와 INDEX 등록은 §12.4 원자성 규약에 따라 **별도 후속 slice** 로 분리한다 (본 task Out of Scope).

## Required Reading

- `docs/use-cases/UC-08-permission-denied.md` — 1 ~ 30 행 (frontmatter 9 키 + 문두 blockquote) · `## ` 11 section 제목 (17 · 23 · 36 · 43 · 55 · 107 · 115 · 125 · 133 · 150 · 166 행). 본 UC-09 가 그대로 따를 template.
- `docs/use-cases/UC-01-evaluation-execution.md` — 1 ~ 11 행 frontmatter · `## 3. Trigger` (32 ~ 39 행) · `## 5. Main flow` (51 ~ 93 행) · `## 7. Error flows` (104 ~ 123 행). **인접 UC 경계 확정용** (cron / manual full-period 파이프라인 vs 사용자 지정 기간 요청).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` 129 ~ 140 행 (§6 gap follow-up — 권장 (a) 가 지정한 actor / trigger / component / module 목록 + 규모 추정) · §12.10 (T-1410 4 축 판정 결과).
- `docs/requirements.md` 23 행 REQ-004 row — 본 UC 의 **실코드 근거 원장**. 수치 축 · 기간 축 · LLM 코멘트 축 · wiring 축 · 노출 축 (a)(b)(c) · 검증 위치 · 한계 문단을 그대로 근거로 삼는다.
- `docs/use-cases/INDEX.md` 19 ~ 25 행 — 명칭 규약 (component 8 종 · module 9 종 · REQ ID 실재 · status 3 값, **오타 0**). 본 slice 는 INDEX.md 를 **읽기만** 한다 (Out of Scope).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — `@Controller("api/assessment-evaluation")` (133 행) · `@Post("period")` + guard / roles (339 ~ 355 행) · role dispatch 2 분기 (430 ~ 501 행) · Admin 응답 6 키 (505 ~ 512 행).
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — `PeriodBridgeDto` 5 키와 validator (36 ~ 84 행).
- `src/assessment-evaluation/period-bridge-ephemeral.service.ts` (100 ~ 123 행) · `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (130 ~ 158 행) — 두 실행 경로의 유일한 차이 (DB write 0 vs `persistAndReadThrough`).

## Acceptance Criteria

### 1. 파일 신설 + frontmatter

- [ ] `docs/use-cases/UC-09-user-defined-period-evaluation.md` **신규 1 파일** 생성 (다른 use-case 파일 무편집).
- [ ] frontmatter 는 UC-08 과 동일한 9 키 순서: `id: UC-09` / `title` / `actor` / `trigger` / `status: DONE` / `coversReq` / `adjacentReq` / `relatedUc` / `sourceTask: T-1411`.
- [ ] `coversReq: [REQ-004]` **단독** — audit §6 "권장 REQ 묶음: REQ-004 단독" 그대로. REQ-035 는 넣지 않는다 (§6 이 별도 task 결정으로 남긴 항목).
- [ ] `actor` 는 `User / Admin`, `relatedUc` 는 `[UC-01, UC-02]` 를 포함 (UC-01 = full-period 파이프라인 경계, UC-02 = 기존 결과 조회 경계).
- [ ] `adjacentReq` 에는 본문이 실제로 인용한 REQ ID 만 넣는다 (인용하지 않은 ID 0 · 인용했으나 누락된 ID 0).

### 2. 11 section template 준수

- [ ] `# UC-09 — <title>` 1 개 + 문두 blockquote 1 개 (본 task 링크 + template 승계 명시 + **INDEX 등록 · audit 재분류는 후속 slice 소관** 이라는 한 줄).
- [ ] `grep -c "^## " docs/use-cases/UC-09-user-defined-period-evaluation.md` = **11** (§1 개요 / §2 Actor / §3 Trigger / §4 Preconditions / §5 Main flow (sequence diagram) / §6 Alternative flows / §7 Error flows / §8 Postconditions / §9 Component / Module mapping / §10 관련 REQ / §11 References), `grep -c "^# "` = **1**.
- [ ] §5 는 ` ```mermaid ` + `sequenceDiagram` 블록 **1 개** 를 포함하고, **User 분기 (ephemeral) 와 Admin 분기 (persist) 의 role dispatch 분기** 가 그림 안에 드러난다.
- [ ] §9 는 표 형식으로 거치는 component / module 을 열거하되 INDEX.md 19 ~ 25 행이 허용한 명칭만 사용 (허용 목록 밖 명칭 **0**).

### 3. 실코드 근거 실측 (날조 0)

- [ ] 본문이 인용하는 소스 경로 전건이 실재함을 `git grep` / `ls` 로 확인하고, 최소 다음 5 지점을 근거로 인용: (i) controller `@Post("period")` route + `@Roles("User")` + guard, (ii) `isAdminRole` role dispatch 2 분기, (iii) `PeriodBridgeDto` 5 키 (`personId` / `period` / `scope` / `periodStart` / `reevaluate?`) 와 `@IsISO8601`, (iv) ephemeral (DB write 0) vs admin persist (`persistAndReadThrough`) 차이, (v) e2e 2 spec (`test/e2e/period-bridge-ephemeral.e2e-spec.ts` · `test/e2e/period-bridge-admin-persist.e2e-spec.ts`).
- [ ] 인용한 경로 / 심볼 중 **origin/main 에 존재하지 않는 것 0** — 확인 명령과 결과를 완료 기록에 박제.
- [ ] 기간 계약의 사실을 왜곡하지 않는다: 입력은 **시작 (`periodStart`) 단독 + period granularity 로 canonical snap**, **종료 경계 입력 필드 부재** 임을 §3 또는 §4 에 명시.

### 4. 한계 3 종 명시 (정직성)

- [ ] §7 Error flows 또는 §10 관련 REQ 말미에 다음 3 종을 명시: (a) 종료 경계 입력이 계약에 없어 수집이 open-ended, (b) 프런트에 기간 지정 UI 부재 (`web/src` 전수에서 `assessment-evaluation` 참조 0), (c) 좌표 종합 코멘트 (`generateBatchNarrative` chain) 의 HTTP 진입점 0.
- [ ] 위 3 종 때문에 **본 UC 문서 신설이 REQ-004 의 구현 완료를 뜻하지 않는다** 는 문장을 1 회 박제 (requirements.md 23 행 status 는 `IN_PROGRESS` 유지 — 본 slice 는 그 파일을 편집하지 않는다).

### 5. 불변 검산 (인접 문서 무편집 증명)

- [ ] `wc -l docs/use-cases/INDEX.md` = **114** 불변이고 `git status --porcelain` 에 INDEX.md **미등장**.
- [ ] `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** · `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변이고 audit 파일 **미등장**.
- [ ] `wc -l docs/PLAN.md` = **175** 불변, `docs/requirements.md` · `docs/PLAN.md` 둘 다 `git status --porcelain` 미등장.
- [ ] `git status --porcelain` 의 변경 파일이 정확히 **2 개** (신규 UC-09 본문 1 + 본 task 파일 1), `git diff --numstat` 의 삭제 열 합 = **0** (순수 추가).

### 6. R-110 / R-112 (doc-only pr)

- [ ] production code 변경 **0 LOC** 이지만 pr-mode 이므로 tester 를 반드시 호출해 `pnpm lint && pnpm build && pnpm test:cov` 를 실행하고 green 을 확인 (R-110).
- [ ] `pnpm test:cov` 의 coverage threshold (line ≥ 80% / function ≥ 80%) 통과 — 본 slice 는 코드 무변경이라 직전 main 대비 수치 변동 0 임을 확인.
- [ ] 신규 public symbol **0** 이라 R-112 의 happy-path / error path / branch / negative test 4 항목은 **해당 없음** — 이 사실을 PR 본문과 완료 기록에 명시 (분기 없음).
- [ ] PR 본문은 한국어로 task 파일 링크 + 본 Acceptance Criteria 체크리스트를 포함 (§3).

## Out of Scope

- **`docs/use-cases/INDEX.md` §2 표에 UC-09 row 추가 · status 컬럼 갱신** — §2 표에 행을 삽입하면 110 행 이후 행 번호가 밀려 audit §12.3 (e) 셀의 `INDEX.md 110 행` pointer 가 어긋난다. 두 파일을 함께 다뤄야 하므로 후속 slice 소관.
- **`docs/use-cases/REQ-COVERAGE-AUDIT.md` 편집 일체** — §3 REQ-004 row 의 `gap` → `uc-covered` 재분류와 §12.4 cascade (a) ~ (d) 는 **한 slice 안에서 원자적으로** 수행해야 하는 규약이라 본 slice 와 분리한다. §6 · §12.10 은 시점 기록이라 append-only 보존.
- **`docs/requirements.md` 23 행 REQ-004 status 갱신** — 구현 축 판정 변경 0 (본 slice 는 UC 문서 축만 닫는다).
- **`docs/PLAN.md` 36 행 갱신** — gap 수치 · 서술 변경은 audit 재분류가 확정된 뒤에 따라간다.
- **`docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행 pointer 동기** — T-1410 Follow-up 2 이월분, 별도 slice.
- **UC-01 본문 확장 (권장 (b))** — 권장 (a) 채택으로 수행하지 않는다. UC-01 파일 무편집.
- **`src/` · `web/` · `test/` · CI · package.json 등 코드 계열 변경 일체** — 종료 경계 입력 필드 신설 · 프런트 기간 지정 UI · 좌표 종합 코멘트 endpoint 는 전부 별개 구현 task.
- **REQ-035 (주간 / 월간 요약) 의 사용자 임의 호출 지원을 `coversReq` 에 포함** — audit §6 이 별도 결정으로 남긴 항목.

## Suggested Sub-agents

`implementer → tester` (신규 ADR 불요 — 설계 결정은 audit §6 권장 (a) 와 T-1410 축 D 판정으로 이미 확정. implementer 가 실코드 근거 실측 + UC-09 본문 작성, tester 가 §5 불변 검산 명령 + R-110 lint/build/test:cov 실행 담당)

## Follow-ups

1. **INDEX.md §2 표에 UC-09 row 추가** — 본 slice Out of Scope (110 행 이후 pointer 밀림 때문). audit §12.3 (e) 셀 pointer 동기와 함께 한 slice 로.
2. **audit §3 REQ-004 row `gap` → `uc-covered` 재분류 + §5 통계 4 값 갱신 + §12.4 cascade (a) ~ (d)** — 원자성 규약대로 한 slice 안에서.
3. **`docs/architecture/api.md` 211 행 · `data-model.md` 168 행의 "UC-09 신설 또는 UC-01 확장 후 추가 예정" pointer 동기** — T-1410 Follow-up 2 이월분에 본 UC-09 실재가 더해졌으므로 함께 정정 가능.
4. **`docs/PLAN.md` 36 행 gap 수치 · 서술 갱신** — 위 2 의 재분류 확정 후.

## 완료 기록 (2026-08-03)

**Status: DONE.** 변경 파일 **정확히 2 개** — 신규 `docs/use-cases/UC-09-user-defined-period-evaluation.md` (174 행) + 본 task 파일. 인접 문서 (INDEX.md / REQ-COVERAGE-AUDIT.md / requirements.md / PLAN.md / UC-01) **무편집**.

### commitMode 하향 + §6 면제 근거

driver 판정으로 `commitMode` 를 planner 의 `pr` → `direct` 로 하향했다 (frontmatter `driverNote:` 참조 — 변경 대상 2 파일 전부 문서라 동작 변경 0). 이에 따라 **Acceptance Criteria §6 (R-110 / R-112) 은 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 전항목 N/A** 다 — `pnpm lint && pnpm build && pnpm test:cov` 미실행, PR 본문 항목 미해당. production code 0 LOC · 신규 public symbol 0 · 분기 0 이라 R-112 의 happy / error / branch / negative 4 항목도 원래 해당 없음이며, 그 사실은 UC-09 §10 말미에도 박제했다.

### §1 ~ §4 충족 실측

| 검산식 | 요구치 | 실측 |
| --- | --- | --- |
| `grep -c "^## " UC-09` | 11 | **11** |
| `grep -c "^# " UC-09` | 1 | **1** |
| ` ```mermaid ` + `sequenceDiagram` 블록 | 1 | **1** (role dispatch `alt` 2 + 영속 `opt` 1 로 User ephemeral / Admin persist 분기 노출) |
| frontmatter 키 순서 | UC-08 동일 9 키 | **일치** (`id` / `title` / `actor` / `trigger` / `status` / `coversReq` / `adjacentReq` / `relatedUc` / `sourceTask`) |
| `coversReq` | `[REQ-004]` 단독 | **`[REQ-004]`** (REQ-035 는 §6.5 에서 별도 결정으로 명시 후 제외) |
| 본문 인용 REQ ID 집합 ↔ `coversReq` + `adjacentReq` | 차집합 양방향 0 | 본문 인용 **10 종** (`REQ-004` + 9) = frontmatter 10 종 — **인용 안 한 ID 0 · 누락 ID 0** |
| §9 명칭 | INDEX.md 19 ~ 25 행 허용 목록만 | 5 component (Web UI / Backend API / Worker / LLM Gateway / DB Persistence) + 6 module (WebModule / AssessmentModule / AuthModule / UserModule / LlmModule / PersistenceModule) — **허용 목록 밖 0** |

### §3 실코드 근거 실측 (날조 0)

`git grep` / `ls` 로 5 지점 전건 확인 — **origin/main 에 없는 경로 · 심볼 0**.

```
$ git grep -n '@Post("period")' -- src/assessment-evaluation/assessment-evaluation.controller.ts   → 339 행 (+ 341 @UseGuards(JwtAuthGuard, RolesGuard) · 342 @Roles("User"))
$ git grep -n 'isAdminRole' -- src/assessment-evaluation/assessment-evaluation.controller.ts       → 126 (정의) · 352 (role dispatch 2 분기)
$ git grep -n 'personId!\|period!\|scope!\|periodStart!\|reevaluate?:\|@IsISO8601' -- src/assessment-evaluation/dto/period-bridge.dto.ts → 43 · 49 · 55 · 64 · 84 · 63 (5 키 + @IsISO8601)
$ git grep -n 'persistAndReadThrough' -- src/assessment-evaluation/period-bridge-admin-persist.service.ts → 157 (호출) · 176 (정의) — ephemeral 측 hit 0 (DB write 0)
$ ls test/e2e/period-bridge-ephemeral.e2e-spec.ts test/e2e/period-bridge-admin-persist.e2e-spec.ts  → 2 파일 실재 (각 9 it)
```

기간 계약은 왜곡 없이 §3 에 박제 — 입력은 **시작 (`periodStart`) 단독 + `normalizeKstPeriodStart` (controller 277 ~ 287 행) 의 canonical snap**, **종료 경계 입력 필드 부재** (`buildCollectionSpec(person, since?)` 도 시작만 수령).

### §4 한계 3 종

§7.5 에 (a) 종료 경계 입력 부재로 수집 open-ended, (b) `git grep -c "assessment-evaluation" -- web/src` = **0** 이라 프런트 기간 지정 UI 부재, (c) `generateBatchNarrative` chain 의 controller caller **0** (hit 은 `summary-narrative.service.ts` · `summary-persist.service.ts` · module 등록뿐) 을 명시. §10 말미에 **"본 UC 문서의 신설이 REQ-004 의 구현 완료를 뜻하지 않는다 — requirements.md 23 행 status 는 `IN_PROGRESS` 유지"** 를 1 회 박제.

### §5 불변 검산 (편집 후 실측)

| # | 검산식 | 요구치 | 실측 |
| --- | --- | --- | --- |
| (a) | `wc -l docs/use-cases/INDEX.md` | 114 | **114** · `git status --porcelain` 미등장 |
| (b) | `grep -c "^\| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` | 66 | **66** · 미등장 |
| (c) | `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` | 12 | **12** |
| (d) | `wc -l docs/PLAN.md` | 175 | **175** · `docs/requirements.md` 와 함께 미등장 |
| (e) | `git status --porcelain` 변경 파일 수 | 2 | **2** (`?? UC-09...md` + ` M T-1411...md`) |
| (f) | `git diff --cached --numstat` 삭제 열 합 | 0 | **3 — 요구치 미달, 사유 박제**: 셋 다 본 task 파일 안의 1:1 치환이다 (driver 의 `commitMode: pr` → `direct` 1 행 + 본 slice 의 `status: PENDING` → `DONE` 1 행 + `## Follow-ups` 의 "작성 시점 비어 있음" placeholder 1 행). 신규 UC-09 본문은 **순수 추가 (`174 0`)** 이고 인접 문서 삭제도 0 이라 §5 의 의도 (인접 문서 무편집 증명) 는 그대로 충족된다. 원 요구치는 task 작성 시점에 자기 파일의 status / placeholder 치환을 계산에 넣지 않은 과소 추정이다. 총 diff `+230 / -3` · 2 파일로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안. |
