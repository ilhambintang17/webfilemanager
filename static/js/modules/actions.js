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

// Helper to fetch folders recursively
// Helper to fetch folders recursively
async function fetchAllFolders(parentId = null, level = 0, allFolders = []) {
    try {
        const url = parentId
            ? `${state.API_URL}/api/files?folder_id=${parentId}`
            : `${state.API_URL}/api/files`; // Fetch root if no parentId

        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();

        if (data.success) {
            const folders = data.data.items.filter(f => f.is_folder);

            for (const folder of folders) {
                // Add to list with indentation
                folder.displayName = '&nbsp;&nbsp;&nbsp;'.repeat(level) + '📁 ' + folder.original_filename;
                allFolders.push(folder);

                // Recursive call
                await fetchAllFolders(folder.id, level + 1, allFolders);
            }
        }
    } catch (e) {
        console.error('Failed to fetch folders', e);
    }
    return allFolders;
}

export async function openMoveDialog(fileId) {
    moveTargetFile = fileId;
    const dialog = document.getElementById('move-dialog');
    const select = document.getElementById('move-destination-select');

    // Reset options and show loading state
    select.innerHTML = '<option value="">Loading folders...</option>';
    dialog.classList.remove('hidden');

    // Fetch all folders
    const folders = await fetchAllFolders();

    // Clear and populate
    select.innerHTML = '<option value="">Home (Root)</option>';

    folders.forEach(f => {
        // Don't show the file itself if we are moving a folder (can't move into self)
        if (f.id !== fileId) {
            const opt = document.createElement('option');
            opt.value = f.id;
            opt.textContent = f.displayName;
            select.appendChild(opt);
        }
    });

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

export function showContextMenu(event, fileId = null) {
    event.preventDefault();
    event.stopPropagation();
    contextFile = fileId;

    const menu = document.getElementById('context-menu');

    // Toggle items based on view mode (Trash vs Normal)
    const isTrash = state.currentView === 'trash';

    // Buttons
    const restoreBtn = document.getElementById('ctx-restore-btn');
    const deleteForeverBtn = document.getElementById('ctx-delete-forever-btn');
    const deleteBtn = document.getElementById('ctx-delete-btn');
    const previewBtn = menu.querySelector('button[onclick="previewContextFile()"]');
    const downloadBtn = menu.querySelector('button[onclick="downloadContextFile()"]');
    const renameBtn = menu.querySelector('button[onclick="renameContextFile()"]');
    const starBtn = menu.querySelector('button[onclick="toggleFavoriteContext()"]');
    const copyBtn = menu.querySelector('button[onclick="copyContextFile()"]');
    const cutBtn = menu.querySelector('button[onclick="cutContextFile()"]');
    const pasteBtn = document.getElementById('ctx-paste-btn');

    if (isTrash) {
        // Trash Mode: Show Restore & Delete Forever, hide others
        if (restoreBtn) {
            restoreBtn.classList.remove('hidden');
            restoreBtn.classList.add('flex');
        }
        if (deleteForeverBtn) {
            deleteForeverBtn.classList.remove('hidden');
            deleteForeverBtn.classList.add('flex');
        }

        // Hide standard actions
        [deleteBtn, renameBtn, starBtn, copyBtn, cutBtn, pasteBtn].forEach(el => {
            if (el) {
                el.classList.add('hidden');
                el.classList.remove('flex');
            }
        });

        // Visible: Preview & Download might be useful in trash? Usually restricted. 
        // Let's keep Preview/Download if fileId is set, but hide Rename/Favorite/Copy/Cut/Delete
    } else {
        // Normal Mode: Hide Restore & Delete Forever, show others
        if (restoreBtn) {
            restoreBtn.classList.add('hidden');
            restoreBtn.classList.remove('flex');
        }
        if (deleteForeverBtn) {
            deleteForeverBtn.classList.add('hidden');
            deleteForeverBtn.classList.remove('flex');
        }

        // Show standard actions if file selected
        if (fileId) {
            [deleteBtn, renameBtn, starBtn, copyBtn, cutBtn].forEach(el => {
                if (el) {
                    el.classList.remove('hidden');
                    el.classList.add('flex');
                }
            });
        }

        // Paste checks clipboard
        updatePasteButtonState();
    }

    // Dividers
    const dividers = menu.querySelectorAll('div.h-px');
    dividers.forEach(div => {
        if (fileId || isTrash) { // Show dividers in trash too
            div.classList.remove('hidden');
        } else {
            div.classList.add('hidden');
        }
    });

    // Update Favorite Text/Icon based on file state (Only in normal view)
    if (fileId && !isTrash) {
        const file = state.currentFiles.find(f => f.id === fileId);
        if (file) {
            const favText = document.getElementById('ctx-fav-text');
            if (favText) {
                favText.textContent = file.is_favorite ? 'Remove from Favorites' : 'Add to Favorites';
                const starIcon = favText.previousElementSibling;
                if (starIcon) {
                    starIcon.textContent = file.is_favorite ? 'star' : 'star';
                    starIcon.classList.toggle('text-amber-500', file.is_favorite);
                    starIcon.style.fontVariationSettings = file.is_favorite ? "'FILL' 1" : "'FILL' 0";
                }
            }
        }
    }

    // Position menu logic
    const x = event.clientX;
    const y = event.clientY;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;

    // Adjust if off screen
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

export function restoreContextFile() {
    if (contextFile) restoreFile(contextFile);
}

export function permanentDeleteContextFile() {
    if (contextFile) permanentDelete(contextFile);
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
window.restoreContextFile = restoreContextFile;
window.permanentDeleteContextFile = permanentDeleteContextFile;
window.openMoveDialog = openMoveDialog;
window.closeMoveDialog = closeMoveDialog;
window.submitMove = submitMove;

// Clipboard Logic (Cut/Copy/Paste)
const CLIPBOARD_KEY = 'cloudDrive_clipboard';

function setClipboard(action, fileId, filename) {
    const data = {
        action: action, // 'copy' or 'cut'
        fileId: fileId,
        filename: filename,
        timestamp: Date.now()
    };
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(data));
    updatePasteButtonState();
}

function getClipboard() {
    try {
        const data = localStorage.getItem(CLIPBOARD_KEY);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

function clearClipboard() {
    localStorage.removeItem(CLIPBOARD_KEY);
    updatePasteButtonState();
}

export function copyFile(fileId) {
    // Find file name if not passed? For now assume we have ID.
    // We need to fetch file info or find it in state.currentFiles
    const file = state.currentFiles.find(f => f.id === fileId);
    if (file) {
        setClipboard('copy', fileId, file.original_filename);
        // Visual feedback?
        alert(`Copied: ${file.original_filename}`);
    }
}

export function cutFile(fileId) {
    const file = state.currentFiles.find(f => f.id === fileId) || { original_filename: 'File', id: fileId };

    setClipboard('cut', fileId, file.original_filename);

    // Visual feedback (opacity)
    // Try to find the element by ID if possible, or context
    const elements = document.querySelectorAll(`div[oncontextmenu*="${fileId}"]`);
    elements.forEach(el => el.classList.add('opacity-50', 'border-dashed', 'border-amber-500'));
}

export async function pasteFile() {
    const data = getClipboard();
    if (!data) return;

    if (!state.currentFolder) {
        // Root folder
    }

    try {
        if (data.action === 'copy') {
            await fetch(`${state.API_URL}/api/files/${data.fileId}/copy`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ destination_folder_id: state.currentFolder || null })
            });
        } else if (data.action === 'cut') {
            await fetch(`${state.API_URL}/api/files/${data.fileId}/move`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ destination_folder_id: state.currentFolder || null })
            });
            clearClipboard(); // Cut is one-time
        }
        refreshCurrentView();
    } catch (e) {
        console.error('Paste failed', e);
        alert('Paste failed');
    }
}

