// ServiceIdentityService — ServiceIdentity 도메인 의 application service.
// ADR-0058 §Follow-ups (a) 의 잔여 slice 중 **골격 + 목록 조회** (T-1741) · **create**
// (T-1742) · **update 1 경로** (T-1743) · **setPrimary 1 경로** (T-1744) 에 이어
// **delete 1 경로** (T-1746) 와 그 **삭제 후 primary 재승격 배선** (T-1747) 까지 담는다
// (DTO 는 T-1739, repository 는 T-1740, 재승격 선택 규칙은 T-1745 의 순수 모듈이 마감).
//
// 책임:
//   - ADR-0058 §Decision 5 (c) 의 **Person 존재 선검사** 계약을 본 service 에 못 박는다.
//     nested route (`/api/persons/:personId/service-identities`) 는 상위 resource 인
//     Person 이 부재하면 하위 collection 이 빈 배열 200 을 주는 대신 404 여야 한다 —
//     "부재한 상위 resource 가 200 을 주면 경로 의미가 깨진다" 는 ADR 근거 그대로다.
//   - update / setPrimary / delete route 가 모두 본 선검사를 재사용한다.
//   - ADR-0058 §Decision 2 의 **첫 row 자동 primary 승격** — 판정 기준은 **생성 직전 시점의
//     기존 row 수 0 개**. 승격 누락은 `N ≥ 1` 인데 primary 0 인 조용한 수집 0 건으로 이어진다.
//   - ADR-0058 §Decision 5 (a) 의 `P2002` → `ConflictException` (409) 변환, (b) 의
//     `P2025` → `NotFoundException` (404) 변환.
//   - ADR-0058 §Decision 3 의 **PATCH 는 `externalId` 단일 축 + 미전달 보존** (RFC-7396
//     merge patch) 과 §Decision 5 (e) 의 **타 Person 소유 identity 는 403 이 아니라 404**.
//
//   - ADR-0058 §Decision 2 마지막 항의 **delete 후 primary 재승격** — 지운 row 가 primary
//     였고 잔여 row 가 1+ 이면 그중 하나를 반드시 새 primary 로 올려 "`N ≥ 1` 인데 primary
//     0" 상태를 남기지 않는다 (REQ-024 의 1 인원 1 primary invariant 를 삭제 경로에서도
//     성립시킴). 잔여 row 중 어느 것을 고르는지의 **정렬 계약** (`createdAt` 오름차순 ·
//     동률이면 `id` 오름차순) 은 순수 모듈 `selectNextPrimaryIdentity` (T-1745) 에 위임하며
//     본 service 안에서 재구현하지 않는다.
//
// 책임 경계 (Out of Scope):
//   - 어느 경로에서도 `setPrimary` 의 2 op transaction 을 재구현하지 않는다
//     (ADR-0058 §Decision 2 — repository 가 유일 경로).
//   - 삭제 + 재승격을 하나의 `$transaction` 으로 묶는 원자성 강화는 본 service 밖이다 —
//     현재는 controller · route 가 0 개라 두 op 사이 중간 상태가 외부로 노출되지 않는다.
//   - `P2002` · `P2025` 외의 오류는 어느 경로에서도 삼키지 않고 그대로 propagate 한다.
//   - controller · route 는 T-1748 이 GET 목록 1 개만 노출했다 (ADR-0058 §Follow-ups
//     (b) 의 첫 절단 — `ServiceIdentityController` + guard stack). POST · PATCH ·
//     DELETE · primary 지정 4 route 는 여전히 미배선이라 후속 slice 소관이다.
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
import { selectNextPrimaryIdentity } from "./service-identity-primary-order";
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

  // setPrimary — 해당 Person 소유 identity 1 개를 primary 로 지정 (ADR-0058 §Decision 1
  // 의 전용 action POST `/api/persons/:personId/identities/:identityId/primary` backend,
  // 성공 200).
  //
  //   (1) 선검사: findByPersonId / create / update 와 **동일한** Person 존재 계약 (ADR
  //       §Decision 5 c). 부재면 404 이고 ServiceIdentityRepository 는 미호출.
  //   (2) 소유 검사: update 와 같은 3 단 패턴 — 목록에 identityId 가 없으면 404 이며
  //       **403 이 아니다** (ADR §Decision 5 e). 타 Person row 의 존재 사실도 소유자
  //       personId 도 메시지에 드러내지 않는다. findById 를 새로 추가하지 않고 기존
  //       findByPersonId primitive 를 재사용한다.
  //   (3) 대상이 **이미 `isPrimary === true` 여도 early return 하지 않는다** — 다른 row 가
  //       잘못 primary 로 남은 상태의 복구를 early return 이 막기 때문이다. 재요청해도 결과
  //       상태가 같으므로 idempotent 하다 (ADR §Decision 1 primary 행).
  //   (4) repository.setPrimary 결과를 가공 없이 반환 (2 op transaction 재구현 0 — ADR
  //       §Decision 2 가 유일 경로). row 가 사라져 `P2025` 가 오면 404 로 변환 (ADR
  //       §Decision 5 b), 그 외 오류는 원형 그대로 propagate.
  async setPrimary(
    personId: string,
    identityId: string,
  ): Promise<ServiceIdentity> {
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }

    const owned = await this.serviceIdentityRepository.findByPersonId(personId);
    if (!owned.some((row) => row.id === identityId)) {
      throw new NotFoundException(`service identity not found: ${identityId}`);
    }

    try {
      return await this.serviceIdentityRepository.setPrimary(
        personId,
        identityId,
      );
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(
          `service identity not found: ${identityId}`,
        );
      }
      throw error;
    }
  }

  // delete — 해당 Person 소유 identity 1 개를 hard delete (ADR-0058 §Decision 1 의
  // DELETE `/api/persons/:personId/identities/:identityId` backend).
  //
  //   (1) 선검사: findByPersonId / create / update / setPrimary 와 **동일한** Person 존재
  //       계약 (ADR §Decision 5 c). 부재면 404 이고 ServiceIdentityRepository 는 미호출.
  //   (2) 소유 검사: update / setPrimary 와 같은 3 단 패턴 — 목록에 identityId 가 없으면
  //       404 이며 **403 이 아니다** (ADR §Decision 5 e). 타 Person row 의 존재 사실도
  //       소유자 personId 도 메시지에 드러내지 않는다. findById 를 새로 추가하지 않고
  //       기존 findByPersonId primitive 를 재사용한다.
  //   (3) 삭제 자체가 실패하면 재승격 단계로 넘어가지 않는다. (2) 와 delete 사이에 row 가
  //       사라져 Prisma 가 `P2025` 를 던지면 404 로 변환 (ADR §Decision 5 b), 그 외 오류는
  //       삼키지 않고 원형 그대로 propagate.
  //   (4) 재승격 발동 조건은 **삭제 대상이 primary 였을 때만** 이다 (ADR §Decision 2 마지막
  //       항). 판정은 repository.delete 반환값이 아니라 (2) 에서 확보한 `owned` 스냅샷의
  //       대상 row 로 한다 — 아래 잔여 목록도 같은 스냅샷에서 만들므로 두 판단의 기준 시점을
  //       하나로 묶어야 "primary 였는데 잔여 목록엔 없다" 같은 어긋남이 생기지 않는다.
  //   (5) 잔여 row 는 2 차 `findByPersonId` 없이 `owned` 에서 삭제된 id 만 제외해 만든다
  //       (추가 DB 왕복 0). 선택은 순수 모듈 `selectNextPrimaryIdentity` 에 위임하며
  //       (정렬 규칙 재구현 0), `null` 이면 승격 없이 종료한다 — 잔여 0 은 ADR §Decision 2
  //       의 `N = 0` 정상 상태다. 아니면 repository.setPrimary 를 정확히 1 회 호출한다.
  //   (6) 반환값은 **삭제된 row** 로 불변이다. 승격된 row 로 바꾸지 않는다 — DELETE 의
  //       응답은 사라진 대상을 가리켜야 한다.
  //   (7) 재승격 단계의 오류는 **변환 없이 그대로 propagate** 한다. 특히 `P2025` 를 404 로
  //       바꾸지 않는다 — 삭제는 이미 성공했으므로 404 는 "DELETE 가 실패했다" 는 거짓
  //       신호가 되고, 호출자가 재시도하면 실제로는 없는 row 를 다시 지우려 한다.
  async delete(personId: string, identityId: string): Promise<ServiceIdentity> {
    const person = await this.personRepository.findById(personId);
    if (person === null) {
      throw new NotFoundException(`person not found: ${personId}`);
    }

    const owned = await this.serviceIdentityRepository.findByPersonId(personId);
    const target = owned.find((row) => row.id === identityId);
    if (target === undefined) {
      throw new NotFoundException(`service identity not found: ${identityId}`);
    }

    let removed: ServiceIdentity;
    try {
      removed = await this.serviceIdentityRepository.delete(identityId);
    } catch (error) {
      if (getPrismaErrorCode(error) === "P2025") {
        throw new NotFoundException(
          `service identity not found: ${identityId}`,
        );
      }
      throw error;
    }

    if (target.isPrimary) {
      const next = selectNextPrimaryIdentity(
        owned.filter((row) => row.id !== identityId),
      );
      if (next !== null) {
        await this.serviceIdentityRepository.setPrimary(personId, next.id);
      }
    }

    return removed;
  }
}
