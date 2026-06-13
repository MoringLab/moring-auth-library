# moring-auth SDK

외부 서비스가 **Moring SSO (OpenID Connect 기반 단일 서명인증)** 시스템을 쉽고 안전하게 연동할 수 있도록 돕는 다중 플랫폼 개발자용 SDK 패키지입니다.

이 monorepo는 Node.js (JavaScript/TypeScript) 생태계 패키지들과 Python 생태계 패키지 및 각 프레임워크 어댑터를 포함하고 있습니다.

---

## ⚡ 지원 환경 및 설치 방법

### 1. JavaScript / TypeScript (Node.js)

| 패키지명 | 설명 | 설치 명령어 |
| :--- | :--- | :--- |
| **`@moring-auth/core`** | OIDC Core 클라이언트 및 토큰 검증기 | `npm install @moring-auth/core` |
| **`@moring-auth/react`** | React Context Provider 및 Hooks | `npm install @moring-auth/react` |
| **`@moring-auth/nextjs`** | Next.js Middleware 및 Server 컴포넌트 헬퍼 | `npm install @moring-auth/nextjs` |
| **`@moring-auth/express`** | Express.js 라우트 보호 미들웨어 | `npm install @moring-auth/express` |
| **`@moring-auth/cli`** | CLI 프로젝트 초기설정 및 보일러플레이트 생성기 | `npx moring-auth init` |

### 2. Python

| 패키지명 | 설명 | 설치 명령어 |
| :--- | :--- | :--- |
| **`moring-auth`** | Python OIDC 코어 및 JWKS 캐싱/검증 | `pip install moring-auth` |
| **`moring-auth-fastapi`** | FastAPI Dependency Injection 지원 | `pip install moring-auth-fastapi` |
| **`moring-auth-django`** | Django 요청 보호용 미들웨어 | `pip install moring-auth-django` |

---

## 🛠️ CLI 사용법 (Node.js/Next.js/Express)

새로운 프로젝트에 Moring SSO 설정을 구성하려면 프로젝트 루트에서 아래 명령을 실행하십시오.
```bash
npx moring-auth init
```
* **동작 방식**: 현재 사용 중인 프레임워크를 자동 감지하고, Moring 서버 주소(Issuer), Client ID 등의 설정을 기입받아 `.env` 파일 구성 및 로그인/로그아웃 콜백 핸들러 코드 파일을 자동으로 생성해 줍니다.

---

## 💻 프레임워크별 연동 가이드

### 1. Next.js (App Router)

#### A. OIDC 로그인 및 세션 관리 예제 (`src/app/page.tsx`)
```tsx
import { getMoringUser } from '@moring-auth/nextjs';
import { createMoringAuth } from '@moring-auth/core';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function Page() {
  // 1. 서버 사이드 쿠키 세션으로부터 로그인 유저정보 획득
  const user = await getMoringUser();

  // 2. 로그인 실행 (Moring SSO 인가 서버로 리다이렉트)
  async function handleSignIn() {
    'use server';
    const auth = createMoringAuth();
    const { url } = await auth.getLoginUrl();
    redirect(url);
  }

  // 3. 로그아웃 실행 (쿠키 세션 제거)
  async function handleSignOut() {
    'use server';
    const cookieStore = await cookies();
    cookieStore.delete('moring_session');
    redirect('/');
  }

  return (
    <div>
      {user ? (
        <>
          <p>환영합니다, {user.name}님 ({user.email})</p>
          <form action={handleSignOut}><button>로그아웃</button></form>
        </>
      ) : (
        <form action={handleSignIn}><button>Moring SSO 로그인</button></form>
      )}
    </div>
  );
}
```

