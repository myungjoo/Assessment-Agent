---
id: T-0798
title: timezone = KST(Asia/Seoul) 기간 경계 표준 패턴 ADR 박제 (ADR-0050 신설) — 저장=UTC timestamptz 유지 + 경계 계산·표시만 고정 +09:00 offset KST 변환, 주 시작=월요일(ISO), 반열림 구간 [start,end), 적용 범위 R-61 일별 자정·주간·월간·R-9 사용자 지정 기간·R-58 최근 1주 재수집 window·시각화 표시
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-034, REQ-031]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-07-01
plannerNote: "Q-0049 옵션(1) 사용자 재승인(2026-07-01 aa-local interactive session) — PLAN P5 bullet110(2026-06-11 KST 확정)의 Q-0026 옵션2 deferral 해제. 사용자가 세부 6종 (a)~(f) 확정: 기준=Asia/Seoul(KST) · 고정 +09:00 offset(DST 부재→새 dep 0) · 저장=UTC timestamptz 유지 경계 계산·표시만 KST · 주 시작=월요일(ISO 8601) · 기간 경계=반열림 [start,end) · 적용 범위=R-61 일별 자정(KST)·주간·월간·R-9 사용자 지정 기간·R-58 최근 1주 재수집 window·시각화 표시. 본 task 는 그 결정을 architect 가 ADR-0050 으로 박제(impl 0 LOC — decision doc only). 후속 순수 helper(kstDayStart/kstWeekStart(월요일)/kstMonthStart/toKstPeriodBoundary 등)는 별도 pr task chain(dependsOn: [T-0798]). 새 dep·credential·schema 0 → §5 미발화, cron 자율 진행 가능. ADR-0045 §D3 의 '저장/계산 분리·no-new-dep' 정신 인접."
independentStream: timezone-kst-period-boundary
dependsOn: []
sizeExempt: false
touchesFiles:
  - docs/decisions/ADR-0050-timezone-kst-period-boundary.md
---

# T-0798 — timezone = KST(Asia/Seoul) 기간 경계 표준 패턴 ADR 박제 (ADR-0050 신설)

## Why

PLAN P5 bullet 110 은 사용자가 2026-06-11 에 timezone 을 **KST(Asia/Seoul)** 로 확정했음을 박제했으나, 세부 표준 패턴은 "구현 진입 시 ADR 로 박제" 로 미뤄졌고 Q-0026 옵션2 가 이를 "미승인/deferred 유지" 상태로 두었다. 2026-07-01 사용자가 Q-0049 옵션(1) 재승인 + 세부 6종을 interactive session 에서 확정하면서 이 deferral 이 해제됐다.

이 결정을 코드에 흩뿌리기 전에 **하나의 ADR 로 먼저 박제**해야 한다 — 일/주/월 요약 경계(R-61 자정 룰), 주간/월간 시작 판정, 사용자 지정 기간(R-9) 해석, 최근 1주 재수집 window(R-58), 시각화 표시가 전부 같은 timezone 규약 위에서 일관돼야 하며, 규약이 문서로 고정돼 있어야 후속 순수 helper 들이 동일 기준으로 구현된다(같은 결정을 두 번 추론하지 않기 — CLAUDE.md §7.3).

## Required Reading

- [docs/PLAN.md](../PLAN.md) — P5 bullet 110(timezone KST 확정), bullet 97(일/주/월 요약 + R-61 자정), bullet 100(R-58 재수집 최근 1주)
- [docs/requirements.md](../requirements.md) — REQ-034(R-61 일별 요약, 당일 자정까지 미실시), REQ-031(R-58 재수집 중복 방지 + 최근 1주), R-9(사용자 지정 기간)
- [docs/decisions/ADR-0045-llm-provider-deployment-config.md](../decisions/ADR-0045-llm-provider-deployment-config.md) — 저장/계산 분리 + no-new-dependency 정신(인접 패턴 참조)
- [docs/STATE.json](../STATE.json) — humanQuestions Q-0049 의 decision(사용자 확정 세부 6종 (a)~(f)), Q-0026 decision(prior deferral 맥락)
- 기존 ADR 번호 확인: `docs/decisions/` 최고 번호는 ADR-0049 → 본 task 는 **ADR-0050** 신설

## Acceptance Criteria

