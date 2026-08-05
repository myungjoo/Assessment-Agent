---
id: T-1496
title: 범위 표기 규약 축 S3 batch 16 — 비-ADR `L` 축 architecture 상위 3 파일 (`api.md` · `modules.md` · `race-patterns.md`) 개정판 R5 · R1 · R4 정규화 + 범위 밖 대상 좌표 · R7 재심 · 한 행 7 좌표 체인 판정 (audit §12.94)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 140
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1495]
touchesFiles:
  - docs/architecture/api.md
  - docs/architecture/modules.md
  - docs/architecture/race-patterns.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1496-range-notation-s3-nonadr-batch16-arch3.md
plannerNote: "uc-doc-audit-resync 108 번째 slice — §12.93 파생 (1) 1 순위 비-ADR 잔여 상위 3 파일 14 행 / 22 좌표, direct 5 파일"
---

# T-1496 — 범위 표기 규약 축 S3 batch 16 — 비-ADR `L` 축 architecture 상위 3 파일 (`api.md` · `modules.md` · `race-patterns.md`)

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.93` (비-ADR `L` 축 첫 다-파일 batch) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **비-ADR `L` 축 batch 16 편성** 의 실집행 slice 다. 같은 절 AC 6 이 잔여를 **11 파일 / 44 좌표** 로 실측하고 상위 5 를 hit 내림차순으로 남겼으며 **갈림길 1 구** 에서 "`docs/architecture/*` 잔여 (**9 파일 / 38 좌표**) 를 먼저 소진할지 `.claude/agents/*` (**2 파일 / 6 좌표**) 를 섞을지" 를 편성의 분기로 예고했다. 본 slice 는 **architecture 계열 우선 소진** 을 택해 상위 3 (`api.md` **8 행 / 8 좌표** · `modules.md` **1 행 / 7 좌표** · `race-patterns.md` **5 행 / 7 좌표**) 을 한 batch 로 묶는다 — 좌표 합 **22** 가 `§ 12.83` AC 3 ④ 임계 **70** 을 크게 밑돌아 이월 0 이 가능하고, 편성 파일 수가 대상 3 + audit + task = **5** 로 cap 을 정확히 소진하기 때문이다 (좌표가 아니라 **파일 수** 가 상한을 물리는 첫 slice — `§ 12.93` 파생 (3) 의 재설계 논거에 반례 1 점을 더한다). 파일 성격 심사는 `§ 12.92` AC 3 ② 의 **경로 기준** 확정으로 불요다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **좌표가 가리키는 대상이 규약 범위 밖인 경우**: `api.md` 96 ~ 99 행의 `L103` · `L140` · `L599` 는 `src/**` **controller 소스 행** 을 가리키고 (`(T-0565, L599 controller)`), `race-patterns.md` 165 행의 `L7` · `L3` 은 `docs/progress/journal-*.md` 를 가리킨다. 둘 다 `§ 12.76` AC 3 ② 5 문서군 **밖** 대상이므로, 규약 적용 기준이 **표기가 실린 문서의 경로** 인지 **좌표가 가리키는 대상의 경로** 인지를 본 축에서 처음 명시적으로 결론지어야 한다 (`§ 12.92` AC 3 ② 경로 기준 승계 여부). (나) **`R7` 시점 기록 면제 재심 — 본 축 최대 밀도**: `api.md` 96 ~ 99 행 4 행은 "**이 path 는 shipped 아님 (never-built)** … `로 implemented-on-main 이관`" 이라는 **이관 시점 기록** 서술 안에 있어 지금까지의 재심 대상 중 시점 기록 성격이 가장 짙다 — `§ 12.85` (`ADR-0049` "이하 원문" 비면제) · `§ 12.89` (기판정 면제 재방문) · `§ 12.93` AC 3 ③ (면제 0) 승계로 **행별** 결론이 필요하다. (다) **한 행 7 좌표 슬래시 체인 + ASCII hyphen 범위 집중**: `modules.md` 257 행은 단일 행에 **7 좌표 전량 en dash 범위** (`L7–18` / `L19–22` / … / `L109–128`) 를 슬래시로 이어 붙여 **행당 좌표 밀도 7** 로 비-ADR 축 최대이고 (`§ 12.88` `ADR-0002` 7 좌표 체인과 동형 여부 판정), `race-patterns.md` 는 좌표 7 중 **5 가 ASCII hyphen 범위** (`L82-115` ×2 · `L52-69` ×2 · `L13-16`) 로 `R1` 치환이 한 파일에 집중된 첫 사례다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/architecture/*` 본문의 **비-결정 수정** = `direct`) 의 **열여섯 번째** 적용 선례이며 (`§ 12.93` ③ 이 열다섯 번째), 편집은 `L` prefix 제거 + 구분자 정규화 + 단위어 `행` 부착에 한정되고 문서의 판단 실질 (endpoint 표 · shipped 판정 · 링크 URL · REQ 매핑) 은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` · `R4` · `R6` · `R7` · AC 3 ② **5 문서군 적용 범위** · AC 3 ③ 한정 소급) · `§ 12.78` (`R1` ASCII hyphen 치환 선례) · `§ 12.83` AC 3 ① (수량 범위 = 범위 밖) · AC 3 ④ (좌표 **70** 이월 임계) · AC 5 (rule 5 경계 = 판단 실질) · `§ 12.85` 한계 4 (단위어 부착 3 규칙) · `§ 12.86` AC 3 ③ (파일 단위 전량 동시 정정) · `§ 12.87` AC 3 ①② (링크 label 결합 · 산문 bare 좌표) · `§ 12.88` (7 좌표 슬래시 체인) · `§ 12.90` (문서 간 일관 적용 · 면제 확정 registry) · `§ 12.91` (개정판 `R5` 문언 · AC 4 병기 인용 규약) · `§ 12.93` 전문 (7728 행 ~ 7785 행 · 특히 AC 3 ②③ 이중 검산 절차 · AC 6 잔여 census 와 갈림길 1 구 · 한계 1 · 파생 (1)(3)). 신설 절 `§ 12.94` 는 `§ 12.93` 뒤 · `## 11. References` **직전** 에 append.
- [docs/architecture/api.md](../architecture/api.md) — planner 실측 후보 **8 행 / 8 좌표** (3 · 28 · 74 · 96 · 97 · 98 · 99 · 217 행), 총 **230 행** · 링크 `](` **120** · `## ` heading **9** · fence **0**, `~` 포함 행 **8** · 숫자 사이 en dash 행 **2**. 좌표 형태: PLAN bullet 괄호 단일 (`bullet (L37)` — 3 · 217 행 2 회) · README 산문 범위 (`README.md L83–86, REQ-044` — 28 행 · en dash) · README 산문 단일 (`README L84 후반` — 74 행) · **소스 코드 행 좌표** (`(T-0565, L599 controller)` · `(L103)` ×2 · `(T-0428, PR #346, L140)` — 96 ~ 99 행, 전부 "shipped 아님 (never-built) … implemented-on-main 이관" 문단 안).
- [docs/architecture/modules.md](../architecture/modules.md) — planner 실측 후보 **1 행 / 7 좌표** (257 행 단독), 총 **259 행** · 링크 `](` **97** · `## ` heading **8** · fence **4**, `~` 포함 행 **5** · 숫자 사이 en dash 행 **1**. 좌표 형태: 링크 뒤 슬래시 체인 (`[README.md](../../README.md) — L7–18 (REQ-005~007 GitHub) / L19–22 (REQ-044 3 권한) / L33–41 / L45–51 / L68–71 / L96–103 / L109–128 (...)`) — **7 좌표 전량 en dash 범위**, 좌표마다 괄호 주석이 개재.
- [docs/architecture/race-patterns.md](../architecture/race-patterns.md) — planner 실측 후보 **5 행 / 7 좌표** (65 · 165 · 172 · 177 · 178 행), 총 **185 행** · 링크 `](` **18** · `## ` heading **9** · fence **0**, `~` 포함 행 **3** · 숫자 사이 en dash 행 **0** · 좌표 ASCII hyphen 행 **4**. 좌표 형태: 링크 뒤 ASCII hyphen 범위 (`ci.yml](...) L82-115` — 65 행 · `integrator.md](...) L52-69` — 172 · 177 행 · `L13-16 (issue_comment trigger) + L82-115 (reviewer-gate step)` — 178 행 **2 좌표**) · **journal 파일 지시 단일 좌표** (`journal-2026-05-30.md](...) L7 (...) + journal-2026-05-31.md](...) L3 (...)` — 165 행 **2 좌표**).
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절 (`§ 12.76 R5 (§ 12.91 개정)` 병기 인용 규약 포함).

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.94` 안에 ① 선정 근거 (`§ 12.93` 파생 (1) 1 순위 · AC 6 갈림길에서 **architecture 계열 우선 소진** 을 택한 이유 · 상위 3 파일이 잔여 좌표 **44** 중 **22 (50.0%)** 라는 실측), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인 · 파일 전체 정규식을 쓴 경우 census 동수 검산으로 부수 편집 0 을 보였음), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열여섯 번째 선례** · `§ 12.93` ③ 의 열다섯 번째 뒤임을 명시), ④ **cap 판정** (좌표 **22** 는 임계 **70** 을 크게 밑돌아 이월 **0**, 그러나 파일 수가 **5/5** 로 cap 을 정확히 소진해 **좌표가 아니라 파일 수가 상한을 물린 첫 slice** 임을 적시하고 `§ 12.93` 파생 (3) 의 "좌표 수 기준 재설계" 논거에 본 실측 (좌표 **22** / 파일 **5**) 이 **반례 방향** 임을 1 문장으로 기록) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (파일별 집계 1 구).** 세 파일 각각에 `grep -cE 'L[0-9]+'` (행) · `grep -oE 'L[0-9]+' | wc -l` (좌표) · `grep -cE '[0-9] *~ *[0-9]'` · `grep -cE '[0-9] *– *[0-9]'` (en dash) · `grep -cE 'L[0-9]+ *- *[0-9]'` (좌표 ASCII hyphen) 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**8 / 8** · **1 / 7** · **5 / 7**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). 행 대비 좌표 격차를 파일별로 적고 (`modules.md` 는 **1 행 7 좌표** 로 본 축 최대 밀도 — `§ 12.93` 의 p4 35 행 **9 좌표** 와 1 구 대조), **비-좌표 `~` 를 담은 행 수** 를 좌표 동반 여부와 분리해 기록해 `§ 12.93` AC 3 ② **이중 검산** 의 분모를 남긴다. 좌표를 **단일 (`R4` 병용)** 과 **범위 (`R1` 적용)** 로 분할한 수 (planner 기준 **9 / 13**) 도 기록.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **범위 밖 대상을 가리키는 좌표** — `api.md` 96 ~ 99 행의 `L103` · `L140` · `L599` 는 `src/**` controller 행을, `race-patterns.md` 165 행의 `L7` · `L3` 은 `docs/progress/journal-*.md` 를 가리켜 **좌표가 지시하는 대상이 `§ 12.76` AC 3 ② 5 문서군 밖** 이라는 구조를 적시하고, 규약 적용 기준이 **표기가 실린 문서의 경로** 임을 `§ 12.92` AC 3 ② 경로 기준 승계로 결론지어 정정 대상 여부를 확정한다 (`.github/workflows/ci.yml` · `.claude/agents/integrator.md` 를 가리키는 65 · 172 · 177 · 178 행과의 취급 차이 유무도 1 문장). 소스 좌표는 코드 변경으로 값이 빠르게 흔들린다는 점을 **한계** 로 넘긴다 (본 절에서 값 검증 금지). ② **`R7` 시점 기록 면제 재심 — 본 축 최짙은 사례** — `api.md` 96 ~ 99 행이 "**shipped 아님 (never-built)** … `로 implemented-on-main 이관`" 이라는 이관 시점 기록 서술 안에 있음을 인용하고, `R7` 이 면제하는 것이 "날짜 · 판정 시점 stamp 가 박히거나 당시 판의 증거로 기능하는 문장의 범위 표기" 라는 문언에 비추어 **행별** 로 면제 · 비면제를 결론짓는다 (`§ 12.85` · `§ 12.89` · `§ 12.93` AC 3 ③ 승계 — 면제 시 `§ 12.90` AC 6 ② 면제 확정 registry 에 추가할 좌표를, 비면제 시 그 근거를 명시). ③ **한 행 7 좌표 슬래시 체인 + ASCII hyphen 집중** — `modules.md` 257 행의 7 좌표 전량 정정에서 좌표마다 괄호 주석이 개재하므로 `§ 12.85` 한계 4 의 "낱말 개재 시 좌표마다 부착" 이 **7 회 전량** 에 걸리는지, `§ 12.88` 의 `ADR-0002` 7 좌표 슬래시 체인 판정과 **동형** 인지를 1 문단으로 결론짓고, `race-patterns.md` 의 ASCII hyphen 범위 **5 좌표** 를 `§ 12.78` `R1` 치환 선례 승계로 `~` 정규화하되 한 파일에 hyphen 이 집중된 첫 사례임을 1 구 기록한다.
- [ ] **AC 4 — 대조표.** 후보 **14 행** 전량을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문 / 승계 선례` **7 컬럼** 표로 박제한다 (행이 14 라 `§ 12.93` 같은 묶음 압축 없이 전량 열거가 가능하나, 절 ≤ 60 행 제약과 충돌하면 파일 × 표기 형태별 묶음으로 압축하고 그 이유를 표 앞 1 구로 명시). 범위 밖 (수량 · 식별자 범위) 표기는 **마지막 1 행** 으로 묶어 무편집임을 적고, `R6` · `R7` 면제 판별 건수 · 단일 좌표 (`R4`) 대 범위 좌표 (`R1`) 수 · 단위어 부착 횟수 · 조사 보정 건수를 표 뒤 **1 구** 로 구분해 기록.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 **파일별** 추가 행 수 = 삭제 행 수 임을 보이고 (예상 **8/8** · **1/1** · **5/5** — 실측값과 차이가 나면 hunk 흡수 몫인지 1 구 설명), hunk 가 endpoint 표 · 산문 · References 어디에 떨어지든 `§ 12.83` AC 5 · `§ 12.89` AC 5 의 "rule 5 경계는 **구간이 아니라 판단 실질**" 판정을 승계해 비-결정 수정임을 1 문장 확인. endpoint path · HTTP method · REQ ID · task ID · PR 번호 · shipped 판정 문구 · 링크 URL 무변경을 링크 수 불변 (**120** · **97** · **18**) 으로 검산. 정정 후 재실측으로 **행 수 230 · 259 · 185 불변** · `## ` heading **9 · 8 · 9 불변** · fence **0 · 4 · 0 불변** · `L` prefix **잔존 0** (또는 면제로 남긴 건수와 근거) · 비-좌표 `~` 행 수 **8 · 5 · 3 불변** 을 기록 (`§ 12.93` AC 3 ② 이중 검산 절차 승계).
- [ ] **AC 6 — 비-ADR `L` 축 잔여 갱신.** 정정 후 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 과 좌표 총계를 실행해 `§ 12.93` AC 6 의 값 (**11 파일 / 44 좌표**) 과 대조하고 잔여를 **파일 수 + 좌표 수 양쪽** 으로 기록한다 (감소분이 본 batch 처리분 **3 파일 / 22 좌표** 와 일치하는지 1 구 검산). 잔여 파일을 hit 내림차순 **상위 5** 까지 (파일 · 행 · 좌표 · `~` 행) 표 밖 1 구로 적어 batch 17 편성 입력을 남기되 편성 자체는 하지 않는다. `docs/architecture/*` 잔여와 `.claude/agents/*` 잔여를 **분리 집계** 해 agents 계열만 남는 시점 예측을 1 구 갱신. ADR 축은 본 batch 미대상이라 `§ 12.90` 마감 상태 (미판정 좌표 **0** · 면제 확정 `ADR-0008`:149 **2 좌표**) 불변임을 확인.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. 본 절이 `R5` 를 인용할 때 **`§ 12.76 R5 (§ 12.91 개정)`** 병기 형태만 썼고 구판 단독 인용이 **0** 임도 1 구 자기 검산 (`§ 12.92` 한계 6 · `§ 12.93` AC 7 관측 계속 — 3 회차). `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값 (**7800 → ?**) 으로 신설 절 **≤ 60 행**, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일**, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · 다른 `docs/architecture/*` · `docs/decisions/` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **7 컬럼 균일** · heading 순번 `12.93` → `12.94` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 16 결과 수치 · 처리 좌표 수 · architecture 계열 우선 소진 채택 · 잔여가 절반 아래로 내려갔는지 · batch 6 ~ 16 누적 정정 좌표 갱신 (`§ 12.93` 기준 **227**)), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 + **소스 코드 좌표의 값 안정성** 이 문서 좌표보다 낮다는 신규 항 · 파일 성격 경로 기준의 손실 승계 · 문서 간 일관성의 grep 미검출 · 회색지대 조문 부재 (`R8` 이월 목록 현행화 — 본 slice 의 **범위 밖 대상 좌표** 판정이 이월에 추가되는지) · 단위어 부착 규칙의 비조문성 · 개정판 `R5` 인용 분산 관측 3 회차 · FU14 anchor 흡수 관계), 파생 영향 **목록만** (다음 1 순위 = 비-ADR `L` 축 **batch 17** 편성 (AC 6 잔여 상위 목록 기반 · architecture 잔여와 `.claude/agents/*` 혼합 여부) · `R8` 조문화 · batch 상한 재설계 (본 slice 가 파일 수 상한 반례) · 5 문서군 적용 범위 재확인 잔여분 (`docs/use-cases/*` 편입) · S4 조건부) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 대상 3 파일 **밖** 의 편집 — 비-ADR `L` 잔존 나머지 **8 파일** (`data-model.md` · `.claude/agents/integrator.md` 등) 정규화는 별도 slice.
- **좌표가 가리키는 대상 파일** (`docs/PLAN.md` · `README.md` · `src/**` controller · `.github/workflows/ci.yml` · `.claude/agents/integrator.md` · `docs/progress/journal-*.md`) 의 편집 · 행 번호 정확성 검증 — 표기만 다루고 값은 다루지 않는다 (`§ 12.74` · `§ 12.92` 한계 1 · `§ 12.93` 한계 1 승계).
- **수량 범위 · 식별자 범위 표기 편집** — `REQ-005~007` · `REQ-051~055` 같은 식별자 범위와 수량 범위는 범위 밖이라 **무편집** 이다 (건드리면 AC 5 이중 검산이 깨진다).
- **`docs/use-cases/*` 파일군** (`UC-01` ~ `UC-09` · `INDEX.md` · audit 자신) 의 `L` 좌표 — `§ 12.76` AC 3 ② 5 문서군 **밖**. 범위 편입 판단은 별도 slice.
- **ADR 재방문** — `§ 12.90` 이 `L` 축 ADR 마감을 선언했고 `ADR-0008`:149 는 면제 확정분이라 손대지 않는다.
- **`§ 12.76` 조문 본문 · 개정판 `R5` 문언 편집** — 본 slice 는 개정판을 **적용** 할 뿐 다시 개정하지 않는다. 범위 밖 대상 좌표 · 식별자 범위 계수 제외는 `R8` 이월 유지.
- **`R8` 조문화** · `R2` · `R3` 병합 재설계 · 면제 registry 조문화 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 대상 파일의 **판단 실질** (`api.md` 의 endpoint 표 · shipped / never-built 판정 · REQ 매핑 · 권한 등급, `modules.md` 의 모듈 경계, `race-patterns.md` 의 race 패턴 결론) 변경, 링크 URL 변경, heading 구조 변경.
- 기존 audit 절 본문의 **소급 수정** — 결론은 신설 절 `§ 12.94` 안에서만 박제한다 (기록 보존 · append-only `§ 12.15`).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · architecture 문서 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **비-ADR `L` 축 batch 17 편성** — AC 6 이 남길 잔여 상위 목록 기반. architecture 잔여를 계속 소진할지 `.claude/agents/*` 2 파일을 섞을지가 갈림길 (`§ 12.92` AC 3 ② 경로 기준으로 성격 심사는 불요).
- **batch 상한의 재설계** — `§ 12.93` 파생 (3) 이 "좌표 수 기준" 을 제안했으나 본 slice 는 좌표 **22** 로 여유가 크면서 파일 수 **5/5** 로 cap 을 소진한다. 좌표 · 파일 **이중 상한** 이 실제 편성 제약임을 입력으로 남긴다.
- **범위 밖 대상을 가리키는 좌표의 조문화** — AC 3 ① 결론 (표기 실린 문서 경로 기준) 을 `R8` 이월 목록에 추가할지 검토.
