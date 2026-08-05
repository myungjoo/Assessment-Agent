---
id: T-1482
title: 범위 표기 규약 축 S3 batch 3 — 잔여 혼용 ADR 3 파일 (`ADR-0008` · `ADR-0013` · `ADR-0014`) R1·R5 정규화 (audit §12.80)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 140
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1481]
touchesFiles:
  - docs/decisions/ADR-0008-auth-credential-type.md
  - docs/decisions/ADR-0013-confluence-space-traversal-policy.md
  - docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1482-range-notation-s3-adr-batch3-mixed.md
plannerNote: "uc-doc-audit-resync 94 번째 slice — §12.79 파생 (1) 1 순위 S3 batch 3. 혼용 ADR 3 파일 · 후보 35 행 R1+R5 정규화, direct 5 파일"
---

# T-1482 — 범위 표기 규약 S3 batch 3: 잔여 혼용 ADR 3 파일 정규화

## Why

[T-1481](T-1481-range-notation-s3-adr-batch2-l-prefix.md) 이 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.79` 로 S3 batch 2 (`R1` · `R5` 이중 대상 ADR 3 파일 · 치환 29 행) 를 마감했다. 그 절의 **파생 영향 (1)** 이 남긴 **1 순위** 가 **S3 batch 3 = 잔여 혼용 ADR 중 3 파일** 이며, 본 task 는 그 지목을 ID 순 (`ADR-0008` · `ADR-0013` · `ADR-0014`) 으로 집행한다.

batch 3 의 설계 전제는 **batch 2 가 실측으로 정정한 census** 다 — `§ 12.79` AC 2 정정 (1) 이 `L` prefix 보유 ADR 을 **2 파일이 아니라 31 파일** 로 바로잡았고, 본 batch 3 파일도 `L` 보유량이 각각 **15 · 13 · 7 행** 이라 batch 1 (`R1` 단독) 이 아니라 **batch 2 와 동형의 `R1` + `R5` 연동 slice** 다. 따라서 후보를 en dash 행으로만 좁히면 같은 파일 안에 정정분과 미정정분이 공존해 `R5` 존치 판정 자체가 성립하지 않는다 (`§ 12.79` AC 2 정정 (2) 의 논거 승계) — 대상은 **3 파일 안의 후보 행 전량**, **파일 경계는 불변** 이다.

commit mode 는 [CLAUDE.md](../../CLAUDE.md) §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 비-결정 수정 = `direct`) 의 **세 번째 적용 선례** 다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 행 · 108 행 · 109 행 · 140 행 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **7047 행 (T-1481 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.78` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.76` 의 조문 `R1` ~ `R7`** (**6862 ~ 6868 행**) 과 **AC 3 ② · ③ (적용 범위 · 발효)** (**6876 · 6878 행**) — 본 slice 가 집행하는 **정본**. 특히 `R1` (구분자 `~`) · `R4` (단일 행) · `R5` (`L` prefix 존치 조건) · `R6` (인용 원문 면제) · `R7` (시점 기록 면제).
  - **`### 12.79` 의 AC 2 정정 (1) · (2)** (**6995 · 6997 행**) 과 **AC 3 ① · ②** (**7001 · 7003 행**) — 본 slice 의 대상 확장 논거 (`~` 유입 시 `R5` 존치 근거 소멸 · 후보를 파일 전량으로) 의 직접 선례.
  - **`§ 12.79` 파생 영향 (1)** (**7032 행**) — 본 slice 의 대상 선정 근거.
  - **`## 11. References`** 좌표 (**현재 7034 행** — `§ 12.80` 삽입 위치 경계, AC 6 에서 재실측).
