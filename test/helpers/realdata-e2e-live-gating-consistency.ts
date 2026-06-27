// realdata-e2e-live-gating-consistency.ts — 실 평가 e2e live-gating 결정
// (`resolveRealDataE2eLiveGating`, T-0610) 이, 동일 env map 으로부터 **독립 재유도**한
// expected gating 과 deep-equal 정합한지 검증하는 순수 가드(T-0707 박제).
//
// 동기: leaf 컴포저 `resolveRealDataE2eLiveGating`(T-0610, `realdata-e2e-live-gating.ts`)
// 은 enable flag + Ollama 5 종 + github read PAT 의 **7-env 완전성 규칙**으로 `enabled`
// 를 판정하고, 활성 시 credential 묶음(ollama) + githubPat + reason 을 합성하는 순수
// leaf 인데, 그 판정 로직(isPresent non-blank·완전성 AND·활성 시에만 credential present·
// missing 순서)이 입력 env 로부터 독립 재유도되어 build-time 에 대조되지 않는다(NO-GUARD
// leaf). 상위 가드가 컴포저를 **재호출**해 deep-equal 할 뿐이라 판정 내부 로직 drift(예:
// enabled=true 인데 credential 누락·reason 에 credential 값 누출·missing 순서 어긋남)를
// 양방향 상쇄로 놓친다(재호출의 한계). 본 가드는 컴포저 재호출 없이 `env` 만으로 expected
// gating 을 독립 재유도해 입력 `gating` 과 deep-equal 대조함으로써 gating drift 를
// fail-fast 로 차단한다(T-0705 result-summary 가드와 동형).
//
// 검증하는 불변식(single source — 컴포저 재호출 0, 판정 독립 재구현):
//   ① enabled === true ⟺ 7 env(REALDATA_E2E_REQUIRED_ENV) 전부 non-blank(isPresent).
//   ② 활성(enabled=true) 시에만 ollama credential 묶음 5 필드 + githubPat present(전부
//      trim 값). 비활성(enabled=false) 시 둘 다 undefined(present-coupling 양방향).
//   ③ credential 값(baseUrl/apiKey/model/provider/apiVersion/githubPat 실값)이 `reason`
//      문자열에 절대 노출되지 않는다(§9).
//   ④ `missing` 동치 — 부재 env 나열 순서 = REALDATA_E2E_REQUIRED_ENV 순서(재유도 reason
//      이 컴포저 reason 과 byte-identical 한지 deep-equal 로 대조).
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
//   - `gating` null/undefined·비객체·`enabled` 비-boolean·`reason` 비-string·`ollama` 가
//     객체 아님(활성인데 누락 등 구조 결손)·`githubPat` 비-string(활성인데) → 한국어 TypeError.
//   - 독립 재유도 expected 와 입력 `gating` drift(enabled mismatch·credential
//     present-coupling 위반·reason 불일치·missing 순서/집합 불일치)·`reason` 에 credential
//     값 누출 → 한국어 RangeError(기대 vs 실측 노출, 단 credential 실값은 echo 0).
//   - silent 통과 0. 검사 순서: 구조(gating) → 재유도 → deep-equal 비교. 가장 먼저 위반한
//     지점에서 throw(fail-fast).
//
// 비변형 / 순수: `gating`(읽기·비교만) / `env`(읽기만, mutate 0). 재유도용 새 객체만 생성.
// 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM·실 네트워크 0 · 새 외부 dependency 0 ·
// credential echo/log 0(env 이름 상수만 메시지에 사용, §9). 동일 입력 → 동일 동작.
//
// env 이름 상수·완전성 순서 single source(중복 정의 0): REALDATA_E2E_REQUIRED_ENV 및 7
// env 이름 상수는 `realdata-e2e-live-gating.ts`(컴포저)에서 import 재사용한다 — 본 가드는
// 새 env 이름·순서를 정의하지 않는다(컴포저와 동일 SSOT). 판정 로직(isPresent·완전성 AND·
// credential coupling)만 독립 재구현한다(재호출의 양방향 상쇄 회피가 핵심).
//
// Out of Scope (T-0707): 컴포저 본문 수정 / self-wire 배선(가드를 컴포저 return 직전 호출 —
// 후속 별도 task) · env 이름 집합/완전성 규칙/isPresent 정책 변경 · production src 변경 ·
// 자동 복구/gating 재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import {
  REALDATA_E2E_LLM_BASE_URL_ENV,
  REALDATA_E2E_LLM_API_KEY_ENV,
  REALDATA_E2E_LLM_MODEL_ENV,
  REALDATA_E2E_LLM_PROVIDER_ENV,
  REALDATA_E2E_LLM_API_VERSION_ENV,
  REALDATA_E2E_GITHUB_READ_PAT_ENV,
  REALDATA_E2E_REQUIRED_ENV,
  type RealDataE2eLiveGating,
  type RealDataE2eLiveOllamaCredential,
} from "./realdata-e2e-live-gating";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신
// 구분해 노출한다(디버깅 가독성). result-summary 가드 동형.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// isPlainRecord — value 가 plain 객체(Record)인지 판정. null/array 는 제외한다
// (gating / ollama 묶음 구조 검증용).
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// isPresent — env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 컴포저(`realdata-e2e-live-gating.ts`)의 isPresent 와 **동형이되 의도적으로 독립 재구현**
// 한다 — 컴포저 재호출이 아니라 판정 로직을 재구성해야 drift 를 양방향 상쇄 없이 잡는다.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다.
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// ollama 묶음의 필드 이름 ↔ env 이름 매핑(재유도 시 trim 값 합성용). credential 값은 본
// 가드 어디에도 echo 하지 않는다 — env *이름* 만 진단/매핑에 쓴다(§9).
const OLLAMA_FIELD_ENV: ReadonlyArray<
  [keyof RealDataE2eLiveOllamaCredential, string]
