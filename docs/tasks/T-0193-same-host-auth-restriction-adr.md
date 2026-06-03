---
id: T-0193
title: ADR-0019 박제 — pagination cursor 의 same-host Authorization 전송 제약 정책 (GitHub/Confluence adapter 공통)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-044, REQ-059]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-03
completedAt: 2026-06-03T15:29:21+09:00
prNumber: 173
reviewRounds: 2
mergedAs: 8ab3c6b
plannerNote: P4 ms3 security hardening 1차 slice — T-0188 reviewer MINOR(cross-host auth-leak) 의 same-host 제약 정책 ADR. 가드 구현은 Follow-up.
---

# T-0193 — ADR-0019 박제: pagination cursor 의 same-host Authorization 전송 제약 정책

## Why

P4 milestone-3 의 두 adapter (`GithubAdapter`, `ConfluenceAdapter`) 는 pagination 순회 시 서버가 준 **opaque next cursor URL** 을 동일한 `headers`(= `Authorization` token 포함)로 그대로 fetch 한다. 그런데 그 cursor URL 은 응답 본문/헤더에서 오는 **서버측(잠재적 공격) 제어값**이라, instance base host 와 다른 host 를 가리키는 cursor 가 오면 `Authorization` 헤더(credential)가 **foreign host 로 leak** 될 수 있다. 이는 T-0188 reviewer 가 MINOR finding 으로 사전 식별한 follow-up 후보다. README 의 instance 별 권한 분리(REQ-044) + 본 시스템의 secret 비노출 규율(CLAUDE.md §9)을 transport 계층에서 방어하기 위해, "cursor URL 의 host 가 base host 와 다르면 Authorization 을 어떻게 처리하는가"를 코드보다 먼저 ADR 로 박제한다(CLAUDE.md §1 "코드보다 ADR이 먼저다", §3.1 rule 4 "새 ADR = pr-mode"). 본 task 는 정책 ADR 만 박제하고, 실제 두 adapter 의 가드 구현/test 는 Follow-up 으로 분리한다(전체 remedy = ADR + 2 가드 + 양쪽 test 가 cap 초과).

## Required Reading

- `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` (§3 auth header shape, §5 Link pagination — 본 ADR 이 그 위에 same-host 제약을 얹음. 형식·frontmatter 참고)
- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` (§5 `_links.next` body cursor — 절대 URL 이 base 를 무시하는 지점이 leak vector)
- `src/github/github-adapter.service.ts` (L201~301 `requestAllPages`/`fetchAndMap`/`parseNextLink` — opaque next URL 을 동일 headers 로 fetch 하는 leak vector 현 코드. 가드 부재 확인용)
- `src/confluence/confluence-adapter.service.ts` (L67~96 `parseNextCursor`: `new URL(next, baseUrl)` 가 절대 URL 시 base 를 무시 / L267~322 `requestAllPages`: 동일 headers 로 fetch. leak vector 현 코드)
- `docs/architecture/INDEX.md` (ADR row 박제 형식 — 본 ADR row 추가)
- `CLAUDE.md` §9 (secret 비노출 규율), §3.1 (commitMode 판정 — 새 ADR = pr)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0019-same-host-auth-restriction-for-pagination.md` 신설. frontmatter (id/title/status: PROPOSED/date/relatedTask: T-0193/supersedes: null) + 본문(Context / Decision / Consequences / Alternatives)을 ADR-0016/0018 형식으로 박제.
- [ ] **Decision §1 "same host" 정의** — cursor URL 과 instance base URL 의 동일 host 판정 기준을 명시: scheme + host(case-insensitive) + port (명시 port / scheme default port 정규화 포함) 3 요소 비교. subdomain 취급(엄격 동일 host vs base host 의 subdomain 허용 여부)도 결정·근거 명시.
- [ ] **Decision §2 mismatch 시 동작 결정** — host 불일치 cursor 를 만났을 때의 동작을 단일 결정으로 박제: (후보) Authorization 헤더를 drop 하고 진행 / 순회를 abort(부분 수집 반환) / 도메인 error throw. 셋 중 택일 + 근거(credential 비노출 우선 vs 수집 완전성 vs 호출처 가시화)를 명시. partial-collection / PermissionDeniedEvent 등 기존 이벤트 위상과의 정합도 기술.
- [ ] **Decision §3 적용 범위** — 본 정책이 GitHub(`parseNextLink` 산출 Link rel=next URL)·Confluence(`parseNextCursor` 산출 `_links.next` 절대/relative URL) **양쪽 adapter 에 공통 적용**됨을 명시. 두 adapter 의 cursor 출처 차이(header vs body)를 동일 host-check 로 수렴시키는 경계 기술.
- [ ] **Decision §4 token 비노출 정합** — host-check 실패 시에도 token 평문이 error message / event / 로그에 노출되지 않음(CLAUDE.md §9)을 invariant 로 박제.
- [ ] `docs/architecture/INDEX.md` 의 ADR 목록에 ADR-0019 row 추가(id / title / status PROPOSED / relatedTask T-0193), 기존 row 형식 정합.
- [ ] `tester` 가 `pnpm lint && pnpm build && pnpm test` 통과 확인(R-110 — 코드 변경 0 LOC 이어도 doc/ADR task 의 tester 호출 의무. ADR/INDEX 는 markdown 이라 build/test 영향 0 이어야 함).
- [ ] 분기 없음 — 본 task 는 ADR/doc 박제만으로 production code 0 LOC. R-112 의 unit test(happy/error/branch/negative)·coverage 항목은 **코드 변경이 없으므로 본 task 에서 생략**(가드 구현 Follow-up task 에서 full R-112 cover). 본 항목 명시로 §3.2 의도 충족.

## Out of Scope

- 두 adapter (`github-adapter.service.ts`, `confluence-adapter.service.ts`) 의 **실제 same-host 가드 코드 구현** — 본 task 는 정책 ADR 박제만. 구현은 Follow-up (adapter 당 1 task, full R-112 test 동반).
- `parseNextLink` / `parseNextCursor` 의 시그니처 변경이나 host-check 로직 추가.
- 새 외부 dependency 추가(URL 비교는 Node 내장 `URL` 로 충분 — Q-0017 제약 "새 dependency 0" 유지).
- live token / 실 네트워크 통합(§5 credential 게이트 — 미승인 deferred).
- PermissionDeniedRecord entity / DB schema 변경(chain row8, §5 schema 게이트).
- ADR status 를 ACCEPTED 로 flip(PROPOSED 로 박제 — ACCEPTED 전이는 구현 머지 후 별도 direct task, ADR-0016/0018 패턴).

## Suggested Sub-agents

`architect` (ADR 정책 결정·박제 — same host 정의 + mismatch 동작 + 양쪽 적용 + token 비노출 invariant) → `tester` (lint/build/test green 확인).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가. 예정: (1) GithubAdapter same-host 가드 구현+test, (2) ConfluenceAdapter same-host 가드 구현+test, (3) 구현 머지 후 ADR-0019 status ACCEPTED flip(direct).)
