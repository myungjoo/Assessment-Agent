---
id: T-1494
title: 범위 표기 규약 축 S3 batch 14 — 비-ADR `L` 축 첫 slice (`p3-implementation-plan.md` 단독) 개정판 R5 · R1 · R4 정규화 + 개정판 R5 첫 적용 · 파일 성격 판정 · en dash 마감 사정 범위 판정 (audit §12.92)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1493]
touchesFiles:
  - docs/architecture/p3-implementation-plan.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1494-range-notation-s3-nonadr-batch14-p3plan.md
plannerNote: "uc-doc-audit-resync 106 번째 slice — §12.91 파생 (1) 1 순위 비-ADR L 축 첫 batch, 단일 파일 29 행 / 40 좌표, direct 3 파일"
---

# T-1494 — 범위 표기 규약 축 S3 batch 14 — 비-ADR `L` 축 첫 slice (`p3-implementation-plan.md` 단독)

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.91` (조문 정비 · `§ 12.76 R5` 개정) 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **비-ADR `L` 축 14 파일 batch 편성** 의 첫 실집행 slice 다. 같은 절 ③ 이 "조문 개정을 비-ADR 정규화보다 **선행**" 으로 확정했고 그 개정이 T-1493 으로 머지됐으므로, 본 slice 부터 비-ADR 14 파일은 **단일 규범** (`L` 미사용) 아래 놓인다. 대상은 그 14 파일 중 hit 수 최대인 **`docs/architecture/p3-implementation-plan.md` 단독** (planner 실측 **29 행 / 40 좌표** · raw `~` **0** · en dash 행 **5** · ASCII hyphen 범위 행 **3**) 이며, `§ 12.91` AC 2 가 "존치 조건이 실제로 지키고 있던 **2 파일 / 41 좌표**" 중 **40 좌표** 가 이 파일이라고 실측한 바로 그 대상이다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **개정판 `R5` 의 첫 적용 사례**: 이 파일은 구판 `R5` 존치 예시 3 파일 중 하나였고 `~` 가 **0** 이라 구판 아래에서는 존치가 형식상 성립했다. `§ 12.91` AC 3 ① 의 존치 조건 삭제로 정정이 **재량이 아니라 규범** 이 되는 첫 사례이며, 같은 절 AC 4 가 못박은 병기 인용 규약 **`§ 12.76 R5 (§ 12.91 개정)`** 의 첫 실사용이기도 하다. 아울러 `§ 12.91` AC 3 ① 이 삭제의 손실 (국소 일관성) 을 흡수한다고 본 **파일 단위 전량 동시 정정 의무** (`§ 12.86` AC 3 ③ 의 파일 단위 승계) 가 실제로 성립하는지를 처음 검산한다. (나) **파일 성격 판정**: 대상은 경로상 `docs/architecture/*.md` 라 `§ 12.76` AC 3 ② 의 5 문서군에 속하지만, 내용은 P3 phase 의 task 시퀀스 · 진척 · cap 검산을 담은 **planning artifact** 라 성격상 `docs/tasks/*` · `docs/progress/*` (범위 밖) 에 가깝다. 적용 범위가 **경로 기준인지 성격 기준인지** 를 처음 판정한다 (`§ 12.91` 파생 (2) 의 부분 선집행). (다) **en dash 축 마감 선언의 사정 범위**: `§ 12.83` AC 6 의 마감은 ADR census 기준이었는데 본 파일에는 en dash 좌표 행이 **5** 남아 있다. 마감이 **표기 종류의 마감** 인지 **ADR 대상 한정** 인지에 따라 본 batch 의 `R1` 적용 여부가 갈린다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/architecture/*` 본문의 **비-결정 수정** = `direct`) 의 **열네 번째** 적용 선례이며 (`§ 12.91` ② 가 rule 5 선례를 **13 건** 으로 집계했고 본 slice 가 그 다음), 편집 대상은 `L` prefix 제거 + 구분자 정규화 + 단위어 부착에 한정되고 문서의 판단 실질 (task 매핑 · 진척 서술 · 수치) 은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 · 특히 `R1` · `R4` · `R6` · `R7` · AC 3 ② 적용 범위 5 문서군 · AC 3 ③ 한정 소급) · `§ 12.82` AC 3 (규약 범위 밖 문서를 가리키는 좌표) · `§ 12.83` AC 6 (en dash 축 마감 선언) · `§ 12.85` 한계 4 (부착 3 규칙) · `§ 12.86` AC 3 ③ (반복 label 전량 동시 정정) · `§ 12.87` AC 3 ① (label 전체 좌표 · 파일명 결합 label) · `§ 12.91` 전문 (7625 행~ · 특히 AC 2 census · AC 3 ①② · AC 4 인용 규약 · 개정판 `R5` 문언 · 한계 1 · 파생 (1)(2)). 신설 절은 파일 **끝** (`## 11. References` 직전) 에 append.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — planner 실측 후보 **29 행 / 40 좌표**, raw `~` **0**, en dash 행 **5** (3 · 11 · 54 · 234 · 238 행 — 54 행은 `L` 미동반이라 좌표 여부 판별 필요), ASCII hyphen 범위 행 **3** (52 · 194 · 209 행 의 `L63-65`), 총 **272 행** · 링크 `](` **66** · `## ` heading **8**. 표기 형태는 표 셀 안 괄호 좌표 (`(L51)`) · 링크 label 결합 (`[PLAN.md L63](../PLAN.md)`) · 산문 내 bare 좌표 (`L47–60`) 3 종.
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절 (T-1493 갱신분 포함).

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.92` 안에 ① 선정 근거 (`§ 12.91` 파생 (1) 1 순위 · 비-ADR 14 파일 중 hit 최대 파일을 먼저 여는 이유 = `§ 12.84` AC 3 ① 의 "대형 파일 선행" 논거 승계 · **단독 편성** 이유 = 40 좌표 단일 파일로 이미 본 축 두 번째 규모라 2 파일째를 얹으면 아래 ④ cap 가드 임계에 근접하고 새 판정 3 종의 문단이 절 ≤ 60 행 과 충돌), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인 · `§ 12.91` 한계 1 이 명시한 "개정은 소급 정정을 발생시키지 않는다" 와 본 batch 가 **별도 편성** 이라는 관계를 1 문장), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열네 번째 선례** · `§ 12.91` ② 가 집계한 **13 건** 뒤임을 명시 · 본 slice 는 `§ 12.91` 과 달리 대상 문서 본문을 **실제로 편집** 하므로 rule 5 선례 계열로 복귀함을 1 구), ④ **cap 판정** (확정 정정 좌표 수를 `§ 12.83` AC 3 ④ 임계 **70** 과 대조해 이월 여부 확정 · 파일 수 **3** 으로 5 파일 cap 미소진 · `§ 12.91` 파생 (4) "batch 상한을 좌표 수로 재설계" 논거와의 관계 1 문장) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (집계 1 구).** `grep -cE 'L[0-9]+'` (행) · `grep -oE 'L[0-9]+' | wc -l` (좌표) · `grep -cE '[0-9] *~ *[0-9]'` · `grep -cE '[0-9] *– *[0-9]'` (en dash) · `grep -cE '[0-9]-[0-9]'` (ASCII hyphen) 을 대상 파일에 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**29 행 / 40 좌표** · `~` **0** · en dash **5** · hyphen **3**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). 행 대비 좌표 격차 **11** 을 `§ 12.84` 의 격차 **12** · `§ 12.88` 의 **7** 과 1 문장으로 대조하고, 본 파일이 비-ADR 14 파일 전체 좌표에서 차지하는 비중 (`grep -oE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 분모 실측) 을 1 구로 기록해 축 잔량 감각을 남긴다.
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **개정판 `R5` 첫 적용** — 본 파일이 구판 존치 예시 3 파일 중 하나이고 `~` **0** 이라 구판 아래에서는 존치가 성립했음을 먼저 확인한 뒤, `§ 12.91` AC 3 ① 의 조건 삭제로 정정이 **재량이 아니라 규범** 이 되는 경로를 1 문단으로 박제하고 (`§ 12.87` · `§ 12.89` · `§ 12.90` 의 재량 3 회와 대비 1 문장), 본 절이 `R5` 를 인용할 때 **`§ 12.76 R5 (§ 12.91 개정)`** 병기 형태를 실제로 사용했음을 1 구로 자기 검산한다. 아울러 `§ 12.91` AC 3 ① 이 손실 흡수 근거로 든 **파일 단위 전량 동시 정정** 이 성립하는지 (정정 후 파일 안 좌표 표기가 `N 행` 단일 형태로 수렴하는지) 를 AC 5 실측과 연결해 1 문장으로 확인. ② **파일 성격 판정** — 경로 기준 (`docs/architecture/*.md` → 5 문서군 안) 과 성격 기준 (planning artifact → `docs/tasks/*` · `docs/progress/*` 계열) 이 갈리는 구조를 적시하고, `§ 12.76` AC 3 ② 문언이 **경로 열거** 로 되어 있다는 사실을 1 차 근거로 삼아 결론을 1 문단으로 확정한다 (경로 기준 채택 시 그 함의 = 같은 디렉토리의 `p3-to-p4-transition.md` · `p4-implementation-plan.md` 도 동일 취급이라 후속 batch 편성이 단순해짐을 1 구). 성격 기준을 채택하지 않는 경우 그 손실 (문서 성격에 따른 규범 차등 불가) 도 1 문장 평가. ③ **en dash 축 마감 사정 범위** — `§ 12.83` AC 6 의 마감 선언이 **ADR census 대상 한정** 인지 **표기 종류 전역** 인지를 그 절 문언으로 판정하고, 본 파일 en dash 행 (3 · 11 · 234 · 238) 을 `R1` 정정 대상에 포함할지 결론을 1 문단으로 박제한다. 54 행의 en dash 는 `L` 미동반이라 **좌표인지 수량 · 그 밖 용법인지** 를 `§ 12.83` AC 3 (`ADR-0001` 수량 범위 판정) 승계로 판별해 편집 여부를 명시.
- [ ] **AC 4 — 대조표.** 후보 행 전량을 `# / 행 / 원 표기 / 판정 / 근거 조문 / 승계 선례` **6 컬럼** 표로 박제하되, 행이 **29** 를 넘어 절 ≤ 60 행 제약과 충돌하면 **표기 형태별 묶음 행** (표 셀 괄호 좌표 · 링크 label 결합 · 산문 bare 좌표 · en dash 범위 · ASCII hyphen 범위) 으로 압축하고 묶음마다 대표 행 번호 + 건수를 적는 방식을 택한다 (압축을 택한 경우 그 이유를 표 앞 1 구로 명시). `R6` · `R7` 면제 판별 건수와 `L` 제거로 인한 **조사 · 단위어 보정 건수**, 이미 `~` 를 쓰는 좌표 수 (**0** 예상) 와 단일 행 좌표 (`R4` 병용) 수를 구분해 적는다.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 대상 파일의 **추가 행 수 = 삭제 행 수** 임을 보이고 (예상 **30/30** 안팎 — 실측값 기록), hunk 가 §2 표 · §3 graph · §4 이후 진척 서술 구간 어디에 떨어지든 `§ 12.83` AC 5 · `§ 12.89` AC 5 의 "rule 5 경계는 **구간이 아니라 판단 실질**" 판정을 승계해 비-결정 수정임을 1 문장으로 확인. task ID · commit SHA · PR 번호 · LOC 수치 · 링크 URL 무변경을 링크 수 불변으로 명시. 정정 후 재실측으로 **행 수 272 · 링크 66 · `## ` heading 8 불변** 과 `L` prefix **잔존 0** (또는 면제로 남긴 건수와 그 근거) 을 기록.
- [ ] **AC 6 — 비-ADR `L` 축 잔여 갱신.** 정정 후 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 과 좌표 총계를 실행해 `§ 12.90` AC 6 의 값 (비-ADR **14 파일**) 과 대조하고 잔여를 **파일 수 + 좌표 수 양쪽** 으로 기록한다. 잔여 파일을 hit 수 내림차순 **상위 5** 까지 (파일 · 행 · 좌표 · `~` 유무) 표 밖 1 구로 적어 후속 batch 편성 입력을 남기되, 편성 자체는 하지 않는다. ADR 축은 본 batch 미대상이라 `§ 12.90` 의 마감 상태 (미판정 좌표 **0** · 면제 확정 `ADR-0008`:149 **2 좌표**) 가 불변임을 1 구로 확인.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값으로 신설 절이 **≤ 60 행** 임을, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일** 임을, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · 다른 `docs/architecture/*` · `docs/decisions/` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 컬럼 균일 · heading 순번 `12.91` → `12.92` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 14 결과 수치 · 처리 좌표 수 · 비-ADR 축 진입 사실 · 개정판 `R5` 첫 적용 · 본 축 단일 파일 최대 batch 여부 · S3 전체 누적 처리 좌표), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · 파일 성격 판정이 경로 기준이라 성격 차등 불가 · 문서 간 일관성의 grep 미검출 승계 · 회색지대 조문 부재 (`R8` 이월 목록 현행화) · 단위어 부착 규칙의 비조문성 · 개정판 `R5` 인용 분산 (`§ 12.91` 한계 2) 의 실사용 관측 · FU14 anchor 흡수 관계), 파생 영향 **목록만** (다음 1 순위 = 비-ADR `L` 축 **batch 15** 편성 (AC 6 잔여 상위 목록 기반) · `R8` 조문화 · batch 상한 좌표 수 재설계 · 5 문서군 적용 범위 재확인 잔여분 · S4 조건부) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 대상 파일 **밖** 의 편집 — 비-ADR `L` 잔존 나머지 **13 파일** (`p4-implementation-plan.md` · `p3-to-p4-transition.md` · `api.md` · `directory.md` · `race-patterns.md` · `integrator.md` · `reviewer.md` 등) 정규화는 별도 slice.
- **`docs/PLAN.md` 본문 편집** — 본 파일 좌표의 다수가 PLAN.md 를 가리키지만 대상 문서의 내용 · 행 번호 정확성은 검증하지 않는다 (`§ 12.74` · `§ 12.82` 판정 승계).
- **`docs/use-cases/*` 파일군** (`UC-01` ~ `UC-09` · `INDEX.md` · audit 자신) 의 `L` 좌표 — `§ 12.76` AC 3 ② 5 문서군 **밖** 이라 census 대상이 아니다. 범위 편입 판단은 별도 slice.
- **ADR 재방문** — `§ 12.90` 이 `L` 축 ADR 마감을 선언했고 `ADR-0008`:149 는 면제 확정분이라 손대지 않는다.
- **`§ 12.76` 조문 본문 · `§ 12.91` 개정판 `R5` 문언 편집** — 본 slice 는 개정판을 **적용** 할 뿐 다시 개정하지 않는다. 식별자 범위 계수 제외 · `§` prefix 좌표 편입은 `R8` 이월 유지.
- **`R8` 조문화** · `R2` · `R3` 병합 재설계 · 면제 registry 의 조문화 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 대상 파일의 **판단 실질** (task 매핑 표의 task ID · 의존 · LOC · 상태 · 진척 서술 · cap 검산 수치) 변경, 링크 URL 변경, frontmatter · heading 구조 변경.
- 기존 audit 절 본문의 **소급 수정** — 결론은 신설 절 `§ 12.92` 안에서만 박제한다 (기록 보존 · append-only `§ 12.15`).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · architecture 문서 1 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **비-ADR `L` 축 batch 15 편성** — AC 6 이 남길 잔여 상위 목록 기반. `docs/architecture/*` 계열과 `.claude/agents/*` 계열을 한 batch 에 섞을지 (성격 판정 AC 3 ② 결론에 의존) 가 편성의 첫 갈림길.
- **batch 상한의 좌표 수 재설계** — 본 slice 가 단일 파일 40 좌표라 "파일 수 5" cap 과 실제 부하가 어긋난 정도를 실측 기록으로 남기면 `§ 12.91` 파생 (4) 의 입력이 된다.
- **개정판 `R5` 병기 인용 규약의 실효성 관측** — `§ 12.91` 한계 2 가 예고한 구판 오적용 위험을 후속 절들이 실제로 회피하는지 몇 slice 뒤 점검.
