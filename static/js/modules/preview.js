/**
 * CloudDrive - Preview Module
 */

import { state } from '../app.js';
import { formatSize, formatDate, formatTime } from './utils.js';
import { getFileIcon } from './render.js';

// Preview file based on type
export async function previewFile(fileId) {
    try {
        const res = await fetch(`${state.API_URL}/api/files/${fileId}`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();

        if (data.success) {
            const file = data.data;
            state.currentFile = file;

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

// Show image preview
export function showImagePreview(file) {
    const modal = document.getElementById('image-preview-modal');
    const img = document.getElementById('preview-image');

    img.src = `${state.API_URL}/api/files/${file.id}/preview`;
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
        `<img src="${state.API_URL}/api/files/${file.id}/preview" class="w-full h-full object-cover" alt="thumbnail"/>`;

    modal.classList.remove('hidden');
}

// Show video preview
export function showVideoPreview(file) {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');

    video.src = `${state.API_URL}/api/files/${file.id}/preview`;
    document.getElementById('video-filename').textContent = file.original_filename;
    document.getElementById('video-filepath').textContent = formatSize(file.file_size);
    document.getElementById('media-type-icon').textContent = 'movie';
    document.getElementById('speed-select').value = '1';

    setupMediaControls(video);
    modal.classList.remove('hidden');
}

// Show audio preview
export function showAudioPreview(file) {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');

    video.src = `${state.API_URL}/api/files/${file.id}/preview`;
    document.getElementById('video-filename').textContent = file.original_filename;
    document.getElementById('video-filepath').textContent = formatSize(file.file_size);
    document.getElementById('media-type-icon').textContent = 'music_note';
    document.getElementById('speed-select').value = '1';

    setupMediaControls(video);
    modal.classList.remove('hidden');
}

// Setup media controls
export function setupMediaControls(video) {
    document.getElementById('play-pause-icon').textContent = 'play_arrow';
    document.getElementById('media-progress').value = 0;
    document.getElementById('media-current-time').textContent = '0:00';
    document.getElementById('media-duration').textContent = '0:00';
    document.getElementById('volume-slider').value = video.volume * 100;

    video.ontimeupdate = () => {
        const progress = (video.currentTime / video.duration) * 100;
        document.getElementById('media-progress').value = progress || 0;
        document.getElementById('media-current-time').textContent = formatTime(video.currentTime);
    };

    video.onloadedmetadata = () => {
        document.getElementById('media-duration').textContent = formatTime(video.duration);
    };

    video.onplay = () => {
        document.getElementById('play-pause-icon').textContent = 'pause';
    };
    video.onpause = () => {
        document.getElementById('play-pause-icon').textContent = 'play_arrow';
    };
}

// Media controls
export function togglePlayPause() {
    const video = document.getElementById('preview-video');
    if (video.paused) {
        video.play();
    } else {
        video.pause();
    }
}

export function skipMedia(seconds) {
    const video = document.getElementById('preview-video');
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
}

export function seekMedia(percent) {
    const video = document.getElementById('preview-video');
    if (video.duration) {
        video.currentTime = (percent / 100) * video.duration;
    }
}

export function setVolume(value) {
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

export function toggleMute() {
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

export function setPlaybackSpeed(speed) {
    const video = document.getElementById('preview-video');
    video.playbackRate = parseFloat(speed);
}

export function toggleFullscreen() {
    const video = document.getElementById('preview-video');
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        video.requestFullscreen();
    }
}

// Document preview
export function showDocPreview(file) {
    const modal = document.getElementById('doc-preview-modal');
    const icon = getFileIcon(file);
    const pdfViewer = document.getElementById('pdf-viewer');
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');
    const docFallback = document.getElementById('doc-fallback');

    document.getElementById('doc-icon').textContent = icon.icon;
    document.getElementById('doc-filename').textContent = file.original_filename;
    document.getElementById('doc-filesize').textContent = formatSize(file.file_size);

    document.getElementById('doc-preview-icon').textContent = icon.icon;
    document.getElementById('doc-preview-name').textContent = file.original_filename;
    document.getElementById('doc-preview-size').textContent = formatSize(file.file_size);

    pdfViewer.classList.add('hidden');
    docxViewer.classList.add('hidden');
    docLoading.classList.add('hidden');
    docFallback.classList.add('hidden');

    const ext = file.original_filename?.toLowerCase().split('.').pop() || '';

    if (ext === 'pdf') {
        pdfViewer.src = `${state.API_URL}/api/files/${file.id}/preview`;
        pdfViewer.classList.remove('hidden');
    } else if (ext === 'docx') {
        docLoading.classList.remove('hidden');
        loadDocxContent(file.id);
    } else if (['pptx', 'ppsx', 'xlsx'].includes(ext)) {
        docFallback.classList.remove('hidden');
        document.getElementById('doc-fallback-message').innerHTML =
            `PowerPoint/Excel preview coming soon.<br>
             <span class="text-xs">Download to view with your preferred app.</span>`;
    } else if (ext === 'txt' || ext === 'md') {
        docLoading.classList.remove('hidden');
        loadTextContent(file.id);
    } else {
        docFallback.classList.remove('hidden');
        document.getElementById('doc-fallback-message').textContent = 'Preview not available for this file type.';
    }

    modal.classList.remove('hidden');
}

// Load DOCX content
async function loadDocxContent(fileId) {
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');
    const docFallback = document.getElementById('doc-fallback');

    try {
        const response = await fetch(`${state.API_URL}/api/files/${fileId}/preview`);
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

// Load text content
async function loadTextContent(fileId) {
    const docxViewer = document.getElementById('docx-viewer');
    const docLoading = document.getElementById('doc-loading');

    try {
        const response = await fetch(`${state.API_URL}/api/files/${fileId}/preview`);
        const text = await response.text();
        const escapeHtml = (t) => { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
        docxViewer.innerHTML = `<pre class="whitespace-pre-wrap font-mono text-sm">${escapeHtml(text)}</pre>`;
        docLoading.classList.add('hidden');
        docxViewer.classList.remove('hidden');
    } catch (err) {
        console.error('Error loading text:', err);
        docLoading.classList.add('hidden');
    }
}

// Hide modals
export function hidePreviewModal() {
    document.getElementById('image-preview-modal').classList.add('hidden');
    state.currentFile = null;
}

export function hideVideoModal() {
    const modal = document.getElementById('video-preview-modal');
    const video = document.getElementById('preview-video');
    video.pause();
    video.src = '';
    modal.classList.add('hidden');
    state.currentFile = null;
}

export function hideDocModal() {
    const pdfViewer = document.getElementById('pdf-viewer');
    const docxViewer = document.getElementById('docx-viewer');
    pdfViewer.src = '';
    pdfViewer.classList.add('hidden');
    docxViewer.innerHTML = '';
    docxViewer.classList.add('hidden');
    document.getElementById('doc-loading').classList.add('hidden');
    document.getElementById('doc-fallback').classList.remove('hidden');
    document.getElementById('doc-preview-modal').classList.add('hidden');
    state.currentFile = null;
}

export function togglePreviewSidebar() {
    document.getElementById('preview-sidebar').classList.toggle('hidden');
}

// Make functions available globally
window.previewFile = previewFile;
window.hidePreviewModal = hidePreviewModal;
window.hideVideoModal = hideVideoModal;
window.hideDocModal = hideDocModal;
window.togglePreviewSidebar = togglePreviewSidebar;
window.togglePlayPause = togglePlayPause;
window.skipMedia = skipMedia;
window.seekMedia = seekMedia;
window.setVolume = setVolume;
window.toggleMute = toggleMute;
window.setPlaybackSpeed = setPlaybackSpeed;
window.toggleFullscreen = toggleFullscreen;
