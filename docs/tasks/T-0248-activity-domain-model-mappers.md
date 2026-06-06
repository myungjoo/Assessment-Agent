---
id: T-0248
title: Activity 도메인 모델 + raw→typed mapper 구현 (collection slice i)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-032, REQ-059]
estimatedDiff: 225
estimatedFiles: 5
created: 2026-06-06
plannerNote: P4 collection orchestrator effort 첫 구현 slice — ADR-0029 §2 Activity typed 모델 + 순수 mapper (의존성 0, R-112 backbone ×1.5)
---

# T-0248 — Activity 도메인 모델 + raw→typed mapper 구현 (collection slice i)

## Why

ADR-0029 가 Assessment collection orchestrator 설계 7 결정을 박제했고(main HEAD 88a3482), 구현은 Follow-ups 의 slice (i)~(vii)로 진행한다. 본 task 는 그 **첫 slice (i) = Activity 도메인 모델 + raw→typed mapper** 다 — orchestrator·module 배선·adapter 호출 없이 의존성 0 의 기반 layer 만 박제한다. raw `unknown` (GitHub commit/PR/issue 1 건, Confluence page 1 건) → typed `Activity` 변환을 **순수 함수 mapper** 가 단독 책임(ADR-0029 Decision §2 mapper 경계)으로 가지며, REQ-032 raw-not-stored 불변(typed 필드만 추출, raw 본문 미적재)을 application layer 에서 보존한다. 후속 slice (ii)/(iii) 수집 service 가 본 mapper 를 호출한다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` (특히 Decision §2 — Activity base + GithubActivity / ConfluenceActivity 필드 set + mapper 경계 + REQ-032 raw-not-stored 보존)
- `src/github/github-adapter.service.ts` (`request()` / `requestAllPages()` 가 반환하는 raw `unknown[]` shape — GitHub REST list endpoint item 형상 참조)
- `src/confluence/confluence-adapter.service.ts` (raw Confluence 응답 shape — `requestAllPages()` 의 `results[]` flatten 항목 형상 참조)
- `docs/architecture/data-model.md` (Contribution / Assessment entity 필드 + §4 raw-not-stored 불변 — Activity 필드가 후속 영속화에서 Contribution 으로 매핑될 위상)
- `docs/requirements.md` (REQ-032 — 🔥 Raw data 저장 금지, 평가 결과만 보유)

## Acceptance Criteria

본 task 는 typed 도메인 모델 + 순수 mapper 2 종 + colocated unit test 를 산출한다. 파일 위치는 ADR-0029 Decision §2 정합으로 `src/assessment-collection/domain/` 하위에 둔다(예: `domain/activity.ts`, `domain/github-activity.mapper.ts`, `domain/confluence-activity.mapper.ts` + 각 colocated `.spec.ts`). module 정의·`app.module.ts` 배선은 본 slice 밖(Out of Scope).

- [ ] **Activity typed 모델** — ADR-0029 Decision §2 대로 base `Activity` (공통 필드: `externalId` / `sourceType`(`"github" | "confluence"` discriminator) / `instanceKey` / `author` / `timestamp` / `metadata`) + `GithubActivity` (extends: `repoRef`, `kind`(`"commit" | "pr" | "issue"`)) + `ConfluenceActivity` (extends: `spaceRef`, `version`) 를 TypeScript interface/type 으로 정의. `sourceType` discriminated union 으로 두 변형을 구분.
- [ ] **github-activity.mapper** — raw `unknown` (단일 GitHub commit/PR/issue item) → `GithubActivity` 순수 함수. 누락/형식 오류 필드에 방어적(adapter 가 raw `unknown[]` 반환). raw 본문(commit message 전문 / diff 등)은 추출하지 않고 typed 식별 필드(SHA·author·timestamp 등)만 추출 — REQ-032 raw-not-stored.
- [ ] **confluence-activity.mapper** — raw `unknown` (단일 Confluence page item) → `ConfluenceActivity` 순수 함수. `_links` / `version.number` / page-id 등 typed 필드만 추출, page 본문 HTML 미적재. 누락/malformed 방어적.
- [ ] **(R-112-1) Happy-path unit test** — 두 mapper 각각에 정상 raw item fixture → 기대 typed Activity 반환 검증 1+.
- [ ] **(R-112-2) Error/negative path unit test** — 두 mapper 각각에 누락 필드 / 잘못된 type / 빈 객체 / null / 비-객체(primitive) / malformed 입력 각 1+ test. 단일 negative 만 작성 금지 — 방어 분기마다 cover(예: `externalId` 부재, `timestamp` 비-string, `version` 비-number 등 각각).
- [ ] **(R-112-3) Flow/branch coverage** — mapper 안 방어 분기(필드 존재/타입 검사 각 분기)마다 test branch 분리.
- [ ] **(R-112-4) raw-not-stored 단언** — 각 mapper 의 출력 Activity 에 raw 본문(commit message 전문 / page 본문 HTML 등)이 포함되지 않음을 명시 검증하는 test 1+ (예: 기대 출력 객체 key 집합이 typed 필드로 한정됨, 또는 raw body 가 주입돼도 출력에 누출 0).
- [ ] **(R-112-5) Coverage** — `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] **colocated spec 위치** — spec 은 대상과 colocated(`src/assessment-collection/domain/<file>.spec.ts`). 공유 fixture 가 2+ spec 에 걸치면 `test/helpers/` 또는 domain 하위 fixture 모듈로 추출.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.

## Out of Scope

- orchestrator entry service(`collectForPerson`) — slice (v).
- `AssessmentCollectionModule` 정의 + `app.module.ts` import 배선 — slice (iv).
- `GithubInstanceClient` / `ConfluenceSpaceTraversalService` 호출 / instance·org·repo·SPACE loop — slice (ii)/(iii).
- dedup(SHA earliest-wins / page-id+version latest) — slice (ii)/(iii).
- incremental "since" 도출 — slice (vi).
- Activity → Contribution 영속화 / Contribution repository 호출 / Prisma — slice (v).
- **live / credentialed 수집 테스트** — Q-0025 결정대로 UI 이후로 deferred. 본 slice 는 mocked/fixture 입력 unit test 만, 실 GitHub/Confluence 호출 0.
- 기존 adapter / instance-client / space-traversal service 동작 변경 — 본 slice 는 그들의 반환 shape 만 참조한다.
- modules.md / data-model.md 동기 갱신 — slice (vii) direct doc-sync.

## Suggested Sub-agents

`implementer → tester` (typed 모델 + 순수 mapper 는 ADR-0029 가 이미 설계를 박제했으므로 architect 불요. mapper 경계/필드 set 은 ADR 결정 그대로 구현).

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append. effort 의 후속 slice (ii)~(vii)는 T-0247 Follow-ups 에 이미 박제됨.)
