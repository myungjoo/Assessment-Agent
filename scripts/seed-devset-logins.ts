#!/usr/bin/env ts-node
// scripts/seed-devset-logins — R-91 실데이터 dataset(133 명 로그인) seed 의 **얇은
// 실행 entrypoint** (T-1658). `scripts/encrypt-token.ts`(T-0206) 정본 패턴 그대로:
// 분기 로직 0 · 실 process io 주입 · `require.main === module` 가드 · 본체 위임만.
//
// 사용법:
//   DATABASE_URL=<postgres 연결 문자열> pnpm seed:devset-logins
//   종료 코드: 0(적재 성공) / 1(실패) — 판정은 전부 본체 runDevsetSeedCli 가 한다.
//
// 재구현 0 — seed 절차 · upsert 인자 조립 · 연결 문자열 검증 · 요약 로깅 · 연결 종료는
// 전부 앞선 slice 의 helper 가 이미 담당한다. 본 파일은 팩토리 1 회 + 본체 1 회 호출뿐.
// 보안 (CLAUDE.md §9): 연결 문자열 리터럴 0 · 로그/에러 출력에 DATABASE_URL 값 삽입 0
// (팩토리의 실패 메시지도 입력값을 echo 하지 않는다).
import { runDevsetSeedCli } from "../test/helpers/realdata-devset-seed-cli";
import { createDevsetSeedClient } from "../test/helpers/realdata-devset-seed-client";

// main — 실 client 와 process io 를 주입해 본체를 호출하고, 반환된 exit code 를 그대로
// process.exit 에 전달한다. 분기 없음 — 모든 판정은 본체와 팩토리가 담당.
async function main(): Promise<void> {
  const code = await runDevsetSeedCli({
    client: createDevsetSeedClient(process.env.DATABASE_URL),
    log: (line) => process.stdout.write(`${line}\n`),
    logError: (line) => process.stderr.write(`${line}\n`),
  });
  process.exit(code);
}

// 본 파일이 직접 실행될 때만 동작한다 (test 에서 import 시 side effect 방지).
// 최상위 실패(팩토리의 TypeError 등) 는 무조건 문자열화해 stderr 로 남기고 exit code 1.
if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`devset seed 실행 실패 — ${String(error)}\n`);
    process.exit(1);
  });
}
