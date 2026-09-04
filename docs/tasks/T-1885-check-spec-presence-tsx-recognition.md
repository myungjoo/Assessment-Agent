---
id: T-1885
title: check-spec-presence 게이트가 .tsx 를 인식하도록 수정 — 동반 spec 후보에 .test.tsx / .spec.tsx 추가 + 신규 production .tsx 도 검사 대상에 포함
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-059, REQ-060]
independentStream: ci-spec-presence-gate
dependsOn: []
touchesFiles:
  - scripts/check-spec-presence.sh
  - scripts/check-spec-presence.test.sh
estimatedDiff: 70
estimatedFiles: 2
created: 2026-09-04
plannerNote: "P6 / R-112 1차 게이트가 .tsx 맹점 — 정상 spec 61 개를 못 세고 신규 .tsx 는 아예 미검사, T-1884 CI 1 round 실비용"
---

# T-1885 — check-spec-presence 게이트의 `.tsx` 맹점 해소

## Why

[CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 의 **1 차 자동 강제 layer** 인 [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) 가 `.tsx` 확장자를 전혀 모른다. 그 결과 **양방향으로 오작동** 한다 — ① 정상적으로 붙인 spec 을 spec 으로 세지 못해 **false fail**, ② 신규 `.tsx` production 파일은 spec 이 하나도 없어도 게이트를 그냥 통과해 **false pass**. 직전 [T-1884](T-1884-adminview-import-export-hook-extract.md) 가 ①로 CI red round 를 1 회 실비용으로 지불했고(그 task `Follow-ups` 에 별도 `pr` task 로 처리하라고 박제), [PLAN.md](../PLAN.md) `183 행` AdminView 부채가 지목한 **경로 2(JSX 섹션 → 하위 컴포넌트 분리)** 는 신규 `.tsx` 를 계속 만들어내므로 ②의 구멍이 그대로 남으면 그 슬라이스들이 R-112 1 차 게이트 밖에서 진행된다.

**issue-still-relevant pre-check 실측** (head `9eaff702`, working tree == `origin/main` 확인):

- `git show origin/main:scripts/check-spec-presence.sh | grep -c "tsx"` = **0** — main 에 동일 의도가 안착한 흔적 0. `docs/tasks/` 의 선행 3 건([T-0007](T-0007-ci-spec-presence-check.md) 신설 · [T-0012](T-0012-check-spec-presence-patch.md) patch · [T-0409](T-0409-spec-presence-web-policy-self-test.md) web `.d.ts` 분기) 중 `.tsx` 를 다룬 것도 없다.
- **① false fail 의 규모** — 저장소에는 이미 `*.test.tsx` 가 **61 개** 존재하고 `*.spec.tsx` 는 **0 개** 다(`find web src test -name '*.test.tsx' -o -name '*.spec.tsx' | wc -l`). 즉 `.test.tsx` 는 web 의 확립된 관행인데 스크립트의 동반 spec 후보는 `40 행` ~ `47 행` 의 `.spec.ts` / `.test.ts` **두 개뿐** 이라, 신규 `.ts` 모듈에 `.test.tsx` spec 을 붙이면 게이트가 red 가 된다(T-1884 round 1 의 실제 원인).
- **② false pass 의 규모** — `18 행` 의 검사 대상 pathspec 이 `-- '*.ts'` 라 `.tsx` 는 애초에 목록에 들어오지 않는다. 실측: `web/src` 의 비-test `.tsx` **37 개** 중 colocated spec 이 없는 것은 **2 개** — `web/src/main.tsx`(Vite entrypoint, `src/main.ts` 와 동형의 정당한 예외) 와 **`web/src/views/adminServiceIdentityRowActions.tsx`**(AdminView 부채 arc 가 추가한 행 액션 helper 군 — `grep -rl "adminServiceIdentityRowActions" web/src --include=*.test.*` 결과 **0 건** 으로 이 파일을 참조하는 spec 이 전무한데도 게이트를 통과했다). 즉 구멍은 가설이 아니라 이미 1 건이 통과한 실증이다.
- **부작용 없음 확인** — 후보에 `.spec.tsx` 를 더해도 root jest 는 이를 집지 않는다(`package.json` 의 `jest.testRegex` = `.*\.spec\.ts$` 로 `.spec.tsx` 는 미매치, `moduleFileExtensions` 에도 `tsx` 없음) → 스크립트 `37 행` ~ `39 행` 주석이 web 에서 `.test.ts` 를 쓰게 만든 근거인 "root jest testRegex 와의 충돌" 이 재발하지 않는다. web 쪽은 `web/vite.config.mts` 에 vitest `include` override 가 없어 default(`**/*.{test,spec}.?(c|m)[jt]s?(x)`)가 적용되므로 네 후보(`.spec.ts` · `.test.ts` · `.spec.tsx` · `.test.tsx`) 모두 실제로 실행된다 — 인식만 넓히는 것이고 새 관행을 강제하지 않는다.

## Required Reading

- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) 전문 (57 줄) — 특히 `18 행`(검사 대상 pathspec) · `23 행` ~ `29 행`(제외 case) · `30 행` ~ `36 행`(`index.ts` re-export 제외) · `37 행` ~ `47 행`(동반 spec 후보 2 종).
- [scripts/check-spec-presence.test.sh](../../scripts/check-spec-presence.test.sh) 전문 (76 줄) — `case_run <name> <expected-exit> <setup-fn>` harness 와 기존 12 케이스의 setup 함수 작성 관행.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `87 행` ~ `94 행` — 두 스크립트를 부르는 CI step 2 개(`spec 파일 동반 여부 검사` / `spec-presence 자체 test`). 본 task 는 이 파일을 **수정하지 않는다**.
- [docs/tasks/T-1884-adminview-import-export-hook-extract.md](T-1884-adminview-import-export-hook-extract.md) `Follow-ups` 첫 항목 — 본 task 의 발주 근거.
- [CLAUDE.md](../../CLAUDE.md) `§3.2` R-112 의 **Entrypoint 예외** 문단 — `web/src/main.tsx` 제외의 근거(`src/main.ts` 와 동형).

