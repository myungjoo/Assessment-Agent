---
id: T-1471
title: ADR 군 6 파일 (ADR-0001 · 0002 · 0003 · 0004 · 0005 · 0042) 의 README 행 번호 pointer 27 지점 ↔ 실 README 행 대조 — `§ 12.68` 파생 영향 (1) 안 B 집행 + audit §12.69
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1470]
touchesFiles:
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1471-adr-group-readme-line-pointer-audit.md
plannerNote: "uc-doc-audit-resync 83 번째 slice — §12.68 FU(1) 안 B 집행. ADR 군 27 pointer = 잔여 산문 34 의 79.4%. doc-only 1.6x"
---

# T-1471 — ADR 군 6 파일의 README 행 번호 pointer 27 지점 실판정

## Why

[T-1470](T-1470-readme-line-pointer-drift-sweep-canonical-docs.md) 이 README 행 번호 pointer 축의 **전수 census (distinct 126 지점 / 11 파일)** 를 확정하고 정본 2 파일 (`CLAUDE.md` · `docs/requirements.md`) 산문 pointer **26/26** 을 판정했다 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.68` — 참 24 · 부분참 2 · 거짓 0). 그 파생 영향 **(1)** 은 잔여 pointer 를 묶는 3 안 (파일 밀도 순 · 문서 종류별 · README 좌표 구간별) 을 실측 비교한 끝에 **안 B 의 ADR 군 일괄** 을 다음 slice 1 순위로 지목했다 — 근거 둘: **첫째** 한 batch 로 잔여 산문 **34** 중 **27 (79.4%)** 을 덮으면서 판정표는 **27 행** 이라 `§ 12.66` (55 행) · `§ 12.67` (48 행) · `§ 12.68` (64 행) 이 지킨 **절 ≤ 100 행** 관행 안에 들어오고, **둘째** ADR 군은 인용 형식이 `[README.md](…) NN 행` 계열로 비교적 균질해 대조 고정비가 최저이며 `§ 12.68` 이 이미 `ADR-0003` 의 `19~22` 를 (다른 문서의 인용 경유로) **부분참** 판정해 적중 근거가 실측으로 있다. planner 는 이 지목을 그대로 채택한다.

**본 slice 는 ADR 파일을 편집하지 않는다** — 지금까지의 slice 는 판정 대상 원문 파일 말미에 각주 blockquote 를 append 해 추적성을 남겼으나 ([CLAUDE.md](../../CLAUDE.md) §3.1 표는 `docs/decisions/*` **추가** 를 `pr` 로, ADR **status 한 줄 갱신** 을 `direct` 로만 규정하고 **기존 ADR 본문 append 의 mode 를 규정하지 않는다**), 본 doc stream 은 `direct` 연속성을 지키기 위해 ADR 을 **판정 대상으로만** 삼고 판정 결과는 audit 절 `§ 12.69` 에만 박제한다. 각주 반영이 필요하다면 mode 판정을 선행한 별도 task 소관이며 본 slice 는 Follow-ups 에 후보로만 남긴다. 이는 T-1470 이 `CLAUDE.md` 를 무편집 판정 대상으로만 다룬 선례와 같은 처리다.

planner 사전 census — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증 · 정정된 선례가 **32** 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 판정을 실측대로 뒤집는다**. ① 파일별 raw token 기대 — `ADR-0002` **10** · `ADR-0001` **6** · `ADR-0003` **5** · `ADR-0042` **4** · `ADR-0004` **1** · `ADR-0005` **1** = **27**. ② 범위 표기 기대 **8** (`ADR-0002` 의 `55–64` · `88–92`, `ADR-0003` 의 `7–17` · `33–41` · `19~22` · `71–74` · `88–92`, `ADR-0005` 의 `110–128`) → **대조 좌표 기대 19 × 1 + 8 × 2 = 35**. ③ `§ 12.68` 이 **어긋남 2 건이 모두 범위 끝 좌표** 에서 나왔다고 실측했으므로 범위 비중이 높은 ADR 군 (**8/27 = 29.6%**) 은 **부분참 산출률이 정본 2 파일 (7/26 = 26.9%) 보다 높거나 비슷** 할 것으로 본다 — 실측으로 확인 또는 반증한다. ④ `ADR-0003` 의 `19~22` 는 `§ 12.68` 판정표 **#24** 가 `requirements.md:39` 경유로 **부분참** (19 · 22 가 빈 줄) 판정한 좌표와 **같다** — 다만 ADR-0003 은 자기 주장으로 인용하므로 **의미가 다르며 재판정 대상** 이다 (`§ 12.68` (iv) 교차 검증이 "동시 참 불가 0" 으로 남긴 지점). ⑤ `ADR-0002` 의 `55–64` · `88–92` 범위와 그 안의 단일 좌표 7 개 (56 · 58 · 59 · 60 · 63 · 91 · 92) 는 **포함 관계** 라, 범위 pointer 가 참이면 단일 pointer 의 참 여부가 독립인지 (범위 안이라는 사실만으로 참이 되지 않는다) 를 판정 규칙으로 명시해야 한다. ⑥ `ADR-0004` 는 `§ 12.62` 계열이 지적한 **번호 충돌 pointer** 이력이 있으므로 README 좌표 pointer 와 ADR 번호 pointer 를 혼동하지 않는다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `README.md` — **151 행. 무편집, read-only**. **판정 기준 원본**. 인용은 **판정에 쓰인 행만 1 구씩** (audit 절 길이 보호).
- `docs/decisions/ADR-0001-stack.md` (**146 행**) · `ADR-0002-db.md` (**127 행**) · `ADR-0003-deployment.md` (**173 행**) · `ADR-0004-smoke-e2e-db-mode.md` (**139 행**) · `ADR-0005-mcp-tools-for-pr-review-flow.md` (**181 행**) · `ADR-0042-nestjs-schedule-adoption.md` (**101 행**) — **전부 무편집, 판정 대상**. pointer 를 가진 행만 **각 1 구 인용까지만** 열고 (AC 1 (i) census 로 좌표 재실측) 그 밖 구간은 열지 않는다 (§7 context 절약).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **6340 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.68`** (pointer 축 census 원본 + 판정 방법론 + AC 6 안 B 지목 근거 + 다중 표기 형식 `pointer : 대조 좌표 : 참 : 부분참 : 거짓` + stale 계수 규칙) · **`## 11. References`** 직전 좌표 (**6327 행** — `§ 12.69` 삽입 위치 경계, AC 1 (vi) 에서 재실측). **`§ 12.44` ~ `§ 12.67` 본문은 열지 않는다**.
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.1 (commit mode 표) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §9 (secret 금지) · §12 (언어 정책) — **무편집**.

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.69` 에 **명령과 요약 수치를 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑥ 은 가설일 뿐이다).
  - (i) **ADR 군 census 재실측**: `grep -rnoE` 로 `docs/decisions/` 의 README 행 번호 pointer 를 수집해 **총 token 수 · 파일 수 · 파일별 계수** 를 보고한다. `§ 12.68` 이 확정한 **정규식 포착률 26.1%** 한계를 감안해 **수동 보정** (연속 · 나열 토큰 · README 앵커 없는 형태) 을 함께 수행하고, 보정 전후 수치를 **둘 다** 적는다. planner 기대 (**27 token / 6 파일**) 와 다르면 실측값을 채택하고 차이 사유를 1 구로 적는다. `wc -l` 로 6 ADR + README + 본 audit 파일 행 수를 실측한다.
  - (ii) **판정 대상 확정**: (i) 의 pointer 를 **번호 붙인 목록** 으로 만든다. 각 항목은 `파일:행 → 주장하는 README 좌표 → 인용 어구 요약` 3 요소이며, `§ 12.68` (ii) 처럼 **AC 2 판정표의 `#` 컬럼으로 실체화** 해 중복 나열을 피한다 (절 ≤ 100 행 보호).
  - (iii) **대상 행 대조**: 각 pointer 에 대해 `sed -n '<N>p' README.md` 로 실 행을 뽑아 **주장 어구와 실 행 내용이 대응하는지** 판정한다. 범위 표기는 **시작 · 끝 두 좌표를 각각** 확인하고, 끝 좌표가 빈 줄 · fence · 다음 절 heading 이면 그 사실을 명시한다. **대조 좌표 총수** 를 보고한다 (기대 **35**).
  - (iv) **포함 관계 규칙 명시** (축 ⑤): `ADR-0002` 처럼 **범위 pointer 와 그 범위 안의 단일 pointer 가 공존** 하는 경우, 단일 pointer 의 판정이 범위 참 여부와 **독립** 임을 규칙으로 적고 그대로 적용한다 (범위 안이라는 사실만으로 단일 pointer 를 참으로 간주하지 않는다). 해당 지점 수를 계수한다.
  - (v) **교차 검증 승계**: `§ 12.68` (iv) 가 남긴 **`19~22` 좌표의 이중 의미** (ADR-0003 자기 주장 ↔ `requirements.md:39` 의 옛 번호 잔재 인용) 를 **ADR-0003 측 의미로 재판정** 하고, 두 판정이 상충하는지 (동시 참 가능한지) 를 1 구로 결론 낸다. 그 밖 2+ 파일 공유 좌표 (`88–92` 등) 도 계수한다.
  - (vi) **좌표 stale · 삽입 파급 계수**: `§ 12.55` ~ `§ 12.68` 의 계수 규칙 (자기 좌표만 · 범위 · 나열 토큰은 1 지점 · 외부 파일 좌표 제외) 을 **그대로 승계** 해 본 slice 가 인용 · 의존한 좌표의 stale 지점 수와 삽입 파급 지점 수를 각각 보고한다 (`§ 12.68` 에서 **stale 2** 로 10 회 연속 0 기록이 끊겼다 — 본 slice 의 Required Reading 좌표가 실측과 맞는지 특히 검산한다).
- [ ] **AC 2 — pointer 별 판정 (참 / 부분참 / 거짓)**: AC 1 (ii) 의 **전 pointer** 를 판정표 (번호 · 출처 `파일:행` · 주장 좌표 · 실 README 행 요약 · 판정 · 근거 1 구) 로 정리한다. **거짓 · 부분참 판정에는 반드시 실 README 행 인용** 을 붙인다. **참 판정도 생략하지 않는다** (drift 0 도 측정 결과다). ADR 군 밖 pointer (정본 2 파일 · `deployment.md` · `directory.md` · `reviewer.md` · `requirements.md` 표 컬럼) 는 **재판정 금지 — 이월**.
- [ ] **AC 3 — 정본 2 파일 축과의 비교**: `§ 12.68` 이 정의한 다중 표기 **`pointer N : 대조 좌표 N : 참 N : 부분참 N : 거짓 N`** 을 본 절 값으로 산출하고 (`§ 12.68` = **26 : 34 : 24 : 2 : 0**), (a) **범위 표기 비중** (ADR 군 기대 8/27 vs 정본 2 파일 7/26) 과 **부분참 산출률** 의 상관을 수치로 비교해 축 ③ 가설을 확인 또는 반증한다. (b) **문서 종류별 pointer 정확도 차이** (ADR = 결정 시점 고정 문서 vs 운영 정본 = 지속 갱신 문서) 가 실측으로 드러나는지 1 ~ 2 구로 결론 낸다. (c) 지점당 고정비 (명령 수 · 인용 구 수) 를 `§ 12.68` 의 **0.08 회 / 지점** 과 비교한다.
- [ ] **AC 4 — audit 절 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 **`### 12.69`** 를 `## 11. References` **직전** 에 신설한다. 구성: 위치 · 계보 (`§ 12.68` FU (1) 안 B 승계 + ADR 무편집 사유) → AC 1 실측 (요약형) → AC 2 판정표 → AC 3 비교 → 다중 표기 수치 → 진척 (**pointer 축 = 산문 60 중 M 판정 / 전체 126 중 N**) → 한계 → 파생 영향 (목록만). **절 ≤ 100 행** — 초과 조짐이 보이면 실측 인용을 요약형 (명령 + 수치만, 출력 전문 생략) 으로 압축한다 (`§ 12.66` 55 행 · `§ 12.67` 48 행 · `§ 12.68` 64 행 성공 방식 승계).
- [ ] **AC 5 — 다음 slice 지목**: 파생 영향 **(1)** 에 pointer 축 잔여의 다음 batch 를 근거와 함께 지목한다. `§ 12.68` AC 6 이 남긴 후보 (**표 컬럼 66 지점 33 × 2 분할** · `deployment.md` + `directory.md` 산문 **7** · `reviewer.md` **2**) 를 실측 계수로 비교해 1 순위와 이유를 1 ~ 2 구로 적고, `§ 12.68` FU (2) ~ (10) 을 우선순위 목록으로 승계한다. **본 slice 에서 착수 금지** (목록만).
- [ ] **AC 6 — 검증 명령**: `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 로 증분을 보고하고 `git diff --stat` 이 **≤ 2 파일 · ≤ 300 LOC** 임을 확인한다. `git status --short` 로 **`docs/decisions/` · `README.md` · `CLAUDE.md` · `docs/requirements.md` 가 변경 목록에 없음** 을 명시적으로 검산한다. doc-only 변경이므로 `pnpm test` 는 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제) — 단 markdown 문법 무손상을 audit 파일의 ` ``` ` fence **짝수 개** 로 확인한다.

## Out of Scope

- **ADR 파일 편집 금지** — 6 ADR 전부 판정 대상일 뿐이다. 각주 append 는 §3.1 상 mode 판정 (pr 여부) 이 선행돼야 하므로 별도 task 소관 (Follow-ups 로만 이월).
- **pointer in-place 정정 금지** — 거짓 · 부분참을 확정하더라도 숫자를 고치지 않는다 (`§ 12.15` append-only + **pointer 정정 batch** 후보로 이월).
- **`README.md` 편집 금지** (요구사항 정본) · **`CLAUDE.md` · `docs/requirements.md` 편집 금지** (`§ 12.68` 이 마감한 축).
- **ADR 군 밖 pointer 판정 금지** — `deployment.md` · `directory.md` · `reviewer.md` · `requirements.md` 표 컬럼 **66** 은 다음 batch 소관 (계수 인용까지만).
- **ADR 내용 자체의 사실 검증 금지** — 본 slice 는 **pointer ↔ README 행** 대조 축만이며 ADR 의 결정 · 근거가 코드와 맞는지는 별개 축이다.
- **components.md · edge · row · 산문 축 재판정 금지** (`§ 12.60` · `§ 12.66` · `§ 12.67` 마감).
- **anchor 좌표계 이행 (FU14) 착수 금지** — 근거 보강 기록까지만.
- **ADR 신설 · 새 dependency 도입 금지** ([CLAUDE.md](../../CLAUDE.md) §5 게이트).
- **secret · token · API key 실값 인용 금지** (§9).
- `docs/STATE.json` · journal write 금지 (driver 소관).

## Suggested Sub-agents

`implementer` 단독 (doc-only). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