#### B. 콜백 핸들러 구성 (`src/app/api/auth/callback/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import { createMoringAuth } from '@moring-auth/core';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) return NextResponse.json({ error: 'Code missing' }, { status: 400 });

  try {
    const auth = createMoringAuth();
    // 1. Authorization Code 를 Token으로 교환
    const tokens = await auth.handleCallback(code);
    // 2. ID Token signature 및 JWKS 검증
    const user = await auth.verifyToken(tokens.id_token);

    const response = NextResponse.redirect(new URL('/protected', request.url));
    
    // 3. 보안 쿠키에 세션 저장
    response.cookies.set('moring_session', tokens.id_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in || 3600,
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'SSO Failed', details: err.message }, { status: 500 });
  }
}
```

#### C. 미들웨어를 이용한 경로 보호 (`src/middleware.ts`)
```typescript
import { withMoringAuth } from '@moring-auth/nextjs/middleware';

export default withMoringAuth({
  publicPaths: ['/', '/login'], // 비보호(공개) 경로 설정
  redirectTo: '/',              // 미인증 시 리다이렉트할 경로
});
```

---

### 2. Express.js

```javascript
const express = require('express');
const { createMoringAuth } = require('@moring-auth/core');
const { requireMoringAuth } = require('@moring-auth/express');

const app = express();
const auth = createMoringAuth();

// 보호 경로: requireMoringAuth 미들웨어 적용 시, 유효 토큰이 없으면 자동으로 401 Unauthorized 반환
app.get('/api/dashboard', requireMoringAuth(), (req, res) => {
  res.json({
    message: '성공',
    user: req.user // 미들웨어가 JWT 검증 후 자동 주입한 유저 정보
  });
});
```

---

### 3. FastAPI (Python)

```python
from fastapi import FastAPI, Depends
from moring_auth import MoringAuth
from moring_auth_fastapi import require_auth

app = FastAPI()
auth = MoringAuth()

# require_auth 디펜던시를 이용해 비동기 API 경로를 간편하게 보호
@app.get("/secure-data")
def read_secure_data(user = Depends(require_auth(auth))):
    return {
        "status": "success",
        "user_id": user["id"],
        "email": user["email"]
    }
```

---

### 4. Django (Python)

#### A. `settings.py` 설정 구성
```python
MIDDLEWARE = [
    ...
    'moring_auth_django.MoringAuthMiddleware', # 미들웨어 추가
]

# Moring SSO 설정 등록
MORING_ISSUER = "https://sso.moring.co"
MORING_CLIENT_ID = "your-client-id"
MORING_CLIENT_SECRET = "your-client-secret"
MORING_REDIRECT_URI = "https://your-domain.com/auth/callback"

MORING_REQUIRED_PATHS = ['/dashboard', '/api/secure'] # 인증이 필요한 경로 목록
MORING_PUBLIC_PATHS = ['/auth/callback']              # 제외할 공개 경로 목록
```

#### B. 뷰에서 유저 객체 획득
```python
from django.http import JsonResponse

def dashboard_view(request):
    # 미들웨어가 JWT 검증 후 자동으로 request.moring_user 에 사용자 정보를 세팅합니다.
    user = request.moring_user
    return JsonResponse({
        "username": user.get("name"),
        "email": user.get("email")
    })
```

---

## 🔒 보안 핵심 고려사항

> [!WARNING]
> **1. Client Secret 보안 노출 방지**
> - `client_secret`은 서버 사이드(Next.js Server Actions/Route Handler, Express, Python)에서만 다루어져야 합니다.
> - 클라이언트 사이드 단독 SPA(React SPA 등)에서는 `client_secret`을 코드에 노출하지 말고, **PKCE (Proof Key for Code Exchange)** 보안 메커니즘을 적용하십시오. `@moring-auth/core`는 client_secret이 세팅되지 않은 경우 PKCE를 자동으로 활성화하여 URL을 생성합니다.

> [!NOTE]
> **2. JWKS(JSON Web Key Sets) 서명 검증의 신뢰성**
> - 이 SDK는 매번 비대칭 키를 획득하기 위해 외부 OIDC 서버를 연동하지 않고, 획득한 서명키 세트를 메모리에 기본 1시간 동안 캐싱합니다.
> - 새로운 서명키(Rotation)로 갱신될 시, 유실 방지를 위한 즉시 갱신(On-demand Refresh) 방어로직을 갖추고 있습니다.
