# 10. 배포 가이드 및 환경변수

## 🌍 시스템 배포 현황

| 서비스 | URL | 인프라 |
|--------|-----|--------|
| SSO 백엔드 서버 | `https://sso.moring.co` | Koyeb (컨테이너) + Cloudflare Tunnel |
| 로그인 UI | `https://account.louis1618.shop` | 별도 서비스 |
| SDK 패키지 | `https://www.npmjs.com/org/moring-auth` | NPM |

---

## 🔑 SSO 서버 전체 환경변수

`Z:\home\louis\Documents\.dev\Moring-SSO-Provider-Server\.env.local`

```bash
# 서버 기본 설정
NODE_ENV="production"
PORT=3005
ISSUER="https://sso.moring.co"       # SSO 서버 자신의 URL (Discovery 문서에 기록됨)
ACCOUNT_URL="https://account.louis1618.shop"  # 로그인 UI 주소

# 프록시 설정 (Cloudflare Tunnel 사용 시)
FORCE_HTTPS="true"
TRUST_PROXY="loopback, linklocal, uniquelocal"

# Supabase (사용자 인증 DB)
SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"  # 동일 값 (레거시)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # 어드민 권한 키 (절대 노출 금지!)

# 쿠키 서명 키 (최소 2개, 쉼표 구분)
COOKIE_KEYS="random-key-1,random-key-2"

# JWT 서명 시크릿 (account.louis1618.shop 과 공유)
SESSION_TOKEN_SECRET="your-jwt-secret"
```

---

## 🔑 Next.js 앱 환경변수

`.env.local`

```bash
# SSO 서버 정보
MORING_ISSUER="https://sso.moring.co"
MORING_CLIENT_ID="your-registered-client-id"
MORING_CLIENT_SECRET="your-client-secret"     # 서버사이드, 절대 노출 금지
MORING_REDIRECT_URI="https://yourapp.com/api/auth/callback"

# 또는 Next.js 공식 표기법 사용
SSO_ISSUER="https://sso.moring.co"
SSO_CLIENT_ID="your-client-id"
```

---

## 🔑 React SPA 환경변수

`.env` (Vite)

```bash
# ⚠️ 브라우저에 노출됨 - clientSecret 절대 넣지 말 것!
VITE_MORING_ISSUER="https://sso.moring.co"
VITE_MORING_CLIENT_ID="your-public-client-id"
VITE_MORING_REDIRECT_URI="http://localhost:5173/callback"
```

> MoringAuthProvider에 직접 값을 전달하므로, 환경변수는 React에서 자동으로 사용되지 않습니다. Provider에 직접 `issuer`, `clientId`를 넣어야 합니다.

---

## 🐳 SSO 서버 Koyeb 배포

`Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3005
CMD ["node", "index.js"]
```

`docker-compose.yml` (로컬 개발):
```yaml
version: '3'
services:
  sso:
    build: .
    ports:
      - "3005:3005"
    env_file:
      - .env.local
```

---

## 🚇 Cloudflare Tunnel (로컬 개발 → HTTPS)

`cloudflared.yml`:
```yaml
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: sso.moring.co
    service: http://localhost:3005
  - service: http_status:404
```

**실행 명령어**:
```bash
cloudflared tunnel run
```

---

## 🔄 SDK 신규 버전 배포 절차

```bash
# 1. 패키지 버전 올리기 (package.json version 수정)

# 2. 전체 빌드
cd moring-sso-template
npm run build --workspaces

# 3. GitHub에 커밋/푸시
git add .
git commit -m "feat: ..."
git push

# 4. NPM 배포 (OTP 필요)
npm publish -w @moring-auth/core    # 버전 변경된 패키지만
npm publish -w @moring-auth/react
# 등등...
```

---

## 🛑 알려진 이슈 및 주의사항

### 1. HTTPS vs HTTP 로컬 개발

Next.js 앱을 HTTPS로 로컬 개발(`next dev --experimental-https`)하면, SSO 서버도 HTTPS여야 쿠키가 정상 전달됩니다.
→ Cloudflare Tunnel로 로컬 SSO 서버를 HTTPS로 노출하거나, 둘 다 HTTP로 맞춰야 합니다.

### 2. SameSite 쿠키 문제

SSO 서버 도메인(`sso.moring.co`)과 앱 도메인(`yourapp.com`)이 다를 경우:
- 프로덕션: `sameSite: 'none'`, `secure: true` 필요 (Cloudflare Tunnel HTTPS 환경)
- 로컬: `sameSite: 'lax'` 사용 가능

### 3. PKCE 강제 적용

`pkce.required: () => true` 설정으로 모든 클라이언트에 PKCE 필수.
`clientSecret`이 있는 서버도 PKCE를 보내야 합니다.
`createMoringAuth()`는 `clientSecret` 유무에 관계없이 항상 PKCE를 자동 생성합니다.

### 4. Discovery 문서 캐싱

`MoringAuth.discover()`는 첫 호출 시에만 `/.well-known/openid-configuration`을 가져오고 이후엔 메모리 캐시를 사용합니다.
서버 재시작 없이 SSO 서버의 설정이 바뀌었다면, 앱도 재시작해야 새 설정이 반영됩니다.

### 5. CLI PowerShell 오류

PowerShell에서 `npx @moring-auth init`는 `@` 문자가 splat 연산자로 해석되어 오류 발생.
반드시 `npx @moring-auth/cli init` 형태로 사용해야 합니다.

### 6. webMessageResponseMode와 CORS

팝업 방식(`loginWithPopup`)은 브라우저가 SSO 서버에 AJAX로 직접 요청하므로, 반드시 `clientBasedCORS` 설정이 필요합니다.
이를 설정하지 않으면 `.well-known/openid-configuration`과 `/token` 엔드포인트에서 CORS 에러 발생.
