---
id: T-2067
title: 등록 수집 대상 허용 host ③ — 실 경로 e2e
phase: P7
status: DONE
completedAt: 2026-10-30
mergedAs: 8bc6d1fa
prNumber: 1628
reviewRounds: 2
commitMode: pr
coversReq: [REQ-037, REQ-072]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-10-31
dependsOn: [T-2066]
touchesFiles: [test/e2e/collection-target-host-guard.e2e-spec.ts, src/collection-target/target-host-guard.spec.ts]
plannerNote: P7 · ADR-0059 §Consequences (e) 봉합 arc ③ — 실 HTTP · 실 DB 로 고정
---

# T-2067 — 허용 host e2e

## Why

T-2066 은 unit 으로 검증됐다. API 로 등록한 대상이 허용 host 없이는 fake host 로 아무 요청도 보내지 않고 좌표를 비워 두는지, 수동 경로도 같은 token 규칙을 따르는지 실 경로로 고정한다.

## Required Reading

- `test/e2e/collection-target-effective.e2e-spec.ts`, [T-2063](T-2063-registered-target-e2e.md), [T-2066](T-2066-target-host-guard-wiring.md).

## Acceptance Criteria

- [ ] 허용 host 없음 → fake host 요청 · Authorization 0, 좌표 0. 설정 → 재기동 없이 수집 · 저장.
- [ ] 불일치 · userinfo · suffix · path 우회 endpoint → 요청 0.
- [ ] Confluence http → 요청 0, https + 허용 host → 수집.
- [ ] `POST /collect` · `POST /period` 도 허용 host 없으면 요청 0, 있으면 Bearer 로 호출.
- [ ] (T-2065 리뷰 MINOR) Confluence 의 정규화 표기를 unit 에 고정.
- [ ] `pnpm test:e2e` green (CI). 로컬 DB 가 없어 로컬 실행은 하지 않는다.

## Out of Scope

- 활동이 있는 좌표의 저장, 실 GitHub · 실 Confluence · 실 LLM, 수동 경로의 저장 판정. redirect · 문서 — T-2068.
