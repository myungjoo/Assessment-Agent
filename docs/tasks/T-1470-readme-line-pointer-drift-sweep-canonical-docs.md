---
id: T-1470
title: README 행 번호 pointer drift 전수 census + 정본 2 파일 (CLAUDE.md · docs/requirements.md) pointer ↔ 실 README 행 대조 — `§ 12.67` 파생 영향 (1) 집행 (components.md 종료 후 첫 pointer 축) + audit §12.68
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1469]
touchesFiles:
  - docs/requirements.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1470-readme-line-pointer-drift-sweep-canonical-docs.md
plannerNote: "uc-doc-audit-resync 82 번째 slice — §12.67 FU(1) 집행. components.md 종료 후 첫 pointer 축, 정본 2 파일 한정 분할. doc-only 1.6x"
---

# T-1470 — README 행 번호 pointer drift 전수 census + 정본 2 파일 대조

## Why

[T-1469](T-1469-components-md-github-adapter-section-prose-audit.md) 가 `## GitHub Adapter` 절 산문 축을 닫으면서 **components.md 는 diagram 23/23 + 표 17/17 + 산문 1/1 로 전량 판정 종료** 됐다 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.67` 진척). 그 `§ 12.67` 파생 영향 **(1)** 은 다음 slice 1 순위로 **README 행 번호 pointer drift 전수 sweep** (`§ 12.65` FU9 = `§ 12.66` FU (2)) 을 근거 둘과 함께 지목했다 — **첫째** components.md 종료로 architecture 문서 축이 비었고 pointer 축은 **판정 대상이 자기 완결적** (pointer ↔ 대상 행 1:1) 이라 산문 축의 반증 불가 문제 (`§ 12.67` 한계 2 — claim 26 중 13 미판정) 가 구조적으로 없으며, **둘째** `§ 12.61` ~ `§ 12.67` 이 **7 회 연속** pointer 축 (ADR `§` 세분 · ADR-0004 번호 충돌) 에서 결함을 찾아 적중률이 실측으로 뒷받침되기 때문이다. planner 는 이 지목을 채택한다.

**단 "전수" 는 한 slice 에 담기지 않아 분할한다** — planner 사전 census 는 `docs/progress/` · `docs/tasks/` · audit 파일을 제외한 markdown 에서 README 행 번호 pointer 를 **약 57 지점 / 18 파일** 로 실측했고 (파일별: `docs/requirements.md` **12** · `docs/decisions/ADR-0001-stack.md` **7** · `CLAUDE.md` **7 ~ 8** · `docs/architecture/deployment.md` **6** · `ADR-0003` **5** · `ADR-0035` **4** · `UC-04` **3** · 나머지 11 파일 각 1 ~ 2), pointer 1 지점 판정에 **pointer 문맥 1 구 + 대상 README 행 1 구 + 판정** 이 필요해 판정표만 **80 행 이상** 이 된다. 이는 `§ 12.66` 이 **55** 행 · `§ 12.67` 이 **48** 행으로 지킨 **절 ≤ 100 행** 관행을 census + 방법론과 함께 담기에 초과다. 따라서 본 slice 는 **(a) 전수 census (계수까지만)** + **(b) 정본 2 파일 (`CLAUDE.md` · `docs/requirements.md`) 약 19 ~ 20 pointer 의 실판정** 으로 범위를 자른다. 이 2 파일을 먼저 고르는 이유는 **CLAUDE.md 는 agent 행동 규칙의 정본이고 `docs/requirements.md` 는 REQ ID 의 정본** 이라 pointer 가 어긋날 때의 파급 (규칙 오독 · REQ 오매핑) 이 가장 크고, 두 파일 모두 **README 를 유일한 상위 출처로 인용** 해 판정 기준이 단일하기 때문이다. T-1468 이 3 row 통합을, T-1467 이 1 row 분할을 각각 **축 수 실측** 으로 갈랐던 선례와 같은 판단 방식이다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **31** 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① **README 총 행 수 151** — pointer 가 이를 넘는 행을 가리키면 즉시 거짓 확정 (범위 밖 pointer). ② **CLAUDE.md `README 109행` (1 task = 1 commit)** — 실 **109** 행이 `한번에 많은 구현을 하지 않고 … (하나의 commit에는 하나의 주제)` 로 보여 **참 가능성이 크다**. ③ **CLAUDE.md `README 110–114행` (§3.2 R-110 ~ R-114)** — **110** 행 = 코드 검토 + test case, **111** = CI 자동 실행, **112** = unit test 3 종 + negative, **113** = smoke / e2e, **114** = commit 후 test + 종료 전 CI 로 **5 : 5 정합 참 가능성이 크다** (R-110 ~ R-114 개별 인용 5 지점도 같은 축). ④ **CLAUDE.md `README 116행` (round 7 · 이중 합의)** — **116** 행이 Reviewer / Committer 합의 + round 7 이라 **1 행에 2 규칙이 겹쳐 참** 으로 보인다. ⑤ **CLAUDE.md `README 117–128행` (reviewer 8 check)** — **117** 이 `Reviewer Agent는 다음의 항목을 검사하여야 한다` · **118** 이 코드블록 fence 이므로 **끝 좌표 128 이 fence 닫힘 / 마지막 check 중 어디인지** 가 쟁점 (부분참 후보). ⑥ **reviewer.md `README 128행` (PR comment 외화)** — 축 ⑤ 의 끝 좌표와 **같은 행을 다른 의미로** 인용하므로 두 pointer 가 동시에 참일 수 있는지 교차 검증이 필요하다 (단 reviewer.md 는 편집 대상 밖 — 판정만). ⑦ **`docs/requirements.md` 의 12 pointer (README **4 ~ 9** · **9** · **19~22** · **21** · **25** · **30** · **31** · **34** · **37** · **92** · **108** 등)** — REQ 본문이 인용한 어구와 실 README 행의 어구가 **1:1 대응하는지** 가 축이며, 범위 표기 (`4~9` · `19~22`) 는 **시작 · 끝 두 좌표를 각각** 판정한다. ⑧ **pointer 표기 형식의 비일관** — `README 109행` · `README 110–114행` (en dash) · `README 4~9 행` (tilde + 공백) 이 혼재하면 **기계 검증 불가** 가 구조적 결함이며, 표기 정본이 어디에도 없다는 사실 자체를 축으로 기록한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `README.md` — **151 행. 무편집, read-only**. **판정 기준 원본** 이므로 통독을 허용하되, 인용은 **판정에 쓰인 행만 1 구씩** (audit 절 길이 보호).
- `CLAUDE.md` — **465 행. 무편집** (본 slice 는 CLAUDE.md 를 **판정 대상으로만** 삼고 편집하지 않는다). pointer 가 있는 행 (**114 · 127 · 147 · 184 · 188 · 221 · 251 · 355** 부근 — AC 1 (i) 에서 재실측) **각 1 구 인용까지만**. 그 밖 구간은 열지 않는다.
- `docs/requirements.md` — **97 행**. README pointer 를 담은 행 (**1 · 3 · 7 · 12 · 16 · 18 · 20 · 23 · 28 · 30 · 33 · 34 · 36 ~ 39 · 49 · 50 · 55 · 62 · 66 · 67 · 75 · 91** 중 행 번호 pointer 를 실제로 가진 것 — AC 1 (i) 에서 선별) 과 **파일 말미** (각주 삽입점). 본 slice 의 **유일한 편집 대상 원문 파일**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6276 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.67`** (파생 영향 **(1)** 원문 = 본 slice 지목 근거 + 절 ≤ 100 행 압축 단서 + stale 계수 규칙) · **`## 11. References`** 직전 좌표 (`§ 12.68` 삽입 위치 경계). **`§ 12.44` ~ `§ 12.66` 본문은 열지 않는다** (§7 context 절약).
- `.claude/agents/reviewer.md` — **무편집, 읽기만**. `README 128행` 인용 **2 지점 1 구까지만** (축 ⑥ 교차 검증).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.68` 에 **명령과 출력 (또는 요약 수치) 을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑧ 은 가설일 뿐이다).
  - (i) **전수 census**: `grep -rn` 으로 markdown 전역 (단 `docs/progress/` · `docs/tasks/` · `REQ-COVERAGE-AUDIT.md` **제외** — 로그 · 자기 참조라 정본이 아니다) 의 README 행 번호 pointer 를 수집해 **총 지점 수 · 파일 수 · 파일별 계수** 를 보고한다. planner 사전 census (**약 57 지점 / 18 파일**) 와 **다르면 실측값을 채택** 하고 차이 사유를 1 구로 적는다. 함께 `wc -l README.md` (**151** 기대) · `wc -l CLAUDE.md docs/requirements.md` 를 실측한다.
  - (ii) **판정 대상 확정**: census 중 **`CLAUDE.md` + `docs/requirements.md`** 의 pointer 만 뽑아 **번호를 붙인 목록** 으로 만든다 (기대 **19 ~ 20** 지점). 각 항목은 `파일:행 → 주장하는 README 좌표 → 인용 어구 요약` 3 요소로 적는다.
  - (iii) **대상 행 대조**: (ii) 의 각 pointer 에 대해 `sed -n '<N>p' README.md` 로 실 README 행을 뽑아 **주장 어구와 실 행 내용이 대응하는지** 를 판정한다. 범위 표기 (`A–B` · `A~B`) 는 **시작 · 끝 두 좌표를 각각** 확인하고, 끝 좌표가 코드블록 fence · 빈 줄 · 다음 절 heading 이면 그 사실을 명시한다.
  - (iv) **교차 검증**: 서로 다른 문서가 **같은 README 행을 다른 의미로** 인용하는 지점을 식별해 계수한다 (축 ⑤ ↔ ⑥). 편집 대상 밖 파일 (`reviewer.md` 등) 의 pointer 는 **판정만 하고 목록에 남긴다**.
  - (v) **표기 형식 계수**: pointer 표기 변종 (`NNN행` · `NNN 행` · `A–B행` · `A~B 행` · `NNN 번째 줄` 등) 을 **형식별로 계수** 하고, 기계 검증 (단일 정규식) 으로 전수 포착이 가능한지 판단한다 (축 ⑧).
  - (vi) **좌표 stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.67` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (T-1462 ~ T-1469 가 **10 회 연속 stale 0**).
