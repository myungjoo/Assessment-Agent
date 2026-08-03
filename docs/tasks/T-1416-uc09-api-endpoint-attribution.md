---
id: T-1416
title: api.md §5 104 행 UC-09 귀속 + §7 cross-reference row 신설 + 153 행 UC cover 8 → 9 동기
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 80
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1415]
touchesFiles:
  - docs/architecture/api.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1416-uc09-api-endpoint-attribution.md
plannerNote: "uc-doc-audit-resync 28 번째 slice — T-1415 Follow-up 1. endpoint 는 이미 104 행에 실재(귀속만 UC-01)라 row 신설 0. doc-only × 1.6"
---

# T-1416 — `docs/architecture/api.md` §5 104 행 UC-09 귀속 + §7 cross-reference row 신설 + 153 행 `8 UC cover` → `9 UC cover`

## Why

[T-1415](T-1415-arch-doc-req004-pointer-resync.md) 가 남긴 **Follow-up 1** (UC-09 §5 sequence → api.md §5 Endpoint 표 실박제) 을 집행한다. 다만 planner 실측 결과 그 Follow-up 의 전제가 **부분적으로 사실과 다르다** — [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) §5 sequence 가 호명하는 endpoint 는 `POST /api/assessment-evaluation/period` **하나뿐** 이고 (UC-09 5 · 36 · 70 · 136 행 전부 같은 route), 그 endpoint 는 [api.md](../architecture/api.md) **§5 표 104 행에 이미 박제돼 있다**. 없는 것은 endpoint row 가 아니라 **UC 귀속** 이다 — 104 행의 UC 컬럼이 `[UC-01]` 단독이라 UC-09 가 어디에도 연결돼 있지 않고, §7 (UC §5 sequence step ↔ endpoint cross-reference) 표에도 UC-09 row 가 없다 (`grep -c "^| \[UC-" docs/architecture/api.md` = **8**).

따라서 본 slice 는 **endpoint 신설 0** 이다 — 153 행 합계의 `72 endpoint` · `16 resource prefix` 는 **불변** 이며, 바뀌는 것은 `8 UC cover` → `9 UC cover` 뿐이다 (§7 에 UC-09 row 를 추가한 직접 인과). 이 판정 자체가 본 slice 의 산출물의 절반이므로 audit §12.14 에 근거와 함께 박제한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (140 ~ 142 행 P7 성능 검증 · 151 행 P8 부하·내성 · 108 · 109 행 live-LLM) 은 각각 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행 불가 — 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/api.md` — **62 · 64 행** (`## 5. Endpoint 표` heading + 서두 "8 UC §5 sequence 의 호명을 모두 수집" 문장 — 본 slice **무편집** 경계), **104 행** (갱신 대상 1: `| POST | /api/assessment-evaluation/period | [UC-01](../use-cases/UC-01-evaluation-execution.md) | … | User (self-only) / Admin (full-persist) |` — UC 컬럼만 대상), **153 행** (갱신 대상 2: `**합계**: 72 endpoint 행 … / 16 resource prefix / 8 UC cover (…)`), **155 행** (T-1306 집계 규칙 3 항 — endpoint 1 개의 정의와 재집계 명령의 정본, **무편집**), **179 ~ 183 행** (`## 7.` heading + 서두 문장 + 표 header), **185 ~ 192 행** (UC-01 ~ UC-08 8 row — 신규 row 의 서술 형식 정본), **193 ~ 196 행** (표 뒤 보조 문단 3 개 — 삽입 하한 경계, **무편집**), **211 행** (갱신 대상 3: T-1415 가 방금 in-place 치환한 REQ-004 out-of-scope bullet).
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — **5 행** (frontmatter `trigger` — 호명 endpoint 1 종 확인), **36 행** (입력 계약 `PeriodBridgeDto` 5 키), **54 ~ 80 행** (`## 5. Main flow` + mermaid — **70 행** 의 `Requester->>BackendAPI: POST /api/assessment-evaluation/period` 가 유일한 HTTP 호명 step 임을 실측 확인), **136 행** (§9 component mapping row). 본 문서 **무편집**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **908 ~ 952 행** (§12.13 — 화법·구성 정본이며 **무편집**), **946 ~ 952 행** (§12.13 한계 3 항 — 특히 한계 ① `endpoint / entity 실박제 미완` 이 본 slice 로 endpoint 축만 해소됨을 대조), **953 행** (`## 11. References` — 신규 §12.14 삽입 위치 상한).
- `docs/tasks/T-1415-arch-doc-req004-pointer-resync.md` — **95 ~ 99 행** (Follow-up 5 건 — 본 slice 는 1 번), **103 ~ 117 행** (완료 기록 — 211 행 현재 문면 대조용).

