// UserModule — Person / ServiceIdentity / Group / Part entity 의 책임 module
// (data-model.md §2 "책임 module" 컬럼). T-0034 에서 PersonRepository 가 등록되었고
// T-0035 가 ServiceIdentityRepository 를 추가 wiring 한다.
// Group / Part 의 entity + repository 는 후속 T-0036 / T-0037 책임 (task 본문 Out
// of Scope).
//
// PersistenceModule (`@Global()`) 이 PrismaService 를 application-wide 로
// export 하므로 본 module 은 PersistenceModule 을 imports 에 명시할 필요가 없다.
// 각 Repository 의 PrismaService 생성자 주입은 global scope 에서 해결됨.
//
// 외부 노출:
//   - providers: PersonRepository, ServiceIdentityRepository — 본 module 의 first-
//     class citizen.
//   - exports: 동일 — 후속 PersonService / ServiceIdentityService / Controller 가
//     다른 module 에서 inject 가능하도록 (T-0036+ 책임).
import { Module } from "@nestjs/common";

import { PersonRepository } from "./person.repository";
import { ServiceIdentityRepository } from "./service-identity.repository";

@Module({
  providers: [PersonRepository, ServiceIdentityRepository],
  exports: [PersonRepository, ServiceIdentityRepository],
})
export class UserModule {}
