// 애플리케이션의 health/sanity service.
// 본 task 에서는 도메인 로직이 없으므로 단순 상태 문자열만 반환한다.
// Phase P2 이후 도메인 service 가 추가되면 본 service 는 health-check 용도로만 남는다.
import { Injectable } from "@nestjs/common";

// 외부에 노출되는 health 응답의 고정 문자열. CI / e2e test 의 anchor 로도 사용된다.
export const APP_STATUS_MESSAGE = "Assessment-Agent";

@Injectable()
export class AppService {
  // 현재 앱의 상태 문자열을 반환. 부트스트랩이 정상 동작했음을 알리는 sanity signal.
  getStatus(): string {
    return APP_STATUS_MESSAGE;
  }
}
