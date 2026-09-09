---
id: T-1990
title: PLAN 166 행 E2E 커버리지 축 drift 정정 — stale spec 수 19 → 39 갱신 + census 강제 장치 좌표 1 회 박제
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-061]
estimatedDiff: 30
estimatedFiles: 1
dependsOn: [T-1985, T-1989]
touchesFiles: [docs/PLAN.md]
independentStream: e2e-census-doc-sync
created: 2026-09-09
plannerNote: P8 · PLAN 166 행 근거가 "19 e2e-spec" 스냅샷에 멈춰 있고 census(89/89 · 미커버 0) 좌표가 문서 어디에도 없다 — 1 회 정정
---

# T-1990 — PLAN 166 행 E2E 커버리지 축 drift 정정 (spec 수 갱신 + census 좌표 박제)

## Why

[docs/PLAN.md](../PLAN.md) `166 행` "E2E 시나리오 커버리지" bullet 의 **implemented-on-main** 근거는 `test/e2e/` 에 "19 e2e-spec" 이 있다는 **스냅샷**인데, 그 사이 T-1960~T-1989 slice 가 spec 을 2 배로 늘려 그 수치가 틀렸다. 더 중요한 건 근거의 **성격**이다 — 이 축은 T-1985~T-1989 를 거쳐 "대표 spec 을 나열한 스냅샷" 에서 "route 모수 대비 미커버 0 을 CI 가 강제하는 **불변식**" 으로 바뀌었는데, 그 강제 장치의 좌표가 PLAN · requirements 어디에도 없다. 직전 [T-1984](T-1984-req043-guard-census-drift-doc-sync.md) 가 guard 축 census 에 대해 [docs/requirements.md](../requirements.md) `62 행` 에서 수행한 것과 **같은 형태의 1 회 정정**이며, 등급 재판정이 아니라 CLAUDE.md `§3.1` once-rule 이 예외로 명시한 "구현 arc 와 무관한 drift 정정" 이다. bullet 마커는 이미 `[x]` 이고 **그대로 둔다**.

**issue-still-relevant pre-check (origin/main `c13bcd3b` 실측)**:

- **stale 수치 미해소** — `sed -n '166p' docs/PLAN.md | grep -o "19 e2e-spec"` 히트 1, 실제 `ls test/e2e/*.e2e-spec.ts | wc -l` 은 **39**. 20 건 차이가 그대로 남아 있다.
- **census 좌표 부재 미해소** — `git grep -n "route-e2e-coverage-census" origin/main -- docs/PLAN.md docs/requirements.md` 히트 **0**. 히트는 journal 2 건과 T-1985~T-1989 task 파일뿐이라 **정본 문서에는 한 번도 박제된 적이 없다**. guard 축은 T-1984 로 이미 박제됐고(`git grep -c "route-auth-guard-coverage-census" origin/main -- docs/requirements.md` = 1) e2e 축만 빠져 있다.
- **중복 아님** — `git log origin/main --oneline -6 -- docs/PLAN.md` 최근 6 commit(T-1955 · T-1947 · T-1922 · T-1919 · T-1911 · T-1906)은 ADR 승격 · REQ 재판정 · AdminView 부채 갱신이라 `166 행` 과 겹치지 않는다.
- **오너 게이트 침범 0** — `src/` · `test/` · `web/` · 워크플로 0 LOC(PLAN `157`·`158 행` perf/load 신규 slice 0, CLAUDE.md `§5` 인증 변경 0).

## Required Reading

- [docs/PLAN.md](../PLAN.md) `166 행` — 본 task 의 **유일한** 수정 대상. Phase P8 첫 bullet, `- [x] E2E 시나리오 커버리지.` 로 시작하는 단일 행(1,718 byte)이다. 대표 spec 링크 나열은 유지 대상이고 수정 지점은 그 앞뒤 서술이다.
- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `36 행`(`MIN` = controllers 23 · routes 89 · e2eSpecs 39 · covered 89) · `42~44 행`(`E2E_UNCOVERED_ALLOWLIST` = **빈 배열**) · `47~50 행`(`CLOSED_BY_T1989` 2 route) · `148 행`(allowlist 가 비었음을 자기검증) — 박제할 수치와 계약의 출처.
- [test/helpers/route-census.ts](../../test/helpers/route-census.ts) — 두 census 가 공유하는 스캐너 단일 출처(T-1986 · T-1987). 좌표만 인용하고 내용 요약은 하지 않는다.
- [docs/tasks/T-1984-req043-guard-census-drift-doc-sync.md](T-1984-req043-guard-census-drift-doc-sync.md) `## Why` · `## Acceptance Criteria` — **본 task 의 형식 선례**(guard 축 census 의 동일 정정). 서술 톤 · "틀린 부분만 고친다" 원칙을 승계한다.
- [CLAUDE.md](../../CLAUDE.md) `§3.1`(once-rule 과 drift 정정 예외) · `§12`(행 범위 표기 R1~R7 — 구분자 `~`, 단일 행은 `166 행`, `L` prefix 금지)

