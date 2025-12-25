/**
 * CloudDrive - Upload Module
 */

import { state } from '../app.js';
import { formatSize } from './utils.js';
import { showDuplicateDialog } from './dialogs.js';
import { loadFiles, refreshCurrentView } from './files.js';
import { loadStorageInfo } from './storage.js';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const activeUploads = new Map();
const uploadProgressIds = new Map(); // filename -> progress element id

// Handle file upload
export async function handleUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    // Start all uploads
    const uploadPromises = [];

    for (const file of files) {
        uploadPromises.push(processUpload(file));
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    loadFiles(state.currentFolder);
    loadStorageInfo();
    event.target.value = '';
}

// Process single upload with duplicate check
async function processUpload(file) {
    // Check for duplicate file
    const existingFile = await checkDuplicateFile(file.name);

    if (existingFile) {
        const action = await showDuplicateDialog(file.name);

        if (action === 'cancel') {
            return;
        } else if (action === 'replace') {
            await fetch(`${state.API_URL}/api/files/${existingFile.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${state.token}` }
            });
        } else if (action === 'keep') {
            const newName = generateUniqueName(file.name);
            const renamedFile = new File([file], newName, { type: file.type });
            return uploadFile(renamedFile);
        }
    }

    return uploadFile(file);
}

// Upload file (chooses simple or chunked based on size)
async function uploadFile(file) {
    if (file.size > 10 * 1024 * 1024) {
        await chunkedUpload(file);
    } else {
        await simpleUpload(file);
    }
}

// Check for duplicate file
async function checkDuplicateFile(filename) {
    try {
        const res = await fetch(`${state.API_URL}/api/files?folder_id=${state.currentFolder || ''}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
            return data.data.find(f => f.original_filename === filename && !f.is_folder);
        }
    } catch (err) {
        console.error('Error checking duplicate:', err);
    }
    return null;
}

// Generate unique name
function generateUniqueName(filename) {
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.substring(lastDot) : '';
    return `${name} (1)${ext}`;
}

// Simple upload for small files
async function simpleUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    if (state.currentFolder) formData.append('folder_id', state.currentFolder);

    const progressId = showUploadProgress(file.name, 0, file.size, false);
    uploadProgressIds.set(file.name, progressId);

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                updateUploadProgressById(progressId, e.loaded, e.total);
            }
        });

        await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status === 200) {
                    completeUploadProgressById(progressId);
                    uploadProgressIds.delete(file.name);
                    resolve();
                } else {
                    reject(new Error('Upload failed'));
                }
            };
            xhr.onerror = reject;
            xhr.open('POST', `${state.API_URL}/api/files/upload`);
            xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
            xhr.send(formData);
        });
    } catch (err) {
        console.error('Upload error:', err);
        errorUploadProgressById(progressId, err.message);
        uploadProgressIds.delete(file.name);
    }
}

// Chunked upload for large files
async function chunkedUpload(file) {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // Show progress immediately
    const progressId = showUploadProgress(file.name, 0, file.size, true);
    uploadProgressIds.set(file.name, progressId);

    try {
        const initRes = await fetch(`${state.API_URL}/api/files/upload/init`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filename: file.name,
                file_size: file.size,
                total_chunks: totalChunks,
                folder_id: state.currentFolder
            })
        });

        const initData = await initRes.json();
        if (!initData.success) throw new Error('Failed to init upload');

        const uploadId = initData.data.upload_id;

        // Update progress element with real upload ID for pause/resume
        updateProgressElementId(progressId, uploadId);

        activeUploads.set(uploadId, {
            file,
            paused: false,
            currentChunk: 0,
            totalChunks,
            progressId
        });

        for (let i = 0; i < totalChunks; i++) {
            const uploadState = activeUploads.get(uploadId);

            while (uploadState?.paused) {
                await new Promise(r => setTimeout(r, 500));
            }

            if (!activeUploads.has(uploadId)) {
                await fetch(`${state.API_URL}/api/files/upload/cancel/${uploadId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                return;
            }

            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('chunk_index', i);
            formData.append('chunk', chunk);

            await fetch(`${state.API_URL}/api/files/upload/chunk/${uploadId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${state.token}` },
                body: formData
            });

            uploadState.currentChunk = i + 1;
            updateUploadProgressById(progressId, end, file.size);
        }

        await fetch(`${state.API_URL}/api/files/upload/complete/${uploadId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });

        activeUploads.delete(uploadId);
        uploadProgressIds.delete(file.name);
        completeUploadProgressById(progressId);

    } catch (err) {
        console.error('Chunked upload error:', err);
        errorUploadProgressById(progressId, err.message);
        uploadProgressIds.delete(file.name);
    }
}

// Pause upload
export function pauseUpload(uploadId) {
    const uploadState = activeUploads.get(uploadId);
    if (uploadState) {
        uploadState.paused = true;
        document.getElementById(`pause-${uploadId}`)?.classList.add('hidden');
        document.getElementById(`resume-${uploadId}`)?.classList.remove('hidden');
    }
}

// Resume upload
export function resumeUpload(uploadId) {
    const uploadState = activeUploads.get(uploadId);
    if (uploadState) {
        uploadState.paused = false;
        document.getElementById(`pause-${uploadId}`)?.classList.remove('hidden');
        document.getElementById(`resume-${uploadId}`)?.classList.add('hidden');
    }
}

// Cancel upload
export function cancelUpload(uploadId) {
    activeUploads.delete(uploadId);
    document.getElementById(`upload-${uploadId}`)?.remove();
}

// ============ UPLOAD PROGRESS UI ============

// Create progress element and return its ID
function showUploadProgress(filename, loaded, total, chunked = false) {
    let container = document.getElementById('upload-progress-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'upload-progress-container';
        container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm';
        document.body.appendChild(container);
    }

    const id = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const percent = Math.round((loaded / total) * 100);

    const html = `
        <div id="${id}" class="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4 min-w-[300px]">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span class="material-symbols-outlined text-primary">upload_file</span>
                    <span class="text-sm font-medium truncate">${filename}</span>
                </div>
                <div class="flex gap-1 upload-controls" style="display: ${chunked ? 'flex' : 'none'}">
                    <button class="pause-btn p-1 text-slate-400 hover:text-slate-600" title="Pause">
                        <span class="material-symbols-outlined text-lg">pause</span>
                    </button>
                    <button class="resume-btn hidden p-1 text-slate-400 hover:text-slate-600" title="Resume">
                        <span class="material-symbols-outlined text-lg">play_arrow</span>
                    </button>
                    <button class="cancel-btn p-1 text-slate-400 hover:text-red-500" title="Cancel">
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            </div>
            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="progress-bar h-full bg-primary transition-all" style="width: ${percent}%"></div>
            </div>
            <div class="progress-text text-xs text-slate-500 mt-1">${formatSize(loaded)} / ${formatSize(total)} (${percent}%)</div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);
    return id;
}

