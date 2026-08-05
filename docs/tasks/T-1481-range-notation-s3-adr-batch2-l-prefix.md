---
id: T-1481
title: 범위 표기 규약 축 S3 batch 2 — `L` prefix 이중 대상 ADR 3 파일 R1·R5 정규화 (audit §12.79)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 110
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1480]
touchesFiles:
  - docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md
  - docs/decisions/ADR-0006-assessment-data-model.md
  - docs/decisions/ADR-0030-assessment-collection-enumerate.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1481-range-notation-s3-adr-batch2-l-prefix.md
plannerNote: "uc-doc-audit-resync 93 번째 slice — §12.78 파생 (1) 1 순위 S3 batch 2. L prefix 이중 대상 ADR 3 파일 · 6 후보 행 R1+R5 정규화, direct 5 파일"
---

# T-1481 — 범위 표기 규약 S3 batch 2: `L` prefix 이중 대상 ADR 3 파일 정규화

## Why

[T-1480](T-1480-range-notation-s3-adr-mixed-batch1.md) 이 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.78` 로 S3 batch 1 (혼용 ADR 3 파일 · 치환 12 건) 을 마감했다. 그 절의 파생 영향 (1) 이 **남은 1 순위** 로 지목한 slice 가 **S3 batch 2 = ADR 3 파일** 이며, 지목과 함께 "`R5` (`L` prefix) 이중 대상 우선" 도 이미 판정돼 있다. 본 task 는 그 우선순위를 그대로 집행한다.

batch 1 이 `R1` (구분자) 만 다뤘던 것과 달리 본 batch 는 **`R5` (`L` prefix) 가 함께 걸린 3 파일** 을 고른다 — `§ 12.76 R5` 의 존치 조건이 "그 파일의 `~` 범위 표기가 **0 건일 때만**" 이라, 같은 slice 에서 `R1` 을 적용해 `~` 를 새로 넣는 순간 존치 근거가 소멸하는 **연동 판정** 이 생기기 때문이다 (`§ 12.76` 한계 3 이 예고한 바로 그 상황 — "순수 파일에 `~` 가 새로 들어오면 존치 근거가 소멸한다, 그때는 `R1` 이 우선"). 이 연동을 두 batch 로 쪼개면 중간 상태에서 규약 위반 파일이 생기므로 한 slice 에서 처리한다.

본 slice 도 **한정 소급** 제약 아래 있다 (`§ 12.76` AC 3 ③) — 아래 AC 2 census 로 좌표가 특정된 **3 파일 · 6 후보 행** 밖으로 나가지 않는다. commit mode 는 [CLAUDE.md](../../CLAUDE.md) §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 비-결정 수정 = `direct`) 의 **두 번째 적용 선례** 다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 행 · 108 행 · 109 행 · 140 행 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6992 행 (T-1480 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.77` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.76` 의 조문 `R1` ~ `R7`** (**6862 ~ 6868 행**) 과 **AC 3 ② · ③ (적용 범위 · 발효)** (**6876 · 6878 행**) — 본 slice 가 집행하는 **정본**. 특히 `R1` · `R4` (단일 행) · `R5` (`L` prefix 존치 조건) · `R6` (인용 원문 면제) · `R7` (시점 기록 면제).
  - **`§ 12.76` 한계 3** (**6884 행**) — `R5` 존치 조건이 스냅숏이며 `~` 유입 시 `R1` 우선이라는 예고. 본 slice 의 연동 판정 (AC 3) 근거.
  - **`### 12.78` 의 AC 2 census 1 구 · `R5` 대상 1 구 · 파생 영향 (1)** (**6937 · 6939 · 6977 행**) — 본 slice 의 대상 선정 근거이자 batch 1 이 이월한 목록.
  - **`## 11. References`** 좌표 (**현재 6979 행** — `§ 12.79` 삽입 위치 경계, AC 6 에서 재실측).
