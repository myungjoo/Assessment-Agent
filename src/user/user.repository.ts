// UserRepository — User entity 의 CRUD primitive **2 메서드만** (create + findByEmail)
// 을 PrismaService 위에 얇게 wrapping 한 repository. T-0080 acceptance C §65-71 박제.
//
// 책임 경계:
//   - 본 repository 는 도메인 invariant (email 형식 / role 값 enum 검증 /
//     hashedPassword 의 hashing 검증 등) 를 검증하지 않는다 — T-0081 AuthService
//     책임. password hashing 자체도 본 layer 외 — caller (AuthService) 가 이미
//     hashing 한 결과 (hashedPassword) 를 input 으로 전달.
//   - 본 class 는 PrismaService 의 `user` delegate 에 1:1 forwarding 만 한다.
//     테스트는 PrismaService 의 `user` 를 Jest mock 으로 대체해 호출 인자 + return
//     값 정합성만 검증한다 (DB 실연결 불필요).
//
// 본 task scope (ADR-0008 후속 chain 첫 task — AuthModule consumption-driven
// minimal surface): create + findByEmail 2 메서드만. PersonRepository 의 6 메서드
// (findMany / findById / create / update / softDelete / restore) 전부 박제 안 함 —
// 후속 task (T-0082 endpoint / T-0083 self-demote invariant) 가 필요한 메서드만
// 점진 추가 (CRUD-U full chain 의 자연 progression 패턴).
//
// Prisma error 정책:
//   - findByEmail 이 row 부재 시 null 반환 (throw 안 함) — null-safe API.
//     PersonRepository.findById L64-66 정공법 정합.
//   - create 가 email unique constraint 위반 시 Prisma 의 `P2002` error 가 그대로
//     propagate — 호출자 (T-0081 AuthService) 가 ConflictException 등으로 변환할
//     책임. PersonRepository.create L70-73 정공법 정합 (catch 0).
import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// 본 repository 가 노출하는 create 메서드의 input shape — T-0081 AuthService 가
// 직접 import. role 은 string literal ("SuperAdmin" / "Admin" / "User") 로 박제
// 되지만 본 type 은 단순 string — enum 검증은 service-layer (REQ-044 self-demote
// 차단 invariant 의 T-0083) 책임.
export interface UserCreateInput {
  email: string;
  hashedPassword: string;
  role: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  // create — email unique constraint 위반 시 Prisma 가 `P2002` (Unique constraint
  // failed) throw — 본 layer catch 0, 호출자 책임. role 값 invariant (SuperAdmin /
  // Admin / User 외 reject) 검증도 본 layer 책임 외 — service-layer (T-0083).
  async create(input: UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data: input });
  }

  // findByEmail — findUnique 의 row 부재 분기는 null 반환 (throw 안 함). null-safe
  // API. T-0081 AuthService 의 login flow 가 본 메서드로 user lookup 후 null 분기
  // 시 UnauthorizedException 발화 책임.
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // findById — 본 task (T-0085) 추가. UserService.changeRole (T-0086 candidate) 의
  // target user lookup 책임. row 부재 시 null 반환 (throw 0) — null-safe API,
  // service-layer 가 NotFoundException 변환 책임. PersonRepository.findById L65-66
  // 정공법 정합.
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // updateRole — 본 task (T-0085) 추가. UserService.changeRole 의 실 update 책임.
  // role 값 invariant (SuperAdmin / Admin / User 외 reject) + REQ-044 self-demote
  // 차단 invariant 검증은 service-layer (T-0086 candidate), 본 layer 는 string
  // forwarding 만. id 부재 시 Prisma 의 `P2025` (record not found) 가 그대로
  // propagate — service-layer 가 NotFoundException 변환 책임 (catch 0).
  // GroupRepository.update L62-64 정공법 정합.
  async updateRole(id: string, role: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  // countAll — 본 task (T-0092) 추가. UserService.signup 의 첫 user 분기 backbone
  // (REQ-044 후반 — 첫 등록 user 의 role = "SuperAdmin" 자동 지정). row 0 일 때
  // 정상 분기 — null-safe (prisma.user.count 는 항상 number 반환, throw 0 정상).
  // 실 race window 강제는 별도 ADR 후속 — 본 layer 는 단순 count 만, service-layer
  // 가 분기 책임 보유. PartRepository / PersonRepository 의 동일 count 패턴 정공법
  // 정합 (단순 prisma delegate wrapping).
  async countAll(): Promise<number> {
    return this.prisma.user.count();
  }
}
