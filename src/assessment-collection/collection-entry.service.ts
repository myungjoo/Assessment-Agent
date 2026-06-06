// CollectionEntryService — collection enumerate/collect 체인의 최종 진입점. 한 Person 에
// 대해 buildCollectionSpec(T-0261) → collectActivities(orchestrator, T-0253) →
// filterActivitiesByAuthor(T-0262) → persistActivities(T-0263) 4단계를 조립해 영속화된
// Contribution[] 를 반환한다(ADR-0030 §5 collectForPerson 진입 계약). author 필터가 collect
// 와 persist 사이에 들어가 Person 기여만 귀속·영속화된다.
//
// 책임 경계(Out of Scope): 4개 building block(spec/orchestrator/filter/persistence)은
// 호출·import 만(재구현 0). since 도출은 slice vi — 본 service 는 주입받아 pass-through.
// assessmentId 의 Assessment row 생성/조회는 본 service 밖(호출처 = scheduler/manual
// trigger 책임) — FK 유효성은 persistActivities → ContributionService.create(P2003→400)에
// 위임(throw 전파, 본 service 는 잡지 않음). module provider 배선은 slice iii-b2b.
// live/credentialed 수집은 Q-0025 deferred — mock 주입 3 service 위에서만 unit-test.
import { Injectable } from "@nestjs/common";
import type { Contribution, ServiceIdentity } from "@prisma/client";

import { CollectionOrchestratorService } from "./collection-orchestrator.service";
import { CollectionPersistenceService } from "./collection-persistence.service";
import { CollectionSpecService } from "./collection-spec.service";
import { filterActivitiesByAuthor } from "./domain/author-filter";

// CollectForPersonInput — collectForPerson 의 person 입력 contract. serviceIdentities 의
// `service`(buildCollectionSpec 의 instance 매칭용)와 `externalId`(author 귀속 필터용)를
// 둘 다 보유한다(ADR-0030 §2 — author 귀속 key 는 externalId). 전체 Prisma Person row 불요.
export interface CollectForPersonInput {
  serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[];
}

@Injectable()
export class CollectionEntryService {
  constructor(
    private readonly specService: CollectionSpecService,
    private readonly orchestrator: CollectionOrchestratorService,
    private readonly persistence: CollectionPersistenceService,
  ) {}

  // collectForPerson — 한 Person 의 수집→귀속→영속화 4단계를 조립한다.
  //   (1) buildCollectionSpec(person, since) → CollectionSpec(GitHub mode B+A + Confluence)
  //   (2) collectActivities(spec) → Activity[](GitHub+Confluence aggregate, orchestrator throw 0)
  //   (3) filterActivitiesByAuthor(activities, serviceIdentities) → Person 귀속 활동만
  //   (4) persistActivities(filtered, assessmentId) → 영속화된 Contribution[] 반환
  // since 는 도출 없이 (1)로 pass-through(slice vi). assessmentId 는 (4)로 전달하고 FK
  // 유효성은 persistActivities(→ ContributionService)에 위임(throw 전파).
  //
  // since 는 의미상 optional 이지만 뒤따르는 assessmentId 가 required 라 TS 상 optional
  // 파라미터를 required 앞에 둘 수 없어 `string | undefined` 로 받는다 — 호출처는 since
  // 미지정 시 `undefined` 를 명시 전달한다.
  async collectForPerson(
    person: CollectForPersonInput,
    since: string | undefined,
    assessmentId: string,
  ): Promise<Contribution[]> {
    const spec = await this.specService.buildCollectionSpec(person, since);
    const activities = await this.orchestrator.collectActivities(spec);
    const filtered = filterActivitiesByAuthor(
      activities,
      person.serviceIdentities,
    );
    return this.persistence.persistActivities(filtered, assessmentId);
  }
}
