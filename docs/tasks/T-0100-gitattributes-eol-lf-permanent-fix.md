---
id: T-0100
title: .gitattributes 신설 — EOL LF 영구 정책 + CRLF trap 차단
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 15
estimatedFiles: 1
created: 2026-05-30
completedAt: 2026-05-30T10:45:00+09:00
actualDiff: 31
actualFiles: 1
dependsOn: []
plannerNote: doc-only direct .gitattributes 신설 — Windows core.autocrlf=true 자동 CRLF 회귀 영구 차단, executor friction 제거, T-0099 부산물 follow-up
driverNote: "loop session #27 turn 7/10 (KST 2026-05-30 10:45, local Windows env) — driver inline 경로 정공법 (T-0093/T-0096/T-0097/T-0098 driver inline 패턴 1:1 mirror, sub-agent dispatch 0). .gitattributes 신설 31 LOC (envelope 15 의 ×2.07 over within doc-only direct tolerance — 12 text 확장자 + 10 binary 확장자 + 2 줄 한국어 헤더 주석 + 4 줄 grouping 주석 + 3 empty 줄 mass 본질). **Acceptance Criteria all PASS**: A (.gitattributes 신설 repo root) + B (`* text=auto eol=lf` default) + C (12 explicit text + LF: ts/js/tsx/jsx/json/md/yml/yaml/html/css/scss/sh) + D (10 explicit binary: png/jpg/jpeg/gif/ico/pdf/zip/woff/woff2/ttf) + E (*.sh LF in C 박제) + F (한국어 헤더 주석 2 줄 — CLAUDE.md §3.1 doc-only direct + T-0100 cross-ref) + G (prettier endOfLine 정합 확인 — package.json 의 prettier config 부재 + .prettierrc* 부재 → prettier v3 default `endOfLine: 'lf'` 자동 정합, 변경 0 Out of Scope) + H (git check-attr 검증 all PASS — README.md/src/main.ts/docs/STATE.json 모두 `text: set + eol: lf`, a.png 가상 binary 파일 `binary: set + diff: unset + merge: unset + text: unset`) + I (STATE counters 98→99 + mostRecentTasks prepend + lastCommit + lastActivity + loopSession.turnCount 6→7 + nextTask=null + lock release / journal 10:45 driver append / 본 task 파일 status DONE + actualDiff 31 + actualFiles 1 + driverNote 박제). doc-only direct inline-amend 누적 7 회차: T-0084 ×0.37 + T-0088 ×0.19 + T-0089 ×0.91 + T-0093 ×0.23 + T-0096 ×0.17 + T-0097 ×0.16 + 본 T-0100 ×2.07 (single file 신설 패턴 첫 박제 — table row inline-amend 6 회차 보다 무거움, classification 분리 후보 — estimate-model.md follow-up — single-file-create vs inline-amend 별도 multiplier 박제 candidate). **executor friction 영구 차단 박제** — Windows core.autocrlf=true system-scope (local override false 박제 무관) trap 이 미래 contributor 모든 새 clone / 새 worktree 에서 동일 재발 차단, .gitattributes 가 git 정책 우선이라 `core.autocrlf` 무관 LF 정규화 강제. **R-110/R-114 CI 안정성 정책 운영 기반 박제** — REQ-057/REQ-058 의 lint/build/test/smoke/e2e/spec-presence/reviewer-gate 7 step CI 가 contributor env 의 EOL 차이로 false-positive fail 차단."
---

# T-0100 — .gitattributes 신설 (EOL LF 영구 정책)

## Why

T-0099 (GET /api/users list, MERGED `e91559b`) 진행 중 executor 가 Windows git 기본 `core.autocrlf=true` 때문에 prettier 가 repo 전체에 CRLF/LF mismatch errors 를 흘리는 trap 을 catch 했다. executor 는 local 한정 `git config core.autocrlf=false` 로 회피했으나 이 config 는 tracked 되지 않아 다른 contributor / 새 clone / 새 worktree 마다 동일 trap 이 재발한다.

본 task 는 `.gitattributes` 파일을 신설해 **EOL 정규화를 영구 정책**으로 박제한다. (1) 모든 text 파일을 LF 로 저장 / checkout — Windows / macOS / Linux 통일 / (2) prettier `endOfLine: "lf"` (package.json) 와 정합 / (3) binary asset 은 명시적으로 binary 처리. 이는 R-110/R-114 의 CI 안정성 정책 (REQ-057/REQ-058) 의 운영 기반 — text 파일 EOL 가 contributor env 마다 달라지면 lint/build/test CI 가 false-positive fail 한다.

