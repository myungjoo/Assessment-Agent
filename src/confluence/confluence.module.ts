// ConfluenceModule — Confluence adapter wiring 의 출발 module shell (T-0184,
// ADR-0018 Decision §2·§6, P4 milestone-3 Confluence adapter slice, REQ-009/010/015/
// 016/044). 본 task 범위에서는 ConfluenceAdapter / SpaceTraversalService 가 아직
// 존재하지 않으므로(ADR-0018 chain row 3~5 = 별도 task), env→instance config 순수
// 함수의 결과를 NestJS provider 로 노출 + export 해 후속 chain 이 inject 할 수 있는
// wiring 골격만 둔다. github.module.ts 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위:
//   - CONFLUENCE_INSTANCES provider 등록 + export. resolveConfluenceInstances 를
//     useFactory 로 호출해 활성 instance config 배열을 module 경계에 노출한다 —
//     후속 ConfluenceAdapter / SpaceTraversalService 가 이 token 을 inject 받는다.
//     resolveConfluenceInstances 는 부수효과 0 순수 함수라 추가 provider wiring
//     없이 process.env 만으로 자기충족한다(github-instance-config.ts mirror).
//   - PersistenceModule import 불요 — Confluence adapter 계층은 Prisma 미사용
//     (ADR-0018 Decision §6 adapter leaf, modules.md ConfluenceModule row).
//
// 책임 경계(본 slice 밖 — 후속 task):
//   - token JIT decrypt(ADR-0018 chain row 2 = 별도 task, github-token-decrypt.ts
//     Confluence mirror) — 본 module 은 tokenEnc 암호문을 그대로 보관만 한다.
//   - ConfluenceAdapter request-builder / service dispatch / `_links.next`
//     pagination(ADR-0018 chain row 3~4 = 별도 task) — provider 미등록.
//   - ConfluenceSpaceTraversalService(ADR-0018 chain row 5 = 별도 task).
//   - 실 token live-run(실 Confluence token + 실 네트워크) — §5 credential 게이트.
import { Module } from "@nestjs/common";

import {
  type ConfluenceInstanceConfig,
  resolveConfluenceInstances,
} from "./confluence-instance-config";

// 활성 Confluence instance config 배열을 module 경계에서 inject 받기 위한 DI token.
// 후속 ConfluenceAdapter / SpaceTraversalService 가 @Inject(CONFLUENCE_INSTANCES) 로
// 주입받아 SPACE 순회 / 인증 요청을 조립한다(ADR-0018 chain row 3~5).
export const CONFLUENCE_INSTANCES = "CONFLUENCE_INSTANCES";

@Module({
  // CONFLUENCE_INSTANCES token 을 process.env 기반 useFactory 로 provide + export.
  // resolveConfluenceInstances 가 부수효과 0 순수 함수라 PersistenceModule import
  // 없이 ConfluenceModule 단독으로 compile 된다(adapter leaf, Prisma dep 0).
  providers: [
    {
      provide: CONFLUENCE_INSTANCES,
      useFactory: (): ConfluenceInstanceConfig[] =>
        resolveConfluenceInstances(process.env).instances,
    },
  ],
  exports: [CONFLUENCE_INSTANCES],
})
export class ConfluenceModule {}
