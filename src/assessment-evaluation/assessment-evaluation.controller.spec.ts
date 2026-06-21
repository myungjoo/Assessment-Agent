// AssessmentEvaluationController spec — T-0293 acceptance 박제 (R-112 4 종 +
// negative cases 충분 cover + RBAC metadata 단언 + DTO ValidationPipe 단위 검증).
// AssessmentCollectionController.spec(T-0274) + UserInstanceAccessController.spec
// (T-0238) 패턴 mirror. EvaluationOrchestratorService 는 jest mock 으로 주입 — 실
// LLM 호출 0 / 실 네트워크 0 / live credential 0.
//
// 본 spec 의 4 부분:
//   1. Unit-level (controller-only with mocked orchestrator) — happy / 위임 정합 /
//      error 전파 / determinism / 입력 비변형 + github/confluence/혼합 branch.
//   2. DTO ValidationPipe 단위 검증 — modelId 누락 / activities 누락·비배열 / 빈 배열 /
//      nested 필수 필드 누락 / 정의 외 추가 필드 / wrong type 6 종.
//   3. RBAC metadata 단언 — Reflector 로 @Roles("Admin") + @UseGuards(JwtAuthGuard,
//      RolesGuard) 부착 검증.
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { JwtPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { LlmProviderConfigResolver } from "../llm/llm-provider-config-resolver.service";
import type { PersonWithIdentities } from "../user/person.repository";
import type { PersonService } from "../user/person.service";

import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
import type { IntendedPeriodCoordinatesInput } from "./domain/evaluation-intended-period-coordinates";
import type { EvaluationResult } from "./domain/evaluation-result";
import type { UnevaluatedFillBatchPlan } from "./domain/evaluation-unevaluated-fill-batch-plan";
import {
  EvaluateActivitiesDto,
  ActivityItemDto,
} from "./dto/evaluate-activities.dto";
import { PeriodBridgeDto } from "./dto/period-bridge.dto";
import { UnevaluatedFillPlanRequestDto } from "./dto/unevaluated-fill-plan-request.dto";
import { UnevaluatedFillRunRequestDto } from "./dto/unevaluated-fill-run-request.dto";
import type { UnevaluatedFillRunResult } from "./dto/unevaluated-fill-run-result";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationResultPersistService,
  type PersistResult,
} from "./evaluation-result-persist.service";
import type { EvaluationUnevaluatedFillPlanner } from "./evaluation-unevaluated-fill-planner.service";
import type {
  PeriodBridgeAdminPersistResult,
  PeriodBridgeAdminPersistService,
} from "./period-bridge-admin-persist.service";
import type { PeriodBridgeEphemeralService } from "./period-bridge-ephemeral.service";
import type { UnevaluatedFillRunOrchestratorService } from "./unevaluated-fill-run-orchestrator.service";

// context 4-tuple(ADR-0033 §51) — 모든 evaluate dto fixture 의 base. persist 호출
// 인자 검증의 기준.
const baseContext = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-06-01T00:00:00.000Z",
};

// 기본 persist mock 반환 — 박제된 식별자.
const defaultPersistResult: PersistResult = {
  assessmentId: "assessment-1",
  contributionCount: 2,
};

// makeController — orchestrator + persist mock 주입 헬퍼. 두 jest.fn 을 함께 반환해
// 호출 인자 / 횟수 / 반환 forward 검증을 enable. persistImpl 미지정 시 defaultPersist
// Result 를 resolve.
function makeController(
  evaluateImpl: (...args: unknown[]) => Promise<EvaluationResult[]>,
  persistImpl?: (...args: unknown[]) => Promise<PersistResult>,
): {
  controller: AssessmentEvaluationController;
  evaluateSpy: jest.Mock;
  persistSpy: jest.Mock;
} {
  const evaluateSpy = jest.fn(evaluateImpl);
  const persistSpy = jest.fn(persistImpl ?? (async () => defaultPersistResult));
  const orchestrator = {
    evaluateActivities: evaluateSpy,
  } as unknown as EvaluationOrchestratorService;
  const persistService = {
    persist: persistSpy,
  } as unknown as EvaluationResultPersistService;
  // POST /period 의 두 collaborator(ephemeralBridge / personService)는 본 evaluate
  // 경로 test 에서 미사용이라 throw mock 으로 주입 — 만약 evaluate() 가 실수로 호출하면
  // 즉시 실패해 격리 위반을 catch 한다.
  const ephemeralBridge = {
    generateEphemeral: jest.fn(() => {
      throw new Error("evaluate() 는 ephemeralBridge 를 호출하면 안 된다");
    }),
  } as unknown as PeriodBridgeEphemeralService;
  const adminBridge = {
    generateAndPersist: jest.fn(() => {
      throw new Error("evaluate() 는 adminBridge 를 호출하면 안 된다");
    }),
  } as unknown as PeriodBridgeAdminPersistService;
  const personService = {
    findByIdWithIdentities: jest.fn(() => {
      throw new Error("evaluate() 는 personService 를 호출하면 안 된다");
    }),
  } as unknown as PersonService;
  // unevaluatedFillPlanner — evaluate() 경로 test 에서 미사용이라 throw mock 으로 주입.
  // evaluate() 가 실수로 호출하면 즉시 실패해 격리 위반을 catch 한다.
  const unevaluatedFillPlanner = {
    planUnevaluatedFill: jest.fn(() => {
      throw new Error(
        "evaluate() 는 unevaluatedFillPlanner 를 호출하면 안 된다",
      );
    }),
  } as unknown as EvaluationUnevaluatedFillPlanner;
  // unevaluatedFillRunOrchestrator — evaluate() 경로 test 에서 미사용이라 throw mock.
  const unevaluatedFillRunOrchestrator = {
    run: jest.fn(() => {
      throw new Error(
        "evaluate() 는 unevaluatedFillRunOrchestrator 를 호출하면 안 된다",
      );
    }),
  } as unknown as UnevaluatedFillRunOrchestratorService;
  // llmProviderConfigResolver — evaluate() 경로 test 에서 미사용이라 throw mock.
  const llmProviderConfigResolver = {
    resolveDefaultModelId: jest.fn(() => {
      throw new Error(
        "evaluate() 는 llmProviderConfigResolver 를 호출하면 안 된다",
      );
    }),
  } as unknown as LlmProviderConfigResolver;
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      adminBridge,
      personService,
      unevaluatedFillPlanner,
      unevaluatedFillRunOrchestrator,
      llmProviderConfigResolver,
    ),
    evaluateSpy,
    persistSpy,
  };
}

// makePeriodController — POST /period 전용 controller 빌더. ephemeralBridge /
// adminBridge / personService 를 jest mock 으로 주입하고(실 LLM/DB/네트워크 0),
// evaluate 경로의 orchestrator/persist 는 throw mock 으로 두어 period() 가 실수로
// 호출하면 catch 한다. generateSpy(ephemeral 위임) / adminSpy(Admin 위임) /
// findPersonSpy(person resolve)를 함께 반환해 위임 인자/횟수 검증을 enable 한다.
function makePeriodController(opts: {
  generateImpl?: (...args: unknown[]) => Promise<EvaluationResult[]>;
  adminImpl?: (...args: unknown[]) => Promise<PeriodBridgeAdminPersistResult>;
  findPersonImpl?: (...args: unknown[]) => Promise<PersonWithIdentities>;
}): {
  controller: AssessmentEvaluationController;
  generateSpy: jest.Mock;
  adminSpy: jest.Mock;
  findPersonSpy: jest.Mock;
} {
  const generateSpy = jest.fn(
    opts.generateImpl ?? (async () => [] as EvaluationResult[]),
  );
  const adminSpy = jest.fn(
    opts.adminImpl ?? (async () => makeAdminPersistResult()),
  );
  const findPersonSpy = jest.fn(
    opts.findPersonImpl ??
      (async () =>
        ({
          id: "person-1",
          serviceIdentities: [{ service: "github", externalId: "octocat" }],
        }) as unknown as PersonWithIdentities),
  );
  const ephemeralBridge = {
    generateEphemeral: generateSpy,
  } as unknown as PeriodBridgeEphemeralService;
  const adminBridge = {
    generateAndPersist: adminSpy,
  } as unknown as PeriodBridgeAdminPersistService;
  const personService = {
    findByIdWithIdentities: findPersonSpy,
  } as unknown as PersonService;
  // evaluate 경로 collaborator 는 period() test 에서 호출되면 안 되므로 throw mock.
  const orchestrator = {
    evaluateActivities: jest.fn(() => {
      throw new Error("period() 는 orchestrator 를 호출하면 안 된다");
    }),
  } as unknown as EvaluationOrchestratorService;
  const persistService = {
    persist: jest.fn(() => {
      throw new Error("period() 는 persist 를 호출하면 안 된다");
    }),
  } as unknown as EvaluationResultPersistService;
  // unevaluatedFillPlanner — period() 경로 test 에서 미사용이라 throw mock.
  const unevaluatedFillPlanner = {
    planUnevaluatedFill: jest.fn(() => {
      throw new Error("period() 는 unevaluatedFillPlanner 를 호출하면 안 된다");
    }),
  } as unknown as EvaluationUnevaluatedFillPlanner;
  // unevaluatedFillRunOrchestrator — period() 경로 test 에서 미사용이라 throw mock.
  const unevaluatedFillRunOrchestrator = {
    run: jest.fn(() => {
      throw new Error(
        "period() 는 unevaluatedFillRunOrchestrator 를 호출하면 안 된다",
      );
    }),
  } as unknown as UnevaluatedFillRunOrchestratorService;
  // llmProviderConfigResolver — period() 경로 test 에서 미사용이라 throw mock.
  const llmProviderConfigResolver = {
    resolveDefaultModelId: jest.fn(() => {
      throw new Error(
        "period() 는 llmProviderConfigResolver 를 호출하면 안 된다",
      );
    }),
  } as unknown as LlmProviderConfigResolver;
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      adminBridge,
      personService,
      unevaluatedFillPlanner,
      unevaluatedFillRunOrchestrator,
      llmProviderConfigResolver,
    ),
    generateSpy,
    adminSpy,
    findPersonSpy,
  };
}

// makeFillController — POST /unevaluated-fill-plan 전용 controller 빌더. planner 를
// jest mock 으로 주입하고(실 DB read 0 / 실 네트워크 0), 다른 경로의 collaborator
// (orchestrator / persist / ephemeral / admin / person)는 throw mock 으로 두어
// planUnevaluatedFill() 가 실수로 호출하면 catch 한다. plannerSpy 로 위임 인자 / 횟수 /
// 반환 forward 검증을 enable 한다.
function makeFillController(
  plannerImpl: (...args: unknown[]) => Promise<UnevaluatedFillBatchPlan>,
): {
  controller: AssessmentEvaluationController;
  plannerSpy: jest.Mock;
} {
  const plannerSpy = jest.fn(plannerImpl);
  const unevaluatedFillPlanner = {
    planUnevaluatedFill: plannerSpy,
  } as unknown as EvaluationUnevaluatedFillPlanner;
  // 다른 route 의 collaborator 는 fill 경로 test 에서 호출되면 안 되므로 throw mock.
  const orchestrator = {
    evaluateActivities: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 orchestrator 를 호출하면 안 된다",
      );
    }),
  } as unknown as EvaluationOrchestratorService;
  const persistService = {
    persist: jest.fn(() => {
      throw new Error("planUnevaluatedFill() 는 persist 를 호출하면 안 된다");
    }),
  } as unknown as EvaluationResultPersistService;
  const ephemeralBridge = {
    generateEphemeral: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 ephemeralBridge 를 호출하면 안 된다",
      );
    }),
  } as unknown as PeriodBridgeEphemeralService;
  const adminBridge = {
    generateAndPersist: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 adminBridge 를 호출하면 안 된다",
      );
    }),
  } as unknown as PeriodBridgeAdminPersistService;
  const personService = {
    findByIdWithIdentities: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 personService 를 호출하면 안 된다",
      );
    }),
  } as unknown as PersonService;
  // unevaluatedFillRunOrchestrator — planUnevaluatedFill() 경로 test 에서 미사용이라
  // throw mock(run-side 사슬이 실수로 호출되면 즉시 실패해 격리 위반을 catch).
  const unevaluatedFillRunOrchestrator = {
    run: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 unevaluatedFillRunOrchestrator 를 호출하면 안 된다",
      );
    }),
  } as unknown as UnevaluatedFillRunOrchestratorService;
  // llmProviderConfigResolver — planUnevaluatedFill() 경로 test 에서 미사용이라 throw mock.
  const llmProviderConfigResolver = {
    resolveDefaultModelId: jest.fn(() => {
      throw new Error(
        "planUnevaluatedFill() 는 llmProviderConfigResolver 를 호출하면 안 된다",
      );
    }),
  } as unknown as LlmProviderConfigResolver;
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      adminBridge,
      personService,
      unevaluatedFillPlanner,
      unevaluatedFillRunOrchestrator,
      llmProviderConfigResolver,
    ),
    plannerSpy,
  };
}

// makeFillDto — UnevaluatedFillPlanRequestDto fixture 빌더(유효 base — personIds 2 +
// 유효 period/scope + 유효 ISO rangeStart/rangeEnd). overrides 로 각 축을 변형한다.
function makeFillDto(
  overrides: Partial<UnevaluatedFillPlanRequestDto> = {},
): UnevaluatedFillPlanRequestDto {
  return {
    personIds: ["person-1", "person-2"],
    period: "week",
    scope: "commit",
    rangeStart: "2026-06-01T00:00:00.000Z",
    rangeEnd: "2026-06-30T00:00:00.000Z",
    ...overrides,
  };
}

