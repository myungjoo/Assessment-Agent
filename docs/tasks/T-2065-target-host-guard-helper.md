---
id: T-2065
title: 등록 수집 대상 허용 host ① — 판정 함수 신설
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: bbe61867
prNumber: 1626
reviewRounds: 2
commitMode: pr
coversReq: [REQ-072]
estimatedDiff: 285
estimatedFiles: 3
created: 2026-10-31
dependsOn: [T-2064]
touchesFiles: [src/collection-target/target-host-guard.ts, src/collection-target/target-host-guard.spec.ts, test/e2e/collection-target-effective.e2e-spec.ts]
plannerNote: P7 · ADR-0059 §Consequences (e) 봉합 arc ① — 소유자 위임 결정 (fail closed, key 별 허용 host env)
---

# T-2065 — 허용 host 판정 함수

## Why

ADR-0059 §Consequences (e) — 등록 row 의 `endpoint` 는 Admin 이 고치고 형식 제약이 없는데, 수집 시 `<KEY>_TOKEN_ENC` 를 복호해 그 host 로 보낸다. 앱 권한으로 배포 secret 을 얻는 경로다. env 에 key 별 허용 host 를 둬서 일치할 때만 token 을 쓰게 한다. 이 task 는 판정 규칙만 만든다.

## Required Reading

- ADR-0059 §Decision 2 · §Consequences (e), `src/github/github-request.builder.ts` `normalizeHost` · `resolveGithubApiBaseUrl`, `src/confluence/confluence-request.builder.ts`.

## Acceptance Criteria

- [ ] `GITHUB_<KEY>_ALLOWED_HOST` / `CONFLUENCE_<KEY>_ALLOWED_HOST` 값과 URL 파서의 host 로 비교한다. 미설정 · 형식 오류 · 불일치는 거부다.
- [ ] 우회 입력을 unit 으로 고정한다: suffix, path, userinfo, backslash, fragment, query, 대소문자, port, 끝 점.
- [ ] port 규칙 명시: `host` 허용은 443 만, `host:8443` 허용은 그 port 만, `:443` 은 생략과 같다.
- [ ] Confluence 는 https URL 만, GitHub 는 `host[:port]` 또는 `https://host[:port]` 만 받는다. `http://` 는 거부한다.
- [ ] 통과 시 정규화 값을 돌려준다. 거부 사유에 endpoint 원문을 싣지 않는다.
- [ ] 후속 T-2066 이 enforcement 를 켜도 깨지지 않게 `collection-target-effective` e2e 에 허용 host env 를 미리 넣는다. 동작 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- 수집 경로 배선 — T-2066. e2e · redirect · 문서 — T-2067, T-2068. 새 dependency · schema 변경 0.

## Follow-ups

- **소비처 동반 예외 (CLAUDE.md §3)**: 소비처 포함 시 estimatedDiff 약 555 (판정 285 + 배선과 단위 test 270) 로 300 LOC cap 을 넘는다. 소비처 slice 는 T-2066 — `effective-instances.ts` 의 `mergeRegistered` · `mergeGithubInstances` · `mergeConfluenceInstances` 배선.
