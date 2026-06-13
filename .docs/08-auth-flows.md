# 08. 인증 플로우별 상세 동작 원리

## 🔐 공통 기반: PKCE (Proof Key for Code Exchange)

모든 플로우에서 PKCE가 강제 적용됩니다. PKCE는 코드 가로채기 공격을 막는 메커니즘입니다.

```
1. 클라이언트: 랜덤 문자열 생성 → code_verifier (43자)
2. 클라이언트: SHA-256(code_verifier) → Base64URL 인코딩 → code_challenge
3. 클라이언트 → SSO: Authorization 요청 시 code_challenge 포함
4. SSO: code_challenge를 임시 저장
5. SSO → 클라이언트: authorization_code 발급
6. 클라이언트 → SSO: Token 요청 시 code_verifier 포함
7. SSO: SHA-256(code_verifier) 재계산 → 3단계의 code_challenge와 비교 → 일치 시 토큰 발급
```

→ 중간에 code를 가로채도 code_verifier가 없으면 토큰을 얻을 수 없습니다.

---

## 🔄 플로우 A: Next.js 리디렉트 방식 (가장 보안 높음)

**사용 패키지**: `@moring-auth/nextjs`

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│ 유저 브  │     │ Next.js 앱   │     │ SSO 서버         │
│ 라우저   │     │ (서버 포함)   │     │ sso.moring.co   │
└────┬────┘     └──────┬───────┘     └────────┬────────┘
     │                  │                      │
     │ [1] 로그인 버튼 클릭 │                    │
     │─────────────────>│                      │
     │                  │ [2] getLoginUrl() 호출 │
     │                  │  → PKCE verifier 생성  │
     │                  │  → moring_code_verifier 쿠키 저장
     │                  │                      │
     │ [3] SSO로 리디렉트 │                      │
     │<─────────────────│                      │
     │                  │                      │
     │ [4] SSO 로그인 화면 요청                  │
     │──────────────────────────────────────>  │
     │ [5] 로그인 UI 표시 (account.louis1618.shop으로 이동)
     │<─────────────────────────────────────   │
     │                  │                      │
     │ [6] 아이디/비번 입력 완료                 │
     │──────────────────────────────────────>  │
     │ [7] ?code=XXX&state=YYY 포함하여 redirect_uri로 리디렉트
     │<─────────────────────────────────────   │
     │                  │                      │
     │ [8] /api/auth/callback 요청              │
     │─────────────────>│                      │
     │                  │ [9] handleAuth() 실행  │
     │                  │  → code + codeVerifier로 토큰 교환
     │                  │──────────────────────>│
     │                  │  [10] id_token 반환    │
     │                  │<──────────────────────│
     │                  │ [11] moring_session HttpOnly 쿠키 저장
     │                  │ [12] /dashboard로 리디렉트
     │<─────────────────│                      │
     │                  │                      │
     │ [13] 이후 모든 요청: withMoringAuth 미들웨어가 쿠키 검증
```

**특징**:
- 토큰이 **절대 JavaScript에 노출되지 않음** (HttpOnly 쿠키)
- XSS 공격으로도 토큰 탈취 불가
- Server Component에서 `getMoringUser()` 직접 호출 가능

---

## 🔄 플로우 B: React SPA 리디렉트 방식

**사용 패키지**: `@moring-auth/react` (login + handleCallback)

```
┌─────────┐     ┌──────────────┐     ┌─────────────────┐
│ 브라우저  │     │ React SPA     │     │ SSO 서버         │
│          │     │ (JS만 있음)   │     │ sso.moring.co   │
└────┬────┘     └──────┬───────┘     └────────┬────────┘
     │                  │                      │
     │ [1] login() 호출  │                      │
     │                  │ [2] PKCE verifier 생성 │
     │                  │ → sessionStorage에 저장│
     │                  │                      │
     │ [3] SSO로 페이지 리디렉트 (현재 페이지 사라짐!)
     │<─────────────────│                      │
     │                  │                      │
     │ ─────── SSO 서버에서 로그인 완료 ─────── │
     │                  │                      │
     │ [4] /callback?code=XXX 로 리디렉트      │
     │<─────────────────────────────────────   │
     │                  │                      │
     │ [5] /callback 컴포넌트 렌더링            │
     │─────────────────>│                      │
     │                  │ [6] handleCallback(code) 호출
     │                  │ → sessionStorage에서 codeVerifier 꺼냄
     │                  │ → /token 엔드포인트로 AJAX 요청
     │                  │──────────────────────>│
     │                  │ [7] id_token, access_token 반환
     │                  │<──────────────────────│
     │                  │ [8] { tokens, user } 반환
     │                  │ → 앱 상태에 저장 (Zustand, Redux 등)
