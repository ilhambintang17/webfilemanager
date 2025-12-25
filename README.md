# CloudDrive - Local File Manager

A lightweight, self-hosted file manager with a modern web interface. Built with FastAPI backend and vanilla JavaScript frontend. Perfect for running on low-resource devices like old phones or Raspberry Pi.

![CloudDrive Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![Python](https://img.shields.io/badge/Python-3.8+-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

### File Management
- 📁 **Folder Organization** - Create, rename, and navigate folders
- 📤 **Unlimited File Upload** - No file size limits, supports all formats
- 📥 **Resumable Downloads** - Pause and resume large downloads
- 🔍 **Search** - Quick file search across all folders
- ⭐ **Favorites** - Mark files for quick access
- 🗑️ **Trash** - Soft delete with restore capability

### File Preview
- 🖼️ **Images** - Full preview with zoom and metadata
- 🎬 **Videos** - Custom player with speed control, skip, volume
- 🎵 **Audio** - Same advanced player for audio files
- 📄 **PDF** - Embedded PDF viewer
- 📝 **DOCX** - Word document preview (using mammoth.js)
- 📑 **Text/Markdown** - Plain text file viewing

### Media Player Controls
- ▶️ Play/Pause
- ⏪ Skip back 10 seconds
- ⏩ Skip forward 10 seconds
- 🔊 Volume control with mute
- ⚡ Playback speed (0.25x - 2x)
- 🖥️ Fullscreen mode
- 📊 Progress bar with seeking

### Storage
- 💾 **Flexible Quota** - Set custom storage limit or use all disk space
- 📊 **Usage Stats** - Visual breakdown by file type
- 🚀 **Efficient Storage** - Flat file structure, smart thumbnails

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/webfilemanager.git
cd webfilemanager
```

2. **Setup virtual environment**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Run the server**
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

5. **Open in browser**
```
http://localhost:8000
```

### Default Login
- **Username:** `admin`
- **Password:** `admin123`

## ⚙️ Configuration

Edit `backend/app/config.py` to customize:

```python
# Storage allocation options:
STORAGE_ALLOCATION = "all"      # Use all available disk space
STORAGE_ALLOCATION = "100GB"    # Limit to 100 gigabytes
STORAGE_ALLOCATION = "500MB"    # Limit to 500 megabytes

# Thumbnail settings
THUMBNAIL_SIZE = (300, 300)     # Max thumbnail dimensions
THUMBNAIL_SUPPORTED = ["jpg", "jpeg", "png", "gif", "webp", "bmp"]

# Chunked upload (for large files)
CHUNK_SIZE = 5 * 1024 * 1024    # 5MB chunks
```

## 📁 Project Structure

```
webfilemanager/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry
│   │   ├── config.py         # Configuration
│   │   ├── auth.py           # Authentication
│   │   ├── routes/
│   │   │   ├── auth_routes.py
│   │   │   ├── files_routes.py
│   │   │   └── storage_routes.py
│   │   └── services/
│   │       ├── file_service.py
│   │       └── thumbnail_service.py
│   ├── data/
│   │   ├── users.json        # User accounts
│   │   └── files.json        # File metadata
│   ├── storage/
│   │   ├── files/            # Uploaded files
│   │   ├── thumbnails/       # Generated thumbnails
│   │   └── chunks/           # Temporary upload chunks
│   └── requirements.txt
├── static/
│   ├── index.html            # Main application
│   ├── css/styles.css        # Custom styles
│   └── js/app.js             # Application logic
└── README.md
```

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with credentials |
| POST | `/api/auth/logout` | Logout current user |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/files` | List files in folder |
| POST | `/api/files/upload` | Upload a file |
| POST | `/api/files/folder` | Create new folder |
| GET | `/api/files/{id}` | Get file info |
| GET | `/api/files/{id}/download` | Download file |
| GET | `/api/files/{id}/preview` | Preview file |
| PUT | `/api/files/{id}/rename` | Rename file |
| DELETE | `/api/files/{id}` | Delete file |
| POST | `/api/files/{id}/favorite` | Toggle favorite |
| POST | `/api/files/{id}/restore` | Restore from trash |

### Chunked Upload (Large Files)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/files/upload/init` | Initialize upload session |
| POST | `/api/files/upload/chunk/{id}` | Upload a chunk |
| POST | `/api/files/upload/complete/{id}` | Complete upload |
| GET | `/api/files/upload/status/{id}` | Get upload progress |
| DELETE | `/api/files/upload/cancel/{id}` | Cancel upload |

### Storage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/storage/quota` | Get storage usage |
| GET | `/api/storage/analysis` | Detailed breakdown |

## 🛡️ Security Notes

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Preview/download endpoints are public (for local use)
- For production deployment, consider:
  - Changing the SECRET_KEY
  - Enabling HTTPS
  - Implementing signed URLs for file access

## 📱 Mobile Friendly

The interface is fully responsive and works great on mobile devices. Perfect for accessing your files from any device on your local network.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) - DOCX to HTML converter
- [Material Symbols](https://fonts.google.com/icons) - Google's icon library
