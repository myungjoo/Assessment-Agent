---
id: T-0399
title: deployment.md 배포 토폴로지에 web/ SPA serve-static 책임 doc-sync
phase: P4-complete / P5-in-progress
status: DONE
commitMode: direct
coversReq: [REQ-048, REQ-002]
estimatedDiff: 30
estimatedFiles: 1
created: 2026-06-14
dependsOn: []
touchesFiles: [docs/architecture/deployment.md]
independentStream: p6-frontend-doc-sync
plannerNote: "P6-closure doc-sync 가족⑤ — deployment.md 단일 NestJS process 책임 범위에 web/ SPA serve-static(ADR-0040 §3) 누락 정합. direct doc-only 1파일."
---

# T-0399 — deployment.md 배포 토폴로지에 web/ SPA serve-static 책임 doc-sync

## Why

PLAN.md P6 composition-wiring 스트림(T-0353~T-0394) 이 완결되고 [ADR-0040](../decisions/ADR-0040-frontend-stack.md)(React+Vite 별도 `web/`) · [ADR-0041](../decisions/ADR-0041-frontend-composition-wiring.md) 이 ACCEPTED 되면서, 운영 배포 형태는 **단일 NestJS process 가 `web/dist/` build 산출물을 `@nestjs/serve-static` 으로 정적 serve** 하는 것으로 확정됐다(ADR-0040 §3, T-0354 serve-static shipped). 그러나 [deployment.md](../architecture/deployment.md) 의 `## 배포 토폴로지` / `### process 1 개의 책임 범위`(48~60행)는 마지막 갱신이 P1 T-0016 이라 backend API/scheduler/평가 파이프라인/LLM gateway/adapter 5종만 나열하고, **같은 process 가 SPA 정적 자산을 serve 하는 책임이 누락**돼 있다(`serve.static`/`ADR-0040`/`SPA 빌드` 0건 grep). 본 task 는 P6-closure doc-sync 가족(T-0395 modules.md / T-0396 PLAN.md / T-0397 directory.md / T-0398 components.md)의 동형 ⑤ 로서 deployment.md 를 shipped 현실로 정합한다. REQ-048(데이터 시각화 화면) · REQ-002(아키텍처 문서 유지) 추적.

## Required Reading

- `docs/architecture/deployment.md` (특히 5~11행 개요, 48~68행 `## 배포 토폴로지` + `### process 1 개의 책임 범위` + worker 분리 시점)
- `docs/decisions/ADR-0040-frontend-stack.md` (§3 build/serve 통합 — 운영 NestJS static serve, §6 web/ 위치, References)
- `docs/architecture/modules.md` (WebModule row — T-0395 가 이미 박제한 현실, deployment.md 와 정합 유지용 — 중복 서술 금지, 링크 참조)

## Acceptance Criteria

- [ ] `### process 1 개의 책임 범위`(54~60행) 목록에 **Web UI 정적 serve** 책임 항목 1개 추가 — 단일 NestJS process 가 `@nestjs/serve-static`(`src/web` WebModule)으로 `web/dist/` build 산출물을 mount 하고 비-`/api/*` 경로의 SPA fallback(`index.html`)을 처리한다는 취지 박제. ADR-0040 §3 링크 포함.
- [ ] `## 배포 토폴로지` 또는 `### process 1 개의 책임 범위`에 frontend 빌드 분리(`web/` 는 backend `src/` 와 빌드 분리, `pnpm build`(NestJS tsc) 불변, frontend 는 분리 빌드) 한 줄 명시 — ADR-0040 §3/§6 참조.
- [ ] `### worker 분리 전환 시점`(66~68행) 또는 개요(11행 근처)에 monolith static serve 의 trade-off(frontend 배포가 backend 재시작과 묶임, single-operator 규모 수용 — ADR-0040 Consequences) 한 줄 추가. backend-게이트 잔여(ReEval/Schedule 미마운트 등)는 modules.md/PLAN.md 가 이미 박제 — **중복 서술 금지**, 필요 시 링크만.
- [ ] 개요(3~11행) 또는 문서 끝에 References/갱신 표기에 ADR-0040 / ADR-0041 / T-0399 링크 갱신(기존 T-A2/ADR-0003 박제 보존, 추가만).
- [ ] DB / Secret / Scheduler / 외부 네트워크 boundary 등 **다른 단락은 변경 0** (배포 토폴로지 + 책임 범위 + worker 시점 + References 국한).
- [ ] 변경량 cap 내(≤300 LOC / 1파일). doc-only direct commit — tester 면제(§3.2, 코드 0 LOC).

## Out of Scope

- `src/web` WebModule 코드 / `web/` SPA 소스 변경 (코드 0).
- 새 ADR 작성 또는 ADR-0040/0041 본문 수정 (deployment.md 만 doc-sync — ADR 은 참조만).
- backend-게이트 잔여 stream(import 결과 상세 / GroupMember mutation / SchedulePanel / ReEvaluationTriggerPanel / R-78 auto-polling) 박제 — 이미 modules.md/PLAN.md 가 defer 박제, 중복 금지.
- T-0355 web vitest CI 배선(onHold) / deployment.md 의 CI/CD step 상세 추가.
- mermaid/다이어그램 신설.

## Suggested Sub-agents

`implementer` (단일 doc 편집 — architect/tester 불요, direct doc-only).

## Follow-ups

(없음)

## 완료 기록

- **DONE 2026-06-14** — deployment.md doc-sync. 단일 NestJS process 책임 범위에 "Web UI 정적 serve"(@nestjs/serve-static src/web WebModule, web/dist/ mount, 비-/api/* SPA fallback, ADR-0040 §3, T-0354 shipped) 항목 추가 + frontend 빌드 분리 한 줄 + worker 시점 monolith static serve trade-off 한 줄 + 상단 References ADR-0040/0041/T-0399 링크 추가. direct doc-only 1파일 +7/-2, tester 면제(§3.2). commit e7de0f6 direct push main.
