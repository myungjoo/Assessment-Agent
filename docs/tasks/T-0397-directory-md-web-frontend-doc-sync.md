---
id: T-0397
title: directory.md frontend(web/) 섹션을 repo-root web/ 패키지 shipped 현실로 doc-sync
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-002, REQ-038]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-06-14
plannerNote: P6 closure doc-sync 가족 ③ — directory.md '옵션 1/2 미결정' 서술이 ADR-0040(옵션1 확정)·web/ tree shipped 와 stale, T-0395/T-0396 와 동형 dependency-free 정합
independentStream: p6-frontend-doc-sync
dependsOn: []
touchesFiles: [docs/architecture/directory.md]
---

# T-0397 — directory.md frontend(web/) 섹션을 repo-root web/ 패키지 shipped 현실로 doc-sync

## Why

PLAN.md P6 의 frontend composition-wiring chain(T-0353~T-0394)이 완결되어 repo-root `web/` 에 React+Vite SPA(15 컴포넌트 + 2 view + AppShell + AuthGate + api/ hook)가 실제로 shipped 됐고, ADR-0040 이 옵션 1(별도 `web/` 패키지)을 ACCEPTED 로 확정했다(REQ-002 Web Interface). 그러나 [directory.md](../architecture/directory.md) 의 "Frontend (web/) 의 위치" 단락(148~155행)은 여전히 옵션 2(NestJS 내부 정적 자산 serve)를 default 로, React/Vue/Vite 선택을 "P6 의 별도 ADR 책임"인 미결정 미래로, "실제 frontend 코드 도입은 P6 의 별도 task"로 박제하고 있다 — 마지막 갱신이 T-0021 시점이라 stale 하다. 본 task 는 T-0395(modules.md)·T-0396(PLAN.md P6)와 동형인 P6 closure doc-sync 가족의 세 번째 정합으로, 같은 stale 서술을 directory.md 에서 현실에 맞춘다.

## Required Reading

- `docs/architecture/directory.md` — 특히 13~49행(top-level tree diagram, `web/` 미포함), 148~155행("Frontend (web/) 의 위치" 단락 — 옵션 1/2 미결정 서술), 157~165행(References)
- `docs/architecture/modules.md` 의 WebModule row + "향후 분리 가능성" 단락 — T-0395 가 이미 동일 현실(ADR-0040 옵션 1 확정·serve-static shipped·composition-wiring 스트림)로 정합한 sibling 문서. 동일 표현·ADR 링크 톤을 재사용한다.
- `docs/decisions/ADR-0040-frontend-stack.md` frontmatter status + Decision 절(React+Vite 별도 `web/` 패키지 = 옵션 1) — 링크 대상 확인용

## Acceptance Criteria

- [ ] "Frontend (web/) 의 위치" 단락(150~155행)을 다음 현실로 정정: 옵션 1(repo-root 별도 `web/` 패키지, React+Vite)이 [ADR-0040](../decisions/ADR-0040-frontend-stack.md)으로 **ACCEPTED·shipped** 임을 명시하고, "P6 의 별도 ADR 책임"·"실제 frontend 코드 도입은 P6 의 별도 task" 같은 미결정 미래 서술을 제거.
- [ ] repo-root `web/` 패키지의 실제 구조를 간략히 박제: `web/src/` 아래 `components/`(15 presentational), `views/`(AdminView·DashboardView), `api/`(apiClient·useApiResource·auth), `AppShell.tsx`·`AuthGate.tsx`·`main.tsx`. 디렉토리 단위 요약이면 충분(파일 전수 나열 금지 — long-horizon 비용).
- [ ] `src/web/`(NestJS serve-static, T-0354 shipped)와 repo-root `web/`(SPA 소스)의 역할 분리를 한 줄로 명확화 — 옵션 1 채택 하에서 `src/web/` 은 build 산출물 serve 역할, `web/` 은 SPA 소스라는 관계.
- [ ] top-level tree diagram(34행 `src/web/` row)의 "P6 옵션 1 시 제거" 같은 미결정 주석을 ADR-0040 확정 현실로 정정(제거가 아니라 serve-static 역할 유지로 shipped). 필요 시 tree diagram 에 repo-root `web/` row 1 줄 추가.
- [ ] backend 계약 미shipped 로 의도적 defer 된 잔여(ReEvaluationTriggerPanel·SchedulePanel 미마운트, R-78 auto-polling, GroupMember add/remove mutation, import 결과 상세)는 directory.md 범위가 아니므로 본 task 에서 다루지 않되, 필요 시 modules.md 의 defer 박제를 링크 참조만.
- [ ] 변경은 `docs/architecture/directory.md` 단일 파일에 한정. `git diff --stat` 으로 1 파일·≤50 LOC 확인.
- [ ] 분기 없음(doc-only) — happy/error/branch/negative test 항목 생략(§3.2 direct doc-only 면제). tester 미호출.

## Out of Scope

- `src/` 코드, `web/src/` 코드, test 파일 변경 일절 금지(doc-only).
- modules.md·PLAN.md·components.md 등 다른 문서 동시 수정 금지(T-0395/T-0396 이 이미 처리 — 본 task 는 directory.md 전용).
- backend-게이트 deferred stream(ReEval/Schedule 마운트·auto-polling·GroupMember mutation·import 상세)을 directory.md 에 신규 박제 금지 — modules.md 가 이미 보유한 defer 서술을 중복 작성하지 않는다.
- ADR-0040 frontmatter·내용 수정 금지(링크만 참조).
- tree diagram 을 web/src 전체 파일 트리로 확장 금지 — 디렉토리 단위 요약까지만.

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 정합 — architect 불요, tester 면제)

## Follow-ups

(없음 — 생성 시점)
