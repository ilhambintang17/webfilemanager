import os
import shutil
import uuid
import json
from pathlib import Path
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Query, Form, Request, Header
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from ..auth import get_current_user
from ..config import FILES_DIR, CHUNKS_DIR, CHUNK_SIZE, THUMBNAIL_SUPPORTED
from ..services.file_service import (
    init_files,
    create_file_record,
    get_file_by_id,
    get_files_in_folder,
    get_deleted_files,
    get_favorite_files,
    update_file,
    delete_file_record,
    get_breadcrumb,
    get_folder_item_count,
    search_files,
    get_storage_stats
)
from ..services.thumbnail_service import generate_image_thumbnail, get_image_dimensions


router = APIRouter(prefix="/api/files", tags=["Files"])


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None


class RenameRequest(BaseModel):
    new_name: str


class MoveRequest(BaseModel):
    destination_folder_id: Optional[str] = None


class ChunkUploadInit(BaseModel):
    filename: str
    file_size: int
    total_chunks: int
    folder_id: Optional[str] = None


# Initialize files on module load
init_files()


# ============ Chunked Upload Endpoints ============

@router.post("/upload/init")
async def init_chunked_upload(
    request: ChunkUploadInit,
    user: dict = Depends(get_current_user)
):
    """Initialize a chunked upload session"""
    upload_id = str(uuid.uuid4())
    
    # Create upload session directory
    upload_dir = CHUNKS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Save upload metadata
    metadata = {
        "upload_id": upload_id,
        "filename": request.filename,
        "file_size": request.file_size,
        "total_chunks": request.total_chunks,
        "folder_id": request.folder_id,
        "uploaded_chunks": [],
        "status": "in_progress",
        "created_at": datetime.now().isoformat()
    }
    
    with open(upload_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    return {
        "success": True,
        "data": {
            "upload_id": upload_id,
            "chunk_size": CHUNK_SIZE
        }
    }


@router.post("/upload/chunk/{upload_id}")
async def upload_chunk(
    upload_id: str,
    chunk_index: int = Form(...),
    chunk: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    """Upload a single chunk"""
    upload_dir = CHUNKS_DIR / upload_id
    
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    # Read metadata
    with open(upload_dir / "metadata.json", "r") as f:
        metadata = json.load(f)
    
    if metadata["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Upload already completed or cancelled")
    
    # Save chunk
    chunk_data = await chunk.read()
    chunk_path = upload_dir / f"chunk_{chunk_index}"
    with open(chunk_path, "wb") as f:
        f.write(chunk_data)
    
    # Update metadata
    if chunk_index not in metadata["uploaded_chunks"]:
        metadata["uploaded_chunks"].append(chunk_index)
    
    with open(upload_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)
    
    return {
        "success": True,
        "data": {
            "chunk_index": chunk_index,
            "uploaded_chunks": len(metadata["uploaded_chunks"]),
            "total_chunks": metadata["total_chunks"]
        }
    }


@router.post("/upload/complete/{upload_id}")
async def complete_chunked_upload(
    upload_id: str,
    user: dict = Depends(get_current_user)
):
    """Complete chunked upload - merge chunks into final file"""
    upload_dir = CHUNKS_DIR / upload_id
    
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    # Read metadata
    with open(upload_dir / "metadata.json", "r") as f:
        metadata = json.load(f)
    
    # Verify all chunks received
    if len(metadata["uploaded_chunks"]) != metadata["total_chunks"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Missing chunks. Got {len(metadata['uploaded_chunks'])}, expected {metadata['total_chunks']}"
        )
    
    # Create file record
    record = create_file_record(
        filename=metadata["filename"],
        original_filename=metadata["filename"],
        file_size=metadata["file_size"],
        parent_folder_id=metadata["folder_id"],
        is_folder=False
    )
    
    # Save file directly in files/ folder (no subfolder)
    file_path = FILES_DIR / record["filename"]
    
    # Merge chunks
    with open(file_path, "wb") as outfile:
        for i in range(metadata["total_chunks"]):
            chunk_path = upload_dir / f"chunk_{i}"
            with open(chunk_path, "rb") as chunk_file:
                outfile.write(chunk_file.read())
    
    # Generate thumbnail for supported images
    ext = metadata["filename"].rsplit(".", 1)[-1].lower() if "." in metadata["filename"] else ""
    if record["file_type"] == "image" and ext in THUMBNAIL_SUPPORTED:
        try:
            thumb_path = generate_image_thumbnail(file_path, record["id"])
            if thumb_path:
                update_file(record["id"], {"thumbnail_path": thumb_path})
                record["thumbnail_path"] = thumb_path
        except Exception:
            pass  # Thumbnail generation failed, continue without it
    
    # Cleanup chunks
    shutil.rmtree(upload_dir)
    
    return {
        "success": True,
        "message": "Upload completed",
        "data": record
    }


@router.get("/upload/status/{upload_id}")
async def get_upload_status(
    upload_id: str,
    user: dict = Depends(get_current_user)
):
    """Get chunked upload status (for resume)"""
    upload_dir = CHUNKS_DIR / upload_id
    
    if not upload_dir.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    with open(upload_dir / "metadata.json", "r") as f:
        metadata = json.load(f)
    
    return {
        "success": True,
        "data": {
            "upload_id": upload_id,
            "filename": metadata["filename"],
            "uploaded_chunks": sorted(metadata["uploaded_chunks"]),
            "total_chunks": metadata["total_chunks"],
            "status": metadata["status"]
        }
    }


@router.delete("/upload/cancel/{upload_id}")
async def cancel_chunked_upload(
    upload_id: str,
    user: dict = Depends(get_current_user)
):
    """Cancel and cleanup chunked upload"""
    upload_dir = CHUNKS_DIR / upload_id
    
    if upload_dir.exists():
        shutil.rmtree(upload_dir)
    
    return {"success": True, "message": "Upload cancelled"}


# ============ Standard Upload (for smaller files) ============

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    user: dict = Depends(get_current_user)
):
    """Upload a file (no size limit)"""
    # Read file contents
    contents = await file.read()
    file_size = len(contents)
    
    # Create file record (no extension restrictions!)
    record = create_file_record(
        filename=file.filename,
        original_filename=file.filename,
        file_size=file_size,
        parent_folder_id=folder_id,
        is_folder=False
    )
    
    # Save file directly in files/ folder (no subfolder)
    file_path = FILES_DIR / record["filename"]
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Generate thumbnail ONLY for supported image formats
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if record["file_type"] == "image" and ext in THUMBNAIL_SUPPORTED:
        try:
            thumb_path = generate_image_thumbnail(file_path, record["id"])
            if thumb_path:
                update_file(record["id"], {"thumbnail_path": thumb_path})
                record["thumbnail_path"] = thumb_path
        except Exception:
            pass  # Thumbnail failed, continue without it
    
    return {
        "success": True,
        "message": "File uploaded successfully",
        "data": record
    }


@router.post("/folder")
async def create_folder(
    request: CreateFolderRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new folder"""
    record = create_file_record(
        filename=request.name,
        original_filename=request.name,
        file_size=0,
        parent_folder_id=request.parent_id,
        is_folder=True
    )
    
    return {
        "success": True,
        "message": "Folder created successfully",
        "data": record
    }


@router.get("")
async def list_files(
    folder_id: Optional[str] = None,
    search: Optional[str] = None,
    type: Optional[str] = None,
    sort: str = "name",
    order: str = "asc",
    user: dict = Depends(get_current_user)
):
    """List files in a folder"""
    if search:
        files = search_files(search)
    else:
        files = get_files_in_folder(folder_id)
    
    # Filter by type
    if type:
        files = [f for f in files if f["file_type"] == type]
    
    # Sort
    if sort == "name":
        files.sort(key=lambda x: x["original_filename"].lower(), reverse=(order == "desc"))
    elif sort == "date":
        files.sort(key=lambda x: x["modified_at"], reverse=(order == "desc"))
    elif sort == "size":
        files.sort(key=lambda x: x["file_size"] or 0, reverse=(order == "desc"))
    elif sort == "type":
        files.sort(key=lambda x: x["file_type"], reverse=(order == "desc"))
    
    # Add item count for folders
    items = []
    for f in files:
        item = f.copy()
        if f["is_folder"]:
            item["item_count"] = get_folder_item_count(f["id"])
        items.append(item)
    
    # Get current folder info and breadcrumb
    current_folder = None
    if folder_id:
        current_folder = get_file_by_id(folder_id)
    
    return {
        "success": True,
        "data": {
            "items": items,
            "current_folder": {
                "id": folder_id,
                "name": current_folder["original_filename"] if current_folder else "My Files",
                "path": "/" if not folder_id else None
            },
            "breadcrumb": get_breadcrumb(folder_id)
        }
    }


@router.get("/{file_id}")
async def get_file_info(
    file_id: str,
    user: dict = Depends(get_current_user)
):
    """Get file details"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    return {
        "success": True,
        "data": file
    }


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    range: Optional[str] = Header(None)
):
    """Download a file with resume support (public for local use)"""
    file = get_file_by_id(file_id)
    
    if not file or file["is_folder"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    file_path = FILES_DIR.parent / file["file_path"]
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    file_size = file_path.stat().st_size
    
    # Handle range requests for resume support
    if range:
        try:
            range_start, range_end = range.replace("bytes=", "").split("-")
            range_start = int(range_start) if range_start else 0
            range_end = int(range_end) if range_end else file_size - 1
            
            if range_start >= file_size:
                raise HTTPException(status_code=416, detail="Range not satisfiable")
            
            content_length = range_end - range_start + 1
            
            def iter_file():
                with open(file_path, "rb") as f:
                    f.seek(range_start)
                    remaining = content_length
                    while remaining > 0:
                        chunk_size = min(8192, remaining)
                        data = f.read(chunk_size)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data
            
            headers = {
                "Content-Range": f"bytes {range_start}-{range_end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Disposition": f'attachment; filename="{file["original_filename"]}"'
            }
            
            return StreamingResponse(
                iter_file(),
                status_code=206,
                headers=headers,
                media_type=file["mime_type"]
            )
        except ValueError:
            pass  # Invalid range, fall through to normal download
    
    # Normal full file download
    return FileResponse(
        path=file_path,
        filename=file["original_filename"],
        media_type=file["mime_type"],
        headers={"Accept-Ranges": "bytes"}
    )


@router.get("/{file_id}/preview")
async def preview_file(file_id: str):
    """Get file for preview (public for local use)"""
    file = get_file_by_id(file_id)
    
    if not file or file["is_folder"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    file_path = FILES_DIR.parent / file["file_path"]
    
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on disk"
        )
    
    return FileResponse(
        path=file_path,
        media_type=file["mime_type"]
    )


@router.get("/{file_id}/thumbnail")
async def get_thumbnail(
    file_id: str,
    user: dict = Depends(get_current_user)
):
    """Get file thumbnail"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    if not file["thumbnail_path"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No thumbnail available"
        )
    
    from ..config import THUMBNAILS_DIR
    thumb_path = FILES_DIR.parent.parent / file["thumbnail_path"]
    
    if not thumb_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnail not found on disk"
        )
    
    return FileResponse(
        path=thumb_path,
        media_type="image/jpeg"
    )


@router.put("/{file_id}/rename")
async def rename_file(
    file_id: str,
    request: RenameRequest,
    user: dict = Depends(get_current_user)
):
    """Rename a file or folder (only updates display name, not physical file)"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Only update the original_filename (display name)
    # Physical file stays as {id}.{ext} for consistency
    updated = update_file(file_id, {
        "original_filename": request.new_name
    })
    
    return {
        "success": True,
        "message": "Renamed successfully",
        "data": updated
    }


@router.put("/{file_id}/move")
async def move_file(
    file_id: str,
    request: MoveRequest,
    user: dict = Depends(get_current_user)
):
    """Move file to another folder"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Update parent folder
    updated = update_file(file_id, {
        "parent_folder_id": request.destination_folder_id
    })
    
    return {
        "success": True,
        "message": "Moved successfully",
        "data": updated
    }


@router.post("/{file_id}/copy")
async def copy_file(
    file_id: str,
    request: MoveRequest,  # Reuse MoveRequest for simplicity (destination_folder_id)
    user: dict = Depends(get_current_user)
):
    """Copy file to another folder"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    # Generate new filename "Copy of ..."
    new_filename = f"Copy of {file['original_filename']}"
    
    # Create new file record
    new_record = create_file_record(
        filename=new_filename,
        original_filename=new_filename,
        file_size=file['file_size'],
        parent_folder_id=request.destination_folder_id,
        is_folder=file['is_folder']
    )
    
    # If it's a file, copy physical file
    if not file['is_folder']:
        src_path = FILES_DIR / file['filename'] # Physical file uses internal filename
        dst_path = FILES_DIR / new_record['filename']
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            
        # Copy thumbnail if exists
        if file.get('thumbnail_path'):
             # Logic to copy thumbnail would go here (skip for simplicity now)
             pass

    # TODO: Directory copy logic is complex (recursive), skipping for this iteration
    # For now, only files or empty folders
    
    return {
        "success": True,
        "message": "Copied successfully",
        "data": new_record
    }


@router.delete("/{file_id}")
async def delete_file(
    file_id: str,
    permanent: bool = False,
    user: dict = Depends(get_current_user)
):
    """Delete file (move to trash or permanent)"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    if permanent or file["is_deleted"]:
        # Permanent delete
        delete_file_record(file_id)
        return {
            "success": True,
            "message": "File permanently deleted"
        }
    else:
        # Move to trash
        update_file(file_id, {
            "is_deleted": True,
            "deleted_at": datetime.now().isoformat()
        })
        return {
            "success": True,
            "message": "File moved to trash"
        }


@router.post("/{file_id}/restore")
async def restore_file(
    file_id: str,
    user: dict = Depends(get_current_user)
):
    """Restore file from trash"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    updated = update_file(file_id, {
        "is_deleted": False,
        "deleted_at": None
    })
    
    return {
        "success": True,
        "message": "File restored",
        "data": updated
    }


