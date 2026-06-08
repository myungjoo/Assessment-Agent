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
//
// 책임 경계(본 module 밖 — 후속 slice):
//   - controller 등록 0 — 평가 HTTP endpoint(R-9 사용자 지정 기간 포함)는 후속 slice.
//   - AppModule 등록 0 — 본 module 의 외부 배선은 호출처(orchestrator) slice 가
//     진입할 때 추가한다(의존성 표면 최소화). 본 module 자체는 LlmModule import 만으로
//     compile 자기충족(module.spec 의 compile test 로 검증).
import { Module } from "@nestjs/common";

import { LLM_GATEWAY } from "../llm/llm-gateway.interface";
import { LlmHttpGateway } from "../llm/llm-http-gateway.service";
import { LlmModule } from "../llm/llm.module";

import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { EvaluationScoringService } from "./evaluation-scoring.service";

@Module({
  // LlmModule import — LlmHttpGateway(LlmGateway 구현체) export 를 끌어와 LLM_GATEWAY
  // token 바인딩을 닫는다(평가 → llm 단방향). PersistenceModule 등 추가 import 불요 —
  // LlmModule 이 (전이로) 자기 의존을 모두 닫는다.
  imports: [LlmModule],
  providers: [
    EvaluationScoringService,
    // EvaluationOrchestratorService — EvaluationScoringService 를 생성자 주입받는
    // 상위 compose service(T-0292). 같은 module 내 class provider 라 추가 token 0.
    EvaluationOrchestratorService,
    // LLM_GATEWAY → LlmHttpGateway useExisting 바인딩. LlmModule 이 등록·export 한
    // LlmHttpGateway singleton 을 그대로 재사용하므로 새 인스턴스 생성 0. interface
    // 가 runtime 소거라 string token 으로 주입을 닫는다.
    {
      provide: LLM_GATEWAY,
      useExisting: LlmHttpGateway,
    },
  ],
  // 후속 controller / orchestrator-상위 slice 가 inject 받기 위해 두 service 모두 export.
  exports: [EvaluationScoringService, EvaluationOrchestratorService],
})
export class AssessmentEvaluationModule {}
