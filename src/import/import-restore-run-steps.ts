// import-restore-run-steps — UC-07 Import 복원 step 배열을 주어진 tx client 위에서 순차 실행하는
// runner (T-1274, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 실행 조각 **3b-1** —
// 3a `buildImportRestoreStepCall` 의 서술을 `tx[delegate][method](args)` 로 옮기기만 한다. 하지
// 않는 것: `$transaction` 열기 · PrismaService 주입 · tx 캐스팅 · Prisma error → HTTP 매핑 ·
// rollback 0 (3b-2 위임 — 여기서 되돌리기를 흉내내면 `$transaction` 과 이중 보상) / `delegate` ·
// `method` · `args` 조립 0 (3a 와 그 하류 위임 — 사본 0 이라 그쪽 한국어 throw 를 **그대로 전파**)
// / step 순서 검증 · 재정렬 0 (T-1264 몫). 순차 계약: `for...of` + `await` 로 받은 순서 그대로
// 하나씩 — `Promise.all` 병렬 금지 (delete-before-insert 가 깨지면 `Assessment.personId → Person`
// 필수 FK 가 중간 상태에서 터진다). fail-fast: 어느 step 이 throw / reject 하면 즉시 중단 · 그대로
// 전파하고 남은 step 은 부르지 않는다 (부분 결과 경로 0). 비변형 — 입력 steps / step / records /
// Date / `fields` / tx 불변 (freeze 도 통과). REQ-032: error 메시지에 delegate · method · index 만.
import { type ExportEntityDelegate } from "../export/export-entity-sources";
import { type ExportEntity } from "../export/export-scope-select";

import { type ImportRestorePhase } from "./import-restore-order";
import {
  buildImportRestoreStepCall,
  type ImportRestoreStepCall,
} from "./import-restore-step-call";
import {
  type ImportRestoreStepMethod,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

// delegate 호출 1 건의 최소 surface — `args` 는 3a 산출 그대로, 반환은 Prisma BatchPayload 동형.
type Call = (args: ImportRestoreStepCall["args"]) => Promise<{ count: number }>;
// 실 `Prisma.TransactionClient` 캐스팅은 호출자 (3b-2) 몫 — 아래 5 delegate key 가 본 runner 가
// 요구하는 tx 의 전부다 (evaluation-result-persist.service 의 좁은 선언 선례).
export interface ImportRestoreDelegateClient {
  deleteMany: Call;
  createMany: Call;
}
export type ImportRestoreTxClient = Readonly<
  Record<ExportEntityDelegate, ImportRestoreDelegateClient>
>;
// step 1 건의 실행 결과 — 입력 step 의 서술 + delegate 가 보고한 건수.
export interface ImportRestoreStepOutcome {
  entity: ExportEntity;
  phase: ImportRestorePhase;
  delegate: ExportEntityDelegate;
  method: ImportRestoreStepMethod;
  count: number;
}

// 안전 표기 (값 대신 타입 이름만 — REQ-032, T-1273 `tokenOf` 사본) + 거부 helper (`never` 반환).
const kindOf = (v: unknown): string => (v === null ? "null" : typeof v);
function fail(message: string): never {
  throw new TypeError(`runImportRestoreSteps: ${message}`);
}

// runImportRestoreSteps — step 배열을 tx 위에서 입력 순서 그대로 실행하고 outcome 을 모은다. 방어:
// tx 비-객체 · steps 비-배열 → TypeError (어느 호출도 하기 전에 거부). step 마다 서술 조립 위임 →
// delegate 존재 → method 함수 → 호출 → 반환 `count` 가 number. 빈 배열은 호출 0 회 + `[]`.
export async function runImportRestoreSteps(
  tx: ImportRestoreTxClient,
  steps: readonly ImportRestoreTransactionStep[],
): Promise<ImportRestoreStepOutcome[]> {
  const table: unknown = tx; // 타입 우회로 흘러든 null / 원시값을 값 자체로 확인한다.
  if (typeof table !== "object" || table === null) {
    fail(`tx 는 객체여야 합니다 (받음: ${kindOf(table)})`);
  }
  const list: unknown = steps;
  if (!Array.isArray(list)) {
    fail(`steps 는 배열이어야 합니다 (받음: ${kindOf(list)})`);
  }

  const clients = table as Record<string, unknown>;
  const items = list as readonly ImportRestoreTransactionStep[];
  const outcomes: ImportRestoreStepOutcome[] = [];
  for (const [index, step] of items.entries()) {
    // 서술 조립은 전량 3a 위임 — 그쪽(과 그 하류) 한국어 throw 는 감싸지 않고 그대로 전파된다.
    const { delegate, method, args } = buildImportRestoreStepCall(step);
    const at = `tx.${delegate}.${method} (steps[${index}])`;
    const client: unknown = clients[delegate];
    if (typeof client !== "object" || client === null) {
      fail(`${at} — delegate 가 객체가 아닙니다 (받음: ${kindOf(client)})`);
    }
    const fn: unknown = (client as Record<string, unknown>)[method];
    if (typeof fn !== "function") {
      fail(`${at} — method 가 함수가 아닙니다 (받음: ${kindOf(fn)})`);
    }

    // receiver 는 delegate 객체 그대로 (this 를 쓴다). reject 는 fail-fast 로 전파되고 이미 끝난
    // 호출의 되돌리기는 시도하지 않는다 (`$transaction` 몫 — 흉내내면 이중 보상).
    const target = client as ImportRestoreDelegateClient;
    const result: unknown = await (fn as Call).call(target, args);
    // 조용히 0 으로 대체하면 미복원을 성공으로 보고하게 되므로 비-number 는 거부한다.
    const count: unknown = ((result ?? {}) as Record<string, unknown>).count;
    if (typeof count !== "number") {
      fail(`${at} — 반환 count 는 number 여야 합니다 (받음: ${kindOf(count)})`);
    }
    const { entity, phase } = step;
    outcomes.push({ entity, phase, delegate, method, count });
  }
  return outcomes;
}
