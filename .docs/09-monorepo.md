# 09. 모노레포 구조 및 개발 가이드

## 📍 경로

`C:\Users\louis\Documents\.dev\Luverse_moring\moring\moring-sso-template`

---

## 📁 전체 폴더 구조

```
moring-sso-template/
│
├── package.json           ← 루트. npm workspaces 설정
├── .npmrc                 ← NPM 스코프(@moring-auth) 설정
│
├── packages/              ← 실제 배포되는 SDK 패키지들
│   ├── core/              → @moring-auth/core
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── client.ts
│   │   │   └── verify.ts
│   │   ├── dist/          (빌드 결과물, gitignore 아님)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── nextjs/            → @moring-auth/nextjs
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── middleware.ts
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── react/             → @moring-auth/react
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── provider.tsx
│   │   │   └── hooks.ts
│   │   ├── dist/
│   │   └── package.json
│   │
│   ├── express/           → @moring-auth/express
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── dist/
│   │   └── package.json
│   │
│   └── cli/               → @moring-auth/cli
│       ├── src/
│       │   └── index.ts
│       ├── dist/
│       └── package.json
│
├── examples/
│   └── nextjs-starter/    ← 완성된 Next.js 예제 앱
│       ├── src/app/
│       │   ├── page.tsx          (로그인 폼 + Server Action)
│       │   ├── protected/page.tsx (보호된 페이지)
│       │   └── api/auth/callback/route.ts (handleAuth 사용)
│       ├── middleware.ts   (withMoringAuth 사용)
│       └── package.json
│
└── .docs/                 ← 이 문서들이 있는 곳
```

---

## 🏗️ npm workspaces

루트 `package.json`:
```json
{
  "name": "moring-auth-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "examples/*"
  ]
}
```

- `packages/*` 의 모든 폴더가 workspace 패키지가 됨
- 각 패키지들은 서로 `file:` 참조 없이 패키지명으로 바로 의존 가능
  - `@moring-auth/nextjs`에서 `@moring-auth/core`를 `import`하면 로컬 소스가 연결됨

---

## 🛠️ 개발 명령어

### 루트에서 전체 빌드
```bash
npm run build --workspaces
# 모든 packages/* 와 examples/* 의 build 스크립트 실행
```

### 특정 패키지만 빌드
```bash
npm run build -w @moring-auth/core
npm run build -w @moring-auth/react
```

### 전체 워치 모드 (개발 중)
```bash
npm run dev --workspaces --if-present
```

### NPM 배포
```bash
# 배포 (OTP 필요)
npm publish -w @moring-auth/core
npm publish -w @moring-auth/nextjs
npm publish -w @moring-auth/react
npm publish -w @moring-auth/cli

# 또는 한꺼번에 (단, 모두 빌드 완료 후)
npm run publish-all
```

---

## 📦 패키지 의존 관계

```
@moring-auth/cli
    (독립, commander + prompts 사용)

@moring-auth/core
    └─ jose (JWT 검증)

@moring-auth/nextjs
    └─ @moring-auth/core
    └─ next (peerDep)

@moring-auth/react
    └─ @moring-auth/core
    └─ react (peerDep)

@moring-auth/express
    └─ @moring-auth/core
    └─ express (peerDep)
```

---

## 🏷️ 버전 관리 현황

| 패키지 | 현재 버전 | 변경 내역 |
|--------|----------|---------|
| `@moring-auth/core` | `0.2.0` | v0.2.0: `getLoginUrl`에 `responseMode` 옵션 추가 (팝업 지원) |
| `@moring-auth/nextjs` | `0.1.1` | v0.1.1: `handleAuth()` 팩토리 함수 추가 (기존 40줄 → 2줄) |
| `@moring-auth/react` | `0.2.0` | v0.2.0: `loginWithPopup()` 훅 추가 (Google 스타일 팝업 로그인) |
| `@moring-auth/express` | `0.1.0` | 초기 버전 |
| `@moring-auth/cli` | `0.1.1` | v0.1.1: Next.js 템플릿이 `handleAuth` 사용하도록 업데이트 |

---

## 🔧 빌드 시스템 (`tsup`)

모든 패키지는 `tsup`으로 빌드합니다.

```json
// 예: packages/core/package.json
"scripts": {
  "build": "tsup src/index.ts --format cjs,esm --dts --clean"
}
```

| 옵션 | 설명 |
|------|------|
| `--format cjs,esm` | CommonJS + ES Module 동시 출력 |
| `--dts` | TypeScript 타입 선언 파일(.d.ts) 생성 |
| `--clean` | 빌드 전 `dist/` 폴더 초기화 |
| `--external next` | nextjs 패키지에서 next를 번들에 포함하지 않음 |

---

## 🔐 NPM 퍼블리시 권한

- **NPM Organization**: `@moring-auth` 스코프
- **Access**: public
- **2FA**: 배포 시 OTP 필요 (npm 계정 설정)
- **GitHub**: https://github.com/MoringLab/moring-auth-library
  - Token: 별도 관리 (직접 push 시 사용)

---

## 📡 `.npmrc` 설정

```
@moring-auth:registry=https://registry.npmjs.org/
```

`@moring-auth` 스코프를 공식 NPM 레지스트리에서 가져오도록 지정.
