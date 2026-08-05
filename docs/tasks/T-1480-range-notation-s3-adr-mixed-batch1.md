---
id: T-1480
title: 범위 표기 규약 축 S3 batch 1 — 혼용 ADR 3 파일 R1 정규화 (audit §12.78)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 110
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1479]
touchesFiles:
  - docs/decisions/ADR-0001-stack.md
  - docs/decisions/ADR-0002-db.md
  - docs/decisions/ADR-0003-deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1480-range-notation-s3-adr-mixed-batch1.md
plannerNote: "uc-doc-audit-resync 92 번째 slice — §12.77 파생 (1) 1 순위 S3 의 첫 batch. 혼용 ADR 3 파일 · 11 후보 행 정규화, direct 5 파일"
---

# T-1480 — 범위 표기 규약 S3 batch 1: 혼용 ADR 3 파일 정규화

## Why

[T-1479](T-1479-range-notation-s2-claude-md-pointer-and-rule5.md) 가 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.77` 로 범위 표기 규약을 `CLAUDE.md` 운영규칙에 **pointer 로** 반영해 S2 를 마감했다. 그 절의 파생 영향 (1) 이 **남은 1 순위** 로 지목한 slice 가 **S3 = 혼용 파일 정규화** 이며 (`§ 12.75` AC 4 분해안 표의 S3 행 — `direct` · ADR 3 + audit 1 + task 1 = **5 파일** · ≈ 70 LOC), 지목과 함께 "ADR 군 **10 파일** 이라 cap 초과 → 3 파일씩 재분할" 도 이미 판정돼 있다. 본 task 는 그 재분할의 **첫 batch** 다.

본 slice 의 핵심 제약은 **한정 소급** 이다 — `§ 12.76` AC 3 ③ 발효 규칙이 **전면 소급 치환을 금지** 하고 소급을 "이미 어긋남이 확인된 좌표" 로 한정했으므로, 본 slice 는 census 로 좌표가 특정된 **3 파일 · 11 후보 행** 밖으로 나가지 않는다. 행마다 `R6` (병기 화법 인용 원문) · `R7` (시점 기록) 면제 판별을 거친 뒤에만 고친다.

commit mode 는 `CLAUDE.md` §3.1 **rule 5** (T-1479 신설) 의 첫 적용 사례다 — ADR 본문의 **표기 정규화** 는 결정 내용 변경이 아니므로 `direct`.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 행 · 108 행 · 109 행 · 140 행 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6936 행 (T-1479 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.74` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.76` 의 조문 `R1` ~ `R7` 과 AC 3 (적용 범위 · 발효)** (**6862 ~ 6878 행**) — 본 slice 가 집행하는 **정본**. 특히 `R1` (구분자 `~` 단일화) · `R5` (`L` prefix 조건부) · `R6` (병기 화법) · `R7` (시점 기록 면제) 4 조.
  - **`§ 12.75` AC 4 분해안 표의 S3 행** (**6820 행**) 과 **(b) 전면 소급 치환 금지 판정** (**6812 행**) — 본 slice 의 범위 · 파일 수 · mode 근거이자 한정 소급의 제약.
  - **`### 12.77` 의 파생 영향 1 구** (**6936 행 부근**) — S3 규모 (ADR **10 파일**) 와 3 파일 재분할 지시.
  - **`## 11. References`** 좌표 (**현재 6923 행 부근** — `§ 12.78` 삽입 위치 경계, AC 5 에서 재실측).
- `docs/decisions/ADR-0001-stack.md` — 구분자가 en dash 인 후보 **4 행 (20 · 21 · 138 · 139 행)** 과 그 행의 문맥 1 행씩만 연다. 문서 전체 열람 금지.
- `docs/decisions/ADR-0002-db.md` — 후보 **2 행 (119 · 120 행)** 만.
- `docs/decisions/ADR-0003-deployment.md` — 후보 **5 행 (20 · 21 · 23 · 24 · 168 행)** 만.
- `CLAUDE.md` — **§3.1 rule 5** (**142 행**, T-1479 신설분) 만. mode 판정 근거. **편집 대상 아님**.
- **다른 ADR 7 파일 · 5 문서군의 나머지 파일은 열지 않는다** — batch 2 이후 몫이며 본 slice 에서 열면 파일 수 검산이 흐려진다.

