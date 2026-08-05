---
id: T-1498
title: 범위 표기 규약 축 S3 batch 18 — 비-ADR `L` 축 architecture 잔여 3 파일 (`realdata-e2e-guard-harness.md` · `components.md` · `deployment.md`) 마감 slice — 개정판 R5 · R1 · R4 정규화 + 좌표 대상이 소스 코드 파일인 첫 사례 · 이미 `~` 구분자를 쓴 범위 좌표 · 비-ADR 유일 en dash 좌표와 `L` prefix 없는 bare 좌표 census 사각 (audit §12.96)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 140
estimatedFiles: 5
created: 2026-08-05
independentStream: uc-doc-audit-resync
dependsOn: [T-1497]
touchesFiles:
  - docs/architecture/realdata-e2e-guard-harness.md
  - docs/architecture/components.md
  - docs/architecture/deployment.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1498-range-notation-s3-nonadr-batch18-arch-close.md
plannerNote: "uc-doc-audit-resync 110 번째 slice — §12.95 파생 (1) 1 순위 batch 18, architecture 잔여 3 파일 마감 5 행 / 10 좌표, direct 5 파일"
---

# T-1498 — 범위 표기 규약 축 S3 batch 18 — 비-ADR `L` 축 architecture 잔여 3 파일 마감 slice

## Why

