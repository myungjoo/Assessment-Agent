// PersonService — Person 도메인 의 application service. T-0036 acceptance C 박제.
//
// 책임:
//   - PersonRepository 의 6 CRUD primitive 위에 도메인 의미 부여 (Not Found / Conflict
//     의 HTTP exception 변환, deactivate / reactivate 의 의미 정의).
//   - 본 service 가 노출하는 8 메서드 (create / findActive / findAll / findById / update /
//     deactivate / reactivate / remove) 가 PersonController 의 5 endpoint 의 forward 대상.
//   - Prisma 의 known error code (`P2002` = unique constraint / `P2025` = record not
//     found) 를 NestJS 의 HttpException (ConflictException / NotFoundException) 으로 변환.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - ServiceIdentity / Group / Part 관련 로직 없음.
//   - NewPersonEvent emit 없음 (REQ-027 — AssessmentModule 도입 후 별도 task).
//   - isPrimary invariant 강제 없음 (ServiceIdentityService 책임).
//   - 권한 / AuthGuard 적용 없음 (T-0038+ 책임).
//
// hard delete 의 구현:
//   - PersonRepository 는 softDelete / restore 만 노출 (T-0034 의 6 메서드 박제).
//   - api.md L75 의 DELETE /api/persons/:id 는 hard delete 이므로 본 service 가
//     PrismaService 의 person.delete 를 직접 호출 (PersonRepository 확장 없이 5 file cap 보존).
//   - Person.serviceIdentities relation 의 `onDelete: Cascade` (schema.prisma §67) 가
//     ServiceIdentity 의 동반 삭제를 책임.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Person } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

import type { CreatePersonDto } from "./dto/create-person.dto";
import type { UpdatePersonDto } from "./dto/update-person.dto";
import { PersonRepository } from "./person.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자.
// `Prisma.PrismaClientKnownRequestError` 의 instanceof check 도 가능하나, runtime 의존성
// 을 늘리지 않기 위해 duck typing (`error.code`) 으로 통일 (PersonRepository spec 의
// 패턴과 일치 — spec §175 의 `Object.assign(new Error, { code: "P2002" })`).
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
export class PersonService {
  constructor(
    private readonly repository: PersonRepository,
    // hard delete 전용 — PersonRepository 확장 회피 (5 file cap 보존). 일반 CRUD 는
    // 모두 repository 경유.
    private readonly prisma: PrismaService,
  ) {}

  // create — REQ-023 신규 인원 추가. email 중복 시 ConflictException.
  async create(dto: CreatePersonDto): Promise<Person> {
    try {
      return await this.repository.create({
        fullName: dto.fullName,
        email: dto.email,
      });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(`email already in use: ${dto.email}`);
      }
      throw error;
    }
  }

  // findActive — REQ-026 default 활성 인원만 반환. controller GET /api/persons 의 backend.
  async findActive(): Promise<Person[]> {
    return this.repository.findMany({ activeOnly: true });
  }

  // findAll — admin 의 deactivated 포함 전체 조회 용. 본 task 는 controller 에서
  // 직접 endpoint 노출 안 함 — query param `?includeInactive=true` 도입은 후속 task.
  async findAll(): Promise<Person[]> {
    return this.repository.findMany({ activeOnly: false });
  }

  // findById — null 반환 분기 를 NotFoundException 으로 변환 (HTTP 404 자동 mapping).
  async findById(id: string): Promise<Person> {
    const found = await this.repository.findById(id);
    if (found === null) {
      throw new NotFoundException(`person not found: ${id}`);
    }
    return found;
  }

  // update — PATCH /api/persons/:id 의 backend. 단독 {active: true|false} payload 는
  // controller 가 별도 routing 으로 service.deactivate / service.reactivate 호출, 본
  // 메서드는 fullName / email 의 부분 수정만 처리. active 가 patch 에 동시 포함되어
  // 들어와도 본 메서드는 묵시적으로 drop (L102-107 의 spread 에서 active 키 제외).
  // 동시 patch 의 active 처리는 T-0036.5 follow-up — UC-03 §6.1 reactivate 의도가 동시
  // patch 케이스에서 silently 무시되는 점은 reviewer PR-35 round 1/7 MAJOR-2 박제.
  async update(id: string, patch: UpdatePersonDto): Promise<Person> {
    try {
      // class-validator 가 통과시킨 patch 객체는 keys 가 dto 의 정의된 필드 (whitelist) 로
      // 한정. fullName / email / active 만 forward 가능.
      return await this.repository.update(id, {
        ...(patch.fullName !== undefined && { fullName: patch.fullName }),
        ...(patch.email !== undefined && { email: patch.email }),
      });
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException(`person not found: ${id}`);
      }
      if (code === "P2002") {
        throw new ConflictException(
          `email already in use: ${patch.email ?? ""}`,
        );
      }
      throw error;
    }
  }

  // deactivate — REQ-026 soft. `P2025` (row 부재) 를 NotFoundException 으로 변환.
  async deactivate(id: string): Promise<Person> {
    try {
      return await this.repository.softDelete(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`person not found: ${id}`);
      }
      throw error;
    }
  }

  // reactivate — REQ-026 activate. `P2025` 변환.
  async reactivate(id: string): Promise<Person> {
    try {
      return await this.repository.restore(id);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`person not found: ${id}`);
      }
      throw error;
    }
  }

  // remove — hard delete (api.md L75 박제). schema 의 onDelete: Cascade 가
  // ServiceIdentity 의 동반 삭제 책임. PersonRepository 확장 회피 차원에서
  // PrismaService 직접 사용 (architect 결정 — 5 file cap 보존).
  async remove(id: string): Promise<void> {
    try {
      await this.prisma.person.delete({ where: { id } });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(`person not found: ${id}`);
      }
      throw error;
    }
  }
}
