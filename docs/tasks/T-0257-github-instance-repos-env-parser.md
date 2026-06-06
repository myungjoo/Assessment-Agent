---
id: T-0257
title: GithubInstanceConfig 에 repos 필드 + _REPOS env parser 확장
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-06-06
status: DONE
completedAt: 2026-06-06T17:42:00+09:00
prNumber: 220
mergeCommit: d445db5
result: PR-220 squash merge d445db5 (loop@AKIHA-s67 t9). GithubInstanceConfig.repos 필드 + GITHUB_REPOS_SUFFIX + resolveGithubInstances 의 _REPOS comma/space parser + spec +11 _REPOS test + token-decrypt spec literal repos:[]. reviewer APPROVE(0 findings), CI green, 4-게이트 PASS. +172/-1 (3 파일), github-instance-config.ts coverage 100%.
plannerNote: P4 collection enumerate(ADR-0030 §5 cap-split slice i) — _REPOS env parser + repos 필드. 순수 함수 확장, dependency-first 첫 slice. R-112 backbone ×1.5.
---

# T-0257 — GithubInstanceConfig 에 repos 필드 + _REPOS env parser 확장

## Why

ADR-0030(assessment collection enumerate 설계)이 Decision §1 에서 GitHub repo source 의 두 모드를 박제했다 — 모드 B(지정 repo, 우선): instance 별 `GITHUB_<KEY>_REPOS` env allowlist, 모드 A(org 전체, fallback): allowlist 미설정 시 런타임 org enumerate. ADR-0030 Decision §5 의 cap-split 은 dependency-first 첫 slice 로 **(i) `_REPOS` env parser 확장 + `GithubInstanceConfig.repos` 필드** 를 명시했다. 본 task 는 그 slice (i) 만 — `resolveGithubInstances` 순수 함수를 확장해 `_REPOS` suffix 를 파싱하고 `GithubInstanceConfig` 에 `repos: string[]`(빈 배열 = 미설정) 필드를 추가한다. README L15-18 의 "지정 Organization 내 전체 Repository, 혹은 지정 Repository" 두 모드 product 요구(REQ-005~008)의 config-표현 backbone 이다.

## Required Reading

- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — Decision §1(repo source 정책: 모드 B env allowlist `GITHUB_<KEY>_REPOS` comma/space `org/repo` 또는 `repo` 토큰 우선) + §5(cap-split slice i 책임 경계). 본 task 는 §1 의 `repos` 필드·`_REPOS` suffix shape 만 박제.
- `src/github/github-instance-config.ts` — 확장 대상. `GithubInstanceConfig {key,host,orgs,tokenEnc}` interface + `resolveGithubInstances` 순수 함수 + `GITHUB_HOST_SUFFIX`/`GITHUB_ORG_SUFFIX`/`GITHUB_TOKEN_ENC_SUFFIX` suffix 상수 + `githubEnvName` 조립 함수 + `isPresent` guard. `_ORG` 를 comma-split + trim 하는 기존 로직(L128~134)을 mirror 해 `_REPOS` 파싱.
- `src/github/github-instance-config.spec.ts` (colocated) — 기존 R-112 spec 스타일(`setInstance` helper, happy/error/negative describe 구조, 실값 0 fixture). 본 task 의 `_REPOS` test 를 여기 colocated 로 추가.
- `src/github/github-token-decrypt.spec.ts` L85~99 — `GithubInstanceConfig` literal 을 직접 생성하는 유일한 spec(L90). `repos` 필드 추가 시 이 literal 의 컴파일 경계 확인 대상.

## Acceptance Criteria