- `docs/decisions/ADR-0008-auth-credential-type.md` — 후보 **15 행 (17 · 25 · 30 · 31 · 32 · 33 · 41 · 149 · 156 · 173 · 179 · 180 · 181 · 182 · 183 행)** 과 각 행 문맥 1 행씩만. 문서 전체 열람 금지.
- `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` — 후보 **13 행 (14 · 20 · 28 · 29 · 30 · 40 · 50 · 56 · 78 · 101 · 103 · 110 · 112 행)** 만.
- `docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md` — 후보 **7 행 (14 · 16 · 43 · 114 · 118 · 119 · 120 행)** 만.
- `CLAUDE.md` — **§3.1 rule 5** (**142 행**) 만. mode 판정 근거. **편집 대상 아님**.
- **다른 ADR · 5 문서군의 나머지 파일은 열지 않는다** — batch 4 이후 몫이며 본 slice 에서 열면 파일 수 검산이 흐려진다.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 정합 판정 (2 ~ 3 구)**: ① **선정 근거** — `§ 12.79` 파생 (1) 이 지목한 "잔여 혼용 ADR 중 3 파일" 을 ID 순으로 취했음을 적는다. ② **한정 소급 준수** — AC 2 census 가 대상을 파일 · 행 단위로 특정하므로 `§ 12.76` AC 3 ③ 의 "이미 어긋남이 확인된 좌표에 한정" 을 충족하며 **전면 일괄 치환은 여전히 금지**, 3 파일 밖 무편집. ③ **mode 근거** — `CLAUDE.md` §3.1 rule 5 의 **세 번째 적용 선례** 이며 ADR 의 Decision · Consequences · Alternatives · `Status` 실질은 무편집.
  - 판정이 **불허** 로 결론나면 편집을 **0 건** 으로 두고 사유를 audit 절에 박제한 뒤 판정 산출만으로 마감한다 (그 경우 AC 3 ~ AC 5 는 "편집 0" 으로 충족).
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구)**: `grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+' <3 파일>` 로 후보 행을 재실측해 파일별 hit 수를 박제하고 위 Required Reading 의 기준값 (**15 · 13 · 7 = 35 행**) 과 대조한다. 차이가 있으면 **실측값을 정본으로** 삼고 차이 사유 (grep 패턴 · 행 단위 하한) 를 1 구 적는다.
  - 좌표 `~` hit 도 함께 실측한다 (`grep -cE '[0-9]+ *~ *[0-9]+'` 후 **수량 · 식별자 범위를 제외한 좌표 표기만** 계수 — `§ 12.79` AC 3 ① 이 확정한 판정 입력). 기준 참고값 (raw grep): `ADR-0008` **1** · `ADR-0013` **1** · `ADR-0014` **3**.
  - `§ 12.79` 한계 3 (grep 행 단위라 한 행 2 hit 이면 1 로 계수 → 파일별 값은 **하한**) 을 승계해 **행 수 ≠ 좌표 수** 임을 1 구 명시한다.
- [ ] **AC 3 — `R5` 존치 조건 연동 판정 (1 ~ 2 구)**: 파일별로 `L` prefix 를 **존치 / 정정** 중 무엇으로 판정하는지 근거와 함께 적는다. 좌표 `~` 가 이미 있으면 존치 조건 불충족이고, 0 이더라도 본 slice 의 `R1` 정정이 좌표 `~` 를 유입시켜 존치 근거가 소멸하므로 (`§ 12.76` 한계 3 · `§ 12.79` AC 3 ②) **정정** 이 규약 정합이라는 batch 2 선례를 그대로 승계함을 밝힌다. 반대 결론을 택하는 파일이 있으면 사유를 명시하고 편집 대상에서 제외한다.
  - `§ 12.76 R5` 예시의 존치 파일 목록이 본 slice 로 추가 stale 해지는지 1 구 대조한다 (조문 **본문은 편집 금지** · 파생 영향에 후보 이월 — `§ 12.79` AC 3 ③ 과 동일 처리).
- [ ] **AC 4 — 행별 면제 판별 후 in-place 정규화 (실측 확정 후보 행)**: 후보 각 행에 대해 **정정 / 면제 / 범위 밖** 을 판별하고 대조표에 남긴다.
  - **면제 판별 기준** — `R6`: 타 문서 표기를 원문 그대로 인용한 경우 무편집. `R7`: 날짜 · 판정 시점 stamp 가 박혔거나 당시 판의 증거로 기능하는 문장은 무편집. `ADR-0008`:149 (CI lint 회차 기록의 `L60` · `L230`) 은 `R7` 후보이므로 **명시 판별 의무**.
  - 정정분은 **구분자와 `L` prefix 만** 바꾼다 — 숫자 · 링크 target · 앞뒤 서술은 건드리지 않는다. `L` 제거 시 단위어 `행` 을 붙여 `80~86 행` 형태로 맞추고, **단일 행 (`L34`) 은 `R4` 를 적용해 `34 행`** 으로 적는다 (`34~34` 금지). `L` 제거로 조사가 비문이 되면 조사 1 자 보정은 허용하되 그 건수를 AC 5 에 박제한다.
  - **규약 범위 밖 판정 유지** — 수량 범위 (`100~200명` 류) 와 식별자 범위 (`R-99~103` · `REQ-005~008` · `ADR-0001~0003` 류) 는 좌표 표기가 아니므로 `§ 12.79` AC 3 ① · 대조표 6 행의 선례를 승계해 **무편집** 임을 1 구 적는다.
  - 정정 후 **각 파일의 행 수 불변** (`wc -l` 전후 동일) 과 **`L` prefix · en dash 잔존 수 = 면제 · 범위 밖 판정분과 동수** 를 재실측해 적는다.
