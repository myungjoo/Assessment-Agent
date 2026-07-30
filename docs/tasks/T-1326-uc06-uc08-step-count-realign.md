---
id: T-1326
title: UC-06 · UC-08 §5 step 수 선언을 실측(12 / 16)으로 정합 + arrow-only 계수 기준 통일
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-008, REQ-016, REQ-037, REQ-041]
estimatedDiff: 10
estimatedFiles: 2
created: 2026-07-30
independentStream: uc-step-count-realign
dependsOn: [T-1316]
touchesFiles:
  - docs/use-cases/UC-06-evaluation-delete-reeval.md
  - docs/use-cases/UC-08-permission-denied.md
plannerNote: "T-1316 이 cap 상 미뤄 둔 'UC-08 16 vs 14' 를 UC-06(13→12)과 함께 마감 — Note 포함 계수 서술 모순 2 파일. direct doc-only, 10 LOC / 2 파일"
---

# T-1326 — UC-06 · UC-08 §5 step 수 선언을 실측(12 / 16)으로 정합 + arrow-only 계수 기준 통일

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 §5 의 `step 수: 약 13` 을 실측 17 로 정합하면서 계수 기준을 **arrow 만 세고 `Note over ...` 는 제외** 로 확정했고, 같은 drift 가 남은 **UC-08 (선언 14 vs 실측 16)** 은 그때 cap 상 Out of Scope 로 미뤄졌다 (2026-07-30 journal `08:55 planner` 항목에 명시적 박제). 본 task 는 그 미뤄진 항목을, 같은 결함 유형 — **선언 괄호가 "`Note` 포함" 이라고 적어 autonumber 실제 동작과 모순되는 파일** — 인 **UC-06 (선언 13 vs 실측 12)** 과 함께 2 파일로 마감한다. 문서가 스스로 밝힌 step 수가 실제 다이어그램과 어긋나면 다른 문서·코드 주석의 `§5 step N` 참조 판정이 다시 흔들리므로 (T-1317~T-1324 sweep 9 slice 의 원인), 참조 기반을 실측으로 되돌리는 것이 목적이다.

PLAN P5 잔여 3 항목 중 line 108 (live-LLM 재검증) · line 109 (실 github 데이터 e2e) 는 credential / 사람-승인 게이트, line 106 (재실행·부분 reset) 은 REQ-051 선행 ADR 이 prerequisite 라 cap 내 1-task 로 부적합해 본 문서 정합 항목을 선택했다.

## Required Reading

- `docs/use-cases/UC-06-evaluation-delete-reeval.md` — 55~93 행 §5 mermaid 블록(**arrow 실측 12 개** = A01~A12, `Note over` 5 개, alt block 2 개[사용자 취소 / 검증 실패·race 거부]) + **95 행 = 수정 대상 문장** (`step 수: 약 13 (autonumber 기준 — 2 alt block 분기 + 1 conceptual Note 포함, 8 ≤ 13 ≤ 14 범위 안). 본 다이어그램은 …`)
- `docs/use-cases/UC-08-permission-denied.md` — 57~103 행 §5 mermaid 블록(**arrow 실측 16 개** = A01~A16, `Note over` 4 개, alt block 2 개[emit audience 분기 / display audience 분기]) + **105 행 = 수정 대상 문장** (`step 수: 약 14 (autonumber 기준 — trigger origin Note + audience 분기 alt block (emit) + display 분기 alt block + 1 conceptual Note 포함, 8 ≤ 14 ≤ 14 범위 안). 본 다이어그램의 의존성 방향은 …`)
- `docs/use-cases/UC-07-export-import.md` 103 · 105 행 — 계수 기준 정본. 103 행 = "`Note over ...` 는 번호 대상 아님 / 번호와 step 이름 병기" 규약, 105 행 = 실측 선언 + 자기점검 범위 초과 사실을 은폐하지 않고 기재한 **문장 형태 선례**. 본 task 는 이 두 문장을 **읽어서 형태만 따르고, UC-07 파일 자체는 1 줄도 고치지 않는다**.
- `docs/tasks/T-0026-uc-06-evaluation-delete-reeval.md` 100 행 · `docs/tasks/T-0028-uc-08-permission-denied.md` 101 행 — 각 UC 의 P2 자기점검 범위 출처 (`sequence step 수: 8 이상 14 이하`).

**planner 실측 확정 (executor 재계수 불요)** — origin/main `4a8a0709` 기준:

| 파일 | 현 선언 | arrow 실측 | `Note over` | 자기점검 범위(8~14) |
| --- | --- | --- | --- | --- |
| UC-06 | 약 13 | **12** (A01~A12) | 5 | 범위 안 |
| UC-08 | 약 14 | **16** (A01~A16, emit 7 + display 9) | 4 | **2 초과** |

## Acceptance Criteria

