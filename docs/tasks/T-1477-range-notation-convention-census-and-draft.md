---
id: T-1477
title: 범위 표기 규약 축 착수 — 표기 형식 census (문서군 단위 집계) + 규약 초안 조문 + 박제 위치·commit mode 판정 + 이행 분해안 (audit §12.75)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1476]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1477-range-notation-convention-census-and-draft.md
plannerNote: "uc-doc-audit-resync 89 번째 slice — §12.74 파생 (1) 1 순위 착수. pointer 축 마감 후 새 축의 게이트 slice (census+규약+분해안), 실집행은 후속"
---

# T-1477 — 범위 표기 규약 축 착수: 형식 census + 규약 초안 + 이행 분해안

## Why

[T-1476](T-1476-pointer-correction-s2-requirements-directory.md) 이 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.74` 로 **pointer 정정 축 14/14 를 마감** 해 판정 · 정정 재고가 모두 **0** 이 됐다. 그 절의 파생 영향 (1) 이 다음 축 **1 순위** 로 지목한 것이 **범위 표기 규약 신설** 이며, 씨앗은 `§ 12.72` 규칙 B · C 와 `§ 12.73` 이 확정한 인라인 괄호 병기 화법이다.

이 축이 필요한 실측 근거는 이미 박제돼 있다 — `§ 12.72` AC 2 가 부분참 14 건의 원인을 **README drift 가 아니라 "작성 시점부터의 범위 끝 부정확"** 으로 확정했고 (`§ 12.71` AC 3 (a): 단일 좌표 113 지점 어긋남 **0** vs 범위 표기 어긋남 **14**), `§ 12.74` 한계 4 는 정정된 본문과 시점 기록이 **의도적으로 불일치** 한 상태로 남았음을 남겼다. 즉 어긋남은 좌표 관측 실패가 아니라 **표기 규약 부재** 에서 온다 — 구분자 (`~` · `–` · `-`) · `L` prefix · 경계 포함 여부 · 단일 행 표기가 문서마다 제각각이다.

본 slice 는 정정 축의 `§ 12.72` 와 같은 **게이트 slice** 다 — 실집행 (소급 정정) 은 하지 않고, **형식 census · 규약 초안 · 박제 위치 판정 · 이행 분해안** 4 종만 확정해 후속 실집행 slice 가 기계적으로 따르게 한다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6776 행 (T-1476 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.71` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.72`** 중 **AC 1 목록표** (**6584 ~ 6597 행 부근**) 과 **3 분류 규칙 A ~ D** (**6607 ~ 6614 행**) — 규약 조문의 씨앗. **무편집 · 승계만**.
  - **`### 12.73`** 중 **규칙 C 인라인 괄호 화법 확정 부분** — 병기 조문의 선례. 절 전체를 읽을 필요 없다.
  - **`### 12.74`** (**6710 ~ 6761 행**) — 직전 slice. **최종 집계 · 한계 4 · 파생 영향** 만 승계한다.
  - **`## 11. References`** 좌표 (**현재 6763 행** — `§ 12.75` 삽입 위치 경계, AC 5 에서 재실측).
- `CLAUDE.md` — **무편집**. §3.1 표 (commit mode 판정 — AC 3 입력) · §7 (context 절약) · §9 · §12 (언어) 만 참조.
- **census 대상 파일군은 열지 않는다** — AC 1 은 `grep -cE` **집계값** 만 쓴다. 개별 파일 본문 열람 금지 (context 보호 · 본 slice 는 편집 대상이 0).

## Acceptance Criteria

- [ ] **AC 1 — 표기 형식 census (문서군 단위 집계 · 개별 파일 나열 금지)**: 모집단 = pointer 축이 다룬 문서군 **5 개** (`README.md` + `CLAUDE.md` / `docs/requirements.md` / `docs/architecture/*.md` / `docs/decisions/ADR-*.md` / `.claude/agents/*.md`). 다음 **형식 4 종** 의 hit 수를 `grep -cE` 로 **문서군 단위 합산** 한다 — ① 물결 `[0-9]+~[0-9]+` · ② en-dash `[0-9]+–[0-9]+` · ③ `L` prefix `L[0-9]+-[0-9]+` · ④ 단위어 동반형 (`행` 또는 `line` 이 범위 직후에 붙는 경우). 결과는 **문서군 5 행 × 형식 4 열 표 1 개** 로만 박제하고 **파일별 나열은 금지** (cap 보호). 사용한 명령을 그대로 1 블록 적는다.
  - **오탐 배제 의무** — 맨 hyphen `[0-9]-[0-9]` 는 날짜 (`2026-08-05`) · 식별자 (`T-1477`) · 버전과 충돌해 census 에서 **제외** 하고 사유를 1 구 박제한다. ③ 은 `L` prefix 가 붙은 것만 센다.
  - 집계값은 **표기 형식의 분포** 일 뿐 **좌표 정오 판정이 아님** 을 1 구 명시한다 (`§ 12.71` 판정 마감을 다시 다투지 않는다).
