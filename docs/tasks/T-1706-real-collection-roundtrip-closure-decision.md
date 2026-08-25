---
id: T-1706
title: 실 수집 왕복(§5 잔여 ①) 해소 경로 판단 사전 박제 (후보 3 종 · 조건 2 개 · 분기 결론 3 값, 부하계획 §3 + §5 + PLAN 141 행)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 120
estimatedFiles: 2
independentStream: load-k6-real-collection-closure
dependsOn: [T-1665, T-1667, T-1686, T-1703, T-1704, T-1705]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain — T-1701 이월 3 항목 종결 후 새 축. §5 마지막 잔여 ①(실 수집 왕복 0) 의 해소 경로를 집행 전에 판단 (코드 0 LOC · dispatch 0)
---

# T-1706 — 실 수집 왕복(§5 잔여 ①) 해소 경로 판단 사전 박제

## Why

[T-1705](T-1705-s3-error-rate-tag-release-exec.md) 로 [T-1701](T-1701-s2-6-s3-5-log-reread.md) 이월
3 항목(① S3 cliff 규칙 3 표본 대입 · ② S2 단계 분해 확대 판단 · ③ `§3` 임계 표 재조정)이 **전부
닫혔다**. 그 결과 [부하계획](../ops/load-resilience-test-plan.md) `§5` item 5 에 남은 잔여는
**① 실 수집 왕복 0**(133 명 `Person` + github `ServiceIdentity` 는 적재됐으나 50~100 repo ·
~1000 page 왕복이 0, LLM 은 stub) **1 개뿐**이며, 이 축은 지금까지 매 회차 "미해소 유지" 로만
승계돼 왔을 뿐 **"무엇을 하면 이 잔여가 닫히는가 / 애초에 닫는 것이 본 문서 소관인가" 가 어디에도
박제돼 있지 않다**. 이 상태로 배선 slice 를 먼저 열면 자격증명 취급([CLAUDE.md §5](../../CLAUDE.md)
BLOCKED 트리거) 여부를 코드 착수 뒤에 되묻게 되므로,
[T-1686](T-1686-k6-seed-persons-cap-decision.md) · [T-1698](T-1698-s3-latency-cliff-judgment-rule.md) ·
[T-1703](T-1703-s2-stage-decomposition-decision.md) · [T-1704](T-1704-s2-s3-baseline-tag-release-rule.md)
가 밟은 **"집행 전 판단 소절 사전 박제"** 서식을 그대로 승계해 **후보 · 조건 · 분기 결론 · 재개
트리거만** 굳힌다. 새 dispatch · rerun · 실측 · 코드 변경은 **0** 이다. PLAN `141 행` 오너 최우선
R-91 chain 의 다음 칸이다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `2580~2586 행` — `§5` item 5 의 **`잔여`: ①** 정의 원문
  (실 dataset seed → 실 수집 왕복 50~100 repo · ~1000 page, LLM stub `ADR-0057 D1`). 본 판단의
  **대상 문장이자 정본** — **문자 단위 무변경**(§12 소급 치환 금지).
- `docs/ops/load-resilience-test-plan.md` `907~958 행` — `#### 8 회차` (seed step 첫 성공 run
  **32665014391**, `person 133 건 / serviceIdentity 133 건`, `http_reqs` 272 → **7**). 잔여 ① 이
  *배선* 이 아니라 *수집 왕복* 축임을 보이는 **사실 근거**(인용만, 수정 금지).
- `docs/ops/load-resilience-test-plan.md` `959~1005 행` — `#### 9 회차` (run **32677333740**,
  `[s1-batch] devset 표본 취득 133명 / 요청 133명`, iteration **825.88ms**). 표본 수 · seed
  재현성은 확정됐고 **왕복만 0** 임을 보이는 근거(인용만).
- `docs/ops/load-resilience-test-plan.md` `487~556 행` — `#### S2 단계 분해 확대 판단 (사전 박제,
  T-1703)`. 승계할 **서식의 정본**(사실 확정 → 후보 열거 → 조건 2 개 → 기계 대입 → 분기 결론
  3 값 → 재개 트리거). **0 hunk**.
