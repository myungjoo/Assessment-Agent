---
id: T-0346
title: select-pickup claim 후보 런타임 재검증 + fail-safe 강등 primitive 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-057, REQ-058]
estimatedDiff: 270
estimatedFiles: 3
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: [T-0343, T-0344, T-0345]
touchesFiles: [scripts/validate-claim-candidate.sh, scripts/validate-claim-candidate.test.sh, docs/decisions/ADR-0036-fine-grained-concurrency.md]
plannerNote: "P5 ADR-0036 §Decision 8 (a)(b) — select 직전 touchesFiles 교집합·dependsOn 머지 재검증 + fail-safe 강등 primitive(scripts/, pr, R-112 4종). (c)(d) 완결, 본 task 가 (a)(b) 닫음."
---

# T-0346 — select-pickup claim 후보 런타임 재검증 + fail-safe 강등 primitive 추가

## Why

ADR-0036 §Decision 8 의 안전장치 5종 중 (c) merge-전 rebase(T-0345) · (d) 회로 차단기(T-0343 schema + T-0344 강등 분기)는 완결됐고, 남은 것은 **(a) fail-safe 강등 + (b) claim 시점 런타임 재검증**뿐이다(STATE.backlogNote · Q-0034 decision 의 §Decision 8 구현 chain 잔여). 기존 `scripts/select-claim.sh` 는 claimed-set 제외만 구현하고 "`dependsOn` 미머지 등 런타임 의존성 평가는 호출측 책임"으로 유보했는데(select-claim.sh 헤더 + concurrency.md §4), §Decision 8 (b) 가 이를 **driver 의무로 확정**했다(planner 의 큐잉-시점 사전 인코딩에 대한 2차 방어). 본 task 는 그 재검증 + fail-safe 강등을 select 직전에 호출하는 read-only primitive 로 박제해 stage 5 (a)(b) 안전장치를 닫는다.

## Required Reading

- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 8 (a)(b) (라인 100~108) + §Decision 0(파일-disjoint·의존성 없음 동시 claimable 조건) + §rollout stage 5 (라인 118)
- `docs/architecture/concurrency.md` §7 (a)(b) (라인 143~176) — 인지 박제(단일 권위는 ADR-0036)
- `docs/LOOP.md` §1[2] 의 "토글 ON 시 driver 의 stage5 안전장치 의무" 단락 (라인 70~76) — driver 가 select+claim 직전 본 재검증을 호출하는 계약
- `scripts/select-claim.sh` 헤더 + `claimed_task_ids()` / `pick_claimable()` (claims.json read 패턴 — touchesFiles 도 같은 tip tree 에서 읽는다)
- `scripts/reclaim-stale-claim.sh` 헤더 (라인 1~50) + `scripts/reclaim-stale-claim.test.sh` (bare-repo self-contained spec 패턴 mirror — CAS 없는 read-only 검증이라 본 task 는 더 단순)
- `scripts/select-claim.test.sh` (R-112 executable spec 의 분기-검증 매핑 + bare-repo + 2 clone 구조 mirror)

## Acceptance Criteria

새 script `scripts/validate-claim-candidate.sh` 는 **select+claim 직전 호출되는 read-only 필터 primitive** 다 — CAS push 없이 후보 task 가 동시 claim 안전한지 판정만 한다. 계약(헤더 주석에 박제):

- 입력: `$1`=후보 task id, env 또는 인자로 후보 task 파일 경로(frontmatter `touchesFiles`/`dependsOn` 읽기 위함) + lock ref(활성 claim 목록) + origin/main ref(dependsOn 머지 여부 판정).
- 출력: `PASS <taskId>`(동시 claim 안전) / `DEMOTE <taskId> reason=<slug>`(직렬화 강등) 중 하나를 stdout. exit 0=판정 완료(PASS·DEMOTE 둘 다 정상 종료), non-zero=인자 오류만.

구현 + 검증 항목:

