---
id: T-0409
title: check-spec-presence — web .d.ts 제외 분기 + .test.sh web 정책 self-test 케이스 (T-0355 잔여 (b))
phase: P6
status: DONE
commitMode: pr
prNumber: 330
completedAt: 2026-06-14T16:14:30Z
completedCommit: 57ecda8
coversReq: [REQ-038, REQ-048]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-06-15
independentStream: p6-frontend-scaffold
dependsOn: []
touchesFiles:
  - scripts/check-spec-presence.sh
  - scripts/check-spec-presence.test.sh
plannerNote: "P6 — T-0355 잔여 (b) 안전 final slice. .test.ts 는 T-0380 선반영, 남은 건 web .d.ts 위양성 1줄 제외 + self-test 케이스. single-helper test × 1.0 ≈ 45 LOC"
---

# T-0409 — check-spec-presence web 정책 self-test (T-0355 잔여 (b))

## Why

T-0355 (P6 scaffold slice 3) 의 마지막 잔여 AC 항목 (b) — `scripts/check-spec-presence.sh` 의 web 정책 + `scripts/check-spec-presence.test.sh` 의 web self-test 케이스 — 를 안전하게 마무리한다. T-0355 의 다른 잔여는 이미 분리·완료됐다 (ci-wiring→T-0405, web-static smoke→T-0406, web.module.ts coverage→T-0408, directory.md→T-0397). 본 task 가 머지되면 driver 가 T-0355 를 DONE 처리한다.

조사로 확인된 현 상태 (staleness 반영): `check-spec-presence.sh` 의 `.test.ts` colocated 인식은 T-0380 에서 **이미 반영**됐고, pathspec 이 `'*.ts'` 라 `web/src/a.ts → web/src/a.test.ts` 는 현재도 통과한다. 잔여 실제 gap 은 단 하나 — **`web/src/types.d.ts` 같은 type-declaration 파일이 missing-spec 으로 잘못 flag 되는 위양성** (실측 confirm: `web/src/types.d.ts` 단독 추가 시 exit 1). `.d.ts` 는 runtime 코드가 없어 spec 대상이 아니므로 제외 분기 1줄을 추가하고, 그 정확성을 self-test 로 가드한다.

## Required Reading

- `scripts/check-spec-presence.sh` — L23-27 의 제외 `case` 블록 (spec/test suffix·test 디렉토리·main.ts), L38-45 의 `.spec.ts`/`.test.ts` colocated 후보 로직
- `scripts/check-spec-presence.test.sh` — `case_run` harness 구조 (L15-32) + 기존 8 케이스 (happy/error/branch/negative/regression/smoke_suffix/test_leading/bad_suffix) 배선 (L34-60)
- `docs/tasks/T-0355-p6-ci-web-steps-policy-doc-sync.md` — AC line 53-54 (web 정책 분기 + self-test) + Out of Scope (`.tsx` production 파일 검사 확장은 제외)

## Acceptance Criteria

- [ ] `scripts/check-spec-presence.sh` 의 제외 `case` 블록 (L23-27) 에 `*.d.ts) continue ;;` 추가 — type-declaration 파일은 spec 의무 대상에서 제외. 기존 `src/` `.spec.ts` 규칙 + `web/` `.test.ts` 규칙 (T-0380 선반영) 불변. 추가 근거를 한국어 주석 1줄로 동반. 파일 inspect 로 검증.
- [ ] `scripts/check-spec-presence.test.sh` 에 web 정책 self-test 케이스 추가 (happy-path) — web `.ts` + colocated `.test.ts` → pass (exit 0). 예: `setup_web_test()` 가 `web/src/a.ts` + `web/src/a.test.ts` 생성, `case_run web_test 0 setup_web_test`.
- [ ] (error/negative path) web `.ts` 단독 (대응 `.test.ts`/`.spec.ts` 없음) → fail (exit 1). 예: `setup_web_missing()` 가 `web/src/b.ts` 만 생성, `case_run web_missing 1 setup_web_missing`.
- [ ] (제외 분기) web `.d.ts` 단독 → pass (exit 0) — 위 main-script 제외 분기 가드. 예: `setup_web_dts()` 가 `web/src/types.d.ts` 만 생성, `case_run web_dts 0 setup_web_dts`. (이 케이스가 첫 AC 의 정확성을 증명하는 핵심 가드 — main-script 변경 없이 돌리면 fail 해야 함 = regression 성격.)
- [ ] branch cover — web `.test.ts` 인식 (happy) + web `.d.ts` 제외 (분기) + web 단독 fail (error) 3 분기가 각각 1+ 케이스로 분리됨. 기존 8 케이스 회귀 없음.
- [ ] negative cases 충분 cover — web `.ts` 단독 fail (위) 외에, 기존 `bad_suffix` (잘못된 suffix `.notspec.ts` 가 spec 으로 오통과 금지) 케이스가 web 경로에도 유효함을 확인 (필요 시 web 변형 1 케이스 추가). 단일 negative 만으로 끝내지 말 것.
- [ ] R-112 self-test layer 충족: `bash scripts/check-spec-presence.test.sh` 실행 시 `[test] pass=N fail=0` green (신규 케이스 포함 전체 통과).
- [ ] R-110: production code 변경 0 이어도 tester 가 root `pnpm lint && pnpm build && pnpm test` + `pnpm test:smoke` + `pnpm test:e2e` 실행·green 확인. (shell script 변경이므로 root jest coverage 영향 없음 — `pnpm test:cov` 별도 step 통과 확인.)
- [ ] R-114: push 후 PR CI 전 step green 확인 — approval-gate ordering fail 은 rerun 절차로 처리.

## Out of Scope

- `check-spec-presence.sh` 의 `*.ts` pathspec 확장 (`.tsx` production 파일 검사) — T-0355 Out of Scope 그대로 유지. 본 task 는 기존 `*.ts` pathspec 안에서 `.d.ts` 제외 분기만 추가.
- `.test.ts` colocated 인식 로직 변경 — T-0380 에서 이미 반영됨, 본 task 는 그 위에 `.d.ts` 제외 + self-test 만.
- `.github/workflows/ci.yml` / `package.json` / smoke spec / directory.md — 모두 T-0405/T-0406/T-0408/T-0397 에서 완료. 본 task 는 scripts 2 파일만.
- vitest coverage threshold 실 도입 (`@vitest/coverage-v8` dev dep — §5 게이트) — T-0355 Follow-ups 의 별도 task.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 변경 범위가 shell script 제외 분기 1줄 + self-test 케이스로 명확, 결정 사항 없음)

## Follow-ups

(없음 — 생성 시점)
