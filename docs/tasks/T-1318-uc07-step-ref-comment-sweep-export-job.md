---
id: T-1318
title: UC-07 §5 step 참조 주석 sweep slice 2 — export job/result/selection 5 파일 10 곳 이름 병기
phase: P5
status: DONE
completedAt: 2026-07-30T12:08:14Z
prNumber: 1199
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 28
estimatedFiles: 5
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317]
touchesFiles:
  - src/export/export-chunk-throughput-series.ts
  - src/export/export-job-plan.ts
  - src/export/export-job-status-view.ts
  - src/export/export-result.ts
  - src/export/export-selection-summary.ts
plannerNote: "T-1317 Follow-ups 첫 항목의 slice 2 — job/result/selection 5 파일 10 곳. step 13→17 8 곳 + step 2→4 2 곳. pr, 28 LOC / 5 파일"
---

# T-1318 — UC-07 §5 step 참조 주석 sweep slice 2 (export job/result/selection 5 파일)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) (merge `e8a77f3d`) 이 UC-07 §5.1 에 step 번호 · 이름 대응표 + 판정 규약을 박제했고, [T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) (merge `8f2bb78d`, PR #1198) 이 chunk streaming 5 파일 11 곳을 첫 소비 slice 로 닫았다. 본 task 는 그 **Follow-ups 첫 항목이 지목한 slice 2** — `export-chunk-throughput-series.ts` + `export-job-plan.ts` + `export-job-status-view.ts` + `export-result.ts` + `export-selection-summary.ts` 5 파일이다.

T-1317 Follow-ups 는 이 묶음을 "8 곳 / 판정 동일 계열 (전부 다운로드 완료 앵커로 추정, 착수 시 재확인 필요)" 로 적었으나, origin/main `8f2bb78d` 재확인 결과 **실측 10 곳이고 판정은 2 종** 이다 (줄바꿈으로 `§5 step` / `13` 이 갈린 참조 2 곳이 단순 grep 에서 누락됐었다). 따라서 본 slice 는 "동일 판정 1 종" 가정을 버리고 **두 판정을 명시적으로 분리** 해 처리한다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **103~127 행** — §5 참조 규약 (번호 + step 이름 병기) + `### 5.1 step 번호 · 이름 대응표` + 표 아래 **판정 규약** (기계적 +2 금지, 이름 기준 판정). 본 slice 의 정답 근거 2 행: `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2` 와 `17 | WebUI → Admin: 결과 표시 (다운로드 완료 / 복원 완료 + 재수집 안내) | 15`.
- `src/export/export-chunk-stream-progress.ts` — **읽기만**. T-1317 이 확정한 병기 표기 선례 (`§5 step 17 (결과 표시 — 다운로드 완료) 직전의 진행 안내` 형태) 를 그대로 따르기 위한 참조.
- 치환 대상 10 곳 (origin/main `8f2bb78d` 기준 행 번호 — 편집 전 grep 으로 실제 위치 재확인할 것):
  - **판정 A (`step 13` → `step 17`, 8 곳)**
    - `src/export/export-chunk-throughput-series.ts` 33 행 (`후속 WebUI 진행 표시(UC-07 §5 step 13)`)
    - `src/export/export-job-plan.ts` 13 행 · 39 행
    - `src/export/export-job-status-view.ts` 12 행 · 29~30 행 (**`§5 step` 과 `13` 이 줄바꿈으로 갈려 있음**) · 122 행
    - `src/export/export-result.ts` 4 행 · 177~178 행 (**여기도 `§5` / `step 13` 이 줄바꿈으로 갈려 있음**)
  - **판정 B (`step 2` → `step 4`, 2 곳)**
    - `src/export/export-selection-summary.ts` 9 행 · 44 행 (둘 다 `§5 step 2(scope 옵션 확인)` — 실제 대상은 §5.1 표의 옛 2 = 현 4 `confirmation dialog (Export scope 선택)`)

## Acceptance Criteria

