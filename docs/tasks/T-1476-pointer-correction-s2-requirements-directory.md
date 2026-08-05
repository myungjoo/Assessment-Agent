---
id: T-1476
title: pointer 정정 batch S2 실집행 — 잔여 3 건 (`requirements.md` 20 · 39 · `directory.md` 197) 3 행 in-place 정정 + 인용-성격 재분류 판정 + audit §12.74 (정정 축 마감)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 75
estimatedFiles: 4
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1475]
touchesFiles:
  - docs/requirements.md
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1476-pointer-correction-s2-requirements-directory.md
plannerNote: "uc-doc-audit-resync 88 번째 slice — §12.72 AC 4 의 2 순위 S2 실집행. 정정 축 잔여 3 건 소화로 축 마감 (14/14)"
---

# T-1476 — pointer 정정 S2: `requirements.md` 2 건 · `directory.md` 1 건 · 3 행 in-place 정정

## Why

[T-1475](T-1475-pointer-correction-s1-adr-group-8-lines.md) 가 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.73` 으로 **S1 (ADR 군 11 건 · 8 행)** 을 실집행하고 규칙 C 병기 화법을 **인라인 괄호** 로 확정했다. 본 slice 는 `§ 12.72` AC 4 분해안의 **2 순위 S2** 를 집행해 **잔여 3 건** (`docs/requirements.md`:20 · 39 · `docs/architecture/directory.md`:197) 을 정정하고, **pointer 정정 축 14 건 전량 (11 + 3) 을 마감** 한다. `§ 12.71` 이 판정 재고를 0 으로 만든 뒤 남아 있던 정정 재고도 본 slice 로 0 이 된다.

잔여 3 건은 `§ 12.72` 배정상 **전부 (I) 규칙 B (in-place 정정)** 라 S1 이 확정한 규칙 C 병기 화법의 적용 대상이 **0** 이다. 다만 `§ 12.68` #24 판정 사유가 대상 행의 좌표를 **"옛 REQ-020 번호 잔재의 인용"** 으로 서술하므로, 그 좌표가 **다른 문서를 그대로 옮긴 인용문 안** 이라면 in-place 치환이 인용을 왜곡한다 — `§ 12.72` 규칙 A / D 로 뒤집힐 수 있는 유일한 건이다. 본 slice 는 이 성격 판정을 AC 2 로 독립시켜 **정정 vs 무편집** 을 근거와 함께 결정한다 (`§ 12.72` 한계 1 이 "정정 slice 는 편집 직전 좌표를 1 회 재확인" 을 명령한 취지의 연장).

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6723 행 (실측 확인, T-1475 후)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.71` 본문은 열지 않는다**.
  - **`### 12.72`** 중 **AC 1 목록표 #1 · #2 · #14 행** (**6584 · 6585 · 6597 행 부근**) 과 **3 분류 규칙** (**6607 ~ 6614 행**) 과 **AC 4 분해안 표의 S2 행** — 본 slice 의 **입력 정본**. **무편집 · 승계만** 한다.
  - **`### 12.73`** (**6649 ~ 6708 행**) — S1 이 확정한 **재대조 절차 · 편집 대조표 · 인라인 괄호 화법** 서술 형식을 승계한다 (본 slice 는 규칙 C 대상 0 이라 화법 자체는 미사용).
  - **`## 11. References`** 좌표 (**현재 6710 행** — `§ 12.74` 삽입 위치 경계, AC 4 에서 재실측).
- `docs/requirements.md` (**103 행**) — 편집 대상 **2 행**: **20** (`136~139` 성분) · **39** (`19~22` 성분). 두 행 모두 **매우 긴 표 row** (각 2491 · 6138 char) 이므로 **행 전체를 재작성하지 말고 좌표 문자열만 치환** 한다.
- `docs/architecture/directory.md` (**203 행**) — 편집 대상 **1 행**: **197**. 같은 행의 **`L96-103` 성분은 `§ 12.71` #38 참 판정이라 무편집**, `L7-22` 성분만 고친다.
- `README.md` (**151 행**) — **무편집. 재대조 입력**. 전체 열람 금지 — 대조 좌표 **15 ~ 22 · 96 ~ 103 · 134 ~ 141** 구간만 `sed -n` / `grep -n` 으로 확보한다.
- `CLAUDE.md` — **무편집**. §3 (크기 상한) · §7 (context 절약) · §9 · §12 (언어) 준수. §3.1 표는 `§ 12.72` AC 3 이 이미 `direct` 로 판정했으므로 재해석 불요.

## Acceptance Criteria

