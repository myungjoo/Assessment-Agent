---
id: T-0229
title: ADR-0025 status PROPOSED→ACCEPTED flip — azure_openai live-test 계약 구현 slice(T-0227+T-0228) 머지 완료 반영
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-096, REQ-097]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-06-04
plannerNote: P4 milestone-1 2a 종결 — ADR-0025 구현 2 slice(T-0227 gating + T-0228 smoke spec) 머지됨, ADR status 한 줄 flip(§3.1 rule 4 direct)
---

# T-0229 — ADR-0025 status PROPOSED→ACCEPTED flip

## Why

ADR-0025(azure_openai live-test 계약)는 `status: PROPOSED` 로 신설(T-0226)됐고, 그 본문 "후속 task chain" 표(line 142)가 **"구현 slice 머지 후 status 한 줄 갱신(direct)"** 을 ACCEPTED flip 조건으로 박제했다. 이제 구현 2 slice 가 모두 main 에 머지됐다 — T-0227(gating helper 의 azure 확장, PR-198 ed8e369) + T-0228(azure live smoke spec, c18cd77). 따라서 repo convention(ADR 의 구현이 안착하면 ACCEPTED 로 flip)에 따라 ADR-0025 status 를 PROPOSED→ACCEPTED 로 갱신해 milestone-1 step 2a(dependency-free 선행)를 문서상 종결한다. ADR status-only 변경은 CLAUDE.md §3.1 rule 4 에 따라 `direct`.

## Required Reading

- `docs/decisions/ADR-0025-azure-openai-live-test-contract.md` — frontmatter `status:` 필드(line 4) + Consequences "후속 task chain" 표(line 137~142)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0025-azure-openai-live-test-contract.md` frontmatter `status: PROPOSED` → `status: ACCEPTED` 로 변경.
- [ ] 본문 "후속 task chain" 표의 마지막 행(`ADR-0025 PROPOSED→ACCEPTED`)이 이제 완료됨을 반영하도록 최소 갱신 — 해당 row 의 dependency 칸이 가리키는 "구현 slice 머지" 가 T-0227+T-0228 로 충족됐음을 한 줄 이내로 명시(예: row 끝에 "완료 — T-0227+T-0228 머지로 본 task(T-0229) 처리" 부기). 표 구조·다른 행 변경 금지.
- [ ] 위 두 변경 외 ADR 본문(Context / Decision §1~§6 / Alternatives / References)은 **불변** — ADR immutable 원칙 준수(status 한 줄 + 후속 chain 표의 해당 row 부기만 허용).
- [ ] diff 가 ≤ 5 LOC / 1 파일임을 확인(doc-only direct).
- 분기 없음 — 코드 변경 0, test 불요(direct doc-only commit). R-110 test 규칙 면제(§3.2 direct-mode doc-only).

## Out of Scope

- ADR-0025 본문의 Decision / Context / Alternatives 내용 수정(immutable — status + 후속 chain row 부기만).
- ADR-0015(base 계약) 변경.
- milestone-1 step 2b(credentialed live run) 착수 — 별도 §5 credential-gated task(아래 Follow-ups + driver assessment 참조).
- 코드 / spec / CI / package.json 변경(이 task 는 순수 ADR status doc-sync).

## Suggested Sub-agents

direct doc-only — sub-agent 불요. driver 가 직접 Edit 후 main 에 commit/push.

## Follow-ups

- **milestone-1 step 2b (credentialed live run)** — Q-0021 decision 이 승인했으나 §5 credential-gated. 로컬 secrets.env(`C:/Users/MyungJoo Ham/.assessment-agent/secrets.env`, azure_openai/gpt-5.4/karina-east-us-2, 만료 2026-06-30)를 env 주입해 gated azure live smoke 를 실 네트워크 1회 실행 + LLM_APIKEY_ENC_KEY(ADR-0014 at-rest) 생성. 이것은 normal autonomous dependency-free task 가 아니다 — credential 이 특정 PC 의 repo-밖 로컬 파일에만 있고 실 네트워크 호출을 하므로, **operator 가 credential 을 주입할 수 있는 환경에서 사람 checkpoint 와 함께 실행해야 한다**. planner 가 자율 큐잉하지 않음 — driver/사람 결정 필요.
