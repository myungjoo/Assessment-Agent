---
id: T-1475
title: pointer 정정 batch S1 실집행 — ADR 군 11 건 (`ADR-0003` 8 · `ADR-0001` 2 · `ADR-0002` 1) 을 8 행 in-place 정정 + 규칙 C 병기 화법 확정 + audit §12.73
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1474]
touchesFiles:
  - docs/decisions/ADR-0001-stack.md
  - docs/decisions/ADR-0002-db.md
  - docs/decisions/ADR-0003-deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1475-pointer-correction-s1-adr-group-8-lines.md
plannerNote: "uc-doc-audit-resync 87 번째 slice — §12.72 AC 4 의 1 순위 S1 실집행. 정정 축 최초 착수 (14 건 중 11). 파일 5 = cap 정확 상한"
---

# T-1475 — pointer 정정 S1: ADR 군 11 건 · 8 행 in-place 정정

## Why

[T-1474](T-1474-pointer-correction-batch-policy-and-14-target-list.md) 가 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.72` 로 pointer 정정 batch 의 **착수 게이트를 열었다** — 부분참 **14 건 목록 실측** · **3 분류 규칙** ((I) 12 / (II) 2 / (III) 0) · **commit mode 전량 `direct`** 판정 · **2 slice 분해안** 이 확정됐고, 그 **1 순위로 S1 (ADR 군)** 을 지목했다. 본 slice 는 그 S1 을 **실집행** 한다 — 87 개 slice 동안 이어진 "측정" 이 처음으로 **"정정"** 으로 전환되는 지점이다.

S1 이 1 순위인 근거는 `§ 12.72` AC 4 그대로다 — ADR 군이 **11/14 = 78.6%** 를 차지해 한 slice 로 정정 재고 대부분을 소화하고, **규칙 C 병기 2 건 (#7 · #12)** 도 전부 여기 있어 **병기 화법 (각주 vs 인라인 괄호) 을 본 slice 가 처음 정하면** S2 가 기계적으로 따를 수 있다. `§ 12.72` 한계 2 가 이 화법을 "S1 이 첫 사례로 정한다" 로 명시 이월했다.

**파일 수가 정확히 cap 상한 (5)** 이다 — `ADR-0003` · `ADR-0001` · `ADR-0002` 3 + audit 절 1 + 본 task 1. **대상 파일을 단 1 개도 추가하지 않는다** (`requirements.md` · `directory.md` 는 S2 소관). `§ 12.72` 한계 1 이 "실 대응 좌표는 판정표 **승계** 값이고 본 절은 대상 파일 · README 를 재대조하지 않았다" 고 못박았으므로, 본 slice 는 **편집 직전 1 회 재대조** 를 AC 1 로 의무화한다 — 재대조 없이 승계값을 그대로 쓰면 판정 오류가 정본에 박제된다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6662 행 (실측 확인)**. 다음 좌표만 연다.
  - **`### 12.72`** (**6565 ~ 6647 행**) — 본 slice 의 **입력 정본**. 14 건 목록표 (6582 ~ 6597) · 3 분류 규칙 (6607 ~ 6614) · commit mode 표 (6620 ~ 6626) · 분해안 표 (6634 ~ 6639) · 한계 (6645) 를 읽는다. **본 절은 무편집** — 승계만 한다.
  - **`## 11. References`** 직전 좌표 (**6649 행** — `§ 12.73` 삽입 위치 경계, AC 4 에서 재실측).
  - **`§ 12.15`** (1002 행) 및 **`§ 12.44` ~ `§ 12.71` 본문은 열지 않는다** — 방침은 `§ 12.72` 가 이미 요약 승계했다.
