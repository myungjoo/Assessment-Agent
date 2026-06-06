---
id: T-0252
title: Activity → ContributionCreateInput 순수 매퍼 추가 (ADR-0029 slice v-a)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-033, REQ-009, REQ-015, REQ-031]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-06
plannerNote: P4 ADR-0029 slice (v) split — orchestrator entry+영속화가 cap 초과라 dependency-first 순수 매퍼만 큐잉, 나머지는 Follow-ups
---

# T-0252 — Activity → ContributionCreateInput 순수 매퍼 추가 (ADR-0029 slice v-a)

## Why

ADR-0029 Decision §6 은 수집된 `Activity` 를 기존 `Contribution` entity 로 1:1 매핑(새 컬럼/migration 0)하도록 결정했다. 이는 README REQ-033(commit·문서별 기여 데이터 영속) + REQ-032(raw-not-stored 불변) 을 수집 layer 에서 구현하는 핵심 backbone 이다. slice (v) 전체(orchestrator entry + Person enumerate + 두 collection service 호출 + 영속화)는 colocated spec 포함 시 ≤300 LOC / ≤5 파일 cap 을 초과하므로, **dependency-first 단위인 순수 매퍼**(`Activity` → `ContributionCreateInput` 변환, 부수효과·영속화·orchestration 0)만 본 task 로 분리한다. 나머지(entry·영속화·incremental since)는 §Follow-ups 로 박제한다. 이 매퍼는 기존 `github-activity.mapper` / `confluence-activity.mapper`(domain/) 의 순수-함수 패턴을 mirror 한다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — 특히 Decision §2(Activity 도메인 모델 + raw-not-stored mapper 경계) + Decision §6(Activity → Contribution 영속화 매핑 표) + §Consequences negative 1(평가 필드 placeholder transient 상태).
- `src/assessment-collection/domain/activity.ts` — `Activity` discriminated union(`GithubActivity`: `repoRef`/`kind`(commit|pr|issue), `ConfluenceActivity`: `spaceRef`/`version`; base 의 `externalId`/`sourceType`/`instanceKey`/`author`/`timestamp`/`metadata`).
- `src/user/contribution.repository.ts` — `ContributionCreateInput` 의 7 키(`assessmentId`/`sourceType`/`sourceUrl`/`sourceRef`/`difficulty`/`contributionScore`/`volume`) shape. 본 매퍼의 출력 타입.
- `src/user/contribution.service.ts` — `VALID_SOURCE_TYPES = ["commit","pr","document"]` + `VALID_DIFFICULTIES = ["easy","medium","hard"]`. **중요**: 매퍼가 산출하는 `sourceType`/`difficulty` 는 이 허용 집합과 정합해야 `ContributionService.create` 가 BadRequestException 없이 통과한다. ADR-0029 §6 의 `"github:commit"` 예시 literal 은 이 기존 validator 와 충돌하므로, 본 task 는 GitHub `kind`(commit/pr/issue) → `"commit"`/`"pr"` 매핑 + Confluence → `"document"` 매핑으로 기존 `VALID_SOURCE_TYPES` 에 정합시킨다(아래 Acceptance Criteria 참조).
- `src/assessment-collection/domain/github-activity.mapper.ts` (앞 30줄) — mirror 할 순수-함수 + 파일 헤더 주석 스타일.
- `src/assessment-collection/domain/github-activity.mapper.spec.ts` — colocated spec 위치/스타일 참조(본 task 의 spec 도 `src/assessment-collection/domain/` 에 colocated).

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/activity-contribution.mapper.ts` 신설 — 순수 함수 `mapActivityToContribution(activity: Activity, assessmentId: string): ContributionCreateInput` export. 부수효과 0 / 외부 의존 0(NestJS `@Injectable` 미사용, Prisma·repository import 0). 헤더 주석은 기존 mapper 스타일로 ADR-0029 §6 근거 박제.
- [ ] **sourceType 매핑**: `GithubActivity.kind === "commit" → "commit"`, `=== "pr" → "pr"`, `=== "issue" → "pr"`(issue 는 기존 `VALID_SOURCE_TYPES` 에 별도 literal 부재 — issue→`"pr"` 흡수를 헤더 주석에 ADR-0029 §6 정합 근거로 명시; 또는 매퍼가 issue 를 별도 처리하되 반드시 `VALID_SOURCE_TYPES` 멤버로만 산출). `ConfluenceActivity → "document"`. **반드시 `ContributionService.VALID_SOURCE_TYPES`(commit/pr/document) 멤버만 산출** — 그 외 literal 산출 금지.
- [ ] **참조 식별 필드(REQ-032 raw-not-stored 보존)**: `sourceRef = activity.externalId`(GitHub SHA / Confluence 는 `${externalId}@${version}`), `sourceUrl` 은 참조 식별자(repo/page 식별자 기반 — raw 본문 0). raw 본문(commit message·page HTML) 을 입력 받지 않고 산출하지 않음을 spec 으로 검증.
- [ ] **평가 필드 placeholder(ADR-0029 §6 + §Consequences negative 1)**: `difficulty`/`contributionScore`/`volume` 는 수집 시점 미정 — placeholder 상수(예: `difficulty = "easy"`(VALID_DIFFICULTIES 멤버), `contributionScore = 0`, `volume = 0`)로 채우되, **placeholder 임을 헤더 주석에 명시**(P5 평가가 채움). placeholder difficulty 는 반드시 `VALID_DIFFICULTIES` 멤버.
- [ ] colocated spec `src/assessment-collection/domain/activity-contribution.mapper.spec.ts` 추가.
- [ ] **Happy-path test**: GithubActivity(commit) → `sourceType="commit"` + sourceRef=SHA + assessmentId 전달, ConfluenceActivity → `sourceType="document"` + sourceRef=`id@version` 각 1+ happy test.
- [ ] **Branch test**: `kind` 의 commit/pr/issue 각 분기 1+ test + GithubActivity vs ConfluenceActivity discriminator 분기 1+ test(각 분기가 정확한 `sourceType` 산출 검증).
- [ ] **Error/negative cases 충분 cover**: (1) 산출된 `sourceType` 이 `VALID_SOURCE_TYPES` 멤버임을 모든 분기에서 assert, (2) 산출된 `difficulty` 가 `VALID_DIFFICULTIES` 멤버임을 assert, (3) raw 본문 누출 0 — 반환 객체 키가 `ContributionCreateInput` 7 키로만 구성됨을 assert(여분 키·raw body 키 부재), (4) Confluence `version` 이 sourceRef 에 정확히 합성됨을 경계값(version=0·큰 수)으로 검증, (5) `assessmentId` 가 빈 문자열/임의 값일 때 그대로 pass-through 됨(검증은 service-layer 책임이므로 매퍼는 throw 0)을 검증. 각 1+ test.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 + `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- orchestrator entry(`collectForPerson(person, since?)`) / Person 의 instance×org×repo·SPACE enumerate — slice (v-b)(Follow-up).
- 두 collection service(`GithubCollectionService`/`ConfluenceCollectionService`) 실제 호출·조립 — slice (v-b).
- `Contribution` 실제 영속화(`ContributionService.create`/`ContributionRepository.create` 호출) — slice (v-c).
- `AssessmentCollectionModule` 에 새 provider 추가·배선 변경 — slice (v-b/v-c)(본 task 는 순수 함수 1개 + spec 만, module 미변경).
- incremental `since` 도출 — slice (vi).
- `ContributionService`/`ContributionRepository`/기존 `VALID_SOURCE_TYPES` 정의 **수정 금지**(매퍼가 거기에 정합시킬 뿐).
- live/credentialed 수집 — Q-0025 대로 UI 이후 deferred.
- modules.md row 9 reconcile doc-sync — slice (vii).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (slice v-b) orchestrator entry — `collectForPerson(person, since?)` 진입점 + Person 의 ServiceIdentity 별 instance×org×repo / Confluence instance enumerate + 두 collection service 호출 → `Activity[]` aggregate(영속화 전). `AssessmentCollectionModule` 에 orchestrator service provider 배선.
- (slice v-c) Contribution 영속화 — v-a 매퍼 + v-b aggregate 를 받아 `ContributionService.create`(또는 repository) 로 `Contribution[]` 영속화. 평가 필드 placeholder transient 상태(nullable vs 0)의 표현 결정. assessmentId 부재/FK 위반 negative cover.
- (slice vi) incremental since 도출 — 직전 Assessment → `since` 계산 + 경계값(동일 timestamp·미래·빈 결과) negative cover.
- (slice vii) modules.md row 9 `AssessmentModule` 수집/평가 분리 reconcile doc-sync(direct).
