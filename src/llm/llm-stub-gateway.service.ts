// LlmStubGateway — 부하 harness 전용 stub LLM gateway 구현체 (T-1628,
// [ADR-0057](../../docs/decisions/ADR-0057-s1-batch-load-io-isolation.md)
// `## Decision` D1). D1 이 남긴 3 조각(env 판정 helper / stub gateway class /
// module binding) 중 **가운데 조각인 구현 class 만** 박제한다.
//
// 왜 필요한가:
//   - S1 배치 부하 job 은 LLM API key 가 없는 credential 0 환경이라(ADR-0057
//     `## Context` 사실 2) 실 gateway(LlmHttpGateway)로는 배치가 아예 발화하지
//     못한다. `LlmGateway` 계약을 만족하면서 외부 왕복이 0 인 구현체가 있어야
//     D2 진입점(`POST /api/assessment-evaluation/unevaluated-fill-run`) 타격이
//     성립한다.
//
// 책임 경계:
//   - 본 class 는 **어떤 module 의 `providers` 에도 등록되지 않는다** — 호출처 0
//     이라 실행 경로 변화 0 이다. `LLM_GATEWAY` token 의 binding 분기와
//     [isLoadTestStubEnabled](../common/load-test-stub-gating.ts) 호출은 **후속
//     slice** 책임이며, 본 파일은 그 helper 를 import 조차 하지 않는다(판정은
//     binding 지점의 책임 — 본 class 는 "이미 켜기로 결정된 뒤" 쓰이는 부품).
//   - 실 구현체(LlmHttpGateway)의 class 형태·`generate` 시그니처만 mirror 하고
//     routing / config 조회 / apiKey decrypt / provider adapter dispatch 같은
//     로직은 **일절 승계하지 않는다**.
//   - 인위적 지연(latency 시뮬레이션) · 토큰 usage 메타 · provider 별 응답 형태
//     흉내는 ADR-0057 이 요구하지 않으므로 두지 않는다.
//
// 결정성 계약: 생성자 의존 0(repository · cipher · fetch · env 접근 전부 없음),
// 외부 HTTP 호출 0, timer / random / Date 접근 0 이라 **동일 입력 → 동일 출력**
// 이 보장된다. 부하 측정의 기준선이 호출마다 흔들리면 D3 의 `http_req_duration
// {route:batch}` 판정이 오염되기 때문이다.
import { BadRequestException, Injectable } from "@nestjs/common";

import {
  LlmGateway,
  LlmGenerateOptions,
  LlmGenerateResult,
  LlmProvider,
} from "./llm-gateway.interface";

// stub 산출임을 응답 본문만 보고도 식별할 수 있게 하는 고정 prefix. 부하 run 의
// 결과물이 실 LLM 산출로 오인되는 사고(ADR-0057 `## Consequences` 부정 3 의
// 오활성 risk 와 같은 계열)를 차단하는 최소 장치다 — 값 자체를 spec 이 assert
// 해 drift 를 막는다.
export const LLM_STUB_NARRATIVE_PREFIX = "[load-test-stub]";

// 문자열이 "실질 내용이 있는가" 판정 — 빈 문자열 / 공백-only 를 모두 잡는다.
// 조용한 기본값 생성(예: 빈 modelId 를 임의 값으로 대체) 대신 거절하기 위한
// 게이트이며, 판정을 한 곳에 모아 prompt · modelId 두 검증이 갈라지지 않게 한다.
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

@Injectable()
export class LlmStubGateway implements LlmGateway {
  // 생성자를 명시하지 않는다 — 의존 0 이 본 class 의 계약이다. 의존이 생기는
  // 순간 "외부 왕복 0 / 결정적" 보장이 깨지므로 추가는 ADR 개정 대상.

  // generate — 프롬프트를 받아 고정 규칙으로 조립한 stub 평가문을 즉시 resolve
  // 한다. 실 gateway 와 달리 config 조회도 네트워크 왕복도 없다.
  //
  // 계약:
  //   - `provider` 는 항상 `LlmProvider.Custom` — stub 은 특정 상용 provider 를
  //     사칭하지 않는다.
  //   - `modelId` 는 `options.modelId` 를 그대로 echo — 부하 스크립트가 넘긴 값이
  //     응답에 보존돼야 호출-응답 대응을 추적할 수 있다.
  //   - `narrative` 는 `LLM_STUB_NARRATIVE_PREFIX` 로 시작한다.
  //
  // 분기는 정확히 2 개다 — (a) `options.difficulty` 가 주어지면 narrative 에 그
  // 난이도 표기를 포함하고, (b) 미제공(undefined)이면 포함하지 않는다. 실
  // gateway 의 difficulty routing(T-0165)을 흉내 내지는 않으며, 난이도가 응답에
  // 반영됐는지를 부하 스크립트가 눈으로 확인할 수 있게 하는 표기일 뿐이다.
  //
  // 잘못된 입력(빈/공백-only `prompt`, 빈/공백-only `options.modelId`)은
  // `BadRequestException` 으로 reject 한다 — 실 gateway 로 fall-through 하거나
  // 조용히 기본값을 만들어내지 않는다(fail-safe: stub 이 입력 결함을 덮으면 부하
  // 결과가 거짓 green 이 된다).
  async generate(
    prompt: string,
    options: LlmGenerateOptions,
  ): Promise<LlmGenerateResult> {
    if (typeof prompt !== "string" || isBlank(prompt)) {
      throw new BadRequestException(
        "stub gateway: prompt 는 비어 있을 수 없습니다",
      );
    }
    if (typeof options?.modelId !== "string" || isBlank(options.modelId)) {
      throw new BadRequestException(
        "stub gateway: options.modelId 는 비어 있을 수 없습니다",
      );
    }

    // difficulty 분기 — 제공 시에만 난이도 표기를 덧붙인다. 빈 문자열도 "제공"
    // 으로 취급해 그대로 표기한다(실 gateway 는 resolveModel 에 위임해 4xx 를
    // 내지만, stub 은 난이도 유효성 판정 책임이 없다 — 판정을 흉내 내면 실
    // 경로와 다른 error 표면이 생겨 부하 결과가 오염된다).
    const difficultyMark =
      options.difficulty === undefined
        ? ""
        : ` difficulty=${options.difficulty}`;

    return {
      narrative: `${LLM_STUB_NARRATIVE_PREFIX}${difficultyMark} ${prompt}`,
      provider: LlmProvider.Custom,
      modelId: options.modelId,
    };
  }
}
