// UnevaluatedFillRunOrchestratorService — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분
// 일괄 평가" / REQ-038) run-side 사슬의 **첫 impure @Injectable wiring**. Q-0045 옵션1
// (impure run orchestrator + POST /unevaluated-fill-run chain)로 재개된 사슬에서 모든
// 순수 조각이 닫혔다 — 입력-side dedup(T-0551), 좌표 변환/실행/집계(T-0556..T-0560),
// person 해석 factory `buildResolvePersonFn`(T-0561), options 도출 factory
// `buildFillRunScoringOptions`(T-0562), 그리고 그 셋을 묶는 dependency-free orchestration
// core `runUnevaluatedFillRunCore`(T-0563, merge fbfd15d)까지. 본 service 는 그 core 를
// NestJS DI 와 결합하는 loop-level @Injectable wiring 으로, 실 DB 조회(PersonService)와
// 실 영속 호출(PeriodBridgeAdminPersistService)을 callable 로 바인딩해 core 에 1 회 위임만
// 한다.
//
// 책임(DI callable 바인딩 + core 1 회 위임 + 등록 — inline 재구현 0):
//   (a) `PersonService.findByIdWithIdentities` 를 person lookup adapter 로 감싸고(아래 glue
//       참조), `buildResolvePersonFn`(T-0561)에 넘겨 `resolvePerson` resolver 를 조립,
//   (b) `PeriodBridgeAdminPersistService.generateAndPersist` 를 `GenerateAndPersistFn`
//       shape 으로 바인딩해 `persist` 를 얻고,
//   (c) `runUnevaluatedFillRunCore`(T-0563)에 raw 좌표 배열·resolver·persist·modelId 를
//       넘겨 1 회 위임한다. dedup / options 도출 / 좌표 순차 순회 / 부분 실패 흡수는 전부
//       core 와 그 하위 helper(T-0558..T-0562)가 책임지므로 본 service 는 위임만 한다.
//
// 핵심 glue(load-bearing — lookup adapter 가 본 service 의 존재 이유):
//   `PersonService.findByIdWithIdentities(id)` 는 person 부재 시 `null` 을 돌려주지 않고
//   `NotFoundException` 을 throw 한다(person.service.ts L103–109 — findById 의 404 분기
//   재사용). 반면 `buildResolvePersonFn` 의 `lookup` callable 은 person 부재 시 `null` 을
//   돌려주는 shape(`(personId) => Promise<PersonWithIdentities | null>`)를 기대한다(T-0561
//   build-resolve-person-fn.ts L64–73). 따라서 `buildResolvePersonFn(this.personService.
//   findByIdWithIdentities.bind(...))` 처럼 직접 바인딩하면 contract 가 어긋난다 — null
//   기대 vs throw 불일치. 본 service 의 lookup adapter 가 이 둘을 화해시킨다: service 의
//   `NotFoundException` 만 catch 해 `null` 로 변환하고, 그러면 `buildResolvePersonFn` 의
//   resolver 가 그 null 을 좌표 단위 한국어 `Error` 로 다시 throw → T-0560 batch driver 가
//   그 좌표만 failed outcome 으로 흡수한다(REQ-037 부분 실패 — 한 좌표의 person 부재가
//   나머지 좌표를 막지 않음). `NotFoundException` 외 error(DB 연결 실패 등)는 catch 하지
//   않고 전파한다(재포장 0) — 그 error 도 좌표 단위로 batch 가 흡수한다. 이 adapter 가
//   흡수 계약의 마지막 glue 다.
//
// 경계(task Out of Scope — 후속 slice):
//   - POST /unevaluated-fill-run controller route / RBAC(self-only · Admin) / run-request
//     DTO 신설 — 후속 controller slice(2). 본 service 는 `run(...)` 메서드만 노출한다.
//   - options 무효 / rawBridges non-array 의 한국어 `TypeError` → HTTP status(400 등) 매핑
//     — 후속 controller slice. 본 service 는 core 의 throw 를 흡수하지 않고 전파만 한다.
//   - `defaultModelId` 의 출처(설정/env/상수) — 본 service 는 `run(...)` 의 인자로 받기만
//     한다. default modelId source 배선은 후속 controller 또는 config slice.
//   - e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice(3). 본 service 의 빌드/unit 은
//     mock callable 라 DB/LLM 0(live-LLM standing 게이트 ADR-0045 무관).
//   - T-0556..T-0563 순수 조각(매퍼/dedup/runner/batch/core/options/person-factory) 로직
//     수정 — 본 service 는 호출만 한다(재구현 / 변경 0).
//   - retry / batch abort / 동시성 정책 / RBAC personId 동등성 강제 — 본 service 는 위임
//     compose 만.
import { Injectable, NotFoundException } from "@nestjs/common";

import { PersonService } from "../user/person.service";

import { buildResolvePersonFn } from "./dto/build-resolve-person-fn";
import type { GenerateAndPersistFn } from "./dto/build-unevaluated-fill-coordinate-runner";
import type { PeriodBridgeDto } from "./dto/period-bridge.dto";
import { runUnevaluatedFillRunCore } from "./dto/run-unevaluated-fill-run-core";
import type { UnevaluatedFillRunResult } from "./dto/unevaluated-fill-run-result";
import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";

