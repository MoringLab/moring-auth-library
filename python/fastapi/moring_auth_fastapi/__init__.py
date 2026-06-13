from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer
from moring_auth import MoringAuth
from typing import Optional, Callable, Dict, Any

class RequireMoringAuth:
    def __init__(self, auth_client: MoringAuth, cookie_name: str = "moring_session", required: bool = True):
        self.auth_client = auth_client
        self.cookie_name = cookie_name
        self.required = required
        self.bearer = HTTPBearer(auto_error=False)

    async def __call__(self, request: Request) -> Optional[Dict[str, Any]]:
        # 1. Extract from Cookie
        token = request.cookies.get(self.cookie_name)

        # 2. Fallback to Authorization Header (Bearer token)
        if not token:
            auth_header = await self.bearer(request)
            if auth_header and auth_header.credentials:
                token = auth_header.credentials

        if not token:
            if self.required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized: No session token provided"
                )
            return None

        try:
            # Verify asynchronously using the MoringAuth async verify_token method
            user = await self.auth_client.verify_token(token)
            return user
        except Exception as e:
            if self.required:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Unauthorized: Invalid token - {str(e)}"
                )
            return None

def require_auth(auth_client: MoringAuth, cookie_name: str = "moring_session", required: bool = True) -> Callable:
    """
    FastAPI dependency injection to protect routes and fetch the authenticated Moring SSO user.
    """
    return RequireMoringAuth(auth_client, cookie_name, required)