- `docs/decisions/ADR-0005-mcp-tools-for-pr-review-flow.md` — 후보 **2 행 (105 · 166 행)** 과 각 행의 문맥 1 행씩만. 문서 전체 열람 금지.
- `docs/decisions/ADR-0006-assessment-data-model.md` — 후보 **3 행 (165 · 173 · 174 행)** 만.
- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — 후보 **2 행 (24 · 93 행)** 만.
- `CLAUDE.md` — **§3.1 rule 5** (**142 행**) 만. mode 판정 근거. **편집 대상 아님**.
- **다른 ADR · 5 문서군의 나머지 파일은 열지 않는다** — batch 3 이후 몫이며 본 slice 에서 열면 파일 수 검산이 흐려진다.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 정합 판정 (2 ~ 3 구)**: 본 batch 3 파일 선정과 편집이 `§ 12.78` 파생 (1) 및 `§ 12.76` AC 3 ③ 과 정합함을 판정해 적는다. ① **선정 근거**: `§ 12.78` 이 "`R5` 이중 대상 우선" 을 지목했고 세 파일 모두 `L` prefix 좌표를 보유한다. ② **한정 소급 준수**: AC 2 census 가 대상을 파일 · 행 단위로 특정하므로 "이미 어긋남이 확인된 좌표" 요건 충족, **전면 일괄 치환은 여전히 금지** 이며 3 파일 밖 무편집. ③ **mode 근거**: `CLAUDE.md` §3.1 rule 5 의 **두 번째 적용 선례** 이며 ADR 의 Decision · Consequences 실질은 무편집.
  - 판정이 **불허** 로 결론나면 편집을 **0 건** 으로 두고 사유를 audit 절에 박제한 뒤 판정 산출만으로 마감한다 (그 경우 AC 3 ~ AC 5 는 "편집 0" 으로 충족).
- [ ] **AC 2 — `R5` census 재실측 + `§ 12.78` 집계 정정 판정 (표 1 개 또는 집계 1 구)**: 다음을 실행해 값을 박제한다.
  - `grep -cE 'L[0-9]+ *[-–~] *[0-9]+|L[0-9]+' docs/decisions/ADR-*.md` 계열 집계로 `L` prefix 보유 ADR 파일 목록을 확정하고, `§ 12.78` AC 2 가 적은 **`R5` 대상 2 파일 (`ADR-0005` · `ADR-0030`)** 과 대조한다.
  - **정정 판정 1 구 의무** — `§ 12.78` 의 집계는 `L[0-9]+-[0-9]+` (**ASCII hyphen 한정**) 패턴이라 **en dash 를 쓴 `L56–63` (`ADR-0006`) 과 단일 행 `L59` 를 놓쳤다**. 실제 `R5` 대상은 **2 파일보다 많다** 는 사실을 본 절에서 정정해 적는다 (`§ 12.15` append-only 이므로 `§ 12.78` 본문은 **편집하지 않고** 본 절에서만 정정 선언).
  - 각 대상 파일의 `~` 범위 표기 hit 수 (`grep -cE '[0-9]+ *~ *[0-9]+'`) 를 함께 박제한다 — `R5` 존치 조건 판정의 직접 입력이다 (실측 기준값: `ADR-0005` **0** · `ADR-0006` **4** · `ADR-0030` **1**).
- [ ] **AC 3 — `R5` 존치 조건 연동 판정 (2 ~ 3 구)**: 파일별로 `L` prefix 를 **존치 / 정정** 중 무엇으로 판정하는지 근거와 함께 적는다.
  - `ADR-0006` · `ADR-0030` — `~` hit ≥ 1 이므로 `R5` 존치 조건 **불충족** → `L` prefix **정정**.
  - `ADR-0005` — 현재 `~` hit **0** 이라 `R5` 문언상 존치 대상이나, 본 slice 가 같은 파일의 `R1` 후보 (166 행 en dash) 를 정정하면 `~` 가 새로 들어와 **존치 근거가 소멸** 한다 (`§ 12.76` 한계 3 이 예고한 상황 · "그때는 `R1` 이 우선"). 따라서 **같은 slice 안에서 `L` prefix 도 함께 정정** 하는 것이 규약 정합이라고 판정하고 그 논거를 적는다. 반대 결론 (파일을 `L` 순수 상태로 두기 위해 `R1` 정정을 보류) 을 택한다면 그 사유를 명시하고 해당 파일을 편집 대상에서 제외한다.
  - 판정 결과를 `§ 12.76 R5` 의 예시에 등장하는 "`ADR-0005` 안에서는 기존 `L` 존치" 문구와 대조해 1 구 적는다 — 조문 예시가 스냅숏이라 본 slice 로 무효화되는지 여부 (조문 **본문은 편집 금지** · 파생 영향에 후보 이월).
- [ ] **AC 4 — 행별 면제 판별 후 in-place 정규화 (6 후보 행)**: 후보 **6 행** (`ADR-0005` 105 · 166 / `ADR-0006` 165 · 173 · 174 / `ADR-0030` 24 · 93 중 실측 확정분) 각각에 대해 **정정 / 면제** 를 판별하고 대조표에 남긴다.
  - **면제 판별 기준** — `R6`: 타 문서 표기를 원문 그대로 인용한 경우 무편집. `R7`: 날짜 · 판정 시점 stamp 가 박혔거나 당시 판의 증거로 기능하는 문장은 무편집.
  - 정정분은 **구분자와 `L` prefix 만** 바꾼다 — 숫자 · 링크 · 앞뒤 서술은 건드리지 않는다. `L` 제거 시 단위어 `행` 을 붙여 `56~63 행` 형태로 맞추고, **단일 행 (`L59`) 은 `R4` 를 적용해 `59 행`** 으로 적는다.
  - **규약 범위 밖 판정 유지** — 수량 범위 (`100~200명` · `50~100 repo`) 와 식별자 범위 (`REQ-005~008` · `ADR-0001~0003` · `R-110~R-114`) 는 좌표 표기가 아니므로 `§ 12.78` `R7` · `R4` 판별 1 구의 선례를 승계해 **무편집** 임을 1 구 적는다.
  - 정정 후 **각 파일의 행 수 불변** (`wc -l` 전후 동일) 과 **`L` prefix · en dash 잔존 수 = 면제 · 범위 밖 판정분과 동수** 를 재실측해 적는다.
