// GithubModule — GithubAdapter 의 책임 module (T-0178, ADR-0017 Decision §1·§2·§3,
// P4 milestone-3 GitHub adapter wiring slice, REQ-005~008/REQ-044). GithubAdapter
// (@Injectable dispatch service)를 provider 로 등록 + export 해 후속 평가 파이프라인
// 이 inject 가능하게 한다. llm.module.ts 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위:
//   - GithubAdapter provider 등록 + export. GithubAdapter 는 fetch / emitter 둘 다
//     @Optional 생성자 주입(default: globalThis.fetch / no-op emitter)이라 추가
//     provider wiring 없이 NestJS 가 resolve 한다 — Prisma dep 0 이므로
//     PersistenceModule import 불요(github-adapter.service.ts L165~176 참조).
//   - GithubInstanceClient provider 등록 + export (T-0180, ADR-0017 Decision §3
//     token JIT decrypt → adapter wire). instance key 하나로 인증 요청을 보내는
//     orchestrator — GithubAdapter + LlmApiKeyCipher 를 inject 받는다.
//   - LlmApiKeyCipher provider 등록 (T-0180) — ADR-0014 기존 cipher 재사용(새 master
//     key 신설 금지). LlmApiKeyCipher 는 no-arg 생성자(env 직접 read)라 Prisma dep 0 —
//     LlmModule 전체 import(repository 가 PrismaService 요구) 대신 cipher 만 직접
//     provider 로 등록해 GithubModule 의 standalone compile 자기충족을 유지한다.
//
// 책임 경계(본 slice 밖 — 후속 task):
//   - env→instance config 의 module init 시점 binding(provider factory) —
//     GithubInstanceClient 는 매 요청마다 resolveGithubInstances 를 호출한다(부수효과 0
//     순수 함수). boot 시점 eager binding 은 별도 검증 layer 책임(ADR-0017 §3).
//   - live-run(실 GitHub token + 실 네트워크) — §5 credential 게이트.
//   - ConfluenceModule wiring(별도 adapter, 별도 task).
//
// 권한 거부 영속화 emitter wiring(T-0211, ADR-0022 chain row 3): GithubModule 이
// PermissionDeniedRecordModule(service export)을 imports 하고, PERMISSION_DENIED_EMITTER
// token 에 PersistingPermissionDeniedEmitter(실 영속화 emitter)를 provide 한다. 그러면
// GithubAdapter 의 @Optional @Inject(PERMISSION_DENIED_EMITTER) emitter param 이 no-op
// 대신 실 emitter 로 resolve 되어 401/403 권한 거부가 record 로 영속화된다. adapter
// 코드 변경 0(port 재사용, ADR-0022 §6.1) — module wiring 으로 자기충족(app.module 무변경).
import { Module } from "@nestjs/common";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";
import { PermissionDeniedRecordModule } from "../permission-denied/permission-denied-record.module";
import { PersistingPermissionDeniedEmitter } from "../permission-denied/persisting-permission-denied-emitter";

import {
  GithubAdapter,
  PERMISSION_DENIED_EMITTER,
} from "./github-adapter.service";
import { GithubInstanceClient } from "./github-instance-client.service";

@Module({
  // PermissionDeniedRecordModule import — PersistingPermissionDeniedEmitter 가
  // PermissionDeniedRecordService 를 inject 하려면 그 service 를 export 하는 module 을
  // import 해야 한다(T-0210 이 service 를 exports 에 등록). PersistenceModule(@Global)이
  // PrismaService 를 application-wide 로 export 하므로 그 추가 import 는 불요.
  imports: [PermissionDeniedRecordModule],
  // GithubAdapter + GithubInstanceClient + LlmApiKeyCipher + 실 영속화 emitter 를 provide.
  // PERMISSION_DENIED_EMITTER token 에 PersistingPermissionDeniedEmitter 를 useClass 로
  // 바인딩 — GithubAdapter 의 @Inject(PERMISSION_DENIED_EMITTER) 가 이를 주입받는다.
  // client 와 adapter 는 외부 transport leaf 라 HTTP endpoint 를 직접 노출하지 않는다.
  // LlmApiKeyCipher 는 GithubModule 내부 주입용으로만 등록(export 불요).
  providers: [
    GithubAdapter,
    GithubInstanceClient,
    LlmApiKeyCipher,
    PersistingPermissionDeniedEmitter,
    {
      provide: PERMISSION_DENIED_EMITTER,
      useClass: PersistingPermissionDeniedEmitter,
    },
  ],
  exports: [GithubAdapter, GithubInstanceClient],
})
export class GithubModule {}
