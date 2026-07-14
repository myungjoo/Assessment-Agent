---
id: T-0979
title: eval-chain activity-map 매핑을 독립 oracle 재유도로 대조하는 consistency drift-guard 순수 helper + colocated spec 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-14
mergedAs: 52170fed
prNumber: 873
reviewRounds: 1
independentStream: realdata-e2e-eval-chain
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-eval-chain-activity-map-consistency.ts
  - test/helpers/realdata-e2e-eval-chain-activity-map-consistency.spec.ts
plannerNote: "P5 §109 test-hardening — T-0978 로 추출한 activity-map helper 에 sibling 관례인 -consistency drift-guard 부재. 매핑 규칙(kind 사영·fallback·metadata R-59)을 독립 oracle 로 재유도 대조. test-only pr-mode 2파일 dep[] file-disjoint stage5b 병렬."
---

# T-0979 — eval-chain activity-map 매핑 consistency drift-guard

## Why

PLAN.md 109행(실 github myungjoo/leemgs 수집 → 로컬 Ollama 실 LLM 평가 e2e)의 수집 leg 에서, 실 github `/users/{user}/events/public` 응답 1 건을 도메인 `GithubActivity` 로 매핑하는 로직을 T-0978 이 `test/helpers/realdata-e2e-eval-chain-activity-map.ts`(`mapRealDataGithubEventToActivity`)로 추출·봉했다. 이 helper 는 event type→kind 사영(PullRequestEvent→pr / IssuesEvent→issue / else→commit), externalId/timestamp/repoRef 방어적 fallback, `metadata` 는 typed scalar 만(raw 본문 폐기, R-59)이라는 **결정론적 매핑 규칙의 단일 지점**이다.

문제는 이 helper 가 이 스트림의 sibling helper 들이 갖춘 `-consistency.ts` **독립 drift-guard 를 아직 갖지 못했다**는 점이다(형제 `realdata-e2e-eval-chain-consistency.ts` T-0976 은 producer 조립 규칙에 대해 이미 이 가드를 가진다). 매핑 규칙이 향후 편집으로 조용히 바뀌면(예: kind 사영 대상 event type 오타, externalId fallback "unknown"→"" 변경, metadata 에 raw 본문 키가 섞여 R-59 위반, repoRef fallback 형식 변형), colocated unit spec 만으로는 그 회귀가 spec 도 함께 수정되면 통과할 수 있다. 본 task 는 그 빈칸을 **독립 oracle 재유도**로 채운다 — 가드가 kind/externalId/timestamp/repoRef/metadata/상수 필드 규칙을 helper 와 무관하게 재유도한 뒤 `mapRealDataGithubEventToActivity` 출력과 deep-equal(byte-identical) 대조하면, 어느 한쪽 규칙이 drift 하는 순간 fail 한다. 순수 함수 가드라 항상 CI 실행(env-gating 무관), 새 dependency 0, `src/` 변경 0(T-0976 leg-경계 mirror).

## Required Reading

