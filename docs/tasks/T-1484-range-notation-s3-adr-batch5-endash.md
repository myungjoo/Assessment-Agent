---
id: T-1484
title: 범위 표기 규약 축 S3 batch 5 — en dash 단독 ADR 3 파일 (`ADR-0016` · `ADR-0017` · `ADR-0021`) R1·R5 정규화 (audit §12.82)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 110
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1483]
touchesFiles:
  - docs/decisions/ADR-0016-github-adapter-http-transport-contract.md
  - docs/decisions/ADR-0017-github-instance-config-source.md
  - docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1484-range-notation-s3-adr-batch5-endash.md
plannerNote: "uc-doc-audit-resync 96 번째 slice — §12.81 파생 (1) 1 순위 S3 batch 5. en dash 단독 ADR 3 파일 · 후보 14 행 / 15 좌표 R1+R5 정규화, direct 5 파일"
---

# T-1484 — 범위 표기 규약 S3 batch 5: en dash 단독 ADR 3 파일 정규화

## Why

[T-1483](T-1483-range-notation-s3-adr-batch4-mixed.md) 가 [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.81` 로 S3 batch 4 (`ADR-0018` · `ADR-0033` · `ADR-0035` · 38 행 / 54 좌표 전량 정정) 를 마감하며 **혼용 ADR 재고를 0** 으로 만들었다. 그 절의 **파생 영향 (1)** 이 지목한 **1 순위** 가 **S3 batch 5 = en dash 단독 ADR 3 파일 (`ADR-0016` · `ADR-0017` · `ADR-0021`)** 이며, 본 task 가 그 지목을 그대로 집행한다.

본 batch 는 앞 4 batch 와 **판정 구조가 하나 다르다** — 3 파일 모두 정정 전 **좌표 `~` 가 0 건** 이라 `§ 12.76 R5` 의 **존치 조건 ("그 파일의 `~` 범위 표기가 0 건일 때만") 이 형식상 성립** 한다. 따라서 batch 4 (`§ 12.81` AC 3 ① — 처음부터 불충족이라 논거 불요) 와 달리, batch 2 · 3 이 세운 "`R1` 정정이 좌표 `~` 를 유입시켜 존치 근거가 소멸한다" 논거 (`§ 12.79` AC 3 ② · `§ 12.80` AC 3 ②) 를 **실제로 동원해야** 결론이 선다. 회색지대는 `§ 12.81` 이 세운 3 종 선례 (개구간 · 양끝 prefix 병기 · 코드 파일 대상 좌표) 로 대부분 흡수되고, 신규 변형 1 종 (**규약 적용 범위 밖 문서 (`docs/PLAN.md`) 를 가리키는 좌표**) 만 추가 판정한다.

commit mode 는 [CLAUDE.md](../../CLAUDE.md) §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 비-결정 수정 = `direct`) 의 **다섯 번째 적용 선례** 다. [PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151 행) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행이 불가하므로 (T-1483 Why 승계) 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **7156 행 (T-1483 후 실측)**. 다음 좌표만 연다. **`§ 12.15` · `§ 12.44` ~ `§ 12.80` 본문은 열지 않는다** (판정 재고 0 · 재판정 금지).
  - **`### 12.76` 의 조문 `R1` ~ `R7`** (**6862 ~ 6868 행**) 과 **AC 3 ② · ③ (적용 범위 · 발효)** (**6876 · 6878 행**) — 본 slice 가 집행하는 **정본**. 특히 `R1` (구분자 `~`) · `R4` (단일 행) · `R5` (`L` prefix + **존치 조건** 문언) · `R6` (인용된 원문 표기는 `R1` 대상 아님) · `R7` (시점 기록 면제).
  - **`### 12.81`** (**7088 ~ 7141 행**) — 직전 batch. 특히 **AC 3 ② 회색지대 3 종 판정** (개구간 · 양끝 prefix 병기 · **코드 파일 대상 좌표**) 과 **AC 2 census 방식** · **파생 영향 (1)** (**7139 행** — 본 slice 의 대상 선정 근거) · **한계 1** (`R5` 잔여 23 ADR · en dash 잔여 5 파일 — AC 6 에서 갱신할 기준값).
  - **`## 11. References`** 좌표 (**현재 7143 행** — `§ 12.82` 삽입 위치 경계, AC 6 에서 재실측).
- `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` — 후보 **4 행 (18 · 33 · 34 · 155 행)** 과 각 행 문맥 1 행씩만. 문서 전체 열람 금지.
- `docs/decisions/ADR-0017-github-instance-config-source.md` — 후보 **7 행 (16 · 30 · 31 · 37 · 38 · 39 · 130 행)** 만. 본 파일이 전체 후보의 과반 (좌표 **7 / 15**).
- `docs/decisions/ADR-0021-github-confluence-live-integration-test-contract.md` — 후보 **3 행 (35 · 36 · 37 행)** 만. 37 행은 복수 좌표 병기 (`L19–22, L33`).
- `CLAUDE.md` — **§3.1 rule 5** (**142 행**) 만. mode 판정 근거. **편집 대상 아님**.
- **다른 ADR · 5 문서군의 나머지 파일은 열지 않는다** — batch 6 이후 몫이며 본 slice 에서 열면 파일 수 검산이 흐려진다.

## 완료 요약 (2026-08-05)

**Status: DONE.** en dash 단독 ADR 3 파일의 후보 **14 행 / 15 좌표 전량 정정** (면제 0 · 범위 밖 raw `~` 5). census 는 기준값과 **차이 0** (행 4 · 7 · 3 / 좌표 4 · 7 · 4 / raw `~` 2 · 1 · 2 · 그중 **좌표 `~` 0 · 0 · 0**). `R5` 존치 조건이 **형식상 성립** 하는 첫 batch 라 `§ 12.79` · `§ 12.80` 의 "`R1` 정정이 `~` 를 유입시켜 존치 근거가 자기 소멸" 논거를 **실제 동원** 해 3 파일 모두 정정으로 확정했고, 회색지대 승계 2 종 (코드 파일 좌표 · 복수 병기) + **신규 변형 1 종** (규약 범위 밖 문서 `docs/PLAN.md` 를 가리키는 좌표 = 표기가 실린 위치 기준으로 정정 대상) 을 판정했다. 무편집 검산: `numstat` **14/14** (추가 = 삭제) · 행 수 불변 (172 · 139 · 187) · 링크 수 불변 (56 · 55 · 56) · `## ` heading 불변 (5 · 5 · 5) · `L` prefix · en dash 잔존 **0 · 0 · 0** · frontmatter · Decision · Consequences · Alternatives hunk **0** · 조사 보정 **0 건**. audit `§ 12.82` 신설 (**52 행** · `wc -l` 7156 → 7209 · `## 11. References` 직전). `git diff --stat` **5 파일 / 79 삽입 · 22 삭제** (cap 이내), 범위 밖 파일 변경 **0**. doc-only 라 `pnpm test` 면제 ([CLAUDE.md](../../CLAUDE.md) §3.2). 잔여 갱신: `L` 잔존 ADR **23 → 20**, en dash 잔여 ADR **5 → 2** (`ADR-0001` · `ADR-0003`).

## Acceptance Criteria

- [x] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정 (3 ~ 4 구)**: ① **선정 근거** — `§ 12.81` 파생 (1) 이 **1 순위로 지목한 en dash 단독 ADR 3 파일** 을 그대로 집행함을 적고, 3 파일 + audit + task = **정확히 5 파일** 이라 후보를 더 얹으면 cap 위반임을 1 구 밝힌다. ② **한정 소급 준수** — AC 2 census 가 대상을 파일 · 행 단위로 특정하므로 `§ 12.76` AC 3 ③ 의 "이미 어긋남이 확인된 좌표에 한정" 을 충족하며 **전면 일괄 치환은 여전히 금지**, 3 파일 밖 무편집. ③ **mode 근거** — `CLAUDE.md` §3.1 rule 5 의 **다섯 번째 적용 선례** 이며 ADR 의 Decision · Consequences · Alternatives · frontmatter `status` · `date` 실질은 무편집. ④ **cap 가드** — AC 2 실측 후 정정 확정 좌표가 **70 을 초과** 하거나 예상 diff 가 **250 LOC** 을 넘길 것으로 보이면 `ADR-0017` 을 **batch 6 으로 이월** 하고 2 파일로 마감한다 (기준값 15 좌표라 발동 가능성은 낮으나 절차는 `§ 12.81` AC 1 ④ 승계).
  - 판정이 **불허** 로 결론나면 편집을 **0 건** 으로 두고 사유를 audit 절에 박제한 뒤 판정 산출만으로 마감한다 (그 경우 AC 3 ~ AC 5 는 "편집 0" 으로 충족).
- [x] **AC 2 — 후보 census 재실측 (집계 1 구)**: `grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+' <3 파일>` 로 후보 행을, `grep -noE 'L?[0-9]+ *– *L?[0-9]+|L[0-9]+'` 로 좌표 토큰을 재실측해 파일별 값을 박제하고 Required Reading 의 기준값 (**행 4 · 7 · 3 = 14**, **좌표 4 · 7 · 4 = 15**) 과 대조한다. 차이가 있으면 **실측값을 정본** 으로 삼고 차이 사유를 1 구 적는다.
  - raw `~` 도 함께 실측하되 **수량 · 식별자 범위를 제외한 좌표 표기만** 계수한다 (`§ 12.79` AC 3 ① · `§ 12.80` AC 3 ① · `§ 12.81` AC 2 판정 승계). 기준값은 raw **2 · 1 · 2** 이며 그중 **좌표 `~` 는 0 · 0 · 0** 으로 예상된다 (`ADR-0001 ~ ADR-0015` 류 식별자 범위) — 이 값이 AC 3 ① 존치 판정의 **직접 입력** 이므로 토큰을 나열해 판별 근거를 남긴다.
  - `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 값은 하한" 을 승계해 1 구 명시한다 (본 batch 의 격차는 `ADR-0021`:37 1 곳 — 1 행 / 2 좌표).
- [x] **AC 3 — `R5` 존치 조건 실판정 + 회색지대 판정 (2 ~ 3 구)**: ① **존치 조건 실동원** — 본 batch 는 앞 4 batch 와 달리 정정 전 좌표 `~` 가 **0 건** 이라 `R5` 존치 조건이 **형식상 성립** 한다. 그럼에도 **정정** 으로 결론내는 근거를 `§ 12.79` AC 3 ② · `§ 12.80` AC 3 ② 선례 그대로 적는다 — 본 slice 의 `R1` 정정 (en dash → `~`) 이 좌표 `~` 를 유입시켜 존치 근거가 **자기 소멸** 하며, `R5` 존치 예시 목록 3 파일 (`p3-implementation-plan.md` · `ADR-0005` · `reviewer.md`) 에 본 3 파일이 **미포함** 이라는 두 축을 모두 밝힌다. 반대 결론 (존치) 이 나온 파일이 있으면 그 파일만 무편집으로 두고 사유를 박제한다.
  - ② **`§ 12.81` 회색지대 승계 2 종** — (다) **코드 파일 대상 좌표** (`ADR-0017`:37 ~ 39 의 `src/llm/llm-apikey-cipher.service.ts L48–73` 등) 는 `R5` 본문 "문서 · 코드 구분 없이" 로 **정정 대상** 이며 대상 코드 파일은 열지도 고치지도 않는다. **복수 좌표 병기** (`ADR-0021`:37 의 `L19–22, L33`) 는 `§ 12.80` 한계 5 의 최소 변경 처리를 승계해 **각 좌표를 개별 정정** 하고 병기 구조는 보존한다.
  - ③ **신규 변형 1 종 판정** — **규약 적용 범위 밖 문서를 가리키는 좌표** (`ADR-0016`:18 · 155 · `ADR-0017`:130 의 `[docs/PLAN.md L81](../PLAN.md)` — `docs/PLAN.md` 는 `§ 12.76` AC 3 ② 의 5 문서군 **밖**). `§ 12.81` 회색 (다) 와 동형으로 **표기가 실린 위치** (ADR 본문 = 범위 안) 기준이므로 **정정 대상** 임을 1 구 밝힌다. 링크 label 안이라 **URL 은 절대 무편집**.
  - ④ `§ 12.76 R5` 예시의 존치 파일 목록이 본 slice 로 **추가 stale** 해지는지 1 구 대조한다 (조문 **본문은 편집 금지** · 파생 영향에 이월 — `§ 12.79` AC 3 ③ · `§ 12.81` AC 3 ③ 동일 처리).
- [x] **AC 4 — 행별 면제 판별 후 in-place 정규화 (실측 확정 후보 행)**: 후보 각 행에 대해 **정정 / 면제 / 범위 밖** 을 판별하고 대조표에 남긴다 (유형별 압축 허용).
  - **면제 판별 기준** — `R7`: 날짜 · 판정 시점 stamp 가 박혔거나 당시 판의 증거로 기능하는 문장은 무편집. `R6`: 인라인 괄호로 병기된 **인용 원문 표기** 는 `R1` 대상이 아니므로 무편집. 각 파일의 `## 참고` · References 목록 행 (`ADR-0016`:155 · `ADR-0017`:130) 은 시점성이 의심되므로 **명시 판별 의무**.
  - 정정분은 **구분자와 `L` prefix 만** 바꾼다 — 숫자 · 링크 target (`](...)` 안) · 앞뒤 서술은 건드리지 않는다. `L` 제거 시 단위어 `행` 을 붙여 `7~18 행` 형태로 맞추고, **단일 행 (`L81` · `L33`) 은 `R4` 를 적용해 `81 행`** 으로 적는다 (`81~81` 금지). `L` 제거로 조사가 비문이 되면 조사 1 자 보정은 허용하되 그 건수를 AC 5 에 박제한다.
  - **링크 텍스트 안의 좌표** (`[docs/PLAN.md L81](../PLAN.md)` 류) 도 표기이므로 정정 대상이나, **링크 URL 부분은 절대 건드리지 않는다** — 정정 전후로 `grep -c '](' <파일>` 값이 불변임을 AC 7 에서 검산한다 (기준 **56 · 55 · 56**).
  - **규약 범위 밖 판정 유지** — 수량 범위와 식별자 범위 (`ADR-0001 ~ ADR-0015` · `ADR-0001 ~ ADR-0016` · `ADR-0001 ~ ADR-0020` 류) · frontmatter `date:` 값은 좌표 표기가 아니므로 `§ 12.80` AC 3 ① · `§ 12.81` 선례를 승계해 **무편집** 임을 1 구 적는다.
  - 정정 후 **각 파일의 행 수 불변** (`wc -l` 전후 **172 · 139 · 187**) 과 **`L` prefix · en dash 잔존 수 = 면제 · 범위 밖 판정분과 동수** 를 재실측해 적는다.
- [x] **AC 5 — 결정 내용 무편집 검산 (1 구)**: `git diff --numstat` 상 대상 ADR 의 **추가 행 수 = 삭제 행 수**, 모든 hunk 가 AC 4 대조표 행 안에 있음, `## Decision` · `## Consequences` · `## Alternatives` 의 **문장 실질 변경 0**, frontmatter `status` · `date` 행 무편집을 확인해 적는다. `git diff --word-diff` 의 변경 토큰이 **구분자 · `L` prefix · 단위어 `행` · (허용된) 조사 보정** 뿐임을 함께 박제한다.
- [x] **AC 6 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.82`** 를 `## 11. References` **직전** 에 신설한다 (삽입 직전 `grep -n '^## 11\. References'` 로 좌표 재실측). 구성: 위치 · 계보 (`§ 12.81` 파생 1 순위 S3 batch 5) → AC 1 선정 · 한정 소급 · mode · cap 판정 → AC 2 census 재실측 (좌표 `~` 0 건 실측 포함) → AC 3 `R5` 존치 조건 **실동원** 판정 + 회색지대 승계 2 종 + 신규 변형 1 종 → **행별 대조표** (파일 · 행 · 원 표기 · 판정 · 근거 조문) → AC 5 무편집 검산 → 진척 · 한계 (**`R5` 잔여 ADR 수 · en dash 잔여 파일 수 갱신 의무** — `§ 12.81` 한계 1 의 `L` 잔존 **23 ADR** · en dash 잔여 **5 파일** 에서 본 batch 처리분을 뺀 값을 실측으로 갱신) → 파생 영향 (목록만 · batch 6 후보 포함). **절 ≤ 60 행** — 초과 예상 시 대조표를 유형별로 압축하고 사유를 박제한다.
- [x] **AC 7 — 자기 준수 + 무손상 · 범위 검산**: 다음을 모두 확인해 절 또는 완료 요약에 적는다.
  - **자기 준수** — 신규 추가분 대상 `git diff -U0 <대상 파일> | grep '^+' | grep -cE '[0-9]+ *– *[0-9]+|L[0-9]+'` 집계값 박제. 대조표의 **원 표기 인용** (`R6`) 은 예외이므로 hit 이 0 이 아니면 내역을 1 구 밝힌다.
  - `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 증분 보고 (**7156 → 7156 + 신설 행수**).
  - `git diff --stat` 이 **정확히 5 파일 (AC 1 ④ 이월 시 4 파일) · ≤ 300 LOC**.
  - `git status --short` 로 **`README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 가 변경 목록에 없음** 을 명시 검산.
  - markdown 무손상 — audit 파일 ` ``` ` fence **짝수 개** + 신설 표 **컬럼 수 일치** + heading 순번 연속 (`12.81` → `12.82`) + 대상 ADR 각각의 `## ` heading 수 **불변 (5 · 5 · 5)** + 링크 개수 불변 (`grep -c '](' <파일>` 전후 동일 — 편집 전 값을 먼저 실측해 기준으로 삼는다).
  - doc-only 변경이라 `pnpm test` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Out of Scope

- **batch 6 이후 파일 착수 금지** — 잔여 en dash 보유 ADR (`ADR-0003` · `ADR-0001`) 과 `L` 잔존 나머지 ADR · 비-ADR 은 열지도 고치지도 않는다. 본 slice 의 5 파일 검산을 깬다.
- **5 문서군의 비-ADR 파일 정규화 금지** — `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/architecture/*` · `.claude/agents/*` (특히 `L` 보유 `directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 는 **무편집**.
- **ADR 결정 내용 변경 금지** — Decision · Consequences · Alternatives · Status 의 실질을 바꾸지 않는다. 바꾸고 싶은 지점이 보이면 Follow-ups 에만 적는다 (`pr` mode 대상이라 §3.1 rule 3 split 필요).
- **좌표가 가리키는 대상 파일 편집 금지** — `docs/PLAN.md` · `README.md` · `docs/requirements.md` · `src/llm/*` · `src/auth/*` 는 참조 대상일 뿐 **열지도 고치지도 않는다** (일부는 `pr` mode 유발).
- **조문 재설계 · 조문 본문 편집 금지** — `R1` ~ `R7` 의 내용 · 번호 · 개수를 바꾸지 않는다. 신규 변형 (범위 밖 문서 대상 좌표) 에 조문을 신설하고 싶어도 **본 slice 에서는 판정만** 하고 조문화는 파생 영향으로 넘긴다 (`§ 12.15` append-only).
- **`§ 12.81` 및 그 이전 audit 절 편집 금지** — 집계 정정이 필요해도 `§ 12.82` 안에서 선언만 한다.
- **pointer 좌표 값 재검증 · 재정정 금지** — 좌표가 가리키는 **값의 정확성** 은 `§ 12.74` 판정을 승계하고 다시 다투지 않는다. 본 slice 는 **표기 형식** 만 본다.
- **수량 · 식별자 범위 치환 금지** — `ADR-0001 ~ ADR-0015` · `100–200명` 류는 좌표 표기가 아니므로 손대지 않는다 (판정 1 구만).
- **`CLAUDE.md` 편집 금지** — rule 5 는 근거로 **참조만**.
- **S4 (`docs/architecture/` 규약 문서 신설) 착수 금지** — `pr` mode 라 mode 혼합 금지 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 관계 언급 1 구까지만 허용.
- **새 REQ 신설 · ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **S3 batch 6 후보** — planner 사전 실측상 en dash 잔여 5 파일 중 본 slice 3 을 뺀 **`ADR-0003`** (좌표 3 행 — 21 · 74 · 168 행) 과 **`ADR-0001`** (`100–200명` · `50–100개` = **수량 범위라 좌표 0** 으로 보임 → 범위 밖 판정 후보). `ADR-0003` + `L` 잔존 ADR 2 ~ 3 을 묶는 편성이 유력.
- **범위 밖 문서 대상 좌표 판정의 조문화** — 본 slice 가 판정하는 "`docs/PLAN.md` 등 5 문서군 밖 문서를 가리키는 좌표도 정정 대상" 을 `§ 12.81` 회색 (다) (코드 파일 대상) 와 묶어 `R8` 후보에 추가할지 판단 (선례 2 건 확보 시점).
- **회색지대 조문화 판단 (`R8`)** — 개구간 (`274 행~`) · 양끝 prefix 병기 · 복수 좌표 병기 · 범위 밖 문서 대상 4 종. `§ 12.81` 파생 (4) 가 우선순위를 **중간** 으로 상향한 상태.
- **`§ 12.76 R5` 예시 갱신** — 존치 파일 목록 (`p3-implementation-plan.md` · `ADR-0005` · `reviewer.md`) 의 stale 이 `§ 12.79` 파생 (3) 부터 이월 중. 조문 편집이라 별도 slice 에서 append-only 준수 방식과 함께 판단.
