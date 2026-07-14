// realdata-e2e-eval-chain-collect-request.ts — 실 평가 e2e full-chain live smoke 의 github
// 수집 round-trip 요청 조립 순수 함수 모듈 (T-0980 박제, PLAN.md 109행 test-hardening).
//
// 배경:
//   - `realdata-e2e-eval-chain-live.smoke-spec.ts`(T-0975)의 full-chain it 본문에는 아직
//     추출되지 않은 결정론적 조립 로직이 하나 남아있었다 — 수집 plan entry(host/path)와
//     gating PAT 를 `GithubRequestInput` 으로 조립하며 `query: { per_page: "1" }` 로
//     bounded single round-trip(T-0245 선례)을 강제하는 부분(inline). 이 조립은 env-gated
//     skip-by-default 라 public CI 에서 **한 번도 실행되지 않아** per_page bound 나 host/path
//     귀속이 깨져도 탐지되지 않았다. 직전 T-0975~T-0979 가 eval-chain 의 다른 조립 leg
//     (입력 descriptor·activity-map·consistency guard)을 전부 순수 helper + R-112 spec 으로
//     봉한 것과 동형으로, 본 마지막 inline leg 을 순수 helper 로 추출해 CI 매 실행 검증화한다.
//
// 책임:
//   - 수집 plan entry(host/path)와 인증 token 으로부터, 실 github REST 호출에 넘길
//     `GithubRequestInput` 을 **결정론적**으로 조립한다. `query.per_page === "1"` 로 bounded
//     single round-trip(정확히 1 건, 무제한 아님 — T-0245 LLM/네트워크 round-trip 1 회 상한)을
//     강제한다. 실 fetch 는 하지 않는다(요청 조립만) — 실 네트워크 호출은 실행 smoke 가
//     gating enabled 분기에서만 수행한다.
//   - process.env 읽기 0 / 실 네트워크 0 (순수 함수). token 은 인자로만 받아 반환 객체로만
//     흘려보낸다.
//
// 🔥 §9 / R-59 격리:
//   - token(github PAT)은 인자로만 받아 반환 `GithubRequestInput.token` 필드로만 통과시킨다.
//     로그 / 직렬화 / **에러 메시지**에 절대 노출하지 않는다(ADR-0016 §3, CLAUDE.md §9).
//     token guard 실패 시에도 throw 메시지에 token 값을 담지 않는다(존재/형태만 언급).
//   - raw 활동 데이터 미보관 — entry 의 결정론 요청 구조(host/path)만 참조한다.
//
// 🔥 외부 dependency 0 — Node 내장 타입 + 기존 helper/도메인 import 재사용만. 새 package 0,
//   production `src/` 변경 0(`GithubRequestInput` 타입 · `RealDataE2eGithubCollectionPlanEntry`
//   타입 read-only import).
//
// 🔥 self-wire drift-guard (T-0983): T-0981 이 봉한 독립 oracle 가드
//   `assertRealDataE2eEvalChainCollectRequestConsistent`(`-collect-request-consistency.ts`)를
//   producer 반환 직전 스스로 호출해 매 조립을 즉시 자가 검증한다. consistency 모듈은
//   `GithubRequestInput`·`RealDataE2eGithubCollectionPlanEntry` 타입만 참조하고 본 producer 를
//   value import 하지 않으므로 런타임 순환 의존이 없다(collect-request → consistency 만
//   런타임 엣지). T-0977/T-0982 self-wire mirror.
import type { GithubRequestInput } from "../../src/github/github-request.builder";

import { assertRealDataE2eEvalChainCollectRequestConsistent } from "./realdata-e2e-eval-chain-collect-request-consistency";
import type { RealDataE2eGithubCollectionPlanEntry } from "./realdata-e2e-github-collection-live";

// bounded single round-trip 강제 상수 — per_page=1(정확히 1 건, 무제한 아님). T-0245 선례
// (LLM/네트워크 round-trip 1 회 상한). 호출처가 query 를 덮어써 무제한으로 확장하지 못하도록
// helper 가 단일 원천으로 박제한다.
const BOUNDED_SINGLE_PER_PAGE = "1";

