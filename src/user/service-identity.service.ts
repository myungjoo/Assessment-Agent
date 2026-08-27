// ServiceIdentityService — ServiceIdentity 도메인 의 application service.
// ADR-0058 §Follow-ups (a) 의 잔여 slice 중 **골격 + 목록 조회** (T-1741) · **create**
// (T-1742) 에 이어 **update 1 경로** (T-1743) 까지 담는다 (DTO 는 T-1739, repository 는
// T-1740 이 마감).
//
// 책임:
//   - ADR-0058 §Decision 5 (c) 의 **Person 존재 선검사** 계약을 본 service 에 못 박는다.
//     nested route (`/api/persons/:personId/service-identities`) 는 상위 resource 인
//     Person 이 부재하면 하위 collection 이 빈 배열 200 을 주는 대신 404 여야 한다 —
//     "부재한 상위 resource 가 200 을 주면 경로 의미가 깨진다" 는 ADR 근거 그대로다.
//   - 후속 slice 의 update / delete / setPrimary route 도 본 선검사를 재사용한다.
//   - ADR-0058 §Decision 2 의 **첫 row 자동 primary 승격** — 판정 기준은 **생성 직전 시점의
//     기존 row 수 0 개**. 승격 누락은 `N ≥ 1` 인데 primary 0 인 조용한 수집 0 건으로 이어진다.
//   - ADR-0058 §Decision 5 (a) 의 `P2002` → `ConflictException` (409) 변환, (b) 의
//     `P2025` → `NotFoundException` (404) 변환.
//   - ADR-0058 §Decision 3 의 **PATCH 는 `externalId` 단일 축 + 미전달 보존** (RFC-7396
//     merge patch) 과 §Decision 5 (e) 의 **타 Person 소유 identity 는 403 이 아니라 404**.
//
// 책임 경계 (Out of Scope — T-1743 §Out of Scope 박제):
//   - delete 후 재승격 · setPrimary 는 public 메서드로 노출하지 않는다 (후속 slice).
//     `setPrimary` 는 create 경로 안에서 **호출만** 하며 그 2 op transaction 을
//     재구현하지 않는다 (ADR-0058 §Decision 2 — repository 가 유일 경로).
//   - `P2002` · `P2025` 외의 오류는 어느 경로에서도 삼키지 않고 그대로 propagate 한다.
//   - controller · route · guard 배선 없음 (ADR-0058 §Follow-ups (b)).
//   - 정렬 · 필터 · DTO 매핑 없음 — repository 의 "Prisma default 순서 유지" 주석 승계.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import type { CreateServiceIdentityDto } from "./dto/create-service-identity.dto";
import type { UpdateServiceIdentityDto } from "./dto/update-service-identity.dto";
import { PersonRepository } from "./person.repository";
import { ServiceIdentityRepository } from "./service-identity.repository";

