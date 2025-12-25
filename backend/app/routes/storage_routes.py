from fastapi import APIRouter, Depends

from ..auth import get_current_user
from ..config import get_storage_quota, get_disk_usage
from ..services.file_service import get_storage_stats

router = APIRouter(prefix="/api/storage", tags=["Storage"])


@router.get("/quota")
async def get_storage_quota_info(user: dict = Depends(get_current_user)):
    """Get storage usage information"""
    stats = get_storage_stats()
    disk = get_disk_usage()
    
    # Get configured quota
    total_quota = get_storage_quota()
    
    # Calculate usage based on our files
    used = stats["total_used"]
    available = total_quota - used
    percentage = (used / total_quota * 100) if total_quota > 0 else 0
    
    return {
        "success": True,
        "data": {
            "total": total_quota,
            "used": used,
            "available": available,
            "percentage_used": round(percentage, 1),
            "total_files": stats["total_files"],
            "breakdown": stats["breakdown"],
            # Actual disk info
            "disk": {
                "total": disk["total"],
                "used": disk["used"],
                "free": disk["free"]
            }
        }
    }


@router.get("/analysis")
async def get_storage_analysis(user: dict = Depends(get_current_user)):
    """Get detailed storage analysis"""
    stats = get_storage_stats()
    disk = get_disk_usage()
    
    return {
        "success": True,
        "data": {
            "total_files": stats["total_files"],
            "file_type_distribution": stats["breakdown"],
            "disk_info": disk
        }
    }