- [ ] **AC 2 — pointer 별 판정 (참 / 부분참 / 거짓)**: AC 1 (ii) 의 **전 pointer** 를 판정표 (번호 · 출처 `파일:행` · 주장 좌표 · 실 README 행 요약 · 판정 · 근거 1 구) 로 정리한다. **거짓 · 부분참 판정에는 반드시 실 README 행 인용** 을 붙인다. **참 판정도 생략하지 않는다** (drift 0 이라는 사실도 측정 결과다). 판정 대상 밖 (census 만 한 16 파일 · `reviewer.md`) 은 **재판정 금지 — 목록 이월**.
- [ ] **AC 3 — pointer 축 vs 산문 · 표 축의 판정 방법론 차이 기록**: 본 slice 가 **첫 pointer 전수 축** 이므로 (a) pointer 1 지점 판정의 고정비 (명령 수 · 인용 행 수) · (b) `§ 12.67` 산문 축의 **미판정 50.0%** 대비 본 축의 **판정 가능 비율** · (c) 표 축 (`§ 12.61` ~ `§ 12.66`) 의 `row N : 실 결선 N : 실 호출 지점 N` 다중 표기가 pointer 축에 적용 가능한지 를 **수치로** 적는다. 불가하면 **대체 다중 표기 형식** (예: `pointer N : 대상 행 N : 정합 N : 어긋남 N`) 을 정의하고 근거를 남긴다.
- [ ] **AC 4 — `docs/requirements.md` 각주 반영**: `docs/requirements.md` **파일 말미** 에 빈 줄 1 행 + blockquote 를 **추가만** 한다 (`§ 12.15` append-only). 각주는 **≤ 6 행** 이며 본 파일 소관 pointer 의 판정 요약 (총 수 · 참 / 부분참 / 거짓 계수 · `§ 12.68` pointer) 까지만 담는다. **REQ 본문 · REQ ID · 기존 pointer 표기는 무편집** — 어긋난 pointer 를 발견해도 **in-place 정정 금지** (별도 pointer 정정 batch 후보로만 남긴다). **`CLAUDE.md` 는 어떤 이유로도 편집하지 않는다** (운영 규칙 정본 — 판정 대상일 뿐이며, 그 pointer 정정은 별도 direct task 소관).
- [ ] **AC 5 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.68`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.67` FU (1) 승계 + 분할 사유 명시) → AC 1 실측 (census 포함) → AC 2 판정표 → AC 3 방법론 차이 → 다중 표기 수치 → 진척 (**pointer 축 = 정본 2 파일 완료 / 전체 N 중 M**) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행** — 초과 조짐이 보이면 실측 인용을 요약형 (명령 + 수치만, 출력 전문 생략) 으로 압축한다 (`§ 12.66` 55 행 · `§ 12.67` 48 행 성공 방식 승계).
- [ ] **AC 6 — 다음 slice 지목**: 파생 영향 **(1)** 에 **pointer 축 잔여 (census 로 확정된 나머지 파일군)** 의 다음 batch 를 근거와 함께 지목한다. 남은 pointer 를 **어떻게 묶을지** (파일 밀도 순 · 문서 종류별 · ADR 군 일괄 등) 를 실측 계수로 제안하고 1 순위 후보와 이유를 1 ~ 2 구로 적는다. 아울러 `§ 12.67` FU (2) ~ (9) 중 편집 가능한 항목을 우선순위 목록으로 승계한다. **본 slice 에서 그 작업을 착수하지 않는다** (목록만).
- [ ] **AC 7 — 검증 명령**: `wc -l docs/requirements.md docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고, `git diff --stat` 이 **≤ 3 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`CLAUDE.md` · `README.md` 가 변경 목록에 없음** 을 명시적으로 검산한다. doc-only 변경이므로 `pnpm test` 는 불요 (CLAUDE.md §3.2 direct doc-only 면제) — 단 markdown 문법 무손상을 `grep -c '^## '` (requirements.md 불변) 과 audit 파일의 ` ``` ` fence 짝수 개로 확인한다.

