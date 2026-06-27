---
id: T-0709
title: realdata-e2e result-issue-descriptor title·marker ↔ run 식별자 single-source 재유도 정합 가드 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-06-27
plannerNote: P5 L109 실 평가 e2e — buildRealDataResultIssueDescriptor 의 title·marker 합성(body 가드 T-0646 명시 제외 영역) 독립 재유도 가드 신설, T-0707 mirror, dependsOn [] 독립
independentStream: realdata-e2e-result-issue-descriptor-identity-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.ts
  - test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.spec.ts
---

# T-0709 — realdata-e2e result-issue-descriptor title·marker ↔ run 식별자 single-source 재유도 정합 가드 신설

## Why

PLAN.md P5 L109 (실 github.com 공개 활동 = 실 평가 e2e 입력) 사슬의 build-time 정합 가드 사슬을 한 칸 더 닫는다. `buildRealDataResultIssueDescriptor(summary, run)` (`test/helpers/realdata-e2e-result-issue-descriptor.ts`, T-0582 박제) 은 daily-test 결과 이슈의 `{ title, marker, body }` descriptor 를 합성하는데, 그 중 **`body`** 3 블록 구조 불변식은 이미 `assertRealDataResultIssueDescriptorBodyConsistent` (T-0646) 가 self-wire 로 강제한다. 그러나 그 body 가드는 **자기 책임 경계 주석(line 35) 에서 `title` / `marker` 합성 규칙 자체의 재검증을 명시적으로 제외** 한다 ("marker 는 body 첫 라인과의 일치만 비교, marker 합성 규칙 자체 재검증 아님"). 즉 `title = ${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}` 와 `marker = ${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->` 의 **합성 규칙** — ① title/marker 가 동일 run token(`${dateToken}@${gitSha}`) 을 공유 / ② summary 와 무관하게 동일 run 이면 title·marker 동일 (멱등 search-or-update 의 핵심, REQ-032) / ③ prefix 고정 / ④ 빈/공백-only gitSha·dateToken 은 비식별 박제 방지로 거부 — 는 컴포저 본문 주석과 happy-path 단언으로만 박제돼 있고, **런타임에서 강제되는 독립 재유도 가드가 부재** 하다. 손상된 식별자 (예: title 과 marker 의 run token 이 어긋나거나, marker 가 다른 run token 을 담아 멱등 검색이 깨지는) descriptor 가 실 gh issue search-or-update 분기로 새기 전 fail-fast throw 로 차단한다.

issue-still-relevant pre-check (origin/main grep):

- `git grep -in "descriptor-identity-consistency\|DescriptorTitleMarker\|TitleMarkerConsistent\|DescriptorIdentityConsistent" origin/main` → **매칭 0 (부재 확인)**. title·marker 재유도 정합 가드 심볼·파일 모두 origin/main 부재.
- 기존 `realdata-e2e-result-issue-descriptor-body-consistency.ts` (T-0646) 는 **body 3 블록 구조에 한정** — line 35 에서 `title`/`marker` 합성 규칙 재검증을 명시 제외. body 가드는 marker 를 "body 첫 라인과의 일치" 로만 비교하며 marker 가 올바른 run token 으로 합성됐는지는 검증하지 않음. → title·marker single-source 재유도는 genuine NO-GUARD gap, make-work 아님.

본 task 는 backlogNote 가 명명한 잔여 NO-GUARD leaf (result-issue-descriptor) 의 미cover 영역(title·marker identity) 을 닫는다. T-0707 live-gating 가드 신설의 mirror (NO-GUARD leaf 가드 신설 → 후속 self-wire 짝 분리 패턴).

## Required Reading

