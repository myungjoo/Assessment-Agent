---
id: T-0262
title: ADR-0030 §2/§3 author 귀속 필터 순수 함수 — filterActivitiesByAuthor(activities, serviceIdentities)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-015, REQ-024]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0030 §5 cap-split slice iii-a — author 귀속 필터 순수 함수(Activity.author===externalId, source-type-aware) 분리. collectForPerson 진입(iii-b)이 소비."
---

# T-0262 — ADR-0030 §2/§3 author 귀속 필터 순수 함수 — filterActivitiesByAuthor(activities, serviceIdentities)

## Why

ADR-0030 §5 cap-split 의 slice ii(`buildCollectionSpec`)가 전부 머지됐다 — `buildCollectionSpec(person, since?): Promise<CollectionSpec>`(T-0261, e73355d) 이 GitHub(T-0260) + Confluence(`resolveConfluenceInstances`)를 결합한 `CollectionSpec` 을 산출한다. 남은 slice iii(`collectForPerson` 진입 + 영속화 결선 + author 필터)는 cap(≤300 LOC / ≤5 파일) 초과가 예상되어 ADR-0030 §5 가 명시한 대로 dependency-first 로 분할한다. 본 task 는 그 첫 micro-slice(iii-a) — **author 귀속 필터를 부수효과 0 의 순수 함수로 선분리** 한다.

ADR-0030 §2/§3 은 "Person 의 기여만 평가 대상이므로 수집된 활동을 그 Person 에 귀속"시켜야 하고, 그 귀속 key 는 `ServiceIdentity.externalId`(그 service 에서의 GitHub login / Confluence accountId)이며 "귀속/필터는 `Activity.author === externalId` 매칭으로 enumerate-호출처(또는 영속화 직전)에서 수행"한다고 박제했다. 수집된 `Activity` 는 이미 `author` 필드(외부 service ID)와 `sourceType`(github/confluence) discriminator 를 보유하므로(`src/assessment-collection/domain/activity.ts`), 본 필터는 `Activity[]` + Person 의 `ServiceIdentity[]` 만 입력으로 받는 순수·동기 함수로 표현 가능하다 — DI 0 / DB 0 / 네트워크 0. main 대조 결과 assessment-collection 에 author 귀속 필터(`Activity.author === externalId`)는 아직 0 이므로(기존 `externalId` 참조는 전부 activity 매퍼/도메인 식별자) 본 micro-slice 가 정당한 다음 단위다. README L13-14("Person 의 기여만 평가") + REQ-024(Person ID 매칭)를 cover 한다. 본 함수를 소비하는 `collectForPerson` 진입 + 영속화 결선은 slice iii-b 책임이다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §2(author 귀속 = `ServiceIdentity.externalId`, post-collection `Activity.author === externalId` 필터, `isPrimary` 는 author 매칭에 무관, 다중 GitHub identity 는 instance 별 externalId 로 독립 매칭), §3(Confluence author 귀속도 GitHub 과 동형 — Confluence Activity 의 author 를 Person 의 Confluence `ServiceIdentity.externalId` 와 매칭, 매칭 부재 시 그 Person 에 귀속 안 됨), §5(cap 분할 — slice iii 를 author 필터 / 진입 결선 으로 분리), §6(testing posture — negative: author 불일치 활동 제외 / 빈 ServiceIdentity).
- `src/assessment-collection/domain/activity.ts` — `Activity = GithubActivity | ConfluenceActivity` discriminated union. 본 task 가 필터할 입력 타입. 핵심: `ActivityBase.author`(활동 주체의 외부 service ID = GitHub login / Confluence accountId), `ActivityBase.sourceType`("github" | "confluence" discriminator), `ActivityBase.instanceKey`. 본 필터는 `author` 와 `sourceType` 만 읽어 매칭한다(다른 필드 불변).
- `src/assessment-collection/domain/github-repo-source.ts` L1-30 — 본 task 가 **mirror 할 도메인 순수 함수 패턴**(부수효과 0 / async 아님 / `@Injectable` 0 / 의존 0). 파일 head 주석 톤·책임 경계 명시 스타일·`ServiceIdentity` import 방식(`import type { ServiceIdentity } from "@prisma/client"`)을 참고. 단 로직은 본 task 고유(author 필터).
- `src/assessment-collection/domain/commit-dedup.ts` L1-20 — 동형 도메인 순수 필터 함수의 또 다른 reference(`Activity[]` → `Activity[]` 변환, 결정론적 순서 보존). describe/it 스타일은 colocated spec 참고.
- `prisma/schema.prisma` `model ServiceIdentity { personId, service, externalId, isPrimary }` — 본 필터의 두 번째 입력. `service`(어느 service instance 의 계정인가) + `externalId`(그 service 의 login/accountId)만 소비. `isPrimary` 는 author 매칭에 무관(ADR-0030 §2). 본 task 의 입력 타입은 전체 Prisma `ServiceIdentity` 가 아니라 `Pick<ServiceIdentity, "service" | "externalId">[]`(또는 그 super-set)로 좁혀 over-fetch 0.