@Injectable()
export class UnevaluatedFillRunOrchestratorService {
  // 2 collaborator 주입 — (1) PersonService: personId → ServiceIdentity DB 조회(부재 시
  // NotFoundException, lookup adapter 가 null 로 화해). (2) PeriodBridgeAdminPersistService:
  // collect→filter→evaluate→persist 의 `generateAndPersist`(persist 로 바인딩). 둘 다
  // 같은 module 내(adminPersistService) 또는 UserModule export(personService)라 추가 module
  // import 0. test 는 이 2 자리에 mock 을 주입해 실 DB / 실 LLM / 실 네트워크 0 으로
  // 바인딩 + core 위임을 검증한다.
  constructor(
    private readonly personService: PersonService,
    private readonly adminPersistService: PeriodBridgeAdminPersistService,
  ) {}

  /**
   * raw 좌표 배열 + run-request modelId 를 받아 미평가 fill run 을 1 회 수행하고
   * batch-run 요약(`UnevaluatedFillRunResult`)을 반환하는 단일 진입 메서드(P5 bullet 106 /
   * R-64 / REQ-037·038 run-side 사슬의 loop-level @Injectable wiring, Q-0045 옵션1).
   *
   * 동작(DI callable 바인딩 + core 1 회 위임):
   *   (a) `resolvePerson` 조립 — `buildResolvePersonFn`(T-0561)에 lookup adapter 를 넘긴다.
   *       adapter 는 `PersonService.findByIdWithIdentities(personId)` 를 호출하되 그
   *       `NotFoundException` 을 catch 해 `null` 로 변환한다(person 부재를 factory 가 기대하는
   *       null-row 신호로 화해). `NotFoundException` 외 error 는 catch 하지 않고 전파.
   *   (b) `persist` 바인딩 — `this.adminPersistService.generateAndPersist` 를 service 에
   *       bind 해 `GenerateAndPersistFn` shape 으로 만든다.
   *   (c) `runUnevaluatedFillRunCore(rawBridges, resolvePerson, persist, requestModelId,
   *       defaultModelId)`(T-0563)에 위임한다 — dedup / options 도출 / 좌표 순차 순회 /
   *       좌표 단위 부분 실패 흡수는 전부 core 와 하위 helper 책임(재구현 0).
   *
   * 흡수 경계:
   *   options 무효(request·default modelId 모두 빈 값) / rawBridges non-array 의 한국어
   *   `TypeError` 는 core 가 좌표를 흘리기 전에 fail-fast 로 전파하며, 본 service 는 이를
   *   흡수하지 않는다(HTTP status 매핑은 후속 controller slice 책임). 반면 좌표 1 개 단위의
   *   person 부재 / persist reject 는 batch 가 failed outcome 으로 흡수하므로 본 service 는
   *   그 결과를 pass-through 만 한다(나머지 좌표는 정상 — REQ-037 부분 실패).
   *
   * @param rawBridges run-request 가 넘긴 raw 좌표 배열(dedup 전). non-array 시 core 의
   *   `dedupePeriodBridgeRequests` 한국어 `TypeError` 전파.
   * @param requestModelId run-request 가 넘긴 선택적 modelId(string | undefined | null).
   *   유효 non-empty 면 우선 채택, 빈 값이면 `defaultModelId` 로 fallback.
   * @param defaultModelId default modelId(string). request 가 비어있을 때 fallback 대상.
   *   request 도 비어있고 default 도 무효면 core 의 한국어 `TypeError` 전파.
   * @returns `UnevaluatedFillRunResult` — dedup 된 좌표 순서·길이 일치 outcome + status 별
   *   집계(core/batch 가 만든 새 객체).
   * @throws {TypeError} options 도출 / dedup 입력 형식 위반 시(core 가 전파, 본 service 는
   *   흡수 0). 좌표 1 개 단위 person/persist reject 는 throw 하지 않고 batch 가 흡수한다.
   */
  async run(
    rawBridges: PeriodBridgeDto[],
    requestModelId: string | undefined | null,
    defaultModelId: string,
  ): Promise<UnevaluatedFillRunResult> {
    // (a) person lookup adapter 조립 → resolver 화해. PersonService 의 NotFoundException(부재
    // 404 분기)을 null 로 변환해 buildResolvePersonFn 의 null-row 기대와 contract 를 맞춘다.
    // NotFoundException 외 error(DB 연결 실패 등)는 재포장 없이 전파(좌표 단위로 batch 가
    // 흡수). null 화해 → resolver 가 좌표 단위 한국어 Error → 그 좌표만 failed(REQ-037).
    const resolvePerson = buildResolvePersonFn(async (personId: string) => {
      try {
        return await this.personService.findByIdWithIdentities(personId);
      } catch (error) {
        if (error instanceof NotFoundException) {
          return null;
        }
        throw error;
      }
    });

    // (b) persist 바인딩 — generateAndPersist 를 service 인스턴스에 bind 해
    // GenerateAndPersistFn shape(5 인자)으로 만든다. core 가 좌표마다 호출한다.
    const persist: GenerateAndPersistFn =
      this.adminPersistService.generateAndPersist.bind(
        this.adminPersistService,
      );

    // (c) core 1 회 위임 — dedup → options 도출 → 좌표 순차 순회 + 집계는 전부 core 책임.
    // core 의 fail-fast TypeError(options 무효 / rawBridges non-array)는 흡수하지 않고 전파.
    return runUnevaluatedFillRunCore(
      rawBridges,
      resolvePerson,
      persist,
      requestModelId,
      defaultModelId,
    );
  }
}
