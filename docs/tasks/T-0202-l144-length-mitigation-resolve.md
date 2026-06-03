---
id: T-0202
title: PLAN L144 길이-mitigation bullet 을 후보 (a) §0.5 cheat sheet 채택으로 resolve
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 8
estimatedFiles: 1
actualDiff: 8
actualFiles: 1
completedAt: 2026-06-03T10:43:00+09:00
created: 2026-06-03
plannerNote: Q-0018 (4)(a) 사용자 결정 — L144 LOC 트리거(905≥800) MET 이나 사고-재발 트리거 0건 + 후보 (a) §0.5 cheat sheet 이미 안착 → bullet resolve(후보 b DRIVER_PROMPT.md 분리 미채택). direct doc-sync.
---

# T-0202 — PLAN L144 길이-mitigation bullet resolve (후보 a 채택)

## Why

[docs/PLAN.md](../PLAN.md) §"운영 정책 review backlog" L144 "CLAUDE.md / LOOP.md 길이 mitigation 검토" bullet 은 두 후보 — (a) CLAUDE.md 앞단 "Hard rule 인덱스" 1 페이지 cheat sheet, (b) LOOP.md §1 표준 prompt 를 `docs/DRIVER_PROMPT.md` 로 분리 — 와 트리거 ("룰 누락 사고 1건 재발 **또는** 두 문서 LOC 합 ≥ 800") 를 forward-looking 으로 적고 있다.

session #49 (Q-0018) 에서 트리거를 평가했다: LOC 합 = CLAUDE.md 461 + LOOP.md 444 = **905 ≥ 800 MET**. 그러나 "룰 누락 사고 1건 재발" 트리거는 §0.5 cheat sheet 도입 이후 **0 건** — cheat sheet 가 attention-drift 누락을 실효적으로 차단해 왔다. 즉 후보 (a) 는 이미 CLAUDE.md §0.5 "Hard rule 인덱스 (cheat sheet)" 로 안착돼 mitigation 역할을 수행 중이다.

사용자가 Q-0018 (4) → sub-decision (a) 를 선택: **후보 (a) §0.5 cheat sheet 로 충분하다 보고 L144 를 resolve 처리**. 후보 (b) DRIVER_PROMPT.md 분리는 single-source doc-drift 유지비용이 현 가치를 초과하고, 백로그 framing 상 ADR 선행이 필요한 별건 refactor 라 미채택 (사고 1건 재발 시 ADR 로 재검토). 순수 문서 정합 (새 dependency 0 / credential 0 / §5 미발화) 이라 commitMode `direct`.

## Required Reading

- `docs/PLAN.md` — L139~146 "운영 정책 review backlog" 절 (특히 L144 bullet)
- `CLAUDE.md` — §0.5 "Hard rule 인덱스 (cheat sheet)" (후보 a 가 이미 존재함을 확인. 헤더 + 8 룰 요약만 보면 충분)

## Acceptance Criteria

- [ ] `docs/PLAN.md` L144 bullet 의 체크박스를 `- [ ]` → `- [x]` 로 flip + 제목에 "완결(후보 a 채택)" 명시.
- [ ] bullet 본문이 다음 사실을 포함하도록 갱신: (1) 후보 (a) **CLAUDE.md §0.5 "Hard rule 인덱스" cheat sheet** 가 attention-drift mitigation 을 수행 중이라 채택, (2) 트리거 평가 결과 — LOC 합 905 ≥ 800 MET 이나 "룰 누락 사고 재발" 트리거는 §0.5 도입 후 0 건, (3) 후보 (b) `docs/DRIVER_PROMPT.md` 분리는 single-source doc-drift 유지비용 > 현 가치라 미채택 (사고 1건 재발 시 ADR 로 재검토), (4) Q-0018 (4)(a) 사용자 결정 근거.
- [ ] bullet 의 "두 문서 (각 ~390 LOC)" stale 수치를 실제 (CLAUDE 461 / LOOP 444 = 905) 로 정합.
- [ ] 같은 절의 나머지 두 bullet (L143 multi-task fire / L145 PLAN 분리) 은 **건드리지 않는다**.
- [ ] 변경 후 `docs/PLAN.md` 의 markdown 구조 (heading / 리스트 들여쓰기) 가 깨지지 않는다 (육안 확인).

## Out of Scope

- 후보 (b) DRIVER_PROMPT.md 실제 분리 / LOOP.md §1 추출 — 미채택 (위 Why). 별도 ADR-gated refactor.
- L143 multi-task fire bullet (T-0201 에서 이미 [x] 완결) / L145 PLAN 분리 bullet (트리거 미충족, 현 155 LOC) — 변경 없음.
- CLAUDE.md / LOOP.md 본문 수정 — 본 task 는 PLAN.md 1 파일 doc-sync 만 (§0.5 cheat sheet 는 이미 존재하므로 추가 작성 불요).
- 새 dependency / credential / DB schema / HITL-gated milestone 작업 일체 (§5 게이트).

## Suggested Sub-agents

direct doc-only 1 파일 bullet 1 개 갱신 — sub-agent 불요. driver-direct 로 처리 (STATE single-writer 와 동일 패턴, R-110 면제 = doc-only direct).

## Follow-ups

- (관찰) 향후 "룰 누락 사고 1건 재발" 이 발생하면 L144 의 후보 (b) DRIVER_PROMPT.md 분리를 ADR 로 재검토 (현재는 §0.5 cheat sheet 로 충분). 이 재검토 트리거는 본 resolve 로 폐기되지 않고 살아있다 — 사고 발생 시 새 backlog bullet 또는 ADR task 로 재진입.
