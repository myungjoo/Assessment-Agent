// UserModule spec — T-0034 acceptance C 보완 (CI scripts/check-spec-presence.sh
// 가 신규 production .ts 에 동반 spec 의무를 강제). PersonRepository + (T-0039)
// GroupRepository + PartRepository + (T-0046) PartService provider 가 module 안에서
// resolve 되고 export 되는지 검증.
//
// 본 spec 은 PersistenceModule (`@Global()`) 을 함께 imports 하여 PrismaService
// dep 를 만족시킨다. PrismaService 의 super() 부작용 (PrismaClient 생성 +
// adapter 구성) 은 jest.mock 으로 회피 — 각 repository 의 unit test 는 별도
// repository.spec.ts 가 책임이며, 본 spec 은 module compile + provider resolve +
// exports 등록 정합성만 검증.

// PrismaService 를 mock — PrismaClient extends 의 부작용 (adapter 생성 / connect)
// 을 회피. PersonRepository / GroupRepository / PartRepository /
// PersonGroupMembershipRepository 의 생성자 dep 으로 PrismaService 가 inject 되나,
// 본 spec 은 instance 동작이 아닌 module compile 만 검증.
// T-0039 — group / part delegate 추가. T-0049 — personGroupMembership delegate
// 추가 (PersonGroupMembershipRepository 가 inject 됨).
jest.mock("../persistence/prisma.service", () => ({
  PrismaService: class MockPrismaService {
    person = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    group = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    part = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    personGroupMembership = {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    // T-0111 — AssessmentRepository 가 PrismaService 의 `assessment` delegate 사용.
    // module compile 단계에서 instance 가 생성되며 생성자가 PrismaService 를 inject —
    // 실제 query 는 본 module spec 에서 호출되지 않으나 typing 안전을 위해 정의.
    assessment = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    // T-0112 — ContributionRepository 가 PrismaService 의 `contribution` delegate
    // 사용. module compile 단계에서 instance 가 생성되며 생성자가 PrismaService 를
    // inject — 실제 query 는 본 module spec 에서 호출되지 않으나 typing 안전을
    // 위해 정의.
    contribution = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    onModuleInit = jest.fn().mockResolvedValue(undefined);
    enableShutdownHooks = jest.fn();
  },
}));

// eslint-disable-next-line import/first
import { Test, type TestingModule } from "@nestjs/testing";

// eslint-disable-next-line import/first
import { PersistenceModule } from "../persistence/persistence.module";

// eslint-disable-next-line import/first
import { AssessmentRepository } from "./assessment.repository";
// eslint-disable-next-line import/first
import { ContributionRepository } from "./contribution.repository";
// eslint-disable-next-line import/first
import { GroupRepository } from "./group.repository";
// eslint-disable-next-line import/first
import { GroupService } from "./group.service";
// eslint-disable-next-line import/first
import { PartRepository } from "./part.repository";
// eslint-disable-next-line import/first
import { PartService } from "./part.service";
// eslint-disable-next-line import/first
import { PersonGroupMembershipRepository } from "./person-group-membership.repository";
// eslint-disable-next-line import/first
import { PersonRepository } from "./person.repository";
// eslint-disable-next-line import/first
import { UserController } from "./user.controller";
// eslint-disable-next-line import/first
import { UserModule } from "./user.module";
// eslint-disable-next-line import/first
import { UserRepository } from "./user.repository";
// eslint-disable-next-line import/first
import { UserService } from "./user.service";

describe("UserModule", () => {
  // Happy path: PersistenceModule (@Global, mocked PrismaService) 와 함께
  // imports 하면 PersonRepository 가 정상 resolve 된다.
  it("compile 시 PersonRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(PersonRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(PersonRepository);

    await moduleRef.close();
  });

  // T-0039: GroupRepository 도 providers / exports 에 등록되어 resolve 된다.
  it("compile 시 GroupRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(GroupRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(GroupRepository);

    await moduleRef.close();
  });

  // T-0039: PartRepository 도 providers / exports 에 등록되어 resolve 된다.
  it("compile 시 PartRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(PartRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(PartRepository);

    await moduleRef.close();
  });

  // Branch: PersonRepository 를 외부 sentinel 로 override 해도 module 이 compile.
  // exports 가 정상 등록되어 외부 module 이 inject 가능함의 간접 검증.
  it("PersonRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "person-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(PersonRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PersonRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0039: GroupRepository sentinel override — exports 등록 간접 검증.
  it("GroupRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "group-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(GroupRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(GroupRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0039: PartRepository sentinel override — exports 등록 간접 검증.
  it("PartRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "part-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(PartRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PartRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0046: PartService provider 가 module 안에서 resolve + export 등록.
  it("compile 시 PartService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const service = moduleRef.get(PartService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(PartService);

    await moduleRef.close();
  });

  // T-0046: PartService sentinel override — exports 등록 간접 검증.
  it("PartService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "part-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(PartService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PartService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0049: PersonGroupMembershipRepository 도 providers / exports 에 등록되어 resolve 된다.
  it("compile 시 PersonGroupMembershipRepository provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(PersonGroupMembershipRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(PersonGroupMembershipRepository);

    await moduleRef.close();
  });

  // T-0049: PersonGroupMembershipRepository sentinel override — exports 등록 간접 검증.
  it("PersonGroupMembershipRepository provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "person-group-membership-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(PersonGroupMembershipRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(PersonGroupMembershipRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0050: GroupService provider 가 module 안에서 resolve + export 등록.
  it("compile 시 GroupService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const service = moduleRef.get(GroupService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(GroupService);

    await moduleRef.close();
  });

  // T-0050: GroupService sentinel override — exports 등록 간접 검증.
  it("GroupService provider 가 sentinel 로 override 되어도 compile 한다", async () => {
    const sentinel = { __sentinel: "group-service-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(GroupService)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(GroupService);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0086: UserService provider 가 module 안에서 resolve + export 등록.
  // T-0082 의 UserRepository resolve 테스트 패턴 mirror.
  it("compile 시 UserService provider 가 resolve 된다", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const service = moduleRef.get(UserService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(UserService);

    await moduleRef.close();
  });

  // T-0087: UserController 가 controllers 배열에 등록 + AuthModule import (forwardRef)
  // 의 circular dependency 정상 resolve. NestJS TestingModule.get<UserController>(...)
  // 으로 controller instance 획득 — provider chain (UserService + JwtAuthGuard +
  // RolesGuard) 모두 resolve 됐다는 의미. PATCH /api/users/:id/role endpoint 의 RBAC
  // 첫 production 적용 wiring 검증.
  it("compile 시 UserController 가 controllers 에 등록되어 resolve 된다 (T-0087 RBAC 첫 production wiring)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const controller = moduleRef.get(UserController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(UserController);

    await moduleRef.close();
  });

  // T-0111: AssessmentRepository 가 providers / exports 에 등록되어 resolve 된다.
  // ADR-0006 의 후속 구현 chain 의 첫 slice — Assessment entity 의 CRUD primitive.
  it("compile 시 AssessmentRepository provider 가 resolve 된다 (T-0111)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(AssessmentRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(AssessmentRepository);

    await moduleRef.close();
  });

  // T-0111: AssessmentRepository sentinel override — exports 등록 간접 검증.
  it("AssessmentRepository provider 가 sentinel 로 override 되어도 compile 한다 (T-0111)", async () => {
    const sentinel = { __sentinel: "assessment-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(AssessmentRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(AssessmentRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // T-0112: ContributionRepository 가 providers / exports 에 등록되어 resolve 된다.
  // ADR-0006 chain 의 Contribution slice — 개별 commit/PR/문서 단위의 CRUD primitive.
  it("compile 시 ContributionRepository provider 가 resolve 된다 (T-0112)", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    }).compile();

    const repo = moduleRef.get(ContributionRepository);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(ContributionRepository);

    await moduleRef.close();
  });

  // T-0112: ContributionRepository sentinel override — exports 등록 간접 검증.
  it("ContributionRepository provider 가 sentinel 로 override 되어도 compile 한다 (T-0112)", async () => {
    const sentinel = { __sentinel: "contribution-repo-override" };
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PersistenceModule, UserModule],
    })
      .overrideProvider(ContributionRepository)
      .useValue(sentinel)
      .compile();

    const resolved = moduleRef.get(ContributionRepository);
    expect(resolved).toBe(sentinel);

    await moduleRef.close();
  });

  // Negative / error path: UserModule 이 PersistenceModule 의 @Global()
  // PrismaService 에 의존함을 검증.
  //
  // T-0106 — AuthController 가 UserService 를 직접 inject (GET /api/auth/me)
  // 하면서 UserModule ↔ AuthModule forwardRef graph 가 확장돼, PersistenceModule
  // 없이 UserModule 만 compile 하는 기존 `.rejects.toThrow(/PrismaService/)` 방식이
  // NestJS 10 instance-loader 의 parallel Promise.all 에서 sibling provider
  // rejection 을 detached 시켜 jest worker 를 crash 시키는 현상 발생 (framework
  // 한계 — testing module 은 항상 abortOnError, compile() 에 suppress 옵션 없음).
  //
  // 따라서 full-graph compile 실패에 의존하지 않고, UserRepository 의 생성자
  // paramtype metadata 에 PrismaService 가 박제됐는지로 dependency 존재를 정적
  // 검증 — instance-loader 의 parallel-rejection escape 를 원천 회피하면서도
  // "UserModule 의 repository 가 PrismaService 를 요구함" invariant 를 보호.
  // (happy-path test 들이 PersistenceModule 동반 시 정상 resolve 됨을 별도 cover.)
  it("UserRepository 가 PrismaService 를 생성자 의존성으로 요구한다 (PersistenceModule @Global 의존 검증)", () => {
    // Reflect metadata — TypeScript emitDecoratorMetadata 가 @Injectable 클래스의
    // 생성자 paramtype 을 박제. UserRepository 의 첫 인자 type 이 PrismaService
    // (본 spec 에서는 mock 의 MockPrismaService) 임을 확인.
    const paramTypes = Reflect.getMetadata(
      "design:paramtypes",
      UserRepository,
    ) as Array<{ name?: string }> | undefined;

    expect(paramTypes).toBeDefined();
    expect(paramTypes?.length).toBeGreaterThanOrEqual(1);
    // mock 의 클래스명은 MockPrismaService — 둘 다 PrismaService substring 매칭.
    expect(paramTypes?.[0]?.name).toMatch(/PrismaService/);
  });
});