architect 가 `docs/decisions/ADR-0050-timezone-kst-period-boundary.md` 1개를 신설하고, 아래 사용자 확정 결정을 **Context / Decision / Consequences / Alternatives** 절로 박제한다(한국어 본문, §12):

1. **기준 timezone = Asia/Seoul(KST, UTC+9)** 를 Decision 으로 명시.
2. **고정 +09:00 offset 채택** — 한국은 1988 이후 DST 부재라 IANA tz 데이터베이스/라이브러리(Luxon·date-fns-tz 등) 불필요, 순수 helper 의 고정 offset 산술로 처리 → **새 dependency 0(§5 미발화)**. Alternatives 절에 "IANA tz 라이브러리(새 dep)" 를 미채택 대안으로 기록.
3. **저장 = UTC `timestamptz` 유지, 경계 계산·표시할 때만 KST 변환** — DB schema 변경 0 을 명시(§5 DB schema 게이트 미발화).
4. **주 시작 = 월요일(ISO 8601)** 을 Decision 으로 명시.
5. **기간 경계 = 반열림 구간 `[start, end)`**(끝 순간 배제) 규약 명시.
6. **적용 범위** 표를 박제: R-61 일별 요약 '자정' = KST 자정(00:00 Asia/Seoul, 당일은 자정까지 평가 미실시) · 주간 요약 = KST 주(월요일 시작) 경계 · 월간 요약 = KST 매월 1일 00:00 · R-9 사용자 지정 기간 = KST 해석 · R-58 최근 1주 재수집 window = KST 계산 · 시각화 표시 = KST.
7. ADR status = **ACCEPTED**(사용자 결정이 이미 확정 — 결정 record 절에 "repo owner myungjoo, 2026-07-01 aa-local interactive session 확정" 명시, ADR-0045 의 결정 record 패턴 mirror). frontmatter status 도 ACCEPTED.
8. **후속 impl 은 Out of Scope** — ADR §Follow-ups 또는 §Out-of-scope 에 순수 helper chain(kstDayStart / kstWeekStart(월요일 시작) / kstMonthStart / toKstPeriodBoundary 등, 각 pr, dependsOn: [T-0798])을 다음 slice 로 명시(본 task 에서 helper 코드 작성 금지).
9. **pr-mode 검증(R-110)** — production code 0 LOC 이지만 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 green 확인(문서-only PR 이라 신규 spec 없음, 기존 suite 무회귀 확인).

## Out of Scope

- 순수 도메인 helper(kstDayStart 등) 구현 — 별도 후속 pr task(dependsOn: [T-0798]).
- 기존 코드의 timezone 로직 리팩터 / 호출부 배선 — helper 구현 이후 slice.
- DB schema 변경(timestamptz 유지 결정이라 애초에 불요).
- 시각화/frontend 표시 배선 — helper + P6 이후.
- IANA tz 라이브러리 도입 검토(고정 +09:00 로 확정 — 재론 금지).

## Follow-ups

- (다음 slice) 순수 helper `kstDayStart` / `kstWeekStart`(월요일 시작) / `kstMonthStart` / `toKstPeriodBoundary` 구현 + R-112 4종 test(happy·error·flow·negative 경계: 월/주/일 경계 전후·윤년·UTC↔KST 자정 넘김 등) — pr, dependsOn: [T-0798].
- 이후 summary/재수집 window/사용자 지정 기간 해석부에 helper 배선.

---

## 완료 기록 (Status: DONE)

- 완료: 2026-07-01T08:50:35Z (driver cron@aa-local-bb0d)
- 결과: ADR-0050 신설(ACCEPTED, docs/decisions/ADR-0050-timezone-kst-period-boundary.md, 150 LOC, 구현 0). Q-0049 옵션(1) 사용자 확정 6종 (a)~(f) 박제.
- commitMode 처리: frontmatter=pr 이나 cron standing instruction(문서 변경 direct commit) + 확정 결정 transcription 이라 direct commit(6bea74ef) 처리. doc-only → R-110 tester 면제(§3.2).
- Follow-ups 정정: 후속 순수 helper(kstDayStart/kstWeekStart/kstMonthStart/toKstPeriodBoundary)는 이미 main(src/common/period-boundary.ts, ADR-0039)에 동일 계약으로 존재 → duplicate 회피. planner 가 Q-0050(issue-already-fixed-on-main) escalate. 권고: helper wiring(summary/R-58/R-9 경로)으로 전환, 사람 결정 대기.
