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
//     호출하고 단일 `Activity[]` 로 aggregate 한다(새 module import 0).
//   - UserModule import + CollectionPersistenceService provider 등록 + export(slice v-c,
//     T-0254) — orchestrator 의 aggregate `Activity[]` 를 매퍼(mapActivityToContribution)로
//     변환해 `ContributionService.create` 로 영속화한다. UserModule 이 `ContributionService`
//     를 export(user.module.ts L181)하므로 import 하면 그 생성자 주입이 DI 로 resolve 된다.
//     후속 enumerate slice(v-b2)가 본 영속화 service 를 inject 한다.
//
// import 방향(ADR-0029 §1 단방향 유지): collection → adapter + collection → user(domain)
// 단방향(user 는 collection 을 모름). AssessmentModule 을
// 확장하지 않고 신규 module 을 신설한다(평가 module 과 수집 module 의 책임 분리).
// PersistenceModule 직접 import 불요 — 두 adapter module 이 (전이로) @Global
// PersistenceModule 의 PrismaService 를 이미 끌어오며, collection service 자체는
// Prisma 의존 0 이라 본 module 이 PersistenceModule 을 직접 import 하지 않는다
// (의존성 표면 최소화). LlmModule 도 import 하지 않는다(ADR-0029 §1, LLM 의존 표면 0).
//
// 책임 경계(본 module 밖 — 후속 task):
//   - enumerate entry — `collectForPerson(person, since?)` 진입점 / Person 의
//     instance×org×repo·SPACE enumerate(slice v-b2)는 본 module 밖. orchestrator/영속화
//     service 는 산출된 `CollectionSpec`(+ assessmentId)을 입력으로 받으며, enumerate
//     service 의 배선은 해당 slice 진입 시 추가된다.
//   - modules.md row 9 reconcile doc-sync(slice vii) — 별도 direct doc-sync task.
//
// slice vi 배선 완료(T-0268): incremental since 도출 service `SinceDerivationService`
// (T-0267 — 직전 Assessment 최신 periodStart → ISO since, 빈 배열 → undefined)를 provider/
// export 로 등록한다. 그 유일한 생성자 의존 `AssessmentService` 는 기존 UserModule import
// 의 export(user.module.ts L174)로 이미 닫혀 새 import 0. 후속 호출처(scheduler/manual
// trigger)가 본 service 를 inject 받아 deriveSince(personId)로 since 를 산출해
// CollectionEntryService.collectForPerson 에 주입한다(호출처 결선은 P5/P7, 본 module 밖).
import { Module } from "@nestjs/common";

import { ConfluenceModule } from "../confluence/confluence.module";
import { GithubModule } from "../github/github.module";
import { UserModule } from "../user/user.module";

import { CollectionEntryService } from "./collection-entry.service";
import { CollectionOrchestratorService } from "./collection-orchestrator.service";
import { CollectionPersistenceService } from "./collection-persistence.service";
import { CollectionSpecService } from "./collection-spec.service";
import { ConfluenceCollectionService } from "./confluence-collection.service";
import { GithubCollectionSpecService } from "./github-collection-spec.service";
import { GithubCollectionService } from "./github-collection.service";
import { GithubOrgEnumerateService } from "./github-org-repo-enumerate.service";
import { SinceDerivationService } from "./since-derivation.service";

@Module({
  // GithubModule / ConfluenceModule import — 두 adapter module 이 export 하는
  // GithubInstanceClient / ConfluenceSpaceTraversalService 를 통해 두 collection
  // service 의 생성자 주입을 성립시킨다(collection → adapter 단방향, ADR-0029 §1).
  // UserModule import — `ContributionService` 를 export(user.module.ts L181)하므로
  // CollectionPersistenceService 의 생성자 주입(영속화 진입점)이 DI 로 resolve 된다
  // (collection → user 단방향, ADR-0029 §1).
  imports: [GithubModule, ConfluenceModule, UserModule],
  // 두 collection service + orchestrator(v-b) + 영속화 service(v-c)를 provider 로 등록.
  // GithubCollectionService 는 GithubInstanceClient 를, ConfluenceCollectionService 는
  // ConfluenceSpaceTraversalService 를 생성자 주입받으며, 위 imports 가 그 token 들을
  // 공급한다. CollectionOrchestratorService 는 같은 module 의 두 collection service 를,
  // CollectionPersistenceService 는 orchestrator + UserModule 의 ContributionService 를
  // 주입받는다. 본 module 은 분기 로직 0 — 순수 DI 선언이다.
  //
  // enumerate chain(ADR-0030 §5, slice ii~iii-b2b) 4 service 추가 배선:
  //   CollectionEntryService(collectForPerson 진입) → CollectionSpecService →
  //   GithubCollectionSpecService → GithubOrgEnumerateService → GithubInstanceClient.
  // leaf 의존 GithubInstanceClient 는 기존 GithubModule import + export(github.module.ts
  // L65)로 이미 공급됨 — 새 import 불요, 기존 GithubCollectionService 와 동일 패턴(ADR
  // 불요). CollectionSpecService/GithubCollectionSpecService 의 @Optional() env 는 미주입
  // 시 process.env 기본값.
  providers: [
    GithubCollectionService,
    ConfluenceCollectionService,
    CollectionOrchestratorService,
    CollectionPersistenceService,
    GithubOrgEnumerateService,
    GithubCollectionSpecService,
    CollectionSpecService,
    CollectionEntryService,
    // slice vi(T-0268): since 도출 service. 생성자 의존 AssessmentService 는 UserModule
    // import 로 공급됨(새 import 0). 호출처가 deriveSince → collectForPerson 으로 잇는다.
    SinceDerivationService,
  ],
  // 두 collection service / orchestrator / 영속화 service 는 후속 slice / 외부가 inject.
  // enumerate chain 은 외부 진입점 CollectionEntryService 만 export 한다 — 중간 chain
  // service(CollectionSpecService / GithubCollectionSpecService / GithubOrgEnumerateService)
  // 는 module 내부 의존이라 의존성 표면 최소화 차원에서 미export(외부 직접 사용 명분 0).
  exports: [
    GithubCollectionService,
    ConfluenceCollectionService,
    CollectionOrchestratorService,
    CollectionPersistenceService,
    CollectionEntryService,
    // slice vi(T-0268): 후속 호출처(scheduler/manual trigger, 별도 module)가 inject 받아
    // since 를 산출하기 위해 export.
    SinceDerivationService,
  ],
})
export class AssessmentCollectionModule {}
