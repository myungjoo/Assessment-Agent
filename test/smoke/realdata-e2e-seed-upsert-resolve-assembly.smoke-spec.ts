// realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts — 실 평가 e2e
// seed→upsert-args→resolve 조립 체인 non-gated build-time smoke (T-0743 박제,
// PLAN.md 109행 🟢 실 평가 e2e).
//
// 본 spec 의 존재 이유 — public CI gap 해소(step④ search-side 조립 smoke 쌍
// T-0741/T-0742 와 step②③ step-args 조립 smoke T-0737~T-0739 의 seed-side 대칭 형제):
//   - PLAN 109행 step① → step② 경계(seed descriptor → Prisma upsert-args → 실
//     person.id 치환)의 build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1)
//     `buildRealDataUpsertArgs(descriptors)`(T-0574, self-wire T-0716)가
//     `buildRealDataE2eSeed()`(T-0573) 산출 `RealDataSeedDescriptor[]` 를
//     `RealDataUpsertArgs[]`(person.upsert + identityUpsertsByEmail, ServiceIdentity
//     where.personId 는 `PERSON_ID_PLACEHOLDER`)로 변환하고, (2)
//     `resolveRealDataPersonId(upsertArgsList, emailToPersonId)`(T-0575, self-wire
//     T-0718)가 그 placeholder 를 email→실 person.id map 으로 치환한 새 트리를 반환한다.
//     이 체인은 step② live runner 가 실제로 `prisma.person.upsert` / `serviceIdentity
//     .upsert` 에 넘기는 **마지막** idempotent upsert-args 트리를 만든다 — 후보 descriptor
//     를 person.upsert args(`where.email` 정합) + identity upsert args(compound-unique
//     `personId_service` shape)로 변환한 뒤, person.upsert 후 얻은 email→id map 으로
//     placeholder 를 실 person.id 로 치환한다.
//   - 이 두 컴포저는 각각 unit(`realdata-e2e-seed-upsert.spec.ts` /
//     `realdata-e2e-seed-resolve-person-id.spec.ts`) + consistency
//     (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→upsert-args→resolve 를
//     묶은 조립 체인 단위의 non-gated build-time smoke** 는 부재였다(`git grep
//     buildRealDataUpsertArgs / resolveRealDataPersonId origin/main test/smoke/` = 0).
//     즉 placeholder→실 person.id 치환 누락·email→id join drift·compound-unique
//     where(`personId_service`) shape drift·net-0 update 보존(email/service/externalId
//     가 update 에서 제외) 회귀·email 매핑 누락/빈값 throw 전파·빈/단일/다수 descriptor
//     분기는 public CI 에서 한 번도 발화되지 않고 DB-gated step② runner set-up 시에만
//     잡혔다.
//   - 본 spec 은 그 gap 을 메운다 — **gating 없이 항상 실행되는 일반 describe** 로
//     seed→upsert→resolve 조립 surface 를 검증한다. live leg(실 prisma.upsert·person.id
//     생성 / 실 DB 접근 / 실 github 수집 / 실 LLM / Ollama / 네트워크 / 실 jest spawn)는
//     복제하지 않고, descriptor 와 email→personId map 을 synthetic literal 로 직접 공급해
//     live leg 를 우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 prisma.upsert 호출 0 — person.upsert / serviceIdentity.upsert 미실행.
//         synthetic descriptor + email→personId map literal 을 컴포저에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / DB 호출 0. fetch 0. process.env 읽기 0.
//      🔥 실 LLM 호출 0 / 실 person.id 생성·조회 0 / 실 jest spawn 0 — 조립만.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 buildRealDataE2eSeed/buildRealDataUpsertArgs/
//         resolveRealDataPersonId + PERSON_ID_PLACEHOLDER import 재사용만
//         (consistency-guard 신설 금지 — sweep 종결, T-0726).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0743):
//   - 기존 `realdata-e2e-assembly.smoke-spec.ts`(T-0728, seed→run-plan→step-args, pre-실행
//     step-args 진입) — 본 task 는 seed-side 의 별개 절단면(seed→upsert-args→resolve, step
//     ①② DB-prep 경로)만 책임(중복·재검증 0 — 그건 step-args aggregator 책임).
//   - email→personId map 의 실 산출(step② person.upsert 후 실 person.id 수집) — 본 task 는
//     그 map 을 synthetic literal 로 직접 주입만.
//   - 실 prisma.person.upsert / serviceIdentity.upsert 실 호출 / 실 person.id 생성·조회 /
//     step② runner / 실 github 수집 / 실 LLM round-trip / Ollama / DB 접근 / 실 jest spawn.
//   - 컴포저 소스(`realdata-e2e-seed-upsert.ts` / `realdata-e2e-seed-resolve-person-id.ts` /
//     `realdata-e2e-seed-fixture.ts`) / 위임 helper / consistency 가드 수정 — test-only
//     (신규 smoke spec 1 파일).
//   - 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만.
//   - production src/ 코드 / package.json / test/jest-smoke.json 변경.
//   - T-0728~T-0742 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream(본 task 는
//     신규 파일 추가만).
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";
import { resolveRealDataPersonId } from "../helpers/realdata-e2e-seed-resolve-person-id";
import {
  buildRealDataUpsertArgs,
  PERSON_ID_PLACEHOLDER,
} from "../helpers/realdata-e2e-seed-upsert";

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

