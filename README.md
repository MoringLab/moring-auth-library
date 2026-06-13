# Moring SSO Login Starter

Moring OIDC 인증이 연동된 Next.js (App Router) 기반의 최소한의 보일러플레이트입니다.

## 🚀 Quick Start

1. **저장소 클론 및 패키지 설치**
   ```bash
   npm install
   ```

2. **환경변수 설정**
   `.env.example` 파일을 `.env.local`로 복사하고, Moring SSO 정보를 입력합니다.
   ```bash
   cp .env.example .env.local
   ```
   * `AUTH_SECRET` 생성: `npx auth secret` 실행

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```
   브라우저에서 `http://localhost:3000`에 접속하여 "Moring으로 로그인"을 테스트합니다.

## ☁️ Vercel 배포 가이드
1. Vercel 대시보드에서 이 레포지토리를 Import 합니다.
2. `Environment Variables` 섹션에 `.env.local`에 작성했던 값들을 동일하게 입력합니다.
   * `AUTH_URL`은 배포될 Vercel 도메인으로 변경해야 합니다. (예: `https://your-app.vercel.app`)
3. Deploy 버튼을 클릭합니다.
