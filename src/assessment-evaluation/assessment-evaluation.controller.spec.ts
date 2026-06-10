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
  ValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { PersonWithIdentities } from "../user/person.repository";
import type { PersonService } from "../user/person.service";

import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
import type { EvaluationResult } from "./domain/evaluation-result";
import {
  EvaluateActivitiesDto,
  ActivityItemDto,
} from "./dto/evaluate-activities.dto";
import { PeriodBridgeDto } from "./dto/period-bridge.dto";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import {
  EvaluationResultPersistService,
  type PersistResult,
} from "./evaluation-result-persist.service";
import type { PeriodBridgeEphemeralService } from "./period-bridge-ephemeral.service";

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
  const personService = {
    findByIdWithIdentities: jest.fn(() => {
      throw new Error("evaluate() 는 personService 를 호출하면 안 된다");
    }),
  } as unknown as PersonService;
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      personService,
    ),
    evaluateSpy,
    persistSpy,
  };
}

// makePeriodController — POST /period 전용 controller 빌더. ephemeralBridge +
// personService 를 jest mock 으로 주입하고(실 LLM/DB/네트워크 0), evaluate 경로의
// orchestrator/persist 는 throw mock 으로 두어 period() 가 실수로 호출하면 catch 한다.
// generateSpy / findPersonSpy 를 함께 반환해 위임 인자/횟수 검증을 enable 한다.
function makePeriodController(opts: {
  generateImpl?: (...args: unknown[]) => Promise<EvaluationResult[]>;
  findPersonImpl?: (...args: unknown[]) => Promise<PersonWithIdentities>;
}): {
  controller: AssessmentEvaluationController;
  generateSpy: jest.Mock;
  findPersonSpy: jest.Mock;
} {
  const generateSpy = jest.fn(
    opts.generateImpl ?? (async () => [] as EvaluationResult[]),
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
  return {
    controller: new AssessmentEvaluationController(
      orchestrator,
      persistService,
      ephemeralBridge,
      personService,
    ),
    generateSpy,
    findPersonSpy,
  };
}

// makePeriodDto — PeriodBridgeDto fixture 빌더(self-only base: personId == 요청
// principal). overrides 로 personId / periodStart / mode 등을 변형한다.
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
    const { controller, generateSpy, findPersonSpy } = makePeriodController({
      generateImpl: async () => expected,
      findPersonImpl: async () =>
        ({
          id: "person-1",
          serviceIdentities: [{ service: "github", externalId: "octocat" }],
        }) as unknown as PersonWithIdentities,
    });

    const dto = makePeriodDto();
    const result = await controller.period(dto, "person-1");

    // person 변환은 dto.personId 로 1 회.
    expect(findPersonSpy).toHaveBeenCalledTimes(1);
    expect(findPersonSpy).toHaveBeenCalledWith("person-1");
    // generateEphemeral 위임 — resolved serviceIdentities + since(periodStart
    // pass-through) + modelId 미지정(undefined).
    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledWith(
      { serviceIdentities: [{ service: "github", externalId: "octocat" }] },
      { since: "2026-06-01T00:00:00.000Z" },
      { modelId: undefined },
    );
    // 반환은 generateEphemeral 결과 reference 그대로(가공 0 — persist 0).
    expect(result).toBe(expected);
  });

  // error path: self != personId(타인 personId) → 403, 위임/person resolve 미호출.
  it("self != personId(타인 personId) 시 403(ForbiddenException) + generateEphemeral / person resolve 미호출 (error path — self-only 위반)", async () => {
    const { controller, generateSpy, findPersonSpy } = makePeriodController({});

    // principal sub 은 "attacker", dto.personId 는 "person-1"(타인).
    await expect(
      controller.period(makePeriodDto({ personId: "person-1" }), "attacker"),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(generateSpy).not.toHaveBeenCalled();
    // self-only 차단은 person resolve 이전(이른 차단)이라 PersonService 도 미호출.
    expect(findPersonSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: principal sub undefined → fail-closed deny(403) + 위임 미호출.
  it("principal sub 이 undefined 면 403 deny(fail-closed) + generateEphemeral 미호출 (flow — principal 부재)", async () => {
    const { controller, generateSpy, findPersonSpy } = makePeriodController({});

    await expect(
      controller.period(makePeriodDto(), undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(findPersonSpy).not.toHaveBeenCalled();
  });

  // flow / 분기: principal sub null 도 fail-closed deny(방어 분기).
  it("principal sub 이 null 이어도 403 deny(fail-closed) (flow — principal null)", async () => {
    const { controller, generateSpy } = makePeriodController({});

    await expect(
      controller.period(makePeriodDto(), null as unknown as string | undefined),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(generateSpy).not.toHaveBeenCalled();
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

    await expect(controller.period(makePeriodDto(), "person-1")).rejects.toBe(
      notFound,
    );
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

    await expect(controller.period(makePeriodDto(), "person-1")).rejects.toBe(
      rawError,
    );
  });

  // branch: dto.mode 는 ephemeral 이므로 무시 — mode 가 있어도 위임/반환 불변.
  it("dto.mode 가 있어도 무시하고 정상 위임한다 (branch — mode ignored, persist 0)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, generateSpy } = makePeriodController({
      generateImpl: async () => expected,
    });

    const result = await controller.period(
      makePeriodDto({ mode: "reeval" }),
      "person-1",
    );

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(expected);
  });

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

    const result = await controller.period(makePeriodDto(), "person-1");

    expect(generateSpy).toHaveBeenCalledWith(
      { serviceIdentities: [] },
      { since: "2026-06-01T00:00:00.000Z" },
      { modelId: undefined },
    );
    expect(result).toBe(expected);
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

  // mode 허용 외 literal → 거부(@IsIn(["fill","reeval"])).
  it("mode 가 허용 외 literal('reevaluate') 이면 ValidationPipe 가 거부한다 (negative — @IsIn)", async () => {
    const pipe = makePipe();
    await expect(
      pipe.transform({ ...validPayload, mode: "reevaluate" }, meta),
    ).rejects.toThrow();
  });
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
