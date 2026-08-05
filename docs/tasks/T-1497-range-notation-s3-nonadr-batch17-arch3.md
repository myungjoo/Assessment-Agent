---
id: T-1497
title: 범위 표기 규약 축 S3 batch 17 — 비-ADR `L` 축 architecture 상위 3 파일 (`data-model.md` · `frontend-api-contract.md` · `directory.md`) 개정판 R5 · R4 · R1 정규화 + heading 안 좌표 (anchor slug) · 같은 행 숫자 충돌 · 이미 정규화된 좌표와의 행 내 혼용 판정 (audit §12.95)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 130
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1496]
touchesFiles:
  - docs/architecture/data-model.md
  - docs/architecture/frontend-api-contract.md
  - docs/architecture/directory.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1497-range-notation-s3-nonadr-batch17-arch3.md
plannerNote: "uc-doc-audit-resync 109 번째 slice — §12.94 파생 (1) 1 순위 batch 17, architecture 잔여 상위 3 파일 11 행 / 12 좌표, direct 5 파일"
---

# T-1497 — 범위 표기 규약 축 S3 batch 17 — 비-ADR `L` 축 architecture 상위 3 파일 (`data-model.md` · `frontend-api-contract.md` · `directory.md`)

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.94` (비-ADR `L` 축 architecture 상위 3 파일 batch) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **batch 17 편성** 의 실집행 slice 다. 같은 절 AC 6 이 잔여를 **8 파일 / 22 좌표** 로 실측하고 `docs/architecture/*` **6 파일 / 16 좌표** 와 `.claude/agents/*` **2 파일 / 6 좌표** 로 분리 집계하면서, 갈림길을 "architecture 6 파일을 계속 소진할지 agents 2 파일을 섞을지" 로 남겼다. 본 slice 는 `§ 12.94` AC 1 ① 이 채택한 **architecture 계열 우선 소진** 을 그대로 승계해 잔여 architecture 상위 3 (`data-model.md` **5 행 / 5 좌표** · `frontend-api-contract.md` **4 행 / 4 좌표** · `directory.md` **2 행 / 3 좌표**) 을 한 batch 로 묶는다 — 잔여 8 파일 중 **3 파일이 1 좌표뿐** 이라 좌표 수 기준 편성은 무의미하고 (`§ 12.94` 파생 (1) 이 "파일 수 cap 이 다시 물릴 공산" 을 예고), 편성 파일 수가 대상 3 + audit + task = **5/5** 로 cap 을 정확히 소진해 **파일 수가 상한을 물린 두 번째 slice** 가 되기 때문이다. 좌표 합 **12** 는 `§ 12.83` AC 3 ④ 임계 **70** 을 크게 밑돌아 이월 **0**. 본 batch 이후 architecture 잔여는 **3 파일 / 4 좌표** 만 남아 `§ 12.94` AC 6 의 "agents 계열만 남는 시점 = **batch 18 전후**" 예측이 batch 18 로 확정 가능해진다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **heading 안 좌표 · anchor slug 첫 사례**: `frontend-api-contract.md` 의 좌표 **4 전량** 이 `### 3.1 … ([PLAN.md](../PLAN.md) P6 L115)` 형태로 **`###` heading 문자열 안** 에 있다. 지금까지의 좌표는 전부 산문 · 표 · 링크 label 안이었고 heading 은 처음이라, 정정이 **anchor slug 를 바꾼다** (`…-p6-l115` → `…-p6-115-행`) 는 부수효과가 `§ 12.83` AC 5 의 "판단 실질 무편집" 경계 안에 드는지, inbound anchor 링크가 깨지는지를 본 축에서 처음 결론지어야 한다 (planner 사전 실측: `frontend-api-contract.md#` 형태 inbound 링크 **0**). 아울러 `P6 L115` 는 **phase 식별자 + 좌표** 결합 형태라 `L` 제거 후 `P6 115 행` 의 가독성 판정도 필요하다. (나) **같은 행 · 같은 숫자 · 다른 대상 충돌**: `data-model.md` 3 행은 한 행 안에 `bullet (L38)` (대상 = `docs/PLAN.md`) 과 이미 정규화된 `38 행 \`13 entity\`` (대상 = 자기 자신) 를 **동시에** 담아 숫자 `38` 이 충돌한다 — `§ 12.94` AC 1 ② 가 파일 단위로 관측한 "정규식 오염 위험" 이 **행 단위** 로 좁혀진 첫 사례이자, 이미 정규화된 좌표와 미정규화 좌표의 **행 내 혼용** (`§ 12.94` 는 파일 내 혼용) 첫 사례다. (다) **쉼표 구분 2 hyphen 범위 + 식별자 범위 2 종 공존**: `directory.md` 197 행은 `L16-18 (REQ-005~007 …), L96-103 (REQ-049 / REQ-051~055 …)` 로 ASCII hyphen 범위 2 를 **쉼표** 로 잇고 (`§ 12.94` `modules.md` 257 행은 슬래시) 괄호 주석 안에 식별자 범위 **2 종** 이 들어있어 `§ 12.83` AC 3 ① 범위 밖 판정과 `R1` 치환이 한 행에서 맞물린다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/architecture/*` 본문의 **비-결정 수정** = `direct`) 의 **열일곱 번째** 적용 선례이며 (`§ 12.94` ③ 이 열여섯 번째), 편집은 `L` prefix 제거 + 구분자 정규화 + 단위어 `행` 부착에 한정되고 문서의 판단 실질 (entity 표 · cardinality · invariant · 화면별 endpoint 맵 · 디렉토리 layout · REQ 매핑 · 링크 URL) 은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` · `R4` · `R6` · `R7` · AC 3 ② **5 문서군 적용 범위** · AC 3 ③ 한정 소급) · `§ 12.78` (`R1` ASCII hyphen 치환 선례) · `§ 12.83` AC 3 ① (수량 · 식별자 범위 = 범위 밖) · AC 3 ④ (좌표 **70** 이월 임계) · AC 5 (rule 5 경계 = 판단 실질) · `§ 12.85` 한계 4 (단위어 부착 3 규칙) · `§ 12.87` AC 3 ①② (링크 label 결합 · 산문 bare 좌표) · `§ 12.88` (7 좌표 체인) · `§ 12.90` (문서 간 일관 적용 · 면제 확정 registry) · `§ 12.91` (개정판 `R5` 문언 · AC 4 병기 인용 규약) · `§ 12.94` 전문 (7787 행 ~ 7843 행 · 특히 AC 1 ①②④ · AC 3 ①②③ · AC 5 이중 검산 분모 확정 · AC 6 잔여 census 와 분리 집계 · 한계 3 · 파생 (1)(3)). 신설 절 `§ 12.95` 는 `§ 12.94` 뒤 · `## 11. References` **직전** 에 append.
- [docs/architecture/data-model.md](../architecture/data-model.md) — planner 실측 후보 **5 행 / 5 좌표** (3 · 78 · 89 · 155 · 178 행), 총 **193 행** · 링크 `](` **92** · `## ` heading **8** · fence **2**, `~` 포함 행 **3** · en dash 행 **0** · 좌표 ASCII hyphen **0**. 좌표 형태: PLAN bullet 괄호 단일 (`bullet (L38) 을` — 3 · 178 행 2 회) · 산문 bare 단일 (`README L63` — 78 · 155 행 2 회) · 링크 뒤 bare 단일 (`[README.md](../../README.md) L59` — 89 행). **3 행 주의** — 같은 행에 이미 정규화된 자기 참조 좌표 `38 행` 이 공존해 숫자 `38` 이 충돌한다.
- [docs/architecture/frontend-api-contract.md](../architecture/frontend-api-contract.md) — planner 실측 후보 **4 행 / 4 좌표** (40 · 49 · 63 · 81 행), 총 **131 행** · 링크 `](` **23** · `## ` heading **7** · fence **0**, `~` 포함 행 **2** · en dash 행 **0** · 좌표 ASCII hyphen **0**. 좌표 형태: **`###` heading 안** 의 phase prefix 결합 단일 (`### 3.1 … ([PLAN.md](../PLAN.md) P6 L115)` — `L115` · `L116` · `L117` · `L118` 순차).
- [docs/architecture/directory.md](../architecture/directory.md) — planner 실측 후보 **2 행 / 3 좌표** (3 · 197 행), 총 **203 행** · 링크 `](` **64** · `## ` heading **10** · fence **2**, `~` 포함 행 **5** · en dash 행 **0** · 좌표 ASCII hyphen 행 **1**. 좌표 형태: 링크 뒤 괄호 단일 (`([PLAN.md](../PLAN.md) L87) 가` — 3 행) · 한 행 쉼표 구분 hyphen 범위 **2** (`L16-18 (REQ-005~007 GitHub 3 instance), L96-103 (REQ-049 / REQ-051~055 LLM 5 provider …)` — 197 행).
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절 (`§ 12.76 R5 (§ 12.91 개정)` 병기 인용 규약 포함).

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.95` 안에 ① 선정 근거 (`§ 12.94` 파생 (1) 1 순위 · AC 6 갈림길에서 **architecture 계열 우선 소진 승계** 를 택한 이유 · 잔여 8 파일 중 **3 이 1 좌표뿐** 이라 좌표 기준 편성이 무의미하다는 실측 · 상위 3 이 잔여 좌표 **22** 중 **12 (54.5%)** 라는 비율), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인 · `data-model.md` 3 행의 숫자 충돌 때문에 **정규식 치환을 쓰지 않고 행별 문자열 편집** 을 택했음을 명시), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열일곱 번째 선례** · `§ 12.94` ③ 의 열여섯 번째 뒤임을 명시), ④ **cap 판정** (좌표 **12** 는 임계 **70** 을 크게 밑돌아 이월 **0**, 파일 수는 **5/5** 로 cap 소진 → **파일 수가 상한을 물린 두 번째 slice** 임을 적시하고 `§ 12.94` 파생 (3) 의 **좌표 · 파일 이중 상한** 재설계 논거에 본 실측 (좌표 **12** / 파일 **5**) 이 **두 번째 증거점** 임을 1 문장 기록) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (파일별 집계 1 구).** 세 파일 각각에 `grep -cE 'L[0-9]+'` (행) · `grep -oE 'L[0-9]+' | wc -l` (좌표) · `grep -cE '[0-9] *~ *[0-9]'` · `grep -cE '[0-9] *– *[0-9]'` (en dash) · `grep -cE 'L[0-9]+ *- *[0-9]'` (좌표 ASCII hyphen) 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**5 / 5** · **4 / 4** · **2 / 3**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). 좌표를 **단일 (`R4` 병용)** 과 **범위 (`R1` 적용)** 로 분할한 수 (planner 기준 **10 / 2**) 를 기록하고, `§ 12.94` AC 5 가 확정한 **이중 검산 분모 규칙** (raw `~` 행이 아니라 **좌표 토큰 제거 후 값**) 을 본 batch 에서 처음부터 적용해 파일별 **순수 비-좌표 `~` 행 수** 를 정정 전 값으로 먼저 기록한다. 정정 대상이 아닌 **이미 정규화된 좌표** (`N 행` · `N~M 행` 형태) 수도 파일별로 세어 (특히 `data-model.md` 3 행의 `38 행`) 혼용의 분모를 남긴다.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **heading 안 좌표 · anchor slug 부수효과** — `frontend-api-contract.md` 40 · 49 · 63 · 81 행의 좌표 4 가 전부 `### 3.x` heading 문자열 안에 있음을 인용하고, 정정이 **GitHub anchor slug 를 바꾼다** 는 사실을 적시한 뒤 (가) inbound anchor 링크 실측 (`grep -rn 'frontend-api-contract.md#' --include=*.md .` — planner 사전값 **0**) 으로 실제 파손 0 임을 보이고 (나) slug 변경이 `§ 12.83` AC 5 의 "판단 실질" 에 해당하지 않아 rule 5 `direct` 경계 안임을 결론짓는다. `P6 L115` 의 **phase 식별자 + 좌표 결합** 형태를 `P6 115 행` 으로 둘지 다른 형태로 둘지도 1 구로 확정하고, heading 안 좌표가 앞으로도 나올 수 있으므로 `R8` 이월 목록 추가 여부를 판단한다. ② **같은 행 · 같은 숫자 · 다른 대상 충돌** — `data-model.md` 3 행이 `bullet (L38)` (대상 `docs/PLAN.md`) 과 `38 행` (자기 참조) 을 한 행에 담아 숫자가 겹치는 구조를 인용하고, 이것이 (가) **정규식 치환 금지 · 행별 문자열 편집 의무** 의 근거임을 `§ 12.94` AC 1 ② 승계로 적고 (나) **이미 정규화된 좌표와 미정규화 좌표의 행 내 혼용** 첫 사례로서 `§ 12.90` 문서 간 일관 적용이 **행 단위** 까지 내려온다는 점을 결론짓는다. 자기 참조 좌표 `38 행` 은 **이미 규약 준수** 라 무편집임도 명시. ③ **쉼표 구분 2 hyphen 범위 + 식별자 범위 공존** — `directory.md` 197 행의 `L16-18` · `L96-103` 을 `§ 12.78` `R1` 치환 선례 승계로 `~` 정규화하되, 구분자가 슬래시가 아니라 **쉼표** 라 `§ 12.94` AC 3 ③ (`modules.md` 슬래시 체인) 과 동형인지 다른지를 1 구로 판정하고, 같은 행 괄호 주석 안의 식별자 범위 **`REQ-005~007` · `REQ-051~055`** 는 `§ 12.83` AC 3 ① 범위 밖이라 **무편집** 임을 확인한다 (`§ 12.85` 한계 4 부착 규칙이 좌표마다 걸리는지도 1 구).
- [ ] **AC 4 — 대조표.** 후보 **11 행** 전량을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문 / 승계 선례` **7 컬럼** 표로 박제한다 (11 행이라 파일 × 표기 형태별 묶음으로 압축 가능 — 압축 시 묶음마다 행 번호 + 건수를 적는다). 범위 밖 (수량 · 식별자 범위) 표기와 **이미 정규화된 좌표** 는 각각 마지막 행으로 묶어 무편집임을 적고, `R6` · `R7` 면제 판별 건수 · 단일 좌표 (`R4`) 대 범위 좌표 (`R1`) 수 · 단위어 부착 횟수 · 조사 보정 건수 · heading 안 좌표 건수를 표 뒤 **1 구** 로 구분해 기록.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 **파일별** 추가 행 수 = 삭제 행 수 임을 보이고 (예상 **5/5** · **4/4** · **2/2** — 실측이 다르면 hunk 흡수 몫인지 1 구 설명), `§ 12.83` AC 5 · `§ 12.94` AC 5 의 "rule 5 경계는 **구간이 아니라 판단 실질**" 판정 승계로 비-결정 수정임을 1 문장 확인. entity 표 · cardinality · invariant 문구 · REQ ID · task ID · 화면별 endpoint 맵 · 디렉토리 경로 · 링크 URL 무변경을 링크 수 불변 (**92** · **23** · **64**) 으로 검산. 정정 후 재실측으로 **행 수 193 · 131 · 203 불변** · `## ` heading **8 · 7 · 10 불변** · `### ` heading 문자열은 좌표 토큰만 변했고 **개수 불변** · fence **2 · 0 · 2 불변** · `L` prefix **잔존 0** (또는 면제로 남긴 건수와 근거) · 순수 비-좌표 `~` 행 수 불변 (AC 2 의 좌표 토큰 제거 후 값 기준) 을 기록.
- [ ] **AC 6 — 비-ADR `L` 축 잔여 갱신.** 정정 후 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 과 좌표 총계를 실행해 `§ 12.94` AC 6 의 값 (**8 파일 / 22 좌표**) 과 대조하고 잔여를 **파일 수 + 좌표 수 양쪽** 으로 기록한다 (감소분이 본 batch 처리분 **3 파일 / 12 좌표** 와 일치하는지 1 구 검산). 잔여 파일 전량 (예상 **5**) 을 hit 내림차순으로 (파일 · 행 · 좌표 · 순수 `~` 행) 표 밖 1 구로 적어 batch 18 편성 입력을 남기되 편성 자체는 하지 않는다. `docs/architecture/*` 잔여와 `.claude/agents/*` 잔여를 **분리 집계** 해 `§ 12.94` 의 "agents 계열만 남는 시점 = batch 18 전후" 예측이 **batch 18 로 확정 가능한지** 를 1 구로 갱신 (architecture 잔여가 3 파일 / 4 좌표면 batch 18 이 architecture 를 마감하고 batch 19 가 agents 2 파일이 되는지, 아니면 batch 18 에서 혼합 마감이 가능한지). ADR 축은 본 batch 미대상이라 `§ 12.90` 마감 상태 (미판정 좌표 **0** · 면제 확정 `ADR-0008`:149 **2 좌표**) 불변임을 확인.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. 본 절이 `R5` 를 인용할 때 **`§ 12.76 R5 (§ 12.91 개정)`** 병기 형태만 썼고 구판 단독 인용이 **0** 임도 1 구 자기 검산 (`§ 12.92` 한계 6 · `§ 12.94` AC 7 관측 계속 — **4 회차**). `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값 (**7858 → ?**) 으로 신설 절 **≤ 60 행**, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일**, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · 다른 `docs/architecture/*` · `docs/decisions/` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **7 컬럼 균일** · heading 순번 `12.94` → `12.95` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 17 결과 수치 · 처리 좌표 수 · heading 안 좌표 판정 신설 · 잔여가 절반 아래로 내려갔는지 · batch 6 ~ 17 누적 정정 좌표 갱신 (`§ 12.94` 기준 **249**)), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · **anchor slug 변경의 외부 파손 미검출 위험** — repo 밖 링크 · 대화 기록의 anchor 는 grep 범위 밖이라는 신규 항 · 문서 간 일관성의 grep 미검출 · 회색지대 조문 부재 (`R8` 이월 목록 현행화 — heading 안 좌표 · 행 내 숫자 충돌이 추가되는지) · 단위어 부착 규칙의 비조문성 · 개정판 `R5` 인용 분산 관측 4 회차 · FU14 anchor 흡수 관계), 파생 영향 **목록만** (다음 1 순위 = 비-ADR `L` 축 **batch 18** 편성 (architecture 잔여 3 파일 마감 또는 agents 혼합) · `R8` 조문화 · 좌표 · 파일 이중 상한 재설계 · 5 문서군 적용 범위 재확인 잔여분 (`docs/use-cases/*` 편입) · S4 조건부) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 대상 3 파일 **밖** 의 편집 — 비-ADR `L` 잔존 나머지 **5 파일** (`realdata-e2e-guard-harness.md` · `components.md` · `deployment.md` · `.claude/agents/integrator.md` · `.claude/agents/reviewer.md`) 정규화는 별도 slice.
- **좌표가 가리키는 대상 파일** (`docs/PLAN.md` · `README.md`) 의 편집 · 행 번호 정확성 검증 — 표기만 다루고 값은 다루지 않는다 (`§ 12.74` · `§ 12.92` 한계 1 · `§ 12.94` 한계 1 승계).
- **수량 범위 · 식별자 범위 표기 편집** — `REQ-005~007` · `REQ-051~055` · `UC-01 ~ UC-09` 같은 식별자 범위와 수량 범위는 범위 밖이라 **무편집** 이다 (건드리면 AC 5 이중 검산이 깨진다).
- **이미 정규화된 좌표** (`data-model.md` 3 행의 `38 행` 등) 의 재편집 — 규약 준수분이라 손대지 않는다 (혼용 분모 증거로만 인용).
- **heading 구조 변경 · anchor 보정 링크 추가** — 좌표 토큰만 정정하고 heading 순번 · 제목 문구 · 다른 문서의 링크는 손대지 않는다 (inbound anchor 링크가 실측 0 이 아니면 AC 3 ① 에 기록만 하고 별도 slice 로 넘긴다).
- **`docs/use-cases/*` 파일군** 의 `L` 좌표 — `§ 12.76` AC 3 ② 5 문서군 **밖**. 범위 편입 판단은 별도 slice.
- **ADR 재방문** — `§ 12.90` 이 `L` 축 ADR 마감을 선언했고 `ADR-0008`:149 는 면제 확정분이라 손대지 않는다.
- **`§ 12.76` 조문 본문 · 개정판 `R5` 문언 편집** · `R8` 조문화 · `R2` · `R3` 병합 재설계 · 면제 registry 조문화 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 대상 파일의 **판단 실질** (`data-model.md` 의 entity 표 · cardinality · raw 미저장 invariant, `frontend-api-contract.md` 의 화면별 endpoint 맵 · RBAC 가시성 · gap 목록, `directory.md` 의 디렉토리 layout · 모듈 매핑) 변경, 링크 URL 변경.
- 기존 audit 절 본문의 **소급 수정** — 결론은 신설 절 `§ 12.95` 안에서만 박제한다 (기록 보존 · append-only `§ 12.15`).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · architecture 문서 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **비-ADR `L` 축 batch 18 편성** — AC 6 이 남길 잔여 (예상 **5 파일 / 10 좌표**) 기반. architecture 잔여 3 파일 (`realdata-e2e-guard-harness.md` · `components.md` · `deployment.md`) 을 마감할지 `.claude/agents/*` 2 파일을 섞을지가 갈림길이며, 파일 수 cap 5 아래에서 3 파일씩이면 batch 19 로 전체 마감이 예상된다.
- **heading 안 좌표의 조문화** — AC 3 ① 결론 (anchor slug 부수효과 허용 여부) 을 `R8` 이월 목록에 추가할지 검토.
- **좌표 · 파일 이중 상한 재설계** — `§ 12.94` 파생 (3) 에 본 slice 실측 (좌표 **12** / 파일 **5**) 이 두 번째 증거점.
