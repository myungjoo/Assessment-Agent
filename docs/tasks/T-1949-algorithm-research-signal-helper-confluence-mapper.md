---
id: T-1949
title: 알고리즘·연구 소개 판별 helper 신설 + Confluence mapper 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-019, REQ-032]
independentStream: adr0064-algorithm-research-uplift
dependsOn: []
touchesFiles:
  - src/assessment-collection/domain/algorithm-research-signal.ts
  - src/assessment-collection/domain/algorithm-research-signal.spec.ts
  - src/assessment-collection/domain/confluence-activity.mapper.ts
  - src/assessment-collection/domain/confluence-activity.mapper.spec.ts
estimatedDiff: 285
estimatedFiles: 4
created: 2026-09-07
plannerNote: P5 ADR-0064 §Follow-ups (a) 첫 코드 slice — helper + 그 소비처 Confluence mapper 동반 (R-112 backbone ×1.5)
---

# T-1949 — 알고리즘·연구 소개 판별 helper 신설 + Confluence mapper 배선

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) 가 R-38 (새 알고리즘 · 새 일거리 구상 · 외부 연구 소개 기여의 결정적 상향) 정책을 박제했으나 production 코드는 0 LOC 이다. 본 task 는 그 `§ Follow-ups (a)` 의 첫 절반 — `§ Decision 1` 이 지정한 mapper 경계 파생 신호 helper 를 신설하고, 그 소비처 중 **전량이 `contributionKind === "document"` 로 정규화되는** Confluence mapper 배선을 같은 PR 에 넣어 CLAUDE.md `§ 3` 소비처 동반 의무를 충족한다 ([PLAN.md](../PLAN.md) `94 행` Phase P5 · [requirements.md](../requirements.md) `38 행` REQ-019 의 "식별 축 부재" 축).

issue-still-relevant pre-check (origin/main `b2369f90` 실측):

- `git ls-tree origin/main src/assessment-collection/domain/` 에 `algorithm-research-signal.ts` **부재**.
- `git grep "algorithmResearchHits\|computeAlgorithmResearchHits\|ALGORITHM_RESEARCH" -- src test web` 매칭 **0** — 식별 축이 코드에 전혀 없다.
- `confluence-activity.mapper.ts` `95~102 행` `buildMetadata` 는 여전히 `titleLength` 단일 키만 담는다 (파생 신호 산출 지점 부재).
- `docs/tasks/` 에서 `ADR-0064` 를 언급하는 파일은 T-1948 (ADR 신설분) 하나뿐 — 동일 의도 task **0**.

즉 안착분 0 이라 큐잉이 정당하다. 오너 게이트 미침범 — PLAN `157 행` (k6 최우선) 은 이미 착수돼 경합 0, `158 행` (per-route perf slice 금지) 은 `test/perf/` 무변경으로 비해당, `183 행` (REQ 재판정 1 회) 은 REQ-019 재판정을 ADR-0064 `§ Follow-ups (d)` doc-sync 로 유예해 본 task 가 건드리지 않는다.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) `§ Decision 1` · `§ Decision 2` · `§ Follow-ups (a)` — 산출 경계 · marker 그룹 3 축 · 임계 · slice 범위
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) `38~43 행` — `ActivityMetadataValue` scalar 계약
- [src/assessment-collection/domain/confluence-activity.mapper.ts](../../src/assessment-collection/domain/confluence-activity.mapper.ts) `92~102 행` — `buildMetadata` 배선 대상
- [src/assessment-collection/domain/confluence-activity.mapper.spec.ts](../../src/assessment-collection/domain/confluence-activity.mapper.spec.ts) — colocated spec (본 task 가 갱신)
- [src/assessment-collection/domain/commit-content-fingerprint.ts](../../src/assessment-collection/domain/commit-content-fingerprint.ts) — 직전 선례 (순수 helper · 하한 미달 시 키 생략 · 새 dependency 0)
- [src/assessment-collection/domain/commit-content-fingerprint.spec.ts](../../src/assessment-collection/domain/commit-content-fingerprint.spec.ts) — colocated spec 서술 관행 선례