- [ ] `GithubInstanceConfig` interface 에 `repos: string[]` 필드 추가 — 빈 배열 = 미설정(모드 B 미적용). JSDoc 으로 "빈 배열 = `_REPOS` 미설정 → 모드 A(org 전체 enumerate) fallback 대상" 명시(ADR-0030 §1 정합, 한국어).
- [ ] `GITHUB_REPOS_SUFFIX = "_REPOS"` suffix 상수 추가(기존 `GITHUB_ORG_SUFFIX` 패턴 mirror, export).
- [ ] `resolveGithubInstances` 가 각 활성 key 의 `githubEnvName(key, GITHUB_REPOS_SUFFIX)` env 를 읽어 comma/space-separated 토큰을 split + trim + 빈 토큰 제거해 `repos` 에 채운다(기존 `_ORG` comma-split 로직 mirror 하되 ADR-0030 §1 의 comma/space 둘 다 구분자 — `_ORG` 는 comma-only 였으나 `_REPOS` 는 `org/repo` 또는 `repo` 토큰을 공백·콤마 모두로 구분). `_REPOS` 미설정/빈/공백-only → 빈 배열.
- [ ] 기존 `resolveGithubInstances` 의 `_HOST`/`_ORG`/`_TOKEN_ENC` 동작·시그니처·reject 로직 불변 — `repos` 필드만 추가. 기존 happy/reject/중복/대소문자 test 가 회귀 없이 통과(`repos` 미설정 시 빈 배열 포함).
- [ ] **Happy-path test** — `GITHUB_<KEY>_REPOS` 설정 시 `repos` 배열에 토큰이 정확히 매핑(단일 토큰 / 다중 토큰 / `org/repo` 형식 / `repo` 형식 모두). 다른 필드(host/orgs/tokenEnc/key)는 기존 그대로 보존.
- [ ] **Error/negative path test 충분 cover (예외 분기마다 1+)** — (a) `_REPOS` 부재 → `repos` 빈 배열, (b) `_REPOS` 빈 문자열/공백-only → 빈 배열, (c) comma-separated 토큰 split, (d) space-separated 토큰 split, (e) 혼합 구분자(comma+space) split, (f) trailing comma/연속 구분자/빈 토큰 무시(빈 문자열 미생성), (g) `_REPOS` 설정됐으나 그 instance 가 필수 env(_HOST/_TOKEN_ENC) 부재로 reject 되면 instances 에 미포함(repos 가 reject 를 막지 않음).
- [ ] **Flow/branch coverage** — `_REPOS` present 분기와 부재 분기 각 1+ test(`isPresent` guard 양쪽).
- [ ] `github-token-decrypt.spec.ts` L90 의 `GithubInstanceConfig` literal 이 `repos` 필드 누락으로 컴파일 깨지면 그 literal 에 `repos: []` 1 줄 추가(consumer 회귀 방지 — 이 spec 의 test 의도는 token 복호라 `repos` 는 빈 배열로 무관). repos 를 optional 로 하지 말고 required + 빈 배열로 통일(ADR-0030 "빈 배열 = 미설정" 정합).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(`github-token-decrypt` 등 기존 consumer 컴파일 회귀 0).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%).

## Out of Scope

- `buildCollectionSpec`(ADR-0030 §5 slice ii — Person→instance 매핑 + repo source 산출) 구현 — 본 task 밖.
- `collectForPerson`(slice iii — 진입 계약 + 영속화 결선 + author 필터) 구현 — 본 task 밖.
- 모드 A 의 실 repo enumerate(`requestAllPagesForInstance("orgs/{org}/repos")` 새 caller) — 본 task 는 config shape 만, 런타임 enumerate 호출 0.
- `org/repo` 토큰의 의미 해석(org 부분 분리·검증) — 본 task 는 토큰 문자열을 그대로 `repos` 배열에 보관만(파싱·검증은 slice ii 책임). 토큰 정규화/소문자화 안 함.
- `GithubInstanceConfig` consumer(`github-instance-client.service.ts`/`github-token-decrypt.ts`)의 동작 변경 — `repos` 필드를 읽는 신규 로직 0(token-decrypt spec literal 의 `repos: []` 추가는 컴파일 회귀 방지일 뿐 동작 무관).
- prisma schema / DB / 새 dependency / credential 변경 — 0(env 파싱 순수 함수 확장). Q-0025 live enumerate deferred.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)
