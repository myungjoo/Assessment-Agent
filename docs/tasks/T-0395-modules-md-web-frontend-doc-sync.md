---
id: T-0395
title: modules.md WebModule 서술을 shipped web/ frontend 현실로 doc-sync
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-038, REQ-044, REQ-049]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-06-14
plannerNote: P6 — modules.md WebModule row + 향후 분리 section 이 frontend framework 미결정으로 stale; ADR-0040/0041 ACCEPTED + web/ 조립 완료 현실 doc-sync (direct doc-only)
touchesFiles: [docs/architecture/modules.md]
dependsOn: []
independentStream: p6-frontend-doc-sync
---

# T-0395 — modules.md WebModule 서술을 shipped web/ frontend 현실로 doc-sync

## Why

P6 frontend composition 스트림이 T-0353~T-0394 로 완결됐다 — ADR-0040(React+Vite frontend stack)·ADR-0041(composition-wiring) 가 ACCEPTED 이고, 별도 `web/` 패키지에 15 개 presentational 컴포넌트 + `AppShell` + 2 view(DashboardView/AdminView) 가 전부 조립·배선·머지됐으며, T-0354 가 serve-static WebModule 을 shipped 했다. 그러나 `docs/architecture/modules.md` 는 마지막으로 T-0324(P5)에서 갱신된 이래 **frontend framework 선택을 아직 미결정으로 서술**한다: WebModule row(43행)는 "SPA 자체의 framework(React/Vue/Vite) 선택은 P6 ADR" 로, "WebModule 의 향후 분리 가능성" 섹션(230~237행)은 "P6 진입 시 진화할 가능성" + "현재 default 가정 = 옵션 2(NestJS 내부 serve)" 로 둔다. 이 두 서술은 이제 사실과 어긋난다 — 결정은 이미 ADR-0040 option 1(별도 `web/` 패키지)로 내려졌고 shipped 됐다. 본 task 는 modules.md 의 이 stale 서술을 shipped 현실로 정합한다(REQ-038 UI / REQ-044 3 권한 로그인 UI / REQ-049 Admin LLM 설정 UI 의 frontend 표현이 어디에 어떻게 박제됐는지를 architecture 인덱스가 정확히 가리키도록).

이것은 architecture doc 의 reality doc-sync 다(기존 T-0319/T-0295/T-0276/T-0269 doc-sync 와 동형) — 코드 변경 0, 새 결정 0, 새 dependency 0. 단지 이미 내려진 결정·이미 shipped 된 코드를 doc 에 반영한다.

## Required Reading

- `docs/architecture/modules.md` — 43행 WebModule row + 230~237행 "WebModule 의 향후 분리 가능성" 섹션 + 250행 Refs footer (본 task 가 갱신할 정확한 지점).
- `docs/decisions/ADR-0040-react-vite-frontend.md` — frontend stack 결정(React+Vite, 별도 `web/` 패키지). status·핵심 결정 키워드만 확인.
- `docs/decisions/ADR-0041-frontend-composition-wiring.md` — composition-wiring 전략(무라우터 view 전환·controlled lift-up·fetch hook 경계·non-parallel single-claim stream). status·§Decision 헤더만 확인(전문 정독 불요).
- `web/src/AppShell.tsx` (이미 본 turn 에서 planner 가 확인) — 조립 완료 확인용. view enum(login/dashboard/admin/superadmin-setup) + AuthGate + 2 view 마운트.

## Acceptance Criteria

- [ ] modules.md 43행 WebModule row 의 "SPA 자체의 framework(React/Vue/Vite) 선택은 P6 ADR" 서술을 shipped 현실로 정정: frontend 가 **ADR-0040 으로 React+Vite 별도 `web/` 패키지로 결정·분리됐고**, WebModule 은 빌드 산출물 serve-static 진입점(T-0354)으로 shipped 됐음을 명시. ADR-0040·ADR-0041 링크를 row 의 ADR 컬럼에 추가.
- [ ] modules.md 230~237행 "WebModule 의 향후 분리 가능성" 섹션을 정정: "P6 진입 시 진화할 가능성"(미래형)을 **이미 옵션 1(별도 `web/` 패키지, ADR-0040)로 결정·shipped 됨**으로 갱신. "현재 default 가정 = 옵션 2" 서술을 제거하거나 "옵션 1 채택됨" 으로 명시. composition-wiring 스트림(T-0353~T-0394, 15 컴포넌트 + AppShell + DashboardView/AdminView)이 `web/` 에 조립 완료됐음을 1~2 문장으로 박제.
- [ ] backend-contract 미shipped 라 의도적으로 미배선인 잔여(ReEvaluationTriggerPanel·SchedulePanel 미마운트 / EvaluationGuardBanner 자동 polling / GroupMember add·remove mutation / import 결과 상세)를 **"backend 계약 확정 후 배선" deferred** 로 한 줄 박제(make-work 가 아니라 의도적 defer 임을 doc 에 남겨 다음 planner 가 재발견하지 않도록). 근거 endpoint: api.md 94~97 (`/run`·bulk DELETE·`/reeval`·`/reset` 미구현) + SchedulerModule(P7, `@nestjs/schedule` 새 dep).
- [ ] modules.md 250행 Refs footer 에 본 task 가 박제한 새 참조(ADR-0040, ADR-0041, T-0395)를 영어 식별자로 추가(기존 footer 포맷 보존).
- [ ] WebModule 외 다른 module row 의 서술은 수정하지 않음(diff 를 WebModule + 향후-분리 섹션 + Refs footer 로 국한).
- [ ] 변경이 doc-only(`docs/architecture/modules.md` 단일 파일)임을 확인 — 코드·테스트·다른 doc 미변경.

## Out of Scope

- 실제 wiring 코드 변경(이미 shipped — 본 task 는 doc-sync 만).
- ReEvaluationTriggerPanel·SchedulePanel 의 실 배선(backend 계약 미shipped — defer 유지, 본 task 는 그 defer 사실을 doc 에 박제만).
- ADR-0040/ADR-0041 본문 수정(이미 ACCEPTED — status flip 불요).
- api.md·components.md·deployment.md 등 다른 architecture doc 동기(modules.md 에 국한 — 다른 doc 이 stale 하면 별도 follow-up task).
- WebModule row 외 module row 의 서술 재작성·11→N module 개수 재산정(본 task 는 WebModule 서술 정합만).
- README·PLAN·STATE 갱신(driver 의 closeout 책임).

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 edit — architect/tester 불요; direct doc commit 이라 R-110 tester 면제, CLAUDE.md §3.2 direct-mode doc-only 예외).

## Follow-ups

(없음 — 생성 시점)
