// CronScheduleService — SchedulerRegistry(@nestjs/schedule) 위의 얇은 wrapper
// (T-0413, ADR-0042 §Decision 2 "R-72" 동적 registry 책임, P7 ③ slice 1, REQ-039).
// Admin 이 런타임 지정한 cron 주기를 이름 붙은 단일 cron job 으로 등록/교체/삭제/조회한다.
// 정적 빌드타임 @Cron 데코레이터가 아니라 SchedulerRegistry 동적 등록이라 재배포 없이
// 주기 변경이 가능하다(ADR-0042 §Decision 2). T-0412 가 AppModule 에 박은
// ScheduleModule.forRoot() 로 SchedulerRegistry 가 전역 주입된다(빈 registry 초기 계약).
//
// 책임 경계(Out of Scope — Follow-up ③ slice 2): HTTP 엔드포인트(controller/DTO)·
// cron callback → 실 평가 실행 경로 배선은 본 service 밖. 본 service 는 callback 을
// 주입형 인자(CronTickHandler)로만 받고 실 도메인 호출은 연결하지 않는다. 등록 cron
// 영속화·timezone(KST) 처리도 ADR-0042 §Consequences 대로 후속/별도 ADR.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { CronJob, CronTime } from "cron";

// CronTickHandler — cron 발화 시 호출되는 callback. 본 task 는 실 평가 경로(④ manual
// trigger 와 공유 추상)를 연결하지 않고 주입형 함수로만 받는다(Out of Scope).
export type CronTickHandler = () => void | Promise<void>;

// isValidCronExpression — cron 표현식 유효성을 판정하는 분기 있는 순수 함수
// (R-112 §entrypoint helper 분리 원칙 동형 — registerOrReplace 본문에서 분리해
// 단위 테스트 가능하게 한다). 빈 문자열/공백/형식 위반은 false 를 반환한다.
// cron 라이브러리의 CronTime 생성자를 검증 primitive 로 재사용한다(새 dependency 0 —
// cron 은 @nestjs/schedule 가 이미 끌어오는 전이 의존, ADR-0042 §Decision 1).
export function isValidCronExpression(expr: string): boolean {
  // 빈 문자열·공백만은 명시적으로 거부(CronTime 가 throw 하기 전 빠른 분기).
  if (typeof expr !== "string" || expr.trim().length === 0) {
    return false;
  }
  try {
    // CronTime 생성이 형식 위반(필드 수 부족·범위 초과 등)에 throw 하면 invalid.
    new CronTime(expr);
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class CronScheduleService {
  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  // registerOrReplace — 이름 붙은 단일 cron job 을 등록한다. 동일 name job 이 이미
  // 있으면 deleteCronJob(name) 후 새 CronJob 으로 재등록(주기 변경 = 교체). cron 식이
  // 유효하지 않으면 등록 전에 BadRequestException throw(addCronJob 미호출).
  registerOrReplace(
    name: string,
    cronExpression: string,
    callback: CronTickHandler,
  ): void {
    // 빈 name 거부 — registry key 로 부적합(부재 조회/삭제와 구분 불가).
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new BadRequestException("cron job name 은 빈 문자열일 수 없다");
    }
    // cron 식 검증 — 분리된 순수 함수로 위임(분기 단위 테스트 가능).
    if (!isValidCronExpression(cronExpression)) {
      throw new BadRequestException(
        `유효하지 않은 cron 표현식: ${JSON.stringify(cronExpression)}`,
      );
    }

    // 기존 job 있음 → delete 후 재등록(주기 교체). 없음 → 신규 등록.
    if (this.exists(name)) {
      this.schedulerRegistry.deleteCronJob(name);
    }

    // cron v3 object-param 생성자. start:false 로 생성 후 명시적 start() — 등록/시작
    // 순서를 분명히 한다. onComplete 는 본 task 에서 미사용(Out of Scope).
    const job = new CronJob(cronExpression, callback);
    this.schedulerRegistry.addCronJob(name, job as unknown as CronJob);
    job.start();
  }

  // remove — 등록된 job 삭제. 부재 시 NotFoundException throw(정책: 명확한 예외 —
  // no-op silent 보다 호출자가 부재를 인지하도록, spec 으로 박제). 존재 시 deleteCronJob.
  remove(name: string): void {
    if (!this.exists(name)) {
      throw new NotFoundException(`등록되지 않은 cron job: ${name}`);
    }
    this.schedulerRegistry.deleteCronJob(name);
  }

  // list — 현재 등록된 cron job 이름 배열(getCronJobs() Map 의 key 들).
  list(): string[] {
    return Array.from(this.schedulerRegistry.getCronJobs().keys());
  }

  // exists — name 등록 여부 boolean(getCronJobs() Map.has 기반 — getCronJob 의
  // 부재 시 throw 를 피하기 위해 Map 조회로 통일).
  exists(name: string): boolean {
    return this.schedulerRegistry.getCronJobs().has(name);
  }
}
