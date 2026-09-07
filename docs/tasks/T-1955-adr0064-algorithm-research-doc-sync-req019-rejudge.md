---
id: T-1955
title: ADR-0064 ACCEPTED 승격 + REQ-019 재판정 + PLAN 103 행 doc-sync
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-019, REQ-032]
estimatedDiff: 45
estimatedFiles: 3
estimatedFilesNote: docs 3 개 (ADR-0064 / requirements.md / PLAN.md) — src·test·prisma·workflow·web 변경 0
created: 2026-09-08
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1948, T-1949, T-1950, T-1951, T-1952, T-1953, T-1954]
touchesFiles:
  - docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md
  - docs/requirements.md
  - docs/PLAN.md
plannerNote: "P5 품질 분류 bullet(PLAN 103 행) — ADR-0064 §Follow-ups (d) doc-sync. (a)~(c) 코드 slice 전량 머지 후 1 회 재판정 (§3.1 once-rule)."
---

# T-1955 — ADR-0064 ACCEPTED 승격 + REQ-019 재판정 + PLAN 103 행 doc-sync

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Follow-ups (d)` 가 지정한 **마지막 문서 slice** 다. 같은 ADR 의 코드 chain (a) mapper 파생 신호 (T-1949 PR #1530 → `c93fb3cf`, T-1950 PR #1531 → `695c3595`) · (b) detection helper + detection pipeline 배선 (T-1951 PR #1532 → `e70a762e`, T-1952 PR #1533 → `a98ad3df`) · (c) uplift adjuster + adjustments pipeline step (9) 배선 (T-1953 PR #1534 → `aee16428`, T-1954 PR #1535 → `c204dd88`) 이 **전량 머지** 됐으므로, CLAUDE.md `§ 3.1` 의 "REQ status 재판정 task 는 그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회만" ([PLAN.md](../PLAN.md) `183 행` once-rule) 조건이 지금 충족된다. 문서가 코드보다 뒤처진 상태 (PROPOSED 인 ADR 위에 구현이 머지돼 있고 REQ 는 "부재" 를 주장) 를 닫는 것이 본 task 의 전부다.

**issue-still-relevant pre-check (origin/main `3a85da4d` 실측 — 문서 축 안착 0 / 코드 축 안착 100%)**:

- ADR status — `docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` frontmatter `5 행` 이 `status: PROPOSED` 이고 `§ Status` (`15 행`) 본문도 "**PROPOSED**. 본 slice 는 **정책만 박제** 하며 코드를 1 LOC 도 만들지 않는다 … ACCEPTED 승격은 `§ Follow-ups` (a)~(c) 전량 머지 뒤 (d) doc-sync 가 수행한다" 로 남아 있다 → **승격 미안착**.
- REQ-019 — [requirements.md](../requirements.md) `38 행` 이 여전히 `IN_PROGRESS (등급 정의 축 · LLM 산출 축 · 점수 영속 축 실재 / 상향을 결정하는 결정적 식별 축 · 부여 축 부재 …)` 다. 같은 행이 "`algorithm` · `research` 를 판별하는 필드 · 임계 · 분기는 domain 디렉토리 전수에서 0", "5-adjuster 중 상향이 …", "상향의 실 배선은 LLM 경유 경로" 라고 단언하는데 이는 T-1949~T-1954 머지로 **모두 거짓이 됐다** → **재판정 미안착**.
- PLAN `103 행` — 품질 분류 bullet (R-37·38) 의 `implemented-on-main` 서술이 `evaluation-quality-signal.ts` + `applyContributionQualityFloor` (하향 축) 좌표에만 머물러 있고 `git grep -n "ADR-0064" -- docs/PLAN.md` 결과가 **0** 이다 → **갱신 미안착**.
- 반대로 코드 축은 전부 안착 확인 — 파생 신호 [algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) `16 행` `ALGORITHM_RESEARCH_MIN_HITS = 2` · `64 행` `computeAlgorithmResearchHits`, mapper 배선 [confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `109~111 행` · [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `151~153 행`, detection [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `36 행` · `89 행` + [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `131 행` `algorithmResearch: computeAlgorithmResearchSignal(deduped)`, uplift [evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) `44 행` `ALGORITHM_RESEARCH_UPLIFT_LEVEL = "high"` · `87 행` `applyAlgorithmResearchUplift`, 소비 [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `279~283 행` guard · `355~357 행` step (9) · `361 행` flatten. 즉 본 task 는 **문서 잔여분만** 남은 상태다.

오너 게이트 미침범 — PLAN `157 행` (R-91 k6: `test/load` · `package.json` · `ci.yml` 무변경) 을 건드리지 않고, `183 행` once-rule 은 본 task 가 바로 그 규칙이 허용하는 **1 회** 재판정이다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — frontmatter `5 행` `status` · `§ Status` (`15 행`) · `§ Follow-ups` (a)~(d) (`104~109 행` 계열) 3 지점이 승격 대상. `§ Decision 1~4` 는 **읽기만** (결정 내용 변경 금지 — 변경 시 `pr` 로 강등된다).
- [docs/requirements.md](../requirements.md) `38 행` — REQ-019 row (재판정 대상 **단일 행**). 같은 파일 `11~14 행` 의 상태 enum · 재판정 규칙, 그리고 바로 앞 `37 행` REQ-018 · 바로 뒤 `39 행` REQ-020 의 `DONE (implemented-on-main — …)` 서술 형식 (실측 좌표 + 한계 열거) 을 **문체 mirror 정본** 으로 삼는다.
- [docs/PLAN.md](../PLAN.md) `103 행` — 품질 분류 (R-37·38) bullet (서술 갱신 대상). `183 행` = REQ 재판정 once-rule 오너 지시, `157 행` = R-91 k6 오너 지시 (침범 금지 경계).
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `55~62 행` (10-step 목록) · `279~283 행` (guard) · `340~361 행` (step (9) + flatten) — 재판정 문장이 인용할 실측 좌표. **읽기 전용**.
- [src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) `44~123 행` · [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) `36~123 행` — 상향 규칙 · 임계 · throw 계약. **읽기 전용**.
- **직전 동형 선례 (mirror 정본)**: [T-1947](T-1947-adr0063-content-dedup-doc-sync-req009-rejudge.md) — 같은 (d) doc-sync 형식 (ADR 승격 + REQ 재판정 + PLAN bullet) 의 직전 slice. 본 task 는 그 구성을 알고리즘·연구 축으로 그대로 mirror 한다.

## Acceptance Criteria

- [ ] ADR-0064 frontmatter `status: PROPOSED` → `status: ACCEPTED` 로 승격하고, `§ Status` 본문의 "PROPOSED … ACCEPTED 승격은 (d) doc-sync 가 수행한다" 서술을 **머지 완료 사실** 서술로 교체한다 (구현 slice 6 건의 task ID · PR 번호 · commit sha 를 본문에 박제). 검증: `git grep -n "status: ACCEPTED" -- docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 가 1 행, `git grep -cn "PROPOSED" -- docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 가 0 (다른 ADR 을 인용하는 문맥이 남으면 그 행만 예외로 task Follow-ups 에 근거를 적는다).
- [ ] ADR-0064 `§ Follow-ups` (a)~(c) 각 항목에 **머지 완료 표기** (task ID + PR 번호) 를 추가한다. (확장 지점) 항목은 미구현 상태 그대로 둔다.
- [ ] [requirements.md](../requirements.md) `38 행` REQ-019 상태를 `IN_PROGRESS` → `DONE (implemented-on-main — …)` 으로 재판정하고, 판정문에 **실측 좌표** 를 포함한다: (i) 식별 축 = `algorithm-research-signal.ts` `64 행` `computeAlgorithmResearchHits` + `16 행` 임계 2, (ii) mapper 배선 = confluence `109~111 행` · github `151~153 행` (hits 0 이면 키 미포함), (iii) detection 축 = `evaluation-algorithm-research-signal.ts` `89 행` + detection pipeline `131 행` 7 번째 필드, (iv) 부여 축 = `evaluation-algorithm-research-adjust.ts` `44 행` `"high"` · `87 행` `applyAlgorithmResearchUplift`, (v) 배선 축 = adjustments pipeline `355~357 행` step (9) + `279~283 행` guard + orchestrator 경유 본류 연결 (dead code 아님), (vi) 점수 도달 = `evaluation-result.persist.mapper.ts` `147 행` 등간격 매핑 → `contributionScore` 3.
- [ ] 같은 REQ-019 판정문에 **한계** 를 최소 3 건 명시한다 — (1) marker 어휘 밖 표현 미탐 (LLM 축 병행 의존 잔존), (2) 임계 `2` 는 dogfood 실측 없는 v1 baseline, (3) title 축 한정 (본문 · 분량 미반영), (4) 본 축을 cover 하는 e2e / smoke 0. 각 한계는 실측 근거 (파일 · 행 또는 grep 결과) 를 동반한다.
- [ ] 같은 판정문이 **직전 IN_PROGRESS 서술의 거짓이 된 문장** 을 명시적으로 폐기한다 — "식별 축 · 부여 축 부재", "`algorithm` · `research` 매칭 0", "상향의 실 배선은 LLM 경유 경로뿐" 3 건 각각에 반증 좌표를 붙인다.
- [ ] `검증 위치` 컬럼 값 재판정 — 현재 `unit + manual` 의 `unit` 근거를 colocated spec 파일명 + it 개수로 갱신하고 (`algorithm-research-signal.spec.ts` · `evaluation-algorithm-research-signal.spec.ts` · `evaluation-algorithm-research-adjust.spec.ts` · `evaluation-adjustments-pipeline.spec.ts` 의 알고리즘·연구 describe), `manual` 축의 문서화된 절차 유무를 실측해 한계로 남긴다. 컬럼 값 자체를 바꾸는 경우 근거를 판정문에 적는다.
- [ ] [PLAN.md](../PLAN.md) `103 행` 품질 분류 bullet 의 `implemented-on-main` 서술에 **R-38 상향 축** 을 추가한다 — ADR-0064 링크 + 파생 신호 · detection · uplift · step (9) 4 좌표 + 구현 slice ID (T-1949~T-1954). 기존 R-37 하향 축 서술은 보존하고 `[x]` 마커는 그대로 둔다.
- [ ] 문서 3 개의 상호 참조가 끊기지 않는다 — 상대 경로 링크가 실재 파일을 가리키고, 행 번호 표기가 CLAUDE.md `§ 12` 표기 규칙 (`38 행` / `109~111 행`, `L` prefix 금지) 을 따른다.
- [ ] `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경 **0** — 검증: `git diff --name-only origin/main` 결과가 `docs/` 이하 파일뿐 (본 task 의 STATE · journal bookkeeping 제외).
- [ ] R-110 면제 근거 명시 — 본 task 는 doc-only `direct` commit 이라 tester 호출이 면제된다 (CLAUDE.md `§ 3.2` R-110 마지막 문장). 코드 0 LOC 이므로 R-112 의 4 축 (happy-path / error path / 분기별 / negative) 은 **본 task 에 적용되지 않으며** 그 책임은 이미 머지된 (a)~(c) slice 의 colocated spec 이 진다 — 신규 spec 0 이 정당함을 task Follow-ups 에 한 줄로 기록한다. **분기 없음 — 분기별 test 항목 생략**.