## Out of Scope

- **pointer in-place 정정 금지** — 거짓 pointer 를 확정하더라도 숫자를 고치지 않는다 (`§ 12.15` append-only + **pointer 정정 batch** 후보로만 이월).
- **`CLAUDE.md` 편집 금지** — 판정 대상일 뿐이다. §3.1 상 direct 가능 파일이지만 운영 규칙 정본이라 본 doc stream 이 건드리지 않는다.
- **`README.md` 편집 금지** — 요구사항 정본 (CLAUDE.md §1 "불변에 가까움").
- **정본 2 파일 밖 pointer 의 판정 금지** — census 계수까지만 (ADR 군 · `deployment.md` · `UC-04` 등은 다음 batch 소관).
- **components.md · edge · row · 산문 축 재판정 금지** (`§ 12.60` · `§ 12.66` · `§ 12.67` 이 마감).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 근거 보강 기록까지만.
- **ADR 신설 · 새 dependency 도입 금지** (CLAUDE.md §5 게이트).
- **secret · token · API key 실값 인용 금지** (CLAUDE.md §9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 (CLAUDE.md §3.2 direct doc-only 면제).

## 결과 (executor 기록)

- **AC 1 ~ AC 7 전량 충족**. 산출물: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) **`§ 12.68`** 신설 (`## 11. References` 직전 · **64 행** = 상한 100 이내) + [requirements.md](../requirements.md) 파일 말미 각주 blockquote **5 행** (append-only).
- **census 실측** — README 행 번호 pointer **raw token 63 / 11 파일** (정규식 1 개), 중복 · 연속 토큰 보정 후 **distinct 126 지점** (산문 60 + `requirements.md` 표 컬럼 66). planner 사전 census (**57 지점 / 18 파일**) 는 파일 수 과대 (`UC-04` · `LOOP.md` 실측 pointer 0) · 지점 수 과소 (`CLAUDE.md` 7~8 → **13**, `requirements.md` 12 → 산문 **13** + 표 **66**) 로 **양방향 정정**. `wc -l` README **151** (기대 일치) · `CLAUDE.md` **465** · `requirements.md` **97** · audit **6276**.
- **판정** — 정본 2 파일 산문 pointer **26 지점 전수** = **참 24 · 부분참 2 · 거짓 0** (대조 좌표 34). 부분참 2 는 모두 **범위 표기의 끝 좌표** — `requirements.md:20` 의 `136~139` (139 = 빈 줄, `pnpm install` 은 140 행) · `requirements.md:39` 의 `19~22` (주제 일치는 20 단독, 19 · 22 는 빈 줄). 단일 좌표 20 지점은 어긋남 **0**.
- **축 ⑧ 확정** — 표기 **10 변종** 이며 census 정규식 포착률 **24/92 = 26.1%**, 미포착 68 은 전부 README 앵커가 같은 토큰에 없는 형태 (연속 토큰 2 · 표 컬럼 66) → **단일 정규식 전수 포착 불가**.
- **교차 검증** — 2+ 파일이 같은 좌표를 인용한 지점 **10**, 그중 다른 의미 인용 **2** (README **128** = 범위 끝 ↔ 8 번째 check 본문 / **19~22** = 자기 주장 ↔ 옛 번호 잔재 인용), 의미 상충으로 동시 참 불가한 지점 **0**.
- **stale 2 지점** — 본 task Required Reading 이 기재한 `CLAUDE.md` pointer 행 **127 · 188** 이 실측 (127 에 pointer 없음 · 188 이 아니라 **186**) 과 어긋나 T-1462 ~ T-1469 의 **10 회 연속 stale 0 기록이 중단**. 삽입 파급은 **0 지점** (말미 append + References 직전 삽입).
- **무편집 검산** — `git status --short` 에 `CLAUDE.md` · `README.md` · `.claude/agents/reviewer.md` **부재**. `git diff --stat` **3 파일** · doc-only 라 `pnpm` 실행 **0** ([CLAUDE.md](../../CLAUDE.md) §3.2 면제). `grep -c '^## '` requirements.md **4 불변** · audit fence **164** (짝수).

