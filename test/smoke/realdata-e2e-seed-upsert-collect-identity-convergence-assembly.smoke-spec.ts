// realdata-e2e-seed-upsert-collect-identity-convergence-assembly.smoke-spec.ts —
// 실 평가 e2e step① seed upsert↔collect 두 leg single-source seeds identity
// convergence 조립 체인 non-gated build-time smoke (T-0760 박제, PLAN.md 109행
// 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(T-0574/T-0716 upsert / T-0577/T-0688
// collect-call / T-0576/T-0690 collect-input 단독 spec 의 cross-leg
// identity-convergence 짝):
//   - PLAN 109행 step ①(시드 수집)은 단일 `seeds: RealDataSeedDescriptor[]`
//     (= `buildRealDataE2eSeed()`) source 로부터 **두 개의 독립 leg** 로 갈린다.
//     (1) **upsert leg** `buildRealDataUpsertArgs(seeds)`(T-0574)는 각 seed
//     descriptor 를 prisma `person.upsert`(`where.email`) + `serviceIdentity.upsert`
//     (`create.{service, externalId, isPrimary}`) args 로 매핑해 **DB 에 어떤
//     person/identity 를 박제할지** 결정하고, (2) **collect leg**
//     `buildRealDataCollectCallArgs(seeds)`(T-0577)는 같은 seed 를
//     `collectForPerson(person, since, assessmentId)` 호출-args 로 매핑해
//     `person.serviceIdentities = {service, externalId}` 로 **어떤 identity 로 활동을
//     수집할지** 결정한다.
//   - step① 의 핵심 불변식은 **두 leg 가 동일 단일 `seeds` source 로 수렴**한다는
//     것 — upsert leg 가 DB 에 박제하는 `(service, externalId)` identity 쌍과 collect
//     leg 가 author 귀속 수집에 쓰는 `(service, externalId)` 쌍이 byte-identical 로
//     일치해야 한다. 두 leg 가 같은 `seeds` 를 공유하지 않으면(한 leg 가 identity 를
//     drop/재정렬하거나 다른 externalId 를 끌어쓰면) **박제한 identity X 로 수집하지
//     않고 identity Y 로 수집**해 step①→② 핸드오프가 깨진다(R-58 재수집 중복 방지·
//     author 귀속 필터 무력화).
//   - 기존 sweep 은 두 leg 를 **각각 따로** 닫았다 — upsert leg 는 T-0574/T-0716,
//     collect leg 는 T-0577/T-0688 + collect-input leaf T-0576/T-0690. 그러나
//     **upsert leg 와 collect leg 를 동일 `seeds` 로 동시 호출해, upsert 가 박제하는
//     identity 의 `(service, externalId)` 와 collect 가 수집에 쓰는 `(service,
//     externalId)` 가 byte-identical 단일 source(`seeds`)로 수렴**함을 박제한 smoke 는
//     NONE 이었다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로 두
//     leg 의 cross-leg identity 수렴만 검증한다(upsert leg 의 args shape /
//     collect leg 의 call-args shape 자체 재단언 금지 — 기존 spec 이미 cover). live
//     leg(실 prisma.upsert·실 collectForPerson·실 github.com fetch·실 LLM·DB·LAN gate)는
//     복제하지 않고, 순수 컴포저에 synthetic seed descriptor 를 직접 공급한다. 따라서
//     본 spec 은:
//
//      🔥 실 prisma 호출 0 — person.upsert / serviceIdentity.upsert 미실행. args 트리만 관측.
//      🔥 실 수집 호출 0 — collectForPerson / github 네트워크 fetch 0. call-args 트리만 관측.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 DB 접근 0 / 실 LLM 0 — seed→두 leg 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만(가드 신설 금지).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0760):
//   - 실 prisma.person.upsert / serviceIdentity.upsert 호출 / 실 DB write / placeholder
//     치환 runner — 본 spec 은 args 트리만 관측(실 영속 0).
//   - 실 github.com 네트워크 수집 / collectForPerson 실행 / 실 활동 수집 — call-args
//     트리만 관측.
//   - upsert leg 자체의 args shape(`personUpsert.where/create/update`·compound-unique
//     where·net-0 update) 전수 재단언(T-0574/T-0716 이미 cover — 본 task 는 cross-leg
//     identity 수렴만).
//   - collect leg 자체의 call-args shape(`person`/`since=undefined`/`assessmentId`
//     placeholder) + collect-input identity 투영 전수 재단언(T-0577/T-0688/T-0576/
//     T-0690 이미 cover).
//   - pre-실행 dual-leg aggregator(buildRealDataE2eStepArgs) / step④ publish↔outcome
//     run 수렴 재단언(T-0752/T-0759 이미 cover).
//   - 새 컴포저 / 가드 / helper 신설 — 기존 build* 컴포저 import 재사용만.
//   - production src/ 코드 / 기존 컴포저 소스 / 위임 helper / consistency 가드 수정 —
//     test-only(신규 smoke spec 1 파일).
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "../helpers/realdata-e2e-seed-collect-call-args";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import {
  PERSON_ID_PLACEHOLDER,
  buildRealDataUpsertArgs,
} from "../helpers/realdata-e2e-seed-upsert";

