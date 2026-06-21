// AssessmentEvaluationModule — P5 평가(scoring) layer 의 NestJS 배선 module
// (T-0291, ADR-0032 Follow-up §2 scoring service slice). 선행 dependency-free
// piece(T-0287 매퍼 / T-0288 result+volume / T-0290 prompt+classify)가 전부
// MERGED 됐고, 본 module 이 그 순수 함수들을 compose 하는 `EvaluationScoringService`
// 를 provider 로 등록 + export 한다. llm.module.ts / assessment-collection.module.ts
// 의 provider/export 패턴을 mirror 한다.
//
// 책임 범위:
//   - LlmModule import — LlmModule 이 `LlmHttpGateway`(`LlmGateway` 구현체)를
//     export(llm.module.ts L58/L66)하므로, 본 module 이 import 하면 그 singleton 을
//     LLM_GATEWAY token 에 useExisting 으로 바인딩할 수 있다. EvaluationScoringService
//     의 @Inject(LLM_GATEWAY) 생성자 주입이 이 바인딩으로 DI resolve 된다
//     (평가 → llm 단방향, llm 은 평가를 모름).
//   - LLM_GATEWAY token → LlmHttpGateway useExisting 바인딩 — 구현체를 직접 import
//     의존하지 않고 interface/token 의존으로 두기 위한 indirection(test 에서 mock
//     gateway 주입 용이). confluence.module.ts 의 CONFLUENCE_PERMISSION_DENIED_EMITTER
//     useClass 바인딩 패턴 mirror — 단 LlmHttpGateway 는 LlmModule 이 이미 등록한
//     singleton 이라 useClass(새 인스턴스) 대신 useExisting(동일 singleton 재사용)으로
//     바인딩해 중복 생성을 피한다.
//   - EvaluationScoringService provider 등록 + export — orchestrator slice 가
//     inject 받아 단위 평가를 조립한다.
//   - EvaluationOrchestratorService provider 등록 + export(T-0292) — Activity[] →
//     매퍼 → 평가-side dedup → scoreUnit → EvaluationResult[] 의 상위 compose layer.
//     EvaluationScoringService 를 같은 module 내 DI 로 주입받으므로 추가 import 0.
//     후속 controller / orchestrator-상위 slice 가 inject 받는다.
//   - AssessmentEvaluationController 등록(T-0293) — orchestrator 의 HTTP 진입점
//     (POST /api/assessment-evaluation/evaluate). EvaluationOrchestratorService 가
//     이미 provider 라 추가 provider 0(같은 module 내 DI resolve).
//
// 책임 경계(본 module 밖 — 후속 slice):
//   - period/personId → 수집 bridge endpoint 는 본 module 밖(별도 후속 slice).
//   - 평가 결과 영속화 / Prisma migration — §5 schema 게이트 deferred.
import { Module } from "@nestjs/common";

import { AssessmentCollectionModule } from "../assessment-collection/assessment-collection.module";
import { LLM_GATEWAY } from "../llm/llm-gateway.interface";
import { LlmHttpGateway } from "../llm/llm-http-gateway.service";
import { LlmModule } from "../llm/llm.module";
import { UserModule } from "../user/user.module";

import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { EvaluationPersistedRecordsReader } from "./evaluation-persisted-records-reader.service";
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";
import { EvaluationScoringService } from "./evaluation-scoring.service";
import { EvaluationUnevaluatedFillPlanner } from "./evaluation-unevaluated-fill-planner.service";
import { PeriodBridgeAdminPersistService } from "./period-bridge-admin-persist.service";
import { PeriodBridgeEphemeralService } from "./period-bridge-ephemeral.service";
import { SummaryAggregateOrchestratorService } from "./summary-aggregate-orchestrator.service";
import { SummaryNarrativeService } from "./summary-narrative.service";
import { SummaryPersistService } from "./summary-persist.service";
import { UnevaluatedFillRunOrchestratorService } from "./unevaluated-fill-run-orchestrator.service";

