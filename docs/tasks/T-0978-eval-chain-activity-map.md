---
id: T-0978
title: eval-chain full-chain live smoke 의 github event→도메인 Activity 매핑을 순수 helper 로 추출 + R-112 spec
phase: P5
status: DONE
mergedAs: d452bb8a
prNumber: 872
reviewRounds: 1
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 150
estimatedFiles: 3
created: 2026-07-14
independentStream: realdata-e2e-eval-chain
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-activity-map.ts
  - test/helpers/realdata-e2e-eval-chain-activity-map.spec.ts
  - test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts
plannerNote: "P5 §109 real-data e2e hardening — T-0975 reviewer MINOR(mapEventToActivity live-only branch) 봉합: 매핑을 순수 helper 로 추출해 항상-CI 실행화. pr test-only 3파일 stage5b 병렬."
---

# T-0978 — eval-chain full-chain live smoke 의 github event→도메인 Activity 매핑을 순수 helper 로 추출 + R-112 spec

## Why

PLAN.md 109행 "실 평가 e2e 테스트 데이터 = github.com myungjoo/leemgs" leg 의 full-chain smoke(`realdata-e2e-eval-chain-live.smoke-spec.ts`, T-0975)는 실 github `/users/{user}/events/public` 응답 1 건을 도메인 `GithubActivity` 로 매핑하는 `mapEventToActivity` 를 **spec 파일 안 inline 로컬 함수**로 두고 있다. 이 함수는 event type→kind 사영(PullRequestEvent→pr / IssuesEvent→issue / else→commit) + raw 본문 폐기 후 typed scalar 만 추출(R-59)이라는 **결정론적 분기 로직**을 담지만, 오직 env-gated `describeLive` 분기 안에서만 실행돼 **public CI 에서는 skip-by-default — 항상-실행 unit test 가 이 분기를 전혀 커버하지 않는다**. T-0975 reviewer 가 이 지점을 MINOR("mapEventToActivity live-only branch follow-up-worthy")로 명시 catch 했다. 본 task 는 그 매핑 로직을 순수 helper 로 추출하고 colocated R-112 spec 으로 봉해, live/skip 여부와 무관하게 CI 가 매 실행마다 이 경계를 검증하도록 한다(T-0975 producer 추출 패턴 mirror).

## Required Reading

- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` — 현 inline `mapEventToActivity` (59~89행) + 소비처(154~159행). 추출 대상 원본.
- `src/assessment-collection/domain/activity.ts` — `GithubActivity` 타입 정의(kind union, metadata, repoRef, sourceType 등 필드).
- `test/helpers/realdata-e2e-eval-chain.ts` — 형제 producer helper(T-0975). 파일 헤더 주석 스타일 · §9/R-59 격리 · 순수성 · 방어적 guard 관례를 그대로 따른다.
- colocated spec 위치: `test/helpers/realdata-e2e-eval-chain-activity-map.spec.ts` (신규 helper 옆 colocated — NestJS/저장소 관례, T-0975 `realdata-e2e-eval-chain.spec.ts` 동형).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain-activity-map.ts` 신규 — 순수 함수 `mapRealDataGithubEventToActivity(username: string, event: Record<string, unknown>): GithubActivity` 를 export. inline 원본과 동일 계약: event.type→kind 사영(pr/issue/commit), externalId/timestamp/repoRef 방어적 fallback, `metadata` 는 typed scalar 만(raw 본문 미포함, R-59), author=username. `process.env` 읽기 0 · 네트워크/DB 호출 0 · 입력 mutate 0(매 호출 새 객체).
- [ ] `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 를 rewire — inline `mapEventToActivity` 제거 후 신규 helper 를 import 해 소비(단일 source-of-truth). 기존 full-chain 검증 흐름·assert 는 그대로 보존.
- [ ] happy-path unit test 1+ — `mapRealDataGithubEventToActivity` 가 정상 event(각 3 종 type)를 올바른 `GithubActivity` 로 매핑(kind 사영 정확, author=username, sourceType="github", instanceKey="github.com").
- [ ] error/negative path unit test — 각 분기·비정상 입력 각 1+: (a) `type` 누락/비string → kind="commit" fallback, (b) `id` 누락/비string → externalId String 변환·"unknown" fallback, (c) `created_at` 누락 → epoch fallback, (d) `repo` 누락/`repo.name` 비string → `${username}/unknown-repo` fallback, (e) PullRequestEvent→pr / IssuesEvent→issue / 그 외 문자열→commit 3 분기 각각.
- [ ] R-59 격리 검증 test 1+ — `metadata` 에 raw payload 전문/본문 키가 실리지 않고 typed scalar(titleLength 등)만 존재함을 assert.
- [ ] 순수성 test 1+ — 동일 입력 2 회 호출 시 서로 다른 새 객체 반환(참조 비동일) + 입력 event 객체 unmutated.
- [ ] 분기 각각 test branch 분리(위 kind 3 분기 + 4 fallback 분기 각 1+ — negative cases 충분 cover).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper line/branch/function 100% 목표.
- [ ] `pnpm lint && pnpm build && pnpm test` green.

## Out of Scope

- consistency drift-guard(`-consistency.ts` oracle) 신설 — 형제 T-0976/977 패턴의 별도 후속 leg. 본 task 는 producer 추출 + R-112 spec + smoke rewire 만.
- `src/` production 코드 변경(0 LOC — `GithubActivity` 타입 read-only import 만).
- 실 네트워크/실 LLM round-trip 로직 변경 — full-chain smoke 의 수집/평가 흐름은 그대로.
- 새 외부 dependency 추가.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(없음 — 생성 시 비움. 후속으로 activity-map consistency drift-guard oracle(T-0976 mirror) 신설이 자연스러운 다음 leg 후보.)
