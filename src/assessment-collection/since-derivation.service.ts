// SinceDerivationService — 한 Person 의 직전 Assessment 로부터 incremental "since" 를
// 도출한다(ADR-0029 §5 / ADR-0030 §4 slice vi). CollectionEntryService.collectForPerson(
// person, since, assessmentId) 의 since 인자 소비처 — 호출처(scheduler/manual trigger)가
// 본 service 로 since 를 산출해 주입한다(REQ-031 재수집 중복 방지 + incremental).
//
// 도출 계약(ADR-0029 §5):
//   (1) this.assessmentService.findByPerson(personId) 로 Assessment 배열 조회(read-only).
//   (2) 그 중 periodStart(마지막 수집 경계 timestamp)가 가장 큰(최신) row 를 선택.
//   (3) 그 periodStart(DateTime) → ISO-8601 문자열(.toISOString())을 반환.
//   (4) 직전 Assessment 부재(빈 배열, 신규 인원)면 undefined = full collection(since 미지정).
//
// 도출 기준은 periodStart(수집 경계)이지 createdAt(row 영속 시각)이 아니다 — 마지막으로
// 수집한 활동 경계가 다음 수집의 하한이기 때문(ADR-0029 §5). 재평가가 나중에 영속돼
// createdAt 이 더 최신이어도 periodStart 가 더 큰 row 가 since 의 근거다.
//
// 책임 경계(Out of Scope): AssessmentService 변경 0(findByPerson read 호출만, Assessment
// 는 immutable). module provider 배선은 별도 micro-slice. 1 주 재수집 window / timezone
// 보정은 P5/P7(REQ-058) — 본 service 는 직전 periodStart 단순 도출만. 실 DB·실 token 0
// (Q-0025 deferred — mock 주입 AssessmentService 위에서만 unit-test).
import { Injectable } from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import { AssessmentService } from "../user/assessment.service";

import { applyRecollectionWindow } from "./domain/recollection-window";

@Injectable()
export class SinceDerivationService {
  constructor(private readonly assessmentService: AssessmentService) {}

  // deriveSince — 직전 Assessment 의 periodStart 로부터 incremental since 를 도출한다.
  // 직전 Assessment 가 없으면 undefined(full collection). throw 0 — findByPerson 의
  // 의존성 reject 만 그대로 전파(잡지 않음, fail-fast).
  async deriveSince(personId: string): Promise<string | undefined> {
    const assessments = await this.assessmentService.findByPerson(personId);
    if (assessments.length === 0) {
      return undefined;
    }
    // 입력 순서에 의존하지 않고 periodStart 가 가장 큰 row 를 선택(정렬 무관).
    const latest = assessments.reduce((max: Assessment, current: Assessment) =>
      current.periodStart.getTime() > max.periodStart.getTime() ? current : max,
    );
    return latest.periodStart.toISOString();
  }

  // deriveSinceWithRecollectionWindow — deriveSince 의 R-58 backoff variant.
  // 기존 deriveSince 로 도출한 since 경계를 applyRecollectionWindow(T-0602)로 thread 해,
  // 다음 수집이 직전 경계의 최근 windowDays 일(기본 7)을 겹쳐 fetch 하도록 뒤로 물린다
  // (REQ-031 재수집 정책 / R-58 — 겹친 부분은 dedup 이 흡수). 재구현 0, 위임만:
  //   (1) this.deriveSince(personId) 로 raw since 도출(신규 인원은 undefined).
  //   (2) applyRecollectionWindow(raw, windowDays) 로 backoff(undefined 는 패스스루).
  // windowDays 미지정 시 applyRecollectionWindow 의 default RECOLLECTION_WINDOW_DAYS(=7).
  // throw 0 — deriveSince(findByPerson reject)의 전파만 그대로(fail-fast 계약 보존).
  async deriveSinceWithRecollectionWindow(
    personId: string,
    windowDays?: number,
  ): Promise<string | undefined> {
    const raw = await this.deriveSince(personId);
    return applyRecollectionWindow(raw, windowDays);
  }
}
