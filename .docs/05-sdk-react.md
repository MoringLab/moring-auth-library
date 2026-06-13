# 05. @moring-auth/react

## 📍 기본 정보

- **경로**: `packages/react/`
- **NPM**: `@moring-auth/react`
- **버전**: `0.2.0`
- **역할**: 순수 React SPA 환경에서 SSO 인증. **백엔드 없이 프론트엔드 단독으로 동작**
- **의존성**: `@moring-auth/core`, `react` (peerDependency)

---

## 📁 파일 구조

```
packages/react/src/
├── index.ts       → 외부 노출 진입점 (provider + hooks re-export)
├── provider.tsx   → MoringAuthProvider 컴포넌트 (React Context)
└── hooks.ts       → useMoringAuth 훅 (login, loginWithPopup, handleCallback)
```

---

## 🔧 제공 컴포넌트 및 훅

### `MoringAuthProvider` — Context Provider

앱 최상단에 한 번만 추가합니다.

```tsx
// src/main.tsx 또는 src/index.tsx
import { MoringAuthProvider } from '@moring-auth/react';

createRoot(document.getElementById('root')!).render(
  <MoringAuthProvider
    issuer="https://sso.moring.co"
    clientId="your-client-id"
    redirectUri="http://localhost:5173/callback"  // 콜백 페이지 URL (리디렉트 방식)
    scope="openid email profile"                  // 생략 시 기본값 사용
  >
    <App />
  </MoringAuthProvider>
);
```

**내부 구조**: `issuer`, `clientId`, `redirectUri`, `scope` 값을 React Context에 저장.
`useMoringAuth()` 훅이 이 컨텍스트를 읽어서 사용.

---

### `useMoringAuth()` — 인증 훅

컴포넌트 어디서나 호출하여 인증 기능 사용.

```tsx
const { login, loginWithPopup, handleCallback } = useMoringAuth();
```

---

#### `login(options?)` — 리디렉트 방식 로그인

페이지 전체를 SSO 로그인 화면으로 이동시킵니다.

```tsx
const { login } = useMoringAuth();

// 버튼 클릭 시
await login();
// → SSO 서버로 페이지 리디렉트 발생
```

**내부 동작:**
1. `createMoringAuth().getLoginUrl()` 호출
2. `state`, `nonce`, `codeVerifier`를 `window.sessionStorage`에 저장
   - `moring_auth_state`, `moring_auth_nonce`, `moring_auth_code_verifier`
3. `window.location.href = url` 으로 SSO 서버로 이동

---

#### `handleCallback(code)` — 콜백 처리 (리디렉트 방식)

`/callback` 전용 컴포넌트에서 URL의 `?code=` 파라미터를 받아 토큰으로 교환.

```tsx
// src/pages/Callback.tsx
import { useEffect } from 'react';
import { useMoringAuth } from '@moring-auth/react';

export default function CallbackPage() {
  const { handleCallback } = useMoringAuth();

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      handleCallback(code).then(({ tokens, user }) => {
        // tokens: { id_token, access_token, ... }
        // user: { id, email, name, ... }
        // 여기서 전역 상태 저장, 라우팅 이동 등 처리
      });
    }
  }, []);

  return <div>로그인 처리 중...</div>;
}
```

**내부 동작:**
1. `sessionStorage`에서 `moring_auth_code_verifier` 꺼내기
2. `createMoringAuth().handleCallback(code, { codeVerifier })` → 토큰 교환
3. `auth.verifyToken(tokens.id_token)` → 유저 정보 추출
4. `sessionStorage` 정리 (state, nonce, codeVerifier 삭제)
5. `{ tokens, user }` 반환

---

#### `loginWithPopup(options?)` — 팝업 방식 로그인 ⭐ NEW

**구글 로그인처럼 팝업 창에서 로그인 후, 현재 페이지를 새로고침 없이 즉시 로그인 상태로 전환.**
`/callback` 라우트나 백엔드 API 없이 동작합니다.