- [ ] **AC 2 — 규약 초안 조문 (5 ~ 7 개 · 각 조문에 근거 1 구)**: 최소 다음을 조문화한다 — (a) **구분자 단일화** (AC 1 최빈 형식 채택 · 근거는 집계값) · (b) **경계 포함 규칙** (양끝 포함 여부를 명문화 · `§ 12.68` #16 의 "139 = 빈 줄" 류 어긋남이 여기서 발생) · (c) **빈 줄 · heading 을 범위에 넣지 않는다** (실 대응 행만) · (d) **단일 행 표기** (`20 행` — `20~20` 금지) · (e) **`L` prefix 사용 조건** (코드 파일 vs 문서 구분 또는 폐지) · (f) **불연속 대응 병기** = `§ 12.73` 인라인 괄호 화법 승계 (`§ 12.72` 규칙 C) · (g) **시점 기록 예외** (`§ 12.72` 규칙 A — 규약을 소급 적용하지 않는 문장 부류). 각 조문은 **근거 1 구** 를 달되 새 판정을 만들지 말고 기존 절 (`§ 12.68` ~ `§ 12.74`) 승계로 적는다.
- [ ] **AC 3 — 박제 위치 · commit mode 판정**: 규약을 어디에 둘지 후보 **3** 을 비교하고 **1 개를 선택** 한다 — ① audit 문서 자체 절 (본 절이 곧 정본) · ② `docs/architecture/` 신설 문서 · ③ `CLAUDE.md` §12 하위 조항. 각 후보에 대해 **[CLAUDE.md](../../CLAUDE.md) §3.1 commit mode** 를 판정한다 (② = **새 `docs/architecture/*` 추가라 `pr`** · ①③ = `direct` — `§ 12.72` AC 3 선례 승계). 선택 근거 **2 구 이내** + 미선택 사유 각 1 구. mode 혼합 slice 가 생기면 §3.1 rule 3 대로 **split 필요** 함을 AC 4 분해안에 반영한다.
- [ ] **AC 4 — 이행 분해안 (소급 범위 판정 포함)**: (a) 규약 적용 시 **소급 정정 대상 규모** 를 AC 1 집계값으로 추정하고 (정확 건수 확정은 후속 slice 몫임을 명시), (b) **전면 소급 치환을 하지 않는다** 는 판정을 `§ 12.15` append-only · `§ 12.72` 규칙 A (시점 기록) 와 충돌 검토해 근거 2 구로 확정하며 (전면 치환 시 시점 증거 훼손 · cap 초과가 예상 사유), (c) **slice 표** 를 만든다 — slice 당 **대상 문서군 · 예상 편집 행 · 파일 수 검산 (≤ 5) · 예상 LOC (≤ 300) · commit mode**, (d) **1 순위 slice 를 지목** 하고 사유 1 구를 적는다.
- [ ] **AC 5 — audit 절 신설 + 검증 명령**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.75`** 를 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.74` 파생 1 · 새 축 착수) → AC 1 census 표 → AC 2 규약 조문 → AC 3 위치 · mode 판정 → AC 4 분해안 표 → 진척 · 한계 → 파생 영향 (목록만). **절 ≤ 70 행** — 초과 예상 시 census 표를 형식 4 열 그대로 두고 조문 근거를 압축하며 그 사유를 1 구 박제한다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **정확히 2 파일 · ≤ 300 LOC** 임을 확인한다.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · `docs/decisions/` · `.claude/agents/` · `src/` 가 변경 목록에 없음** 을 명시적으로 검산한다 (census 는 읽기 전용).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 대신 markdown 무손상을 audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** 로 확인한다.

## Out of Scope

- **규약 실집행 · 소급 정정 착수 금지** — 본 slice 는 게이트 (census + 초안 + 분해안) 다. 어떤 문서의 표기도 고치지 않는다 (편집 대상 파일 **0** — audit 절 + 본 task 파일뿐).
- **`docs/architecture/` 신설 문서 작성 금지** — AC 3 이 후보 ② 를 선택하더라도 **판정만** 하고 문서 생성은 후속 slice (그 경우 `pr` mode 라 본 slice 와 mode 혼합 금지, §3.1 rule 3).
- **`CLAUDE.md` 편집 금지** — AC 3 후보 ③ 도 판정만. §3.1 rule 5 명문화 (`§ 12.72` AC 3 Follow-up) 착수도 금지.
- **pointer 재판정 · 재정정 금지** — `§ 12.68` ~ `§ 12.71` 의 140 지점 판정과 `§ 12.73` · `§ 12.74` 의 11 행 정정을 다시 다투지 않는다. AC 1 은 **표기 형식 분포** 집계일 뿐이다.
- **개별 파일 census 나열 금지** — 문서군 단위 합산만. 파일별 목록은 cap 을 깨고 후속 slice 의 몫이다.
- **anchor 좌표계 이행 (FU14) 착수 금지** — 규약 조문에서 **관계만** 1 구 언급 가능 (`§ 12.74` 한계 3).
- **`§ 12.74` 및 그 이전 audit 절 편집 금지** — append-only (`§ 12.15`). 산출은 `§ 12.75` 신설로만.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 편집 대상 문서 0). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
