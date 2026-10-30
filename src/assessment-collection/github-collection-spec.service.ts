// GithubCollectionSpecService — 한 Person 으로부터 GitHub 수집 `GithubCollectionSpec` 을
// 조립하는 service (ADR-0030 §1 결합 규칙 + §2 Person→instance 매핑, collection enumerate
// slice ii-b2a). mode B(allowlist)와 mode A(org 전체 enumerate)의 두 산출을 결합한다:
//   (a) mergeGithubInstances(env, 등록 row) 로 활성 GitHub instance config 를 resolve
//       (ADR-0059 §Decision 3 env ∪ active row, 충돌 시 env 우선),
//   (b) resolveGithubRepoSources(T-0258, sync) 로 mode B `sources` + mode A
//       `orgEnumerateTargets` 동시 획득,
//   (c) GithubOrgEnumerateService.enumerateRepoSources(T-0259, async) 로 mode A target →
//       `GithubRepoSource[]` 런타임 enumerate,
//   (d) mode B + mode A source 를 결정론적 순서(mode B 먼저)로 결합해 `{ sources }` 반환.
//
// 책임 경계(Out of Scope): mode B 매칭(T-0258)·mode A enumerate(T-0259) 로직은 재구현
// 하지 않고 호출만 한다. instance 별 allowlist-vs-org 분기는 resolveGithubRepoSources 가
// 이미 수행(B sources + A targets 분리 반환) — 본 service 는 두 산출을 결합만 한다.
// Confluence enumerate + 전체 CollectionSpec 조립은 slice ii-b2b, collectForPerson 진입·
// 영속화·author 필터는 slice iii, since 도출은 slice vi. since 는 주입받아 pass-through 만.
// live/credentialed enumerate 는 Q-0025 대로 deferred — mock 주입 enumerate service +
// 임의 env map 위에서만 unit-test(실 fetch 0 / 실 token 0).
import { Injectable, Optional } from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import { CollectionTargetReader } from "../collection-target/collection-target-reader.service";
import {
  type CollectionTargetRow,
  mergeGithubInstances,
} from "../collection-target/effective-instances";

import { resolveGithubRepoSources } from "./domain/github-repo-source";
import {
  CollectionCallTally,
  GithubCollectionSpec,
  GithubRepoSource,
} from "./github-collection.service";
import { GithubOrgEnumerateService } from "./github-org-repo-enumerate.service";

// GithubCollectionSpecInput — buildGithubCollectionSpec 의 입력 contract. 전체 Prisma
// `Person` row 가 아니라 GitHub instance 매칭에 필요한 `serviceIdentities`(service 필드만)
// 로 좁힌다 — author 귀속/필터(externalId)는 slice iii 책임이라 본 입력에 불필요.
export interface GithubCollectionSpecInput {
  serviceIdentities: Pick<ServiceIdentity, "service">[];
}

@Injectable()
export class GithubCollectionSpecService {
  constructor(
    private readonly enumerateService: GithubOrgEnumerateService,
    private readonly targets: CollectionTargetReader,
    // env 는 mock-injectable — spec 이 임의 env map 으로 instance 를 구성해 실 env 의존
    // 없이 테스트한다(GithubInstanceClient 의 @Optional env 패턴 mirror).
    @Optional() private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  // buildGithubCollectionSpec — Person 의 serviceIdentities 와 env ∪ 등록 row 의 활성 instance
  // 로부터 mode B(allowlist) + mode A(org 전체 enumerate) source 를 결합한
  // `GithubCollectionSpec` 을 반환한다. 매칭 instance 가 없으면 빈 sources(throw 0).
  // org 열거의 성공 · 실패는 tally 로 알린다 — 빈 sources 만으로는 둘을 구분할 수 없다.
  async buildGithubCollectionSpec(
    person: GithubCollectionSpecInput,
    since?: string,
    tally: CollectionCallTally = { succeeded: 0, failed: 0 },
    targets?: CollectionTargetRow[],
  ): Promise<GithubCollectionSpec> {
    // (a) 활성 GitHub instance config 를 resolve(reject 진단은 사용 안 함). 호출자가 row 를
    // 주지 않으면 DB 를 읽으므로 등록 변경은 다음 수집부터 반영된다.
    const { instances } = mergeGithubInstances(
      this.env,
      targets ?? (await this.targets.findAll()),
    );

    // (b) mode B `sources`(sync) + mode A 대상 `orgEnumerateTargets` 동시 획득.
    const { sources: modeBSources, orgEnumerateTargets } =
      resolveGithubRepoSources(instances, person.serviceIdentities, since);

    // (c) mode A enumerate — 대상이 있을 때만 호출(빈 targets early-skip, client 0).
    // enumerate service 는 내부적으로 per-target skip-and-continue 하므로 throw 가능성은
    // 낮으나, 방어적으로 실패를 빈 mode A 로 흡수해 mode B sources 를 보존한다(ADR-0030
    // §1 부분 가용성 우선).
    let modeASources: GithubRepoSource[] = [];
    if (orgEnumerateTargets.length > 0) {
      try {
        modeASources = await this.enumerateService.enumerateRepoSources(
          orgEnumerateTargets,
          tally,
        );
      } catch {
        tally.failed += 1;
        modeASources = [];
      }
    }

    // (d) mode B 먼저 + mode A 결합(결정론적 순서). 본 service 는 결합만 한다.
    return { sources: [...modeBSources, ...modeASources] };
  }
}