// Prisma 의 error 식별 — `code` field 가 known request error 의 식별자. instanceof 대신
// duck typing 을 쓰고 공용 module 로 추출하지 않는 것은 person.service.ts 의 동명 helper 와
// 같은 관례다 (runtime 의존성 0 유지 — 중복 정리는 별도 판단).
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
export class ServiceIdentityService {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly serviceIdentityRepository: ServiceIdentityRepository,
  ) {}

  // findByPersonId — 해당 Person 의 ServiceIdentity 목록 (ADR-0058 §Decision 1 의
  // GET route backend).
  //
  //   (1) 선검사: PersonRepository.findById 가 null 이면 NotFoundException (404).
  //       ServiceIdentityRepository.findByPersonId 는 Person 부재 시에도 빈 배열을
  //       주므로 (repository 주석 참조) 이 선검사 없이는 404 를 만들 수 없다.
  //   (2) 선검사 기준은 **row 존재 여부** 이며 Person 의 `active` 값과 무관하다 —
  //       ADR-0058 §Decision 5 (c) 는 404 사유를 "미존재 personId" 로만 규정하고
  //       soft delete (`active=false`) 를 404 사유로 들지 않는다. 따라서
  //       deactivate 된 Person 도 정상적으로 목록 경로를 탄다 (관리 화면이 비활성
  //       인원의 식별자를 정리할 수 있어야 하므로).
  //   (3) repository 결과는 가공 없이 그대로 반환 — 정렬 · 필터 · 복제 0.
  async findByPersonId(personId: string): Promise<ServiceIdentity[]> {
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }
    return this.serviceIdentityRepository.findByPersonId(personId);
  }

  // create — 해당 Person 에 identity 1 개 추가 (ADR-0058 §Decision 1 의 POST 201 backend).
  //
  //   (1) 선검사: findByPersonId 와 **동일한** Person 존재 계약 (ADR §Decision 5 c).
  //       부재면 NotFoundException 이고 create · setPrimary 는 호출되지 않는다.
  //   (2) 승격 판정용 기존 row 수는 **생성 직전** 에 읽는다 (create 이후에 세면 거짓 판정).
  //   (3) repository create 인자는 `{ personId, service, externalId }` 뿐 — `isPrimary` 는
  //       전달하지 않는다 (ADR §Decision 2). 초기값은 schema `@default(false)` 가 cover.
  //   (4) `P2002` (`@@unique([personId, service])` 위반) 만 ConflictException (409, ADR
  //       §Decision 5 a 행). 그 외 오류는 원형 그대로 propagate.
  //   (5) 기존 row 0 개면 setPrimary 결과를 반환 (transaction 재구현 0). 승격 실패도 전파.
  async create(
    personId: string,
    dto: CreateServiceIdentityDto,
  ): Promise<ServiceIdentity> {
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }

    const existing =
      await this.serviceIdentityRepository.findByPersonId(personId);

    let created: ServiceIdentity;
    try {
      created = await this.serviceIdentityRepository.create({
        personId,
        service: dto.service,
        externalId: dto.externalId,
      });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2002") {
        throw new ConflictException(
          `service identity already exists: ${personId}/${dto.service}`,
        );
      }
      throw error;
    }

    if (existing.length === 0) {
      return this.serviceIdentityRepository.setPrimary(personId, created.id);
    }
    return created;
  }

  // update — 해당 Person 소유 identity 1 개의 부분 갱신 (ADR-0058 §Decision 1 의 PATCH
  // backend). 갱신 축은 `externalId` 하나뿐이다 (§Decision 3 — 금지 축은 DTO 가 차단).
  //
  //   (1) 선검사: findByPersonId / create 와 **동일한** Person 존재 계약 (ADR §Decision
  //       5 c). 부재면 404 이고 ServiceIdentityRepository 는 한 번도 호출되지 않는다.
  //   (2) 소유 검사: 해당 Person 의 목록에서 identityId 를 찾는다. 없으면 404 이며
  //       **403 이 아니다** (ADR §Decision 5 e) — 타 Person row 의 존재 사실도 그
  //       소유자 personId 도 메시지에 드러내지 않는다. repository 에 findById 를 새로
  //       추가하는 대신 기존 findByPersonId primitive 를 재사용한다.
  //   (3) `externalId` 미전달 (undefined) 이면 repository.update 를 **호출하지 않고**
  //       (2) 의 현재 row 를 그대로 반환 — RFC-7396 미전달 보존이며 빈 `data` 로 no-op
  //       update 를 Prisma 에 흘리지 않는다 (`ServiceIdentityUpdateInput` required 대응).
  //   (4) 전달됐으면 repository.update 결과를 가공 없이 반환. 그 사이 row 가 사라져
  //       Prisma 가 `P2025` 를 던지면 404 로 변환한다 (ADR §Decision 5 b). 그 외 오류는
  //       원형 그대로 propagate.
  async update(
    personId: string,
    identityId: string,
    dto: UpdateServiceIdentityDto,
  ): Promise<ServiceIdentity> {
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }

    const owned = await this.serviceIdentityRepository.findByPersonId(personId);
    const current = owned.find((row) => row.id === identityId);
    if (current === undefined) {
      throw new NotFoundException(`service identity not found: ${identityId}`);
    }

    if (dto.externalId === undefined) {
      return current;
    }

    try {
      return await this.serviceIdentityRepository.update(identityId, {
        externalId: dto.externalId,
      });
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(
          `service identity not found: ${identityId}`,
        );
      }
      throw error;
    }
  }
}