// 비어있지 않은 string 인지 검증하는 내부 guard — invalid 입력에서 의미 불명한 요청 조립
// 대신 명확한 Error throw 를 위해 사용. number / null / undefined / whitespace-only 모두 거부.
// 🔥 §9: field 이름만 메시지에 담고 실 값(특히 token)은 절대 담지 않는다.
function assertNonEmptyField(
  value: unknown,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(
      `buildRealDataE2eEvalChainCollectRequest: ${field} 가 비어있거나 string 이 아닙니다.`,
    );
  }
}

// buildRealDataE2eEvalChainCollectRequest — 수집 plan entry + 인증 token 으로부터 실 github
// 수집 round-trip 요청(`GithubRequestInput`)을 조립하는 순수 함수. entry 의 host/path 를
// 귀속하고 query.per_page 를 "1"(bounded single)로 고정한다. 실 네트워크/DB 호출 0,
// process.env 읽기 0.
//
// 분기(각 guard):
//   - entry 가 null/undefined/비객체 → 한국어 메시지 TypeError(방어적 guard).
//   - entry.host 누락/공백 → 한국어 메시지 Error(요청 대상 host 가 없으면 조립 불가).
//   - entry.path 누락/공백 → 한국어 메시지 Error(요청 대상 path 가 없으면 조립 불가).
//   - token 이 빈 문자열/공백/비-string → 한국어 메시지 Error(인증 없는 요청 조립 차단).
//     🔥 메시지에 token 값 미노출(§9).
//
// bounded single:
//   - query.per_page 는 항상 "1" 로 고정한다 — entry/token 어디에도 per_page override 통로가
//     없으므로 호출처가 무제한으로 확장할 수 없다(T-0245 round-trip 1 회 상한).
//
// 순수성:
//   - 입력 entry 를 mutate 하지 않는다. 매 호출마다 새 `GithubRequestInput` 객체(및 새 query
//     객체)를 반환한다(공유 mutable 노출 0). 반환값을 호출 측이 mutate 해도 입력·다음 호출에
//     영향 0.
//
// @param entry 수집 plan entry(host/path 귀속) — buildRealDataGithubCollectionPlan 산출 1 건.
// @param token 평문 github PAT(gating 출처, 인자 주입) — 반환 객체로만 통과, 로그/메시지 노출 0.
// @returns bounded single(per_page="1") `GithubRequestInput`(host/token/path/query).
export function buildRealDataE2eEvalChainCollectRequest(
  entry: RealDataE2eGithubCollectionPlanEntry,
  token: string,
): GithubRequestInput {
  if (entry === null || typeof entry !== "object") {
    throw new TypeError(
      "buildRealDataE2eEvalChainCollectRequest: entry 가 null/undefined 이거나 객체가 아닙니다.",
    );
  }

  assertNonEmptyField(entry.host, "entry.host");
  assertNonEmptyField(entry.path, "entry.path");
  // 🔥 §9: token guard 실패 메시지에도 token 값은 담지 않는다(field 이름만).
  assertNonEmptyField(token, "token");

  // bounded single 요청 조립 — host/path 귀속 + per_page="1" 고정. query 는 매 호출 새 객체.
  const result: GithubRequestInput = {
    host: entry.host,
    token,
    path: entry.path,
    query: { per_page: BOUNDED_SINGLE_PER_PAGE },
  };

  // 🔥 self-wire drift-guard (T-0983): 조립 결과를 반환하기 **직전** 독립 oracle 가드를
  //   스스로 호출해 매 조립을 즉시 자가 검증한다. 정합 산출이면 tautology(항상 void)라 정상
  //   동작을 바꾸지 않고, host/path 귀속 · per_page="1" bounded single · token 필드-only 통과
  //   규칙과 oracle 규칙이 어긋나는 순간(drift 도입) 모든 호출 경로(unit spec · live smoke
  //   재사용)에서 즉시 throw 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.
  //   throw 는 삼키지 않고 전파한다(복구는 호출처 책임).
  assertRealDataE2eEvalChainCollectRequestConsistent(entry, token, result);

  return result;
}
