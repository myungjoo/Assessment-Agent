// CollectionTriggerService — collection manual-trigger endpoint(POST /api/assessment-
// collection/collect, controller 는 #3 slice)의 orchestration. ADR-0031 §3 6단계로 4
// building block(PersonService / SinceDerivationService / AssessmentService /
// CollectionEntryService)을 조립해 한 Person 을 "지금 수집" 한다(REQ-040 manual trigger /
// REQ-029 영속 / REQ-031 incremental 재수집).
//
// 책임 경계(Out of Scope): building block 재구현 0 — 호출만(시그니처 불변). module
// provider 배선은 #3 controller slice(본 service 는 spec 에서 직접 인스턴스화 mock 주입으로
// 검증). throw 는 잡지 않고 그대로 전파(fail-fast) — Person 404 / literal 400 / P2002 409 /
// collect reject 가 호출자(controller→HTTP status)로 흐른다. live/credentialed 수집은
// Q-0025 deferred(4 의존성 전부 mock-testable, 실 DB·실 token 0).
import { Injectable } from "@nestjs/common";

import { AssessmentService } from "../user/assessment.service";
import { PersonService } from "../user/person.service";

import { CollectionEntryService } from "./collection-entry.service";
import { CollectTriggerDto } from "./dto/collect-trigger.dto";
import { SinceDerivationService } from "./since-derivation.service";

// CollectionTriggerSummary — triggerCollection 의 반환 shape. controller(#3)·spec 가 재사용.
// 영속화된 Contribution[] 전문 대신 요약을 반환한다(전문은 GET /api/assessments 등 조회
// 경로로 확보, ADR-0031 §2). since 는 deriveSinceWithRecollectionWindow 결과(R-58 backoff;
// undefined → JSON null = full collection).
export interface CollectionTriggerSummary {
  assessmentId: string;
  personId: string;
  since: string | null;
  period: string;
  scope: string;
  periodStart: string;
  contributionCount: number;
}

@Injectable()
export class CollectionTriggerService {
  constructor(
    private readonly personService: PersonService,
    private readonly sinceDerivationService: SinceDerivationService,
    private readonly assessmentService: AssessmentService,
    private readonly collectionEntryService: CollectionEntryService,
  ) {}

  // triggerCollection — ADR-0031 §3 6단계 합성. 각 building block 의 throw 는 잡지 않고
  // 그대로 전파(fail-fast). Assessment row 는 collectForPerson 의 persist FK 가 요구하므로
  // collect 전에 생성한다.
  async triggerCollection(
    dto: CollectTriggerDto,
  ): Promise<CollectionTriggerSummary> {
    // (1) Person resolve(serviceIdentities 포함). 부재 → NotFoundException 404 전파.
    const person = await this.personService.findByIdWithIdentities(
      dto.personId,
    );

    // (2) serviceIdentities → CollectForPersonInput(귀속 key = service + externalId).
    const serviceIdentities = person.serviceIdentities.map((si) => ({
      service: si.service,
      externalId: si.externalId,
    }));

    // (3) incremental since 도출 — R-58 backoff variant(T-0603) 채택. 직전 Assessment
    // periodStart 를 기준으로 최근 1주(기본 windowDays=7)를 겹쳐 재수집하도록 경계를 뒤로
    // 물린다(REQ-031/R-58 — 겹친 부분은 dedup 이 흡수). 신규 인원(직전 0건)은 backoff
    // 패스스루로 여전히 undefined=full collection. windowDays 미전달 → 기본 7일 backoff.
    const since =
      await this.sinceDerivationService.deriveSinceWithRecollectionWindow(
        dto.personId,
      );

    // periodStart = 이번 수집 경계(ADR-0031 §1). dto 제공 시 그 ISO 값, 미제공 시 서버
    // now(). 이 값이 다음 수집의 since 하한이 된다(T-0267 periodStart-as-boundary convention).
    const periodStart = dto.periodStart ?? new Date().toISOString();

    // (4) Assessment row 생성. 평가-산출 필드는 placeholder(수집은 평가 안 함, ADR-0029 §1
    // — P5 평가가 immutability 규칙[ADR-0006]대로 delete 후 재생성으로 실값 채움).
    // AssessmentCreateInput.periodStart 는 Date 타입이라 ISO string → Date 변환. P2002
    // (동일 경계 중복) → ConflictException 전파. collectForPerson 전 필수(persist FK).
    const assessment = await this.assessmentService.create({
      personId: dto.personId,
      period: dto.period,
      scope: dto.scope,
      periodStart: new Date(periodStart),
      difficulty: "medium",
      contributionScore: 0,
      volume: 0,
      narrative: "",
    });

    // (5) 수집→귀속 필터→영속화(collectForPerson 4단계). reject 그대로 전파.
    const contributions = await this.collectionEntryService.collectForPerson(
      { serviceIdentities },
      since,
      assessment.id,
    );

    // (6) summary 반환(Contribution[] 전문 대신 요약, ADR-0031 §2).
    return {
      assessmentId: assessment.id,
      personId: dto.personId,
      since: since ?? null,
      period: dto.period,
      scope: dto.scope,
      periodStart,
      contributionCount: contributions.length,
    };
  }
}
