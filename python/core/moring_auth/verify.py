import jwt
from jwt.algorithms import RSAAlgorithm
import time

# Cache format: { jwks_uri: { "keys": { kid: public_key }, "fetched_at": float } }
_jwks_cache = {}
CACHE_TTL = 3600  # Cache JWKS keys for 1 hour by default

def get_signing_key(jwks_uri: str, kid: str, fetch_fn) -> any:
    now = time.time()
    cache_entry = _jwks_cache.get(jwks_uri)

    # 1. If no cache exists or cache has expired, fetch fresh JWKS
    if not cache_entry or (now - cache_entry["fetched_at"]) > CACHE_TTL:
        try:
            jwks_doc = fetch_fn(jwks_uri)
            cache_entry = {
                "keys": {k.get("kid"): RSAAlgorithm.from_jwk(k) for k in jwks_doc.get("keys", []) if k.get("kid")},
                "fetched_at": now
            }
            _jwks_cache[jwks_uri] = cache_entry
        except Exception as e:
            # If fetch fails but we have stale cache, fallback to it
            if cache_entry:
                pass
            else:
                raise e

    # 2. If kid is missing from cache, perform key rotation check (fetch fresh keys once)
    if cache_entry and kid not in cache_entry["keys"]:
        jwks_doc = fetch_fn(jwks_uri)
        cache_entry = {
            "keys": {k.get("kid"): RSAAlgorithm.from_jwk(k) for k in jwks_doc.get("keys", []) if k.get("kid")},
            "fetched_at": now
        }
        _jwks_cache[jwks_uri] = cache_entry

    if not cache_entry or kid not in cache_entry["keys"]:
        raise ValueError(f"Signature verification failed: Kid '{kid}' was not found in JWKS.")

    return cache_entry["keys"][kid]


def verify_id_token(id_token: str, jwks_uri: str, issuer: str, client_id: str, fetch_fn) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(id_token)
    except Exception as e:
        raise ValueError("Invalid JWT format.") from e

    kid = unverified_header.get("kid")
    if not kid:
        raise ValueError("JWT header is missing 'kid' claim.")

    # Retrieve public key (using dynamic fetch function)
    public_key = get_signing_key(jwks_uri, kid, fetch_fn)

    # Decode and verify signature & claims
    payload = jwt.decode(
        id_token,
        public_key,
        algorithms=["RS256"],
        audience=client_id,
        issuer=issuer,
        options={"require": ["exp", "iss", "aud"]}
    )

    # Format into standard user dictionary
    return {
        "id": payload.get("sub") or payload.get("id"),
        "email": payload.get("email"),
        "name": payload.get("name") or payload.get("preferred_username"),
        "picture": payload.get("picture") or payload.get("avatar_url"),
        **payload
    }
Keep-Alive: true
