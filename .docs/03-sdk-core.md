# 03. @moring-auth/core

## 📍 기본 정보

- **경로**: `packages/core/`
- **NPM**: `@moring-auth/core`
- **버전**: `0.2.0`
- **역할**: 다른 모든 SDK 패키지의 **공통 기반 (foundation)**. OIDC 통신, JWT 검증, PKCE 생성 등 핵심 로직 담당
- **의존성**: `jose` (JWKS 기반 JWT 검증 라이브러리)

---

## 📁 파일 구조

```
packages/core/src/
├── index.ts      → 외부로 노출되는 진입점 (re-export)
├── types.ts      → 공용 TypeScript 인터페이스 정의
├── client.ts     → MoringAuth 클래스 + createMoringAuth 팩토리 함수
└── verify.ts     → JWT ID Token 검증 로직 (jose 사용)
```

---

## 📋 타입 정의 (`types.ts`)

```typescript
// SDK 초기화에 필요한 설정값
interface MoringAuthConfig {
  issuer: string;         // SSO 서버 URL (예: "https://sso.moring.co")
  clientId: string;       // 클라이언트 앱 ID
  clientSecret?: string;  // 클라이언트 시크릿 (서버 환경만, SPA는 없어도 됨)
  redirectUri: string;    // OAuth 콜백 URL
  scope?: string;         // 요청할 스코프 (기본: "openid email profile")
}

// 로그인 성공 후 반환되는 유저 정보
interface MoringUser {
  id: string;       // Supabase User UUID (sub 클레임)
  email: string;
  name?: string;
  picture?: string;
  [key: string]: any;  // 추가 클레임 허용
}

// SSO 서버에서 토큰 교환 시 받는 응답
interface TokenResponse {
  access_token: string;
  id_token: string;          // 유저 정보 포함 JWT
  refresh_token?: string;
  expires_in?: number;       // 만료 시간 (초)
  token_type?: string;       // "Bearer"
  scope?: string;
}

// /.well-known/openid-configuration 응답
interface OidcDiscoveryDoc {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
}
```

---

## 🔧 MoringAuth 클래스 (`client.ts`)

### `discover()` — OIDC Discovery 문서 조회

```typescript
await auth.discover(); // => OidcDiscoveryDoc
```

- `/.well-known/openid-configuration` 엔드포인트를 한 번만 호출하고 결과를 캐시
- 이후 모든 메서드에서 이 문서를 참조하여 token_endpoint 등 URL 획득

---

### `getLoginUrl(options?)` — Authorization URL 생성

```typescript
const { url, state, nonce, codeVerifier } = await auth.getLoginUrl({
  responseMode?: string,  // "web_message" → 팝업 모드
  scope?: string[],
  state?: string,         // 생략 시 자동 생성
  nonce?: string,         // 생략 시 자동 생성
});
```

**내부 동작:**
1. `discover()` 호출로 `authorization_endpoint` URL 획득
2. `state`, `nonce` 랜덤 문자열 자동 생성 (16자)
3. PKCE: `codeVerifier` (43자 랜덤) → SHA-256 해싱 → Base64URL 인코딩 → `code_challenge` 생성
4. `clientSecret`이 없으면 자동으로 PKCE 파라미터 추가
5. 완성된 Authorization URL 반환

---

### `handleCallback(code, options?)` — 토큰 교환

```typescript
const tokens = await auth.handleCallback(code, {
  codeVerifier?: string,  // PKCE 검증용
});
// => TokenResponse
```

**내부 동작:**
1. `token_endpoint`로 POST 요청
2. Body: `grant_type=authorization_code`, `code=...`, `redirect_uri=...`, `client_id=...`, `code_verifier=...`
3. SSO 서버가 PKCE 검증 후 `id_token`, `access_token` 반환

---

### `verifyToken(idToken)` — JWT 검증

```typescript
const user = await auth.verifyToken(idToken);
// => MoringUser
```

**내부 동작:**
1. `jwks_uri`에서 SSO 서버의 공개키(JWKS) 조회
2. `jose` 라이브러리로 JWT 서명 검증
3. 클레임(`sub`, `email`, `name` 등) 파싱하여 `MoringUser` 반환

---

## 🏭 `createMoringAuth(config?)` — 팩토리 함수

```typescript
const auth = createMoringAuth(); // 환경변수에서 자동 읽기
```

환경변수 우선순위 (config 없으면 자동으로 읽음):
- `MORING_ISSUER` 또는 `SSO_ISSUER`
- `MORING_CLIENT_ID` 또는 `SSO_CLIENT_ID`
- `MORING_CLIENT_SECRET` 또는 `SSO_CLIENT_SECRET`
- `MORING_REDIRECT_URI`

---

## 📦 빌드 출력 (`dist/`)

| 파일 | 용도 |
|------|------|
| `dist/index.js` | CommonJS 번들 (Node.js `require()`) |
| `dist/index.mjs` | ES Module 번들 (브라우저/Node.js `import`) |
| `dist/index.d.ts` | TypeScript 타입 선언 |
| `dist/index.d.mts` | ES Module용 타입 선언 |

---

## 🌐 환경변수

```bash
MORING_ISSUER="https://sso.moring.co"
MORING_CLIENT_ID="your-client-id"
MORING_CLIENT_SECRET="your-secret"  # 서버 환경에서만
MORING_REDIRECT_URI="http://localhost:3000/api/auth/callback"
```
