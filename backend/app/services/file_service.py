import json
import uuid
import shutil
import mimetypes
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from ..config import DATA_DIR, FILES_DIR, THUMBNAILS_DIR


# Files metadata file
FILES_FILE = DATA_DIR / "files.json"

# Known file type mappings (flexible, not restrictive)
FILE_TYPE_EXTENSIONS = {
    "image": ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico", "tiff", "tif"],
    "video": ["mp4", "webm", "mov", "avi", "mkv", "flv", "wmv", "m4v", "3gp"],
    "audio": ["mp3", "wav", "ogg", "flac", "aac", "wma", "m4a"],
    "document": ["pdf", "doc", "docx", "txt", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf", "csv", "md"],
    "archive": ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "tgz"],
    "code": ["py", "js", "ts", "jsx", "tsx", "html", "css", "json", "xml", "yaml", "yml", "go", "rs", "c", "cpp", "h", "java", "kt", "swift", "php", "rb", "sh", "bash", "sql", "vue", "svelte"],
    "executable": ["exe", "msi", "app", "dmg", "deb", "rpm", "apk"],
}


def init_files():
    """Initialize files.json if not exists"""
    if not FILES_FILE.exists():
        save_files_data({"files": [], "next_id": 1})
    return load_files_data()


def load_files_data() -> dict:
    """Load files metadata from JSON"""
    if FILES_FILE.exists():
        with open(FILES_FILE, "r") as f:
            return json.load(f)
    return {"files": [], "next_id": 1}


