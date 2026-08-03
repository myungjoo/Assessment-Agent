---
id: T-1413
title: REQ-COVERAGE-AUDIT §3 REQ-004 row gap → uc-covered 재분류 + cascade (a) ~ (d) 원자 실행
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-08-03
independentStream: uc-doc-audit-resync
dependsOn: [T-1412]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1413-req004-gap-to-uc-covered-reclassification.md
plannerNote: "uc-doc-audit-resync 25 번째 slice — T-1412 Follow-up 1 (의존 최전방). PLAN 미완 bullet (P7 성능·P8 부하·live-LLM) 은 ADR-0054 PROPOSED / credential 게이트라 본 doc stream 우선. doc-only enumerated-section × 1.6"
---

# T-1413 — REQ-COVERAGE-AUDIT §3 REQ-004 row `gap` → `uc-covered` 재분류 + cascade (a) ~ (d) 원자 실행

## Why

[T-1411](T-1411-uc-09-user-defined-period-evaluation.md) 이 `docs/use-cases/UC-09-user-defined-period-evaluation.md` (174 행, `coversReq: [REQ-004]`) 를 박제하고 [T-1412](T-1412-index-uc09-row-registration.md) 가 [INDEX.md](../use-cases/INDEX.md) §2 표 · §3 description 에 UC-09 를 등록해, [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) §9.1 이 `gap` 유지의 근거로 삼았던 3 축 (**(a) UC-09 파일 실재 0 · (b) `coversReq` 포함 UC 0 / 8 · (c) 본문 언급 0**) 이 **전부 뒤집혔다**. §12.2 의 분류 변경 임계 ("근거 3 종 중 2 종 이상 어긋날 때만 분류값을 바꾼다") 를 3 / 3 으로 초과하므로, §3 38 행 REQ-004 row 의 `gap` → `uc-covered` 재분류가 이제 규약상 **강제** 된다.

본 slice 는 T-1412 Follow-up 1 = T-1411 Follow-up 2 의 이월분이며 **의존 순서상 최전방** 이다 — [§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 의 **원자 묶음** 규약이 cascade (a) ~ (d) 를 한 slice 안에서 함께 갱신하라고 못박았고 ((a) ~ (d) 는 같은 파일 안의 상호 정합식이라 분리하면 중간 commit 이 `합 ≠ 66` 자기모순으로 main 에 남는다), (e) INDEX.md 118 행 · (f) PLAN.md 36 행 은 같은 규약이 **분리 허용** 으로 남긴 후속 slice 소관이다.

[PLAN.md](../PLAN.md) 의 미완 bullet (140 ~ 142 행 P7 성능 검증 · 151 행 P8 부하·내성 · 108 · 109 행 live-LLM) 은 각각 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) PROPOSED 대기 · 새 dependency · 외부 credential 게이트라 planner 단독 진행이 불가하므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **38 행** (§3 REQ-004 row — 5 컬럼 `REQ-004 | FR | gap | — | …`, cascade (a) 대상), **106 ~ 117 행** (§4 8 UC bullet + 115 행 정합식 `33 + 15 + 4 + 13 + 1 = 66` + 117 행 envelope 잔차 blockquote), **121 ~ 127 행** (§5 통계표 4 row + 합계 row), **169 ~ 176 행** (§9.1 축 (a) (b) (c) — 본 slice 가 재실측으로 뒤집을 3 축의 원문), **188 행** (§9.4 `gap` 유지 판정 — 시점 기록, 무편집), **278 ~ 290 행** (§12.2 근거 3 종 (i) (ii) (iii) 표 + 분류 변경 임계 2 / 3), **292 ~ 313 행** (§12.3 cascade 6 지점 표 + T-1412 각주 + §12.4 원자 묶음 / 분리 허용), **329 행** (§12.6 blockquote — 신규 `###` 절의 **삽입 위치 규약**: §12.x 마지막 행 뒤 · `## 11. References` 앞, `## ` heading count 불변), **721 ~ 740 행** (§12.10 축 A ~ D — 본 slice 가 해소하는 "미착수" 판정의 직전 시점 기록).
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` — 1 ~ 11 행 frontmatter (`coversReq: [REQ-004]` · `adjacentReq` 9 종 · `relatedUc: [UC-01, UC-02]` — §4 신규 bullet 의 유일한 source), `## 1. 개요` 첫 문단 (bullet 의 괄호 설명 어구 source).
- `docs/use-cases/INDEX.md` — 38 ~ 39 행 (T-1412 가 등록한 UC-09 row — 총 9 UC 실증), 118 행 (closure 문단 — 본 slice **무편집**, cascade (e) 후속 slice 소관).
- `docs/tasks/T-1412-index-uc09-row-registration.md` — 94 ~ 97 행 (Follow-ups 4 건 — 본 slice 는 1 번, 나머지 3 건은 후속).

