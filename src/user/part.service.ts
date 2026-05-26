// PartService — Part 도메인 의 application service. T-0046 acceptance §PartService 박제.
//
// 책임:
//   - PartRepository 의 4 CRUD primitive (create / findById / findMany / delete) +
//     PersonRepository.findByPartId (T-0041) 위에 도메인 의미 부여 — NotFoundException /
//     ConflictException 으로 Prisma known error code 변환, REQ-028 의 "정확히 1 Part"
//     invariant 의 service-layer enforce.
//   - 본 service 가 노출하는 5 메서드 (create / findAll / findById / delete /
//     findPersonsByPartId) 가 PartController 의 5 endpoint 의 forward 대상.
//   - Prisma 의 known error code (`P2002` = unique constraint / `P2025` = record not
//     found / `P2003` = FK constraint failed) 를 NestJS 의 HttpException
//     (ConflictException / NotFoundException) 으로 변환.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - PartRepository.update 추가 / PATCH endpoint 없음 (CRUD 의 C/R/D 만 — 별도 후속 task).
//   - Part name 의 regex / trim / case-insensitive 중복 검증 같은 정교한 validation 없음
//     (schema `@unique` 의 raw propagate 만).
//   - Person.partId 의 mandatory invariant 강제 없음 (PersonService 책임).
//   - findByName / 기타 추가 query 없음.
//   - AuthGuard / 권한 없음 (후속 task 책임).
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Part, Person } from "@prisma/client";

import type { CreatePartDto } from "./dto/create-part.dto";
import { PartRepository } from "./part.repository";
import { PersonRepository } from "./person.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// PersonService 의 동일 helper 와 동일 duck typing 패턴 — `Prisma.PrismaClientKnownRequestError`
// 의 instanceof check 대신 runtime 의존성 회피 차원. (PartRepository spec 의
// `Object.assign(new Error, { code: "P2002" })` 패턴과 정합.)
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
export class PartService {
  constructor(
    private readonly partRepository: PartRepository,
    // findPersonsByPartId 의 reverse query 호출 source — PersonRepository.findByPartId
    // (T-0041) 로 Part 소속 Person 조회. PartRepository 확장 회피 차원.
    private readonly personRepository: PersonRepository,
  ) {}

  // create — REQ-028 신규 Part 추가. name `@unique` 중복 시 ConflictException.
  async create(dto: CreatePartDto): Promise<Part> {
    try {
      return await this.partRepository.create({ name: dto.name });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(`part name already in use: ${dto.name}`);
      }
      throw error;
    }
  }

  // findAll — 전체 Part 조회. 정렬 / pagination 등은 후속 task 책임 (본 layer 는 raw
  // forward). PartRepository.findMany 의 native Prisma default 순서 유지.
  async findAll(): Promise<Part[]> {
    return this.partRepository.findMany();
  }

  // findById — null 반환 분기 를 NotFoundException 으로 변환 (HTTP 404 자동 mapping).
  // PersonService.findById 의 패턴 직접 reuse.
  async findById(id: string): Promise<Part> {
    const found = await this.partRepository.findById(id);
    if (found === null) {
      throw new NotFoundException(`part not found: ${id}`);
    }
    return found;
  }

  // delete — REQ-028 invariant 의 service-layer enforce. 두 Prisma error 분기 변환:
  //   - P2025 (row 부재) → NotFoundException
  //   - P2003 (FK 위반 — 소속 Person 1+) → ConflictException
  //     ("part has assigned persons: <id>") — schema 의 cascade default Restrict 가
  //     dangling reference 차단. service 가 그 의도를 HTTP 의미로 변환.
  async delete(id: string): Promise<void> {
    try {
      await this.partRepository.delete(id);
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException(`part not found: ${id}`);
      }
      if (code === "P2003") {
        throw new ConflictException(`part has assigned persons: ${id}`);
      }
      throw error;
    }
  }

  // findPersonsByPartId — REQ-028 의 reverse query (지정 Part 소속 Person 목록).
  // 옵션 선택 (a) — Part 존재 검증을 위해 findById 재호출 (NotFoundException 강제),
  // 그 후 PersonRepository.findByPartId forwarding.
  // 옵션 (b) (PersonRepository.findByPartId 의 빈 배열 = Part 없음 가정) 대비 장점:
  //   (1) 실 "Part 없음" 과 "Part 있으나 Person 0" 의 두 분기 구별 가능 (404 vs 200+[]).
  //   (2) HTTP semantics 정합 — 존재하지 않는 부모 resource 의 child 조회는 404 가 표준.
  // activeOnly 는 default true 유지 (PersonRepository.findByPartId 의 default 와 동일,
  // REQ-026 휴직/비활성 invariant — 휴직자 숨김).
  async findPersonsByPartId(partId: string): Promise<Person[]> {
    // Part 존재 검증 — null 시 NotFoundException throw (findById 가 책임).
    await this.findById(partId);
    return this.personRepository.findByPartId(partId);
  }
}
