// PartService — Part 도메인 의 application service. T-0046 acceptance §PartService 박제
// + T-0071 acceptance §A 추가 (PartService.update — P2025 → NotFoundException +
// P2002 → ConflictException 변환).
//
// 책임:
//   - PartRepository 의 5 CRUD primitive (create / findById / findMany / delete /
//     update) + PersonRepository.findByPartId (T-0041) 위에 도메인 의미 부여 —
//     NotFoundException / ConflictException 으로 Prisma known error code 변환,
//     REQ-028 의 "정확히 1 Part" invariant 의 service-layer enforce.
//   - 본 service 가 노출하는 6 메서드 (create / findAll / findById / delete /
//     findPersonsByPartId / update) 가 PartController endpoint 의 forward 대상
//     (단 PATCH controller endpoint 는 후속 T-0072 책임 — 본 task 는 service-layer
//     update 만).
//   - Prisma 의 known error code (`P2002` = unique constraint / `P2025` = record not
//     found / `P2003` = FK constraint failed) 를 NestJS 의 HttpException
//     (ConflictException / NotFoundException) 으로 변환.
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - PartController PATCH 없음 (CRUD 의 C/R/D + service.update 만 — controller PATCH
//     는 별도 후속 task T-0072).
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
import type { UpdatePartDto } from "./dto/update-part.dto";
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

  // update — PATCH /api/parts/:id 의 service-layer backend. T-0071 acceptance §A 박제.
  // RFC-7396 (JSON Merge Patch) semantic 의 partial update — patch 객체에 정의된
  // 필드만 PartRepository.update 로 forward.
  //
  // branch 분기 박제:
  //   - `patch.name !== undefined` → `{name}` spread forward (실 update).
  //   - `patch.name === undefined` → 빈 객체 `{}` forward (PATCH no-op semantic).
  //     Prisma `@updatedAt` directive 가 updatedAt 만 갱신 — 완전 no-op 아님.
  //     spread `...(false && {...})` 는 빈 객체로 평가 (TypeScript spread 표준 동작).
  //
  // Prisma error 분기 2 종 변환:
  //   - `P2025` (row 부재) → NotFoundException("part not found: ${id}") — PartService
  //     의 다른 메서드 (delete / findById) 와 메시지 정합.
  //   - `P2002` (name unique 위반) → ConflictException("part name already in use:
  //     ${patch.name ?? ''}") — PartService.create L62-64 의 동일 메시지 정합.
  //     `patch.name` undefined 시 빈 string fallback (defensive — 실 사용 unlikely,
  //     PATCH no-op + race 로 name unique conflict 가 자동 발생할 시나리오 부재이나
  //     분기 cover 박제).
  //   - 그 외 (P9999 / code 없는 Error / null throw 등) → raw propagate.
  //
  // P2002 분기 존재 사유 (Group precedent 와의 핵심 차이):
  //   - Part.name 은 prisma/schema.prisma L108 의 `@unique` directive **정의** —
  //     동명 Part update 시 schema-level enforce 로 Prisma P2002 raise. 후속
  //     PartService.update 가 ConflictException 변환 책임. PartService.create
  //     L58-67 가 동일 분기 1 차 박제 — 본 update 메서드가 2 차 박제.
  //   - 반면 Group.name 은 `@unique` 미정의 → GroupService.update (T-0067) 의
  //     P2002 분기 부재 (raw propagate 만). Part 도메인 의 unique invariant 차이.
  //
  // 책임 경계 (Out of Scope):
  //   - PartController @Patch(":id") endpoint 신설 안 함 — 후속 T-0072 책임. 본
  //     메서드는 service-layer 만 박제.
  //   - name 의 형식 / 길이 validation 은 UpdatePartDto (T-0069) 의 class-validator
  //     decorator 책임 — controller-scope ValidationPipe 가 service 호출 전에 reject.
  async update(id: string, patch: UpdatePartDto): Promise<Part> {
    try {
      // class-validator 가 통과시킨 patch 객체는 keys 가 UpdatePartDto 의 정의된
      // 필드 (name 단일) 로 한정. 명시적으로 전달된 경우 (undefined 아님) 에만
      // spread 에 포함 — undefined 키가 Prisma update 에 들어가 의도치 않은 null
      // overwrite 가 일어나지 않도록 한다. GroupService.update / PersonService.update
      // 의 동일 패턴 mirror.
      return await this.partRepository.update(id, {
        ...(patch.name !== undefined && { name: patch.name }),
      });
    } catch (error) {
      const code = getPrismaErrorCode(error);
      if (code === "P2025") {
        throw new NotFoundException(`part not found: ${id}`);
      }
      if (code === "P2002") {
        // PartService.create L62-64 의 메시지 정합 — `patch.name` undefined 시
        // 빈 string fallback (defensive, branch cover 박제).
        throw new ConflictException(
          `part name already in use: ${patch.name ?? ""}`,
        );
      }
      throw error;
    }
  }
}
