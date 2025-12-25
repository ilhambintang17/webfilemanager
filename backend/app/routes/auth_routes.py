from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from datetime import datetime

from ..auth import (
    get_user_by_username, 
    verify_password, 
    create_access_token,
    update_user_password,
    update_last_login
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    success: bool
    message: str
    data: dict = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login endpoint"""
    user = get_user_by_username(request.username)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Create token
    token = create_access_token({"sub": user["username"]})
    
    # Update last login
    update_last_login(user["username"])
    
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"]
            },
            "expires_in": 86400  # 24 hours in seconds
        }
    }


@router.post("/logout")
async def logout():
    """Logout endpoint (client should discard token)"""
    return {
        "success": True,
        "message": "Logged out successfully"
    }


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Forgot password - simulated (no email sent)"""
    # In a real app, this would send an email
    # For local use, we just return success
    return {
        "success": True,
        "message": "Password reset instructions sent (simulated - use reset endpoint directly)"
    }


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with new password"""
    # For simplicity, we accept any token for local use
    # In production, validate the reset token
    
    # Default: reset admin password
    success = update_user_password("admin", request.new_password)
    
    if success:
        return {
            "success": True,
            "message": "Password reset successful"
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reset password"
        )
