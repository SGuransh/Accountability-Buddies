import os
from functools import lru_cache
from pathlib import Path
from uuid import UUID

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_jwks_client() -> PyJWKClient:
    jwks_url = os.getenv("SUPABASE_JWKS_URL") or os.getenv("SUPABASE_JWT_SECRET")
    if not jwks_url or not jwks_url.startswith("https://"):
        raise RuntimeError("SUPABASE_JWKS_URL must be configured with the Supabase JWKS URL.")
    return PyJWKClient(jwks_url)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UUID:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(credentials.credentials)
        issuer = jwks_client.uri.removesuffix("/.well-known/jwks.json")
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=issuer,
            options={"require": ["sub", "exp"]},
        )
    except (jwt.PyJWTError, RuntimeError, ValueError) as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.") from error

    user_id = claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")
    try:
        return UUID(user_id)
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.") from error