#!/usr/bin/env bash
# scripts/check-dependency-consistency.sh
#
# README 108 행 / docs/requirements.md 75 행 REQ-056 의 CI 판정 축 — root package.json 과
# web/package.json 을 top-level 정적 판정만으로 검사한다. 판정 3 종:
#   J1 공통 의존성 version mismatch — 두 manifest 의 dependencies + devDependencies 를
#      각각 병합해, 공통 이름의 version spec 문자열이 다르면 위반.
#   J2 lockfile 단일성 — pnpm-lock.yaml 은 root 1 개만 (ADR-0040 §4). web/pnpm-lock.yaml
#      · package-lock.json · yarn.lock (root·web) 중 하나라도 있으면 위반.
#   J3 version 재작성 필드 금지 — 두 manifest 중 최상위 overrides · resolutions 키가 있으면 위반.
#
# 사용법: `bash scripts/check-dependency-consistency.sh` (repo root) —
#        `TARGET_ROOT=<dir>` 로 판정 대상 주입 (check-spec-presence.sh 의 BASE_REF 와 동형).
# 계약: 인자 0 개. 위반 0 이면 판정별 요약 3 줄 출력 후 exit 0, 위반 1+ 이면 한국어 사유 +
#      위반 항목 출력 후 exit 1. 순수 bash + node — jq · 네트워크 · install · lockfile
#      재작성 0 (cloud runner 에 jq 가 없어 JSON 파싱은 node -e 로만 한다).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_ROOT="${TARGET_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

ROOT_MANIFEST="$TARGET_ROOT/package.json"
WEB_MANIFEST="$TARGET_ROOT/web/package.json"

violations=0

# manifest 1 개를 정규화해 stdout 으로 뱉는다.
#   DEP<TAB><name><TAB><spec 또는 __NON_STRING__>
#   FIELD<TAB>overrides|resolutions<TAB>1
# 파싱·읽기 실패 시 non-zero — stack trace 는 노출하지 않는다(2>/dev/null).
dump_manifest() {
  node -e '
    const fs = require("fs");
    let json;
    try { json = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch (e) { process.exit(3); }
    if (json === null || typeof json !== "object" || Array.isArray(json)) { process.exit(3); }
    const merged = {};
    for (const key of ["dependencies", "devDependencies"]) {
      const block = json[key];
      if (block === null || typeof block !== "object" || Array.isArray(block)) { continue; }
      for (const name of Object.keys(block)) {
        const spec = block[name];
        merged[name] = typeof spec === "string" ? spec : "__NON_STRING__";
      }
    }
    for (const name of Object.keys(merged).sort()) {
      console.log(["DEP", name, merged[name]].join("\t"));
    }
    for (const key of ["overrides", "resolutions"]) {
      if (Object.prototype.hasOwnProperty.call(json, key)) {
        console.log(["FIELD", key, "1"].join("\t"));
      }
    }
  ' "$1" 2>/dev/null
}

# dump 에 FIELD <key> 줄이 있으면 exit 0. tab 구분자는 awk 로 다뤄 정규식 함정을 피한다.
has_field() {
  printf '%s\n' "$1" | awk -F'\t' -v k="$2" 'BEGIN { found = 1 } $1 == "FIELD" && $2 == k { found = 0 } END { exit found }'
}

# --- manifest 로드 (파싱 실패는 즉시 종료: 판정 자체가 불가) -------------------
root_dump=""
if [ -f "$ROOT_MANIFEST" ]; then
  root_dump="$(dump_manifest "$ROOT_MANIFEST")"
  if [ $? -ne 0 ]; then
    echo "판정 불가: root package.json 을 JSON 으로 파싱하지 못했습니다 ($ROOT_MANIFEST)." >&2
    exit 1
  fi
else
  echo "판정 불가: root package.json 이 없습니다 ($ROOT_MANIFEST)." >&2
  exit 1
fi

web_present=0
web_dump=""
if [ -f "$WEB_MANIFEST" ]; then
  web_present=1
  web_dump="$(dump_manifest "$WEB_MANIFEST")"
  if [ $? -ne 0 ]; then
    echo "판정 불가: web/package.json 을 JSON 으로 파싱하지 못했습니다 ($WEB_MANIFEST)." >&2
    exit 1
  fi
fi

# --- J1 공통 의존성 version mismatch -----------------------------------------
if [ "$web_present" -eq 0 ]; then
  echo "J1 공통 의존성 version mismatch: skip — web/package.json 부재라 비교 대상 0."
else
  common=0
  mismatch=""
  while IFS=$'\t' read -r kind name spec; do
    [ "$kind" = "DEP" ] || continue
    web_spec="$(printf '%s\n' "$web_dump" | awk -F'\t' -v n="$name" '$1=="DEP" && $2==n {print $3; exit}')"
    [ -n "$web_spec" ] || continue
    common=$((common + 1))
    if [ "$spec" = "__NON_STRING__" ] || [ "$web_spec" = "__NON_STRING__" ]; then
      mismatch="${mismatch}  ${name}: root=${spec} / web=${web_spec} (version spec 이 문자열이 아니라 비교 불가)"$'\n'
    elif [ "$spec" != "$web_spec" ]; then
      mismatch="${mismatch}  ${name}: root=${spec} / web=${web_spec}"$'\n'
    fi
  done <<< "$root_dump"

  if [ -n "$mismatch" ]; then
    echo "J1 위반: root 와 web 의 공통 의존성 version spec 이 일치하지 않습니다 (공통 $common 개)." >&2
    printf '%s' "$mismatch" >&2
    violations=$((violations + 1))
  else
    echo "J1 공통 의존성 version mismatch: 위반 0 (공통 이름 $common 개 일치)."
  fi
fi

# --- J2 lockfile 단일성 -------------------------------------------------------
forbidden_locks=""
for rel in "web/pnpm-lock.yaml" "package-lock.json" "web/package-lock.json" "yarn.lock" "web/yarn.lock"; do
  if [ -f "$TARGET_ROOT/$rel" ]; then
    forbidden_locks="${forbidden_locks}  ${rel}"$'\n'
  fi
done

if [ -n "$forbidden_locks" ]; then
  echo "J2 위반: root pnpm-lock.yaml 외의 lockfile 이 존재합니다 (ADR-0040 §4 단일 lockfile workspace)." >&2
  printf '%s' "$forbidden_locks" >&2
  violations=$((violations + 1))
else
  echo "J2 lockfile 단일성: 위반 0 (root pnpm-lock.yaml 외 lockfile 0 개)."
fi

# --- J3 version 재작성 필드 금지 ---------------------------------------------
rewrite_fields=""
for key in overrides resolutions; do
  if has_field "$root_dump" "$key"; then
    rewrite_fields="${rewrite_fields}  package.json: ${key}"$'\n'
  fi
  if [ "$web_present" -eq 1 ] && has_field "$web_dump" "$key"; then
    rewrite_fields="${rewrite_fields}  web/package.json: ${key}"$'\n'
  fi
done

if [ -n "$rewrite_fields" ]; then
  echo "J3 위반: version 재작성 필드(overrides · resolutions)는 mismatch 를 숨기므로 금지됩니다." >&2
  printf '%s' "$rewrite_fields" >&2
  violations=$((violations + 1))
else
  echo "J3 version 재작성 필드 금지: 위반 0 (overrides · resolutions 키 0 개)."
fi

if [ "$violations" -ne 0 ]; then
  echo "의존성 정합성 검증 실패 — 위반 판정 ${violations} 종 (REQ-056)." >&2
  exit 1
fi
exit 0
