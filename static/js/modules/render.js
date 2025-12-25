/**
 * CloudDrive - Render Module
 */

import { state } from '../app.js';
import { formatSize, formatDate } from './utils.js';

// Get file icon
export function getFileIcon(file) {
    if (file.is_folder) return { icon: 'folder', color: 'text-primary' };
    switch (file.file_type) {
        case 'image': return { icon: 'image', color: 'text-purple-500' };
        case 'video': return { icon: 'movie', color: 'text-red-500' };
        case 'audio': return { icon: 'music_note', color: 'text-pink-500' };
        case 'document':
            if (file.original_filename?.endsWith('.pdf')) return { icon: 'picture_as_pdf', color: 'text-red-500' };
            return { icon: 'description', color: 'text-blue-500' };
        case 'archive': return { icon: 'folder_zip', color: 'text-yellow-600' };
        case 'code': return { icon: 'code', color: 'text-green-500' };
        default: return { icon: 'insert_drive_file', color: 'text-slate-400' };
    }
}

// Render files grid/list
export function renderFiles(files, isTrash = false) {
    const grid = document.getElementById('files-grid');
    const list = document.getElementById('files-list');
    const empty = document.getElementById('empty-state');

    if (!files || files.length === 0) {
        grid.classList.add('hidden');
        list.classList.add('hidden');
        empty.classList.remove('hidden');
        empty.classList.add('flex');
        return;
    }

    empty.classList.add('hidden');
    empty.classList.remove('flex');

    if (state.viewMode === 'grid') {
        grid.classList.remove('hidden');
        list.classList.add('hidden');
        grid.innerHTML = files.map(f => renderFileCard(f, isTrash)).join('');
    } else {
        grid.classList.add('hidden');
        list.classList.remove('hidden');
        list.innerHTML = files.map(f => renderFileRow(f, isTrash)).join('');
    }
}

// Render file card (grid view)
export function renderFileCard(file, isTrash) {
    const icon = getFileIcon(file);

    if (file.is_folder) {
        return `
        <div onclick="loadFiles('${file.id}')" oncontextmenu="showContextMenu(event, '${file.id}')" 
             class="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all select-none">
            <div class="flex items-start justify-between mb-3">
                <span class="material-symbols-outlined text-4xl text-primary icon-fill">folder</span>
                <button onclick="event.stopPropagation(); showContextMenu(event, '${file.id}')" class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
            <h3 class="font-medium text-slate-900 dark:text-white truncate">${file.original_filename}</h3>
            <p class="text-xs text-slate-500 mt-1">${file.item_count || 0} items</p>
        </div>`;
    } else {
        const thumbStyle = file.thumbnail_path ?
            `background-image: url('${state.API_URL}/${file.thumbnail_path}'); background-size: cover; background-position: center;` : '';
        const thumbContent = file.thumbnail_path ? '' :
            `<span class="material-symbols-outlined text-5xl ${icon.color}">${icon.icon}</span>`;

        return `
        <div onclick="previewFile('${file.id}')" oncontextmenu="showContextMenu(event, '${file.id}')"
             class="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:shadow-md hover:border-primary/50 transition-all">
            <div class="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden" style="${thumbStyle}">
                ${thumbContent}
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                    <button onclick="event.stopPropagation(); previewFile('${file.id}')" class="p-2 bg-white/90 rounded-full hover:bg-white text-slate-800 shadow-lg" title="Preview">
                        <span class="material-symbols-outlined text-lg">visibility</span>
                    </button>
                    <button onclick="event.stopPropagation(); downloadFile('${file.id}')" class="p-2 bg-white/90 rounded-full hover:bg-white text-slate-800 shadow-lg" title="Download">
                        <span class="material-symbols-outlined text-lg">download</span>
                    </button>
                    <button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="p-2 bg-white/90 rounded-full hover:bg-red-500 hover:text-white text-slate-800 shadow-lg" title="Delete">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </div>
            <div class="p-3">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined ${icon.color} text-xl">${icon.icon}</span>
                    <h3 class="font-medium text-sm text-slate-900 dark:text-white truncate flex-1">${file.original_filename}</h3>
                    ${file.is_favorite ? '<span class="material-symbols-outlined text-yellow-500 text-sm icon-fill">star</span>' : ''}
                </div>
                <div class="flex justify-between items-center mt-2 text-xs text-slate-400">
                    <span>${formatSize(file.file_size)}</span>
                    <span>${formatDate(file.modified_at)}</span>
                </div>
            </div>
        </div>`;
    }
}

// Render file row (list view)
export function renderFileRow(file, isTrash) {
    const icon = getFileIcon(file);
    return `
    <div onclick="${file.is_folder ? `loadFiles('${file.id}')` : `previewFile('${file.id}')`}" 
         oncontextmenu="showContextMenu(event, '${file.id}')"
         class="group/row flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border border-slate-100 dark:border-slate-700">
        <div class="w-10 h-10 flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl ${icon.color} ${file.is_folder ? 'icon-fill' : ''}">${icon.icon}</span>
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
                <h3 class="font-medium text-slate-900 dark:text-white truncate">${file.original_filename}</h3>
                ${file.is_favorite ? '<span class="material-symbols-outlined text-yellow-500 text-sm icon-fill">star</span>' : ''}
            </div>
            <p class="text-xs text-slate-500">${file.is_folder ? (file.item_count || 0) + ' items' : formatSize(file.file_size)}</p>
        </div>
        <div class="text-xs text-slate-400 hidden sm:block w-32">${formatDate(file.modified_at)}</div>
        <div class="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            ${!file.is_folder ? `
            <button onclick="event.stopPropagation(); downloadFile('${file.id}')" class="p-2 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600">
                <span class="material-symbols-outlined text-lg">download</span>
            </button>` : ''}
            <button onclick="event.stopPropagation(); deleteFile('${file.id}')" class="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    </div>`;
}

// Render breadcrumb
export function renderBreadcrumb(breadcrumb) {
    const el = document.getElementById('breadcrumb');
    el.innerHTML = breadcrumb.map((item, i) => {
        if (i === breadcrumb.length - 1) {
            return `<span class="font-semibold text-slate-900 dark:text-white truncate">${item.name}</span>`;
        }
        return `<a href="#" onclick="loadFiles(${item.id ? `'${item.id}'` : 'null'})" class="hover:text-primary transition-colors">${item.name}</a>
        <span class="material-symbols-outlined text-lg mx-1 text-slate-400">chevron_right</span>`;
    }).join('');
}

// Toggle view mode
export function toggleViewMode(mode) {
    state.viewMode = mode;
    document.getElementById('view-grid-btn').classList.toggle('bg-white', mode === 'grid');
    document.getElementById('view-grid-btn').classList.toggle('shadow-sm', mode === 'grid');
    document.getElementById('view-list-btn').classList.toggle('bg-white', mode === 'list');
    document.getElementById('view-list-btn').classList.toggle('shadow-sm', mode === 'list');
    window.dispatchEvent(new CustomEvent('view:changed'));
}

// Make available globally
window.toggleViewMode = toggleViewMode;
