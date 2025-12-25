import os
import shutil
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = BASE_DIR / "storage"
FILES_DIR = STORAGE_DIR / "files"
THUMBNAILS_DIR = STORAGE_DIR / "thumbnails"
CHUNKS_DIR = STORAGE_DIR / "chunks"

# Create directories if not exist
DATA_DIR.mkdir(exist_ok=True)
FILES_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
CHUNKS_DIR.mkdir(parents=True, exist_ok=True)

# App config
APP_NAME = "CloudDrive"
SECRET_KEY = "your-super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# ============ STORAGE CONFIGURATION ============
# Options:
#   "all"           - Use ALL available disk space
#   "10GB"          - Allocate 10 gigabytes
#   "500MB"         - Allocate 500 megabytes
#   1073741824      - Allocate 1GB (in bytes)
#
# Set your preferred storage allocation below:
STORAGE_ALLOCATION = "all"  # Change this to limit storage


def get_storage_quota():
    """Calculate storage quota based on configuration"""
    if STORAGE_ALLOCATION == "all":
        # Get actual disk space
        disk = shutil.disk_usage(STORAGE_DIR)
        return disk.total
    elif isinstance(STORAGE_ALLOCATION, str):
        # Parse string like "10GB", "500MB"
        size_str = STORAGE_ALLOCATION.upper().strip()
        multipliers = {
            'TB': 1024 ** 4,
            'GB': 1024 ** 3,
            'MB': 1024 ** 2,
            'KB': 1024,
            'B': 1
        }
        for suffix, mult in multipliers.items():
            if size_str.endswith(suffix):
                return int(float(size_str[:-len(suffix)]) * mult)
        return int(size_str)  # Assume bytes if no suffix
    else:
        # Direct bytes value
        return int(STORAGE_ALLOCATION)


def get_disk_usage():
    """Get actual disk usage info"""
    disk = shutil.disk_usage(STORAGE_DIR)
    return {
        "total": disk.total,
        "used": disk.used,
        "free": disk.free
    }


# File config - NO SIZE LIMIT, ALL FORMATS ALLOWED
# Thumbnail config - ONLY for supported image formats
THUMBNAIL_SIZE = (300, 300)
THUMBNAIL_SUPPORTED = ["jpg", "jpeg", "png", "gif", "webp", "bmp"]

# Chunk size for large file uploads (5MB chunks)
CHUNK_SIZE = 5 * 1024 * 1024  # 5MB

# Default admin
DEFAULT_ADMIN = {
    "username": "admin",
    "password": "admin123",
    "email": "admin@localhost"
}
