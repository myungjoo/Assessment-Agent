import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// ADR-0061 D2 — 전역 스타일은 진입점 side-effect import 1 곳으로만 적용한다
// (컴포넌트별 CSS import 금지 — cascade 예측 가능성 보존).
import './styles/global.css';

// SPA 진입점 — index.html 의 #root 에 App 을 mount 한다 (ADR-0040 §1·§4).
// 분기·로직 없음: #root 는 index.html 에 정적으로 존재한다 (Vite 표준 진입 구조).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
