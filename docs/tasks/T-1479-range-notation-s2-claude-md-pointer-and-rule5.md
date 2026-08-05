---
id: T-1479
title: 범위 표기 규약 축 S2 — CLAUDE.md §12 정본 pointer 소절 + §3.1 rule 5 명문화 (audit §12.77)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1478]
touchesFiles:
  - CLAUDE.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1479-range-notation-s2-claude-md-pointer-and-rule5.md
plannerNote: "uc-doc-audit-resync 91 번째 slice — §12.76 파생 (1) 1 순위 S2 집행. 정본 pointer 3 줄 + rule 5 명문화, direct 3 파일"
---

# T-1479 — 범위 표기 규약 S2: CLAUDE.md 정본 pointer + §3.1 rule 5

## Why

[T-1478](T-1478-range-notation-convention-s1-canonical.md) 이 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.76` 으로 범위 표기 규약을 **정본** 으로 승격해 조문 `R1` ~ `R7` 을 확정했다. 그 절의 파생 영향 (1) 이 **다음 1 순위** 로 지목한 slice 가 **S2 = `CLAUDE.md` §12 하위 pointer 3 줄 + §3.1 rule 5 명문화** 이며 (`§ 12.75` AC 4 분해안 표의 S2 행 — `direct` · 3 파일 · ≈ 50 LOC), 지목 사유는 "인용할 정본이 생겼으므로" 다.

두 편집은 성격이 다르지만 같은 slice 로 묶인다 — 둘 다 `CLAUDE.md` **단일 파일의 운영규칙 편집** 이고 (`§ 3.1` 표 상 `direct`), rule 5 는 `§ 12.72` AC 3 이 남긴 Follow-up 후보로 `§ 12.73` · `§ 12.74` · `§ 12.76` 세 절이 매번 파생 목록에 이월해 온 잔여 항목이다 (`§ 12.75` 분해안이 S2 한 slice 로 **흡수** 하도록 이미 판정했다).

본 slice 의 핵심 제약은 **SSOT 보존** 이다 — `CLAUDE.md` 에는 조문 전문을 복제하지 않고 **정본 좌표를 가리키는 pointer** 만 둔다. 조문을 두 곳에 두면 본 규약이 막으려는 drift 를 규약 자체가 만든다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 행 · 108 행 · 109 행 · 140 행 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6901 행 (T-1478 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.74` 본문은 열지 않는다** (판정 · 정정 재고 0 · 재판정 금지).
  - **`### 12.76`** (**6833 ~ 6886 행**) — 직전 slice **전량**. 정본 조문 `R1` ~ `R7` (AC 2) · 적용 범위 · 발효 (AC 3) 를 승계한다. 본 slice pointer 의 유일한 인용 원천이다.
  - **`§ 12.75` AC 4 분해안 표 중 S2 행** (**6819 행**) — 본 slice 의 범위 · 파일 수 · LOC · mode 근거. **표만 보고 절 전체는 열지 않는다**.
  - **`§ 12.72` AC 3 결론의 Follow-ups 후보 1 구** (**6628 행**) — rule 5 조문의 원문 씨앗. **그 한 행만** 본다.
  - **`## 11. References`** 좌표 (**현재 6888 행** — `§ 12.77` 삽입 위치 경계, AC 4 에서 재실측).
- `CLAUDE.md` — **본 slice 의 유일한 편집 대상 문서**. 다음 3 좌표만 연다.
  - **§3.1 판정 규칙 목록** (**136 ~ 143 행**) — 현재 rule 1 ~ 4. 삽입 지점은 rule 4 (**141 행**) 직후.
  - **§12 하위 소절 경계** — `### 혼합이 자연스러운 경우` (**445 행**) ~ `### 과거와의 호환` (**451 행**). 신설 소절은 이 둘 사이.
  - §7 (context 절약) · §9 (안전장치) · §12 (언어) 는 참조만.
- **census 대상 파일군 · ADR 군 본문은 열지 않는다** — 본 slice 는 소급 정정이 **0** 이라 재실측이 불요하다 (집계값은 `§ 12.76` 승계).

## Acceptance Criteria

- [ ] **AC 1 — `CLAUDE.md` §3.1 rule 5 명문화 (1 ~ 2 줄 · 목록 append)**: §3.1 "판정 규칙" 번호 목록 (현재 1 ~ 4) 의 **rule 4 직후** 에 **rule 5** 를 추가한다. 조문은 다음 3 요소를 갖춘다 — ① **규범**: 기존 `docs/decisions/*` · `docs/architecture/*` 본문의 **비-결정 수정** (행 좌표 pointer 정정 · typo · 표기 정규화) 은 `direct`. ② **경계 (반대 항)**: 결정 내용 자체 (ADR 의 Decision · Consequences 의 실질 · architecture 문서의 구조 판단) 변경은 종전대로 `pr`. ③ **근거 좌표 1**: `§ 12.72` AC 3 (본 판정의 선례를 세운 절).
  - 기존 **rule 1 ~ 4 는 무편집** — 문구 · 번호 · 순서를 건드리지 않는다 (append only).
  - 본 rule 은 **새 판정이 아니라 이미 집행된 선례의 명문화** 임을 조문 안 또는 audit 절에 1 구 밝힌다 (`§ 12.73` · `§ 12.74` · `§ 12.75` · `§ 12.76` 4 slice 가 실제로 `direct` 로 집행됐다).
