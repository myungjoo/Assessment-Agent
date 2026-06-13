#!/usr/bin/env bash
# scripts/check-spec-presence.sh
#
# CLAUDE.md §3.2 R-112 의 1차 자동 강제 layer.
# PR diff 에 새로 추가된 production .ts 파일이 있는데 대응 spec 이
# 같이 추가되지 않았으면 exit 1 로 CI 를 fail 시킨다.
# spec 의 *내용* 까지 검증하지는 않는다 (T-0008 범위).
#
# 사용법:
#   BASE_REF=origin/main scripts/check-spec-presence.sh
# BASE_REF 미지정 시 origin/main 을 기본값으로 사용.

set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"

# 추가된(A) 파일만 검사. 수정(M)·삭제는 spec 의무 대상 외.
mapfile -t added < <(git diff --name-only --diff-filter=A "${BASE_REF}...HEAD" -- '*.ts')

missing=()
for f in "${added[@]}"; do
  # 제외: spec / test 파일 그 자체
  case "$f" in
    *.spec.ts|*.test.ts|*.e2e-spec.ts|*.smoke-spec.ts) continue ;;
    test/*|*/test/*|*/__tests__/*) continue ;;
    src/main.ts) continue ;;
  esac
  # 제외: 단일 re-export 만 있는 index.ts (export/import 라인만, 그 외 빈 줄·주석만 허용)
  base="$(basename "$f")"
  if [ "$base" = "index.ts" ]; then
    if ! grep -Ev '^\s*(//|/\*|\*|$)' "$f" | grep -Eqv '^\s*(export|import) '; then
      continue
    fi
  fi
  # 대응 spec 후보: foo.ts → foo.spec.ts (same dir, root jest 관행)
  # 또는 foo.ts → foo.test.ts (web/ vitest 관행 — root jest testRegex 와 충돌
  # 회피 위해 .test.ts 를 사용; ADR-0041 Decision 3 / T-0380 박제).
  spec="${f%.ts}.spec.ts"
  if [ -f "$spec" ]; then
    continue
  fi
  test_spec="${f%.ts}.test.ts"
  if [ -f "$test_spec" ]; then
    continue
  fi
  missing+=("$f")
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "[spec-presence] 신규 production .ts 에 대응 spec 이 없습니다:" >&2
  for m in "${missing[@]}"; do echo "  - $m (기대 spec: ${m%.ts}.spec.ts)" >&2; done
  exit 1
fi

echo "[spec-presence] OK — 신규 production .ts ${#added[@]} 건 검사 통과."