- `docs/decisions/ADR-0003-deployment.md` (**173 행**) — 편집 대상 **5 행**: **20 · 21 · 22 · 23 · 168**.
- `docs/decisions/ADR-0001-stack.md` (**146 행**) — 편집 대상 **2 행**: **20 · 138**.
- `docs/decisions/ADR-0002-db.md` (**127 행**) — 편집 대상 **1 행**: **119**.
- `README.md` — **무편집. 재대조 입력**. 전체 열람 금지 — 대조가 필요한 좌표 **15 ~ 18 · 20 · 31 · 34 · 54 ~ 64 · 72 ~ 73 · 88 ~ 92** 구간만 `sed -n` / `grep -n` 으로 확보한다.
- `CLAUDE.md` — **무편집**. §3 (크기 상한) · §7 (context 절약) · §9 · §12 (언어) 준수. §3.1 표는 `§ 12.72` AC 3 이 이미 `direct` 로 판정했으므로 재해석 불요.

## Acceptance Criteria

- [x] **AC 1 — 편집 직전 좌표 1 회 재대조 (`§ 12.72` 한계 1 이행 · 날조 금지)**: 8 개 편집 행 각각에 대해 **(a) 대상 ADR 행의 현재 주장 좌표** 와 **(b) README 실 대응 구간** 을 `sed -n '<범위>p' README.md` 로 직접 확인한다. 사용한 명령을 그대로 적는다. 대조 대상 6 쌍 — `7–17` → **15–18** (REQ-005~007) · `19–22` → **20** (REQ-020) · `33–41` → **31 + 34 불연속** (REQ-016) · `71–74` → **72–73** (REQ-039/040) · `88–93` → **88–92** (성능 특성) · `55–64` → **54–64** (저장 정책). **승계값과 재대조 결과가 다르면 재대조 결과를 채택** 하고 차이를 1 구로 박제한다 (`§ 12.72` 승계값은 전제가 아니다). 재대조 결과 **정정 불요** 로 뒤집히는 건이 있으면 그 건은 **무편집** 으로 남기고 사유를 적는다.
- [x] **AC 2 — 규칙 C 병기 화법 확정 (본 slice 최초 판정)**: `§ 12.72` 규칙 C 대상 **2 건** (#7 `ADR-0003`:21 · #12 `ADR-0003`:168 의 `33–41` 성분 — 대응 34 와 정본 31 이 불연속) 의 표기 화법을 **각주 vs 인라인 괄호 병기** 중 하나로 확정한다. 판정 근거는 **(a) 해당 행이 표가 아닌 산문 bullet 이라는 형식 제약**, **(b) `§ 12.72` 규칙 C 문언 ("원 범위 보존 + 정확 좌표 병기")**, **(c) 같은 파일 안 다른 pointer 와의 표기 일관성** 3 개로 하고 각 1 구씩 적는다. 확정한 화법의 **실제 문자열 형태를 1 예시** 로 박제해 S2 가 그대로 따를 수 있게 한다.
- [x] **AC 3 — 8 행 in-place 정정 실집행**: AC 1 재대조 · AC 2 화법에 따라 다음 8 행만 고친다. **행 추가 · 삭제 없이 각 행 안에서 좌표 문자열만 교체** 한다 (본문 의미 · 어순 · REQ 번호 · 링크는 불변).
  - `ADR-0003-deployment.md`:**20** (`7–17` → 정정) · **21** (`33–41` → 규칙 C 병기) · **22** (`19–22` → 정정) · **23** (`71–74` → 정정) · **168** (한 행 안 4 성분 `7–17` · `19–22` · `33–41` · `71–74` 동시 정정 — `88–92` 성분은 **참 판정이므로 무편집**).
  - `ADR-0001-stack.md`:**20** · **138** (둘 다 `88–93` → 정정).
  - `ADR-0002-db.md`:**119** (`55–64` → 정정).

  편집 후 `git diff --numstat` 으로 3 파일의 변경 행이 **각각 5 / 2 / 1 = 총 8 행 (추가 8 · 삭제 8)** 임을 확인하고 초과 시 원인을 박제한다.
- [x] **AC 4 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.73`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.72` AC 4 S1 승계) → AC 1 재대조 결과표 (6 쌍 · 승계값 대비 일치 / 뒤집힘) → AC 2 화법 판정 (근거 3 + 예시 1) → AC 3 편집 대조표 (행 · before → after · 분류) → 진척 (**정정 축 = 14 건 중 처리 11 · 잔여 3**) → 한계 → 파생 영향 (목록만 · S2 를 1 순위 지목). **절 ≤ 60 행**. 초과 예상 시 **AC 1 재대조표를 6 행 요약** 으로 압축하고 근거를 1 구 박제한다.
- [x] **AC 5 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고, `git diff --stat` 이 **정확히 5 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`docs/requirements.md` · `docs/architecture/` · `CLAUDE.md` · `.claude/agents/` · `README.md` · `src/` 가 변경 목록에 없음** 을 명시적으로 검산한다 (README 는 재대조 입력일 뿐 무편집). doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 무손상을 audit 파일 ` ``` ` fence **짝수 개** + 신설 표 컬럼 수 일치 + **정정한 3 ADR 의 링크 문법 무손상** (`grep -c '](\.\./\.\./README.md)'` 류로 링크 개수 불변 확인) 으로 확인한다.

## Out of Scope

- **S2 대상 착수 금지** — `docs/requirements.md` (2 건 · 20 · 39 행) · `docs/architecture/directory.md` (1 건 · 197 행) 은 **무편집**. 파일 수가 이미 cap 상한 5 라 1 개라도 추가하면 §3 위반이다.
- **pointer 재판정 금지** — `§ 12.68` ~ `§ 12.71` 이 마감한 140 지점의 참 / 부분참 / 거짓 판정을 다시 다투지 않는다. AC 1 은 **정정 대상 8 행의 좌표 재대조** 일 뿐 새 판정 축이 아니다.
- **ADR 본문의 결정 내용 · 구조 변경 금지** — 좌표 문자열 외의 어떤 문장 · Status · Decision · Consequences 도 건드리지 않는다. 행 수 증감 0.
- **`§ 12.72` 및 그 이전 audit 절 편집 금지** — append-only (`§ 12.15`). 본 slice 산출은 `§ 12.73` 신설로만.
- **`CLAUDE.md` §3.1 rule 5 명문화 착수 금지** (`§ 12.72` 파생 (3) — 시급성 낮음).
- **범위 표기 규약 신설 · anchor 좌표계 이행 (FU14) 착수 금지** (`§ 12.72` 파생 (4) · (5)).
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Result (2026-08-05)

AC 1 ~ 5 **전량 충족**. 재대조 6 쌍 **전량 일치 · 뒤집힘 0** → 승계값 채택. 규칙 C 화법은 **인라인 괄호 병기** 확정 (예시 `(README 33–41 행 표기 · 실 대응 31 · 34 행 불연속)`). 8 행 in-place 정정 실집행 — `git diff --numstat` = ADR-0001 `2 2` · ADR-0002 `1 1` · ADR-0003 `5 5` = **추가 8 · 삭제 8** (기대 5/2/1 일치 · 초과 0), 3 ADR 행 수 불변 (146 / 127 / 173) · README 링크 개수 불변 (2 / 9 / 3). audit `§ 12.73` 신설 — `wc -l` **6662 → 6723 (+61)**, 절 본문 **60 행** (상한 준수 — AC 4 단서대로 재대조표를 6 행 요약으로 압축), fence **166 → 170** (짝수). `git diff --stat` = **4 파일 + task 1 = 5 파일 · +69/-8 LOC** (cap 준수), `git status --short` 에 `README.md` · `docs/requirements.md` · `docs/architecture/` · `CLAUDE.md` · `.claude/agents/` · `src/` **없음**. 정정 축 진척 **14 건 중 11 처리 · 잔여 3** (S2).

## Follow-ups

- **S2 실집행** (`docs/requirements.md` 20 · 39 · `docs/architecture/directory.md` 197 = 3 건) — 다음 slice 1 순위. 잔여 3 건 전부 (I) 라 규칙 C 화법은 적용 대상 없음.
- `CLAUDE.md` §3.1 rule 5 명문화 (기존 `docs/decisions/*` · `docs/architecture/*` 본문의 비-결정 수정 = `direct`) — `§ 12.72` AC 3 승계, 시급성 낮음.