- [ ] **판정 A 8 곳**: `§5 step 13` → `§5 step 17` + step 이름 병기. 파일별 첫(헤더) 참조는 `UC-07 §5 step 17 (결과 표시 — 다운로드 완료)`, 같은 파일 안의 짧은 반복 참조는 `§5 step 17 (결과 표시)` 를 쓴다 (T-1317 이 확정한 2 종 허용 형태 그대로). **기계적 +2 로 15 를 쓰지 않는다** (§5.1 판정 규약).
- [ ] **판정 B 2 곳**: `§5 step 2(scope 옵션 확인)` → `§5 step 4 (confirmation dialog — Export scope 선택)` 형태. 옛 2 → 현 4 는 §5.1 표 행이 직접 근거이며, 같은 문장 안의 `§3 trigger 1` · `§8 (b) Audit row` 인용은 **무변경**.
- [ ] **진행 표시 문맥 3 곳 의미 보존** (`export-chunk-throughput-series.ts` 33 행 · `export-job-status-view.ts` 12 행 · 29~30 행): 진행 표시는 완료 표시 자체가 아니므로 `§5 step 17 (결과 표시 — 다운로드 완료) 직전의 진행 안내` 형태로 앵커한다. 기존의 `직전의 진행 안내` · `polling 진행 표시` 어휘를 없애지 않는다.
- [ ] **줄바꿈 갈림 2 곳 처리** (`export-job-status-view.ts` 29~30 행 · `export-result.ts` 177~178 행): 토큰이 두 줄에 걸쳐 있으므로 단순 문자열 치환으로는 잡히지 않는다. 두 줄을 함께 편집해 `§5 step 17` 이 **한 줄 안에** 오도록 정리한다 (후속 grep 검증이 성립하도록).
- [ ] 검증 (편집 후): 5 파일 대상 `git grep -oE "§5 step (13|2)\b"` 가 **0 hit**, `git grep -oE "§5 step 17"` 가 **8 hit**, `git grep -oE "§5 step 4"` 가 **2 hit**.
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · export 시그니처 · 상수값 변경 **0 LOC**. 검증: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치 금지 — diff 를 10 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 ([T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) 선례). 대신 대응 기존 spec 5 종 (`export-chunk-throughput-series.spec.ts` · `export-job-plan.spec.ts` · `export-job-status-view.spec.ts` · `export-result.spec.ts` · `export-selection-summary.spec.ts`) 전량 pass 를 확인한다.
- [ ] **error path test**: 위 5 spec 의 기존 error-path test (빈 입력 · 잘못된 status · 경계 수치 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 5 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- 나머지 **약 38 곳 / 21 파일** 의 §5 step 참조 (`export-job.service.ts` 8 곳 · `export.controller.ts` 3 곳 · `import-restore-preview.ts` 계열 등) — 파일 묶음별 후속 slice 책임. 본 slice 에서 "지나가다 보이니 같이" 고치지 않는다 ([CLAUDE.md](../../CLAUDE.md) §3).
- **spec 파일 수정** — 5 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴 drift-guard spec 신설도 본 slice 밖.
- production 로직 · 함수 시그니처 · 반환 shape · 상수 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- 같은 주석 안의 `§3 trigger 1` · `§8 NFR` · `§8 (a)/(b)` 인용 재정비 — 본 slice 는 **§5 step 번호만** 건드린다.
- 주석의 영어화 · 전면 재작성 · 어휘 개선 목적 편집 — §12 정합 유지.

## Suggested Sub-agents

`implementer` (10 곳 국소 주석 치환 — 판정 A 8 곳 / 판정 B 2 곳, 줄바꿈 갈림 2 곳 주의) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Result (2026-07-30 12:08Z, DONE)

pr-mode — PR [#1199](https://github.com/myungjoo/Assessment-Agent/pull/1199) squash 머지 (`abbcb994`), reviewer APPROVE round 1/7, 4-게이트 PASS, PR CI green. export job/result/selection 계열 5 파일 **10 곳** 을 [T-1316](T-1316-uc07-step-count-and-mapping-table.md) §5.1 대응표 기준으로 정정 (+20/-17, 주석-only — 비주석 diff 줄 0). 판정 A **8 곳** `§5 step 13` → `§5 step 17 (결과 표시 — 다운로드 완료)`, 판정 B **2 곳** `§5 step 2` → `§5 step 4 (confirmation dialog — Export scope 선택)`. 진행 표시 문맥 3 곳은 `직전의 진행 안내` 앵커를 유지했고, 줄바꿈으로 갈려 있던 참조 2 곳은 토큰을 한 줄로 재정렬했다. §3 · §8 인용은 글자 그대로 유지.

검증: grep `step 13` · `step 2` 본 slice 5 파일 0 hit / `step 17` 8 hit · `step 4` 2 hit, 전체 428 suite / 12271 test pass, line 99.95% · function 100%. 신규·변경 public symbol 0 이라 신규 spec 불요.

본 task 는 [7.5] cron multi-task chain 의 두 번째 task 로 [T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) 과 같은 fire 에서 수행됐다 (`FIRE-BATCH: T-1317+T-1318`).

## Follow-ups

- (잔여 sweep) `export-job.service.ts` 8 곳 은 단일 파일에 몰려 있어 1 파일 slice 로 처리 가능 — `§5 step 13 + §8 (a) Export postcondition` 형태의 복합 인용이라 병기 형태를 별도 판단.
- (선행 drift 실례) `import-restore-preview.ts` · `import-restore-confirmation.ts` · `import-restore-plan-summary.ts` 의 `step 7 강한 confirmation` 계열 — +2 도 옛 7 도 아닌 **현 step 4** 로 판정될 후보. Import 계열만 묶은 별 slice 권장.
- (계수 방법 교훈) 줄바꿈으로 갈린 `§5 step\n// 13` 패턴 때문에 단순 `git grep -oE "§5 step [0-9]+"` 가 실측을 **과소 계수** 한다. 남은 slice 의 잔여 계수는 `§5` 만으로 grep 한 뒤 육안 판정하는 편이 안전 — 다음 slice 정의 시 planner 가 이 방식을 쓴다.
- (과도기 표 수명) sweep 이 전부 닫히면 UC-07 §5.1 표는 제거 가능 — 마지막 slice 가 표 제거 여부를 함께 판단.