- `test/helpers/realdata-e2e-result-issue-descriptor.ts` — `buildRealDataResultIssueDescriptor` 컴포저 본체. 특히 `ISSUE_TITLE_PREFIX` (62행) · `ISSUE_MARKER_PREFIX` (66행) 상수, `runToken(run)` = `${run.dateToken}@${run.gitSha}` (90~94행), title·marker 합성 (126~128행), `assertNonBlank` 빈/공백 거부 규칙 (97~108행), 반환 타입 `RealDataResultIssueDescriptor` (`{ title, marker, body }`, 84~88행) 과 `RealDataResultIssueRunRef` (72행).
- `test/helpers/realdata-e2e-result-issue-descriptor-body-consistency.ts` — 기존 body 가드 (T-0646). **책임 경계 주석(line 35) 의 title/marker 제외 선언** 확인 + 에러 정책 (구조 결손 TypeError ↔ 값 정합 위반 RangeError 분리) · `describe(value)` 라벨 helper · 한국어 JSDoc·책임 경계 주석 톤을 **mirror**.
- `test/helpers/realdata-e2e-live-gating-consistency.ts` — 직전 sibling 가드 (T-0707). single-source 독립 재유도 → deep 대조 패턴, 에러 분리, 입력 비변형 보장 패턴 참고.
- `test/helpers/realdata-e2e-live-gating-consistency.spec.ts` — colocated spec 구조 (happy-path / 구조 결손 negative / 값 정합 negative / 비변형·결정론) 패턴 참고.
- (colocated spec 위치) 신규 spec 은 `test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.spec.ts` 에 둔다 — NestJS·discoverability convention, sibling 가드와 동일 위치.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-result-issue-descriptor-identity-consistency.ts` 신설 — 순수 함수 `assertRealDataResultIssueDescriptorIdentityConsistent(descriptor, run)` export. 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM·실 네트워크 호출 0 / 입력 비변형 (descriptor·run 읽기·비교만) / 동일 입력 → 동일 동작.
- [ ] 가드는 `run` (gitSha·dateToken) 으로부터 expected title·marker 를 **컴포저 재호출 없이 독립 재유도** 한다 — run token (`${dateToken}@${gitSha}`) 과 prefix 결합 규칙을 자체 재구현 (`ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX` 상수는 컴포저에서 import 재사용, 합성 로직은 독립 재유도) 해 expected `title` / `marker` 를 산출한 뒤, 인자로 받은 `descriptor.title` / `descriptor.marker` 와 byte-identical 대조. 또한 title·marker 가 **동일 run token 을 공유** 하는지 (멱등 불변식) 교차 검증.
- [ ] **에러 정책 분리** — `descriptor`·`run` 객체·필드의 구조/타입 결손 (null/array/비-string `title`·`marker`·`gitSha`·`dateToken` 등) 은 **TypeError**, 재유도 값 정합 위반 (title mismatch / marker mismatch / title·marker run token 불일치 / prefix 어긋남) 은 **RangeError** 로 구분. 한국어 메시지.
- [ ] **빈/공백 식별자 거부 mirror** — 컴포저의 `assertNonBlank` 규칙대로 `run.gitSha` / `run.dateToken` 이 빈/공백-only 면 (비식별 박제 방지) RangeError 또는 명시적 throw 로 거부 — 가드는 그런 run 을 정상으로 통과시키지 않는다.
- [ ] Happy-path unit test 1+ — `assertRealDataResultIssueDescriptorIdentityConsistent` 에 정상 합성 descriptor (`buildRealDataResultIssueDescriptor` 산출물) + 동일 run 입력 시 정상 통과 (void 반환). summary 가 달라도 동일 run 이면 동일 title·marker 임을 검증하는 멱등 happy-path 1+.
- [ ] Error path unit test 1+ — descriptor 가 null/undefined·비객체·`title`/`marker` 비-string·run 필드 타입 결손일 때 TypeError throw (구조 결손 분기 각 1+).
- [ ] Flow / branch coverage — title 재유도 분기 / marker 재유도 분기 / title·marker run token 교차 검증 분기 / 빈-식별자 거부 분기 각각 test 1+.
- [ ] Negative cases 충분 cover — 각 1+ test: (1) `descriptor.title` 이 expected 와 불일치 (prefix 변형 / token 변형) → RangeError, (2) `descriptor.marker` 가 expected 와 불일치 → RangeError, (3) title 과 marker 가 **서로 다른 run token** 을 담은 경우 (멱등 깨짐) → RangeError, (4) marker 의 닫는 `-->` 누락·prefix 어긋남 → RangeError, (5) 빈 문자열/공백-only gitSha·dateToken run → 거부 throw, (6) 입력 객체 비변형 (가드 호출 후 descriptor·run 동일성 유지).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 가드 파일 cov 충족.
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 결과 확인.

## Out of Scope

- `buildRealDataResultIssueDescriptor` 컴포저 본문 수정 / self-wire 배선 (가드를 컴포저 return 직전 호출) — **후속 별도 task** (T-0707→T-0708 self-wire 분리 패턴 mirror). 본 task 는 순수 가드 helper + colocated spec 까지.
- `body` 3 블록 구조 재검증 — 이미 T-0646 `assertRealDataResultIssueDescriptorBodyConsistent` 가 담당. 본 가드는 title·marker identity 에만 한정 (중복 0).
- `ISSUE_TITLE_PREFIX`·`ISSUE_MARKER_PREFIX` 상수 값·run token 합성 규칙 변경 0 (가드는 컴포저 규칙을 mirror 재유도만, 재정의 0).
- result-summary / live-gating leaf 가드 (이미 T-0705 / T-0707 로 신설 완료) — 재작업 0.
- production `src/` 변경 / DB write·migration / live LLM 호출 / zod·ajv 등 외부 validation 라이브러리 도입 — 전부 0.
- 자동 복구 / descriptor 재합성 / 정규화 / 기본값 채움 0 — 손상 descriptor 는 fail-fast throw (복구는 호출처 책임).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
