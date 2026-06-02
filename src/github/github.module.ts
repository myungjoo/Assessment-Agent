// GithubModule — GithubAdapter 의 책임 module (T-0178, ADR-0017 Decision §1·§2·§3,
// P4 milestone-3 GitHub adapter wiring slice, REQ-005~008/REQ-044). GithubAdapter
// (@Injectable dispatch service)를 provider 로 등록 + export 해 후속 평가 파이프라인
// 이 inject 가능하게 한다. llm.module.ts 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위(본 task):
//   - GithubAdapter provider 등록 + export. GithubAdapter 는 fetch / emitter 둘 다
//     @Optional 생성자 주입(default: globalThis.fetch / no-op emitter)이라 추가
//     provider wiring 없이 NestJS 가 resolve 한다 — Prisma dep 0 이므로
//     PersistenceModule import 불요(github-adapter.service.ts L165~176 참조).
//
// 책임 경계(본 slice 밖 — 후속 task):
//   - env→instance config 의 module init 시점 binding(provider factory) — 본 module
//     은 GithubAdapter 만 배선한다. resolveGithubInstances(github-instance-config.ts)
//     순수 함수는 후속 wiring slice 가 적절한 시점에 호출한다(본 task 는 함수 박제만,
//     module 안에서 호출하지 않는다 — ADR-0017 Decision §3 boot 검증 layer 정합).
//   - token JIT decrypt(ADR-0017 chain row 2 = 별도 task) — 본 module 은 decrypt
//     cipher 를 주입하지 않는다(GithubAdapter 는 평문 token 인자만 받음).
//   - PermissionDeniedRecord entity 의 실 persistence(§5 게이트, 별도 task).
//   - ConfluenceModule wiring(별도 adapter, 별도 task).
import { Module } from "@nestjs/common";

import { GithubAdapter } from "./github-adapter.service";

@Module({
  // GithubAdapter 만 provide + export. controller / repository 0 — 본 adapter 는
  // 외부 transport leaf 라 HTTP endpoint 를 직접 노출하지 않는다(상위 orchestrator /
  // 평가 파이프라인이 inject 해 사용). PersistenceModule import 불요(Prisma dep 0).
  providers: [GithubAdapter],
  exports: [GithubAdapter],
})
export class GithubModule {}
