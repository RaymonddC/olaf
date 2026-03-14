"""Firebase Authentication middleware for FastAPI.

Extracts and verifies Firebase ID tokens from the Authorization header.
Returns the decoded token dict containing uid, email, custom claims, etc.
"""

import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    """FastAPI dependency that verifies a Firebase ID token.

    Returns the decoded token dict with uid, email, role, and custom claims.
    Raises HTTP 401 for missing/invalid/expired tokens.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )
    except Exception:
        logger.exception("Unexpected error verifying Firebase token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


def require_role(allowed_roles: list[str]):
    """FastAPI dependency factory that checks the user's role claim.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_role(["admin"]))])
    """

    async def _check_role(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role") or user.get("custom_claims", {}).get("role")
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _check_role