> = [
  ["baseUrl", REALDATA_E2E_LLM_BASE_URL_ENV],
  ["apiKey", REALDATA_E2E_LLM_API_KEY_ENV],
  ["model", REALDATA_E2E_LLM_MODEL_ENV],
  ["provider", REALDATA_E2E_LLM_PROVIDER_ENV],
  ["apiVersion", REALDATA_E2E_LLM_API_VERSION_ENV],
];

// assertGatingStructure — `gating` 객체와 필드의 구조가 온전한지 fail-fast 검증.
// 구조/타입 결손은 TypeError 로 구분한다(값 정합 위반과 분리). enabled 는 boolean,
// reason 은 string 이어야 하며, enabled 분기에 따라 credential 묶음의 최소 형태도 검증한다
// (활성인데 ollama 비-객체·githubPat 비-string 은 구조 결손 — 깊은 값 정합은 재유도 비교가 맡는다).
function assertGatingStructure(
  gating: RealDataE2eLiveGating | null | undefined,
): asserts gating is RealDataE2eLiveGating {
  if (!isPlainRecord(gating)) {
    throw new TypeError(
      `gating 이 객체가 아니다(타입: ${describe(gating)}) — RealDataE2eLiveGating 가 필요하다.`,
    );
  }
  const enabled = (gating as { enabled?: unknown }).enabled;
  if (typeof enabled !== "boolean") {
    throw new TypeError(
      `gating.enabled 가 boolean 이 아니다(타입: ${describe(enabled)}) — gating 정합 재유도를 진행할 수 없다.`,
    );
  }
  const reason = (gating as { reason?: unknown }).reason;
  if (typeof reason !== "string") {
    throw new TypeError(
      `gating.reason 이 문자열이 아니다(타입: ${describe(reason)}) — reason 정합 비교를 진행할 수 없다.`,
    );
  }
  const ollama = (gating as { ollama?: unknown }).ollama;
  const githubPat = (gating as { githubPat?: unknown }).githubPat;
  if (enabled) {
    // 활성이면 credential 묶음 최소 형태 보장 — ollama 는 5 필드 string Record, githubPat 은
    // string 이어야 한다. 구조 결손은 TypeError(값 정합 coupling 위반과 분리).
    if (!isPlainRecord(ollama)) {
      throw new TypeError(
        `gating.ollama 가 객체가 아니다(타입: ${describe(ollama)}) — 활성 gating 은 ollama credential 묶음을 보유해야 한다.`,
      );
    }
    for (const [field] of OLLAMA_FIELD_ENV) {
      if (typeof ollama[field] !== "string") {
        throw new TypeError(
          `gating.ollama.${field} 가 문자열이 아니다(타입: ${describe(ollama[field])}) — credential 묶음 최소 형태 보장 실패.`,
        );
      }
    }
    if (typeof githubPat !== "string") {
      throw new TypeError(
        `gating.githubPat 이 문자열이 아니다(타입: ${describe(githubPat)}) — 활성 gating 은 github read PAT 를 보유해야 한다.`,
      );
    }
  } else {
    // 비활성이면 credential 필드는 부재(undefined)여야 구조적으로 온전하다 — present 면
    // 역 present-coupling 위반이지만 그 판정은 값 정합(RangeError)이 맡으므로 여기선
    // string/객체 등 비-undefined 타입을 구조 결손으로 보지 않고 통과시킨다(재유도 비교에 위임).
    void ollama;
    void githubPat;
  }
}

