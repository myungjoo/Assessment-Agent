---
id: ADR-0063
title: rebase/meld 로 commit ID 가 갈린 "내용물" 중복 제거 정책 — mapper 경계 content fingerprint (sha256) + (author, 지문) 합성 키
status: ACCEPTED
date: 2026-09-07
relatedTask: [T-1943, T-1944, T-1945, T-1946, T-1947]
relatedReq: [REQ-009, REQ-032]
supersedes: null
augments: [ADR-0029]
---

# ADR-0063 — rebase/meld 내용물 중복 제거 정책 (commit content fingerprint)

## Status

**ACCEPTED**. `§ Follow-ups` (a)~(c) 의 구현 chain 이 **전량 머지** 돼 본 ADR 의 결정이 main 에 안착했다 — (a) 지문 helper 신설 + mapper 배선 (T-1944, PR #1526 → merge `ae03ac5b`) · (b) dedup pass 2 신설 + 수집 flow 2-pass 직렬 합성 (T-1945, PR #1527 → merge `1b7b9c2f`) · (c) 제거 건수 관측 로그 (T-1946, PR #1528 → merge `85641398`). **남은 구현 항목은 없다** — `§ Follow-ups` 의 "(확장 지점, task 아님)" 은 task 가 아니라 재검토 조건이라 미착수 그대로 남는다. 본 문서의 ACCEPTED 승격 · [requirements.md](../requirements.md) REQ-009 재판정 · [PLAN.md](../PLAN.md) `99 행` 갱신은 T-1947 이 수행했다 ((d)).

작성 시점 (PROPOSED) 의 성격은 기록으로 보존한다 — 본 ADR slice 자체는 **결정만 박제** 했고 코드를 1 LOC 도 만들지 않았다 (그 slice 의 diff 는 본 문서 1 개뿐이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` 변경이 **0** 이었다). 지문 helper 신설 · mapper 배선 · `commit-dedup.ts` 의 dedup pass 추가 · 관측 배선을 전부 `§ Follow-ups` 로 이월한 것이 그 선택이다 ([ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) 의 doc-only ADR 선례 동형).

본 ADR 은 [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) 를 **augment** 한다 — 그 `§ Decision (4)` 의 식별자 기반 dedup 전략 (commit = SHA earliest-wins / Confluence page = page-id + version latest-wins) 은 **그대로 유효** 하고, 본 ADR 은 그 뒤에 붙는 **두 번째 pass 1 개** 를 추가할 뿐이다. 기존 결정을 뒤집는 부분은 없다 (supersede 0).

## Context

### 공백 — README R-21 의 세 축 중 하나가 코드에 없다

[README.md](../../README.md) `21 행` 은 중복 제거를 세 축으로 지시한다: (i) fork 로 인한 내용물 중복, (ii) **"Meld되거나 Rebase되어 commit ID는 다르지만 중복된 내용물"**, (iii) 시간적 중복 (2 월 결과물이 3 월 timestamp 로 나타나면 2 월 기여로 판단).

(i) 과 (iii) 은 [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) 에 실재한다 — `40~46 행` `dedupKey` 가 commit 을 `commit:<SHA>` **단일 키** 로 만들어 repo 경계를 지우므로 fork 로 같은 SHA 가 여러 repo/instance 에 나타나는 경우가 잡히고, `72 행` `isEarlier(activity.timestamp, current.timestamp)` 의 earliest-wins 가 시간적 중복 축을 충족한다.

(ii) 는 **잡히지 않는다**. rebase / meld 는 정의상 commit SHA 를 재작성하므로 `commit:<SHA>` 키가 갈라지고, 두 활동은 서로 다른 dedup 키를 갖는 별개 기여로 남는다. [requirements.md](../requirements.md) `28 행` REQ-009 행이 이 공백을 이미 실측 박제했다 — "내용 hash / diff 유사도 기반 dedup 은 `src/` 전체에 부재" (`similarity` · `contentHash` · `diffHash` 어느 심볼도 `src` 이하 `*.ts` 에서 매칭 0). 평가-side [evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) 도 `17~19 행` 주석이 "fork/rebase/meld 구조적 중복은 수집-side commit-dedup 책임" 이라고 경계를 박아 두어, 이 축을 받을 자리는 수집-side 한 곳뿐이다.

### 왜 구현이 아니라 ADR 이 먼저인가

결정해야 할 것이 구현 방식이 아니라 **정책** 이기 때문이다.

1. **REQ-032 와의 관계가 선결이다.** 내용 지문은 정의상 raw 본문 (commit message) 에서 나온다. [data-model.md](../architecture/data-model.md) `§ 4` 의 raw 미저장 invariant 와 [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) `§ Decision (2)` 의 "raw 는 매핑 직후 폐기" 경계를 어디서 어떻게 지킬지 확정하지 않으면 mapper 에 손댈 수 없다.
2. **오탐이 곧 기여 삭제다.** 지문 dedup 이 제거하는 것은 화면 표시가 아니라 **평가 입력 1 건** 이다. "fix typo" 같은 상투적 메시지가 서로 다른 실제 기여를 하나로 접으면 그 사람의 기여가 조용히 사라진다. 키 합성과 하한 규칙은 코드보다 먼저 못박아야 한다.
3. **기존 시간 규칙과의 적용 순서** 도 정책이다 — ADR-0029 `§ Decision (4)` 의 earliest-wins 를 새 pass 가 승계하는가, 두 pass 의 순서는 무엇인가.

### 새 dependency 0 · schema 변경 0

지문 산출 수단은 Node 내장 `crypto` `createHash("sha256")` 로 충분하다 — [export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `22 행` import · `176 행` `createHash("sha256").update(canonical, "utf8").digest("hex")` 가 이미 사내 선례이며 그 파일 `11~16 행` 주석이 "Node 내장 `crypto` 만 사용해 새 외부 dependency 0" 을 명시한다. 따라서 CLAUDE.md `§ 5` 의 새-dep 게이트 · schema 게이트 어느 쪽도 침범하지 않는다.

## Decision

### § Decision 1 — 지문 산출 지점: mapper 의 raw→typed 경계

**채택: 지문은 [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) 의 raw→typed 경계에서 산출하고, 입력이 된 raw 본문은 그 자리에서 폐기한다.**

- 산출 위치는 `119~131 행` `buildMetadata` 계열 — 즉 raw `Record<string, unknown>` 이 아직 손 안에 있는 유일한 지점이다. `mapGithubActivity` 가 반환하는 `GithubActivity` 에는 **digest 문자열만** 실리고, raw commit message 는 반환 객체 어디에도 남지 않는다 (raw 객체는 ADR-0029 `§ Decision (2)` 대로 매핑 직후 폐기되는 in-memory transient).
- 산출 수단은 **Node 내장 `crypto` 의 `createHash("sha256")`**, 출력은 hex digest **64 자 전량** (절단 없음 — 절단은 충돌 확률을 올리는데 얻는 것이 문자 수뿐이라 채택하지 않는다).
- 산출 로직 자체는 mapper 본문이 아니라 **순수 helper 파일 1 개** (`commit-content-fingerprint.ts`) 로 분리한다 — 정규화 규칙 (§ Decision 2) 이 단위 테스트 표면을 가지려면 mapper 의 raw 파싱과 섞이면 안 된다. mapper 는 그 helper 를 **호출만** 한다.
- **비-commit 활동 (pr / issue) 은 지문을 산출하지 않는다** (§ Decision 6).

근거 — 지문을 dedup pass 안에서 산출하면 그 시점에는 이미 raw 가 없다 (`dedupGithubActivities` 의 입력은 typed `GithubActivity[]`). raw 를 dedup 까지 끌고 가는 대안은 REQ-032 표면을 넓히므로 반대 방향이다 (§ Alternatives A).

### § Decision 2 — 정규화 규칙 (digest 입력 문자열)

**채택: digest 입력은 "정규화된 commit message" 단일 문자열이며, 정규화는 아래 5 규칙을 이 순서로 적용한다.**

| # | 규칙 | rebase/meld 가 무엇을 바꾸는가 (근거) |
| --- | --- | --- |
| 1 | 개행 정규화 — `\r\n` · `\r` → `\n` | rebase 를 다른 platform/클라이언트에서 수행하면 개행 표현만 바뀌는 경우가 있고, 그것은 기여 내용의 차이가 아니다. |
| 2 | trailer 제거 — 각 행이 `Signed-off-by:` · `Change-Id:` · `Reviewed-on:` · `(cherry picked from commit <sha>)` 중 하나에 매칭하면 그 행을 제거 (행 단위 · 대소문자 무시) | 이 trailer 들은 **rebase / cherry-pick / gerrit meld 가 삽입하거나 지우는 metadata** 다. 원본과 재작성본의 유일한 차이가 이 행인 경우가 rebase 중복의 전형이다. `Co-authored-by:` 는 **제거하지 않는다** — 그것은 기여자 구성이라 내용의 일부다. |
| 3 | 행 내 연속 공백 (space · tab) → 단일 space, 연속 빈 행 → 단일 `\n` | 재작성 과정에서 wrap 폭 · 들여쓰기가 바뀌어도 문장은 같다. |
| 4 | 앞뒤 trim (문자열 전체 + 각 행 끝) | 편집기·도구가 trailing whitespace 를 붙이거나 떼는 것은 내용 차이가 아니다. |
| 5 | **대소문자는 보존한다** (lowercase 정규화 미채택) | rebase / meld 는 메시지의 대소문자를 바꾸지 않는다. 반대로 소문자화는 서로 다른 기여를 접을 확률만 올린다 — 얻는 것이 없는 오탐 확대라 채택하지 않는다. |

- **diff / 파일 목록은 digest 입력에 넣지 않는다 (v1).** GitHub commits list 응답에는 파일 목록이 없어 per-commit 상세 호출 (N+1) 이 필요하고, 그 raw 를 mapper 까지 끌고 오는 것은 REQ-032 표면 확대다. 파일 경로 축의 편입은 § Follow-ups 의 확장 지점으로만 남긴다.
- 정규화 결과가 **빈 문자열** 이면 지문을 산출하지 않는다 (§ Decision 4 의 하한 규칙에 흡수).

### § Decision 3 — 저장 형태와 REQ-032 관계

**채택: 지문은 `Activity.metadata` 의 scalar 1 개로만 실리고, 영속 컬럼은 신설하지 않는다.**

- 키는 `contentFingerprint`, 값은 hex digest **문자열** — [activity.ts](../../src/assessment-collection/domain/activity.ts) `42 행` `ActivityMetadataValue = string | number | boolean | null` 계약을 그대로 지킨다 (객체 그래프 유입 0).
- **raw quote 가 아니다.** 저장되는 것은 비가역 sha256 digest 이며 원문 복원이 불가능하다. [activity.ts](../../src/assessment-collection/domain/activity.ts) `38~41 행` 주석이 금지한 것은 "raw quote (commit message 전문 / page 본문 HTML 등)" 이고, digest 는 `titleLength` (길이 number) 와 같은 계열의 **파생 typed 보조값** 이다.
- **[prisma/schema.prisma](../../prisma/schema.prisma) 에 컬럼을 신설하지 않는다.** [data-model.md](../architecture/data-model.md) `§ 4` 는 "Contribution entity 동일 — 개별 commit/문서 단위에서도 raw 본문 미저장. 외부 GitHub/Confluence URL + commit SHA / page version ID 등 참조 식별자만 보유" 라고 못박았고, 지문은 참조 식별자가 아니라 **pre-persistence 연산의 중간값** 이다. 따라서 지문의 수명은 `수집 → mapper → dedup pass → 폐기` 로 **in-memory 전용** 이며, ADR-0029 `§ Decision (4)` 가 규정한 "DB unique constraint 와는 별개의 application-layer pre-persistence dedup" 성격을 그대로 승계한다.
- 결과적으로 본 ADR 은 raw 미저장 invariant 의 **새 위반 0** 이며, CLAUDE.md `§ 5` 의 schema 게이트도 건드리지 않는다. 지문을 영속화하고 싶어지는 시점 (예: 재수집 간 cross-run dedup) 은 **별도 ADR 필수** 다 — 본 ADR 은 그 문을 열지 않는다.

### § Decision 4 — dedup 키 합성 + 오탐 차단

**채택: `content:<author>:<digest>` — 지문 단독이 아니라 `(author, 지문)` 합성 키.** 시간창 제한은 미채택.

- **author 를 키에 넣는 이유**: 지문 단독 키는 서로 다른 사람이 같은 메시지로 한 별개 기여 (템플릿 · 자동 생성 · 동일 문서 수정) 를 접는다. 반면 rebase / meld 는 author 를 보존하므로 (committer 는 바뀌어도 author 는 유지) author 를 키에 넣어도 잡아야 할 중복을 놓치지 않는다.
- **repoRef 는 키에 넣지 않는다** — rebase 중복은 fork 된 다른 repo 에서 나타나는 것이 전형이며, 이는 기존 `commit:<SHA>` 키가 repo 를 뺀 것 (`commit-dedup.ts` `36~39 행` 주석) 과 같은 이유다.
- **시간창 제한 미채택**: rebase 된 사본은 원본보다 수개월 뒤에 나타날 수 있고 (README `21 행` 의 "2 월 / 3 월" 예시가 정확히 그 상황), 시간창을 두면 그 사례를 놓친다. 대신 earliest-wins (§ Decision 5) 가 시간 축을 처리한다.
- **오탐 차단 — 정규화 후 최소 길이 하한 `CONTENT_FINGERPRINT_MIN_LENGTH = 20` (문자).** § Decision 2 의 정규화를 마친 문자열이 **20 자 미만** 이면 지문을 산출하지 않고 (`metadata.contentFingerprint` 미포함), 그 활동은 지문 dedup 대상에서 **제외** 되어 원본 그대로 통과한다. 근거 — "fix typo" (8) · "wip" (3) · "update" (6) · "Merge branch 'main'" (19) 같은 상투구는 서로 다른 기여를 접을 위험이 크고 개별 정보량이 낮다. 20 자는 "한 문장 이상" 의 경험적 경계이며, 하한을 넘긴 상투구가 남더라도 author 동일 요구가 2 차 방어가 된다.
- **오탐 시 잃는 것을 명시한다**: 지문 dedup 의 오탐 1 건 = **평가 입력에서 기여 1 건이 조용히 사라짐** 이다. 미탐 (중복이 남음) 은 중복 계상이라는 정량 왜곡에 그치지만, 오탐은 기여자에게 불이익으로 직결된다. 따라서 본 결정은 **미탐 쪽으로 편향** (하한 · author 동일 · 유사도 미사용) 시키는 것을 의도한 선택이다.

### § Decision 5 — 적용 순서와 결정성

**채택: 기존 식별자 dedup → 그 출력에 content 지문 dedup, 2-pass 직렬.** earliest-wins · tie-break · 반환 순서 결정성은 pass 1 계약을 그대로 승계한다.

1. **pass 1 (기존, 무변경)**: `dedupGithubActivities` — `commit:<SHA>` / `<kind>:<repoRef>:<externalId>` 키, earliest-wins, 동일 timestamp tie 는 먼저 등장한 항목 유지, 반환 순서는 `firstSeenOrder` (`commit-dedup.ts` `79~81 행`) 기준.
2. **pass 2 (신설)**: pass 1 의 출력에 대해 `content:<author>:<digest>` 키로 같은 알고리즘을 적용한다. 지문이 없는 활동 (비-commit · 하한 미달) 은 **키를 만들지 않고 그대로 통과** 시킨다 (dedup 대상 아님).

- **순서 근거**: SHA 동일 중복이 먼저 접히면 pass 2 의 입력이 줄고, pass 2 는 순수하게 "SHA 는 다른데 내용이 같은" 축만 다루게 되어 두 pass 의 책임이 겹치지 않는다. 역순은 pass 2 가 SHA 중복까지 흡수해 "무엇이 무엇을 지웠는가" 가 흐려진다.
- **earliest-wins 승계**: pass 2 도 같은 키의 후보 중 `isEarlier` 로 **엄격히 더 이른** timestamp 1 개만 남긴다 — README `21 행` 의 "2 월 결과물이 3 월 timestamp 로 중복되면 2 월 기여로 판단" 이 rebase 사본에 대해서도 성립하게 하는 핵심이다. `isEarlier` (`commit-dedup.ts` `26~34 행`) 는 재구현하지 않고 그대로 재사용한다 (`Date.parse` 우선 · NaN 이면 사전식 fallback).
- **tie-break / 결정성**: 동일 timestamp 는 먼저 등장한 항목 유지 (입력 순서 보존), 반환 순서는 유지 항목의 최초 등장 위치 기준 — pass 1 과 **동형** 이라 2-pass 합성 결과도 결정적이다. 부수효과 0 / 입력 배열 비변형도 pass 1 계약 그대로다.
- **공개 계약**: pass 2 는 `dedupGithubActivities` 의 시그니처를 바꾸지 않는다 — 같은 파일에 pass 2 순수 함수를 추가하고 기존 함수 내부 (또는 호출부) 에서 직렬 합성한다. 호출부 [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) `115 행` 의 반환 형태는 무변경이다.

### § Decision 6 — 적용 범위: commit 한정

**채택: 내용 지문 dedup 은 `kind === "commit"` 에만 적용한다.**

- pr / issue dedup 정책은 **무변경** — `(kind, repoRef, externalId)` 합성 키 그대로다. PR/issue 번호는 repo 내 단조 증가 식별자라 재작성되지 않으므로 지문이 풀 문제 자체가 없다 (`commit-dedup.ts` `13~19 행` 주석의 근거 승계).
- Confluence page dedup ([page-dedup.ts](../../src/assessment-collection/domain/page-dedup.ts), page-id + version latest-wins) 도 **무변경** — 그쪽은 "최신 상태가 기여 단위" 라 방향이 반대이며 본 ADR 범위 밖이다.
- **diff 유사도 임계 기반 fuzzy dedup 은 미채택** — 근거는 § Alternatives B.

### § Decision 7 — 관측 · 개입

**채택: v1 은 "제거 건수 로그 1 줄" 만 두고, 사람이 제거된 활동을 되살리는 개입 경로는 defer 한다.**

- **관측**: 수집 flow 호출부에서 pass 2 가 제거한 건수를 Nest `Logger` 로 1 줄 남긴다 (예: `content-fingerprint dedup: N 건 제거`). 개별 활동 식별자·메시지는 남기지 않는다 (raw 유출 0). 이것으로 "지문 dedup 이 과하게 먹고 있는가" 를 운영이 **수치로** 인지할 수 있다.
- **defer 하는 것**: 제거된 활동의 목록 노출 · Admin UI 의 복원 (allowlist) 경로. 근거 — 복원 경로는 "무엇이 제거됐는가" 를 영속화해야 하고 그것은 § Decision 3 이 금지한 영속 표면 신설로 직결된다. 즉 지금 만들면 ADR 두 개를 동시에 여는 셈이다.
- **재검토 트리거 (아래 중 하나면 본 § 를 재개한다)**: (a) 위 로그의 제거 건수가 pass 1 제거 건수를 상시 초과, (b) 기여자로부터 "내 커밋이 평가에서 빠졌다" 는 오탐 신고 1 건 이상, (c) § Decision 4 의 하한 20 자를 조정해야 할 실측 근거 확보. 재검토는 본 ADR 을 augment 하는 후속 ADR 로 한다.

## Alternatives

- **A. dedup pass 안에서 지문 산출 (mapper 대신)** — 미채택. `dedupGithubActivities` 의 입력은 이미 typed `GithubActivity[]` 라 raw commit message 가 없다. 채택하려면 raw 를 dedup 까지 운반해야 하고, 이는 ADR-0029 `§ Decision (2)` 의 "raw 는 매핑 직후 폐기" 와 REQ-032 표면을 동시에 넓힌다. mapper 산출은 raw 수명을 **가장 짧게** 유지한다.
- **B. diff 유사도 임계 기반 fuzzy dedup** — 미채택. 근거 셋: (i) **새 외부 dependency** (문자열 유사도 · diff 라이브러리) 가 필요해 CLAUDE.md `§ 5` 게이트에 걸린다, (ii) **오탐 비용** 이 비대칭이다 — 임계값은 본질적으로 임의이고 임계 근처의 오탐 1 건이 기여 1 건 삭제인데 (§ Decision 4), 그 손실을 되돌릴 개입 경로가 아직 없다 (§ Decision 7), (iii) **raw diff 취급** — 유사도는 diff 본문을 메모리로 끌어와야 하고 per-commit 상세 호출 (N+1) 까지 유발해 REQ-032 표면과 API 비용을 함께 키운다. 정확 일치 digest 는 이 셋을 모두 피하면서 rebase/meld 의 전형 (메시지 보존 재작성) 을 잡는다.
- **C. 지문 단독 키 (`content:<digest>`)** — 미채택. author 를 빼면 서로 다른 사람의 동일 메시지 기여가 접힌다. rebase 는 author 를 보존하므로 author 를 넣어도 재현율 손실이 사실상 0 이다 (§ Decision 4).
- **D. 지문을 `Contribution` 컬럼으로 영속화** — 미채택 (현 단계). 재수집 간 cross-run dedup 은 매력적이지만 [data-model.md](../architecture/data-model.md) `§ 4` 의 영속 표면 확대라 **별도 ADR 필수** 이며, 현행 재수집 중복 방지는 [applyRecollectionWindow](../../src/assessment-collection/domain/recollection-window.ts) 가 이미 담당한다.
- **E. 메시지 lowercase 정규화** — 미채택. rebase 는 대소문자를 바꾸지 않으므로 재현율 이득이 없고 오탐 확률만 올린다 (§ Decision 2 규칙 5).

## Consequences

- **얻는 것**: README `21 행` 세 축 중 미충족이던 (ii) 를 수집-side 단일 지점에서 닫는다. REQ-009 의 "내용물 중복 제거 축 부재" 실측 문장이 구현 chain 머지 후 재판정 대상이 된다.
- **치르는 것**: mapper 가 commit 당 sha256 1 회를 더 계산한다 (수집 규모 대비 무시 가능). 정규화 규칙이 늘면 과거 수집분과 지문이 달라지지만, 지문이 in-memory 전용 (§ Decision 3) 이라 마이그레이션 부담은 0 이다.
- **남는 위험**: § Decision 4 의 하한 20 자를 넘는 상투구 + 동일 author 조합의 오탐. 이 잔여 위험은 § Decision 7 의 재검토 트리거로 감시한다.
- **경계**: 본 ADR 은 평가-side [evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) 를 건드리지 않는다 — 그 파일 `17~19 행` 이 선언한 책임 분담 (구조적 중복은 수집-side) 이 본 ADR 로 **강화** 될 뿐이다.

## Follow-ups

구현 chain 을 slice 단위로 박제한다 (각 slice ≤ 300 LOC / ≤ 5 파일, CLAUDE.md `§ 3` 소비처 동반 의무 판정 포함).

- **(a) 지문 helper + mapper 배선** — **완료** (T-1944, PR #1526 → merge `ae03ac5b`). 파일: `src/assessment-collection/domain/commit-content-fingerprint.ts` (신설, § Decision 2 정규화 + `createHash("sha256")` + 하한 20 자) · 그 `.spec.ts` · [github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) (`buildMetadata` 를 commit 분기에서 helper 호출하도록 확장) · 그 spec. **4 파일 / ~200 LOC**. 소비처 동반 판정: **충족** — helper 신설과 그 유일 소비처 (mapper) 배선이 같은 PR 에 들어간다 (helper 단독 PR 아님). R-112: happy-path (정규화 → 안정적 digest) · error path (비-string message / 필드 부재) · 분기별 (trailer 있음/없음 · CRLF · 하한 미달) · negative (하한 미달 시 `metadata.contentFingerprint` **미포함**, 비-commit 은 미산출).
- **(b) content dedup pass + 수집 flow 배선** — **완료** (T-1945, PR #1527 → merge `1b7b9c2f`). 파일: [commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) (pass 2 순수 함수 추가 + § Decision 5 직렬 합성) · 그 spec · [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) (`115 행` 반환 경로 무변경 확인 또는 합성 지점 배선) · 그 spec. **4 파일 / ~180 LOC**. 소비처 동반 판정: **충족** — pass 함수와 수집 flow 호출이 같은 PR. R-112: happy-path (SHA 다름 + 지문 같음 → 1 개, earliest 유지) · error path (지문 키 부재 활동 통과) · 분기별 (author 다름 → 미접힘 / 비-commit → 미접힘 / pass 1 과의 순서) · negative (동일 timestamp tie 시 입력 순서 보존, 반환 순서 결정성).
- **(c) 관측 로그** — **완료** (T-1946, PR #1528 → merge `85641398`). 파일: [github-collection.service.ts](../../src/assessment-collection/github-collection.service.ts) (§ Decision 7 의 제거 건수 1 줄 로그) · 그 spec. **2 파일 / ~60 LOC**. 소비처 동반 판정: **충족** (배선 자체가 소비처). R-112: happy-path (제거 > 0 시 로그 1 회) · error path (제거 0 시 로그 억제 여부 명시) · 분기별 · negative (로그 문자열에 식별자·메시지 미포함 = raw 유출 0 검증).
- **(d) doc-sync (direct)** — **완료** (T-1947, main 직접 commit). 본 ADR status PROPOSED → ACCEPTED, [requirements.md](../requirements.md) REQ-009 재판정 (PLAN `183 행` once-rule 에 따라 (a)~(c) 머지 후 **1 회만**), [PLAN.md](../PLAN.md) `99 행` 중복 제거 bullet 의 implemented-on-main 서술 갱신. **문서 전용 / cap 무관**.
- **(확장 지점, task 아님)** 파일 경로 축을 digest 입력에 편입하는 안 — adapter 가 per-commit 파일 목록을 이미 보유하게 되는 시점에만 재검토하며, 그때는 § Decision 2 개정 ADR 이 선행한다.

## References

- [README.md](../../README.md) `21 행` — R-21 원문 (본 ADR 이 닫는 축 (ii))
- [docs/requirements.md](../requirements.md) `28 행` — REQ-009 의 "내용물 중복 제거 축 부재" 실측 (본 ADR 의 공백 근거)
- [ADR-0029](ADR-0029-assessment-collection-orchestrator.md) `§ Decision (2)` · `§ Decision (4)` — mapper raw→typed 경계 / 현행 dedup 전략 (본 ADR 이 augment)
- [docs/architecture/data-model.md](../architecture/data-model.md) `§ 4` — REQ-032 raw 미저장 invariant 정본 (§ Decision 3 의 제약)
- [src/assessment-collection/domain/commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) — pass 1 계약 (`isEarlier` / `dedupKey` / 결정적 반환 순서)
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` — `ActivityMetadataValue` scalar 계약 (§ Decision 3 준수 대상)
- [src/assessment-collection/domain/github-activity.mapper.ts](../../src/assessment-collection/domain/github-activity.mapper.ts) `119~131 행` — `buildMetadata` (§ Decision 1 의 산출 지점)
- [src/export/export-dump-checksum.ts](../../src/export/export-dump-checksum.ts) `22 행` · `176 행` — Node 내장 `crypto` sha256 선례 (새 dependency 0 근거)
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) `17~19 행` — 수집-side / 평가-side 책임 경계
- [ADR-0062](ADR-0062-llm-default-provider-explicit-selection.md) — doc-only ADR slice 형식 선례

Refs: ADR-0063, ADR-0029, REQ-009, REQ-032, T-1943, T-1944, T-1945, T-1946, T-1947