```

**특징**:
- `/callback` 전용 라우트 컴포넌트 필요
- 토큰이 **JavaScript 메모리/sessionStorage**에 저장 (XSS 취약점 있음)
- 백엔드 서버 불필요

---

## 🔄 플로우 C: React SPA 팝업 방식 (Google 스타일)

**사용 패키지**: `@moring-auth/react` (loginWithPopup)

```
┌─────────────────────────────────────────────────────┐
│ 현재 페이지 (계속 살아있음)                             │
│                                                       │
│  [1] loginWithPopup() 호출                            │
│  ↓                                                    │
│  [2] getLoginUrl({ responseMode: 'web_message' }) 호출│
│  [3] window.open() → 팝업 창 열림 (500x600)           │
│  [4] window.addEventListener('message', ...) 대기     │
│                                ┌────────────────────┐│
│                                │ SSO 팝업 창         ││
│                                │                    ││
│                                │ [5] SSO 로그인 UI  ││
│                                │ 아이디/비번 입력    ││
│                                │ 로그인 완료         ││
│                                │                    ││
│                                │ [6] SSO 서버:      ││
│                                │ window.opener      ││
│                                │ .postMessage({     ││
│                                │   type: "authz_resp"││
│                                │   response: {code} ││
│                                │ })                 ││
│                                │ 창 자동 닫힘        ││
│                                └────────────────────┘│
│                                                       │
│  [7] messageListener 수신:                            │
│    → origin 검증 (sso.moring.co인지?)                 │
│    → state 검증 (CSRF 방지)                           │
│    → handleCallback(code, { codeVerifier }) 호출      │
│    → AJAX로 /token 엔드포인트 호출                     │
│    → id_token, access_token 획득                      │
│    → Promise resolve({ tokens, user })                │
│                                                       │
│  [8] 현재 페이지 UI 즉시 업데이트 (리프레시 없음!)     │
└─────────────────────────────────────────────────────┘
```

**특징**:
- `/callback` 라우트 **불필요**
- 현재 페이지가 유지되어 **최고의 UX**
- SSO 서버에 `webMessageResponseMode` 활성화 필요
- 브라우저 팝업 차단 주의

---

## 🔒 CORS 이슈 (React SPA 전용)

React SPA에서 `fetch()`로 OIDC 엔드포인트를 직접 호출할 때 CORS 설정 필요:

**문제**: `http://localhost:5173` → `https://sso.moring.co` cross-origin 요청

**해결**: SSO 서버의 `provider.js`에 `clientBasedCORS` 설정:

```javascript
clientBasedCORS(ctx, origin, client) {
  return true; // 모든 origin 허용 (PKCE로 보안 보장)
}
```

> **왜 `return true`가 안전한가?**  
> 설령 악의적인 사이트가 토큰 교환을 시도해도, PKCE의 `code_verifier`가 없으면 토큰을 얻을 수 없습니다.

---

## 🔑 토큰 검증 방식 (JWKS)

모든 토큰 검증은 SSO 서버의 **공개키(JWKS)**를 사용합니다.

```
1. 클라이언트: GET https://sso.moring.co/.well-known/jwks.json
   → 공개키 묶음(RSA Public Key) 다운로드
   
2. jose 라이브러리: JWT 헤더에서 kid(key ID) 추출
   → 해당 kid의 공개키 선택
   
3. RSA 공개키로 JWT 서명(RS256) 검증
   → 서버의 비밀키로 서명된 토큰임을 수학적으로 증명
   
4. 클레임 추출: sub(유저ID), email, name, picture 등
```

**핵심**: 시크릿 키 없이 공개키만으로 검증하므로, 클라이언트 사이드에서도 완전히 신뢰할 수 있습니다.