// makeFillPlan — planner 반환 UnevaluatedFillBatchPlan mock fixture. periodStart 는
// Date(도메인 컬럼) — controller 가 response mapper 경유로 ISO string 직렬화한다.
function makeEmptyFillPlan(): UnevaluatedFillBatchPlan {
  return { batches: [], totalGapCount: 0, personCount: 0 };
}

// makeTwoBatchFillPlan — person 2 묶음(person-1 좌표 2 + person-2 좌표 1)을 담은 plan.
// 순서/좌표 보존 검증의 기준값. periodStart 는 Date 축.
function makeTwoBatchFillPlan(): UnevaluatedFillBatchPlan {
  return {
    batches: [
      {
        personId: "person-1",
        periods: [
          {
            personId: "person-1",
            period: "week",
            scope: "commit",
            // KST 2026-06-01 00:00(= 2026-05-31T15:00Z) → formatKstIso 직렬화 시
            // "2026-06-01T00:00:00+09:00".
            periodStart: new Date("2026-05-31T15:00:00.000Z"),
          },
          {
            personId: "person-1",
            period: "week",
            scope: "commit",
            // KST 2026-06-08 00:00(= 2026-06-07T15:00Z) → "2026-06-08T00:00:00+09:00".
            periodStart: new Date("2026-06-07T15:00:00.000Z"),
          },
        ],
      },
      {
        personId: "person-2",
        periods: [
          {
            personId: "person-2",
            period: "week",
            scope: "commit",
            periodStart: new Date("2026-05-31T15:00:00.000Z"),
          },
        ],
      },
    ],
    totalGapCount: 3,
    personCount: 2,
  };
}

// makeAdminPersistResult — Admin generateAndPersist mock 반환 fixture. 영속
// Assessment(read-back 결과) + created 플래그. controller 가 응답 shape 로 매핑하는
// 기준값. periodStart 는 Date(영속 컬럼) — controller 가 ISO string 으로 직렬화.
function makeAdminPersistResult(
  overrides: Partial<{
    id: string;
    personId: string;
    period: string;
    scope: string;
    periodStart: Date;
    created: boolean;
  }> = {},
): PeriodBridgeAdminPersistResult {
  const {
    id = "assessment-admin-1",
    personId = "target-person",
    period = "week",
    scope = "commit",
    periodStart = new Date("2026-06-01T00:00:00.000Z"),
    created = true,
  } = overrides;
  return {
    assessment: {
      id,
      personId,
      period,
      scope,
      periodStart,
      difficulty: "medium",
      contributionScore: 0,
      volume: 0,
      narrative: "",
      createdAt: new Date("2026-06-02T00:00:00.000Z"),
    } as unknown as PeriodBridgeAdminPersistResult["assessment"],
    created,
  };
}

// adminActor — Admin tier principal payload. dispatch source(JwtPayload.role)가
// Admin 이면 controller 가 full-persist 분기로 dispatch.
const adminActor: JwtPayload = { sub: "admin-1", role: "Admin" };
// userActor — User tier principal payload. sub 으로 self-only 동등성을 판별.
// sub 부재(undefined/null) negative 분기 검증을 위해 string|undefined 를 받아
// JwtPayload 로 cast 한다(실 runtime 의 비정상 principal 형태를 단위로 재현).
function userActor(sub: string | undefined): JwtPayload {
  return { sub, role: "User" } as unknown as JwtPayload;
}

// makePeriodDto — PeriodBridgeDto fixture 빌더(self-only base: personId == 요청
// principal). overrides 로 personId / periodStart / reevaluate 등을 변형한다.
function makePeriodDto(
  overrides: Partial<PeriodBridgeDto> = {},
): PeriodBridgeDto {
  return {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

// Fixture — 유효한 GitHub activity 1 건. ActivityBase + GithubActivity-only 필드.
const githubActivity = {
  externalId: "abc123",
  sourceType: "github",
  instanceKey: "com",
  author: "octocat",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { changedFiles: 3 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};

// Fixture — 유효한 Confluence activity 1 건.
const confluenceActivity = {
  externalId: "page-42",
  sourceType: "confluence",
  instanceKey: "wiki-eng",
  author: "alice",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 12 },
  spaceRef: "ENG",
  version: 3,
};

// Fixture — orchestrator 반환 EvaluationResult 1 건.
function makeEvaluationResult(
  unitId: string = "github:com:abc123",
): EvaluationResult {
  return {
    unitId,
    narrative: "구현 진행",
    difficulty: "medium",
    contribution: "medium",
    volume: 3,
  };
}

// makeDto — context 4-tuple 을 포함한 evaluate DTO fixture 빌더. overrides 로 modelId /
// activities / mode 등을 변형한다.
function makeDto(
  overrides: Partial<EvaluateActivitiesDto> = {},
): EvaluateActivitiesDto {
  return {
    modelId: "gpt-4o-mini",
    ...baseContext,
    activities: [githubActivity as unknown as ActivityItemDto],
    ...overrides,
  };
}

describe("AssessmentEvaluationController (unit — delegation + persist wiring)", () => {
  // happy: 유효한 DTO 입력 시 orchestrator → persist 순서로 호출되고, 박제 식별자 +
  // in-memory 결과를 함께 반환.
  it("evaluate() 가 orchestrator 위임 후 persist 를 호출하고 { assessmentId, contributionCount, results } 를 반환한다 (happy)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, evaluateSpy, persistSpy } = makeController(
      async () => expected,
    );

    const dto = makeDto();
    const result = await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledWith(dto.activities, {
      modelId: "gpt-4o-mini",
    });
    // persist 가 orchestrator 결과 + 조립된 context + mode 로 호출됨.
    expect(persistSpy).toHaveBeenCalledTimes(1);
    expect(persistSpy).toHaveBeenCalledWith(
      {
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-06-01T00:00:00.000Z"),
      },
      expected,
      "fill",
    );
    // 반환 shape — 영속 식별자 + in-memory 결과 동시.
    expect(result).toEqual({
      assessmentId: "assessment-1",
      contributionCount: 2,
      results: expected,
    });
    // results 는 orchestrator 반환 reference 그대로(가공 0).
    expect(result.results).toBe(expected);
  });

  // periodStart 가 string → Date 로 파싱돼 persist context 에 전달.
  it("periodStart string 을 Date 로 파싱해 persist context 에 전달한다 (parsing branch)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, persistSpy } = makeController(async () => expected);

    await controller.evaluate(
      makeDto({ periodStart: "2026-01-15T09:30:00.000Z" }),
    );

    const passedContext = persistSpy.mock.calls[0][0] as { periodStart: Date };
    expect(passedContext.periodStart).toBeInstanceOf(Date);
    expect(passedContext.periodStart.toISOString()).toBe(
      "2026-01-15T09:30:00.000Z",
    );
  });

  // branch — mode='fill' 명시 시 persist 에 'fill' 전달.
  it("mode='fill' 명시 시 persist 에 'fill' 을 전달한다 (branch — fill)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);

    await controller.evaluate(makeDto({ mode: "fill" }));

    expect(persistSpy.mock.calls[0][2]).toBe("fill");
  });

  // branch — mode='reeval' 명시 시 persist 에 'reeval' 전달.
  it("mode='reeval' 명시 시 persist 에 'reeval' 을 전달한다 (branch — reeval)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);

    await controller.evaluate(makeDto({ mode: "reeval" }));

    expect(persistSpy.mock.calls[0][2]).toBe("reeval");
  });

  // branch — mode 미지정 시 기본값 'fill'.
  it("mode 미지정 시 기본값 'fill' 을 persist 에 전달한다 (branch — default fill)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);

    await controller.evaluate(makeDto({ mode: undefined }));

    expect(persistSpy.mock.calls[0][2]).toBe("fill");
  });

  // branch — 허용 외 mode 값은 'fill' 로 안전 fallback(reeval 오인 방지).
  it("허용 외 mode('bogus') 는 'fill' 로 안전 fallback 한다 (branch — unknown mode)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);

    await controller.evaluate(makeDto({ mode: "bogus" }));

    expect(persistSpy.mock.calls[0][2]).toBe("fill");
  });

  // error path: orchestrator reject 시 persist 미호출 + error 전파(swallow 0).
  it("orchestrator reject 시 persist 미호출 + error 를 그대로 전파한다 (error path — orchestrator)", async () => {
    const rawError = new Error("scoreUnit failed: model timeout");
    const { controller, persistSpy } = makeController(async () => {
      throw rawError;
    });

    await expect(controller.evaluate(makeDto())).rejects.toBe(rawError);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  // error path: persist reject(ConflictException) 시 controller 가 raw 전파(swallow 0).
  it("persist 가 ConflictException reject 시 controller 가 raw 전파한다 (error path — persist, 409 surfacing)", async () => {
    const conflict = new ConflictException("평가 결과가 이미 존재한다");
    const { controller } = makeController(
      async () => [makeEvaluationResult()],
      async () => {
        throw conflict;
      },
    );

    await expect(controller.evaluate(makeDto())).rejects.toBe(conflict);
  });

  // error path: persist 가 일반 error reject 시에도 raw 전파.
  it("persist 가 일반 error reject 시에도 raw 전파한다 (error path — persist generic)", async () => {
    const rawError = new Error("DB connection lost");
    const { controller } = makeController(
      async () => [makeEvaluationResult()],
      async () => {
        throw rawError;
      },
    );

    await expect(controller.evaluate(makeDto())).rejects.toBe(rawError);
  });

  // branch — confluence only input 도 그대로 forward.
  it("confluence activity 만 입력 시 orchestrator 에 그대로 forward 한다 (branch — confluence only)", async () => {
    const expected = [makeEvaluationResult("confluence:wiki-eng:page-42")];
    const { controller, evaluateSpy } = makeController(async () => expected);
    const dto = makeDto({
      activities: [confluenceActivity as unknown as ActivityItemDto],
    });

    await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledWith([confluenceActivity], {
      modelId: "gpt-4o-mini",
    });
  });

  // branch — 혼합(github + confluence) input.
  it("github + confluence 혼합 입력 시 분기 없이 전부 forward 한다 (branch — mixed)", async () => {
    const expected = [
      makeEvaluationResult("github:com:abc123"),
      makeEvaluationResult("confluence:wiki-eng:page-42"),
    ];
    const { controller, evaluateSpy } = makeController(async () => expected);
    const dto = makeDto({
      activities: [
        githubActivity as unknown as ActivityItemDto,
        confluenceActivity as unknown as ActivityItemDto,
      ],
    });

    const result = await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledWith(
      [githubActivity, confluenceActivity],
      { modelId: "gpt-4o-mini" },
    );
    expect(result.results).toBe(expected);
  });

  // branch — orchestrator 가 빈 결과 반환 시에도 persist 호출 + 빈 결과 반환.
  it("orchestrator 가 빈 EvaluationResult[] 반환 시에도 persist 호출 후 빈 results 를 반환한다 (branch — empty result)", async () => {
    const empty: EvaluationResult[] = [];
    const { controller, persistSpy } = makeController(
      async () => empty,
      async () => ({
        assessmentId: "assessment-empty",
        contributionCount: 0,
      }),
    );
    const result = await controller.evaluate(makeDto());

    expect(persistSpy).toHaveBeenCalledWith(expect.anything(), empty, "fill");
    expect(result.results).toBe(empty);
    expect(result.results.length).toBe(0);
    expect(result.contributionCount).toBe(0);
  });

  // 입력 비변형: controller 가 dto 객체를 수정하지 않음.
  it("controller 는 입력 dto 의 modelId / activities 를 변형하지 않는다 (input immutability)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller } = makeController(async () => expected);
    const dto = makeDto({
      activities: [{ ...githubActivity } as unknown as ActivityItemDto],
    });
    const snapshotModelId = dto.modelId;
    const snapshotActivities = [...dto.activities];
    const snapshotItem = { ...dto.activities[0] };

    await controller.evaluate(dto);

    expect(dto.modelId).toBe(snapshotModelId);
    expect(dto.activities).toEqual(snapshotActivities);
    expect(dto.activities[0]).toEqual(snapshotItem);
  });
});