// deriveExpectedGating — `env` 만으로 expected gating 을 **독립 재유도**한다. 컴포저
// (`resolveRealDataE2eLiveGating`, T-0610)의 판정(isPresent·7-env 완전성 AND·활성 시
// credential 묶음 합성·missing 순서·reason 문구)을 의도적으로 재구현한다(컴포저 재호출 0 —
// 재호출은 동일 로직 drift 를 양방향 상쇄해 잡지 못한다). 재유도용 **새 객체** 만 생성하고
// 입력 env 는 읽기만 한다. credential 값은 반환 객체에 담되 reason 에는 절대 넣지 않는다(§9).
function deriveExpectedGating(env: NodeJS.ProcessEnv): RealDataE2eLiveGating {
  // 7-env present 여부를 REALDATA_E2E_REQUIRED_ENV 순서로 평가해 missing 을 모은다(순서
  // = 컴포저 reason 의 나열 순서). 실값은 missing 에 넣지 않는다(이름만, §9).
  const missing: string[] = [];
  for (const name of REALDATA_E2E_REQUIRED_ENV) {
    if (!isPresent(env[name])) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    // 하나라도 부재 → 비활성. reason 에 이름만 박제(컴포저 문구 byte-identical 재구현).
    return {
      enabled: false,
      reason: `realdata-e2e live smoke skip — gating env 부재: ${missing.join(", ")}`,
    };
  }

  // 7 종 모두 present — 활성. trim 된 값을 credential 묶음으로 합성(컴포저 동형). isPresent
  // 가 narrowing 을 보장하나 재유도 경로라 명시적 String() 으로 string 을 확정한다.
  return {
    enabled: true,
    ollama: {
      baseUrl: String(env[REALDATA_E2E_LLM_BASE_URL_ENV]).trim(),
      apiKey: String(env[REALDATA_E2E_LLM_API_KEY_ENV]).trim(),
      model: String(env[REALDATA_E2E_LLM_MODEL_ENV]).trim(),
      provider: String(env[REALDATA_E2E_LLM_PROVIDER_ENV]).trim(),
      apiVersion: String(env[REALDATA_E2E_LLM_API_VERSION_ENV]).trim(),
    },
    githubPat: String(env[REALDATA_E2E_GITHUB_READ_PAT_ENV]).trim(),
    reason: "realdata-e2e live smoke 활성 — gating env 7 종 모두 set",
  };
}

