---
id: T-1327
title: UC-01 ~ UC-05 §5 step 수 선언을 실측(11 / 11 / 10 / 10 / 11)으로 정합 + arrow-only 계수 기준 통일
phase: P5
status: DONE
completedAt: 2026-07-30T16:41:07Z
resultCommit: 6bd51d76
commitMode: direct
coversReq: [REQ-039, REQ-042, REQ-023, REQ-044, REQ-050]
estimatedDiff: 10
estimatedFiles: 5
created: 2026-07-30
independentStream: uc-step-count-realign
dependsOn: [T-1326]
touchesFiles:
  - docs/use-cases/UC-01-evaluation-execution.md
  - docs/use-cases/UC-02-evaluation-query.md
  - docs/use-cases/UC-03-person-crud.md
  - docs/use-cases/UC-04-account-auth.md
  - docs/use-cases/UC-05-llm-config.md
plannerNote: "T-1326 이 Out of Scope 로 넘긴 UC-01~UC-05 off-by-N 5 건 마감 — 선언만 실측에 맞춤. direct doc-only, 10 LOC / 5 파일"
---

# T-1327 — UC-01 ~ UC-05 §5 step 수 선언을 실측(11 / 11 / 10 / 10 / 11)으로 정합 + arrow-only 계수 기준 통일

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 에서 **arrow 만 계수하고 `Note over ...` 는 제외** 라는 계수 기준을 확정했고, [T-1326](T-1326-uc06-uc08-step-count-realign.md) 이 그 기준으로 UC-06(13→12) · UC-08(14→16) 을 마감하면서 **UC-01 ~ UC-05 의 같은 drift 5 건을 명시적으로 Out of Scope 로 넘겼다** (T-1326 61 행). 본 task 가 그 잔여 5 건을 닫아 `docs/use-cases/UC-01` ~ `UC-08` 8 개 use-case 의 §5 step 수 선언이 전부 실측과 일치하는 상태로 수렴시킨다.

문서가 스스로 밝힌 step 수가 실제 다이어그램과 어긋나면 다른 문서 · 코드 주석의 `§5 step N` 참조 판정이 다시 흔들린다 (T-1317~T-1324 sweep 9 slice 를 낳은 원인). 본 5 건의 drift 원인은 **`Note` 만 든 alt block 분기를 step 으로 세었기 때문** 이며 (아래 실측표), 이는 UC-06 · UC-08 의 "`Note` 포함" 서술 모순과 같은 뿌리다.

PLAN P5 잔여 3 항목 중 line 108(live-LLM 재검증) · line 109(실 github 데이터 e2e) 는 credential / 사람-승인 게이트, line 106(재실행 · 부분 reset) 은 대형 chain 이라 cap 내 1-task 로 부적합해 본 문서 정합 항목을 선택했다 (T-1325 · T-1326 과 동일 판단).

## Required Reading

- `docs/use-cases/UC-01-evaluation-execution.md` — 53~90 행 §5 mermaid(참조용, 무변경) + **92 행 = 수정 대상 줄**
- `docs/use-cases/UC-02-evaluation-query.md` — 52~81 행 mermaid + **83 행 = 수정 대상 줄**
- `docs/use-cases/UC-03-person-crud.md` — 54~88 행 mermaid + **90 행 = 수정 대상 줄**
- `docs/use-cases/UC-04-account-auth.md` — 54~90 행 mermaid + **92 행 = 수정 대상 줄**
- `docs/use-cases/UC-05-llm-config.md` — 55~90 행 mermaid + **92 행 = 수정 대상 줄**
- `docs/use-cases/UC-06-evaluation-delete-reeval.md` 95 행 · `docs/use-cases/UC-08-permission-denied.md` 105 행 — **문장 형태 선례** (실측 선언 → 계수 기준 명시 → 자기점검 범위 판정 → 기존 뒷문장 보존). 읽어서 형태만 따르고 두 파일은 1 줄도 고치지 않는다.

