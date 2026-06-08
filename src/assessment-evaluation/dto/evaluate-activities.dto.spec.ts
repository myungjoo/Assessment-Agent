// EvaluateActivitiesDto / ActivityItemDto spec — CI scripts/check-spec-presence.sh
// 가 신규 production .ts 에 동반 spec 의무 강제. class-validator decorator 동작을
// isolated 하게 검증 — controller-scope ValidationPipe 통합 검증은 controller spec
// (assessment-evaluation.controller.spec.ts) 가 별도 cover. ADR-0032 §5 test posture
// (R-112 — happy / error / branch / negative 충분 cover). collect-trigger.dto.spec.ts
// (T-0274) 패턴 1:1 mirror — plainToInstance + validate 직접 호출, ValidationPipe 미경유.
//
// 본 spec 의 cover scope:
//   - EvaluateActivitiesDto: modelId (string + non-empty), activities (배열 + 최소 1 + nested).
//   - ActivityItemDto: 6 필수 base 필드 (externalId, sourceType, instanceKey, author,
//     timestamp, metadata) + 4 optional source-별 필드 (repoRef, kind, spaceRef, version).
//   - @ArrayMinSize(1) 경계값 (0 → reject, 1 → pass).
//   - @IsObject metadata — scalar / null 거부, 객체 통과.
//   - whitelistValidation (forbidNonWhitelisted) — 정의 외 필드 거부.
import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate, type ValidatorOptions } from "class-validator";

import {
  ActivityItemDto,
  EvaluateActivitiesDto,
} from "./evaluate-activities.dto";

// 유효한 GitHub activity payload — ActivityBase + GithubActivity-only 필드. 모든
// happy-path 의 base. 개별 negative 는 이 base 에서 한 field 만 변형.
const validGithubActivity = {
  externalId: "abc123",
  sourceType: "github",
  instanceKey: "com",
  author: "octocat",
  timestamp: "2026-06-01T00:00:00.000Z",
  metadata: { changedFiles: 3 },
  repoRef: "octo-org/octo-repo",
  kind: "commit",
};

// 유효한 Confluence activity payload — base 6 필드 + spaceRef + version.
const validConfluenceActivity = {
  externalId: "page-42",
  sourceType: "confluence",
  instanceKey: "wiki-eng",
  author: "alice",
  timestamp: "2026-06-02T00:00:00.000Z",
  metadata: { titleLength: 12 },
  spaceRef: "ENG",
  version: 3,
};

const validEvaluatePayload = {
  modelId: "gpt-4o-mini",
  activities: [validGithubActivity],
};

// helper — plain 객체 → EvaluateActivitiesDto instance 변환 후 nested 포함 validate.
// constraint key 평면 목록(자기 / nested) 반환.
async function validateEvaluatePlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(EvaluateActivitiesDto, payload);
  const errors = await validate(dto, options);
  // top-level constraint + nested children constraint 모두 평탄화.
  const flat: string[] = [];
  const walk = (errs: typeof errors): void => {
    for (const e of errs) {
      if (e.constraints) flat.push(...Object.keys(e.constraints));
      if (e.children && e.children.length > 0) walk(e.children);
    }
  };
  walk(errors);
  return flat;
}

