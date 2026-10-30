// CollectionTargetReader — 수집 경로가 쓰는 CollectionTarget 읽기 전용 포트 (ADR-0059 §Decision 3).
// GithubModule 이 AssessmentCollectionModule 을 거꾸로 import 하지 않도록 @Global PrismaService
// 만 의존한다. 캐시가 없어 다음 수집부터 재기동 없이 변경이 반영된다.
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../persistence/prisma.service";

import type { CollectionTargetRow } from "./effective-instances";

@Injectable()
export class CollectionTargetReader {
  constructor(private readonly prisma: PrismaService) {}

  /** 등록된 수집 대상 전체. 비활성 row 도 포함한다 (충돌 진단에 쓴다). */
  async findAll(): Promise<CollectionTargetRow[]> {
    return this.prisma.collectionTarget.findMany({
      select: {
        type: true,
        instanceKey: true,
        endpoint: true,
        orgs: true,
        repos: true,
        spaces: true,
        active: true,
        createdAt: true,
      },
    });
  }
}
