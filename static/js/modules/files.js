/**
 * CloudDrive - Files Module
 */

import { state } from '../app.js';
import { renderFiles, renderBreadcrumb } from './render.js';

// Update UI based on current view
function updateViewUI() {
    const uploadBtn = document.getElementById('upload-btn');
    const newFolderBtn = document.getElementById('new-folder-btn');
    const emptyTrashBtn = document.getElementById('empty-trash-btn');
    const emptyStateActions = document.getElementById('empty-state-actions');
    const emptyStateTitle = document.getElementById('empty-state-title');
    const emptyStateMessage = document.getElementById('empty-state-message');

    // Default: show upload and new folder buttons
    if (uploadBtn) uploadBtn.classList.remove('hidden');
    if (newFolderBtn) newFolderBtn.classList.remove('hidden');
    if (emptyTrashBtn) emptyTrashBtn.classList.add('hidden');
    if (emptyStateActions) emptyStateActions.classList.remove('hidden');

    // Customize based on view
    if (state.currentView === 'trash') {
        // Hide upload/new folder in trash
        if (uploadBtn) uploadBtn.classList.add('hidden');
        if (newFolderBtn) newFolderBtn.classList.add('hidden');
        if (emptyTrashBtn) emptyTrashBtn.classList.remove('hidden');
        if (emptyStateActions) emptyStateActions.classList.add('hidden');
        if (emptyStateTitle) emptyStateTitle.textContent = 'Trash is empty';
        if (emptyStateMessage) emptyStateMessage.textContent = 'Deleted files will appear here';
    } else if (state.currentView === 'favorites') {
        // Hide upload/new folder in favorites
        if (uploadBtn) uploadBtn.classList.add('hidden');
        if (newFolderBtn) newFolderBtn.classList.add('hidden');
        if (emptyStateActions) emptyStateActions.classList.add('hidden');
        if (emptyStateTitle) emptyStateTitle.textContent = 'No favorites yet';
        if (emptyStateMessage) emptyStateMessage.textContent = 'Star files to add them to favorites';
    } else if (state.currentView === 'recent') {
        // Hide new folder in recent
        if (newFolderBtn) newFolderBtn.classList.add('hidden');
        if (emptyStateActions) emptyStateActions.classList.add('hidden');
        if (emptyStateTitle) emptyStateTitle.textContent = 'No recent files';
        if (emptyStateMessage) emptyStateMessage.textContent = 'Recently accessed files will appear here';
    } else {
        // Default files view
        if (emptyStateTitle) emptyStateTitle.textContent = 'No files yet';
        if (emptyStateMessage) emptyStateMessage.textContent = 'Upload your first file or create a folder';
    }
}

// Show loading state
export function showLoading() {
    document.getElementById('files-grid').classList.add('hidden');
    document.getElementById('files-list').classList.add('hidden');
    document.getElementById('empty-state').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('hidden');
    document.getElementById('loading-state').classList.add('flex');
}

// Hide loading state
export function hideLoading() {
    document.getElementById('loading-state').classList.add('hidden');
    document.getElementById('loading-state').classList.remove('flex');
}

// Load files from folder
export async function loadFiles(folderId) {
    state.currentFolder = folderId;
    state.currentView = 'files';
    updateViewUI();
    showLoading();

    const url = folderId ? `${state.API_URL}/api/files?folder_id=${folderId}` : `${state.API_URL}/api/files`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();

        if (data.success) {
            state.currentFiles = data.data.items; // Store in state for context menu actions
            renderFiles(data.data.items);
            renderBreadcrumb(data.data.breadcrumb);
        }
    } catch (err) {
        console.error('Error loading files:', err);
    }
    hideLoading();
}

// Load favorites
export async function loadFavorites() {
    state.currentView = 'favorites';
    updateViewUI();
    showLoading();
    try {
        const res = await fetch(`${state.API_URL}/api/files/favorites/list`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
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

// Load trash
export async function loadTrash() {
    state.currentView = 'trash';
    updateViewUI();
    showLoading();
    try {
        const res = await fetch(`${state.API_URL}/api/files/trash/list`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
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

// Load recent files
export async function loadRecent() {
    state.currentView = 'recent';
    updateViewUI();
    showLoading();
    try {
        const res = await fetch(`${state.API_URL}/api/files`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
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

// Refresh current view
export function refreshCurrentView() {
    switch (state.currentView) {
        case 'favorites': loadFavorites(); break;
        case 'trash': loadTrash(); break;
        case 'recent': loadRecent(); break;
        default: loadFiles(state.currentFolder);
    }
}

// Search files
export async function searchFiles(query) {
    if (!query) {
        loadFiles(state.currentFolder);
        return;
    }
    state.currentView = 'search';
    updateViewUI();
    showLoading();
    try {
        const res = await fetch(`${state.API_URL}/api/files/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
            renderFiles(data.data);
            document.getElementById('breadcrumb').innerHTML = `<span class="font-semibold text-slate-900 dark:text-white">🔍 Search: ${query}</span>`;
        }
    } catch (err) {
        console.error('Error:', err);
    }
    hideLoading();
}

// Make functions available globally for HTML onclick
window.loadFiles = loadFiles;
window.loadFavorites = loadFavorites;
window.loadTrash = loadTrash;
window.loadRecent = loadRecent;
window.refreshCurrentView = refreshCurrentView;
window.searchFiles = searchFiles;
