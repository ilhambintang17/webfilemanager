/**
 * CloudDrive - Storage Module
 */

import { state } from '../app.js';
import { formatSize } from './utils.js';

// Load storage info
export async function loadStorageInfo() {
    try {
        const res = await fetch(`${state.API_URL}/api/storage/quota`, {
            headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();

        if (data.success) {
            const used = data.data.used_bytes;
            const total = data.data.total_bytes;
            const free = total - used;
            const percent = total > 0 ? (used / total) * 100 : 0;

            document.getElementById('storage-bar').style.width = `${percent}%`;
            document.getElementById('storage-text').textContent =
                `${formatSize(used)} used • ${formatSize(free)} free`;
        }
    } catch (err) {
        console.error('Error loading storage:', err);
    }
}