- [ ] **AC 5 — 결정 내용 무편집 검산 (1 구)**: `git diff` 상 3 ADR 의 변경이 **구분자 · prefix 치환뿐** 임을 확인해 적는다 — 추가 행 수 = 삭제 행 수, 각 hunk 가 후보 6 행 안에 있음, `## Decision` · `## Consequences` · `## Alternatives` 의 **문장 실질 변경 0**, ADR 의 `Status` 행 무편집.
- [ ] **AC 6 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.79`** 를 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.78` 파생 1 순위 S3 batch 2) → AC 1 선정 · 한정 소급 판정 → AC 2 census 재실측 + `§ 12.78` 집계 정정 → AC 3 `R5` 연동 판정 → **행별 대조표** (파일 · 행 · 원 표기 · 판정 · 근거 조문) → AC 5 무편집 검산 → 진척 · 한계 → 파생 영향 (목록만 — batch 3 대상 후보 포함). **절 ≤ 60 행** — 초과 예상 시 census 를 집계값 1 구로 압축하고 사유를 박제한다.
- [ ] **AC 7 — 자기 준수 + 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - **자기 준수** — 신규 추가분 대상 `git diff -U0 <5 파일> | grep '^+' | grep -cE '[0-9]+ *– *[0-9]+|L[0-9]+' ` 집계값 박제. `R6` 인용 원문 · 대조표의 원 표기 인용은 예외이므로 hit 이 0 이 아니면 내역을 1 구 밝힌다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**6992 → 6992 + 신설 행수**).
  - `git diff --stat` 이 **정확히 5 파일 · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + `### 12.7x` heading 순번 연속 (`12.78` → `12.79`) + 3 ADR 각각의 `## ` heading 수 **불변** (실측 기준값 `ADR-0005` 6 · `ADR-0006` 5 · `ADR-0030` 5) + 링크 개수 불변 (`grep -c '](' <파일>` 전후 동일 — 기준값 43 · 28 · 10).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **batch 3 이후 파일 착수 금지** — 혼용 ADR 잔여 파일 (`ADR-0008` · `ADR-0013` · `ADR-0014` · `ADR-0018` · `ADR-0033` · `ADR-0035`) 과 en dash 단독 파일 (`ADR-0016` · `ADR-0017` · `ADR-0021`) 은 열지도 고치지도 않는다. 본 slice 의 파일 수 검산 (5) 을 깬다.
- **5 문서군의 비-ADR 파일 정규화 금지** — `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` (특히 `L` 보유 `directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 는 **무편집**.
- **ADR 결정 내용 변경 금지** — Decision · Consequences · Alternatives · Status 의 실질을 바꾸지 않는다. 바꾸고 싶은 지점이 보이면 Follow-ups 에만 적는다 (`pr` mode 대상이라 §3.1 rule 3 split 필요).
- **조문 재설계 · 조문 본문 편집 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. `R5` 예시의 파일 목록이 본 slice 로 stale 해져도 **`§ 12.76` 본문은 편집하지 않고** 파생 영향 이월로만 처리한다 (`§ 12.15` append-only).
- **`§ 12.78` 및 그 이전 audit 절 편집 금지** — 집계 정정도 `§ 12.79` 안에서 선언만 한다.
- **pointer 좌표 값 재검증 · 재정정 금지** — `§ 12.68` ~ `§ 12.74` 의 판정을 다시 다투지 않는다. 본 slice 는 **구분자와 `L` prefix** 만 본다.
- **수량 · 식별자 범위 치환 금지** — `100~200명` · `REQ-005~008` 류는 좌표 표기가 아니므로 손대지 않는다 (판정 1 구만).
- **`CLAUDE.md` 편집 금지** — rule 5 는 근거로 **참조만**. 회색지대 예시 보강은 선례 축적 후 별도 slice.
- **S4 (`docs/architecture/` 규약 문서 신설) 착수 금지** — `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 인접 작업 발견 시 여기에 append)