// (service, externalId) identity 쌍 — 두 leg 수렴 비교의 단위. isPrimary 는 collect
// leg(collect-input)가 투영하지 않으므로 비교 대상에서 제외한다(Acceptance Criteria 명시).
interface IdentityPair {
  service: string;
  externalId: string;
}

// upsert leg 의 1 descriptor → identity 쌍 집합(create.{service, externalId}).
function upsertIdentityPairs(
  upsertArgs: ReturnType<typeof buildRealDataUpsertArgs>[number],
): IdentityPair[] {
  return upsertArgs.identityUpsertsByEmail.map((identity) => ({
    service: identity.create.service,
    externalId: identity.create.externalId,
  }));
}

// collect leg 의 1 descriptor → identity 쌍 집합(person.serviceIdentities.{service, externalId}).
function collectIdentityPairs(
  collectArgs: ReturnType<typeof buildRealDataCollectCallArgs>[number],
): IdentityPair[] {
  return collectArgs.person.serviceIdentities.map((identity) => ({
    service: identity.service,
    externalId: identity.externalId,
  }));
}

// synthetic 단일-identity descriptor 합성 헬퍼 — fixture shape 정합(person 메타 +
// github.com identity 1 개). R-59 정합(raw 활동 0, 식별자만).
function singleIdentitySeed(
  username: string,
  externalId: string = username,
): RealDataSeedDescriptor {
  return {
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [{ service: "github.com", externalId, isPrimary: true }],
  };
}

