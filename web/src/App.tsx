// App 진입 컴포넌트 — P6 composition wiring ① (T-0378).
// 정적 placeholder (T-0353) 를 제거하고 전역 레이아웃 AppShell 을 렌더하는
// thin wrapper 로 교체한다. 실 화면 조립은 AppShell 과 후속 wiring slice 의 책임이다.
import AppShell from './AppShell';

function App() {
  return <AppShell />;
}

export default App;
