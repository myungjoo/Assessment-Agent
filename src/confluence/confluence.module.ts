// ConfluenceModule — Confluence adapter wiring module (T-0184 instance config provider
// + T-0187 ConfluenceAdapter provider, ADR-0018 Decision §2·§4·§6, P4 milestone-3
// Confluence adapter slice, REQ-009/010/015/016/044). env→instance config 순수 함수의
// 결과를 NestJS provider 로 노출하고, ConfluenceAdapter(단일 page dispatch service)
// 를 provider 로 등록 + export 해 후속 chain(row4 pagination / row5 traversal service)
// 이 inject 할 수 있게 한다. github.module.ts 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위:
//   - CONFLUENCE_INSTANCES provider 등록 + export. resolveConfluenceInstances 를
//     useFactory 로 호출해 활성 instance config 배열을 module 경계에 노출한다 —
//     후속 ConfluenceAdapter wiring / SpaceTraversalService 가 이 token 을 inject 받는다.
//     resolveConfluenceInstances 는 부수효과 0 순수 함수라 추가 provider wiring
//     없이 process.env 만으로 자기충족한다(github-instance-config.ts mirror).
//   - ConfluenceAdapter provider 등록 + export(T-0187, ADR-0018 §6 4단 경계 2번).
//     fetch / emitter 가 @Optional 생성자 주입(default globalThis.fetch / no-op
//     emitter)이라 추가 provider 없이 NestJS 가 0-인자로 인스턴스화한다 — row5
//     SpaceTraversalService 가 이 adapter 를 inject 해 SPACE 순회를 조립한다.
//   - ConfluenceSpaceTraversalService provider 등록 + export(T-0189, ADR-0018 §6
//     4단 경계 4번). ConfluenceAdapter + LlmApiKeyCipher(JIT decrypt) 주입,
//     PermissionDeniedEmitter 는 @Optional(no-op default). LlmApiKeyCipher 도
//     self-contained provider 로 함께 등록한다.
//   - PersistenceModule import 불요 — Confluence adapter 계층은 Prisma 미사용
//     (ADR-0018 Decision §6 adapter leaf, modules.md ConfluenceModule row).
//
// 책임 경계(본 slice 밖 — 후속 task):
//   - 다중 instance 순회(resolveConfluenceInstances 결과 전체 loop) — 상위
//     orchestrator 책임. 본 module 은 단일 instance traverse service 까지만 등록.
//   - PermissionDeniedRecord entity 의 실 persistence(Prisma model + migration) —
//     chain row8, §5 schema 게이트. 본 module 의 emit 은 in-memory port 까지만.
//   - 실 token live-run(실 Confluence token + 실 네트워크) — §5 credential 게이트.
import { Module } from "@nestjs/common";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { ConfluenceAdapter } from "./confluence-adapter.service";
import {
  type ConfluenceInstanceConfig,
  resolveConfluenceInstances,
} from "./confluence-instance-config";
import { ConfluenceSpaceTraversalService } from "./confluence-space-traversal.service";

// 활성 Confluence instance config 배열을 module 경계에서 inject 받기 위한 DI token.
// 후속 ConfluenceAdapter / SpaceTraversalService 가 @Inject(CONFLUENCE_INSTANCES) 로
// 주입받아 SPACE 순회 / 인증 요청을 조립한다(ADR-0018 chain row 3~5).
export const CONFLUENCE_INSTANCES = "CONFLUENCE_INSTANCES";

@Module({
  // CONFLUENCE_INSTANCES token 을 process.env 기반 useFactory 로 provide + export +
  // ConfluenceAdapter class provider 등록 + export. resolveConfluenceInstances 가
  // 부수효과 0 순수 함수이고 ConfluenceAdapter 의 fetch/emitter 가 @Optional 주입
  // (default 채움)이라 PersistenceModule import 없이 ConfluenceModule 단독으로
  // compile 된다(adapter leaf, Prisma dep 0).
  providers: [
    {
      provide: CONFLUENCE_INSTANCES,
      useFactory: (): ConfluenceInstanceConfig[] =>
        resolveConfluenceInstances(process.env).instances,
    },
    ConfluenceAdapter,
    // LlmApiKeyCipher 는 ConfluenceSpaceTraversalService 의 token JIT decrypt 의존
    // (ADR-0014 cipher 재사용). 자기충족 provider 로 등록해 module context 에서
    // 주입 가능하게 한다 (PersistenceModule 등 추가 import 불요 — cipher 는 env 만
    // 읽는 self-contained @Injectable).
    LlmApiKeyCipher,
    // ConfluenceSpaceTraversalService — SPACE allowlist 순회 + 4xx skip-and-continue
    // (T-0189, ADR-0018 §6 4단 경계 4번). ConfluenceAdapter + LlmApiKeyCipher 주입,
    // PermissionDeniedEmitter 는 @Optional (no-op default) 이라 추가 provider 불요.
    ConfluenceSpaceTraversalService,
  ],
  exports: [
    CONFLUENCE_INSTANCES,
    ConfluenceAdapter,
    ConfluenceSpaceTraversalService,
  ],
})
export class ConfluenceModule {}
