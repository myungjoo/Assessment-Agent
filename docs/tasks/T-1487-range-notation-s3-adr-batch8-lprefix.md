---
id: T-1487
title: 범위 표기 규약 축 S3 batch 8 — `L` 축 ADR 3 파일 (`ADR-0022` · `ADR-0019` · `ADR-0049`) R5·R4 정규화 + 병기 구분자 2 변형 · "이하 원문" 구간 R6 판정 (audit §12.85)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 150
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1486]
touchesFiles:
  - docs/decisions/ADR-0022-permission-denied-record-data-model.md
  - docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md
  - docs/decisions/ADR-0049-doc-update-count-neutralization.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1487-range-notation-s3-adr-batch8-lprefix.md
plannerNote: "uc-doc-audit-resync 99 번째 slice — §12.84 파생 (1) 1 순위 S3 batch 8. `L` 잔존 16 ADR 중 3 파일 39 좌표, direct 5 파일"
---

# T-1487 — 범위 표기 규약 축 S3 batch 8 — `L` 축 ADR 3 파일 (`ADR-0022` · `ADR-0019` · `ADR-0049`) `R5` · `R4` 정규화

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.84` (S3 batch 7) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 8 = `L` 잔존 16 ADR 중 `ADR-0022` · `ADR-0019` · `ADR-0049`** 를 집행한다. `§ 12.83` AC 6 이 en dash 축 마감을 선언했으므로 후보는 여전히 **`L` 축 단일 축** 이며, 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7`, 판정 선례는 `§ 12.79` AC 3 ①② · `§ 12.80` AC 2 · `§ 12.81` AC 3 ①② · `§ 12.82` AC 3 ③ · `§ 12.83` AC 3 ③ · AC 5 · `§ 12.84` AC 3 ①②③ 을 승계한다. 파생 (1) 이 함께 열거한 `ADR-0037` 은 5 파일 cap 상 batch 9 로 이월한다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **병기 구분자 2 변형**: `ADR-0019`:93 의 **가운뎃점 병기** (`L271~275·L290~294`) 와 `ADR-0049`:130 의 **prefix 생략 병기** (`L31 / 40 / 41` — `L` 이 첫 좌표에만 붙음) 는 `§ 12.84` AC 3 ② 가 판정한 4 종 (`,` · `/` · `+` · label / heading 내) 밖의 형태다. (나) **"이하 원문" 선언 구간의 `R6` 면제 판정**: `ADR-0049` 는 `:30` 의 `> *(이하 원문 — 미채택 설계안. …)*` 선언 뒤 본문 전체가 **미채택 원안의 보존 텍스트** 인데 blockquote 마크업 (`>`) 은 `:30` 까지만 붙어 있어, 후속 6 행 (`:34` · `:36` · `:48` · `:87` · `:129` · `:130`) 이 `R6` 인용 면제인지 통상 ADR 본문인지 **형식만으로는 갈리지 않는다**. (다) **행↔좌표 최대 격차**: `ADR-0019` 는 9 행 / 16 좌표로 격차 **7** — 지금까지 batch 중 최대라 `§ 12.80` AC 2 의 "행 단위 census 는 하한" 을 가장 강하게 실증한다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 **여덟 번째** 적용 선례이며, 편집 대상은 `L` prefix 제거 + 단위어 부착 + 구분자 보존에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R1` · `R4` · `R5` 존치 조건 · `R6` · `R7` · AC 3 ③ 한정 소급) · `§ 12.80` AC 2 · `§ 12.81` AC 3 ①② · `§ 12.83` AC 3 ③ · AC 5 · `§ 12.84` 전문 (7266 행~ · 특히 AC 3 ①②③ · AC 6 · 한계 3 · 한계 5 · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](../decisions/ADR-0022-permission-denied-record-data-model.md) — planner 실측 후보 **12 행 / 14 좌표**, raw `~` **11**, en dash **0**, 총 **180 행**. `:28` 콤마 병기 (`L19~22, L33`) · `:107` 한 행 다중 좌표 · `:168` ~ `:170` References 좌표 포함.
- [docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md](../decisions/ADR-0019-same-host-auth-restriction-for-pagination.md) — planner 실측 후보 **9 행 / 16 좌표**, raw `~` **14**, en dash **0**, 총 **160 행**. `:93` 가운뎃점 병기 (`L271~275·L290~294`) · `:18` · `:19` · `:148` · `:149` 한 행 2 좌표 포함.
- [docs/decisions/ADR-0049-doc-update-count-neutralization.md](../decisions/ADR-0049-doc-update-count-neutralization.md) — planner 실측 후보 **7 행 / 9 좌표**, raw `~` **2**, en dash **0**, 총 **138 행**. `:30` "이하 원문" 선언 (blockquote) · `:34` heading 안 좌표 · `:130` prefix 생략 병기 (`L31 / 40 / 41`) 포함.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.85` 안에 ① 선정 근거 (`§ 12.84` 파생 (1) 1 순위 · `L` 잔존 16 중 **3 파일** 편성 이유 · `ADR-0037` 을 얹지 않은 5 파일 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ "이미 어긋남이 확인된 좌표에 한정" 충족 · **전면 일괄 치환 금지** 재확인), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **여덟 번째 선례** · 선례 `§ 12.78` ~ `§ 12.84` ③ 열거), ④ **cap 가드** (확정 정정 좌표 수가 **70 초과** 면 `ADR-0049` 를 batch 9 로 이월하고 그 판단 결과를 명시 · `§ 12.81` AC 1 ④ · `§ 12.84` AC 1 ④ 선례 승계) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구).** 3 파일에 대해 `grep -nE 'L[0-9]+' <file>` (행 단위) · `grep -oE 'L[0-9]+' <file> | wc -l` (좌표 단위) · raw `grep -oE '[0-9] *~ *[0-9]' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**12 / 14** · **9 / 16** · **7 / 9**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · 행 단위 grep 은 하한" 승계를 1 문장으로 재확인하고, 본 batch 최대 격차인 `ADR-0019` (16−9 = **7**) 가 어느 행에서 발생하는지 **행 번호로 지목**.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **`R5` 존치 조건 파일별 판정** — 3 파일의 raw `~` 실측치를 **좌표 범위 vs 수량 범위** 로 분해해 (`§ 12.84` AC 3 ① 의 `ADR-0039` 판별 방식 승계) 파일별 존치 조건 성립 여부를 각각 결론내고, 성립 파일이 있으면 `§ 12.83` AC 3 ③ 동형 논거 (존치 예시 목록 = 예시적 · 조문 문언이 재량) 로 정정 결론임을 1 문단으로 명시. ② **병기 구분자 2 변형 첫 판정** — (가) 가운뎃점 병기 (`ADR-0019`:93 `L271~275·L290~294`), (나) **prefix 생략 병기** (`ADR-0049`:130 `L31 / 40 / 41` — `L` 이 첫 좌표에만) 각각에 대해 **원 표기 → 정정 표기** 를 제시하고, `§ 12.84` AC 3 ② 가 확정한 **"연속 좌표 묶음 끝에 단위어 1 회 · 구분자 보존"** 규칙이 두 변형에 그대로 적용되는지 (특히 `·` 를 `,` 로 바꾸지 않는지 · prefix 생략형이 정정 후 원 구분자를 유지하는지) 를 `R1` · `R4` · `R6` 화법 근거로 확정. ③ **"이하 원문" 구간의 `R6` 면제 판정** — `ADR-0049`:30 선언 뒤 6 후보 행이 (가) `R6` 인용 면제로 **무편집** 인지 (나) 통상 ADR 본문으로 **정정 대상** 인지를 판정하고, 판정 기준 (blockquote 마크업 유무 · 표기의 **저자** 가 인용원인지 본 ADR 인지 · `§ 12.72` 규칙 A 의 인용 재분류 선례 · `§ 12.74` 의 char-identical 대조 방식) 을 1 문단으로 박제. 판정이 (가) 면 해당 행은 대조표에 **면제** 로 기록하고 `L` 잔존 수에 반영한다.
- [ ] **AC 4 — 대조표.** 후보 행 전량 (3 파일 합계) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 면제 판별 건수와 `L` 제거로 인한 **조사 보정 건수** 를 1 구로 명시하고, 이미 `~` 를 쓰는 좌표 (`R1` 이미 준수 · `R5` 만 적용) 와 단일 행 좌표 (`R4` 병용) 의 수를 구분해 적는다.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 3 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고, hunk 가 `## Decision` · `## Consequences` · `## Alternatives` 구간에 떨어지면 `§ 12.83` AC 5 · `§ 12.84` AC 5 의 "rule 5 경계는 **구간이 아니라 결정 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인 (문장 · 수치 · 링크 URL 무변경). frontmatter (`status` · `date`) hunk **0**. 정정 후 재실측으로 **행 수 (180 · 160 · 138) · 링크 수 · `## ` heading 수 불변** 과 `L` prefix **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 이월 판정분과 **동수** 인지 대조.
- [ ] **AC 6 — `L` 축 잔여 갱신.** `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md | wc -l` 과 비-ADR 대상 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 을 정정 후 실행해 **`L` 잔존 파일 수** 를 갱신 기록하고 `§ 12.84` AC 6 의 값 (ADR **16** · 비-ADR **14**) 과 대조. 감소분이 본 batch 처리 파일 수와 일치하는지 확인하고, 불일치 시 원인 (AC 3 ③ 면제 잔존 · 부분 이월) 을 명시.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.84` → `12.85` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 8 결과 수치 · 처리 좌표 수 · 면제 · 이월 여부), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 (현 **5 종** + 병기 변형 **6 종**) · 단위어 부착 규칙의 비조문성 (`§ 12.84` 한계 5 승계) · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = `L` 축 batch 9 후보 (`ADR-0037` 외) · 비-ADR 정규화 · `R5` 개정 판단 · `R8` 조문화 우선순위) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 3 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (`ADR-0037` · `ADR-0038` · `ADR-0044` · `ADR-0023` · `ADR-0032` 등 13 파일) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md` 14 파일) 정규화는 batch 9 이후.
- **en dash 축 재개** — `§ 12.83` AC 6 이 마감을 선언했으므로 잔존 좌표는 재판정하지 않는다.
- `§ 12.76` **조문 본문 편집** — `R5` 존치 조건 개정 · 예시 목록 갱신 · 단위어 부착 규칙의 조문화는 `§ 12.79` 파생 (3) + `§ 12.84` 한계 4 · 5 이월 유지 (별도 slice).
- **`R8` 조문화** (회색지대 5 종 + 병기 변형 6 종) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 좌표가 가리키는 **값 자체의 정확성 재검증** (`§ 12.74` 판정 승계 — 본 slice 는 표기 형식만).
- `ADR-0049` 의 **미채택 원안 본문 자체의 내용 수정 · 삭제 · 재작성** — AC 3 ③ 판정은 좌표 표기의 정정 여부만 가른다.
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경.
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · ADR 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 9 편성 후보** — `ADR-0037` (7 행 / 9 좌표) + `ADR-0038` (5 행 / 7 좌표) + `ADR-0044` (4 행 / 8 좌표) + `ADR-0023` (5 행 / 6 좌표) 조합이 유력. 소규모 군 (`ADR-0002` 1 행 / 7 좌표 · `ADR-0008` · `ADR-0015` · `ADR-0047` 각 1 행) 은 좌표 수가 적어 다수 묶음 가능하나 5 파일 cap 이 실질 제약.
- **비-ADR `L` 축 14 파일** — `R5` 존치 예시 목록 (`p3-implementation-plan.md` · `reviewer.md`) 과 정면 충돌이라 `§ 12.76 R5` 개정 판단 slice 를 **선행** 시킬지 순서 판단 필요 (`§ 12.84` 파생 (2)(3)).
- **병기 변형의 조문화** — 본 slice 판정 후 변형은 6 종 (`,` · `/` · `+` · label / heading 내 · `·` · prefix 생략) 으로 늘어난다. `R8` 후보 묶음에 단위어 부착 규칙과 함께 편입할지 재판단.
