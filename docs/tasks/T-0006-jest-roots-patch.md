---
id: T-0006
title: T-0003 결함 patch — jest.roots 에서 부재 디렉토리 제거
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 2
estimatedFiles: 1
created: 2026-05-23
plannerNote: HQ-0002 결정 (b) patch. T-0003 이 만든 package.json 의 jest.roots = ["<rootDir>/src", "<rootDir>/test"] 중 "<rootDir>/test" 가 부재 디렉토리라 jest Validation Error. T-0004 BLOCKED 의 직접 원인을 1줄 fix 로 제거.
dependsOn: [T-0003]
blocks: [T-0004]
hqOrigin: HQ-0002
---

# T-0006 — T-0003 결함 patch (jest.roots)

## Why

[T-0003](T-0003-project-config.md) 의 PR-3 review round 1 에서 reviewer 가 MINOR=2 로만 잡고 통과시킨 결함이 T-0004 진행 중에 드러났다.

`package.json` 의 jest 설정에 `roots: ["<rootDir>/src", "<rootDir>/test"]` 가 있는데, test 디렉토리는 실제로 존재하지 않는다. jest 는 부재 디렉토리를 `roots` 에 두면 `passWithNoTests: true` 와 무관하게 Validation Error 로 즉시 종료한다.

T-0006 이 1 줄 patch 로 이 결함을 제거하면 T-0004 의 `pnpm test` acceptance 가 충족 가능해지고, T-0004 가 unblock 된다.

이 patch 자체는 T-0003 의 reviewer 가 round 1 에서 catch 했어야 할 일 — 점검표 #B5 (reviewer agent 의 미스) 의 실증이다. reviewer agent 의 자체 강화는 별도 후속 task 로 ([T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) Follow-ups 에 메모).

## Required Reading

- `package.json` (현재 main 의 산출물, T-0003 의 e6052d4)
- [T-0003](T-0003-project-config.md) (어떤 의도로 roots 가 결정됐는지 확인)
- [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) (Blocker 섹션)
- [CLAUDE.md](../../CLAUDE.md) §3, §12

## Acceptance Criteria

- [ ] `package.json` 의 jest 블록의 `"roots"` 가 `["<rootDir>/src"]` 만 포함하도록 수정 (test 항목 제거).
- [ ] `passWithNoTests: true` 는 그대로 유지 (T-0004 가 첫 spec 을 추가하기 전까지 빈 상태에서도 `pnpm test` 가 통과해야 함).
- [ ] 위 수정 후 로컬에서 `pnpm test` 가 exit 0 으로 통과 (test 가 없어도 passWithNoTests 로).
- [ ] 다른 어떤 파일도 변경하지 않는다 — 단 1 파일.
- [ ] 단일 commit 으로 staged 된다.

## Out of Scope

- T-0004 의 본 작업 (NestJS src skeleton) — 본 task 머지 후 T-0004 가 unblock 되어 다음 turn 에서 자동 진행.
- jest config 의 다른 부분 (testRegex, transform, moduleFileExtensions 등) 은 손대지 않는다.
- e2e 용 `test/` 디렉토리 추가 — 후속 task (P0.5 또는 P1).
- reviewer agent 의 jest config 검증 강화 — 본 task scope 밖. [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md) Follow-ups 에 기재.

## Suggested Sub-agents

`implementer` (package.json 1 줄 patch) → `tester` (`pnpm test` 가 exit 0 인지 확인. `passWithNoTests` 가 있어서 spec 없어도 통과해야 함)

architect 호출 안 함 (새 결정 없음).

## Follow-ups

(빈 칸 — patch 와 관련한 추가 발견은 여기에)
