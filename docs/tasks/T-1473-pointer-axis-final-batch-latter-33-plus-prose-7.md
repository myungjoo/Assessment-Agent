---
id: T-1473
title: pointer 축 최종 batch — `docs/requirements.md` 표 컬럼 후반 33 지점 (REQ-034 ~ REQ-066) + 산문 잔여 7 (`deployment.md` · `directory.md` · `reviewer.md`) 합류 40 지점 실판정 + audit §12.71
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1472]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1473-pointer-axis-final-batch-latter-33-plus-prose-7.md
plannerNote: "uc-doc-audit-resync 85 번째 slice — §12.70 FU(1) 합류안 집행. 후반 33 + 산문 7 = 40 지점으로 pointer 축 140 전량 소진. doc-only 1.6x"
---

# T-1473 — pointer 축 최종 batch (후반 33 + 산문 잔여 7 = 40 지점)

## Why

[T-1472](T-1472-requirements-table-column-pointer-audit-first-33.md) 가 `docs/requirements.md` 표 `README 행` 컬럼 **전반 33** 을 전수 판정하며 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.70` — **33 : 34 : 33 : 0 : 0**, 참율 **100%** · 집단 stale 0 · 단조 역전 0 · 중복 0) pointer 축을 정정 census **140** 중 **100 판정 = 71.4%** 로 끌어올렸고, 파생 영향 **(1)** 은 잔여 **40** (= 표 컬럼 후반 **33** + 산문 **7**) 을 **한 batch 합류** 로 소진하는 안이 유효함을 행당 실측 비용 (`40 + 2 + 37 = 79 행` + 산문 census 1 ~ 2 행 ≈ **81 행** < 상한 100) 으로 검산해 1 순위로 지목했다. 본 slice 는 그 안을 그대로 집행해 **pointer 축을 전량 마감** 한다.

본 slice 는 세 가지 점에서 앞선 batch 와 다르다. ① **두 성질의 축을 한 절에서 다룬다** — 표 컬럼 (REQ 정의 자체의 좌표) 과 산문 (README 를 인용하는 서술) 이 섞이므로 판정표를 두 blok 으로 나누고 다중 표기 수치도 **분리 + 합계** 로 보고해야 한다. ② **`§ 12.70` (b) 명제의 최종 검증대** 다 — "정확도의 설명 변수는 문서 종류가 아니라 **절 단위 광역 범위** 표기" 라는 명제는 3 batch 에서 단조 동행으로 지지됐는데, 후반 33 은 전반 33 (범위 비중 3.0%) 보다 범위 표기가 많아 보이고 (`REQ-038 = 68-71` 등) README **61 ~ 151** 구간을 겨냥해 절 밀도가 다르므로, 명제가 **같은 문서 안에서도** 성립하는지가 결정적으로 갈린다. ③ **pointer 축 총결산** — 140 전량 판정이 끝나므로 축 전체의 참율 · 거짓 0 지속 여부 · 정정 batch 누적 규모를 한 번에 확정한다.

**어떤 파일도 편집하지 않는다** — `requirements.md` · `README.md` · `deployment.md` · `directory.md` · `.claude/agents/reviewer.md` 는 판정 대상일 뿐이고 결과는 audit 절 `§ 12.71` 에만 박제한다 (`§ 12.15` append-only + `§ 12.68` ~ `§ 12.70` 선례 승계).

**context 위험 경고 (본 slice 고유)** — `docs/requirements.md` **53 ~ 85 행** 의 `상태` 컬럼에는 REQ-036 · REQ-037 처럼 **한 행이 수 KB 인 초장문 재판정 기록** 이 있다. `sed -n '53,85p'` 같은 raw 출력은 context 를 파괴하므로 **금지** 하고, 반드시 `awk -F'|'` 로 `REQ` · `README 행` · `요약` **3 컬럼만 필드 추출** 한다 (`§7` context 절약).

planner 사전 census — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **33** 회 있고, `§ 12.70` 에서 처음으로 census 가 전 축 일치했다 — 표 축은 기계 추출이라 일치가 자연스러웠을 뿐 산문 축은 여전히 어긋날 여지가 크다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① 표 축 = `requirements.md` **53 ~ 85 행** 의 REQ-034 ~ REQ-066 **33** 지점. ② 산문 축 = `deployment.md` + `directory.md` distinct **5** + `.claude/agents/reviewer.md` **2** = **7** (`§ 12.69` AC 5 (B)(C) 실측 승계 — `deploy/README.md` 227 은 외부 파일 좌표라 제외). ③ 표 축 주장 좌표는 README **61 ~ 151** 에 몰릴 것이며 범위 표기 비중이 전반 33 의 3.0% 보다 **높다** (관측된 `68-71` 1 건 이상). ④ `§ 12.70` 이 확인한 단조 증가 · 중복 0 패턴이 후반에서도 유지되는지, 그리고 전반 ↔ 후반 경계 (REQ-033 = 60 → REQ-034 = 61) 가 연속인지. ⑤ 산문 7 은 배포 · 디렉토리 · reviewer 규약 문서라 README 후반 (운영 · 룰 구간) 을 가리킬 것이고, 표 축과 **좌표값이 겹칠** 수 있다 (`§ 12.70` (v) 가 발견한 "인스턴스 분리 · 좌표값 7 건 겹침" 패턴의 재현 여부).

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `README.md` — **151 행 (실측 확인). 무편집, read-only**. **판정 기준 원본**. 본 slice 의 주장 좌표는 **61 행 이후** 에 몰릴 것이므로 `sed -n '61,151p' README.md | cat -n` **1 회 batch** 로 확보한다 (61 미만 좌표가 나오면 그 행만 개별 `sed` 로 추가 확인). 판정에 쓰인 행만 **1 구씩** 인용한다 (절 길이 보호).
- `docs/requirements.md` — **103 행. 무편집, 판정 대상**. **53 ~ 85 행** (REQ-034 ~ REQ-066) 만 대상이며 **반드시 `awk -F'|'` 필드 추출로만 읽는다** — `REQ` · `README 행` · `요약` 3 컬럼 외에는 출력하지 않는다. **`상태` 컬럼 본문 (초장문 재판정 기록) 은 어떤 방법으로도 열지 않는다** (§7 + 본 task Why 의 context 경고). **20 ~ 52 행 (전반 33) 은 열지 않는다** (`§ 12.70` 마감).
- `docs/architecture/deployment.md` — **232 행. 무편집, 판정 대상**. `grep -n 'README' docs/architecture/deployment.md` 로 pointer 만 추출해 해당 줄만 본다.
- `docs/architecture/directory.md` — **203 행. 무편집, 판정 대상**. 위와 동일하게 `grep -n` 추출분만.
- `.claude/agents/reviewer.md` — **181 행. 무편집, 판정 대상**. 위와 동일하게 `grep -n` 추출분만 (`§ 12.69` AC 5 (C) 기대 **2** 지점).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6493 행 (실측 확인)**. **`### 12.15`** (append-only 처리 방침 정본, **1002 행**) · **`### 12.70`** (직전 절 — 판정 규칙 3 분류 · 다중 표기 `pointer : 대조 좌표 : 참 : 부분참 : 거짓` · stale 계수 규칙 · AC 5 합류안 검산 근거, **6408 행**) · **`## 11. References`** 직전 좌표 (**6480 행** — `§ 12.71` 삽입 위치 경계, AC 1 (vi) 에서 재실측). **`§ 12.44` ~ `§ 12.69` 본문은 열지 않는다** (필요 수치는 `§ 12.70` 안의 인용으로 충분하다).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.1 (commit mode 표) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책) — **무편집**.

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.71` 에 **명령과 요약 수치를 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **표 축 census 재실측**: `awk -F'|' 'NR>=53 && NR<=85 && /^\| REQ-/ {print NR"\t"$2"\t"$3"\t"$4}' docs/requirements.md` (또는 동등한 필드 추출) 로 **후반 row 수 · 파일 행 구간 · 각 row 의 `README 행` · `요약` 값** 을 확보한다. 사용한 명령을 그대로 적는다. planner 기대 (**33 지점 / 파일 53 ~ 85 행**) 와 다르면 실측값을 채택하고 차이 사유를 1 구로 적는다. **`상태` 컬럼을 출력한 명령이 있었다면 그 사실도 적는다** (context 규율 자기 보고).
  - (ii) **산문 축 census 재실측**: `grep -n 'README' docs/architecture/deployment.md docs/architecture/directory.md .claude/agents/reviewer.md` 로 pointer 를 추출하고 **raw token 수 → distinct 지점 수** 를 계수한다. `§ 12.69` AC 5 실측 (**distinct 5 + 2 = 7**, `deploy/README.md` 227 은 외부 좌표라 제외) 과 다르면 실측대로 정정하고 제외 판단 근거를 1 구로 적는다. `wc -l` 로 5 개 판정 대상 파일 + 본 audit 파일 행 수를 실측한다.
  - (iii) **주장 좌표 형태 분류**: 40 지점 (표 33 + 산문 7) 을 **단일 / 범위 / 나열** 로 분류해 **축별로** 계수하고 **대조 좌표 총수** 를 산출한다. 범위는 **폭 (행 수)** 도 함께 계수한다 (`§ 12.70` (b) 명제가 "절 단위 광역 범위" 를 지목했으므로 폭이 핵심 변수다). 빈 값 · 비숫자 값이 있으면 별도 계수한다.
  - (iv) **대상 행 대조**: `sed -n '61,151p' README.md | cat -n` 1 회 batch 로 실 행을 확보하고, 각 pointer 에 대해 (표 축은 **`요약` 컬럼 어구 ↔ 실 README 행**, 산문 축은 **인용 문장 ↔ 실 README 행**) 대응 여부를 판정한다. 범위는 **시작 · 끝 두 좌표를 각각** 확인한다. 판정 규칙은 `§ 12.70` 이 승계한 **참 / 부분참 / 거짓 3 분류** 를 **그대로 승계** 하고 본 절에 1 구로 재명시한다. 61 미만 좌표가 나오면 그 행만 개별 확인한다.
  - (v) **단조성 · 중복 · 커버리지 · 축 간 겹침 검사**: (a) REQ-034 ~ REQ-066 의 번호 순서 ↔ 주장 좌표 **단조 증가 여부** 와 역전 지점 수, 그리고 **전반 ↔ 후반 경계** (REQ-033 = 60 → REQ-034) 의 연속성. (b) 2+ REQ 가 같은 좌표를 주장하는 **중복** 지점 수. (c) 표 33 pointer 가 README **61 ~ 151** 에서 커버하지 않는 행을 계수하고 **빈 줄 / heading / 비지시 서술 / 지시 문장인데 REQ 없음** 으로 분류한다 (마지막 분류가 1+ 이면 그 행 번호를 나열 — 계수까지만, 새 REQ 신설 금지). (d) 표 축 ↔ 산문 7 의 **좌표값 겹침** 건수와 두 판정의 상충 여부 (`§ 12.70` (v) 의 "인스턴스 분리 · 좌표값 겹침" 패턴 재현 여부).
  - (vi) **stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.70` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표 (README 151 · `requirements.md` 103 · `deployment.md` 232 · `directory.md` 203 · `reviewer.md` 181 · 본 파일 6493 · `## 11. References` 6480 · `§ 12.15` 1002 · `§ 12.70` 6408 · `PLAN.md` 175) 의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (`§ 12.69` · `§ 12.70` 이 **2 연속 stale 0** 이다 — 본 slice 도 검산한다).