@router.post("/{file_id}/favorite")
async def toggle_favorite(
    file_id: str,
    user: dict = Depends(get_current_user)
):
    """Toggle favorite status"""
    file = get_file_by_id(file_id)
    
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    
    new_status = not file["is_favorite"]
    updated = update_file(file_id, {"is_favorite": new_status})
    
    return {
        "success": True,
        "message": "Added to favorites" if new_status else "Removed from favorites",
        "data": {"is_favorite": new_status}
    }


# Trash routes
@router.get("/trash/list")
async def list_trash(user: dict = Depends(get_current_user)):
    """List files in trash"""
    files = get_deleted_files()
    return {
        "success": True,
        "data": files
    }


@router.delete("/trash/empty")
async def empty_trash(user: dict = Depends(get_current_user)):
    """Permanently delete all files in trash"""
    deleted_files = get_deleted_files()
    deleted_count = 0
    
    for file in deleted_files:
        try:
            # delete_file_record handles both physical file and record deletion
            if delete_file_record(file["id"]):
                deleted_count += 1
        except Exception as e:
            print(f"Error deleting file {file['id']}: {e}")
    
    return {
        "success": True,
        "message": f"Deleted {deleted_count} files permanently"
    }


# Favorites route
@router.get("/favorites/list")
async def list_favorites(user: dict = Depends(get_current_user)):
    """List favorite files"""
    files = get_favorite_files()
    return {
        "success": True,
        "data": files
    }