describe("EvaluateActivitiesDto (ValidationPipe negative cases)", () => {
  // makePipe — controller-scope ValidationPipe 와 동일 옵션으로 단위 검증.
  function makePipe(): ValidationPipe {
    return new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }

  // metatype 인자 헬퍼 — type:"body" 컨텍스트 mirror.
  const meta = {
    type: "body" as const,
    metatype: EvaluateActivitiesDto,
    data: "",
  };

  // 정상 case 가 통과하는지부터 확인 — pipe 자체 동작 sanity check.
  it("유효한 DTO(context 4-tuple 포함)는 통과한다 (sanity — happy)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform(
      {
        modelId: "gpt-4o-mini",
        ...baseContext,
        activities: [{ ...githubActivity }],
      },
      meta,
    );
    expect(transformed).toBeInstanceOf(EvaluateActivitiesDto);
    expect(transformed.modelId).toBe("gpt-4o-mini");
    expect(transformed.personId).toBe("person-1");
    expect(transformed.activities[0]).toBeInstanceOf(ActivityItemDto);
  });

  // context 4-tuple 누락 → 거부(각 필드 required).
  it.each(["personId", "period", "scope", "periodStart"] as const)(
    "context 필드 %s 누락 시 ValidationPipe 가 거부한다 (negative — required context field)",
    async (field) => {
      const pipe = makePipe();
      const payload: Record<string, unknown> = {
        modelId: "gpt-4o-mini",
        ...baseContext,
        activities: [{ ...githubActivity }],
      };
      delete payload[field];
      await expect(pipe.transform(payload, meta)).rejects.toThrow();
    },
  );

  // (i) modelId 누락 → 거부.
  it("modelId 누락 시 ValidationPipe 가 거부한다 (negative — required field missing)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ activities: [{ ...githubActivity }] }, meta),
    ).rejects.toThrow();
  });

  // (ii-a) activities 누락 → 거부.
  it("activities 누락 시 ValidationPipe 가 거부한다 (negative — required array missing)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ modelId: "gpt-4o-mini" }, meta),
    ).rejects.toThrow();
  });

  // (ii-b) activities 가 배열 아님 → 거부.
  it("activities 가 배열이 아니면 ValidationPipe 가 거부한다 (negative — wrong type, not array)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform(
        { modelId: "gpt-4o-mini", activities: "not-an-array" },
        meta,
      ),
    ).rejects.toThrow();
  });

  // (iii) 빈 배열 → 거부(@ArrayMinSize(1)).
  it("activities 빈 배열 시 ValidationPipe 가 거부한다 (negative — @ArrayMinSize(1))", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ modelId: "gpt-4o-mini", activities: [] }, meta),
    ).rejects.toThrow();
  });

  // (iv) nested activity 필수 필드(externalId) 누락 → 거부.
  it("nested activity 의 externalId 누락 시 ValidationPipe 가 거부한다 (negative — nested required field)", async () => {
    const pipe = makePipe();
    const broken = { ...githubActivity } as Partial<typeof githubActivity>;
    delete broken.externalId;
    await expect(
      pipe.transform({ modelId: "gpt-4o-mini", activities: [broken] }, meta),
    ).rejects.toThrow();
  });

  // (v) 정의 외 추가 필드(예: raw 본문 가장한 임의 필드) → 거부(forbidNonWhitelisted).
  it("정의되지 않은 추가 필드는 forbidNonWhitelisted 가 거부한다 (negative — extra field)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform(
        {
          modelId: "gpt-4o-mini",
          activities: [{ ...githubActivity }],
          rawBody: "긴 raw 본문",
        },
        meta,
      ),
    ).rejects.toThrow();
  });

  // (vi) wrong type — timestamp 가 number → 거부.
  it("nested activity 의 timestamp 가 number 면 ValidationPipe 가 거부한다 (negative — nested wrong type)", async () => {
    const pipe = makePipe();
    const broken = { ...githubActivity, timestamp: 1717200000 };
    await expect(
      pipe.transform({ modelId: "gpt-4o-mini", activities: [broken] }, meta),
    ).rejects.toThrow();
  });

  // 추가 — modelId 빈 문자열 → 거부(@IsNotEmpty).
  it("modelId 빈 문자열 시 ValidationPipe 가 거부한다 (negative — @IsNotEmpty)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform(
        { modelId: "", activities: [{ ...githubActivity }] },
        meta,
      ),
    ).rejects.toThrow();
  });

  // 추가 — nested activity 의 sourceType 누락 → 거부.
  it("nested activity 의 sourceType 누락 시 ValidationPipe 가 거부한다 (negative — nested required)", async () => {
    const pipe = makePipe();
    const broken = { ...githubActivity } as Partial<typeof githubActivity>;
    delete broken.sourceType;
    await expect(
      pipe.transform({ modelId: "gpt-4o-mini", activities: [broken] }, meta),
    ).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------
// RBAC metadata 단언 — Reflector 로 evaluate() 핸들러에 @Roles("Admin") +
// @UseGuards(JwtAuthGuard, RolesGuard) 가 부착됐음을 검증. RBAC 게이트가 라우트를
// gate 하는지 metadata 수준에서 단언 — guard 실행 자체의 401/403 live 검증은 e2e
// slice 책임(본 task Out of Scope).
// -----------------------------------------------------------------------
describe("AssessmentEvaluationController (RBAC / guard metadata)", () => {
  const reflector = new Reflector();

  it("evaluate 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)", () => {
    const roles = reflector.get<string[]>(
      ROLES_METADATA_KEY,
      AssessmentEvaluationController.prototype.evaluate,
    );
    expect(roles).toEqual(["Admin"]);
  });

  it("evaluate 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증 + RBAC gate)", () => {
    // NestJS @UseGuards 는 "__guards__" metadata key 에 guard class 배열을 박제.
    const guards = Reflect.getMetadata(
      "__guards__",
      AssessmentEvaluationController.prototype.evaluate,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });
});

// =======================================================================
// POST /api/assessment-evaluation/period — User self-only ephemeral
// (T-0317, ADR-0037 §Decision1/4). R-112 4 종 + negative cases 충분 cover.
// =======================================================================
describe("AssessmentEvaluationController.period (unit — self-only ephemeral delegation)", () => {
  // happy: self == personId 인 User 가 호출 → person resolve → generateEphemeral
  // 1 회 위임 + 반환 결과 그대로 응답(persist 호출 0 — period() 가 persist mock 을
  // 호출하면 throw 로 즉시 실패).
  it("self == personId 시 person resolve 후 generateEphemeral 에 1 회 위임하고 결과를 그대로 반환한다 (happy)", async () => {
    const expected = [makeEvaluationResult("github:com:abc123")];
    const { controller, generateSpy, adminSpy, findPersonSpy } =
      makePeriodController({
        generateImpl: async () => expected,
        findPersonImpl: async () =>
          ({
            id: "person-1",
            serviceIdentities: [{ service: "github", externalId: "octocat" }],
          }) as unknown as PersonWithIdentities,
      });

    const dto = makePeriodDto();
    const result = await controller.period(dto, userActor("person-1"));

    // person 변환은 dto.personId 로 1 회.
    expect(findPersonSpy).toHaveBeenCalledTimes(1);
    expect(findPersonSpy).toHaveBeenCalledWith("person-1");
    // generateEphemeral 위임 — resolved serviceIdentities + since(periodStart 를 KST
    // week boundary 로 snap: KST 2026-06-01(월) 00:00 = 2026-05-31T15:00:00.000Z) +
    // modelId 미지정(undefined). raw "2026-06-01T00:00:00.000Z" 직접 전달 아님(T-0358).
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledWith(
      { serviceIdentities: [{ service: "github", externalId: "octocat" }] },
      { since: "2026-05-31T15:00:00.000Z" },
      { modelId: undefined },
    );
    // User 분기는 Admin full-persist 위임을 호출하지 않는다(role dispatch 분리).
    expect(adminSpy).not.toHaveBeenCalled();
    // 반환은 generateEphemeral 결과 reference 그대로(가공 0 — persist 0).
    expect(result).toBe(expected);
  });

  // error path: self != personId(타인 personId) → 403, 위임/person resolve 미호출.
  it("self != personId(타인 personId) 시 403(ForbiddenException) + generateEphemeral / person resolve 미호출 (error path — self-only 위반)", async () => {
    const { controller, generateSpy, findPersonSpy } = makePeriodController({});

    // principal sub 은 "attacker", dto.personId 는 "person-1"(타인).
    await expect(
      controller.period(
        makePeriodDto({ personId: "person-1" }),
        userActor("attacker"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(generateSpy).not.toHaveBeenCalled();
    // self-only 차단은 person resolve 이전(이른 차단)이라 PersonService 도 미호출.
    expect(findPersonSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: principal sub undefined → fail-closed deny(403) + 위임 미호출.
  it("principal sub 이 undefined 면 403 deny(fail-closed) + generateEphemeral 미호출 (flow — principal 부재)", async () => {
    const { controller, generateSpy, findPersonSpy } = makePeriodController({});

    await expect(
      controller.period(makePeriodDto(), userActor(undefined)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(findPersonSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: principal sub null 도 fail-closed deny(방어 분기).
  it("principal sub 이 null 이어도 403 deny(fail-closed) (flow — principal null)", async () => {
    const { controller, generateSpy } = makePeriodController({});

    await expect(
      controller.period(
        makePeriodDto(),
        userActor(null as unknown as string | undefined),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: actor 자체가 undefined(인증 부재의 방어 분기)여도 User 분기로
  // fall-through 해 self-only fail-closed deny(403). isAdminRole(undefined)=false 라
  // Admin 분기로 새지 않는다(fail-closed dispatch).
  it("actor 가 undefined 면 User 분기 self-only deny(403) (flow — actor 부재, Admin 미진입)", async () => {
    const { controller, generateSpy, adminSpy } = makePeriodController({});

    await expect(
      controller.period(makePeriodDto(), undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(generateSpy).not.toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: person 미존재 → PersonService 의 NotFoundException(404) 전파.
  // self-only 는 통과(self == personId)하나 person row 부재라 PersonService 가 throw.
  it("person 미존재 시 PersonService 의 NotFoundException(404)을 전파한다 (flow — person not found, generateEphemeral 미호출)", async () => {
    const notFound = new NotFoundException("person not found: person-1");
    const { controller, generateSpy } = makePeriodController({
      findPersonImpl: async () => {
        throw notFound;
      },
    });

    await expect(
      controller.period(makePeriodDto(), userActor("person-1")),
    ).rejects.toBe(notFound);
    // person resolve 가 throw 하면 위임 단계 도달 0.
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // error path: generateEphemeral reject 시 controller 가 raw 전파(swallow 0).
  it("generateEphemeral reject 시 controller 가 error 를 raw 전파한다 (error path — bridge reject)", async () => {
    const rawError = new Error("collect spec build failed");
    const { controller } = makePeriodController({
      generateImpl: async () => {
        throw rawError;
      },
    });

    await expect(
      controller.period(makePeriodDto(), userActor("person-1")),
    ).rejects.toBe(rawError);
  });

  // (구 "dto.mode 무시" branch 테스트는 T-0334 에서 제거 — vestigial mode field 자체가
  // ADR-0038 §Decision1 amendment 로 DTO 에서 제거돼 boundary 진입이 불가능해졌다. mode
  // 제공 payload 의 거부는 아래 "PeriodBridgeDto (ValidationPipe negative cases)" 가 cover.)

  // branch: serviceIdentities 가 빈 배열인 person 도 그대로 조립해 위임.
  it("serviceIdentities 가 빈 배열인 person 도 { serviceIdentities: [] } 로 위임한다 (branch — empty identities)", async () => {
    const expected: EvaluationResult[] = [];
    const { controller, generateSpy } = makePeriodController({
      generateImpl: async () => expected,
      findPersonImpl: async () =>
        ({
          id: "person-1",
          serviceIdentities: [],
        }) as unknown as PersonWithIdentities,
    });

    const result = await controller.period(
      makePeriodDto(),
      userActor("person-1"),
    );

    expect(generateSpy).toHaveBeenCalledWith(
      { serviceIdentities: [] },
      { since: "2026-05-31T15:00:00.000Z" },
      { modelId: undefined },
    );
    expect(result).toBe(expected);
  });
});

// =======================================================================
// POST /api/assessment-evaluation/period — Admin full-persist 분기
// (T-0322, ADR-0037 slice 3, §Decision1 Admin full-persist + amended
// §Decision3 first-write-wins read-through). R-112 4 종 + role dispatch
// 분기 cover + negative. dispatch source 는 principal role(Admin tier 이상).
// =======================================================================
describe("AssessmentEvaluationController.period (unit — Admin full-persist branch)", () => {
  // happy: Admin role 호출 → person resolve → generateAndPersist 1 회 위임 +
  // 반환 영속 Assessment 식별자/좌표가 응답에 박제. ephemeral 위임 미호출(분리).
  it("Admin role 호출 시 person resolve 후 generateAndPersist 에 1 회 위임하고 영속 Assessment 식별자/좌표를 응답한다 (happy — Admin persist)", async () => {
    const { controller, adminSpy, generateSpy, findPersonSpy } =
      makePeriodController({
        adminImpl: async () =>
          makeAdminPersistResult({
            id: "assessment-admin-1",
            personId: "target-person",
            created: true,
          }),
        findPersonImpl: async () =>
          ({
            id: "target-person",
            serviceIdentities: [{ service: "github", externalId: "octocat" }],
          }) as unknown as PersonWithIdentities,
      });

    // Admin 은 임의 personId(자기 sub 과 다름)를 target — self-only 우회.
    const dto = makePeriodDto({ personId: "target-person" });
    const result = await controller.period(dto, adminActor);

    // person 변환은 임의 personId(target-person)로 1 회(self-only 동등성 검사 0).
    expect(findPersonSpy).toHaveBeenCalledTimes(1);
    expect(findPersonSpy).toHaveBeenCalledWith("target-person");
    // generateAndPersist 위임 — resolved serviceIdentities + since(pass-through) +
    // modelId 미지정 + context 4-tuple(periodStart Date 파싱) + reevaluate 미지정
    // 은 5번째 인자 undefined 그대로 pass-through(T-0336, ADR-0038 §Decision1).
    // since + context.periodStart 둘 다 KST week boundary 로 snap(KST 2026-06-01 월
    // 00:00 = 2026-05-31T15:00:00.000Z). 같은 source 에서 도출(중복 산술 0, §Decision5).
    expect(adminSpy).toHaveBeenCalledTimes(1);
    expect(adminSpy).toHaveBeenCalledWith(
      { serviceIdentities: [{ service: "github", externalId: "octocat" }] },
      { since: "2026-05-31T15:00:00.000Z" },
      { modelId: undefined },
      {
        personId: "target-person",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-05-31T15:00:00.000Z"),
      },
      undefined,
    );
    // 응답 shape — 영속 식별자 + 좌표 + created. periodStart 는 ISO string 직렬화.
    expect(result).toEqual({
      assessmentId: "assessment-admin-1",
      personId: "target-person",
      period: "week",
      scope: "commit",
      periodStart: "2026-06-01T00:00:00.000Z",
      created: true,
    });
    // Admin 분기는 ephemeral 위임을 호출하지 않는다(role dispatch 분리).
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // branch: created=false(first-write-wins read-through — 기존 저장본 반환)도
  // 그대로 응답에 박제(409 전파 0, amended §Decision3).
  it("created=false(read-through 기존 저장본) 도 그대로 응답에 박제한다 (branch — read-through, 409 전파 0)", async () => {
    const { controller } = makePeriodController({
      adminImpl: async () =>
        makeAdminPersistResult({ id: "assessment-existing", created: false }),
    });

    const result = (await controller.period(
      makePeriodDto({ personId: "target-person" }),
      adminActor,
    )) as { assessmentId: string; created: boolean };

    expect(result.assessmentId).toBe("assessment-existing");
    expect(result.created).toBe(false);
  });

  // SuperAdmin(Admin escalation)도 Admin 분기로 dispatch — ROLE_HIERARCHY 재사용.
  it("SuperAdmin role 도 Admin 분기로 dispatch 한다 (branch — escalation, SuperAdmin)", async () => {
    const { controller, adminSpy, generateSpy } = makePeriodController({});

    await controller.period(makePeriodDto({ personId: "target-person" }), {
      sub: "super-1",
      role: "SuperAdmin",
    });

    expect(adminSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // error path: Admin 분기에서 generateAndPersist reject(예: evaluateActivities
  // throw / persist 비-Conflict error) 시 controller 가 raw 전파(swallow 0).
  it("Admin 분기 generateAndPersist reject 시 controller 가 error 를 raw 전파한다 (error path — admin bridge reject)", async () => {
    const rawError = new Error("evaluateActivities failed: model timeout");
    const { controller } = makePeriodController({
      adminImpl: async () => {
        throw rawError;
      },
    });

    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person" }),
        adminActor,
      ),
    ).rejects.toBe(rawError);
  });

  // flow / 분기: Admin 분기에서도 person 미존재 → PersonService 의
  // NotFoundException(404) 전파(generateAndPersist 미호출).
  it("Admin 분기 person 미존재 시 PersonService 의 NotFoundException(404)을 전파한다 (flow — person not found, persist 미호출)", async () => {
    const notFound = new NotFoundException("person not found: target-person");
    const { controller, adminSpy } = makePeriodController({
      findPersonImpl: async () => {
        throw notFound;
      },
    });

    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person" }),
        adminActor,
      ),
    ).rejects.toBe(notFound);
    // person resolve 가 throw 하면 persist 위임 단계 도달 0.
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // branch: periodStart string → Date 파싱 후 KST week boundary 로 snap 돼 context 에
  // 전달. KST 2026-01-15(목) 18:30 → 그 주 월요일 KST 2026-01-12 00:00 =
  // 2026-01-11T15:00:00.000Z. raw 입력이 context 좌표로 직접 흐르지 않음을 박제.
  it("periodStart string 을 Date 로 파싱·snap 해 context 에 전달한다 (branch — periodStart 파싱 + snap)", async () => {
    const { controller, adminSpy } = makePeriodController({});

    await controller.period(
      makePeriodDto({
        personId: "target-person",
        periodStart: "2026-01-15T09:30:00.000Z",
      }),
      adminActor,
    );

    const passedContext = adminSpy.mock.calls[0][3] as { periodStart: Date };
    expect(passedContext.periodStart).toBeInstanceOf(Date);
    expect(passedContext.periodStart.toISOString()).toBe(
      "2026-01-11T15:00:00.000Z",
    );
  });

  // negative: reevaluate 미지정 시 Admin 분기는 reeval 로 baking 하지 않는다 —
  // 5번째 인자가 undefined 그대로 pass-through 돼(가공·정규화 0) first-write-wins
  // default 가 보존된다(ADR-0038 §Decision3 — strict-true 판정은 service 책임).
  // context 4-tuple 에도 mode 류 키를 baking 하지 않는다(구 vestigial dto.mode 는
  // T-0334 제거 — mode 제공 payload 는 ValidationPipe 가 정의 외 필드로 400 거부,
  // 아래 ValidationPipe negative cases cover).
  it("reevaluate 미지정 시 Admin 분기는 reeval 로 baking 하지 않는다 (negative — 5번째 인자 undefined, default first-write-wins 보존)", async () => {
    const { controller, adminSpy } = makePeriodController({});

    await controller.period(
      makePeriodDto({ personId: "target-person" }),
      adminActor,
    );

    // 5번째 인자는 명시적 undefined pass-through(reeval 오인 baking 0).
    expect(adminSpy.mock.calls[0].length).toBe(5);
    expect(adminSpy.mock.calls[0][4]).toBeUndefined();
    const passedContext = adminSpy.mock.calls[0][3] as Record<string, unknown>;
    // context 4-tuple 에 mode 키 부재(reeval baking 0).
    expect(passedContext).not.toHaveProperty("mode");
    expect(Object.keys(passedContext).sort()).toEqual([
      "period",
      "periodStart",
      "personId",
      "scope",
    ]);
  });
});

// =======================================================================
// POST /api/assessment-evaluation/period — KST boundary snap 배선
// (T-0358, ADR-0039 §Decision3 (a)~(c) + §Decision5). controller `period()`
// 가 raw `dto.periodStart` 를 요청 granularity 의 canonical KST period boundary
// 로 snap 해 좌표/since 로 쓴다. R-112 4 종 + negative cases 충분 cover.
// =======================================================================
describe("AssessmentEvaluationController.period (unit — KST boundary snap, ADR-0039)", () => {
  // helper — Admin 분기로 호출하고 generateAndPersist 의 since(인자0) / context.periodStart
  // (인자3) 를 추출. snap 좌표 단언의 공통 진입.
  async function snapAdmin(periodStart: string, period: string = "week") {
    const { controller, adminSpy } = makePeriodController({});
    await controller.period(
      makePeriodDto({ personId: "target-person", periodStart, period }),
      adminActor,
    );
    const since = (adminSpy.mock.calls[0][1] as { since: string }).since;
    const ctx = adminSpy.mock.calls[0][3] as { periodStart: Date };
    return { since, periodStart: ctx.periodStart };
  }

  // happy(Admin): 같은 KST 일 안의 서로 다른 입력 instant 2 개가 동일 canonical
  // periodStart 좌표 + since 로 snap 된다 (day granularity, AC 핵심).
  it("같은 KST 일 안의 서로 다른 instant 2 개가 동일 day 좌표/since 로 snap 된다 (happy — day 수렴)", async () => {
    // KST 2026-06-11 00:00(=2026-06-10T15:00Z) 와 KST 2026-06-11 23:00(=2026-06-11T14:00Z).
    const a = await snapAdmin("2026-06-10T15:00:00.000Z", "day");
    const b = await snapAdmin("2026-06-11T14:00:00.000Z", "day");
    expect(a.periodStart.toISOString()).toBe("2026-06-10T15:00:00.000Z");
    expect(b.periodStart.toISOString()).toBe("2026-06-10T15:00:00.000Z");
    expect(a.since).toBe(b.since);
    expect(a.since).toBe("2026-06-10T15:00:00.000Z");
  });

  // branch: week granularity — KST 임의 요일 입력이 그 주 월요일 KST 00:00 으로 snap.
  it("week granularity 입력이 그 주 KST 월요일 00:00 좌표로 snap 된다 (branch — week)", async () => {
    // KST 2026-06-11(목) → 그 주 월요일 KST 2026-06-08 00:00 = 2026-06-07T15:00Z.
    const r = await snapAdmin("2026-06-11T03:00:00.000Z", "week");
    expect(r.periodStart.toISOString()).toBe("2026-06-07T15:00:00.000Z");
    expect(r.since).toBe("2026-06-07T15:00:00.000Z");
  });

  // branch: month granularity — 월 중 입력이 그 달 1 일 KST 00:00 으로 snap.
  it("month granularity 입력이 그 달 KST 1 일 00:00 좌표로 snap 된다 (branch — month)", async () => {
    // KST 2026-06-15 → 6 월 월초 KST 2026-06-01 00:00 = 2026-05-31T15:00Z.
    const r = await snapAdmin("2026-06-15T03:00:00.000Z", "month");
    expect(r.periodStart.toISOString()).toBe("2026-05-31T15:00:00.000Z");
  });

  // negative: KST 자정 직전/직후 경계가 서로 다른 KST 일로 snap (day, 9 시간 drift).
  it("KST 자정 직전/직후 경계가 서로 다른 KST 일 좌표로 snap 된다 (negative — 경계값)", async () => {
    // 2026-06-10T14:59:59.999Z = KST 6/10 23:59:59.999 → KST 6/10 자정(2026-06-09T15:00Z).
    const before = await snapAdmin("2026-06-10T14:59:59.999Z", "day");
    // 2026-06-10T15:00:00.000Z = KST 6/11 00:00 → KST 6/11 자정(2026-06-10T15:00Z).
    const after = await snapAdmin("2026-06-10T15:00:00.000Z", "day");
    expect(before.periodStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
    expect(after.periodStart.toISOString()).toBe("2026-06-10T15:00:00.000Z");
    expect(before.periodStart.toISOString()).not.toBe(
      after.periodStart.toISOString(),
    );
  });

  // negative: 월말 입력(KST 6/1 자정 = 5/31 15:00Z)이 6 월 월초 좌표로 snap (T-0357
  // overflow 결함 인접 — 한 달 +1 일 drift 가 없음을 박제).
  it("월말 입력(KST 6/1 자정)이 6 월 월초 좌표로 snap 된다 (negative — month overflow 인접)", async () => {
    const r = await snapAdmin("2026-05-31T15:00:00.000Z", "month");
    expect(r.periodStart.toISOString()).toBe("2026-05-31T15:00:00.000Z");
  });

  // error path: 알 수 없는 period(snap 도달 전 RangeError) → Admin 위임 미호출.
  it("알 수 없는 period('year') 는 snap reject(RangeError) + generateAndPersist 미호출 (error path — Admin)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person", period: "year" }),
        adminActor,
      ),
    ).rejects.toThrow(RangeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // error path: 알 수 없는 period → User 분기에서도 snap reject + ephemeral 위임 미호출.
  it("알 수 없는 period('year') 는 User 분기에서도 snap reject + generateEphemeral 미호출 (error path — User)", async () => {
    const { controller, generateSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({ period: "year" }),
        userActor("person-1"),
      ),
    ).rejects.toThrow(RangeError);
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // negative: DTO 통과 후 형식 위반(`not-a-real-date`)인 periodStart → `parseKstPeriodInput`
  // 의 RangeError 전파(Admin 위임 미호출). `@IsISO8601` 우회 가정한 edge — T-0359 가
  // raw `new Date` 의 silent Invalid Date(이전엔 helper assertValidDate TypeError 였음)를
  // parser 의 명시적 형식 위반 RangeError 로 교체한다(silent NaN 진입 차단, ADR-0039
  // §Decision3 (d)). 비문자열/빈 입력의 TypeError 경로는 아래 R-9 describe 가 cover.
  it("DTO 통과했으나 형식 위반인 periodStart 는 parseKstPeriodInput RangeError 전파 + 위임 미호출 (negative — 형식 위반)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({
          personId: "target-person",
          periodStart: "not-a-real-date",
        }),
        adminActor,
      ),
    ).rejects.toThrow(RangeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // flow: User reevaluate fail-closed reject 는 snap 보다 선행(기존 차단 우선 회귀 0) —
  // 알 수 없는 period 라도 재평가 거부(403)가 snap RangeError 보다 먼저 발생.
  it("User + reevaluate: true 는 snap 도달 전 403(재평가 거부)으로 선행 차단된다 (flow — fail-closed 우선, 회귀 0)", async () => {
    const { controller, generateSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({ period: "year", reevaluate: true }),
        userActor("person-1"),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(generateSpy).not.toHaveBeenCalled();
  });
});

// =======================================================================
// R-9 입력 parseKstPeriodInput 경유 (T-0359, ADR-0039 §Decision3 (d) +
// §Decision5). controller 가 raw `new Date(periodStart)` 대신 helper 로
// R-9 입력을 해석 — offset 미명시 입력이 Asia/Seoul default 로 해석돼야 한다
// (예 `2026-06-10T15:00` → KST 15시 = `2026-06-10T06:00:00Z`). period()
// (Admin/User 양 분기) + evaluate() 양 경로 cover. R-112 4 종 + negative
// cases 충분 cover(자정 경계 / UTC-drift 회귀 차단 / malformed / type mismatch).
// =======================================================================
describe("AssessmentEvaluationController (unit — R-9 입력 parseKstPeriodInput 경유, ADR-0039 §Decision3 (d))", () => {
  // helper — Admin 분기로 호출하고 generateAndPersist 의 since(인자0) / context.periodStart
  // (인자3) 를 추출. KST-default 해석 단언의 공통 진입(snap 까지 흐른 좌표).
  async function snapAdmin(periodStart: string, period: string = "day") {
    const { controller, adminSpy } = makePeriodController({});
    await controller.period(
      makePeriodDto({ personId: "target-person", periodStart, period }),
      adminActor,
    );
    const since = (adminSpy.mock.calls[0][1] as { since: string }).since;
    const ctx = adminSpy.mock.calls[0][3] as { periodStart: Date };
    return { since, periodStart: ctx.periodStart };
  }

  // happy: offset 미명시 입력(`2026-06-10T15:00`)이 Asia/Seoul KST 15시로 해석돼
  // (= `2026-06-10T06:00:00Z`) 그 KST 일(6/10) 자정(2026-06-09T15:00Z)으로 snap 된다.
  // raw `new Date("2026-06-10T15:00")` 였다면 JS 엔진 default(UTC/locale, KST 아님)로
  // 해석돼 다른 좌표가 됐을 것 — KST-default 해석을 박제.
  it("offset 미명시 입력(`2026-06-10T15:00`)이 Asia/Seoul 로 해석돼 KST 일 좌표로 흐른다 (happy — KST-default 해석)", async () => {
    const r = await snapAdmin("2026-06-10T15:00", "day");
    // KST 6/10 15시 = 2026-06-10T06:00:00Z → 그 KST 일(6/10) 자정 = 2026-06-09T15:00:00Z.
    expect(r.periodStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
    expect(r.since).toBe("2026-06-09T15:00:00.000Z");
  });

  // branch: offset 명시 입력(`...Z`)은 그대로 해석된다(KST 재해석 0).
  it("offset 명시 입력(`...Z`)은 그대로 해석된다 (branch — offset 명시 그대로)", async () => {
    // 2026-06-10T15:00:00Z = KST 6/11 00:00 → 그 KST 일(6/11) 자정 = 2026-06-10T15:00:00Z.
    const r = await snapAdmin("2026-06-10T15:00:00.000Z", "day");
    expect(r.periodStart.toISOString()).toBe("2026-06-10T15:00:00.000Z");
  });

  // branch: offset 명시 입력(`+09:00`)도 그대로 해석(KST 명시이므로 Asia/Seoul 해석과 동일).
  it("offset 명시 입력(`+09:00`)은 그대로 해석된다 (branch — explicit +09:00)", async () => {
    // 2026-06-10T15:00:00+09:00 = 2026-06-10T06:00:00Z → KST 6/10 → 6/10 자정 = 2026-06-09T15:00Z.
    const r = await snapAdmin("2026-06-10T15:00:00+09:00", "day");
    expect(r.periodStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
  });

  // negative: 날짜만(offset/시각 미명시) 입력(`2026-06-10`)은 KST 자정으로 해석된다 —
  // UTC 자정(`2026-06-10T00:00:00Z`)이 아니라 KST 자정(`2026-06-09T15:00:00Z`).
  // UTC-drift 회귀 차단(9 시간 drift 가 없음을 박제).
  it("날짜만 입력(`2026-06-10`)은 KST 자정으로 해석된다 — UTC 자정 아님 (negative — UTC-drift 회귀 차단)", async () => {
    const r = await snapAdmin("2026-06-10", "day");
    // KST 6/10 자정 = 2026-06-09T15:00:00Z. (UTC 해석이었다면 2026-06-10T00:00:00Z.)
    expect(r.periodStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
    expect(r.periodStart.toISOString()).not.toBe("2026-06-10T00:00:00.000Z");
  });

  // negative: offset 미명시 KST 자정 경계 입력(`2026-06-10T00:00`)은 KST 6/10 자정으로
  // 해석(= 2026-06-09T15:00:00Z) — 미명시가 UTC 가 아니라 KST 로 묶임을 경계값에서 재확인.
  it("offset 미명시 자정 경계(`2026-06-10T00:00`)는 KST 자정으로 해석된다 (negative — 자정 경계 KST 묶임)", async () => {
    const r = await snapAdmin("2026-06-10T00:00", "day");
    expect(r.periodStart.toISOString()).toBe("2026-06-09T15:00:00.000Z");
  });

  // 분기: period() User 분기도 동일하게 KST-default 해석된 좌표로 since 를 흘려보낸다.
  it("User 분기도 offset 미명시 입력을 Asia/Seoul 로 해석해 since 로 흘려보낸다 (branch — User dispatch KST-default)", async () => {
    const { controller, generateSpy } = makePeriodController({
      generateImpl: async () => [],
    });
    await controller.period(
      makePeriodDto({ periodStart: "2026-06-10T15:00", period: "day" }),
      userActor("person-1"),
    );
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect((generateSpy.mock.calls[0][1] as { since: string }).since).toBe(
      "2026-06-09T15:00:00.000Z",
    );
  });

  // 분기: evaluate() 경로의 context periodStart 도 KST-default 해석된다(snap 0, 좌표 해석만).
  it("evaluate() 의 context periodStart 도 offset 미명시 입력을 Asia/Seoul 로 해석한다 (branch — evaluate KST-default)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);
    await controller.evaluate(makeDto({ periodStart: "2026-06-10T15:00" }));
    const ctx = persistSpy.mock.calls[0][0] as { periodStart: Date };
    expect(ctx.periodStart).toBeInstanceOf(Date);
    // KST 6/10 15시 = 2026-06-10T06:00:00Z (evaluate 는 snap 0 — 좌표 해석만).
    expect(ctx.periodStart.toISOString()).toBe("2026-06-10T06:00:00.000Z");
  });

  // 분기: evaluate() 에서 offset 명시 입력(`...Z`)은 그대로 해석(KST 재해석 0).
  it("evaluate() 에서 offset 명시 입력(`...Z`)은 그대로 해석된다 (branch — evaluate offset 명시)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);
    await controller.evaluate(
      makeDto({ periodStart: "2026-01-15T09:30:00.000Z" }),
    );
    const ctx = persistSpy.mock.calls[0][0] as { periodStart: Date };
    expect(ctx.periodStart.toISOString()).toBe("2026-01-15T09:30:00.000Z");
  });

  // error path: malformed periodStart(달력 불가능 값)는 helper 의 RangeError 로 전파 +
  // Admin 위임 미호출(@IsISO8601 우회 가정한 edge — helper 가 silent Invalid Date 차단).
  it("malformed periodStart(달력 불가능 `2026-02-30`)는 helper RangeError 전파 + 위임 미호출 (error path — RangeError)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person", periodStart: "2026-02-30" }),
        adminActor,
      ),
    ).rejects.toThrow(RangeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // error path: 범위 외 offset(`+09:99`)은 helper 의 RangeError(형식 위반)로 전파.
  it("범위 외 offset(`+09:99`)은 helper RangeError 전파 + 위임 미호출 (error path — 범위 외 offset)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({
          personId: "target-person",
          periodStart: "2026-06-10T15:00:00+09:99",
        }),
        adminActor,
      ),
    ).rejects.toThrow(RangeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // error path: 형식 위반(비-ISO 류 `not-a-real-date`)은 helper RangeError 전파.
  // (@IsISO8601 우회 가정 — `new Date` 의 silent Invalid Date 대신 명시적 error.)
  it("형식 위반 입력(`not-a-real-date`)은 helper RangeError 전파 + 위임 미호출 (error path — 형식 위반)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({
          personId: "target-person",
          periodStart: "not-a-real-date",
        }),
        adminActor,
      ),
    ).rejects.toThrow(RangeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // negative(type mismatch): 빈 문자열 입력은 helper TypeError 전파(비문자열/빈 입력).
  it("빈 문자열 periodStart 는 helper TypeError 전파 + 위임 미호출 (negative — type mismatch/빈 입력)", async () => {
    const { controller, adminSpy } = makePeriodController({});
    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person", periodStart: "   " }),
        adminActor,
      ),
    ).rejects.toThrow(TypeError);
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // negative(type mismatch): 비문자열(number cast) 입력도 helper TypeError 전파 —
  // evaluate() 경로에서도 raw `new Date` 의 silent NaN 대신 명시적 error.
  it("evaluate() 에서 비문자열 periodStart 는 helper TypeError 전파 (negative — evaluate type mismatch)", async () => {
    const { controller, persistSpy } = makeController(async () => [
      makeEvaluationResult(),
    ]);
    await expect(
      controller.evaluate(makeDto({ periodStart: 12345 as unknown as string })),
    ).rejects.toThrow(TypeError);
    // 해석 단계가 throw 하면 persist 미호출(swallow 0).
    expect(persistSpy).not.toHaveBeenCalled();
  });
});

// =======================================================================
// POST /api/assessment-evaluation/period — reevaluate dispatch
// (T-0336, ADR-0038 slice 3, §Decision1 flag dispatch + §Decision4 (ii)
// User fail-closed reject). Admin true/false 분기 + User true/false 분기 +
// negative(타인 personId 조합 선행 결정성) cover. Admin/User 의 "미지정" 분기는
// 위 두 describe 의 기존 happy + 재정의된 5번째-인자-undefined negative 가 cover.
// wrong-type reevaluate 거부는 DTO ValidationPipe 책임(T-0333 기 커버) — controller
// 단은 boolean 전제.
// =======================================================================
describe("AssessmentEvaluationController.period (unit — reevaluate dispatch, ADR-0038 slice 3)", () => {
  // happy: Admin + reevaluate: true → person resolve 후 generateAndPersist 1 회
  // 위임 + **5번째 인자 true** 가공 없이 pass-through + 영속 식별자/좌표 응답 보존.
  it("Admin + reevaluate: true 시 generateAndPersist 5번째 인자로 true 를 pass-through 한다 (happy — reeval dispatch)", async () => {
    const { controller, adminSpy, generateSpy } = makePeriodController({
      adminImpl: async () =>
        makeAdminPersistResult({
          id: "assessment-reeval-1",
          personId: "target-person",
          created: true,
        }),
      findPersonImpl: async () =>
        ({
          id: "target-person",
          serviceIdentities: [{ service: "github", externalId: "octocat" }],
        }) as unknown as PersonWithIdentities,
    });

    const result = await controller.period(
      makePeriodDto({ personId: "target-person", reevaluate: true }),
      adminActor,
    );

    expect(adminSpy).toHaveBeenCalledTimes(1);
    expect(adminSpy).toHaveBeenCalledWith(
      { serviceIdentities: [{ service: "github", externalId: "octocat" }] },
      { since: "2026-05-31T15:00:00.000Z" },
      { modelId: undefined },
      {
        personId: "target-person",
        period: "week",
        scope: "commit",
        periodStart: new Date("2026-05-31T15:00:00.000Z"),
      },
      true,
    );
    // 영속 식별자/좌표 응답 shape 보존(reevaluate 분기가 응답 가공을 바꾸지 않는다).
    expect(result).toEqual({
      assessmentId: "assessment-reeval-1",
      personId: "target-person",
      period: "week",
      scope: "commit",
      periodStart: "2026-06-01T00:00:00.000Z",
      created: true,
    });
    expect(generateSpy).not.toHaveBeenCalled();
  });

  // branch: Admin + reevaluate: false → 5번째 인자 false 그대로(정규화 0 —
  // strict-true 판정은 service 책임, first-write-wins 보존).
  it("Admin + reevaluate: false 시 5번째 인자로 false 를 그대로 pass-through 한다 (branch — explicit false, fill 보존)", async () => {
    const { controller, adminSpy } = makePeriodController({});

    await controller.period(
      makePeriodDto({ personId: "target-person", reevaluate: false }),
      adminActor,
    );

    expect(adminSpy).toHaveBeenCalledTimes(1);
    expect(adminSpy.mock.calls[0][4]).toBe(false);
  });

  // error path: Admin + reevaluate: true 분기에서 generateAndPersist 가
  // ConflictException reject(T-0335 reeval 경로 Conflict 전파 계약) 시 controller
  // 가 raw 전파한다(swallow 0 — NestJS 가 409 로 매핑).
  it("Admin + reevaluate: true 분기에서 generateAndPersist 의 ConflictException 을 raw 전파한다 (error path — reeval Conflict 전파)", async () => {
    const conflict = new ConflictException("동시 재평가 경합");
    const { controller } = makePeriodController({
      adminImpl: async () => {
        throw conflict;
      },
    });

    await expect(
      controller.period(
        makePeriodDto({ personId: "target-person", reevaluate: true }),
        adminActor,
      ),
    ).rejects.toBe(conflict);
  });

  // error path: User + reevaluate: true → 403 ForbiddenException(재평가는 Admin
  // 전용, ADR-0038 §Decision4 (ii)) + self-only 검사·person resolve·ephemeral
  // 위임·admin 위임 **전부 미호출**(선행 차단).
  it("User + reevaluate: true 시 403(ForbiddenException) + 위임/resolve 전부 미호출 — 재평가는 Admin 전용 (error path — fail-closed reject)", async () => {
    const { controller, generateSpy, adminSpy, findPersonSpy } =
      makePeriodController({});

    let caught: unknown;
    try {
      await controller.period(
        makePeriodDto({ reevaluate: true }),
        userActor("person-1"),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ForbiddenException);
    // 메시지에 재평가/Admin 전용 의미 명시(한국어, §Decision4 silent 혼란 차단).
    expect((caught as ForbiddenException).message).toContain("재평가");
    expect((caught as ForbiddenException).message).toContain("Admin");
    // 차단이 모든 위임/resolve 보다 선행 — 전부 미호출.
    expect(generateSpy).not.toHaveBeenCalled();
    expect(findPersonSpy).not.toHaveBeenCalled();
    expect(adminSpy).not.toHaveBeenCalled();
  });

  // negative: User + reevaluate: true + 타인 personId 조합 — 재평가 거부가
  // self-only 위반 검사보다 **선행**해 거부 사유가 결정적(403, 사유 = 재평가 거부).
  it("User + reevaluate: true + 타인 personId 조합도 재평가 거부(403)가 self-only 위반보다 선행한다 (negative — 거부 사유 결정성)", async () => {
    const { controller, generateSpy, findPersonSpy } = makePeriodController({});

    let caught: unknown;
    try {
      await controller.period(
        makePeriodDto({ personId: "person-1", reevaluate: true }),
        userActor("attacker"),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ForbiddenException);
    // 거부 사유가 self-only 가 아니라 재평가 거부로 결정적이다(선행 차단).
    expect((caught as ForbiddenException).message).toContain("재평가");
    expect((caught as ForbiddenException).message).not.toContain("self-only");
    expect(generateSpy).not.toHaveBeenCalled();
    expect(findPersonSpy).not.toHaveBeenCalled();
  });

  // flow: User + reevaluate: false → 기존 self-only ephemeral 동작 그대로(회귀 0).
  // 미지정 분기는 위 self-only describe 의 기존 happy(makePeriodDto() 기본값)가 cover.
  it("User + reevaluate: false 시 기존 self-only ephemeral 동작 그대로 위임한다 (flow — explicit false, 회귀 0)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, generateSpy, adminSpy } = makePeriodController({
      generateImpl: async () => expected,
    });

    const result = await controller.period(
      makePeriodDto({ reevaluate: false }),
      userActor("person-1"),
    );

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(adminSpy).not.toHaveBeenCalled();
    expect(result).toBe(expected);
  });

  // flow: User + reevaluate: false 에서도 self-only 위반(타인 personId)은 기존
  // fail-closed deny 그대로(재평가 차단이 false 분기 동작을 바꾸지 않는다).
  it("User + reevaluate: false + 타인 personId 는 기존 self-only deny(403) 그대로다 (flow — false 분기 self-only 보존)", async () => {
    const { controller, generateSpy } = makePeriodController({});

    let caught: unknown;
    try {
      await controller.period(
        makePeriodDto({ personId: "person-1", reevaluate: false }),
        userActor("attacker"),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ForbiddenException);
    // 사유는 기존 self-only(재평가 거부 아님) — false 분기는 회귀 0.
    expect((caught as ForbiddenException).message).toContain("self-only");
    expect(generateSpy).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// PeriodBridgeDto ValidationPipe negative cases — controller-scope pipe 와 동일
// 옵션으로 단위 검증(e2e 부재라 metadata/구조로 wire 확인 + DTO decorator 검증).
// -----------------------------------------------------------------------
describe("PeriodBridgeDto (ValidationPipe negative cases)", () => {
  function makePipe(): ValidationPipe {
    return new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }

  const meta = {
    type: "body" as const,
    metatype: PeriodBridgeDto,
    data: "",
  };

  const validPayload = {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
  };

  it("유효한 DTO 는 통과한다 (sanity — happy)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform({ ...validPayload }, meta);
    expect(transformed).toBeInstanceOf(PeriodBridgeDto);
    expect(transformed.personId).toBe("person-1");
  });

  // 필수 필드 누락 → 거부.
  it.each(["personId", "period", "scope", "periodStart"] as const)(
    "필수 필드 %s 누락 시 ValidationPipe 가 거부한다 (negative — required field missing)",
    async (field) => {
      const pipe = makePipe();
      const payload: Record<string, unknown> = { ...validPayload };
      delete payload[field];
      await expect(pipe.transform(payload, meta)).rejects.toThrow();
    },
  );

  // wrong type — personId 가 number → 거부.
  it("personId 가 number 면 ValidationPipe 가 거부한다 (negative — wrong type)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, personId: 123 }, meta),
    ).rejects.toThrow();
  });

  // periodStart 가 비-ISO → 거부(@IsISO8601).
  it("periodStart 가 비-ISO 문자열이면 ValidationPipe 가 거부한다 (negative — @IsISO8601)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, periodStart: "2026-13-99" }, meta),
    ).rejects.toThrow();
  });

  // 정의 외 추가 필드 → 거부(forbidNonWhitelisted).
  it("정의되지 않은 추가 필드는 forbidNonWhitelisted 가 거부한다 (negative — extra field)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rawBody: "긴 raw 본문" }, meta),
    ).rejects.toThrow();
  });

  // 구 vestigial mode field(T-0334 제거, ADR-0038 §Decision1 amendment) — 제공 시
  // 더 이상 @IsIn 검증이 아니라 **정의 외 필드**로 forbidNonWhitelisted 가 400 거부
  // (구 @IsIn 거부 테스트의 대체). 구 허용 literal 포함 어떤 값이든 거부 — 예외 분기마다
  // cover(단일 negative 금지).
  it.each(["fill", "reeval", "reevaluate"])(
    "제거된 mode field 에 '%s' 제공 시 ValidationPipe 가 정의 외 필드로 거부한다 (negative — vestigial mode 거부)",
    async (modeValue) => {
      const pipe = makePipe();
      await expect(
        pipe.transform({ ...validPayload, mode: modeValue }, meta),
      ).rejects.toThrow();
    },
  );
});

// -----------------------------------------------------------------------
// RBAC metadata 단언 — period() 핸들러에 @Roles("User") + @UseGuards(JwtAuthGuard,
// RolesGuard) 부착 검증(User+ escalation gate). guard 실행 401/403 live 검증은 e2e
// slice 책임(본 task Out of Scope).
// -----------------------------------------------------------------------
describe("AssessmentEvaluationController.period (RBAC / guard metadata)", () => {
  const reflector = new Reflector();

  it("period 핸들러에 @Roles('User') metadata 부착 (User+ tier gate)", () => {
    const roles = reflector.get<string[]>(
      ROLES_METADATA_KEY,
      AssessmentEvaluationController.prototype.period,
    );
    expect(roles).toEqual(["User"]);
  });

  it("period 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증 + RBAC gate)", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      AssessmentEvaluationController.prototype.period,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });
});

// =======================================================================
// POST /api/assessment-evaluation/unevaluated-fill-plan — 미평가 fill plan
// (T-0547, PLAN.md P5 bullet 106 / R-64 / REQ-037 / REQ-038). thin delegate:
// 요청 DTO → request mapper(string→Date) → planner → response mapper(Date→ISO).
// R-112 4 종(happy / error path / branch / negative) + RBAC metadata 단언.
// =======================================================================
describe("AssessmentEvaluationController.planUnevaluatedFill (unit — request mapper → planner → response mapper delegation)", () => {
  // happy: 유효 DTO 입력 시 planner 가 request mapper 산출 IntendedPeriodCoordinatesInput
  // (personIds/period/scope passthrough + rangeStart/rangeEnd Date 변환)으로 정확히
  // 호출되고, 반환 plan 이 response mapper 거쳐 응답 shape(periodStart string ISO)로 반환됨.
  it("유효 DTO 시 planner 를 mapper 산출 IntendedPeriodCoordinatesInput 으로 호출하고 응답 shape 를 반환한다 (happy)", async () => {
    const { controller, plannerSpy } = makeFillController(async () =>
      makeTwoBatchFillPlan(),
    );

    const dto = makeFillDto();
    const result = await controller.planUnevaluatedFill(dto);

    // planner 위임 — request mapper 산출 IntendedPeriodCoordinatesInput 1 회.
    // personIds/period/scope 는 passthrough(personIds 는 새 배열로 복사), rangeStart/
    // rangeEnd 는 parseKstPeriodInput 경유 Date 변환(offset 명시 `...Z` 는 그대로 해석).
    expect(plannerSpy).toHaveBeenCalledTimes(1);
    const passed = plannerSpy.mock
      .calls[0][0] as IntendedPeriodCoordinatesInput;
    expect(passed.personIds).toEqual(["person-1", "person-2"]);
    expect(passed.period).toBe("week");
    expect(passed.scope).toBe("commit");
    expect(passed.rangeStart).toBeInstanceOf(Date);
    expect(passed.rangeStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(passed.rangeEnd).toBeInstanceOf(Date);
    expect(passed.rangeEnd.toISOString()).toBe("2026-06-30T00:00:00.000Z");

    // 응답 shape — response mapper 가 periodStart 를 offset-명시 ISO string 으로 직렬화.
    expect(result.personCount).toBe(2);
    expect(result.totalGapCount).toBe(3);
    expect(result.batches).toHaveLength(2);
    expect(result.batches[0].personId).toBe("person-1");
    expect(result.batches[0].periods).toHaveLength(2);
    expect(typeof result.batches[0].periods[0].periodStart).toBe("string");
    expect(result.batches[0].periods[0].periodStart).toBe(
      "2026-06-01T00:00:00+09:00",
    );
    expect(result.batches[0].periods[1].periodStart).toBe(
      "2026-06-08T00:00:00+09:00",
    );
    expect(result.batches[1].personId).toBe("person-2");
  });

  // error path (a): planner reject(예: reader 의존성 실패) → controller 가 raw 전파(swallow 0).
  it("planner reject 시 controller 가 error 를 raw 전파한다 (error path — planner reject)", async () => {
    const rawError = new Error("readForPersons failed: DB connection lost");
    const { controller } = makeFillController(async () => {
      throw rawError;
    });

    await expect(controller.planUnevaluatedFill(makeFillDto())).rejects.toBe(
      rawError,
    );
  });

  // error path (b): request mapper 가 던지는 경로 — rangeStart 가 형식 위반(@IsISO8601
  // 우회 가정한 edge)이면 parseKstPeriodInput 의 RangeError 가 전파되고 planner 미호출.
  it("rangeStart 형식 위반 시 request mapper RangeError 전파 + planner 미호출 (error path — request mapper)", async () => {
    const { controller, plannerSpy } = makeFillController(async () =>
      makeEmptyFillPlan(),
    );

    await expect(
      controller.planUnevaluatedFill(
        makeFillDto({ rangeStart: "not-a-real-date" }),
      ),
    ).rejects.toThrow(RangeError);
    // mapper 가 throw 하면 planner 위임 단계 도달 0.
    expect(plannerSpy).not.toHaveBeenCalled();
  });

  // error path (b'): rangeEnd 비-string(type mismatch) → parseKstPeriodInput TypeError 전파.
  it("rangeEnd 가 비-string 이면 request mapper TypeError 전파 + planner 미호출 (negative — type mismatch)", async () => {
    const { controller, plannerSpy } = makeFillController(async () =>
      makeEmptyFillPlan(),
    );

    await expect(
      controller.planUnevaluatedFill(
        makeFillDto({ rangeEnd: 12345 as unknown as string }),
      ),
    ).rejects.toThrow(TypeError);
    expect(plannerSpy).not.toHaveBeenCalled();
  });

  // flow / branch (a): personIds 빈 배열 DTO → mapper/planner 경유 빈 plan → 빈 batches 응답.
  // 빈 배열은 정책상 허용(빈 plan 의 자연스러운 흐름) — silent 비정상 진행 아님(도메인 결정성).
  it("personIds 빈 배열 DTO 는 빈 plan 을 빈 batches 응답으로 반환한다 (branch — 빈 personIds → 빈 응답)", async () => {
    const { controller, plannerSpy } = makeFillController(async () =>
      makeEmptyFillPlan(),
    );

    const result = await controller.planUnevaluatedFill(
      makeFillDto({ personIds: [] }),
    );

    // mapper 가 빈 personIds 를 빈 배열로 전사해 planner 에 forward.
    expect(plannerSpy).toHaveBeenCalledTimes(1);
    const passed = plannerSpy.mock
      .calls[0][0] as IntendedPeriodCoordinatesInput;
    expect(passed.personIds).toEqual([]);
    // 빈 plan → 빈 응답.
    expect(result.batches).toEqual([]);
    expect(result.totalGapCount).toBe(0);
    expect(result.personCount).toBe(0);
  });

  // flow / branch (b): batches 2+ 묶음 정상 plan → 응답에 person 묶음 순서 / 좌표 순서 보존.
  it("batches 2+ 묶음 plan 의 person 묶음 순서 / 좌표 순서를 응답에서 보존한다 (branch — 순서/좌표 보존)", async () => {
    const { controller } = makeFillController(async () =>
      makeTwoBatchFillPlan(),
    );

    const result = await controller.planUnevaluatedFill(makeFillDto());

    // person 묶음 순서 보존(person-1 → person-2).
    expect(result.batches.map((b) => b.personId)).toEqual([
      "person-1",
      "person-2",
    ]);
    // person-1 묶음 안의 좌표 순서 보존(periodStart 직렬화 순서).
    expect(result.batches[0].periods.map((p) => p.periodStart)).toEqual([
      "2026-06-01T00:00:00+09:00",
      "2026-06-08T00:00:00+09:00",
    ]);
  });

  // negative (thin delegate 비변형): controller 가 planner 반환 plan 을 재정렬 / 필터 없이
  // response mapper 에만 넘긴다 — planner 호출 인자 = request mapper 산출(가공 0)이고,
  // 응답의 좌표 묶음 수 / gap 수가 planner 반환 plan 과 1:1(controller 가공 0).
  it("controller 는 planner 반환 plan 을 재정렬/필터 없이 response mapper 에만 넘긴다 (negative — thin delegate 비변형)", async () => {
    const plan = makeTwoBatchFillPlan();
    const { controller, plannerSpy } = makeFillController(async () => plan);

    const result = await controller.planUnevaluatedFill(makeFillDto());

    // planner 는 정확히 1 회 호출되고, 인자는 mapper 산출 외 추가 가공 0.
    expect(plannerSpy).toHaveBeenCalledTimes(1);
    // 응답 batches 수 / gap 수 / person 수가 planner 반환 plan 과 1:1(controller 가공 0).
    expect(result.batches).toHaveLength(plan.batches.length);
    expect(result.totalGapCount).toBe(plan.totalGapCount);
    expect(result.personCount).toBe(plan.personCount);
  });

  // negative: 입력 dto.personIds 비변형 — request mapper 가 새 배열로 복사 전사하므로
  // controller 호출 후에도 원 dto.personIds 배열이 변형되지 않는다(도메인 helper 안전).
  it("입력 dto.personIds 를 변형하지 않는다 (negative — input immutability)", async () => {
    const { controller } = makeFillController(async () => makeEmptyFillPlan());
    const dto = makeFillDto({ personIds: ["a", "b"] });
    const snapshot = [...dto.personIds];

    await controller.planUnevaluatedFill(dto);

    expect(dto.personIds).toEqual(snapshot);
  });
});

// -----------------------------------------------------------------------
// UnevaluatedFillPlanRequestDto ValidationPipe negative cases — controller-scope
// pipe 와 동일 옵션으로 단위 검증(e2e 부재라 DTO decorator 검증). 필수 필드 누락 /
// wrong type / 비-ISO range / 정의 외 필드 6 종 — 예외 분기마다 cover(단일 negative 금지).
// -----------------------------------------------------------------------
describe("UnevaluatedFillPlanRequestDto (ValidationPipe negative cases)", () => {
  function makePipe(): ValidationPipe {
    return new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }

  const meta = {
    type: "body" as const,
    metatype: UnevaluatedFillPlanRequestDto,
    data: "",
  };

  const validPayload = {
    personIds: ["person-1", "person-2"],
    period: "week",
    scope: "commit",
    rangeStart: "2026-06-01T00:00:00.000Z",
    rangeEnd: "2026-06-30T00:00:00.000Z",
  };

  it("유효한 DTO 는 통과한다 (sanity — happy)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform({ ...validPayload }, meta);
    expect(transformed).toBeInstanceOf(UnevaluatedFillPlanRequestDto);
    expect(transformed.personIds).toEqual(["person-1", "person-2"]);
  });

  // 빈 personIds 는 형식상 허용(@ArrayNotEmpty 미적용 — 빈 배열 → 빈 plan 정책).
  it("personIds 빈 배열은 형식상 통과한다 (branch — 빈 배열 허용, 빈 plan 정책)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform(
      { ...validPayload, personIds: [] },
      meta,
    );
    expect(transformed.personIds).toEqual([]);
  });

  // 필수 필드 누락 → 거부.
  it.each(["period", "scope", "rangeStart", "rangeEnd"] as const)(
    "필수 필드 %s 누락 시 ValidationPipe 가 거부한다 (negative — required field missing)",
    async (field) => {
      const pipe = makePipe();
      const payload: Record<string, unknown> = { ...validPayload };
      delete payload[field];
      await expect(pipe.transform(payload, meta)).rejects.toThrow();
    },
  );

  // personIds 누락 → 거부(@IsArray).
  it("personIds 누락 시 ValidationPipe 가 거부한다 (negative — required array missing)", async () => {
    const pipe = makePipe();
    const payload: Record<string, unknown> = { ...validPayload };
    delete payload.personIds;
    await expect(pipe.transform(payload, meta)).rejects.toThrow();
  });

  // personIds 가 배열 아님 → 거부.
  it("personIds 가 배열이 아니면 ValidationPipe 가 거부한다 (negative — wrong type, not array)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, personIds: "person-1" }, meta),
    ).rejects.toThrow();
  });

  // personIds 원소가 string 아님 → 거부(@IsString({ each: true })).
  it("personIds 원소가 string 이 아니면 ValidationPipe 가 거부한다 (negative — element wrong type)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, personIds: [123] }, meta),
    ).rejects.toThrow();
  });

  // rangeStart 가 비-ISO → 거부(@IsISO8601).
  it("rangeStart 가 비-ISO 문자열이면 ValidationPipe 가 거부한다 (negative — @IsISO8601 rangeStart)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rangeStart: "2026-13-99" }, meta),
    ).rejects.toThrow();
  });

  // rangeEnd 가 비-ISO → 거부(@IsISO8601).
  it("rangeEnd 가 비-ISO 문자열이면 ValidationPipe 가 거부한다 (negative — @IsISO8601 rangeEnd)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rangeEnd: "not-iso" }, meta),
    ).rejects.toThrow();
  });

  // 정의 외 추가 필드 → 거부(forbidNonWhitelisted).
  it("정의되지 않은 추가 필드는 forbidNonWhitelisted 가 거부한다 (negative — extra field)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rawBody: "긴 raw 본문" }, meta),
    ).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------
// RBAC metadata 단언 — planUnevaluatedFill() 핸들러에 @Roles("Admin") +
// @UseGuards(JwtAuthGuard, RolesGuard) 부착 검증(evaluate route mirror — Admin+
// tier gate). guard 실행 401/403 live 검증은 e2e slice 책임(본 task Out of Scope).
// -----------------------------------------------------------------------
describe("AssessmentEvaluationController.planUnevaluatedFill (RBAC / guard metadata)", () => {
  const reflector = new Reflector();

  it("planUnevaluatedFill 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)", () => {
    const roles = reflector.get<string[]>(
      ROLES_METADATA_KEY,
      AssessmentEvaluationController.prototype.planUnevaluatedFill,
    );
    expect(roles).toEqual(["Admin"]);
  });

  it("planUnevaluatedFill 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증 + RBAC gate)", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      AssessmentEvaluationController.prototype.planUnevaluatedFill,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });
});

// =======================================================================
// T-0565 — POST /unevaluated-fill-run (run-side controller route) 검증.
// run-request DTO → orchestrator.run → UnevaluatedFillRunResult thin delegate.
// =======================================================================

// makeRunController — POST /unevaluated-fill-run 전용 controller 빌더. run
// orchestrator 를 jest mock 으로 주입하고(실 DB read 0 / 실 LLM 0 / 실 네트워크 0),
// 다른 경로의 collaborator(orchestrator / persist / ephemeral / admin / person /
// planner)는 throw mock 으로 두어 runUnevaluatedFill() 가 실수로 호출하면 catch 한다.
// runSpy 로 위임 인자 / 횟수 / 반환 forward 검증을 enable 한다.
function makeRunController(
  runImpl: (...args: unknown[]) => Promise<UnevaluatedFillRunResult>,
  // resolveImpl — llmProviderConfigResolver.resolveDefaultModelId mock 구현. 기본은
  // 단일-row resolve 성공 path("resolved-default") 를 반환한다. 0-row/2+row/빈·non-
  // string fail-fast 시나리오는 reject 하는 impl 을 주입해 503 매핑 분기를 검증한다.
  resolveImpl: () => Promise<string> = async () => "resolved-default",
): {
  controller: AssessmentEvaluationController;
  runSpy: jest.Mock;
  resolveSpy: jest.Mock;
} {
  const runSpy = jest.fn(runImpl);
  const unevaluatedFillRunOrchestrator = {
    run: runSpy,
  } as unknown as UnevaluatedFillRunOrchestratorService;
  // llmProviderConfigResolver — default modelId 의 server-side source(ADR-0048 §Decision
  // 1·2). resolveSpy 로 호출 횟수 / 503 매핑 분기를 검증한다.
  const resolveSpy = jest.fn(resolveImpl);
  const llmProviderConfigResolver = {
    resolveDefaultModelId: resolveSpy,
  } as unknown as LlmProviderConfigResolver;
  // 다른 route 의 collaborator 는 run 경로 test 에서 호출되면 안 되므로 throw mock.
  const orchestrator = {
    evaluateActivities: jest.fn(() => {
      throw new Error(
        "runUnevaluatedFill() 는 orchestrator 를 호출하면 안 된다",
      );
    }),
  } as unknown as EvaluationOrchestratorService;
  const persistService = {
    persist: jest.fn(() => {
      throw new Error("runUnevaluatedFill() 는 persist 를 호출하면 안 된다");
    }),
  } as unknown as EvaluationResultPersistService;
  const ephemeralBridge = {
    generateEphemeral: jest.fn(() => {
      throw new Error(
        "runUnevaluatedFill() 는 ephemeralBridge 를 호출하면 안 된다",
      );
    }),
  } as unknown as PeriodBridgeEphemeralService;
  const adminBridge = {
    generateAndPersist: jest.fn(() => {
      throw new Error(
        "runUnevaluatedFill() 는 adminBridge 를 호출하면 안 된다",
      );
    }),
  } as unknown as PeriodBridgeAdminPersistService;
  const personService = {
    findByIdWithIdentities: jest.fn(() => {
      throw new Error(
        "runUnevaluatedFill() 는 personService 를 호출하면 안 된다",
      );
    }),
  } as unknown as PersonService;
  const unevaluatedFillPlanner = {
    planUnevaluatedFill: jest.fn(() => {
      throw new Error(
        "runUnevaluatedFill() 는 unevaluatedFillPlanner 를 호출하면 안 된다",
      );
    }),
  } as unknown as EvaluationUnevaluatedFillPlanner;
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      adminBridge,
      personService,
      unevaluatedFillPlanner,
      unevaluatedFillRunOrchestrator,
      llmProviderConfigResolver,
    ),
    runSpy,
    resolveSpy,
  };
}

// makeRunDto — UnevaluatedFillRunRequestDto fixture 빌더(유효 base — rawBridges 2 +
// modelId 지정 + defaultModelId 지정). overrides 로 각 축을 변형한다.
function makeRunDto(
  overrides: Partial<UnevaluatedFillRunRequestDto> = {},
): UnevaluatedFillRunRequestDto {
  return {
    rawBridges: [
      {
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-01T00:00:00.000Z",
      },
      {
        personId: "person-2",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-08T00:00:00.000Z",
      },
    ] as PeriodBridgeDto[],
    modelId: "gpt-4o-mini",
    defaultModelId: "gpt-4o",
    ...overrides,
  };
}

// makeRunResult — orchestrator.run 반환 UnevaluatedFillRunResult mock fixture(이미
// plain JSON-safe — periodStart ISO string, count 축 number). controller 가 가공 0 으로
// 그대로 반환하는 기준값.
function makeRunResult(
  overrides: Partial<UnevaluatedFillRunResult> = {},
): UnevaluatedFillRunResult {
  return {
    outcomes: [
      {
        personId: "person-1",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-01T00:00:00.000Z",
        status: "evaluated",
        evaluatedCount: 3,
      },
      {
        personId: "person-2",
        period: "week",
        scope: "commit",
        periodStart: "2026-06-08T00:00:00.000Z",
        status: "skipped",
      },
    ],
    totalCount: 2,
    evaluatedCount: 1,
    skippedCount: 1,
    failedCount: 0,
    totalEvaluatedRecords: 3,
    ...overrides,
  };
}

// makeEmptyRunResult — 빈 좌표(rawBridges 빈 배열) 시 service 가 반환하는 빈 outcomes
// 결과. 빈 입력 → 빈 outcomes 의 결정적 흐름(silent 비정상 진행 아님)을 검증.
function makeEmptyRunResult(): UnevaluatedFillRunResult {
  return {
    outcomes: [],
    totalCount: 0,
    evaluatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    totalEvaluatedRecords: 0,
  };
}

describe("AssessmentEvaluationController.runUnevaluatedFill (unit — DTO → resolver → orchestrator.run → result delegation)", () => {
  // happy: 유효 DTO(rawBridges 2 + modelId 지정) 입력 + resolver 단일-row resolve 성공 시,
  // orchestrator.run 이 (rawBridges, dto.modelId, **resolver 가 반환한** defaultModelId)
  // 3 인자로 정확히 호출되고, 반환 UnevaluatedFillRunResult 가 controller 반환과
  // deep-equal(가공 0). 3 번째 인자는 더 이상 dto.defaultModelId 가 아니라 resolver source.
  it("resolver 성공 시 orchestrator.run 을 (rawBridges, dto.modelId, resolved defaultModelId) 로 호출하고 결과를 그대로 반환한다 (happy)", async () => {
    const expected = makeRunResult();
    const { controller, runSpy, resolveSpy } = makeRunController(
      async () => expected,
    );

    const dto = makeRunDto();
    const result = await controller.runUnevaluatedFill(dto);

    // resolver — 정확히 1 회 호출(default modelId 의 server-side source).
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    // 위임 — 정확히 1 회. 3 번째 인자는 resolver 가 반환한 "resolved-default"(dto.
    // defaultModelId "gpt-4o" 아님 — source 가 resolver 로 이전).
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(
      dto.rawBridges,
      "gpt-4o-mini",
      "resolved-default",
    );
    // 반환 — service 결과 deep-equal(controller 가공 0).
    expect(result).toEqual(expected);
    // 동일 참조 forward(재정렬/복사 0 — thin delegate).
    expect(result).toBe(expected);
  });

  // negative: dto.defaultModelId 는 더 이상 source 가 아니다 — dto 가 다른 값을 보내도
  // orchestrator 에는 resolver 가 반환한 값만 forward 된다(server-side 권위 source 박제).
  it("dto.defaultModelId 값과 무관하게 resolver 반환값을 forward 한다 (negative — dto.defaultModelId source 아님)", async () => {
    const { controller, runSpy } = makeRunController(async () =>
      makeRunResult(),
    );

    const dto = makeRunDto({ defaultModelId: "dto-가-보낸-무시될-값" });
    await controller.runUnevaluatedFill(dto);

    expect(runSpy).toHaveBeenCalledWith(
      dto.rawBridges,
      "gpt-4o-mini",
      "resolved-default",
    );
  });

  // error path (resolver 0-row): resolver 가 row 0 throw 시 controller 가 503
  // ServiceUnavailableException 으로 매핑하고 orchestrator.run 을 호출하지 않는다(평가 사슬
  // 미진입). resolver 의 한국어 메시지가 503 응답에 보존된다.
  it("resolver 0-row throw 시 503(ServiceUnavailableException)으로 매핑하고 orchestrator 를 호출하지 않는다 (negative — 0-row → 503)", async () => {
    const { controller, runSpy, resolveSpy } = makeRunController(
      async () => makeRunResult(),
      async () => {
        throw new Error(
          "LlmProviderConfigResolver: LLM provider 가 설정되지 않았다 (row 0).",
        );
      },
    );

    await expect(
      controller.runUnevaluatedFill(makeRunDto()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    // 평가 사슬 미진입 — resolver fail 시 비용 있는 orchestrator 호출 0.
    expect(runSpy).not.toHaveBeenCalled();
  });

  // error path (resolver 2+row): resolver 가 다중-row throw 시 동일하게 503 + orchestrator
  // 미호출. 한국어 메시지가 503 message 에 보존되는지도 검증(진단성).
  it("resolver 2+row throw 시 503 으로 매핑하고 한국어 메시지를 보존한다 (negative — 2+row → 503)", async () => {
    const koMessage =
      "LlmProviderConfigResolver: LlmProviderConfig 다중-row 운용 (row 수=2, 후속 ADR 필요).";
    const { controller, runSpy } = makeRunController(
      async () => makeRunResult(),
      async () => {
        throw new Error(koMessage);
      },
    );

    await expect(
      controller.runUnevaluatedFill(makeRunDto()),
    ).rejects.toMatchObject({
      message: koMessage,
    });
    expect(runSpy).not.toHaveBeenCalled();
  });

  // error path (resolver 빈/non-string TypeError): resolver 가 형식 위반 TypeError throw
  // 시에도 동일하게 503 매핑(Error/TypeError 구분 없이 fail-fast → 일시적 서비스 불가).
  it("resolver 가 빈/non-string modelId TypeError throw 시 503 으로 매핑한다 (negative — type mismatch → 503)", async () => {
    const { controller, runSpy } = makeRunController(
      async () => makeRunResult(),
      async () => {
        throw new TypeError(
          "LlmProviderConfigResolver: LlmProviderConfig.modelId 가 비어있다.",
        );
      },
    );

    await expect(
      controller.runUnevaluatedFill(makeRunDto()),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(runSpy).not.toHaveBeenCalled();
  });

  // error path (resolver non-Error reject): resolver 가 Error 인스턴스가 아닌 값(문자열
  // 등)으로 reject 하는 비정상 시퀀스에서도 controller 의 catch 가 503 으로 매핑한다.
  // 이때 `error instanceof Error` 가 false 인 else 분기가 동작해 한국어 fallback 메시지
  // ("LLM provider 설정을 해석할 수 없다 ...")를 503 응답에 담는다(메시지 추출 불가 시의
  // 진단성 보존). orchestrator 미호출 — resolver fail 시 평가 사슬 미진입.
  it("resolver 가 non-Error 값으로 reject 시 503 + 한국어 fallback 메시지로 매핑한다 (negative — non-Error reject → 503 fallback)", async () => {
    const { controller, runSpy, resolveSpy } = makeRunController(
      async () => makeRunResult(),
      // class-validator/promise 가 string reason 등 non-Error 로 reject 하는 비정상 경로.
      () => Promise.reject("문자열 reason — Error 인스턴스 아님"),
    );

    await expect(
      controller.runUnevaluatedFill(makeRunDto()),
    ).rejects.toMatchObject({
      message:
        "LLM provider 설정을 해석할 수 없다 (default modelId source 미박제).",
    });
    expect(resolveSpy).toHaveBeenCalledTimes(1);
    // 평가 사슬 미진입 — resolver fail 시 비용 있는 orchestrator 호출 0.
    expect(runSpy).not.toHaveBeenCalled();
  });

  // error path (orchestrator reject): resolver 성공 뒤 orchestrator.run reject(core 의
  // options 무효 TypeError 등) → controller 가 raw 전파(swallow 0). resolver fail 의 503
  // 매핑과 구분 — 이건 503 으로 wrapping 되지 않고 원본 error 가 그대로 전파된다.
  it("resolver 성공 후 orchestrator.run reject 시 raw 전파한다 (negative — orchestrator reject 는 503 아님)", async () => {
    const rawError = new TypeError("options 무효: modelId 가 비어있다");
    const { controller, resolveSpy } = makeRunController(async () => {
      throw rawError;
    });

    await expect(controller.runUnevaluatedFill(makeRunDto())).rejects.toBe(
      rawError,
    );
    // resolver 는 성공했음(orchestrator 진입 전 fail 아님).
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  // flow / branch (modelId 미지정): modelId 미지정(undefined) 시에도 orchestrator 가 정확히
  // (rawBridges, undefined, resolved default) 로 호출됨(controller 가 임의 default 채워
  // 넣지 않음 — override 축은 dto.modelId, default 축은 resolver).
  it("modelId 미지정 시 orchestrator.run 을 (rawBridges, undefined, resolved default) 로 호출한다 (branch — modelId override 미지정)", async () => {
    const { controller, runSpy } = makeRunController(async () =>
      makeRunResult(),
    );

    const dto = makeRunDto({ modelId: undefined });
    await controller.runUnevaluatedFill(dto);

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(
      dto.rawBridges,
      undefined,
      "resolved-default",
    );
  });

  // flow / branch (modelId 지정): 지정 modelId override 분기는 resolved default 와 무관하게
  // 그대로 forward 된다(두 축의 독립성).
  it("modelId 지정 분기는 지정 modelId override 를 forward 한다 (branch — modelId 지정)", async () => {
    const { controller, runSpy } = makeRunController(async () =>
      makeRunResult(),
    );

    await controller.runUnevaluatedFill(
      makeRunDto({ modelId: "custom-model" }),
    );

    expect(runSpy).toHaveBeenCalledWith(
      expect.any(Array),
      "custom-model",
      "resolved-default",
    );
  });

  // flow / branch (빈 입력): rawBridges 빈 배열 DTO → resolver 성공 후 orchestrator 호출 +
  // service 가 반환한 빈 outcomes 결과를 그대로 응답(빈 입력 → 빈 outcomes 의 결정적 흐름).
  it("rawBridges 빈 배열 DTO 는 빈 outcomes 결과를 그대로 응답한다 (branch — 빈 입력 → 빈 outcomes)", async () => {
    const { controller, runSpy } = makeRunController(async () =>
      makeEmptyRunResult(),
    );

    const result = await controller.runUnevaluatedFill(
      makeRunDto({ rawBridges: [] }),
    );

    // 빈 배열도 그대로 forward(controller 가 빈 입력을 거부하지 않음 — 도메인 결정성).
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith([], "gpt-4o-mini", "resolved-default");
    expect(result.outcomes).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  // negative (thin delegate 비변형): controller 가 service 반환 result 를 재정렬 / 필터 /
  // 직렬화 변환 없이 그대로 반환 — outcome 수 / 4 count 축이 service 반환과 1:1(controller
  // 가공 0).
  it("controller 는 service 반환 result 를 재정렬/필터/변환 없이 그대로 반환한다 (negative — thin delegate 비변형)", async () => {
    const expected = makeRunResult();
    const { controller, runSpy } = makeRunController(async () => expected);

    const result = await controller.runUnevaluatedFill(makeRunDto());

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(result.outcomes).toHaveLength(expected.outcomes.length);
    expect(result.totalCount).toBe(expected.totalCount);
    expect(result.evaluatedCount).toBe(expected.evaluatedCount);
    expect(result.skippedCount).toBe(expected.skippedCount);
    expect(result.failedCount).toBe(expected.failedCount);
    expect(result.totalEvaluatedRecords).toBe(expected.totalEvaluatedRecords);
    // outcome 순서 보존(person-1 evaluated → person-2 skipped).
    expect(result.outcomes.map((o) => o.status)).toEqual([
      "evaluated",
      "skipped",
    ]);
  });

  // negative: modelId null 도 override 축으로 그대로 forward — service 가 빈 값으로 취급해
  // resolved default fallback(controller 는 정규화 0). default 축은 여전히 resolver source.
  it("modelId 가 null 이면 null override 를 그대로 forward 한다 (negative — null override pass-through)", async () => {
    const { controller, runSpy } = makeRunController(async () =>
      makeRunResult(),
    );

    const dto = makeRunDto({ modelId: null as unknown as string });
    await controller.runUnevaluatedFill(dto);

    expect(runSpy).toHaveBeenCalledWith(
      dto.rawBridges,
      null,
      "resolved-default",
    );
  });
});

// -----------------------------------------------------------------------
// UnevaluatedFillRunRequestDto ValidationPipe negative cases — controller-scope
// pipe 와 동일 옵션으로 단위 검증(e2e 부재라 DTO decorator 검증). 필수 필드 누락 /
// non-array / nested PeriodBridgeDto 위반 / modelId 빈 문자열 / defaultModelId 누락 /
// 정의 외 필드 — 예외 분기마다 cover(단일 negative 금지).
// -----------------------------------------------------------------------
describe("UnevaluatedFillRunRequestDto (ValidationPipe negative cases)", () => {
  function makePipe(): ValidationPipe {
    return new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
  }

  const meta = {
    type: "body" as const,
    metatype: UnevaluatedFillRunRequestDto,
    data: "",
  };

  const validBridge = {
    personId: "person-1",
    period: "week",
    scope: "commit",
    periodStart: "2026-06-01T00:00:00.000Z",
  };

  const validPayload = {
    rawBridges: [validBridge],
    modelId: "gpt-4o-mini",
    defaultModelId: "gpt-4o",
  };

  it("유효한 DTO 는 통과하고 nested rawBridges 가 PeriodBridgeDto 로 transform 된다 (sanity — happy)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform({ ...validPayload }, meta);
    expect(transformed).toBeInstanceOf(UnevaluatedFillRunRequestDto);
    expect(transformed.rawBridges).toHaveLength(1);
    expect(transformed.rawBridges[0]).toBeInstanceOf(PeriodBridgeDto);
    expect(transformed.defaultModelId).toBe("gpt-4o");
  });

  // modelId 미지정도 통과(@IsOptional — fallback 대상).
  it("modelId 미지정 시 통과한다 (branch — modelId 선택)", async () => {
    const pipe = makePipe();
    const payload: Record<string, unknown> = { ...validPayload };
    delete payload.modelId;
    const transformed = await pipe.transform(payload, meta);
    expect(transformed.modelId).toBeUndefined();
    expect(transformed.defaultModelId).toBe("gpt-4o");
  });

  // 빈 rawBridges 는 형식상 허용(@ArrayNotEmpty 미적용 — 빈 배열 → 빈 outcomes 정책).
  it("rawBridges 빈 배열은 형식상 통과한다 (branch — 빈 배열 허용, 빈 outcomes 정책)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform(
      { ...validPayload, rawBridges: [] },
      meta,
    );
    expect(transformed.rawBridges).toEqual([]);
  });

  // rawBridges 누락 → 거부(@IsArray).
  it("rawBridges 누락 시 ValidationPipe 가 거부한다 (negative — required array missing)", async () => {
    const pipe = makePipe();
    const payload: Record<string, unknown> = { ...validPayload };
    delete payload.rawBridges;
    await expect(pipe.transform(payload, meta)).rejects.toThrow();
  });

  // rawBridges 가 배열 아님 → 거부.
  it("rawBridges 가 배열이 아니면 ValidationPipe 가 거부한다 (negative — wrong type, not array)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rawBridges: validBridge }, meta),
    ).rejects.toThrow();
  });

  // nested PeriodBridgeDto 위반(원소의 필수 personId 누락) → 거부(@ValidateNested).
  it("rawBridges 원소가 PeriodBridgeDto 위반(personId 누락)이면 거부한다 (negative — nested validation)", async () => {
    const pipe = makePipe();
    const badBridge = { ...validBridge };
    delete (badBridge as Record<string, unknown>).personId;
    await expect(
      pipe.transform({ ...validPayload, rawBridges: [badBridge] }, meta),
    ).rejects.toThrow();
  });

  // nested PeriodBridgeDto 위반(periodStart 비-ISO) → 거부(@IsISO8601 재귀).
  it("rawBridges 원소의 periodStart 가 비-ISO 면 거부한다 (negative — nested @IsISO8601)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform(
        {
          ...validPayload,
          rawBridges: [{ ...validBridge, periodStart: "2026-13-99" }],
        },
        meta,
      ),
    ).rejects.toThrow();
  });

  // modelId 빈 문자열 → 거부(@IsNotEmpty, 제공 시).
  it("modelId 가 빈 문자열이면 거부한다 (negative — @IsNotEmpty modelId)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, modelId: "" }, meta),
    ).rejects.toThrow();
  });

  // defaultModelId 누락 → 거부(필수).
  it("defaultModelId 누락 시 거부한다 (negative — required field missing)", async () => {
    const pipe = makePipe();
    const payload: Record<string, unknown> = { ...validPayload };
    delete payload.defaultModelId;
    await expect(pipe.transform(payload, meta)).rejects.toThrow();
  });

  // defaultModelId 빈 문자열 → 거부(@IsNotEmpty).
  it("defaultModelId 가 빈 문자열이면 거부한다 (negative — @IsNotEmpty defaultModelId)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, defaultModelId: "" }, meta),
    ).rejects.toThrow();
  });

  // 정의 외 추가 필드 → 거부(forbidNonWhitelisted).
  it("정의되지 않은 추가 필드는 forbidNonWhitelisted 가 거부한다 (negative — extra field)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, rawBody: "긴 raw 본문" }, meta),
    ).rejects.toThrow();
  });
});