// collectCredentialValues — gating 의 credential 실값(ollama 5 필드 + githubPat)을 모은다.
// §9 비노출 단언 전용 — reason 에 이 값들이 섞였는지 검사하기 위해서만 사용하고, 본 함수의
// 반환값은 throw message·log 에 절대 echo 하지 않는다(호출처가 포함 여부 boolean 만 사용).
function collectCredentialValues(gating: RealDataE2eLiveGating): string[] {
  const values: string[] = [];
  if (gating.ollama) {
    for (const [field] of OLLAMA_FIELD_ENV) {
      const v = gating.ollama[field];
      if (typeof v === "string" && v.length > 0) {
        values.push(v);
      }
    }
  }
  if (typeof gating.githubPat === "string" && gating.githubPat.length > 0) {
    values.push(gating.githubPat);
  }
  return values;
}

/**
 * 실 평가 e2e live-gating 결정(`resolveRealDataE2eLiveGating`, T-0610)이, 동일 env map
 * 으로부터 가드 안에서 독립 재유도한 expected gating 과 deep-equal 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 L109 실 평가 e2e 입력 chain 의 gating-layer 무결성 조각).
 * T-0705 result-summary 가드의 "컴포저 재호출이 아니라 판정 독립 재구현" 정신을 gating
 * layer 로 mirror 한다.
 *
 * 검증하는 불변식(single source — 컴포저 재호출 0, 판정 독립 재구현):
 *   ① enabled === true ⟺ 7 env 전부 non-blank.
 *   ② 활성 시에만 ollama 묶음 + githubPat present(비활성 시 둘 다 undefined) — 양방향 coupling.
 *   ③ reason 에 credential 실값 비노출(§9).
 *   ④ missing 나열 순서 = REALDATA_E2E_REQUIRED_ENV 순서(재유도 reason 과 byte-identical).
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `gating` null/undefined·비객체·enabled 비-boolean·reason 비-string·활성인데 ollama
 *     비-객체/필드 비-string·githubPat 비-string → 한국어 TypeError.
 *   - 독립 재유도 expected 와 입력 `gating` drift(enabled mismatch·credential
 *     present-coupling 위반·reason 불일치·missing 순서/집합 불일치)·reason 에 credential
 *     값 누출 → 한국어 RangeError. 단 credential 실값은 메시지에 echo 0(§9).
 *   - silent 통과 0. 검사 순서: 구조(gating) → 재유도 → deep-equal 비교. fail-fast.
 *
 * 비변형 / 순수: `gating`/`env` 를 읽기·비교만 한다(쓰기 0). 재유도용 새 객체만 생성.
 * 부수효과 0·새 외부 dependency 0·credential echo 0. 동일 입력 → 동일 동작.
 *
 * @param gating 검증 대상 컴포저 산출 gating. 변형하지 않는다(읽기·비교만). enabled/reason
 *   필수, 활성 시 ollama/githubPat 필수. 재유도 expected 와 정합해야 한다.
 * @param env 재유도 입력 env map. 변형하지 않는다(읽기만). 7-env 완전성 판정에 재사용한다.
 * @returns 재유도 expected 와 정합하면 정상 반환(void).
 * @throws {TypeError} `gating` 구조·타입 결손.
 * @throws {RangeError} 독립 재유도 expected 와 입력 `gating` drift(값 정합 위반).
 */