## Acceptance Criteria

### 1. 근거 3 종 재실측 (판정의 입력)

- [ ] §9.1 축 3 개를 명령으로 재실측하고 출력을 §12.11 에 그대로 박제:
  - (a) `ls docs/use-cases/UC-09*.md` → **1 파일** (2026-08-02 시점 0).
  - (b) `grep -n "^coversReq" docs/use-cases/UC-*.md` → **9 배열 중 1 개** (`UC-09` 7 행) 가 `REQ-004` 포함 (시점 0 / 8).
  - (c) `grep -c "REQ-004" docs/use-cases/UC-*.md` → UC-01 ~ UC-08 **각 0** · UC-09 **N ≥ 1** (실측값 그대로 기재).
- [ ] §12.2 근거 3 종 frame ((i) frontmatter · (ii) 본문 hit · (iii) requirements.md 원문 + cover 위치 셀) 으로 환산해 **어긋남 3 / 3** → 임계 (2 / 3) 초과로 **분류 변경 확정** 을 1 줄 명시. (iii) 은 `docs/requirements.md` 23 행 REQ-004 원문 (kind = FR) 을 read 로 확인만 하고 **편집하지 않는다**.

### 2. cascade (a) — §3 38 행 REQ-004 row 재분류 (in-place)

- [ ] 38 행 `cover 방식` 셀 `gap` → **`uc-covered`**, `cover 위치` 셀 `—` → **`UC-09`**.
- [ ] `참고` 셀은 **기존 문자열 보존 + 뒤에 첨가** (append-only 화법) — `; 2026-08-03 재분류 (T-1413): UC-09 신설로 uc-covered — 근거 §12.11` 형태. 기존 `§6 follow-up · 2026-08-02 재판정: §9 참조` 문구는 지우지 않는다.
- [ ] `|` 필드 수가 헤더 · 인접 행과 동일 (5 컬럼) — `grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` = **66** 불변.
- [ ] 검산: `grep -n "^| REQ-004 |" docs/use-cases/REQ-COVERAGE-AUDIT.md` 출력에 `uc-covered` · `UC-09` 포함, `| gap |` **미포함**.

### 3. cascade (b) — §4 에 UC-09 bullet 1 행 추가

- [ ] 113 행 (UC-08 bullet) 다음에 UC-09 bullet **1 행** 삽입 → §4 bullet **9 줄**. 기존 8 줄 화법 승계 — `- **UC-09** (사용자 지정 기간 임의 평가문) — coversReq: REQ-004. adjacent: …` 형태이며 나열 값은 **UC-09 frontmatter 에서만** 옮겨 적는다 (날조 0, `envelope-cover` label 은 UC-09 에 근거가 없으므로 붙이지 않는다).
- [ ] 기존 8 bullet (106 ~ 113 행) 본문은 **무편집** — UC-09 추가가 다른 UC 의 coversReq / adjacent 나열을 바꾸지 않는다.

### 4. cascade (c) — §4 정합식 + union 수치 (in-place, 편집 전 115 행)

- [ ] `8 UC 의 coversReq union: 33 REQ` → **`9 UC 의 coversReq union: 34 REQ`** (UC-09 가 REQ-004 1 건을 새로 union 에 추가).
- [ ] `envelope 잔차 15 REQ 포함 시 uc-covered 48 REQ` → **`… uc-covered 49 REQ`** (34 + 15 = 49 — envelope 잔차 **15 는 무변**).
- [ ] 합산식 `33 + 15 + 4 cross-cutting + 13 infrastructure + 1 gap = 66` → **`34 + 15 + 4 cross-cutting + 13 infrastructure + 0 gap = 66`** (역산 일치 유지).
- [ ] **117 행 blockquote (envelope 잔차 15 vs bullet 13 차이 2 건 서술) 는 무편집** — §12.7 384 행이 "(c) 의 `15` 항이 움직일 때만 부속으로 stale" 이라 규정했고 본 slice 는 `15` 항 무변.

### 5. cascade (d) — §5 통계표 (in-place, 편집 전 121 ~ 127 행)

