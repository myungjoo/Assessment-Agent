---
id: T-1488
title: 범위 표기 규약 축 S3 batch 9 — `L` 축 ADR 3 파일 (`ADR-0037` · `ADR-0038` · `ADR-0044`) R5·R4 정규화 + 식별자 범위 · 혼합 단일/범위 병기 · 반복 label 판정 (audit §12.86)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 140
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1487]
touchesFiles:
  - docs/decisions/ADR-0037-period-collection-evaluate-bridge.md
  - docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md
  - docs/decisions/ADR-0044-export-import-job-persistence.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1488-range-notation-s3-adr-batch9-lprefix.md
plannerNote: "uc-doc-audit-resync 100 번째 slice — §12.85 파생 (1) 1 순위 S3 batch 9. `L` 잔존 13 ADR 중 3 파일 24 좌표, direct 5 파일"
---

# T-1488 — 범위 표기 규약 축 S3 batch 9 — `L` 축 ADR 3 파일 (`ADR-0037` · `ADR-0038` · `ADR-0044`) `R5` · `R4` 정규화

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.85` (S3 batch 8) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 9 = `L` 잔존 13 ADR 중 `ADR-0037` · `ADR-0038` · `ADR-0044`** 를 집행한다. `§ 12.83` AC 6 이 en dash 축 마감을 선언했으므로 후보는 여전히 **`L` 축 단일 축** 이며, 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7`, 판정 선례는 `§ 12.79` AC 3 ①② · `§ 12.80` AC 2 · 대조표 #4 · `§ 12.81` AC 3 ①② · `§ 12.82` AC 3 ③ · `§ 12.83` AC 3 ②③ · `§ 12.84` AC 3 ①②③ · `§ 12.85` AC 3 ①②③ 을 승계한다. 파생 (1) 이 함께 열거한 `ADR-0023` 은 5 파일 cap 상 batch 10 으로 이월한다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **식별자 범위의 첫 등장**: `ADR-0037`:78 류의 `§Decision 1~5` · `slice 2~5` 와 `ADR-0038` 의 `§Decision 1~5` 는 `§ 12.85` AC 3 ① 이 "수량 · 식별자 범위는 3 파일 모두 **0**" 이라 적었던 유형의 **실제 첫 사례** 라, `R5` 존치 조건 계산의 분해가 좌표 / 수량 **2 분해** 에서 **3 분해** 로 확장돼야 하는지 판정이 필요하다. (나) **혼합 단일 · 범위 병기 묶음**: `ADR-0044`:17 · :168 의 `` L56·L122~124·L176 `` 은 한 가운뎃점 묶음 안에 **단일 좌표 2 + 범위 좌표 1** 이 섞여 `R4` (단일 행) 와 `R1` · `R5` 가 **동시 적용** 되는 첫 형태다 — 단위어를 묶음 끝 1 회로 붙일 때 단일 좌표가 `56~56` 로 오독되지 않는지가 쟁점. (다) **동일 좌표 label 의 반복**: `ADR-0038` 은 같은 좌표 label (`admin-persist-service L159~163` **3 회** · `persist-service L169~182` **2 회**) 이 서로 다른 행에 반복 등장해, 일관 정정 의무 (일부만 고치면 같은 파일 안에서 표기가 갈린다) 를 처음으로 실증한다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 **아홉 번째** 적용 선례이며, 편집 대상은 `L` prefix 제거 + 단위어 부착 + 구분자 보존에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R1` · `R4` · `R5` 존치 조건 · `R6` · `R7` · AC 3 ③ 한정 소급) · `§ 12.80` AC 2 · `§ 12.81` AC 3 ①② (회색지대 3 종 · 코드 파일 대상 좌표) · `§ 12.82` AC 3 (규약 범위 밖 문서 좌표) · `§ 12.84` AC 3 ②③ · `§ 12.85` 전문 (7310 행~ · 특히 AC 3 ①②③ · AC 4 대조표 · AC 6 · 한계 3 · 4 · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0037-period-collection-evaluate-bridge.md](../decisions/ADR-0037-period-collection-evaluate-bridge.md) — planner 실측 후보 **7 행 / 9 좌표**, raw `~` **6** (좌표 3 · 식별자 3), en dash **0**, 총 **193 행** · 링크 **58** · `## ` heading **6**. `:22` 괄호 안 코드 파일 좌표 (`controller 주석(L26~27)`) · `:24` · `:40` · `:152` · `:179` 의 `docs/PLAN.md` 대상 좌표 (`PLAN L98`) · `:31` · `:41` 의 `README` 대상 병기 (`L72~74` · `L86`) 포함.
- [docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) — planner 실측 후보 **5 행 / 7 좌표**, raw `~` **9** (좌표 7 · 식별자 2), en dash **0**, 총 **195 행** · 링크 **75** · `## ` heading **7**. 좌표 전량이 **markdown 링크 label 안 · 코드 파일 대상** (`[persist-service L169~182](../../src/...)`) 이며 `:30` · `:65` · `:75` · `:88` · `:107` 에 걸쳐 **동일 label 이 반복** 된다.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — planner 실측 후보 **4 행 / 8 좌표**, raw `~` **3** (전량 좌표), en dash **0**, 총 **189 행** · 링크 **63** · `## ` heading **7**. `:17` · `:168` 혼합 단일/범위 가운뎃점 병기 (`L56·L122~124·L176`) · `:35` 좌표 뒤 코드 스팬 개재 · `:112` 백틱 경로 뒤 코드 파일 좌표 (`` `src/export/export-job.service.ts` L89~92 ``) 포함.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.86` 안에 ① 선정 근거 (`§ 12.85` 파생 (1) 1 순위 · `L` 잔존 13 중 **3 파일** 편성 이유 · `ADR-0023` 을 얹지 않은 5 파일 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ "이미 어긋남이 확인된 좌표에 한정" 충족 · **전면 일괄 치환 금지** 재확인), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **아홉 번째 선례** · 선례 `§ 12.78` ~ `§ 12.85` ③ 열거), ④ **cap 가드** (확정 정정 좌표 수가 **70 초과** 면 `ADR-0044` 를 batch 10 으로 이월하고 그 판단 결과를 명시 · `§ 12.81` AC 1 ④ · `§ 12.85` AC 1 ④ 선례 승계) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구).** 3 파일에 대해 `grep -nE 'L[0-9]+' <file>` (행 단위) · `grep -oE 'L[0-9]+' <file> | wc -l` (좌표 단위) · raw `grep -oE '[0-9] *~ *[0-9]' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**7 / 9** · **5 / 7** · **4 / 8**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 grep 은 하한" 승계를 1 문장으로 재확인하고, 본 batch 최대 격차인 `ADR-0044` (8−4 = **4**) 가 어느 행에서 발생하는지 **행 번호로 지목**.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **`R5` 존치 조건 파일별 판정 + 식별자 범위 첫 처리** — 3 파일의 raw `~` 실측치를 **좌표 범위 / 수량 범위 / 식별자 범위 3 분해** 로 나눠 (`§ 12.84` AC 3 ① 의 2 분해를 확장 · `§ 12.85` AC 3 ① 이 "식별자 범위 0" 이라 적은 유형의 첫 실사례임을 명시) 파일별 존치 조건 성립 여부를 각각 결론내고, **식별자 범위** (`§Decision 1~5` · `slice 2~5`) 가 (가) `R1` 규율 대상인지 (나) 존치 조건 계수에 포함되는지를 `R1` 문언 근거로 확정한다. 아울러 `L` 접두 좌표 자신의 `~` 를 좌표 범위로 계수하는 `§ 12.85` AC 3 ① 선례를 **명시 승계** 해 self-reference 논점을 1 문장으로 닫는다. 성립 파일이 있으면 `§ 12.82` AC 3 ① 자기 소멸 논거 또는 `§ 12.83` AC 3 ③ 재량 논거로 정정 결론임을 1 문단으로 명시. ② **혼합 단일 · 범위 병기 묶음 첫 판정** — `ADR-0044`:17 · :168 의 `` L56·L122~124·L176 `` 에 대해 **원 표기 → 정정 표기** 를 제시하고, 단위어를 묶음 끝 1 회로 붙일 때 단일 좌표 `56` · `176` 이 `R4` 위반 (`56~56` 형태) 로 읽히지 않는지 · 가운뎃점 구분자가 `§ 12.85` AC 3 ② (나) 승계로 보존되는지를 `R1` · `R4` · `R6` 화법 근거로 확정. ③ **대상별 판정 2 종 + 반복 label 일관성** — (가) 규약 적용 범위 **밖** 문서 (`docs/PLAN.md`) 를 가리키는 `ADR-0037` 좌표 (`:40` · `:152` · `:179` 의 `PLAN L98`) 가 `§ 12.82` AC 3 의 "표기가 **놓인** 문서 기준" 판정 승계로 정정 대상인지, (나) 코드 파일 (`src/**`) 대상 좌표 (`ADR-0038` 전량 · `ADR-0044`:112 · `ADR-0037`:22) 가 `§ 12.81` 회색지대 3 승계로 정정 대상인지를 각각 1 문단으로 확정하고, `ADR-0038` 의 **동일 label 반복** (`L159~163` 3 회 · `L169~182` 2 회) 은 **전량 동시 정정** 이 의무임을 (일부 정정 시 같은 파일 안 표기 분열) 1 문장으로 박제.
- [ ] **AC 4 — 대조표.** 후보 행 전량 (3 파일 합계 **16 행**) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 면제 판별 건수와 `L` 제거로 인한 **조사 보정 건수** 를 1 구로 명시하고, 이미 `~` 를 쓰는 좌표 (`R1` 이미 준수 · `R5` 만 적용) 와 단일 행 좌표 (`R4` 병용) 의 수를 구분해 적는다. 반복 label 은 **반복 횟수** 를 셀 안에 표기.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 3 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고, hunk 가 `## Decision` · `## Consequences` · `## Alternatives` 구간에 떨어지면 `§ 12.83` AC 5 · `§ 12.85` AC 5 의 "rule 5 경계는 **구간이 아니라 결정 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인 (문장 · 수치 · 링크 URL 무변경 — 특히 링크 label 안 좌표 정정이 **URL 을 건드리지 않았음** 을 명시). frontmatter (`status` · `date`) hunk **0**. 정정 후 재실측으로 **행 수 (193 · 195 · 189) · 링크 수 (58 · 75 · 63) · `## ` heading 수 (6 · 7 · 7) 불변** 과 `L` prefix **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 이월 판정분과 **동수** 인지 대조.
- [ ] **AC 6 — `L` 축 잔여 갱신.** `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md | wc -l` 과 비-ADR 대상 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 을 정정 후 실행해 **`L` 잔존 파일 수** 를 갱신 기록하고 `§ 12.85` AC 6 의 값 (ADR **13** · 비-ADR **14**) 과 대조. 감소분이 본 batch 처리 파일 수와 일치하는지 확인하고, 불일치 시 원인 (AC 3 면제 잔존 · 부분 이월) 을 명시. 잔존 ADR 목록을 좌표 수와 함께 열거해 batch 10 편성 근거를 남긴다.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.85` → `12.86` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 9 결과 수치 · 처리 좌표 수 · 면제 · 이월 여부 · `L` 잔존 ADR 추이), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 (현 **5 종** + 병기 변형 누적 · 식별자 범위 신규) · 단위어 부착 규칙의 비조문성 (`§ 12.85` 한계 4 승계) · 반복 label 일관성의 grep 미검출 · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = `L` 축 batch 10 후보 (`ADR-0023` 외 잔존) · 비-ADR 14 파일 정규화 · `R5` 개정 판단 · `R8` 조문화 우선순위) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 3 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (`ADR-0023` · `ADR-0032` · `ADR-0027` · `ADR-0004` · `ADR-0002` · `ADR-0008` · `ADR-0015` · `ADR-0029` · `ADR-0046` · `ADR-0047` 등 10 파일) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md` 14 파일) 정규화는 batch 10 이후.
- **en dash 축 재개** — `§ 12.83` AC 6 이 마감을 선언했으므로 잔존 좌표는 재판정하지 않는다.
- **좌표가 가리키는 대상 파일 (`src/**` · `docs/PLAN.md` · `README.md`) 의 편집** — 본 slice 는 ADR 안 표기 형식만 고친다. 대상 파일의 행 번호가 실제로 맞는지도 검증하지 않는다 (`§ 12.74` 판정 승계).
- `§ 12.76` **조문 본문 편집** — `R5` 존치 조건 개정 · 예시 목록 갱신 · 단위어 부착 규칙 · 식별자 범위 규정의 조문화는 `§ 12.79` 파생 (3) + `§ 12.85` 한계 3 · 4 이월 유지 (별도 slice).
- **`R8` 조문화** (회색지대 + 병기 변형 + 저자 test) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경 (label 안 좌표만 정정).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · ADR 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 10 편성 후보** — `ADR-0023` (5 행 / 6 좌표) + `ADR-0032` (6 행 / 6 좌표) + `ADR-0027` (2 행 / 3 좌표) 또는 소규모 군 (`ADR-0004` 3 행 · `ADR-0002` 1 행 / 7 좌표 · `ADR-0008` · `ADR-0015` · `ADR-0029` · `ADR-0046` · `ADR-0047`) 묶음. 좌표 수가 적어 다수 묶음이 가능하나 **5 파일 cap 이 실질 제약** 이라 잔존 10 파일은 최소 4 batch 가 더 필요하다 — batch 크기 상한을 파일 수가 아니라 좌표 수로 재설계할지 판단 여지.
- **비-ADR `L` 축 14 파일** — `R5` 존치 예시 목록 (`p3-implementation-plan.md` · `reviewer.md`) 과 정면 충돌이라 `§ 12.76 R5` 개정 판단 slice 를 **선행** 시킬지 순서 판단 필요 (`§ 12.85` 파생 (2)(3)).
- **식별자 범위의 조문화** — 본 slice 가 `§Decision 1~5` · `slice 2~5` 를 처음 판정하면 `R1` 의 적용 대상 (행 범위 한정) 문언을 명시할 실익이 커진다. `R8` 후보 묶음에 편입할지 재판단.
