---
id: T-1453
title: components.md `## Component table` 뒤 **각주 blockquote 7 블록 누적 구조 재판정** (좌표 drift 실측 + 처리 방식 판정) — T-1452 FU1 계승 + audit §12.51
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057]
estimatedDiff: 200
estimatedFiles: 3
created: 2026-08-04
independentStream: uc-doc-audit-resync
dependsOn: [T-1452]
touchesFiles:
  - docs/architecture/components.md
  - docs/use-cases/REQ-COVERAGE-AUDIT.md
  - docs/tasks/T-1453-components-md-table-footnote-structure-rejudge.md
plannerNote: "uc-doc-audit-resync 65 번째 slice — T-1452 FU1 (각주 7 블록 구조 재판정, 표 완결로 조건 소멸) 1 순위 집행. doc-only 1.6x"
---

# T-1453 — components.md `## Component table` 뒤 각주 blockquote 7 블록 누적 구조 재판정

## Why

[T-1452](T-1452-components-md-scheduler-row-vs-src-scheduling-audit.md) 가 `Scheduler` row 를 닫으며 **`## Component table` 7 row 대조를 완결** 했고 ([REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.50`), 그 파생 영향 **(1)** 과 한계 **4** 가 **"표 뒤 각주 7 블록 누적 구조 재판정"** 을 **다음 slice 1 순위** 로 지목했다. 본 task 는 그 지목을 집행한다.

이 재판정이 지금 가능해진 이유는 하나다 — `§ 12.49` AC 3.5 가 각주 규약 재설계를 **"표 완결까지 현 규약 (표 뒤 blockquote 나열) 유지"** 로 결착시켰는데, `§ 12.50` 이 표를 완결시켜 **그 유예 조건이 소멸** 했다. 즉 본 slice 는 새 대조가 아니라 **이미 쌓인 7 블록 (현 128 ~ 173 행) 의 구조 자체** 를 판정 대상으로 삼는다.

판정을 실측으로 묶는 축이 하나 더 있다. 각주 본문은 **행 번호 좌표를 그대로 박제** 하는데, **뒤에 붙은 각주가 앞 각주의 좌표를 밀어낸다**. planner 훑기상 T-1450 각주 (현 **156** 행) 는 sub-section heading 을 **"155 행"** 이라 적었으나 T-1451 · T-1452 각주 (+13 행) 삽입으로 실 heading 은 **175** 행이라 **이미 stale 로 보인다**. 이것이 참이면 "각주 안 행 번호 좌표" 가 **자기 자신의 누적 때문에 썩는 구조** 라는 사실이 실측으로 서는데, 이는 **30 회째 이월된 `행 번호 → anchor 좌표계 이행`** (`§ 12.50` FU16) 의 판단 근거로도 그대로 쓰인다.

planner 사전 확인 — **아래는 전부 가설이며 전제가 아니다** (T-1440 AC 1 이후 planner 기대가 실측에 반증·정정된 선례가 14 회 있다). executor 는 AC 1 에서 전부 재측정하고 **기대와 다르면 그 축의 편집을 중단** 한다. ① 각주 blockquote 는 **7 블록 · 46 행 (128 ~ 173)** 으로 보이며 표 본체 (117 ~ 126 행, 10 행) 보다 **4 배 이상** 이라 "읽기 부담 임계" 주장이 수치로 설 가능성이 크다. ② T-1450 각주의 `155 행` 표기는 **stale (거짓)** 일 가능성이 크다 — 실측으로 가른다. ③ 다른 각주 블록의 좌표 (표 row 번호 `119` ~ `126`) 는 **표 자체가 각주보다 앞** 에 있어 **여전히 유효** 할 가능성이 크다 (즉 drift 는 "각주 → 뒤쪽 좌표" 참조에만 발생). ④ 각주 블록의 `§ 12.44` ~ `§ 12.50` 링크는 anchor 없는 **파일 링크** 라 절 번호 drift 에는 강할 가능성이 크다. ⑤ **anchor 일괄 이행 (후보 C) 은 cap 초과** 가능성이 크다 — 46 행 전면 치환은 ≤ 300 LOC 안에 들어도 판정 밀도가 무너져 split 대상일 수 있다.

**행 좌표 주의** — components.md 는 T-1452 각주 +7 행으로 **243** 행이고, `## Component table` **115**, 표 본체 **117 ~ 126**, 각주 7 블록 **128 ~ 173**, `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` **175**, `## Contracts` **207**, `## References` **233** 이다. AC 1 (i) 에서 재실측한다.

[PLAN.md](../PLAN.md) 의 미완 bullet (106 · 108 · 109 · 140 · 151) 은 owner 게이트 · 외부 credential · 새 dependency 게이트라 planner 단독 진행 불가이므로, 본 doc stream 이 현 시점 우선순위 최상위다.

## Required Reading

- `docs/architecture/components.md` — **243 행**. 다음 구간만 읽는다.
  - **115 ~ 126 행** (`## Component table` heading + 표 header 2 행 + 7 row) — **무편집, 분량 대조용** (행 수 · 폭만 쓴다. row 본문 재판정 금지).
  - **128 ~ 173 행** (T-1446 ~ T-1452 각주 blockquote **7 블록**) — **본 slice 의 유일한 판정 대상**. 각 블록의 **첫 행 + 좌표 참조 + 말미 audit 링크** 만 인용한다 (**블록 본문 통독 · 판정 내용 재검토 금지**).
  - **1 ~ 4 행** (문서 성격 선언 blockquote) — **무편집**, 인용만.
  - **그 밖 전 구간** — **무편집, heading 좌표 확인만** (`## GitHub Adapter …` **175** · `## Contracts` **207** · `## References` **233**).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` — **5073 행**. **`### 12.15`** (append-only 처리 방침 정본) · **`### 12.50`** (**4982** 행 — T-1452 판정표 화법 template + **파생 영향 (1)** 원문 + **한계 4** 원문 + 7 row 완결 선언) · **`### 12.49`** (**4900** 행 — **AC 3.5 의 `표 완결까지 현 규약 유지` 결착 문장 1 ~ 2 구만** 인용) · **`## 11. References` (5060 행)** — `§ 12.51` 삽입 위치 경계. **그 밖의 절은 열지 않는다** (§7).
- `docs/PLAN.md` — **175 행. 무편집, 읽기만**. 미완 bullet 좌표 확인용 `grep` 만.
- `CLAUDE.md` §3 (task 크기 상한) · §3.2 (direct doc-only 면제) · §7 (context 절약) · §12 (언어 정책)

## Acceptance Criteria

- [ ] **AC 1 — 실측 선행 (날조 금지)**: 편집 전에 다음을 직접 측정해 `§ 12.51` 에 **명령과 출력을 함께** 인용한다. 기대값과 **다르면 그 축의 판정을 실측대로 뒤집는다** (Why 의 ① ~ ⑤ 는 가설일 뿐이다).
  - (i) **좌표 재확인**: `grep -n '^#\{1,3\} ' docs/architecture/components.md` 로 heading 좌표를 **먼저 실측** 한다 (본 AC 의 `115` · `175` · `207` · `233` 도 stale 일 수 있다 — T-1436 ~ T-1452 선례). 이어 `grep -n '^> \*\*' docs/architecture/components.md` 로 **각주 블록 시작행** 을, `grep -c '^> ' docs/architecture/components.md` 로 **blockquote 총 행수** 를 센다.
  - (ii) **분량 대조**: 표 본체 행수 (`117 ~ 126` 구간 실측값) ↔ 각주 구간 행수 (`128 ~ 173` 실측값) 를 **비율 1 개** 로 제시하고, 각주 구간의 **문자 수** (`sed -n '<시작>,<끝>p' … | wc -c`) 도 함께 인용한다. "읽기 부담 임계" 주장을 **수치로만** 세운다 (인상 서술 금지).
  - (iii) **좌표 drift 실측 (본 slice 의 핵심 증거)**: 각주 본문이 참조하는 **components.md 자기 자신의 행 번호** 를 뽑아 (`grep -n '행 `## \|행 `#' …` 또는 `sed -n '128,173p' … | grep -o '\*\*[0-9]\{2,3\}\*\* 행'` 등 **2 명령 이내**) 실 좌표와 대조한다. **최소한 T-1450 각주 (현 156 행) 의 `155` 행 표기** 는 반드시 재측정해 **참 / stale** 을 가른다. drift 가 발견되면 **몇 지점인지 · 어느 블록인지** 를 열거하고, 발견되지 않으면 **"drift 0" 이 그대로 판정 결과** 다 (그 경우 Why ② 를 반증한 사실로 기록).
  - (iv) **외부 참조 안정성**: 각주 말미의 `§ 12.44` ~ `§ 12.50` 링크가 **anchor 없는 파일 링크인지** `grep -o '(\.\./use-cases/REQ-COVERAGE-AUDIT\.md[^)]*)' docs/architecture/components.md | sort -u` **1 명령** 으로 확인한다. `## Component table` row 좌표 (`119` ~ `126`) 가 여전히 유효한지도 (i) 출력으로 가른다.
  - (v) **결착 조건 소멸 확인**: `§ 12.49` AC 3.5 의 `표 완결까지 현 규약 유지` 문장과 `§ 12.50` 의 **7 row 완결 선언 · 한계 4** 를 각각 **1 구씩** 인용해, 본 재판정이 **유예 조건 소멸에 근거** 함을 실측으로 세운다.
  - (vi) baseline — `wc -l` components.md **243** · audit **5073** · requirements.md **97** · deployment.md **232** · directory.md **203** · modules.md **259** · PLAN.md **175**, `grep -c '^## '` components.md **7** · audit **12**, audit `grep -c '^| REQ-'` **66** · `grep -c '^### 12\.'` **50**.
- [ ] **AC 2 — 구조 문제 판정표**: AC 1 이 실측한 **구조 축** 마다 `문제 있음 / 없음` 을 판정한 표를 만든다. 각 row 는 **축 1 구 · 실측 수치 · 판정 · 근거 1 구** 4 컬럼이다. 최소 축 4 개 — ① **분량 비율** (표 : 각주), ② **자기 참조 좌표 drift** (AC 1 (iii) 결과), ③ **외부 참조 안정성** (audit 링크 · row 좌표), ④ **탐색성** (표 직후에 7 블록이 이어져 다음 `##` heading 까지의 거리가 얼마인지 — 실측 행수로만).
  - **각주 블록 안의 판정 내용 (참 / 부분참 / 거짓) 재검토는 금지** — 본 표는 **구조** 만 다룬다.
- [ ] **AC 3 — 처리 방식 판정**: 후보 4 개 중 **채택 1 · 기각 3** 인 판정표를 만든다. 기각마다 근거 1 구.
  - 후보 — (A) **현행 유지 + 무편집** (audit 기록만), (B) **최소 개입** — 각주군 **앞** 에 안내 blockquote **1 개 (≤ 4 행)** 를 신설해 `row → 각주 블록 → audit 절` 매핑을 1 곳에 모으고, AC 1 (iii) 이 **stale 로 확정한 좌표만** in-place 정정 (**≤ 2 지점**), (C) **7 블록 전면 anchor 이행** (행 번호 → `#heading` anchor 일괄 치환), (D) **audit 이관** (각주 7 블록을 요약 1 블록 + 링크로 축약하고 전문은 audit 에만 존치).
  - 판정 기준 **4 축** 명시 — ① `§ 12.15` **append-only 정합** (기존 각주 본문 삭제 · 재작성은 방침과 충돌하는지), ② **오도 risk** (stale 좌표를 그대로 두면 독자가 잘못된 행을 열람할 비용 vs 대량 치환이 판정 이력을 훼손할 비용), ③ **cap** — 예상 diff ≤ 300 LOC · 변경 파일 **3 고정** (초과 후보는 **자동 기각 + split 제안을 파생 영향에 기록**), ④ **가역성** (되돌리기 비용 · 후속 각주가 계속 붙을 때의 확장성).
  - **(D) 는 `§ 12.15` append-only 방침과 정면 충돌 가능성이 커 기각 근거를 방침 인용으로 적는다**. **(C) 가 cap 안이라도 판정 밀도가 무너지면 기각하고 split 제안** 으로 넘긴다.
- [ ] **AC 4 — 채택안 반영**: AC 3 채택안대로만 편집한다.
  - **(A) 채택 시** — components.md **무편집** (`git status --porcelain docs/architecture/components.md` **빈 출력**) 이며, 유지 근거를 `§ 12.51` 에 남긴다.
  - **(B) 채택 시** — 안내 blockquote 는 **각주 첫 블록 (현 128 행) 직전** 에 삽입하고 **≤ 4 행 + 앞 빈 줄 1 행**, in-place 좌표 정정은 **AC 1 (iii) 이 stale 로 확정한 지점만 ≤ 2 지점** (숫자 1 개씩 치환, 문장 재작성 금지). `wc -l` 증가 **+5 이내** (243 → ≤ 248).
  - **(C) · (D) 채택 시** — 변경 파일 3 · diff ≤ 300 LOC 를 **먼저 검산** 하고, 초과하면 채택을 철회해 (B) 로 내린 뒤 그 사실을 `§ 12.51` 에 1 구로 남긴다.
  - **문구 · 행 번호 · 절 번호 · task ID 는 AC 1 실측 출력과 1:1 일치** 해야 하며, 실측되지 않은 값을 **새로 창작하지 않는다**.
  - **표 본체 (117 ~ 126 행) · 1 ~ 4 행 blockquote · 175 행 이후 전 구간 무편집**. **각주 블록의 판정 문장 (참 / 부분참 / 거짓 서술) 은 어떤 후보에서도 수정 금지** — 허용되는 in-place 는 **stale 숫자 치환뿐** 이다.
  - **secret · token · 실 credential 을 문서에 옮겨 적지 않는다** (CLAUDE.md §9).
- [ ] **AC 5 — audit `§ 12.51` 신설**: [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 의 `## 11. References` (5060 행) **직전** 에 `### 12.51 …` 절을 **순수 append** 한다 (기존 절 수정 0). 구성 — 본 절의 위치 · 계보 1 문단 (**`§ 12.50` 파생 영향 (1) · 한계 4 의 1 순위 지목** 과 `§ 12.49` AC 3.5 결착 조건이 표 완결로 소멸했다는 사실) / AC 1 실측 (명령 + 출력) / AC 2 구조 판정표 / AC 3 처리 판정표 / AC 4 반영 결과 + 무편집 경계 / **좌표계 이행 판단 재료** (AC 1 (iii) drift 실측이 `행 번호 → anchor 이행` 이월 항목에 주는 함의 **2 구 이내** — **이행 자체는 본 slice 밖**) / 파생 영향 (목록만) / 불변 검산 / 한계. **절 전체 ≤ 105 행** (초과 시 실측 인용을 요약형으로 압축하고 압축 사실을 한계에 명시).
  - `###` 레벨이라 `grep -c '^## '` **12 불변** · `grep -c '^| REQ-'` **66 불변** · `grep -c '^### 12\.'` **50 → 51**.
- [ ] **AC 6 — 불변 검산**: 다음을 실행해 출력을 `§ 12.51` 에 인용한다. `wc -l` components.md (243 → ≤ 248) · audit (5073 → +105 이내) · requirements.md (**97 불변**) · deployment.md (**232 불변**) · directory.md (**203 불변**) · modules.md (**259 불변**) · PLAN.md (**175 불변**), `git diff -U0 -- docs/architecture/components.md | grep '^@@'` 로 **hunk 개수 · 위치** 를 보이고 AC 4 허용 구간 밖 hunk **0** 을 실증 (무편집 채택 시 **hunk 0**), `git diff --numstat` 으로 **순수 삭제 0** (삭제 행이 있으면 stale 숫자 치환의 짝임을 1 구로 설명), `git status --porcelain src/ test/ web/ prisma/ deploy/ docker-compose.yml Dockerfile .github/ package.json README.md .claude/ docs/decisions/ docs/ops/ docs/PLAN.md docs/requirements.md` **빈 출력**, `git status --porcelain` 전체가 **3 파일 이내**.
- [ ] **AC 7 — 파생 영향 기록 (목록만, 본 slice 편집 금지)**: `§ 12.51` 말미에 후속 slice 대상을 목록으로 남긴다. 최소 포함 — (1) **`## Deployment 컨텍스트` (22 ~ 26 행) "8 component 동일 process" claim ↔ 표 7 row 카운트 어긋남** (`§ 12.50` FU3 — **8 회째 이월, 표 완결 후 다음 대조 1 순위 후보**) / (2) `## Component diagram` mermaid node ↔ 실 module 대조 / (3) `## GitHub Adapter — 3 instance 묶음 vs 분리 결정` sub-section 본문 ↔ 코드 대조 (`§ 12.48` FU4 미소진) / (4) `## Contracts` 표 ↔ 실 계약 표면 대조 / (5) **row pointer 셀 보강 2 건** (`Scheduler` = `ADR-0042` 미등재 `§ 12.50` FU2 · `Confluence Adapter` `§ 12.49` FU2) / (6) LLM · GitHub adapter ADR pointer 미등재 (`§ 12.47` FU5 · `§ 12.48` FU3) / (7) `@nestjs/config` 미도입 전수 sweep (`§ 12.39` FU3, ADR 게이트) / (8) reviewer 규약 미이행 (`§ 12.41` FU2) / (9) `deploy/README.md` ↔ deployment.md ↔ runbook 3 자 정합 (`§ 12.41` FU3) / (10) README 행 번호 pointer drift 전수 sweep / (11) REQ 번호 체계 잔재 sweep (`§ 12.38` FU3) / (12) `CLAUDE.md` §1 pointer 부정확 (T-1442 FU3) / (13) UC-09 `§ 5` sequence participant 병기 (**37 회째 이월**) / (14) modules.md 카운트 claim 대조 (`§ 12.34` FU1, ADR 게이트) / (15) **행 번호 → anchor 좌표계 이행** (**31 회째 이월 — 본 절 (iii) drift 실측이 판단 재료를 보강했는지 1 구로 표기**) / (16) `§ 12.44` 한계 "mutation 러너 26 개" 정의 미확정 / (17) `Scheduler` cron → 평가 pipeline 미결선 (`§ 12.50` FU18 — **코드 소관, `pr` task 로만**) / (18) `ADR-0003` "단일 DB 인스턴스" 좌표 부재 (`§ 12.46` FU16) / (19) **AC 3 에서 기각된 후보의 split 제안** (기각이 cap 사유였을 때만).
- [ ] **AC 8 — R-110 / R-112 면제 근거 명시**: 본 task 는 `commitMode: direct` doc-only 로 production code **0 LOC** · 분기 **0** 이라 [CLAUDE.md](../../CLAUDE.md) §3.2 direct-mode 면제 조항에 따라 tester 호출 · happy / error / flow / negative 4 항목 · `pnpm test:cov` 가 **N/A** 임을 `§ 12.51` 에 1 구로 명시한다.
- [ ] **AC 9 — 언어 · 링크 규약**: 추가 문장은 모두 한국어 (§12), 문서 간 참조는 상대경로 markdown 링크, 수치는 실측 출력과 1:1 일치.

## Out of Scope

- **코드 · schema · frontend · 배포 자산 · CI · agent 정의 변경 절대 금지** — `src/` · `web/` · `test/` · `prisma/` · `scripts/` · `deploy/` · `docker-compose.yml` · `Dockerfile` · `.github/workflows/` · `package.json` · `.claude/agents/` 는 diff 에 등장하면 안 된다.
- **각주 7 블록의 판정 내용 재검토 · 재측정 금지** — `§ 12.44` ~ `§ 12.50` 이 이미 닫았다. 본 slice 는 **구조** 만 다루며, 각 블록 안의 참 / 부분참 / 거짓 서술은 인용조차 최소화한다.
- **`## Component table` 7 row 본문 (117 ~ 126 행) 재판정 · 편집 금지**.
- **components.md 전면 anchor 좌표계 이행 실행 금지** — 본 slice 는 표 뒤 각주 구간의 처리 판정까지이며, 문서 전역 이행은 파생 영향 (15) 소관이다.
- **각주 블록 삭제 · 이관 · 재작성 금지** (AC 3 (D) 가 채택되지 않는 한). 채택되더라도 `§ 12.15` append-only 정합을 먼저 판정에 세우고, 통과하지 못하면 실행하지 않는다.
- **`## Deployment 컨텍스트` · `## Component diagram` · `## GitHub Adapter …` sub-section · `## Contracts` · `## References` 판정 · 편집 금지** — 각각 파생 영향 (1) · (2) · (3) · (4) 소관이다.
- **`docs/PLAN.md` · `docs/requirements.md` 편집 금지** — 좌표 확인용 grep 인용까지만.
- **ADR 본문 · status 변경 금지**, **[modules.md](../architecture/modules.md) · [INDEX.md](../architecture/INDEX.md) · [deployment.md](../architecture/deployment.md) · [directory.md](../architecture/directory.md) · [api.md](../architecture/api.md) 편집 금지** — 필요 사실은 파생 영향 목록에만.
- **다른 문서로의 cascade 금지** — [use-cases/INDEX.md](../use-cases/INDEX.md) · `UC-01` ~ `UC-09` · ADR · [README.md](../../README.md) 는 무편집.
- **빌드 · 테스트 · 설치 실행 금지** — `pnpm install` · `pnpm build` · `pnpm test` 어느 것도 실행하지 않는다 (측정은 전부 read-only `grep` · `sed` · `wc` · `git`).
- **CI drift-guard spec 작성 금지** — `pr` mode 소관이라 본 direct task 에서 진행하면 §3.1 위반.
- **audit 기존 절 (`§ 12.1` ~ `§ 12.50`) 수정 금지** — `§ 12.51` 순수 append 만.

## Suggested Sub-agents

`implementer` 단독 (doc-only, 코드 0 LOC — architect · tester 불요. §3.2 direct-mode 면제).

## Follow-ups
