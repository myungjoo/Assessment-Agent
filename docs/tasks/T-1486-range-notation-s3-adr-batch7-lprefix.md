---
id: T-1486
title: 범위 표기 규약 축 S3 batch 7 — `L` 축 대형 ADR 2 파일 (`ADR-0024` · `ADR-0039`) R5·R1 정규화 + 병기 변형 3 종 판정 (audit §12.84)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 155
estimatedFiles: 4
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1485]
touchesFiles:
  - docs/decisions/ADR-0024-user-instance-binding-data-model.md
  - docs/decisions/ADR-0039-timezone-kst-boundary-policy.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1486-range-notation-s3-adr-batch7-lprefix.md
plannerNote: "uc-doc-audit-resync 98 번째 slice — §12.83 파생 (1) 1 순위 S3 batch 7. en dash 축 마감 후 첫 `L` 축 slice, 대형 2 파일 48 좌표, direct 4 파일"
---

# T-1486 — 범위 표기 규약 축 S3 batch 7 — `L` 축 대형 ADR 2 파일 (`ADR-0024` · `ADR-0039`) R5·R1 정규화 + 병기 변형 3 종 판정

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.83` (S3 batch 6) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **S3 batch 7 = `L` 잔존 18 ADR 중 대형 1 ~ 2 파일** 을 집행한다. `§ 12.83` AC 6 이 **en dash 축 마감을 선언** 했으므로 batch 7 부터는 후보가 `L` 축 단일 축으로 좁혀진다 — 본 slice 는 그 축의 **첫 실집행** 이며, 규범 정본은 `§ 12.76` 조문 `R1` ~ `R7`, 판정 선례는 `§ 12.79` AC 3 ②③ · `§ 12.80` AC 2 · `§ 12.81` AC 3 ①② · `§ 12.82` AC 3 ③ · `§ 12.83` AC 3 ③ 을 승계한다.

본 slice 가 새로 여는 판정 축은 둘이다 — (가) **`R5` 존치 조건이 실측으로 불성립하는 대형 파일**: `ADR-0024` 는 raw `~` **20 건**, `ADR-0039` 는 **1 건** 이라 `§ 12.76 R5` 존치 조건 ("그 파일의 `~` 범위 표기가 0 건일 때만") 이 **애초에 성립하지 않아** `§ 12.83` AC 3 ③ 의 사문화 논거도, `§ 12.82` AC 3 ① 의 자기 소멸 논거도 **동원할 필요가 없다** (`§ 12.79` AC 3 ② 선례의 단순 승계). (나) **병기 변형 3 종의 첫 실판정**: `L19~22, L33` (콤마 병기) · `L54/L122` (슬래시 병기) · `[README L61](...)` 처럼 **링크 label 안에 좌표가 박힌** 형태 · `### ... (ADR-0035 §Decision3 / L41)` 처럼 **heading 안** 에 박힌 형태가 한 batch 에 모여 있다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 의 **일곱 번째** 적용 선례이며, 편집 대상은 `L` prefix 제거 + 단위어 부착 + 구분자에 한정되고 ADR 의 결정 실질은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` ~ `R7` · 특히 `R1` · `R4` · `R5` 존치 조건 · `R6` · AC 3 ③ 한정 소급) · `§ 12.79` AC 3 ②③ · `§ 12.80` AC 2 · `§ 12.81` AC 3 ①②(회색 가 · 나) · `§ 12.82` AC 3 ③ · `§ 12.83` 전문 (7196 행~ · 특히 AC 3 ③ · AC 6 · 한계 4 · 파생 영향 (1)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/decisions/ADR-0024-user-instance-binding-data-model.md](../decisions/ADR-0024-user-instance-binding-data-model.md) — planner 실측 후보 **21 행 / 26 좌표**, raw `~` **20**, en dash **0**, 총 **203 행** · 링크 **104**. 대상 대부분이 `src/` · `prisma/` 코드 파일 좌표.
- [docs/decisions/ADR-0039-timezone-kst-boundary-policy.md](../decisions/ADR-0039-timezone-kst-boundary-policy.md) — planner 실측 후보 **15 행 / 22 좌표**, raw `~` **1**, en dash **0**, 총 **128 행** · 링크 **22**. `:16` heading 안 좌표 · `:20` 슬래시 병기 (`L54/L122`) · `:30` · `:33` 링크 label 안 좌표 포함.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절.

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.84` 안에 ① 선정 근거 (`§ 12.83` 파생 (1) 1 순위 · `L` 잔존 18 중 대형 **2 파일** 편성 이유 · `ADR-0022` 를 얹지 않은 cap 근거), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ "이미 어긋남이 확인된 좌표에 한정" 충족 · **전면 일괄 치환 금지** 재확인), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **일곱 번째 선례** · 선례 `§ 12.78` ~ `§ 12.83` ③ 열거), ④ **cap 가드** (확정 정정 좌표 수가 **70 초과** 면 `ADR-0039` 를 batch 8 로 이월하고 그 판단 결과를 명시 · `§ 12.81` AC 1 ④ 선례 승계) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구).** 2 파일에 대해 `grep -nE 'L[0-9]+' <file>` (행 단위) · `grep -oE 'L[0-9]+' <file> | wc -l` (좌표 단위) · raw `grep -oE '[0-9] *~ *[0-9]' <file> | wc -l` 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**21 행 / 26 좌표** · **15 행 / 22 좌표**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). `§ 12.80` AC 2 의 "행 수 ≠ 좌표 수 · `grep -c` 는 하한" 승계를 1 문장으로 재확인하고, 본 batch 의 행↔좌표 격차 (26−21 · 22−15) 가 어느 행에서 발생하는지 **행 번호로 지목**.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **`R5` 존치 조건 불성립 확인** — 2 파일의 raw `~` 실측치를 근거로 `§ 12.76 R5` 존치 조건이 **애초에 불성립** 임을 보이고, `§ 12.82` AC 3 ① (자기 소멸) · `§ 12.83` AC 3 ③ (예시 목록 = 예시적) 논거를 **동원하지 않고** `§ 12.79` AC 3 ② 의 단순 승계로 정정 결론임을 1 문단으로 명시. ② **병기 변형 3 종 판정** — (가) 콤마 병기 (`ADR-0024`:29 `L19~22, L33`), (나) 슬래시 병기 (`ADR-0039`:20 `L54/L122`), (다) **링크 label 안 좌표** (`[README L61](../../README.md)` · `[ADR-0029 L107](...)`) 와 **heading 안 좌표** (`ADR-0039`:16) 각각에 대해 정정 후 형태를 **원 표기 → 정정 표기** 로 제시하고, 단위어 `행` 을 **몇 번** 붙이는지 (좌표마다 vs 병기 묶음당 1 회) 를 `R1` · `R4` 근거로 확정. ③ **코드 파일 대상 좌표 재확인** — `ADR-0024` 후보 다수가 `src/` · `prisma/` 를 가리키는 좌표임을 밝히고, `§ 12.81` AC 3 ② (회색 다) · `§ 12.82` AC 3 ③ 승계로 판정 기준이 **표기가 실린 위치** (ADR 본문 = 범위 안) 임을 재확인 → 정정 대상 결론. 이미 `~` 를 쓰는 좌표 (`L133~144`) 는 **`R5` 만 적용 · `R1` 은 이미 준수** 임을 구분해 표기.
- [ ] **AC 4 — 대조표.** 후보 행 전량 (2 파일 합계) 을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문` **6 컬럼** 표로 박제 (유형이 같으면 행 압축 허용 · 압축 시 행·좌표 수를 셀 안에 표기). `R6` · `R7` · `R4` 면제 판별 건수와 `L` 제거로 인한 **조사 보정 건수** (예: `L133~144 \`list(...)\`` → `133~144 행` 뒤 문맥) 를 1 구로 명시.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 2 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고, hunk 가 `## Decision` · `## Consequences` · `## Alternatives` 구간에 떨어지면 `§ 12.83` AC 5 의 "rule 5 경계는 **구간이 아니라 결정 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인 (문장 · 수치 · 링크 URL 무변경). frontmatter (`status` · `date`) hunk **0**. 정정 후 재실측으로 **행 수 (203 · 128) · 링크 수 (104 · 22) · `## ` heading 수 불변** 과 `L` prefix **잔존 수** 를 파일별로 적고, 잔존 수가 면제 · 이월 판정분과 **동수** 인지 대조.
- [ ] **AC 6 — `L` 축 잔여 갱신.** `grep -lE 'L[0-9]+' docs/decisions/ADR-*.md | wc -l` 과 비-ADR 대상 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 을 정정 후 실행해 **`L` 잔존 파일 수** 를 갱신 기록하고 `§ 12.83` AC 6 의 값 (ADR **18**) 과 대조. 감소분이 본 batch 처리 파일 수와 일치하는지 확인하고, 불일치 시 원인 (부분 이월 · 면제 잔존) 을 명시.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · 다른 `docs/decisions/*` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **6 컬럼 균일** · heading 순번 `12.83` → `12.84` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 7 결과 수치 · 처리 좌표 수 · 이월 여부), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · census 행 단위 하한 · 회색지대 조문 부재 (현 **5 종** + 병기 변형) · FU14 anchor 흡수 관계 등), 파생 영향 **목록만** (다음 1 순위 = `L` 축 batch 8 후보 · 비-ADR 정규화 · `R5` 개정 판단 · `R8` 조문화 우선순위) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 본 2 ADR **밖** 의 파일 편집 — `L` 잔존 나머지 ADR (`ADR-0022` · `ADR-0019` · `ADR-0049` · `ADR-0037` 등 약 16 파일) · 비-ADR (`directory.md` · `integrator.md` · `reviewer.md` · `race-patterns.md` · `p3-*.md`) 정규화는 batch 8 이후.
- **en dash 축 재개** — `§ 12.83` AC 6 이 마감을 선언했으므로 `ADR-0001` · `ADR-0003` 잔존 4 좌표는 재판정하지 않는다.
- `§ 12.76` **조문 본문 편집** — `R5` 존치 조건 개정 · 예시 목록 갱신은 `§ 12.79` 파생 (3) + `§ 12.83` 한계 5 이월 유지 (별도 slice).
- **`R8` 조문화** (회색지대 5 종 + 병기 변형) · `R2` · `R3` 병합 재설계 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 좌표가 가리키는 **값 자체의 정확성 재검증** (`§ 12.74` 판정 승계 — 본 slice 는 표기 형식만).
- ADR 의 `## Decision` · `## Consequences` · `## Alternatives` 실질 · frontmatter `status` · `date` 변경, 링크 URL 변경.
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · ADR 2 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **batch 8 편성 후보** — `ADR-0022` (12 행 / 14 좌표) + `ADR-0019` (9 행) + `ADR-0049` · `ADR-0037` (각 7 행) 조합이 유력. 소규모 군 (`ADR-0002` · `ADR-0008` · `ADR-0015` · `ADR-0047` 각 1 행) 은 한 batch 에 다수 묶음 가능하나 5 파일 cap 이 실질 제약.
- **비-ADR `L` 축** — `docs/architecture/*` · `.claude/agents/*` 대상은 `R5` 존치 예시 목록 (`p3-implementation-plan.md` · `reviewer.md`) 과 직접 충돌하므로, `§ 12.76 R5` 개정 판단 slice 를 **선행** 시킬지 순서 판단 필요.
- **병기 변형의 조문화** — 콤마 · 슬래시 · 링크 label 내 · heading 내 4 형태는 본 slice 판정 후 선례 1 건씩 확보. `R8` 후보 묶음에 편입할지 선례 2 건 시점에 재판단.
