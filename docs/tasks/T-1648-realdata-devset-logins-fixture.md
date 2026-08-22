---
id: T-1648
title: Extract realdata devset 133 logins into a machine-readable fixture with a validating loader
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047]
independentStream: r91-load-k6
dependsOn: []
touchesFiles:
  - test/load/realdata-devset-logins.json
  - test/helpers/realdata-devset-logins.ts
  - test/helpers/realdata-devset-logins.spec.ts
estimatedDiff: 285
estimatedFiles: 3
created: 2026-08-22
createdAt: 2026-08-22
plannerNote: R-91 chain 29/N — 133명 실 dataset seed 축의 1 슬라이스: 로그인 목록 기계 판독화 + 검증 로더 (pr, 3 파일)
---

# T-1648 — realdata devset 133 로그인의 기계 판독 fixture + 검증 로더

## Why

오너 지시(PLAN `144 행` "R-91 k6 최우선·즉시 착수")의 chain 에서 남은 축은 **133 명 실 dataset seed**(Person + github `ServiceIdentity`) 다 — 부하계획 `§5` item 5 의 잔여 ① 축. 그 seed 를 어떤 형태로든 자동화하려면 [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 사람용 markdown 표에만 있는 133 개 github login 이 **기계 판독 가능한 형태**로 먼저 저장소에 있어야 한다. 본 slice 는 그 첫 단계만 한다 — 데이터 파일 1 개와 검증 로더 1 개를 박제하고, seed 실행·수집·워크플로 배선은 건드리지 않는다(다음 slice).

## Required Reading

- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) — `§A`(33 명 표) · `§B`(100 명 표) 가 로그인 정본. 총합 133, A ∩ B 중복 0.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `22~30 행` — `K6_S1_PERSONS` 기본값 처리 (향후 소비자 형태 참고용, 본 slice 에서 수정 금지).
- [package.json](../../package.json) 의 `jest` 블록 — `testRegex`(`.*\.spec\.ts$`) · `collectCoverageFrom`(`src/**` 한정) 확인.
- 기존 helper + colocated spec 패턴 예: [test/helpers/realdata-e2e-daily-step-collect-command-plan.ts](../../test/helpers/realdata-e2e-daily-step-collect-command-plan.ts) 와 같은 이름의 `.spec.ts`.

## Acceptance Criteria

- [ ] `test/load/realdata-devset-logins.json` 신설 — `{"a": [...33개], "b": [...100개]}` 구조. 값은 위 정본 문서 `§A` · `§B` 표의 github login 을 표에 등장한 순서 그대로 옮긴 것이며 **가감·재정렬 0**.
- [ ] `test/helpers/realdata-devset-logins.ts` 신설 — 다음 3 개 public symbol 만 export:
  - `parseDevsetLogins(raw: unknown): { a: string[]; b: string[]; all: string[] }` — 순수 함수. `a` 33 개 · `b` 100 개 · 합집합 133 개 · 교집합 0 · 각 login 이 github 규칙(`/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/`)에 부합함을 검증하고, 위반 시 사유가 담긴 `Error` throw.
  - `loadRealdataDevsetLogins()` — 위 JSON 을 `fs` 로 읽어 `parseDevsetLogins` 에 통과시킨 결과 반환.
  - `resolveRealdataDevsetLogins(count?: number): string[]` — `all` 의 앞에서부터 `count` 개 반환(기본 133). `count` 가 정수가 아니거나 `< 1` 또는 `> 133` 이면 `RangeError`.
- [ ] `test/helpers/realdata-devset-logins.spec.ts` (colocated) 신설 — happy-path test: `loadRealdataDevsetLogins()` 가 `a` 33 · `b` 100 · `all` 133 을 반환하고 중복 0 임을 검증, `resolveRealdataDevsetLogins()` 기본 호출이 133 개를 반환함을 검증.
- [ ] error path test: `parseDevsetLogins` 에 잘못된 입력(`null` · 배열 · `a` 키 누락 · `a` 길이 32 · `b` 길이 99 · A/B 중복 1 건 · login 형식 위반 1 건)을 넣어 각각 `Error` 가 throw 되는지 **사유별 1+ test**.
- [ ] branch test: `resolveRealdataDevsetLogins` 의 분기(기본값 사용 / 명시 `count` 사용 / 범위 위반)를 각 1+ test 로 분리하고, `parseDevsetLogins` 의 검증 분기마다 1+ test.
- [ ] negative cases 충분 cover: `count = 0` · `count = 134` · `count = 1.5` · `count = NaN` · `count = -1` 각 1+ test 로 `RangeError` 확인.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 본 slice 는 `src/` 를 건드리지 않아 coverage 수치 불변임을 확인.

## Out of Scope

- Person / `ServiceIdentity` 를 실제로 DB 에 seed 하는 코드·스크립트 (다음 slice).
- `test/load/s1-batch.js` · `.github/workflows/load-k6.yml` · `package.json` 수정 — 본 slice 는 소비자 배선 0.
- github 실 수집(PAT 사용) · `assessment-collection` 호출 — 자격증명 gating 축이라 별도 결정 필요.
- `docs/ops/realdata-scale-devset.md` 본문 수정, PLAN · 부하계획 문서 doc-sync (별도 direct slice).
- `src/` 의 어떤 파일도 변경하지 않는다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- drift-guard slice: `docs/ops/realdata-scale-devset.md` 의 `§A` · `§B` 표를 파싱해 본 JSON 과 정확히 일치하는지 검증하는 consistency spec 1 개 (문서↔fixture 이중 정본 drift 차단).
- seed slice: 본 로더를 소비해 133 Person + github `ServiceIdentity` 를 부하 테스트용 DB 에 넣는 경로 (workflow step 또는 k6 setup).
