---
id: T-1412
title: INDEX.md §2 표에 UC-09 row 등록 + §3 description 신설 + audit §12.3 (e) 행 pointer 동기
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1411]
touchesFiles:
  - docs/use-cases/INDEX.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1412-index-uc09-row-registration.md
plannerNote: "uc-doc-audit-resync 24 번째 slice — T-1411 Follow-up 1 (의존 최전방) 채택. PLAN 미완 bullet 은 credential·부하 게이트로 대기 중이라 본 doc stream 우선. doc-only inline-amend × 0.64"
---

# T-1412 — INDEX.md §2 표에 UC-09 row 등록 + §3 description 신설 + audit §12.3 (e) 행 pointer 동기

## Why

[T-1411](T-1411-uc-09-user-defined-period-evaluation.md) 이 `docs/use-cases/UC-09-user-defined-period-evaluation.md` (174 행) 를 main 에 박제해 REQ-004 gap 을 **UC 본문 축** 에서 닫았다. 그러나 use case 목록의 backbone 인 [INDEX.md](../use-cases/INDEX.md) §2 표에는 UC-09 row 가 아직 없어 (`grep -c "^| UC-" docs/use-cases/INDEX.md` = **8**), 본문 파일은 실재하는데 인덱스에서는 **발견 불가능한 상태** 다. [INDEX.md](../use-cases/INDEX.md) §5 갱신 룰 1 ("새 UC 가 추가될 때 — 본 표에 새 row 추가 + 신규 description 단락 추가") · 룰 3 ("UC 본문 task 가 머지될 때 status 컬럼을 `DONE` 으로") 이 규정한 동기 의무의 이행이 본 slice 다.

본 slice 는 T-1411 Follow-up 4 건 중 **의존 순서상 최전방** 이다 — [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) §12.10 의 축 A 가 "UC-09 미착수" 판정의 실측 근거로 `UC-09 파일 hit 0` 과 함께 **`grep -c "^| UC-" INDEX.md` = 8 (UC-09 row 없음)** 을 든 만큼, 후속 slice 의 audit §3 REQ-004 `gap` → `uc-covered` 재분류는 본 row 등록이 선행돼야 근거가 선다. 동시에 §2 표 · §3 description 삽입은 INDEX.md 110 행 이후 행 번호를 밀어내므로, audit §12.3 302 행 (e) 셀이 지목하는 `docs/use-cases/INDEX.md 110 행` pointer 를 **같은 slice 안에서** 정정해야 dangling 이 생기지 않는다 (T-1411 Follow-up 1 이 두 편집을 한 slice 로 묶으라고 지정한 이유).