- [ ] **AC 2 — `CLAUDE.md` §12 정본 pointer 소절 신설 (3 ~ 5 줄 · 조문 복제 금지)**: §12 안에 소절 **`### 범위 좌표 표기 (행 범위)`** 를 `### 혼합이 자연스러운 경우` **직후** · `### 과거와의 호환` **직전** 에 신설한다. 내용은 **정확히 3 ~ 5 개 bullet** 이며 각각 다음을 담는다.
  - ① **정본 pointer** — 범위 표기 규약의 정본은 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.76` 의 `R1` ~ `R7` 이고 인용은 `§ 12.76 R3` 형태로 한다 (상대 경로 링크 1 개).
  - ② **실무 요약 3 점** — 구분자는 `~` 하나 (`R1`) · 단일 행은 `20 행` 이며 `20~20` 금지 (`R4`) · 신규 표기에 `L` prefix 금지 (`R5`). **조문 전문 · 예시 · 근거는 옮기지 않는다** (SSOT 는 `§ 12.76`).
  - ③ **적용 범위 · 발효** — 5 문서군 한정 · `docs/tasks/*` · `docs/progress/*` · 코드 주석은 범위 밖 · **신규 작성분부터 적용 · 전면 소급 치환 금지** (`§ 12.76` AC 3 승계).
  - **SSOT 보존 검산 1 구** — 신설 소절이 `R1` ~ `R7` 의 **규범 문장을 복제하지 않았음** 을 확인해 적는다 (요약 3 점은 조문 번호 참조를 동반한 축약이지 정본이 아니다).
- [ ] **AC 3 — 자기 준수 검산 (규약을 본 slice 산출물에 적용)**: 본 task 파일과 신설 audit 절 · `CLAUDE.md` 신설분에 쓰인 **모든 범위 표기** 가 `R1` (구분자 `~`) · `R4` (단일 행은 `N 행`) · `R5` (`L` prefix 미사용) 를 지키는지 확인하고 결과를 1 구 적는다. 위반이 있으면 **본 slice 산출물 안에서만** 고친다 (기존 문서 소급 정정은 금지 — Out of Scope).
  - 검산은 신규 추가분 대상 `grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+-[0-9]+'` **집계값** 으로 하고 명령을 1 줄 박제한다. 단 **원문 인용** (`R6` 병기 화법으로 인용된 타 문서 표기) 은 위반이 아니므로 예외를 1 구 밝힌다.
- [ ] **AC 4 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.77`** 을 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.76` 파생 1 순위 S2 · rule 5 는 `§ 12.72` Follow-up 흡수) → **편집 2 지점 대조표** (파일 · 삽입 좌표 · 삽입 요지 · 근거 절) → SSOT 판정 1 구 (`CLAUDE.md` 는 **pointer** 이지 정본이 아니다) → AC 3 자기 준수 결과 → 진척 · 한계 → 파생 영향 (목록만). **절 ≤ 55 행** — 초과 예상 시 대조표를 유지하고 서술을 압축하며 그 사유를 1 구 박제한다.
- [ ] **AC 5 — 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**6901 → 6901 + 신설 행수**) 와 `wc -l CLAUDE.md` 증분 보고 (**465 → 465 + 신설 행수**).
  - `git diff --stat` 이 **정확히 3 파일 · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `docs/requirements.md` · `docs/architecture/` · `docs/decisions/` · `.claude/agents/` · `docs/LOOP.md` · `src/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + `### 12.7x` heading 순번 연속 (`12.76` → `12.77`) + `CLAUDE.md` 의 `### ` heading 수가 **정확히 +1** (`grep -c '^### ' CLAUDE.md`) 이고 `## ` heading 수는 **불변**.
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **조문 전문 복제 금지** — `CLAUDE.md` 에 `R1` ~ `R7` 의 규범 문장 · 예시 · 근거를 옮겨 적지 않는다. pointer + 3 점 요약까지만 (본 규약이 막으려는 drift 의 재생산 방지).
- **규약 소급 실집행 금지** — 어떤 문서의 범위 표기도 고치지 않는다. S3 (ADR 혼용 정규화) 착수 금지 (`§ 12.76` 파생 2 · 시급성 낮음).
- **`docs/architecture/` 신설 문서 작성 금지** — S4 는 `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **`§ 12.76` 및 그 이전 audit 절 편집 금지** — append-only (`§ 12.15`). 산출은 `§ 12.77` 신설로만.
- **조문 재설계 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. R2 · R3 병합 후보 (`§ 12.76` 파생 3) 는 착수 금지.
- **pointer 재판정 · 재정정 금지** — `§ 12.68` ~ `§ 12.71` 의 140 지점 판정과 `§ 12.73` · `§ 12.74` 의 11 행 정정을 다시 다투지 않는다.
- **`CLAUDE.md` 다른 § 편집 금지** — §3.1 rule 5 추가와 §12 소절 신설 **2 지점만**. §0.5 cheat sheet · §3.2 · 표 본문 · 기존 rule 1 ~ 4 는 무편집.
- **`README.md` · `docs/requirements.md` · `docs/LOOP.md` · `.claude/agents/*` 편집 금지** — 본 slice 의 파일 수 검산 (3) 을 깬다.
- **anchor 좌표계 이행 (FU14) 착수 금지** — `§ 12.76` 한계 4 의 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 편집 지점 2 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