- [ ] **(b)-(i) touchesFiles 교집합 검사** — 후보 task frontmatter 의 `touchesFiles` 가 **활성 claim 보유 task 들의 `touchesFiles`** 와 교집합 0 인지 검사. 겹치면 `DEMOTE <taskId> reason=files-overlap`. 활성 claim 의 task id 는 lock ref tip 의 `claims.json` 에서, 각 task 의 `touchesFiles` 는 그 task 파일 frontmatter 에서 읽는다.
- [ ] **(b)-(ii) dependsOn 머지 검사** — 후보의 `dependsOn` 전원이 origin/main 에 머지됐는지 확인(예: 각 dependsOn task 파일 frontmatter `status: DONE` 또는 `git log` 에 해당 task id 매칭 commit 존재). 미머지 dependsOn 1+ 이면 `DEMOTE <taskId> reason=unmerged-dependency`.
- [ ] **(a) fail-safe 강등 — 모르면 직렬화** — 판정 불확실 시(claims.json 파싱 실패 · 후보/활성 task frontmatter 의 `touchesFiles`/`dependsOn` 누락 · server-time 미확보 등) `DEMOTE <taskId> reason=uncertain` 으로 단일-task 경로 fallback. reclaim 의 fail-closed 계약("모르면 보류")을 select 면으로 확장.
- [ ] **happy-path unit test** — 후보의 `touchesFiles` 가 활성 claim 과 disjoint + `dependsOn` 전원 머지 → `PASS <taskId>` exit 0 (`scripts/validate-claim-candidate.test.sh`).
- [ ] **error/negative path test (각 분기 1+)** — (1) touchesFiles 겹침 → `DEMOTE reason=files-overlap`, (2) dependsOn 미머지 1+ → `DEMOTE reason=unmerged-dependency`, (3) 후보 frontmatter 의 `touchesFiles` 누락 → fail-safe `DEMOTE reason=uncertain`, (4) claims.json 파싱 실패/부재 시 안전 동작(claim 0 이면 disjoint → PASS, 손상 JSON 이면 `DEMOTE reason=uncertain`), (5) 인자 오류(후보 id 누락) → non-zero exit. 각 1+ test (R-112 negative cases 충분 cover — 분기마다).
- [ ] **flow/branch cover** — 위 3 reason 슬러그 분기 + PASS 분기 각각 test 1+ (select-claim.test.sh 의 분기-검증 매핑 주석 형식 mirror).
- [ ] `scripts/validate-claim-candidate.test.sh` 가 **bare-repo + clone self-contained**(네트워크/credential 불요, CI ubuntu 통과) 로 작성 — reclaim-stale-claim.test.sh 패턴 mirror.
- [ ] tester 가 `bash scripts/validate-claim-candidate.test.sh` 실행 → 전 case ok. 추가로 `pnpm lint && pnpm build && pnpm test` 가 회귀 없이 통과(본 task 는 src/ 무변경이라 기존 TS 테스트 불변, coverage threshold 영향 0).
- [ ] **ADR-0036 §Decision 8 (b) 의 "호출측 책임 → driver 의무 확정"** 을 본 script 가 구현함을 ADR-0036 §Decision 8 또는 §rollout 에 1~2 줄로 cross-ref 박제(architect 가 boundary 결정 시 amend, 단순 확장이면 생략 가능 — Suggested Sub-agents 참조). select-claim.sh 헤더의 "런타임 의존성 평가는 호출측 책임" 유보 문구에 본 script 경로를 가리키는 1 줄 추가.

> 주: jest coverageThreshold 는 TS(`src/`) 대상이라 본 bash primitive 에는 직접 적용 안 됨. 검증은 `.test.sh` executable spec 의 분기 cover(위 항목)로 한다 — select-claim/reclaim 선례 동형. src/ 무변경이므로 line/function ≥ 80% 게이트는 기존값 유지(회귀 0).

## Out of Scope

- **`scripts/select-claim.sh` 본문 수정 금지** — 본 task 는 select 직전 호출되는 **별도 read-only primitive** 만 추가한다(select-claim.sh 헤더에 cross-ref 1 줄은 허용). select-claim 의 CAS 경로는 불변.
- **driver loop 실제 wiring 금지** — LOOP §1[2] 의 "select+claim 직전 본 script 호출" 통합은 이미 spec 으로 박제돼 있고(라인 70~76), 실제 호출 코드 박제는 별도 slice. 본 task 는 primitive + spec 만.
- **`.github/workflows/ci.yml` 에 CI step 추가 금지** — gh token 이 workflow scope 미보유. 본 test 의 CI step 등록은 Follow-up(별도 task, workflow scope 확보 후).
- **`flags.fineGrainedConcurrency` 토글 ON 금지** — 본 task 는 토글 OFF 유지(forward-looking primitive). 토글 ON 은 stage 5a(별도 task).
- **incrementing 로직 / 5a 진입 금지** — §Decision 8 (a)(b) 닫는 것만. incrementing(언제 어느 유형 +1) + 5a(`maxConcurrentClaims=1` + 토글 ON 첫 단계)는 후속 chain.

## Suggested Sub-agents

`architect → implementer → tester`.

- **architect (짧은 design note 또는 ADR-0036 amend)**: 재검증 로직의 위치(신규 `validate-claim-candidate.sh` primitive vs `select-claim.sh` 확장)와 "dependsOn 머지됨" 의 판정 기준(task frontmatter `status: DONE` vs `git log` commit 매칭 — 또는 둘 다)을 결정. 이는 §Decision 8 (b) 의 "호출측 책임 → driver 의무" 경계 확정이므로 ADR-0036 §Decision 8/§rollout 에 1~2 줄 amend 가 적절(단순 primitive 추가로 판단되면 design note 만 trail 에 남기고 ADR 무변경 가능 — architect 재량).
- **implementer**: 위 결정에 따라 `validate-claim-candidate.sh` 작성(reclaim-stale-claim.sh 의 claims.json read + self-contained identity 패턴 mirror, CAS 없음).
- **tester**: `validate-claim-candidate.test.sh`(bare-repo self-contained) 작성 + 실행 + `pnpm lint && pnpm build && pnpm test` 회귀 확인.

## Follow-ups

(없음 — 생성 시점)
