// EvaluationPersistedRecordsReader — 미평가 fill 입력용 영속 레코드 read-adapter
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가"의 detection 사슬의
// 첫 impure slice). 순수-도메인 4 조각(enumerate / project / select / batch-plan)과
// compose helper `composeUnevaluatedFillPlan`(T-0540)이 닫은 `persisted` 입력 형태
// (`PersistedAssessmentRecord[]`)를, 실제 DB 에서 길어 오는 얇은 read-adapter 다.
//
// 책임(REQ-037 detection 사슬의 첫 impure 입력 배선 — REQ-038 query 표면 재사용):
//   여러 person 의 영속 Assessment 레코드를 기존 `AssessmentService.findByPerson`
//   (REQ-038 시계열 조회, ADR-0033 query 표면)으로 person 별 호출해, 그 결과를 **person
//   입력 순서를 보존**한 단일 `PersistedAssessmentRecord[]` 로 평탄화(flatten)한다.
//   `Assessment` row 는 `PersistedAssessmentRecord`(좌표 4-field + index signature)와
//   구조적 호환이라 매핑/가공 0 으로 그대로 element 로 사용한다(추가 컬럼은 index
//   signature 가 흡수). 이 출력이 `composeUnevaluatedFillPlan` 의 `persisted` 입력으로
//   흘러간다.
//
// 경계(task Out of Scope):
//   - 새 repository 메서드 / 새 query 표면 / 새 ADR / schema 변경 0 — 이미 존재하는
//     `findByPerson` 를 person 별로 호출해 한 배열로 모으는 어댑터일 뿐이다.
//   - `intended` 좌표 range/person 결정(스케줄러·요청 DTO 등)은 본 task 밖 — 후속 slice.
//   - orchestrator/controller 실배선(`composeUnevaluatedFillPlan` 호출 → 실 평가 실행)은
//     본 task 밖. module provider 등록도 후속 wiring slice(실 소비처가 생길 때 함께).
//   - `AssessmentService.findByPerson` 의 기존 동작 변경 0 — 읽기만, 시그니처·정렬·분기
//     불변.
//
// 패턴 mirror: evaluation-result-persist.service.ts 의 constructor DI 패턴(@Injectable +
// constructor private readonly 주입) + 도메인 helper 들의 fail-fast 방어(명시적
// null/undefined·타입 한국어 메시지 `TypeError`). 본 adapter 는 입력 검증 후 person 별로
// findByPerson 를 순차 await 하고 결과를 입력 순서대로 push 평탄화한다.
import { Injectable } from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import { AssessmentService } from "../user/assessment.service";

import type { PersistedAssessmentRecord } from "./domain/evaluation-persisted-period-coordinates";

// EvaluationPersistedRecordsReadOptions — read-adapter 의 선택 옵션. `period` 가 주어지면
// 각 person 의 findByPerson 호출에 그대로 forward 된다(REQ-038 시계열 period 필터 재사용).
// undefined 면 전체 period 조회(findByPerson 의 미지정 분기). 새 query 표면 발명 0 —
// 기존 AssessmentFindByPersonOptions 와 동일 의미의 얇은 wrapper.
export interface EvaluationPersistedRecordsReadOptions {
  // `"day"` / `"week"` / `"month"` 중 하나. undefined 면 전체 period 조회. 값 검증은
  // 본 adapter 가 하지 않고 findByPerson(AssessmentService) 가 forward 받아 검증한다
  // (단일 검증 출처 — 본 adapter 는 forward 만, 중복 검증 0).
  period?: string;
}

@Injectable()
export class EvaluationPersistedRecordsReader {
  constructor(private readonly assessmentService: AssessmentService) {}