## Acceptance Criteria

- [ ] **AC 1 — 한정 소급 정합 판정 (2 ~ 3 구)**: 본 slice 의 편집이 `§ 12.76` AC 3 ③ ("신규 작성분부터 적용 · 전면 소급 치환 금지 · 소급은 **이미 어긋남이 확인된 좌표에 한정**") 과 정합함을 판정해 적는다. 판정은 다음을 포함한다 — ① 허용 근거: `§ 12.75` 분해안이 S3 를 **slice 로 사전 승인** 했고 본 slice 의 census (AC 2) 가 좌표를 **파일 · 행 단위로 특정** 하므로 "확인된 좌표" 요건을 충족한다. ② 금지선: **91 행 일괄 치환은 여전히 금지** 이며 본 slice 는 3 파일 밖으로 나가지 않는다. ③ mode 근거: `CLAUDE.md` §3.1 **rule 5** (비-결정 수정 = `direct`) 의 첫 적용이며 ADR 의 Decision · Consequences **실질은 무편집**.
  - 판정이 **불허** 로 결론나면 편집을 **0 건** 으로 두고 그 사유를 audit 절에 박제한 뒤 slice 를 판정 산출만으로 마감한다 (그 경우 AC 3 · AC 4 는 "편집 0" 으로 충족).
- [ ] **AC 2 — 혼용 ADR census 재실측 + 3 파일 선정 근거 (표 1 개)**: 다음 2 명령을 그대로 실행해 집계값을 박제한다.
  - `grep -lE '[0-9]+ *– *[0-9]+' docs/decisions/ADR-*.md` 각 파일에 대해 en dash hit 수와 `~` hit 수를 함께 세어 **혼용 (둘 다 1 이상) 파일 목록** 을 확정하고 `§ 12.77` 의 **10 파일** 과 대조한다 (불일치 시 그 사유 1 구).
  - `grep -lE 'L[0-9]+-[0-9]+' docs/decisions/ADR-*.md` 로 `R5` 대상 파일도 함께 집계하되 **본 batch 의 편집 대상에는 넣지 않는다** (batch 2 몫임을 1 구 명시).
  - 본 batch 3 파일 (`ADR-0001` · `ADR-0002` · `ADR-0003`) 선정 근거를 1 구 — 셋 다 혼용 확정이고, `§ 12.73` 정정 축이 이미 편집한 동일 파일군이라 diff 검산 비용이 최소이며, constraint 근거 ADR 3 종이라 인용 빈도가 가장 높다.
- [ ] **AC 3 — 행별 면제 판별 후 in-place 정규화 (11 후보 행)**: 후보 11 행 (`ADR-0001` 4 · `ADR-0002` 2 · `ADR-0003` 5) 각각에 대해 **정정 / 면제** 를 판별하고 대조표에 남긴다.
  - **면제 판별 기준** — `R6`: 타 문서가 쓴 표기를 원문 그대로 인용한 경우 무편집. `R7`: 날짜 · 판정 시점 stamp 가 박혔거나 당시 판의 증거로 기능하는 문장은 무편집.
  - 정정분은 **구분자만** `~` 로 바꾼다 — 숫자 · 단위어 (`행`) · 링크 · 앞뒤 서술은 **건드리지 않는다**. 단일 행이 된 경우가 있으면 `R4` (`N 행`) 를 함께 적용한다.
  - 정정 후 **각 파일의 행 수 불변** (`wc -l` 전후 동일) 과 **en dash hit 수 0 또는 면제분과 동수** 를 재실측해 적는다.