- [ ] **AC 2 — pointer 별 판정 (참 / 부분참 / 거짓)**: AC 1 의 **전 40 지점** 을 **두 blok 판정표** 로 정리한다 — blok A (표 컬럼 33: 번호 · `REQ-NNN` · 파일 행 · 주장 좌표 · `요약` 어구 · 실 README 행 요약 · 판정 · 근거 1 구), blok B (산문 7: 번호 · 파일 · 파일 행 · 주장 좌표 · 인용 어구 · 실 README 행 요약 · 판정 · 근거 1 구). **거짓 · 부분참 판정에는 반드시 실 README 행 인용** 을 붙인다. **참 판정도 생략하지 않는다** (drift 0 도 측정 결과다). 근거 컬럼은 "n 과 동일 사유" 압축을 적극 사용해 **절 ≤ 100 행** 을 지킨다. **전반 33 · `상태` 컬럼 산문 · 이미 마감된 산문 축 재판정 금지**.
- [ ] **AC 3 — pointer 축 총결산 + 명제 최종 판정**: (a) 본 절 값을 `pointer N : 대조 좌표 N : 참 N : 부분참 N : 거짓 N` 다중 표기로 **blok A · blok B · 합계 3 줄** 보고하고, `§ 12.68` (**26 : 34 : 24 : 2 : 0**) · `§ 12.69` (**41 : 59 : 30 : 11 : 0**) · `§ 12.70` (**33 : 34 : 33 : 0 : 0**) 와 합산해 **pointer 축 140 전량의 총계** 를 산출한다 (참율 · 거짓 0 지속 여부 포함). (b) `§ 12.70` (b) 명제 — **"부분참을 낳는 것은 범위 표기 자체가 아니라 절 단위 광역 범위 (평균 폭)"** — 를 본 축의 **범위 폭 분포 ↔ 부분참율** 로 **확인 또는 반증** 한다. 특히 **같은 `requirements.md` 표 안에서 전반 (범위 3.0%) ↔ 후반** 비교가 "문서 종류" 변수를 통제한 자연 실험임을 1 구로 명시하고 결론을 2 구 이내로 확정한다. (c) 지점당 고정비 (명령 수 / 지점) 를 `§ 12.68` **0.08** · `§ 12.69` **0.17** · `§ 12.70` **0.18** 과 비교하고, 2 축 혼합 batch 의 비용 특성을 1 구로 적는다.
- [ ] **AC 4 — audit 절 신설 + 분할 판단 명시**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.71`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.70` FU (1) 합류안 승계 + 무편집 사유) → AC 1 실측 (요약형) → AC 2 두 blok 판정표 → AC 3 총결산 → 다중 표기 수치 → 진척 (**pointer 축 = 정정 census 140 중 M 판정** — 마감이면 그 사실을 명시) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행**. **분할 판단 의무** — AC 1 실측 직후 예상 절 길이를 산출해 (`§ 12.70` 검산 = 40 + 헤더 2 + 표 밖 구조 37 + 산문 census 1 ~ 2 ≈ **81 행**), **100 행 초과가 예상되면 산문 7 (blok B) 을 본 slice 에서 떼어 별도 slice 로 이월** 하고 그 판단 근거 · 실측 예상치를 절 안에 1 ~ 2 구로 박제한다 (표 33 만으로도 pointer 축 표 컬럼은 마감된다). 압축을 먼저 시도하고 (근거 컬럼 "n 과 동일 사유" · 실측 인용 요약형) 그래도 넘칠 때만 분할한다.
- [ ] **AC 5 — 다음 slice 지목**: 파생 영향 **(1)** 에 pointer 축 마감 이후의 **다음 축** 을 지목한다. 후보를 실측 규모와 함께 비교한다 — (A) **pointer 정정 batch** (`§ 12.70` 기준 후보 **13 건** + 본 절 증분; `§ 12.15` append-only 와 in-place 정정의 관계 · `ADR 각주 append 의 commit mode 판정` 미규정 구간을 함께 다뤄야 하므로 착수 전 방침 확정 필요) / (B) `deploy/README.md` ↔ `deployment.md` ↔ runbook 3 자 정합 (`§ 12.67` FU (2)) / (C) 행 번호 → **anchor 좌표계 이행** (FU14 — `§ 12.70` 이 "단일 좌표 어긋남 0" 을 반대 증거로 제시했으므로 본 절 총결산 수치로 **시급성을 재평가** 한 결론을 함께 적는다). 1 순위와 이유를 1 ~ 2 구로 적고, `§ 12.70` FU (2) ~ (10) 과 본 stream 밖 승계 항목을 우선순위 목록으로 승계한다. **본 slice 에서 착수 금지** (목록만).
- [ ] **AC 6 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **≤ 2 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`docs/requirements.md` · `README.md` · `docs/architecture/` · `.claude/agents/` · `CLAUDE.md` · `docs/decisions/` 가 변경 목록에 없음** 을 명시적으로 검산한다. doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 문법 무손상을 audit 파일의 ` ``` ` fence **짝수 개** 와 신설 두 표의 컬럼 수 일치로 확인한다.

## Out of Scope

- **`docs/requirements.md` 편집 금지** — 표는 판정 대상일 뿐이다. 어긋난 좌표를 찾아도 **in-place 정정 0** (`§ 12.15` append-only + **pointer 정정 batch** 후보로 이월). 각주 append 도 하지 않는다 (본 slice 는 audit 절 단일 파일 편집).
- **`README.md` · `docs/architecture/deployment.md` · `docs/architecture/directory.md` · `.claude/agents/reviewer.md` · `CLAUDE.md` · `docs/decisions/` 편집 금지** — 전부 무편집 판정 대상.
- **`requirements.md` `상태` 컬럼 본문 열람 · 재판정 금지** — `§ 12.68` 이 마감한 산문 축이며, 초장문 row 라 context 파괴 위험이 크다 (본 task 의 명시 제약).
- **전반 33 (REQ-001 ~ REQ-033) 재판정 금지** (`§ 12.70` 마감) · **components.md · edge · row · 정본 2 파일 · ADR 군 산문 재판정 금지** (`§ 12.60` · `§ 12.66` ~ `§ 12.69` 마감).
- **REQ 정의 자체의 타당성 검증 금지** — 본 slice 는 **좌표 ↔ README 행** 대조 축만이며, `상태` 컬럼의 DONE / IN_PROGRESS 판정이 코드와 맞는지는 별개 축이다.
- **README 누락 지시 발굴 금지** — AC 1 (v)(c) 는 **미커버 행의 계수 · 분류까지만** 이며 새 REQ 를 신설하거나 제안 목록을 만들지 않는다 (Follow-ups 로만).
- **pointer 정정 batch 착수 금지** — 후보 목록 갱신까지만 (AC 5 (A) 는 지목 · 방침 필요성 기록까지).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 시급성 재평가 기록까지만.
- **ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Result (2026-08-05)

`§ 12.71` 신설 (**85 행**, 상한 100 이내). 40 지점 실판정 = **참 39 · 부분참 1 · 거짓 0** (참율 97.5%) — blok A (표 후반 33) **33 : 35 : 33 : 0 : 0**, blok B (산문 7) **7 : 10 : 6 : 1 : 0**. **pointer 축 140 전량 마감** (**140 : 172 : 126 : 14 : 0**, 참율 90.0%, 거짓 0 이 4 batch 연속). 단조 역전 0 · 중복 0 · 전반↔후반 경계 연속 · stale 0 (3 연속) · 삽입 파급 0. 유일 부분참은 `directory.md` 197 행 `L7-22` (폭 16, 절 통째 지시) 이며 `§ 12.70` (b) 명제는 **"폭 지표가 아니라 끝 좌표의 의미 단위 경계 정렬 지표"** 로 정밀화돼 확인됐다. 판정 대상 5 파일 전부 무편집 · in-place 정정 0.

## Follow-ups

- pointer 정정 batch 후보 **14 건** (본 절 +1) — 착수 전 `§ 12.15` append-only ↔ in-place 정정 관계 및 ADR 각주 append 의 commit mode 판정 (§3.1 미규정 구간) 방침 확정 필요 (다음 slice 1 순위).
- **범위 표기 규약** 신설 후보 — 절 통째 범위 금지 · 끝 좌표를 의미 단위 경계에 정렬 · 대표 단일 좌표 병기 (FU14 anchor 이행을 대체하는 저비용 안).
- README **140 ~ 148** 9 행 (`# 로컬 빌드 / 테스트` 절의 `pnpm` 명령 안내) 은 REQ 미대응 — 오너 요구사항이 아니라 개발자 실행 절차로 판단했으나 그 경계는 정성이라 별도 확인 여지 (계수까지만, 신설 0).
