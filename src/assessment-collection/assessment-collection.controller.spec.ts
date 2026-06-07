// AssessmentCollectionController unit test — CollectionTriggerService 를 jest mock 으로
// 주입해 controller 의 위임(delegation)만 검증한다(ADR-0031 §5 — RBAC/ValidationPipe 통합은
// #4 e2e[supertest]가 cover). AssessmentController.spec 의 unit 부분 mirror.
import { ConflictException, NotFoundException } from "@nestjs/common";

import { AssessmentCollectionController } from "./assessment-collection.controller";
import { CollectionTriggerService } from "./collection-trigger.service";
import type { CollectionTriggerSummary } from "./collection-trigger.service";
import { CollectTriggerDto } from "./dto/collect-trigger.dto";

const dto: CollectTriggerDto = {
  personId: "person-1",
  period: "week",
  scope: "commit",
  periodStart: "2026-06-01T00:00:00.000Z",
};

// makeController — triggerCollection mock 주입한 controller + spy 반환.
function makeController(triggerImpl: () => Promise<CollectionTriggerSummary>): {
  controller: AssessmentCollectionController;
  triggerSpy: jest.Mock;
} {
  const triggerSpy = jest.fn(triggerImpl);
  const triggerService = {
    triggerCollection: triggerSpy,
  } as unknown as CollectionTriggerService;
  return {
    controller: new AssessmentCollectionController(triggerService),
    triggerSpy,
  };
}

describe("AssessmentCollectionController", () => {
  it("collect() 가 triggerCollection 에 dto 그대로 위임하고 summary 를 반환한다 (happy)", async () => {
    const summary: CollectionTriggerSummary = {
      assessmentId: "assess-1",
      personId: "person-1",
      since: "2026-05-01T00:00:00.000Z",
      period: "week",
      scope: "commit",
      periodStart: "2026-06-01T00:00:00.000Z",
      contributionCount: 3,
    };
    const { controller, triggerSpy } = makeController(async () => summary);

    const result = await controller.collect(dto);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy).toHaveBeenCalledWith(dto);
    expect(result).toBe(summary);
  });

  it("triggerCollection 이 NotFoundException(Person 부재) reject 시 그대로 전파한다 (negative)", async () => {
    const { controller } = makeController(async () => {
      throw new NotFoundException("person not found: person-1");
    });

    await expect(controller.collect(dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("triggerCollection 이 ConflictException(동일 경계 P2002) reject 시 그대로 전파한다 (negative)", async () => {
    const { controller } = makeController(async () => {
      throw new ConflictException("assessment already exists");
    });

    await expect(controller.collect(dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