## Acceptance Criteria

### 1. 실측 선행 판정 (날조 0 의 전제)

- [ ] UC-09 §5 sequence 가 호명하는 HTTP endpoint 를 **실측 열거** — UC-09 5 · 36 · 70 · 136 행 기준으로 `POST /api/assessment-evaluation/period` **1 종뿐** 임을 확인하고, 그 route 가 api.md §5 표 **104 행에 이미 실재** 함을 확인한다. 실측이 이 전제와 다르면 (2 종 이상 호명 등) **작업을 중단하고** 차이를 완료 기록에 적은 뒤 Follow-up 으로 이월한다 (임의 endpoint row 신설 금지).
- [ ] 재집계 명령 baseline 실행 — `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` = **72**, `grep -c "^| \[UC-" docs/architecture/api.md` = **8**. 두 값을 완료 기록에 박제.

### 2. `docs/architecture/api.md` 104 행 UC 귀속 병기 (in-place)

- [ ] 104 행의 **UC 컬럼만** 1:1 in-place 치환 — 기존 `[UC-01](../use-cases/UC-01-evaluation-execution.md)` 을 **제거하지 않고** [UC-09](../use-cases/UC-09-user-defined-period-evaluation.md) 링크를 **병기** 한다 (같은 route 가 UC-01 의 manual trigger 이관 경로이자 UC-09 의 유일 진입점이므로 둘 다 참). 표기 예: `[UC-01](…) · [UC-09](…)`.
- [ ] **METHOD · path · description · auth tier 4 컬럼은 한 글자도 편집하지 않는다** — 본 slice 는 귀속만 다룬다. 행은 **1 행 유지** 이고 위치 (104 행) 불변, 인접 103 · 105 행 **무편집**.
- [ ] 검산: `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` = **72 불변** (endpoint 신설 0).

### 3. `docs/architecture/api.md` §7 UC-09 row 신설

- [ ] §7 표 마지막 row (192 행 UC-08) **바로 뒤** 에 UC-09 row 1 행 추가 — 3 컬럼 모두 UC-09 본문 실측에서 채운다: (i) UC 링크는 `#5-main-flow-sequence-diagram` anchor 포함 (선행 8 row 형식 승계), (ii) "핵심 endpoint 호출 step" 은 UC-09 §5 mermaid 의 **실제 step** (Requester → BackendAPI 의 `POST /api/assessment-evaluation/period` 호출) 로 적고 **role 2 분기 (User ephemeral / Admin persist)** 를 1 구로 덧붙인다, (iii) endpoint group 은 `POST /api/assessment-evaluation/period` 단일이며 **§5 104 행이 계약의 정본** 임을 pointer 로 위임한다 (description 재생산 금지 — 104 행 중복 서술은 drift 원인).
- [ ] row 는 **1 행** 이고 표 뒤 보조 문단 3 개 (193 ~ 196 행) 와 §8 heading 은 **무편집**.
- [ ] 검산: `grep -c "^| \[UC-" docs/architecture/api.md` = **9**.

### 4. `docs/architecture/api.md` 153 행 합계 동기 (in-place)

