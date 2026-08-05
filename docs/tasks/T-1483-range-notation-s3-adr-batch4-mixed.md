---
id: T-1483
title: 범위 표기 규약 축 S3 batch 4 — 잔여 혼용 ADR 3 파일 (`ADR-0018` · `ADR-0033` · `ADR-0035`) R1·R5 정규화 (audit §12.81)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1482]
touchesFiles:
  - docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md
  - docs/decisions/ADR-0033-evaluation-result-persistence.md
  - docs/decisions/ADR-0035-aggregate-summary-evaluation.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1483-range-notation-s3-adr-batch4-mixed.md
plannerNote: "uc-doc-audit-resync 95 번째 slice — §12.80 파생 (1) 1 순위 S3 batch 4. 잔여 혼용 ADR 3 파일 · 후보 38 행 / 54 좌표 R1+R5 정규화, direct 5 파일"
---

# T-1483 — 범위 표기 규약 S3 batch 4: 잔여 혼용 ADR 3 파일 정규화

## Why

[T-1482](T-1482-range-notation-s3-adr-batch3-mixed.md) 가 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.80` 으로 S3 batch 3 (`ADR-0008` · `ADR-0013` · `ADR-0014` · 정정 34 행 / 42 좌표) 을 마감했다. 그 절의 **파생 영향 (1)** 이 남긴 **1 순위** 가 **S3 batch 4 = 잔여 혼용 ADR 3 파일 (`ADR-0018` · `ADR-0033` · `ADR-0035`) 또는 en dash 단독 3 파일** 이며, 본 task 는 **잔여 혼용 3 파일** 을 택해 집행한다 — 셋 다 `L` prefix 와 en dash 를 동시에 보유해 batch 2 · batch 3 과 **동형의 `R1` + `R5` 이중 slice** 이고, en dash 단독 군보다 판정 선례 (`§ 12.79` · `§ 12.80`) 의 재사용도가 높다.

본 batch 는 앞 batch 에 없던 **회색지대 3 종** 을 실제로 만난다 — ① **개구간 표기** (`ADR-0033`:140 의 `L274~` 처럼 끝 좌표가 없는 형태), ② **양끝 prefix 병기** (`ADR-0035` 의 `L61~L63`), ③ **코드 파일을 가리키는 좌표** (`prisma/schema.prisma` · `src/user/assessment.service.ts` 대상). ③ 은 `§ 12.76 R5` 본문이 "문서 · 코드 구분 없이 `N 행`" 으로 이미 명문화했으므로 새 판정이 아니고, ① · ② 는 조문 명문이 없어 **최소 변경 원칙** 으로 처리 후 파생 영향에 넘긴다 (`§ 12.80` 한계 5 의 복수 좌표 병기 처리와 동형).

commit mode 는 [CLAUDE.md](../../CLAUDE.md) §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 비-결정 수정 = `direct`) 의 **네 번째 적용 선례** 다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행이 불가하므로 (T-1482 Why 승계) 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **7101 행 (T-1482 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.79` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.76` 의 조문 `R1` ~ `R7`** (**6862 ~ 6868 행**) 과 **AC 3 ② · ③ (적용 범위 · 발효)** (**6876 · 6878 행**) — 본 slice 가 집행하는 **정본**. 특히 `R1` (구분자 `~`) · `R4` (단일 행) · `R5` (`L` prefix — "문서 · 코드 구분 없이" 문언 포함) · `R6` (불연속 병기 · 인용된 원문 표기는 `R1` 대상 아님) · `R7` (시점 기록 면제).
  - **`### 12.80` 의 AC 2 · AC 3 · 한계 5** (**7048 · 7052 ~ 7056 · 7082 행**) — 행 수 ≠ 좌표 수 (하한) 인정, `~` raw hit 의 수량 · 식별자 판별, 복수 좌표 병기 최소 변경 선례.
  - **`§ 12.80` 파생 영향 (1)** (**7084 행**) — 본 slice 의 대상 선정 근거.
  - **`## 11. References`** 좌표 (**현재 7088 행** — `§ 12.81` 삽입 위치 경계, AC 6 에서 재실측).
- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — 후보 **5 행 (31 · 32 · 33 · 184 · 186 행)** 과 각 행 문맥 1 행씩만. 문서 전체 열람 금지.
- `docs/decisions/ADR-0033-evaluation-result-persistence.md` — 후보 **8 행 (17 · 21 · 31 · 32 · 62 · 74 · 140 · 145 행)** 만.
- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — 후보 **25 행 (23 · 27 · 28 · 37 · 38 · 39 · 47 · 57 · 72 · 76 · 82 · 83 · 84 · 87 · 98 · 116 · 129 · 136 · 140 · 155 · 173 · 177 · 179 · 180 · 195 행)** 만. 본 파일이 전체 후보의 과반 (좌표 **36 / 54**) 이라 cap 감시 대상 (AC 1 ④).
- `CLAUDE.md` — **§3.1 rule 5** (**142 행**) 만. mode 판정 근거. **편집 대상 아님**.
- **다른 ADR · 5 문서군의 나머지 파일은 열지 않는다** — batch 5 이후 몫이며 본 slice 에서 열면 파일 수 검산이 흐려진다.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정 (3 ~ 4 구)**: ① **선정 근거** — `§ 12.80` 파생 (1) 의 두 후보군 (잔여 혼용 3 · en dash 단독 3) 중 **혼용 3 파일** 을 택한 사유 (`R1` + `R5` 이중 slice 동형 · 선례 재사용도) 를 적는다. ② **한정 소급 준수** — AC 2 census 가 대상을 파일 · 행 단위로 특정하므로 `§ 12.76` AC 3 ③ 의 "이미 어긋남이 확인된 좌표에 한정" 을 충족하며 **전면 일괄 치환은 여전히 금지**, 3 파일 밖 무편집. ③ **mode 근거** — `CLAUDE.md` §3.1 rule 5 의 **네 번째 적용 선례** 이며 ADR 의 Decision · Consequences · Alternatives · `Status` 실질은 무편집. ④ **cap 가드** — AC 2 실측 후 **정정 확정 좌표가 70 을 초과** 하거나 3 ADR 의 예상 diff 가 **250 LOC 을 넘길 것으로 보이면** `ADR-0035` 를 **batch 5 로 이월** 하고 본 slice 를 2 파일 (`ADR-0018` · `ADR-0033`) 로 마감한다 — 이월 시 사유 · 이월 대상 · 잔여 좌표 수를 audit 절과 Follow-ups 에 박제한다.
  - 판정이 **불허** 로 결론나면 편집을 **0 건** 으로 두고 사유를 audit 절에 박제한 뒤 판정 산출만으로 마감한다 (그 경우 AC 3 ~ AC 5 는 "편집 0" 으로 충족).
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구)**: `grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+' <3 파일>` 로 후보 행을, `grep -oE` 로 좌표 토큰을 재실측해 파일별 값을 박제하고 Required Reading 의 기준값 (**행 5 · 8 · 25 = 38**, **좌표 6 · 12 · 36 = 54**) 과 대조한다. 차이가 있으면 **실측값을 정본** 으로 삼고 차이 사유를 1 구 적는다.
  - 좌표 `~` hit 도 함께 실측하되 **수량 · 식별자 범위를 제외한 좌표 표기만** 계수한다 (`§ 12.79` AC 3 ① · `§ 12.80` AC 3 ① 판정 승계). `ADR-0035` 의 `L61~L63` 류는 **좌표 `~` 로 계수** 되므로 `R5` 존치 조건 판정 입력이 된다.
  - `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 값은 하한" 을 승계해 1 구 명시한다 (본 batch 는 `ADR-0035` 에서 그 격차가 특히 크다 — 25 행 / 36 좌표).
- [ ] **AC 3 — `R5` 존치 조건 연동 + 회색지대 3 종 판정 (2 ~ 3 구)**: ① 파일별 `L` prefix 를 **존치 / 정정** 중 무엇으로 판정하는지 근거와 함께 적는다 — 좌표 `~` 가 이미 있으면 존치 조건 불충족이고, 0 이더라도 본 slice 의 `R1` 정정이 좌표 `~` 를 유입시켜 존치 근거가 소멸한다는 batch 2 · 3 선례 (`§ 12.79` AC 3 ② · `§ 12.80` AC 3 ②) 를 승계한다. ② **회색지대 3 종** 을 각각 1 구로 판정한다 — (가) **개구간** (`ADR-0033`:140 `L274~` 류): 끝 좌표가 없어 `R1` · `R4` 어느 조문에도 해당하지 않으므로 **`L` 만 제거** 하고 개구간 형태는 보존 (`274 행~` 또는 원문 구조 유지 중 최소 변경을 택하고 택한 형태를 박제). (나) **양끝 prefix 병기** (`L61~L63`): 구분자는 이미 `~` 라 `R1` 은 충족이고 `R5` 로 양끝 `L` 을 제거해 `61~63 행` 으로 맞춘다. (다) **코드 파일 대상 좌표** (`prisma/schema.prisma` · `src/user/assessment.service.ts`): `R5` 본문의 "문서 · 코드 구분 없이" 문언으로 **정정 대상** 이며, `§ 12.76` AC 3 ② 의 "코드 주석 · 코드 내 문자열은 범위 밖" 은 **표기가 실린 위치** 기준이라 본 건 (ADR 본문에 실린 표기) 과 충돌하지 않음을 1 구 밝힌다.
  - `§ 12.76 R5` 예시의 존치 파일 목록이 본 slice 로 추가 stale 해지는지 1 구 대조한다 (조문 **본문은 편집 금지** · 파생 영향에 후보 이월 — `§ 12.79` AC 3 ③ 과 동일 처리).
- [ ] **AC 4 — 행별 면제 판별 후 in-place 정규화 (실측 확정 후보 행)**: 후보 각 행에 대해 **정정 / 면제 / 범위 밖** 을 판별하고 대조표에 남긴다 (유형별 압축 허용).
  - **면제 판별 기준** — `R7`: 날짜 · 판정 시점 stamp 가 박혔거나 당시 판의 증거로 기능하는 문장은 무편집. `R6`: 인라인 괄호로 병기된 **인용 원문 표기** 는 `R1` 대상이 아니므로 무편집. `ADR-0035`:195 (P7 backlog 항목) 처럼 시점성이 의심되는 행은 **명시 판별 의무**.
  - 정정분은 **구분자와 `L` prefix 만** 바꾼다 — 숫자 · 링크 target (`](...)` 안) · 앞뒤 서술은 건드리지 않는다. `L` 제거 시 단위어 `행` 을 붙여 `341~355 행` 형태로 맞추고, **단일 행 (`L40`) 은 `R4` 를 적용해 `40 행`** 으로 적는다 (`40~40` 금지). `L` 제거로 조사가 비문이 되면 조사 1 자 보정은 허용하되 그 건수를 AC 5 에 박제한다.
  - **링크 텍스트 안의 좌표** (`[README.md L9–22](../../README.md)` 류) 도 표기이므로 정정 대상이나, **링크 URL 부분은 절대 건드리지 않는다** — 정정 전후로 `grep -c '](' <파일>` 값이 불변임을 AC 7 에서 검산한다.
  - **규약 범위 밖 판정 유지** — 수량 범위 (`0~3` 류) 와 식별자 범위 (`R-99~103` · `REQ-005~008` · `ADR-0032~0035` 류) · frontmatter `date:` 값은 좌표 표기가 아니므로 `§ 12.80` AC 3 ① 선례를 승계해 **무편집** 임을 1 구 적는다.
  - 정정 후 **각 파일의 행 수 불변** (`wc -l` 전후 동일) 과 **`L` prefix · en dash 잔존 수 = 면제 · 범위 밖 판정분과 동수** 를 재실측해 적는다.
- [ ] **AC 5 — 결정 내용 무편집 검산 (1 구)**: `git diff --numstat` 상 대상 ADR 의 **추가 행 수 = 삭제 행 수**, 모든 hunk 가 AC 4 대조표 행 안에 있음, `## Decision` · `## Consequences` · `## Alternatives` 의 **문장 실질 변경 0**, frontmatter `status` · `date` 행 무편집을 확인해 적는다. `git diff --word-diff` 의 변경 토큰이 **구분자 · `L` prefix · 단위어 `행` · (허용된) 조사 보정** 뿐임을 함께 박제한다.
- [ ] **AC 6 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.81`** 을 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.80` 파생 1 순위 S3 batch 4) → AC 1 선정 · 한정 소급 · mode · cap 판정 → AC 2 census 재실측 → AC 3 `R5` 연동 + 회색지대 3 종 판정 → **행별 대조표** (파일 · 행 · 원 표기 · 판정 · 근거 조문) → AC 5 무편집 검산 → 진척 · 한계 (**`R5` 잔여 파일 수 갱신 의무** — `§ 12.80` 한계 1 의 26 파일에서 본 batch 처리분을 뺀 값) → 파생 영향 (목록만 · batch 5 후보 포함). **절 ≤ 60 행** — 초과 예상 시 대조표를 유형별로 압축하고 사유를 박제한다.
- [ ] **AC 7 — 자기 준수 + 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - **자기 준수** — 신규 추가분 대상 `git diff -U0 <대상 파일> | grep '^+' | grep -cE '[0-9]+ *– *[0-9]+|L[0-9]+'` 집계값 박제. 대조표의 **원 표기 인용** (`R6`) 은 예외이므로 hit 이 0 이 아니면 내역을 1 구 밝힌다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**7101 → 7101 + 신설 행수**).
  - `git diff --stat` 이 **정확히 5 파일 (AC 1 ④ 이월 시 4 파일) · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + heading 순번 연속 (`12.80` → `12.81`) + 대상 ADR 각각의 `## ` heading 수 **불변** + 링크 개수 불변 (`grep -c '](' <파일>` 전후 동일 — 편집 전 값을 먼저 실측해 기준으로 삼는다).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **batch 5 이후 파일 착수 금지** — en dash 단독 ADR (`ADR-0016` · `ADR-0017` · `ADR-0021`) 과 `L` 잔존 나머지 ADR 은 열지도 고치지도 않는다. 본 slice 의 파일 수 검산을 깬다.