**planner 실측 확정 (executor 재계수 · 재판정 불요)** — origin/main `0694d4f6` 기준, 각 파일의 유일한 ` ```mermaid ` 블록 안에서 `->>` / `-->>` 를 센 값:

| 파일 | 현 선언 | arrow 실측 | `Note over` | alt / par block 안의 arrow | P2 자기점검 범위 (출처) | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| UC-01 | 약 13 | **11** | 4 | alt `cron / manual` 2 개 + par `3 GitHub instance 수집` 3 개 | `10 이상 18 이하` ([T-0020](T-0020-uc-01-evaluation-execution.md) 92 행) | 범위 안 |
| UC-02 | 약 12 | **11** | 3 | alt `AssessmentRun.status = 'RUNNING'` → **0 개** (내부가 Note 1 개뿐) | `8 이상 14 이하` ([T-0022](T-0022-uc-02-evaluation-query.md) 89 행) | 범위 안 |
| UC-03 | 약 11 | **10** | 4 | alt 2 개 중 `신규 인원 추가 성공` 1 개 / `검증 실패` **0 개** | `8 이상 14 이하` ([T-0023](T-0023-uc-03-person-crud.md) 91 행) | 범위 안 |
| UC-04 | 약 11 | **10** | 6 | alt 2 개(`검증 실패` / `첫 로긴 trigger`) 둘 다 **0 개** | `8 이상 14 이하` ([T-0024](T-0024-uc-04-account-auth.md) 88 행) | 범위 안 |
| UC-05 | 약 12 | **11** | 4 | alt 2 개 중 `provider 추가·수정 + health check 옵션` 2 개 / `검증 실패` **0 개** | `8 이상 14 이하` ([T-0025](T-0025-uc-05-llm-config.md) 94 행) | 범위 안 |

5 건 모두 자기점검 범위 **안** 이라 UC-07 · UC-08 처럼 "범위 초과 사실 기재" 절은 필요 없다.

## Acceptance Criteria

각 파일에서 **`step 수: 약 N (autonumber 기준 — … )` 한 문장만** 아래 정본 문장으로 교체한다. 같은 줄의 뒤 문장(`본 다이어그램은 …` 이후 전체, UC-01 은 `각 step 의 라벨은 …` 부터 전체)은 **글자 그대로 보존**한다.

- [ ] **UC-01 92 행** — `step 수: 약 13 (autonumber 기준 — par/alt block 안의 호출 포함).` 를 다음으로 교체:
      `step 수 11 (autonumber 기준 — [UC-07](UC-07-export-import.md) §5 103 행 규약과 같은 기준으로 **arrow 만 계수하고 `Note over ...` 는 계수 대상에서 제외한다**; trigger 분기 alt block [cron / manual] 의 arrow 2 개와 3 GitHub instance 수집 par block 의 arrow 3 개는 모두 계수에 들어간다). 이는 [T-0020](../tasks/T-0020-uc-01-evaluation-execution.md) 92 행의 P2 자기점검 범위 `10 이상 18 이하` **안** 이다.`
      → 뒤이어 오는 `각 step 의 라벨은 한국어 + 관련 REQ ID 인라인 인용. 본 다이어그램은 …` 는 그대로 둔다.
- [ ] **UC-02 83 행** — `step 수: 약 12 (autonumber 기준 — alt block 안의 분기 포함).` 를 다음으로 교체:
      `step 수 11 (autonumber 기준 — [UC-07](UC-07-export-import.md) §5 103 행 규약과 같은 기준으로 **arrow 만 계수하고 `Note over ...` 는 계수 대상에서 제외한다**; `AssessmentRun.status = 'RUNNING'` alt block 은 내부가 Note 1 개뿐이라 계수에 더해지는 arrow 가 없다). 이는 [T-0022](../tasks/T-0022-uc-02-evaluation-query.md) 89 행의 P2 자기점검 범위 `8 이상 14 이하` **안** 이다.`
- [ ] **UC-03 90 행** — `step 수: 약 11 (autonumber 기준 — alt block 안의 분기 포함, 8 ≤ 11 ≤ 14 범위 안).` 를 다음으로 교체:
      `step 수 10 (autonumber 기준 — [UC-07](UC-07-export-import.md) §5 103 행 규약과 같은 기준으로 **arrow 만 계수하고 `Note over ...` 는 계수 대상에서 제외한다**; alt block 2 개 중 `신규 인원 추가 성공` 만 arrow 1 개를 더하고 `검증 실패` 는 내부가 Note 뿐이라 0 개다). 이는 [T-0023](../tasks/T-0023-uc-03-person-crud.md) 91 행의 P2 자기점검 범위 `8 이상 14 이하` **안** 이다.`
- [ ] **UC-04 92 행** — `step 수: 약 11 (autonumber 기준 — alt block 안의 분기 포함, 8 ≤ 11 ≤ 14 범위 안).` 를 다음으로 교체:
      `step 수 10 (autonumber 기준 — [UC-07](UC-07-export-import.md) §5 103 행 규약과 같은 기준으로 **arrow 만 계수하고 `Note over ...` 는 계수 대상에서 제외한다**; alt block 2 개 [`검증 실패` / `첫 로긴 trigger`] 는 둘 다 내부가 Note 뿐이라 계수에 더해지는 arrow 가 없다). 이는 [T-0024](../tasks/T-0024-uc-04-account-auth.md) 88 행의 P2 자기점검 범위 `8 이상 14 이하` **안** 이다.`
- [ ] **UC-05 92 행** — `step 수: 약 12 (autonumber 기준 — 2 alt block 분기 포함, 8 ≤ 12 ≤ 14 범위 안).` 를 다음으로 교체:
      `step 수 11 (autonumber 기준 — [UC-07](UC-07-export-import.md) §5 103 행 규약과 같은 기준으로 **arrow 만 계수하고 `Note over ...` 는 계수 대상에서 제외한다**; alt block 2 개 중 `provider 추가·수정 + health check 옵션` 만 arrow 2 개를 더하고 `검증 실패` 는 내부가 Note 뿐이라 0 개다). 이는 [T-0025](../tasks/T-0025-uc-05-llm-config.md) 94 행의 P2 자기점검 범위 `8 이상 14 이하` **안** 이다.`
- [ ] **mermaid 무변경** — 5 개 파일의 ` ```mermaid ` 블록(참여자 선언 · arrow · `Note over` · alt / par block)을 **1 줄도 바꾸지 않는다**. arrow 를 추가 · 삭제해 선언에 맞추는 방향은 명시적 금지 — **선언을 실측에 맞춘다**.
- [ ] **검증 grep** (편집 후 실행, 기대값은 planner 실측 확정분):
  - `grep -c -- "->>" docs/use-cases/UC-01-evaluation-execution.md` → **11**, UC-02 → **11**, UC-03 → **10**, UC-04 → **10**, UC-05 → **11** (mermaid 무변경 확인)
  - `grep -c "step 수: 약" docs/use-cases/UC-0[1-5]*.md` → 5 파일 모두 **0**
  - `grep -c "step 수 11" UC-01` → **1**, `"step 수 11"` UC-02 → **1**, `"step 수 10"` UC-03 → **1**, `"step 수 10"` UC-04 → **1**, `"step 수 11"` UC-05 → **1**
  - `grep -c "본 다이어그램" docs/use-cases/UC-0[1-5]*.md` → 5 파일 모두 **1** (뒤 문장 보존 확인)
  - `grep -c "각 step 의 라벨은" docs/use-cases/UC-01-evaluation-execution.md` → **1** (UC-01 중간 문장 보존 확인)
