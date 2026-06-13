# 04. @moring-auth/nextjs

## 📍 기본 정보

- **경로**: `packages/nextjs/`
- **NPM**: `@moring-auth/nextjs`
- **버전**: `0.1.1`
- **역할**: Next.js App Router 환경에서 SSO 인증을 **서버사이드**로 처리
- **의존성**: `@moring-auth/core`, `next` (peerDependency)

---

## 📁 파일 구조

```
packages/nextjs/src/
├── index.ts        → handleAuth, getMoringUser 함수 (서버 컴포넌트/API 라우트용)
└── middleware.ts   → withMoringAuth 함수 (Next.js 미들웨어용)
```

---

## 🔧 제공 함수

### `handleAuth(options?)` — 콜백 라우트 핸들러 생성기

가장 핵심적인 함수. **단 2줄로 콜백 API 라우트를 완성**합니다.

```typescript
// src/app/api/auth/callback/route.ts
import { handleAuth } from '@moring-auth/nextjs';

export const GET = handleAuth({
  successRedirectUrl: '/dashboard', // 로그인 성공 후 이동 경로 (기본: '/')
  cookieName: 'moring_session',     // 세션 쿠키 이름 (기본: 'moring_session')
});
```

**내부 동작 순서:**
1. 요청 URL에서 `?code=` 파라미터 추출
2. `cookies()`로 `moring_code_verifier` 쿠키에서 PKCE verifier 가져오기
3. `createMoringAuth().handleCallback(code, { codeVerifier })` 호출 → token 교환
4. `auth.verifyToken(tokens.id_token)` 으로 토큰 검증
5. `moring_code_verifier` 쿠키 삭제
6. `moring_session` **HttpOnly 쿠키에 id_token 저장** (XSS 방어)
7. `successRedirectUrl`로 리디렉트

---

### `getMoringUser(options?)` — 서버에서 현재 유저 조회

Server Component나 Server Action에서 현재 로그인된 유저를 가져올 때 사용.

```typescript
// app/protected/page.tsx (Server Component)
import { getMoringUser } from '@moring-auth/nextjs';

export default async function ProtectedPage() {
  const user = await getMoringUser();
  // user가 null이면 비로그인 상태
  
  return <div>안녕하세요, {user?.name}님!</div>;
}
```

**내부 동작:**
1. `cookies()` 헬퍼로 `moring_session` 쿠키에서 id_token 읽기
2. `auth.verifyToken(token)` 으로 JWT 검증 및 유저 정보 파싱
3. 토큰 없거나 만료 시 `null` 반환

---

### `withMoringAuth(options?)` — 미들웨어 보호

특정 경로를 인증된 사용자만 접근하도록 보호합니다.

```typescript
// src/middleware.ts
import { withMoringAuth } from '@moring-auth/nextjs/middleware';

export default withMoringAuth({
  publicPaths: ['/', '/login', '/api/auth/*'], // 인증 없이 접근 가능한 경로
  redirectTo: '/',                              // 미인증 시 리디렉트 경로
  cookieName: 'moring_session',                 // 기본값
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**내부 동작:**
1. `/_next`, `/static`, 파일 확장자 경로는 자동으로 통과
2. `publicPaths` 체크: 와일드카드 `/*` 지원
3. `moring_session` 쿠키에서 토큰 읽기
4. 토큰 없음 → 로그인 경로로 리디렉트 (현재 URL은 `?callbackUrl=` 파라미터로 보존)
5. 토큰 있음 → `verifyToken()` 검증 → 통과 또는 만료 시 쿠키 삭제 후 리디렉트

---

## 🍪 쿠키 상세

| 쿠키명 | 내용 | 속성 |
|--------|------|------|
| `moring_code_verifier` | PKCE code_verifier (로그인 시작 시 생성) | httpOnly, secure, sameSite: lax |
| `moring_session` | ID Token JWT (로그인 완료 후 저장) | httpOnly, secure, sameSite: lax |

> **왜 HttpOnly 쿠키인가?**  
> `httpOnly: true` 옵션은 JavaScript에서 해당 쿠키에 접근하는 것 자체를 브라우저 레벨에서 차단합니다. XSS 공격으로 악성 스크립트가 실행되어도 토큰을 훔쳐갈 방법이 없습니다.

---

## 🔁 전체 로그인 플로우 (Next.js)

```
[1] 유저가 로그인 버튼 클릭
    ↓
[2] Server Action: createMoringAuth().getLoginUrl() 호출
    → codeVerifier 생성 → moring_code_verifier 쿠키 저장
    → Authorization URL 생성 → 브라우저를 SSO 서버로 리디렉트
    ↓
[3] SSO 서버: 로그인 UI (account.louis1618.shop) 표시
    ↓
[4] 유저: 아이디/비번 입력 → 인증 성공
    ↓
[5] SSO 서버: ?code=XXX&state=YYY 파라미터와 함께 redirect_uri로 리디렉트
    ↓
[6] /api/auth/callback (handleAuth가 처리)
    → code + moring_code_verifier 쿠키로 토큰 교환
    → moring_session HttpOnly 쿠키에 토큰 저장
    → /dashboard 또는 successRedirectUrl로 리디렉트
    ↓
[7] 이후 요청: withMoringAuth 미들웨어가 moring_session 쿠키 검증
```

---

## 📦 빌드 출력 (`dist/`)

| 파일 | 용도 |
|------|------|
| `dist/index.js` / `index.mjs` | 서버 컴포넌트용 함수 (`handleAuth`, `getMoringUser`) |
| `dist/middleware.js` / `middleware.mjs` | 미들웨어용 함수 (`withMoringAuth`) |
| `dist/*.d.ts` / `*.d.mts` | TypeScript 타입 선언 |

> **왜 미들웨어 파일을 분리했나?**  
> Next.js 미들웨어는 Edge Runtime에서 실행되므로, Node.js 전용 API를 사용하는 코드와 번들을 분리해야 합니다.

---

## 🌐 환경변수

```bash
# .env.local
MORING_ISSUER="https://sso.moring.co"
MORING_CLIENT_ID="your-client-id"
MORING_CLIENT_SECRET="your-secret"  # 서버 환경이므로 시크릿 사용 권장
MORING_REDIRECT_URI="http://localhost:3000/api/auth/callback"
```
