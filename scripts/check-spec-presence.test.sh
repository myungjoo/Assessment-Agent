#!/usr/bin/env bash
# scripts/check-spec-presence.test.sh
#
# scripts/check-spec-presence.sh 자체 검증 (R-112: happy / error / branch / negative / regression).
# 임시 git repo 에 main commit + feature commit 시나리오를 만들고
# BASE_REF=main 으로 검사 script 를 호출, exit code 를 검증한다.

set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/check-spec-presence.sh"
COUNTERS="$(mktemp)"; echo "0 0" >"$COUNTERS"

record() { read -r p f <"$COUNTERS"; echo "$((p+$1)) $((f+$2))" >"$COUNTERS"; }

case_run() {
  local name="$1" expected="$2" setup="$3"
  local tmp; tmp="$(mktemp -d)"
  pushd "$tmp" >/dev/null
  git init -q -b main >/dev/null && git config user.email t@e && git config user.name t
  git commit -q --allow-empty -m base
  git checkout -q -b feat
  "$setup"
  git add -A && git commit -q -m feat
  BASE_REF=main bash "$SCRIPT" >sp.out 2>&1
  local actual=$?
  if [ "$actual" = "$expected" ]; then
    echo "  ok   $name (exit=$actual)"; record 1 0
  else
    echo "  FAIL $name (expected=$expected actual=$actual)"; sed 's/^/    /' sp.out; record 0 1
  fi
  popd >/dev/null; rm -rf "$tmp"
}

setup_happy() { mkdir -p src; echo 'export const a=1;' >src/a.ts; echo 't' >src/a.spec.ts; }
setup_error() { mkdir -p src; echo 'export const b=1;' >src/b.ts; }
setup_branch() {
  mkdir -p src/sub
  echo 'export const x=1;' >src/sub/x.ts; echo 't' >src/sub/x.spec.ts
  echo 'export * from "./sub/x";' >src/index.ts
  echo 'bootstrap();' >src/main.ts
  echo 't' >src/something.spec.ts
}
setup_negative() { mkdir -p src; echo 't' >src/onlyspec.spec.ts; }
setup_regression() { mkdir -p src; echo 'export class C{}' >src/c.ts; }
# T-0012 regression: .smoke-spec.ts suffix 가 spec 으로 인식되어야 한다.
setup_smoke_suffix() { mkdir -p test/smoke; echo 't' >test/smoke/app.smoke-spec.ts; }
# T-0012 regression: leading 'test/' path (no leading slash) 가 test 디렉토리로 인식되어야 한다.
setup_test_leading() { mkdir -p test/e2e; echo 'export const e=1;' >test/e2e/util.ts; }
# T-0012 추가 negative: 잘못된 suffix (.notspec.ts) 는 spec 으로 잘못 통과되면 안 됨.
setup_bad_suffix() { mkdir -p src; echo 'export const d=1;' >src/d.ts; echo 't' >src/d.notspec.ts; }

echo "[test] check-spec-presence.sh 자체 검증"
case_run happy         0 setup_happy
case_run error         1 setup_error
case_run branch        0 setup_branch
case_run negative      0 setup_negative
case_run regression    1 setup_regression
case_run smoke_suffix  0 setup_smoke_suffix
case_run test_leading  0 setup_test_leading
case_run bad_suffix    1 setup_bad_suffix

read -r p f <"$COUNTERS"; rm -f "$COUNTERS"
echo "[test] pass=$p fail=$f"
[ "$f" = "0" ]