- `test/helpers/realdata-e2e-eval-chain-activity-map.ts` (T-0978) — 검증 대상. `mapRealDataGithubEventToActivity(username, event)` 계약: kind 사영 3 분기, externalId(string→그대로 / else→`String(event.id ?? "unknown")`), timestamp(string→그대로 / else→epoch), repoRef(`repo.name` string→그대로 / else→`${username}/unknown-repo`), 상수 필드(sourceType="github", instanceKey="github.com", author=username), `metadata.titleLength = type.length`. 이 규칙을 그대로 독립 재유도할 대상.
- `test/helpers/realdata-e2e-eval-chain-consistency.ts` (T-0976) — 미러할 consistency-guard 패턴: 구조 결손 = TypeError / 값 정합 위반 = RangeError, fail-fast throw, silent 통과 0, 비변형(입력 mutate 0), 순수(부수효과 0). describe() 라벨 헬퍼 + assert*Structure + 재유도 대조 2단 구조.
- `test/helpers/realdata-e2e-eval-chain-consistency.spec.ts` (T-0976) — colocated spec 의 R-112 4종 배치(happy/error/branch/negative + 구조 결손 케이스) 미러 참조.
- `src/assessment-collection/domain/activity.ts` — `GithubActivity` 타입 shape(kind union, sourceType, instanceKey, author, timestamp, metadata, repoRef, externalId 필드) 확인용(read-only import, 변경 0).
- colocated spec 위치: `test/helpers/realdata-e2e-eval-chain-activity-map-consistency.spec.ts` (신규 helper 옆 colocated — 저장소 관례, T-0976 `-consistency.spec.ts` 동형).

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-eval-chain-activity-map-consistency.ts` 신설 — **순수** drift-guard 함수 1개(예: `assertRealDataGithubEventActivityMappingConsistent(username, event, activity, descriptor)`). `mapRealDataGithubEventToActivity` 를 호출하지 **않고**(그러면 자기 자신 대조라 무의미) kind 사영 / externalId / timestamp / repoRef / 상수 필드 / metadata 규칙을 **독립 재구현(oracle)** 해 expected `GithubActivity` 를 산출한 뒤, 인자로 받은 `activity` 가 expected 와 deep-equal(모든 필드 byte-identical)인지 대조한다. 위반 시 fail-fast throw(구조 결손 = TypeError, 값 정합 위반 = RangeError, 메시지 한국어 + 어긋난 필드명 정보). 네트워크/LLM/DB/env 읽기 0, 입력(username/event/activity) mutate 0.
- [ ] `test/helpers/realdata-e2e-eval-chain-activity-map-consistency.spec.ts` 신설(colocated) — R-112 4종 커버(항상 CI 실행):
  - **Happy-path**: 실제 `mapRealDataGithubEventToActivity` 출력을 가드에 넘겨 정합 시 void(throw 0) — (i) PullRequestEvent(kind=pr), (ii) IssuesEvent(kind=issue), (iii) 그 외 type(kind=commit) 각각에 대해 정합 통과 1+.
  - **Error path**: helper 출력을 의도적으로 손상시킨 activity(예: `kind` 를 다른 값으로 교체, `externalId` 변경, `author` 를 다른 username 으로 교체, `metadata.titleLength` drift) 주입 → 가드가 RangeError throw 하는지 각 손상 유형 1+.
  - **Flow/branch cover — 분기마다 1+**: (i) kind 3 분기(pr/issue/commit) 재유도 대조, (ii) externalId string vs 비string(`String(...)` / "unknown" fallback) 분기, (iii) timestamp string vs 비string(epoch fallback) 분기, (iv) repoRef `repo.name` string vs 누락(`${username}/unknown-repo` fallback) 분기.
  - **Negative 충분 cover — 예외 상황 분기마다 1+**: (a) `activity` 비객체/null → TypeError, (b) `event` 비객체/null → TypeError, (c) `username` 비string → TypeError, (d) `metadata` 에 raw 본문 키(payload 전문/body 등)가 섞여 있음 → RangeError(typed scalar 만 허용, R-59), (e) 상수 필드 drift(sourceType≠"github" 또는 instanceKey≠"github.com") → RangeError(필드명 포함), (f) repoRef fallback 형식 drift(`${username}/unknown-repo` 아님) → RangeError.
  - **§9 secret-safety**: fixture/activity/에러 메시지 어디에도 실 secret/token/apiKey 미등장(비시크릿 username·event 메타만) assert 1+.
- [ ] **§9 / R-59 격리**: 실 credential 값을 spec/helper 어디에도 적지 않는다(event fixture 는 type/id/created_at/repo.name 만 담는 더미 구조). raw 활동 본문(payload 전문·commit message·diff·issue body)을 파일/전역에 저장하지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). 가드·spec 모두 순수/결정론이라 완전 커버.

## Out of Scope

- `test/helpers/realdata-e2e-eval-chain-activity-map.ts`(T-0978) 본문 수정 0 — import·재유도 대조·throw 만(재정의 0). 특히 `mapRealDataGithubEventToActivity` 반환 직전 self-assert 배선(self-wire)은 본 task 밖(별도 후속 slice, dependsOn 본 task — T-0977 self-wire mirror).
- `test/smoke/realdata-e2e-eval-chain-live.smoke-spec.ts` 및 형제 consistency helper 수정 0.
- `src/` production 코드 변경 0(`GithubActivity` 타입 read-only import). `package.json`/lockfile/CI workflow 변경 0. 새 외부 dependency 도입 0.
- 자동 복구/재합성/기본값 채움 0 — 손상 activity 를 고치지 않고 fail-fast throw(복구는 호출처 책임). JSON schema/zod/ajv 도입 0(순수 비교만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- 본 가드의 self-wire(=`mapRealDataGithubEventToActivity` 반환 직전 `assertRealDataGithubEventActivityMappingConsistent` 자체 호출로 매핑 즉시 자가 검증) 배선은 후속 slice 로 분리(T-0977 self-wire mirror, dependsOn 본 task).
- §109 잔여(변경 없음): (1) 실 credential 주입 하 credentialed live run 1 회(운영/env 층), (2) `deploy/daily-test.sh` step_eval 이 full-chain smoke 를 트리거하도록 재배선 — 둘 다 credential/env 게이트라 별도 큐잉.