function updatePasteButtonState() {
    const data = getClipboard();
    const btn = document.getElementById('paste-btn');
    const ctxBtn = document.getElementById('ctx-paste-btn');

    if (btn) {
        if (data) {
            btn.classList.remove('hidden');
            btn.title = `${data.action === 'cut' ? 'Move' : 'Copy'} ${data.filename}`;
        } else {
            btn.classList.add('hidden');
        }
    }

    if (ctxBtn) {
        if (data) {
            ctxBtn.classList.remove('hidden');
            const actionText = data.action === 'cut' ? 'Move' : 'Copy';
            ctxBtn.innerHTML = `<span class="material-symbols-outlined text-lg">content_paste</span> Paste (${actionText} "${data.filename}")`;
        } else {
            ctxBtn.classList.add('hidden');
        }
    }
}

// Context menu helpers
export function copyContextFile() {
    if (contextFile) copyFile(contextFile);
}

export function cutContextFile() {
    if (contextFile) cutFile(contextFile);
}

// Expose to window
window.copyFile = copyFile;
window.cutFile = cutFile;
window.pasteFile = pasteFile;
window.copyContextFile = copyContextFile;
window.cutContextFile = cutContextFile;

// Initialize paste button on load
document.addEventListener('DOMContentLoaded', updatePasteButtonState);
// Listen for storage changes (tabs sync)
window.addEventListener('storage', updatePasteButtonState);