신규 helper 의 colocated spec 경로는 `src/assessment-collection/domain/algorithm-research-signal.spec.ts` 로 고정한다 (다른 위치 금지).

## Acceptance Criteria

- [ ] `src/assessment-collection/domain/algorithm-research-signal.ts` 를 신설하고 `ALGORITHM_RESEARCH_MIN_HITS` (= 2) 와 marker 그룹 3 축 상수, 순수 함수 `computeAlgorithmResearchHits(title: unknown): number` 를 export 한다. 부수효과 0 · 외부 dependency 0 · `import` 는 타입 외 0.
- [ ] 판별 규칙이 ADR-0064 `§ Decision 2` 와 일치한다 — 그룹 (A) 주제·알고리즘 / (B) 주제·외부 연구 / (C) 형식·소개 의 부분 문자열 · 대소문자 무시 매칭이며, **(C) 매칭이 없으면 반환값은 항상 `0`** 이고 (C) + (A 또는 B) 일 때만 `2` 이상이 된다. 반환값은 매칭된 **그룹 수** (0~3 정수) 로, 같은 그룹 안에서 여러 marker 가 맞아도 1 로 센다.
- [ ] `confluence-activity.mapper.ts` 의 `buildMetadata` 가 helper 를 호출해 결과가 `0` 보다 클 때만 `metadata.algorithmResearchHits` 를 담는다 (`0` 이면 키 자체 미포함 — `contentFingerprint` 키 생략과 동형). raw title 문자열은 metadata 에 담지 않아 REQ-032 불변을 지킨다.
- [ ] happy-path — helper 에 (C)+(A) title · (C)+(B) title 을 넣어 `2` 를 얻고, mapper 가 그 page 를 매핑하면 `metadata.algorithmResearchHits === 2` 임을 단언하는 test 1+ 씩.
- [ ] error path — helper 에 비-string 입력 (`undefined` · `null` · number · 객체 · 배열 · boolean) 을 넣어 throw 없이 `0` 을 반환함을 단언하는 test 1+. mapper 쪽은 `raw.title` 부재 page 에서 키가 없고 매핑 자체는 성공함을 단언하는 test 1+.
- [ ] 분기별 test — (C) 단독 매칭 / (A) 단독 매칭 / (B) 단독 매칭 / 3 그룹 동시 매칭 / 대소문자 차이 (`Research` · `SOTA`) / 한영 혼용 title 각 1+ (`it.each` 사용 권장).
- [ ] negative case — 예외 분기마다 1+: 빈 문자열 → `0`, marker 무관 title → `0` 이며 mapper metadata 에 `algorithmResearchHits` 키 **미포함**, 같은 그룹 marker 2 개 중복 title → `1` (중복 가산 없음), 기존 `titleLength` 키 값·존재가 회귀하지 않음.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%, 신규 helper 파일은 line · function 100%.
- [ ] diff ≤ 300 LOC · 파일 ≤ 4 개 유지 (초과 조짐이면 helper 주석 밀도를 줄이지 말고 spec 을 `it.each` 표로 압축한다).

## Out of Scope

- `github-activity.mapper.ts` 배선 (GitHub issue → document 축) — 별도 후속 slice. 본 PR 은 Confluence 축만 닫는다.
- 평가 layer 의 detection helper · `evaluation-detection-signals-pipeline.ts` 배선 — ADR-0064 `§ Follow-ups (b)`.
- uplift adjuster · `evaluation-adjustments-pipeline.ts` step (9) 삽입 · 관측 로그 — 같은 ADR `§ Follow-ups (c)`.
- ADR-0064 status 승격 · `requirements.md` REQ-019 재판정 · PLAN 서술 갱신 — 같은 ADR `§ Follow-ups (d)` 가 (a)~(c) 전량 머지 후 1 회만 (PLAN `183 행` once-rule).
- `evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` 의 하향 축 판정식 · 상수 · 주석 오기 정정 (ADR-0064 `§ Consequences` 경계 항이 범위 밖으로 명시).
- `prisma/schema.prisma` 컬럼 신설, `package.json` 변경, narrative marker 접두, 본문 (page body) 기반 판별.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)
