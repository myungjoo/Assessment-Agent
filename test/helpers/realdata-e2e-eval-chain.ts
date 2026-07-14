// realdata-e2e-eval-chain.ts — 실 평가 e2e full-chain leg 의 수집→평가 경계 배선 순수
// 함수 모듈 (T-0975 박제, PLAN.md 109행 두 leg 합류).
//
// 배경:
//   - `realdata-e2e-live.smoke-spec.ts`(T-0610)의 LLM 평가 leg 은 collection 을 synthetic
//     Activity 1 건으로 stub 했고, `realdata-e2e-github-collection-live.smoke-spec.ts`
//     (T-0806)의 github 수집 leg 은 수집 결과를 평가로 흘려보내지 않고(eval stub) 수집
//     round-trip 만 assert 했다. 즉 **실 수집 → 그 실 활동을 실 LLM 평가로 chain 하는
//     full-e2e** 는 어떤 spec 도 봉하지 않은 채였다. 본 모듈은 그 합류 지점의 **결정론적
//     경계 로직**(수집 도메인 Activity[] → orchestrator 평가 input 조립)을 순수 함수로
//     분리해 R-112 로 봉한다(항상 CI 실행 — env-gating 무관). 실 네트워크·실 LLM round-trip
//     자체는 live smoke 가 env-gated skip-by-default 로 수행한다.
//
// 책임:
//   - 실 github 수집으로 얻은 도메인 `GithubActivity[]` 를 (a) **bounded single round-trip**
//     (T-0245 선례 — 정확히 1 건으로 bound, LLM round-trip 1 회 상한)으로 좁히고 (b) 그
//     활동을 `EvaluationOrchestratorService.evaluateActivities` 입력으로 그대로 넘길 수 있는
//     결정론적 descriptor 로 조립한다. 실 네트워크/LLM/DB 호출 0(순수 함수). `process.env`
//     읽기 0 — gating 은 인자로 주입받는다(§9 — credential 은 gating 출처, 코드 기재 0).
//
// 🔥 경계 배선 drift 방어 (task Why 핵심 위험):
//   - 수집 0 건인데 평가가 빈 입력으로 조용히 통과하는 사고를 막기 위해, 유효 활동이 0 건이면
//     `active:false` + 빈 `activities` 로 수렴시켜 조용한-빈-입력-평가를 차단한다.
//   - 다수 활동이 무제한 LLM round-trip 을 유발하는 사고를 막기 위해, 유효 활동을 정확히
//     1 건으로 bound 한다(다수 → 첫 유효 1 건).
//
// 🔥 §9 / R-59 격리:
//   - descriptor 에 실 credential(apiKey/PAT) 값을 담지 않는다 — gating 은 enabled 판정에만
//     쓰고 credential 값은 descriptor 로 흘려보내지 않는다(비시크릿 username·활동 메타만).
//   - raw 활동 본문 미보관 — 도메인 Activity 의 typed 참조 필드만 그대로 통과시킨다.
//
// 🔥 외부 dependency 0 — Node 내장 타입 + 기존 helper/도메인 import 재사용만. 새 package 0,
//   production `src/` 변경 0(`GithubActivity` 타입 read-only import).
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

// 🔥 self-wire drift-guard (T-0977): T-0976 이 봉한 독립 oracle 가드를 producer 반환 직전
//   value import 해 배선한다. consistency 모듈은 이 파일로부터 `RealDataE2eEvalChainInput`
//   을 **type-only** import 만 하므로(타입 소거) value import 를 되받아도 런타임 순환
//   의존이 없다(eval-chain → consistency 만 런타임 엣지). T-0682/T-0684 self-wire mirror.
import { assertRealDataE2eEvalChainInputConsistent } from "./realdata-e2e-eval-chain-consistency";
import type { RealDataE2eLiveGating } from "./realdata-e2e-live-gating";

// RealDataE2eEvalChainInput — 수집 활동을 실 LLM 평가로 chain 하기 위해 조립된 결정론적
// descriptor. `activities` 는 그대로 `EvaluationOrchestratorService.evaluateActivities`
// 의 첫 인자로 넘긴다(bounded single). raw credential/활동 본문 미포함(§9, R-59).
export interface RealDataE2eEvalChainInput {
  // 실 LLM 평가 leg 진입 가능 여부 — gating.enabled + Ollama credential 존재 + 유효 활동
  // 정확히 1 건일 때만 true. false 면 live smoke 가 실 평가 round-trip 을 진입하지 않는다
  // (조용한-빈-입력-평가 차단 · gating 비활성 정렬).
  active: boolean;
  // orchestrator 평가 input — bounded single(0 또는 1 건). 유효 활동이 있으면 정확히 1 건,
  // 없으면 빈 배열(빈-입력 error path 로 수렴).
  activities: GithubActivity[];
  // 귀속 username(person/service-identity) — bounded 활동의 author(myungjoo/leemgs 등).
  // 유효 활동이 0 건이면 null.
  username: string | null;
}