describe("Smoke(non-gated): 실 평가 e2e step① seed upsert↔collect 두 leg single-source seeds identity convergence 조립 체인 live 0 검증", () => {
  describe("happy path — 동일 seeds 로 두 leg 동시 호출 정상 산출", () => {
    it("동일 seeds(buildRealDataE2eSeed) 로 upsert leg + collect leg 호출 → 두 배열 모두 정상 산출 + length 가 seeds.length 와 동형(person 1:1)", () => {
      const seeds = buildRealDataE2eSeed();

      // DB-write upsert leg + collect-call leg 동시 호출(단일 source seeds).
      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      // upsert leg: {personUpsert, identityUpsertsByEmail}[] 정상 산출.
      expect(Array.isArray(upsertArgs)).toBe(true);
      expect(upsertArgs).toHaveLength(seeds.length);
      for (const args of upsertArgs) {
        expect(args.personUpsert).toBeDefined();
        expect(Array.isArray(args.identityUpsertsByEmail)).toBe(true);
      }

      // collect leg: {person, since, assessmentId}[] 정상 산출.
      expect(Array.isArray(collectArgs)).toBe(true);
      expect(collectArgs).toHaveLength(seeds.length);
      for (const args of collectArgs) {
        expect(args.person).toBeDefined();
        expect(Array.isArray(args.person.serviceIdentities)).toBe(true);
      }

      // 두 leg length 가 person 단위 1:1 동형.
      expect(upsertArgs).toHaveLength(collectArgs.length);
    });
  });

  describe("cross-leg identity single-source 수렴 — 핵심 불변식(branch)", () => {
    it("descriptor 단위로 upsert leg create.{service, externalId} 집합 === collect leg person.serviceIdentities.{service, externalId} 집합(순서·값 byte-identical) AND personUpsert.where.email 이 동일 seed descriptor 에서 도출", () => {
      const seeds = buildRealDataE2eSeed();

      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      seeds.forEach((seed, i) => {
        // upsert 가 DB 에 박제하는 identity 쌍과 collect 가 수집에 쓰는 identity 쌍이
        // 순서·값 byte-identical 로 일치(같은 단일 seeds source 로 수렴).
        expect(upsertIdentityPairs(upsertArgs[i])).toEqual(
          collectIdentityPairs(collectArgs[i]),
        );

        // upsert leg 의 person email(= 단위 join 키)이 동일 seed descriptor 에서 도출.
        expect(upsertArgs[i].personUpsert.where.email).toBe(seed.person.email);

        // identity 쌍 자체도 seed descriptor 의 serviceIdentities 에서 도출됨(단일 source).
        expect(upsertIdentityPairs(upsertArgs[i])).toEqual(
          seed.serviceIdentities.map((identity) => ({
            service: identity.service,
            externalId: identity.externalId,
          })),
        );
      });
    });
  });

  describe("multi-identity person 분기에서도 identity 수렴(branch)", () => {
    it("한 person 이 2+ serviceIdentities → upsert leg 다중 entry 의 (service, externalId) 순서·값이 collect leg 다중 entry 와 동형 일치(drop/재정렬 drift 0)", () => {
      // 한 person 에 3 identity(외부 externalId 가 서로 다름) — 순서까지 고정 단언.
      const multi: RealDataSeedDescriptor = {
        person: {
          fullName: "multi-id-person",
          email: "multi@e2e.realdata.test",
          active: true,
        },
        serviceIdentities: [
          { service: "github.com", externalId: "id-a", isPrimary: true },
          { service: "github.com", externalId: "id-b", isPrimary: false },
          { service: "github.com", externalId: "id-c", isPrimary: false },
        ],
      };
      const seeds = [multi];

      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      const upsertPairs = upsertIdentityPairs(upsertArgs[0]);
      const collectPairs = collectIdentityPairs(collectArgs[0]);

      // 다중 identity 매핑에서도 순서·값 동형(toEqual — 순서 민감).
      expect(upsertPairs).toHaveLength(3);
      expect(collectPairs).toHaveLength(3);
      expect(upsertPairs).toEqual(collectPairs);
      // 입력 순서 보존도 명시 단언(재정렬 drift 0).
      expect(upsertPairs.map((p) => p.externalId)).toEqual([
        "id-a",
        "id-b",
        "id-c",
      ]);
    });
  });

  describe("partial-thread 격리 — 두 leg 가 같은 source 따라 동시 이동(branch)", () => {
    it("다른 seeds(identity externalId 변) 으로 두 leg 함께 호출 → 박제 identity 와 수집 identity 가 함께 동형 변화(한 leg 만 stale seed 면 핸드오프 깨짐을 회귀 박제)", () => {
      // seeds X(externalId=alice).
      const seedsX = [singleIdentitySeed("alice")];
      const upsertX = buildRealDataUpsertArgs(seedsX);
      const collectX = buildRealDataCollectCallArgs(seedsX);

      // seeds Y(externalId=bob — externalId 가 다름).
      const seedsY = [singleIdentitySeed("bob")];
      const upsertY = buildRealDataUpsertArgs(seedsY);
      const collectY = buildRealDataCollectCallArgs(seedsY);

      // 두 leg 의 identity 가 seeds X→Y 로 **함께** 이동.
      expect(upsertIdentityPairs(upsertX[0])).not.toEqual(
        upsertIdentityPairs(upsertY[0]),
      );
      expect(collectIdentityPairs(collectX[0])).not.toEqual(
        collectIdentityPairs(collectY[0]),
      );

      // seeds X: 두 leg identity 가 함께 alice 로 수렴.
      expect(upsertIdentityPairs(upsertX[0])).toEqual(
        collectIdentityPairs(collectX[0]),
      );
      expect(upsertX[0].identityUpsertsByEmail[0].create.externalId).toBe(
        "alice",
      );
      expect(collectX[0].person.serviceIdentities[0].externalId).toBe("alice");

      // seeds Y: 두 leg identity 가 함께 bob 으로 수렴.
      expect(upsertIdentityPairs(upsertY[0])).toEqual(
        collectIdentityPairs(collectY[0]),
      );
      expect(upsertY[0].identityUpsertsByEmail[0].create.externalId).toBe(
        "bob",
      );
      expect(collectY[0].person.serviceIdentities[0].externalId).toBe("bob");
    });

    it("빈 serviceIdentities descriptor → 두 leg 모두 빈 identity(upsert identityUpsertsByEmail=[] AND collect person.serviceIdentities=[])로 동형 수렴", () => {
      const seeds: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "no-identity-person",
            email: "noid@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [],
        },
      ];

      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      // 두 leg 모두 빈 identity 로 동형 수렴(throw 0).
      expect(upsertArgs[0].identityUpsertsByEmail).toEqual([]);
      expect(collectArgs[0].person.serviceIdentities).toEqual([]);
      expect(upsertIdentityPairs(upsertArgs[0])).toEqual(
        collectIdentityPairs(collectArgs[0]),
      );
    });
  });

  describe("error path / negative cases — 두 leg 의 가드 비대칭 박제(collect throw · upsert 통과)", () => {
    it("어떤 identity externalId 가 빈 문자열 '' → collect leg(buildRealDataCollectCallArgs) throw 전파(수집 author 귀속 key 빈값 차단)", () => {
      const seeds = [singleIdentitySeed("ghost", "")];
      expect(() => buildRealDataCollectCallArgs(seeds)).toThrow();
    });

    it("어떤 identity externalId 가 공백-only '   ' → collect leg throw 전파", () => {
      const seeds = [singleIdentitySeed("ghost", "   ")];
      expect(() => buildRealDataCollectCallArgs(seeds)).toThrow();
    });

    it("동일 빈/공백 externalId seeds 로 upsert leg(buildRealDataUpsertArgs) 는 throw 0 — 두 leg 가드 비대칭(한 leg throw·다른 leg 통과) 명시 박제", () => {
      const emptySeeds = [singleIdentitySeed("ghost", "")];
      const blankSeeds = [singleIdentitySeed("ghost", "   ")];

      // upsert leg 는 externalId 빈값 가드가 없어 통과(collect leg 만 막음).
      expect(() => buildRealDataUpsertArgs(emptySeeds)).not.toThrow();
      expect(() => buildRealDataUpsertArgs(blankSeeds)).not.toThrow();

      // 통과 산출은 빈/공백 externalId 를 그대로 args 에 담는다(가드 부재 명시).
      const emptyArgs = buildRealDataUpsertArgs(emptySeeds);
      expect(emptyArgs[0].identityUpsertsByEmail[0].create.externalId).toBe("");
      const blankArgs = buildRealDataUpsertArgs(blankSeeds);
      expect(blankArgs[0].identityUpsertsByEmail[0].create.externalId).toBe(
        "   ",
      );

      // 동일 seeds 로 collect leg 는 throw — 비대칭 확정.
      expect(() => buildRealDataCollectCallArgs(emptySeeds)).toThrow();
      expect(() => buildRealDataCollectCallArgs(blankSeeds)).toThrow();
    });

    it("빈 seeds 배열 [] → 두 leg 모두 빈 배열 반환(throw 0, 경계값)", () => {
      expect(buildRealDataUpsertArgs([])).toEqual([]);
      expect(buildRealDataCollectCallArgs([])).toEqual([]);
    });
  });

  describe("flow / branch — DB-write upsert leg vs collect-call leg 분리(독립 출력 shape·identity source 공유)", () => {
    it("DB-write upsert leg — personUpsert/identityUpsertsByEmail shape 산출 + PERSON_ID_PLACEHOLDER 박제", () => {
      const seeds = buildRealDataE2eSeed();
      const upsertArgs = buildRealDataUpsertArgs(seeds);

      // upsert leg 는 DB-write args shape(personUpsert + identityUpsertsByEmail) 산출.
      const first = upsertArgs[0];
      expect(first.personUpsert.where.email).toBe(seeds[0].person.email);
      expect(first.personUpsert.create.fullName).toBe(seeds[0].person.fullName);
      // compound-unique where 에 personId placeholder 박제(런타임 치환 대상).
      expect(
        first.identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
    });

    it("collect-call leg — person/since/assessmentId shape 산출 + since=undefined·ASSESSMENT_ID_PLACEHOLDER 박제", () => {
      const seeds = buildRealDataE2eSeed();
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      // collect leg 는 collect-call args shape(person/since/assessmentId) 산출.
      const first = collectArgs[0];
      expect(first.person.serviceIdentities).toBeDefined();
      // 신규 seed 인원 — since=undefined(full collection).
      expect(first.since).toBeUndefined();
      // assessment.id 는 DB write 시점 치환 placeholder.
      expect(first.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
    });

    it("두 leg 가 독립 출력 shape(upsert-args vs call-args)를 산출하되 identity source 만 공유 — upsert 출력에 since/assessmentId 없고, collect 출력에 personUpsert 없음", () => {
      const seeds = buildRealDataE2eSeed();
      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      // upsert leg 출력은 collect-call 필드를 갖지 않음(독립 shape).
      expect(upsertArgs[0]).not.toHaveProperty("since");
      expect(upsertArgs[0]).not.toHaveProperty("assessmentId");
      // collect leg 출력은 upsert 필드를 갖지 않음(독립 shape).
      expect(collectArgs[0]).not.toHaveProperty("personUpsert");
      expect(collectArgs[0]).not.toHaveProperty("identityUpsertsByEmail");

      // 그러나 identity source 는 공유(수렴) — 위 cross-leg 단언과 정합.
      expect(upsertIdentityPairs(upsertArgs[0])).toEqual(
        collectIdentityPairs(collectArgs[0]),
      );
    });
  });

  describe("credential 누출 0 — 두 leg 어느 출력에도 secret/raw 활동 미포함(§9·R-59)", () => {
    it("upsertArgs·collectArgs 직렬화 어디에도 token/secret/ghp_/--auth 어휘 + raw 활동 본문 미포함", () => {
      const seeds = buildRealDataE2eSeed();
      const upsertArgs = buildRealDataUpsertArgs(seeds);
      const collectArgs = buildRealDataCollectCallArgs(seeds);

      const serialized = [
        JSON.stringify(upsertArgs),
        JSON.stringify(collectArgs),
      ]
        .join(" ")
        .toLowerCase();

      // 실 credential leak shape 어휘만 검사(일반 `token` 단어는 false-positive 회피 —
      // 두 leg 출력에는 등장하지 않으므로 그대로 부재 단언해도 안전).
      for (const secretToken of [
        "ghp_",
        "gho_",
        "--auth",
        "authorization",
        "bearer",
        "password",
        "secret",
      ]) {
        expect(serialized).not.toContain(secretToken);
      }

      // raw 외부 활동 데이터(commit/PR/issue 본문) 미포함 — person 메타 + identity
      // 식별자만(R-59 정합). 두 leg 출력 키가 식별 필드로만 구성됨을 확인.
      const upsertKeys = JSON.stringify(upsertArgs);
      expect(upsertKeys).not.toContain("commit");
      expect(upsertKeys).not.toContain('"body"');
      expect(upsertKeys).not.toContain('"diff"');
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 seeds 두 번 호출 + 입력 불변", () => {
    it("두 leg 각각 두 번 호출 → deep-equal 산출(toEqual) + 새 객체(not.toBe)", () => {
      const seeds = buildRealDataE2eSeed();

      const upsertA = buildRealDataUpsertArgs(seeds);
      const upsertB = buildRealDataUpsertArgs(seeds);
      const collectA = buildRealDataCollectCallArgs(seeds);
      const collectB = buildRealDataCollectCallArgs(seeds);

      // 값은 deep-equal(결정론 — 입력만의 함수).
      expect(upsertA).toEqual(upsertB);
      expect(collectA).toEqual(collectB);

      // 참조는 무공유 — 매 호출 새 객체.
      expect(upsertA).not.toBe(upsertB);
      expect(collectA).not.toBe(collectB);
    });

    it("입력 seeds(중첩 person/serviceIdentities 포함) 가 두 leg 호출 전후로 mutate 되지 않음(deep-equal 보존)", () => {
      const seeds = buildRealDataE2eSeed();
      const seedsBefore = JSON.parse(JSON.stringify(seeds));

      buildRealDataUpsertArgs(seeds);
      buildRealDataCollectCallArgs(seeds);

      // 호출 후 입력 seeds 동형(무공유 보존 — 출력 변형이 입력에 누설 0).
      expect(seeds).toEqual(seedsBefore);
    });
  });
});
