// CollectionPersistenceService — 수집된 `Activity[]` 를 v-a 매퍼로 `ContributionCreateInput`
// 으로 변환한 뒤 기존 `ContributionService.create` 로 `Contribution` row 를 영속화하는
// service(ADR-0029 Decision §6 Activity → Contribution 영속화 매핑, collection slice (v-c),
// REQ-031~033). orchestrator 의 aggregate(`collectActivities` → `Activity[]`, T-0253)와
// 순수 매퍼(`mapActivityToContribution`, T-0252)는 머지됐으나 그 둘을 이어 실제로 DB 에
// 영속화하는 caller 가 아직 0 이었다 — 본 service 가 그 마지막 영속화 단계다.
//
// 흐름: collectAndPersist(spec, assessmentId)
//   (1) `orchestrator.collectActivities(spec)` 로 두 source 를 모은 `Activity[]` aggregate.
//   (2) `persistActivities(activities, assessmentId)` 로 위임 — 각 `Activity` 를
//       `mapActivityToContribution` 로 `ContributionCreateInput` 변환(순수, 평가 필드
//       placeholder, ADR-0029 §6) 후 `contributionService.create` 로 순차 영속화.
//   입력 `Activity[]` 순서(orchestrator 의 GitHub→Confluence)를 그대로 보존한다(결정론).
//
// collect/persist 경계 분리(ADR-0030 §5 slice iii-b1): 영속화 단계를 `persistActivities`
// (이미 수집된 `Activity[]` 를 받아 영속화)로 추출한다. 이는 후속 `collectForPerson`
// (slice iii-b2)가 collect 와 persist 사이에 author 필터(`filterActivitiesByAuthor`, T-0262)
// 를 끼울 수 있는 hook 이다 — `collectAndPersist` 의 공개 동작·시그니처는 불변(내부 분리만).
//
// per-activity 오류 방침(ADR-0029 §6 + task §AC): 본 영속화는 transactional all-or-nothing
// 도, per-activity skip 도 아닌 **fail-fast 전파**다. assessmentId 는 호출 단위로 동일하므로
// FK 위반(Assessment row 부재)이면 첫 `create` 가 P2003→`BadRequestException` 으로 throw 하고,
// 그 오류를 잡지 않고 그대로 전파해 전체 호출을 실패시킨다(잘못된 참조 input 은 호출 전체의
// 오류라는 의미). 따라서 FK 오류의 경우 어떤 row 도 영속화되기 전에 실패한다. 빈 `Activity[]`
// (수집 0건)면 `create` 를 0회 호출하고 빈 `Contribution[]` 를 반환한다(throw 0).
//
// 책임 경계(Out of Scope — task §Out of Scope): 본 service 는 **이미 산출된 `CollectionSpec`
// 과 `assessmentId` 를 입력으로 받는다**. Person enumerate(`collectForPerson` + ServiceIdentity→
// CollectionSpec 산출)는 slice (v-b2), incremental since 도출은 slice (vi)로 분리된다.
// assessmentId 에 해당하는 `Assessment` row 생성/조회는 본 service 밖이며 FK 유효성은
// `ContributionService.create` 의 P2003→400 변환에 위임한다. 평가 필드(difficulty/score/volume)
// 는 매퍼가 placeholder 로 채우며 P5 평가가 갱신한다. live/credentialed 수집은 Q-0025 대로
// deferred — 본 service 는 mock 주입 orchestrator + mock ContributionService 위에서만 unit-test 된다.
import { Injectable } from "@nestjs/common";
import type { Contribution } from "@prisma/client";

import { ContributionService } from "../user/contribution.service";

import {
  CollectionOrchestratorService,
  CollectionSpec,
} from "./collection-orchestrator.service";
import { Activity } from "./domain/activity";
import { mapActivityToContribution } from "./domain/activity-contribution.mapper";

@Injectable()
export class CollectionPersistenceService {
  constructor(
    private readonly orchestrator: CollectionOrchestratorService,
    private readonly contributions: ContributionService,
  ) {}

  // collectAndPersist — spec 으로 두 source 를 모아(orchestrator) 각 활동을 매퍼로
  // `ContributionCreateInput` 변환 후 `ContributionService.create` 로 영속화한다.
  // 반환 `Contribution[]` 순서는 입력 `Activity[]` 순서(GitHub→Confluence)와 일치한다.
  // create 가 throw(예: assessmentId FK 위반 → BadRequestException)하면 잡지 않고
  // 그대로 전파한다(fail-fast). 빈 수집 결과면 create 0회 + 빈 배열 반환.
  async collectAndPersist(
    spec: CollectionSpec,
    assessmentId: string,
  ): Promise<Contribution[]> {
    const activities = await this.orchestrator.collectActivities(spec);
    return this.persistActivities(activities, assessmentId);
  }

  // persistActivities — 이미 수집된 `Activity[]` 를 매퍼로 `ContributionCreateInput` 으로
  // 변환한 뒤 `ContributionService.create` 로 순차 영속화해 `Contribution[]` 를 반환한다.
  // orchestrator 를 호출하지 않는다(이미 수집된 활동을 받는다) — 이것이 collect 와 persist
  // 사이에 author 필터를 끼우는 hook(slice iii-b2 가 소비). 반환 순서는 입력 순서와 일치.
  // create 가 throw(예: assessmentId FK 위반 → BadRequestException)하면 잡지 않고 그대로
  // 전파한다(fail-fast — 첫 오류에서 중단, 이후 create 미호출). 빈 입력이면 create 0회 +
  // 빈 배열(throw 0).
  async persistActivities(
    activities: Activity[],
    assessmentId: string,
  ): Promise<Contribution[]> {
    const persisted: Contribution[] = [];
    for (const activity of activities) {
      // 매퍼는 순수 변환(검증 0) — assessmentId 유효성은 ContributionService 가 책임.
      const input = mapActivityToContribution(activity, assessmentId);
      // 순차 await — 결정론적 순서 보존 + 첫 오류에서 fail-fast 전파.
      persisted.push(await this.contributions.create(input));
    }
    return persisted;
  }
}
