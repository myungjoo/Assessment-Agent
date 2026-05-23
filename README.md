본 문서는 이 Software System의 소개로서 Use Case 문서의 기본이 되는 Description 역할과 사용자들에게 어떠한 사용을 할 수 있는지 안내를 한다.


# Assessment-Agent

AA (Assessment-Agent)는 Web Interface를 제공하는 Agent System 이다.
각 개발자들의 기여 활동의 양과 질을 평가하고 평가 결과를 저장하고 보여주는 시스템이다.

질과 양 모든 면에서 각 개발자가 얼마나 기여하는 지 다양한 지표를 통해 수치적으로도 보여주고, 사용자가 지정한 기간동안 어떠한 주요 활동이 있었는지 LLM을 통해 평가 코멘트도 생성하여 보여 주게 된다.

# Assessment Target

AA의 평가 대상은 크게 코드 작성과 문서 작성으로 나누어 볼 수 있다.

## 코드 평가 대상
- Github.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.sec.samsung.net 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물
- Github.ecodesamsung.com 내 지정 Organization 내 전체 Repository, 혹은 지정 Repository 내 Commit 내용물

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: Forked repository로 인해 내용물이 중복되거나, Meld되거나 Rebase되어 commit ID는 다르지만 중복된 내용물이 상당히 있을 수 있다. 중복된 부분은 제거되고 평가되어야 한다. 중복된 부분이 시간적으로 다를 수 있음도 고려되어야 한다. (2월 결과물이 3월 timestamp로 중복될 경우 2월에 기여한 것으로 판단한다.)

### 평가 목표
- 코드 기여의 양과 질을 모두 평가하여야 한다.
- 보다 더 중요한 기여, 보다 더 어렵고 남들이 못할 일을 한 개발자를 식별하여 더 높은 점수와 더 높은 평가 코멘트가 생성되어야 한다.
- commit과 PR 숫자만 늘리는 abusing을 통해 점수를 높히는 상황을 평가 Metric을 통해 방지할 수 있어야 한다.
- 코드 작성에 있어 기여가 현격히 떨어지는 저성과자를 식별할 수 있어야 한다.

## 문서 평가 대상
- 코드 평가 대상이 된 Repository에 Issue를 작성하여 다른 개발자들의 활동에 도움이 된 경우. 단, 본인 결과물에 대해 본인이 Follow-up을 남기고 본인이 소비하는 경우는 카운트 하지 않는다.
- 지정된 주소의 Confluence Service 내 지정된 SPACE들 내에서의 문서 작성 / 업데이트 활동.

주의 사항: 접근 권한 (read) 을 AA가 가지고 있어야 한다. 접근 권한이 모자를 경우 AA 사용자와 관리자가 인식하여 대응할 수 있어야 한다.
주의 사항: 지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다.

### 평가 목표
- 단순 보고성 자료는 질적으로 낮게 평가한다. 단순 로그 작성, 특히 copy-paste로 볼 수 있는 로그 붙이기는 zero-contribution으로 간주한다.
- 새로운 알고리즘의 설계, 새로운 일거리의 구상, 외부 연구 도입을 위해 타 개발자들이 참고할 수 있도록 소개 자료를 정리하는 활동은 높은 contribution으로 간주한다.
- 궁극적으로 보다 조직에 큰 기여를 문서를 통해 한 인원에게 더 높은 점수와 더 높은 평가 코멘트가 생성될 수 있어야 한다.
- Abusing (의미 없는 기여의 단순 반복) 을 평가 Metric을 통해 막을 수 있어야 한다.
- 문서 작성 중 습관적으로 Update를 하여 중간 저장을 하여 Update 횟수만 늘어나는 경우에 대해 advantage/disadvantage 둘 다 있어서는 안된다.


## 평가 대상 인원
- 각 서비스 별로 하나의 인물이 다른 ID를 가질 수 있다.
- 예를 들어 github.com의 ID는 myungjoo, github.sec.samsung.net은 myungjoo-ham, confluence.sec.samsung.net은 myungjoo.ham 같은 식으로 되어있을 수 있다.
- 단, 기준이 되는 "primary key" 역할을 할 ID는 그중 한 곳의 ID로 지정할 수 있다. (예를 들어 confluence.sec.samsung.net의 ID를 기준 ID로 하면 된다.)
- 일부 인원은 특정 서비스에 가입이 되어있지 않아 NULL일 수는 있다. (그러나 confluence.sec.samsung.net에는 모두 ID가 있다.)
- 평가 대상 인원은 별도로 미리 저장하고 추가/삭제/변경/Deactivate/Activate 될 수 있어야 한다. (deactivate는 삭제를 굳이 하지 말고 평가 대상자 명단에서만 숨김. 예: 휴직)
- 평가 대상 인원이 새로이 추가될 경우 코드/문서 평가를 다른 사람들과는 다르게 훨씬 긴 기간에 대해 한번 해줘야 한다. (예를 들어 일반적으로 매일 1주일어치 활동기록을 가져온다면, 새로 추가된 인원은 지난 1년치 활동 기록 가져오기) 


# 평가 자료의 저장

- Non-volatile하게 평가 자료를 저장하여, 조회시 마다 새로이 자료를 모으고 새로 평가할 필요가 없어야 한다.
- 평가 자료가 저장된 공간은 쉽게 export하여 backup하고 restore하여 reset할 수도 있어야 한다.
- 평가 자료를 재수집할 때에 저장된 부분이 중복되지 않도록 하여야 하나, 재수집 대상 (github, confluence) 의 data synchronization 문제나 뒤늦게 commit push되면서 과거의 자료가 나중에 업데이트되는 경우 놓치지 않도록 하여야 한다. 최근 1주 정도의 데이터는 재수집하여 중복 부분을 제거하는 형태가 되어도 좋다. (주기적으로 데이터 모으면서 최근 1주 정도는 중복되어 다시 fetch & process하여도 computing power에 부담이 없다고 일단 가정하자. 이부분은 나중에 최적화가 필요하다고 판단하면 다시 최적화하기 위한 고려를 하자.)
- 평가 자료의 raw data (code commit, documentation change) 를 저장하는 것은 안된다.
- 각 code commit, create/update된 문서 건 별 기여도, 난이도, 양을 모두 평가하여 가지고 있으면 된다.
- 종료된 날짜의 활동에 대해서는 (실행 당일은 자정이 될때까지는 아직 끝나지 않았으니 하지 말자) 그날의 전체 활동에 대해 요약하여 어떠한 기여를 하였고, 얼마나 중요하고 영향력이 있는 기여인지 평가한 평가문도 저장해 두자.
- 이러한 평가 문은 주간 (다음주 시작시) / 월간 (다음달 시작시) 단위로도 해당 기간의 활동을 토대로 작성하자.
- 평가 문은 개발자들 간 상대적인 비교도 가능할 수 있어야 하며, 주간/월간 활동 요약기록은 LLM에 의한 정성적 평가 결과 외에 개발된 Metric에 의한 수치적 평가 결과도 함께 보유하도록 한다.


# 평가 자료의 시각화



# 평가 실행 제약 사항



# 보안 특성


# 성능 특성
