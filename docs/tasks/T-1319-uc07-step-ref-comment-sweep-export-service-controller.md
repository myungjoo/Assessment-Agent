---
id: T-1319
title: UC-07 §5 step 참조 주석 sweep slice 3 — export job service/controller 2 파일 12 곳 이름 병기
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-045]
estimatedDiff: 34
estimatedFiles: 2
created: 2026-07-30
independentStream: uc07-step-ref-comment-sweep
dependsOn: [T-1316, T-1317, T-1318]
touchesFiles:
  - src/export/export-job.service.ts
  - src/export/export.controller.ts
plannerNote: "T-1318 Follow-ups 첫 항목의 slice 3 — export job service 8 곳 + controller 4 곳. step 13→17 10 곳 / step 2→4 2 곳. pr, 34 LOC / 2 파일"
---

# T-1319 — UC-07 §5 step 참조 주석 sweep slice 3 (export job service/controller 2 파일)

## Why

[T-1316](T-1316-uc07-step-count-and-mapping-table.md) 이 UC-07 §5.1 에 step 번호 · 이름 대응표 + 판정 규약을 박제한 뒤, [T-1317](T-1317-uc07-step-ref-comment-sweep-chunk.md) (chunk streaming 5 파일 11 곳, PR #1198) · [T-1318](T-1318-uc07-step-ref-comment-sweep-export-job.md) (job/result/selection 5 파일 10 곳, PR #1199, merge `abbcb994`) 가 두 slice 를 닫았다. 본 task 는 T-1318 Follow-ups 첫 항목이 지목한 **slice 3** — `export-job.service.ts` (8 곳) 와 그 HTTP 표면인 `export.controller.ts` (4 곳) 다.

T-1318 Follow-ups 는 `export-job.service.ts` 8 곳을 "단일 파일 slice" 로 적었으나, origin/main `abbcb994` 재확인 결과 같은 배선 계열의 **controller 4 곳** 이 동일 판정 2 종에 그대로 속해 두 파일을 한 slice 로 묶는 편이 판정 일관성이 높다 (service 가 derive 한 결과를 controller 가 그대로 내려주는 같은 문맥). 2 파일 12 곳으로 cap (≤ 300 LOC / ≤ 5 파일) 안이다.

## Required Reading

- `docs/use-cases/UC-07-export-import.md` **103~127 행** — §5 참조 규약 (번호 + step 이름 병기) + `### 5.1 step 번호 · 이름 대응표` + 표 아래 **판정 규약** (기계적 +2 금지, 이름 기준 판정). 본 slice 의 정답 근거 2 행: `4 | WebUI → Admin: confirmation dialog (Export scope 선택 / Import 강한 confirmation) | 2` 와 `17 | WebUI → Admin: 결과 표시 (다운로드 완료 / 복원 완료 + 재수집 안내) | 15`.
- `src/export/export-result.ts` — **읽기만**. T-1317 / T-1318 이 확정한 병기 표기 선례 (헤더 참조는 `UC-07 §5 step 17 (결과 표시 — 다운로드 완료)`, 짧은 반복 참조는 `§5 step 17 (결과 표시)`) 를 그대로 따르기 위한 참조.
- 치환 대상 12 곳 (origin/main `abbcb994` 기준 행 번호 — 편집 전 grep 으로 실제 위치 재확인할 것):
  - **판정 A (`step 13` → `step 17`, 10 곳)**
    - `src/export/export-job.service.ts` 174 행 · 187 행 · 194 행 · 203 행 · 341 행 · 354 행 · 366 행 · 381 행 (8 곳, 전부 한 줄 안에 토큰이 있음 — 줄바꿈 갈림 없음)
    - `src/export/export.controller.ts` 340 행 (**`§5 step13` — 숫자가 붙어쓰기라 `step 13` grep 에 안 잡힌다**) · 417 행
  - **판정 B (`step 2` → `step 4`, 2 곳)**
    - `src/export/export.controller.ts` 17 행 · 186 행 (둘 다 `UC-07 §5 step 2 + §6.1 + §8 (a) read-only` — describe-scope 는 확정 전 scope 선택 dialog 이므로 §5.1 표의 옛 2 = 현 4)

## Acceptance Criteria

- [ ] **판정 A 10 곳**: `§5 step 13` (및 `§5 step13`) → `§5 step 17` + step 이름 병기. 파일별 첫(헤더) 참조는 `UC-07 §5 step 17 (결과 표시 — 다운로드 완료)`, 같은 파일 안의 짧은 반복 참조는 `§5 step 17 (결과 표시)` 를 쓴다 (T-1317 / T-1318 이 확정한 2 종 허용 형태 그대로). **기계적 +2 로 15 를 쓰지 않는다** (§5.1 판정 규약).
- [ ] **판정 B 2 곳**: `§5 step 2` → `§5 step 4 (confirmation dialog — Export scope 선택)` 형태. 옛 2 → 현 4 는 §5.1 표 행이 직접 근거이며, 같은 주석 안의 `§6.1` · `§8 (a) read-only` 인용은 **무변경**.
- [ ] **진행 표시 문맥 의미 보존** (`export-job.service.ts` 194 · 203 · 366 · 381 행 chunk/progress 문맥, `export.controller.ts` 417 행 status-view 문맥): 진행 표시는 완료 표시 자체가 아니므로 `§5 step 17 (결과 표시 — 다운로드 완료) 직전의 진행 안내` 형태로 앵커한다. 기존의 `직전 진행 안내` · `progress bar / resume offset 안내` · `chunk 경계 정합` 어휘를 없애지 않는다.
- [ ] **붙어쓰기 1 곳 정규화** (`export.controller.ts` 340 행 `§5 step13`): 치환하면서 `§5 step 17` 로 **공백을 넣어** 정규화한다 (후속 grep 검증이 성립하도록).
- [ ] 검증 (편집 후, 위 2 파일 대상): `git grep -oE "§5 ?step ?(13|2)\b"` 가 **0 hit**, `git grep -oE "§5 step 17"` 가 **10 hit**, `git grep -oE "§5 step 4"` 가 **2 hit**.
- [ ] **주석-only 보증**: `git diff -U0` 의 모든 `+`/`-` 줄 (diff 헤더 제외) 이 `//` 주석 줄이다. production 로직 · 식별자 · 메서드 시그니처 · 라우트 경로 · 상수값 변경 **0 LOC**. 검증: `git diff -U0 | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -vcE "^[+-]\s*//"` 가 `0` 을 보고.
- [ ] **줄바꿈 최소화**: 이름 병기로 줄이 길어지면 같은 주석 블록 안에서만 인접 1~2 줄 재줄바꿈을 허용한다 (주변 ~100 char wrap 스타일 유지). 문장 추가 · 문단 재작성 · 어순 재배치 금지 — diff 를 12 곳 주변으로 국소화한다.
- [ ] **happy-path test**: 본 task 는 주석 문자열만 바꾸므로 **신규 · 변경 public symbol 0** 이라 신규 happy-path test 대상이 없다 (T-1317 / T-1318 선례). 대신 대응 기존 spec 2 종 (`src/export/export-job.service.spec.ts` · `src/export/export.controller.spec.ts`) 전량 pass 를 확인한다.
- [ ] **error path test**: 위 2 spec 의 기존 error-path test (없는 job id · 잘못된 scope · 의존성 실패 등) 가 **무회귀 pass**. 신규 error 경로 도입 0 이라 신규 test 불요.
- [ ] **분기 cover**: 신규 · 변경 분기 **0** (주석만 변경) — 신규 branch test 없음. 기존 branch coverage 수치가 변하지 않음을 `pnpm test:cov` 결과로 확인.
- [ ] **negative cases**: 신규 예외 상황 (권한 부족 · 빈 입력 · 경계값 · type mismatch · 의존성 실패 · 비정상 시퀀스) 도입 0 — 기존 negative test 전량 무회귀 pass 로 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 + `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] 변경 범위 확인: `git diff --stat` 이 **위 2 파일만** 보고 (spec 파일 · 다른 `src/export/*` · `src/import/*` · docs · 워크플로 수정 0).

## Out of Scope

- `export.controller.ts` 7 행 (`UC-07 §5 Export 측 HTTP entry` — step 번호 없음) 과 11 행 (`api.md §5` — 다른 문서의 § 참조) 은 **무변경**. 본 slice 는 `UC-07 §5 step <숫자>` 형태만 건드린다.
- 나머지 잔여 §5 step 참조 — `export-import-audit.ts` (step 12 계열) · `export-dump-checksum.ts` (step 5 계열) · `export-dump-size-estimate.ts` (step 2 계열) · `import-restore-*.ts` / `import-mode-description.ts` (step 2 · 7 · 13 계열) · `src/import/*.ts` — 는 후속 slice 책임. "지나가다 보이니 같이" 고치지 않는다 ([CLAUDE.md](../../CLAUDE.md) §3).
- **spec 파일 수정** — 2 대응 spec 의 `describe`/`it` 문자열 · 단언 · 주석 전부 무변경. 주석 리터럴 drift-guard spec 신설도 본 slice 밖.
- production 로직 · 라우트 경로 · DTO · 반환 shape · 상수 변경 — 주석-only 원칙 위반.
- UC-07 문서 자체 수정 (§5 mermaid · §5.1 표 · 규약 · `step 수 17` 문장) — **read-only**. 표가 틀렸다고 판단되면 고치지 말고 Follow-ups 에 적는다.
- 같은 주석 안의 `§3 trigger 1` · `§6.1` · `§8 NFR` · `§8 (a)/(c)` 인용 재정비 — 본 slice 는 **§5 step 번호만** 건드린다.
- 주석의 영어화 · 전면 재작성 · 어휘 개선 목적 편집 — §12 정합 유지.

## Suggested Sub-agents

`implementer` (12 곳 국소 주석 치환 — 판정 A 10 곳 / 판정 B 2 곳, 붙어쓰기 `step13` 1 곳 주의) → `tester` (R-110 의무: `pnpm lint && pnpm build && pnpm test` + `pnpm test:cov`, 신규 spec 추가 0 이 정당한지 diff 로 확인).

## Follow-ups

- (잔여 sweep — import 계열) `import-restore-preview.ts` 3 곳 · `import-restore-confirmation.ts` 2 곳 · `import-restore-plan-summary.ts` 2 곳 · `import-mode-description.ts` 2 곳 · `import-restore-result.ts` 2 곳 — `step 2` / `step 7 강한 confirmation` / `step 13` 이 섞여 있고, §5.1 판정 규약이 명시한 대로 `step 7` 은 +2 도 옛 7 도 아닌 **현 step 4** 후보다. Import 계열만 묶은 별 slice 권장 (5 파일 11 곳 — cap 안).
- (잔여 sweep — export 기타) `export-import-audit.ts` 3 곳 (step 12 → 현 14 후보) · `export-dump-checksum.ts` 2 곳 (step 5 Note) · `export-dump-size-estimate.ts` 2 곳 (step 2 → 4 후보) — 판정이 서로 달라 한 slice 로 묶되 곳마다 표로 대조.
- (잔여 sweep — src/import) `import.controller.ts` · `import-restore.service.ts` · `import-job-runner.service.ts` 의 §5 참조 — step 번호 포함 여부부터 실측 후 slice 정의.
- (계수 방법 교훈 누적) T-1318 이 기록한 줄바꿈 갈림 (`§5 step\n// 13`) 에 더해 본 slice 에서 **붙어쓰기 `§5 step13`** 형태도 확인됐다. 잔여 계수는 `§5` 만으로 grep 한 뒤 육안 판정하는 방식을 계속 쓴다.
- (과도기 표 수명) sweep 이 전부 닫히면 UC-07 §5.1 표는 제거 가능 — 마지막 slice 가 표 제거 여부를 함께 판단.
