/**
 * CloudDrive - Main Application Entry Point
 * File Manager with Chunked Upload & Resume Support
 */

// ============ GLOBAL STATE ============
export const state = {
    API_URL: '',
    token: localStorage.getItem('token'),
    currentFolder: null,
    currentFile: null,
    viewMode: 'grid',
    currentView: 'files'
};

// ============ IMPORT MODULES ============
import { showLogin, showDashboard, handleLogin, logout } from './modules/auth.js';
import { loadFiles, loadFavorites, loadTrash, loadRecent, refreshCurrentView, searchFiles } from './modules/files.js';
import { loadStorageInfo } from './modules/storage.js';
import { setActiveNav } from './modules/utils.js';
import { toggleViewMode } from './modules/render.js';

// Import side-effect modules (they register global functions)
import './modules/preview.js';
import './modules/actions.js';
import './modules/dialogs.js';
import './modules/upload.js';

// ============ INITIALIZATION ============
document.addEventListener('DOMContentLoaded', () => {
    if (state.token) {
        showDashboard();
        loadFiles(null);
        loadStorageInfo();
    } else {
        showLogin();
    }

    // Close context menu on click
    document.addEventListener('click', () => {
        document.getElementById('context-menu').classList.add('hidden');
    });

    // Login form handler
    document.getElementById('login-form').addEventListener('submit', handleLogin);

    // Search handler
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchFiles(e.target.value);
            }, 300);
        });
    }
});

// Listen for auth events
window.addEventListener('auth:loggedIn', () => {
    loadFiles(null);
    loadStorageInfo();
});

// Listen for view change events
window.addEventListener('view:changed', () => {
    refreshCurrentView();
});

// ============ GLOBAL FUNCTIONS ============
// Make functions available globally for HTML onclick handlers
window.logout = logout;
window.setActiveNav = setActiveNav;
