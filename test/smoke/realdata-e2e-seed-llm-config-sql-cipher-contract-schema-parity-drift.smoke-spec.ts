// realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts
// — 실 평가 e2e/deploy step③ `deploy/seed-llm-config.sh` 가 매 재배포 직후(redeploy.sh
// 31~34행 호출) 하드코딩한 세 계약 ↔ 실 build/runtime artifact parity 를, 양측 소스
// (shell + schema.prisma + cipher.ts + tsconfig)를 readFileSync/JSON.parse 로 읽어 정적
// 추출·cross-artifact 대조하는 drift-detection non-gated build-time smoke (T-0794 박제,
// PLAN.md 109행 🟢 실 평가 e2e/deploy step③).
//
// 본 spec 의 존재 이유 — seed-shell-contract ↔ build/runtime-artifact gap 해소:
//   `deploy/seed-llm-config.sh` 는 매 재배포마다 DB 의 `LlmProviderConfig` 행을 멱등
//   upsert 해 테스트 기기가 로컬 LLM endpoint(예: 같은 LAN 의 Ollama)를 쓰도록 보장한다
//   (REQ-051 custom provider 슬롯·REQ-061 운영 자동화). 이 seed shell 이 하드코딩한 세
//   계약은 **실 build/runtime artifact 와 정합해야만 재배포 직후 seed 가 silent 실패
//   없이 동작하는 운영 contract** 다:
//    1. SQL upsert 컬럼 계약(106~113행) — `INSERT INTO "LlmProviderConfig"
//       ("id","provider","endpointUrl","apiKey","modelId","createdAt","updatedAt")` 의
//       7-컬럼 튜플이 실 Prisma 모델 `LlmProviderConfig` 의 scalar 컬럼 집합과 set-equal
//       이어야 하고, `ON CONFLICT ("id") DO UPDATE SET` 의 5-컬럼 update 집합
//       (`provider`·`endpointUrl`·`apiKey`·`modelId`·`updatedAt`)이 멱등 보존 불변
//       (conflict key `id` 와 첫 생성 시각 `createdAt` 은 update 제외)을 지켜야 한다.
//    2. compiled cipher require-path 계약(91행) — `require("/app/dist/src/llm/
//       llm-apikey-cipher.service")` 의 `dist` prefix 가 `tsconfig.json` outDir(`./dist`)
//       basename 과 정합하고, 이후 경로 segment(`src/llm/llm-apikey-cipher.service`)가 실
//       파일 경로와 정합해야 한다(T-0793 박제 동형 dist prefix↔outDir 계약).
//    3. cipher API 계약(91행) — `new LlmApiKeyCipher().encrypt(d)` 의 class 명·메서드명이
//       실 TS class `LlmApiKeyCipher`(ADR-0014 AES-256-GCM envelope)의 export·메서드
//       시그니처와 정합해야 한다.
//
//   이 contract 는 origin/main 시점에 **검증 0 부재** 였다:
//      (1) daily-test smoke(T-0790 step_eval argv·T-0791 머신 JSON 스키마·T-0792 HTTP
//          step↔controller route)·docker-entrypoint smoke(T-0793 런타임 계약↔build
//          artifact)는 distinct surface 만 cover — seed-llm-config 의 SQL 컬럼↔schema·
//          cipher↔TS 대조 0.
//      (2) `test/prisma-schema.spec.ts` 는 `LlmProviderConfig` 를 FK Restrict 주석에서만
//          언급할 뿐 seed shell 의 SQL 컬럼 집합과 대조 0.
//      (3) CI 의 컨테이너 런타임 smoke(ci.yml)는 실 컨테이너 부팅이지 seed shell 텍스트↔
//          schema/cipher 의 정적 drift 를 잡지 않고, redeploy.sh 가 seed 실패를 경고만
//          하고 계속 진행하므로 재배포가 깨지지도 않아 silent 하다.
//   본 spec 은 그 빈 자리를 메운다 — `deploy/seed-llm-config.sh` + `prisma/schema.prisma`
//   + `src/llm/llm-apikey-cipher.service.ts` + `tsconfig.json` 4 소스를 readFileSync/
//   JSON.parse 로 읽어 (a) shell 측 세 계약(INSERT 컬럼 튜플·ON CONFLICT update 집합·
//   require-path·encrypt class/method)을 추출, (b) artifact 측(schema scalar 컬럼 집합·
//   cipher export class/method·tsconfig outDir)을 추출해 (c) INSERT==schema set-equal·
//   ON CONFLICT==INSERT\{id,createdAt} 멱등 불변·dist prefix==outDir basename·class/method
//   byte-identical 을 단언한다. 이 contract 가 drift 하면(schema 컬럼 추가/rename·
//   ON CONFLICT 에 id 포함·outDir 변경·cipher class/method rename) 재배포 직후 seed 가
//   silent crash 하고 평가 orchestrator 가 참조할 `seed-local-llm` config 가 누락된다.
//
//      🔥 실 LLM 호출·실 docker compose exec·실 prisma upsert·실 cipher encrypt·실 DB·
//         실 postgres 0 — 파일 read + 정적 텍스트/JSON 추출 + 합성 문자열/객체만. shell·
//         schema·cipher·tsconfig 소스는 읽기만(실행/build/부팅/encrypt/import 0).
//      🔥 NestJS module/class import 0 / `@prisma/client` import 0 — readFileSync/
//         JSON.parse 텍스트·JSON read only, DI/DB/컨테이너/LLM 의존 0.
//      🔥 process.env 읽기 0 / gating 분기 0 — non-gated 항상 실행(describe.skip 0).
//      🔥 live-LLM gate(PLAN.md 108행 🔴 BLOCKED) 경계 준수 — 실 LLM endpoint 호출·실
//         apiKey 암호화·실 DB write 0. credential 0 — 세 계약은 컬럼·경로·class/method
//         토큰만 운반. SEED_LLM_API_KEY·LLM_APIKEY_ENC_KEY 등은 env 변수명일 뿐 값 추출/
//         단언 surface 미포함(§9).
//      🔥 새 외부 dependency 0 — node 내장(`fs`/`path`) import 만.
//
// Out of Scope (T-0794):
//   - src 변경 0 — test-only. schema/cipher/tsconfig 는 readFileSync/JSON.parse read 만.
//   - `deploy/seed-llm-config.sh` 변경 0 — readFileSync 로 읽기만(drift 발견 시 별도 fix task).
//   - 실 LLM endpoint 호출/실 apiKey 암호화/실 docker compose exec/실 prisma upsert/실 DB write 0.
//   - SQL VALUES 절 실 값 바인딩(`$ID_E`·`sql_escape`) 검증 0 — 컬럼 집합 정합·멱등 불변만.
//   - nest build 의 `dist/src/llm/llm-apikey-cipher.service.js` 실 emit 검증 0 — require-path
//     의 `dist` prefix↔outDir basename + `src/llm/...` segment↔실 파일 경로 정합만 정적 단언.
//   - daily-test argv/JSON/HTTP(T-0790~92)·docker-entrypoint runtime-contract(T-0793) 재단언 0
//     — distinct surface(seed-SQL↔schema·cipher↔TS).
//   - 새 helper 모듈 신설 0(`test/helpers/` 변경 0) — spec 로컬 보조 함수만 허용.
import { readFileSync } from "fs";
import * as path from "path";