// isAttributedGithubActivity — 활동 1 개가 person/service-identity 귀속 메타(author 비어있지
// 않은 string)를 갖췄는지 판정하는 내부 type-guard. 귀속 key 가 없는 malformed 활동은
// 평가 input 에서 제외한다(수집 author 귀속이 없으면 평가 주체가 모호하므로). 비객체/null
// entry 도 방어적으로 false.
function isAttributedGithubActivity(
  activity: unknown,
): activity is GithubActivity {
  if (activity === null || typeof activity !== "object") {
    return false;
  }
  const author = (activity as { author?: unknown }).author;
  return typeof author === "string" && author.trim().length > 0;
}

// buildRealDataE2eEvalChainInput — 실 수집 도메인 활동 배열을 실 LLM 평가 input 으로 조립하는
// 순수 함수. bounded single(정확히 1 건) + person/service-identity 귀속 보존 + gating/유효성
// 반영 active 플래그를 결정론적으로 산출한다. 실 네트워크/LLM/DB 호출 0, process.env 읽기 0.
//
// 분기:
//   - gating null/비객체 → 한국어 메시지 TypeError(방어적 guard).
//   - collectedActivities 비배열(null/undefined/비배열) → 한국어 메시지 TypeError.
//   - 유효 활동(author 귀속 present) 1+ → 첫 유효 1 건으로 bound(다수 → 1 건, T-0245).
//   - 유효 활동 0 건(빈 입력 또는 전부 malformed) → active:false + 빈 activities(빈-입력
//     error path 로 수렴, 조용한-빈-입력-평가 차단).
//   - active = gating.enabled === true AND gating.ollama 존재(평가 credential) AND bounded
//     활동 정확히 1 건. gating.enabled 인데 credential 부재인 비정상 조합 → active:false.
//
// 순수성:
//   - 입력 gating·활동 배열을 mutate 하지 않는다. 매 호출마다 새 descriptor 객체를 반환
//     (bounded 활동은 원본 참조를 그대로 담되 배열은 새로 생성 — 공유 배열 노출 0).
//
// @param gating resolveRealDataE2eLiveGating 산출(주입) — enabled/credential 판정에만 사용.
// @param collectedActivities 실 github 수집 산출 도메인 활동 배열(typed surface, raw 0).
// @returns bounded single descriptor(active/activities/username).
export function buildRealDataE2eEvalChainInput(
  gating: RealDataE2eLiveGating,
  collectedActivities: GithubActivity[],
): RealDataE2eEvalChainInput {
  if (gating === null || typeof gating !== "object") {
    throw new TypeError(
      "buildRealDataE2eEvalChainInput: gating 이 null/undefined 이거나 객체가 아닙니다.",
    );
  }
  if (!Array.isArray(collectedActivities)) {
    throw new TypeError(
      "buildRealDataE2eEvalChainInput: collectedActivities 가 배열이 아닙니다 (null/undefined/비배열).",
    );
  }

  // 유효 활동만 남긴다(귀속 메타 present) — malformed(author 누락/공백) skip. 그 뒤
  // 정확히 1 건으로 bound(다수 → 첫 유효 1 건, LLM round-trip 1 회 상한).
  const bounded = collectedActivities
    .filter(isAttributedGithubActivity)
    .slice(0, 1);

  // 평가 credential 존재 여부 — 실 LLM 평가 leg 은 Ollama credential 이 있어야 진입한다.
  // gating.enabled 인데 ollama 부재인 비정상 조합은 active:false 로 막는다(§9 — 값 미참조,
  // 존재만 판정). raw credential 값은 descriptor 로 흘려보내지 않는다.
  const hasEvalCredential =
    gating.enabled === true &&
    gating.ollama !== null &&
    typeof gating.ollama === "object";

  // active = gating 활성 + credential 존재 + bounded 활동 정확히 1 건. 셋 중 하나라도
  // 아니면 실 평가 round-trip 진입 금지(빈-입력 평가 차단 · 비활성/비정상 조합 차단).
  const active = hasEvalCredential && bounded.length === 1;

  const result: RealDataE2eEvalChainInput = {
    active,
    activities: bounded,
    username: bounded.length === 1 ? bounded[0].author : null,
  };

  // 🔥 self-wire drift-guard (T-0977): descriptor 를 반환하기 **직전** 독립 oracle 가드를
  //   스스로 호출해 조립 즉시 자가 검증한다. 정합 산출이면 tautology(항상 void)라 정상
  //   동작을 바꾸지 않고, filter/bound/active/username 규칙과 oracle 규칙이 어긋나는 순간
  //   (drift 도입) 모든 호출 경로(unit spec · live smoke 재사용)에서 즉시 throw 하는 live
  //   트립와이어가 된다 — spec 커버리지에 의존하지 않는다. throw 는 삼키지 않고 전파한다.
  assertRealDataE2eEvalChainInputConsistent(
    gating,
    collectedActivities,
    result,
  );

  return result;
}
