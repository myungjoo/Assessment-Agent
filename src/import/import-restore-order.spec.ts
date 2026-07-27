// import-restore-order.spec — T-1261. R-112 4 종 (happy / error / 분기 / negative 충분 cover) 을
// 신규 helper 2 심볼 (IMPORT_RESTORE_INSERT_ORDER 상수 + orderImportRestoreEntities) 에 대해 모두
// 커버한다. 순수 helper 라 DB · Prisma · fixture 0 — 상수/배열만으로 단언한다.
//
// 추가로 마지막 describe 는 **schema 사실 고정 test** 다 (round 2 nit closure, reviewer MINOR-1).
// production 의 INSERT_RANK 는 `prisma/schema.prisma` 의 FK 사실에서 도출한 파생물인데,
// `Record<ExportEntity, number>` 타입은 **entity 추가** 만 컴파일 error 로 잡고 기존 5 entity 사이에
// **새 FK edge 가 생기는 변화** 는 아무 test 도 잡지 못한다 (예: ADR-0044 §Follow-ups 가 예고한
// AuditLog 실 model 승격 후 그 model 이 Assessment 를 참조하면 현재 rank 로는 FK 위반인데 CI 는 계속
// green). 그래서 schema 원문을 직접 파싱해 export 5 model 사이의 직접 FK edge 집합을 단언한다.
import { readFileSync } from "fs";
import { join } from "path";

import {
  VALID_EXPORT_ENTITIES,
  type ExportEntity,
} from "../export/export-scope-select";

import {
  IMPORT_RESTORE_INSERT_ORDER,
  orderImportRestoreEntities,
} from "./import-restore-order";

// 타입 체크를 우회해 런타임 방어를 검증하기 위한 helper — 잘못된 입력을 그대로 전달한다.
function callWithAny(entities: unknown, phase: unknown): ExportEntity[] {
  return orderImportRestoreEntities(
    entities as ReadonlyArray<ExportEntity>,
    phase as "insert" | "delete",
  );
}

