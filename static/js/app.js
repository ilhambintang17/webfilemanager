/**
 * CloudDrive - Main Application JavaScript
 * File Manager with Chunked Upload & Resume Support
 */

// ============ STATE ============
const API_URL = '';
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
let token = localStorage.getItem('token');
let currentFolder = null;
let currentFile = null;
let contextFile = null;
let viewMode = 'grid';
let currentView = 'files';

// Upload state for pause/resume
let activeUploads = new Map(); // uploadId -> { file, paused, controller }

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showDashboard();
        loadFiles(null);
        loadStorageInfo();
    } else {
        showLogin();
    }

    document.addEventListener('click', () => {
        document.getElementById('context-menu').classList.add('hidden');
    });

    document.getElementById('login-form').addEventListener('submit', handleLogin);
});

// ============ AUTH ============
function showLogin() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('flex');
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            token = data.data.token;
            localStorage.setItem('token', token);
            showDashboard();
            loadFiles(null);
            loadStorageInfo();
        } else {
            showLoginError(data.detail || 'Login failed');
        }
    } catch (err) {
        showLoginError('Connection error');
    }
}

function logout() {
    localStorage.removeItem('token');
    token = null;
    showLogin();
}

function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}

// ============ NAVIGATION ============
function setActiveNav(el) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active', 'bg-primary/10', 'text-primary', 'font-medium');
        link.classList.add('text-slate-600', 'dark:text-slate-400');
    });
    el.classList.add('active', 'bg-primary/10', 'text-primary', 'font-medium');
    el.classList.remove('text-slate-600', 'dark:text-slate-400');
}

// ============ FILE LOADING ============
async function loadFiles(folderId) {
    currentFolder = folderId;
    currentView = 'files';
    showLoading();

    const url = folderId ? `${API_URL}/api/files?folder_id=${folderId}` : `${API_URL}/api/files`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            renderFiles(data.data.items);
            renderBreadcrumb(data.data.breadcrumb);
        }
    } catch (err) {
        console.error('Error loading files:', err);
    }
    hideLoading();
}

async function loadFavorites() {
    currentView = 'favorites';
    showLoading();
    try {
        const res = await fetch(`${API_URL}/api/files/favorites/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderFiles(data.data);
            document.getElementById('breadcrumb').innerHTML = '<span class="font-semibold text-slate-900 dark:text-white">⭐ Favorites</span>';
        }
    } catch (err) {
        console.error('Error:', err);
    }
    hideLoading();
}

async function loadTrash() {
    currentView = 'trash';
    showLoading();
    try {
        const res = await fetch(`${API_URL}/api/files/trash/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderFiles(data.data, true);
            document.getElementById('breadcrumb').innerHTML = '<span class="font-semibold text-slate-900 dark:text-white">🗑️ Trash</span>';
        }
    } catch (err) {
        console.error('Error:', err);
    }
    hideLoading();
}

async function loadRecent() {
    currentView = 'recent';
    showLoading();
    try {
        const res = await fetch(`${API_URL}/api/files`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            const sorted = data.data.items.filter(f => !f.is_folder).sort((a, b) =>
                new Date(b.modified_at) - new Date(a.modified_at)
            ).slice(0, 20);
            renderFiles(sorted);
            document.getElementById('breadcrumb').innerHTML = '<span class="font-semibold text-slate-900 dark:text-white">🕒 Recent</span>';
        }
    } catch (err) {
        console.error('Error:', err);
    }
    hideLoading();
}

function showLoading() {
    document.getElementById('files-grid').classList.add('hidden');
    document.getElementById('files-list').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('loading-state').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('flex');
}

// ============ RENDER FILES ============
function renderFiles(files, isTrash = false) {
    const grid = document.getElementById('files-grid');
    const list = document.getElementById('files-list');
    const empty = document.getElementById('empty-state');

    if (!files || files.length === 0) {
        grid.classList.add('hidden');
        list.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.classList.add('flex');
        return;
    }

    empty.classList.add('hidden');
    empty.classList.remove('flex');

    if (viewMode === 'grid') {
        grid.classList.remove('hidden');
        list.classList.add('hidden');
        grid.innerHTML = files.map(f => renderFileCard(f, isTrash)).join('');
    } else {
        grid.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = files.map(f => renderFileRow(f, isTrash)).join('');
    }
}

