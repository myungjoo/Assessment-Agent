// AssessmentCollectionModule — Assessment 수집 orchestrator 의 NestJS 배선 module
// (T-0251, ADR-0029 Decision §1 Module placement, P4 collection slice (iv),
// REQ-005~008/REQ-015/REQ-031). slice (i) Activity 도메인 + mapper(T-0248) → (ii)
// GithubCollectionService(T-0249) → (iii) ConfluenceCollectionService(T-0250) 가
// 완료됐으나 두 collection service 가 아직 어떤 module 에도 배선되지 않아 DI 로
// inject 받을 수 없었다. 본 module 이 두 adapter module 을 import 하고 두 collection
// service 를 provider 로 등록 + export 해 후속 orchestrator(slice v)가 inject 가능하게 한다.
// github.module.ts / confluence.module.ts 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위:
//   - GithubModule import — GithubModule 이 `GithubInstanceClient` 를 export 하므로
//     (github.module.ts L65), 본 module 이 import 하면 GithubCollectionService 의
//     생성자 의존 `GithubInstanceClient` 가 DI 로 resolve 된다.
//   - ConfluenceModule import — ConfluenceModule 이 `ConfluenceSpaceTraversalService`
//     를 export 하므로(confluence.module.ts L91~95), 본 module 이 import 하면
//     ConfluenceCollectionService 의 생성자 의존 `ConfluenceSpaceTraversalService` 가
//     DI 로 resolve 된다.
//   - GithubCollectionService / ConfluenceCollectionService provider 등록 + export —
//     orchestrator + 후속 enumerate slice(v-b2)가 두 collection service 를 inject 받아
//     instance×org×repo·SPACE enumerate 를 조립한다.
//   - CollectionOrchestratorService provider 등록 + export(slice v-b, T-0253) — 같은
//     module 의 두 collection service 를 주입받아 한 `CollectionSpec` 에 대해 둘을
//     호출하고 단일 `Activity[]` 로 aggregate 한다(새 module import 0). 후속 영속화
//     slice(v-c)가 본 orchestrator 를 inject 한다.
//
// import 방향(ADR-0029 §1 단방향 유지): collection → adapter 만. AssessmentModule 을
// 확장하지 않고 신규 module 을 신설한다(평가 module 과 수집 module 의 책임 분리).
// PersistenceModule 직접 import 불요 — 두 adapter module 이 (전이로) @Global
// PersistenceModule 의 PrismaService 를 이미 끌어오며, collection service 자체는
// Prisma 의존 0 이라 본 module 이 PersistenceModule 을 직접 import 하지 않는다
// (의존성 표면 최소화). LlmModule 도 import 하지 않는다(ADR-0029 §1, LLM 의존 표면 0).
//
// 책임 경계(본 module 밖 — 후속 task):
//   - enumerate entry + Contribution 영속화 — `collectForPerson(person, since?)` 진입점
//     / Person 의 instance×org×repo·SPACE enumerate(slice v-b2) / Activity →
//     Contribution 영속화(slice v-c)는 본 module 밖. orchestrator(slice v-b)는 산출된
//     `CollectionSpec` 을 받아 aggregate 까지만 하며, enumerate·영속화 service 의 배선은
//     해당 slice 진입 시 추가된다.
//   - incremental since 도출(slice vi) — 직전 Assessment → since 계산 service 의 배선.
//   - modules.md row 9 reconcile doc-sync(slice vii) — 별도 direct doc-sync task.
import { Module } from "@nestjs/common";

import { ConfluenceModule } from "../confluence/confluence.module";
import { GithubModule } from "../github/github.module";

import { CollectionOrchestratorService } from "./collection-orchestrator.service";
import { ConfluenceCollectionService } from "./confluence-collection.service";
import { GithubCollectionService } from "./github-collection.service";

@Module({
  // GithubModule / ConfluenceModule import — 두 adapter module 이 export 하는
  // GithubInstanceClient / ConfluenceSpaceTraversalService 를 통해 두 collection
  // service 의 생성자 주입을 성립시킨다(collection → adapter 단방향, ADR-0029 §1).
  imports: [GithubModule, ConfluenceModule],
  // 두 collection service + orchestrator(slice v-b)를 provider 로 등록.
  // GithubCollectionService 는 GithubInstanceClient 를, ConfluenceCollectionService 는
  // ConfluenceSpaceTraversalService 를 생성자 주입받으며, 위 imports 가 그 token 들을
  // 공급한다. CollectionOrchestratorService 는 같은 module 의 두 collection service 를
  // 주입받으므로(새 module import 0) 본 providers 등록만으로 DI 가 성립한다. 본 module 은
  // 분기 로직 0 — 순수 DI 선언이다.
  providers: [
    GithubCollectionService,
    ConfluenceCollectionService,
    CollectionOrchestratorService,
  ],
  // 두 collection service 와 orchestrator 를 export. orchestrator 는 후속
  // 영속화 slice (v-c)가, 두 collection service 는 enumerate slice (v-b2)가 inject 한다.
  exports: [
    GithubCollectionService,
    ConfluenceCollectionService,
    CollectionOrchestratorService,
  ],
})
export class AssessmentCollectionModule {}