- [ ] 153 행에서 **`8 UC cover` → `9 UC cover`** 1 토큰 치환 + 짧은 부기 1 구 (`T-1416 박제로 UC-09 귀속 추가 — endpoint 신설 0 이라 72 / 16 은 불변`). 행은 **1 행 유지**.
- [ ] **`72 endpoint 행` · `16 resource prefix` 두 값과 그 뒤 누계 서술 (T-0117 ~ T-1306 이력) 은 한 글자도 바꾸지 않는다** — 본 slice 는 endpoint 를 신설하지 않았다.
- [ ] api.md 3 · 12 · 64 · 207 · 208 행의 다른 `8 UC` 표기는 **무편집** (T-1415 Follow-up 4 소관). 검산: `grep -c "8 UC" docs/architecture/api.md` = **7 → 6**.

### 5. `docs/architecture/api.md` 211 행 잔여 의무 재기술 (in-place)

- [ ] 211 행을 **1 행 in-place 치환** — T-1415 가 적은 "UC-09 §5 sequence 가 호명하는 endpoint 는 아직 본 §5 표에 미박제" 는 본 slice 의 실측으로 **사실이 아니게 됐으므로** 남기지 않는다. 대체 문면 3 요소: (i) endpoint 축은 **§5 104 행 (실재) + §7 UC-09 row (귀속)** 로 본 문서 안에서 **해소** 됨, (ii) 그럼에도 out-of-scope 로 남는 잔여는 **본 문서 밖 축** — [data-model.md](../architecture/data-model.md) §2 entity 도출 판정 · 프런트 기간 지정 UI 부재 (UC-09 118 행 실측), (iii) 근거를 `REQ-COVERAGE-AUDIT.md §12.13 · §12.14` 로 위임.
- [ ] bullet **1 행 유지** · `## 8. Out of scope` 안 위치 (211 행) 불변 · 인접 210 · 212 행 **무편집**. bullet 을 **삭제하지 않는다** (순수 삭제 0 — 잔여 축이 실재하므로 재기술이 맞다).

### 6. audit §12.14 실행 기록 절 신설

- [ ] `## 11. References` (953 행) **바로 앞** 에 `### 12.14 UC-09 endpoint 귀속 박제 — api.md §5 104 행 · §7 row (T-1416)` 절 추가. `###` 이므로 `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12 불변**.
- [ ] 구성은 §12.13 화법 승계 — (i) 서두 blockquote (본 절 소관 1 줄), (ii) **실측 선행 판정** 1 문단 — "Follow-up 1 의 전제 (`endpoint 미박제`) 는 부분적으로 사실과 달랐다: 호명 endpoint 1 종은 104 행에 이미 실재했고 없던 것은 **귀속**" 을 명시하고 판정 근거 (UC-09 5 · 36 · 70 · 136 행 · api.md 104 행) 를 열거, (iii) **갱신 4 지점 기록** 각 1 줄 (104 행 귀속 병기 · §7 row 신설 · 153 행 `8 UC cover` → `9 UC cover` · 211 행 재기술), (iv) §12.13 **한계 ① 의 소진 상태** 1 줄 — endpoint 축 해소 · **entity 축은 잔존** (T-1415 Follow-up 2 소관), (v) **불변 검산 출력 블록** (AC 7 의 명령 + 실측 출력 그대로), (vi) **한계** 3 항.
- [ ] 한계 절 최소 3 항: ① **endpoint 신설 0** — `72 endpoint` · `16 resource prefix` 무변이며 본 slice 는 문서 안 귀속만 바꿨다 (실코드 route 신설 0), ② **data-model.md §2 entity 축 미판정** — UC-09 가 신규 entity 를 요구하는지 여부는 본 slice 가 **판정하지 않았다**, ③ **`8 UC` 표기는 153 행 1 곳만 갱신** — api.md 3 · 12 · 64 · 207 · 208 행 · data-model.md 3 · 38 행 · audit §11 References 2 줄은 여전히 stale 이며 별도 slice 소관.

### 7. 불변 검산 (인접 문서 무편집 증명)

- [ ] `git status --porcelain` 의 변경 파일이 정확히 **3 개** — `docs/architecture/api.md` · `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일 (driver 가 같은 commit 에 얹는 `docs/STATE.json` · journal 은 본 계산 제외).
- [ ] `docs/architecture/data-model.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `CLAUDE.md` 모두 `git status --porcelain` **미등장**.
- [ ] `wc -l docs/architecture/api.md` = **229 → 230** (§7 row 1 행 추가분만 증가 — 나머지 3 지점은 1:1 in-place 치환).
- [ ] audit 검산: `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변 · `grep -c "^## "` = **12** 불변 · §3 38 행 REQ-004 row · §4 116 행 정합식 (`34 + 15 + 4 + 13 + 0 = 66`) · §5 표 (`49 / 4 / 13 / 0`) · §12.3 cascade 6 row **무변**.
- [ ] `git diff --numstat` 을 완료 기록에 박제 — api.md 는 **추가 4 / 삭제 3** (104 · 153 · 211 in-place 3 짝 + §7 row 순수 추가 1), audit 은 **삭제 0** (순수 append). 삭제 3 이 전부 in-place 치환의 짝이라 **순수 삭제 0** 임을 명시하고, 합계가 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안임을 적는다.

