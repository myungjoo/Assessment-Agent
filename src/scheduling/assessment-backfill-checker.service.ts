// AssessmentBackfillChecker — "이 personId 가 이미 backfill 됐는가" 판정자의 실 구현
// (T-0420, P7 ⑤ slice 2 후속 a-1, R-50 / REQ-027). T-0419 가 박제한 주입형 인터페이스
// AlreadyBackfilledChecker(DI token ALREADY_BACKFILLED_CHECKER)의 기본 미주입(항상 false)
// 자리를 실 판정자로 채운다 — 즉 "신규 인원 1회만 backfill"(중복 backfill 방지, REQ-027
// "1회")의 실 보장을 박제한다.
//
// 판정 근거(보수적 proxy): 기존 read primitive SinceDerivationService.deriveSince(personId)
// 를 재사용한다 — 직전 Assessment 가 0건이면 undefined, 1건 이상이면 최신 periodStart ISO
// 문자열을 반환한다. 따라서 "Assessment 가 이미 존재함"(deriveSince !== undefined) ⟺
// "이미 backfill(또는 일반 평가)됨" 으로 판정해 중복 backfill 을 차단한다(신규 인원 =
// Assessment 0건 = backfill 진행, 기존 인원 = skip). 이는 schema flag/row 신설(slice 3)
// 없이 동작하는 보수적 proxy 다 — 정교한 전용 영속 표식(예: Person.backfilledAt)은 slice 3
// 의 책임으로 유지한다.
//
// 책임 경계(Out of Scope, task §Out of Scope):
//   - read primitive 재구현 0 — SinceDerivationService.deriveSince 는 호출만(시그니처 불변).
//     본 service 는 그 반환값의 정의 여부(!== undefined) 판정만 담당한다.
//   - PersonService create hook 배선 / manual REST endpoint / schema 변경(전용 표식) 은
//     별도 sub-slice. 본 service 는 personId 를 인자로만 받고 schema·Prisma 쿼리 무변경.
//   - 실 live/credentialed 수집은 Q-0025 deferred — mock SinceDerivationService 주입 위에서만
//     unit-test(실 token·실 DB 0).
import { Injectable } from "@nestjs/common";

import { SinceDerivationService } from "../assessment-collection/since-derivation.service";

import type { AlreadyBackfilledChecker } from "./backfill-runner.service";

@Injectable()
export class AssessmentBackfillChecker implements AlreadyBackfilledChecker {
  constructor(
    private readonly sinceDerivationService: SinceDerivationService,
  ) {}

  // isAlreadyBackfilled — 직전 Assessment 존재 여부를 backfill 완료의 보수적 proxy 로 판정.
  //   - deriveSince 가 정의된 값(undefined 아님)을 반환 = 직전 Assessment 1건 이상 존재
  //     = 이미 평가/backfill 됨 → true(skip). 빈 문자열 "" 같은 falsy 값도 undefined 가
  //     아니면 "존재" 로 판정한다 — 정의 여부 판정은 truthiness 가 아니라 `!== undefined`
  //     기준이다(deriveSince 의 계약상 부재 신호는 오직 undefined).
  //   - deriveSince 가 undefined(Assessment 0건, 신규 인원) → false(backfill 진행).
  // error 정책: deriveSince 가 reject(의존성 실패)하면 잡지 않고 그대로 전파(fail-fast,
  // deriveSince 동형). personId 검증 책임 없음 — 빈 문자열/비정상도 deriveSince 로 그대로
  // 전달(read primitive 가 판정).
  async isAlreadyBackfilled(personId: string): Promise<boolean> {
    const since = await this.sinceDerivationService.deriveSince(personId);
    return since !== undefined;
  }
}
