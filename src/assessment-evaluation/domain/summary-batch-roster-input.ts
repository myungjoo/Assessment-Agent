// summary-batch-roster-input — R-61 요약 평가 batch roster→orchestrator-input 순수
// composer (PLAN.md P5 bullet 97 / REQ-061 "일/주/월 요약 평가"의 join 조각).
// p5-summary-aggregate stream 은 순수 layer(enumerate→plan→run→outcome→pipeline) +
// `@Injectable` service-경계 + summaryLine 까지 모두 닫혔다(T-0613~T-0623). 그러나 그
// stream 의 **첫 조각**인 `enumerateSummaryDueCoordinates`(T-0613)는 정의·검증만 됐고
// 어떤 caller 도 호출하지 않는 exists-but-unwired 공백이었다 —
// `SummaryBatchOrchestratorService.evaluateBatch` 가 caller 가 이미 enumerate 해 넘긴
// `coordinates` 를 입력으로 요구하므로(`SummaryBatchOrchestratorInput`),
// roster(personIds) + granularities → `coordinates` enumerate → orchestrator-input
// 조립의 join 조각이 비어 있었다. 본 composer 가 그 빈 join 을 채운다 —
// roster/granularities/resultsByCoordinate/mode/options/now 를 받아 내부에서
// `enumerateSummaryDueCoordinates` 를 호출(재구현 0)해 `SummaryBatchOrchestratorInput`
// 형태를 결정적으로 조립한다. 좌표 enumerate 가 caller-facing 으로 처음 소비된다.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// DB write 0 — `enumerateSummaryDueCoordinates` 위임 + 4 필드(resultsByCoordinate /
// mode / options / now) pass-through 만. 입력 배열·map·원소·`now` 비변형(enumerate 의
// 비변형 계약 상속, map/now 는 그대로 부착만 — 본 composer 가 변형 0). 동일 입력 →
// 동일 출력(enumerate 결정성 상속). raw 미저장(R-59 — 좌표 식별 축만, 평가 본문 미접촉).
// 새 외부 dependency 0.
//
// 책임 경계(task Out of Scope):
//   - `SummaryBatchOrchestratorService` 본문/생성자/DI 변경 금지 — 본 composer 는
//     service 가 소비할 입력을 조립할 뿐, service 배선은 별도(필요 시 follow-up).
//   - manual-trigger HTTP endpoint / controller / DTO / route / RBAC 추가 금지
//     (Q-0030 RBAC ADR-gated).
//   - 좌표 → `EvaluationResult[]` 도출(collection bridge) 금지 — caller 가
//     `resultsByCoordinate` map 을 이미 넘긴다고 전제(cross-module/RBAC ADR 영역).
//   - roster(personIds) source 도출(DB read / Person repository) 금지 — caller 가
//     in-memory string[] 로 주입.
//   - mode/options/now 결정 로직 금지 — caller 가 넘긴 값 그대로 전달.
//   - `enumerateSummaryDueCoordinates` 본문 / `summary-due-coordinates.ts` 변경 금지
//     (import 만, 값/순서 무변경).
//
// 패턴 mirror: summary-batch-pipeline.ts / summary-batch-plan.ts(순수 함수 / 입력
// 등장 순서 보존 / 입력 비변형 / null·undefined 입력 fail-fast 한국어 TypeError /
// 결정적 출력 / 한국어 JSDoc / 단일 입력 객체로 positional 인자 혼동 차단).

import type { PersistMode } from "../evaluation-result-persist.service";
import type { SummaryBatchOrchestratorInput } from "../summary-batch-orchestrator.service";
import type { SummaryPersistOptions } from "../summary-persist.service";

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import { enumerateSummaryDueCoordinates } from "./summary-due-coordinates";

// SummaryBatchRosterInput — composer 의 단일 입력 객체(positional 인자 혼동 차단,
// JSDoc single-source). 산출 타입 `SummaryBatchOrchestratorInput` 과의 핵심 차이는
// `coordinates` 자리에 그 좌표를 enumerate 할 source(`personIds` + `granularities`)가
// 온다는 점이다 — composer 가 내부에서 `enumerateSummaryDueCoordinates(personIds,
// granularities, now)` 로 좌표를 산출한다. 나머지 4 필드(resultsByCoordinate / mode /
// options / now)는 `SummaryBatchOrchestratorInput` surface 를 그대로 mirror 한다
// (새 surface 발명 0).
export interface SummaryBatchRosterInput {
  // 평가 대상 roster(in-memory string[] — Person source 도출은 본 composer 범위 밖,
  // caller 가 주입). `enumerateSummaryDueCoordinates` 의 외부 루프 축. 비변형.
  personIds: string[];
  // 평가 granularity 집합(`day`/`week`/`month`). enumerate 의 내부 루프 축. 비변형.
  granularities: PeriodGranularity[];
  // 좌표 key → 단위 평가 묶음 look-up map. composer 는 변형·재구성 0 으로 그대로 부착
  // (key 부재 좌표의 빈 배열 기본은 buildSummaryBatchPlan 책임 — 본 composer 는 map 전달만).
  resultsByCoordinate: Map<string, EvaluationResult[]>;
  // 공통 영속화 모드 — 좌표마다 동일 적용(caller 가 선택, composer 는 전달만).
  mode: PersistMode;
  // 공통 narrative 옵션(modelId) — 좌표마다 동일 적용.
  options: SummaryPersistOptions;
  // 좌표 산출 기준 현재 시각(주입 — 결정성·테스트 가능성). enumerate 에 그대로 전달.
  now: Date;
}

