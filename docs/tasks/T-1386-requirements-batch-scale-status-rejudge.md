---
id: T-1386
title: requirements.md 66 행 REQ-047 평가 배치 scale·1시간 임계 상태를 실측 기반 재판정
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 32
estimatedFiles: 2
created: 2026-08-02
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1386-requirements-batch-scale-status-rejudge.md
plannerNote: "requirements-status-resync 32 번째 slice — T-1385 Out of Scope 가 남긴 REQ-047 (scale·1h 축), 계획·harness·임계·seed 4 축 정적 실측, doc-only direct"
---

# T-1386 — requirements.md 66 행 REQ-047 평가 배치 scale·1시간 임계 상태를 실측 기반 재판정

## Why

[docs/requirements.md](../requirements.md) 66 행 REQ-047 (README 91 행 — 100~200명 / 50~100 repo / ~1000 confluence page 규모의 평가 작성이 1시간 이내) 은 kind = `NFR`, 구현 위치 = `P7`, 검증 위치 = `manual + perf test` 인데 상태 컬럼이 아직 `PLANNED` 다. 그 사이 main 에는 `docs/ops/load-resilience-test-plan.md` (S1 배치 부하 시나리오 + ≤ 1h 임계 표) 와 `ADR-0054` (harness 도구 권고) 가 머지됐고 `test/perf/` 에 latency 측정 primitive 가 실재해, 표가 저장소 사실보다 뒤처졌는지 앞서 있는지 확인이 필요하다. 직전 slice [T-1385](T-1385-requirements-read-latency-status-rejudge.md) 는 Out of Scope 에 "REQ-047 (66 행) 재판정 — 100~200명 / 50~100 repo / 1h 이내 scale 축은 measurement 근거가 다르므로 별도 slice" 를 명시해 본 slice 를 남겨뒀다. `requirements-status-resync` stream 의 32 번째 slice 로 **계획 축 · 배치 측정 harness 축 · 1시간 절대 임계 축 · scale seed 축** 을 각각 직접 실측해 표를 저장소 사실에 되돌린다.

## Required Reading