function renderFileCard(file, isTrash) {
    const icon = getFileIcon(file);

    if (file.is_folder) {
        return `
        <div onclick="loadFiles('${file.id}')" oncontextmenu="showContextMenu(event, '${file.id}')" 
             class="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all select-none">
            <div class="flex items-start justify-between mb-3">
                <span class="material-symbols-outlined text-4xl text-primary icon-fill">folder</span>
                <button onclick="event.stopPropagation(); showContextMenu(event, '${file.id}')" class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
            <h3 class="font-medium text-slate-900 dark:text-white truncate">${file.original_filename}</h3>
            <p class="text-xs text-slate-500 mt-1">${file.item_count || 0} items</p>
        </div>`;
    } else {
        const thumbStyle = file.thumbnail_path ?
            `background-image: url('${API_URL}/${file.thumbnail_path}'); background-size: cover; background-position: center;` : '';
        const thumbContent = file.thumbnail_path ? '' :
            `<span class="material-symbols-outlined text-5xl ${icon.color}">${icon.icon}</span>`;

        return `
        <div onclick="previewFile('${file.id}')" oncontextmenu="showContextMenu(event, '${file.id}')"
             class="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/50 transition-all">
            <div class="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden" style="${thumbStyle}">
                ${thumbContent}
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                    <button onclick="event.stopPropagation(); previewFile('${file.id}')" class="p-2 bg-white/90 rounded-full hover:bg-white text-slate-800 shadow-lg" title="Preview">
                        <span class="material-symbols-outlined text-lg">visibility</span>
                    </button>
                    <button onclick="event.stopPropagation(); downloadFile('${file.id}')" class="p-2 bg-white/90 rounded-full hover:bg-white text-slate-800 shadow-lg" title="Download">
                        <span class="material-symbols-outlined text-lg">download</span>
                    </button>
                </div>
            </div>
            <div class="p-3">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined ${icon.color} text-xl">${icon.icon}</span>
                    <h3 class="font-medium text-sm text-slate-900 dark:text-white truncate flex-1">${file.original_filename}</h3>
                    ${file.is_favorite ? '<span class="material-symbols-outlined text-yellow-500 text-sm icon-fill">star</span>' : ''}
                </div>
                <div class="flex justify-between items-center mt-2 text-xs text-slate-400">
                    <span>${formatSize(file.file_size)}</span>
                    <span>${formatDate(file.modified_at)}</span>
                </div>
            </div>
        </div>`;
    }
}

function renderFileRow(file, isTrash) {
    const icon = getFileIcon(file);
    return `
    <div onclick="${file.is_folder ? `loadFiles('${file.id}')` : `previewFile('${file.id}')`}" 
         oncontextmenu="showContextMenu(event, '${file.id}')"
         class="group/row flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border border-slate-100 dark:border-slate-700">
        <div class="w-10 h-10 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl ${icon.color} ${file.is_folder ? 'icon-fill' : ''}">${icon.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
                <h3 class="font-medium text-slate-900 dark:text-white truncate">${file.original_filename}</h3>
                ${file.is_favorite ? '<span class="material-symbols-outlined text-yellow-500 text-sm icon-fill">star</span>' : ''}
            </div>
            <p class="text-xs text-slate-500">${file.is_folder ? (file.item_count || 0) + ' items' : formatSize(file.file_size)}</p>
        </div>
        <div class="text-xs text-slate-400 hidden sm:block w-32">${formatDate(file.modified_at)}</div>
        <div class="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            ${!file.is_folder ? `
            <button onclick="event.stopPropagation(); downloadFile('${file.id}')" class="p-2 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600">
                <span class="material-symbols-outlined text-lg">download</span>
            </button>` : ''}
            <button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    </div>`;
}

function getFileIcon(file) {
    if (file.is_folder) return { icon: 'folder', color: 'text-primary' };
    switch (file.file_type) {
        case 'image': return { icon: 'image', color: 'text-purple-500' };
        case 'video': return { icon: 'movie', color: 'text-red-500' };
        case 'audio': return { icon: 'music_note', color: 'text-pink-500' };
        case 'document':
            if (file.original_filename?.endsWith('.pdf')) return { icon: 'picture_as_pdf', color: 'text-red-500' };
            return { icon: 'description', color: 'text-blue-500' };
        case 'archive': return { icon: 'folder_zip', color: 'text-yellow-600' };
        case 'code': return { icon: 'code', color: 'text-green-500' };
        default: return { icon: 'insert_drive_file', color: 'text-slate-400' };
    }
}

