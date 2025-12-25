from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from .config import APP_NAME, BASE_DIR
from .auth import init_users
from .services.file_service import init_files
from .routes import auth_routes, files_routes, storage_routes

# Create FastAPI app
app = FastAPI(
    title=f"{APP_NAME} API",
    description="Local File Manager API - No Database",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local use
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router)
app.include_router(files_routes.router)
app.include_router(storage_routes.router)

# Static files directory
STATIC_DIR = BASE_DIR.parent / "static"

# Mount storage for thumbnail access
STORAGE_DIR = BASE_DIR / "storage"
if STORAGE_DIR.exists():
    app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")


@app.on_event("startup")
async def startup_event():
    """Initialize data on startup"""
    init_users()
    init_files()
    print(f"\n{'='*50}")
    print(f"  {APP_NAME} Backend Started!")
    print(f"  API Docs: http://localhost:8000/docs")
    print(f"  Default Login: admin / admin123")
    print(f"{'='*50}\n")


# Serve static files with proper paths
@app.get("/")
async def root():
    """Root endpoint - serve index.html"""
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": f"Welcome to {APP_NAME} API", "docs": "/docs"}


@app.get("/index.html")
async def serve_index():
    """Serve index.html"""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/css/{filename:path}")
async def serve_css(filename: str):
    """Serve CSS files"""
    file_path = STATIC_DIR / "css" / filename
    if file_path.exists():
        return FileResponse(file_path, media_type="text/css")
    return {"error": "Not found"}, 404


@app.get("/js/{filename:path}")
async def serve_js(filename: str):
    """Serve JS files"""
    file_path = STATIC_DIR / "js" / filename
    if file_path.exists():
        return FileResponse(file_path, media_type="application/javascript")
    return {"error": "Not found"}, 404


@app.get("/favicon.ico")
async def favicon():
    """Serve favicon (optional)"""
    favicon_path = STATIC_DIR / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(favicon_path)
    # Return empty response if no favicon
    return Response(status_code=204)


# Also keep /static mount for backward compatibility
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/api")
async def api_info():
    """API info endpoint"""
    return {
        "name": APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "auth": "/api/auth",
            "files": "/api/files",
            "storage": "/api/storage"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