- `docs/requirements.md` — 66 행 (REQ-047) 및 표 헤더 (18~19 행) 의 컬럼 순서, 상태 enum (9 행). 인접 REQ-046 (65 행, `DONE`) · REQ-048 (67 행, `IN_PROGRESS`) 은 `|` 필드 수 비교용으로만 쓴다.
- `docs/tasks/T-1385-requirements-read-latency-status-rejudge.md` — 직전 slice 의 상태 문자열 서술 포맷 (`DONE (implemented-on-main — <근거>)` / `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)` / `PLANNED` 유지 + 사유 부기) 과 완료 기록 포맷을 그대로 따른다. **단 그 안의 실측값 (perf-spec 30 개 · 3000ms 임계 등) 을 본 task 근거로 복사하지 않는다** — 그것은 조회 지연 축 (REQ-048) 의 근거이고 본 task 는 배치 축이다. 처음부터 직접 실측한다.
- `README.md` 90~91 행 — REQ-047 원문 및 그 앞 줄의 "성능 요구사항을 구체적으로 정의하지 않는다" 단서. 축 분해 = (a) **계획 축**: 배치 부하 시나리오와 임계가 문서로 정의됐는지, (b) **배치 측정 harness 축**: 평가 배치 (write 경로) 소요 시간을 실제로 재는 spec · primitive 가 실재하는지, (c) **1시간 절대 임계 축**: 3600s / 1h 임계가 assertion 으로 박제됐는지, (d) **scale seed 축**: 100~200명 · 50~100 repo · ~1000 page 규모 fixture · seed 가 실재하는지.
- `docs/ops/load-resilience-test-plan.md` — 계획 축. 12 행 (REQ-047/048 참조) · 25~26 행 (REQ-047 정의) · 45~49 행 (S1 평가 배치 부하 시나리오, 목표 ≤ 1h) · 81 행 (임계 표 S1 행) · §5 follow-up 인덱스를 행 인용한다. **문서 서술은 그 자체로 구현 근거가 아니다** — 아래 소스 실측과 어긋나면 어긋난 사실을 그대로 적는다.
- `docs/decisions/ADR-0054-load-resilience-harness-tool.md` — 도구 결정 축. frontmatter 의 `status` 값과 `relatedReq` 를 행 인용하고, 본 ADR 이 **권고 (PROPOSED) 인지 채택 (ACCEPTED) 인지** 를 한 줄로 확정한다. PROPOSED 면 harness 도구가 아직 도입되지 않았다는 뜻이므로 축 충족 판정에 그대로 반영한다.
- `test/perf/latency-metrics.ts` — 측정 primitive 축. `throughput` (112 행) 과 `summarizeLatency` 의 정의 행을 인용하되, 이 primitive 들이 **요청 단위 latency 용인지 배치 전체 소요시간 판정용인지** 를 한 줄로 확정한다.
- 배치 측정 harness 실 근거용 — `ls test/perf | grep -ci "batch\|write\|eval"` 및 `grep -rn "REQ-047" test/ --include=*.ts` 로 배치 경로 perf-spec · 참조 건수를 확인한다. 0 건이면 0 으로 적고 축을 충족으로 판정하지 않는다.
- 1시간 임계 실 근거용 — `grep -rn "3600" test/perf --include=*.ts` 와 `grep -rn "3600" test/smoke --include=*.ts | head` 로 절대 임계 상수 사용처 건수를 확인한다. 판정 (expect / throw) 에 쓰이는 정의가 0 이면 축을 충족으로 판정하지 않는다.
- scale seed 실 근거용 — `ls prisma/` · `ls scripts/` 에서 대규모 seed 스크립트가 실재하는지 확인하고, `grep -rln "seed" prisma/ scripts/` 결과를 건수로 적는다. lock / claim 관련 shell test 처럼 무관한 매치는 무관으로 분류해 적는다.

## Acceptance Criteria

- [ ] **계획 축** 을 실측한다 — `docs/ops/load-resilience-test-plan.md` 의 S1 시나리오 정의 행 (45~49 행 부근) 과 임계 표 S1 행 (81 행 부근) 을 행 번호와 함께 인용하고, `ADR-0054` frontmatter 의 `status` 값을 그대로 적는다.
- [ ] **배치 측정 harness 축** 을 실측한다 — `test/perf` 하위에 평가 배치 (write / evaluation) 경로 소요시간을 재는 spec 이 실재하는지 `ls test/perf` 필터 결과 건수와 `grep -rn "REQ-047" test/ --include=*.ts` 건수로 적는다. 매치가 smoke 의 무관한 참조뿐이면 그 사실을 명시하고 축을 충족으로 판정하지 않는다.
- [ ] **1시간 절대 임계 축** 을 실측한다 — `grep -rn "3600" test/perf --include=*.ts` 건수와 그 중 판정 (expect / throw) 에 쓰이는 정의 건수를 구분해 적는다. 0 이면 "1h 절대 임계 assertion 부재" 를 상태 문자열에 그대로 적는다.
- [ ] **scale seed 축** 을 실측한다 — 100~200명 · 50~100 repo · ~1000 page 규모 fixture · seed 스크립트가 실재하는지 `ls prisma/` · `ls scripts/` · grep 결과 건수로 적는다. 0 이면 0 으로 적고 축을 충족으로 판정하지 않는다.
- [ ] **검증 위치 컬럼 (`manual + perf test`) 의 실 근거** 를 확인한다 — `manual` 축은 `docs/ops/runbook.md` 또는 `docs/ops/load-resilience-test-plan.md` 에 사람이 따라 할 배치 부하 실행 절차가 실재하는지로 판정하고, 실재하면 행 인용, 부재하면 "manual 절차 미박제" 로 적는다.
- [ ] REQ-047 (66 행) 의 상태 컬럼을 실측 결과에 따라 `DONE (implemented-on-main — <근거>)`, 일부 축만 충족 시 `IN_PROGRESS (<충족 축> 실재 / <미충족 축> 부재)`, 근거 부족 시 `PLANNED` 유지 + 유지 사유 부기 중 하나로 갱신한다. **어느 판정이든 근거에 실재하는 파일 경로 3 개 이상** (계획 문서 · ADR · test 경로 또는 부재 확인 대상 경로) 이 포함돼야 한다.
- [ ] 실측으로 확인되지 않은 부분 (예: 실 LLM 호출 비용으로 인한 full-scale 미측정 · harness dependency 미도입 · CI runner 로는 1h 배치 재현 불가 등) 은 상태 문자열 안에 "한계 —" 로 1~2 절 부기한다.
- [ ] `grep -n "REQ-047" docs/requirements.md` 결과에서 해당 행의 상태 컬럼이 갱신 (또는 사유 부기) 됐고, 표의 컬럼 수 (`|` 필드 수) 가 인접 행 (REQ-046 · REQ-048) 과 동일하게 유지됨을 확인한다. 상태 문자열 안에 리터럴 `|` 문자를 넣지 않는다 (T-1370 · T-1375 사고 재발 방지). `wc -l docs/requirements.md` = 97 과 `grep -c "^| REQ-" docs/requirements.md` = 66 이 편집 전후 불변임도 확인한다.
- [ ] 본 task 파일의 `status` 를 `DONE` 으로 바꾸고 완료 시각 · 결과 요약 (실측값 포함) 을 추가한다.