## Follow-ups

- **pointer 정정 batch (신설 후보)** — 본 slice 가 확정한 부분참 **2** 건의 in-place 정정: `docs/requirements.md` **20 행** `136~139 행` → `136~140 행`, **39 행** `19~22 행` → `20 행`. `§ 12.15` append-only 때문에 본 slice 는 정정하지 않았다.
- **본 task 파일 Required Reading 좌표 stale 2** — `CLAUDE.md` pointer 행 기재값 **127 · 188** 은 실측 **149 · 186** 계열의 오기다 (실측 전체: 114 · 147 · 149 · 151 · 156 · 160 · 171 · 176 · 184 · 186 · 221 · 251 · 355). 완료된 task 파일이라 본 항목 기록까지만 하고 frontmatter · 본문 좌표는 고치지 않는다.
- **`CLAUDE.md` §1 pointer 부정확 (`§ 12.67` FU11) 의 대상 축소** — 본 slice 가 §3.2 · §3.3 · §4 · §10 의 README pointer **13/13 참** 을 확인했으므로, FU11 의 잔여 대상은 **§1 (기술 스택 표) 의 비-README pointer** 로 좁혀진다.
- **다음 batch 지목** — ADR 군 일괄 (6 파일 **27** token = 잔여 산문 34 의 **79.4%**) 이 1 순위, `requirements.md` 표 컬럼 **66** 지점 전수 어구 대조 (33 × 2 분할) 가 2 순위. 상세는 `§ 12.68` AC 6 참조.
