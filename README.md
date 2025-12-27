# CloudDrive - Local Web File Manager

CloudDrive is a lightweight, database-free web-based file manager designed for low-resource environments and legacy devices. It runs locally using Python's FastAPI framework and stores data directly on the filesystem using JSON for metadata persistence.

![CloudDrive Preview](preview.png)

## Key Features

*   **No Database Required**: Uses a flat-file JSON storage system for users and file metadata, making it easy to deploy and backup.
*   **Lightweight Backend**: Built with FastAPI for high performance and minimal resource usage.
*   **Modern Frontend**: Responsive web interface with support for Grid and List views. **Includes Dark Mode support.**
*   **File Management**:
    *   Upload, download, rename, and delete files/folders.
    *   **Drag & Drop** uploads supported.
    *   **Cut, Copy, & Paste** functionality for organizing files efficiently.
    *   **Trash Management** with Restore and Permanent Delete options.
*   **Preview Support**: Built-in previews for Images, Videos, PDFs, and Code/Text files.
*   **Favorites & Search**: Quickly access important files and search across your storage.
*   **Responsive Mobile Design**: Optimized for mobile devices with hamburger menu and touch-friendly controls.
*   **Authentication**: Secure JWT-based login system.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10, macOS 10.14, Ubuntu 18.04 | Any modern OS |
| **Python** | 3.8+ | 3.10+ |
| **RAM** | 512 MB | 1 GB+ |
| **Disk Space** | 100 MB + storage | As needed |
| **Browser** | Chrome 80+, Firefox 75+, Safari 13+ | Latest version |

## Project Structure

```
webfilemanager/
├── backend/                # Backend application code
│   ├── app/
│   │   ├── routes/         # API endpoints (Auth, Files, Storage)
│   │   ├── services/       # Business logic
│   │   └── data/           # JSON data storage (users.json, files.json)
│   ├── storage/            # Physical file storage directory
│   └── requirements.txt    # Python dependencies
└── static/                 # Frontend assets
    ├── index.html          # Main application interface
    ├── css/                # Stylesheets
    └── js/                 # Javascript modules
```

## Installation & Setup

### Prerequisites

*   **Python 3.8 or higher** - [Download Python](https://www.python.org/downloads/)
*   **pip** - Python package manager (included with Python)
*   **Git** - For cloning the repository (optional)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/ilhambintang17/webfilemanager.git
cd webfilemanager
```

Or download the ZIP file from GitHub and extract it.

---

#### 2. Set Up Python Virtual Environment (Recommended)

Using a virtual environment keeps your system clean and avoids dependency conflicts.

**Linux/macOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

You should see `(venv)` in your terminal prompt when activated.

---

#### 3. Install Dependencies

With the virtual environment activated:

```bash
pip install -r requirements.txt
```

**Required packages** (installed automatically):
| Package | Version | Description |
|---------|---------|-------------|
| fastapi | 0.104.1 | Web framework |
| uvicorn | 0.24.0 | ASGI server |
| python-multipart | 0.0.6 | File upload support |
| python-jose | 3.3.0 | JWT authentication |
| passlib | 1.7.4 | Password hashing |
| bcrypt | - | Bcrypt support for passlib |
| Pillow | 10.1.0 | Image processing |
| aiofiles | 23.2.1 | Async file operations |

---

#### 4. Run the Application

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Options:**
- `--host 0.0.0.0`: Allow access from other devices on network
- `--port 8000`: Port number (change if needed)
- `--reload`: Auto-restart on code changes (development mode)

---

#### 5. Access the Application

Open your web browser and navigate to:
```
http://localhost:8000
```

**Default Credentials:**
| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **Important**: Change the default password after first login for security!

---

### Alternative: Install Without Virtual Environment

If you prefer to install system-wide (not recommended):

```bash
cd backend
pip install -r requirements.txt --break-system-packages
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Usage Guide

*   **File Actions**: Right-click any file or folder to access the context menu (Open, Preview, Copy, Cut, Delete, etc.).
*   **Trash**: Deleted files are moved to the Trash. You can restore them or permanently delete them from the Trash view.
*   **Favorites**: Mark frequently used files as favorites for quick access.
*   **Storage Quota**: Monitor your storage usage directly from the sidebar.
*   **Dark Mode**: Toggle dark mode using the moon/sun icon in the header.
*   **Mobile**: On mobile devices, use the hamburger menu to access navigation.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ModuleNotFoundError: No module named 'uvicorn'` | Activate venv or install dependencies |
| Port 8000 already in use | Use `--port 8001` or different port |
| `externally-managed-environment` error | Use virtual environment or `--break-system-packages` |
| Can't access from other devices | Use `--host 0.0.0.0` and check firewall |

## Development

The backend is powered by **FastAPI** and runs on **Uvicorn**. The frontend utilizes vanilla **JavaScript (ES6 Modules)** and **Tailwind CSS** for styling, requiring no complex build steps.

## License

This project is open-source and available for personal or educational use.