## Out of Scope

- **perf spec · seed 스크립트 · CI workflow · harness dependency 도입** — 배치 측정 부재 · 1h 임계 미박제 등 공백을 발견해도 코드 · workflow · package.json 을 고치지 않는다 (새 dependency 는 CLAUDE.md §5 상 BLOCKED 사유이기도 하다). 발견 사항은 Follow-ups 에만 적는다.
- **실제 배치 부하 실행 (`pnpm test:perf` · 대규모 seed 투입)** — live NestJS app + PostgreSQL + LLM 호출이 필요해 본 doc-only slice 범위를 넘는다. 정적 실측 (파일 · 행 · 개수) 만 한다.
- **ADR-0054 status 변경 (PROPOSED → ACCEPTED)** — 도구 채택은 owner 승인이 필요한 별도 결정이다. 본 task 는 현재 status 를 인용만 한다.
- **`docs/ops/load-resilience-test-plan.md` · `docs/architecture/*` · `docs/PLAN.md` 수정** — 서술 drift 를 발견해도 인용 · 부기만 한다.
- 상태 컬럼 외 다른 컬럼 (README 행 번호 · 요약 · kind · 구현 위치 · 검증 위치) 수정 — 검증 위치 재판정은 별도 slice.
- REQ-001 (20 행) · REQ-056 (75 행) 등 남은 `PLANNED` row 재판정 — 각각 별도 slice.
- `src/` · `web/` · `test/` · `prisma/` 등 코드 · **코드 주석** 변경 일체 (본 task 는 `commitMode: direct` doc-only).
- T-1385 Follow-ups (web 렌더 latency 측정 도입 · perf-spec mock 의존 해소) 의 구현 또는 재서술.

## Suggested Sub-agents

`implementer` (doc-only 실측 + 표 갱신). 코드 변경이 0 이므로 tester 는 생략한다 (CLAUDE.md §3.2 R-110 의 direct-mode doc-only 면제).

## Follow-ups