// repo-root 경로 — test 실행 cwd 무관하게 robust 하게 해석(`__dirname` = test/smoke,
// 두 단계 위가 repo-root). `process.cwd()` 대신 `__dirname` 기준 상대로 고정한다.
const REPO_ROOT = path.resolve(__dirname, "../..");
const SEED_SHELL_PATH = path.join(REPO_ROOT, "deploy/seed-llm-config.sh");
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma");
const CIPHER_PATH = path.join(
  REPO_ROOT,
  "src/llm/llm-apikey-cipher.service.ts",
);
const TSCONFIG_PATH = path.join(REPO_ROOT, "tsconfig.json");

// ---------------------------------------------------------------------------
// 타입 정의 — shell·artifact 양측에서 추출한 계약/artifact 의 정규형.
// ---------------------------------------------------------------------------

// seed-llm-config.sh 가 운반하는 세 계약의 정규형.
//   · insertColumns: INSERT INTO "LlmProviderConfig" 의 7-컬럼 튜플(순서 보존)
//   · onConflictColumns: ON CONFLICT DO UPDATE SET 의 update 컬럼 집합(5개)
//   · cipherRequirePath: require("/app/dist/src/llm/llm-apikey-cipher.service") 의 경로
//   · cipherClassName: new LlmApiKeyCipher() 의 class 명
//   · cipherMethodName: .encrypt(d) 의 호출 메서드명
interface ShellSeedContract {
  insertColumns: string[] | null;
  onConflictColumns: string[] | null;
  cipherRequirePath: string | null;
  cipherClassName: string | null;
  cipherMethodName: string | null;
}

// cipher 파일(src/llm/llm-apikey-cipher.service.ts) export 의 정규형.
interface CipherExport {
  className: string | null; // export class <name>
  hasEncryptMethod: boolean; // encrypt(<...>): <...> 시그니처 존재
}

// ---------------------------------------------------------------------------
// shell 측 추출 — seed-llm-config.sh 의 세 계약(SQL 컬럼·require-path·cipher API).
// ---------------------------------------------------------------------------

// shell 106행 `INSERT INTO "LlmProviderConfig" ("id","provider",...,"updatedAt")` 의
// 괄호 안 따옴표 컬럼 튜플을 순서 보존 배열로 추출한다. 못 찾으면 null(호출측 단언).
function extractInsertColumns(shellSource: string): string[] | null {
  // INSERT INTO "LlmProviderConfig" (...) 의 첫 괄호 그룹.
  const match = shellSource.match(
    /INSERT\s+INTO\s+"LlmProviderConfig"\s*\(([^)]*)\)/,
  );
  if (!match) {
    return null;
  }
  // 괄호 안 `"id","provider",...` 에서 따옴표 사이 식별자만 추출.
  const cols = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return cols.length > 0 ? cols : null;
}

