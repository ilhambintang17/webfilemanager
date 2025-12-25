import json
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

from jose import JWTError, jwt
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .config import DATA_DIR, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_HOURS, DEFAULT_ADMIN

# Bearer token security
security = HTTPBearer()

# User data file
USERS_FILE = DATA_DIR / "users.json"


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def init_users():
    """Initialize users.json with default admin if not exists"""
    if not USERS_FILE.exists():
        default_user = {
            "id": 1,
            "username": DEFAULT_ADMIN["username"],
            "password_hash": hash_password(DEFAULT_ADMIN["password"]),
            "email": DEFAULT_ADMIN["email"],
            "created_at": datetime.now().isoformat(),
            "last_login": None
        }
        save_users({"users": [default_user], "next_id": 2})
    return load_users()


def load_users() -> dict:
    """Load users from JSON file"""
    if USERS_FILE.exists():
        with open(USERS_FILE, "r") as f:
            return json.load(f)
    return {"users": [], "next_id": 1}


def save_users(data: dict):
    """Save users to JSON file"""
    with open(USERS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_user_by_username(username: str) -> Optional[dict]:
    """Get user by username"""
    data = load_users()
    for user in data["users"]:
        if user["username"] == username:
            return user
    return None


def create_access_token(data: dict) -> str:
    """Create JWT token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    payload = verify_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    username = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    user = get_user_by_username(username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


def update_user_password(username: str, new_password: str) -> bool:
    """Update user password"""
    data = load_users()
    for user in data["users"]:
        if user["username"] == username:
            user["password_hash"] = hash_password(new_password)
            save_users(data)
            return True
    return False


def update_last_login(username: str):
    """Update user's last login time"""
    data = load_users()
    for user in data["users"]:
        if user["username"] == username:
            user["last_login"] = datetime.now().isoformat()
            save_users(data)
            break