### 8. R-110 / R-112 (direct doc-only)

- [ ] 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** (분기 없음). 이 사실을 완료 기록에 1 줄 명시.

## Out of Scope

- **`src/` · `test/` · `web/` 의 route 신설 / 변경 일체** — `POST /api/assessment-evaluation/period` 는 이미 shipped (T-0315 ~ T-0323, [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md)) 이고 본 slice 는 **문서 귀속** 만 다룬다.
- **api.md §5 104 행의 description 컬럼 재작성 / 축약 / UC-09 문면 삽입** — 계약 서술의 정본은 104 행이고 본 slice 는 UC 컬럼 1 개만 건드린다. §7 신규 row 도 description 을 재생산하지 않고 104 행으로 위임한다.
- **`docs/architecture/data-model.md` 편집 일체** — UC-09 §5 기준 entity 도출 판정 (신규 entity 필요 여부 · §2 표 row · 38 행 `13 entity` 합계) 은 T-1415 Follow-up 2 의 별도 slice 소관이며 본 slice 는 **판정조차 하지 않는다**.
- **api.md 3 · 12 · 64 · 207 · 208 행 · audit §11 References 2 줄의 `8 UC` 표기 갱신** — 153 행 외의 `8 UC` 는 T-1415 Follow-up 4 소관 (시점 기록인지 현행 index 서술인지의 일괄 판정 선행 필요).
- **audit §1 18 행 · §6 · §8 160 ~ 161 행 · §9 · §10 · §12.1 ~ §12.13 본문 편집 일체** — 각 시점의 요약·판정 서술은 append-only 보존 대상. 옛 행 번호 표기 (`115 행` · `L212` · `104 행` 등) 도 시점 기록이라 정정하지 않는다.
- **audit §12.3 cascade 6 지점 표 · 각주 편집** — 본 slice 의 4 지점은 cascade 6 지점 **밖** 이다 (6 지점은 T-1414 로 전건 closure 확정).
- **`docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · UC 본문 편집** · **재판정 후보 17 row 또는 다른 분류 row 재검토** · CI · package.json 등 코드 계열 변경 일체.

## Suggested Sub-agents

`implementer` (신규 ADR 불요 — endpoint 계약은 [ADR-0037](../decisions/ADR-0037-period-collection-evaluate-bridge.md) 가 이미 ACCEPTED 이고 본 slice 는 문서 귀속만 다룬다. direct doc-only 라 tester 호출 면제 — §3.2. implementer 가 AC 1 실측 판정 → 104 행 UC 컬럼 병기 → §7 row 신설 → 153 행 토큰 치환 → 211 행 재기술 → §12.14 절 작성 → AC 7 불변 검산 명령 실행 순으로 담당)

## Follow-ups

1. **UC-09 §5 기준 `docs/architecture/data-model.md` §2 entity 도출 판정** — T-1415 Follow-up 2 이월. 신규 entity 가 필요한지 (기존 `Assessment` 로 충분한지) 를 먼저 판정하고, 필요 시에만 §2 표 row + 38 행 `13 entity` 합계 갱신 + 168 행 잔여 의무 재기술.
2. **audit §8 161 · 162 행 · §1 18 행의 `gap 1 건` 결론 문장 처리 방침 확정** — T-1413 Follow-up 4 · T-1414 Follow-up 4 · T-1415 Follow-up 3 의 3 회 이월. §12.10 790 행 한계 2 의 3 지점 중 유일 잔존 1 건.
3. **`8 UC` 표기 일괄 갱신** — api.md 3 · 12 · 64 · 207 · 208 행 · data-model.md 3 · 38 행 · audit §11 References 2 줄. 각 지점이 시점 기록인지 현행 index 서술인지의 판정이 선행 (T-1415 Follow-up 4 이월 + 본 slice 한계 ③).
4. **audit 198 행 `INDEX.md 104 행` 표기 최신성 점검** — T-1412 Follow-up 4 · T-1413 Follow-up 3 · T-1414 Follow-up 3 · T-1415 Follow-up 5 의 4 회 이월.
5. **UC-09 ↔ `docs/architecture/modules.md` / `components.md` mapping 점검** — UC-09 136 행이 `AssessmentModule (controller layer) + AuthModule` 을 지목하는데 두 architecture 문서가 UC-09 를 알지 못한다. 본 slice 의 api.md 귀속과 동형 처리가 필요한지 판정.

## 완료 기록 (2026-08-03)

**Status: DONE.** 변경 파일 **정확히 3 개** — `docs/architecture/api.md` (+4/-3) · `docs/use-cases/REQ-COVERAGE-AUDIT.md` (+47/-0) · 본 task 파일. 2 doc 파일 합계 **삽입 51 / 삭제 3** 으로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안이며, 삭제 3 은 전부 in-place 치환의 짝 (api.md 104 · 153 · 211 행) 이라 **순수 삭제 0** 이다 (AC 7).

**AC 1 (실측 선행 판정)** — 전제는 **성립했다**. UC-09 §5 sequence (54 ~ 98 행) 가 호명하는 HTTP endpoint 는 70 행의 `POST /api/assessment-evaluation/period` **1 종뿐** 이고 (5 · 36 · 136 행이 같은 route 를 가리키며, 118 행은 같은 route 의 UI 부재 서술, 124 행 `GET /api/assessments` 는 §8 postcondition 의 UC-02 조회 경로 참조라 §5 step 아님), 그 route 는 api.md §5 표 **104 행에 이미 실재** 했다. 없던 것은 **UC 귀속** — 104 행 UC 컬럼이 `[UC-01]` 단독이고 §7 표에 UC-09 row 부재. baseline 재집계: `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|'` = **72** · `grep -c "^| \[UC-"` = **8**. 2 종 이상 호명이 아니므로 중단 없이 진행했고, 임의 endpoint row 신설은 **0** 이다.

