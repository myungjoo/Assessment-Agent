본 문서는 이 Software System의 소개로서 Use Case 문서의 기본이 되는 Description 역할과 사용자들에게 어떠한 사용을 할 수 있는지 안내를 한다.


# Assessment-Agent

AA (Assessment-Agent)는 Web Interface를 제공하는 Agent System 이다.
각 개발자들의 기여 활동의 양과 질을 평가하고 평가 결과를 저장하고 보여주는 시스템이다.

# Assessment Target

평가 대상은 크게 코드 작성과 문서 작성으로 나누어 볼 수 있다.

## 코드 평가 대상
- Github.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.sec.samsung.net 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.ecodesamsung.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: Forked repository로 인해 내용물이 중복되거나, Meld되거나 Rebase되어 commit ID는 다르지만 중복된 내용물이 상당히 있을 수 있다. 중복된 부분은 제거되고 평가되어야 한다. 중복된 부분이 시간적으로 다를 수 있음도 고려되어야 한다. (2월 결과물이 3월 timestamp로 중복될 경우 2월에 기여한 것으로 판단한다.)


## 문서 평가 대상
- 코드 평가 대상이 된 Repository에 Issue를 작성하여 다른 개발자들의 활동에 도움이 된 경우. 단, 본인 결과물에 대해 본인이 Follow-up을 남기고 본인이 소비하는 경우는 카운트 하지 않는다.
- 지정된 주소의 Confluence Service 내 지정된 SPACE들 내에서의 문서 작성 / 업데이트 활동.
    - 단순 보고성 자료는 질적으로 낮게 평가한다. 단순 로그 작성, 특히 copy-paste로 볼 수 있는 로그 붙이기는 zero-contribution으로 간주한다.
    - 새로운 알고리즘의 설계, 새로운 일거리의 구상, 외부 연구 도입을 위해 타 개발자들이 참고할 수 있도록 소개 자료를 정리하는 활동은 높은 contribution으로 간주한다.

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: 지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다.


# 평가 자료의 저장

# 평가 자료의 시각화

# 보안 특성

# 성능 특성