// helper — plain 객체 → ActivityItemDto instance 변환 후 validate. nested 단독 검증용.
async function validateActivityPlain(
  payload: unknown,
  options?: ValidatorOptions,
): Promise<string[]> {
  const dto = plainToInstance(ActivityItemDto, payload);
  const errors = await validate(dto, options);
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe("EvaluateActivitiesDto", () => {
  // --------------------------------------------------------------------------
  // happy (R-112 #1): 정상 payload → errors 빈 배열.
  // --------------------------------------------------------------------------
  it("정상 payload(github activity 1 건)는 errors 빈 배열을 반환한다 (happy)", async () => {
    const errors = await validateEvaluatePlain(validEvaluatePayload);
    expect(errors).toEqual([]);
  });

  it("confluence activity 1 건도 errors 빈 배열을 반환한다 (happy — branch confluence)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "claude-haiku",
      activities: [validConfluenceActivity],
    });
    expect(errors).toEqual([]);
  });

  it("github + confluence 혼합 activities 도 errors 빈 배열을 반환한다 (happy — branch mixed)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [validGithubActivity, validConfluenceActivity],
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative (R-112 #2/#4): modelId 결함.
  // --------------------------------------------------------------------------
  it("modelId 누락 시 isNotEmpty / isString 위반 (negative — required field missing)", async () => {
    const errors = await validateEvaluatePlain({
      activities: [validGithubActivity],
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("modelId 빈 문자열 시 isNotEmpty 위반 (negative — empty string)", async () => {
    const errors = await validateEvaluatePlain({
      ...validEvaluatePayload,
      modelId: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("modelId 가 number 시 isString 위반 (negative — wrong type)", async () => {
    const errors = await validateEvaluatePlain({
      ...validEvaluatePayload,
      modelId: 123,
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // --------------------------------------------------------------------------
  // negative: activities 결함.
  // --------------------------------------------------------------------------
  it("activities 누락 시 isArray 위반 (negative — required array missing)", async () => {
    const errors = await validateEvaluatePlain({ modelId: "gpt-4o-mini" });
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  it("activities 가 string 시 isArray 위반 (negative — wrong type, not array)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: "not-an-array",
    });
    expect(errors).toEqual(expect.arrayContaining(["isArray"]));
  });

  // --------------------------------------------------------------------------
  // boundary (R-112 #3): @ArrayMinSize(1) — 0 거부 / 1 통과 / 2+ 통과.
  // --------------------------------------------------------------------------
  it("activities 빈 배열 시 arrayMinSize 위반 (negative — @ArrayMinSize(1) boundary 0)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [],
    });
    expect(errors).toEqual(expect.arrayContaining(["arrayMinSize"]));
  });

  it("activities 1 건은 통과한다 (boundary 1 — @ArrayMinSize 경계 통과)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [validGithubActivity],
    });
    expect(errors).toEqual([]);
  });

  it("activities 5 건도 통과한다 (boundary 다건)", async () => {
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [
        validGithubActivity,
        validGithubActivity,
        validConfluenceActivity,
        validConfluenceActivity,
        validGithubActivity,
      ],
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative: nested ActivityItemDto 위반이 평탄화돼 잡힘 — @ValidateNested 분기.
  // --------------------------------------------------------------------------
  it("nested activity 의 externalId 누락 시 nested 검증이 isNotEmpty 위반 (negative — nested required)", async () => {
    const broken: Record<string, unknown> = { ...validGithubActivity };
    delete broken.externalId;
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [broken],
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("nested activity 의 timestamp 가 number 시 isString 위반 (negative — nested wrong type)", async () => {
    const broken = { ...validGithubActivity, timestamp: 1717200000 };
    const errors = await validateEvaluatePlain({
      modelId: "gpt-4o-mini",
      activities: [broken],
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드 → whitelistValidation.
  // ValidationPipe 의 whitelist+forbidNonWhitelisted 동작을 spec 레벨에서 직접 검증.
  // --------------------------------------------------------------------------
  it("정의 외 필드(rawBody) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — extra field)", async () => {
    const errors = await validateEvaluatePlain(
      { ...validEvaluatePayload, rawBody: "긴 raw 본문" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });

  // --------------------------------------------------------------------------
  // DTO contract: 정의된 2 키만 선언됨(정의 외 키는 contract 일부 아님).
  // --------------------------------------------------------------------------
  it("DTO 는 modelId / activities 2 키만 contract 로 가진다", () => {
    const dto = plainToInstance(EvaluateActivitiesDto, validEvaluatePayload);
    expect(Object.keys(dto).sort()).toEqual(["activities", "modelId"]);
  });
});

describe("ActivityItemDto (nested DTO isolated)", () => {
  // --------------------------------------------------------------------------
  // happy: github / confluence 둘 다 통과.
  // --------------------------------------------------------------------------
  it("유효한 github activity 는 errors 빈 배열을 반환한다 (happy — github branch)", async () => {
    const errors = await validateActivityPlain(validGithubActivity);
    expect(errors).toEqual([]);
  });

  it("유효한 confluence activity 는 errors 빈 배열을 반환한다 (happy — confluence branch)", async () => {
    const errors = await validateActivityPlain(validConfluenceActivity);
    expect(errors).toEqual([]);
  });

  it("source-별 optional 필드 모두 미제공 (base 6 필드만)도 통과한다 (@IsOptional 분기)", async () => {
    const baseOnly = {
      externalId: "ext-1",
      sourceType: "github",
      instanceKey: "com",
      author: "octocat",
      timestamp: "2026-06-01T00:00:00.000Z",
      metadata: {},
    };
    const errors = await validateActivityPlain(baseOnly);
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative: 6 필수 base 필드 — 각 누락 1+.
  // --------------------------------------------------------------------------
  it.each([
    "externalId",
    "sourceType",
    "instanceKey",
    "author",
    "timestamp",
  ] as const)(
    "필수 필드 %s 누락 시 isNotEmpty 위반 (negative — required base field missing)",
    async (field) => {
      const broken: Record<string, unknown> = { ...validGithubActivity };
      delete broken[field];
      const errors = await validateActivityPlain(broken);
      expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
    },
  );

  // --------------------------------------------------------------------------
  // negative: 빈 문자열 — isNotEmpty 분기.
  // --------------------------------------------------------------------------
  it("externalId 빈 문자열 시 isNotEmpty 위반 (negative — empty string)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      externalId: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("sourceType 빈 문자열 시 isNotEmpty 위반 (negative — empty string)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      sourceType: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------------
  // negative: wrong type — isString 분기 (각 필드 1+).
  // --------------------------------------------------------------------------
  it("author 가 number 시 isString 위반 (negative — wrong type)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      author: 42,
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("instanceKey 가 object 시 isString 위반 (negative — wrong type)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      instanceKey: { nested: "value" },
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  // --------------------------------------------------------------------------
  // negative: metadata (@IsObject) — scalar / null 거부.
  // --------------------------------------------------------------------------
  it("metadata 가 string 시 isObject 위반 (negative — @IsObject scalar 거부)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      metadata: "not-an-object",
    });
    expect(errors).toEqual(expect.arrayContaining(["isObject"]));
  });

  it("metadata 가 number 시 isObject 위반 (negative — @IsObject scalar 거부)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      metadata: 123,
    });
    expect(errors).toEqual(expect.arrayContaining(["isObject"]));
  });

  it("metadata 누락 시 isObject 위반 (negative — required object missing)", async () => {
    const broken: Record<string, unknown> = { ...validGithubActivity };
    delete broken.metadata;
    const errors = await validateActivityPlain(broken);
    expect(errors).toEqual(expect.arrayContaining(["isObject"]));
  });

  it("metadata 가 빈 객체여도 통과한다 (boundary — @IsObject 는 shape 미검사)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      metadata: {},
    });
    expect(errors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // negative: optional source-별 필드 type mismatch.
  // --------------------------------------------------------------------------
  it("repoRef 가 number 시 isString 위반 (negative — optional wrong type)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      repoRef: 42,
    });
    expect(errors).toEqual(expect.arrayContaining(["isString"]));
  });

  it("kind 가 빈 문자열 시 isNotEmpty 위반 (negative — optional but provided empty)", async () => {
    const errors = await validateActivityPlain({
      ...validGithubActivity,
      kind: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  it("spaceRef 가 빈 문자열 시 isNotEmpty 위반 (negative — optional but provided empty)", async () => {
    const errors = await validateActivityPlain({
      ...validConfluenceActivity,
      spaceRef: "",
    });
    expect(errors).toEqual(expect.arrayContaining(["isNotEmpty"]));
  });

  // --------------------------------------------------------------------------
  // negative (forbidNonWhitelisted): 정의 외 필드.
  // --------------------------------------------------------------------------
  it("정의 외 필드(rawBody) 는 forbidNonWhitelisted 로 whitelistValidation 위반 (negative — extra field)", async () => {
    const errors = await validateActivityPlain(
      { ...validGithubActivity, rawBody: "긴 raw 본문" },
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).toEqual(expect.arrayContaining(["whitelistValidation"]));
  });
});
