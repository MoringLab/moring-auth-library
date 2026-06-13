# 07. @moring-auth/cli

## 📍 기본 정보

- **경로**: `packages/cli/`
- **NPM**: `@moring-auth/cli`
- **버전**: `0.1.1`
- **역할**: 새 프로젝트에 Moring Auth SDK를 **자동으로 세팅**해주는 CLI 도구
- **명령어**: `npx @moring-auth/cli init`

---

## 🚀 사용법

```bash
# 프로젝트 폴더로 이동 후
npx @moring-auth/cli init
```

---

## 🔄 init 명령어 동작 순서

### 1단계: 프레임워크 자동 감지

현재 폴더의 `package.json`을 읽어 `dependencies`에서 프레임워크를 자동 파악합니다.

```
next    가 있으면 → "nextjs" 감지
express 가 있으면 → "express" 감지
react   가 있으면 → "react" 감지
없으면             → "unknown" 처리
```

### 2단계: 설정값 입력 프롬프트

```
? Moring SSO Issuer URL: https://sso.moring.co
? Moring Client ID: your-client-id
? Moring Client Secret (Optional): ****
? Redirect URI: http://localhost:3000/api/auth/callback
```

### 3단계: 환경변수 파일 생성/업데이트

- Next.js: `.env.local`에 추가
- 그 외: `.env`에 추가

```bash
# 생성되는 내용
MORING_ISSUER="https://sso.moring.co"
MORING_CLIENT_ID="your-client-id"
MORING_CLIENT_SECRET="your-secret"   # 입력한 경우
MORING_REDIRECT_URI="http://localhost:3000/api/auth/callback"
```

### 4단계: 프레임워크별 템플릿 파일 생성

**Next.js인 경우**: 콜백 API 라우트 자동 생성 여부 물어봄
- `src/app/api/auth/callback/route.ts` (또는 `app/api/auth/callback/route.ts`) 자동 생성

```typescript
// 생성되는 파일 내용
import { handleAuth } from '@moring-auth/nextjs';

export const GET = handleAuth({
  successRedirectUrl: '/protected',
});
```

**Express인 경우**: 예제 코드 파일 생성 여부 물어봄
- `moring-auth-demo.js` 생성 (로그인/콜백/보호된 라우트 예제)

---

## 📦 빌드 출력 (`dist/`)

| 파일 | 용도 |
|------|------|
| `dist/index.js` | CLI 실행 파일 (CommonJS) |

`package.json`의 `bin` 필드:
```json
{
  "bin": {
    "moring-auth": "./dist/index.js"
  }
}
```

---

## ⚠️ 알려진 이슈

- `npx @moring-auth init` ← 이렇게 하면 오류 (PowerShell에서 `@`가 splat 연산자로 해석됨)
- 반드시 `npx @moring-auth/cli init` 형태로 패키지명 전체를 사용해야 함
