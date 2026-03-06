"""OLAF — Auth API endpoints.

POST /api/auth/register — Create user profile after Firebase Auth registration
POST /api/auth/family-link — Link a family member to an elderly user
GET  /api/auth/me — Get current user profile and linked accounts
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from api.middleware.firebase_auth import get_current_user
from models.api import (
    ApiResponse,
    FamilyLinkRequest,
    LinkedAccount,
    RegisterRequest,
    UserProfileResponse,
)
from models.firestore import FamilyLink, UserProfile
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
) -> ApiResponse:
    """Create user profile after Firebase Auth registration."""
    uid = user["uid"]

    # Check if user already exists
    existing = await fs.get_user(uid)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User profile already exists",
        )

    profile = UserProfile(
        uid=uid,
        role=req.role,
        name=req.name,
        age=req.age,
        timezone=req.timezone,
        language=req.language,
    )
    await fs.create_user(profile)

    logger.info("User registered: uid=%s role=%s", uid, req.role)

    return ApiResponse(
        status="success",
        data={
            "userId": uid,
            "role": req.role,
            "profileComplete": False,
        },
    )


@router.post("/family-link", status_code=status.HTTP_201_CREATED)
async def family_link(
    req: FamilyLinkRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
) -> ApiResponse:
    """Link a family member to an elderly user."""
    family_uid = user["uid"]
    elderly_uid = req.elderly_user_id

    # Verify the elderly user exists
    elderly_user = await fs.get_user(elderly_uid)
    if not elderly_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Elderly user not found",
        )

    # Get family user profile for the name
    family_user = await fs.get_user(family_uid)
    family_name = family_user.name if family_user else user.get("name", "")

    link_id = f"{family_uid}_{elderly_uid}"
    link = FamilyLink(
        link_id=link_id,
        elderly_user_id=elderly_uid,
        family_user_id=family_uid,
        family_name=family_name,
        relationship=req.relationship,
        permissions=req.permissions,
    )
    await fs.create_family_link(link)

    logger.info("Family link created: %s -> %s (%s)", family_uid, elderly_uid, req.relationship)

    return ApiResponse(
        status="success",
        data={
            "linkId": link_id,
            "elderlyUserId": elderly_uid,
            "familyUserId": family_uid,
            "relationship": req.relationship,
        },
    )


@router.get("/me")
async def get_me(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
) -> ApiResponse:
    """Get current user profile and linked accounts."""
    uid = user["uid"]

    profile = await fs.get_user(uid)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not found",
        )

    # Get linked accounts
    linked_accounts: list[LinkedAccount] = []
    if profile.role == "elderly":
        links = await fs.get_family_links_for_elderly(uid)
        for link in links:
            family_user = await fs.get_user(link.family_user_id)
            if family_user:
                linked_accounts.append(
                    LinkedAccount(
                        user_id=link.family_user_id,
                        name=family_user.name,
                        relationship=link.relationship,
                        role="family",
                    )
                )
    else:
        links = await fs.get_family_links_for_family(uid)
        for link in links:
            elderly_user = await fs.get_user(link.elderly_user_id)
            if elderly_user:
                linked_accounts.append(
                    LinkedAccount(
                        user_id=link.elderly_user_id,
                        name=elderly_user.name,
                        relationship=link.relationship,
                        role="elderly",
                    )
                )

    return ApiResponse(
        status="success",
        data=UserProfileResponse(
            user_id=uid,
            role=profile.role,
            name=profile.name,
            age=profile.age,
            linked_accounts=linked_accounts,
        ).model_dump(by_alias=True),
    )