/**
 * R-61 요약 평가 batch 의 roster(personIds) + granularities 를 좌표로 enumerate 해
 * `SummaryBatchOrchestratorInput` 형태로 결정적으로 조립하는 순수 composer
 * (PLAN.md P5 bullet 97 / REQ-061). p5-summary-aggregate stream 의 첫 조각
 * `enumerateSummaryDueCoordinates`(T-0613)를 caller-facing 으로 처음 소비한다 —
 * `SummaryBatchOrchestratorService.evaluateBatch` 가 요구하는 `coordinates` 입력의
 * 빈 join 을 채운다.
 *
 * 조립 계약:
 *   1. `coordinates = enumerateSummaryDueCoordinates(personIds, granularities, now)`
 *      — roster × granularity 등장 순서 보존 좌표 산출(재구현 0, 위임만). personIds/
 *      granularities null/undefined·알 수 없는 granularity·Invalid Date now 의
 *      TypeError/RangeError 는 여기서 전파(fail-fast).
 *   2. 나머지 4 필드(resultsByCoordinate / mode / options / now)는 변형 0 으로 그대로
 *      부착한다(map 재구성·복제 0 — 동일 reference 부착). 산출은 caller 가
 *      `evaluateBatch` 에 그대로 넘길 수 있는 `SummaryBatchOrchestratorInput`.
 *
 * 정책:
 *   - 빈 `personIds`(또는 빈 `granularities`)면 enumerate 가 빈 `coordinates` 를
 *     반환하므로 본 composer 도 빈 coordinates 를 부착한다(throw 0).
 *   - 중복 personId roster 는 enumerate 계약 상속으로 좌표도 중복 보존(de-dup 0).
 *   - 입력 객체·배열·map·`now` 모두 비변형 — enumerate 가 personIds/granularities/now
 *     를 변형하지 않고, 본 composer 는 map/mode/options/now 를 그대로 부착만 한다.
 *   - 동일 입력 → 동일 출력(enumerate 결정성 상속). 매 호출 새 입력 객체 반환(coordinates
 *     는 enumerate 가 만든 새 배열, 나머지 4 필드는 동일 reference pass-through).
 *   - raw 미저장(R-59) — 좌표 식별 축만 산출, 평가 본문 미접촉.
 *
 * @param input roster(`personIds`) / `granularities` / `resultsByCoordinate` / `mode` /
 *   `options` / `now` 를 묶은 단일 객체(positional 인자 혼동 차단). null/undefined 시
 *   한국어 `TypeError`(직접 가드). 개별 필드 무결성(personIds/granularities/now)은
 *   `enumerateSummaryDueCoordinates` 가드에 위임(이중 검증 발명 0).
 * @returns `coordinates`(enumerate 산출 새 배열) + resultsByCoordinate/mode/options/now
 *   (그대로 부착)를 담은 `SummaryBatchOrchestratorInput`(매 호출 새 객체).
 * @throws {TypeError} `input` 이 null/undefined 일 때(직접 가드), 또는
 *   `enumerateSummaryDueCoordinates` 가 `personIds`/`granularities` null/undefined ·
 *   `now` Invalid Date 로 던진 TypeError 전파(위임).
 * @throws {RangeError} `granularities` 에 알 수 없는 period 가 포함될 때 enumerate 위임
 *   helper 의 RangeError 전파.
 */
export function buildSummaryBatchOrchestratorInput(
  input: SummaryBatchRosterInput,
): SummaryBatchOrchestratorInput {
  // input 자체의 null/undefined 만 composer 가 직접 가드한다(한국어 메시지 진단성
  // 확보). 개별 필드 무결성은 enumerate 가드에 위임한다(이중 검증 발명 0).
  if (input === null || input === undefined) {
    throw new TypeError("input 이 null/undefined 일 수 없다.");
  }

  const { personIds, granularities, resultsByCoordinate, mode, options, now } =
    input;

  // roster × granularity 좌표 enumerate — 위임만(재구현 0). personIds/granularities
  // null/undefined TypeError, 알 수 없는 granularity RangeError, Invalid Date now
  // TypeError 가 여기서 전파된다(fail-fast). enumerate 는 입력을 변형하지 않는다.
  const coordinates = enumerateSummaryDueCoordinates(
    personIds,
    granularities,
    now,
  );

  // 나머지 4 필드는 변형·복제 0 으로 그대로 부착한다(map 재구성 0 — 동일 reference).
  return { coordinates, resultsByCoordinate, mode, options, now };
}