## Acceptance Criteria

- [ ] **동반 spec 후보 4 종화** — [check-spec-presence.sh](../../scripts/check-spec-presence.sh) 가 신규 production 파일 `foo.ts` / `foo.tsx` 에 대해 `foo.spec.ts` · `foo.test.ts` · `foo.spec.tsx` · `foo.test.tsx` **네 후보 중 하나라도 존재하면 통과** 시킨다. 확장자 제거는 `.tsx` → `.ts` 순으로 안전하게 처리한다(현재 `${f%.ts}` 는 `foo.tsx` 에서 아무것도 떼지 못해 `foo.tsx.spec.ts` 를 찾는 버그가 된다).
- [ ] **검사 대상에 `.tsx` 포함** — `18 행` 의 `git diff ... -- '*.ts'` 를 `-- '*.ts' '*.tsx'` 로 넓혀 신규 production `.tsx` 도 spec 동반 의무 대상이 된다.
- [ ] **자기 제외 · entrypoint 제외 동반** — 위 확장으로 목록에 들어오게 된 test 파일 자신(`*.test.tsx` · `*.spec.tsx`)을 제외 case 에 추가하고, Vite entrypoint `web/src/main.tsx` 를 `src/main.ts` 와 같은 근거(CLAUDE.md §3.2 Entrypoint 예외)로 제외한다. `index.ts` re-export 제외 분기는 `index.tsx` 에도 동일하게 적용한다.
- [ ] **happy-path unit test** — [check-spec-presence.test.sh](../../scripts/check-spec-presence.test.sh) 에 `case_run` 케이스 추가: ① 신규 `web/src/a.ts` + `web/src/a.test.tsx` → exit **0** (T-1884 가 부딪힌 바로 그 조합) · ② 신규 `web/src/b.tsx` + `web/src/b.test.tsx` → exit **0**.
- [ ] **error path unit test** — 신규 `web/src/c.tsx` 단독(대응 spec 전무) → exit **1**. 이것이 현재 false pass 하는 구멍이며, 본 케이스는 스크립트 수정 전에는 실패(=regression 가드)해야 한다.
- [ ] **분기 cover** — 새로 생긴 분기마다 1+ 케이스: ① `web/src/main.tsx` 단독 → exit **0**(entrypoint 제외 분기) · ② 신규 `web/src/d.tsx` + `web/src/d.spec.tsx` → exit **0**(후보 4 종 중 `.spec.tsx` 경로) · ③ 신규 `web/src/e.ts` + `web/src/e.spec.tsx` → exit **0**(`.ts` 본체 ↔ `.tsx` spec 교차 조합) · ④ `web/src/index.tsx` 가 re-export 만 담을 때 → exit **0**(`index` 제외 분기의 `.tsx` 확장).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ 케이스: ① `web/src/f.tsx` + `web/src/f.notspec.tsx`(잘못된 suffix) → exit **1**(오통과 금지) · ② `web/src/g.tsx` + `web/src/g.test.ts`(본체 `.tsx`, spec 은 `.ts`) → exit **0** · ③ `web/src/h.test.tsx` **단독**(test 파일만 추가) → exit **0**(자기 제외 분기 — 없으면 test 파일이 자기 spec 을 요구하는 무한 요구가 된다) · ④ `web/src/i.d.ts` 는 기존대로 exit **0** 유지(기존 `web_dts` 케이스가 red 로 변하지 않음).
- [ ] **regression test** — 기존 12 케이스(`happy` ~ `web_bad_suffix`)가 **하나도 제거·수정되지 않고** 그대로 통과한다. 특히 `bad_suffix`(exit 1) · `web_missing`(exit 1) · `web_dts`(exit 0) 세 건의 기대값이 유지되는지 확인한다.
- [ ] `bash scripts/check-spec-presence.test.sh` 가 로컬에서 `[test] pass=N fail=0` 으로 종료(exit 0)하고, N 이 기존 12 에서 신규 케이스 수만큼 증가한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green, `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 task 의 변경은 shell script 2 개뿐이라 TypeScript coverage 수치 변동은 0 이어야 하며, 임계 미달이 새로 발생하면 그것은 본 변경과 무관한 회귀이므로 착수를 멈추고 보고한다.
- [ ] 본 PR 자신의 CI `spec 파일 동반 여부 검사` step 이 green — 본 PR 은 `.ts`/`.tsx` 를 추가하지 않으므로 검사 대상 0 건으로 통과해야 한다.

## Out of Scope

- `web/src/views/adminServiceIdentityRowActions.tsx` 의 누락 spec 작성 — 게이트는 **신규 추가 파일** 만 보므로 이미 머지된 이 파일은 본 수정으로 red 가 되지 않는다. 소급 spec 은 별도 slice (아래 `Follow-ups`).
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) 수정 — 두 step 은 스크립트를 그대로 호출하므로 배선 변경 불요.
- 다른 검사 스크립트([check-doc-only-pr.sh](../../scripts/check-doc-only-pr.sh) 등) 의 확장자 정책 손질.
- spec 의 **내용** 검증(테스트가 실제로 무엇을 assert 하는지) — 스크립트 헤더 주석이 명시하듯 [T-0007](T-0007-ci-spec-presence-check.md) 신설 시점부터 일관되게 범위 밖이다. 본 게이트는 존재 여부만 본다.
- `package.json` 의 `jest.testRegex` · `moduleFileExtensions` · web vitest `include` 변경 — 위 pre-check 에서 현행 설정으로 부작용 0 임을 확인했으므로 건드리지 않는다.
- AdminView 부채의 다음 축 hook 추출 — 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- **`web/src/views/adminServiceIdentityRowActions.tsx` 의 소급 spec 작성** — 본 task 의 pre-check 가 실측한 false pass 실증 1 건이다. 게이트는 신규 추가 파일만 보므로 이미 머지된 이 파일은 본 수정으로 red 가 되지 않지만, R-112 관점에서는 참조 spec 0 건인 production 모듈이 남아 있는 상태다. planner 가 별도 `pr` slice 로 colocated spec 을 붙일 것.


## 완료 기록

- **완료 시각**: 2026-09-04T04:32Z (server-time 기준 — `gh api -i rate_limit` `Date` 헤더). 본 fire 의 **두 번째이자 마지막 task** (multi-task chain, `FIRE-BATCH: T-1884+T-1885`).
- **PR / merge**: [PR #1473](https://github.com/myungjoo/Assessment-Agent/pull/1473) → main [`ee928073`](https://github.com/myungjoo/Assessment-Agent/commit/ee928073) (squash, round 1 APPROVE, BLOCKER 0 / MAJOR 0 / MINOR 0)
- **변경**: 2 파일 `+66/-18` — cap (300 LOC / 5 파일) 여유 준수.
  - [check-spec-presence.sh](../../scripts/check-spec-presence.sh): 동반 spec 후보를 `.spec.ts` · `.test.ts` · `.spec.tsx` · `.test.tsx` **4 종** 으로 넓히고, diff pathspec 에 `'*.tsx'` 를 추가해 신규 production `.tsx` 도 검사 대상에 넣었다. `*.test.tsx` / `*.spec.tsx` 자기 제외 · Vite entrypoint `web/src/main.tsx` 제외(CLAUDE.md `§3.2` Entrypoint 예외와 동형) · `index.tsx` re-export 분기를 함께 배선.
  - **확장자 제거 버그 해소**: 기존 `${f%.ts}` 는 `foo.tsx` 에서 아무것도 떼지 못해 `foo.tsx.spec.ts` 를 찾고 있었다. `strip_ext()` 헬퍼로 `.tsx` → `.ts` 순서로 안전 처리.
- **검증**: 자체 harness `bash scripts/check-spec-presence.test.sh` 가 **12 → 22 케이스** 로 늘어 `[test] pass=22 fail=0`. 신규 10 건은 happy 2 · error 1 · 분기 4 · negative 3 으로 R-112 4 종 전부 cover 하며, 기존 12 케이스는 **한 건도 수정하지 않고** 그대로 통과했다. `pnpm lint && pnpm build && pnpm test` green (466 suite · 13,495 test), CI 에서 `test:cov` · smoke · e2e · perf 도 green.
  - `tsx_missing` 케이스(신규 `web/src/c.tsx` 단독 → exit 1)는 수정 **전** 스크립트에서 false pass 하므로 실제 회귀 가드로 기능한다.
- **4-게이트**: reviewer VERDICT=APPROVE PR comment 외부 존재(게이트 2, 1 건) · PR head `ae8a3369` 의 pull_request run(33836674162) success(게이트 4) · integrator 자체 점검 통과 · Acceptance Criteria 11 항목 전부 ok → round 1 squash merge.
- **실증된 구멍이 닫혔다**: pre-check 가 찾아낸 false pass 실증 1 건(`web/src/views/adminServiceIdentityRowActions.tsx` — 참조 spec 0 건인데 게이트 통과)의 경로가 본 수정으로 막혔다. 이미 머지된 그 파일 자체의 소급 spec 은 아래 `Follow-ups` 로 남는다 (게이트는 신규 추가 파일만 본다).
