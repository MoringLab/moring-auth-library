# 06. @moring-auth/express

## 📍 기본 정보

- **경로**: `packages/express/`
- **NPM**: `@moring-auth/express`
- **버전**: `0.1.0`
- **역할**: Express.js 백엔드 API 서버에서 **API 엔드포인트를 보호**하고 유저 정보를 검증
- **의존성**: `@moring-auth/core`, `express` (peerDependency)

---

## 📁 파일 구조

```
packages/express/src/
└── index.ts   → requireMoringAuth 미들웨어 함수
```

---

## 🔧 제공 함수

### `requireMoringAuth(options?)` — 미들웨어 함수

Express 라우트에 꽂아서 **인증된 요청만 통과**시킵니다.
토큰 검증 성공 시 `req.user`에 유저 정보가 자동으로 주입됩니다.

```typescript
import express from 'express';
import { requireMoringAuth } from '@moring-auth/express';

const app = express();

// 이 라우트는 인증된 유저만 접근 가능
app.get('/api/profile', requireMoringAuth(), (req, res) => {
  res.json({ user: req.user }); // req.user: MoringUser 자동 주입
});

// 인증 옵션 커스터마이징
app.get('/api/optional', requireMoringAuth({ required: false }), (req, res) => {
  if (req.user) {
    res.json({ message: '로그인된 유저', user: req.user });
  } else {
    res.json({ message: '비로그인 유저' });
  }
});
```

**옵션:**

```typescript
interface ExpressMiddlewareOptions {
  cookieName?: string;  // 세션 쿠키 이름 (기본: 'moring_session')
  issuer?: string;      // SSO 서버 URL (없으면 환경변수 사용)
  clientId?: string;    // 클라이언트 ID (없으면 환경변수 사용)
  required?: boolean;   // false이면 토큰 없어도 통과 (기본: true)
}
```

---

## 🔍 토큰 탐지 우선순위

미들웨어는 다음 순서로 토큰을 찾습니다:

```
1순위: req.cookies['moring_session']  (cookie-parser 미들웨어 필요)
2순위: req.headers.cookie를 직접 파싱 (cookie-parser 없을 때 폴백)
3순위: req.headers.authorization의 "Bearer <token>" 형식
```

> **팁**: React SPA가 `loginWithPopup`으로 얻은 토큰을 Express API로 보낼 때는 3순위 방식(Bearer 헤더) 사용

```typescript
// React 클라이언트에서
fetch('/api/profile', {
  headers: {
    'Authorization': `Bearer ${tokens.access_token}`
  }
});
```

---

## 🏗️ TypeScript 타입 확장

`index.ts`에서 Express의 `Request` 타입을 전역으로 확장합니다.

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: MoringUser; // 토큰 검증 성공 시 자동 주입
    }
  }
}
```

덕분에 TypeScript 환경에서 `req.user.email` 등을 타입 안전하게 사용 가능합니다.

---

## 🔁 전체 플로우 예시 (Express + React SPA 조합)

```
[1] React SPA: loginWithPopup() 호출
    → 팝업에서 로그인
    → { tokens: { access_token, id_token }, user } 획득
    ↓
[2] React SPA: tokens.access_token을 어딘가에 저장
    (메모리 변수 or zustand/redux 등 클라이언트 상태)
    ↓
[3] React SPA: Express API 호출 시 토큰 첨부
    fetch('/api/secure-data', {
      headers: { Authorization: `Bearer ${access_token}` }
    })
    ↓
[4] Express 서버: requireMoringAuth() 미들웨어
    → Authorization 헤더에서 토큰 추출
    → SSO 서버의 JWKS로 토큰 서명 검증
    → 유효 → req.user 주입 → 다음 핸들러로 pass
    → 무효 → 401 Unauthorized 반환
```

---

## 💡 콜백 라우트 직접 구현

`@moring-auth/express`는 콜백 처리 함수를 제공하지 않습니다.  
Express 서비스마다 라우팅 구조가 다양하기 때문에, 개발자가 직접 구현합니다.

```typescript
import { createMoringAuth } from '@moring-auth/core';

const auth = createMoringAuth();

// 로그인 시작
app.get('/login', async (req, res) => {
  const { url, codeVerifier } = await auth.getLoginUrl();
  // codeVerifier를 세션에 임시 저장
  req.session.codeVerifier = codeVerifier;
  res.redirect(url);
});

// 콜백 처리
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code as string;
  const codeVerifier = req.session.codeVerifier;
  
  const tokens = await auth.handleCallback(code, { codeVerifier });
  
  // HttpOnly 쿠키에 토큰 저장
  res.cookie('moring_session', tokens.id_token, { httpOnly: true });
  res.redirect('/dashboard');
});
```
