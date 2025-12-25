/**
 * CloudDrive - Authentication Module
 */

import { state } from '../app.js';

// Show login page
export function showLogin() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('hidden');
}

// Show dashboard
export function showDashboard() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('dashboard-page').classList.remove('hidden');
    document.getElementById('dashboard-page').classList.add('flex');
}

// Handle login form submit
export async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${state.API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            state.token = data.data.token;
            localStorage.setItem('token', state.token);
            showDashboard();
            // These will be called from app.js
            window.dispatchEvent(new CustomEvent('auth:loggedIn'));
        } else {
            showLoginError(data.detail || 'Login failed');
        }
    } catch (err) {
        showLoginError('Connection error');
    }
}

// Logout
export function logout() {
    localStorage.removeItem('token');
    state.token = null;
    showLogin();
}

// Show login error
export function showLoginError(msg) {
    const el = document.getElementById('login-error');
    el.textContent = msg;
    el.classList.remove('hidden');
}
