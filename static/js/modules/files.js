/**
 * CloudDrive - Files Module
 */

import { state } from '../app.js';
import { renderFiles, renderBreadcrumb } from './render.js';

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
    showLoading();

    const url = folderId ? `${state.API_URL}/api/files?folder_id=${folderId}` : `${state.API_URL}/api/files`;

    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${state.token}` }
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

// Load favorites
export async function loadFavorites() {
    state.currentView = 'favorites';
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
