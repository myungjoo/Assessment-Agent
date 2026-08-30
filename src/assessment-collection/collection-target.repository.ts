// CollectionTargetRepository — ADR-0059 §Follow-ups (b) 전반부. T-1808 이 박은
// `model CollectionTarget` 위에 CRUD primitive 5 종만 얹는다. PartRepository
// (src/user/part.repository.ts) 의 shape 을 mirror 한 얇은 forwarding layer.
//
// 책임 경계 — `collectionTarget` delegate 에 1:1 forwarding 만 하고 도메인 검증 (type
// 값 "GITHUB" / "CONFLUENCE" 여부, GITHUB 인데 spaces 가 채워졌는지 같은 type 별 조건부
// 필수성) 은 0 이다 — DTO 의 `@IsIn` 과 후속 service 책임 (ADR-0059 §Consequences (c)).
// credential 경계상 자격증명 계열 필드 0, DB 는 `instanceKey` 참조만 보관 (§Decision 2).
//
// Prisma error 정책 — 예외를 붙잡지 않고 raw propagate: create 의 `@@unique` 축
// (type, instanceKey) 위반 `P2002` 와 update / delete 의 row 부재 `P2025` 가 그대로
// throw 되고 findById 만 null 을 돌려준다. `P2002` → 409 / `P2025` → 404 변환은 service 소관
// (ADR-0059 §Decision 5 오류 계약 표 c / d 행).
import { Injectable } from "@nestjs/common";
import type { CollectionTarget } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// create 의 input shape (ADR-0059 §Decision 4 필드 표). type / instanceKey /
// endpoint 는 필수, 나머지는 schema default 위임 가능 (배열 3 종은 빈 배열, active true).
export interface CollectionTargetCreateInput {
  type: string;
  instanceKey: string;
  endpoint: string;
  orgs?: string[];
  repos?: string[];
  spaces?: string[];
  active?: boolean;
}

// update 의 input shape — PATCH 의 partial semantics. 모든 필드 optional 이고 빈 객체
// `{}` 도 valid (Prisma 가 `@updatedAt` 만 갱신 — no-op 아님). **type / instanceKey 는
// 정체성 축이라 갱신 축에서 의도적으로 제외** 한다 (ADR-0059 §Decision 5 PATCH 행).
export interface CollectionTargetUpdateInput {
  endpoint?: string;
  orgs?: string[];
  repos?: string[];
  spaces?: string[];
  active?: boolean;
}

@Injectable()
export class CollectionTargetRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — (type, instanceKey) 중복 시 `P2002` 를 raw propagate.
  async create(input: CollectionTargetCreateInput): Promise<CollectionTarget> {
    return this.prisma.collectionTarget.create({ data: input });
  }

  // findById — row 부재 분기는 null 반환 (null-safe API, throw 안 함).
  async findById(id: string): Promise<CollectionTarget | null> {
    return this.prisma.collectionTarget.findUnique({ where: { id } });
  }

  // findMany — 전체 조회. 정렬 / 필터는 상위 layer 책임 (본 layer 는 raw forward).
  async findMany(): Promise<CollectionTarget[]> {
    return this.prisma.collectionTarget.findMany();
  }

  // update — id 부재 시 `P2025` 를 raw propagate.
  async update(
    id: string,
    input: CollectionTargetUpdateInput,
  ): Promise<CollectionTarget> {
    return this.prisma.collectionTarget.update({ where: { id }, data: input });
  }

  // delete — hard delete. id 부재 시 `P2025` 를 raw propagate. relation 0 인 독립
  // table 이라 `P2003` (FK) 분기는 부재 (ADR-0059 §Decision 6).
  async delete(id: string): Promise<CollectionTarget> {
    return this.prisma.collectionTarget.delete({ where: { id } });
  }
}
