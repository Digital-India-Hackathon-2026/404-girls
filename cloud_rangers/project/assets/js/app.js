// ============================================================
// LABEL PADEGHA SABH — Main App JS v2 (Shared Utilities)
// ============================================================

const API_BASE = "http://127.0.0.1:5000";

// ── Auth ─────────────────────────────────────────────────
// NOTE: Auth is localStorage-based. Pages without login redirect.
// Set isLoggedIn = 'true' on successful login/register.
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = ['dashboard.html', 'ai-chat.html', 'health-profile.html', 'product-result.html', 'scanner.html'];

    if (!isLoggedIn && protectedPages.includes(currentPage)) {
        // Redirect to login if not logged in
        window.location.href = 'login.html';
    }
}


function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// ── Sidebar User Info ─────────────────────────────────────
function initializeUserInfo() {
    const profile = getHealthProfile();
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    if (nameEl) nameEl.textContent = profile.name || localStorage.getItem('userName') || 'User';
    if (emailEl) emailEl.textContent = localStorage.getItem('userEmail') || 'Set profile ↗';
}

// ── Health Profile Utils ──────────────────────────────────
function getHealthProfile() {
    try { return JSON.parse(localStorage.getItem('healthProfile') || '{}'); }
    catch { return {}; }
}

// ── Manual Search (Dashboard Modal) ───────────────────────
function performSearch() {
    const modal = new bootstrap.Modal(document.getElementById('manualSearchModal'));
    modal.show();
}

function showSearchResults() {
    const query = (document.getElementById('productSearch').value || '').trim();
    if (!query) return;
    const resultsDiv = document.getElementById('searchResults');
    if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-success"></div> Searching…</div>`;
    }

    // Check if query looks like a barcode (all digits)
    const isBarcode = /^\d+$/.test(query);

    if (isBarcode) {
        localStorage.setItem('scannedBarcode', query);
        window.location.href = 'product-result.html';
    } else {
        // For text search, look it up via the barcode endpoint as a search term
        localStorage.setItem('scannedBarcode', query);
        window.location.href = 'product-result.html';
    }
}

// ── Menu Toggle ───────────────────────────────────────────
function initMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }
}

// ── Format Time ───────────────────────────────────────────
function formatTime(date) {
    const now = new Date(), diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

// ── Image Upload (Dashboard) ───────────────────────────────
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const base64Str = e.target.result.split(',')[1];
        localStorage.setItem('scannedImageBase64', base64Str);
        localStorage.removeItem('scannedBarcode');
        window.location.href = 'product-result.html';
    };
    reader.readAsDataURL(file);
}

// ── Init ────────────────────────────────────────────────── 
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeUserInfo();
    initMenuToggle();
});