- [ ] **AC 4 — 결정 내용 무편집 검산**: `git diff` 상 3 ADR 의 변경이 **구분자 치환뿐** 임을 확인해 1 구 적는다 — 추가 행 수 = 삭제 행 수, 각 hunk 가 후보 11 행 안에 있음, `## Decision` · `## Consequences` · `## Alternatives` 의 **문장 실질 변경 0**, ADR 의 `Status` 행 무편집.
- [ ] **AC 5 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.78`** 을 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.77` 파생 1 순위 S3 · 첫 batch) → AC 1 한정 소급 판정 → census 표 (파일 · en dash · `~` · 혼용 여부) → **행별 대조표** (파일 · 행 · 정정 / 면제 · 근거 조문) → 진척 · 한계 → 파생 영향 (목록만 — batch 2 대상 파일 후보 포함). **절 ≤ 60 행** — 초과 예상 시 census 표를 집계값 1 구로 압축하고 그 사유를 박제한다.
- [ ] **AC 6 — 자기 준수 + 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - **자기 준수** — 신규 추가분 대상 `git diff -U0 <5 파일> | grep '^+' | grep -cE '[0-9]+ *– *[0-9]+|L[0-9]+-[0-9]+'` 집계값 박제. `R6` 인용 원문은 예외이므로 hit 이 0 이 아니면 그 내역을 1 구 밝힌다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**6936 → 6936 + 신설 행수**).
  - `git diff --stat` 이 **정확히 5 파일 · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + `### 12.7x` heading 순번 연속 (`12.77` → `12.78`) + 3 ADR 각각의 `## ` heading 수 **불변** + 링크 개수 불변 (`grep -c '](' <파일>` 전후 동일).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **batch 2 이후 파일 착수 금지** — 혼용 ADR 나머지 7 파일과 `R5` (`L` prefix) 대상 파일은 열지도 고치지도 않는다. 본 slice 의 파일 수 검산 (5) 을 깬다.
- **5 문서군의 비-ADR 파일 정규화 금지** — `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` 는 무편집.
- **ADR 결정 내용 변경 금지** — Decision · Consequences · Alternatives · Status 의 실질을 바꾸지 않는다. 바꾸고 싶은 지점이 보이면 Follow-ups 에만 적는다 (`pr` mode 대상이라 §3.1 rule 3 split 필요).
- **조문 재설계 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. `R2` · `R3` 병합 후보 (`§ 12.77` 파생 3) 착수 금지.
- **`§ 12.77` 및 그 이전 audit 절 편집 금지** — append-only (`§ 12.15`). 산출은 `§ 12.78` 신설로만.
- **pointer 재판정 · 재정정 금지** — `§ 12.68` ~ `§ 12.71` 의 판정과 `§ 12.73` · `§ 12.74` 의 11 행 정정을 다시 다투지 않는다. 본 slice 는 **구분자** 만 본다.
- **`CLAUDE.md` 편집 금지** — rule 5 는 근거로 **참조만** 한다. 회색지대 예시 보강 (`§ 12.77` 파생 2) 은 선례 2 건 이상 축적 후.
- **S4 (`docs/architecture/` 규약 문서 신설) 착수 금지** — `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **S3 batch 2** — 혼용 ADR 잔여 7 파일 중 3 파일 (`R5` `L` prefix 대상 파일 우선 후보 — `L` 과 `~` 를 함께 쓰는 파일은 `R1` · `R5` 이중 위반이라 이득이 크다).
- **S3 batch 3 이후** — 5 문서군 중 ADR 이외 혼용 파일 (`§ 12.77` 실측 **17 파일** 에서 ADR **10 파일** 을 뺀 잔여). 착수 전 `§ 12.76` AC 3 ② 적용 범위 재확인 필요.
- **rule 5 회색지대 예시 보강** — 본 slice 가 rule 5 의 **첫 적용 선례** 이므로 선례 2 건째가 쌓이면 `CLAUDE.md` §3.1 rule 5 에 예시 1 행을 덧댄다.
- **`R2` · `R3` 병합 후보 (낮음)** — `§ 12.77` 파생 (3) 그대로 이월.
- **anchor 좌표계 이행 FU14 (낮음 유지)** — 이행 시 구분자 규약 자체가 anchor 표기에 흡수될 수 있다. 관계 언급까지만.