  // readForPersons — 여러 personId 의 영속 Assessment 레코드를 person 입력 순서대로
  // 평탄화해 반환한다(REQ-037 detection 사슬의 첫 impure 입력 배선).
  //
  // 흐름:
  //   (1) personIds 입력 1 차 fail-fast 방어(null/undefined·non-array·원소 non-string
  //       → 한국어 메시지 `TypeError`). 도메인 helper 들의 방어 패턴 mirror — silent skip
  //       시 영속 좌표 누락으로 일괄 평가 누락을 유발하므로 fail-fast 가 안전(R-112
  //       negative). 입력 검증을 먼저 모두 수행해 findByPerson 호출 0 으로 조기 차단한다.
  //   (2) 빈 personIds → findByPerson 호출 0 으로 빈 배열 `[]` 반환(루프 진입 0).
  //   (3) person 입력 순서대로 순차 await — 각 person 의 findByPerson 결과(매칭 0 시 빈
  //       배열 자연 흡수)를 누적 배열에 입력 순서 보존하며 push 평탄화한다. options.period
  //       는 그대로 forward(지정 시 시계열 period 필터, 미지정 시 전체 — findByPerson 분기).
  //   (4) findByPerson 이 reject(의존성 실패)하면 그 rejection 을 그대로 전파한다(재던지지
  //       않음 — single-source, AssessmentService 의 예외 변환 정책을 그대로 노출).
  //
  // 비변형: 전달받은 personIds 배열을 mutate 하지 않는다(읽기만). 반환 배열은 새로 생성한
  // 누적 배열이며, element 는 findByPerson 이 반환한 Assessment row 를 그대로 사용한다
  // (구조적 호환 — PersistedAssessmentRecord 좌표 4-field + index signature 가 흡수,
  // 매핑/복사 0). element 자체도 mutate 하지 않는다.
  //
  // @param personIds 영속 레코드를 읽을 person id 목록. 변형하지 않는다.
  // @param options 선택 옵션 — period 지정 시 각 findByPerson 호출에 forward.
  // @returns person 입력 순서를 보존한 단일 `PersistedAssessmentRecord[]`(매칭 0 인 person
  //   은 기여분 0). 빈 personIds → 빈 배열.
  // @throws {TypeError} personIds 가 null/undefined·non-array 이거나, 원소가 non-string
  //   일 때(도메인 helper fail-fast 방어 mirror). findByPerson 의 rejection(의존성 실패·
  //   잘못된 period literal 등)은 그대로 전파된다.
  async readForPersons(
    personIds: string[],
    options?: EvaluationPersistedRecordsReadOptions,
  ): Promise<PersistedAssessmentRecord[]> {
    if (personIds === null || personIds === undefined) {
      throw new TypeError("personIds 배열이 null/undefined 일 수 없다.");
    }
    if (!Array.isArray(personIds)) {
      throw new TypeError(`personIds 는 배열이어야 한다: ${String(personIds)}`);
    }
    for (const personId of personIds) {
      if (typeof personId !== "string") {
        throw new TypeError(
          `personIds 원소는 string 이어야 한다: ${String(personId)}`,
        );
      }
    }

    // 누적 배열 — person 입력 순서를 보존하며 평탄화한다. 빈 personIds 면 루프 진입 0 →
    // 빈 배열 반환(findByPerson 호출 0).
    const flattened: Assessment[] = [];
    for (const personId of personIds) {
      // options.period 는 그대로 forward(undefined 면 findByPerson 의 전체 period 분기).
      // findByPerson reject 시 await 가 그대로 throw → 호출자에 자연 전파(재던지지 않음).
      const records = await this.assessmentService.findByPerson(
        personId,
        options,
      );
      // 매칭 0 인 person 은 빈 배열 → push 0 으로 자연 흡수(기여분 0).
      for (const record of records) {
        flattened.push(record);
      }
    }

    // Assessment row 는 PersistedAssessmentRecord 와 구조적 호환(좌표 4-field + index
    // signature)이라 매핑 0 으로 그대로 반환한다.
    return flattened;
  }
}
