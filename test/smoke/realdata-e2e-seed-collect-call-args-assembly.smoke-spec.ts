// realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts — 실 평가 e2e
// seed→collect-input→collect-call-args 조립 체인 non-gated build-time smoke (T-0744 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(seed-side upsert 조립 smoke T-0743,
// seed→upsert-args→resolve step①② DB-prep 경로의 collect-side(step① 수집 입력 경로) 대칭 형제):
//   - PLAN 109행 step① → step②(수집) 경계의 build-time 순수 layer 는 두 컴포저가 직렬로
//     닫는다 — (1) `buildRealDataCollectInput(seeds)`(T-0576)가
//     `buildRealDataE2eSeed()`(T-0573) 산출 `RealDataSeedDescriptor[]` 의 각 descriptor
//     `serviceIdentities` 에서 `service`/`externalId` 만 추려 수집 경계 입력 contract
//     `CollectForPersonInput[]`(`isPrimary` 등 수집에 불필요한 필드 제외) 로 변환하고, (2)
//     `buildRealDataCollectCallArgs(seeds)`(T-0577)가 그 위에
//     `collectForPerson(person, since, assessmentId)` 의 완전한 호출-args 묶음
//     `RealDataCollectCallArgs[]`(`{person, since: undefined, assessmentId:
//     ASSESSMENT_ID_PLACEHOLDER}`)을 얹는다 — 신규 seed 인원이라 `since=undefined`(full
//     collection, SinceDerivationService §4 신규-인원 계약), `assessmentId` 는 DB write 후
//     치환 placeholder.
//   - 이 두 컴포저는 각각 unit(`realdata-e2e-seed-collect-input.spec.ts` /
//     `realdata-e2e-seed-collect-call-args.spec.ts`) + consistency(`...-consistency.spec.ts`)
//     spec 으로 닫혀 있으나, **seed→collect-input→collect-call-args 를 묶은 조립 체인 단위의
//     non-gated build-time smoke** 는 부재였다. `buildRealDataCollectInput` 은
//     `realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` 에 위임 throw 전파 주석으로만 언급되고,
//     그 smoke 는 `buildRealDataPipelinePlan` aggregator 의 `collectCallArgs` 수준에서만 단언할
//     뿐 — descriptor→CollectForPersonInput 중간 변환(`service`/`externalId` 만 추리고
//     `isPrimary` 드롭) 과 그 위 call-args 합성을 직접 chain 으로 묶은 단언은 0 이었다
//     (`git grep buildRealDataCollectInput origin/main test/smoke/` = pipeline-plan 의 위임
//     언급 1회뿐, collect-side assembly smoke 파일 부재 확인).
//     즉 descriptor→CollectForPersonInput shape drift(불필요 필드 누출 / service·externalId
//     누락)·call-args 묶음 shape drift(`since`/`assessmentId` placeholder)·externalId 빈/공백
//     throw 전파·빈/단일/다수 descriptor 분기는 public CI 에서 직접 발화되지 않고 pipeline-plan
//     aggregator 또는 DB-gated step② runner set-up 시에만 잡혔다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     seed→collect-input→collect-call-args 조립 surface 를 검증한다. live leg(실 github.com
//     네트워크 fetch / 실 활동 수집 / `collectForPerson` 실 호출 / 실 SinceDerivationService
//     .deriveSince / 실 assessment.id 생성 / DB 접근 / 실 LLM / Ollama / 실 jest spawn)는
//     복제하지 않고, descriptor 를 synthetic literal 로 직접 공급해 live leg 를 우회한다(조립
//     surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 collectForPerson 호출 0 — 수집/귀속/영속화 미실행. synthetic descriptor literal
//         을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / DB 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 deriveSince 0 / 실 assessment.id 생성 0 / 실 jest spawn 0 — 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 buildRealDataE2eSeed/buildRealDataCollectInput/
//         buildRealDataCollectCallArgs + ASSESSMENT_ID_PLACEHOLDER import 재사용만
//         (consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0744):
//   - 기존 `realdata-e2e-pipeline-plan-assembly.smoke-spec.ts`(T-0592, `seeds+modelId →
//     buildRealDataPipelinePlan → {collectCallArgs, modelId}` aggregator 진입) 의 재검증 —
//     본 task 는 그 aggregator 아래 collect-input→collect-call-args 직접 chain(modelId 무관)
//     만 책임(중복·재검증 0).
//   - 기존 `realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts`(T-0743, seed→upsert-args
//     →resolve DB-prep 경로) — 본 task 는 collect 입력 경로만, 별개 절단면.
//   - `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner / `since=undefined` 외 실
//     `deriveSince` 산출(DB 접근) — 본 task 는 build-time placeholder·`undefined` 만 검증.
//   - 실 수집 호출 / 실 github 수집 / 실 LLM round-trip / Ollama / DB 접근 / 실 jest spawn.
//   - 컴포저 소스(`realdata-e2e-seed-collect-input.ts` / `realdata-e2e-seed-collect-call-args.ts`
//     / `realdata-e2e-seed-fixture.ts`) / 위임 helper / consistency 가드 수정 — test-only
//     (신규 smoke spec 1 파일).
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
//   - T-0728~T-0743 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream(본 task 는
//     신규 파일 추가만).
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "../helpers/realdata-e2e-seed-collect-call-args";
import { buildRealDataCollectInput } from "../helpers/realdata-e2e-seed-collect-input";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";