def save_files_data(data: dict):
    """Save files metadata to JSON"""
    with open(FILES_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


def get_file_type(filename: str) -> str:
    """Determine file type from extension - accepts ALL formats"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    # Check known types
    for file_type, extensions in FILE_TYPE_EXTENSIONS.items():
        if ext in extensions:
            return file_type
    
    # Unknown extension = "other" (still allowed!)
    return "other"


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename"""
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def create_file_record(
    filename: str,
    original_filename: str,
    file_size: int,
    parent_folder_id: Optional[str] = None,
    is_folder: bool = False
) -> dict:
    """Create a new file record"""
    data = load_files_data()
    
    file_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    # Get file extension
    ext = original_filename.rsplit('.', 1)[-1] if '.' in original_filename else ''
    # Store file directly in files/ folder as: {id}.{ext} or {id} if no extension
    stored_filename = f"{file_id}.{ext}" if ext else file_id
    
    record = {
        "id": file_id,
        "filename": stored_filename,
        "original_filename": original_filename,
        "file_path": f"files/{stored_filename}" if not is_folder else None,
        "file_size": file_size,
        "file_type": "folder" if is_folder else get_file_type(original_filename),
        "mime_type": None if is_folder else get_mime_type(original_filename),
        "thumbnail_path": None,
        "parent_folder_id": parent_folder_id,
        "is_folder": is_folder,
        "is_favorite": False,
        "is_deleted": False,
        "created_at": now,
        "modified_at": now,
        "deleted_at": None
    }
    
    data["files"].append(record)
    save_files_data(data)
    
    return record


def get_file_by_id(file_id: str) -> Optional[dict]:
    """Get file by ID"""
    data = load_files_data()
    for f in data["files"]:
        if f["id"] == file_id:
            return f
    return None


def get_files_in_folder(folder_id: Optional[str] = None, include_deleted: bool = False) -> List[dict]:
    """Get all files in a folder"""
    data = load_files_data()
    files = []
    
    for f in data["files"]:
        if f["parent_folder_id"] == folder_id:
            if include_deleted or not f["is_deleted"]:
                files.append(f)
    
    # Sort: folders first, then by name
    files.sort(key=lambda x: (not x["is_folder"], x["original_filename"].lower()))
    return files


def get_deleted_files() -> List[dict]:
    """Get all deleted files (trash)"""
    data = load_files_data()
    return [f for f in data["files"] if f["is_deleted"]]


def get_favorite_files() -> List[dict]:
    """Get all favorite files"""
    data = load_files_data()
    return [f for f in data["files"] if f["is_favorite"] and not f["is_deleted"]]


def update_file(file_id: str, updates: dict) -> Optional[dict]:
    """Update file record"""
    data = load_files_data()
    
    for i, f in enumerate(data["files"]):
        if f["id"] == file_id:
            data["files"][i].update(updates)
            data["files"][i]["modified_at"] = datetime.now().isoformat()
            save_files_data(data)
            return data["files"][i]
    
    return None


def delete_file_record(file_id: str) -> bool:
    """Permanently delete file record and associated files"""
    data = load_files_data()
    
    for i, f in enumerate(data["files"]):
        if f["id"] == file_id:
            # Delete physical file
            if f["file_path"]:
                file_path = FILES_DIR.parent / f["file_path"]
                if file_path.exists():
                    file_path.unlink()
            
            # Delete thumbnail (always try)
            if f.get("thumbnail_path"):
                thumb_path = THUMBNAILS_DIR / f"{file_id}.jpg"
                if thumb_path.exists():
                    thumb_path.unlink()
            
            # Remove from list
            data["files"].pop(i)
            save_files_data(data)
            return True
    
    return False


def get_folder_path(folder_id: Optional[str]) -> str:
    """Get full path string for a folder"""
    if folder_id is None:
        return "/"
    
    path_parts = []
    current_id = folder_id
    
    while current_id:
        folder = get_file_by_id(current_id)
        if folder:
            path_parts.insert(0, folder["original_filename"])
            current_id = folder["parent_folder_id"]
        else:
            break
    
    return "/" + "/".join(path_parts)


def get_breadcrumb(folder_id: Optional[str]) -> List[dict]:
    """Get breadcrumb path for a folder"""
    breadcrumb = [{"id": None, "name": "Home", "path": "/"}]
    
    if folder_id is None:
        return breadcrumb
    
    path_parts = []
    current_id = folder_id
    
    while current_id:
        folder = get_file_by_id(current_id)
        if folder:
            path_parts.insert(0, {"id": folder["id"], "name": folder["original_filename"]})
            current_id = folder["parent_folder_id"]
        else:
            break
    
    for part in path_parts:
        breadcrumb.append(part)
    
    return breadcrumb


def get_folder_item_count(folder_id: str) -> int:
    """Get number of items in a folder"""
    data = load_files_data()
    count = 0
    for f in data["files"]:
        if f["parent_folder_id"] == folder_id and not f["is_deleted"]:
            count += 1
    return count


def search_files(query: str) -> List[dict]:
    """Search files by name"""
    data = load_files_data()
    query_lower = query.lower()
    results = []
    
    for f in data["files"]:
        if not f["is_deleted"] and query_lower in f["original_filename"].lower():
            results.append(f)
    
    return results


def get_storage_stats() -> dict:
    """Get storage statistics"""
    data = load_files_data()
    
    total_size = 0
    type_breakdown = {
        "image": {"count": 0, "size": 0},
        "video": {"count": 0, "size": 0},
        "audio": {"count": 0, "size": 0},
        "document": {"count": 0, "size": 0},
        "archive": {"count": 0, "size": 0},
        "code": {"count": 0, "size": 0},
        "other": {"count": 0, "size": 0}
    }
    
    for f in data["files"]:
        if not f["is_deleted"] and not f["is_folder"]:
            size = f["file_size"] or 0
            total_size += size
            
            file_type = f["file_type"]
            if file_type in type_breakdown:
                type_breakdown[file_type]["count"] += 1
                type_breakdown[file_type]["size"] += size
            else:
                type_breakdown["other"]["count"] += 1
                type_breakdown["other"]["size"] += size
    
    return {
        "total_used": total_size,
        "total_files": sum(t["count"] for t in type_breakdown.values()),
        "breakdown": type_breakdown
    }