@Module({
  // LlmModule import — LlmHttpGateway(LlmGateway 구현체) export 를 끌어와 LLM_GATEWAY
  // token 바인딩을 닫는다(평가 → llm 단방향). PersistenceModule 등 추가 import 불요 —
  // LlmModule 이 (전이로) 자기 의존을 모두 닫는다.
  // AssessmentCollectionModule import — T-0316(ADR-0037 §Decision1 ephemeral bridge).
  // PeriodBridgeEphemeralService 의 생성자 의존 CollectionSpecService /
  // CollectionOrchestratorService 가 collection module export 로 DI resolve 된다
  // (evaluation → collection 단방향, collection 은 evaluation 미참조 — circular 부재).
  // persist service / collectForPerson 은 import 해도 본 ephemeral service 가 주입하지
  // 않으므로 도달 경로 0(구조적 write-0 보존).
  // UserModule import — T-0317(ADR-0037 slice 3). POST /period 가 personId →
  // resolved person 변환에 재사용하는 Person.findByIdWithIdentities 의 PersonService
  // 가 UserModule export 라 DI resolve 된다(controller → user 단방향). UserModule 은
  // AuthModule(forwardRef)만 import 하므로 circular 부재(AssessmentCollectionModule 도
  // 이미 UserModule 을 import 중 — 동일 singleton 재사용).
  imports: [LlmModule, AssessmentCollectionModule, UserModule],
  // T-0293: AssessmentEvaluationController 등록 — POST /api/assessment-evaluation/
  // evaluate 의 HTTP route 가 본 module import 로 NestJS 런타임에 살아난다.
  controllers: [AssessmentEvaluationController],
  providers: [
    EvaluationScoringService,
    // EvaluationOrchestratorService — EvaluationScoringService 를 생성자 주입받는
    // 상위 compose service(T-0292). 같은 module 내 class provider 라 추가 token 0.
    EvaluationOrchestratorService,
    // EvaluationResultPersistService — ADR-0033 §Follow-ups 3 (write service).
    // PrismaService(@Global PersistenceModule provider)를 생성자 주입받아 평가 결과를
    // 영속화한다. 추가 import 0 (PrismaService 가 @Global 이라 DI resolve). 후속
    // orchestrator/controller persist-return slice(§Follow-ups 4)가 inject 받는다.
    EvaluationResultPersistService,
    // SummaryNarrativeService — P5 aggregate(batch) 평가의 thin narrative service
    // (T-0307, ADR-0035 §Decision 1/5). @Inject(LLM_GATEWAY) 생성자 주입을 본 module
    // 의 LLM_GATEWAY useExisting 바인딩으로 닫는다(추가 import 0). T-0309 write service
    // slice 가 같은 module 내 DI 로 inject 받는다.
    SummaryNarrativeService,
    // SummaryPersistService — P5 aggregate 평가 write service (T-0309, ADR-0035
    // §Decision 1/4). PrismaService(@Global) + SummaryNarrativeService(같은 module)를
    // 생성자 주입받아 narrative(LLM) + metricScore(deterministic)를 결합해 Summary 를
    // reset-and-recreate 영속화한다. 추가 import 0. 후속 orchestrator/controller slice
    // 가 inject 받는다.
    SummaryPersistService,
    // SummaryAggregateOrchestratorService — P5 aggregate 평가 상위 compose service
    // (T-0310, ADR-0035 §Follow-ups orchestrator slice). SummaryPersistService(같은
    // module)를 생성자 주입받아 isPeriodEvaluable 시점 게이트 → persistSummary 위임을
    // compose 한다. 추가 import 0(같은 module 내 DI resolve). 후속 controller slice 가
    // inject 받는다.
    SummaryAggregateOrchestratorService,
    // PeriodBridgeEphemeralService — T-0316(ADR-0037 §Decision1 User self-only ephemeral
    // + §Decision4 fresh in-memory collect). CollectionSpecService /
    // CollectionOrchestratorService(AssessmentCollectionModule export) +
    // EvaluationOrchestratorService(같은 module)를 주입받아 collect→filter→evaluate 를
    // DB write 0 로 compose 한다(persist service 미주입 — 구조적 write-0). 후속 controller
    // slice(slice 3)가 같은 module 내 DI 로 inject 받는다.
    PeriodBridgeEphemeralService,
    // PeriodBridgeAdminPersistService — T-0321(ADR-0037 slice 2, §Decision1 Admin full
    // path + §Decision2 evaluation-side single-writer + amended §Decision3 first-write-
    // wins read-through + §Decision4 fresh collect). PeriodBridgeEphemeralService 의
    // sibling — 같은 persist-free compose 3 종(CollectionSpecService /
    // CollectionOrchestratorService(AssessmentCollectionModule export) /
    // EvaluationOrchestratorService(같은 module))에 더해 Admin 한정 persist 도달 경로 2 종
    // (EvaluationResultPersistService(같은 module provider) / AssessmentRepository
    // (UserModule export, 이미 import 중))을 주입받아 collect→filter→evaluate→
    // first-write-wins persist 를 compose 한다. ephemeral service 가 persist 를 주입조차
    // 안 함으로써 구조적으로 보장하는 write-0 은 sibling 분리로 그대로 유지되고, persist
    // 도달 가능성은 본 Admin service 에 국소화된다. 추가 module import 0. 후속 controller
    // slice(slice 3)가 같은 module 내 DI 로 inject 받는다.
    PeriodBridgeAdminPersistService,
    // EvaluationPersistedRecordsReader — T-0541(REQ-037 detection 사슬의 첫 impure 입력
    // source). 유일한 생성자 의존 AssessmentService 가 UserModule export(user.module.ts
    // L174)라 본 module 이 이미 import 중인 UserModule 로 DI resolve 된다(추가 import 0).
    // T-0543 wiring slice 가 등록 — 후속 orchestrator/controller 소비처가 inject 받는다.
    EvaluationPersistedRecordsReader,
    // EvaluationUnevaluatedFillPlanner — T-0542(REQ-037 detection 사슬의 impure compose
    // 완결). 유일한 생성자 의존 EvaluationPersistedRecordsReader 가 본 task 에서 같은
    // module 의 provider 가 되므로 같은 module 내 DI 로 resolve 된다(추가 import 0).
    // T-0543 wiring slice 가 등록 — 후속 orchestrator/controller 소비처가 inject 받는다.
    EvaluationUnevaluatedFillPlanner,
    // UnevaluatedFillRunOrchestratorService — T-0564(Q-0045 옵션1 run-side 사슬 slice 1'
    // loop-level @Injectable wiring). PersonService(UserModule export, 이미 import 중)와
    // PeriodBridgeAdminPersistService(같은 module provider)를 주입받아 person lookup
    // adapter(NotFoundException→null 화해) + generateAndPersist 바인딩을 compose 한 뒤
    // runUnevaluatedFillRunCore(T-0563)에 1 회 위임한다. 추가 module import 0. 후속
    // controller slice(POST /unevaluated-fill-run)가 같은 module 내 DI 로 inject 받는다.
    UnevaluatedFillRunOrchestratorService,
    // LLM_GATEWAY → LlmHttpGateway useExisting 바인딩. LlmModule 이 등록·export 한
    // LlmHttpGateway singleton 을 그대로 재사용하므로 새 인스턴스 생성 0. interface
    // 가 runtime 소거라 string token 으로 주입을 닫는다.
    {
      provide: LLM_GATEWAY,
      useExisting: LlmHttpGateway,
    },
  ],
  // 후속 controller / orchestrator-상위 slice 가 inject 받기 위해 service 들을 export.
  exports: [
    EvaluationScoringService,
    EvaluationOrchestratorService,
    EvaluationResultPersistService,
    // T-0309 write service slice 가 본 narrative service 를 inject 받을 수 있도록 export.
    SummaryNarrativeService,
    // 후속 orchestrator/controller slice 가 aggregate 평가를 영속화하기 위해 inject 받도록 export.
    SummaryPersistService,
    // 후속 controller slice 가 aggregate 평가 orchestrator 를 inject 받도록 export(T-0310).
    SummaryAggregateOrchestratorService,
    // 후속 controller slice(slice 3, POST /api/assessment-evaluation/period)가 ephemeral
    // bridge service 를 inject 받도록 export(T-0316).
    PeriodBridgeEphemeralService,
    // 후속 controller slice(slice 3, POST /api/assessment-evaluation/period Admin 분기)가
    // Admin full-persist bridge service 를 inject 받도록 export(T-0321).
    PeriodBridgeAdminPersistService,
    // 후속 orchestrator/controller 소비처가 미평가 fill detection 사슬 service 2종을
    // 다른 module 또는 같은 module DI 로 inject 받도록 export(T-0543 wiring slice).
    EvaluationPersistedRecordsReader,
    EvaluationUnevaluatedFillPlanner,
    // 후속 controller slice(POST /unevaluated-fill-run)가 person+persist 바인딩 compose
    // orchestrator 를 같은 module 내 DI 로 inject 받도록 export(T-0564).
    UnevaluatedFillRunOrchestratorService,
  ],
})
export class AssessmentEvaluationModule {}
