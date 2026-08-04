---
id: T-1472
title: docs/requirements.md `README 행` 표 컬럼 전반 33 지점 (REQ-001 ~ REQ-033) ↔ 실 README 행 대조 — `§ 12.69` 파생 영향 (1) 안 A 집행 + audit §12.70
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 190
estimatedFiles: 2
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1471]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1472-requirements-table-column-pointer-audit-first-33.md
plannerNote: "uc-doc-audit-resync 84 번째 slice — §12.69 FU(1) 안 A 전반 33. 잔여 73 의 45.2%, 산문 축 마감 후 첫 표 컬럼 축. doc-only 1.6x"
---

# T-1472 — `docs/requirements.md` 표 컬럼 pointer 전반 33 지점 실판정

## Why

[T-1471](T-1471-adr-group-readme-line-pointer-audit.md) 이 ADR 군 6 파일의 README 행 pointer **41** 지점을 전수 판정하며 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.69` — **41 : 59 : 30 : 11 : 0**) pointer 축의 **산문 부분을 74 중 67 = 90.5% 로 사실상 마감** 했고, 파생 영향 **(1)** 은 잔여 **73** 의 **90.4%** 를 차지하는 **`docs/requirements.md` 표 컬럼 66** 을 "pointer 축 마감의 유일한 병목" 으로 지목하며 **33 × 2 분할** 을 1 순위로 제시했다. 본 slice 는 그 **전반 33** (REQ-001 ~ REQ-033) 을 집행한다. 33 행 판정표는 `§ 12.66` (55 행) · `§ 12.67` (48 행) · `§ 12.68` (64 행) · `§ 12.69` (81 행) 이 지킨 **절 ≤ 100 행** 관행 안에 들어오며, 후반 33 은 `§ 12.69` FU (2) 의 산문 **7** (`deployment.md` · `directory.md` · `reviewer.md`) 을 합류시켜 **2 slice 로 pointer 축 전량 소진** 하는 계획이다.

본 축은 앞선 두 batch 와 **성질이 다르다**. 산문 pointer 는 "README 를 인용하는 서술" 이지만 표 컬럼은 **REQ 정의 그 자체의 좌표** 이며 — [requirements.md](../requirements.md) 7 행이 본 표를 "단일 source of truth" 로, 5 행이 "README 의 모든 지시사항을 추적 가능한 REQ-NNN ID 로 박제" 로 규정한다 — 좌표가 틀리면 REQ 의 정의 근거 자체가 흔들린다. 따라서 본 slice 의 판정은 다른 축보다 **결과 무게가 크며**, `§ 12.69` 가 확인한 "단일 좌표 어긋남 0 / 어긋남은 전부 범위 표기" 패턴이 **표 컬럼에서도 유지되는지** 가 본 slice 의 핵심 검증점이다.

**어떤 파일도 편집하지 않는다** — `requirements.md` · `README.md` 는 판정 대상일 뿐이고 결과는 audit 절 `§ 12.70` 에만 박제한다 (`§ 12.15` append-only + `§ 12.68` · `§ 12.69` 가 정본 파일 · ADR 을 무편집 판정 대상으로만 다룬 선례 승계).

planner 사전 census — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **33** 회 있고, 직전 `§ 12.69` 도 census 축 ①② 를 반증했다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① 판정 대상 = `requirements.md` **20 ~ 52 행** 의 REQ-001 ~ REQ-033 row **33** 지점 (표 전체는 20 ~ 85 행 **66** row). ② 주장 좌표 기대 — 단일 **32** + 범위 **1** (REQ-023 = `45-46`) → **대조 좌표 34**. ③ `§ 12.69` 패턴 (단일 어긋남 0) 이 유지되면 **부분참 ≤ 1 · 거짓 0** 이 기대값이나, 표 컬럼은 T-0013 이 일괄 생성한 이래 README 갱신을 따라갔는지 검증된 적이 없어 **집단 stale (전 좌표가 일정 offset 만큼 밀림)** 가능성이 산문 축보다 크다 — offset 패턴 유무를 반드시 검사한다. ④ 좌표 단조성 — REQ 번호 순서와 README 행 순서가 단조 증가하는지 확인하고 역전 지점이 있으면 그 자체가 drift 신호다. ⑤ 중복 좌표 — 2+ REQ 가 같은 README 행을 주장하는 지점을 계수한다 (기대 0, 앞선 축에서 파일 간 공유 좌표 10 이 나온 것과는 다른 성질). ⑥ README 커버리지 — 33 pointer 가 README **1 ~ 60** 구간에서 어느 행을 비우는지 (누락 후보) 를 계수한다. ⑦ `§ 12.68` 이 판정한 `requirements.md` **산문** pointer (26 중 일부) 와 본 표 컬럼은 **집합이 분리** 돼 있어 재판정 중복이 없어야 한다 — 실측으로 확인한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `README.md` — **151 행. 무편집, read-only**. **판정 기준 원본**. 판정에 쓰인 행만 **1 구씩** 인용한다 (audit 절 길이 보호). 본 slice 의 주장 좌표는 **1 ~ 60** 구간에 몰려 있으므로 `sed -n '1,60p'` 1 회 batch 로 충분하다.
- `docs/requirements.md` — **103 행. 무편집, 판정 대상**. **20 ~ 52 행** (REQ-001 ~ REQ-033 row) 의 `REQ` · `README 행` · `요약` 3 컬럼만 본다. **`상태` 컬럼 본문 (REQ-001 등 초장문 재판정 기록) 은 열지 않는다** — 그 안의 README 인용은 `§ 12.68` 이 판정한 **산문 축** 이며 본 slice 대상 밖이다 (§7 context 절약). **53 ~ 85 행 (후반 33) 은 열지 않는다**.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6421 행**. **`### 12.15`** (append-only 처리 방침 정본, **1002 행**) · **`### 12.69`** (직전 절 — 판정 규칙 3 분류 · 포함 관계 독립 규칙 · 다중 표기 `pointer : 대조 좌표 : 참 : 부분참 : 거짓` · stale 계수 규칙 · AC 5 안 A 지목 근거, **6327 행**) · **`## 11. References`** 직전 좌표 (**6408 행** — `§ 12.70` 삽입 위치 경계, AC 1 (v) 에서 재실측). **`§ 12.44` ~ `§ 12.68` 본문은 열지 않는다**.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.1 (commit mode 표) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책) — **무편집**.

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.70` 에 **명령과 요약 수치를 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑦ 은 가설일 뿐이다).
  - (i) **대상 census 재실측**: `grep -nE '^\| REQ-' docs/requirements.md` 로 REQ row 총수 · 좌표 범위를 재확인하고, **전반 33 (REQ-001 ~ REQ-033) 의 파일 행 구간** 과 각 row 의 `README 행` 컬럼 값을 **기계적으로 추출** 한다 (`awk` / `sed` 등 — 사용한 명령을 그대로 적는다). planner 기대 (**33 지점 / 파일 20 ~ 52 행 / 표 전체 66 row**) 와 다르면 실측값을 채택하고 차이 사유를 1 구로 적는다. `wc -l` 로 `README.md` · `docs/requirements.md` · 본 audit 파일 행 수를 실측한다.
  - (ii) **주장 좌표 형태 분류**: 33 지점을 **단일 / 범위 / 나열** 로 분류해 계수하고 **대조 좌표 총수** 를 산출한다 (planner 기대 단일 32 + 범위 1 → **34**). 컬럼 값이 비었거나 숫자가 아닌 row 가 있으면 별도 계수한다.
  - (iii) **대상 행 대조**: `sed -n '1,60p' README.md` (또는 `cat -n`) 1 회 batch 로 실 행을 확보하고, 각 pointer 에 대해 **`요약` 컬럼 어구와 실 README 행 내용이 대응하는지** 판정한다. 범위는 **시작 · 끝 두 좌표를 각각** 확인한다. 판정 규칙은 `§ 12.69` 의 **참 / 부분참 / 거짓 3 분류** 를 **그대로 승계** 하고 본 절에 1 구로 재명시한다.
  - (iv) **집단 stale · 단조성 · 중복 · 커버리지 검사** (축 ③ ~ ⑥): (a) 어긋남이 있다면 **일정 offset 으로 밀린 집단 패턴인지** 개별 오류인지 판별한다 (offset 분포를 계수). (b) REQ 번호 순서 ↔ 주장 좌표의 **단조 증가 여부** 를 검사하고 역전 지점을 계수한다. (c) **2+ REQ 가 같은 README 좌표를 주장** 하는 중복 지점을 계수한다. (d) 33 pointer 가 README **1 ~ 60** 구간에서 **커버하지 않는 행** 을 계수한다 (지시 문장인데 REQ 가 없는 행 = 누락 후보인지, 빈 줄 · heading 이라 대상이 아닌지 구분).
  - (v) **stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.69` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표 (README 151 · `requirements.md` 103 · 본 파일 6421 · `## 11. References` 6408 · `§ 12.15` 1002 · `§ 12.69` 6327 · `PLAN.md` 175) 의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (`§ 12.69` 는 stale 0 으로 복귀했다 — 본 slice 도 검산한다).