- `docs/ops/load-resilience-test-plan.md` `557~632 행` — `#### S2 · S3 baseline 후 fix 표기 해제
  판단 (사전 박제, T-1704)`. **본 소절의 삽입 지점 바로 앞 소절**이며, 판단과 집행을 한 commit 에
  합치지 않는 규칙(조항 ④ split 승계)의 최근 정본. **0 hunk**.
- `docs/ops/load-resilience-test-plan.md` `634 행` — `### 3.1 baseline 실측 기록 (S1 16 회분 ·
  S2 6 회분 · S3 5 회분)` 헤더. **삽입 지점은 632 행과 634 행 사이**. 회분 표기 **재갱신 금지**.
- `docs/decisions/ADR-0057-s1-batch-load-io-isolation.md` — `D1`(LLM stub) · `D5`(provider seed)
  4 축 격리 결정. 후보 열거 시 **기존 결정과의 충돌 여부** 판정 근거(ADR 본문 수정 금지 —
  충돌하는 안이면 후보 자체를 `해소 불요` 쪽으로 분류).
- `CLAUDE.md` `§5` — BLOCKED 처리 목록(**새 외부 dependency** · **외부 자격증명 필요** ·
  **Security/auth 관련 변경**). 조건 ⓑ 의 정본.
- `docs/PLAN.md` `140~141 행` — R-91 bullet. `140 행` checkbox 는 실 수집 축 미검증이라 **`[ ]`
  유지**, `141 행` 꼬리에 본 slice 집행 **1 문장**만 append.

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` 의 **632 행과 634 행 사이**에 새 소절
      `#### 실 수집 왕복(§5 잔여 ①) 해소 경로 판단 (사전 박제, T-1706)` 을 **add-only** 로 신설
      (기존 행 삭제 · 치환 **0**). 확인: `grep -n "해소 경로 판단 (사전 박제, T-1706)" docs/ops/load-resilience-test-plan.md`
      가 1 건, `git diff --stat` 의 삭제 행이 pointer 성 1~2 줄 이내.
- [ ] 소절 첫 항이 **사실 확정** — 새 측정 없이 기박제 수치만 인용: (ㄱ) seed 성공 run
      **32665014391**(person 133 · serviceIdentity 133), (ㄴ) 표본 로그 run **32677333740**
      (`표본 취득 133명 / 요청 133명`), (ㄷ) `http_reqs` **7** · iteration **825.88ms**,
      (ㄹ) LLM **stub**(ADR-0057 `D1`) · 부하 job 의 GitHub/Confluence 자격증명 **0**.
- [ ] 소절이 **후보 3 종**을 열거: ㉠ **실 자격증명 주입**(GitHub/Confluence token 을 부하 job 에
      투입해 실 수집 왕복 발화) · ㉡ **왕복 재현 대체안**(record-replay fixture 또는 수집 어댑터
      stub 으로 왕복 *shape* 만 재현, 자격증명 0) · ㉢ **해소 불요**(REQ-047 판정면은 1h 예산
      외삽이고 실 수집 왕복은 그 판정면 밖 — 잔여를 문서상 재정의). 각 후보마다 **비용 · 판정면
      영향 · 충돌하는 기박제 결정**을 1~2 줄로 적을 것.
- [ ] 소절이 **조건 2 개**를 T-1686 · T-1704 서식으로 정의: **ⓐ 판정면 이동 여부** — 그 후보가
      `§3` 표의 **판정용 임계**(REQ-047 1h 예산 · `FULL_RUN_BUDGET_MS` · `BATCH_P95_MS` 외삽)를
      움직이는가. **ⓑ 자율 집행 가능 여부** — [CLAUDE.md §5](../../CLAUDE.md) 의 BLOCKED 트리거
      (새 외부 dependency · 외부 자격증명 · security/auth) 를 건드리지 않고 agent 가 끝낼 수
      있는가.
- [ ] 소절이 **분기 결론 3 값**(`자율 집행 채택` · `사람 승인 대기` · `해소 불요`)을 정의하고,
      위 조건 2 개를 후보 3 종에 **기계 대입한 결과를 후보마다 1 값씩** 박제. 대입 근거는 위
      사실 확정 항과 Required Reading 인용만으로 구성하고 **새 추정치 발명 금지**.
