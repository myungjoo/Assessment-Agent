// realdata-e2e-seed-upsert-consistency.spec.ts — T-0715 colocated unit spec for
// `assertRealDataUpsertArgsConsistentWithDescriptors`.
//
// R-112 cover: happy(정합→void, 실 seed 2 항목 myungjoo/leemgs·빈 배열 쌍·
// serviceIdentities 0/1/N 합성 descriptor 각 분기) · 호출 격리(컴포저 spy 0 회 호출) ·
// 구조 결손(upsertArgsList/descriptors 비배열·null/undefined·길이 불일치·원소 비객체·
// personUpsert/identityUpsertsByEmail·하위 where/create/update 누락·descriptor.person·
// serviceIdentities 누락 → TypeError) · 값 정합 위반(negative ①~⑨ where.email·create·
// update 슬롯·net-0·placeholder·service·identity create·update·순서 drift → RangeError) ·
// flow/branch(TypeError↔RangeError·외층/내층 빈 배열 경계·다중 descriptor) · 비변형.
import { buildRealDataE2eSeed } from "./realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";
// composer 모듈 namespace import — 호출 격리 검증 test 가 buildRealDataUpsertArgs 를
// spy 로 감시하되, PERSON_ID_PLACEHOLDER 상수는 그대로 살아있어야 하므로 모듈 전체를
// mock 하지 않고 namespace 를 통해 spyOn 한다.
import * as seedUpsert from "./realdata-e2e-seed-upsert";
import {
  buildRealDataUpsertArgs,
  PERSON_ID_PLACEHOLDER,
  type RealDataUpsertArgs,
} from "./realdata-e2e-seed-upsert";
import { assertRealDataUpsertArgsConsistentWithDescriptors } from "./realdata-e2e-seed-upsert-consistency";

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