- [ ] **AC 5 — 결정 내용 무편집 검산 (1 구)**: `git diff --numstat` 상 3 ADR 의 **추가 행 수 = 삭제 행 수**, 모든 hunk 가 AC 4 대조표 행 안에 있음, `## Decision` · `## Consequences` · `## Alternatives` 의 **문장 실질 변경 0**, ADR 의 `Status` 행 무편집을 확인해 적는다. `git diff --word-diff` 의 변경 토큰이 **구분자 · `L` prefix · 단위어 `행` · (허용된) 조사 보정** 뿐임을 함께 박제한다.
- [ ] **AC 6 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.80`** 을 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.79` 파생 1 순위 S3 batch 3) → AC 1 선정 · 한정 소급 · mode 판정 → AC 2 census 재실측 → AC 3 `R5` 연동 판정 → **행별 대조표** (파일 · 행 · 원 표기 · 판정 · 근거 조문 — 유형별 압축 허용) → AC 5 무편집 검산 → 진척 · 한계 (**`R5` 잔여 파일 수 갱신 의무** — `§ 12.79` 한계 1 의 28 파일에서 본 batch 처리분을 뺀 값) → 파생 영향 (목록만 · batch 4 후보 포함). **절 ≤ 60 행** — 초과 예상 시 census 를 집계값 1 구로 압축하고 사유를 박제한다.
- [ ] **AC 7 — 자기 준수 + 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - **자기 준수** — 신규 추가분 대상 `git diff -U0 <5 파일> | grep '^+' | grep -cE '[0-9]+ *– *[0-9]+|L[0-9]+'` 집계값 박제. 대조표의 **원 표기 인용** (`R6`) 은 예외이므로 hit 이 0 이 아니면 내역을 1 구 밝힌다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**7047 → 7047 + 신설 행수**).
  - `git diff --stat` 이 **정확히 5 파일 · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + `### 12.7x`/`12.80` heading 순번 연속 (`12.79` → `12.80`) + 3 ADR 각각의 `## ` heading 수 **불변** + 링크 개수 불변 (`grep -c '](' <파일>` 전후 동일 — 편집 전 값을 먼저 실측해 기준으로 삼는다).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **batch 4 이후 파일 착수 금지** — 잔여 혼용 ADR (`ADR-0018` · `ADR-0033` · `ADR-0035`) 과 en dash 단독 (`ADR-0016` · `ADR-0017` · `ADR-0021`), `L` 잔존 나머지 ADR 은 열지도 고치지도 않는다. 본 slice 의 파일 수 검산 (5) 을 깬다.
- **5 문서군의 비-ADR 파일 정규화 금지** — `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` (특히 `L` 보유 `directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 는 **무편집**.
- **ADR 결정 내용 변경 금지** — Decision · Consequences · Alternatives · Status 의 실질을 바꾸지 않는다. 바꾸고 싶은 지점이 보이면 Follow-ups 에만 적는다 (`pr` mode 대상이라 §3.1 rule 3 split 필요).
- **조문 재설계 · 조문 본문 편집 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. `R5` 예시가 본 slice 로 추가 stale 해져도 **`§ 12.76` 본문은 편집하지 않고** 파생 영향 이월로만 처리한다 (`§ 12.15` append-only).
- **`§ 12.79` 및 그 이전 audit 절 편집 금지** — 집계 정정이 필요해도 `§ 12.80` 안에서 선언만 한다.
- **pointer 좌표 값 재검증 · 재정정 금지** — `L` 좌표가 가리키는 **값의 정확성** 은 `§ 12.74` 판정을 승계하고 다시 다투지 않는다. 본 slice 는 **표기 형식** 만 본다.
- **수량 · 식별자 범위 치환 금지** — `100~200명` · `R-99~103` 류는 좌표 표기가 아니므로 손대지 않는다 (판정 1 구만).
- **`CLAUDE.md` 편집 금지** — rule 5 는 근거로 **참조만**. 회색지대 예시 보강은 선례 축적 후 별도 slice.
- **S4 (`docs/architecture/` 규약 문서 신설) 착수 금지** — `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9) — `ADR-0008` · `ADR-0014` 가 인증 · 자격증명 ADR 이라 특히 주의.
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)
