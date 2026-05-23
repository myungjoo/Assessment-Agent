---
id: T-0003
title: 프로젝트 base config (pnpm + tsconfig + ESLint + .gitignore)
phase: P0
status: PENDING
commitMode: pr
estimatedDiff: 150
estimatedFiles: 5
created: 2026-05-23
plannerNote: T-0001 split의 두 번째 task. ADR-0001 의 결정대로 빈 NestJS 프로젝트의 base config 만 셋업. src 코드와 CI 는 후속 task.
dependsOn: [T-0002]
blocks: [T-0004]
---

# T-0003 — 프로젝트 base config

## Why

[ADR-0001](../decisions/ADR-0001-stack.md) (T-0002 산출물) 의 결정대로 NestJS + TypeScript + pnpm 프로젝트의 base config 5개 파일만 셋업한다. 본 task 가 끝나면 `pnpm install` 이 lockfile 을 생성하고 `pnpm lint` 가 "타깃 없음" 으로라도 성공해야 한다.

`src/` 아래 NestJS 코드와 sanity test 는 [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md), GitHub Actions CI workflow 는 [T-0005](T-0005-ci-workflow.md).

## Required Reading

- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) (T-0002 가 만든 ADR)
- [CLAUDE.md](../../CLAUDE.md) §1 (스택 표), §3 (size cap), §12 (언어 정책 — config 파일 안 주석도 한국어)
- 없음 (기존 코드 없음)

## Acceptance Criteria

- [ ] `package.json` 존재. name: `assessment-agent`, private: true, packageManager 필드 명시 (pnpm 버전 핀). scripts: `build`, `lint`, `test`, `start`, `format` 정의. dependencies 는 NestJS 기본 세트(@nestjs/common, @nestjs/core, @nestjs/platform-express, reflect-metadata, rxjs). devDependencies 는 typescript, @types/node, jest, ts-jest, @types/jest, eslint + 관련 plugin, prettier.
- [ ] `tsconfig.json` 존재. ES2022 / NodeNext / strict / experimentalDecorators / emitDecoratorMetadata 등 NestJS 표준.
- [ ] `tsconfig.build.json` 존재. tsconfig.json 을 extends 하고 test 파일 제외.
- [ ] `.eslintrc.cjs` 존재 (또는 `eslint.config.js` flat config). TypeScript / NestJS 표준 룰셋. import 정렬 정도만.
- [ ] `.gitignore` 존재. `node_modules/`, `dist/`, `coverage/`, `.env*`, `*.log`, `.DS_Store` 등 포함.
- [ ] `pnpm install` 이 실패 없이 lockfile (`pnpm-lock.yaml`) 을 생성한다 (이 lockfile 도 PR 에 포함).
- [ ] `pnpm lint` 가 (대상 파일이 없거나 src 가 비어도) exit 0 으로 성공한다.
- [ ] 단일 commit 으로 staged 된다 (5 파일 + lockfile 1 — lockfile 은 자동 생성물이라 size cap에서 제외 가능, 단 commit 에는 포함).

## Out of Scope

- `src/` 아래 어떤 코드도 작성하지 않는다 — [T-0004](T-0004-nestjs-skeleton-and-sanity-test.md).
- Jest 설정 (`jest.config.js`) 은 본 task 에 포함. 단 실제 spec 파일은 T-0004 에서.
- CI workflow — [T-0005](T-0005-ci-workflow.md).
- Prettier 설정 (있어도 무방하지만 별도 ADR 없이는 기본만).
- ADR-0001 범위 밖 라이브러리 추가 금지 (DB 클라이언트, HTTP 클라이언트, validation 라이브러리 등은 후속 phase 에서 별도 ADR).

## Suggested Sub-agents

`implementer` (config 파일 작성, `pnpm install` 실행해 lockfile 생성) → `tester` (`pnpm lint` 가 exit 0 인지 확인. spec 파일 작성은 T-0004 의 일이므로 본 task 에서는 lint 통과만 검증)

## Follow-ups

(빈 칸)
