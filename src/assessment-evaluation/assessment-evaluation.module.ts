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

import { LLM_GATEWAY } from "../llm/llm-gateway.interface";
import { LlmHttpGateway } from "../llm/llm-http-gateway.service";
import { LlmModule } from "../llm/llm.module";

import { AssessmentEvaluationController } from "./assessment-evaluation.controller";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";
import { EvaluationScoringService } from "./evaluation-scoring.service";
import { SummaryNarrativeService } from "./summary-narrative.service";
import { SummaryPersistService } from "./summary-persist.service";

@Module({
  // LlmModule import — LlmHttpGateway(LlmGateway 구현체) export 를 끌어와 LLM_GATEWAY
  // token 바인딩을 닫는다(평가 → llm 단방향). PersistenceModule 등 추가 import 불요 —
  // LlmModule 이 (전이로) 자기 의존을 모두 닫는다.
  imports: [LlmModule],
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
  ],
})
export class AssessmentEvaluationModule {}