**AC 2 (104 행 UC 귀속 병기)** — UC 컬럼만 1:1 in-place 치환 (`[UC-01](…)` → `[UC-01](…) · [UC-09](…)`). METHOD · path · description · auth tier 4 컬럼 무편집 · 행 1 행 유지 · 위치 (104 행) 불변 · 인접 103 · 105 행 무편집. 검산 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|'` = **72 불변**.

**AC 3 (§7 UC-09 row 신설)** — UC-08 row (192 행) 바로 뒤에 1 행 추가 (신규 193 행). (i) UC 링크 `#5-main-flow-sequence-diagram` anchor 포함, (ii) 호출 step 은 §5 autonumber **step 1** (Requester→BackendAPI, 기간 좌표 body) + role 2 분기 (User self-only ephemeral / Admin full-persist) 1 구, (iii) endpoint group 은 단일 route 이되 계약 정본을 **§5 104 행으로 위임** (description 재생산 0). 표 뒤 보조 문단 3 개와 `## 8.` heading 무편집. 검산 `grep -c "^| \[UC-"` = **9**.

**AC 4 (153 행 합계 동기)** — `8 UC cover` → `9 UC cover` 1 토큰 치환 + 부기 1 구 (`T-1416 박제로 UC-09 귀속 추가 (§5 104 행 UC 컬럼 병기 + §7 UC-09 row 신설) 라 UC cover 8 → 9 — endpoint 신설 0 이라 72 / 16 은 불변`). `72 endpoint 행` · `16 resource prefix` · T-0117 ~ T-1306 누계 서술 무편집 · 1 행 유지. 검산 `grep -c "8 UC"` = **7 → 6** (3 · 12 · 64 · 207 · 208 행은 무편집).