- **5 문서군의 비-ADR 파일 정규화 금지** — `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` (특히 `L` 보유 `directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 는 **무편집**.
- **ADR 결정 내용 변경 금지** — Decision · Consequences · Alternatives · Status 의 실질을 바꾸지 않는다. 바꾸고 싶은 지점이 보이면 Follow-ups 에만 적는다 (`pr` mode 대상이라 §3.1 rule 3 split 필요).
- **좌표가 가리키는 대상 파일 편집 금지** — `prisma/schema.prisma` · `src/user/assessment.service.ts` · `README.md` 는 참조 대상일 뿐 **열지도 고치지도 않는다** (`pr` mode 유발).
- **조문 재설계 · 조문 본문 편집 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. 회색지대 3 종에 조문을 신설하고 싶어도 **본 slice 에서는 판정만** 하고 조문화는 파생 영향으로 넘긴다 (`§ 12.15` append-only).
- **`§ 12.80` 및 그 이전 audit 절 편집 금지** — 집계 정정이 필요해도 `§ 12.81` 안에서 선언만 한다.
- **pointer 좌표 값 재검증 · 재정정 금지** — `L` 좌표가 가리키는 **값의 정확성** 은 `§ 12.74` 판정을 승계하고 다시 다투지 않는다. 본 slice 는 **표기 형식** 만 본다.
- **수량 · 식별자 범위 치환 금지** — `0~3` · `R-99~103` 류는 좌표 표기가 아니므로 손대지 않는다 (판정 1 구만).
- **`CLAUDE.md` 편집 금지** — rule 5 는 근거로 **참조만**.
- **S4 (`docs/architecture/` 규약 문서 신설) 착수 금지** — `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **S3 batch 5 후보** — en dash 단독 ADR (`ADR-0016` · `ADR-0017` · `ADR-0021`). AC 1 ④ cap 가드 평가 결과 **이월 0** (좌표 54 ≤ 70 · diff 250 LOC 미만) 으로 `ADR-0035` 는 본 slice 에서 마감했다 — `§ 12.81` 파생 (1) 의 1 순위.
- **개구간 표기 형태 정합** — 본 slice 가 처음 도입한 `274 행~` (끝 좌표 없는 개구간) 형태를 후속 slice 가 그대로 승계하는지 감시. 불일치 발생 시 `R8` 조문화 판단에 함께 묶는다 (`§ 12.81` 한계 5).
- **회색지대 조문화 판단** — 개구간 (`274 행~`) · 양끝 prefix 병기 · 복수 좌표 병기 (`85/88 행`, `§ 12.80` 한계 5) 3 종을 `R8` 로 묶어 조문화할지 여부. 선례가 2 ~ 3 slice 더 쌓인 뒤 판단.
- **`§ 12.76 R5` 예시 갱신** — 존치 파일 목록 (`p3-implementation-plan.md` · `ADR-0005` · `reviewer.md`) 의 stale 이 `§ 12.79` 파생 (3) 부터 이월 중. 조문 편집이라 별도 slice 에서 append-only 준수 방식과 함께 판단.

## 완료 요약 (2026-08-05)

- 혼용 ADR 3 파일(`ADR-0018` · `ADR-0033` · `ADR-0035`) 후보 **38 행 / 54 좌표 전량 정정** (면제 0 · 범위 밖 15 좌표). 파일별 추가 = 삭제 (5/8/25) 로 결정 내용 무편집 검산 통과.
- cap 가드 평가: 정정 좌표 54 ≤ 70, diff +95/-39 ≤ 250 LOC → **batch 5 이월 0**.
- 회색지대 3 종(개구간 · 양끝 prefix · 코드 파일 대상 좌표) 첫 실판정 수행, audit `§ 12.81` 신설(54 행, 7101 → 7156 행).
- 5 파일 +95/-39, direct commit `55bda9e4` main push. doc-only 라 `pnpm test` 면제 (CLAUDE.md §3.2).