// shell 108~113행 `ON CONFLICT ("id") DO UPDATE SET "provider"=..., ... "updatedAt"=NOW()`
// 의 update 대상 컬럼(LHS `"col" =`)만 추출한다 — RHS(EXCLUDED."provider"·NOW())는 제외.
// 못 찾으면 null.
function extractOnConflictColumns(shellSource: string): string[] | null {
  // ON CONFLICT (...) DO UPDATE SET <block> ; 의 SET 블록 슬라이스.
  const match = shellSource.match(
    /ON\s+CONFLICT\s*\(\s*"[^"]+"\s*\)\s*DO\s+UPDATE\s+SET([\s\S]*?);/,
  );
  if (!match) {
    return null;
  }
  // SET 블록에서 `"col" =`(LHS 만, RHS 의 EXCLUDED."col" 은 `=` 뒤라 미매칭) 추출.
  const cols = [...match[1].matchAll(/"([^"]+)"\s*=/g)].map((m) => m[1]);
  return cols.length > 0 ? cols : null;
}

// shell 91행 `require("/app/dist/src/llm/llm-apikey-cipher.service")` 의 require 경로를
// 추출한다(작은따옴표/큰따옴표 모두 수용). 못 찾으면 null.
function extractCipherRequirePath(shellSource: string): string | null {
  const match = shellSource.match(/require\(\s*["']([^"']+)["']\s*\)/);
  return match ? match[1] : null;
}

// shell 91행 `new LlmApiKeyCipher()` 의 class 명을 추출한다. 못 찾으면 null.
function extractCipherClassName(shellSource: string): string | null {
  const match = shellSource.match(/new\s+([A-Za-z_$][\w$]*)\s*\(/);
  return match ? match[1] : null;
}

// shell 91행 `new LlmApiKeyCipher().encrypt(d)` 의 호출 메서드명(`encrypt`)을 추출한다.
// `new <Class>().<method>(` 패턴의 method 토큰. 못 찾으면 null.
function extractCipherMethodName(shellSource: string): string | null {
  const match = shellSource.match(
    /new\s+[A-Za-z_$][\w$]*\s*\(\s*\)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/,
  );
  return match ? match[1] : null;
}

// shell 측 세 계약을 정규형(ShellSeedContract)으로 추출한다.
function extractShellSeedContract(shellSource: string): ShellSeedContract {
  return {
    insertColumns: extractInsertColumns(shellSource),
    onConflictColumns: extractOnConflictColumns(shellSource),
    cipherRequirePath: extractCipherRequirePath(shellSource),
    cipherClassName: extractCipherClassName(shellSource),
    cipherMethodName: extractCipherMethodName(shellSource),
  };
}

// require-path(`/app/dist/src/llm/llm-apikey-cipher.service`)의 `dist` segment(첫 dist
// 토큰)를 추출한다 — outDir basename 정합 대조용. 못 찾으면 null.
function extractRequirePathDistPrefix(
  requirePath: string | null,
): string | null {
  if (!requirePath) {
    return null;
  }
  const segs = requirePath.replace(/^\/+/, "").split("/");
  const distIdx = segs.indexOf("dist");
  return distIdx >= 0 ? segs[distIdx] : null;
}

// require-path 에서 `dist` 이후 경로 segment(`src/llm/llm-apikey-cipher.service`)를
// 추출한다 — 실 cipher 파일 경로(확장자 제거 형태)와 정합 대조용. 못 찾으면 null.
function extractRequirePathModuleSegment(
  requirePath: string | null,
): string | null {
  if (!requirePath) {
    return null;
  }
  const segs = requirePath.replace(/^\/+/, "").split("/");
  const distIdx = segs.indexOf("dist");
  if (distIdx < 0 || distIdx === segs.length - 1) {
    return null;
  }
  return segs.slice(distIdx + 1).join("/");
}

// ---------------------------------------------------------------------------
// artifact 측 추출 — schema scalar 컬럼 / cipher export / tsconfig outDir.
// ---------------------------------------------------------------------------

// schema.prisma 텍스트에서 `model LlmProviderConfig { ... }` 블록의 scalar 컬럼 집합을
// 추출한다 — relation 필드(`difficultyMappings DifficultyMapping[]` 처럼 대문자로 시작하는
// 모델 타입·list `[]`)는 제외. `@prisma/client` import 0, 순수 텍스트 슬라이스. 못 찾으면 null.
function extractSchemaScalarColumns(schemaSource: string): string[] | null {
  // model LlmProviderConfig { ... } 블록 슬라이스(첫 닫는 중괄호까지 — 본 모델은 중첩 0).
  const blockMatch = schemaSource.match(
    /model\s+LlmProviderConfig\s*\{([\s\S]*?)\}/,
  );
  if (!blockMatch) {
    return null;
  }
  const body = blockMatch[1];
  const columns: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    // 빈 줄·주석 줄 skip.
    if (line.length === 0 || line.startsWith("//")) {
      continue;
    }
    // `<fieldName> <Type> ...` 형태에서 필드명·타입 토큰 추출.
    const fieldMatch = line.match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)(\[\])?/);
    if (!fieldMatch) {
      continue;
    }
    const fieldName = fieldMatch[1];
    const fieldType = fieldMatch[2];
    const isList = fieldMatch[3] === "[]";
    // relation 판정: list(`[]`) 이거나 타입이 대문자로 시작하는 사용자 model 타입.
    // scalar 타입(String·Int·DateTime·Boolean·Float·Json·Bytes·BigInt·Decimal)만 컬럼.
    const SCALAR_TYPES = new Set([
      "String",
      "Int",
      "BigInt",
      "Float",
      "Decimal",
      "Boolean",
      "DateTime",
      "Json",
      "Bytes",
    ]);
    if (isList || !SCALAR_TYPES.has(fieldType)) {
      continue;
    }
    columns.push(fieldName);
  }
  return columns.length > 0 ? columns : null;
}