- [ ] `uc-covered` row: count **48 → 49**, percentage **73 % → 74 %** (49 / 66 = 74.2 반올림), 비고 셀의 `33 REQ 가 1+ UC 의 coversReq 직접 명시` → **`34 REQ …`**.
- [ ] `gap` row: count **1 → 0**, percentage **2 % → 0 %**, 비고 셀은 기존 문자열 보존 + `· 2026-08-03 재분류 (T-1413): UC-09 신설로 uc-covered 전이 — §12.11` 첨가. **row 자체는 삭제하지 않는다** (삭제 시 행 이동 + 시점 근거 소실).
- [ ] `cross-cutting` 4 (6 %) · `infrastructure` 13 (20 %) row 는 **무편집**, 합계 row `**66**` · `**100 %**` 도 **무편집** (row 수 불변).
- [ ] percentage 합 검산: 74 + 6 + 20 + 0 = **100** — 이 산술을 §12.11 에 1 줄 박제.

### 6. §12.3 표 (b) · (c) · (d) 셀 동기 + 각주 1 줄

- [ ] 편집 후 실제 행 번호를 재측정 (`grep -n "coversReq union" docs/use-cases/REQ-COVERAGE-AUDIT.md` 등) 하고 §12.3 표를 1:1 치환 — (b) `§4 106 ~ 113 행 8 UC bullet` → **`106 ~ 114 행 9 UC bullet`** · 나열 설명 `8 줄` → `9 줄`, (c) `§4 115 행` → **`116 행`** + `현재 값` 열 `33 + 15 + 4 + 13 + 1 = 66` → **`34 + 15 + 4 + 13 + 0 = 66`**, (d) `§5 121 ~ 127 행` → **`122 ~ 128 행`** + `현재 값` 열 `48 / 4 / 13 / 1` · `73 / 6 / 20 / 2 %` → **`49 / 4 / 13 / 0` · `74 / 6 / 20 / 0 %`**.
- [ ] **(a) · (e) · (f) row 는 무편집** — (a) 는 행 pointer 가 없고, (e) INDEX.md 118 행 · (f) PLAN.md 36 행 의 `현재 값` 은 **아직 옛 수치가 실제** 이므로 후속 slice 가 옮겨 적을 때까지 보존한다.
- [ ] T-1412 각주 (§12.3 표 아래) 다음 줄에 각주 **1 줄** append — `2026-08-03 (T-1413): §4 에 UC-09 bullet 1 행 삽입으로 편집 전 114 행 이하가 +1 (본 각주 이후 구간은 +2) 이동 — (b) · (c) · (d) 셀의 행 pointer 와 현재 값을 동기했다. §9 · §10 · §12.6 ~ §12.10 본문의 `115 행` · `121 ~ 127 행` · `L212` 등 옛 행 표기는 시점 기록이라 append-only 규약대로 보존.` (T-1412 각주 화법 승계, blank line 없이 이어 붙여 추가 열 최소화).

### 7. §12.11 실판정 절 신설

- [ ] `## 11. References` **바로 앞** (= §12.10 마지막 행 뒤) 에 `### 12.11 REQ-004 `gap` → `uc-covered` 실판정 + cascade (a) ~ (d) 원자 실행 (T-1413)` 절 추가. `###` 이므로 `grep -c "^## " docs/use-cases/REQ-COVERAGE-AUDIT.md` = **12** 불변.
- [ ] 절 구성은 §12.6 ~ §12.10 화법 승계 — (i) 서두 blockquote (본 절의 소관 · 삽입 위치 규약 명시), (ii) **실측 명령 + 출력 블록** (AC 1 의 3 축), (iii) **판정** (어긋남 3 / 3 → 임계 초과 → `gap` → `uc-covered`), (iv) **cascade 실행 기록** (a) ~ (d) 각 1 줄 + (e) · (f) 는 §12.4 분리 허용대로 후속 slice 로 명시 이월, (v) **hunk 국한 검증** (`git diff -U0 | grep '^@@'` + `git diff --numstat` 출력 박제), (vi) **한계** 4 항 이내.
- [ ] 한계 절에 최소 3 항: ① (e) · (f) 미동기 lag 이 §12.4 가 명시 허용한 것이라는 사실, ② §1 18 행 · §8 160 ~ 161 행 · §9.4 188 행 의 옛 `gap 1 건` 요약 문장은 **시점 기록이라 무편집** (§12.3 표 아래 규약 그대로), ③ 재판정 후보 밖 49 row 는 여전히 미재판정 (§12.9 한계 4 존속).
- [ ] §12.10 축 A 가 남긴 "권장 (a) UC-09 신설 미착수 (0 / 1)" 판정이 본 slice 시점에 **해소** 됐다는 사실을 1 줄 기재 (해당 §12.10 본문은 **무편집** — 시점 기록).