describe("IMPORT_RESTORE_INSERT_ORDER (FK 안전 삽입 순서 상수)", () => {
  it("5 entity 를 정확히 1 번씩 담는다 (누락·중복 0)", () => {
    expect(IMPORT_RESTORE_INSERT_ORDER).toHaveLength(5);
    expect(new Set(IMPORT_RESTORE_INSERT_ORDER).size).toBe(5);
  });

  it("VALID_EXPORT_ENTITIES 와 집합이 같다 (union 과 동일 멤버십)", () => {
    expect([...IMPORT_RESTORE_INSERT_ORDER].sort()).toEqual(
      [...VALID_EXPORT_ENTITIES].sort(),
    );
  });

  it("유일한 FK 제약인 Person < Assessment 를 만족한다", () => {
    const personIndex = IMPORT_RESTORE_INSERT_ORDER.indexOf("Person");
    const assessmentIndex = IMPORT_RESTORE_INSERT_ORDER.indexOf("Assessment");
    expect(personIndex).toBeGreaterThanOrEqual(0);
    expect(personIndex).toBeLessThan(assessmentIndex);
  });

  it("결정론적 고정 순서를 유지한다", () => {
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("동결돼 있어 push / index 대입이 원본을 바꾸지 못한다", () => {
    const before = [...IMPORT_RESTORE_INSERT_ORDER];
    const mutable = IMPORT_RESTORE_INSERT_ORDER as ExportEntity[];
    expect(Object.isFrozen(IMPORT_RESTORE_INSERT_ORDER)).toBe(true);
    expect(() => mutable.push("Person")).toThrow();
    expect(() => {
      mutable[0] = "Assessment";
    }).toThrow();
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual(before);
  });
});

describe("orderImportRestoreEntities — happy path", () => {
  it("뒤섞인 5 entity 입력을 insert 순서로 정렬한다", () => {
    const shuffled: ExportEntity[] = [
      "Assessment",
      "AuditLog",
      "Person",
      "LlmConfig",
      "Group",
    ];
    expect(orderImportRestoreEntities(shuffled, "insert")).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("같은 입력을 delete 로 부르면 정확히 insert 순서의 역순이다", () => {
    const shuffled: ExportEntity[] = [
      "Assessment",
      "AuditLog",
      "Person",
      "LlmConfig",
      "Group",
    ];
    expect(orderImportRestoreEntities(shuffled, "delete")).toEqual(
      [...IMPORT_RESTORE_INSERT_ORDER].reverse(),
    );
  });

  it("부분 집합 입력도 두 phase 각각 올바른 순서로 돌려준다", () => {
    const subset: ExportEntity[] = ["Assessment", "Person"];
    expect(orderImportRestoreEntities(subset, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(orderImportRestoreEntities(subset, "delete")).toEqual([
      "Assessment",
      "Person",
    ]);
  });

  it("입력에 없는 entity 는 결과에도 없다", () => {
    const result = orderImportRestoreEntities(["Group", "AuditLog"], "insert");
    expect(result).toEqual(["Group", "AuditLog"]);
    expect(result).not.toContain("Person");
  });
});

describe("orderImportRestoreEntities — 분기 cover", () => {
  it("(1) phase insert 분기 / (2) phase delete 분기 가 서로 역순이다", () => {
    const input: ExportEntity[] = ["Person", "Group", "Assessment"];
    const inserted = orderImportRestoreEntities(input, "insert");
    const deleted = orderImportRestoreEntities(input, "delete");
    expect(inserted).toEqual(["Person", "Group", "Assessment"]);
    expect(deleted).toEqual([...inserted].reverse());
  });

  it("(3) 빈 배열 입력은 두 phase 모두 빈 배열 (error 아님)", () => {
    expect(orderImportRestoreEntities([], "insert")).toEqual([]);
    expect(orderImportRestoreEntities([], "delete")).toEqual([]);
  });

  it("(4) 중복 원소 입력은 dedupe 된다", () => {
    const duplicated: ExportEntity[] = [
      "Person",
      "Person",
      "Assessment",
      "Person",
    ];
    expect(orderImportRestoreEntities(duplicated, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(orderImportRestoreEntities(duplicated, "delete")).toEqual([
      "Assessment",
      "Person",
    ]);
  });
});

describe("orderImportRestoreEntities — error path", () => {
  it("(5) entities 가 배열이 아니면 TypeError", () => {
    for (const invalid of [null, undefined, "Person", { 0: "Person" }, 42]) {
      expect(() => callWithAny(invalid, "insert")).toThrow(TypeError);
    }
  });

  it("배열 방어 메시지는 한국어이고 함수명을 포함한다", () => {
    expect(() => callWithAny(null, "insert")).toThrow(
      /orderImportRestoreEntities: entities 는 배열이어야 합니다/,
    );
  });

  it("(6) 원소가 5 literal 밖 값이면 index 를 담은 RangeError", () => {
    const invalidElements: unknown[] = [
      "person",
      "Part",
      "",
      null,
      undefined,
      42,
      {},
    ];
    for (const element of invalidElements) {
      expect(() => callWithAny([element], "insert")).toThrow(RangeError);
      expect(() => callWithAny([element], "insert")).toThrow(
        /entities\[0\] 는 export entity 5 종 중 하나여야 합니다/,
      );
    }
  });

  it("원소 방어 메시지는 위반 원소의 index 를 정확히 담는다", () => {
    expect(() => callWithAny(["Person", "Group", "part"], "delete")).toThrow(
      /orderImportRestoreEntities: entities\[2\] 는/,
    );
  });

  it("(7) phase 가 insert/delete 밖 값이면 RangeError", () => {
    for (const invalid of ["upsert", "", undefined, null, 42, {}]) {
      expect(() => callWithAny(["Person"], invalid)).toThrow(RangeError);
    }
    expect(() => callWithAny(["Person"], "upsert")).toThrow(
      /orderImportRestoreEntities: phase 는 insert\/delete 중 하나여야 합니다/,
    );
  });

  it("phase 방어가 entities 방어보다 먼저다 (잘못된 둘 다면 RangeError)", () => {
    expect(() => callWithAny(null, "upsert")).toThrow(RangeError);
  });
});

describe("orderImportRestoreEntities — negative cases", () => {
  it("입력 배열을 변형하지 않는다 (길이·원소 동일)", () => {
    const input: ExportEntity[] = ["Assessment", "Person", "Group"];
    const snapshot = [...input];
    orderImportRestoreEntities(input, "insert");
    orderImportRestoreEntities(input, "delete");
    expect(input).toEqual(snapshot);
  });

  it("Object.freeze 된 배열로 호출해도 통과한다", () => {
    const frozen = Object.freeze<ExportEntity[]>(["Assessment", "Person"]);
    expect(orderImportRestoreEntities(frozen, "insert")).toEqual([
      "Person",
      "Assessment",
    ]);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("반환 배열은 입력과 다른 참조이고, 변형해도 모듈 상수를 오염시키지 않는다", () => {
    const input: ExportEntity[] = ["Person", "Group"];
    const first = orderImportRestoreEntities(input, "insert");
    expect(first).not.toBe(input);
    first.push("Assessment");
    first[0] = "AuditLog";
    expect(IMPORT_RESTORE_INSERT_ORDER).toEqual([
      "Person",
      "Group",
      "LlmConfig",
      "AuditLog",
      "Assessment",
    ]);
  });

  it("두 번째 호출 결과가 첫 호출과 동일하다 (idempotent)", () => {
    const input: ExportEntity[] = ["AuditLog", "Person"];
    const first = orderImportRestoreEntities(input, "delete");
    const second = orderImportRestoreEntities(input, "delete");
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("연속 호출 사이에 phase 를 바꿔도 이전 결과가 오염되지 않는다", () => {
    const input: ExportEntity[] = ["Person", "Assessment"];
    const inserted = orderImportRestoreEntities(input, "insert");
    orderImportRestoreEntities(input, "delete");
    expect(inserted).toEqual(["Person", "Assessment"]);
  });

  it("원소 방어 실패 시 앞쪽 유효 원소의 부분 결과를 돌려주지 않고 throw 한다", () => {
    let result: ExportEntity[] | undefined;
    expect(() => {
      result = callWithAny(["Person", "Group", 42], "insert");
    }).toThrow(RangeError);
    expect(result).toBeUndefined();
  });

  it("중복 + 부분 집합 + 역순이 섞인 조합도 상수 순서의 부분 수열이다", () => {
    const messy: ExportEntity[] = [
      "Assessment",
      "Person",
      "Assessment",
      "LlmConfig",
      "Person",
    ];
    const result = orderImportRestoreEntities(messy, "insert");
    expect(result).toEqual(["Person", "LlmConfig", "Assessment"]);

    const indexes = result.map((entity) =>
      IMPORT_RESTORE_INSERT_ORDER.indexOf(entity),
    );
    expect(indexes).toEqual([...indexes].sort((left, right) => left - right));
  });
});

// ─── schema FK edge 고정 (round 2 nit closure — reviewer MINOR-1) ─────────────
// 아래 helper 들은 `prisma/schema.prisma` 원문을 읽어 model 사이의 **직접 FK edge** 집합을 뽑는다.
// 목적은 production 의 INSERT_RANK 근거 (= "export 5 entity 사이의 유일한 직접 FK 는
// Assessment.personId → Person") 를 test 로 고정하는 것 — schema 에 새 edge 가 생기면 아래 test 가
// fail 해 INSERT_RANK 재검토를 강제한다. DB 접속 0, Prisma client import 0 (schema 원문만 읽는다).

// ExportEntity → prisma model 이름 매핑. production 파일 머리 주석 (순서 근거 단락) 이 근거로 삼은
// 5 model 과 정확히 같은 대응이며, LlmConfig / AuditLog 두 개만 model 이름이 다르다
// (`export-entity-full-record-select.ts` 의 delegate 매핑과 동형).
const ENTITY_TO_PRISMA_MODEL: Readonly<Record<ExportEntity, string>> = {
  Person: "Person",
  Group: "Group",
  LlmConfig: "LlmProviderConfig",
  AuditLog: "PermissionDeniedRecord",
  Assessment: "Assessment",
};

// 주석 (`//` 이후) 을 걷어내고, `@relation(...)` 이 여러 줄에 걸쳐도 괄호 균형이 맞을 때까지 이어붙여
// "선언 1 개 = 문자열 1 개" 로 만든다. 줄바꿈 위치에 취약한 정규식이 되지 않게 하는 전처리다.
function normalizeDeclarations(lines: ReadonlyArray<string>): string[] {
  const declarations: string[] = [];
  let pending = "";
  for (const raw of lines) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (line === "") {
      continue;
    }
    const candidate = pending === "" ? line : `${pending} ${line}`;
    const opened = (candidate.match(/\(/g) ?? []).length;
    const closed = (candidate.match(/\)/g) ?? []).length;
    if (opened > closed) {
      pending = candidate;
      continue;
    }
    pending = "";
    declarations.push(candidate);
  }
  if (pending !== "") {
    declarations.push(pending);
  }
  return declarations;
}

// `model X { ... }` 블록을 model 이름 → 선언 목록으로 나눈다. prisma 의 model 블록은 중첩 `{}` 를
// 갖지 않으므로 단독 `}` 줄을 블록 종료로 본다.
function parsePrismaModelBlocks(schema: string): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  let current: string | null = null;
  let body: string[] = [];
  for (const line of schema.split(/\r?\n/)) {
    const opened = /^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(line);
    if (opened !== null) {
      current = opened[1];
      body = [];
      continue;
    }
    if (current === null) {
      continue;
    }
    if (/^\s*\}\s*$/.test(line)) {
      blocks.set(current, normalizeDeclarations(body));
      current = null;
      continue;
    }
    body.push(line);
  }
  return blocks;
}

// 선언 1 줄이 **FK 를 실제로 소유한** relation field 면 참조 대상 model 이름을, 아니면 null 을
// 돌려준다. Prisma 에서 FK column 을 드는 쪽은 `fields: [...]` + `references: [...]` 를 모두 가진
// `@relation` 이며, 역방향 field (`assessments Assessment[]`) 나 이름만 붙인 `@relation("...")`
// 은 FK 가 아니다 — 그래서 두 인자의 존재를 명시적으로 요구한다.
function referencedModelOf(declaration: string): string | null {
  const field =
    /^[A-Za-z_][A-Za-z0-9_]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\?|\[\])?\s+.*@relation\s*\(([\s\S]*)\)\s*$/.exec(
      declaration,
    );
  if (field === null) {
    return null;
  }
  const [, targetModel, args] = field;
  const owning =
    /\bfields\s*:\s*\[[^\]]*\]/.test(args) &&
    /\breferences\s*:\s*\[[^\]]*\]/.test(args);
  return owning ? targetModel : null;
}

// "From->To" 형태의 직접 FK edge 집합. `restrictTo` 를 주면 양끝이 모두 그 집합에 속한 edge 만 남긴다.
function collectDirectFkEdges(
  schema: string,
  restrictTo?: ReadonlySet<string>,
): string[] {
  const edges = new Set<string>();
  for (const [model, declarations] of parsePrismaModelBlocks(schema)) {
    for (const declaration of declarations) {
      const target = referencedModelOf(declaration);
      if (target === null) {
        continue;
      }
      if (
        restrictTo !== undefined &&
        (!restrictTo.has(model) || !restrictTo.has(target))
      ) {
        continue;
      }
      edges.add(`${model}->${target}`);
    }
  }
  return [...edges].sort();
}

describe("prisma/schema.prisma FK 사실 고정 (INSERT_RANK 의 근거)", () => {
  const schema = readFileSync(
    join(__dirname, "..", "..", "prisma", "schema.prisma"),
    "utf8",
  );
  const exportModels = new Set<string>(
    (Object.keys(ENTITY_TO_PRISMA_MODEL) as ExportEntity[]).map(
      (entity) => ENTITY_TO_PRISMA_MODEL[entity],
    ),
  );

  it("parser 가 export 5 entity 에 대응하는 model 블록을 모두 찾는다", () => {
    const blocks = parsePrismaModelBlocks(schema);
    expect(exportModels.size).toBe(5);
    for (const model of exportModels) {
      expect(blocks.has(model)).toBe(true);
    }
  });

  it("parser 가 vacuous 하지 않다 — 알려진 owning relation 을 실제로 잡아낸다", () => {
    const allEdges = collectDirectFkEdges(schema);
    // schema 에 명백히 존재하는 FK 들 — 이 단언이 깨지면 아래 edge 집합 test 가
    // "아무것도 못 찾아서 통과" 하는 위양성 상태라는 뜻이다.
    expect(allEdges).toEqual(
      expect.arrayContaining([
        "Assessment->Person",
        "Contribution->Assessment",
        "DifficultyMapping->LlmProviderConfig",
        "PersonGroupMembership->Person",
        "PersonGroupMembership->Group",
        "Person->Part",
      ]),
    );
  });

  it("export 5 model 사이의 직접 FK edge 는 정확히 Assessment->Person 1 개다", () => {
    // 🔒 INSERT_RANK 의 유일한 근거. 5 model 사이에 새 FK edge 가 생기면 (예: AuditLog 실 model
    // 승격 후 Assessment 참조) 본 단언이 fail 해 INSERT_RANK 재검토를 강제한다.
    expect(collectDirectFkEdges(schema, exportModels)).toEqual([
      "Assessment->Person",
    ]);
  });

  it("schema 의 FK edge 방향이 INSERT_RANK 순서와 정합이다 (참조 대상이 먼저 삽입)", () => {
    const rankOf = (model: string): number =>
      IMPORT_RESTORE_INSERT_ORDER.findIndex(
        (entity) => ENTITY_TO_PRISMA_MODEL[entity] === model,
      );
    const edges = collectDirectFkEdges(schema, exportModels);
    expect(edges.length).toBeGreaterThan(0);
    for (const edge of edges) {
      const [from, to] = edge.split("->");
      // 참조 대상 (to) 이 참조 주체 (from) 보다 insert rank 가 낮아야 FK 위반 없이 삽입된다.
      expect(rankOf(to)).toBeGreaterThanOrEqual(0);
      expect(rankOf(from)).toBeGreaterThanOrEqual(0);
      expect(rankOf(to)).toBeLessThan(rankOf(from));
    }
  });

  it("export 5 model 밖 model 을 향한 FK 는 edge 집합에서 제외된다", () => {
    // Person->Part 는 실재하지만 Part 가 export 대상 밖이라 순서 고려 대상이 아니다
    // (production 주석의 "Part 는 export 5 entity 밖" 근거 고정).
    const scoped = collectDirectFkEdges(schema, exportModels);
    expect(scoped).not.toContain("Person->Part");
    expect(collectDirectFkEdges(schema)).toContain("Person->Part");
  });

  it("negative — 역방향 relation / 이름만 붙은 @relation 은 FK edge 로 세지 않는다", () => {
    // 역방향 list field (FK 미소유).
    expect(referencedModelOf("assessments Assessment[]")).toBeNull();
    // 이름만 있는 @relation (fields/references 없음 — FK 미소유 측).
    expect(
      referencedModelOf('exportJobs ExportJob[] @relation("UserExportJobs")'),
    ).toBeNull();
    // scalar field / block attribute / 빈 문자열.
    expect(referencedModelOf("partId String?")).toBeNull();
    expect(referencedModelOf("@@unique([personId, period])")).toBeNull();
    expect(referencedModelOf("")).toBeNull();
    // 실제 schema 에서도 역방향 쪽 edge 는 생기지 않는다.
    const allEdges = collectDirectFkEdges(schema);
    expect(allEdges).not.toContain("Person->Assessment");
    expect(allEdges).not.toContain("Group->PersonGroupMembership");
  });

  it("owning relation 은 줄바꿈이 섞여도 파싱된다 (정규식 취약성 방지)", () => {
    const multiline = [
      "model Alpha {",
      "  betaId String",
      "  beta Beta @relation(",
      "    fields: [betaId],",
      "    references: [id],",
      "    onDelete: Cascade",
      "  )",
      "}",
    ].join("\n");
    expect(collectDirectFkEdges(multiline)).toEqual(["Alpha->Beta"]);
  });
});