## Acceptance Criteria

본 task 의 산출물은 `src/assessment-collection/domain/author-filter.ts`(부수효과 0 순수·동기 함수 모듈) + colocated `src/assessment-collection/domain/author-filter.spec.ts`(R-112 spec) 이다. `@Injectable` / DI / DB / 네트워크 0 — 도메인 순수 함수다(`github-repo-source.ts` / `commit-dedup.ts` 패턴 mirror).

- [ ] **순수 함수**: `filterActivitiesByAuthor(activities: Activity[], serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[]): Activity[]`(또는 동등 시그니처) 를 export. Person 의 ServiceIdentity 들로부터 귀속 가능한 externalId 집합을 구성하고, `activity.author` 가 그 집합에 속하는 활동만 남긴 새 배열을 반환한다(입력 순서 보존, 부수효과 0, 입력 배열 미변형).
- [ ] **source-type-aware 매칭(ADR-0030 §2/§3)**: GitHub 활동(`sourceType === "github"`)은 GitHub 계열 ServiceIdentity 의 externalId 와, Confluence 활동(`sourceType === "confluence"`)은 Confluence 계열 ServiceIdentity 의 externalId 와 매칭한다 — cross-source false-match(예: Confluence accountId 가 우연히 GitHub login 과 같아 GitHub 활동을 잘못 귀속)를 방지한다. ServiceIdentity 의 `service` 가 어느 source 계열인지 판정하는 규칙은 구현 판단(예: `sourceType` 별 service prefix/매핑 또는 `instanceKey` 대조) — 단 그 규칙을 함수 head 주석에 명시하고 test 로 cover. (현 단계에서 source 계열 판정이 ADR 보다 더 정교한 결정을 요구하면 가장 보수적인 안 = "같은 sourceType 의 활동은 그 sourceType 에 해당하는 externalId 와만 매칭" 을 택하고 그 가정을 주석·Follow-up 에 박제.)
- [ ] **isPrimary 무관(ADR-0030 §2)**: `isPrimary` 값은 author 매칭에 영향을 주지 않는다(같은 service 의 여러 identity 가 있어도 externalId 매칭만 본다). 본 함수는 `isPrimary` 를 읽지 않는다 — test 로 isPrimary=false identity 의 externalId 도 매칭됨을 확인.
- [ ] **다중 identity 독립 매칭(ADR-0030 §2)**: 한 Person 이 여러 GitHub instance 의 externalId(또는 GitHub + Confluence 혼합)를 가지면 각 externalId 가 독립적으로 그 source 계열 활동을 귀속한다 — test 로 2+ identity 입력 시 각각의 활동이 모두 남음을 확인.
- [ ] happy-path test 1+: GitHub identity + Confluence identity 를 가진 Person + 그 두 author 의 활동 + 무관한 author 의 활동이 섞인 입력 → 무관 author 활동만 제외되고 Person 의 GitHub/Confluence 활동은 모두 보존(입력 순서 유지) + 입력 배열이 변형되지 않음(원본 length 불변).
- [ ] error/negative test 1+ **각각**(ADR-0030 §6 + 분기마다 cover): (a) **빈 serviceIdentities** → 어떤 활동도 귀속 안 됨(빈 배열 반환, throw 0), (b) **author 전부 불일치**(Person 의 externalId 와 매칭되는 활동 0) → 빈 배열(throw 0), (c) **cross-source 동명 false-match 방지** — Confluence accountId == 어떤 GitHub login 인 상황에서 GitHub 활동이 Confluence identity 로 잘못 귀속되지 않음(source-type-aware 매칭 검증), (d) **빈 activities** → 빈 배열(throw 0), (e) **부분 매칭** — 같은 author 의 활동이 여러 건이면 전부 보존, 다른 author 활동은 전부 제외, (f) **isPrimary=false 매칭** — primary 가 아닌 identity 의 externalId 도 매칭됨.
- [ ] flow/branch cover: author 매칭 vs 불일치 / GitHub vs Confluence 활동 / 빈 identities vs non-empty / 빈 activities vs non-empty 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/domain/author-filter.spec.ts`(기존 domain/*.spec.ts colocated 패턴 정합 — `github-repo-source.spec.ts` / `commit-dedup.spec.ts` 와 동형). 입력 fixture 는 spec 안 helper(예: `githubActivity(...)` / `confluenceActivity(...)` literal factory)로 구성 — 공유 helper 추출 불요(단일 spec).

## Out of Scope

- **`collectForPerson` 진입 + 영속화 결선** — slice iii-b. 본 task 는 author 필터 순수 함수만 산출하고 `collectForPerson`/`buildCollectionSpec`/`collectAndPersist` 를 호출하거나 wiring 하지 않는다. (참고: `collectAndPersist` 는 현재 내부에서 collect→persist 를 한 번에 수행하므로, 본 author 필터를 그 사이에 끼우는 결선은 slice iii-b 가 영속화 경계를 재구성하며 결정한다 — 본 task 는 순수 함수 export 까지만.)
- **`buildCollectionSpec` / `CollectionSpec` 산출** — T-0261 완결(본 task 와 무관).
- **API-side `?author=` 필터(수집량 최적화)** — ADR-0030 §2/Alternatives 가 후속 최적화 slice 로 deferred. 본 task 는 post-collection 필터(정확성 우선)만.
- **Confluence Person→instance 매핑 변경** — ADR-0030 §3 대로 Confluence enumerate(instance 산출)는 활성 instance 전체 대상이고, author 귀속만 본 필터 책임. 본 task 는 enumerate 단계를 건드리지 않는다.
- **since 도출 / pass-through** — slice vi. 본 author 필터는 since 와 무관(활동의 author 만 본다).
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. 본 task 는 순수 함수라 애초에 네트워크/token 접근 0(literal fixture 만).
- **module 배선 / DI provider 등록** — 본 task 는 도메인 순수 함수 모듈이라 provider 등록 불요(@Injectable 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- slice iii-b: `collectForPerson(person, since?): Promise<Contribution[]>` 진입 — `buildCollectionSpec`(T-0261) 산출 → 두 source 수집(`Activity[]`) → 본 task 의 `filterActivitiesByAuthor` 적용 → 영속화(`collectAndPersist` 경계 재구성 또는 매퍼 직접 호출). `assessmentId` 주입 경계 결정 포함.
- slice vi: since 도출(직전 Assessment → since) — GitHub/Confluence 양쪽 pass-through.
- module 배선: enumerate chain service(`CollectionSpecService` 등)를 `AssessmentCollectionModule` provider 로 등록(별도 micro-slice 가능).
