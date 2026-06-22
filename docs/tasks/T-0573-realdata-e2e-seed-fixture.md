---
id: T-0573
title: 실 평가 e2e 시드 픽스처 빌더 — myungjoo / leemgs github.com Person+ServiceIdentity 순수 helper
phase: P5
status: DONE
prNumber: 486
mergedAs: 33d2086
commitMode: pr
coversReq: [REQ-023, REQ-009]
estimatedDiff: 120
estimatedFiles: 2
created: 2026-06-22
independentStream: p5-realdata-e2e
dependsOn: []
touchesFiles: [test/helpers/realdata-e2e-seed-fixture.ts, test/helpers/realdata-e2e-seed-fixture.spec.ts]
plannerNote: "P5 실 평가 e2e bullet(109행) step ① seed — github.com myungjoo/leemgs Person+ServiceIdentity 순수 픽스처 빌더(LAN/live-LLM/credential 무관, build-time 완결)"
---

# T-0573 — 실 평가 e2e 시드 픽스처 빌더 (myungjoo / leemgs)

## Why

[PLAN.md](../PLAN.md) Phase P5 의 새 bullet (109행, 2026-06-22 사용자 지정) — "실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동" 의 **step ①** (두 사용자를 테스트 Person 으로 seed, github.com `ServiceIdentity` = username) 만을 cover 한다. 본 task 는 그 seed 입력을 **순수 함수 픽스처 빌더**로 박제한다 — 어떤 LAN/live-LLM/credential 도 build-time 에 요구하지 않으므로 cloud cron 에서 완결 가능한 dependency-free slice 다. 후속 step ②(실 수집)·③(로컬 Ollama 실 LLM 평가)·④(daily-test step_eval)은 LAN/credential-gated 로 deferred 유지 — 본 helper 가 그들의 입력 계약을 미리 고정해 둔다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) 109행 (실 평가 e2e bullet — 4 step 중 step ① 범위)
- `prisma/schema.prisma` 의 `model Person` (L55~) 와 `model ServiceIdentity` (L247~) — 필드 (`fullName`/`email`/`active`, `service`/`externalId`/`isPrimary`) + `@@unique([personId, service])` invariant
- `test/helpers/auth-e2e-helper.ts` — 기존 e2e helper 의 순수-함수 / colocated spec 스타일 참고
- `docs/decisions/ADR-0006-person-service-identity-model.md` (있으면 §person/service-identity 모델 — service 토큰 표기 "github.com", primary key 역할 ID R-47)

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-fixture.ts` 신설 — **순수 함수** `buildRealDataE2eSeed()` (또는 동등) 가 두 사용자의 seed descriptor 배열을 반환한다. 각 descriptor 는 `{ person: { fullName, email, active }, serviceIdentities: [{ service: "github.com", externalId, isPrimary }] }` 형태. `externalId` 는 각각 `"myungjoo"` / `"leemgs"` (github.com username = ServiceIdentity externalId, R-47 primary key 역할 — github.com ID 를 isPrimary=true 로 지정). 실 네트워크 호출 0, env 읽기 0 — 결정론적 상수 빌더.
- [ ] 반환값에 **raw 활동 데이터 없음** (R-59) — username/Person 메타데이터만. commit/PR/issue 본문 등 raw 는 포함 금지 (주석으로 R-59 명시).
- [ ] `buildRealDataE2eSeed()` 에 happy-path unit test 1+ — 정확히 2 descriptor 반환, 각 externalId 가 `myungjoo`/`leemgs`, service 가 모두 `"github.com"`, github.com identity 가 isPrimary=true 검증.
- [ ] error/negative path test 1+ — (분기가 없는 순수 상수 빌더이면) 반환 객체의 **불변성/무공유** 검증: 두 번 호출한 결과가 서로 다른 객체 참조이거나(호출 간 mutation 격리), email 이 모두 `@@unique` 위반 없는 distinct 값임을 검증. 빈/중복 externalId 가 산출되지 않음을 단언.
- [ ] flow/branch cover — 분기 있으면 각 분기 1+ test. **분기 없는 순수 상수 빌더면 "분기 없음 — 이 항목 생략" 을 spec 주석 또는 본 task 본문에 명시**.
- [ ] negative cases 충분 cover — descriptor 가 schema invariant 를 위반하지 않음을 분리 단언: (a) 동일 person 내 동일 service 중복 없음 (`@@unique([personId, service])` 정합), (b) email 빈 문자열 아님, (c) externalId 빈 문자열 아님, (d) fullName 빈 문자열 아님. 각 1+ test.
- [ ] colocated spec `test/helpers/realdata-e2e-seed-fixture.spec.ts` 신설 (helper 와 동일 디렉토리).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 순수 함수라 100% 도달 용이.

## Out of Scope

- 실 github.com API 호출 / 수집 (step ② — LAN/credential gate, 별도 후속).
- 로컬 Ollama 실 LLM 평가 (step ③ — LAN gate, ADR-0045).
- `deploy/daily-test.sh` 의 `step_eval` 추가 (step ④ — deploy/credential gate, 별도 후속).
- DB 에 실제 seed upsert 하는 runner/script (본 task 는 **데이터 빌더 순수 함수**만 — DB write 배선은 후속).
- Person/ServiceIdentity service/repository 변경 (기존 계약 재사용, 본 task 는 test helper 만).
- schema.prisma 변경 0 (기존 모델로 충분).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
