/**
 * CloudDrive - Utility Functions
 */

// Format file size
export function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Format date
export function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' hours ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';

    return date.toLocaleDateString();
}

// Format time (for media player)
export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Escape HTML
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Set active navigation
export function setActiveNav(el) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active', 'bg-primary/10', 'text-primary', 'font-medium');
        link.classList.add('text-slate-600', 'dark:text-slate-400');
    });
    el.classList.add('active', 'bg-primary/10', 'text-primary', 'font-medium');
    el.classList.remove('text-slate-600', 'dark:text-slate-400');
}