## Acceptance Criteria

- [ ] **수정 범위** — `docs/PLAN.md` **1 파일 · `166 행` 1 행**만 바꾼다. `git diff --stat` 이 `1 file changed` 이고 다른 행 · 다른 파일 변경 0. `src/` · `test/` · `web/` · `.github/` · `package.json` 0 LOC.
- [ ] **stale 수치 정정** — "19 e2e-spec" 을 실측 **39** 로 고친다. 착수 시 `ls test/e2e/*.e2e-spec.ts | wc -l` 을 다시 돌려 값을 확정하고, **실측이 39 와 다르면 실측을 따르고** 그 차이를 `## Follow-ups` 에 적는다.
- [ ] **census 좌표 박제 (1 회)** — 같은 bullet 에 다음 4 요소를 담은 서술을 **1~3 문장**으로 추가한다: (1) [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) 링크 (2) `36 행` `MIN` 4 축 실측(controller 23 · route 89 · e2e spec 39 · 커버 89) (3) **미커버 0 · allowlist 빈 배열**이라는 현행 계약과 그 소진 출처(T-1989 가 `GET /api/admin/import/running` · `/modes` 를 실 왕복 e2e 로 닫음) (4) 판정 비대칭 — 4 축은 하한이라 증가는 정상이지만 **미커버 집합은 정확 일치**라 e2e 없는 route 가 새로 들어오면 CI 가 red. 스캐너 단일 출처 [route-census.ts](../../test/helpers/route-census.ts) 도 한 번 링크한다.
- [ ] **정확한 서술은 건드리지 않는다** — 대표 spec 링크 나열, `pnpm test:e2e` step 과 R-113 언급, [T-0825](T-0825-plan-p8-e2e-scenario-coverage-implemented-on-main.md) 출처 pointer 는 **그대로 둔다**. 마커 `[x]` 도 불변이다(등급 재판정 아님).
- [ ] **표기 규약** — 행 범위는 `§12` R1~R7 대로 `166 행` · `42~44 행` 형태. 문서 링크는 `docs/` 기준 상대 경로이고, 추가한 모든 링크의 대상 파일이 실재함을 `ls` 또는 `git ls-files` 로 확인한다(깨진 링크 0).
- [ ] **검증** — `grep -c "19 e2e-spec" docs/PLAN.md` 가 **0**, `grep -c "route-e2e-coverage-census-drift" docs/PLAN.md` 가 **1 이상**. `sed -n '166p' docs/PLAN.md` 가 여전히 `- [x] E2E 시나리오 커버리지.` 로 시작하는 단일 행이고 bullet 이 두 행으로 쪼개지지 않았음을 눈으로 확인한다.
- [ ] **direct commit 규율** — 문서 1 파일뿐이므로 CLAUDE.md `§3.1` 대로 main 직접 commit. R-110 면제 대상(doc-only)이라 `pnpm test` 는 요구하지 않으나, 변경이 문서 밖으로 새면 즉시 중단하고 `pr` 로 재큐잉한다.

## Out of Scope

- **test 파일 수정 금지** — census smoke spec · [route-census.ts](../../test/helpers/route-census.ts) · `test/e2e/` 어느 것도 건드리지 않는다. 특히 T-1989 reviewer 가 남긴 MINOR(`CLOSED_BY_T1989` 에 `readonly` 누락, 동작 영향 0)는 `test/` 변경이라 commitMode 가 갈린다 — 본 task 에 섞지 말고 census 파일을 만지는 다음 `pr` slice 에서 함께 처리한다(CLAUDE.md `§3` Nit-in-PR closure 급).
- **REQ 등급 재판정 금지** — [docs/requirements.md](../requirements.md) 의 REQ-061 등 어떤 REQ status 도 바꾸지 않는다(once-rule). 본 task 는 PLAN 서술 정정 1 회로 끝나며 후속 재판정 task 를 만들지 않는다.
- **다른 PLAN bullet 갱신 금지** — `157`·`158`·`161`·`169 행`(R-91 k6 · R-92 churn 중단 · 실데이터 133명 · 부하·내성) 과 `184 행` AdminView 부채 실측 갱신은 각각 별도 축이다.
- **guard 축 재서술 금지** — `KNOWN_GAP_REQ_043` 20 건 · guard census 는 T-1984 가 이미 [docs/requirements.md](../requirements.md) `62 행` 에 박제했다. PLAN 에 중복 서술하지 않는다.
- **guard 실 배선 · 새 e2e 신설 · 새 helper · 새 dependency** 전부 금지.

## Suggested Sub-agents

`implementer` (doc-only 단일 행 정정 — architect · tester 불요)

## Follow-ups

(생성 시점 비어 있음)
