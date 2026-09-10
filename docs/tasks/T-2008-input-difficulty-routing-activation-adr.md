---
id: T-2008
title: ADR-0066 신설 — 사전 난이도 routing 의 운영 발화 스위치(스위치 source · 적용 진입점 · 기본값 경계) 결정
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-050, REQ-049]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-09-10
independentStream: llm-difficulty
dependsOn: [T-2003, T-2004, T-2005]
touchesFiles:
  - docs/decisions/ADR-0066-input-difficulty-routing-activation.md
  - docs/decisions/ADR-0065-difficulty-routing-activation.md
plannerNote: "P5 REQ-050 잔여 1 축(운영 발화 0) — opt-in 을 실제로 켜는 경로를 ADR-first 로 결정, 코드 0 LOC"
---

# T-2008 — 사전 난이도 routing 운영 발화 스위치 ADR 신설

## Why

[ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) `§ Decision 3` 이 사전 난이도 주입을 **명시적 opt-in 스위치 뒤** 로 두고 기본값 OFF 로 확정했고, 그 집행 slice([T-2004](T-2004-input-difficulty-rule-injection.md) · [T-2005](T-2005-difficulty-routing-failfast-crosslayer-spec.md))가 전량 머지됐다. 그러나 **그 스위치를 켜는 경로가 어디에도 없다** — 즉 Admin 이 지정한 3 슬롯 model 은 여전히 평가에서 발화하지 않는다. [requirements.md](../requirements.md) `69 행` REQ-050 이 [T-2006](T-2006-req050-difficulty-routing-readjudication.md) 재판정에서 남긴 잔여도 정확히 **"운영 발화 0 축"** 하나다. ADR-0065 `## Follow-ups` 의 "(확장 지점, task 아님) 사전 난이도의 운영 설정화 — 본 ADR 을 augment 하는 후속 ADR 이 선행한다" 가 본 task 를 ADR-first 로 지정한다.

**issue-still-relevant pre-check (origin/main `01c0c4b4` 실측)** — 미해소 확인:

