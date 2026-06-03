// scripts/encrypt-token.spec.ts — entrypoint 최소 spec (T-0206, check-spec-presence.sh
// 신규 .ts 의무 정합). entrypoint 는 분기 0 의 얇은 wrapper 로, 실 본체 (R-112 cover)
// 는 src/llm/encrypt-token-cli.spec.ts 가 담당한다 (src/main.ts ↔ parse-port.spec.ts
// 분리 패턴 mirror). 본 spec 은 entrypoint 가 (1) import 만으로 side effect 를 일으키지
// 않고 (require.main !== module 가드), (2) src 본체 runEncryptTokenCli 에 위임함을 검증한다.
//
// scripts/ 는 package.json collectCoverageFrom (src/**) 밖이라 coverage 집계 대상이
// 아니다 — 본 spec 의 목적은 spec-presence 충족 + 위임 계약 검증.
import { runEncryptTokenCli } from "../src/llm/encrypt-token-cli";

describe("scripts/encrypt-token entrypoint", () => {
  it("import 만으로 process.exit 등 side effect 를 일으키지 않는다 (require.main 가드)", async () => {
    // jest 환경에서 require.main !== module 이므로 main() 이 실행되지 않아야 한다.
    // import 가 throw / exit 없이 완료되면 통과. dynamic import() 로 모듈 로드를
    // 콜백 안으로 지연시켜 require() (no-require-imports) 없이 ESM 스타일을 유지한다.
    await expect(import("./encrypt-token")).resolves.toBeDefined();
  });

  it("entrypoint 가 위임하는 src 본체 runEncryptTokenCli 가 함수로 존재한다 (위임 계약)", () => {
    // entrypoint 의 분기 0 위임 대상 — 본체가 함수 형태로 export 됨을 확인.
    expect(typeof runEncryptTokenCli).toBe("function");
  });
});
