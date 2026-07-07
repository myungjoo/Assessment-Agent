---
id: T-0816
title: PLAN.md P4 GitHub Issue 평가 bullet(82) implemented-on-main checkbox 정합
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-030]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-reconcile
dependsOn: []
touchesFiles:
  - docs/PLAN.md
plannerNote: "P4 line82 GitHub Issue 평가(R-30) bullet 이 shipped-on-main(issues 수집 + issue→document 매핑 + excludeSelfFollowUps 배선)인데 [ ] stale — T-0809/0812~0815 drift 패턴 mirror, direct doc-only."
---

# T-0816 — PLAN.md P4 GitHub Issue 평가 bullet(82) implemented-on-main checkbox 정합

## Why

[PLAN.md](../PLAN.md) 82행 "GitHub Issue 평가 (R-30) — Repo 내 Issue 작성을 문서 기여로 평가. 단 본인이 본인 follow-up 을 남기고 본인이 소비하는 경우 카운트 제외" bullet 이 여전히 `[ ]` 로 남아 있으나, grep 실측 결과 해당 기능은 이미 origin/main 에 전량 shipped 돼 있다 — collection leg(github issues endpoint 수집) + evaluation leg(issue → document 기여 매핑 + self-follow-up 제외 배선) 모두 안착. 이는 최근 T-0809/T-0811~T-0815 에서 교정한 PLAN↔shipped-code checkbox drift 와 동형 패턴이다(STATE.phase 는 이미 P4-complete/P5 인데 P4 bullet 이 미정합 stale). 본 task 는 순수 doc-only 정합으로, line 82 를 `[x]` 로 flip 하고 implemented-on-main 근거 절을 append 한다(코드 변경 0).

grep 실측 근거(origin/main):
- 수집 leg — `src/assessment-collection/github-collection.service.ts` 의 `GithubActivityEndpoint = "commits" | "pulls" | "issues"` + `{ endpoint: "issues", suffix: "issues" }` 로 issue list endpoint 수집. `src/assessment-collection/domain/activity.ts` `GithubActivityKind = "commit" | "pr" | "issue"`.
- 문서 기여 매핑 — `src/assessment-evaluation/domain/evaluation-input.mapper.ts` 가 `issue → "document"`(R-30 — Issue 는 문서 기여) 로 정규화, ADR-0032 §1 박제.
- self-follow-up 제외 — `src/assessment-evaluation/domain/evaluation-dedup.ts:153` `excludeSelfFollowUps(...)` 가 같은 document(issue) 단위 안 동일 author 의 후속 활동을 평가 카운트에서 제외(R-30, ADR-0032 §4 (b)-2). `evaluation-orchestrator.service.ts:148` 이 `excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` 로 실제 배선.

## Required Reading

- `docs/PLAN.md` 81~83행 — P4 GitHub Issue 평가 bullet + 인접한 `[x]` bullet(81 GitHub 통합 / 83 Confluence 통합)의 implemented-on-main 서술 스타일(mirror 대상)
- `docs/tasks/T-0815-plan-p3-domain-core-implemented-on-main-parity.md` — 직전 동형 drift 정합 task 의 body/절 스타일 참조(append-only, 인접 라인 무손상)

## Acceptance Criteria

- [ ] `docs/PLAN.md` 82행 `- [ ]` → `- [x]` 로 flip (해당 1개 bullet 만).
- [ ] 82행 bullet 끝에 **implemented-on-main** 근거 절 append — Why 절에 나열한 3 심볼(github-collection.service.ts `issues` endpoint / evaluation-input.mapper.ts `issue → "document"` / evaluation-dedup.ts `excludeSelfFollowUps` + orchestrator line148 배선) + ADR-0032 §1/§4 참조를 인용. 인접 `[x]` bullet(81/83)의 "**(완료)** — …" 서술 톤 mirror.
- [ ] 변경은 **append-only**: 82행 외 다른 라인(81 GitHub 통합 / 83 Confluence / P4 헤더 등) 무손상. `git diff docs/PLAN.md` 가 82행 국한 +1/-1(또는 그 bullet 내부 편집)만 보일 것.
- [ ] 인용한 3 파일 경로·심볼이 origin/main 에 실존함을 재확인(false-positive flip 방지): `git grep -n "excludeSelfFollowUps" src/assessment-evaluation/evaluation-orchestrator.service.ts` / `git grep -n "endpoint: \"issues\"" src/assessment-collection/github-collection.service.ts` / `git grep -n "issue → \"document\"" src/assessment-evaluation/domain/evaluation-input.mapper.ts` 각 1+ hit.

## Out of Scope

- **코드 변경 0** — src/ / test/ / prisma/ 어떤 파일도 건드리지 않는다. 본 task 는 순수 PLAN.md doc 정합.
- line 82 외 다른 미체크 bullet(98 R-9 사용자 지정 기간 / 106 R-64 부분 reset / 108~110 credential·timezone 게이트 / 136~148 P8) 정합은 본 task 밖 — 각각 별도 task 또는 사용자 결정 게이트.
- ADR-0032 본문 수정·재검토 금지(이미 ACCEPTED, 참조만).
- self-follow-up 검출 확장(comment thread 수집 등 ADR-0032 §4 (d) deferred 여지) 구현 금지 — 현재 배선된 범위만 정합 대상.

## Suggested Sub-agents

direct doc-only — sub-agent 불요. driver 가 Edit 1회로 처리(§3.1 direct).

## Follow-ups

(없음 — 생성 시점)

---

**DONE (2026-07-07, cron@cloud-3fefa fire)** — docs/PLAN.md line82 GitHub Issue 평가(R-30) bullet `[ ]`→`[x]` flip + implemented-on-main 근거 절 append(수집 leg `endpoint: "issues"` / 평가 leg `issue → "document"` ADR-0032 §1 / dedup `excludeSelfFollowUps` + orchestrator:148 배선 ADR-0032 §4). 인용 3 심볼 origin/main grep 각 1+ hit 재확인, diff line82 국한 +1/-1. direct commit main 68d0793b push(source=target=main). AC 4/4 ok.