export function assertRealDataE2eLiveGatingConsistentWithEnv(
  gating: RealDataE2eLiveGating,
  env: NodeJS.ProcessEnv,
): void {
  // 구조 검증(TypeError 분기) — gating 객체·enabled·reason·(활성 시) credential 형태.
  assertGatingStructure(gating);

  // 기대값 독립 재유도 — isPresent·완전성·credential 합성·missing·reason 을 컴포저 재호출
  // 없이 직접 재구현해 single-source expected 를 산출한다(drift 0). 입력 env mutate 0.
  const expected = deriveExpectedGating(env);

  // 값 정합 비교(RangeError 분기) — enabled → present-coupling → credential 값 → reason 순 fail-fast.
  if (gating.enabled !== expected.enabled) {
    throw new RangeError(
      `정합 위반: gating.enabled 가 env 로부터 독립 재유도한 expected 와 다르다 — 기대=${expected.enabled}, 실측=${gating.enabled}. env 완전성 판정이 drift 했다.`,
    );
  }

  if (expected.enabled) {
    // 활성 — credential 묶음·githubPat present 여부 및 값 정합 검증(present-coupling 정방향).
    if (!gating.ollama) {
      throw new RangeError(
        "정합 위반: gating.enabled=true 인데 ollama credential 묶음이 부재하다 — 활성 gating 은 credential 을 보유해야 한다(present-coupling 위반).",
      );
    }
    if (typeof gating.githubPat !== "string") {
      throw new RangeError(
        "정합 위반: gating.enabled=true 인데 githubPat 이 부재하다 — 활성 gating 은 github read PAT 를 보유해야 한다(present-coupling 위반).",
      );
    }
    // credential 값 정합 — env trim 값과 일치해야 한다. 불일치 시 *어느 필드* 인지만 노출하고
    // 실값(기대/실측)은 메시지에 echo 하지 않는다(§9 — env 이름 상수만).
    for (const [field, envName] of OLLAMA_FIELD_ENV) {
      if (gating.ollama[field] !== expected.ollama![field]) {
        throw new RangeError(
          `정합 위반: gating.ollama.${field} 가 env(${envName}) 로부터 재유도한 값과 다르다 — credential 값 drift(실값은 비노출, §9).`,
        );
      }
    }
    if (gating.githubPat !== expected.githubPat) {
      throw new RangeError(
        `정합 위반: gating.githubPat 이 env(${REALDATA_E2E_GITHUB_READ_PAT_ENV}) 로부터 재유도한 값과 다르다 — credential 값 drift(실값은 비노출, §9).`,
      );
    }
  } else {
    // 비활성 — credential 필드는 present 하면 안 된다(역 present-coupling). present 면 위반.
    if (gating.ollama !== undefined) {
      throw new RangeError(
        "정합 위반: gating.enabled=false 인데 ollama credential 묶음이 present 하다 — 비활성 gating 은 credential 을 보유하면 안 된다(역 present-coupling 위반).",
      );
    }
    if (gating.githubPat !== undefined) {
      throw new RangeError(
        "정합 위반: gating.enabled=false 인데 githubPat 이 present 하다 — 비활성 gating 은 credential 을 보유하면 안 된다(역 present-coupling 위반).",
      );
    }
  }

  // reason 정합 — 재유도 reason 과 byte-identical(missing 나열 순서·문구 포함, 불변식 ④).
  if (gating.reason !== expected.reason) {
    throw new RangeError(
      `정합 위반: gating.reason 이 env 로부터 재유도한 expected reason 과 다르다 — missing 나열 순서(REALDATA_E2E_REQUIRED_ENV) 또는 문구가 drift 했다.`,
    );
  }

  // §9 credential 비노출 단언 — reason 에 credential 실값이 섞여 있으면 안 된다(불변식 ③).
  // 위반해도 실값을 메시지에 echo 하지 않는다(어느 credential 인지만 막연히 보고).
  const credentials = collectCredentialValues(gating);
  for (const secret of credentials) {
    if (gating.reason.includes(secret)) {
      throw new RangeError(
        "정합 위반: gating.reason 에 credential 실값이 노출됐다 — reason 은 env 이름·활성 사실만 보고해야 한다(§9, 실값 비노출).",
      );
    }
  }
}
