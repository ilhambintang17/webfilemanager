from pathlib import Path
from PIL import Image
import io

from ..config import THUMBNAILS_DIR, THUMBNAIL_SIZE


def generate_image_thumbnail(file_path: Path, file_id: str) -> str:
    """Generate thumbnail for image file only if needed"""
    try:
        with Image.open(file_path) as img:
            original_size = img.size
            
            # Skip thumbnail if image is already small enough
            # No need to create duplicate file
            if original_size[0] <= THUMBNAIL_SIZE[0] and original_size[1] <= THUMBNAIL_SIZE[1]:
                return None  # Use original file directly
            
            # Also skip if image is only slightly larger (within 1.5x)
            if original_size[0] <= THUMBNAIL_SIZE[0] * 1.5 and original_size[1] <= THUMBNAIL_SIZE[1] * 1.5:
                return None  # Use original file directly
            
            # Convert to RGB if necessary (for PNG with alpha)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Create thumbnail
            img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            
            # Save thumbnail
            thumb_filename = f"{file_id}.jpg"
            thumb_path = THUMBNAILS_DIR / thumb_filename
            img.save(thumb_path, "JPEG", quality=80)
            
            return f"storage/thumbnails/{thumb_filename}"
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        return None


def get_image_dimensions(file_path: Path) -> tuple:
    """Get image dimensions"""
    try:
        with Image.open(file_path) as img:
            return img.size
    except Exception:
        return None