describe("assertRealDataUpsertArgsConsistentWithDescriptors", () => {
  describe("happy-path (정합 args↔descriptors → void)", () => {
    it("실 seed(myungjoo/leemgs) — 컴포저 산출 args 를 그대로 넘기면 throw 0(void)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).not.toThrow();
    });

    it("정합 쌍이면 void(undefined) 를 반환한다", () => {
      const descriptors = buildRealDataE2eSeed();
      expect(
        assertRealDataUpsertArgsConsistentWithDescriptors(
          buildRealDataUpsertArgs(descriptors),
          descriptors,
        ),
      ).toBeUndefined();
    });

    it("빈 배열 쌍([], []) — 외층 빈 배열 경계도 정합(void)", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors([], []),
      ).not.toThrow();
    });

    it("합성 descriptor(serviceIdentities 0/1/N) — 내층 빈/단일/다중 분기 정합(void)", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          buildRealDataUpsertArgs(SYNTH_DESCRIPTORS),
          SYNTH_DESCRIPTORS,
        ),
      ).not.toThrow();
    });
  });

  describe("호출 격리 — 가드는 buildRealDataUpsertArgs 를 재호출하지 않는다", () => {
    it("컴포저 spy 가 가드 호출 동안 0 회 호출됨(재호출 의존 시 양방향 drift 상쇄 gap)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors); // 가드 호출 전 산출
      const spy = jest.spyOn(seedUpsert, "buildRealDataUpsertArgs");
      try {
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors);
        expect(spy).toHaveBeenCalledTimes(0);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("구조 결손 — upsertArgsList/descriptors 비배열·null/undefined → TypeError", () => {
    it("upsertArgsList null → TypeError", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          null as unknown as RealDataUpsertArgs[],
          [],
        ),
      ).toThrow(TypeError);
    });

    it("upsertArgsList undefined → TypeError(메시지 노출)", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          undefined as unknown as RealDataUpsertArgs[],
          [],
        ),
      ).toThrow(/upsertArgsList 가 배열이 아니다/);
    });

    it("upsertArgsList 객체(비배열) → TypeError", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          {} as unknown as RealDataUpsertArgs[],
          [],
        ),
      ).toThrow(/upsertArgsList 가 배열이 아니다/);
    });

    it("descriptors null → TypeError", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          [],
          null as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(/descriptors 가 배열이 아니다/);
    });

    it("descriptors undefined → TypeError", () => {
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          [],
          undefined as unknown as RealDataSeedDescriptor[],
        ),
      ).toThrow(TypeError);
    });
  });

  describe("구조 결손 — 길이 불일치 → TypeError (negative ⑩)", () => {
    it("upsertArgsList 길이 ↔ descriptors 길이 불일치 → TypeError", () => {
      const descriptors = buildRealDataE2eSeed(); // 2 항목
      const args = buildRealDataUpsertArgs(descriptors).slice(0, 1); // 1 항목
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(/길이.*불일치/);
    });
  });

  describe("구조 결손 — 원소/슬롯 결손 → TypeError (negative ⑫⑬)", () => {
    it("upsertArgsList 원소가 객체 아님(null) → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = [null, args[1]] as unknown as RealDataUpsertArgs[];
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/upsertArgsList\[0\] 가 객체가 아니다/);
    });

    it("personUpsert 슬롯 누락 → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(JSON.stringify(args)) as RealDataUpsertArgs[];
      delete (broken[0] as unknown as Record<string, unknown>).personUpsert;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/personUpsert 슬롯이 누락/);
    });

    it("personUpsert.create 슬롯 누락 → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(JSON.stringify(args)) as RealDataUpsertArgs[];
      delete (broken[0].personUpsert as unknown as Record<string, unknown>)
        .create;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/personUpsert\.create 슬롯이 누락/);
    });

    it("identityUpsertsByEmail 슬롯이 배열 아님 → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(JSON.stringify(args)) as RealDataUpsertArgs[];
      (broken[0] as unknown as Record<string, unknown>).identityUpsertsByEmail =
        {};
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/identityUpsertsByEmail 슬롯이 누락됐거나 배열이 아니다/);
    });

    it("identityUpsertsByEmail[*] 원소가 객체 아님(null) → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(JSON.stringify(args)) as RealDataUpsertArgs[];
      (broken[0].identityUpsertsByEmail as unknown as unknown[])[0] = null;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/identityUpsertsByEmail\[0\] 가 객체가 아니다/);
    });

    it("identityUpsertsByEmail[*].where 슬롯 누락 → TypeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(JSON.stringify(args)) as RealDataUpsertArgs[];
      delete (
        broken[0].identityUpsertsByEmail[0] as unknown as Record<
          string,
          unknown
        >
      ).where;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(broken, descriptors),
      ).toThrow(/identityUpsertsByEmail\[0\]\.where 슬롯이 누락/);
    });

    it("descriptor 원소가 객체 아님(null) → TypeError (negative ⑬)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const brokenDescriptors = [
        null,
        descriptors[1],
      ] as unknown as RealDataSeedDescriptor[];
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(
          args,
          brokenDescriptors,
        ),
      ).toThrow(/descriptors\[0\] 가 객체가 아니다/);
    });

    it("descriptor.person 누락 → TypeError (negative ⑬)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(
        JSON.stringify(descriptors),
      ) as RealDataSeedDescriptor[];
      delete (broken[0] as unknown as Record<string, unknown>).person;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, broken),
      ).toThrow(/descriptors\[0\]\.person 슬롯이 누락/);
    });

    it("descriptor.serviceIdentities 누락 → TypeError (negative ⑬)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const broken = JSON.parse(
        JSON.stringify(descriptors),
      ) as RealDataSeedDescriptor[];
      delete (broken[0] as unknown as Record<string, unknown>)
        .serviceIdentities;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, broken),
      ).toThrow(/serviceIdentities 슬롯이 누락/);
    });
  });

  describe("값 정합 위반 — args drift → RangeError", () => {
    // makePair — 컴포저 실 산출 + 그 source descriptor 를 deep-clone 으로 분리해, args
    // 한쪽만 변조해도 descriptor 가 오염되지 않게 한다.
    function makePair(): {
      args: RealDataUpsertArgs[];
      descriptors: RealDataSeedDescriptor[];
    } {
      const descriptors = buildRealDataE2eSeed();
      const args = JSON.parse(
        JSON.stringify(buildRealDataUpsertArgs(descriptors)),
      ) as RealDataUpsertArgs[];
      return { args, descriptors };
    }

    it("① personUpsert.where.email drift → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].personUpsert.where.email = "drift@e2e.realdata.test";
      const run = () =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(/기대=.*실측=/s);
    });

    it("② personUpsert.create 슬롯 값 drift(fullName) → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].personUpsert.create.fullName = "drifted-name";
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("③ personUpsert.update 슬롯 값 drift(active) → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].personUpsert.update.active = false;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("④ personUpsert.update net-0 보존 위반(email 이 update 슬롯에 추가) → RangeError", () => {
      const { args, descriptors } = makePair();
      (
        args[0].personUpsert.update as unknown as Record<string, unknown>
      ).email = descriptors[0].person.email;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("⑤ identity where.personId_service.personId 가 placeholder 아님 → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].identityUpsertsByEmail[0].where.personId_service.personId =
        "real-id-1";
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("⑥ identity where.personId_service.service drift → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].identityUpsertsByEmail[0].where.personId_service.service =
        "gitlab.com";
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("⑦ identity create 슬롯 값 drift(externalId) → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].identityUpsertsByEmail[0].create.externalId = "drifted-login";
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("⑧ identity update 슬롯 값 drift(isPrimary) → RangeError", () => {
      const { args, descriptors } = makePair();
      args[0].identityUpsertsByEmail[0].update.isPrimary = false;
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("⑨ identity 순서 drift(N 개 identity 의 args 순서가 descriptor 와 어긋남) → RangeError", () => {
      const descriptors = [
        makeDescriptor("multi@e2e.realdata.test", [
          makeIdentity("first", true),
          makeIdentity("second", false),
        ]),
      ];
      const args = JSON.parse(
        JSON.stringify(buildRealDataUpsertArgs(descriptors)),
      ) as RealDataUpsertArgs[];
      // 내층 identity 2 개 순서 swap → descriptor 순서와 어긋남.
      args[0].identityUpsertsByEmail.reverse();
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).toThrow(RangeError);
    });

    it("descriptor 측 필드가 args 와 어긋나도 동일 RangeError(양방향 어느 쪽이든 노출)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const mismatched = JSON.parse(
        JSON.stringify(descriptors),
      ) as RealDataSeedDescriptor[];
      mismatched[0].person.fullName = "changed-only-in-descriptor";
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, mismatched),
      ).toThrow(RangeError);
    });
  });

  describe("결정성 / 비변형", () => {
    it("동일 정합 쌍 2 회 호출 → 둘 다 void", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).not.toThrow();
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).not.toThrow();
    });

    it("동일 drift 쌍 2 회 호출 → 둘 다 RangeError", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = JSON.parse(
        JSON.stringify(buildRealDataUpsertArgs(descriptors)),
      ) as RealDataUpsertArgs[];
      args[0].personUpsert.create.fullName = "drift";
      const run = () =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors);
      expect(run).toThrow(RangeError);
      expect(run).toThrow(RangeError);
    });

    it("가드 호출 전후 upsertArgsList·descriptors 객체 mutate 0 (deep-equal 불변)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const argsSnapshot = JSON.stringify(args);
      const descriptorsSnapshot = JSON.stringify(descriptors);
      assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors);
      expect(JSON.stringify(args)).toBe(argsSnapshot);
      expect(JSON.stringify(descriptors)).toBe(descriptorsSnapshot);
    });

    it("가드 호출 전후 입력 배열 참조 동등성 보존(새 배열 미할당)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      const argsRef = args;
      const descriptorsRef = descriptors;
      assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors);
      expect(args).toBe(argsRef);
      expect(descriptors).toBe(descriptorsRef);
    });

    it("PERSON_ID_PLACEHOLDER single-source 상수가 재유도에 반영됨(정합 source 와 동일 토큰)", () => {
      const descriptors = buildRealDataE2eSeed();
      const args = buildRealDataUpsertArgs(descriptors);
      // 정합 통과 = 재유도가 동일 placeholder 토큰을 썼다는 간접 증명.
      expect(
        args[0].identityUpsertsByEmail[0].where.personId_service.personId,
      ).toBe(PERSON_ID_PLACEHOLDER);
      expect(() =>
        assertRealDataUpsertArgsConsistentWithDescriptors(args, descriptors),
      ).not.toThrow();
    });
  });
});