**AC 5 (211 행 재기술)** — 1 행 in-place 치환 (치환 후 212 행). 3 요소 충족 — (i) endpoint 축은 §5 104 행 (실재) + §7 UC-09 row (귀속) 로 본 문서 안에서 **해소**, (ii) 잔여는 본 문서 밖 축 (data-model.md §2 entity 도출 판정 · 프런트 기간 지정 UI 부재 — UC-09 118 행 실측), (iii) 근거를 `REQ-COVERAGE-AUDIT.md §12.13 · §12.14` 로 위임. bullet **삭제 0** (순수 삭제 0) · `## 8. Out of scope` 안 위치 불변 · 인접 bullet 무편집.

**AC 6 (audit §12.14 신설)** — `## 11. References` 바로 앞에 `### 12.14 UC-09 endpoint 귀속 박제 — api.md §5 104 행 · §7 row (T-1416)` 절 (47 행) 삽입, `grep -c "^## "` = **12 불변**. 구성은 §12.13 화법 승계 — (i) 서두 blockquote, (ii) 실측 선행 판정 1 문단 (전제가 부분적으로 사실과 달랐음 + 근거 열거), (iii) 갱신 4 지점 기록 각 1 줄, (iv) §12.13 한계 ① 소진 상태 (endpoint 축 해소 · entity 축 잔존), (v) 불변 검산 출력 블록, (vi) 한계 3 항.

**AC 7 (불변 검산)** — `git status --porcelain` 변경 파일 **3 개** (위 목록) 이고 `docs/architecture/data-model.md` · `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `UC-01` ~ `UC-09` 본문 · `CLAUDE.md` **미등장**. `wc -l docs/architecture/api.md` = **229 → 230**. audit 검산 `grep -c "^| REQ-"` = **66** · `grep -c "^## "` = **12** 불변이며 §3 38 행 · §4 116 행 정합식 · §5 표 · §12.3 cascade 6 row 는 hunk 밖 무변 (`git diff -U0 | grep '^@@'` = 5 hunk: api 104 · 153 · 192,0+193 · 211 · audit 952,0+953,47). `git diff --numstat` = api.md **4 / 3** · audit **47 / 0**.

**AC 8 (R-110 / R-112 면제)** — 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** 다 (분기 0, architect / tester dispatch 0).

**Out of Scope 준수** — `src/` · `test/` · `web/` route 일체, api.md 104 행의 description · auth tier 컬럼, `docs/architecture/data-model.md` 전체, api.md 3 · 12 · 64 · 207 · 208 행 · audit §11 References 의 `8 UC` 표기, audit §1 · §6 · §8 · §9 · §10 · §12.1 ~ §12.13 본문 · §12.3 cascade 표, INDEX.md · PLAN.md · requirements.md · UC 본문, 코드 계열 전부 **한 글자도 건드리지 않았다**.