### 8. 불변 검산 (인접 문서 무편집 증명)

- [ ] `git status --porcelain` 의 변경 파일이 정확히 **2 개** — `docs/use-cases/REQ-COVERAGE-AUDIT.md` + 본 task 파일 (driver 가 같은 commit 에 얹는 `docs/STATE.json` · journal 은 본 계산 제외).
- [ ] `docs/use-cases/INDEX.md` · `docs/PLAN.md` · `docs/requirements.md` · `docs/use-cases/UC-01-evaluation-execution.md` ~ `UC-09-user-defined-period-evaluation.md` · `docs/architecture/api.md` · `docs/architecture/data-model.md` 모두 `git status --porcelain` **미등장**.
- [ ] `wc -l docs/PLAN.md` = **175** 불변 · `wc -l docs/use-cases/INDEX.md` = **122** 불변.
- [ ] `git diff --numstat` 합계를 완료 기록에 박제하고 [CLAUDE.md](../../CLAUDE.md) §3 상한 (≤ 300 LOC / ≤ 5 파일) 안임을 명시. audit 파일의 **삭제 열 ≤ 8** (모두 in-place 치환의 짝 — 순수 삭제 0) 임을 확인.

### 9. R-110 / R-112 (direct doc-only)

- [ ] 본 task 는 `commitMode: direct` + production code **0 LOC** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 의 "direct-mode doc-only commit 만 본 규칙 면제" 조항으로 R-110 tester 호출 · R-112 4 항목 (happy / error / branch / negative) · `pnpm test:cov` 가 전부 **N/A** (분기 없음). 이 사실을 완료 기록에 1 줄 명시.

## Out of Scope

- **cascade (e) `docs/use-cases/INDEX.md` 118 행 closure 문단** (4 값 + `gap 1 (REQ-004 — … UC-09 신설 또는 UC-01 확장 권장)` 서술) 과 **cascade (f) `docs/PLAN.md` 36 행** — [§12.4](../use-cases/REQ-COVERAGE-AUDIT.md) 가 **분리 허용** 으로 명시한 지점. 본 slice 는 두 파일을 **한 글자도 건드리지 않는다**.
- **`docs/architecture/api.md` 211 행 · `data-model.md` 168 행 의 "UC-09 신설 또는 UC-01 확장 후 추가 예정" pointer 동기** — T-1411 Follow-up 3 이월분, 별도 slice.
- **§1 18 행 · §8 160 ~ 161 행 · §9 · §10 · §12.6 ~ §12.10 본문 편집 일체** — 각 시점의 요약·판정 서술은 append-only 보존 대상 (§12.3 표 아래 규약: "§9.4 · §10 의 이전 요약 문장은 cascade 갱신 대상이 아니다"). 옛 행 번호 표기 (`115 행` · `121 ~ 127 행` · `L212` · `124 행`) 도 시점 기록이라 정정하지 않는다.
- **§4 117 행 envelope blockquote 편집** — (c) 의 `15` 항 무변이라 부속 stale 이 발생하지 않는다 (§12.7 384 행).
- **audit frontmatter (`auditDate: 2026-05-25`) 변경** — 최초 audit 시점 기록.
- **재판정 후보 17 row (cross-cutting 4 + infrastructure 13) 또는 다른 `uc-covered` row 의 분류 재검토** — 본 slice 는 REQ-004 **1 row** 만 판정한다.
- **UC-09 / UC-01 본문 편집** · **requirements.md 23 행 REQ-004 상태 (`IN_PROGRESS`) 변경** · `src/` · `web/` · `test/` · CI · package.json 등 코드 계열 변경 일체.

## Suggested Sub-agents

`implementer` (신규 ADR 불요 — 판정 기준은 §12.2 임계, 갱신 대상은 §12.3 표, 순서·원자성은 §12.4 가 이미 확정. direct doc-only 라 tester 호출 면제 — §3.2. implementer 가 3 축 재실측 → (a) ~ (d) 원자 편집 → 행 번호 재측정 → §12.3 (b) (c) (d) 셀 동기 + 각주 → §12.11 절 작성 → AC 8 불변 검산 명령 실행까지 담당)

## Follow-ups

_(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 append)_