// cipher 파일(src/llm/llm-apikey-cipher.service.ts) 텍스트에서 `export class <Name>` 의
// class 명과 `encrypt(<...>): <...>` 메서드 시그니처 존재 여부를 추출한다. 순수 텍스트 read.
function extractCipherExport(cipherSource: string): CipherExport {
  const classMatch = cipherSource.match(/export\s+class\s+([A-Za-z_$][\w$]*)/);
  // `encrypt(plaintext: string): string` 같은 메서드 시그니처 존재 여부.
  const hasEncrypt = /\bencrypt\s*\([^)]*\)\s*:\s*\w/.test(cipherSource);
  return {
    className: classMatch ? classMatch[1] : null,
    hasEncryptMethod: hasEncrypt,
  };
}

// tsconfig(JSON.parse 결과)에서 compilerOptions.outDir 의 basename(`dist`)을 추출한다.
// `"./dist"` → `dist`. 못 찾으면 null.
function extractTsconfigOutDirBasename(tsconfig: {
  compilerOptions?: { outDir?: string };
}): string | null {
  const outDir = tsconfig.compilerOptions?.outDir;
  if (typeof outDir !== "string" || outDir.length === 0) {
    return null;
  }
  const segs = outDir
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter((s) => s.length > 0 && s !== ".");
  return segs.length > 0 ? segs[segs.length - 1] : null;
}

// ---------------------------------------------------------------------------
// 멱등 보존 불변 판정 — ON CONFLICT update 집합이 INSERT \ {id, createdAt} 인지.
// ---------------------------------------------------------------------------

// 정렬 후 deep-equal 비교를 위한 set 정규화(중복 제거 + 정렬).
function normalizedSet(cols: string[]): string[] {
  return [...new Set(cols)].sort();
}

// ON CONFLICT update 집합이 멱등 upsert 보존 불변을 지키는지 판정한다:
//   (a) update 집합 ⊆ INSERT 집합, AND
//   (b) update 집합 == INSERT 집합 \ {id, createdAt}(conflict key·첫 생성 시각 제외).
// id 나 createdAt 가 update 에 포함되면 멱등성/생성시각 보존이 깨지므로 false.
function isIdempotentUpdateSet(
  insertColumns: string[],
  onConflictColumns: string[],
): boolean {
  const insertSet = new Set(insertColumns);
  // (a) update ⊆ insert.
  for (const c of onConflictColumns) {
    if (!insertSet.has(c)) {
      return false;
    }
  }
  // (b) update == insert \ {id, createdAt}.
  const expected = normalizedSet(
    insertColumns.filter((c) => c !== "id" && c !== "createdAt"),
  );
  const actual = normalizedSet(onConflictColumns);
  if (expected.length !== actual.length) {
    return false;
  }
  return expected.every((c, i) => c === actual[i]);
}

// ---------------------------------------------------------------------------
// 본 spec 이 박제하는 contract 정본 — shell·artifact 양측이 수렴해야 하는 기대값.
// ---------------------------------------------------------------------------

const EXPECTED_INSERT_COLUMNS = [
  "id",
  "provider",
  "endpointUrl",
  "apiKey",
  "modelId",
  "createdAt",
  "updatedAt",
];
const EXPECTED_ON_CONFLICT_COLUMNS = [
  "provider",
  "endpointUrl",
  "apiKey",
  "modelId",
  "updatedAt",
];
const EXPECTED_CIPHER_REQUIRE_PATH =
  "/app/dist/src/llm/llm-apikey-cipher.service";
const EXPECTED_DIST_PREFIX = "dist";
const EXPECTED_CIPHER_MODULE_SEGMENT = "src/llm/llm-apikey-cipher.service";
const EXPECTED_CIPHER_CLASS = "LlmApiKeyCipher";
const EXPECTED_CIPHER_METHOD = "encrypt";