function renderBreadcrumb(breadcrumb) {
    const el = document.getElementById('breadcrumb');
    el.innerHTML = breadcrumb.map((item, i) => {
        if (i === breadcrumb.length - 1) {
            return `<span class="font-semibold text-slate-900 dark:text-white truncate">${item.name}</span>`;
        }
        return `<a href="#" onclick="loadFiles(${item.id ? `'${item.id}'` : 'null'})" class="hover:text-primary transition-colors">${item.name}</a>
        <span class="material-symbols-outlined text-lg mx-1 text-slate-400">chevron_right</span>`;
    }).join('');
}

// ============ FILE PREVIEW ============
async function previewFile(fileId) {
    try {
        const res = await fetch(`${API_URL}/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const file = data.data;
            currentFile = file;

            if (file.file_type === 'image') {
                showImagePreview(file);
            } else if (file.file_type === 'video') {
                showVideoPreview(file);
            } else if (file.file_type === 'audio') {
                showAudioPreview(file);
            } else {
                showDocPreview(file);
            }
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to load file');
    }
}

function showImagePreview(file) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');

    img.src = `${API_URL}/api/files/${file.id}/preview`;
    img.alt = file.original_filename;

    document.getElementById('preview-filename').textContent = file.original_filename;
    document.getElementById('preview-filesize').textContent = formatSize(file.file_size);
    document.getElementById('preview-fav-icon').textContent = file.is_favorite ? 'star' : 'star_border';
    document.getElementById('preview-fav-icon').classList.toggle('icon-fill', file.is_favorite);
    document.getElementById('preview-fav-icon').classList.toggle('text-yellow-500', file.is_favorite);

    const metaHtml = `
        <div class="text-gray-500 dark:text-gray-400">Format</div>
        <div class="text-gray-900 dark:text-gray-200 font-medium">${file.mime_type || 'Image'}</div>
        <div class="text-gray-500 dark:text-gray-400">Size</div>
        <div class="text-gray-900 dark:text-gray-200 font-medium">${formatSize(file.file_size)}</div>
        <div class="text-gray-500 dark:text-gray-400">Created</div>
        <div class="text-gray-900 dark:text-gray-200 font-medium">${formatDate(file.created_at)}</div>
        <div class="text-gray-500 dark:text-gray-400">Modified</div>
        <div class="text-gray-900 dark:text-gray-200 font-medium">${formatDate(file.modified_at)}</div>
    `;
    document.getElementById('preview-metadata').innerHTML = metaHtml;
    document.getElementById('preview-thumb-container').innerHTML =
        `<img src="${API_URL}/api/files/${file.id}/preview" class="w-full h-full object-cover" alt="thumbnail"/>`;

    modal.classList.remove('hidden');
}

function showVideoPreview(file) {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');

    video.src = `${API_URL}/api/files/${file.id}/preview`;
    document.getElementById('video-filename').textContent = file.original_filename;
    document.getElementById('video-filepath').textContent = formatSize(file.file_size);
    document.getElementById('media-type-icon').textContent = 'movie';
    document.getElementById('speed-select').value = '1';

    // Setup media event listeners
    setupMediaControls(video);

    modal.classList.remove('hidden');
}

function showAudioPreview(file) {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');

    video.src = `${API_URL}/api/files/${file.id}/preview`;
    document.getElementById('video-filename').textContent = file.original_filename;
    document.getElementById('video-filepath').textContent = formatSize(file.file_size);
    document.getElementById('media-type-icon').textContent = 'music_note';
    document.getElementById('speed-select').value = '1';

    // Setup media event listeners
    setupMediaControls(video);

    modal.classList.remove('hidden');
}

function setupMediaControls(video) {
    // Reset controls
    document.getElementById('play-pause-icon').textContent = 'play_arrow';
    document.getElementById('media-progress').value = 0;
    document.getElementById('media-current-time').textContent = '0:00';
    document.getElementById('media-duration').textContent = '0:00';
    document.getElementById('volume-slider').value = video.volume * 100;

    // Time update
    video.ontimeupdate = () => {
        const progress = (video.currentTime / video.duration) * 100;
        document.getElementById('media-progress').value = progress || 0;
        document.getElementById('media-current-time').textContent = formatTime(video.currentTime);
    };

    // Duration loaded
    video.onloadedmetadata = () => {
        document.getElementById('media-duration').textContent = formatTime(video.duration);
    };

    // Play/pause state
    video.onplay = () => {
        document.getElementById('play-pause-icon').textContent = 'pause';
    };
    video.onpause = () => {
        document.getElementById('play-pause-icon').textContent = 'play_arrow';
    };
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function togglePlayPause() {
    const video = document.getElementById('preview-video');
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

function skipMedia(seconds) {
    const video = document.getElementById('preview-video');
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

function seekMedia(percent) {
    const video = document.getElementById('preview-video');
    if (video.duration) {
        video.currentTime = (percent / 100) * video.duration;
    }
}

function setVolume(value) {
    const video = document.getElementById('preview-video');
    video.volume = value / 100;
    const icon = document.getElementById('volume-icon');
    if (value == 0) {
        icon.textContent = 'volume_off';
    } else if (value < 50) {
        icon.textContent = 'volume_down';
    } else {
        icon.textContent = 'volume_up';
    }
}

function toggleMute() {
    const video = document.getElementById('preview-video');
    const slider = document.getElementById('volume-slider');
    if (video.volume > 0) {
        video.dataset.prevVolume = video.volume;
        video.volume = 0;
        slider.value = 0;
    } else {
        video.volume = video.dataset.prevVolume || 1;
        slider.value = video.volume * 100;
    }
    setVolume(slider.value);
}

function setPlaybackSpeed(speed) {
    const video = document.getElementById('preview-video');
    video.playbackRate = parseFloat(speed);
}

function toggleFullscreen() {
    const video = document.getElementById('preview-video');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        video.requestFullscreen();
    }
}

function showDocPreview(file) {
    const modal = document.getElementById('doc-preview-modal');
    const icon = getFileIcon(file);
    const pdfViewer = document.getElementById('pdf-viewer');
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');
    const docFallback = document.getElementById('doc-fallback');

    // Header info
    document.getElementById('doc-icon').textContent = icon.icon;
    document.getElementById('doc-filename').textContent = file.original_filename;
    document.getElementById('doc-filesize').textContent = formatSize(file.file_size);

    // Fallback info  
    document.getElementById('doc-preview-icon').textContent = icon.icon;
    document.getElementById('doc-preview-name').textContent = file.original_filename;
    document.getElementById('doc-preview-size').textContent = formatSize(file.file_size);

    // Hide all viewers first
    pdfViewer.classList.add('hidden');
    docxViewer.classList.add('hidden');
    docLoading.classList.add('hidden');
    docFallback.classList.add('hidden');

    const ext = file.original_filename?.toLowerCase().split('.').pop() || '';

    if (ext === 'pdf') {
        // Show PDF in iframe
        pdfViewer.src = `${API_URL}/api/files/${file.id}/preview`;
        pdfViewer.classList.remove('hidden');
    } else if (ext === 'docx') {
        // Load and render DOCX using mammoth.js
        docLoading.classList.remove('hidden');
        loadDocxContent(file.id);
    } else if (['pptx', 'ppsx', 'xlsx'].includes(ext)) {
        // Office files - show message
        docFallback.classList.remove('hidden');
        document.getElementById('doc-fallback-message').innerHTML =
            `PowerPoint/Excel preview coming soon.<br>
             <span class="text-xs">Download to view with your preferred app.</span>`;
    } else if (ext === 'txt' || ext === 'md') {
        // Text files - load and display
        docLoading.classList.remove('hidden');
        loadTextContent(file.id);
    } else {
        // Generic fallback
        docFallback.classList.remove('hidden');
        document.getElementById('doc-fallback-message').textContent = 'Preview not available for this file type.';
    }

    modal.classList.remove('hidden');
}

async function loadDocxContent(fileId) {
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');
    const docFallback = document.getElementById('doc-fallback');

    try {
        const response = await fetch(`${API_URL}/api/files/${fileId}/preview`);
        const arrayBuffer = await response.arrayBuffer();

        const result = await mammoth.convertToHtml({ arrayBuffer });
        docxViewer.innerHTML = result.value;
        docLoading.classList.add('hidden');
        docxViewer.classList.remove('hidden');
    } catch (err) {
        console.error('Error loading DOCX:', err);
        docLoading.classList.add('hidden');
        docFallback.classList.remove('hidden');
        document.getElementById('doc-fallback-message').textContent = 'Failed to load document.';
    }
}

async function loadTextContent(fileId) {
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');

    try {
        const response = await fetch(`${API_URL}/api/files/${fileId}/preview`);
        const text = await response.text();

        docxViewer.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(text)}</pre>`;
        docLoading.classList.add('hidden');
        docxViewer.classList.remove('hidden');
    } catch (err) {
        console.error('Error loading text:', err);
        docLoading.classList.add('hidden');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hidePreviewModal() {
    document.getElementById('image-preview-modal').classList.add('hidden');
    currentFile = null;
}

function hideVideoModal() {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');
    video.pause();
    video.src = '';
    modal.classList.add('hidden');
    currentFile = null;
}

function hideDocModal() {
    const pdfViewer = document.getElementById('pdf-viewer');
    const docxViewer = document.getElementById('docx-viewer');
    pdfViewer.src = '';
    pdfViewer.classList.add('hidden');
    docxViewer.innerHTML = '';
    docxViewer.classList.add('hidden');
    document.getElementById('doc-loading').classList.add('hidden');
    document.getElementById('doc-fallback').classList.remove('hidden');
    document.getElementById('doc-preview-modal').classList.add('hidden');
    currentFile = null;
}

function togglePreviewSidebar() {
    document.getElementById('preview-sidebar').classList.toggle('hidden');
}

// ============ DOWNLOAD WITH RESUME ============
async function downloadFile(fileId) {
    try {
        // Get file info first
        const fileRes = await fetch(`${API_URL}/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const fileData = await fileRes.json();
        if (!fileData.success) throw new Error('File not found');

        const filename = fileData.data.original_filename;

        // Simple download for small files
        const res = await fetch(`${API_URL}/api/files/${fileId}/download`);
        if (!res.ok) throw new Error('Download failed');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (err) {
        console.error('Download error:', err);
        alert('Download failed');
    }
}

function downloadCurrentFile() {
    if (currentFile) {
        downloadFile(currentFile.id);
    }
}

// ============ FILE ACTIONS ============
async function deleteFile(fileId) {
    if (!confirm('Move to trash?')) return;

    try {
        await fetch(`${API_URL}/api/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        refreshCurrentView();
        loadStorageInfo();
    } catch (err) {
        console.error('Error:', err);
    }
}

function deleteCurrentFile() {
    if (currentFile) {
        hidePreviewModal();
        hideVideoModal();
        hideDocModal();
        deleteFile(currentFile.id);
    }
}

async function toggleFavorite(fileId) {
    try {
        await fetch(`${API_URL}/api/files/${fileId}/favorite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

async function toggleFavoritePreview() {
    if (currentFile) {
        await toggleFavorite(currentFile.id);
        const res = await fetch(`${API_URL}/api/files/${currentFile.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            currentFile = data.data;
            document.getElementById('preview-fav-icon').textContent = currentFile.is_favorite ? 'star' : 'star_border';
            document.getElementById('preview-fav-icon').classList.toggle('icon-fill', currentFile.is_favorite);
            document.getElementById('preview-fav-icon').classList.toggle('text-yellow-500', currentFile.is_favorite);
        }
    }
}

function refreshCurrentView() {
    if (currentView === 'favorites') loadFavorites();
    else if (currentView === 'trash') loadTrash();
    else if (currentView === 'recent') loadRecent();
    else loadFiles(currentFolder);
}

// ============ CONTEXT MENU ============
function showContextMenu(event, fileId) {
    event.preventDefault();
    event.stopPropagation();

    contextFile = fileId;
    const menu = document.getElementById('context-menu');
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.classList.remove('hidden');

    fetch(`${API_URL}/api/files/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()).then(data => {
        if (data.success) {
            document.getElementById('ctx-fav-text').textContent =
                data.data.is_favorite ? 'Remove from Favorites' : 'Add to Favorites';
        }
    });
}

function previewContextFile() {
    if (contextFile) previewFile(contextFile);
    document.getElementById('context-menu').classList.add('hidden');
}

function downloadContextFile() {
    if (contextFile) downloadFile(contextFile);
    document.getElementById('context-menu').classList.add('hidden');
}

function deleteContextFile() {
    if (contextFile) deleteFile(contextFile);
    document.getElementById('context-menu').classList.add('hidden');
}

function toggleFavoriteContext() {
    if (contextFile) toggleFavorite(contextFile);
    document.getElementById('context-menu').classList.add('hidden');
}

async function renameContextFile() {
    document.getElementById('context-menu').classList.add('hidden');
    const newName = prompt('Enter new name:');
    if (!newName || !contextFile) return;

    try {
        await fetch(`${API_URL}/api/files/${contextFile}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_name: newName })
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

// ============ CHUNKED UPLOAD WITH PAUSE/RESUME ============
async function handleUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    for (const file of files) {
        // Use chunked upload for files > 10MB
        if (file.size > 10 * 1024 * 1024) {
            await chunkedUpload(file);
        } else {
            await simpleUpload(file);
        }
    }

    loadFiles(currentFolder);
    loadStorageInfo();
    event.target.value = '';
}

async function simpleUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    if (currentFolder) formData.append('folder_id', currentFolder);

    // Show upload progress
    showUploadProgress(file.name, 0, file.size);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                updateUploadProgress(file.name, e.loaded, e.total);
            }
        });

        await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status === 200) {
                    completeUploadProgress(file.name);
                    resolve();
                } else {
                    reject(new Error('Upload failed'));
                }
            };
            xhr.onerror = reject;
            xhr.open('POST', `${API_URL}/api/files/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            xhr.send(formData);
        });
    } catch (err) {
        console.error('Upload error:', err);
        errorUploadProgress(file.name, err.message);
    }
}

async function chunkedUpload(file) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    showUploadProgress(file.name, 0, file.size, true);

    try {
        // Initialize upload
        const initRes = await fetch(`${API_URL}/api/files/upload/init`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: file.name,
                file_size: file.size,
                total_chunks: totalChunks,
                folder_id: currentFolder
            })
        });

        const initData = await initRes.json();
        if (!initData.success) throw new Error('Failed to init upload');

        const uploadId = initData.data.upload_id;

        // Store upload state
        activeUploads.set(uploadId, {
            file,
            paused: false,
            currentChunk: 0,
            totalChunks
        });

        // Upload chunks
        for (let i = 0; i < totalChunks; i++) {
            const state = activeUploads.get(uploadId);

            // Check if paused
            while (state?.paused) {
                await new Promise(r => setTimeout(r, 500));
            }

            // Check if cancelled
            if (!activeUploads.has(uploadId)) {
                await fetch(`${API_URL}/api/files/upload/cancel/${uploadId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return;
            }

            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('chunk_index', i);
            formData.append('chunk', chunk);

            await fetch(`${API_URL}/api/files/upload/chunk/${uploadId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            state.currentChunk = i + 1;
            updateUploadProgress(file.name, end, file.size, true, uploadId);
        }

        // Complete upload
        await fetch(`${API_URL}/api/files/upload/complete/${uploadId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        activeUploads.delete(uploadId);
        completeUploadProgress(file.name);

    } catch (err) {
        console.error('Chunked upload error:', err);
        errorUploadProgress(file.name, err.message);
    }
}

function pauseUpload(uploadId) {
    const state = activeUploads.get(uploadId);
    if (state) {
        state.paused = true;
        document.getElementById(`pause-${uploadId}`)?.classList.add('hidden');
        document.getElementById(`resume-${uploadId}`)?.classList.remove('hidden');
    }
}

function resumeUpload(uploadId) {
    const state = activeUploads.get(uploadId);
    if (state) {
        state.paused = false;
        document.getElementById(`pause-${uploadId}`)?.classList.remove('hidden');
        document.getElementById(`resume-${uploadId}`)?.classList.add('hidden');
    }
}

function cancelUpload(uploadId) {
    activeUploads.delete(uploadId);
    document.getElementById(`upload-${uploadId}`)?.remove();
}

// ============ UPLOAD PROGRESS UI ============
function showUploadProgress(filename, loaded, total, chunked = false, uploadId = null) {
    let container = document.getElementById('upload-progress-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'upload-progress-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm';
        document.body.appendChild(container);
    }

    const id = uploadId || `simple-${Date.now()}`;
    const percent = Math.round((loaded / total) * 100);

    const html = `
        <div id="upload-${id}" class="bg-white dark:bg-slate-800 rounded-lg shadow-xl border p-4 min-w-[300px]">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="material-symbols-outlined text-primary">upload_file</span>
                    <span class="text-sm font-medium truncate">${filename}</span>
                </div>
                ${chunked ? `
                <div class="flex gap-1">
                    <button id="pause-${id}" onclick="pauseUpload('${id}')" class="p-1 text-slate-400 hover:text-slate-600" title="Pause">
                        <span class="material-symbols-outlined text-lg">pause</span>
                    </button>
                    <button id="resume-${id}" onclick="resumeUpload('${id}')" class="hidden p-1 text-slate-400 hover:text-slate-600" title="Resume">
                        <span class="material-symbols-outlined text-lg">play_arrow</span>
                    </button>
                    <button onclick="cancelUpload('${id}')" class="p-1 text-slate-400 hover:text-red-500" title="Cancel">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                ` : ''}
            </div>
            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div id="progress-bar-${id}" class="h-full bg-primary transition-all" style="width: ${percent}%"></div>
            </div>
            <div id="progress-text-${id}" class="text-xs text-slate-500 mt-1">${formatSize(loaded)} / ${formatSize(total)} (${percent}%)</div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
}

function updateUploadProgress(filename, loaded, total, chunked = false, uploadId = null) {
    const id = uploadId || Array.from(document.querySelectorAll('[id^="upload-simple-"]'))[0]?.id.replace('upload-', '');
    if (!id) return;

    const percent = Math.round((loaded / total) * 100);
    const bar = document.getElementById(`progress-bar-${id}`);
    const text = document.getElementById(`progress-text-${id}`);

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${formatSize(loaded)} / ${formatSize(total)} (${percent}%)`;
}

function completeUploadProgress(filename) {
    const containers = document.querySelectorAll('[id^="upload-"]');
    containers.forEach(el => {
        if (el.textContent.includes(filename)) {
            el.classList.add('border-green-500');
            setTimeout(() => el.remove(), 2000);
        }
    });
}

function errorUploadProgress(filename, error) {
    const containers = document.querySelectorAll('[id^="upload-"]');
    containers.forEach(el => {
        if (el.textContent.includes(filename)) {
            el.classList.add('border-red-500');
            const text = el.querySelector('[id^="progress-text-"]');
            if (text) text.textContent = `Error: ${error}`;
        }
    });
}

// ============ FOLDER ============
function showNewFolderModal() {
    document.getElementById('folder-modal').classList.remove('hidden');
    document.getElementById('folder-name').value = '';
    document.getElementById('folder-name').focus();
}

function hideFolderModal() {
    document.getElementById('folder-modal').classList.add('hidden');
}

async function createFolder() {
    const name = document.getElementById('folder-name').value.trim();
    if (!name) return;

    try {
        await fetch(`${API_URL}/api/files/folder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, parent_id: currentFolder })
        });
        hideFolderModal();
        loadFiles(currentFolder);
    } catch (err) {
        console.error('Error:', err);
    }
}

// ============ SEARCH ============
function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            searchFiles(query);
        } else {
            loadFiles(currentFolder);
        }
    }
}

async function searchFiles(query) {
    showLoading();
    try {
        const res = await fetch(`${API_URL}/api/files?search=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderFiles(data.data.items);
            document.getElementById('breadcrumb').innerHTML = `<span class="font-semibold text-slate-900 dark:text-white">🔍 Search: ${query}</span>`;
        }
    } catch (err) {
        console.error('Error:', err);
    }
    hideLoading();
}

// ============ VIEW MODE ============
function setViewMode(mode) {
    viewMode = mode;
    document.getElementById('grid-btn').className = mode === 'grid' ?
        'p-1.5 rounded bg-white dark:bg-slate-700 shadow-sm text-primary' :
        'p-1.5 rounded text-slate-500 hover:text-slate-700';
    document.getElementById('list-btn').className = mode === 'list' ?
        'p-1.5 rounded bg-white dark:bg-slate-700 shadow-sm text-primary' :
        'p-1.5 rounded text-slate-500 hover:text-slate-700';
    refreshCurrentView();
}

// ============ STORAGE ============
async function loadStorageInfo() {
    try {
        const res = await fetch(`${API_URL}/api/storage/quota`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.success) {
            const info = data.data;
            const freeSpace = info.available;
            document.getElementById('storage-percent').textContent = `${info.percentage_used}%`;
            document.getElementById('storage-bar').style.width = `${info.percentage_used}%`;
            document.getElementById('storage-text').textContent =
                `${formatSize(info.used)} used • ${formatSize(freeSpace)} free`;
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

// ============ HELPERS ============
function formatSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return `${bytes.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} mins ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