doc-only direct (CLAUDE.md §3.1 — 신규 production code / CI workflow / dependency manifest 변경 0, `.gitattributes` 는 git 메타 정책 파일로 direct mode 대상) → 1 commit / 1 파일.

## Required Reading

- `C:\Users\myung\Assessment-Agent\package.json` — `prettier.endOfLine` 확인 (lf 박제 여부)
- `C:\Users\myung\Assessment-Agent\.prettierrc` 또는 `.prettierrc.json` — prettier config 박제 위치 (있다면)
- `C:\Users\myung\Assessment-Agent\docs\architecture\race-patterns.md` — Windows 환경 trap 박제 history (필요 시 follow-up amend 후보)

## Acceptance Criteria

- [ ] A. `.gitattributes` 신설 — repo root (`C:\Users\myung\Assessment-Agent\.gitattributes`).
- [ ] B. **default text normalization** — 첫 줄 `* text=auto eol=lf` (모든 text 파일 자동 분류 + LF checkout/commit 강제).
- [ ] C. **explicit text + LF** — 다음 확장자 그룹을 explicit text + lf 로 박제: `*.ts`, `*.js`, `*.tsx`, `*.jsx`, `*.json`, `*.md`, `*.yml`, `*.yaml`, `*.html`, `*.css`, `*.scss`, `*.sh`. 각 줄 형식 `<pattern> text eol=lf`.
- [ ] D. **explicit binary** — 다음 확장자 그룹을 binary 로 박제 (git diff / merge 오작동 차단): `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.ico`, `*.pdf`, `*.zip`, `*.woff`, `*.woff2`, `*.ttf`. 각 줄 형식 `<pattern> binary`.
- [ ] E. **shell script LF 강제** — `*.sh` 는 C 항목에서 이미 cover (LF 필수 — Linux/macOS shell 가 CRLF 만나면 `bad interpreter` error).
- [ ] F. **헤더 주석 박제 (한국어)** — 파일 상단에 `# .gitattributes — EOL 정규화 정책 (CLAUDE.md §3.1 doc-only direct, T-0100)` + `# 모든 text 파일 LF 통일, Windows core.autocrlf 무관하게 일관성 보장` 2 줄 주석.
- [ ] G. **prettier 정합 확인** — `package.json` 의 prettier config (또는 `.prettierrc*`) 의 `endOfLine` 이 `"lf"` 인지 확인. 다르면 본 task scope 0 (Out of Scope) — Follow-ups 에 기록.
- [ ] H. **검증** — `git check-attr -a README.md` (또는 임의 .ts 파일) 결과에 `text: set` 와 `eol: lf` 표시 확인. (`git check-attr` 은 새 attribute 즉시 인식 — commit 전에도 확인 가능.)
- [ ] I. **STATE / journal bookkeeping** — STATE.json `lastActivity` 갱신 + journal `## <time> driver` 항목 append. counters.tasksCompleted 98→99, mostRecentTasks prepend T-0100 (cap 5).

분기 없음 — 단일 파일 신설 + 정적 content. R-112 4 카테고리 (happy/error/branch/negative test) 는 doc-only direct mode 라 면제 (CLAUDE.md §3.2 R-110 면제 분기). 단 H 의 `git check-attr` 검증이 본 task 의 "test 수행" 역할.

## Out of Scope

- 기존 repo 의 모든 파일을 LF 로 일괄 재정규화 (`git add --renormalize .` + 대량 commit) — 본 task scope 0. 미래 follow-up 또는 contributor 가 본 `.gitattributes` 박제 후 자연 checkout 시점에 자동 정규화.
- `core.autocrlf=false` 를 repo 모든 contributor 의 local config 에 강제 — git 정책상 .gitattributes 가 우선이므로 불요.
- `.editorconfig` 신설 — IDE 정책 별도 layer. 필요 시 follow-up.
- prettier `endOfLine` config 변경 — G 항목에서 정합 확인만, 변경은 Out of Scope.
- race-patterns.md 에 Windows CRLF trap 박제 추가 — 별도 follow-up task (#6 race-patterns.md amend 후보 와 합쳐 처리 가능).
- cron env / MCP env / 다른 phantom worktree 박제 — 별도 task.
- ADR 신설 — `.gitattributes` 는 standard convention, ADR 불요.

## Suggested Sub-agents

driver inline 경로 권장 (sub-agent dispatch 0). doc-only direct 단일 파일 신설 + `git check-attr` 1 회 검증 + bookkeeping 1 commit. T-0093 / T-0096 / T-0097 / T-0098 driver inline 패턴 1:1 mirror.

## Follow-ups

(empty — sub-agent / driver 가 작업 중 발견 시 append)