// -----------------------------------------------------------------------
// RBAC / HttpCode metadata 단언 — runUnevaluatedFill() 핸들러에 @Roles("Admin") +
// @UseGuards(JwtAuthGuard, RolesGuard) + @HttpCode(200) 부착 검증(evaluate / plan
// route mirror — Admin+ tier gate). guard 실행 401/403 live 검증은 e2e slice 책임.
// -----------------------------------------------------------------------
describe("AssessmentEvaluationController.runUnevaluatedFill (RBAC / HttpCode metadata)", () => {
  const reflector = new Reflector();

  it("runUnevaluatedFill 핸들러에 @Roles('Admin') metadata 부착 (Admin+ tier gate)", () => {
    const roles = reflector.get<string[]>(
      ROLES_METADATA_KEY,
      AssessmentEvaluationController.prototype.runUnevaluatedFill,
    );
    expect(roles).toEqual(["Admin"]);
  });

  it("runUnevaluatedFill 핸들러에 @UseGuards(JwtAuthGuard, RolesGuard) 부착 (인증 + RBAC gate)", () => {
    const guards = Reflect.getMetadata(
      "__guards__",
      AssessmentEvaluationController.prototype.runUnevaluatedFill,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it("runUnevaluatedFill 핸들러에 @HttpCode(200) 부착 (실 실행 진입, 200 OK)", () => {
    const httpCode = Reflect.getMetadata(
      "__httpCode__",
      AssessmentEvaluationController.prototype.runUnevaluatedFill,
    ) as number;
    expect(httpCode).toBe(200);
  });
});