- [ ] **AC 2 — pointer 별 판정 (참 / 부분참 / 거짓)**: AC 1 (i) 의 **전 33 지점** 을 판정표 (번호 · `REQ-NNN` · 파일 행 · 주장 좌표 · `요약` 컬럼 어구 · 실 README 행 요약 · 판정 · 근거 1 구) 로 정리한다. **거짓 · 부분참 판정에는 반드시 실 README 행 인용** 을 붙인다. **참 판정도 생략하지 않는다** (drift 0 도 측정 결과다). 표가 길어지면 근거 컬럼을 "n 과 동일 사유" 로 압축해 **절 ≤ 100 행** 을 지킨다. **후반 33 (REQ-034 ~ REQ-066) · `상태` 컬럼 산문 · 이미 마감된 산문 축은 판정 금지 — 이월**.
- [ ] **AC 3 — 산문 축과의 비교 (표 ↔ 산문)**: `§ 12.68` (정본 2 파일 산문 = **26 : 34 : 24 : 2 : 0**) · `§ 12.69` (ADR 군 = **41 : 59 : 30 : 11 : 0**) 와 본 절 값을 같은 다중 표기로 비교해 (a) **표 컬럼이 산문보다 정확한가** 를 참율 수치로 결론 내고, (b) `§ 12.69` AC 3 (b) 가 도출한 **"정확도의 설명 변수는 문서 종류가 아니라 표기 형식 (단일 vs 범위)"** 명제를 본 축 (범위 비중 기대 1/33 = 3.0%) 이 **확인 또는 반증** 하는지 1 ~ 2 구로 판정한다, (c) 지점당 고정비 (명령 수 · 인용 구 수) 를 `§ 12.68` **0.08** · `§ 12.69` **0.17 회 / 지점** 과 비교한다.
- [ ] **AC 4 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.70`** 을 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.69` FU (1) 안 A 전반 33 승계 + 무편집 사유) → AC 1 실측 (요약형) → AC 2 판정표 → AC 3 비교 → 다중 표기 수치 → 진척 (**pointer 축 = 정정 census 140 중 M 판정 / 표 컬럼 66 중 33**) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행** — 초과 조짐이 보이면 실측 인용을 요약형 (명령 + 수치만, 출력 전문 생략) 으로 압축한다 (`§ 12.66` ~ `§ 12.69` 성공 방식 승계).
- [ ] **AC 5 — 다음 slice 지목**: 파생 영향 **(1)** 에 pointer 축 **최종 batch** 를 지목한다 — `§ 12.69` FU (1) 이 예고한 **후반 33 (REQ-034 ~ REQ-066) + 산문 잔여 7 (`deployment.md` · `directory.md` · `reviewer.md`) 합류안** 이 본 slice 실측 후에도 유효한지 (합계 40 지점이 절 ≤ 100 행 안에 들어오는지) 를 본 절의 **행당 실측 비용** 으로 검산해 1 순위와 이유를 1 ~ 2 구로 적는다. 합류가 과대하면 분할안을 제시한다. `§ 12.69` FU (2) ~ (10) 과 본 stream 밖 승계 항목 (**pointer 정정 batch 후보 13 건** · **ADR 각주 append 의 commit mode 판정**) 을 우선순위 목록으로 승계한다. **본 slice 에서 착수 금지** (목록만).
- [ ] **AC 6 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **≤ 2 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`docs/requirements.md` · `README.md` · `CLAUDE.md` · `docs/decisions/` 가 변경 목록에 없음** 을 명시적으로 검산한다. doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 문법 무손상을 audit 파일의 ` ``` ` fence **짝수 개** 와 신설 표의 컬럼 수 일치로 확인한다.

## Out of Scope

- **`docs/requirements.md` 편집 금지** — 표는 판정 대상일 뿐이다. 어긋난 좌표를 찾아도 **in-place 정정 0** (`§ 12.15` append-only + **pointer 정정 batch** 후보로 이월). 각주 append 도 하지 않는다 (본 slice 는 audit 절 단일 파일 편집).
- **`README.md` 편집 금지** (요구사항 정본) · **`CLAUDE.md` · `docs/decisions/` 편집 금지**.
- **후반 33 (REQ-034 ~ REQ-066) 판정 금지** — 계수 인용까지만. 다음 batch 소관.
- **`상태` 컬럼 산문 재판정 금지** — `§ 12.68` 이 마감한 산문 축이며 본 slice 는 `README 행` 컬럼만 본다.
- **REQ 정의 자체의 타당성 검증 금지** — 본 slice 는 **좌표 ↔ README 행** 대조 축만이며, 요약 문구가 REQ 로 적절한지 · kind 분류가 맞는지는 별개 축이다.
- **README 누락 지시 발굴 금지** — AC 1 (iv)(d) 는 **커버되지 않은 행의 계수까지만** 이며 새 REQ 를 신설하거나 제안 목록을 만들지 않는다 (별도 축 · Follow-ups 로만).
- **components.md · edge · row · 산문 축 재판정 금지** (`§ 12.60` · `§ 12.66` ~ `§ 12.69` 마감).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 근거 보강 기록까지만.
- **ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append 한다.)
