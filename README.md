# CloudDrive - Local Web File Manager

CloudDrive is a lightweight, database-free web-based file manager designed for low-resource environments and legacy devices. It runs locally using Python's FastAPI framework and stores data directly on the filesystem using JSON for metadata persistence.

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

*   Python 3.8 or higher
*   Git (optional, for cloning)

### Quick Start

1.  **Clone the repository**
    ```bash
    git clone https://github.com/ilhambintang17/webfilemanager.git
    cd webfilemanager
    ```

2.  **Set up the backend**
    Navigate to the backend directory and install dependencies:
    ```bash
    cd backend
    pip install -r requirements.txt
    ```

3.  **Run the application**
    Start the server using Uvicorn:
    ```bash
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

4.  **Access the application**
    Open your web browser and navigate to:
    `http://localhost:8000`

    **Default Credentials:**
    *   **Username:** `admin`
    *   **Password:** `admin123`

## Usage Guide

*   **File Actions**: Right-click any file or folder to access the context menu (Open, Preview, Copy, Cut, Delete, etc.).
*   **Trash**: Deleted files are moved to the Trash. You can restore them or permanently delete them from the Trash view.
*   **Favorites**: Mark frequently used files as favorites for quick access.
*   **Storage Quota**: Monitor your storage usage directly from the sidebar.

## Development

The backend is powered by **FastAPI** and runs on **Uvicorn**. The frontend utilizes vanilla **JavaScript (ES6 Modules)** and **Tailwind CSS** for styling, requiring no complex build steps.

## License

This project is open-source and available for personal or educational use.