## Out of Scope

- ADR-0064 `§ Decision 1~4` 의 **결정 내용 변경** (임계 · marker 어휘 · document kind 한정 · `"zero"` floor 우선 규칙) — 결정 변경은 CLAUDE.md `§ 3.1` 상 `pr` 대상이라 본 direct task 가 하면 mode 위반이다. 필요 시 후속 ADR.
- `src/` 주석 정정 — [evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) · [evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `2~3 행` 의 `REQ-037 / REQ-038` 오기 (README 행 번호를 REQ ID 로 적은 drift) 는 ADR-0064 `§ Consequences` 가 범위 밖으로 명시했고 `src/` 변경이라 `pr` 이다 → Follow-ups 로만.
- narrative marker 접두 (`[연구소개] ` 계열) · marker 어휘 운영 설정화 · 본문 축 편입 — ADR-0064 `§ Follow-ups (확장 지점)` 이 후속 ADR 선행을 요구한다.
- REQ-019 외 다른 REQ row 재판정 (REQ-018 · REQ-020 · REQ-032 등) — once-rule 상 REQ 당 1 회이며 본 task 는 REQ-019 **1 건만** 다룬다. REQ-032 는 `coversReq` 에만 들어가고 (raw 미저장 불변 유지 확인 축) row 재판정 대상이 아니다.
- [docs/architecture/modules.md](../architecture/modules.md) · [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 갱신 — ADR-0064 `§ Follow-ups (d)` 가 열거한 3 지점 밖이고 파일 수 cap 여유를 소진한다 → 필요 시 Follow-ups.
- 새 ADR 신설 · schema · migration · 새 dependency · e2e · smoke spec 일체.

## Suggested Sub-agents

`implementer` (doc-only — tester 는 R-110 면제 대상, direct commit 이라 reviewer · integrator 도 비경유)

## Follow-ups

- **R-110 / R-112 면제 근거** — 본 task 는 doc-only `direct` commit 이라 tester 호출이 면제되고 (CLAUDE.md `§ 3.2` R-110 마지막 문장), production code 0 LOC 이므로 R-112 의 4 축 (happy-path / error path / 분기별 / negative) 은 본 task 에 적용되지 않는다. **신규 spec 0 이 정당** 하며 그 책임은 이미 머지된 (a)~(c) slice 의 colocated spec 6 종이 진다 (`algorithm-research-signal.spec.ts` · 두 mapper spec 의 `algorithmResearchHits 배선` describe · `evaluation-algorithm-research-signal.spec.ts` · `evaluation-algorithm-research-adjust.spec.ts` · `evaluation-adjustments-pipeline.spec.ts` 997 행 describe). 분기 없음 — 분기별 test 항목 생략.
- **(신규) 상향 건수 관측 로그 slice** — ADR-0064 `§ Consequences` 오탐 완화 (iv) 와 `§ Follow-ups` (c) 가 예고한 **상향 건수 관측 로그가 미착수** 다 (`evaluation-adjustments-pipeline.ts` · `evaluation-algorithm-research-adjust.ts` 전수에 `Logger` · `console` 참조 0). 과잉 발동을 수치로 인지할 경로가 없으므로 `pr` slice 1 건으로 이월한다 — 선례는 ADR-0063 `§ Follow-ups` (c) (T-1946, PR #1528).
- **`src/` 주석 REQ 오기 정정** — `evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` `2~3 행` 의 `REQ-037 / REQ-038` 은 README 행 번호 (`R-37 / R-38`) 를 REQ ID 로 적은 drift 다. ADR-0064 `§ Consequences` 가 범위 밖으로 명시했고 `src/` 변경이라 `pr` mode → 별도 slice.
- **GitHub 축 kind 한정 재검토** — `github-activity.mapper.ts` `150 행` `if (kind === "issue")` 로 파생 신호가 issue 단위에만 산출된다. PR 본문형 소개 자료는 구조적으로 미탐이며, 대상 확대는 ADR-0064 `§ Decision 2` 개정 (후속 ADR) 선행이 필요하다.
- **두 임계 상수 drift 여지** — 수집 `ALGORITHM_RESEARCH_MIN_HITS` (`16 행`) 와 평가 `ALGORITHM_RESEARCH_UPLIFT_MIN_HITS` (`36 행`) 는 layer 분리 목적으로 독립 소유돼 한쪽만 바뀌어도 컴파일이 깨지지 않는다. dogfood calibration 시 동시 갱신 규약 · drift-guard spec 을 함께 검토한다.
- **`docs/architecture/modules.md` · `REQ-COVERAGE-AUDIT.md` 반영** — ADR-0064 `§ Follow-ups` (d) 의 3 지점 밖이라 본 task 범위에서 제외했다. 알고리즘·연구 축 4 파일 신설분의 module 인덱스 등재는 별도 `direct` slice 로.
