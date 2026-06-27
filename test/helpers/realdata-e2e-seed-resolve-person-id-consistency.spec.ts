// realdata-e2e-seed-resolve-person-id-consistency.spec.ts — T-0717 colocated unit spec
// for `assertRealDataResolvePersonIdConsistentWithInputs`.
//
// R-112 cover: happy(정합→void, 실 seed myungjoo/leemgs·Map 형태·Record 형태·빈 배열
// 쌍·identity 0/1/N 합성 args 각 분기) · 호출 격리(컴포저 spy 0 회 호출) · 구조 결손
// (resolved/upsertArgsList 비배열·null/undefined·길이 불일치·원소 비객체·personUpsert/
// identityUpsertsByEmail·하위 where/create/update·personId_service 누락·emailToPersonId
// 지원 형태 아님 → TypeError) · 값 정합 위반(negative ①~⑥ 치환 personId drift·잔존
// placeholder·service·personUpsert·identity create/update·순서 → RangeError) · email
// 매핑 누락/빈값(⑪ → TypeError) · flow/branch(TypeError↔RangeError·외층/내층 빈 배열
// 경계·Map/Record arm) · 비변형.
import {
  buildRealDataE2eSeed,
  type RealDataSeedDescriptor,
} from "./realdata-e2e-seed-fixture";
// composer 모듈 namespace import — 호출 격리 검증 test 가 resolveRealDataPersonId 를
// spy 로 감시하기 위함. 본 가드는 컴포저를 재호출하면 안 되므로 spy 가 0 회 호출됨을 단언.
import * as resolveModule from "./realdata-e2e-seed-resolve-person-id";
import {
  type PersonIdMap,
  resolveRealDataPersonId,
} from "./realdata-e2e-seed-resolve-person-id";
// consistency 모듈 namespace import — self-wire(T-0718) 배선 검증 test 가 컴포저의
// 가드 호출을 spyOn 으로 가로채기 위함. 컴포저는 top-level import 로 같은 CommonJS 모듈
// 캐시 객체를 로드하므로 본 spy 가 컴포저 내부 호출을 가로챈다.
import * as consistencyModule from "./realdata-e2e-seed-resolve-person-id-consistency";
import { assertRealDataResolvePersonIdConsistentWithInputs } from "./realdata-e2e-seed-resolve-person-id-consistency";
import {
  buildRealDataUpsertArgs,
  PERSON_ID_PLACEHOLDER,
  type RealDataUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// makeIdentity — 합성 ServiceIdentity seed 1 개.
function makeIdentity(
  externalId: string,
  isPrimary: boolean,
): RealDataSeedDescriptor["serviceIdentities"][number] {
  return { service: "github.com", externalId, isPrimary };
}

// makeDescriptor — 합성 Person + N 개 ServiceIdentity descriptor.
function makeDescriptor(
  email: string,
  identities: RealDataSeedDescriptor["serviceIdentities"],
): RealDataSeedDescriptor {
  return {
    person: { fullName: email.split("@")[0], email, active: true },
    serviceIdentities: identities,
  };
}

// buildIdMap — upsert-args 의 모든 email 에 결정론적 person.id 를 부여한 Map.
function buildIdMap(args: RealDataUpsertArgs[]): Map<string, string> {
  const map = new Map<string, string>();
  args.forEach((a, i) => {
    map.set(a.personUpsert.where.email, `person-id-${i + 1}`);
  });
  return map;
}

// buildIdRecord — 동일 매핑을 Record 형태로(Record arm cover 용).
function buildIdRecord(args: RealDataUpsertArgs[]): Record<string, string> {
  const record: Record<string, string> = {};
  args.forEach((a, i) => {
    record[a.personUpsert.where.email] = `person-id-${i + 1}`;
  });
  return record;
}

// 합성 descriptor — serviceIdentities 0/1/N 분기를 한 배열에 담아 외층 다중·내층 빈/
// 단일/다중 경계를 동시에 cover.
const SYNTH_DESCRIPTORS: RealDataSeedDescriptor[] = [
  makeDescriptor("zero@e2e.realdata.test", []), // 내층 빈 배열
  makeDescriptor("one@e2e.realdata.test", [makeIdentity("one", true)]), // 1 개
  makeDescriptor("many@e2e.realdata.test", [
    makeIdentity("many-a", true),
    makeIdentity("many-b", false),
  ]), // N 개
];

// buildResolvedPair — 컴포저로 정합 (resolved, upsertArgsList, map) 3 종을 산출한다.
// map 형태(Map | Record)를 인자로 받아 두 arm 을 동일 helper 로 생성.
function buildResolvedPair(
  descriptors: RealDataSeedDescriptor[],
  mapKind: "map" | "record" = "map",
): {
  resolved: RealDataUpsertArgs[];
  upsertArgsList: RealDataUpsertArgs[];
  map: PersonIdMap;
} {
  const upsertArgsList = buildRealDataUpsertArgs(descriptors);
  const map =
    mapKind === "map"
      ? buildIdMap(upsertArgsList)
      : buildIdRecord(upsertArgsList);
  const resolved = resolveRealDataPersonId(upsertArgsList, map);
  return { resolved, upsertArgsList, map };
}

// deepClone — JSON round-trip 으로 args 트리를 deep-clone(변조 격리용).
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("assertRealDataResolvePersonIdConsistentWithInputs", () => {
  describe("happy-path (정합 resolved↔입력 → void)", () => {
    it("실 seed(myungjoo/leemgs) Map 형태 — 컴포저 산출 resolved 를 그대로 넘기면 throw 0(void)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
    });

    it("실 seed Record 형태 — Record arm 도 정합(void)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
        "record",
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toBeUndefined();
    });

    it("빈 배열 쌍([], []) + 빈 map — 외층 빈 배열 경계도 정합(void)", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs([], [], new Map()),
      ).not.toThrow();
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs([], [], {}),
      ).not.toThrow();
    });

    it("합성 descriptor(identity 0/1/N) Map 형태 — 내층 빈/단일/다중 분기 정합(void)", () => {
      const { resolved, upsertArgsList, map } =
        buildResolvedPair(SYNTH_DESCRIPTORS);
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
    });

    it("합성 descriptor(identity 0/1/N) Record 형태 — Record arm × 내층 분기 정합(void)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        SYNTH_DESCRIPTORS,
        "record",
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
    });
  });

  describe("호출 격리 — 가드는 resolveRealDataPersonId 를 재호출하지 않는다", () => {
    it("컴포저 spy 가 가드 호출 동안 0 회 호출됨(재호출 의존 시 양방향 drift 상쇄 gap)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const spy = jest.spyOn(resolveModule, "resolveRealDataPersonId");
      try {
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        );
        expect(spy).toHaveBeenCalledTimes(0);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("구조 결손 — resolved/upsertArgsList 비배열·null/undefined → TypeError (negative ⑧)", () => {
    it("resolved null → TypeError", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          null as unknown as RealDataUpsertArgs[],
          [],
          new Map(),
        ),
      ).toThrow(/resolved 가 배열이 아니다/);
    });

    it("resolved undefined → TypeError", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          undefined as unknown as RealDataUpsertArgs[],
          [],
          new Map(),
        ),
      ).toThrow(TypeError);
    });

    it("resolved 객체(비배열) → TypeError", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          {} as unknown as RealDataUpsertArgs[],
          [],
          new Map(),
        ),
      ).toThrow(/resolved 가 배열이 아니다/);
    });

    it("upsertArgsList null → TypeError", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          [],
          null as unknown as RealDataUpsertArgs[],
          new Map(),
        ),
      ).toThrow(/upsertArgsList 가 배열이 아니다/);
    });

    it("upsertArgsList undefined → TypeError", () => {
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          [],
          undefined as unknown as RealDataUpsertArgs[],
          new Map(),
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구조 결손 — 길이 불일치 → TypeError (negative ⑦)", () => {
    it("resolved 길이 ↔ upsertArgsList 길이 불일치 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved.slice(0, 1),
          upsertArgsList,
          map,
        ),
      ).toThrow(/길이.*불일치/);
    });
  });

  describe("구조 결손 — emailToPersonId 지원 형태 아님 → TypeError (negative ⑩)", () => {
    it("emailToPersonId null → TypeError", () => {
      const { resolved, upsertArgsList } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          null as unknown as PersonIdMap,
        ),
      ).toThrow(/emailToPersonId 가 null\/undefined/);
    });

    it("emailToPersonId undefined → TypeError", () => {
      const { resolved, upsertArgsList } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          undefined as unknown as PersonIdMap,
        ),
      ).toThrow(TypeError);
    });

    it("emailToPersonId 가 primitive(string) → TypeError", () => {
      const { resolved, upsertArgsList } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          "not-a-map" as unknown as PersonIdMap,
        ),
      ).toThrow(/지원 형태/);
    });

    it("emailToPersonId 가 배열 → TypeError", () => {
      const { resolved, upsertArgsList } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          [] as unknown as PersonIdMap,
        ),
      ).toThrow(/지원 형태/);
    });
  });

  describe("구조 결손 — 원소/슬롯 결손 → TypeError (negative ⑨)", () => {
    it("upsertArgsList 원소가 객체 아님(null) → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = [
        null,
        upsertArgsList[1],
      ] as unknown as RealDataUpsertArgs[];
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/upsertArgsList\[0\] 가 객체가 아니다/);
    });

    it("resolved 원소가 객체 아님(null) → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = [null, resolved[1]] as unknown as RealDataUpsertArgs[];
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          broken,
          upsertArgsList,
          map,
        ),
      ).toThrow(/resolved\[0\] 가 객체가 아니다/);
    });

    it("upsertArgsList[0].personUpsert 슬롯 누락 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      delete (broken[0] as unknown as Record<string, unknown>).personUpsert;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/personUpsert 슬롯이 누락/);
    });

    it("upsertArgsList[0].personUpsert.where 슬롯 누락 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      delete (broken[0].personUpsert as unknown as Record<string, unknown>)
        .where;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/personUpsert\.where 슬롯이 누락/);
    });

    it("upsertArgsList[0].identityUpsertsByEmail 가 배열 아님 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      (broken[0] as unknown as Record<string, unknown>).identityUpsertsByEmail =
        {};
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/identityUpsertsByEmail 슬롯이 누락됐거나 배열이 아니다/);
    });

    it("upsertArgsList[0].identityUpsertsByEmail[*] 원소가 객체 아님(null) → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      (broken[0].identityUpsertsByEmail as unknown as unknown[])[0] = null;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/identityUpsertsByEmail\[0\] 가 객체가 아니다/);
    });

    it("upsertArgsList[0].identityUpsertsByEmail[*].where.personId_service 슬롯 누락 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      delete (
        broken[0].identityUpsertsByEmail[0].where as unknown as Record<
          string,
          unknown
        >
      ).personId_service;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/personId_service 슬롯이 누락/);
    });

    it("resolved[0].identityUpsertsByEmail[*].create 슬롯 누락 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(resolved);
      delete (
        broken[0].identityUpsertsByEmail[0] as unknown as Record<
          string,
          unknown
        >
      ).create;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          broken,
          upsertArgsList,
          map,
        ),
      ).toThrow(
        /resolved\[0\]\.identityUpsertsByEmail\[0\]\.create 슬롯이 누락/,
      );
    });

    it("upsertArgsList[0].personUpsert.where.email 이 문자열 아님 → TypeError", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const broken = deepClone(upsertArgsList);
      (
        broken[0].personUpsert.where as unknown as Record<string, unknown>
      ).email = 42;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          broken,
          map,
        ),
      ).toThrow(/email 이 문자열이 아니다/);
    });
  });

  describe("email 매핑 누락/빈값 → TypeError (negative ⑪)", () => {
    it("입력 args 의 email 이 map 에 없으면 누락 email 을 담아 TypeError", () => {
      const { resolved, upsertArgsList } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const email = upsertArgsList[0].personUpsert.where.email;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          new Map(),
        ),
      ).toThrow(new RegExp(email.replace(/[.@]/g, "\\$&")));
    });

    it("map 값이 빈 문자열이면 TypeError", () => {
      const descriptors = [makeDescriptor("blank@e2e.realdata.test", [])];
      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const resolved = deepClone(upsertArgsList);
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          new Map([["blank@e2e.realdata.test", ""]]),
        ),
      ).toThrow(/빈 값\/공백\/비문자열/);
    });

    it("map 값이 공백뿐이면 TypeError", () => {
      const descriptors = [makeDescriptor("ws@e2e.realdata.test", [])];
      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const resolved = deepClone(upsertArgsList);
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          new Map([["ws@e2e.realdata.test", "   "]]),
        ),
      ).toThrow(/빈 값\/공백\/비문자열/);
    });

    it("Record 의 inherited prototype 속성은 own-property 아님 → 누락 TypeError", () => {
      const descriptors = [makeDescriptor("proto@e2e.realdata.test", [])];
      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const resolved = deepClone(upsertArgsList);
      const proto = { "proto@e2e.realdata.test": "inherited-id" };
      const record: Record<string, string> = Object.create(proto);
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          record,
        ),
      ).toThrow(/proto@e2e\.realdata\.test/);
    });
  });

  describe("값 정합 위반 — resolved drift → RangeError", () => {
    // makeDriftable — 컴포저 정합 resolved 를 deep-clone 으로 분리해 한쪽만 변조해도
    // upsertArgsList 가 오염되지 않게 한다.
    function makeDriftable(): {
      resolved: RealDataUpsertArgs[];
      upsertArgsList: RealDataUpsertArgs[];
      map: PersonIdMap;
    } {
      const descriptors = [
        makeDescriptor("drift@e2e.realdata.test", [
          makeIdentity("d-a", true),
          makeIdentity("d-b", false),
        ]),
      ];
      const upsertArgsList = buildRealDataUpsertArgs(descriptors);
      const map = new Map([["drift@e2e.realdata.test", "real-id-7"]]);
      const resolved = deepClone(resolveRealDataPersonId(upsertArgsList, map));
      return { resolved, upsertArgsList, map };
    }

    it("① 치환된 personId drift(map 실값과 불일치) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail[0].where.personId_service.personId =
        "wrong-id";
      const run = () =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        );
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("② 치환 누락(resolved 가 여전히 placeholder 인데 map 에 실값 있음) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail[0].where.personId_service.personId =
        PERSON_ID_PLACEHOLDER;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("③ service 슬롯 보존 위반(where.personId_service.service drift) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail[0].where.personId_service.service =
        "gitlab.com";
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("④ personUpsert 슬롯 보존 위반(where.email drift) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].personUpsert.where.email = "tampered@e2e.realdata.test";
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("④ personUpsert.create 슬롯 보존 위반(fullName drift) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].personUpsert.create.fullName = "drifted-name";
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("⑤ identity create 슬롯 보존 위반(externalId drift) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail[0].create.externalId = "drifted-login";
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("⑤ identity update 슬롯 보존 위반(isPrimary drift) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail[0].update.isPrimary = false;
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("⑥ identity 순서 drift(resolved identity 순서가 입력과 어긋남) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail.reverse();
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });

    it("⑥ identity 개수 drift(resolved 가 identity 1 개 더 가짐) → RangeError", () => {
      const { resolved, upsertArgsList, map } = makeDriftable();
      resolved[0].identityUpsertsByEmail.push({
        where: {
          personId_service: { personId: "real-id-7", service: "github.com" },
        },
        create: {
          service: "github.com",
          externalId: "extra",
          isPrimary: false,
        },
        update: { isPrimary: false },
      });
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
      expect(() =>
        assertRealDataResolvePersonIdConsistentWithInputs(
          resolved,
          upsertArgsList,
          map,
        ),
      ).not.toThrow();
    });

    it("가드 호출 전후 resolved·upsertArgsList·map 객체 mutate 0 (deep-equal 불변)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const resolvedSnapshot = JSON.stringify(resolved);
      const upsertSnapshot = JSON.stringify(upsertArgsList);
      const mapSnapshot = JSON.stringify([...(map as Map<string, string>)]);
      assertRealDataResolvePersonIdConsistentWithInputs(
        resolved,
        upsertArgsList,
        map,
      );
      expect(JSON.stringify(resolved)).toBe(resolvedSnapshot);
      expect(JSON.stringify(upsertArgsList)).toBe(upsertSnapshot);
      expect(JSON.stringify([...(map as Map<string, string>)])).toBe(
        mapSnapshot,
      );
    });

    it("가드 호출 전후 입력 배열 참조 동등성 보존(새 배열 미할당)", () => {
      const { resolved, upsertArgsList, map } = buildResolvedPair(
        buildRealDataE2eSeed(),
      );
      const resolvedRef = resolved;
      const upsertRef = upsertArgsList;
      assertRealDataResolvePersonIdConsistentWithInputs(
        resolved,
        upsertArgsList,
        map,
      );
      expect(resolved).toBe(resolvedRef);
      expect(upsertArgsList).toBe(upsertRef);
    });
  });

  // ── self-wire(T-0718) — 값-정합 가드 컴포저 single-return 배선 ───────────────
  // 컴포저 `resolveRealDataPersonId` 가 단일 return 직전 값-정합 가드
  // assertRealDataResolvePersonIdConsistentWithInputs 를 self-assert 하는지 검증한다.
  // 컴포저는 top-level import 로 본 모듈을 로드하고 spec 도 namespace import 하므로 동일
  // CommonJS 모듈 캐시 객체를 가리킨다 — spyOn 이 컴포저 내부 가드 호출을 가로챈다(가드는
  // 컴포저로부터 type-only import 만 → 순환 의존 0, T-0716 lazy require 불요).
  describe("self-wire(T-0718) — 컴포저 single-return 값-정합 가드 배선", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // ① happy — 정상 입력에서 가드를 throw 0 으로 통과해 반환 트리가 self-wire 전 산출과
    //   deep-equal(byte-identical, 무회귀).
    it("① 정상 입력에서 가드를 throw 0 으로 통과해 치환 결과 트리를 반환한다(happy, 무회귀)", () => {
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);

      const resolved = resolveRealDataPersonId(upsertArgsList, map);

      // 자립 재유도(컴포저 미러링): 각 identity 의 personId 만 map 실값으로 치환.
      const expected = upsertArgsList.map((args) => {
        const personId = map.get(args.personUpsert.where.email);
        return {
          personUpsert: {
            where: { email: args.personUpsert.where.email },
            create: { ...args.personUpsert.create },
            update: { ...args.personUpsert.update },
          },
          identityUpsertsByEmail: args.identityUpsertsByEmail.map(
            (identity) => ({
              where: {
                personId_service: {
                  personId,
                  service: identity.where.personId_service.service,
                },
              },
              create: { ...identity.create },
              update: { ...identity.update },
            }),
          ),
        };
      });
      expect(resolved).toEqual(expected);
    });

    // ① happy(Record arm) — Record 형태 map + 빈 입력 배열 경계도 throw 0 으로 통과.
    it("① Record 형태 map·빈 입력 배열 경계도 가드 통과·정상 반환(throw 0, 경계)", () => {
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const record = buildIdRecord(upsertArgsList);
      expect(() =>
        resolveRealDataPersonId(upsertArgsList, record),
      ).not.toThrow();
      // 빈 입력 → 빈 배열 반환(throw 0).
      expect(resolveRealDataPersonId([], new Map())).toEqual([]);
      expect(resolveRealDataPersonId([], {})).toEqual([]);
    });

    // ② 호출 배선 검증(self-wire 발동 증명) — 정확히 1 회·(resolved, upsertArgsList,
    //   emailToPersonId) 인자로 단일 return 직전 호출. 미배선 회귀(import 만 추가하고 호출
    //   누락) 시 호출수 0 으로 fail.
    it("② 가드 호출 배선 — 정확히 1 회·(resolved, upsertArgsList, emailToPersonId) 인자로 호출(self-wire 발동 증명)", () => {
      const spy = jest.spyOn(
        consistencyModule,
        "assertRealDataResolvePersonIdConsistentWithInputs",
      );
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);

      const resolved = resolveRealDataPersonId(upsertArgsList, map);

      expect(spy).toHaveBeenCalledTimes(1);
      // 반환 트리·입력 배열·map 동일 참조를 인자로 받아야 한다(반환 직전 단언).
      expect(spy).toHaveBeenCalledWith(resolved, upsertArgsList, map);
      expect(spy.mock.calls[0][0]).toBe(resolved);
      expect(spy.mock.calls[0][1]).toBe(upsertArgsList);
      expect(spy.mock.calls[0][2]).toBe(map);
    });

    // ③ 값 가드 RangeError throw 전파 — 가드가 throw 하면 컴포저가 삼키지 않고 선전파
    //   (silent 통과 0, negative ① — 값 정합 위반).
    it("③ 값 가드 RangeError throw 전파 — 컴포저가 삼키지 않고 선전파(silent 통과 0, negative)", () => {
      const sentinel = new RangeError("값 정합 위반(테스트 주입)");
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResolvePersonIdConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw sentinel;
        });
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);

      expect(() => resolveRealDataPersonId(upsertArgsList, map)).toThrow(
        sentinel,
      );
    });

    // ④ 값 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관
    //   전파, negative ② — 구조 결손).
    it("④ 값 가드 TypeError(구조 결손 모사) throw 도 컴포저가 선전파한다(에러 종류 무관 전파, negative)", () => {
      jest
        .spyOn(
          consistencyModule,
          "assertRealDataResolvePersonIdConsistentWithInputs",
        )
        .mockImplementation(() => {
          throw new TypeError("구조 결손 모사");
        });
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);

      expect(() => resolveRealDataPersonId(upsertArgsList, map)).toThrow(
        "구조 결손 모사",
      );
    });

    // ⑤ 매핑 선throw(email 누락) → 값-정합 가드 미호출(분기 순서 보장, negative ③).
    //   컴포저는 가드 호출 전에 `.map` 안에서 email→id 조회를 수행하므로 누락 email 에서
    //   매핑 단계 throw 가 먼저 발생해 값 가드 도달 전에 전파된다. 값 가드 spy 호출수 0.
    it("⑤ 매핑 선throw(email 누락) — 값-정합 가드 미호출(분기 순서 보장, negative)", () => {
      const valueSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResolvePersonIdConsistentWithInputs",
      );
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);

      // map 이 비어 첫 원소 email 조회부터 매핑 throw → 가드 도달 전 선throw.
      expect(() => resolveRealDataPersonId(upsertArgsList, new Map())).toThrow(
        /매핑 누락/,
      );
      expect(valueSpy).not.toHaveBeenCalled();
    });

    // ⑤ 매핑 선throw(빈/공백 person.id) → 값-정합 가드 미호출(분기 순서 보장, negative).
    it("⑤ 매핑 선throw(빈/공백 person.id) — 값-정합 가드 미호출(분기 순서 보장, negative)", () => {
      const valueSpy = jest.spyOn(
        consistencyModule,
        "assertRealDataResolvePersonIdConsistentWithInputs",
      );
      const upsertArgsList = buildRealDataUpsertArgs([
        makeDescriptor("blank@e2e.realdata.test", [makeIdentity("b", true)]),
      ]);

      expect(() =>
        resolveRealDataPersonId(
          upsertArgsList,
          new Map([["blank@e2e.realdata.test", "   "]]),
        ),
      ).toThrow(/빈 값\/공백/);
      expect(valueSpy).not.toHaveBeenCalled();
    });

    // ⑥ 결정성 — self-wire 후에도 동일 입력 2 회 호출 → deep-equal 동일 트리(byte-identical).
    it("⑥ self-wire 후에도 동일 입력 2 회 호출 → deep-equal 동일 트리(결정성 보존)", () => {
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);

      const a = resolveRealDataPersonId(upsertArgsList, map);
      const b = resolveRealDataPersonId(upsertArgsList, map);

      expect(a).toEqual(b);
    });

    // ⑦ 비변형 — self-wire 후에도 입력 upsertArgsList·하위 트리 mutate 0(원본 placeholder 보존).
    it("⑦ self-wire 후에도 입력 upsertArgsList 와 하위 트리를 mutate 하지 않는다(비변형 보존)", () => {
      const upsertArgsList = buildRealDataUpsertArgs(SYNTH_DESCRIPTORS);
      const map = buildIdMap(upsertArgsList);
      const snapshot = JSON.stringify(upsertArgsList);

      resolveRealDataPersonId(upsertArgsList, map);

      expect(JSON.stringify(upsertArgsList)).toBe(snapshot);
      // 원본 placeholder 가 그대로 살아있다(치환 결과는 새 트리).
      const withIdentity = upsertArgsList.find(
        (a) => a.identityUpsertsByEmail.length > 0,
      );
      expect(
        withIdentity?.identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
    });
  });
});