- [ ] 소절이 **집행 경로**를 명시: 결론이 `자율 집행 채택` 인 후보가 있으면 그 집행은
      T-1668 규칙 ④ 를 승계해 **코드 `pr` + 문서 `direct` 2 task split** 으로 별도 slice 소관이며
      **본 slice 는 아무것도 배선하지 않는다**. `사람 승인 대기` 결론이 나오면 그 후보는
      **본 slice 에서 humanQuestion 을 만들지 않고**(판단 박제만) 후속 slice 가 CLAUDE.md §5
      경로로 올린다는 것까지 문장으로 굳힐 것.
- [ ] 소절 마지막 항이 **재개 트리거 T1~T3**(예: T1 오너가 자격증명을 제공 · T2 수집 어댑터에
      credential-free 경로가 생김 · T3 REQ-047 판정면이 실 수집 왕복을 포함하도록 재정의됨)와
      **판정면 불변 · 코드 0 LOC** 항을 포함. `§3` 임계 표 8 행 · 각주 · T-1668/T-1704 규칙 소절 ·
      기박제 회차 본문은 **문자 단위 무변경**.
- [ ] 문서 **tail**(§5 item 5 blob 끝)에 앞 slice 서식대로 **문단 1 개**를 add-only 로 덧붙여 본
      판단의 결론과 "잔여 개수 **1 개** 유지 · 회분 표기(S1 **16 회** · S2 **6 회** · S3 **5 회**)
      무변경 · 새 dispatch · rerun · 실측 **0**" 을 pointer 로 남길 것. `2580~2586 행` 의 잔여 ①
      원문은 **문자 단위 무변경**.
- [ ] `docs/PLAN.md` `141 행` 꼬리에 본 slice 집행 **1 문장** append. `140 행` checkbox 는 실 수집
      축 미검증이라 **`[ ]` 유지**(변경 시 위반).
- [ ] `test/` · `src/` · `web/` · `.github/workflows/` · `package.json` diff **0 파일 · 0 LOC**.
      확인: `git diff --name-only` 결과가 `docs/` 아래 파일만.
- [ ] 새 `workflow_dispatch` · rerun · 실측 회수 **0**. 확인: 본 task 수행 중 `gh workflow run` ·
      `gh run rerun` 호출 이력 없음.
- [ ] 변경 diff ≤ **300 LOC** · 변경 파일 ≤ **5**(본 task 파일 · STATE · journal 포함). 확인:
      `git diff --stat`.
- [ ] `pnpm lint` 무경고(문서만 바뀌어도 실행해 회귀 0 확인). **R-110/R-112 는 direct doc-only ·
      production code 0 LOC 이라 면제** — 분기 없음, 본 항목 생략 사유를 commit trail `notes` 에 명시.

## Out of Scope

- **실제 자격증명 획득 · 주입 · secret 취급 일체** — token 을 workflow / repo secret / 문서 어디에도
  쓰지 않는다(CLAUDE.md §9). 후보 ㉠ 은 *열거와 판정* 대상일 뿐 집행 대상이 아니다.
- **record-replay fixture · 수집 어댑터 stub 의 실제 구현**(후보 ㉡) — 결론이 `자율 집행 채택` 이어도
  배선은 별도 `pr` slice 소관.
- `load-k6.yml` · `s1-batch.js` · `s2-*.js` · `s3-concurrent.js` · `package.json` 변경.
- 새 `workflow_dispatch` · rerun · 새 실측 회수. `§3.1` 회차 신설 · 회분 표기 갱신 금지.
- `§3` 임계 표 숫자 · 태그 변경(S2 `p50 latency / throughput` 의 `baseline 후 fix` 는 T-1704 결론
  `해제 불요` 그대로 유지).
- ADR 신설 · ADR-0057 본문 수정. 본 slice 는 기존 결정 안에서의 판단만 적는다.
- `docs/PLAN.md` `140 행` checkbox flip.
- 기박제 회차 본문 · 잔여 ① 원문의 **소급 치환**(무효화 표기 · add-only pointer 만 허용, §12).
- `STATE.humanQuestions` 항목 신설 — 본 slice 는 판단 박제만 한다.

## Suggested Sub-agents

`implementer` (문서 편집 단독 — direct doc-only 라 architect · tester 불요; R-110 면제 근거를 trail 에 명시)

## Follow-ups

(작성 시점 없음 — sub-agent 가 발견 시 여기에 append)
