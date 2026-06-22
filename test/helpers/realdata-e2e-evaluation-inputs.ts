// realdata-e2e-evaluation-inputs.ts — 실 평가 e2e 수집 Activity[] →
// EvaluationInput[] 경계 순수 매퍼 (T-0578 박제).
//
// 책임:
//   - 실 평가 e2e chain 의 step ②(수집) → step ③(평가) 경계를 순수 함수로 박제한다.
//     step ②(실 수집 runner)가 산출할 typed `Activity[]`(GitHub commit/pr/issue +
//     Confluence page 정규화 단위)를 step ③(평가 scoring)의 입력 shape `EvaluationInput[]`
//     (= `EvaluationScoringService.scoreUnit` 첫 인자)로 변환한다.
//   - production 에는 이미 그 둘을 잇는 **단건** 순수 함수
//     `mapActivityToEvaluationInput(activity)`(evaluation-input.mapper.ts)가 존재한다.
//     본 helper 는 그 production 매퍼를 **재사용**해 배열 매핑만 얹는다 — step ② 산출물이
//     step ③ 입력 shape 로 흐르는 경계를 build-time 에 결정론적으로 고정한다.
//
// 🔥 매핑 로직 복제 0 (단일 진실 원천 보존):
//   - contributionKind 정규화(commit/pr→code, issue→document R-30, Confluence→document)·
//     unitId 합성(`<sourceType>:<instanceKey>:<externalId>`)·typed 필드 전사·raw 본문
//     미보유(REQ-032)는 전부 production 매퍼가 담당한다. 본 helper 는 그 위에 `map` 으로
//     배열 차원만 얹는다(추가 분기 0). 위임된 분기는 입력 다양성으로 cover.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 배열을 반환(공유 mutable 노출 0).
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 매 호출이 `map` 으로 새 배열을 반환하고 입력 `activities` 배열·원소를 변형하지 않는다.
//   - 단, production 매퍼가 `metadata` 를 reference 그대로 전달하므로(deep clone 0) 본
//     helper 도 그 승계를 그대로 둔다 — 반환 원소의 `metadata` 는 입력 Activity 의 metadata
//     와 동일 reference 다(매퍼 계약 그대로). top-level 배열/원소는 새로 생성되므로 배열
//     차원 무공유는 보장된다.
//
// 🔥 type·매퍼 재사용 (중복 정의 0):
//   - `Activity` 는 assessment-collection 도메인에서, `EvaluationInput` /
//     `mapActivityToEvaluationInput` 은 assessment-evaluation 도메인에서 import 재사용한다.
//     본 helper 는 새 type 정의·매핑 복제를 두지 않는다(SSOT).
//
// Out of Scope (task T-0578):
//   - 실 github.com 네트워크 fetch / 실 활동 수집 호출(step ② live, LAN/credential gate).
//   - EvaluationScoringService.scoreUnit 실 호출 / scoring 옵션 / LLM gateway 주입(step ③ live).
//   - Contribution(Prisma row) → EvaluationInput 경로(본 helper 는 Activity[] 경계만).
//   - 평가-side dedup / self-follow-up 제외 / abuse·notable 보정(상위 orchestrator 책임).
//   - production `src/` 코드 변경(evaluation-input.mapper.ts 등) — test helper 단독.
import type { Activity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input";
import { mapActivityToEvaluationInput } from "../../src/assessment-evaluation/domain/evaluation-input.mapper";

// buildRealDataEvaluationInputs — 수집 산출 `Activity[]` 를 평가 입력 `EvaluationInput[]`
// 로 변환하는 **순수 함수**. 각 원소를 production `mapActivityToEvaluationInput()` 로
// 변환하고 순서를 보존한다.
//
// 분기:
//   - 빈 입력 배열 → 빈 배열 반환(throw 0). `[].map(...)` 가 자연히 `[]` 산출.
//   - github(commit/pr/issue) / confluence 입력 — 분기는 전부 production 매퍼가 담당하며
//     본 helper 는 추가 분기를 두지 않는다(배열 매핑만). 위임된 분기는 입력 다양성으로 cover.
//
// 순수성:
//   - 매 호출마다 **새 배열**을 생성한다(`map`). 입력 `activities` 배열·원소를 변형하지
//     않는다. 반환 원소의 `metadata` 는 production 매퍼 계약대로 입력 Activity 의 metadata
//     reference 를 승계한다(deep clone 0) — 배열/원소 차원 무공유는 보장.
export function buildRealDataEvaluationInputs(
  activities: Activity[],
): EvaluationInput[] {
  // 매핑은 production 단건 매퍼에 위임(중복 정의 0). map 이 매 호출 새 배열을 반환하므로
  // 배열 차원에서 입력·다음 호출 결과와 무공유다.
  return activities.map((activity) => mapActivityToEvaluationInput(activity));
}