```tsx
const { loginWithPopup } = useMoringAuth();

const handleLogin = async () => {
  try {
    const { tokens, user } = await loginWithPopup({
      popupWidth: 500,   // 팝업 너비 (기본: 500)
      popupHeight: 600,  // 팝업 높이 (기본: 600)
    });
    
    console.log('로그인 성공!', user.name);
    // tokens.id_token, tokens.access_token 사용 가능
  } catch (err) {
    if (err.message === 'Popup closed by user before completing login') {
      // 유저가 팝업을 직접 닫은 경우
    }
  }
};
```

**내부 동작 (Web Message Response Mode 활용):**
1. `getLoginUrl({ responseMode: 'web_message' })` 호출
   - `response_mode=web_message` 파라미터 포함된 URL 생성
2. `window.open(url, 'MoringSSOLogin', '...')` 으로 팝업 창 열기
   - 위치: 화면 중앙 정렬
3. `window.addEventListener('message', messageListener)` 등록
4. 유저가 팝업 창에서 로그인 완료
5. SSO 서버: 리디렉트 대신 `window.opener.postMessage()` 로 `{ type: 'authorization_response', response: { code, state } }` 전송 후 팝업 닫힘
6. 부모 창의 `messageListener` 수신:
   - origin 검증 (SSO 서버 도메인인지 확인, 보안)
   - state 검증 (CSRF 방지)
   - `handleCallback(code, { codeVerifier })` 으로 토큰 교환
7. `{ tokens, user }` 로 Promise resolve

**팝업이 수동으로 닫힐 경우**: `setInterval`로 1초마다 `popup.closed` 확인 → Promise reject

---

## ⚠️ 리디렉트 vs 팝업 방식 선택 가이드

| | 리디렉트 (`login`) | 팝업 (`loginWithPopup`) |
|---|---|---|
| `/callback` 라우트 | 필요 | 불필요 |
| UX | 페이지 전환 발생 | 팝업만 뜨고 현재 페이지 유지 |
| 작업 중 상태 보존 | ❌ (페이지 떠남) | ✅ (현재 페이지 유지) |
| 브라우저 팝업 차단 | 해당 없음 | 주의 (사용자가 차단 시 에러) |
| SSO 서버 설정 | 기본 | `webMessageResponseMode: enabled` 필요 |

---

## 🔒 보안 고려사항

- 토큰(`id_token`, `access_token`)이 **JavaScript 메모리 또는 sessionStorage**에 저장됨 (Next.js의 HttpOnly 쿠키보다 XSS에 취약)
- **PKCE가 자동으로 적용**되어 코드 가로채기 공격은 방어됨
- **State 파라미터 검증**으로 CSRF 공격 방어
- **postMessage origin 검증**으로 악성 사이트의 메시지 주입 방어

> 높은 보안이 필요한 서비스라면 `@moring-auth/nextjs` (HttpOnly 쿠키) 사용 권장

---

## 🌐 환경변수

React SPA는 `NEXT_PUBLIC_` 접두사 없이 `VITE_` 접두사를 사용합니다 (Vite 기준).

```bash
# .env (Vite)
VITE_MORING_ISSUER="https://sso.moring.co"
VITE_MORING_CLIENT_ID="your-client-id"
VITE_MORING_REDIRECT_URI="http://localhost:5173/callback"
```

> ⚠️ React SPA는 `clientSecret`을 **절대 사용하면 안 됩니다**. 브라우저에 번들되어 누구나 볼 수 있습니다. PKCE로 대체합니다.

---

## 📦 빌드 출력 (`dist/`)

| 파일 | 용도 |
|------|------|
| `dist/index.js` | CommonJS 번들 |
| `dist/index.mjs` | ES Module 번들 |
| `dist/index.d.ts` / `index.d.mts` | TypeScript 타입 |