- **S1 배치 측정 harness 도입** — `test/perf` 에 평가 작성(write) 배치 경로 소요시간 spec 이 0 건이다. 계획 문서 131 행 follow-up 3 과 동일 항목이며, ADR-0054 가 ACCEPTED 로 승격돼 harness dependency 가 도입된 뒤에야 착수 가능하다 (owner 승인 필요 — CLAUDE.md §5).
- **1h 절대 임계 assertion 박제** — `latency-collector.ts` 의 `DEFAULT_P95_MAX_MS = 3000` (REQ-048 축) 에 대응하는 배치용 3600s 임계 상수·판정 함수가 없다. harness 도입 후 S2 와 동형으로 박제.
- **scale seed 스크립트 도입** — 100~200명 · 50~100 repo · ~1000 confluence page 규모 fixture / seed 가 0 건이다. `prisma/schema.prisma` 433~434 행이 이미 "3 row seed 자동화는 Follow-up" 으로 소규모 seed 공백도 남겨둔 상태라 함께 설계 필요.
- **manual 배치 부하 실행 절차 박제** — 검증 위치 컬럼의 `manual` 축 근거가 `docs/ops/runbook.md` 14 행 cross-link 뿐이다. runbook 에 사람이 따라 할 배치 부하 실행 절차 섹션 추가 (별도 doc-only slice).

## 완료 기록

- **완료 시각**: 2026-08-02
- **판정**: REQ-047 (66 행) 상태 컬럼을 `PLANNED` 유지 + 유지 사유 부기로 갱신했다. 4 축 중 **계획 축만 충족**, 측정 3 축은 전부 부재라 `IN_PROGRESS` 승격 근거가 없다 (상태 enum 9 행의 `IN_PROGRESS` = "대응 task 진행 중" 인데 대응 구현 task 가 착수되지 않았다).
- **실측값**:
  - 계획 축 (충족) — `docs/ops/load-resilience-test-plan.md` 45 행 S1 헤더 · 47~48 행 부하 규모 · 49 행 "완료 시간 ≤ 1h" · 81 행 임계 표 S1 행. `ADR-0054` frontmatter 4 행 `status: PROPOSED`, 7 행 `relatedReq: [REQ-047, REQ-048]` → **권고 단계, 미채택**.
  - 배치 측정 harness 축 (부재) — `ls test/perf` 44 entry, batch · write · eval 패턴 매치 **0 건**, 실재 perf-spec 은 `read.perf-spec.ts` 30 개 (전부 조회 경로). `grep -rn "REQ-047" test/ --include=*.ts` = **2 건** 이나 둘 다 smoke 의 author 귀속 key 정합 주석으로 무관.
  - 1시간 절대 임계 축 (부재) — `grep -rn "3600" test/perf --include=*.ts` = **0 건**. `test/smoke` = 6 건이나 전부 systemd `RandomizedDelaySec=3600` mutant → 판정(expect / throw)용 정의 **0 건**.
  - scale seed 축 (부재) — `ls prisma/` = 2 entry (`migrations` · `schema.prisma`), `ls scripts/` = 19 entry 에 대규모 seed 없음. `grep -rln "seed" prisma/ scripts/` = **6 건** 중 schema.prisma 주석 1 파일 (25 · 433~434 행) + lock/claim shell test 5 파일 → 무관 6 / 유효 **0**.
  - 검증 위치 `manual` 축 (미박제) — `docs/ops/runbook.md` 14 행 cross-link 한 줄뿐, 배치 부하 실행 절차 부재.
- **표 무결성**: `wc -l docs/requirements.md` = 97, `grep -c "^| REQ-"` = 66 (편집 전후 불변), 65 · 66 · 67 행 `|` 필드 수 = 9 로 동일. 상태 문자열에 리터럴 `|` 미사용.
- **한계**: doc-only 정적 실측이라 `pnpm test:perf` 미실행. full-scale 배치는 실 LLM 호출 비용 · 외부 수집 I/O 의존 (계획 문서 51~52 행) 으로 CI runner 재현 불가.
