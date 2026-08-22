---
id: T-1649
title: 정본 markdown 표에서 133 devset 로그인을 재유도하는 drift guard 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
independentStream: r91-load-k6
dependsOn: [T-1648]
touchesFiles:
  - test/helpers/realdata-devset-logins-doc-consistency.ts
  - test/helpers/realdata-devset-logins-doc-consistency.spec.ts
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22
completedAt: 2026-08-22T13:01:30Z
prNumber: 1318
plannerNote: R-91 chain 30/N — T-1648 Follow-ups 의 drift-guard 축: 정본 markdown 표 ↔ fixture JSON 이중 정본 drift 차단 (pr, 2 파일)
---

# T-1649 — 정본 markdown 표에서 133 로그인을 재유도하는 drift guard

## Why

T-1648 이 정본 문서 [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 `§A` · `§B` 표를 `test/load/realdata-devset-logins.json` 으로 옮겨 담으면서 **같은 데이터의 정본이 둘**이 됐다 — 사람이 읽는 markdown 표와 기계가 읽는 JSON fixture. 어느 한쪽만 갱신되면(예: 문서 표에 개발자 1 명 추가, fixture 미반영) 부하 테스트가 조용히 옛 집합을 쓰게 된다. 본 slice 는 T-1648 Follow-ups 의 첫 축 — **문서 표를 파싱해 fixture 와 정확히 일치하는지 검증하는 drift guard 1 개**만 박는다. seed 실행 경로와 워크플로 배선은 건드리지 않는다(다음 slice).

PLAN `144 행` 오너 지시(R-91 k6 최우선)의 chain, 부하계획 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 잔여 ① 실 dataset seed 축의 선행 안전장치다.

## Required Reading

- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) — `14 행` `## A.` 소제목 + markdown 표(첫 열 `github login`, 33 행), `52 행` `## B.` 소제목 + 표(첫 열 `github login`, 100 행), `157 행` `## 재생성(refresh) 명령` 이 `§B` 표의 종료 경계. `§B` 표는 첫 열에 공백 padding 이 있다(`| mhs4670go                | 273 |`) — trim 필요.
- [test/helpers/realdata-devset-logins.ts](../../test/helpers/realdata-devset-logins.ts) — T-1648 로더. `parseDevsetLogins` / `loadRealdataDevsetLogins` / `resolveRealdataDevsetLogins` 3 symbol 과 `GITHUB_LOGIN_PATTERN` · 33/100/133 상수 정책. 본 task 에서 **수정 금지**, import 해서 재사용만.
- [test/helpers/realdata-devset-logins.spec.ts](../../test/helpers/realdata-devset-logins.spec.ts) — colocated spec 작성 스타일(한국어 describe/it, 사유별 error path 분리) 참고.
- [test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts](../../test/helpers/realdata-e2e-daily-step-collect-command-plan-consistency.ts) `1~40 행` — 기존 `*-consistency` guard 계열의 헤더 주석 구조와 **에러 정책**(구조 결손 = `TypeError` / 값 정합 위반 = `RangeError`, 한국어 메시지, fail-fast) 관례.
- [package.json](../../package.json) 의 `jest` 블록 — `testRegex`(`.*\.spec\.ts$`) · `collectCoverageFrom`(`src/**` 한정 → 본 task 는 전역 coverage 수치 무변경).

## Acceptance Criteria