- [ ] **UC-06 95 행** — `step 수: 약 13 (autonumber 기준 — 2 alt block 분기 + 1 conceptual Note 포함, 8 ≤ 13 ≤ 14 범위 안).` 를 실측 기반 문장으로 교체한다: (a) `step 수 12` 명시, (b) 계수 기준을 **arrow 만 계수하고 `Note over ...` 는 포함하지 않는다** 로 바로잡는다 (현 `1 conceptual Note 포함` 서술이 autonumber 실제 동작과 모순이므로 제거), (c) 2 alt block 안의 분기 arrow 는 계수에 포함된다는 사실 유지, (d) [T-0026](T-0026-uc-06-evaluation-delete-reeval.md) 100 행 자기점검 범위 `8 이상 14 이하` **안** 이라는 판정을 남긴다.
- [ ] **UC-08 105 행** — `step 수: 약 14 (autonumber 기준 — trigger origin Note + … + 1 conceptual Note 포함, 8 ≤ 14 ≤ 14 범위 안).` 를 실측 기반 문장으로 교체한다: (a) `step 수 16` 명시, (b) 계수 기준을 **arrow 만 계수 · `Note over ...` 제외** 로 바로잡는다, (c) emit phase 7 arrow + display phase 9 arrow 구성과 audience 분기 alt block 2 개 안의 arrow 가 포함된다는 사실을 한 절로 남긴다, (d) [T-0028](T-0028-uc-08-permission-denied.md) 101 행 자기점검 범위 `8 이상 14 이하` 를 **2 초과** 하는 사실을 [UC-07](../use-cases/UC-07-export-import.md) §5 선례대로 **은폐하지 않고 기재** 하고, 그 사유(본 UC 가 emit phase[외부 4xx → event emit → 영속]와 display phase[별도 read path] 두 국면을 한 다이어그램에 담고 각 국면의 audience 분기[REQ-008 user / REQ-016 admin]를 alt block 으로 전개)를 같은 문장 안에 1 절로 적는다.
- [ ] **뒤 문장 보존** — 두 파일 모두 `본 다이어그램은 …` / `본 다이어그램의 의존성 방향은 …` 부터 문단 끝까지 (의존성 그래프 정합 서술 · UC-01 conceptual reference 서술 포함) **글자 그대로 유지**. 삭제 · 요약 · 재작성 금지.
- [ ] **mermaid 무변경** — UC-06 55~93 행 · UC-08 57~103 행 블록의 arrow · `Note over` · alt block · participant 선언을 **1 줄도 바꾸지 않는다** (arrow 를 추가·삭제해 선언에 맞추는 방향은 명시적 금지 — 선언을 실측에 맞춘다).
- [ ] **검증 grep** (편집 후 실행, 기대값 실측 확정분):
  - `grep -c -- "->>" docs/use-cases/UC-06-evaluation-delete-reeval.md` → **12**, 같은 명령 UC-08 → **16** (mermaid 무변경 확인)
  - `grep -c "약 13" docs/use-cases/UC-06-evaluation-delete-reeval.md` → **0**, `grep -c "약 14" docs/use-cases/UC-08-permission-denied.md` → **0**
  - `grep -c "step 수 12" docs/use-cases/UC-06-evaluation-delete-reeval.md` → **1**, `grep -c "step 수 16" docs/use-cases/UC-08-permission-denied.md` → **1**
  - `grep -c "Note 포함" docs/use-cases/UC-06-evaluation-delete-reeval.md docs/use-cases/UC-08-permission-denied.md` → 두 파일 모두 **0**
  - `grep -c "본 다이어그램" docs/use-cases/UC-06-evaluation-delete-reeval.md` → **1**, 같은 명령 UC-08 → **1** (뒤 문장 보존 확인)
- [ ] **2 파일 게이트** — `git diff --stat` 결과가 위 2 개 use-case 파일뿐이고 파일당 삭제 1 줄 · 추가 1 줄 (합계 ≈ +2/-2 ~ +4/-4) 범위여야 한다. `src/` · `test/` · `web/` · 다른 UC 파일은 **1 줄도 건드리지 않는다**.
- [ ] **R-112 대체 검증** — 본 task 는 `commitMode: direct` 문서 전용 변경이라 **신규 public symbol 0 · 신규 분기 0 · production 코드 0 LOC** 이므로 happy-path / error path / 분기 / negative cases 각각에 대응하는 신규 test 대상이 **없다** (T-1316 · T-1325 선례). 대신 다음으로 대체한다:
  - `pnpm lint && pnpm build` 통과 (문서 변경이라 영향 0 이어야 한다)
  - `pnpm test` 전량 통과 · `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 기존 spec 무회귀 확인
  - push 후 main CI conclusion 확인은 driver 책임 (R-114)

## Out of Scope

- **UC-01 · UC-02 · UC-03 · UC-04 · UC-05 의 같은 drift** — planner 실측상 UC-01 (선언 13 / 실측 11) · UC-02 (12 / 11) · UC-03 (11 / 10) · UC-04 (11 / 10) · UC-05 (12 / 11) 도 모두 어긋나지만, 5 파일 cap 과 판정 유형(이 5 개는 `Note 포함` 모순 없이 단순 off-by-N)이 달라 **후속 slice** 로 넘긴다. 본 task 에서 손대지 말 것.
- **UC-07 파일 수정** — 계수 기준 정본이라 읽기만 한다. 문장 표현 통일 · 상호 링크 추가도 하지 않는다.
- **mermaid arrow 추가 · 삭제 · 재배열 · step 라벨 문구 개선** — 선언을 실측에 맞추는 방향만 허용.
- **§5.1 형태의 step 번호 · 이름 대응표 신설** — UC-06 · UC-08 을 참조하는 `§5 step N` 코드 주석은 실측상 **0 곳** (`git grep -n "UC-06" -- src` 4 파일은 모두 operation 라벨 · 책임 경계 서술이고 step 번호 인용 없음, `UC-08` 은 `src`/`web`/`test` 전역 0 hit) 이라 sweep 도 대응표도 불요하다.
- **drift-guard smoke 신설** (step 수 선언이 다시 어긋나면 fail 하는 spec) — 별건. `deploy/daily-test.sh` leg 추가는 drift-guard smoke 3 종 동기 수정을 강제해 5 파일 cap 을 넘긴다 (Q-0054 선례).
- `docs/architecture/*` · `docs/PLAN.md` · `docs/STATE.json` 갱신 (driver bookkeeping 영역) · 과거 task 파일 · journal 안의 step 수 언급 개서 (이력 기록이라 보존).

## Suggested Sub-agents

`implementer`

## Follow-ups
