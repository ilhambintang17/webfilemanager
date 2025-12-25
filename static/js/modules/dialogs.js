/**
 * CloudDrive - Custom Dialogs Module
 */

// Dialog state
let confirmCallback = null;
let pendingDuplicateResolve = null;

// Show confirm dialog
export function showConfirmDialog(title, message, filename, callback) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-filename').textContent = filename;
    confirmCallback = callback;
    document.getElementById('confirm-dialog').classList.remove('hidden');
}

// Close confirm dialog
export function closeConfirmDialog() {
    document.getElementById('confirm-dialog').classList.add('hidden');
    confirmCallback = null;
}

// Execute confirm action
export function confirmDialogAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmDialog();
}

// Show duplicate file dialog
export function showDuplicateDialog(filename) {
    return new Promise((resolve) => {
        document.getElementById('duplicate-filename').textContent = filename;
        pendingDuplicateResolve = resolve;
        document.getElementById('duplicate-dialog').classList.remove('hidden');
    });
}

// Handle duplicate action
export function handleDuplicateAction(action) {
    document.getElementById('duplicate-dialog').classList.add('hidden');
    if (pendingDuplicateResolve) {
        pendingDuplicateResolve(action);
        pendingDuplicateResolve = null;
    }
}

// Make functions available globally for HTML onclick
window.closeConfirmDialog = closeConfirmDialog;
window.confirmDialogAction = confirmDialogAction;
window.handleDuplicateAction = handleDuplicateAction;
