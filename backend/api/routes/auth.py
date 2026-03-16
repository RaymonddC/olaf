"""OLAF — Auth API endpoints.

POST /api/auth/register — Create user profile after Firebase Auth registration
POST /api/auth/family-link — Link a family member to an elderly user
GET  /api/auth/me — Get current user profile and linked accounts
"""

import logging
import secrets
import string

from fastapi import APIRouter, Depends, HTTPException, status
from firebase_admin import auth as firebase_auth

from api.middleware.firebase_auth import get_current_user
from models.api import (
    ApiResponse,
    CreateElderAccountRequest,
    CreateElderAccountResponse,
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


@router.post("/create-elder-account", status_code=status.HTTP_201_CREATED)
async def create_elder_account(
    req: CreateElderAccountRequest,
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
) -> ApiResponse:
    """Family member creates an elder's account on their behalf.

    Creates a Firebase Auth user, a Firestore profile, and a family link
    in one step. Returns temporary credentials for the family member to
    set up the elder's device.
    """
    family_uid = user["uid"]

    # Verify the caller is a family member
    family_profile = await fs.get_user(family_uid)
    if family_profile and family_profile.role != "family":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only family members can create elder accounts",
        )

    # Validate username format
    username = req.username.strip().lower()
    if len(username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters",
        )
    if not username.replace("_", "").replace(".", "").isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username can only contain letters, numbers, dots, and underscores",
        )

    # Check username uniqueness via Firestore
    existing = await fs.get_user_by_username(username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please choose another.",
        )

    # Generate a secure temporary password
    alphabet = string.ascii_letters + string.digits
    temp_password = "".join(secrets.choice(alphabet) for _ in range(10))

    # Create Firebase Auth user — use username@olaf.app as internal email
    internal_email = f"{username}@olaf.app"
    try:
        firebase_user = firebase_auth.create_user(
            email=internal_email,
            password=temp_password,
            display_name=req.name,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please choose another.",
        )

    elder_uid = firebase_user.uid

    # Create Firestore profile for the elder
    elder_profile = UserProfile(
        uid=elder_uid,
        role="elderly",
        name=req.name,
        username=username,
        age=req.age,
        timezone=req.timezone,
        language=req.language,
    )
    await fs.create_user(elder_profile)

    # Create the family link
    family_name = family_profile.name if family_profile else ""
    link_id = f"{family_uid}_{elder_uid}"
    link = FamilyLink(
        link_id=link_id,
        elderly_user_id=elder_uid,
        family_user_id=family_uid,
        family_name=family_name,
        relationship=req.relationship,
        permissions=["view_health", "view_alerts", "view_memories"],
    )
    await fs.create_family_link(link)

    logger.info(
        "Family member %s created elder account %s (username=%s)",
        family_uid, elder_uid, username,
    )

    return ApiResponse(
        status="success",
        data=CreateElderAccountResponse(
            elder_user_id=elder_uid,
            username=username,
            temp_password=temp_password,
            link_id=link_id,
        ).model_dump(by_alias=True),
    )