[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.95` 의 **파생 영향 (1)** 이 **1 순위** 로 지목한 **batch 18** 의 실집행 slice 다. 같은 절 AC 6 이 잔여를 **5 파일 / 10 좌표** 로 실측하고 `docs/architecture/*` **3 파일 / 4 좌표** 와 `.claude/agents/*` **2 파일 / 6 좌표** 로 분리 집계하면서, "**batch 18 이 architecture 잔여 3 파일을 마감하고 batch 19 가 agents 2 파일을 마감** 하는 형태" 로 편성을 **미리 확정** 했다 (혼합 마감은 파일 수 cap 상 불가). 본 slice 는 그 확정을 그대로 집행해 `realdata-e2e-guard-harness.md` (**2 행 / 2 좌표**) · `components.md` (**2 행 / 7 좌표** — planner 재실측이 `§ 12.95` 의 1 좌표 집계를 정정, 아래 (다) 참조) · `deployment.md` (**1 행 / 1 좌표**) 를 한 batch 로 묶는다. 편성 파일 수는 대상 3 + audit + task = **5/5** 로 cap 을 다시 정확히 소진해 **파일 수가 상한을 물린 세 번째 slice** 이며, 좌표 합 **10** 은 `§ 12.83` AC 3 ④ 임계 **70** 을 크게 밑돌아 이월 **0** 이다. 본 batch 로 **`docs/architecture/*` 계열의 `L` 축이 마감** 되고 축 잔여는 `.claude/agents/*` **2 파일** 만 남아, batch 19 가 비-ADR `L` 축 전체 마감 slice 로 확정된다.

본 slice 가 새로 여는 판정 축은 셋이다 — (가) **좌표 대상이 소스 코드 파일인 첫 사례**: `realdata-e2e-guard-harness.md` 34 · 37 행의 좌표 2 는 모두 `test/helpers/realdata-e2e-result-issue-action.ts` 라는 **TypeScript 소스 파일** 의 행을 가리킨다. `§ 12.94` 가 판정한 "5 문서군 **밖** 대상 좌표" 는 대상이 그래도 문서였는데, 대상이 **문서가 아예 아닌** 경우는 처음이라 (ㄱ) 표기 규약이 **표기 주체 문서 기준** 이라는 `§ 12.94` 결론이 코드 대상에도 그대로 미치는지, (ㄴ) 단위어 `행` 이 코드 행에도 자연스러운지, (ㄷ) 코드 파일은 문서보다 행 이동이 잦아 좌표 stale 위험이 큰데 그 사실이 정정 여부 판단에 영향을 주는지 (`§ 12.74` 값 무검증 원칙과의 관계) 를 결론지어야 한다. (나) **이미 `~` 구분자를 쓴 범위 좌표**: 같은 파일의 `L1~60` · `L23~27` 은 `R1` 이 요구하는 구분자를 **이미 충족** 하고 `L` prefix 와 단위어만 어긋난 첫 사례라, `R1` **무편집** · `R5` + `R4` **단독 적용** 이라는 조문 분해가 처음 필요하다 (지금까지 범위 좌표는 hyphen · en dash 를 동반해 `R1` 이 항상 함께 걸렸다). (다) **비-ADR 유일 en dash 좌표 + `L` prefix 없는 bare 좌표 census 사각**: `components.md` 113 행 `L19–22` 는 비-ADR 축에서 처음이자 유일한 **en dash 좌표** 로 `§ 12.92` 가 "en dash 마감은 **ADR census 한정**" 이라 확정한 단서의 실물이며, 같은 파일 355 행은 `— 7–18 (REQ-005~007 GitHub) / 19–22 (REQ-044 권한) / …` 형태로 **`L` prefix 없는 en dash 범위 좌표 6** 을 한 행에 담아 **`grep -E 'L[0-9]+'` 기반 잔여 census 가 구조적으로 놓치는 사각** 을 처음 실증한다. 이 사각은 축 "마감" 선언의 정확성에 직결되므로 본 절에서 census 방법론을 갱신해야 한다.

`CLAUDE.md` §3.1 **rule 5** (기존 `docs/architecture/*` 본문의 **비-결정 수정** = `direct`) 의 **열여덟 번째** 적용 선례이며 (`§ 12.95` ③ 이 열일곱 번째), 편집은 `L` prefix 제거 + 구분자 정규화 + 단위어 `행` 부착에 한정되고 문서의 판단 실질 (가드 4 불변식 · component 박스 · 운영 토폴로지 · REQ 매핑 · 링크 URL) 은 무편집이다.

## Required Reading

- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — `§ 12.76` (정본 조문 `R1` · `R4` · `R6` · `R7` · AC 3 ② **5 문서군 적용 범위** · AC 3 ③ 한정 소급) · `§ 12.78` (`R1` ASCII hyphen 치환 선례) · `§ 12.83` AC 3 ① (수량 · 식별자 범위 = 범위 밖) · AC 3 ④ (좌표 **70** 이월 임계) · AC 5 (rule 5 경계 = 판단 실질) · `§ 12.85` 한계 4 (단위어 부착 3 규칙) · `§ 12.90` (문서 간 일관 적용 · 면제 확정 registry) · `§ 12.91` (개정판 `R5` 문언 · AC 4 병기 인용 규약) · `§ 12.92` (en dash 마감 = **ADR census 한정** 확정 · 파일 성격 경로 기준) · `§ 12.94` AC 3 (5 문서군 밖 대상 좌표 · 한 행 다좌표 체인) · `§ 12.95` 전문 (7845 행 ~ 7899 행 · 특히 AC 1 ④ 파일 수 상한 · AC 5 이중 검산 분모 · AC 6 잔여 census 와 batch 18 · 19 편성 확정 · 한계 4 `R8` 이월 10 종 · 파생 (1)(3)). 신설 절 `§ 12.96` 은 `§ 12.95` 뒤 · `## 11. References` **직전** 에 append (현재 파일 **7914 행** · References heading **7901 행**).
- [docs/architecture/realdata-e2e-guard-harness.md](../architecture/realdata-e2e-guard-harness.md) — planner 실측 후보 **2 행 / 2 좌표** (34 · 37 행), 총 **86 행** · 링크 `](` **3** · `## ` heading **6** · fence **0**, `~` 포함 행 **2** (전부 좌표 행 — 순수 비-좌표 `~` 행 **0**) · en dash 행 **0** · 좌표 ASCII hyphen **0**. 좌표 형태: **소스 코드 대상** 괄호 범위 (`상단 주석 (L1~60, T-0584) 이` — 34 행) · **소스 코드 대상** 파일경로 결합 범위 (`…-issue-action.ts L23~27 의 일반화` — 37 행). 둘 다 구분자가 이미 `~` 라 `R1` 무편집.
- [docs/architecture/components.md](../architecture/components.md) — planner 실측 후보 **2 행 / 7 좌표** (113 · 355 행), 총 **357 행** · 링크 `](` **111** · `## ` heading **7** · fence **2**, `~` 포함 행 **73** (대부분 `REQ-005~007` 식별자 범위 · 산문 `~`) · en dash 행 **2** (= 좌표 행 2 와 동일) · 좌표 ASCII hyphen **0**. 좌표 형태: 링크 뒤 괄호 **en dash 범위 + `L` prefix** 단일 (`([README.md](../../README.md) L19–22, REQ-044) 의` — 113 행) · References bullet 안 **`L` prefix 없는 en dash 범위 6 개 슬래시 체인** (`— 7–18 (REQ-005~007 GitHub) / 19–22 (REQ-044 권한) / 33–41 (REQ-015 Confluence) / 45–51 (REQ-026 인원) / 68–71 (REQ-038 UI) / 96–103 (REQ-049 / REQ-051~055 LLM).` — 355 행). **355 행은 `grep -E 'L[0-9]+'` 에 잡히지 않아 `§ 12.95` AC 6 집계 (1 좌표) 에서 누락된 분** 이다.
- [docs/architecture/deployment.md](../architecture/deployment.md) — planner 실측 후보 **1 행 / 1 좌표** (149 행), 총 **232 행** · 링크 `](` **49** · `## ` heading **6** · fence **6**, `~` 포함 행 **9** · en dash 행 **0** · 좌표 ASCII hyphen **0**. 좌표 형태: 링크 뒤 bare 단일 (`[README.md](../../README.md) L72 예시 (KST 02:00)` — 149 행).
- [CLAUDE.md](../../CLAUDE.md) — §3 (cap 300 LOC · 5 파일) · §3.1 rule 5 (비-결정 doc 수정 = `direct`) · §12 정본 pointer 소절 (`§ 12.76 R5 (§ 12.91 개정)` 병기 인용 규약 포함).

## Acceptance Criteria

- [ ] **AC 1 — 대상 선정 · 한정 소급 · mode · cap 판정.** audit 신설 절 `§ 12.96` 안에 ① 선정 근거 (`§ 12.95` 파생 (1) 1 순위 · AC 6 이 **batch 18 = architecture 잔여 3 파일 마감** 으로 편성을 미리 확정했음을 인용하고 본 slice 가 그 확정의 집행임을 적시 · 혼합 마감이 파일 수 cap 상 불가하다는 논거 승계), ② 한정 소급 준수 (AC 2 census 가 파일 · 행 단위로 특정 → `§ 12.76` AC 3 ③ 충족 · **전면 일괄 치환 금지** 재확인 · `components.md` 355 행처럼 한 행에 좌표 **6** 이 몰린 구조에서 **행별 문자열 편집** 을 택했음을 `§ 12.95` AC 3 ② 승계로 명시), ③ mode 근거 (`CLAUDE.md` §3.1 rule 5 **열여덟 번째 선례** · `§ 12.95` ③ 의 열일곱 번째 뒤임을 명시), ④ **cap 판정** (좌표 **10** 은 임계 **70** 을 크게 밑돌아 이월 **0**, 파일 수는 **5/5** 로 cap 소진 → **파일 수가 상한을 물린 세 번째 slice** 임을 적시하고 `§ 12.94` 파생 (3) · `§ 12.95` AC 1 ④ 의 **좌표 · 파일 이중 상한** 재설계 논거에 본 실측 (좌표 **10** / 파일 **5**) 이 **세 번째 증거점** 임을 1 문장 기록) 를 각각 **1 문단씩** 박제.
- [ ] **AC 2 — 후보 census 재실측 (파일별 집계 1 구).** 세 파일 각각에 `grep -cE 'L[0-9]+'` (행) · `grep -oE 'L[0-9]+' | wc -l` (좌표) · `grep -cE '[0-9] *~ *[0-9]'` · `grep -cE '[0-9] *– *[0-9]'` (en dash) · `grep -cE 'L[0-9]+ *- *[0-9]'` (좌표 ASCII hyphen) 을 실행해 값을 절 안에 기록하고, Required Reading 의 planner 기준값 (**2 / 2** · **2 / 7** · **1 / 1**) 과의 **차이를 명시** (차이 0 이면 "차이 0"). 특히 `components.md` 의 `L[0-9]+` 값은 **1** 로 나오는데 실제 좌표는 **7** 이라는 불일치를 그대로 기록하고 그 원인이 355 행의 **`L` prefix 없는 좌표 6** 임을 적시한다 (AC 3 ③ 의 census 사각 판정 입력). 좌표를 **단일 (`R4` 병용)** 과 **범위 (`R1` 적용 여부 분해)** 로 분할한 수 (planner 기준 단일 **1** / 범위 **9** — 그중 `~` 기충족 **2** · en dash **7**) 를 기록하고, `§ 12.94` AC 5 가 확정한 **이중 검산 분모 규칙** (raw `~` 행이 아니라 **좌표 토큰 제거 후 값**) 을 적용해 파일별 **순수 비-좌표 `~` 행 수** 를 정정 전 값으로 먼저 기록한다 (planner 기준 **0** · **73 중 좌표 행 제외분** · **9**).
- [ ] **AC 3 — 판정 3 종 독립 결론.** ① **좌표 대상이 소스 코드 파일** — `realdata-e2e-guard-harness.md` 34 · 37 행의 좌표 2 가 `test/helpers/realdata-e2e-result-issue-action.ts` (TypeScript) 를 가리킴을 인용하고, (ㄱ) `§ 12.94` 의 "규약은 **표기 주체 문서** 기준" 결론이 대상이 코드일 때도 그대로 적용됨 (ㄴ) 단위어 `행` 이 코드 행에도 부착 가능한지 (`§ 12.85` 한계 4 의 3 규칙 적용) (ㄷ) 코드는 문서보다 행 이동이 잦아 좌표 stale 위험이 크지만 **값 정확성은 여전히 범위 밖** (`§ 12.74` 승계) 이라 정정 여부에 영향을 주지 않음 — 셋을 각 1 구로 결론짓고, `R8` 이월 목록에 "**코드 대상 좌표**" 항을 추가할지 판단한다. ② **이미 `~` 를 쓴 범위 좌표의 조문 분해** — `L1~60` · `L23~27` 이 `R1` 요구 구분자를 **이미 충족** 함을 보이고 본 건에 걸리는 조문이 `R5` (prefix 제거) + `R4` (단위어) **뿐** 이며 `R1` 은 **무편집 (기충족)** 임을 1 구로 확정한다. 범위 좌표에 `R1` 이 항상 함께 걸린다는 지금까지의 암묵 전제가 **일반명제가 아님** 을 기록하고, AC 4 대조표의 근거 조문 컬럼이 건별로 달라지는 첫 사례임을 적시. ③ **비-ADR en dash 좌표 + bare 좌표 census 사각** — `components.md` 113 행 `L19–22` 가 비-ADR 축 **유일한 en dash 좌표** 임을 `§ 12.92` ("en dash 마감은 ADR census 한정") 의 실물로 인용해 `R1` en dash → `~` 치환 + `R5` + `R4` 결합 처리하고, 355 행의 **`L` 없는 en dash 범위 6** 이 `grep -E 'L[0-9]+'` 잔여 census 에 **잡히지 않는 구조적 사각** 임을 결론짓는다. 후속으로 **5 문서군 전체에 `grep -cE '[0-9] *– *[0-9]'` 를 실행** 해 hit 를 **좌표** 와 **범위 밖 (수량 · step · 식별자 범위)** 으로 분류한 표 밖 1 구를 남긴다 (planner 사전 실측 hit: `api.md` 1 · `components.md` 2 · `p3-implementation-plan.md` 1 · `p3-to-p4-transition.md` 4 · `p4-implementation-plan.md` 1 · `.claude/agents/notifier.md` 2 · `.claude/agents/planner.md` 1 — `components.md` 2 외에는 전부 `12–18 task` · `2–4 options` · `step 2–3` 같은 **수량 범위** 로 보이며, 실측으로 확인). 아울러 355 행의 README REQ 매핑이 `directory.md` 197 행 (T-1497 처리분) 과 **같은 매핑을 다른 좌표 값** (`7–18` 대 `16-18`) 으로 적고 있다는 관측을 1 구로 기록하되 **값 검증 · 정정은 범위 밖** 임을 명시한다.
- [ ] **AC 4 — 대조표.** 후보 **5 행 / 10 좌표** 전량을 `# / 파일 / 행 / 원 표기 / 판정 / 근거 조문 / 승계 선례` **7 컬럼** 표로 박제한다 (355 행처럼 한 행에 좌표 6 이 몰린 건은 1 행으로 묶되 좌표 건수를 적는다). 범위 밖 (수량 · 식별자 범위 — 같은 행 안의 `REQ-005~007` · `REQ-051~055` 포함) 표기는 마지막 행으로 묶어 무편집임을 적고, `R6` · `R7` 면제 판별 건수 · 단일 좌표 (`R4`) 대 범위 좌표 수 · **범위 좌표 중 `R1` 적용분 (en dash 7) 과 기충족 무편집분 (2) 의 분해** · 단위어 부착 횟수 · 조사 보정 건수 · 코드 대상 좌표 건수를 표 뒤 **1 구** 로 구분해 기록.
- [ ] **AC 5 — 무편집 검산.** `git diff --numstat` 로 **파일별** 추가 행 수 = 삭제 행 수 임을 보이고 (예상 **2/2** · **2/2** · **1/1** — 실측이 다르면 hunk 흡수 몫인지 1 구 설명), `§ 12.83` AC 5 · `§ 12.95` AC 5 의 "rule 5 경계는 **구간이 아니라 판단 실질**" 판정 승계로 비-결정 수정임을 1 문장 확인. 가드 4 불변식 문구 · component 박스 · 운영 토폴로지 · REQ ID · task ID · 파일 경로 (`test/helpers/…ts`) · 링크 URL 무변경을 링크 수 불변 (**3** · **111** · **49**) 으로 검산. 정정 후 재실측으로 **행 수 86 · 357 · 232 불변** · `## ` heading **6 · 7 · 6 불변** · fence **0 · 2 · 6 불변** · `L` prefix **잔존 0** (또는 면제로 남긴 건수와 근거) · en dash **좌표** 잔존 **0** (비-좌표 en dash 는 무편집 존속) · 순수 비-좌표 `~` 행 수 불변 (AC 2 의 좌표 토큰 제거 후 값 기준) 을 기록.
- [ ] **AC 6 — 비-ADR `L` 축 잔여 갱신 + architecture 계열 마감 선언.** 정정 후 `grep -lE 'L[0-9]+' docs/architecture/*.md .claude/agents/*.md | wc -l` 과 좌표 총계를 실행해 `§ 12.95` AC 6 의 값 (**5 파일 / 10 좌표**) 과 대조하고 잔여를 **파일 수 + 좌표 수 양쪽** 으로 기록한다 (감소분이 본 batch 처리분과 일치하는지 1 구 검산 — `components.md` 의 bare 좌표 6 때문에 `L` 기준 감소분 (**3 파일 / 4 좌표**) 과 실제 처리 좌표 (**10**) 가 다르다는 점을 명시). `docs/architecture/*` 잔여가 **0 파일 / 0 좌표** 임을 확인해 **architecture 계열 `L` 축 마감** 을 선언하고, 잔여가 `.claude/agents/integrator.md` (5 행 / 5 좌표) · `.claude/agents/reviewer.md` (1 / 1) **2 파일 / 6 좌표** 뿐임을 hit 내림차순 1 구로 적어 **batch 19 = 비-ADR `L` 축 전체 마감 slice** 임을 확정하되 편성 자체는 하지 않는다. AC 3 ③ 의 en dash 분류 결과를 반영해 **잔여 census 방법론을 `L` 단독 grep 에서 `L` + en dash + bare 범위 병행 census 로 갱신** 하고, 그 기준으로 본 batch 이후 **비-좌표를 제외한 실 잔여** 를 1 구로 다시 적는다. ADR 축은 본 batch 미대상이라 `§ 12.90` 마감 상태 (미판정 좌표 **0** · 면제 확정 `ADR-0008`:149 **2 좌표**) 불변임을 확인.
- [ ] **AC 7 — 자기 준수 · 범위 검산 1 구.** 신규 추가분 대상 자기 준수 grep (`grep -nE '[0-9]+ *– *[0-9]+|L[0-9]+'` 를 신설 절 · task 파일 대상으로) hit 수를 적고 전량이 **원 표기 인용 (`R6` 예외)** 임을 확인. 본 절이 `R5` 를 인용할 때 **`§ 12.76 R5 (§ 12.91 개정)`** 병기 형태만 썼고 구판 단독 인용이 **0** 임도 1 구 자기 검산 (`§ 12.92` 한계 6 · `§ 12.95` AC 7 관측 계속 — **5 회차**). `wc -l docs/use-cases/REQ-COVERAGE-AUDIT.md` 전후 값 (**7914 → ?**) 으로 신설 절 **≤ 60 행**, `git diff --stat` 으로 **≤ 300 LOC · ≤ 5 파일**, `git status --short` 로 `README.md` · `CLAUDE.md` · `docs/requirements.md` · `docs/PLAN.md` · 다른 `docs/architecture/*` · `docs/decisions/` · `.claude/agents/` · `docs/LOOP.md` · `src/` · `test/` · `prisma/` 변경 **0** 임을 검산. audit 파일 fence **짝수** · 신설 표 **7 컬럼 균일** · heading 순번 `12.95` → `12.96` **연속** 도 확인. doc-only 라 `pnpm test` 불요 (`CLAUDE.md` §3.2 direct doc-only 면제).
- [ ] **AC 8 — 진척 · 한계 · 파생 영향.** 절 말미에 진척 1 문단 (batch 18 결과 수치 · 처리 좌표 수 · **architecture 계열 마감** · 판정 3 종 신설 · batch 6 ~ 18 누적 정정 좌표 갱신 (`§ 12.95` 기준 **261**)), 한계 **4 개 이상** (좌표 값 정확성 미검증 승계 · **`L` 단독 grep census 의 사각을 본 batch 가 처음 실증했으므로 그 이전 batch 의 "마감" 선언들도 bare 좌표를 놓쳤을 수 있다** 는 신규 항 (소급 재census 는 착수 금지 · 위험 기록만) · 문서 간 일관성의 grep 미검출 (같은 README 매핑의 좌표 값 불일치 실물 포함) · 회색지대 조문 부재 (`R8` 이월 목록 현행화 — 코드 대상 좌표가 추가되는지) · 단위어 부착 규칙의 비조문성 · 개정판 `R5` 인용 분산 관측 5 회차 · FU14 anchor 흡수 관계), 파생 영향 **목록만** (다음 1 순위 = 비-ADR `L` 축 **batch 19** = `.claude/agents/*` 2 파일 마감 · `R8` 조문화 · 좌표 · 파일 이중 상한 재설계 · **bare 좌표 소급 census** · 5 문서군 적용 범위 재확인 잔여분 (`docs/use-cases/*` 편입) · S4 조건부) 을 박제. **파생 항목은 본 slice 에서 착수 금지**.

## Out of Scope

- 대상 3 파일 **밖** 의 편집 — 비-ADR `L` 잔존 나머지 **2 파일** (`.claude/agents/integrator.md` · `.claude/agents/reviewer.md`) 정규화는 batch 19 몫.
- **이미 처리된 파일의 bare 좌표 소급 재census · 재정정** — AC 3 ③ 의 en dash 분류는 **분류 · 기록만** 이고, 다른 파일에서 좌표로 판명된 건이 나와도 본 slice 에서 고치지 않는다 (파생 영향에 남긴다).
- **좌표가 가리키는 대상 파일** (`README.md` · `test/helpers/realdata-e2e-result-issue-action.ts`) 의 편집 · 행 번호 정확성 검증 — 표기만 다루고 값은 다루지 않는다 (`§ 12.74` · `§ 12.95` 한계 1 승계). `components.md` 355 행과 `directory.md` 197 행의 좌표 값 불일치도 **기록만**.
- **수량 범위 · step 범위 · 식별자 범위 표기 편집** — `REQ-005~007` · `REQ-051~055` · `12–18 task` · `step 2–3` 같은 표기는 범위 밖이라 **무편집** 이다 (건드리면 AC 5 이중 검산이 깨진다).
- **`.claude/agents/notifier.md` · `planner.md` 의 en dash** — 수량 범위로 보이며 본 slice 대상 파일 밖이라 분류 기록만 하고 편집하지 않는다.
- **heading 구조 · References bullet 구조 변경** — 355 행은 좌표 토큰만 정정하고 bullet 순서 · 괄호 주석 · 슬래시 구분자 · 링크는 손대지 않는다.
- **`docs/use-cases/*` 파일군** 의 `L` 좌표 — `§ 12.76` AC 3 ② 5 문서군 **밖**. 범위 편입 판단은 별도 slice.
- **ADR 재방문** — `§ 12.90` 이 `L` 축 ADR 마감을 선언했고 `ADR-0008`:149 는 면제 확정분이라 손대지 않는다.
- **`§ 12.76` 조문 본문 · 개정판 `R5` 문언 편집** · `R8` 조문화 · `R2` · `R3` 병합 재설계 · 면제 registry 조문화 · FU14 anchor 좌표계 이행 — 관계 언급만, 착수 금지.
- 대상 파일의 **판단 실질** (`realdata-e2e-guard-harness.md` 의 가드 4 불변식 · raw 미저장 정합, `components.md` 의 component 박스 · 등급 · REQ 매핑, `deployment.md` 의 cron 표현식 · 운영 토폴로지) 변경, 링크 URL 변경.
- 기존 audit 절 본문의 **소급 수정** — 결론은 신설 절 `§ 12.96` 안에서만 박제한다 (기록 보존 · append-only `§ 12.15`).
- `docs/STATE.json` · `docs/progress/journal-*.md` 편집 (driver bookkeeping 몫) · `src/` · `test/` · `prisma/` · `.github/workflows/` 일체.

## Suggested Sub-agents

`implementer` 단독 (doc-only · architecture 문서 3 파일 in-place 정정 + audit 절 신설 1). 코드 변경 0 이므로 `tester` 불요 ([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

- **비-ADR `L` 축 batch 19 (축 마감 slice)** — `.claude/agents/integrator.md` (5 행 / 5 좌표) · `reviewer.md` (1 / 1) 2 파일 / 6 좌표. 대상 + audit + task = **4 파일** 로 cap 여유가 있어 축 전체 마감이 한 slice 로 가능하다.
- **bare 좌표 소급 census** — AC 3 ③ 이 실증할 `L` 단독 grep 의 사각을 근거로, 이미 마감 선언된 파일군 (ADR 축 포함) 에 en dash · hyphen bare 좌표가 남았는지 재census 할지 판단.
- **코드 대상 좌표의 조문화** — AC 3 ① 결론을 `R8` 이월 목록에 추가할지 검토.
- **좌표 · 파일 이중 상한 재설계** — `§ 12.94` 파생 (3) 에 본 slice 실측 (좌표 **10** / 파일 **5**) 이 세 번째 증거점.