describe("realdata-e2e/deploy step③ seed-llm-config.sh 멱등 upsert 계약(SQL 컬럼 집합·compiled cipher require-path/API) ↔ 실 build/runtime artifact(Prisma LlmProviderConfig·TS cipher class·tsconfig outDir) parity drift smoke (T-0794)", () => {
  describe("Happy-path: shell + build/runtime artifact 소스 read + 계약/artifact 추출", () => {
    it("실 seed-llm-config.sh + schema.prisma + cipher.ts + tsconfig.json 4 소스를 읽어 shell 세 계약·artifact 를 비어있지 않게 추출한다", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
      const cipherSource = readFileSync(CIPHER_PATH, "utf8");
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));

      // shell 측 세 계약이 비어있지 않게 추출됨.
      const contract = extractShellSeedContract(shellSource);
      expect(contract.insertColumns).toBeTruthy();
      expect(contract.insertColumns?.length).toBe(7);
      expect(contract.onConflictColumns).toBeTruthy();
      expect(contract.onConflictColumns?.length).toBe(5);
      expect(contract.cipherRequirePath).toBeTruthy();
      expect(contract.cipherClassName).toBeTruthy();
      expect(contract.cipherMethodName).toBeTruthy();

      // artifact 측 추출이 비어있지 않음.
      const scalarCols = extractSchemaScalarColumns(schemaSource);
      expect(scalarCols).toBeTruthy();
      expect(scalarCols?.length).toBe(7);
      const cipherExport = extractCipherExport(cipherSource);
      expect(cipherExport.className).toBeTruthy();
      expect(cipherExport.hasEncryptMethod).toBe(true);
      expect(extractTsconfigOutDirBasename(tsconfig)).toBeTruthy();
    });

    it("repo-root 경로가 __dirname 기준으로 robust 하게 해석되어 4 소스가 실재한다", () => {
      // cwd 무관 — __dirname 기준 상대(path.resolve)로 해석한 경로가 실제 파일을 가리킨다.
      expect(readFileSync(SEED_SHELL_PATH, "utf8")).toContain(
        'INSERT INTO "LlmProviderConfig"',
      );
      expect(readFileSync(SEED_SHELL_PATH, "utf8")).toContain(
        'require("/app/dist/src/llm/llm-apikey-cipher.service")',
      );
      expect(readFileSync(SCHEMA_PATH, "utf8")).toContain(
        "model LlmProviderConfig {",
      );
      expect(readFileSync(CIPHER_PATH, "utf8")).toContain(
        "export class LlmApiKeyCipher",
      );
      expect(readFileSync(TSCONFIG_PATH, "utf8")).toContain(
        '"outDir": "./dist"',
      );
    });
  });

  describe("INSERT 컬럼 튜플 ↔ schema scalar 컬럼 set-equal 수렴(핵심 불변식 1)", () => {
    it("shell INSERT 의 7-컬럼 튜플이 schema LlmProviderConfig scalar 컬럼 집합과 set-equal(relation difficultyMappings 제외)", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");

      const insertColumns = extractInsertColumns(shellSource);
      const scalarColumns = extractSchemaScalarColumns(schemaSource);
      expect(insertColumns).not.toBeNull();
      expect(scalarColumns).not.toBeNull();

      // INSERT 튜플은 정본과 byte-identical(순서 포함).
      expect(insertColumns).toEqual(EXPECTED_INSERT_COLUMNS);

      // set-equal(정렬 후 deep-equal) — schema scalar 추출이 relation 을 정확히 제외.
      expect(normalizedSet(insertColumns as string[])).toEqual(
        normalizedSet(scalarColumns as string[]),
      );

      // relation 필드 difficultyMappings 는 scalar 집합에 미포함.
      expect(scalarColumns).not.toContain("difficultyMappings");
    });
  });

  describe("ON CONFLICT update 집합 멱등 보존 불변 수렴(핵심 불변식 2)", () => {
    it("shell ON CONFLICT update 5-컬럼이 INSERT 집합의 부분집합 AND 정확히 INSERT \\ {id, createdAt}", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");

      const insertColumns = extractInsertColumns(shellSource) as string[];
      const onConflictColumns = extractOnConflictColumns(
        shellSource,
      ) as string[];

      // update 집합이 정본과 set-equal.
      expect(normalizedSet(onConflictColumns)).toEqual(
        normalizedSet(EXPECTED_ON_CONFLICT_COLUMNS),
      );

      // (a)(b) 멱등 보존 불변: update ⊆ insert AND update == insert \ {id, createdAt}.
      expect(isIdempotentUpdateSet(insertColumns, onConflictColumns)).toBe(
        true,
      );

      // conflict key id 와 첫 생성 시각 createdAt 은 update 에서 제외.
      expect(onConflictColumns).not.toContain("id");
      expect(onConflictColumns).not.toContain("createdAt");
      // updatedAt 은 매 upsert NOW() 갱신 — update 집합에 포함되어야 함.
      expect(onConflictColumns).toContain("updatedAt");
    });
  });

  describe("compiled cipher require-path ↔ tsconfig outDir + 파일 경로 정합 수렴(핵심 불변식 3)", () => {
    it("shell require-path 의 dist prefix 가 tsconfig outDir basename 과 정합 AND dist 이후 segment 가 실 cipher 파일 경로와 정합", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));

      const requirePath = extractCipherRequirePath(shellSource);
      expect(requirePath).toBe(EXPECTED_CIPHER_REQUIRE_PATH);

      // (a) dist prefix == tsconfig outDir basename(outDir 변경 drift 검출).
      const distPrefix = extractRequirePathDistPrefix(requirePath);
      const outDirBasename = extractTsconfigOutDirBasename(tsconfig);
      expect(distPrefix).toBe(EXPECTED_DIST_PREFIX);
      expect(outDirBasename).toBe(EXPECTED_DIST_PREFIX);
      expect(distPrefix).toBe(outDirBasename);

      // (b) dist 이후 segment == 실 cipher 파일 경로(확장자 제거 형태).
      const moduleSegment = extractRequirePathModuleSegment(requirePath);
      expect(moduleSegment).toBe(EXPECTED_CIPHER_MODULE_SEGMENT);
      // 실 파일(src/llm/llm-apikey-cipher.service.ts)의 확장자 제거형이 require segment 와 정합.
      const cipherRelToRepo = path
        .relative(REPO_ROOT, CIPHER_PATH)
        .split(path.sep)
        .join("/")
        .replace(/\.ts$/, "");
      expect(cipherRelToRepo).toBe(moduleSegment);
    });
  });

  describe("cipher API(class·메서드) 정합 수렴(핵심 불변식 4)", () => {
    it("shell new LlmApiKeyCipher().encrypt() 의 class 명·메서드명이 실 cipher export class·encrypt 메서드와 byte-identical", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const cipherSource = readFileSync(CIPHER_PATH, "utf8");

      const shellClass = extractCipherClassName(shellSource);
      const shellMethod = extractCipherMethodName(shellSource);
      const cipherExport = extractCipherExport(cipherSource);

      // class 명 byte-identical(class rename drift 검출).
      expect(shellClass).toBe(EXPECTED_CIPHER_CLASS);
      expect(cipherExport.className).toBe(EXPECTED_CIPHER_CLASS);
      expect(shellClass).toBe(cipherExport.className);

      // 메서드명 정합 AND cipher 파일에 encrypt 시그니처 존재(method rename drift 검출).
      expect(shellMethod).toBe(EXPECTED_CIPHER_METHOD);
      expect(cipherExport.hasEncryptMethod).toBe(true);
      expect(cipherSource).toMatch(
        /\bencrypt\s*\(\s*plaintext\s*:\s*string\s*\)/,
      );
    });
  });

  describe("drift-detection 변별성 수렴(본 smoke 가 drift 를 실제로 잡음을 입증)", () => {
    it("schema scalar 집합에 합성 컬럼 region 추가 → INSERT 튜플과 not.toEqual — 원본 추출 불변·mutate 0", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");

      const insertColumns = extractInsertColumns(shellSource) as string[];
      const scalarColumns = extractSchemaScalarColumns(
        schemaSource,
      ) as string[];

      // 사본만 mutate: schema scalar 집합에 NOT NULL 합성 컬럼 region 추가.
      const mutatedScalar = [...scalarColumns, "region"];
      expect(normalizedSet(insertColumns)).not.toEqual(
        normalizedSet(mutatedScalar),
      );

      // 원본 추출은 불변 — 여전히 INSERT 와 set-equal.
      expect(normalizedSet(insertColumns)).toEqual(
        normalizedSet(scalarColumns),
      );
    });

    it("schema 컬럼 modelId 를 model 로 rename 한 합성 집합 → INSERT 튜플과 not.toEqual", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const insertColumns = extractInsertColumns(shellSource) as string[];

      const mutated = insertColumns.map((c) => (c === "modelId" ? "model" : c));
      expect(normalizedSet(insertColumns)).not.toEqual(normalizedSet(mutated));
    });

    it("shell INSERT 에서 apiKey 제거한 사본 → schema scalar 집합과 not.toEqual", () => {
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
      const scalarColumns = extractSchemaScalarColumns(
        schemaSource,
      ) as string[];

      const mutatedInsert = EXPECTED_INSERT_COLUMNS.filter(
        (c) => c !== "apiKey",
      );
      expect(normalizedSet(mutatedInsert)).not.toEqual(
        normalizedSet(scalarColumns),
      );
    });

    it("ON CONFLICT update set 에 id 를 추가한 사본 → 멱등 보존 불변 판정 false(원본은 true)", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const insertColumns = extractInsertColumns(shellSource) as string[];
      const onConflictColumns = extractOnConflictColumns(
        shellSource,
      ) as string[];

      // 원본은 멱등 보존 불변 true.
      expect(isIdempotentUpdateSet(insertColumns, onConflictColumns)).toBe(
        true,
      );

      // 사본만 mutate: update set 에 conflict key id 추가 → 멱등성 붕괴.
      const mutated = [...onConflictColumns, "id"];
      expect(isIdempotentUpdateSet(insertColumns, mutated)).toBe(false);

      // 원본 추출은 불변.
      expect(isIdempotentUpdateSet(insertColumns, onConflictColumns)).toBe(
        true,
      );
    });

    it("tsconfig outDir 를 ./build 로 바꾼 합성 객체 → shell require-path dist prefix 와 not.toBe", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const distPrefix = extractRequirePathDistPrefix(
        extractCipherRequirePath(shellSource),
      );

      const mutatedTsconfig = { compilerOptions: { outDir: "./build" } };
      const mutatedBasename = extractTsconfigOutDirBasename(mutatedTsconfig);
      expect(mutatedBasename).not.toBe(distPrefix);
      expect(mutatedBasename).toBe("build");
      expect(distPrefix).toBe(EXPECTED_DIST_PREFIX);
    });

    it("cipher class 명을 OtherCipher 로 바꾼 합성 export → shell class 명과 not.toBe", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const shellClass = extractCipherClassName(shellSource);

      const synthetic =
        "export class OtherCipher {\n  encrypt(p: string): string { return p; }\n}";
      const mutatedExport = extractCipherExport(synthetic);
      expect(mutatedExport.className).not.toBe(shellClass);
      expect(mutatedExport.className).toBe("OtherCipher");
      // 원본 shell class 는 여전히 LlmApiKeyCipher.
      expect(shellClass).toBe(EXPECTED_CIPHER_CLASS);
    });
  });

  describe("Error path / negative cases 충분 cover", () => {
    it("존재하지 않는 경로로 readFileSync → ENOENT throw(silent 0-byte fallback false-PASS 방지)", () => {
      const badShell = path.join(REPO_ROOT, "deploy/does-not-exist-xyz.sh");
      const badSchema = path.join(REPO_ROOT, "prisma/does-not-exist.prisma");
      const badCipher = path.join(REPO_ROOT, "src/llm/does-not-exist.ts");
      const badTsconfig = path.join(REPO_ROOT, "does-not-exist.json");
      expect(() => readFileSync(badShell, "utf8")).toThrow();
      expect(() => readFileSync(badSchema, "utf8")).toThrow();
      expect(() => readFileSync(badCipher, "utf8")).toThrow();
      expect(() => readFileSync(badTsconfig, "utf8")).toThrow();
    });

    it("schema 컬럼 추가 drift 검출(합성) — region NOT NULL scalar 추가 schema → INSERT 7-컬럼과 not.toEqual(superset)", () => {
      // 합성: LlmProviderConfig 에 region String NOT NULL scalar 추가.
      const synthetic = [
        "model LlmProviderConfig {",
        "  id          String   @id @default(cuid())",
        "  provider    String",
        "  endpointUrl String",
        "  apiKey      String",
        "  modelId     String",
        "  region      String",
        "  createdAt   DateTime @default(now())",
        "  updatedAt   DateTime @updatedAt",
        "  difficultyMappings DifficultyMapping[]",
        "}",
      ].join("\n");
      const scalarCols = extractSchemaScalarColumns(synthetic) as string[];
      // 합성 집합은 8개(region 포함) — relation 은 제외됨.
      expect(scalarCols).toContain("region");
      expect(scalarCols).not.toContain("difficultyMappings");
      // INSERT 7-컬럼 튜플과 set-equal 아님(superset — seed 가 region 미충족 → NOT NULL violation).
      expect(normalizedSet(EXPECTED_INSERT_COLUMNS)).not.toEqual(
        normalizedSet(scalarCols),
      );
    });

    it("컬럼 rename drift 검출(합성) — schema modelId 를 model 로 바꾼 합성 schema → INSERT 튜플과 not.toEqual", () => {
      const synthetic = [
        "model LlmProviderConfig {",
        "  id          String   @id @default(cuid())",
        "  provider    String",
        "  endpointUrl String",
        "  apiKey      String",
        "  model       String",
        "  createdAt   DateTime @default(now())",
        "  updatedAt   DateTime @updatedAt",
        "}",
      ].join("\n");
      const scalarCols = extractSchemaScalarColumns(synthetic) as string[];
      expect(scalarCols).toContain("model");
      expect(scalarCols).not.toContain("modelId");
      // rename 으로 INSERT(modelId) 가 존재하지 않는 컬럼 타깃 → SQL error 위험 검출.
      expect(normalizedSet(EXPECTED_INSERT_COLUMNS)).not.toEqual(
        normalizedSet(scalarCols),
      );
    });

    it("ON CONFLICT 멱등 불변 위반 검출(합성) — update set 에 createdAt 포함한 합성 → isIdempotentUpdateSet false(silent PASS 아님)", () => {
      // 합성: update set 에 첫 생성 시각 createdAt 을 잘못 포함(멱등 보존 위반).
      const mutated = [
        "provider",
        "endpointUrl",
        "apiKey",
        "modelId",
        "createdAt",
        "updatedAt",
      ];
      expect(isIdempotentUpdateSet(EXPECTED_INSERT_COLUMNS, mutated)).toBe(
        false,
      );
      // id 포함 변형도 false.
      const withId = [...EXPECTED_ON_CONFLICT_COLUMNS, "id"];
      expect(isIdempotentUpdateSet(EXPECTED_INSERT_COLUMNS, withId)).toBe(
        false,
      );
    });

    it("outDir 변경 drift 검출(합성) — outDir ./build 인 합성 tsconfig → require-path dist prefix 와 not.toBe", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const distPrefix = extractRequirePathDistPrefix(
        extractCipherRequirePath(shellSource),
      );
      const synthetic = { compilerOptions: { outDir: "./build" } };
      expect(extractTsconfigOutDirBasename(synthetic)).not.toBe(distPrefix);
    });

    it("cipher class rename drift 검출(합성) — export class SealService 인 합성 → shell class 명과 not.toBe", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const shellClass = extractCipherClassName(shellSource);
      const synthetic =
        "@Injectable()\nexport class SealService {\n  encrypt(p: string): string { return p; }\n}";
      const cipherExport = extractCipherExport(synthetic);
      expect(cipherExport.className).not.toBe(shellClass);
      expect(cipherExport.className).toBe("SealService");
    });

    it("SQL 미존재 검출(합성) — INSERT INTO LlmProviderConfig 없는 합성 shell → 컬럼 추출 null(silent PASS 아님)", () => {
      const synthetic = "set -e\necho hello\nexit 0";
      expect(extractInsertColumns(synthetic)).toBeNull();
      expect(extractOnConflictColumns(synthetic)).toBeNull();
    });

    it("require/encrypt 미존재 검출(합성) — cipher 호출 없는 합성 shell → require-path·class·method 추출 null", () => {
      const synthetic = "set -e\nINSERT INTO foo (a) VALUES (1)";
      expect(extractCipherRequirePath(synthetic)).toBeNull();
      expect(extractCipherClassName(synthetic)).toBeNull();
      expect(extractCipherMethodName(synthetic)).toBeNull();
    });
  });

  describe("credential 누출 0(REQ-059 / §9)", () => {
    it("추출/합성하는 어떤 문자열(컬럼명·require-path·class/method·outDir·합성 schema/shell/cipher/tsconfig)에도 credential placeholder 미surface", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
      const cipherSource = readFileSync(CIPHER_PATH, "utf8");
      const tsconfig = JSON.parse(readFileSync(TSCONFIG_PATH, "utf8"));

      const contract = extractShellSeedContract(shellSource);
      const haystacks = [
        ...(contract.insertColumns ?? []),
        ...(contract.onConflictColumns ?? []),
        contract.cipherRequirePath ?? "",
        contract.cipherClassName ?? "",
        contract.cipherMethodName ?? "",
        ...(extractSchemaScalarColumns(schemaSource) ?? []),
        extractCipherExport(cipherSource).className ?? "",
        extractTsconfigOutDirBasename(tsconfig) ?? "",
        ...EXPECTED_INSERT_COLUMNS,
        ...EXPECTED_ON_CONFLICT_COLUMNS,
        EXPECTED_CIPHER_REQUIRE_PATH,
        EXPECTED_CIPHER_MODULE_SEGMENT,
        EXPECTED_CIPHER_CLASS,
        EXPECTED_CIPHER_METHOD,
      ];

      // token 형태(GH_TOKEN/Bearer/Authorization/x-*-token/ghp_/sk-/실 endpoint IP/
      // postgres URL 실값/실 enc key)만 검출 — 본 smoke surface 는 컬럼·경로·토큰만 운반.
      const credentialPattern =
        /(GH_TOKEN|\bBearer\b|Authorization|x-access-token|x-github-token|ghp_|\bsk-|postgres:\/\/[^@\s]*:[^@\s]+@|\d{1,3}(\.\d{1,3}){3})/i;
      haystacks.forEach((s) => {
        expect(credentialPattern.test(s)).toBe(false);
      });
    });
  });

  describe("결정론·no-mutation", () => {
    it("동일 shell·schema·cipher·tsconfig 소스로 추출을 두 번 → 결과가 byte-identical deep-equal", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const schemaSource = readFileSync(SCHEMA_PATH, "utf8");
      const cipherSource = readFileSync(CIPHER_PATH, "utf8");

      const a = extractShellSeedContract(shellSource);
      const b = extractShellSeedContract(shellSource);
      expect(a).toEqual(b);

      expect(extractSchemaScalarColumns(schemaSource)).toEqual(
        extractSchemaScalarColumns(schemaSource),
      );
      expect(extractCipherExport(cipherSource)).toEqual(
        extractCipherExport(cipherSource),
      );
    });

    it("추출 보조 함수가 입력을 mutate 0 — drift 사본 mutate 후에도 원본 추출 결과 deep-equal 유지", () => {
      const shellSource = readFileSync(SEED_SHELL_PATH, "utf8");
      const before = extractShellSeedContract(shellSource);

      // 사본 mutate(drift 변별성 항과 동형) — 사본만 변형, 원본 추출은 불변.
      const insertColumns = before.insertColumns as string[];
      const mutated = [...insertColumns, "region"];
      expect(normalizedSet(mutated)).not.toEqual(normalizedSet(insertColumns));

      // 원본 재추출은 before 와 deep-equal(보조 함수가 입력 mutate 0).
      const after = extractShellSeedContract(shellSource);
      expect(after).toEqual(before);
    });
  });
});
