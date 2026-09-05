#!/usr/bin/env bash
# scripts/check-dependency-consistency.test.sh
#
# check-dependency-consistency.sh 의 executable spec (CLAUDE.md §3.2 R-112) — happy(현 repo ·
# 일치 fixture) / error(J1·J2·J3 위반) / 분기(판정별 3 분기) / negative(파싱 불가 · web manifest
# 부재 · 키 부재 · 빈 객체 · 비문자열 spec) cover. fixture 는 임시 디렉터리에만 쓰고 종료 시
# 정리한다(repo 파일 write 0, 네트워크 · install 0). CI 의 "의존성 정합성 script 자체 test" 가 실행.

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-dependency-consistency.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail=0

# MSYS(Git Bash) 에서 /tmp 계열 경로는 node 가 해석하지 못하므로 native 경로로 변환.
# Linux(CI) 에서는 `pwd -W` 가 없어 그대로 반환된다.
native() {
  (cd "$1" && pwd -W) 2>/dev/null || (cd "$1" && pwd)
}

# fixture <이름> — 디렉터리를 만들고 native 경로를 echo.
fixture() {
  mkdir -p "$WORK/$1"
  native "$WORK/$1"
}

# assert_case <설명> <기대 exit> <TARGET_ROOT> [출력에 포함돼야 할 문자열]
assert_case() {
  local desc="$1" expected="$2" target="$3" needle="${4:-}" actual out
  out="$(TARGET_ROOT="$target" bash "$SCRIPT" 2>&1)"
  actual=$?
  if [ "$actual" -ne "$expected" ]; then
    echo "FAIL: $desc — expected exit $expected, got $actual"
    printf '  출력: %s\n' "$out"
    fail=1
    return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -qF "$needle"; then
    echo "FAIL: $desc — 출력에 '$needle' 이 없음"
    printf '  출력: %s\n' "$out"
    fail=1
    return
  fi
  if printf '%s' "$out" | grep -qE 'at [A-Za-z]+\.|node:internal'; then
    echo "FAIL: $desc — stack trace 가 출력에 노출됨"
    fail=1
    return
  fi
  echo "PASS: $desc"
}

# --- happy path: 현 repo 상태 --------------------------------------------------
out="$(bash "$SCRIPT" 2>&1)"; rc=$?
summary_lines="$(printf '%s\n' "$out" | grep -cE '^J[123] ')"
if [ "$rc" -ne 0 ] || [ "$summary_lines" -ne 3 ]; then
  echo "FAIL: 현 repo happy path — exit $rc, J 요약 $summary_lines 줄 (기대 exit 0 / 3 줄)"
  printf '  출력: %s\n' "$out"
  fail=1
else
  echo "PASS: 현 repo happy path — exit 0 + J1~J3 요약 3 줄"
fi

# --- J1 분기 -------------------------------------------------------------------
d="$(fixture j1-none)"
echo '{"dependencies":{"nestjs":"^10.0.0"}}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"devDependencies":{"vite":"^8.0.16"}}' >"$d/web/package.json"
assert_case "J1 분기 ① 공통 이름 0 개 → 통과" 0 "$d" "공통 이름 0 개"

d="$(fixture j1-match)"
echo '{"devDependencies":{"typescript":"5.6.2","jest":"^29.7.0"}}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"devDependencies":{"typescript":"5.6.2"}}' >"$d/web/package.json"
assert_case "J1 분기 ② 공통 있고 전부 일치 → 통과" 0 "$d" "공통 이름 1 개 일치"

d="$(fixture j1-mismatch)"
echo '{"devDependencies":{"typescript":"5.6.2"},"dependencies":{"react":"^19.0.0"}}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"dependencies":{"react":"^18.2.0"},"devDependencies":{"typescript":"5.4.0"}}' >"$d/web/package.json"
assert_case "J1 분기 ③ 공통 2 개 불일치 → 위반" 1 "$d" "J1 위반"

# --- J2 분기 -------------------------------------------------------------------
d="$(fixture j2-web-pnpm)"
echo '{}' >"$d/package.json"; mkdir -p "$d/web"; touch "$d/web/pnpm-lock.yaml"
assert_case "J2 분기 ① web/pnpm-lock.yaml → 위반" 1 "$d" "web/pnpm-lock.yaml"

d="$(fixture j2-npm)"
echo '{}' >"$d/package.json"; touch "$d/package-lock.json"
assert_case "J2 분기 ② package-lock.json → 위반" 1 "$d" "J2 위반"

d="$(fixture j2-yarn)"
echo '{}' >"$d/package.json"; touch "$d/yarn.lock"
assert_case "J2 분기 ③ yarn.lock → 위반" 1 "$d" "yarn.lock"

# --- J3 분기 -------------------------------------------------------------------
d="$(fixture j3-overrides)"
echo '{"overrides":{"lodash":"4.17.21"}}' >"$d/package.json"
assert_case "J3 분기 ① root overrides → 위반" 1 "$d" "package.json: overrides"

d="$(fixture j3-resolutions)"
echo '{}' >"$d/package.json"; mkdir -p "$d/web"
echo '{"resolutions":{"lodash":"4.17.21"}}' >"$d/web/package.json"
assert_case "J3 분기 ② web resolutions → 위반" 1 "$d" "web/package.json: resolutions"

d="$(fixture j3-absent)"
echo '{"dependencies":{}}' >"$d/package.json"
assert_case "J3 분기 ③ 둘 다 부재 → 통과" 0 "$d" "J3 version 재작성 필드 금지: 위반 0"

# --- negative -------------------------------------------------------------------
d="$(fixture neg-parse)"
echo '{"dependencies":{,,}' >"$d/package.json"
assert_case "negative ① 파싱 불가 JSON → 사유 출력 + 위반" 1 "$d" "파싱하지 못했습니다"

d="$(fixture neg-no-web)"
echo '{"devDependencies":{"typescript":"5.6.2"}}' >"$d/package.json"
assert_case "negative ② web/package.json 부재 → J1 skip · 오탐 0" 0 "$d" "skip — web/package.json 부재"

d="$(fixture neg-no-keys)"
echo '{"name":"x","version":"0.0.0"}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"name":"web"}' >"$d/web/package.json"
assert_case "negative ③ dependencies·devDependencies 키 자체 부재 → 통과" 0 "$d" "공통 이름 0 개"

d="$(fixture neg-empty-keys)"
echo '{"dependencies":{},"devDependencies":{}}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"dependencies":{},"devDependencies":{}}' >"$d/web/package.json"
assert_case "negative ④ 두 키가 빈 객체 → 통과" 0 "$d" "공통 이름 0 개"

d="$(fixture neg-non-string)"
echo '{"dependencies":{"typescript":"5.6.2"}}' >"$d/package.json"
mkdir -p "$d/web"; echo '{"dependencies":{"typescript":562}}' >"$d/web/package.json"
assert_case "negative ⑤ version spec 이 문자열 아님 → 비교 불가 위반" 1 "$d" "비교 불가"

if [ "$fail" -ne 0 ]; then
  echo "RESULT: FAIL"
  exit 1
fi
echo "RESULT: PASS (모든 case 통과)"
