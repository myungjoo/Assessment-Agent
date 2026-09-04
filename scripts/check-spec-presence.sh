#!/usr/bin/env bash
# scripts/check-spec-presence.sh
#
# CLAUDE.md §3.2 R-112 의 1차 자동 강제 layer.
# PR diff 에 새로 추가된 production .ts / .tsx 파일이 있는데 대응 spec 이
# 같이 추가되지 않았으면 exit 1 로 CI 를 fail 시킨다.
# spec 의 *내용* 까지 검증하지는 않는다 (T-0008 범위).
#
# 사용법:
#   BASE_REF=origin/main scripts/check-spec-presence.sh
# BASE_REF 미지정 시 origin/main 을 기본값으로 사용.

set -euo pipefail

BASE_REF="${BASE_REF:-origin/main}"

# 추가된(A) 파일만 검사. 수정(M)·삭제는 spec 의무 대상 외.
mapfile -t added < <(git diff --name-only --diff-filter=A "${BASE_REF}...HEAD" -- '*.ts' '*.tsx')

# 확장자 제거: .tsx 를 먼저 떼고, 그 다음 .ts 를 뗀다.
# ${f%.ts} 만으로는 foo.tsx 에서 아무것도 떼지 못해
# foo.tsx.spec.ts 를 찾는 버그가 된다 (T-1885).
strip_ext() {
  local x="${1%.tsx}"
  echo "${x%.ts}"
}

missing=()
for f in "${added[@]}"; do
  # 제외: spec / test 파일 그 자체 (.tsx 변종 포함)
  case "$f" in
    *.spec.ts|*.test.ts|*.e2e-spec.ts|*.smoke-spec.ts) continue ;;
    *.spec.tsx|*.test.tsx) continue ;;
    # 제외: type-declaration 파일 (web/src/*.d.ts 등) — runtime 코드가 없어 spec 대상 아님.
    *.d.ts) continue ;;
    test/*|*/test/*|*/__tests__/*) continue ;;
    # 제외: entrypoint (CLAUDE.md §3.2 Entrypoint 예외) — NestJS 부트스트랩 / Vite entrypoint.
    src/main.ts|web/src/main.tsx) continue ;;
  esac
  # 제외: 단일 re-export 만 있는 index.ts / index.tsx (export/import 라인만, 그 외 빈 줄·주석만 허용)
  base="$(basename "$f")"
  if [ "$base" = "index.ts" ] || [ "$base" = "index.tsx" ]; then
    if ! grep -Ev '^\s*(//|/\*|\*|$)' "$f" | grep -Eqv '^\s*(export|import) '; then
      continue
    fi
  fi
  # 대응 spec 후보 4 종 — 하나라도 있으면 통과:
  #   foo.spec.ts  (root jest 관행)
  #   foo.test.ts  (web vitest 관행 — root jest testRegex 와 충돌 회피,
  #                 ADR-0041 Decision 3 / T-0380 박제)
  #   foo.spec.tsx / foo.test.tsx (web 의 JSX spec 관행 — T-1885 에서 인식 추가)
  stem="$(strip_ext "$f")"
  found=0
  for cand in "${stem}.spec.ts" "${stem}.test.ts" "${stem}.spec.tsx" "${stem}.test.tsx"; do
    if [ -f "$cand" ]; then
      found=1
      break
    fi
  done
  if [ "$found" = "1" ]; then
    continue
  fi
  missing+=("$f")
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "[spec-presence] 신규 production .ts/.tsx 에 대응 spec 이 없습니다:" >&2
  for m in "${missing[@]}"; do
    echo "  - $m (기대 spec: $(strip_ext "$m").spec.ts / .test.ts / .spec.tsx / .test.tsx 중 1)" >&2
  done
  exit 1
fi

echo "[spec-presence] OK — 신규 production .ts/.tsx ${#added[@]} 건 검사 통과."
