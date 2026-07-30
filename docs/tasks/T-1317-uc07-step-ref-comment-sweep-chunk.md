---
id: T-1317
title: UC-07 §5 step 참조 주석 sweep slice 1 — export chunk streaming 5 파일의 step 13 → step 17 이름 병기
phase: P5
status: DONE
completedAt: 2026-07-30T11:48:55Z
prNumber: 1198
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 24
estimatedFiles: 5
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316]
touchesFiles:
  - src/export/export-chunk-integrity-reconcile.ts
  - src/export/export-chunk-refetch-coalesce.ts
  - src/export/export-chunk-resume-plan.ts
  - src/export/export-chunk-stream-progress.ts
  - src/export/export-chunk-stream-throughput.ts
plannerNote: "T-1316 §5.1 대응표의 첫 소비 slice — chunk streaming 5 파일 주석 11 곳 step 13→17 이름 병기. pr, 24 LOC / 5 파일"
---

# T-1317 — UC-07 §5 step 참조 주석 sweep slice 1 (export chunk streaming 5 파일)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) (merge `e8a77f3d`) 이 UC-07 §5.1 에 **step 번호 · 이름 대응표 + 판정 규약** 을 박제해, 코드 주석의 옛 §5 step 참조를 고칠 수 있는 선행 조건이 확정됐다. 그 Follow-ups 의 마지막 항목 (`src/export/**` · `src/import/**` 주석 sweep — 파일 묶음별 slice) 의 **첫 slice** 다.

origin/main `e8a77f3d` 실측: `git grep -oE "§5 step [0-9]+" -- "src/export/*" "src/import/*"` = **60 곳 / 31 파일** (T-1316 이 적은 48 곳 / 27 파일 은 다른 계수 패턴 — 본 task 는 위 명령 결과를 기준으로 삼는다). 5 파일 cap 상 최소 7 slice 가 필요하므로, 본 slice 는 **판정이 완전히 동일한 export chunk streaming 계열 5 파일 (11 곳)** 만 처리한다 — 한 번의 의미 판정을 5 파일에 그대로 적용해 slice 안에서 재추론 0 ([CLAUDE.md](../../CLAUDE.md) §7 context 절약).

본 slice 는 §5.1 판정 규약이 경고한 **선행 drift 의 두 번째 실례** 이기도 하다: 11 곳 전부가 `§5 step 13(Export 다운로드)` / `step 13 정합` 인데, 이들이 가리키는 의도는 **WebUI 의 "다운로드 완료" 결과 표시** 다. T-1311 이전 번호로도 옛 13 은 `AssessmentModule-->>BackendAPI: 결과 응답` arrow 였고 결과 표시는 옛 15 였다 — 즉 **기계적 +2 (13→15) 는 틀리고, 이름 기준 판정으로 현 step 17 이 정답**이다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **103~127 행** — §5 참조 규약 (번호 + step 이름 병기, 예 `§5 step 17 (결과 표시 — 다운로드 완료)`) + `### 5.1 step 번호 · 이름 대응표` 17 행 + 표 아래 **판정 규약** (기계적 +2 금지, 이름 기준 판정). 표의 마지막 행 `17 | WebUI → Admin: 결과 표시 (다운로드 완료 / 복원 완료 + 재수집 안내) | 15` 가 본 slice 의 정답 근거.
- `docs/use-cases/UC-07-export-import.md` **96 행** — `WebUI->>Admin: 결과 표시 (Export: 다운로드 완료. ...)` arrow 원문 (현 17 번째 arrow).
- 치환 대상 11 곳 (origin/main `e8a77f3d` 기준 행 번호 — 편집 전 실제 위치를 grep 으로 재확인할 것):
  - `src/export/export-chunk-integrity-reconcile.ts` 16 행 · 79 행
  - `src/export/export-chunk-refetch-coalesce.ts` 17 행 · 152 행
  - `src/export/export-chunk-resume-plan.ts` 14 행 · 79 행
  - `src/export/export-chunk-stream-progress.ts` 12 행 · 47 행 · 87 행
  - `src/export/export-chunk-stream-throughput.ts` 40 행 · 79 행
- `src/export/export-job-status-view.ts` 12 행 — **읽기만 (본 slice Out of Scope)**. `... 직전의 진행 안내` 라는 기존 표현 선례로만 참조한다. 이 파일의 step 번호는 후속 slice 가 고친다.
- `docs/tasks/T-1316-uc07-step-count-and-mapping-table.md` Follow-ups 마지막 항목 — 본 slice 의 출처.

## Acceptance Criteria

