---
id: T-1984
title: REQ-043 상태 칸 적용률 축 drift 정정 — stale census 수치 4 개 갱신 + T-1983 census smoke 좌표 1 회 박제
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-043]
estimatedDiff: 20
estimatedFiles: 1
dependsOn: [T-1983]
touchesFiles: [docs/requirements.md]
independentStream: req043-guard-census-doc-sync
created: 2026-09-08
plannerNote: P5 · REQ-043 상태 칸의 census 수치가 5 주 stale 이고 "미보호를 잡는 test 없음" 문장이 T-1983 머지로 거짓이 됨 — 1 회 정정
---

# T-1984 — REQ-043 상태 칸 적용률 축 drift 정정 (census 수치 갱신 + 강제 장치 좌표 박제)

## Why

[docs/requirements.md](../requirements.md) `62 행` REQ-043 상태 칸의 **적용률 축** 문단은 [T-1379](T-1379-requirements-auth-protection-coverage-status-rejudge.md) 실측 시점(2026-08-02)의 수치를 그대로 담고 있는데, 그 사이 5 주 동안 route 표면이 커져 **네 개 수치가 전부 틀렸다**. 또한 같은 문단 끝 문장 "group · part · person 의 미보호를 fail 로 잡는 test 는 없다" 는 [T-1983](T-1983-route-auth-guard-coverage-census-smoke.md)(main `23a26f01` 머지) 이후 **거짓**이 됐다. 본 task 는 이 두 가지를 한 번에 정정한다 — 등급 재판정이 아니라 **stale 수치 · 거짓 문장의 drift 정정**이며(CLAUDE.md `§3.1` 이 once-rule 예외로 명시한 "구현 arc 와 무관한 drift 정정" 에 해당), REQ-043 등급은 실 배선이 여전히 미완이므로 `IN_PROGRESS` 그대로 둔다.

issue-still-relevant pre-check (origin/main `c0715e47`, 실측):

- **stale 수치 4 개 재확인** — 본 fire 에서 `src/**/*.controller.ts` 를 주석 제거 후 센 결과 **controller 23 개 · `@UseGuards` 를 하나라도 가진 controller 19 개 · route decorator 89 개** 다. 상태 칸은 각각 **20 · 16 · 74** 로 적혀 있고, 보호 route 도 **49** 로 적혀 있으나 실제는 **64** 다(머지된 census spec 의 `MIN` 상수 `19 행` 과 일치). 네 수치 모두 갱신 대상.
- **틀리지 않은 수치는 건드릴 필요가 없다** — "guard 미참조 controller 4 개"(23 − 19 = 4: app · group · part · person) 와 "21 route 는 실제로 미보호"(app 1 + group 9 + part 6 + person 5) 는 지금도 참이다. 미보호 총계 25(= 21 + auth 3 + signup 1) 도 census spec 의 allowlist 25 건과 일치한다. **정확한 문장을 새로 쓰지 말 것** — 변경은 틀린 부분에 한정한다.
- **거짓이 된 문장 1 개** — `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 가 main 에 있고(`19 행` 하한 3 축 · `21~57 행` allowlist 25 건 · `213 행` 태그 건수 단언), 미보호 full-path 집합을 allowlist 와 **양방향 정확 일치**로 고정한다. 즉 group · part · person 의 미보호가 하나라도 늘거나 기존 guard 가 사라지면 CI 가 red 다 — 상태 칸의 "잡는 test 는 없다" 는 더 이상 사실이 아니다.
- **중복 아님** — `git grep -n "route-auth-guard-coverage-census-drift" origin/main -- docs/` 히트 **0**. census spec 좌표는 어느 문서에도 아직 박제되지 않았다. `git log origin/main --oneline -20 -- docs/requirements.md` 에서 REQ-043 행을 만진 최근 commit 도 없다(T-1983 은 `docs/requirements.md` 무접촉으로 명시 이월했다).
- **once-rule 준수** — REQ-043 등급 재판정 왕복(PLAN `183 행` 이 금지한 `재판정 → 배선 → 재판정`)이 아니다. 등급은 `IN_PROGRESS` 로 **불변**이고, 본 task 는 수치 정정 + 강제 장치 좌표 1 회 박제로 끝난다. 후속 재판정 task 를 만들지 않는다.
- **오너 게이트 침범 0** — `src/` · `test/` 0 LOC(PLAN `157`·`158 행` perf/load 신규 slice 0), 공유 helper 신설 0(PLAN `182 행`), guard 실 배선 0(CLAUDE.md `§5` 인증 변경 — 오너 승인 대상).

## Required Reading

- [docs/requirements.md](../requirements.md) `62 행` REQ-043 행 — 특히 상태 칸 안 **적용률 축은 미완** 로 시작하는 문단 (본 task 의 유일한 수정 대상)
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `19 행`(`MIN` = controllers 23 · routes 89 · guarded 64) · `21~57 행`(`PUBLIC_BY_DESIGN` 5 + `KNOWN_GAP_REQ_043` 20 = allowlist 25) · `177`·`191`·`213 행`(하한 · census · 태그 건수 단언)
- [docs/tasks/T-1983-route-auth-guard-coverage-census-smoke.md](T-1983-route-auth-guard-coverage-census-smoke.md) `## Why` (census 시계열: 2026-08-02 controller 20 / route 74 → 현재 23 / 89) · `## Out of Scope` 마지막 두 bullet(본 doc-sync 를 이월한 지점)
- [docs/tasks/T-1379-requirements-auth-protection-coverage-status-rejudge.md](T-1379-requirements-auth-protection-coverage-status-rejudge.md) `## Follow-ups` — 현 상태 칸 문장의 출처
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(REQ 재판정 once-rule 과 drift 정정 예외) · `§12`(행 범위 표기 R1~R7 — 구분자 `~`, 단일 행은 `62 행`, `L` prefix 금지)