- `git ls-tree origin/main docs/decisions/ | grep -c ADR-0066` = **0**. 최신 ADR 은 ADR-0065 이며 발화 스위치를 다루는 결정 문서는 없다.
- `git grep -n "useInputDifficultyRouting" origin/main -- src/ web/ test/` 히트 **7** 인데, 그 중 production 은 **3 개뿐이고 전부 선언 · 주석 · 읽기** 다 — [evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `54 행`(선택 필드 선언) · `81 행`(주석) · `108 행`(읽기). 나머지 4 히트는 spec 2 개(`evaluation-scoring.difficulty-routing.spec.ts` `38` · `251 행`, `evaluation-scoring.service.spec.ts` `269` · `299 행`)뿐이라 **`true` 를 세팅하는 production 호출자가 0** 이다.
- `git grep -in "DIFFICULTY_ROUTING\|INPUT_DIFFICULTY" origin/main -- src/ deploy/ .github/` 는 `DEFAULT_INPUT_DIFFICULTY` 상수 계열만 잡히고 **env · 설정 키는 0** 이다.
- 진입점 3 종이 모두 스위치를 모른 채 `ScoringOptions` 를 조립한다 — 평가 route [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `290~292 행`(`{ modelId: dto.modelId }`) · summary persist `905 행`(`const options = { modelId: dto.modelId }`) · fill-run [build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행`(반환 `{ modelId }` 2 곳). period bridge 는 `545 행` · `616 행` 에서 `{ modelId: undefined as unknown as string }` 을 넘겨 **진입점마다 modelId source 조차 다르다** — 스위치를 어디에 얹을지가 자명하지 않아 ADR 이 선행해야 한다.

## Required Reading

- [docs/decisions/ADR-0065-difficulty-routing-activation.md](../decisions/ADR-0065-difficulty-routing-activation.md) — `§ Decision 2`(주입 지점 1 곳 고정) · `§ Decision 3`(opt-in · 기본 OFF · fail-fast 전파) · `§ Decision 4`(요약 경로 범위 밖) · `## Follow-ups` 의 확장 지점 3 종. 본 ADR 이 augment 하는 대상이다.
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `47~51 행`(3 슬롯) · `60~64 행`(fail-fast, silent fallback 명시 기각) — 뒤집으면 안 되는 경계.
- [src/assessment-evaluation/evaluation-scoring.service.ts](../../src/assessment-evaluation/evaluation-scoring.service.ts) `47~55 행`(`ScoringOptions` 두 필드) · `104~114 행`(opt-in 분기와 generate 인자 조립).
- [src/assessment-evaluation/assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts) `290~292 행` · `537~546 행` · `595~617 행` · `905 행` — `ScoringOptions` 가 실제로 만들어지는 좌표 4 곳(진입점별 modelId source 상이).
- [src/assessment-evaluation/dto/build-fill-run-scoring-options.ts](../../src/assessment-evaluation/dto/build-fill-run-scoring-options.ts) `108~131 행` — fill-run 의 유일한 조립 helper(반환 지점 2 + fail-fast 1).
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `93~125 행` — ON 경로에서 실제로 걸리는 `resolveModel` 4 분기 4xx.
- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 판정문의 잔여 "운영 발화 0 축" 표현(본 ADR 이 닫을 대상이며, 재판정 자체는 본 task 범위 밖).
- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — 기본 provider 를 **명시 선택** 으로 좁힌 선례(암묵 자동 선택 기각 논리의 전례로 참조).

## Acceptance Criteria

- [ ] **ADR 파일 신설** — `docs/decisions/ADR-0066-input-difficulty-routing-activation.md` 를 기존 ADR frontmatter 규약 그대로(`id` · `title` · `status: ACCEPTED` · `date: 2026-09-10` · `relatedTask: [T-2008]` · `supersedes: null` · `augments: [ADR-0065, ADR-0011]`) 작성한다. `## Status` 는 본 task 가 **코드 0 LOC** 임을 명시한다.
- [ ] **§ Decision 1 — 스위치 source 를 1 값으로 확정** — 후보를 최소 4 종(㉠ 요청 DTO 의 선택 필드 · ㉡ 서버 env 설정 값 · ㉢ DB 설정 row · ㉣ 3 슬롯 셋업 여부 자동 감지) 나열하고, 각 후보에 조건 (a) 기본 OFF 보존 (b) 결정성 · 감사가능성(누가 켰는지 추적) (c) ADR-0011 §3 fail-fast 우회 여부 (d) **자율 집행 가능성(새 dependency · 외부 credential · DB schema 변경 0)** 을 표로 대입해 1 값을 고른다. ㉣ 처럼 실패를 암묵 회피하는 안을 채택할 수 없는 이유를 명시 기각으로 남긴다.
- [ ] **§ Decision 2 — 적용 진입점 범위를 1 값으로 확정** — 위 `290~292` · `537~546` · `595~617` · `905 행` 좌표와 `build-fill-run-scoring-options.ts` `108~131 행` 중 **어디에 스위치를 배선하고 어디는 배선하지 않는지** 를 좌표 단위로 못박는다. 요약 경로는 ADR-0065 `§ Decision 4` 대로 범위 밖임을 재확인한다.
- [ ] **§ Decision 3 — 기본값 · 회귀 경계 재확인** — 스위치 미지정 = OFF = 종전 `{ modelId }` 단일 경로와 **문자 단위 동일** 이고, ON 경로의 슬롯 미설정 4xx 는 가리지 않고 전파(silent fallback 금지, ADR-0011 `60~64 행` 유지)임을 결정문으로 박제한다. 잘못된 값(비-boolean · 문자열 `"true"` 등)의 취급도 1 값으로 정한다.
- [ ] **§ Decision 4 — 운영자 표면 범위 판정** — ON 인데 슬롯이 비어 4xx 가 날 때 운영자에게 무엇을 보이는지(기존 4xx 메시지 그대로 / 별도 안내)를 **범위 안 · 밖 중 하나로 판정** 하고 사유를 남긴다. 범위 밖이면 `## Follow-ups` 로 내린다.
- [ ] **§ Consequences · § Alternatives considered** — 얻는 것(REQ-050 잔여 축 해소 경로) · 치르는 것(셋업 누락 환경의 4xx 노출 · 오분류 routing) · 바꾸지 않는 경계(ADR-0011 §1~§3 · gateway 분기 · `classifyNarrative`)를 각각 bullet 로 적고, 기각 후보의 기각 사유는 §Alternatives 에 남긴다.
- [ ] **§ Follow-ups 에 집행 slice 분해** — 각 slice 가 ≤ 300 LOC / ≤ 5 파일이고 CLAUDE.md §3 소비처 동반 의무(스위치 helper 신설 시 실제 배선 동반)를 충족하도록 파일 단위로 나눈다. R-112 4 축(happy-path · error path · 분기별 · 예외 분기마다 negative)은 그 집행 slice 가 진다는 점을 명시한다. REQ-050 재판정은 [PLAN.md](../PLAN.md) `183 행` once-rule 대로 **집행 slice 전량 머지 후 1 회** 임을 적는다.
- [ ] **ADR-0065 pointer 1~3 줄 추가** — [ADR-0065](../decisions/ADR-0065-difficulty-routing-activation.md) `## Follow-ups` 의 "(확장 지점, task 아님)" bullet 에 "운영 설정화는 ADR-0066 이 결정" 을 pointer 로 덧붙인다. **기존 결정문(§ Decision 1~4)의 문자는 바꾸지 않는다** — augment pointer 뿐이다.
- [ ] **좌표 정확성** — ADR 이 인용한 모든 `NN 행` 좌표가 origin/main 실측과 일치한다(`sed -n` · `grep -n` 으로 검증). 행 범위 표기는 CLAUDE.md §12(구분자 `~`, 단일 행은 `NN 행`, `L` prefix 금지)를 따른다.
- [ ] **코드 0 LOC 검증** — `git diff --stat origin/main` 이 위 `touchesFiles` 2 개 문서 파일만 보이고 `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/workflows/` diff 가 **0** 이다.
- [ ] **R-110 이행** — 코드 변경이 0 LOC 이지만 `commitMode: pr` 이므로 tester 를 호출해 `pnpm lint && pnpm build && pnpm test` green 을 확인한다. 신규 spec 은 **0 이 정당** 하다 — 본 task 가 만드는 public symbol 이 0 이기 때문이며 R-112 4 축은 §Follow-ups 의 집행 slice 가 진다. 이 사유를 ADR `## Status` 에 1 줄로 남긴다. 분기 있는 코드 추가가 0 이라 R-112 (3) 분기별 항목은 **해당 없음 — 이 항목 생략**.
- [ ] **§5 게이트 준수** — 결정이 새 외부 dependency · 외부 credential · DB schema 변경을 요구하면 그 방향으로 ADR 을 쓰지 말고 **BLOCKED 로 escalate** 한다(자율 집행 가능한 후보가 실재하므로 정상 경로에서는 발생하지 않아야 한다).

## Out of Scope

- **코드 배선 일체** — `ScoringOptions` 조립 지점 · controller · DTO · helper · env 로딩 중 무엇도 이번 task 에서 바꾸지 않는다(집행은 §Follow-ups slice 소관).
- [requirements.md](../requirements.md) `69 행` REQ-050 재판정 — PLAN `183 행` once-rule 상 집행 slice 머지 후 1 회.
- ADR-0011 · ADR-0032 · ADR-0065 의 **결정 내용 변경** (본 task 는 ADR-0065 에 pointer 만 추가한다).
- 요약 경로(`summary-narrative.service.ts`) 난이도 routing — ADR-0065 `§ Decision 4` 가 범위 밖으로 확정.
- 사전 / 사후 난이도 괴리율 관측 · 규칙 임계 상수 재조정 — 각각 별도 후속 ADR.
- prisma schema · migration · 새 외부 dependency · 외부 credential (§5).
- web(AdminView · DifficultyModelSelector) 변경.

## Suggested Sub-agents

`architect → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
