---
id: T-0398
title: components.md Web UI 컴포넌트 row 를 ADR-0040 React+Vite 확정·shipped 현실로 doc-sync
phase: P6
status: PENDING
commitMode: direct
coversReq: [REQ-038, REQ-044, REQ-026]
estimatedDiff: 25
estimatedFiles: 1
created: 2026-06-14
plannerNote: P6 closure doc-sync 가족 ④ — components.md L113 'P6 Web UI task / 구체 SPA 프레임워크는 후속 ADR' 가 ADR-0040(React+Vite 확정)·shipped 와 stale(마지막 갱신 T-0016), T-0395/0396/0397 와 동형 dependency-free 정합
independentStream: p6-frontend-doc-sync
dependsOn: []
touchesFiles: [docs/architecture/components.md]
---

# T-0398 — components.md Web UI 컴포넌트 row 를 ADR-0040 React+Vite 확정·shipped 현실로 doc-sync

## Why

PLAN.md P6 의 frontend composition-wiring chain(T-0353~T-0394)이 완결되어 repo-root `web/` 에 React+Vite SPA 가 실제로 shipped 됐고, ADR-0040 이 frontend stack(React+Vite, 별도 `web/` 패키지)을, ADR-0041 이 composition-wiring 조립 구조를 ACCEPTED 로 확정했다(REQ-038 / REQ-044). 그러나 [components.md](../architecture/components.md) 의 "Web UI" component table row(113행)는 마지막 갱신이 T-0016(문서 신설) 시점이라 "관련 ADR / 문서" 컬럼이 여전히 "P6 Web UI task / 구체 SPA 프레임워크는 후속 ADR" 로 미결정 미래를 박제하고 있다 — stale 하다. 본 task 는 T-0395(modules.md)·T-0396(PLAN.md P6)·T-0397(directory.md)와 동형인 P6 closure doc-sync 가족의 네 번째 정합으로, 같은 stale 서술을 components.md 에서 현실에 맞춘다.

## Required Reading

- `docs/architecture/components.md` — 특히 113행("Web UI" component table row, "관련 ADR / 문서" 컬럼의 stale 서술), 45행(mermaid `web_ui["Web UI<br/>(Frontend SPA)"]` 노드 — 확인용, 변경 불요), 107행(사용자 브라우저 3 등급 entry point 서술 — 변경 불요)
- `docs/architecture/modules.md` 의 WebModule row + "향후 분리 가능성" 단락 — T-0395 가 이미 동일 현실(ADR-0040 옵션 1 확정·serve-static T-0354 shipped·composition-wiring 스트림 T-0353~T-0394)로 정합한 sibling 문서. 동일 표현·ADR 링크 톤을 재사용한다.
- `docs/decisions/ADR-0040-frontend-stack.md` frontmatter status + Decision 절(React+Vite 별도 `web/` 패키지) — 링크 대상 확인용
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` frontmatter status(ACCEPTED) — 조립 구조 링크 대상 확인용

## Acceptance Criteria

- [ ] "Web UI" row(113행)의 "관련 ADR / 문서" 컬럼을 현실로 정정: "구체 SPA 프레임워크는 후속 ADR" 같은 미결정 서술을 제거하고 [ADR-0040](../decisions/ADR-0040-frontend-stack.md)(React+Vite 별도 `web/` 패키지, ACCEPTED)·[ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md)(composition-wiring, ACCEPTED) 링크로 교체. "P6 Web UI task" 는 "P6 Web UI(shipped, T-0353~T-0394 composition-wiring chain)" 로 완료 현실 반영.
- [ ] "책임" 컬럼(113행)의 "frontend SPA. 로그인 / 대시보드 조회 / 인원 CRUD UI / Admin 설정 UI 진입점" 서술이 shipped 컴포넌트(AppShell·AuthGate·DashboardView·AdminView·SuperAdminSetupForm·EvaluationGuardBanner)와 정합하는지 한 줄 점검 — 큰 불일치 없으면 그대로 두되, "Admin 설정 UI" 가 shipped AdminView(GroupMemberList 조회·DifficultyModelSelector·export/import·RBAC gating) 범위임을 간략히 명확화(파일 전수 나열 금지).
- [ ] mermaid 다이어그램(45행 `web_ui` 노드)·process subgraph 서술(105~107행)은 frontend SPA 추상이 여전히 정확하므로 변경하지 않는다.
- [ ] backend 계약 미shipped 로 의도적 defer 된 잔여(ReEvaluationTriggerPanel·SchedulePanel 미마운트, R-78 auto-polling, GroupMember add/remove mutation, import 결과 상세)는 modules.md 가 이미 보유한 defer 서술과 중복되므로 components.md 에 신규 박제하지 않는다 — 필요 시 modules.md 링크 참조만.
- [ ] 변경은 `docs/architecture/components.md` 단일 파일에 한정. `git diff --stat` 으로 1 파일·≤30 LOC 확인.
- [ ] 분기 없음(doc-only) — happy/error/branch/negative test 항목 생략(§3.2 direct doc-only 면제). tester 미호출.

## Out of Scope

- `src/` 코드, `web/src/` 코드, test 파일 변경 일절 금지(doc-only).
- modules.md·PLAN.md·directory.md 등 다른 문서 동시 수정 금지(T-0395/T-0396/T-0397 이 이미 처리 — 본 task 는 components.md 전용).
- mermaid 다이어그램(45행 web_ui 노드)·Backend API/Worker/Scheduler 등 다른 component row 수정 금지 — Web UI row 정합에만 한정.
- backend-게이트 deferred stream(ReEval/Schedule 마운트·auto-polling·GroupMember mutation·import 상세)을 components.md 에 신규 박제 금지 — modules.md 가 이미 보유한 defer 서술을 중복 작성하지 않는다.
- ADR-0040·ADR-0041 frontmatter·내용 수정 금지(링크만 참조).

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 정합 — architect 불요, tester 면제)

## Follow-ups

(없음 — 생성 시점)