- [ ] **AC 1 — 편집 직전 좌표 1 회 재대조 (`§ 12.72` 한계 1 이행 · 날조 금지)**: 3 쌍 각각에 대해 **(a) 대상 행의 현재 주장 좌표** 와 **(b) README 실 대응 구간** 을 `sed -n '<범위>p' README.md` 로 직접 확인하고 사용한 명령을 그대로 적는다. 대조 3 쌍 — `136~139` → **136 ~ 140** (`§ 12.68` #16: 139 = 빈 줄 · 인용 어구 `- pnpm install` 은 140) · `19~22` → **20 단독** (19 · 22 빈 줄 · 21 은 중복 제거로 무관) · `L7-22` → **16 ~ 18** (`§ 12.71` #37). **승계값과 재대조 결과가 다르면 재대조 결과를 채택** 하고 차이를 1 구로 박제한다. 재대조로 **정정 불요** 로 뒤집히는 건은 무편집으로 남기고 사유를 적는다.
- [ ] **AC 2 — `requirements.md`:39 의 인용-성격 판정 (본 slice 고유 · 규칙 A / D 재검토)**: 해당 좌표가 들어 있는 문장이 **`docs/tasks/T-0015-adr-0003-deployment-rest.md` 의 문자열을 그대로 옮긴 인용** 인지, 아니면 audit 저자의 **자체 서술** 인지를 `grep -n '19~22' docs/tasks/T-0015-*.md` 등으로 **원문 대조해 확정** 한다. 판정 분기를 그대로 따른다 — **(a) 원문에 동일 문자열 존재 (인용)** 이면 `§ 12.72` **규칙 A** 로 재분류해 **무편집** 하고 각주 · 병기 없이 사유만 `§ 12.74` 에 박제 (원 문서를 고치는 것은 본 batch 범위 밖). **(b) 자체 서술** 이면 `§ 12.72` 배정대로 **규칙 B (I) in-place 정정** 을 집행한다. 어느 쪽이든 근거를 **원문 대조 명령 1 + 판정 1 구** 로 적는다.
- [ ] **AC 3 — 3 행 in-place 정정 실집행**: AC 1 · AC 2 결과에 따라 다음 행만 고친다. **행 추가 · 삭제 없이 각 행 안에서 좌표 문자열만 교체** 한다 (본문 의미 · 어순 · REQ 번호 · 링크 · 표 컬럼 수 불변).
  - `docs/requirements.md`:**20** (`136~139` → 정정).
  - `docs/requirements.md`:**39** (`19~22` → AC 2 판정 (b) 일 때만 정정 · (a) 이면 **무편집**).
  - `docs/architecture/directory.md`:**197** (`L7-22` → 정정 · **`L96-103` 성분 무편집**).

  편집 후 `git diff --numstat` 으로 두 파일의 변경 행이 **`requirements.md` 2 (또는 AC 2 (a) 시 1) · `directory.md` 1** 이고 **추가 = 삭제** 임을 확인한다. 초과 시 원인을 박제한다.
- [ ] **AC 4 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.74`** 를 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.72` AC 4 S2 · `§ 12.73` 승계) → AC 1 재대조 결과표 (3 쌍 · 승계값 대비 일치 / 뒤집힘) → AC 2 인용-성격 판정 (원문 대조 결과 + 분기 · 근거) → AC 3 편집 대조표 (행 · before → after · 분류) → **정정 축 최종 집계** (14 건 = S1 11 + S2 3 · 처리 / 무편집 내역 · 잔여 **0** · 축 마감 선언) → 한계 → 파생 영향 (목록만 · 다음 축 1 순위 지목). **절 ≤ 60 행**. 초과 예상 시 재대조표를 **3 행 요약** 으로 압축하고 근거를 1 구 박제한다.
- [ ] **AC 5 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **정확히 4 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`README.md` · `docs/decisions/` · `CLAUDE.md` · `.claude/agents/` · `src/` 가 변경 목록에 없음** 을 명시적으로 검산한다 (README 는 재대조 입력일 뿐 무편집). doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 무손상을 audit 파일 ` ``` ` fence **짝수 개** + 신설 표 컬럼 수 일치 + **정정한 2 파일의 링크 · 표 파이프 개수 불변** (`grep -c '|' <file>` 류 또는 대상 행의 `|` 개수 대조) 으로 확인한다.

## Out of Scope

- **S1 재편집 금지** — `ADR-0001` · `ADR-0002` · `ADR-0003` 은 T-1475 가 이미 정정했다. 재검토 · 재정정 하지 않는다 (파일 수 cap 여유가 있어도 축 중복).
- **pointer 재판정 금지** — `§ 12.68` ~ `§ 12.71` 이 마감한 140 지점의 참 / 부분참 / 거짓 판정을 다시 다투지 않는다. AC 1 · AC 2 는 **정정 대상 3 행 한정 재대조 · 성격 판정** 일 뿐 새 판정 축이 아니다.
- **`docs/tasks/T-0015-*.md` 편집 금지** — AC 2 가 인용 원문으로 열람만 한다. 옛 REQ 번호 잔재 정정은 별도 축 (Follow-ups).
- **대상 행 외 본문 · 구조 변경 금지** — 좌표 문자열 외의 어떤 문장 · 표 · REQ row · 상태값도 건드리지 않는다. 행 수 증감 0.
- **`§ 12.73` 및 그 이전 audit 절 편집 금지** — append-only (`§ 12.15`). 본 slice 산출은 `§ 12.74` 신설로만.
- **`CLAUDE.md` §3.1 rule 5 명문화 착수 금지** (`§ 12.72` 파생 (3) — 시급성 낮음).
- **범위 표기 규약 신설 · anchor 좌표계 이행 (FU14) 착수 금지** (`§ 12.72` 파생 (4) · (5)).
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 발견 사항을 여기에 append)