- [x] `test/helpers/realdata-devset-logins-doc-consistency.ts` 신설 — 다음 3 개 public symbol 만 export:
  - `parseDevsetLoginsDoc(markdown: string): { a: string[]; b: string[] }` — 순수 함수. `## A.` / `## B.` 소제목 뒤의 markdown 표에서 **첫 열(github login) 만** 추출(구분자 행 `|---|` 과 헤더 행 제외, 각 셀 trim). markdown 이 문자열이 아니거나 `§A` · `§B` 소제목을 찾지 못하면 한국어 `TypeError`.
  - `loadRealdataDevsetLoginsDoc(): { a: string[]; b: string[] }` — 정본 markdown 파일을 `node:fs` 로 읽어 위 파서에 통과시킨 결과 반환(경로는 `node:path` 로 helper 기준 상대 해석).
  - `assertDevsetLoginsFixtureMatchesDoc(markdown: string, fixtureRaw: unknown): void` — `parseDevsetLoginsDoc` 결과와 `parseDevsetLogins(fixtureRaw)`(T-1648 로더 재사용) 결과를 비교해 `a` · `b` 각각의 **길이 · 원소 · 순서**가 정확히 일치하지 않으면 어느 그룹 · 몇 번째 index · 양쪽 값이 무엇인지 담은 한국어 `RangeError`. 일치하면 `void`(silent 통과 0 — 위반인데 통과하는 경로 없음).
- [x] `test/helpers/realdata-devset-logins-doc-consistency.spec.ts` 신설 (colocated). 아래 R-112 4 종을 모두 cover:
  - **happy path**: 실제 저장소의 정본 문서 ↔ 실제 fixture 가 일치 — `assertDevsetLoginsFixtureMatchesDoc(실제 markdown, 실제 fixture)` 가 throw 하지 않음. `parseDevsetLoginsDoc` 이 `a` 33 개 · `b` 100 개 · 합집합 133 개 · 교집합 0 을 돌려줌. `loadRealdataDevsetLoginsDoc()` 이 파일에서 같은 결과를 돌려줌. **이 항목이 본 task 의 drift guard 실효 자체다.**
  - **error path**(사유별 별개 test): markdown 이 문자열 아님(`null` · 숫자 · 객체) / `## A.` 소제목 부재 / `## B.` 소제목 부재 / 표가 비어 login 0 개 — 각각 `TypeError` 와 사유 문구 검증.
  - **분기 cover**: `§A` 만 drift · `§B` 만 drift · 양쪽 정상 3 분기 각 1+ test. 표 셀 padding 이 있는 행(`| login    | 4 |`)과 없는 행 둘 다 trim 되어 같은 값이 나오는 분기 1+.
  - **negative cases 충분 cover**(각 1+ test): 문서에만 있고 fixture 에 없는 login(문서 표 1 행 추가) · fixture 에만 있는 login · 같은 집합이지만 **순서만 다름** · 대소문자만 다름(`Foo` vs `foo` 는 불일치로 판정) · 개수는 같은데 1 개 값이 다름 · `§B` 표 뒤 `## 재생성(refresh) 명령` 이후 본문의 코드블록 라인이 표로 오인 파싱되지 않음. 각각 `RangeError` 이고 메시지에 위반 그룹(`a`/`b`)과 index 가 포함됨을 확인.
- [x] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 무변경이라 전역 coverage 수치는 불변이어야 한다.
- [x] 새 dependency 0 — `node:fs` · `node:path` 와 기존 helper import 만 사용.
- [x] `docs/ops/realdata-scale-devset.md` · `test/load/realdata-devset-logins.json` · `test/helpers/realdata-devset-logins.ts` · `src/` · `.github/workflows/` · `package.json` 변경 0.

## Out of Scope

- 133 Person + github `ServiceIdentity` 를 DB 에 넣는 seed 실행 경로(다음 slice).
- `test/load/s1-batch.js` · `load-k6.yml` 배선 변경, 임계 숫자(900ms · 1h 예산) 조정.
- 정본 문서나 fixture 의 데이터 자체 수정(가감 · 재정렬 · 오타 교정 포함) — drift 를 발견하면 고치지 말고 Follow-ups 에 적는다.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` doc-sync (direct-mode 별도 task).
- `deploy/daily-test.sh` leg 추가(drift-guard smoke spec 3 종 동시 갱신이 강제되어 5 파일 cap 초과).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- seed slice: 본 로더/가드가 보증하는 133 로그인을 소비해 Person + github `ServiceIdentity` 를 부하 테스트용 DB 에 넣는 경로(workflow step 또는 k6 setup).
- doc-sync slice: 부하계획 `§5` item 5 잔여 ① 의 진척(fixture + drift guard 박제) 반영.
