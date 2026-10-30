---
id: T-2064
title: 등록 수집 대상 실효화 ⑥ — ADR · 모듈 인덱스 · 화면 주석 동기화
phase: P7
status: PLANNED
commitMode: pr
coversReq: [REQ-070, REQ-072]
estimatedDiff: 35
estimatedFiles: 4
created: 2026-10-31
dependsOn: [T-2063]
touchesFiles: [docs/decisions/ADR-0059-collection-target-registration.md, docs/architecture/modules.md, docs/architecture/api.md, web/src/components/CollectionTargetList.tsx]
plannerNote: P7 · 등록 수집 대상 실효화 arc ⑥ — 문서 · 주석 정합
---

# T-2064 — 문서 동기화

## Why

T-2062 부터 등록 대상이 수집된다. ADR-0059 의 "credential 표면 불변" 과 "수집 결과 0 건" 문구, `CollectionTargetList.tsx` 의 비활성 주석이 실제와 어긋난다. endpoint · token 결합 위험도 ADR 에 없다.

## Required Reading

- ADR-0059 §Decision 3 · §Consequences, [T-2059](T-2059-effective-github-instances.md) Follow-ups, [T-2060](T-2060-coverage-registered-targets.md).

## Acceptance Criteria

- [ ] ADR-0059 에 배선 세부와 §Consequences (e) 위험을 적고, (b) 와 "credential 표면 불변" 을 정정하며, §Follow-ups (g) 를 shipped 로 표시한다.
- [ ] `modules.md` · `api.md` 가 env ∪ active row 를 말한다.
- [ ] `CollectionTargetList.tsx` 주석이 비활성 row + env 동작과 맞는다. 동작 변경 0.
- [ ] `pnpm lint && pnpm build && pnpm test` green, PR CI green.

## Out of Scope

- REQ-070 · REQ-072 status 재판정, 화면의 출처 표시, 허용 host 도입.

## Suggested Sub-agents

`implementer`

## Follow-ups

- (owner 판단) ADR-0059 §Consequences (e): key 별 허용 host 를 env 에 둘지.
- `rejected` 진단 (충돌 · credential 부재) 을 API 와 화면 출처 표시로 노출 (ADR-0059 §Follow-ups (e)).
- REQ-070 · REQ-072 재판정 1 회.
