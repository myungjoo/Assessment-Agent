---
id: T-1250
title: exportJobDownload.ts 삭제된 AdminView 소스 참조 stale 주석 현행화
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-049]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-07-26
touchesFiles: [web/src/api/exportJobDownload.ts]
dependsOn: []
independentStream: p6-export-contract-fix
plannerNote: P6 export-contract-fix stream 잔여 nit — exportJobDownload.ts 가 T-1247/T-1249 로 삭제된 AdminView 소스를 mirror 로 참조하는 stale 주석 현행화(comment-only)
---

# T-1250 — exportJobDownload.ts 삭제된 AdminView 소스 참조 stale 주석 현행화

## Why

P6 export-contract-fix stream(T-1242~T-1249)이 종결되면서 `web/src/api/exportJobDownload.ts` 의 여러 주석이 이제 존재하지 않는 소스를 가리킨다. T-1247 이 AdminView 의 구 `runExport`/`buildExportPath`/`EXPORT_DONE_TEXT`/`DEFAULT_EXPORT_FILENAME` 를, T-1249 가 AdminView 의 죽은 `parseFilename`/`triggerDownload` 를 물리 삭제했으나, 본 파일 주석은 여전히 그것들을 "mirror" 대상으로 서술한다. T-1249 reviewer 가 out-of-scope NIT 으로 지적하고 "comment-currency follow-up slice" 로 이연한 잔재다. 삭제된 코드를 현행으로 오도하는 주석은 향후 유지보수자에게 능동적으로 잘못된 지도를 준다 — 현행화가 필요하다(PLAN.md P6, §12 언어/주석 정합).

## Required Reading

- `web/src/api/exportJobDownload.ts` — 본 task 의 유일한 편집 대상. 특히 stale 주석: L4(`구 runExport(AdminView L924~957) mirror`), L5~6(`hub 무접촉 — dedup 은 배선 slice Follow-up`), L10~11(`AdminView EXPORT_DONE_TEXT/DEFAULT_EXPORT_FILENAME mirror`), L15(`AdminView parseFilename mirror`), L57(`AdminView triggerDownload mirror`), L75(`구 runExport mirror`).
- `web/src/api/exportJobDownload.test.ts` — 기존 spec. 로직 무변경이므로 그대로 green 유지 확인용(신규 추가 불요).

## Acceptance Criteria

- [ ] L4·L75 의 `구 runExport(AdminView L924~957) mirror` 서술을 삭제된 사실에 맞게 현행화(예: "구 GET 모델 runExport 를 대체한 job-flow 다운로드 러너" 로 — 삭제된 AdminView 위치 참조 제거).
- [ ] L5~6 의 `hub 무접촉 — dedup 은 배선 slice Follow-up` 서술을 현행화 — dedup 은 T-1249 로 이미 완료(AdminView 죽은 사본 삭제됨)이므로 "미완 Follow-up" 표현 제거.
- [ ] L10~11 의 `AdminView EXPORT_DONE_TEXT/DEFAULT_EXPORT_FILENAME mirror` 서술 현행화 — 해당 AdminView 상수는 T-1247 로 삭제됐으므로 본 파일이 canonical(단일 정의처)임을 반영.
- [ ] L15 의 `AdminView parseFilename mirror` → 삭제된 mirror 참조 제거, 본 파일 `parseFilename` 이 canonical 임을 반영(RFC 6266 파싱 서술 자체는 유지).
- [ ] L57 의 `AdminView triggerDownload mirror` → 삭제된 mirror 참조 제거, 본 파일 `triggerDownload` 가 canonical 임을 반영.
- [ ] L44 의 `AdminView DownloadDeps 동형` 주석은 **유지**(AdminView `DownloadDeps`/`browserDownloadDeps` 는 T-1249 note 대로 보존돼 여전히 정확 — 검증 후 손대지 않음).
- [ ] 로직 diff 0 확인 — 함수 시그니처·본문·export 목록 무변경, 주석만 수정. `git diff` 로 코드 라인 변경 없음 확인.
- [ ] 분기 없음 · 신규 public symbol 없음 · 동작 변경 없음 → R-112 신규 test(happy/error/branch/negative) 추가는 해당 없음(항목 생략). 대신 기존 `exportJobDownload.test.ts` 가 그대로 통과함을 확인.
- [ ] `pnpm --dir web lint && pnpm --dir web build` 통과(TS6133 미사용 0).
- [ ] `pnpm --dir web test` 전량 green(회귀 0).
- [ ] web coverage threshold 게이트가 있으면 `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%). web 쪽 coverageThreshold 미강제(PLAN line125 gated)면 그 사실을 PR 본문에 명시하고 기존 test green 으로 대체.

## Out of Scope

- `web/src/views/AdminView.tsx` 편집 금지(file-disjoint 유지 — 본 task 는 export API client 주석만).
- `parseFilename`/`triggerDownload`/`runExportJobDownload` 의 로직·시그니처·export 변경 금지.
- 새 test case 추가 금지(주석-only 이므로 불요 — 기존 spec 유지).
- `DownloadDeps`/`browserDownloadDeps` 관련 주석 개변 금지(정확하므로 보존).
- web coverageThreshold 도입(새 dep `@vitest/coverage-v8`) 은 별개 gated backlog — 본 task 에서 다루지 않음.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