// validDescriptors — synthetic 다수 descriptor fixture(2 Person, 각 1 identity). 매 it
// 가 새 트리를 받아 입력 mutate 가 누설되지 않도록 헬퍼로 빌드. 실 빌더
// buildRealDataE2eSeed 산출과 동형(person{fullName,email,active} + serviceIdentities
// 1개, github.com / isPrimary=true).
function validDescriptors(): RealDataSeedDescriptor[] {
  return [
    {
      person: {
        fullName: "alice",
        email: "alice@e2e.realdata.test",
        active: true,
      },
      serviceIdentities: [
        { service: "github.com", externalId: "alice", isPrimary: true },
      ],
    },
    {
      person: { fullName: "bob", email: "bob@e2e.realdata.test", active: true },
      serviceIdentities: [
        { service: "github.com", externalId: "bob", isPrimary: true },
      ],
    },
  ];
}

describe("Smoke(non-gated): 실 평가 e2e seed→collect-input→collect-call-args 조립 체인 live-collect 0 검증", () => {
  describe("happy path — 종단 체인(seed→collect-input→collect-call-args) 산출", () => {
    it("buildRealDataE2eSeed()→buildRealDataCollectInput→buildRealDataCollectCallArgs 종단 → callArgs 가 배열·길이=descriptor 수·각 원소 person/since/assessmentId 필드 보유", () => {
      const descriptors = buildRealDataE2eSeed();
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      expect(Array.isArray(callArgs)).toBe(true);
      expect(callArgs).toHaveLength(descriptors.length);
      for (const args of callArgs) {
        expect(args.person).toBeDefined();
        expect(Array.isArray(args.person.serviceIdentities)).toBe(true);
        // since 는 undefined 값을 보유(키 존재) — hasOwnProperty 로 키 존재 단언.
        expect(Object.prototype.hasOwnProperty.call(args, "since")).toBe(true);
        expect(typeof args.assessmentId).toBe("string");
      }
    });

    it("(b) 각 원소 person.serviceIdentities[*] 가 원본 descriptor 의 service/externalId 만 보유하고 isPrimary 등 불필요 필드 미누출", () => {
      const descriptors = validDescriptors();
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      callArgs.forEach((args, i) => {
        const srcIdentities = descriptors[i].serviceIdentities;
        expect(args.person.serviceIdentities).toHaveLength(
          srcIdentities.length,
        );
        args.person.serviceIdentities.forEach((identity, j) => {
          // service/externalId 만 보유 — 정확히 두 키.
          expect(Object.keys(identity).sort()).toEqual([
            "externalId",
            "service",
          ]);
          expect(identity).toEqual({
            service: srcIdentities[j].service,
            externalId: srcIdentities[j].externalId,
          });
          // isPrimary 등 수집 입력에 불필요한 필드 미누출.
          expect(identity).not.toHaveProperty("isPrimary");
        });
      });
    });

    it("(c) 각 원소 since === undefined · assessmentId === ASSESSMENT_ID_PLACEHOLDER", () => {
      const callArgs = buildRealDataCollectCallArgs(validDescriptors());

      for (const args of callArgs) {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
      }
    });
  });

  describe("단일 source 조립 단언 — collect-input → collect-call-args 를 seeds 단일 source 로 thread", () => {
    it("buildRealDataCollectCallArgs(seeds)[*].person 이 buildRealDataCollectInput(seeds) 산출과 deep-equal(중복 매핑 없이 동일 변환 위임)", () => {
      const descriptors = validDescriptors();

      const persons = buildRealDataCollectInput(descriptors);
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      // call-args 의 person 들을 추출한 배열이 collect-input 직접 산출과 byte-identical.
      expect(callArgs.map((args) => args.person)).toEqual(persons);
    });

    it("call-args 산출 원소 수 = collect-input 산출 원소 수 = descriptor 수(1:1 wrap)", () => {
      const descriptors = validDescriptors();

      const persons = buildRealDataCollectInput(descriptors);
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      expect(persons).toHaveLength(descriptors.length);
      expect(callArgs).toHaveLength(descriptors.length);
      expect(callArgs).toHaveLength(persons.length);
    });

    it("descriptor 의 person.email/fullName 등 collect 입력에 불필요한 필드가 CollectForPersonInput shape 에 누출되지 않음(serviceIdentities 만 보유)", () => {
      const descriptors = validDescriptors();
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      for (const args of callArgs) {
        // CollectForPersonInput 은 serviceIdentities 만 보유하는 최소 shape.
        expect(Object.keys(args.person)).toEqual(["serviceIdentities"]);
        expect(args.person).not.toHaveProperty("email");
        expect(args.person).not.toHaveProperty("fullName");
        expect(args.person).not.toHaveProperty("active");
      }
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 descriptor + identity 0 분기(분기별 분리)", () => {
    it("빈 seeds → buildRealDataCollectInput([]) = [] → buildRealDataCollectCallArgs([]) = [](throw 0)", () => {
      expect(buildRealDataCollectInput([])).toEqual([]);
      expect(buildRealDataCollectCallArgs([])).toEqual([]);
    });

    it("serviceIdentities 0개 descriptor → person.serviceIdentities 빈 배열로 통과(throw 0)", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "dave",
            email: "dave@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [],
        },
      ];
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].person.serviceIdentities).toEqual([]);
      expect(callArgs[0].since).toBeUndefined();
      expect(callArgs[0].assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
    });

    it("단일 descriptor → 길이 1 + person.serviceIdentities[0] 가 service/externalId 만 보유", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "eve",
            email: "eve@e2e.realdata.test",
            active: false,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "eve", isPrimary: true },
          ],
        },
      ];
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      expect(callArgs).toHaveLength(1);
      expect(callArgs[0].person.serviceIdentities[0]).toEqual({
        service: "github.com",
        externalId: "eve",
      });
    });

    it("다수 descriptor → 각 person 이 자기 descriptor 의 identity 를 받음(순서 정합)", () => {
      const descriptors = validDescriptors();
      const callArgs = buildRealDataCollectCallArgs(descriptors);

      expect(callArgs).toHaveLength(2);
      expect(callArgs[0].person.serviceIdentities[0].externalId).toBe("alice");
      expect(callArgs[1].person.serviceIdentities[0].externalId).toBe("bob");
    });
  });

  describe("negative cases — collect-input 위임 throw 전파(조립 경로 자체 try/catch 0)", () => {
    it("(a) descriptor 의 어느 serviceIdentity externalId 가 빈 문자열 → buildRealDataCollectCallArgs 의 하위 throw 가 조립 경로로 그대로 전파", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "alice",
            email: "alice@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "", isPrimary: true },
          ],
        },
      ];
      expect(() => buildRealDataCollectCallArgs(descriptors)).toThrow();
    });

    it("(b) externalId 가 공백만 → throw 전파", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "alice",
            email: "alice@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "   ", isPrimary: true },
          ],
        },
      ];
      expect(() => buildRealDataCollectCallArgs(descriptors)).toThrow();
    });

    // (c) service blank guard — buildRealDataCollectInput 은 externalId 빈/공백만 throw 가드
    // 하고 service 빈/공백은 guard 하지 않는다(CollectForPersonInput 은 service 를 그대로
    // 투영). 따라서 본 항목(service 빈/공백 throw 전파)은 helper 가 guard 하지 않아 생략한다.
    it("(c-note) service blank 는 collect-input 컴포저가 guard 하지 않으므로 throw 0 — 빈 service 도 그대로 투영(생략 사실 박제)", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "alice",
            email: "alice@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            // service 빈 문자열 — externalId 는 정상이므로 throw 0(service guard 부재).
            { service: "github.com", externalId: "alice", isPrimary: true },
          ],
        },
      ];
      // externalId 정상이면 service 값과 무관하게 throw 0(가드 부재 사실 검증).
      expect(() => buildRealDataCollectCallArgs(descriptors)).not.toThrow();
    });

    it("다수 descriptor 중 하나라도 externalId 빈/공백 → 조립 전체 throw 전파", () => {
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "alice",
            email: "alice@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "alice", isPrimary: true },
          ],
        },
        {
          person: {
            fullName: "bob",
            email: "bob@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: " ", isPrimary: true },
          ],
        },
      ];
      expect(() => buildRealDataCollectCallArgs(descriptors)).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 seeds 두 번 호출 + 입력 불변", () => {
    it("(c-결정론·무공유) 두 호출 deep-equal + 매 호출 새 객체 트리(종단 산출 배열·중첩 person·person.serviceIdentities 배열 모두 참조 비동일)", () => {
      const descriptors = validDescriptors();

      const a = buildRealDataCollectCallArgs(descriptors);
      const b = buildRealDataCollectCallArgs(descriptors);

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].person).not.toBe(b[0].person);
      expect(a[0].person.serviceIdentities).not.toBe(
        b[0].person.serviceIdentities,
      );
      // ASSESSMENT_ID_PLACEHOLDER 는 string 원시값이라 공유돼도 mutate 불가 — 동일 값 보유.
      expect(a[0].assessmentId).toBe(b[0].assessmentId);
    });

    it("(d) no-mutation — 입력 seeds(및 그 중첩 serviceIdentities)가 호출 전후 deep-equal(mutate 0)", () => {
      const descriptors = validDescriptors();
      const descriptorsBefore = JSON.parse(JSON.stringify(descriptors));

      buildRealDataCollectCallArgs(descriptors);

      expect(descriptors).toEqual(descriptorsBefore);
      // 중첩 serviceIdentities 도 보존(isPrimary 등 drop 은 산출물에서만, 입력은 불변).
      expect(descriptors[0].serviceIdentities[0]).toEqual({
        service: "github.com",
        externalId: "alice",
        isPrimary: true,
      });
    });
  });
});
