// ==========================
// auth.js - Handles registration, login, password toggle, strength, and dashboard
// ==========================

const DEMO_EMAIL = 'demo@labelpadega.com';
const DEMO_PASSWORD = 'demo12345';

function getStoredUsers() {
    try {
        const raw = localStorage.getItem('users');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not parse stored users:', error);
        return [];
    }
}

function saveStoredUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
}

function ensureDemoAccount() {
    const users = getStoredUsers();
    if (!users.some(user => user.email === DEMO_EMAIL)) {
        users.push({ fullName: 'Demo User', email: DEMO_EMAIL, password: DEMO_PASSWORD });
        saveStoredUsers(users);
    }
    return users;
}

document.addEventListener('DOMContentLoaded', function() {

    // --------------------------
    // Password Toggle
    // --------------------------
    function setupToggle(inputId, toggleId) {
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);
        if (input && toggle) {
            toggle.addEventListener('click', () => {
                if (input.type === 'password') {
                    input.type = 'text';
                    toggle.innerHTML = '<i class="bi bi-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    toggle.innerHTML = '<i class="bi bi-eye"></i>';
                }
            });
        }
    }

    setupToggle('password', 'togglePassword');
    setupToggle('confirmPassword', 'toggleConfirmPassword');
    setupToggle('loginPassword', 'toggleLoginPassword');

    // --------------------------
    // Password Strength
    // --------------------------
    const passwordInput = document.getElementById('password');
    const strengthIndicator = document.getElementById('passwordStrength');

    if (passwordInput && strengthIndicator) {
        passwordInput.addEventListener('input', function() {
            const password = this.value;
            let strength = 0;

            if (password.length >= 8) strength += 20;   // min 8 chars
            if (password.length >= 12) strength += 20;
            if (/[a-z]/.test(password)) strength += 15;
            if (/[A-Z]/.test(password)) strength += 15;
            if (/[0-9]/.test(password)) strength += 15;
            if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

            // Reset classes
            strengthIndicator.className = 'password-strength';

            if (password.length > 0) {
                if (strength < 30) {
                    strengthIndicator.classList.add('weak');
                    strengthIndicator.innerText = 'Weak';
                } else if (strength < 60) {
                    strengthIndicator.classList.add('medium');
                    strengthIndicator.innerText = 'Medium';
                } else {
                    strengthIndicator.classList.add('strong');
                    strengthIndicator.innerText = 'Strong';
                }
            } else {
                strengthIndicator.innerText = '';
            }
        });
    }

    // --------------------------
    // Registration Handler
    // --------------------------
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const termsAccept = document.getElementById('termsAccept').checked;

            // Validation
            if (!fullName || !email || !password || !confirmPassword || !termsAccept) {
                alert("Please fill all fields and accept terms.");
                return;
            }

            if (!isValidEmail(email)) {
                alert("Please enter a valid email address.");
                return;
            }

            if (password.length < 8) {
                alert("Password must be at least 8 characters long.");
                return;
            }

            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                return;
            }

            // Multi-user support
            const users = getStoredUsers();
            if (users.some(u => u.email === email)) {
                alert("Email already registered.");
                return;
            }

            users.push({ fullName, email, password });
            saveStoredUsers(users);

            alert("Registration successful! Redirecting to login...");
            window.location.href = 'login.html';
        });
    }

    // --------------------------
    // Login Handler
    // --------------------------
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value.trim().toLowerCase();
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                alert("Please enter both email and password.");
                return;
            }

            const users = ensureDemoAccount();
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('loggedInUser', JSON.stringify(user));
                if (rememberMe) localStorage.setItem('rememberMe', 'true');

                alert(`Welcome back, ${user.fullName}!`);
                window.location.href = 'dashboard.html';
            } else {
                alert("Invalid email or password.");
            }
        });
    }

    // --------------------------
    // Dashboard protection
    // --------------------------
    if (window.location.pathname.includes('dashboard.html')) {
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            window.location.href = 'login.html';
        } else {
            const user = JSON.parse(localStorage.getItem('loggedInUser'));
            const welcomeEl = document.getElementById('welcomeMessage');
            if (welcomeEl) {
                welcomeEl.innerText = `Welcome, ${user.fullName}!`;
            }
        }
    }

    // --------------------------
    // Logout function
    // --------------------------
    window.logout = function() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    };

    // --------------------------
    // Helper: Email validation
    // --------------------------
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
});
// Dashboard protection & display user info
if (window.location.pathname.includes('dashboard.html')) {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
    } else {
        const user = JSON.parse(localStorage.getItem('loggedInUser'));
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');

        if (nameEl) nameEl.innerText = user.fullName;
        if (emailEl) emailEl.innerText = user.email;
    }
}
