/**
 * CloudDrive - Actions Module
 */

import { state } from '../app.js';
import { showConfirmDialog } from './dialogs.js';
import { refreshCurrentView } from './files.js';
import { hidePreviewModal, hideVideoModal, hideDocModal } from './preview.js';
import { loadStorageInfo } from './storage.js';

// Download file
export async function downloadFile(fileId) {
    try {
        const fileRes = await fetch(`${state.API_URL}/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const fileData = await fileRes.json();
        if (!fileData.success) throw new Error('File not found');

        const filename = fileData.data.original_filename;
        const res = await fetch(`${state.API_URL}/api/files/${fileId}/download`);
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

// Download current file
export function downloadCurrentFile() {
    if (state.currentFile) {
        downloadFile(state.currentFile.id);
    }
}

// Delete file
export async function deleteFile(fileId) {
    try {
        const res = await fetch(`${state.API_URL}/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
            showConfirmDialog(
                'Move to Trash',
                'This file will be moved to trash',
                data.data.original_filename,
                async () => {
                    await fetch(`${state.API_URL}/api/files/${fileId}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${state.token}` }
                    });
                    refreshCurrentView();
                    loadStorageInfo();
                }
            );
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

// Delete current file
export function deleteCurrentFile() {
    if (state.currentFile) {
        showConfirmDialog(
            'Move to Trash',
            'This file will be moved to trash',
            state.currentFile.original_filename,
            async () => {
                hidePreviewModal();
                hideVideoModal();
                hideDocModal();
                await fetch(`${state.API_URL}/api/files/${state.currentFile.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${state.token}` }
                });
                refreshCurrentView();
                loadStorageInfo();
            }
        );
    }
}

// Toggle favorite
export async function toggleFavorite(fileId) {
    try {
        await fetch(`${state.API_URL}/api/files/${fileId}/favorite`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Toggle favorite from preview
export async function toggleFavoritePreview() {
    if (state.currentFile) {
        await toggleFavorite(state.currentFile.id);
        const res = await fetch(`${state.API_URL}/api/files/${state.currentFile.id}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
            state.currentFile = data.data;
            document.getElementById('preview-fav-icon').textContent = state.currentFile.is_favorite ? 'star' : 'star_border';
            document.getElementById('preview-fav-icon').classList.toggle('icon-fill', state.currentFile.is_favorite);
            document.getElementById('preview-fav-icon').classList.toggle('text-yellow-500', state.currentFile.is_favorite);
        }
    }
}

// Create folder
export async function createFolder() {
    const name = prompt('Enter folder name:');
    if (!name) return;

    try {
        await fetch(`${state.API_URL}/api/files/folder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                parent_folder_id: state.currentFolder
            })
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Rename file
export async function renameFile(fileId, newName) {
    try {
        await fetch(`${state.API_URL}/api/files/${fileId}/rename`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_name: newName })
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Restore file from trash
export async function restoreFile(fileId) {
    try {
        await fetch(`${state.API_URL}/api/files/${fileId}/restore`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        refreshCurrentView();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Permanent delete
export async function permanentDelete(fileId) {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;

    try {
        await fetch(`${state.API_URL}/api/files/${fileId}/permanent`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        refreshCurrentView();
        loadStorageInfo();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Empty trash
export async function emptyTrash() {
    if (!confirm('Empty trash? All files will be permanently deleted.')) return;

    try {
        await fetch(`${state.API_URL}/api/files/trash/empty`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        refreshCurrentView();
        loadStorageInfo();
    } catch (err) {
        console.error('Error:', err);
    }
}

// Context menu
let contextFile = null;

export function showContextMenu(event, fileId) {
    event.preventDefault();
    event.stopPropagation();
    contextFile = fileId;

    const menu = document.getElementById('context-menu');
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    menu.classList.remove('hidden');
}

export function previewContextFile() {
    if (contextFile) {
        window.previewFile(contextFile);
    }
}

export function downloadContextFile() {
    if (contextFile) {
        downloadFile(contextFile);
    }
}

export function renameContextFile() {
    if (contextFile) {
        const newName = prompt('Enter new name:');
        if (newName) {
            renameFile(contextFile, newName);
        }
    }
}

export function toggleFavoriteContext() {
    if (contextFile) {
        toggleFavorite(contextFile);
    }
}

export function deleteContextFile() {
    if (contextFile) {
        deleteFile(contextFile);
    }
}

// Make functions available globally
window.downloadFile = downloadFile;
window.downloadCurrentFile = downloadCurrentFile;
window.deleteFile = deleteFile;
window.deleteCurrentFile = deleteCurrentFile;
window.toggleFavorite = toggleFavorite;
window.toggleFavoritePreview = toggleFavoritePreview;
window.createFolder = createFolder;
window.restoreFile = restoreFile;
window.permanentDelete = permanentDelete;
window.emptyTrash = emptyTrash;
window.showContextMenu = showContextMenu;
window.previewContextFile = previewContextFile;
window.downloadContextFile = downloadContextFile;
window.renameContextFile = renameContextFile;
window.toggleFavoriteContext = toggleFavoriteContext;
window.deleteContextFile = deleteContextFile;
