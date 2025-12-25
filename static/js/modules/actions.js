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

        // Small delay to ensure browser register click
        setTimeout(() => {
            a.click();
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                a.remove();
            }, 1000);
        }, 50);

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

// Show new folder dialog
export function showNewFolderModal() {
    const dialog = document.getElementById('new-folder-dialog');
    const input = document.getElementById('new-folder-input');
    input.value = '';
    dialog.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
}

// Close new folder dialog
export function closeNewFolderDialog() {
    document.getElementById('new-folder-dialog').classList.add('hidden');
}

// Submit new folder
export async function submitNewFolder() {
    const input = document.getElementById('new-folder-input');
    const name = input.value.trim();

    if (!name) {
        input.classList.add('border-red-500');
        input.focus();
        return;
    }

    try {
        const res = await fetch(`${state.API_URL}/api/files/folder`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                parent_id: state.currentFolder
            })
        });
        const data = await res.json();
        if (data.success) {
            closeNewFolderDialog();
            refreshCurrentView();
        } else {
            alert('Failed to create folder: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to create folder');
    }
}

// Legacy alias
export const createFolder = showNewFolderModal;

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

// Move File Logic
let moveTargetFile = null;

// Helper to fetch folders (flat list for simplicity)
async function fetchFolders() {
    try {
        // Fetch all files
        const res = await fetch(`${state.API_URL}/api/files?type=folder`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (!data.success) return [];

        // Return folders only (the API filters by type but let's double check)
        // Also we might want to recursively fetch if the API only returns current folder
        // For now, assuming API returns current folder items.
        // Wait, the API `list_files` lists items in a folder. It doesn't list ALL folders.
        // We need to implement a walk or just standard level-by-level navigation in the dialog.
        // For simplicity: Just fetch root items that are folders.
        // Ideally we need a 'get all folders' API, but we don't have it. 
        // We will default to Root + Current Folder subfolders.
        return data.data.items.filter(f => f.is_folder);
    } catch (e) {
        console.error(e);
        return [];
    }
}

export async function openMoveDialog(fileId) {
    moveTargetFile = fileId;
    const dialog = document.getElementById('move-dialog');
    const select = document.getElementById('move-destination-select');

    // Reset options
    select.innerHTML = '<option value="">Home (Root)</option>';

    // Fetch folders in current directory
    // Note: This is an improved implementation that allows moving to folders in current view
    // A full folder tree would require backend changes
    try {
        const res = await fetch(`${state.API_URL}/api/files?folder_id=${state.currentFolder || ''}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();

        if (data.success) {
            const folders = data.data.items.filter(f => f.is_folder && f.id !== fileId);
            folders.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = f.original_filename;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load folders', e);
    }

    dialog.classList.remove('hidden');
}

export function closeMoveDialog() {
    document.getElementById('move-dialog').classList.add('hidden');
    moveTargetFile = null;
}

export async function submitMove() {
    if (!moveTargetFile) return;

    const select = document.getElementById('move-destination-select');
    const destId = select.value || null; // Empty string means root (null)

    // Don't move to same folder
    if (destId === state.currentFolder) {
        closeMoveDialog();
        return;
    }

    try {
        const res = await fetch(`${state.API_URL}/api/files/${moveTargetFile}/move`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ destination_folder_id: destId })
        });

        const data = await res.json();
        if (data.success) {
            refreshCurrentView();
            closeMoveDialog();
        } else {
            alert('Move failed');
        }
    } catch (e) {
        console.error('Move error:', e);
        alert('Move failed');
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

    // Position menu logic (prevent overflow)
    const x = event.clientX;
    const y = event.clientY;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Adjust if off screen (simple check)
    if (x + 200 > winWidth) menu.style.left = `${x - 200}px`;

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

export function moveContextFile() {
    if (contextFile) {
        openMoveDialog(contextFile);
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
window.showNewFolderModal = showNewFolderModal;
window.closeNewFolderDialog = closeNewFolderDialog;
window.submitNewFolder = submitNewFolder;
window.restoreFile = restoreFile;
window.permanentDelete = permanentDelete;
window.emptyTrash = emptyTrash;
window.showContextMenu = showContextMenu;
window.previewContextFile = previewContextFile;
window.downloadContextFile = downloadContextFile;
window.renameContextFile = renameContextFile;
window.toggleFavoriteContext = toggleFavoriteContext;
window.deleteContextFile = deleteContextFile;
window.moveContextFile = moveContextFile;
window.openMoveDialog = openMoveDialog;
window.closeMoveDialog = closeMoveDialog;
window.submitMove = submitMove;