// validMap — 위 descriptor 의 email 전부를 실 person.id 로 매핑한 Record fixture.
function validMap(): Record<string, string> {
  return {
    "alice@e2e.realdata.test": "person-id-alice",
    "bob@e2e.realdata.test": "person-id-bob",
  };
}

describe("Smoke(non-gated): 실 평가 e2e seed→upsert-args→resolve 조립 체인 live-prisma 0 검증", () => {
  describe("happy path — 종단 체인(seed→upsert→resolve) 산출", () => {
    it("buildRealDataE2eSeed()→buildRealDataUpsertArgs→resolveRealDataPersonId 종단 → resolved 가 배열·길이=descriptor 수·각 원소 personUpsert/identityUpsertsByEmail 필드 보유", () => {
      const descriptors = buildRealDataE2eSeed();
      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const emailToPersonId: Record<string, string> = Object.fromEntries(
        descriptors.map((d, i) => [d.person.email, `person-id-${i}`]),
      );
      const resolved = resolveRealDataPersonId(upsertArgsList, emailToPersonId);

      expect(Array.isArray(resolved)).toBe(true);
      expect(resolved).toHaveLength(descriptors.length);
      for (const args of resolved) {
        expect(args.personUpsert).toBeDefined();
        expect(Array.isArray(args.identityUpsertsByEmail)).toBe(true);
      }
    });

    it("(b) 각 identity 의 where.personId_service.personId 가 PERSON_ID_PLACEHOLDER 가 아니라 map 의 실 person.id 로 치환됨", () => {
      const descriptors = validDescriptors();
      const map = validMap();
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      for (const args of resolved) {
        const expectedId = map[args.personUpsert.where.email];
        for (const identity of args.identityUpsertsByEmail) {
          expect(identity.where.personId_service.personId).toBe(expectedId);
          expect(identity.where.personId_service.personId).not.toBe(
            PERSON_ID_PLACEHOLDER,
          );
        }
      }
    });

    it("(c) personUpsert.where.email/create/update 가 원본 descriptor 와 정합(보존)", () => {
      const descriptors = validDescriptors();
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        validMap(),
      );

      resolved.forEach((args, i) => {
        const person = descriptors[i].person;
        expect(args.personUpsert.where).toEqual({ email: person.email });
        expect(args.personUpsert.create).toEqual({
          fullName: person.fullName,
          email: person.email,
          active: person.active,
        });
        expect(args.personUpsert.update).toEqual({
          fullName: person.fullName,
          active: person.active,
        });
      });
    });
  });

  describe("단일 source 조립 단언 — 2-위임(upsert→resolve)을 descriptors 단일 source 로 thread", () => {
    it("종단 산출이 resolveRealDataPersonId(buildRealDataUpsertArgs(descriptors), map) 2-위임 직접 재유도 결과와 deep-equal", () => {
      const descriptors = validDescriptors();
      const map = validMap();

      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const chained = resolveRealDataPersonId(upsertArgsList, map);

      // 2-위임 직접 재유도(single-source) — 컴포저 thread 결과와 byte-identical.
      const direct = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      expect(chained).toEqual(direct);
    });

    it("같은 Person(같은 email)의 모든 identityUpsertsByEmail[*] 가 동일 person.id 를 받음(compound-unique 정합)", () => {
      // 1 Person 에 다수 identity 를 가진 descriptor — 모두 같은 email 이므로 같은 id.
      const descriptors: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "carol",
            email: "carol@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [
            { service: "github.com", externalId: "carol", isPrimary: true },
            {
              service: "github.com",
              externalId: "carol-alt",
              isPrimary: false,
            },
          ],
        },
      ];
      const map = { "carol@e2e.realdata.test": "person-id-carol" };
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      const ids = resolved[0].identityUpsertsByEmail.map(
        (id) => id.where.personId_service.personId,
      );
      expect(ids).toEqual(["person-id-carol", "person-id-carol"]);
      // 전부 동일 값(set 크기 1).
      expect(new Set(ids).size).toBe(1);
    });

    it("net-0 update 보존 — personUpsert.update 에 email 부재(fullName/active 만)·identityUpsertsByEmail[*].update 에 service/externalId 부재(isPrimary 만)", () => {
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(validDescriptors()),
        validMap(),
      );

      for (const args of resolved) {
        expect(Object.keys(args.personUpsert.update).sort()).toEqual([
          "active",
          "fullName",
        ]);
        expect(args.personUpsert.update).not.toHaveProperty("email");
        for (const identity of args.identityUpsertsByEmail) {
          expect(Object.keys(identity.update)).toEqual(["isPrimary"]);
          expect(identity.update).not.toHaveProperty("service");
          expect(identity.update).not.toHaveProperty("externalId");
        }
      }
    });
  });

  describe("Record / Map 양쪽 arm — union map 형태 둘 다에서 happy-path 동작", () => {
    it("(d-record) Record map 으로 치환 정상 동작 — identity personId 가 실 id 로 치환", () => {
      const descriptors = validDescriptors();
      const recordMap: Record<string, string> = validMap();
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        recordMap,
      );

      expect(
        resolved[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(recordMap[descriptors[0].person.email]);
    });

    it("(d-map) Map map 으로 치환 정상 동작 + Record 결과와 deep-equal(arm 등가)", () => {
      const descriptors = validDescriptors();
      const recordMap = validMap();
      const mapMap = new Map(Object.entries(recordMap));

      const viaRecord = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        recordMap,
      );
      const viaMap = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        mapMap,
      );

      expect(viaMap).toEqual(viaRecord);
    });
  });

  describe("flow / branch — 빈 / 단일 / 다수 descriptor + identity 0 분기(분기별 분리)", () => {
    it("빈 descriptors → buildRealDataUpsertArgs([]) = [] → resolveRealDataPersonId([], map) = [](throw 0)", () => {
      const upsertArgsList = buildRealDataUpsertArgs([]);
      expect(upsertArgsList).toEqual([]);
      const resolved = resolveRealDataPersonId(upsertArgsList, validMap());
      expect(resolved).toEqual([]);
    });

    it("serviceIdentities 0개 descriptor → identityUpsertsByEmail 빈 배열로 통과(throw 0)", () => {
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
      const map = { "dave@e2e.realdata.test": "person-id-dave" };
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      expect(resolved).toHaveLength(1);
      expect(resolved[0].identityUpsertsByEmail).toEqual([]);
    });

    it("단일 descriptor → 길이 1 + identity personId 치환", () => {
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
      const map = { "eve@e2e.realdata.test": "person-id-eve" };
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      expect(resolved).toHaveLength(1);
      expect(
        resolved[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe("person-id-eve");
    });

    it("다수 descriptor → 각 Person 이 자기 email 의 id 를 받음(join 정합)", () => {
      const descriptors = validDescriptors();
      const map = validMap();
      const resolved = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      expect(resolved).toHaveLength(2);
      expect(
        resolved[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe("person-id-alice");
      expect(
        resolved[1].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe("person-id-bob");
    });
  });

  describe("negative cases — resolve 위임 throw 전파(컴포저 자체 try/catch 0)", () => {
    it("(a) emailToPersonId 에 descriptor email 키 누락 → 누락 email 포함 throw 전파", () => {
      const upsertArgsList = buildRealDataUpsertArgs(validDescriptors());
      // bob 의 email 키 누락.
      const partialMap = { "alice@e2e.realdata.test": "person-id-alice" };
      expect(() => resolveRealDataPersonId(upsertArgsList, partialMap)).toThrow(
        "bob@e2e.realdata.test",
      );
    });

    it("(b) map 의 person.id 값이 빈 문자열 → throw 전파", () => {
      const upsertArgsList = buildRealDataUpsertArgs(validDescriptors());
      const map = {
        "alice@e2e.realdata.test": "",
        "bob@e2e.realdata.test": "person-id-bob",
      };
      expect(() => resolveRealDataPersonId(upsertArgsList, map)).toThrow();
    });

    it("(c) map 의 person.id 값이 공백만 → throw 전파", () => {
      const upsertArgsList = buildRealDataUpsertArgs(validDescriptors());
      const map = {
        "alice@e2e.realdata.test": "   ",
        "bob@e2e.realdata.test": "person-id-bob",
      };
      expect(() => resolveRealDataPersonId(upsertArgsList, map)).toThrow();
    });

    it("(b-map) Map arm 에서도 빈 person.id → throw 전파", () => {
      const upsertArgsList = buildRealDataUpsertArgs(validDescriptors());
      const map = new Map<string, string>([
        ["alice@e2e.realdata.test", ""],
        ["bob@e2e.realdata.test", "person-id-bob"],
      ]);
      expect(() => resolveRealDataPersonId(upsertArgsList, map)).toThrow();
    });
  });

  describe("결정론 · 무공유 — 동일 (descriptors, map) 두 번 호출 + 입력 불변", () => {
    it("(d) 두 호출 deep-equal + 매 호출 새 객체 트리(종단 산출·중첩 personUpsert/identityUpsertsByEmail 참조 비동일)", () => {
      const descriptors = validDescriptors();
      const map = validMap();

      const a = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );
      const b = resolveRealDataPersonId(
        buildRealDataUpsertArgs(descriptors),
        map,
      );

      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].personUpsert).not.toBe(b[0].personUpsert);
      expect(a[0].identityUpsertsByEmail).not.toBe(b[0].identityUpsertsByEmail);
    });

    it("(e) no-mutation — 입력 descriptors·upsertArgsList(중간 산출)·emailToPersonId 가 호출 전후 deep-equal(mutate 0)", () => {
      const descriptors = validDescriptors();
      const map = validMap();
      const descriptorsBefore = JSON.parse(JSON.stringify(descriptors));
      const mapBefore = JSON.parse(JSON.stringify(map));

      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const upsertArgsListBefore = JSON.parse(JSON.stringify(upsertArgsList));

      resolveRealDataPersonId(upsertArgsList, map);

      expect(descriptors).toEqual(descriptorsBefore);
      expect(upsertArgsList).toEqual(upsertArgsListBefore);
      expect(map).toEqual(mapBefore);
    });
  });
});