## Acceptance Criteria

- [ ] `docs/requirements.md` **1 파일만** 수정한다(`git status --porcelain` 이 이 파일 1 개만 보여야 한다). 다른 REQ 행 · 표 머리글 · 다른 문서 무접촉.
- [ ] REQ-043 상태 칸의 **적용률 축** 문단에서 stale 수치 4 개를 실측값으로 교체한다: controller `20` → **23**, `@UseGuards` 보유 controller `16` → **19**, route decorator `74` → **89**, 보호 route `49` → **64**. 교체 후 `grep -o "controller 는 23 개" docs/requirements.md` 등으로 각 갱신값이 실제로 들어갔는지 확인한다.
- [ ] 갱신값이 main 의 census spec 상수와 **일치**함을 확인한다 — `grep -n "MIN = " test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 가 `controllers: 23, routes: 89, guarded: 64` 를 보여야 하고, 상태 칸의 세 수치가 그와 같아야 한다(문서가 spec 보다 앞서 나가지 않는다).
- [ ] 이미 참인 서술 — "guard 미참조 controller 4 개", "21 route 는 실제로 미보호", app · auth 3 · signup 의 공개 의도 서술 — 은 **그대로 둔다**. 불필요한 재작성으로 diff 를 키우지 않는다.
- [ ] 문단 끝의 거짓 문장("e2e 는 auth 도메인 route 만 cover 해 group · part · person 의 미보호를 fail 로 잡는 test 는 없다")을 사실로 교체한다: 강제 장치가 `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 에 존재하며 미보호 full-path 집합을 allowlist(`public-by-design` 5 · `known-gap-REQ-043` 20 = 25)와 **양방향 정확 일치**로 고정해 신규 미보호 route 유입 · 기존 guard 제거를 red 로 잡는다는 사실을, 파일 경로 + `19 행` · `21~57 행` · `213 행` 좌표와 함께 1~3 문장으로 적는다.
- [ ] REQ-043 의 **등급은 `IN_PROGRESS` 로 불변**임을 확인한다 — group · part · person 20 route 의 실 배선은 CLAUDE.md `§5` 인증 변경이라 미완이며, 본 task 는 관측 · 서술만 정정한다. `DONE` 으로 승격하지 않는다.
- [ ] 남는 한계도 함께 명시한다: census 는 **정적 소스 추출** 기반이고 미보호 20 route 는 여전히 부채로 카운트될 뿐 배선되지 않았다는 점(조용한 blessing 이 아님).
- [ ] 행 범위 표기는 CLAUDE.md `§12` R1~R7 을 따른다(구분자 `~`, 단일 행 `19 행`, `L` prefix 금지). 기존 문장의 표기는 소급 치환하지 않는다.
- [ ] 수정 후 표 구조가 깨지지 않았음을 확인한다 — REQ-043 은 여전히 `|` 로 구분된 **한 줄**이고 셀 개수가 다른 행과 같다(`awk -F'|' '/REQ-043/ {print NF}' docs/requirements.md` 결과가 이웃 행과 동일).
- [ ] doc-only `direct` commit 이므로 test 는 요구하지 않는다(CLAUDE.md `§3.2` R-110 의 direct doc-only 면제). `src/` · `test/` · `web/` · `package.json` 변경 0 LOC 임을 commit 전에 확인한다.

## Out of Scope

- **guard 실 배선** — group · part · person 20 route 에 `@UseGuards` 를 붙이는 일. CLAUDE.md `§5` 인증 변경이라 오너 승인 + ADR 선행 대상이며 본 task 에서 절대 손대지 않는다.
- `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 수정 · allowlist 증감 · 새 spec 신설(본 task 는 `test/` 무접촉).
- REQ-043 등급 승격 또는 다른 REQ 행(REQ-045 · REQ-049 등) 재판정 — 각각 자기 구현 slice 머지 후 once-rule 로 별도 처리.
- [docs/PLAN.md](../PLAN.md) bullet 갱신 · ADR 신설 · [docs/architecture/](../architecture/) 문서 갱신.
- `@Roles` / RBAC 역할 축 census 를 상태 칸에 추가하는 일 — 본 문단은 **인증(JwtAuthGuard) 적용 여부** 축만 서술한다.
- 상태 칸의 자격증명 축 · guard wiring 축 · 프런트 진입 차단 축 문단 재작성 — 그 세 문단은 여전히 정확하므로 무접촉.

## Suggested Sub-agents

`implementer`

## Follow-ups

(작성 시점 비어 있음)
