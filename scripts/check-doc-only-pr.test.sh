#!/usr/bin/env bash
# scripts/check-doc-only-pr.test.sh
#
# check-doc-only-pr.sh 의 executable spec (CLAUDE.md §3.2 R-112).
# happy(전부 doc → 면제) / negative(코드·ADR·architecture·CI·config 혼합 →
# 게이트 필요) / edge(빈 입력·공백) cases 를 충분히 cover 한다.
# 네트워크/의존성 0 — 순수 bash. CI 의 "doc-only 판정 script 자체 test" step 이 실행.

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-doc-only-pr.sh"
fail=0

# assert_exit <설명> <기대 exit code> <stdin 입력>
assert_exit() {
  local desc="$1" expected="$2" input="$3" actual
  printf '%s' "$input" | bash "$SCRIPT" >/dev/null 2>&1
  actual=$?
  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: $desc — expected exit $expected, got $actual"
    fail=1
  else
    echo "PASS: $desc"
  fi
}

# --- happy path: 전부 direct-mode 문서 → 면제(exit 0) ---
assert_exit "STATE+PLAN+task+journal 전부 doc → 면제" 0 \
  $'docs/STATE.json\ndocs/PLAN.md\ndocs/tasks/T-0283-x.md\ndocs/progress/journal-2026-06-08.md'
assert_exit "CLAUDE.md 단독 → 면제" 0 'CLAUDE.md'
assert_exit "README.md 단독 → 면제" 0 'README.md'
assert_exit ".claude meta 단독 → 면제" 0 '.claude/agents/reviewer.md'
assert_exit "LOOP.md + use-cases → 면제" 0 $'docs/LOOP.md\ndocs/use-cases/UC-01-x.md'
assert_exit "requirements + PLAN_archive → 면제" 0 $'docs/requirements.md\ndocs/PLAN_archive.md'

# --- negative path: pr-mode 영역 1+ 포함 → 게이트 필요(exit 1) ---
assert_exit "src 코드 포함 → 게이트 필요" 1 \
  $'docs/PLAN.md\nsrc/llm/llm-http-gateway.service.ts'
assert_exit "test 코드 포함 → 게이트 필요" 1 \
  $'docs/PLAN.md\ntest/e2e/foo.e2e-spec.ts'
assert_exit "ADR(decisions) 포함 → 게이트 필요" 1 'docs/decisions/ADR-0031-x.md'
assert_exit "architecture 문서 포함 → 게이트 필요" 1 'docs/architecture/modules.md'
assert_exit "CI workflow 포함 → 게이트 필요" 1 '.github/workflows/ci.yml'
assert_exit "scripts 포함 → 게이트 필요" 1 'scripts/check-doc-only-pr.sh'
assert_exit "package.json 포함 → 게이트 필요" 1 'package.json'
assert_exit "lockfile 포함 → 게이트 필요" 1 'pnpm-lock.yaml'
assert_exit "prisma schema 포함 → 게이트 필요" 1 'prisma/schema.prisma'

# --- edge: 부분 경로 매칭 우회 방지 (allowlist 는 ^anchor) ---
assert_exit "이름이 docs 로 시작하는 비-docs 경로 → 게이트 필요" 1 'docssrc/evil.ts'
assert_exit "src 안의 PLAN.md 유사 파일 → 게이트 필요" 1 'src/docs/PLAN.md'

# --- edge: 빈 입력 / 공백만 → 보수적 게이트 필요(exit 1) ---
assert_exit "빈 입력 → 보수적 게이트 필요" 1 ''
assert_exit "공백·빈 줄만 → 보수적 게이트 필요" 1 $'   \n\n  '

if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
