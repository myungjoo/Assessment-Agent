// ServiceIdentityService — ServiceIdentity 도메인 의 application service.
// ADR-0058 §Follow-ups (a) 의 잔여 slice 중 **골격 + 목록 조회 1 경로** 만 담는다
// (T-1741). DTO 2 종은 T-1739 가, repository `update` primitive 는 T-1740 이 이미 닫았다.
//
// 책임:
//   - ADR-0058 §Decision 5 (c) 의 **Person 존재 선검사** 계약을 본 service 에 못 박는다.
//     nested route (`/api/persons/:personId/service-identities`) 는 상위 resource 인
//     Person 이 부재하면 하위 collection 이 빈 배열 200 을 주는 대신 404 여야 한다 —
//     "부재한 상위 resource 가 200 을 주면 경로 의미가 깨진다" 는 ADR 근거 그대로다.
//   - 후속 slice 의 create / update / delete / setPrimary 5 route 전부가 본 선검사를
//     재사용하므로, 그 계약을 먼저 고정하는 것이 본 slice 의 실질이다.
//
// 책임 경계 (Out of Scope — T-1741 §Out of Scope 박제):
//   - create 의 자동 primary 승격 · update · delete 후 재승격 · setPrimary 미구현.
//   - Prisma error (`P2002` → 409 / `P2025` → 404) 변환도 위 method 들과 함께 후속 slice.
//     본 slice 의 유일한 경로인 `findByPersonId` 는 Prisma 가 known error 를 던지지 않는
//     읽기 경로라 변환 대상이 없다 — 발생한 오류는 그대로 propagate 한다.
//   - controller · route · guard 배선 없음 (ADR-0058 §Follow-ups (b)).
//   - 정렬 · 필터 · DTO 매핑 없음 — repository 의 "Prisma default 순서 유지" 주석 승계.
import { Injectable, NotFoundException } from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import { PersonRepository } from "./person.repository";
import { ServiceIdentityRepository } from "./service-identity.repository";

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
}
