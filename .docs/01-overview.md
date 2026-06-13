# 01. 전체 시스템 개요 및 아키텍처

## 🌐 Moring SSO란?

Moring SSO는 Moring 생태계의 서비스들이 단일 계정으로 모든 연동 서비스에 로그인할 수 있게 해주는 **중앙 인증 시스템**입니다.
OIDC (OpenID Connect) + OAuth 2.0 표준을 기반으로 구축되어, 표준을 준수하는 모든 언어/프레임워크에서 연동할 수 있습니다.

---

## 🏗️ 전체 시스템 구성

시스템은 크게 **3개의 레이어**로 나뉩니다.

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: 사용자의 앱 (Client Application)                        │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Next.js App │  │  React SPA   │  │  Express API │            │
│  │  (서버사이드)  │  │  (클라이언트) │  │   (백엔드)   │            │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                 │                     │
│  @moring-auth/nextjs  @moring-auth/react  @moring-auth/express    │
└─────────┼───────────────────────────────────┼───────────────────┘
          │            @moring-auth/core       │
┌─────────▼─────────────────────────────────────────────────────┐
│  Layer 2: Moring Auth SDK (NPM 패키지)                          │
│                                                                 │
│  @moring-auth/core  ─── OIDC 클라이언트, JWT 검증, PKCE 생성    │
│  @moring-auth/nextjs ── Next.js 서버 헬퍼, 미들웨어             │
│  @moring-auth/react  ── React Provider, useMoringAuth 훅        │
│  @moring-auth/express ─ Express 미들웨어 (requireMoringAuth)    │
│  @moring-auth/cli   ─── 프로젝트 초기화 CLI                      │
└─────────────────────────────┬───────────────────────────────┘
                               │ OIDC 통신
┌──────────────────────────────▼───────────────────────────────┐
│  Layer 3: Moring SSO Provider Server                          │
│                                                               │
│  node-oidc-provider (v8.8.1) on Express                      │
│  Supabase (사용자 인증 DB)                                     │
│  https://sso.moring.co (Production)                           │
└───────────────────────────────────────────────────────────────┘
```

---

## 📦 저장소 구조

### SDK 모노레포
**경로**: `C:\Users\louis\Documents\.dev\Luverse_moring\moring\moring-sso-template`
**GitHub**: https://github.com/MoringLab/moring-auth-library

```
moring-sso-template/
├── packages/
│   ├── core/         → @moring-auth/core (v0.2.0)
│   ├── nextjs/       → @moring-auth/nextjs (v0.1.1)
│   ├── react/        → @moring-auth/react (v0.2.0)
│   ├── express/      → @moring-auth/express (v0.1.0)
│   └── cli/          → @moring-auth/cli (v0.1.1)
├── examples/
│   └── nextjs-starter/   → Next.js 스타터 예제
└── package.json          → npm workspaces 루트
```

### SSO 백엔드 서버
**경로**: `Z:\home\louis\Documents\.dev\Moring-SSO-Provider-Server` (Linux 마운트 경로)
**Production URL**: `https://sso.moring.co`

```
Moring-SSO-Provider-Server/
├── index.js          → Express 앱 메인 (라우터, 미들웨어)
├── provider.js       → node-oidc-provider 설정 및 인스턴스
├── adapters/
│   └── hybrid.js     → Supabase + Redis 하이브리드 어댑터
├── lib/
│   └── account.js    → Supabase에서 계정 조회 (findAccount)
└── api/
    └── sso/
        └── issue-code.js → 외부 로그인 후 코드 발급 API
```

---

## 🔐 사용하는 보안 표준

| 표준 | 설명 |
|------|------|
| **OIDC (OpenID Connect)** | OAuth 2.0 위에 ID Token 계층을 추가한 인증 표준 |
| **OAuth 2.0 Authorization Code Flow** | 가장 보안이 높은 표준 인가 흐름 |
| **PKCE (Proof Key for Code Exchange)** | 코드 가로채기 공격 방지. 모든 요청에 강제 적용 |
| **JWT (ID Token)** | 유저 정보가 서명된 토큰 (jose 라이브러리로 검증) |
| **JWKS (JSON Web Key Set)** | SSO 서버의 공개키 묶음. 토큰 서명 검증에 사용 |
| **HttpOnly Cookie** | Next.js/Express 환경에서 XSS 방지를 위해 토큰을 쿠키에 저장 |

---

## 🗺️ 지원 연동 방식 비교

| 방식 | 패키지 | API 라우트 필요 | 토큰 저장 위치 | XSS 방어 |
|------|--------|----------------|---------------|---------|
| Next.js (서버) | `@moring-auth/nextjs` | ✅ 필요 (자동 생성) | HttpOnly 쿠키 | ✅ 완벽 |
| React (리디렉트) | `@moring-auth/react` | ❌ 불필요 | sessionStorage/메모리 | ⚠️ 보통 |
| React (팝업) | `@moring-auth/react` | ❌ 불필요 | sessionStorage/메모리 | ⚠️ 보통 |
| Express | `@moring-auth/express` | ✅ 필요 (직접 구현) | HttpOnly 쿠키 | ✅ 완벽 |

---

## 🔗 관련 서비스 URL

| 서비스 | URL |
|--------|-----|
| SSO 인증 서버 | https://sso.moring.co |
| SSO 로그인 UI | https://account.louis1618.shop |
| SDK GitHub | https://github.com/MoringLab/moring-auth-library |
| OIDC Discovery | https://sso.moring.co/.well-known/openid-configuration |