- [ ] **5 파일 게이트** — `git diff --stat` 결과가 위 5 개 use-case 파일뿐이고 파일당 삭제 1 줄 · 추가 1 줄(합계 ≈ +5/-5)여야 한다. `src/` · `test/` · `web/` · UC-06 · UC-07 · UC-08 · `docs/architecture/*` 는 **1 줄도 건드리지 않는다**.
- [ ] **R-112 대체 검증** — 본 task 는 `commitMode: direct` 문서 전용 변경이라 **신규 public symbol 0 · 신규 분기 0 · production 코드 0 LOC** 이므로 happy-path / error path / 분기 / negative cases 각각에 대응하는 신규 test 대상이 **없다** ([T-1316](T-1316-uc07-step-count-and-mapping-table.md) · [T-1325](T-1325-uc07-transitional-step-mapping-table-removal.md) · [T-1326](T-1326-uc06-uc08-step-count-realign.md) 선례). 대신 다음으로 대체한다:
  - `pnpm lint && pnpm build` 통과 (문서 변경이라 영향 0 이어야 한다)
  - `pnpm test` 전량 통과 · `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 기존 spec 무회귀 확인
  - 새로 추가한 상대 링크 5 종(`UC-07-export-import.md`, `../tasks/T-0020|T-0022|T-0023|T-0024|T-0025-*.md`)이 실존하는지 확인
  - push 후 main CI conclusion 확인은 driver 책임 (R-114)

## Out of Scope

- **`§5 step N` 코드 주석 sweep 신설** — planner 실측상 UC-01 ~ UC-05 의 §5 step 번호를 인용하는 코드 주석은 **0 곳** (`git grep -nE "UC-0[1-5].{0,40}step" -- src web test` → 0 hit, `UC-0[1-5]` hit 4 파일은 전부 operation 라벨 · 책임 경계 서술). UC-07 식 sweep 도 §5.1 대응표 신설도 불요하며, 본 task 는 step **번호를 이동시키지 않으므로**(mermaid 무변경) 다른 참조를 깨지 않는다.
- **UC-06 · UC-07 · UC-08 재수정** — 이미 [T-1316](T-1316-uc07-step-count-and-mapping-table.md) · [T-1325](T-1325-uc07-transitional-step-mapping-table-removal.md) · [T-1326](T-1326-uc06-uc08-step-count-realign.md) 로 정합 완료. 문장 표현 통일 · 상호 링크 추가도 하지 않는다.
- **mermaid arrow 추가 · 삭제 · 재배열 · step 라벨 문구 개선 · `Note over` 를 arrow 로 승격** — 선언을 실측에 맞추는 방향만 허용.
- **P2 자기점검 범위(8~14 / 10~18) 자체의 재조정** — 과거 task 파일의 기준을 고치는 것은 이력 개서라 금지. 본 task 는 현 실측이 그 범위 안이라는 **판정만** 기재한다.
- **drift-guard smoke 신설** (step 수 선언이 다시 어긋나면 fail 하는 spec) — 별건. `deploy/daily-test.sh` leg 추가는 drift-guard smoke 3 종(T-0791 / T-0944 / T-0947) 동기 수정을 강제해 5 파일 cap 을 넘긴다 (Q-0054 선례).
- `docs/architecture/*` · `docs/PLAN.md` · `docs/STATE.json` 갱신(driver bookkeeping 영역) · 과거 task 파일 · journal 안의 step 수 언급 개서(이력 기록이라 보존).

## Suggested Sub-agents

`implementer`

## Follow-ups
