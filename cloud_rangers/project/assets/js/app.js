// ============================================================
// LABEL PADEGHA SABH — Premium App JS v3
// Enhanced UX: Scroll Animations, Toast Notifications, 
// Back to Top, Dark Mode, API Integration
// ============================================================

const API_BASE = (window.location.protocol === 'file:') ? 'http://127.0.0.1:8000' : window.location.origin;

// ── Toast Notification System ──
function showToast(message, type = 'success', duration = 3000) {
    // Remove existing container or create new one
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = {
        success: 'bi-check-circle-fill',
        error: 'bi-x-circle-fill',
        warning: 'bi-exclamation-triangle-fill'
    };

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <i class="bi ${icons[type] || icons.success}"></i>
        <span class="toast-text">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, duration);

    // Click to dismiss
    toast.addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    });
}

// ── Back to Top Button ──
function initBackToTop() {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    btn.setAttribute('aria-label', 'Back to top');
    document.body.appendChild(btn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 400) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    }, { passive: true });

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ── Scroll-triggered Reveal Animations ──
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
    
    if (!revealElements.length) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
}

// ── Navbar Shadow on Scroll ──
function initNavbarScroll() {
    const nav = document.querySelector('.glass-nav');
    if (!nav) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }, { passive: true });
}

// ── Dark Mode Detection ──
function initDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listen for changes
    prefersDark.addEventListener('change', (e) => {
        if (e.matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    });
}

// ── Auth ──
function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = ['dashboard.html', 'ai-chat.html', 'health-profile.html', 'product-result.html', 'scanner.html', 'mart.html'];

    if (!isLoggedIn && protectedPages.includes(currentPage)) {
        // Auto-login in demo mode for seamless testing
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userId', '1');
        localStorage.setItem('userName', 'Demo User');
        localStorage.setItem('userEmail', 'demo@labelpadega.com');
        console.log('[Auth] Auto-login for demo mode');
    } else if (localStorage.getItem('isLoggedIn') === 'true' && !localStorage.getItem('userId')) {
        localStorage.setItem('userId', '1');
    }
}

function logout() {
    // Show a toast asking for confirmation with two-step approach
    showToast('Logging out...', 'warning', 1500);
    setTimeout(() => {
        localStorage.clear();
        window.location.href = 'index.html';
    }, 1600);
}

// ── Sidebar User Info ──
function initializeUserInfo() {
    const profile = getHealthProfile();
    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    if (nameEl) nameEl.textContent = profile.name || localStorage.getItem('userName') || 'User';
    if (emailEl) emailEl.textContent = localStorage.getItem('userEmail') || 'Set profile ↗';
}

// ── Health Profile Utils ──
function getHealthProfile() {
    try { return JSON.parse(localStorage.getItem('healthProfile') || '{}'); }
    catch { return {}; }
}

// ── Manual Search (Dashboard Modal) ──
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

    const isBarcode = /^\d+$/.test(query);

    if (isBarcode) {
        localStorage.setItem('scannedBarcode', query);
        window.location.href = 'product-result.html';
    } else {
        localStorage.setItem('scannedBarcode', query);
        window.location.href = 'product-result.html';
    }
}

// ── Menu Toggle ──
function initMenuToggle() {
    const toggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => sidebar.classList.toggle('active'));
    }
}

// ── Format Time ──
function formatTime(date) {
    const now = new Date(), diff = now - date;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

// ── Image Upload ──
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

// ── API Helper Functions ──
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    // Add user ID if logged in
    const userId = localStorage.getItem('userId');
    if (userId) {
        headers['X-User-Id'] = userId;
    }

    const options = { method, headers };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'API request failed');
        }

        return data;
    } catch (error) {
        if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
            throw new Error('Unable to connect to server. Please ensure the backend is running.');
        }
        throw error;
    }
}

// ── Login ──
async function loginUser(email, password) {
    const data = await apiRequest('/api/auth/login', 'POST', { email, password });
    if (data.success && data.user) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userId', String(data.user.id));
        localStorage.setItem('userName', data.user.full_name);
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('loggedInUser', JSON.stringify(data.user));
        return data.user;
    }
    throw new Error('Login failed');
}

// ── Register ──
async function registerUser(fullName, email, password) {
    const data = await apiRequest('/api/auth/register', 'POST', {
        full_name: fullName,
        email,
        password
    });
    if (data.success) {
        return data.user;
    }
    throw new Error('Registration failed');
}

// ── Fetch Health Profile from Backend ──
async function fetchHealthProfile() {
    try {
        const data = await apiRequest('/api/profile');
        if (data.success && data.profile) {
            localStorage.setItem('healthProfile', JSON.stringify(data.profile));
            return data.profile;
        }
    } catch (e) {
        // Fall back to local storage
        return getHealthProfile();
    }
    return getHealthProfile();
}

// ── Update Health Profile on Backend ──
async function updateHealthProfileBackend(profileData) {
    try {
        const data = await apiRequest('/api/profile', 'PUT', profileData);
        if (data.success && data.profile) {
            localStorage.setItem('healthProfile', JSON.stringify(data.profile));
            return data.profile;
        }
    } catch (e) {
        // Fall back to local storage
        localStorage.setItem('healthProfile', JSON.stringify(profileData));
    }
    return profileData;
}

// ── Page Transition Overlay ──
function initPageTransition() {
    // Create overlay if it doesn't exist
    if (!document.querySelector('.page-transition')) {
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        document.body.appendChild(overlay);
    }
}

// ── Scroll Indicator Click ──
function initScrollIndicator() {
    const indicator = document.querySelector('.scroll-indicator');
    if (indicator) {
        indicator.addEventListener('click', () => {
            const nextSection = document.querySelector('#six-factors') || document.querySelector('#how-it-works');
            if (nextSection) {
                nextSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeUserInfo();
    initMenuToggle();
    initBackToTop();
    initScrollReveal();
    initNavbarScroll();
    initDarkMode();
    initPageTransition();
    initScrollIndicator();
});