// Update progress element with real upload ID for pause/resume controls
function updateProgressElementId(progressId, uploadId) {
    const el = document.getElementById(progressId);
    if (!el) return;

    const pauseBtn = el.querySelector('.pause-btn');
    const resumeBtn = el.querySelector('.resume-btn');
    const cancelBtn = el.querySelector('.cancel-btn');

    if (pauseBtn) {
        pauseBtn.id = `pause-${uploadId}`;
        pauseBtn.onclick = () => pauseUpload(uploadId);
    }
    if (resumeBtn) {
        resumeBtn.id = `resume-${uploadId}`;
        resumeBtn.onclick = () => resumeUpload(uploadId);
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => cancelUpload(uploadId);
    }
}

// Update progress by element ID
function updateUploadProgressById(id, loaded, total) {
    const el = document.getElementById(id);
    if (!el) return;

    const percent = Math.round((loaded / total) * 100);
    const bar = el.querySelector('.progress-bar');
    const text = el.querySelector('.progress-text');

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = `${formatSize(loaded)} / ${formatSize(total)} (${percent}%)`;
}

// Complete progress by element ID
function completeUploadProgressById(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('border-green-500');
        el.querySelector('.progress-bar')?.classList.add('bg-green-500');
        el.querySelector('.progress-bar')?.classList.remove('bg-primary');
        el.querySelector('.upload-controls')?.remove();
        setTimeout(() => el.remove(), 2000);
    }
}

// Error progress by element ID
function errorUploadProgressById(id, error) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('border-red-500');
        el.querySelector('.progress-bar')?.classList.add('bg-red-500');
        el.querySelector('.progress-bar')?.classList.remove('bg-primary');
        const text = el.querySelector('.progress-text');
        if (text) text.textContent = `Error: ${error}`;
    }
}

// Make functions available globally
window.handleUpload = handleUpload;
window.pauseUpload = pauseUpload;
window.resumeUpload = resumeUpload;
window.cancelUpload = cancelUpload;
