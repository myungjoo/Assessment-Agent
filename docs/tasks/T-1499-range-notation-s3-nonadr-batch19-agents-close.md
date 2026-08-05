---
id: T-1499
title: 범위 표기 규약 축 S3 batch 19 — 비-ADR `L` 축 `.claude/agents/*` 2 파일 (`integrator.md` · `reviewer.md`) 축 마감 slice — 개정판 R5 · R1 · R4 정규화 + 슬래시 압축 다좌표 · 문서 간 반복 좌표 · `.claude/` 메타 mode 근거 (rule 5 비원용) 판정 신설 (audit §12.97)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 120
estimatedFiles: 4
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1498]
touchesFiles:
  - .claude/agents/integrator.md
  - .claude/agents/reviewer.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1499-range-notation-s3-nonadr-batch19-agents-close.md
plannerNote: "uc-doc-audit-resync 111 번째 slice — §12.96 파생 (1) 1 순위 batch 19, 비-ADR L 축 마감 6 행 / 8 좌표, direct 4 파일"
---

# T-1499 — 범위 표기 규약 축 S3 batch 19 — 비-ADR `L` 축 `.claude/agents/*` 2 파일 마감 slice

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.96` 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **batch 19** 의 실집행 slice 다. 같은 절이 잔여를 `.claude/agents/integrator.md` + `reviewer.md` **2 파일 / 6 좌표** 로 실측하면서 "대상 + audit + task = **4 파일** 로 cap 여유 1" 이라 편성을 미리 확정했고, `§ 12.96` AC 6 이 `docs/architecture/*` 계열 마감을 선언하며 본 batch 를 **비-ADR `L` 축 전체 마감 slice** 로 지정했다. 본 slice 는 그 확정을 그대로 집행한다 — planner 재실측 기준 `integrator.md` **5 행 / 7 좌표** · `reviewer.md` **1 행 / 1 좌표**, 합 **6 행 / 8 좌표**. 좌표 합 **8** 은 `§ 12.83` AC 3 ④ 임계 **70** 을 크게 밑돌아 이월 **0** 이고, 파일 수 **4/5** 로 cap 여유 1 이라 세 slice 연속 (batch 17 · 18) 이던 **파일 수 상한 물림이 끊긴다**.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **mode 근거가 rule 5 가 아닌 첫 사례**: batch 6 ~ 18 은 전부 `CLAUDE.md` §3.1 **rule 5** (기존 `docs/architecture/*` · `docs/decisions/*` 본문의 **비-결정 수정** = `direct`) 를 원용했으나, `.claude/agents/*` 는 §3.1 표의 `direct` 컬럼에 **`.claude/` 메타 변경** 으로 **직접 열거** 돼 있어 rule 5 원용이 불요하다. 그렇다면 rule 5 의 "판단 실질 불변" 경계 (`§ 12.83` AC 5) 검산이 본 batch 에도 계속 필요한지, 아니면 §3.1 직접 해당이라 검산 의무가 약화되는지를 결론지어야 한다 (planner 견해로는 **검산은 유지** — 근거 조문이 달라도 무편집 검산은 본 축의 자기 규율이다). (나) **슬래시 압축 다좌표**: `integrator.md` 93 · 143 행의 `reviewer.md L90/127` 은 **한 토큰 안에 단일 좌표 2 개** 를 슬래시로 압축한 첫 사례로, `R5` prefix 제거와 `R4` 단일 좌표 표기 · 단위어 부착 (`§ 12.85` 한계 4 의 3 규칙) 을 압축 표기에 어떻게 적용할지 (좌표마다 `행` 을 부착할지 · 말미 1 회만 부착할지 · 슬래시를 유지할지) 가 미결이다. 이 형태 때문에 `grep -oE 'L[0-9]+'` 기반 census 값 **6** 과 실 좌표 **8** 이 어긋나며, 이는 `§ 12.96` AC 3 ③ 이 `components.md` 355 행에서 실증한 **census 사각의 두 번째 유형** (bare 좌표가 아니라 **압축 좌표**) 이다. (다) **문서 간 반복 좌표**: `L13-16` 이 `integrator.md` 62 · 204 행과 `reviewer.md` 171 행에 **3 회** 반복돼 같은 대상 좌표가 파일을 넘어 재등장하는 첫 사례라, `§ 12.90` 의 **문서 간 일관 적용** 요구를 한 batch 안에서 검산할 수 있는 첫 기회다.

편집은 `L` prefix 제거 + 구분자 정규화 (`-` → `~`) + 단위어 `행` 부착에 한정되고, agent 지시문의 실질 (4-게이트 · `--body-file` convention · reviewer-gate race 판정 · SUMMARY 형식 · 링크 URL) 은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` · `R4` · `R6` · `R7` · AC 3 ② **5 문서군 적용 범위** · AC 3 ③ 한정 소급) · `§ 12.83` AC 3 ① · AC 3 ④ (좌표 **70** 이월 임계) · AC 5 (mode 경계 = 판단 실질) · `§ 12.85` 한계 4 (단위어 부착 3 규칙) · `§ 12.90` (**문서 간 일관 적용** · 면제 확정 registry) · `§ 12.91` (개정판 `R5` 문언 · AC 4 병기 인용 규약) · `§ 12.92` (en dash 마감 = ADR census 한정) · `§ 12.94` AC 3 · AC 5 (이중 검산 분모 = 좌표 토큰 제거 후 값) · `§ 12.96` 전문 (**7901 행 ~ 7953 행** — 특히 AC 3 ③ census 사각 · AC 6 잔여 census 와 batch 19 편성 확정 · 한계 2 (`L` prefix 기준 마감 유보) · 파생 (1)(4)). 신설 절 `§ 12.97` 은 `§ 12.96` 뒤 · `## 11. References` **직전** 에 append (현재 파일 **7968 행** · References heading **7955 행**).
- [.claude/agents/integrator.md](../../.claude/agents/integrator.md) — planner 실측 후보 **5 행 / 7 좌표** (60 · 62 · 93 · 143 · 204 행), 총 **204 행** · 링크 `](` **12** · `#` heading **11** · fence **6**, `~` 포함 행 **2** (전부 비-좌표) · en dash 행 **0** · 좌표 ASCII hyphen 행 **3**. 좌표 형태: 링크 뒤 괄호 범위 (`…ci.yml) L82-115) 이` — 60 행) · 괄호 범위 + 조사 (`…ci.yml) L13-16 에 박제)` — 62 행) · **슬래시 압축 단일 좌표 2** (`reviewer.md L90/127 이 이미` — 93 · 143 행, 각 좌표 2) · 링크 뒤 bare 범위 (`…ci.yml) L13-16 의 trigger` — 204 행).
- [.claude/agents/reviewer.md](../../.claude/agents/reviewer.md) — planner 실측 후보 **1 행 / 1 좌표** (171 행), 총 **181 행** · 링크 `](` **13** · `#` heading **11** · fence **4**, `~` 포함 행 **0** · en dash 행 **0** · 좌표 ASCII hyphen 행 **1**. 좌표 형태: 링크 뒤 괄호 범위 + 조사 (`…ci.yml) L13-16) 로` — 171 행).
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 표의 `direct` 컬럼 (**`.claude/` 메타 변경**) 과 rule 5 · §12 정본 pointer 소절 (`§ 12.76 R5 (§ 12.91 개정)` 병기 인용 규약 포함).

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.97` 안에 ① 선정 근거 (`§ 12.96` 파생 (1) 1 순위 · AC 6 이 **batch 19 = `.claude/agents/*` 2 파일 마감** 으로 편성을 확정했음을 인용하고 본 slice 가 그 집행임을 적시), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인 · 행별 문자열 편집 채택 명시), ③ **mode 근거** (`.claude/agents/*` 는 `CLAUDE.md` §3.1 표 `direct` 컬럼의 **`.claude/` 메타 변경** 에 **직접 열거** 돼 있어 **rule 5 원용이 불요한 첫 batch** 임을 적시하고, batch 6 ~ 18 이 rule 5 선례를 누적해 온 계보가 본 batch 에서 **끊김** 을 1 문장 기록), ④ **cap 판정** (좌표 **8** 은 임계 **70** 을 크게 밑돌아 이월 **0**, 파일 수 **4/5** 로 **여유 1** → batch 17 · 18 의 연속 상한 물림이 끊겼음을 적시하고 `§ 12.96` 파생 (3) **좌표 · 파일 이중 상한 재설계** 논거에 본 실측이 **네 번째 증거점 (여유 사례)** 임을 1 문장 기록) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (파일별 집계 1 구).** 두 파일 각각에 `grep -cE 'L[0-9]+'` (행) · `grep -oE 'L[0-9]+' | wc -l` (토큰) · `grep -cE '[0-9] *~ *[0-9]'` · `grep -cE '[0-9] *– *[0-9]'` (en dash) · `grep -cE 'L[0-9]+ *- *[0-9]'` 를 실행해 값을 절 안에 기록하고 Required Reading 의 planner 기준값 (**5 행 / 7 좌표** · **1 행 / 1 좌표**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). 특히 `L` **토큰 수 6** 과 **실 좌표 8** 의 불일치를 기록하고 원인이 93 · 143 행의 **슬래시 압축 좌표 (`L90/127` = 좌표 2)** 임을 적시한다 (AC 3 ② 판정 입력 · `§ 12.96` AC 3 ③ census 사각의 **두 번째 유형**). 좌표를 **단일 (`R4`)** 과 **범위 (`R1`)** 로 분할한 수 (planner 기준 단일 **4** / 범위 **4**) 를 기록하고, `§ 12.94` AC 5 의 **이중 검산 분모 규칙** (좌표 토큰 제거 후 값) 으로 파일별 **순수 비-좌표 `~` 행 수** 를 정정 전 값으로 먼저 기록한다 (planner 기준 **2** · **0**).
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **mode 근거의 전환** — `.claude/agents/*` 가 §3.1 `direct` 컬럼 직접 열거 대상임을 인용하고, rule 5 의 "판단 실질 불변" 검산 (`§ 12.83` AC 5) 이 본 batch 에도 **계속 적용되는지** 를 1 구로 결론짓는다 (planner 견해 = 유지 — 근거 조문이 달라도 무편집 검산은 축의 자기 규율이며 AC 5 가 이를 집행). 아울러 대상이 **agent prompt** 라 표기 변경이 LLM 지시 해석에 영향을 줄 여지가 있는지 (좌표 표기는 참조 pointer 일 뿐 지시 실질이 아님) 를 1 구로 확인. ② **슬래시 압축 다좌표의 조문 적용** — `reviewer.md L90/127` 에 `R5` (prefix 제거) + `R4` (단일 좌표 · `N 행`) 를 적용할 때 (ㄱ) 슬래시 구분자 유지 여부 (ㄴ) 단위어를 좌표마다 부착할지 말미 1 회만 부착할지 (`§ 12.85` 한계 4 의 3 규칙 적용) (ㄷ) `R1` 은 **범위가 아니므로 무적용** 임 — 셋을 각 1 구로 결론짓고 채택한 정규형 (예: `reviewer.md 90 · 127 행`) 을 **선례로 명시** 한다. 압축 좌표가 `grep -oE 'L[0-9]+'` census 를 어긋나게 하는 **두 번째 사각 유형** 임을 `§ 12.96` 한계 2 에 이어 기록한다. ③ **문서 간 반복 좌표의 일관 적용** — `L13-16` 이 `integrator.md` 62 · 204 행과 `reviewer.md` 171 행에 **3 회** 반복됨을 보이고, 세 곳의 정규화 결과가 **문자열 수준에서 동일** (`13~16 행`) 함을 `§ 12.90` 문서 간 일관 적용 요구의 첫 한-batch 검산으로 1 구 기록. 조사 (`에` · `의` · `로`) 차이로 주변 문맥은 달라도 좌표 토큰 자체는 동형이어야 함을 명시.
- [ ] **AC 4 — 대조표.** 후보 **6 행 / 8 좌표** 전량을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문 / 승계 선례` **7 컬럼** 표로 박제한다 (슬래시 압축 행은 1 행으로 묶되 좌표 건수 **2** 를 적는다). 범위 밖 (수량 · 식별자 범위) 표기가 있으면 마지막 행으로 묶어 무편집임을 적고, `R6` · `R7` 면제 판별 건수 · 단일 좌표 (`R4`, **4**) 대 범위 좌표 (`R1`, **4**) 수 · 단위어 부착 횟수 · 조사 보정 건수 · 반복 좌표 (`13~16 행`) 3 회의 동형 여부를 표 뒤 **1 구** 로 구분해 기록.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 **파일별** 추가 행 수 = 삭제 행 수 임을 보이고 (예상 **5/5** · **1/1** — 실측이 다르면 hunk 흡수 몫인지 1 구 설명), mode 경계는 **판단 실질** 기준임을 (`§ 12.83` AC 5 승계, AC 3 ① 결론 반영) 1 문장 확인. 4-게이트 문구 · `--body-file` convention · reviewer-gate race 판정 · SUMMARY 형식 · PR-154 incident 주석 · 링크 URL 무변경을 링크 수 불변 (**12** · **13**) 으로 검산. 정정 후 재실측으로 **행 수 204 · 181 불변** · `#` heading **11 · 11 불변** · fence **6 · 4 불변** · `L` prefix **잔존 0** (또는 면제로 남긴 건수와 근거) · en dash 좌표 잔존 **0** · 순수 비-좌표 `~` 행 수 불변 (AC 2 의 좌표 토큰 제거 후 값 기준) 을 기록.
- [ ] **AC 6 — 비-ADR `L` 축 마감 선언 + 잔여 갱신.** 정정 후 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md docs/decisions/*.md README.md CLAUDE.md docs/requirements.md | wc -l` 과 좌표 총계를 실행해 `§ 12.96` AC 6 의 값과 대조하고 잔여를 **파일 수 + 좌표 수 양쪽** 으로 기록한다 (감소분이 본 batch 처리분과 일치하는지 1 구 검산 — 슬래시 압축 때문에 `L` 토큰 기준 감소분 **6** 과 실 처리 좌표 **8** 이 다르다는 점을 명시). 잔여가 **0 파일 / 0 좌표** 임을 확인해 **비-ADR `L` 축 전체 마감 + 5 문서군 `L` prefix 축 마감** 을 선언하되, `§ 12.96` 한계 2 를 승계해 그 마감이 **`L` prefix 좌표 기준** 이며 bare 좌표 (`CLAUDE.md` **5 행** · `ADR-0003` **2 행** 의 en dash 좌표 등) 는 파생 (4) **소급 census** 판단으로 남는다는 유보를 **같은 문단 안에** 명시한다 (마감 선언의 과대 해석 차단). ADR 축은 본 batch 미대상이라 `§ 12.90` 마감 상태 (미판정 좌표 **0** · 면제 확정 `ADR-0008`:149 **2 좌표**) 불변임을 확인.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. 본 절이 `R5` 를 인용할 때 **`§ 12.76 R5 (§ 12.91 개정)`** 병기 형태만 썼고 구판 단독 인용이 **0** 임도 1 구 자기 검산 (`§ 12.92` 한계 6 관측 계속 — **6 회차**). `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값 (**7968 → ?**) 으로 신설 절 **≤ 60 행**, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일**, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · `docs/architecture/` · `docs/decisions/` · 다른 `.claude/agents/` · `docs/LOOP.md` · `src/` · `test/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **7 컬럼 균일** · heading 순번 `12.96` → `12.97` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 19 결과 수치 · 처리 좌표 수 · **비-ADR `L` 축 마감** · 판정 3 종 신설 · batch 6 ~ 19 누적 정정 좌표 갱신 (`§ 12.96` 기준 **271**)), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · **마감은 `L` prefix 기준** 이라는 `§ 12.96` 한계 2 승계와 bare · 압축 두 사각 유형의 병존 · 단위어 부착 규칙의 비조문성 · `R8` 이월 목록 현행화 (슬래시 압축 좌표를 추가할지 판단) · 개정판 `R5` 인용 분산 관측 6 회차 · FU14 anchor 흡수 관계), 파생 영향 **목록만** (다음 1 순위 = **bare · 압축 좌표 3 패턴 병행 소급 census** 착수 여부 판단 · `R8` 조문화 · 좌표 · 파일 이중 상한 재설계 · 5 문서군 적용 범위 재확인 잔여분 (`docs/use-cases/*` 편입) · S4 조건부) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 대상 2 파일 **밖** 의 편집 — 다른 `.claude/agents/*.md` (`planner.md` · `notifier.md` · `executor.md` 등) · `docs/architecture/*` · `docs/decisions/*` 는 손대지 않는다.
- **bare · 압축 좌표 소급 재census · 재정정** — AC 3 ② 의 압축 좌표 사각 판정은 **기록만** 이고, 다른 파일에서 같은 유형이 있어도 본 slice 에서 고치지 않는다 (파생 영향에 남긴다).
- **좌표가 가리키는 대상 파일** (`.github/workflows/ci.yml` · `reviewer.md` 의 해당 행) 의 편집 · 행 번호 정확성 검증 — 표기만 다루고 값은 다루지 않는다 (`§ 12.74` · `§ 12.96` 한계 1 승계).
- **agent 지시 실질 변경** — 4-게이트 정의 · `--body-file` convention · reviewer-gate race 판정 · SUMMARY 형식 · verdict enum · 표 구조 · PR-154 incident 주석 문구를 손대지 않는다. 표기 정규화 외 문장 다듬기 금지.
- **수량 범위 · step 범위 · 식별자 범위 표기 편집** — `12–18 task` · `step 2–3` 같은 표기는 범위 밖이라 **무편집** 이다 (건드리면 AC 5 이중 검산이 깨진다).
- **`docs/use-cases/*` 파일군** 의 `L` 좌표 — `§ 12.76` AC 3 ② 5 문서군 **밖**. 범위 편입 판단은 별도 slice.
- **ADR 재방문** — `§ 12.90` 이 `L` 축 ADR 마감을 선언했고 `ADR-0008`:149 는 면제 확정분이라 손대지 않는다.
- **`§ 12.76` 조문 본문 · 개정판 `R5` 문언 편집** · `R8` 조문화 · `R2` · `R3` 병합 재설계 · 면제 registry 조문화 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 기존 audit 절 본문의 **소급 수정** — 결론은 신설 절 `§ 12.97` 안에서만 박제한다 (기록 보존 · append-only `§ 12.15`).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `test/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · agent 정의서 2 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **3 패턴 병행 소급 census** — `L` prefix · bare en dash · 슬래시 압축 세 유형으로 이미 마감 선언된 파일군 (ADR 축 · architecture 축 포함) 을 재census 할지 판단 (`§ 12.96` 파생 (4) 승계 · 본 slice 가 두 번째 사각 유형을 추가).
- **슬래시 압축 좌표의 조문화** — AC 3 ② 결론을 `R8` 이월 목록 또는 `R4` 보칙으로 승격할지 검토.
- **좌표 · 파일 이중 상한 재설계** — `§ 12.96` 파생 (3) 에 본 slice 실측 (좌표 **8** / 파일 **4** — 여유 사례) 이 네 번째 증거점.
- **5 문서군 적용 범위 재확인** — `docs/use-cases/*` 편입 여부 (`§ 12.76` AC 3 ②).
