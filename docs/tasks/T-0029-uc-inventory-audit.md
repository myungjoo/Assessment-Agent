---
id: T-0029
title: P2 Use case 인벤토리 검증 — requirements.md 의 모든 functional REQ ↔ UC cover audit
phase: P2
status: PENDING
commitMode: pr
coversReq: [TBD]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-05-25
plannerNote: P2 Use case 인벤토리 검증 — 66 REQ 중 FR 행이 1+ UC 로 cover 되는지 audit. P2 첫 bullet의 마지막 sub-task. gap 발견 시 follow-up task 생성.
dependsOn: [T-0019, T-0028]
blocks: []
hqOrigin: null
---

# T-0029 — P2 Use case 인벤토리 검증 (REQ ↔ UC coverage audit)

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 세 entry artifact 중 **첫 번째 — "Use case 인벤토리 검증"** ([PLAN.md](../PLAN.md) L45) 를 본 task 가 cover 한다. P2 의 핵심 backbone — [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 8 UC ([T-0019](T-0019-p2-entry-use-case-index.md) PR-18 머지) + UC-01 ~ UC-08 본문 8/8 closure ([T-0020](T-0020-uc-01-evaluation-execution.md) / [T-0022](T-0022-uc-02-evaluation-query.md) / [T-0023](T-0023-uc-03-person-crud.md) / [T-0024](T-0024-uc-04-account-auth.md) / [T-0025](T-0025-uc-05-llm-config.md) / [T-0026](T-0026-uc-06-evaluation-delete-reeval.md) / [T-0027](T-0027-uc-07-export-import.md) / [T-0028](T-0028-uc-08-permission-denied.md) PR-27 머지 db65dd7) — 가 모두 완성된 시점이다. **본 task 는 8 UC 가 [requirements.md](../requirements.md) 의 모든 functional REQ 를 빠짐없이 cover 하는지 audit 한다**.

본 task 의 본질: **gap detection — 빠진 functional REQ 가 있다면 9 번째 UC 가 필요하거나 기존 UC 본문의 확장이 필요**하다. 이 검증을 통과해야 P2 의 후속 artifact (api.md / data-model.md) 가 UC 들을 frontend 로 삼아 안전하게 진행될 수 있다. UC backbone 이 functional REQ 의 superset 임을 박제하지 않으면, api.md / data-model.md 가 어떤 REQ 의 endpoint·entity 를 빠뜨릴 위험이 존재.

본 task 는 또한 **non-functional REQ (NFR) / Constraint REQ 의 처리 정책 박제** 도 겸한다. README 의 latency / 권한 / 보안 / stack 같은 REQ 는 단일 UC 로 cover 하기보다 **cross-cutting (여러 UC 가 공유)** 또는 **infrastructure level (UC 영역 밖 — CI / ADR / 운영 정책)** 에서 cover 된다. audit document 가 이 분류를 명시해야 "UC 로 cover 안 됨" ≠ "gap" 임이 명확.

산출물: (1) audit document 1 파일 (`docs/use-cases/REQ-COVERAGE-AUDIT.md`) — 66 REQ × UC 매트릭스 표 + gap 분석 + NFR/Constraint 처리 정책 박제, (2) INDEX.md 의 갱신 룰 §5 또는 §1 끝에 audit document 참조 1 줄 추가 + Refs 라인의 끝에 `T-0029` 추가, (3) PLAN.md 의 P2 셋째 bullet (`Use case 인벤토리 검증`) 옆에 closure marker + audit doc link inline append + `[ ]` → `[x]` 전환.

본 task 는 doc-only 이지만 새 파일 신설 (`REQ-COVERAGE-AUDIT.md`) 을 포함하므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/use-cases/* 추가도 reviewer 점검 대상 + audit 결과의 architectural 박제 가치).

**gap 발견 시 정책**: audit 표에 `gap` row 가 1+ 발견되면 본 task 가 직접 use case 를 신설하지 않는다. 대신 본 task 의 산출물 audit document 가 `## gap follow-up` 단락에서 각 gap 별로 (a) 권장 처리 — 새 UC-09 신설 또는 기존 UC-NN 본문 확장 — (b) 권장 REQ 묶음 — 을 명시. 후속 planner 호출이 본 단락을 읽어 별도 task (T-0030+) 를 생성. **본 task scope 는 audit 자체 + gap 발견 시 follow-up 권장 박제만**.

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 셋째 bullet "Use case 인벤토리 검증" 의 cover. PLAN.md commit 98ace27 refactor 이후 P2 단락 L-number 사용)
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — 8 UC backbone 표 + 각 UC 의 `관련 REQ` 컬럼 (audit 의 1차 source) + 8/8 closure 박제 확인
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) ~ [docs/use-cases/UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md) — 8 UC 본문 (각 frontmatter 의 `coversReq` + `adjacentReq` 가 audit 의 2차 source — INDEX.md 의 `관련 REQ` 컬럼보다 풍부할 수 있음)
- [docs/requirements.md](../requirements.md) — **본 task 의 핵심 source**. 66 REQ row 의 `kind` 컬럼 (FR / NFR / Constraint) + README 행 + 요약 + 구현 위치 + 검증 위치 + 상태 컬럼 모두 사용
- [README.md](../../README.md) L9-103 — functional REQ 의 source. INDEX.md / UC 본문 cross-reference 시 사용 (이미 requirements.md 에 박제됐으므로 본 task 는 requirements.md 만 직접 사용해도 충분 — README 는 ambiguity 발생 시 fallback)
- [docs/architecture/components.md](../architecture/components.md) — NFR / Constraint REQ 의 cross-cutting cover 위치 박제 시 참조 (예: REQ-048 latency 는 components.md §NFR 또는 deployment.md 에서 cover)
- [docs/architecture/modules.md](../architecture/modules.md) — module level NFR cover 박제 시 참조
- [docs/architecture/deployment.md](../architecture/deployment.md) — operational NFR / Constraint cover 위치 (예: REQ-091 latency 는 deployment.md 의 SLA section)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) ~ [ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Constraint REQ (stack / DB / deployment) 의 cover 위치
- [docs/tasks/T-0028-uc-08-permission-denied.md](T-0028-uc-08-permission-denied.md) — 직전 UC task (template / Acceptance Criteria pattern / Out of Scope 분리 style 참고)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — MVA 원칙 + style 참고

## Acceptance Criteria

### 1. audit document 신설 — `docs/use-cases/REQ-COVERAGE-AUDIT.md`

- [ ] `docs/use-cases/REQ-COVERAGE-AUDIT.md` 신설. 한국어 본문 ≥ 80 줄 / ≤ 180 줄 (audit 결과의 합리적 길이 — 66 REQ × audit row + section 별 요약 + gap follow-up). 다음 section 을 본 순서로 포함:
  - **Frontmatter** (한국어 본문 + 영어 키): `id: REQ-COVERAGE-AUDIT`, `title: P2 Use case 인벤토리 검증 — requirements.md ↔ UC backbone audit`, `status: DONE` (audit 자체는 본 task 머지 시 완료 상태), `coversPlanBullet: "P2 셋째 bullet — Use case 인벤토리 검증"`, `sourceTask: T-0029`, `auditDate: 2026-05-25`.
  - **1. 개요** — 1~2 단락. audit 의 목적 (gap 검출 — 8 UC 가 functional REQ 의 superset 임을 박제) + 범위 (66 REQ 모두) + 정책 (NFR / Constraint 는 UC cover 가 아니라 cross-cutting / infrastructure 에서 cover — 별도 분류) + 결론 요약 (1 줄 — "gap 0 건" 또는 "gap N 건 — follow-up section 참조").
  - **2. 분류 정책** — REQ 의 cover 방식을 다음 4 enum 으로 분류:
    - **`uc-covered`** — 1+ UC 의 `coversReq` 또는 `adjacentReq` frontmatter 에 명시됨. INDEX.md `관련 REQ` 컬럼이 superset.
    - **`cross-cutting`** — NFR (latency / 권한 / 보안) 처럼 다수 UC 가 공유. INDEX.md 의 한 UC 에 박제하지 않고 architecture document (components.md / modules.md / deployment.md) 또는 ADR 에서 cover. 본 task 가 cover 위치를 박제.
    - **`infrastructure`** — Constraint (stack / CI / 운영 정책) — UC 영역 밖. ADR 또는 CLAUDE.md / LOOP.md 또는 `.github/workflows/ci.yml` 또는 PLAN.md 의 운영 정책 backlog 에서 cover.
    - **`gap`** — 1+ UC 에 cover 안 됐고, cross-cutting 도 아니고, infrastructure 도 아닌 functional REQ. **본 task 의 검출 대상**.
  - **3. audit 매트릭스** — 66 REQ × audit row 표. 5 컬럼:
    - **REQ ID** (REQ-001 ~ REQ-066 — requirements.md 의 모든 row)
    - **kind** (requirements.md 의 `kind` 컬럼 그대로 — FR / NFR / Constraint)
    - **cover 방식** (위 §2 의 4 enum 중 1)
    - **cover 위치** (uc-covered 면 UC-NN 또는 UC-NN+UC-MM / cross-cutting 면 architecture doc 경로 / infrastructure 면 ADR 또는 정책 파일 경로 / gap 이면 "—")
    - **참고** (한국어 1 줄 — 인용 위치 또는 보완 노트)
  - **4. UC 별 REQ cover 요약** — 각 UC 가 cover 하는 REQ 의 ID list (INDEX.md 의 `관련 REQ` 컬럼 + UC 본문 frontmatter `coversReq` 의 union — INDEX.md 가 subset 인 경우 본문 frontmatter 가 우선). 8 UC × 1 단락. 본 단락이 audit 의 reverse-direction view (UC → REQ).
  - **5. 분류별 요약 통계** — 4 enum 별로 REQ count + percentage + 한국어 1 줄 요약. 예시: `uc-covered: NN/66 (XX%)`, `cross-cutting: NN/66 (YY%)`, `infrastructure: NN/66 (ZZ%)`, `gap: NN/66 (WW%)`. 본 통계가 audit 의 quantitative summary.
  - **6. gap follow-up** — `gap` 분류된 REQ 가 1+ 있으면 본 단락에 각 REQ 별로:
    - **REQ ID + 요약** (requirements.md 의 row).
    - **권장 처리** — (a) **새 UC 신설** (UC-09 등 — 권장 title + actor + trigger + 거치는 component / module) 또는 (b) **기존 UC-NN 본문 확장** (어느 UC 의 어느 section 에 어떤 흐름을 추가).
    - **권장 REQ 묶음** — 본 gap REQ 와 함께 1+ 다른 gap REQ 를 같은 use case 로 묶을 수 있다면 그 묶음.
    - **추정 task 규모** — 본 task 시점에서는 conceptual 추정 (예: "T-0028 와 동급, ≤180 LOC, frontmatter + 11 section").
    - gap 이 0 건이면 본 §6 단락은 `**gap 0 건 — P2 첫 bullet closure 안전**` 한 줄로 마감.
  - **7. NFR / Constraint cross-cutting 처리 박제** — `cross-cutting` 분류 REQ + `infrastructure` 분류 REQ 의 cover 위치가 architecture document 또는 ADR 에 실제로 박제됐는지 spot check. 1+ 누락 발견 시 follow-up note 1 줄 (단 본 task scope 밖 — 별도 task 권장).
  - **8. 결론** — 본 audit 의 verdict 1 단락. P2 셋째 bullet closure 가능 여부 + 후속 P2 artifact (api.md / data-model.md) 진행 가능 여부 + gap follow-up task 권장 (있다면).
  - **9. References** — INDEX.md / 8 UC 본문 / requirements.md / PLAN.md / architecture 3 doc / ADR-0001 ~ ADR-0003 / 본 task 파일 링크.

### 2. INDEX.md 갱신 — audit document 참조 박제

- [ ] [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 갱신 룰 §5 또는 §1 의 끝에 audit document 의 참조 1 줄 추가 — "본 INDEX.md 의 UC backbone 의 REQ cover 완전성은 [REQ-COVERAGE-AUDIT.md](REQ-COVERAGE-AUDIT.md) ([T-0029](../tasks/T-0029-uc-inventory-audit.md)) 에서 audit 됨" 의 의미가 한 줄로 들어가도록. 정확 위치는 implementer 판단.
- [ ] INDEX.md 의 Refs 라인 끝에 `T-0029` 추가.

### 3. PLAN.md 갱신 — P2 셋째 bullet closure marker

- [ ] [docs/PLAN.md](../PLAN.md) 의 P2 셋째 bullet "Use case 인벤토리 검증" 의 `[ ]` 을 `[x]` 로 전환 + bullet 본문에 "[REQ-COVERAGE-AUDIT.md](use-cases/REQ-COVERAGE-AUDIT.md) ([T-0029](tasks/T-0029-uc-inventory-audit.md)) 완료 — gap N 건" (N 은 actual count) inline append.
- [ ] gap 1+ 발견 시 P2 셋째 bullet 본문 끝에 "(follow-up task 권장 — REQ-NNN ... cover 미흡)" 한 줄 추가. gap 0 건 시 "(gap 0 건 — P2 첫 bullet 완전 closure)" 한 줄 추가.

### 4. audit 검증 — REQ 6 6개 row 빠짐없이 처리

- [ ] §3 매트릭스 표의 REQ row 수 정확히 66 (requirements.md 의 row 수와 일치). 누락 REQ 0 — implementer 가 `grep -c "^| REQ-" docs/requirements.md` 로 검증.
- [ ] 각 row 의 `cover 방식` 컬럼이 §2 의 4 enum 중 정확히 1 — 미정 / 빈 셀 0.
- [ ] §4 의 UC 별 cover list 가 INDEX.md `관련 REQ` 컬럼 + UC 본문 frontmatter `coversReq` 의 union 과 정합 — 누락 REQ 0.
- [ ] §5 의 4 enum count 의 합 = 66 — 검산.

### 5. Test / build 검증 (R-110 active)

- [ ] tester 가 `pnpm lint` 통과 확인 (production code 0 LOC, Windows-CRLF lint baseline 동일).
- [ ] tester 가 `pnpm build` 통과 확인 (production code 0 LOC, build 영향 없음 — sanity).
- [ ] tester 가 `pnpm test` 통과 확인 (production code 0 LOC, test 영향 없음 — sanity).
- [ ] R-112 의 4 항목 (happy / error / branch / negative): **본 task 는 production code 0 LOC + 분기 0 + 새 public symbol 0** 이므로 unit test 추가 의무 없음 — task 본문에 "분기 없음 / public symbol 추가 없음 — R-112 항목 4종 모두 N/A" 명시 (CLAUDE.md §3.2 R-112 의 "분기 없음 — 이 항목 생략" 룰 적용, T-0020 ~ T-0028 동일 처리).

### 6. 크기 제한 / 보안 / 의존성

- [ ] production code 0 LOC, 새 dependency 0 (CLAUDE.md §5 BLOCKED 조건 회피).
- [ ] estimatedDiff 110 LOC / estimatedFiles 3 — CLAUDE.md §3 size cap (≤300 LOC / ≤5 파일) 안. UC-NN 본문 task 보다 작음 (UC 본문은 frontmatter + 11 section + mermaid, audit 은 표 + gap follow-up 중심).
- [ ] 변경 파일: `docs/use-cases/REQ-COVERAGE-AUDIT.md` (신설) + `docs/use-cases/INDEX.md` (audit 참조 1 줄 + Refs T-0029) + `docs/PLAN.md` (P2 셋째 bullet `[ ]` → `[x]` + closure marker) = 3 파일.

### 7. Reviewer / Integrator 합의 (§3.3 4-gate)

- [ ] reviewer round 1+ APPROVE verdict + `gh pr comment` 외화 (driver 가 직접 dispatch — Agent tool runtime cache 결함 패턴 재현 대비, T-0019~T-0028 표준 절차).
- [ ] CI green (lint + build + test + reviewer-approval step). 1차 fail 시 `gh run rerun --failed` 표준 절차 적용 (9번 dogfood 검증된 pattern).
- [ ] integrator 의 자체 점검 (Acceptance Criteria / Out of Scope / 신규 dependency / size cap) 통과.
- [ ] `gh pr merge --squash --delete-branch` 성공.
- [ ] **본 task 머지 시 P2 첫 bullet (Use case 발굴 + 인벤토리 검증) 완전 closure 달성** — driver / integrator 가 STATE.json 의 `phase` 갱신 시 audit 결과 반영 (정확 enum 은 driver 결정).

## Out of Scope

본 task 는 audit document 신설 + INDEX.md / PLAN.md 갱신만 수행. 다음은 별도 task:

- **gap follow-up UC 신설 또는 기존 UC 확장** — audit §6 가 gap REQ 와 권장 처리를 박제하나, 실제 UC 신설 / 본문 확장은 후속 task (T-0030+) 의 책임. 본 task 는 audit + 권장 박제만.
- **api.md 신설** — P2 의 별도 entry artifact. 본 audit 가 통과한 후 안전하게 진행. 본 task scope 밖.
- **data-model.md 신설** — P2 의 별도 entry artifact. 본 audit 가 통과한 후 안전하게 진행. 본 task scope 밖.
- **NFR / Constraint REQ 의 cross-cutting / infrastructure cover 위치 박제 개선** — audit §7 가 spot check 만 수행. cover 위치가 실제로 누락된 경우 별도 task (architecture document 갱신 또는 ADR 신설) 권장. 본 task 는 발견 + 1 줄 노트만.
- **requirements.md 의 `구현 위치` / `검증 위치` 컬럼 갱신** — audit 결과 (예: REQ-NNN 이 UC-MM 에서 cover) 를 requirements.md 의 row 에 역전파하는 작업. 별도 task (T-0030+) 또는 후속 P3 task 에서 자연 갱신. 본 task 는 audit document 중심.
- **README 의 ambiguity 발견 처리** — audit 중 README 의 ambiguous 지시 발견 시 humanQuestion 신설 권장. 본 task 가 직접 신설하지 않고 audit document 의 footnote 로 박제 — driver 가 본 task 머지 후 humanQuestion 검토.
- **8 UC 본문의 sequence diagram / Acceptance Criteria 갱신** — audit 가 발견한 누락 REQ 를 기존 UC 본문에 추가하는 작업. 별도 task (T-0030+).
- **PLAN.md 셋째 bullet 외 P2 bullet 의 처리** — 넷째 bullet (api.md) / 다섯째 bullet (data-model.md) 은 별도 task. 본 task 는 셋째 bullet 만.
- **T-0017~T-0028 review 의 MINOR follow-up 들** — 본 task scope 밖.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect**: 4 분류 enum (uc-covered / cross-cutting / infrastructure / gap) 의 정확 정의 + 각 REQ 의 분류 판정 + gap REQ 발견 시 권장 처리 (새 UC vs 기존 UC 확장) + cross-cutting / infrastructure REQ 의 cover 위치 (architecture doc / ADR / 운영 정책) 결정. 8 UC 본문의 `coversReq` + `adjacentReq` frontmatter union 추출 + INDEX.md `관련 REQ` 컬럼과 비교 + requirements.md 66 REQ 와 cross-reference. 산출물: REQ-COVERAGE-AUDIT.md 의 outline (section 별 한 줄 요약 + §3 매트릭스 의 row 별 분류 판정 + §5 enum 별 count 추정 + §6 gap follow-up 권장).
- **implementer**: architect 의 outline 을 따라 REQ-COVERAGE-AUDIT.md 신설 + INDEX.md / PLAN.md 갱신. §3 매트릭스 의 66 row 빠짐없이 작성 (REQ ID 순서). §4 의 UC 별 cover list 정확 작성. §5 의 count 검산 (합 = 66). §6 의 gap follow-up 명시. PLAN.md L-number 는 commit 98ace27 refactor 이후 변경된 최신 값 사용.
- **tester**: `pnpm lint && pnpm build && pnpm test` 통과 확인 (production code 0 LOC sanity). audit 표의 66 row count 검증 (`grep -c "^| REQ-" docs/use-cases/REQ-COVERAGE-AUDIT.md` ≥ 66). §5 의 4 enum count 합 = 66 검산. INDEX.md ↔ REQ-COVERAGE-AUDIT.md ↔ PLAN.md ↔ requirements.md ↔ 8 UC 본문 간 link 무결성 확인.

## Follow-ups

(생성 시점 공란. sub-agent / reviewer 가 발견 시 append.)
