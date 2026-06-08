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
import { ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
import type { EvaluationResult } from "./domain/evaluation-result";
import {
  EvaluateActivitiesDto,
  ActivityItemDto,
} from "./dto/evaluate-activities.dto";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";

// makeController — orchestrator mock 주입 헬퍼. evaluateActivities 의 jest.fn 을 함께
// 반환해 호출 인자 / 횟수 / 반환 forward 검증을 enable.
function makeController(
  evaluateImpl: (...args: unknown[]) => Promise<EvaluationResult[]>,
): {
  controller: AssessmentEvaluationController;
  evaluateSpy: jest.Mock;
} {
  const evaluateSpy = jest.fn(evaluateImpl);
  const orchestrator = {
    evaluateActivities: evaluateSpy,
  } as unknown as EvaluationOrchestratorService;
  return {
    controller: new AssessmentEvaluationController(orchestrator),
    evaluateSpy,
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

describe("AssessmentEvaluationController (unit — delegation)", () => {
  // happy: 유효한 DTO 입력 시 orchestrator.evaluateActivities 가 정확히 1 회 호출되고
  // 반환이 그대로 forward.
  it("evaluate() 가 orchestrator.evaluateActivities 에 위임하고 반환을 그대로 forward 한다 (happy)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, evaluateSpy } = makeController(async () => expected);

    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [githubActivity as unknown as ActivityItemDto],
    };

    const result = await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledWith(dto.activities, {
      modelId: "gpt-4o-mini",
    });
    expect(result).toBe(expected);
  });

  // 위임 검증: controller 가 orchestrator 반환을 가공하지 않고 그대로 통과시킴.
  it("orchestrator 반환을 가공하지 않고 그대로 forward 한다 (delegation purity)", async () => {
    const expected = [
      makeEvaluationResult("github:com:abc123"),
      makeEvaluationResult("confluence:wiki-eng:page-42"),
    ];
    const { controller } = makeController(async () => expected);
    const dto: EvaluateActivitiesDto = {
      modelId: "claude-haiku",
      activities: [
        githubActivity as unknown as ActivityItemDto,
        confluenceActivity as unknown as ActivityItemDto,
      ],
    };

    const result = await controller.evaluate(dto);

    // 동일 reference — 객체 복사 0, 배열 reordering 0.
    expect(result).toBe(expected);
    expect(result.length).toBe(2);
    expect(result[0].unitId).toBe("github:com:abc123");
    expect(result[1].unitId).toBe("confluence:wiki-eng:page-42");
  });

  // error path: orchestrator reject 시 controller 가 swallow 하지 않고 그대로 전파.
  it("orchestrator.evaluateActivities reject 시 error 를 그대로 전파한다 (error path, swallow 0)", async () => {
    const rawError = new Error("scoreUnit failed: model timeout");
    const { controller } = makeController(async () => {
      throw rawError;
    });
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [githubActivity as unknown as ActivityItemDto],
    };

    await expect(controller.evaluate(dto)).rejects.toBe(rawError);
  });

  // branch — github only input.
  it("github activity 만 입력 시 orchestrator 에 그대로 forward 한다 (branch — github only)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, evaluateSpy } = makeController(async () => expected);
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [githubActivity as unknown as ActivityItemDto],
    };

    await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledWith([githubActivity], {
      modelId: "gpt-4o-mini",
    });
  });

  // branch — confluence only input.
  it("confluence activity 만 입력 시 orchestrator 에 그대로 forward 한다 (branch — confluence only)", async () => {
    const expected = [makeEvaluationResult("confluence:wiki-eng:page-42")];
    const { controller, evaluateSpy } = makeController(async () => expected);
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [confluenceActivity as unknown as ActivityItemDto],
    };

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
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [
        githubActivity as unknown as ActivityItemDto,
        confluenceActivity as unknown as ActivityItemDto,
      ],
    };

    await controller.evaluate(dto);

    expect(evaluateSpy).toHaveBeenCalledWith(
      [githubActivity, confluenceActivity],
      { modelId: "gpt-4o-mini" },
    );
  });

  // branch — orchestrator 가 빈 결과 반환 시 controller 도 빈 배열 forward.
  it("orchestrator 가 빈 EvaluationResult[] 반환 시 controller 도 빈 배열을 forward 한다 (branch — empty result)", async () => {
    const empty: EvaluationResult[] = [];
    const { controller } = makeController(async () => empty);
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [githubActivity as unknown as ActivityItemDto],
    };

    const result = await controller.evaluate(dto);

    expect(result).toBe(empty);
    expect(result.length).toBe(0);
  });

  // determinism: 동일 입력 + 동일 mock 응답 → 동일 응답 2 회.
  it("동일 입력 + 동일 mock 응답 → 2 회 호출도 동일 응답 (determinism)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller, evaluateSpy } = makeController(async () => expected);
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [githubActivity as unknown as ActivityItemDto],
    };

    const r1 = await controller.evaluate(dto);
    const r2 = await controller.evaluate(dto);

    expect(r1).toBe(expected);
    expect(r2).toBe(expected);
    expect(evaluateSpy).toHaveBeenCalledTimes(2);
  });

  // 입력 비변형: controller 가 dto 객체를 수정하지 않음.
  it("controller 는 입력 dto 의 modelId / activities 를 변형하지 않는다 (input immutability)", async () => {
    const expected = [makeEvaluationResult()];
    const { controller } = makeController(async () => expected);
    const dto: EvaluateActivitiesDto = {
      modelId: "gpt-4o-mini",
      activities: [{ ...githubActivity } as unknown as ActivityItemDto],
    };
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
  it("유효한 DTO 는 통과한다 (sanity — happy)", async () => {
    const pipe = makePipe();
    const transformed = await pipe.transform(
      {
        modelId: "gpt-4o-mini",
        activities: [{ ...githubActivity }],
      },
      meta,
    );
    expect(transformed).toBeInstanceOf(EvaluateActivitiesDto);
    expect(transformed.modelId).toBe("gpt-4o-mini");
    expect(transformed.activities[0]).toBeInstanceOf(ActivityItemDto);
  });

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
