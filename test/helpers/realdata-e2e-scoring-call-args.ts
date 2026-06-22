// realdata-e2e-scoring-call-args.ts — 실 평가 e2e EvaluationInput[] →
// scoreUnit 호출-args 묶음 순수 빌더 (T-0579 박제).
//
// 책임:
//   - T-0578 의 `buildRealDataEvaluationInputs()` 는 수집 산출 `Activity[]` 를
//     평가 입력 `EvaluationInput[]`(= `EvaluationScoringService.scoreUnit` 의 **첫**
//     인자)로만 매핑했다. 그러나 `scoreUnit(input, options)` 는 **2 개 인자**를 받는다 —
//     `input` 외에 `options: ScoringOptions = { modelId }` 도 필요하다.
//   - 본 빌더는 그 **완전한 호출-args 묶음**(`{ input, options: { modelId } }`)을
//     build-time 결정론적으로 산출한다. step ③(실 평가 runner)가 받을 호출-args 형태를
//     미리 고정해 build-time 에 검증 가능하게 만든다(T-0577 의 collectForPerson
//     호출-args 빌더와 동형 패턴 — 호출-args shape 의 build-time 박제).
//
// 🔥 modelId source 정책 (ADR-0048 박제):
//   - modelId 의 source 는 server-side `LlmProviderConfigResolver` **단일 source** 다.
//     modelId 는 입력 단위(`EvaluationInput`)가 아니라 평가 정책 차원의 선택이므로
//     (evaluation-scoring.service.ts L37~L49), caller(상위 orchestrator)가 결정해 주입한다.
//   - 본 helper 는 그 resolver 가 돌려줄 단일 modelId 결정값(또는 build-time placeholder)
//     을 **인자로 받기만** 하고, 받은 modelId 를 모든 `EvaluationInput` 에 동형 적용한다.
//     실 resolver 호출 / DB lookup / modelId 실 결정은 Out of Scope(본 helper 안에서
//     resolver 를 호출하지 않는다 — ADR-0048 server-side 경계 보존).
//
// 🔥 단일 modelId 동형 적용 (난이도별 routing 미적용 — R-97 deferred):
//   - 본 helper 는 모든 unit 에 **동일** modelId 를 매핑한다. 난이도별 routing(input 별
//     difficulty 사전 확정 후 model 분기)은 별도 후속 slice 책임.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 배열 + 새 options 객체를 반환
//     (공유 mutable 노출 0).
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 매 호출이 `map` 으로 새 배열을 반환하고 입력 `inputs` 배열·원소·문자열 modelId 를
//     변형하지 않는다. 각 호출-args 의 `options` 는 매번 새 객체로 생성되므로
//     (`{ modelId }`), 반환 배열·원소·options 모두 입력 / 다음 호출 결과와 무공유다.
//     `input` 은 reference 그대로 페어링한다 — 본 helper 는 EvaluationInput 자체를
//     복제하지 않는다(상위 매퍼 계약 보존, 새 배열·새 options wrapper 만 추가).
//
// 🔥 type 재사용 (중복 정의 0):
//   - `EvaluationInput` 은 `domain/evaluation-input.ts` 에서, `ScoringOptions` 는
//     production `evaluation-scoring.service.ts` 에서 import 재사용한다. 본 helper 는
//     새 type 정의를 두지 않고 production 시그니처와 1:1 정합을 유지한다(SSOT).
//
// Out of Scope (task T-0579):
//   - 실 EvaluationScoringService.scoreUnit 호출 / scoring 실행 / EvaluationResult 산출
//     (step ③ live — Ollama LAN=AKIHA 192.168.0.5, cloud cron LAN 무경로, ADR-0045).
//   - 실 LlmProviderConfigResolver 호출 / DB lookup / modelId 실 결정(ADR-0048 — 본
//     helper 는 build-time 에 결정값을 인자로 받기만 함).
//   - 난이도별 routing(R-97) / LlmGateway mock 주입 / scoring service test.
//   - production `src/` 코드 변경(evaluation-scoring.service.ts 등) — test helper 단독.
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";
import type { ScoringOptions } from "../../src/assessment-evaluation/evaluation-scoring.service";

// RealDataScoringCallArgs — `scoreUnit(input, options)` 의 호출-args 묶음. 필드 모양은
// production 시그니처와 1:1 정합:
//   - input: EvaluationInput (production import 재사용, 중복 정의 0).
//   - options: ScoringOptions (production import 재사용, `{ modelId }` 단일 필드).
export interface RealDataScoringCallArgs {
  input: EvaluationInput;
  options: ScoringOptions;
}

// buildRealDataScoringCallArgs — 평가 입력 `EvaluationInput[]` 를 scoreUnit 호출-args
// 묶음 배열로 변환하는 **순수 함수**. 각 원소에 동일 modelId 를 담은 새 `options`
// 객체를 페어링해 `{ input, options: { modelId } }` 형태로 매핑한다(순서 보존).
//
// 분기(본 helper 자체의 분기는 modelId guard 1 개 외 없음 — 배열 매핑만):
//   - modelId 가 빈 문자열 / 공백만 → 명시적 throw(조용한 통과 차단, T-0575/T-0576 의
//     placeholder/identity guard 패턴 mirror). 유효 modelId 면 통과.
//   - 빈 입력 배열 → 빈 배열 반환(throw 0). `[].map(...)` 가 자연히 `[]` 산출.
//   - 단일 / 다수 원소 → 각 원소를 1:1 페어링(추가 분기 0).
//
// 순수성:
//   - 매 호출마다 **새 배열** + 매 원소마다 **새 options 객체**를 생성한다(`map`).
//     입력 `inputs` 배열·원소·문자열 modelId 를 변형하지 않는다. `input` 은 reference
//     그대로 페어링한다(EvaluationInput 복제 0 — 상위 매퍼 계약 보존). 배열·options
//     차원 무공유는 보장된다.
export function buildRealDataScoringCallArgs(
  inputs: EvaluationInput[],
  modelId: string,
): RealDataScoringCallArgs[] {
  // modelId guard — 빈/공백 modelId 는 평가 정책 미결정 상태이므로 조용히 통과시키지
  // 않고 명시적 throw 한다(placeholder/identity guard 패턴 mirror).
  if (modelId.trim() === "") {
    throw new Error(
      "buildRealDataScoringCallArgs: modelId 는 빈 문자열 / 공백만일 수 없다",
    );
  }
  // 각 원소에 동일 modelId 를 담은 새 options 객체를 페어링. map 이 매 호출 새 배열을
  // 반환하고 `{ modelId }` 가 매번 새 객체라 배열·options 차원 무공유가 보존된다.
  return inputs.map((input) => ({ input, options: { modelId } }));
}
