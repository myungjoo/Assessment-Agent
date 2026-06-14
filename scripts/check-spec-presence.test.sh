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
# T-0409 happy: web .ts + colocated .test.ts (vitest 관행) → pass.
setup_web_test() { mkdir -p web/src; echo 'export const a=1;' >web/src/a.ts; echo 't' >web/src/a.test.ts; }
# T-0409 error/negative: web .ts 단독 (대응 spec/test 없음) → fail.
setup_web_missing() { mkdir -p web/src; echo 'export const b=1;' >web/src/b.ts; }
# T-0409 분기 가드: web .d.ts 단독 → pass (제외 분기). main-script 제외 없으면 fail = regression.
setup_web_dts() { mkdir -p web/src; echo 'export interface T { id: number }' >web/src/types.d.ts; }
# T-0409 추가 negative: web 경로 잘못된 suffix (.notspec.ts) 는 spec 으로 오통과 금지.
setup_web_bad_suffix() { mkdir -p web/src; echo 'export const e=1;' >web/src/e.ts; echo 't' >web/src/e.notspec.ts; }

echo "[test] check-spec-presence.sh 자체 검증"
case_run happy           0 setup_happy
case_run error           1 setup_error
case_run branch          0 setup_branch
case_run negative        0 setup_negative
case_run regression      1 setup_regression
case_run smoke_suffix    0 setup_smoke_suffix
case_run test_leading    0 setup_test_leading
case_run bad_suffix      1 setup_bad_suffix
case_run web_test        0 setup_web_test
case_run web_missing     1 setup_web_missing
case_run web_dts         0 setup_web_dts
case_run web_bad_suffix  1 setup_web_bad_suffix

read -r p f <"$COUNTERS"; rm -f "$COUNTERS"
echo "[test] pass=$p fail=$f"
[ "$f" = "0" ]