- [ ] 위 11 곳의 `§5 step 13` 을 **`§5 step 17` + step 이름 병기** 형태로 교체한다. 허용 형태 2 종: 각 파일의 첫(헤더) 참조는 `UC-07 §5 step 17 (결과 표시 — 다운로드 완료)`, 같은 파일 안의 짧은 반복 참조는 `§5 step 17 (결과 표시)` — 둘 다 §5 규약의 "번호 + 이름 병기" 를 충족한다. **기계적 +2 로 15 를 쓰지 않는다** (§5.1 판정 규약, 위 Why 근거).
- [ ] "진행 표시" 문맥 2 곳 (`export-chunk-stream-progress.ts` 47 행 · `export-chunk-stream-throughput.ts` 40 행) 은 **의미를 보존** 한다 — 진행 표시는 완료 표시 자체가 아니므로 `§5 step 17 (결과 표시 — 다운로드 완료) 직전의 진행 안내` 형태로 앵커한다. `export-chunk-stream-throughput.ts` 40 행의 `"남은 시간"·"전송 속도"` **리터럴은 글자 그대로 유지** 하고, UC-07 §8 에 없는 새 문서 주장 (예: "§8 NFR 이 남은 시간·전송 속도를 규정" 류) 을 추가하지 않는다.
- [ ] 검증 (편집 후): `git grep -c "§5 step 13" -- src/export/export-chunk-integrity-reconcile.ts src/export/export-chunk-refetch-coalesce.ts src/export/export-chunk-resume-plan.ts src/export/export-chunk-stream-progress.ts src/export/export-chunk-stream-throughput.ts` 가 **0 hit**, 같은 5 파일에 대한 `git grep -oE "§5 step 17" ... | wc -l` 이 **11**.
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · export 시그니처 · 상수값 변경 **0 LOC**. 검증 명령: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치는 금지 — diff 를 11 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 ([T-1314](T-1314-realdata-live-spec-timeout-120s.md) 선례). 대신 대응 기존 spec 5 종 (`export-chunk-integrity-reconcile.spec.ts` · `export-chunk-refetch-coalesce.spec.ts` · `export-chunk-resume-plan.spec.ts` · `export-chunk-stream-progress.spec.ts` · `export-chunk-stream-throughput.spec.ts`) 이 전량 pass 함을 확인한다: `pnpm test -- src/export/export-chunk-`.
- [ ] **error path test**: 위 5 spec 의 기존 error-path test (빈 입력 · 잘못된 chunk 범위 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 5 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- `src/export/export-chunk-throughput-series.ts` (§5 step 참조 1 곳) — chunk 계열이지만 **5 파일 cap 때문에 본 slice 밖**. 후속 slice 가 다른 파일들과 함께 묶는다.
- 나머지 **49 곳 / 26 파일** 의 §5 step 참조 (`export-job.service.ts` 8 곳 · `export.controller.ts` 3 곳 · `import-restore-preview.ts` 3 곳 등) — 파일 묶음별 후속 slice 책임. 본 slice 에서 "지나가다 보이니 같이" 고치지 않는다 (§3).
- **spec 파일 수정** — 5 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴을 감시하는 drift-guard spec 신설도 본 slice 밖 (별도 판단 — 현재 `git grep "step 13" -- test/ web/ scripts/` 0 hit 으로 감시 spec 부재 확인됨).
- production 로직 · 함수 시그니처 · 반환 shape · 상수 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- UC-08 `step 수: 약 14` vs 실측 16 정합 및 UC-01~UC-06 계수 기준 통일 — T-1316 Follow-ups 의 별 slice.
- 주석의 영어화 · 전면 재작성 · `§8 NFR` 인용 재정비 — §12 정합 유지, 어휘 개선 목적 편집 금지.

## Suggested Sub-agents

`implementer` (11 곳 국소 주석 치환 — §5.1 표 기준 이름 병기) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Result (2026-07-30 11:48Z, DONE)

pr-mode — PR [#1198](https://github.com/myungjoo/Assessment-Agent/pull/1198) squash 머지 (`8f2bb78d`), reviewer APPROVE round 1/7, 4-게이트 PASS, PR CI green. export chunk streaming 5 파일 주석 **11 곳** 을 §5.1 대응표 기준 `§5 step 17` 이름 병기로 교체 (+22/-19, 주석-only — 비주석 diff 줄 0). 병기 형태는 헤더 5 곳 `결과 표시 — 다운로드 완료`, 반복 인용 4 곳 `결과 표시`, 진행 표시 문맥 2 곳 `직전의 진행 안내` 로 갈라 의미 보존 — **기계적 +2(15) 미사용** (§5.1 판정 규약 준수). `남은 시간` · `전송 속도` 리터럴과 §8 관련 주장은 글자 그대로 유지, 재줄바꿈은 같은 주석 블록 인접 줄에 한정.

검증: `step 13` grep 0 hit · `step 17` 11 hit, export-chunk 11 suite / 383 test + 전체 428 suite / 12271 test pass, line 99.95% · function 100%. 신규·변경 public symbol 0 이라 신규 spec 불요 (주석-only 선례 — 본 task 본문 `Suggested Sub-agents` 의 tester 판단 기준과 동형).

## Follow-ups

- (본 slice 잔여) §5 step 참조 **49 곳 / 26 파일** — 다음 slice 후보 묶음: `export-chunk-throughput-series.ts` (1) + `export-job-plan.ts` (2) + `export-job-status-view.ts` (2) + `export-result.ts` (1) + `export-selection-summary.ts` (2) = 5 파일 / 8 곳 (판정 동일 계열 — 전부 "다운로드 완료" 결과 표시 앵커로 추정, slice 착수 시 재확인 필요).
- (판정 재추론 필요) `export-job.service.ts` 8 곳 은 단일 파일에 몰려 있어 1 파일 slice 로 처리 가능 — 다만 `§5 step 13 + §8 (a) Export postcondition` 형태의 복합 인용이라 이름 병기 형태를 별도 판단.
- (선행 drift 실례) `import-restore-preview.ts` · `import-restore-confirmation.ts` · `import-restore-plan-summary.ts` 의 `step 7 강한 confirmation` 계열 — §5.1 판정 규약이 명시한 대로 +2 도 아니고 옛 7 도 아닌 **현 step 4 (confirmation dialog)** 로 판정될 후보. Import 계열만 묶은 별 slice 권장.
- (과도기 표 수명) 위 sweep 이 전부 닫히면 UC-07 §5.1 표는 제거 가능 — 마지막 slice 가 표 제거 여부를 함께 판단.
