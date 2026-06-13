import httpx
import urllib.parse
import secrets
import hashlib
import base64
import os
from typing import Dict, Any, Optional, List, Tuple
from .verify import verify_id_token

class MoringAuth:
    def __init__(
        self,
        issuer: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        scope: Optional[str] = None
    ):
        # Fallback to environment variables
        self.issuer = issuer or os.getenv("MORING_ISSUER") or os.getenv("SSO_ISSUER")
        self.client_id = client_id or os.getenv("MORING_CLIENT_ID") or os.getenv("SSO_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("MORING_CLIENT_SECRET") or os.getenv("SSO_CLIENT_SECRET")
        self.redirect_uri = redirect_uri or os.getenv("MORING_REDIRECT_URI") or ""
        self.scope = scope or "openid email profile"

        if not self.issuer:
            raise ValueError("MoringAuth: issuer is required (or set MORING_ISSUER environment variable).")
        if not self.client_id:
            raise ValueError("MoringAuth: client_id is required (or set MORING_CLIENT_ID environment variable).")

        self.issuer = self.issuer.rstrip("/")
        self._discovery_doc: Optional[Dict[str, Any]] = None

    async def discover(self) -> Dict[str, Any]:
        if self._discovery_doc:
            return self._discovery_doc

        discovery_url = f"{self.issuer}/.well-known/openid-configuration"
        async with httpx.AsyncClient() as client:
            res = await client.get(discovery_url)
            res.raise_for_status()
            self._discovery_doc = res.json()
            return self._discovery_doc

    def discover_sync(self) -> Dict[str, Any]:
        if self._discovery_doc:
            return self._discovery_doc

        discovery_url = f"{self.issuer}/.well-known/openid-configuration"
        with httpx.Client() as client:
            res = client.get(discovery_url)
            res.raise_for_status()
            self._discovery_doc = res.json()
            return self._discovery_doc

    async def get_login_url(
        self,
        state: Optional[str] = None,
        nonce: Optional[str] = None,
        scope: Optional[List[str]] = None,
        code_challenge: Optional[str] = None,
        code_challenge_method: Optional[str] = None
    ) -> Tuple[str, str, str, Optional[str]]:
        discovery = await self.discover()
        return self._build_login_url(discovery, state, nonce, scope, code_challenge, code_challenge_method)

    def get_login_url_sync(
        self,
        state: Optional[str] = None,
        nonce: Optional[str] = None,
        scope: Optional[List[str]] = None,
        code_challenge: Optional[str] = None,
        code_challenge_method: Optional[str] = None
    ) -> Tuple[str, str, str, Optional[str]]:
        discovery = self.discover_sync()
        return self._build_login_url(discovery, state, nonce, scope, code_challenge, code_challenge_method)

    def _build_login_url(
        self,
        discovery: Dict[str, Any],
        state: Optional[str],
        nonce: Optional[str],
        scope: Optional[List[str]],
        code_challenge: Optional[str],
        code_challenge_method: Optional[str]
    ) -> Tuple[str, str, str, Optional[str]]:
        state = state or secrets.token_urlsafe(16)
        nonce = nonce or secrets.token_urlsafe(16)
        scope_str = " ".join(scope) if scope else self.scope

        auth_endpoint = discovery["authorization_endpoint"]
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": scope_str,
            "state": state,
            "nonce": nonce
        }

        code_verifier = None
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = code_challenge_method or "S256"
        elif code_challenge_method == "S256" or not self.client_secret:
            # Auto PKCE
            code_verifier = secrets.token_urlsafe(43)
            sha256_hash = hashlib.sha256(code_verifier.encode("utf-8")).digest()
            challenge = base64.urlsafe_b64encode(sha256_hash).decode("utf-8").rstrip("=")
            params["code_challenge"] = challenge
            params["code_challenge_method"] = "S256"

        query_str = urllib.parse.urlencode(params)
        url = f"{auth_endpoint}?{query_str}"
        return url, state, nonce, code_verifier

    async def handle_callback(self, code: str, code_verifier: Optional[str] = None) -> Dict[str, Any]:
        discovery = await self.discover()
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret
        if code_verifier:
            data["code_verifier"] = code_verifier

        async with httpx.AsyncClient() as client:
            res = await client.post(discovery["token_endpoint"], data=data)
            res.raise_for_status()
            return res.json()

    def handle_callback_sync(self, code: str, code_verifier: Optional[str] = None) -> Dict[str, Any]:
        discovery = self.discover_sync()
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.redirect_uri,
            "client_id": self.client_id
        }
        if self.client_secret:
            data["client_secret"] = self.client_secret
        if code_verifier:
            data["code_verifier"] = code_verifier

        with httpx.Client() as client:
            res = client.post(discovery["token_endpoint"], data=data)
            res.raise_for_status()
            return res.json()

    async def verify_token(self, id_token: str) -> Dict[str, Any]:
        discovery = await self.discover()
        jwks_uri = discovery["jwks_uri"]
        
        # Async fetch helper for verify_id_token
        async def fetch_jwks(url: str) -> Dict[str, Any]:
            async with httpx.AsyncClient() as client:
                res = await client.get(url)
                res.raise_for_status()
                return res.json()

        # Execute JWKS fetch using async-safe caller
        # PyJWT is synchronous internally, but we resolve/verify the signature with async fetch caching
        # We can run the verify_id_token using a wrapper
        # Since verification is CPU-bound and fetching JWKS is I/O-bound, we retrieve JWKS asynchronously,
        # then pass the JWKS document directly to the decode algorithm
        jwks_doc = await fetch_jwks(jwks_uri)
        
        # Define a mock fetcher that returns pre-fetched doc
        def mock_fetcher(url):
            return jwks_doc

        return verify_id_token(
            id_token=id_token,
            jwks_uri=jwks_uri,
            issuer=discovery["issuer"],
            client_id=self.client_id,
            fetch_fn=mock_fetcher
        )

    def verify_token_sync(self, id_token: str) -> Dict[str, Any]:
        discovery = self.discover_sync()
        jwks_uri = discovery["jwks_uri"]

        def fetch_jwks_sync(url: str) -> Dict[str, Any]:
            with httpx.Client() as client:
                res = client.get(url)
                res.raise_for_status()
                return res.json()

        return verify_id_token(
            id_token=id_token,
            jwks_uri=jwks_uri,
            issuer=discovery["issuer"],
            client_id=self.client_id,
            fetch_fn=fetch_jwks_sync
        )

    async def get_user_from_token(self, id_token: str) -> Dict[str, Any]:
        return await self.verify_token(id_token)

    def get_user_from_token_sync(self, id_token: str) -> Dict[str, Any]:
        return self.verify_token_sync(id_token)


def create_moring_auth(
    issuer: Optional[str] = None,
    client_id: Optional[str] = None,
    client_secret: Optional[str] = None,
    redirect_uri: Optional[str] = None,
    scope: Optional[str] = None
) -> MoringAuth:
    return MoringAuth(
        issuer=issuer,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scope=scope
    )
