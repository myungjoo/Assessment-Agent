// CollectionTargetService — ADR-0059 §Follow-ups (b) 후반부 (read + create 축은 T-1810,
// update + delete 축은 T-1811 이 얹어 (b) 를 종결한다).
// T-1809 가 박은 CollectionTargetRepository 의 primitive 위에 ADR-0059 §Decision 5 오류
// 계약을 얹는 얇은 변환층이며 PartService (src/user/part.service.ts) 의 shape 을 mirror 한다.
//
// 집행하는 오류 계약 행 (§Decision 5 오류 표):
//   - c 행 — 동일 `(type, instanceKey)` 재등록 시 repository create 가 raw propagate 한
//     `P2002` 를 붙잡아 `ConflictException` (HTTP 409) 으로 변환.
//   - d 행 — 단건 조회의 row 부재 (repository findById 의 `null`) 를 `NotFoundException`
//     (HTTP 404) 으로 변환. 나머지 행 (a 401 / b 403 guard, e 400 ValidationPipe) 은 본
//     layer 소관이 아니다.
//
// 책임 경계 — 도메인 검증 (type 허용 값 · type 별 조건부 필수 필드) 은 DTO 의 `@IsIn` /
// `@IsArray` 소관이라 인자를 그대로 pass-through 한다 (§Consequences (c)). credential 계열
// 필드는 만들지도 되돌리지도 않는다 — row 는 `instanceKey` 참조만 보관 (§Decision 2).
// DTO · controller · route 배선은 §Follow-ups (c) 소관으로 본 layer 밖이다.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CollectionTarget } from "@prisma/client";

import {
  CollectionTargetRepository,
  type CollectionTargetCreateInput,
  type CollectionTargetUpdateInput,
} from "./collection-target.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자다.
// PartService / PersonService 와 동일한 duck-typing 패턴 (`instanceof
// Prisma.PrismaClientKnownRequestError` 의 runtime 의존성 회피 — repository spec 의
// `Object.assign(new Error(), { code: "P2002" })` 패턴과도 정합).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

@Injectable()
export class CollectionTargetService {
  constructor(
    private readonly collectionTargetRepository: CollectionTargetRepository,
  ) {}

  // create — REQ-070 신규 수집 대상 등록. `@@unique([type, instanceKey])` 위반 시의
  // `P2002` 만 ConflictException 으로 변환하고 (오류 표 c 행), 그 외 error 는 code 유무와
  // 무관하게 raw propagate 한다 (오변환 금지 — 다른 Prisma code 를 409 로 삼키면 원인이
  // 소실된다).
  async create(input: CollectionTargetCreateInput): Promise<CollectionTarget> {
    try {
      return await this.collectionTargetRepository.create(input);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          `collection target already registered: ${input.type}/${input.instanceKey}`,
        );
      }
      throw error;
    }
  }

  // findAll — REQ-072 전체 목록. 0 row 는 정상 상태이므로 빈 배열을 그대로 돌려주고 throw
  // 하지 않는다 (§Decision 5 GET 표). 정렬 / 필터 / pagination 은 후속 slice 책임.
  async findAll(): Promise<CollectionTarget[]> {
    return this.collectionTargetRepository.findMany();
  }

  // findById — repository 의 null-safe 반환을 HTTP 의미로 변환 (오류 표 d 행).
  // row 존재 시 가공 없이 그대로 반환한다.
  async findById(id: string): Promise<CollectionTarget> {
    const found = await this.collectionTargetRepository.findById(id);
    if (found === null) {
      throw new NotFoundException(`collection target not found: ${id}`);
    }
    return found;
  }

  // update — REQ-073 부분 수정. repository update 가 raw propagate 한 `P2025` (:id row
  // 부재) 만 NotFoundException 으로 변환한다 (§Decision 5 오류 표 d 행). 그 외 error 는
  // code 유무와 무관하게 raw propagate — 다른 Prisma code 를 404 로 삼키면 원인이 소실된다.
  // 정체성 축 (`type` · `instanceKey`) 은 CollectionTargetUpdateInput 이 애초에 받지 않으므로
  // (§Decision 5 PATCH 행) 본 layer 의 제거 로직 0 이고, 빈 객체 `{}` 도 그대로 forward 한다
  // (Prisma 가 `@updatedAt` 만 갱신 — no-op 아님).
  async update(
    id: string,
    input: CollectionTargetUpdateInput,
  ): Promise<CollectionTarget> {
    try {
      return await this.collectionTargetRepository.update(id, input);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`collection target not found: ${id}`);
      }
      throw error;
    }
  }

  // delete — REQ-073 등록 해제 (hard delete). update 와 동일하게 `P2025` 만
  // NotFoundException 으로 변환하고 (§Decision 5 오류 표 d 행) 나머지는 raw propagate 한다.
  // relation 0 인 독립 table 이라 `P2003` (FK) 분기는 부재하지만 (§Decision 6), 그런 code 가
  // 와도 삼키지 않고 그대로 올린다.
  async delete(id: string): Promise<CollectionTarget> {
    try {
      return await this.collectionTargetRepository.delete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`collection target not found: ${id}`);
      }
      throw error;
    }
  }
}
