import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ADR-0040 §3 — 개발 시 Vite dev server (5173) 가 /api 요청을 NestJS
// (localhost:3000) 로 proxy 해 browser 관점 same-origin 을 유지한다
// (CORS 설정 0 + JWT HttpOnly SameSite=Strict cookie 정합, ADR-0008).
// 파일 확장자 .mts: Vite 공식 지원 ESM config 형식 — CI 의 spec-presence
// 게이트 (신규 *.ts 의 spec 동반 검사) 가 build config 를 production 소스로
// 오인하지 않도록 ESM 을 명시한다. web/ 의 spec-presence 정책 정식 결정은
// scaffold slice 3 (CI 통합) 의 책임.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