수치 재분류 (audit §3 / §5 / cascade (a) ~ (d)) 는 [§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 311 행의 **원자 묶음** 규약대로 별도 slice 소관이라 본 task 는 **수치 문자열을 한 글자도 바꾸지 않는다** (Out of Scope).

## Required Reading

- `docs/use-cases/INDEX.md` — 19 ~ 27 행 (§2 컬럼 정의 7 종 — component 8 종 · module 9 종 · REQ ID 실재 · status 3 값의 **허용 목록**), 29 ~ 40 행 (표 header + 8 row + 40 행 "총 8 UC" 시점 기록), 42 ~ 48 행 (**amendment 문단 화법 3 건** — `**YYYY-MM-DD 재판정 (T-NNNN)**` 형식, 본 slice 가 승계할 template), 80 ~ 82 행 (§3 UC-08 description 블록 — 본 slice 가 그대로 따를 4 줄 구조), 98 ~ 113 행 (§5 갱신 룰 1 · 3 + closure 문단 110 ~ 112 행).
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — 1 ~ 11 행 frontmatter (`title` / `actor: User / Admin` / `trigger` / `status: DONE` / `coversReq: [REQ-004]` / `adjacentReq` 9 종 / `relatedUc: [UC-01, UC-02]`), `## 1. 개요` 첫 2 문단 (description 문단의 요약 source — UC-01 / UC-02 와의 2 경계), `## 9. Component / Module mapping` 표 (component 5 종 · module 6 종 — **INDEX row 의 component / module 컬럼 값의 유일한 source**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — 292 ~ 306 행 (§12.3 cascade 6 지점 표, 특히 302 행 (e) 셀 = 본 slice 가 정정할 유일한 audit 지점 + 306 행 append-only 규약), 307 ~ 313 행 (§12.4 원자 묶음 (a) ~ (d) / 분리 허용 (e) · (f) — 본 slice 가 수치를 건드리지 않는 근거), 102 ~ 104 행 (§4 서두 — "INDEX.md 의 `관련 REQ` 컬럼이 본 list 의 subset 인 경우 본문 frontmatter 가 정답").
- `docs/tasks/T-1411-uc-09-user-defined-period-evaluation.md` — 98 ~ 104 행 (Follow-ups 4 건 — 본 slice 는 1 번, 나머지 3 건은 후속).

## Acceptance Criteria

### 1. INDEX.md §2 표에 UC-09 row 1 행 추가

- [ ] `docs/use-cases/INDEX.md` 38 행 (UC-08 row) 다음에 UC-09 row **1 행** 삽입 → `grep -c "^| UC-" docs/use-cases/INDEX.md` = **9**.
- [ ] 7 컬럼 값: `UC-09` / `사용자 지정 기간 임의 평가문 요청` (UC-09 frontmatter `title` 과 문자열 동일) / actor `User / Admin` / 주요 component · 주요 module 은 **UC-09 §9 표에서 옮겨 적기** / 관련 REQ `REQ-004` **단독** / status `DONE`.
- [ ] component 컬럼은 INDEX.md 24 행 허용 8 종 안의 명칭만, module 컬럼은 25 행 허용 9 종 안의 명칭만 — **허용 목록 밖 명칭 0**. UC-09 §9 의 `AssessmentModule (controller layer)` 같은 괄호 수식은 제거하고 순수 module 명만 나열 (기존 8 row 화법).
- [ ] 관련 REQ 를 `REQ-004` 단독으로 두는 근거를 amendment 문단에 1 줄 — UC-09 frontmatter `coversReq` 가 `[REQ-004]` 단독이고 `adjacentReq` 9 종은 §4 104 행의 subset 규칙상 INDEX 표에 올리지 않는다.

### 2. §3 에 UC-09 description 블록 신설

- [ ] `## 4. References` (84 행) 직전에 `### UC-09 사용자 지정 기간 임의 평가문 요청` 블록 추가 → `grep -c "^### UC-" docs/use-cases/INDEX.md` = **9**.
- [ ] 블록 구조는 UC-08 (80 ~ 82 행) 과 동일 — 제목 1 행 + 빈 줄 + 본문 1 문단 + 빈 줄. 본문 끝은 `→ [UC-09-user-defined-period-evaluation.md](UC-09-user-defined-period-evaluation.md)` 링크로 마감 (8 블록 공통 화법).
- [ ] 본문 1 문단은 UC-09 §1 개요를 근거로 (i) trigger (`POST /api/assessment-evaluation/period` 에 person + 기간 좌표 지정), (ii) **UC-01 (cron / manual full-period) · UC-02 (기존 결과 read path) 와의 2 경계**, (iii) role dispatch 2 분기 (User = ephemeral / Admin = 영속) 를 담는다. 날조 0 — UC-09 본문에 없는 사실 추가 금지.
- [ ] 링크 검산: `ls docs/use-cases/UC-09-user-defined-period-evaluation.md` 성공 (broken link 0).

### 3. amendment 문단 1 개 추가 (시점 기록 보존)

- [ ] 48 행 (T-1392 대조 문단) 다음에 `**2026-08-03 UC-09 row 등록 (T-1412)**` 문단 **1 개** 추가. 42 ~ 48 행의 기존 화법 승계.
- [ ] 문단이 담을 4 사실: (i) [T-1411](T-1411-uc-09-user-defined-period-evaluation.md) 의 UC-09 본문 머지에 따른 §5 갱신 룰 1 · 3 이행, (ii) 21 행 "본 task 시점에 UC-01 ~ UC-08 의 8 개" · 40 행 "총 8 UC" 는 **T-0019 시점 기록이라 무편집 보존** 하고 현재 총계는 **9 UC** 임, (iii) 110 행 closure 문단의 4 값 · gap 서술은 **본 slice 무편집** — audit §3 재분류 cascade 확정 후 후속 slice 가 동기 ([§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 311 행 분리 허용), (iv) 본 row 등록이 audit §12.10 축 A 의 "미착수" 근거 (`^| UC-` = 8) 를 해소한다는 사실.
- [ ] 21 행 · 40 행 · 110 행 · 114 행 (Refs) 문자열은 **무편집** — `git diff docs/use-cases/INDEX.md` 에서 이 4 행이 삭제 측 (`-`) 으로 등장하지 않음.

### 4. audit §12.3 (e) 셀 행 pointer 동기

- [ ] 편집 후 INDEX.md 의 closure 문단 실제 행 번호 측정: `grep -n "uc-covered 48 / cross-cutting 4" docs/use-cases/INDEX.md` → N (단일 hit).
- [ ] `docs/use-cases/REQ-COVERAGE-AUDIT.md` 302 행 (e) 셀의 지목을 `docs/use-cases/INDEX.md` **110 행 → N 행** 으로 1:1 치환. **`현재 값` 열의 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` 문자열은 무편집** (분류 변경 0).
- [ ] §12.3 표 아래 306 행 다음에 각주 **1 줄** 추가 — `2026-08-03 (T-1412): INDEX.md 의 UC-09 row · description 등록으로 (e) 지점 행 번호가 110 → N 으로 이동 (수치 문자열 무변). §12.6 ~ §12.10 본문의 `110 행` 표기는 시점 기록이라 append-only 규약대로 보존.`
- [ ] 검산: `grep -n "^| (e) |" docs/use-cases/REQ-COVERAGE-AUDIT.md` 결과에 `N 행` 포함 · `110 행` **미포함**, 그리고 `sed -n "${N}p" docs/use-cases/INDEX.md` 가 `uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1` 을 포함.
- [ ] audit 파일의 §1 ~ §11 · §12.1 ~ §12.2 · §12.5 ~ §12.10 은 **무편집** — `git diff --numstat docs/use-cases/REQ-COVERAGE-AUDIT.md` 의 삭제 열 = **1** (§12.3 (e) 셀 1:1 치환의 짝) 이고 추가 열 ≤ **2**.

### 5. 불변 검산 (인접 문서 무편집 증명)

- [ ] `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변 · `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [ ] `wc -l docs/PLAN.md` = **175** 불변, `docs/PLAN.md` · `docs/requirements.md` · `docs/use-cases/UC-01-evaluation-execution.md` · `docs/use-cases/UC-09-user-defined-period-evaluation.md` 모두 `git status --porcelain` **미등장**.
- [ ] `git status --porcelain` 의 변경 파일이 정확히 **3 개** (INDEX.md · REQ-COVERAGE-AUDIT.md · 본 task 파일) — driver 가 같은 commit 에 얹는 `docs/STATE.json` · journal 은 별도 (본 계산에서 제외).
- [ ] 총 diff 가 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안 — `git diff --numstat` 합계를 완료 기록에 박제.

### 6. R-110 / R-112 (direct doc-only)

- [ ] 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) 전항목 **N/A**. 이 사실을 완료 기록에 1 줄 명시 (분기 없음).

## Out of Scope

- **audit §3 REQ-004 row 의 `gap` → `uc-covered` 재분류** 와 그에 딸린 cascade (a) ~ (d) (§3 셀 · §4 106 ~ 115 행 bullet / 정합식 · §5 121 ~ 127 행 통계 4 값) — [§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 311 행의 **원자 묶음** 규약상 한 slice 안에서 함께 해야 하므로 본 slice 와 분리. 본 slice 는 audit 의 **수치를 한 글자도 바꾸지 않는다**.
- **INDEX.md 110 행 closure 문단의 4 값 · gap 서술 (`gap 1 (REQ-004 — … UC-09 신설 또는 UC-01 확장 권장)`) 갱신** — cascade (e) 는 (c) · (d) 발동 후에 옮겨 적는 지점이라 재분류 확정 전 선행 갱신 금지. 본 slice 가 만드는 lag 은 §12.4 가 명시적으로 허용한 것.
- **`docs/PLAN.md` 36 행 갱신** — cascade (f), 위와 같은 이유로 후속.
- **`docs/architecture/api.md` 211 행 · `docs/architecture/data-model.md` 168 행 pointer 동기** — T-1411 Follow-up 3 이월분, 별도 slice.
- **audit 198 행 `INDEX.md 104 행` 표기의 최신성 점검** — §9.5 시점 기록 안의 stale 후보이나 본 slice 판정 축 밖 (Follow-ups 에 기록).
- **INDEX.md 21 · 40 · 114 행 편집** — 시점 기록 / Refs 보존 (기존 재판정 slice 들이 task ID 를 Refs 에 추가하지 않은 선례 승계).
- **UC-09 본문 파일 편집 일체** · **UC-01 본문 확장** · `src/` · `web/` · `test/` · CI · package.json 등 코드 계열 변경 일체.

## Suggested Sub-agents

`implementer` (신규 ADR 불요 — 편집 내용은 INDEX.md §5 갱신 룰 1 · 3 과 audit §12.3 / §12.4 규약이 이미 확정. direct doc-only 라 tester 호출 면제 — §3.2. implementer 가 UC-09 §9 / frontmatter 실측 → row · description 작성 → 행 번호 재측정 → audit (e) 셀 치환 → §5 불변 검산 명령 실행까지 담당)

## Follow-ups

1. **audit §3 REQ-004 row `gap` → `uc-covered` 재분류 + cascade (a) ~ (d)** — T-1411 Follow-up 2 이월. §12.4 원자 묶음 규약대로 한 slice 안에서 (§3 셀 · §4 106 ~ 115 행 bullet / 정합식 · §5 121 ~ 127 행 통계 4 값).
2. **cascade (e) · (f) 수치 동기** — 위 1 확정 후 INDEX.md 118 행 closure 문단 4 값 · gap 서술 + `docs/PLAN.md` 36 행. 본 slice 는 (e) 의 **행 pointer 만** 옮겼고 수치는 무편집.
3. **`docs/architecture/api.md` 211 행 · `data-model.md` 168 행 pointer 동기** — T-1411 Follow-up 3 이월분 (UC-09 실재 반영).
4. **audit 198 행 `INDEX.md 104 행` 표기 최신성 점검** — 본 slice 의 §3 description 블록 4 행 삽입으로 104 행 지목이 추가로 밀렸을 가능성 (§9.5 시점 기록 안의 stale 후보, 본 slice 판정 축 밖이었음).

## 완료 기록 (2026-08-03)

**Status: DONE.** 변경 파일 **정확히 3 개** — `docs/use-cases/INDEX.md` (+8/-0) · `docs/use-cases/REQ-COVERAGE-AUDIT.md` (+2/-1) · 본 task 파일 (+21/-2). `git diff --numstat` 합계 **+31/-3 (34 LOC)** — 문서 2 개만 보면 +10/-1 — 로 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안. `docs/PLAN.md` · `docs/requirements.md` · `UC-01-evaluation-execution.md` · `UC-09-user-defined-period-evaluation.md` 는 `git status --porcelain` **미등장** (무편집).

**AC 1 ~ 2 (INDEX 등록)** — UC-08 row 다음에 UC-09 row 1 행 삽입 → `grep -c "^| UC-"` = **9**. 7 컬럼 값은 UC-09 frontmatter `title` / `actor` 와 §9 표에서 옮겨 적었고 (component 5 종 `Web UI, Backend API, Worker, LLM Gateway, DB Persistence` — 24 행 허용 8 종 안, module 6 종 `WebModule, AssessmentModule, AuthModule, UserModule, LlmModule, PersistenceModule` — 25 행 허용 9 종 안, `(controller layer)` 류 괄호 수식 제거), 관련 REQ 는 `REQ-004` 단독 · status `DONE`. `## 4. References` 직전에 description 블록 1 개 신설 → `grep -c "^### UC-"` = **9**, UC-08 과 동일한 4 줄 구조 + `→ [UC-09-user-defined-period-evaluation.md](...)` 링크 마감 (`ls` 성공 — broken link 0).

**AC 3 (amendment)** — 48 행 T-1392 문단 다음에 `**2026-08-03 UC-09 row 등록 (T-1412)**` 2 줄 문단 1 개 추가 (기존 화법 승계). 4 사실 (룰 1 · 3 이행 / 21 · 40 행은 T-0019 시점 기록이라 보존하되 현재 총계 9 UC / closure 문단 4 값은 후속 slice 소관 / 축 A 의 `^| UC-` = 8 근거 해소) + REQ-004 단독 근거 (`adjacentReq` 9 종은 audit §4 104 행 subset 규칙상 미등재) 박제. `git diff --numstat docs/use-cases/INDEX.md` = **8 / 0** — 삭제 0 이므로 21 · 40 · 110 (현 118) · 114 행 무편집 증명.

**AC 4 (audit (e) pointer)** — 편집 후 `grep -n "uc-covered 48 / cross-cutting 4" docs/use-cases/INDEX.md` 단일 hit **118**, `sed -n "118p"` 가 4 값 문자열 포함 확인. §12.3 302 행 (e) 셀 지목을 `110 행` → **`118 행`** 1:1 치환 (`현재 값` 열 수치 문자열 무편집), 305 행 다음에 각주 1 줄 append. `grep -n "^| (e) |"` 결과 302 행에 `118 행` 포함 · `110 행` 미포함 (394 / 500 / 612 / 692 / 764 행의 §12.6 ~ §12.10 검증표 (e) 행은 `sed -n '115p'` 정합식 축이라 무관 · 무편집). audit `--numstat` = **2 / 1** — 삭제 1 (치환의 짝) · 추가 ≤ 2 충족. 각주는 blank line 없이 305 행 문단에 이어 붙여 추가 열을 2 로 묶었다.

**AC 5 (불변 검산)** — `grep -c "^| REQ-" REQ-COVERAGE-AUDIT.md` = **66** 불변, `grep -c "^## " REQ-COVERAGE-AUDIT.md` = **12** 불변, `wc -l docs/PLAN.md` = **175** 불변.

**AC 6 (R-110 / R-112 면제)** — 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항이 그대로 적용되어 tester 호출 (R-110) · R-112 4 항목 (happy / error / branch / negative) · `pnpm lint/build/test:cov` · PR 본문 관련 항목은 전부 **N/A** 다 (분기 없음, architect / tester dispatch 0).

**Out of Scope 준수** — audit §3 REQ-004 재분류 및 cascade (a) ~ (d) 수치, INDEX 118 행 closure 문단 4 값 · gap 서술, `docs/PLAN.md` 36 행, api.md / data-model.md pointer 는 **한 글자도 건드리지 않았다**. 본 fire 는 multi-task chain 의 두 번째 task (직전 T-1411) 로 commit footer 에 `FIRE-BATCH: T-1411+T-1412` marker 박제.
