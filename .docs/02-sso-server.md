# 02. SSO 백엔드 서버 (Moring-SSO-Provider-Server)

## 📍 경로 및 기본 정보

- **로컬 경로**: `Z:\home\louis\Documents\.dev\Moring-SSO-Provider-Server`
  - (Z: 드라이브는 Ubuntu(WSL2) 파티션의 Windows 마운트 경로)
- **Production URL**: `https://sso.moring.co`
- **런타임**: Node.js (ESModule `"type": "module"`)
- **핵심 라이브러리**: `oidc-provider` v8.8.1

---

## 📁 파일별 역할

### `index.js` — Express 앱 메인

전체 HTTP 서버의 진입점. 아래 역할을 담당합니다.

```
index.js
├── 환경변수 로드 (env.js import)
├── Express 앱 생성 및 미들웨어 등록
│   ├── express.json() — JSON 요청 바디 파싱
│   ├── cookieParser() — 쿠키 파싱
│   └── cors() — CORS 헤더 (커스텀 API 경로에만 적용)
│
├── 라우터 등록
│   ├── GET  /health               → 서버 상태 확인
│   ├── POST /api/sso/issue-code   → 외부 로그인 후 코드 발급
│   ├── GET  /debug/user/:userId   → 개발 환경 전용 유저 조회
│   ├── ALL  /sso/complete         → 로그인 완료 후 Grant 처리 및 코드 발급
│   ├── GET  /interaction/:uid     → OIDC 로그인/동의 인터랙션 처리
│   └── GET  /.well-known/webfinger → Tailscale Custom OIDC용
│
└── app.use('/', provider.callback()) → 나머지 모든 OIDC 요청 처리
```

**중요 포인트: CORS 설정**
```js
// 커스텀 경로에만 CORS 미들웨어 적용
// oidc-provider 내장 OIDC 엔드포인트는 clientBasedCORS 설정으로 별도 관리
app.use('/api', customCors);
app.use('/sso', customCors);
app.use('/interaction', customCors);
```

### `provider.js` — node-oidc-provider 설정

OIDC 서버의 핵심 설정 파일.

```js
const configuration = {
  proxy: true,              // Cloudflare/Koyeb 역방향 프록시 신뢰
  adapter: HybridAdapter,   // 세션 저장소 (Supabase + Redis)
  findAccount,              // Supabase에서 유저 계정 조회

  pkce: {
    required: () => true,   // ⚠️ 모든 요청에 PKCE 강제 적용
  },

  clientBasedCORS(ctx, origin, client) {
    return true;            // SPA(React)의 cross-origin fetch 허용
  },

  features: {
    webMessageResponseMode: { enabled: true }, // 팝업 로그인용 postMessage 응답 모드
    rpInitiatedLogout: { enabled: true },
    revocation: { enabled: true },
    introspection: { enabled: true },
  },

  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
    profile: ['name', 'picture', 'updated_at'],
  },

  // 각 토큰의 유효 기간
  ttl: {
    AccessToken: 3600,          // 1시간
    AuthorizationCode: 600,     // 10분
    IdToken: 3600,              // 1시간
    RefreshToken: 30 * 24 * 3600, // 30일
    Session: 7 * 24 * 3600,    // 7일
  },
};
```

### `adapters/hybrid.js` — 하이브리드 저장 어댑터

node-oidc-provider는 Session, Grant, AuthorizationCode 등의 상태를 저장할 외부 스토리지가 필요합니다.

- **Supabase (PostgreSQL)**: 영속적 데이터 (Grant, RefreshToken)
- **Redis** (Upstash 등): 단기 세션 데이터 (AuthorizationCode 10분 등)

### `lib/account.js` — 계정 조회

`findAccount` 함수: OIDC 서버가 `accountId`로 실제 유저를 찾을 때 사용.
Supabase `auth.admin.getUserById(accountId)` 를 호출하여 유저 정보를 반환.

---

## 🔑 핵심 엔드포인트

`app.use('/', provider.callback())` 으로 마운트되어 oidc-provider가 자동 처리하는 엔드포인트:

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /.well-known/openid-configuration` | OIDC Discovery 문서 (모든 엔드포인트 URL 포함) |
| `GET /.well-known/jwks.json` | 공개키 세트 (토큰 서명 검증용) |
| `GET /auth` | Authorization 엔드포인트 (로그인 시작) |
| `POST /token` | Token 엔드포인트 (code → token 교환) |
| `GET /me` 또는 `/userinfo` | UserInfo 엔드포인트 |
| `GET /session/end` | RP-initiated Logout |

---

## 🔄 `/interaction/:uid` 처리 흐름

로그인이 필요할 때 oidc-provider가 이 경로로 리디렉트합니다.

```
1. oidc-provider → 쿠키에 Supabase 세션 쿠키 확인
   ├── 있음: 쿠키에서 access_token 추출 → supabase.auth.getUser() 호출
   │         성공 시: interactionFinished(login) → 자동 로그인 완료
   │
   └── 없음: account.louis1618.shop/auth/login 으로 리디렉트
              → 로그인 UI에서 아이디/비번 입력
              → /sso/complete 호출 (session_token 포함)
              → Grant 생성 → AuthorizationCode 발급 → 클라이언트로 리디렉트
```

---

## 🌍 환경변수 목록 (`.env.local`)

| 변수명 | 설명 |
|--------|------|
| `ISSUER` | SSO 서버 URL (예: `https://sso.moring.co`) |
| `ACCOUNT_URL` | 로그인 UI URL (예: `https://account.louis1618.shop`) |
| `PORT` | 서버 포트 (기본: 3005) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 롤 키 (어드민 권한) |
| `COOKIE_KEYS` | 쿠키 서명 키 (쉼표로 구분, 최소 2개) |
| `SESSION_TOKEN_SECRET` | JWT 서명 시크릿 |
| `NODE_ENV` | `production` 또는 `development` |
| `TRUST_PROXY` | 역방향 프록시 신뢰 설정 |

---

## ⚠️ 알려진 이슈 및 주의사항

1. **PKCE 강제**: `pkce.required: () => true` 설정으로 모든 클라이언트에 PKCE 필수. `clientSecret` 없이도 안전한 이유.

2. **쿠키 SameSite**: Production에서 `sameSite: 'none'` 사용 (Cloudflare Tunnel HTTPS 환경). SSO 도메인과 앱 도메인이 다르기 때문에 cross-site 쿠키 전송 필요.

3. **CORS**: 
   - `clientBasedCORS: () => true` → OIDC 엔드포인트 (token, discovery 등) CORS 허용
   - 커스텀 Express 라우터에는 별도 `cors()` 미들웨어 적용
   - 전역 `app.use(cors())` 사용 금지 (oidc-provider의 내부 CORS 처리와 충돌)

4. **webMessageResponseMode**: 팝업 로그인 기능을 위해 활성화. SSO 서버가 `redirect` 대신 `postMessage`로 코드를 부모 창에 전송.
