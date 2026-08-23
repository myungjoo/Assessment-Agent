// realdata-devset-seed-cli.ts — R-91 실데이터 dataset(133 명) seed 의 **CLI 본체**
// (T-1656). 직전 slice T-1655 가 박은 `runDevsetSeed` 를 감싸 (1) 요약 로그 · (2) exit
// code 반환 · (3) 연결 종료 세 분기만 담당한다.
//
// 🔥 정본 패턴 승계 — `src/llm/encrypt-token-cli.ts`(T-0206) 의 "testable 본체 + trivial
//   entrypoint" 구조 그대로: 실 io 를 주입받고 `process`/`console` 를 직접 만지지 않으며
//   exit code 를 **return** 한다. 실 `PrismaClient` 인스턴스화와 `process.exit` 은 분기 0
//   인 다음 slice 의 entrypoint 몫 (CLAUDE.md §3.2 R-112 "entrypoint 에 분기 두지 말고
//   helper 로 분리"). 🔥 seed 로직 재구현 0 — `runDevsetSeed` 를 정확히 1 회 호출할 뿐
//   upsert args 조립 · placeholder 치환 · 값 검증을 직접 하지 않는다. 🔥 client 주입형 —
//   `@prisma/client` import 0(구조적 타입만) · 새 dep 0 · env 0 · 실 DB/네트워크 0.
//   🔥 R-59 raw 데이터 0 — 성공 로그는 두 count 요약 한 줄뿐(반환 Map 원소 덤프 0), 실패
//   로그도 `error.message` 문자열만 (CLAUDE.md §9 객체 덤프 금지 = secret 혼입 차단).
import { runDevsetSeed } from "./realdata-devset-seed-run";
import type { DevsetSeedClient } from "./realdata-devset-seed-run";

// DevsetSeedCliClient — seed 두 leg 의 구조적 계약(`DevsetSeedClient`) 에 연결 종료 수단만
// 더한 교차 타입. 자체 필드 재선언 0 이라 실 `PrismaClient` 가 그대로 상위집합.
export type DevsetSeedCliClient = DevsetSeedClient & {
  $disconnect(): Promise<void>;
};

// DevsetSeedCliDeps — 주입 계약. 부수효과(연결 · 로그) 를 전부 본 인터페이스로 외화한다.
// `count` 무인자면 `runDevsetSeed` 의 기본 경로(133 건 전량) 로 그대로 넘어간다.
export interface DevsetSeedCliDeps {
  client: DevsetSeedCliClient;
  count?: number;
  log: (line: string) => void;
  logError: (line: string) => void;
}

// 로깅 수단 결손이면 진단을 남길 곳이 없다 — 그 경우에만 `TypeError` 를 호출부로 전파한다
// (나머지 결손은 전부 `logError` + exit code 1 로 흡수).
function assertLogSinks(deps: DevsetSeedCliDeps): void {
  if (typeof deps !== "object" || deps === null) {
    throw new TypeError("devset seed CLI: deps 가 객체가 아니다");
  }
  const sinks = [deps.log, deps.logError];
  if (sinks.some((sink) => typeof sink !== "function")) {
    throw new TypeError("devset seed CLI: log/logError 가 함수가 아니다");
  }
}

// `Error` 면 message 문자열만, 아니면 `String()` 결과만 쓴다(객체 덤프 0).
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// 연결 종료 — 성공/실패 어느 경로에서도 `finally` 로 정확히 1 회 시도한다. `$disconnect`
// 결손·rejection 은 **기록만** 하고 원래 exit code 를 바꾸지 않는다(seed 결과가 연결 종료
// 실패로 뒤집히면 CI 판정이 왜곡된다).
async function disconnectQuietly(
  client: unknown,
  logError: (line: string) => void,
): Promise<void> {
  const close = (client as DevsetSeedCliClient | undefined)?.$disconnect;
  if (typeof close !== "function") {
    logError("devset seed 연결 종료 생략 — $disconnect 가 함수가 아니다");
    return;
  }
  try {
    await close.call(client);
  } catch (error) {
    logError(`devset seed 연결 종료 실패(exit code 유지): ${messageOf(error)}`);
  }
}

// runDevsetSeedCli — CLI 실행 본체. exit code 만 반환하고 스스로 throw 하지 않는다(로깅
// 수단 결손만 예외 — 위 `assertLogSinks`. CI 는 exit code 로만 판정).
//   - resolve → 두 count 요약 한 줄 `log` + `0`.
//   - reject/throw(client 결손 `TypeError` · count 범위 `RangeError` · upsert rejection ·
//     치환 `Error`) → 메시지 `logError` + `1`. 어느 경로든 `$disconnect` 1 회 시도.
export async function runDevsetSeedCli(
  deps: DevsetSeedCliDeps,
): Promise<number> {
  assertLogSinks(deps);
  const { log, logError } = deps;
  try {
    const result = await runDevsetSeed(deps.client, deps.count);
    log(
      `devset seed 완료 — person ${result.personCount} 건 / ` +
        `serviceIdentity ${result.identityCount} 건 적재`,
    );
    return 0;
  } catch (error) {
    logError(`devset seed 실패: ${messageOf(error)}`);
    return 1;
  } finally {
    await disconnectQuietly(deps.client, logError);
  }
}
