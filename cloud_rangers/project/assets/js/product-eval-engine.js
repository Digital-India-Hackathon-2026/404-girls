// ============================================================
// LABEL PADEGHA SABH — Product Evaluation Engine v4.1
// FIXED: API_BASE conflict, double res.json(), stepTimer race,
//        loading state management, comprehensive debug logging
// ============================================================

// ── CRITICAL FIX (Bug #2): Use a unique name to avoid `const` redeclaration
// conflict with the `const API_BASE` already declared in app.js.
// Both files are loaded on product-result.html — a duplicate `const`
// declaration is a SyntaxError that kills ALL JS on the page.
const EVAL_API_BASE = (window.location.protocol === 'file:') ? 'http://127.0.0.1:8000' : '';

// ── Debug Logger ──────────────────────────────────────────
function evalLog(message, type) {
    type = type || 'info';
    var prefix = '[ProductEval] ';
    if (type === 'error')   console.error(prefix + message);
    else if (type === 'warn') console.warn(prefix + message);
    else                    console.log(prefix + message);
}

// ── Step helpers ──────────────────────────────────────────
function setLoadingStep(stepId, state) {
    var el = document.getElementById(stepId);
    if (!el) return;
    el.className = 'loading-step ' + state;
}

function animateLoadingSteps(steps, delay) {
    delay = delay || 600;
    return (async function() {
        for (var i = 0; i < steps.length; i++) {
            setLoadingStep(steps[i], 'active');
            await new Promise(function(r) { setTimeout(r, delay); });
            setLoadingStep(steps[i], 'done');
        }
    })();
}

// ── State ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
    var urlParams  = new URLSearchParams(window.location.search);
    var barcodeFromUrl = urlParams.get('barcode');
    var barcode = barcodeFromUrl || localStorage.getItem('scannedBarcode');
    var image   = localStorage.getItem('scannedImageBase64');

    evalLog('🚀 DOMContentLoaded — barcode="' + barcode + '" image=' + !!image);

    if (barcode) {
        evalLog('Starting barcode analysis: ' + barcode);
        fetchFullAnalysis(barcode);
    } else if (image) {
        evalLog('Starting image analysis');
        localStorage.removeItem('scannedImageBase64');
        fetchProductByImage(image);
    } else {
        evalLog('No product data found — showing error', 'warn');
        showError('No product to analyze', 'Please scan a product or upload an image first.');
    }
});

// ── Error UI ──────────────────────────────────────────────
function showError(title, msg) {
    title = title || 'Error';
    msg   = msg   || 'Something went wrong.';
    evalLog('❌ showError: ' + title + ' — ' + msg, 'error');
    document.getElementById('loadingContainer').style.display = 'none';
    document.getElementById('productContainer').style.display = 'none';
    var err = document.getElementById('errorContainer');
    err.style.display = 'block';
    document.getElementById('errorTitle').textContent   = title;
    document.getElementById('errorMessage').textContent = msg;
}

// ── GET user preferences ───────────────────────────────────
function getHealthProfile() {
    try { return JSON.parse(localStorage.getItem('healthProfile') || '{}'); }
    catch (e) { return {}; }
}

// ═══════════════════════════════════════════════════════════
// Unified /api/analyze-product endpoint
// ═══════════════════════════════════════════════════════════
async function fetchFullAnalysis(barcode) {
    var loading   = document.getElementById('loadingContainer');
    var container = document.getElementById('productContainer');
    loading.style.display   = 'flex';
    container.style.display = 'none';

    var stepSeq = ['step-fetch', 'step-extract', 'step-regulatory', 'step-ai', 'step-personalize', 'step-dashboard'];

    // ── CRITICAL FIX (Bug #5): Run step animation concurrently — don't await it
    // before the fetch. This prevents a 3-second deadlock if the API is fast.
    var stepTimer = animateLoadingSteps(stepSeq, 500);

    var data = null;

    try {
        var profile = getHealthProfile();
        var payload = {
            barcode:    barcode,
            age:        profile.age        || null,
            allergies:  profile.allergies  || [],
            conditions: profile.conditions || [],
            diet:       profile.diet       || ''
        };

        evalLog('📡 Sending POST /api/analyze-product  barcode=' + barcode);
        evalLog('   payload: ' + JSON.stringify(payload));

        var res = await fetch(EVAL_API_BASE + '/api/analyze-product', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(payload)
        });

        evalLog('✅ API response received — HTTP ' + res.status + ' ' + res.statusText);

        // ── CRITICAL FIX (Bug #3): Read the response body EXACTLY ONCE.
        // Previously the code called res.json() inside the !res.ok branch AND
        // again outside it, causing "body stream already consumed" TypeError.
        data = await res.json();
        evalLog('✅ Response JSON parsed successfully');
        evalLog('   Keys: ' + Object.keys(data).join(', '));

        if (!res.ok) {
            // Backend returned a non-2xx status — extract message from either field
            var errMsg = (data && (data.detail || data.error)) || ('Server error (' + res.status + ')');
            evalLog('❌ Non-OK status: ' + errMsg, 'error');
            throw new Error(errMsg);
        }

        // Backend may return 200 + {"error": "..."} for product-not-found
        if (data.error) {
            evalLog('❌ Product not found: ' + data.error, 'warn');
            showError('Product Not Found', data.error);
            return;
        }

    } catch (err) {
        evalLog('❌ Fetch/parse failed: ' + err.message, 'error');
        // ── CRITICAL FIX (Bug #4): Always hide loading in the error path
        loading.style.display = 'none';
        if (err.message && err.message.includes('Failed to fetch')) {
            showError(
                'Cannot Connect to Backend',
                'Make sure the Python backend is running: cd backend && uvicorn app:app --reload  (port 8000)'
            );
        } else {
            showError('Analysis Failed', err.message || 'Could not connect to the server.');
        }
        return;
    }

    // ── CRITICAL FIX (Bug #4): Hide loading BEFORE rendering so the product
    // cards are not covered by the spinner overlay.
    loading.style.display = 'none';

    evalLog('🎨 Calling renderFullAnalysis...');
    renderFullAnalysis(data, getHealthProfile());

    // Let the step animation finish in the background (it's already running)
    stepTimer.catch(function() {});
}

// ═══════════════════════════════════════════════════════════
// LEGACY: Image to /api/analyze
// ═══════════════════════════════════════════════════════════
async function fetchProductByImage(base64Image) {
    var loading   = document.getElementById('loadingContainer');
    var container = document.getElementById('productContainer');
    loading.style.display   = 'flex';
    container.style.display = 'none';

    var stepSeq   = ['step-fetch', 'step-extract', 'step-regulatory', 'step-ai', 'step-personalize', 'step-dashboard'];
    var stepTimer = animateLoadingSteps(stepSeq, 700);

    var data = null;

    try {
        var prefs     = getHealthProfile();
        var imageData = 'data:image/jpeg;base64,' + base64Image;

        evalLog('📡 Sending POST /api/analyze (image)');

        var res = await fetch(EVAL_API_BASE + '/api/analyze', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ image: imageData, preferences: prefs })
        });

        evalLog('✅ Image API response — HTTP ' + res.status);
        data = await res.json();   // read once
        evalLog('✅ Image response JSON parsed');

        if (!res.ok) {
            var errMsg = (data && (data.error || data.detail)) || ('Server error (' + res.status + ')');
            throw new Error(errMsg);
        }

        if (data.error && !data.name) {
            showError('Image Analysis Failed', data.error);
            loading.style.display = 'none';
            return;
        }

    } catch (err) {
        evalLog('❌ Image fetch failed: ' + err.message, 'error');
        loading.style.display = 'none';
        showError('Image Analysis Failed', err.message || 'Could not analyze the image.');
        return;
    }

    loading.style.display = 'none';
    renderFullAnalysis(data, getHealthProfile());
    stepTimer.catch(function() {});
}

// ═══════════════════════════════════════════════════════════
// RENDER ENGINE v4.1 — Full dashboard
// ═══════════════════════════════════════════════════════════

// HTML entity encoding helper
var _amp  = '&' + 'amp;';
var _lt   = '&' + 'lt;';
var _gt   = '&' + 'gt;';
var _quot = '&' + 'quot;';

function escHtml(s) {
    return String(s)
        .replace(/&/g, _amp)
        .replace(/</g, _lt)
        .replace(/>/g, _gt)
        .replace(/"/g, _quot)
        .replace(/'/g, '&#039;');
}

function renderFullAnalysis(analysisData, profile) {
    if (!profile) profile = {};
    evalLog('🎨 renderFullAnalysis — product: ' + (analysisData.product && analysisData.product.name));

    // Save active state globally for filters, sorting, search & exports
    window.activeAnalysisData = analysisData;
    window.activeAdditiveReport = analysisData.additive_regulatory_report || [];

    var container = document.getElementById('productContainer');
    if (!container) {
        evalLog('❌ productContainer element not found!', 'error');
        return;
    }

    try {
        var product                = analysisData.product                || {};
        var nutrition              = analysisData.nutrition              || {};
        var ingredients            = analysisData.ingredients            || [];
        var ingredientExplanations = analysisData.ingredient_explanations|| [];
        var concernScore           = analysisData.concern_score          || { score: 50, level: 'Moderate Concern', factors: [] };
        var allergens              = analysisData.allergens              || [];
        var alerts                 = analysisData.alerts                 || [];
        var personalizedWarnings   = analysisData.personalized_warnings  || [];
        var regulatory             = analysisData.regulatory             || [];
        var news                   = analysisData.news                   || [];
        var nova                   = analysisData.nova                   || { level: 'Unknown', name: 'Not Classified', description: '' };

        evalLog('📊 Data summary:');
        evalLog('   product.name   = ' + product.name);
        evalLog('   ingredients    = ' + ingredients.length);
        evalLog('   allergens      = ' + allergens.length);
        evalLog('   regulatory     = ' + regulatory.length);
        evalLog('   concern_score  = ' + concernScore.score);
        evalLog('   news items     = ' + news.length);

        // Concern Score
        var score       = concernScore.score  || 50;
        var scoreLevel  = concernScore.level  || 'Moderate Concern';
        var scoreFactors= concernScore.factors || [];

        var scoreRingColor = '#10B981';
        if (score >= 70) scoreRingColor = '#EF4444';
        else if (score >= 40) scoreRingColor = '#F59E0B';

        var circumference = 2 * Math.PI * 52;
        var fillOffset    = circumference - (score / 100) * circumference;

        // ── Factor 3: Ingredient Explanations (Collapsible v4.2) ──
        var ingExplHtml = '<div class="ingredients-collapsed-container" id="ingredientsCollapseContainer">';
        if (ingredientExplanations.length > 0) {
            for (var i = 0; i < ingredientExplanations.length; i++) {
                var ing      = ingredientExplanations[i];
                var riskClass= 'risk-safe';
                if (ing.category === 'Preservative' || ing.category === 'Colour') riskClass = 'risk-high';
                else if (ing.category === 'Sweetener' || ing.category === 'Flavour Enhancer') riskClass = 'risk-moderate';

                var isAdditive = false;
                var insLabel = '';
                if (analysisData.additive_regulatory_report) {
                    var match = analysisData.additive_regulatory_report.find(function(a) {
                        return a.name.toLowerCase() === ing.name.toLowerCase() || 
                               (ing.simple_name && a.name.toLowerCase() === ing.simple_name.toLowerCase()) ||
                               ing.name.toLowerCase().includes(a.name.toLowerCase());
                    });
                    if (match) {
                        isAdditive = true;
                        insLabel = match.ins_no;
                    }
                }

                var clickAttr = ' onclick="showIngredientModal(' + i + ')"';

                ingExplHtml += '<div class="ingredient-card ' + riskClass + ' ingredient-chip-interactive" ' + clickAttr + '>';
                ingExplHtml += '<p class="ing-name">' + escHtml(ing.name || '') + ' ';
                if (isAdditive) {
                    ingExplHtml += '<span class="badge bg-warning text-dark ms-2" style="font-size:10px;"><i class="bi bi-shield-exclamation me-1"></i>Additive ' + escHtml(insLabel) + '</span>';
                }
                ingExplHtml += '</p>';
                if (ing.simple_name) ingExplHtml += '<p class="ing-purpose"><strong>Also known as:</strong> ' + escHtml(ing.simple_name) + '</p>';
                if (ing.purpose)     ingExplHtml += '<p class="ing-purpose"><strong>Purpose:</strong> ' + escHtml(ing.purpose) + '</p>';
                if (ing.description) ingExplHtml += '<p class="ing-purpose text-truncate">' + escHtml(ing.description) + '</p>';
                if (ing.category)    ingExplHtml += '<span class="tag-pill mt-2">' + escHtml(ing.category) + '</span>';
                ingExplHtml += '</div>';
            }
        } else {
            ingExplHtml += '<p class="text-muted">No ingredient data available.</p>';
        }
        ingExplHtml += '<div class="ingredients-fade-overlay" id="ingredientsFadeOverlay"></div>';
        ingExplHtml += '</div>';

        if (ingredientExplanations.length > 3) {
            ingExplHtml += '<button class="toggle-ingredients-btn" id="toggleIngredientsBtn" onclick="toggleIngredientsExpand()"><i class="bi bi-chevron-down"></i> Read More</button>';
        }

        // ── Factor 4: Allergen Alerts ──
        var allergenHtml = '';
        if (allergens.length > 0) {
            for (var a = 0; a < allergens.length; a++) {
                var al = allergens[a];
                allergenHtml += '<div class="warning-card danger mb-2">';
                allergenHtml += '<div class="warning-icon"><i class="bi bi-exclamation-triangle-fill"></i></div>';
                allergenHtml += '<div><div class="warning-title">Contains ' + escHtml(al.allergen || '') + '</div>';
                allergenHtml += '<p class="warning-desc">Found in: ' + escHtml(al.found_in || '') + '</p></div></div>';
            }
        } else {
            allergenHtml = '<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i><strong>No common allergens detected</strong> in the ingredient list.</div>';
        }

        // ── Factor 5: Personalized Warnings ──
        var warningsHtml = '';
        if (personalizedWarnings.length > 0) {
            for (var w = 0; w < personalizedWarnings.length; w++) {
                var warn  = personalizedWarnings[w];
                var wType = warn.type === 'red' ? 'danger' : 'caution';
                var wIcon = warn.type === 'red' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill';
                warningsHtml += '<div class="warning-card ' + wType + '">';
                warningsHtml += '<div class="warning-icon"><i class="bi bi-' + wIcon + '"></i></div>';
                warningsHtml += '<div><div class="warning-title">' + escHtml(warn.title || 'Warning') + '</div>';
                warningsHtml += '<p class="warning-desc">' + escHtml(warn.description || '') + '</p></div></div>';
            }
        } else {
            warningsHtml = '<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i><strong>No personalized warnings</strong> based on your health profile.</div>';
        }

        // ── Factor 6: Regulatory Status ──
        var regHtml = '';
        if (regulatory.length > 0) {
            for (var r = 0; r < regulatory.length; r++) {
                var reg = regulatory[r];
                regHtml += '<div class="factor-detail-card mb-3" style="background:var(--gray-100);padding:16px;border-radius:14px;">';
                regHtml += '<h5 style="font-weight:700;margin-bottom:10px;">' + escHtml(reg.ingredient) + '</h5>';
                regHtml += '<div class="reg-pills">';
                var statuses = reg.regulatory_status || [];
                for (var s = 0; s < statuses.length; s++) {
                    var rs  = statuses[s];
                    var cls = rs.status === 'Allowed' ? 'approved' : (rs.status === 'Banned' ? 'banned' : 'review');
                    var icon= rs.status === 'Allowed' ? 'check-circle-fill' : (rs.status === 'Banned' ? 'x-circle-fill' : 'exclamation-circle-fill');
                    regHtml += '<span class="reg-pill ' + cls + '"><i class="bi bi-' + icon + '"></i> ' + escHtml(rs.country) + ' — ' + escHtml(rs.status) + '</span>';
                }
                regHtml += '</div>';
                if (reg.notes) regHtml += '<p class="text-muted small mt-2">' + escHtml(reg.notes) + '</p>';
                regHtml += '</div>';
            }
        } else {
            regHtml = '<p class="text-muted">No verified regulatory information available for the detected ingredients.</p>';
        }

        // News / Recalls
        var newsHtml = '';
        if (news.length > 0) {
            for (var n = 0; n < news.length; n++) {
                var newsItem = news[n];
                newsHtml += '<div class="warning-card caution mb-2">';
                newsHtml += '<div class="warning-icon"><i class="bi bi-newspaper"></i></div>';
                newsHtml += '<div><div class="warning-title">' + escHtml(newsItem.title || 'News') + '</div>';
                newsHtml += '<p class="warning-desc">';
                if (newsItem.source) newsHtml += '<strong>Source:</strong> ' + escHtml(newsItem.source);
                if (newsItem.date)   newsHtml += ' - ' + escHtml(newsItem.date);
                if (newsItem.link)   newsHtml += '<br><a href="' + escHtml(newsItem.link) + '" target="_blank" style="color:var(--primary-emerald);">Read more</a>';
                newsHtml += '</p></div></div>';
            }
        } else {
            newsHtml = '<div class="alert alert-success"><i class="bi bi-shield-check-fill me-2"></i><strong>No recent recalls or safety notices</strong> found for this product.</div>';
        }

        // Nutrition table
        var nutritionHtml = buildNutritionTable(nutrition);

        // Concern Factors list
        var factorsHtml = '';
        if (scoreFactors.length > 0) {
            factorsHtml = '<ul style="margin:0;padding-left:20px;">';
            for (var f = 0; f < scoreFactors.length; f++) {
                factorsHtml += '<li style="color:var(--gray-700);margin-bottom:4px;">' + escHtml(scoreFactors[f]) + '</li>';
            }
            factorsHtml += '</ul>';
        } else {
            factorsHtml = '<p class="text-muted small">No specific concern factors identified.</p>';
        }

        // NOVA
        var novaHtml = '';
        if (nova.level !== 'Unknown') {
            novaHtml = '<span class="tag-pill" style="background:rgba(16,185,129,0.1);color:#059669;">NOVA ' + nova.level + ': ' + escHtml(nova.name) + '</span>';
        }

        // AI Summary
        var aiSummary = analysisData.ai_summary || generateAISummary(product, nutrition, score, alerts);

        // ════════════════════════════════════════════════
        // BUILD THE FULL DASHBOARD — 6 Factor Cards
        // ════════════════════════════════════════════════
        var html = '';

        // ── Product Header Card ──
        html += '<div class="product-header-card fade-in mb-4">';
        html += '<div class="product-image-large">';
        if (product.image_url) {
            html += '<img src="' + escHtml(product.image_url) + '" alt="' + escHtml(product.name || '') + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'">';
        } else {
            html += '<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--gray-100);border-radius:16px;"><i class="bi bi-box" style="font-size:5rem;color:var(--gray-300);"></i></div>';
        }
        html += '</div>';
        html += '<div class="product-header-info">';
        html += '<h1 class="product-title">' + escHtml(product.name || 'Unknown Product') + '</h1>';
        html += '<p class="product-brand-large" style="color:var(--gray-500);font-size:1.1rem;">' + escHtml(product.brand || 'Unknown Brand') + '</p>';
        html += '<div class="product-meta">';
        html += '<span><i class="bi bi-tag text-success"></i> ' + escHtml((Array.isArray(product.categories) ? product.categories.join(', ') : product.categories) || 'Food') + '</span>';
        html += '<span><i class="bi bi-database text-muted"></i> Source: ' + escHtml(product.source || 'OpenFoodFacts') + '</span>';
        html += novaHtml;
        html += '</div>';
        if (product.health_note)     html += '<div class="mt-2 p-2" style="background:rgba(16,185,129,0.08);border-radius:10px;font-size:13px;color:#065f46;"><i class="bi bi-heart-pulse me-1"></i>' + escHtml(product.health_note) + '</div>';
        if (product.key_differences) html += '<div class="mt-2 p-2" style="background:rgba(59,130,246,0.08);border-radius:10px;font-size:13px;color:#1e40af;"><i class="bi bi-info-circle me-1"></i><strong>India vs Global:</strong> ' + escHtml(product.key_differences) + '</div>';
        if (product.consumer_note)   html += '<div class="mt-2 p-2" style="background:rgba(245,158,11,0.08);border-radius:10px;font-size:13px;color:#92400e;"><i class="bi bi-lightbulb me-1"></i>' + escHtml(product.consumer_note) + '</div>';
        html += '</div></div>';

        // ── Factor 1: Concern Score ──
        html += '<div class="factor-detail-card fade-in-up stagger-1">';
        html += '<div class="factor-header"><div class="factor-icon-lg"><i class="bi bi-speedometer2"></i></div>';
        html += '<div><h3>Concern Score</h3><p class="factor-subtitle">Rule-based risk assessment (0–100). Higher = More Concern.</p></div></div>';
        html += '<div class="factor-body">';
        html += '<div class="concern-score-block">';
        html += '<div class="score-ring-container">';
        html += '<svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">';
        html += '<circle class="score-ring-bg" cx="60" cy="60" r="52"/>';
        html += '<circle class="score-ring-fill" cx="60" cy="60" r="52" stroke="' + scoreRingColor + '" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + fillOffset + '"/>';
        html += '</svg>';
        html += '<div class="score-ring-text"><span class="score-ring-num" style="color:' + scoreRingColor + ';">' + score + '</span><span class="score-ring-label">/ 100</span></div>';
        html += '</div>';
        html += '<div class="score-description" style="flex:1;">';
        html += '<h4 style="font-size:1.2rem;font-weight:700;margin-bottom:8px;color:' + scoreRingColor + ';">' + escHtml(scoreLevel) + '</h4>';
        html += '<div class="progress-bar-custom mb-3" style="height:10px;"><div class="progress-fill" style="width:' + score + '%;background:' + scoreRingColor + ';"></div></div>';
        html += '<p class="text-muted small" style="font-weight:600;margin-bottom:6px;">Contributing factors:</p>';
        html += factorsHtml;
        html += '</div></div></div></div>';

        // ── Factor 2: Nutrition Facts ──
        html += '<div class="factor-detail-card fade-in-up stagger-2">';
        html += '<div class="factor-header"><div class="factor-icon-lg" style="background:linear-gradient(135deg,#06B6D4,#0891B2);"><i class="bi bi-bar-chart-fill"></i></div>';
        html += '<div><h3>Nutrition Facts</h3><p class="factor-subtitle">Per 100g serving</p></div></div>';
        html += '<div class="factor-body">' + nutritionHtml + '</div></div>';

        // ── Factor 3: Ingredient Breakdown ──
        html += '<div class="factor-detail-card fade-in-up stagger-3">';
        html += '<div class="factor-header"><div class="factor-icon-lg" style="background:linear-gradient(135deg,#3B82F6,#2563EB);"><i class="bi bi-clipboard-data"></i></div>';
        html += '<div><h3>Ingredient Breakdown</h3><p class="factor-subtitle">' + ingredients.length + ' ingredients detected</p></div></div>';
        html += '<div class="factor-body">' + ingExplHtml;
        html += '<hr style="margin:1rem 0;"><p class="text-muted small"><strong>Full ingredient list:</strong> ' + escHtml(ingredients.join(', ') || 'Not available') + '</p>';
        html += '</div></div>';

        // ── Factor 4: Allergen Alerts ──
        html += '<div class="factor-detail-card fade-in-up stagger-4" style="border-color:' + (allergens.length ? 'rgba(239,68,68,0.3)' : 'var(--gray-200)') + ';">';
        html += '<div class="factor-header" style="background:' + (allergens.length ? 'rgba(239,68,68,0.05)' : 'var(--light-gray)') + ';">';
        html += '<div class="factor-icon-lg" style="background:linear-gradient(135deg,#EF4444,#B91C1C);"><i class="bi bi-exclamation-triangle"></i></div>';
        html += '<div><h3>Allergen Alerts</h3><p class="factor-subtitle">Detected potential allergens in ingredient list</p></div></div>';
        html += '<div class="factor-body">' + allergenHtml + '</div></div>';

        // ── Factor 5: Personalized Warnings ──
        var hasRedWarning = personalizedWarnings.some(function(w) { return w.type === 'red'; });
        html += '<div class="factor-detail-card fade-in-up stagger-5" style="border-color:' + (hasRedWarning ? 'rgba(239,68,68,0.3)' : 'var(--gray-200)') + ';">';
        html += '<div class="factor-header" style="background:' + (hasRedWarning ? 'rgba(239,68,68,0.05)' : 'var(--light-gray)') + ';">';
        html += '<div class="factor-icon-lg" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><i class="bi bi-person-exclamation"></i></div>';
        html += '<div><h3>Personalized Warnings</h3><p class="factor-subtitle">Based on your health profile</p></div></div>';
        html += '<div class="factor-body">' + warningsHtml + '</div></div>';

        // ── Factor 6: Global Regulatory Status (Interactive bottom-sheet v4.2) ──
        // Store regulatory HTML in global variable
        window.activeRegulatoryHtml = regHtml;

        html += '<div class="factor-detail-card fade-in-up stagger-6" style="cursor:pointer;" onclick="openRegulatoryBottomSheet()">';
        html += '<div class="factor-header"><div class="factor-icon-lg" style="background:linear-gradient(135deg,#8B5CF6,#7C3AED);"><i class="bi bi-globe-americas"></i></div>';
        html += '<div><h3>Global Regulatory Status</h3><p class="factor-subtitle">Click to view cross-country compliance and additive safety report</p></div>';
        html += '<div class="ms-auto text-muted"><i class="bi bi-chevron-right fs-4"></i></div></div>';
        html += '<div class="factor-body">' + regHtml + '</div></div>';

        // ── Safety Alerts & Recalls ──
        html += '<div class="factor-detail-card fade-in-up stagger-7">';
        html += '<div class="factor-header"><div class="factor-icon-lg" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><i class="bi bi-megaphone-fill"></i></div>';
        html += '<div><h3>Safety Alerts &amp; Recalls</h3><p class="factor-subtitle">Official recall notices and safety news</p></div></div>';
        html += '<div class="factor-body">' + newsHtml + '</div></div>';

        // ── AI Summary ──
        html += '<div class="factor-detail-card fade-in-up stagger-7">';
        html += '<div class="factor-header"><div class="factor-icon-lg" style="background:linear-gradient(135deg,#10B981,#059669);"><i class="bi bi-robot"></i></div>';
        html += '<div><h3>AI Summary</h3><p class="factor-subtitle">Simplified overview based on verified data</p></div></div>';
        html += '<div class="factor-body"><div style="background:var(--gray-100);border-radius:14px;padding:20px;line-height:1.7;">' + escHtml(aiSummary) + '</div></div></div>';

        // ── Decision Banner ──
        html += '<div class="decision-banner fade-in-up stagger-7">';
        html += '<h4>Your Decision Matters</h4>';
        html += '<p>Label Padegha Sabh provides transparent, data-driven insights — not a verdict. You are empowered to make the best choice for yourself.</p>';
        html += '</div>';

        // ── AI CTA ──
        html += '<div class="ai-cta-section fade-in-up stagger-7">';
        html += '<div class="ai-cta-text"><h3>Have questions? Ask the AI</h3>';
        html += '<p>Get deeper insights about this product\'s ingredients, health impacts, and alternatives.</p>';
        html += '<a href="ai-chat.html" class="btn mt-3" style="background:#fff;color:var(--primary-emerald);font-weight:700;border-radius:12px;padding:10px 24px;">';
        html += '<i class="bi bi-chat-dots-fill me-2"></i>Open AI Chat</a></div>';
        html += '<i class="bi bi-robot ai-cta-icon"></i></div>';

        container.innerHTML = html;
        container.style.display = 'block';

        evalLog('✅ UI updated — all 6 factor cards rendered successfully', 'info');

        // Save context for AI chat
        try {
            localStorage.setItem('lps_ai_context', JSON.stringify({
                name:         product.name,
                brand:        product.brand,
                ingredients:  ingredients,
                concern_score:score,
                allergens:    alerts,
                nutrition:    nutrition
            }));
        } catch (e) {}

    } catch (err) {
        evalLog('❌ renderFullAnalysis crashed: ' + err.message, 'error');
        console.error('[ProductEval] Render error detail:', err);
        container.innerHTML  = '<div class="error-card"><i class="bi bi-exclamation-circle"></i><h4>Analysis Preview Available</h4>';
        container.innerHTML += '<p class="text-muted">We received product information, but the full dashboard could not be rendered.</p>';
        container.innerHTML += '<div class="mt-3 text-start">';
        container.innerHTML += '<strong>' + escHtml((analysisData && analysisData.product && analysisData.product.name) || 'Unknown Product') + '</strong>';
        container.innerHTML += '<p class="text-muted mb-0">' + escHtml((analysisData && analysisData.ingredients || []).join(', ') || 'No details available.') + '</p>';
        container.innerHTML += '</div></div>';
        container.style.display = 'block';
    }
}

// ═══════════════════════════════════════════════════════════
// AI Summary Generator (rule-based fallback, no API needed)
// ═══════════════════════════════════════════════════════════
function generateAISummary(product, nutrition, score, alerts) {
    var name     = product.name  || 'this product';
    var brand    = product.brand || '';
    var scoreVal = score || 50;

    var summary = name;
    if (brand) summary += ' by ' + brand;
    summary += '. ';

    if (scoreVal <= 20)      summary += 'This product has a low concern score, suggesting it may be a reasonable choice for most consumers. ';
    else if (scoreVal <= 50) summary += 'This product has a moderate concern score. ';
    else if (scoreVal <= 80) summary += 'This product has a high concern score. ';
    else                     summary += 'This product has a very high concern score. ';

    if (alerts && alerts.length > 0) {
        summary += 'It contains potential allergens: ' + alerts.join(', ') + '. ';
        summary += 'If you have known allergies, please check the ingredient list carefully. ';
    }

    var sugar = nutrition.sugars_100g;
    var salt  = nutrition.salt_100g;
    var fiber = nutrition.fiber_100g;

    if (sugar !== undefined) {
        if (sugar > 15)     summary += 'Sugar content is high at ' + sugar + 'g per 100g. ';
        else if (sugar > 5) summary += 'Contains ' + sugar + 'g of sugar per 100g. ';
        else                summary += 'Sugar content is relatively low at ' + sugar + 'g per 100g. ';
    }
    if (salt !== undefined) {
        if (salt > 1.5)     summary += 'Sodium content is high at ' + salt + 'g per 100g. ';
        else if (salt > 0.5)summary += 'Contains ' + salt + 'g of salt per 100g. ';
    }
    if (fiber !== undefined && fiber > 3) {
        summary += 'Good source of dietary fiber (' + fiber + 'g per 100g). ';
    }

    summary += 'Always consider your personal dietary needs and consult healthcare professionals for personalized advice.';
    return summary;
}

// ═══════════════════════════════════════════════════════════
// Nutrition Table Builder
// ═══════════════════════════════════════════════════════════
function buildNutritionTable(nutrition) {
    var key_map = {
        'energy-kcal_100g':    ['Calories (kcal)', 'kcal'],
        'energy_100g':         ['Energy (kJ)',      'kJ'],
        'proteins_100g':       ['Protein',          'g'],
        'carbohydrates_100g':  ['Carbohydrates',    'g'],
        'sugars_100g':         ['of which Sugars',  'g'],
        'fat_100g':            ['Fat',              'g'],
        'saturated-fat_100g':  ['Saturated Fat',    'g'],
        'fiber_100g':          ['Dietary Fiber',    'g'],
        'sodium_100g':         ['Sodium',           'g'],
        'salt_100g':           ['Salt',             'g'],
        'calcium_100g':        ['Calcium',          'mg'],
        'iron_100g':           ['Iron',             'mg'],
    };

    var n = nutrition;
    if (Array.isArray(n)) {
        var obj = {};
        for (var i = 0; i < n.length; i++) {
            var item = n[i];
            var k    = (item.nutrientName || '').toLowerCase().replace(/ /g, '_') + '_100g';
            obj[k]   = item.amount;
        }
        n = obj;
    }

    var rows = '';
    var keys = Object.keys(key_map);
    for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        if (n[key] === undefined || n[key] === null) continue;
        var label = key_map[key][0];
        var unit  = key_map[key][1];
        var val   = parseFloat(n[key] || 0).toFixed(2);

        var lvlClass = '';
        if      (key.indexOf('sugars')    >= 0 && val > 15)  lvlClass = 'nutriment-level-high';
        else if (key.indexOf('sugars')    >= 0 && val > 5)   lvlClass = 'nutriment-level-moderate';
        else if (key.indexOf('salt')      >= 0 && val > 1.5) lvlClass = 'nutriment-level-high';
        else if (key.indexOf('salt')      >= 0 && val > 0.5) lvlClass = 'nutriment-level-moderate';
        else if (key.indexOf('saturated') >= 0 && val > 5)   lvlClass = 'nutriment-level-high';
        else if (key.indexOf('fiber')     >= 0 && val > 3)   lvlClass = 'nutriment-level-low';

        rows += '<div class="nutriment-row">';
        rows += '<span class="nutriment-key">' + label + '</span>';
        rows += '<span class="nutriment-val ' + lvlClass + '">' + val + ' ' + unit + '</span>';
        rows += '</div>';
    }

    if (rows.length === 0) {
        return '<p class="text-muted">No nutrition data available for this product.</p>';
    }
    return '<div class="nutriment-table">' + rows + '</div>';
}

// ═══════════════════════════════════════════════════════════
// ADDITIVE SAFETY & COLLAPSE SCRIPTS (v4.2)
// ═══════════════════════════════════════════════════════════

function toggleIngredientsExpand() {
    var container = document.getElementById('ingredientsCollapseContainer');
    var btn = document.getElementById('toggleIngredientsBtn');
    var overlay = document.getElementById('ingredientsFadeOverlay');
    if (!container || !btn) return;
    
    if (container.classList.contains('expanded')) {
        container.classList.remove('expanded');
        if (overlay) overlay.style.display = 'block';
        btn.innerHTML = '<i class="bi bi-chevron-down"></i> Read More';
    } else {
        container.classList.add('expanded');
        if (overlay) overlay.style.display = 'none';
        btn.innerHTML = '<i class="bi bi-chevron-up"></i> Show Less';
    }
}

function showIngredientModal(index) {
    var data = window.activeAnalysisData;
    if (!data || !data.ingredient_explanations || !data.ingredient_explanations[index]) return;
    var ing = data.ingredient_explanations[index];
    
    var body = document.getElementById('ingredientDetailModalBody');
    if (!body) return;
    
    var html = '';
    html += '<h4 class="mb-2" style="font-weight:800;color:var(--gray-900);">' + escHtml(ing.name) + '</h4>';
    if (ing.simple_name) {
        html += '<p class="text-muted mb-3" style="font-size:14px;"><strong>Also known as:</strong> ' + escHtml(ing.simple_name) + '</p>';
    }
    
    var badgeClass = 'bg-success';
    if (ing.category === 'Preservative' || ing.category === 'Colour') badgeClass = 'bg-danger';
    else if (ing.category === 'Sweetener' || ing.category === 'Flavour Enhancer') badgeClass = 'bg-warning text-dark';
    
    html += '<div class="d-flex gap-2 mb-4">';
    if (ing.category) {
        html += '<span class="badge ' + badgeClass + ' px-3 py-2" style="border-radius:50px; font-size:11px;">' + escHtml(ing.category) + '</span>';
    }
    
    var additive = (data.additive_regulatory_report || []).find(function(a) {
        return a.name.toLowerCase() === ing.name.toLowerCase() || 
               (ing.simple_name && a.name.toLowerCase() === ing.simple_name.toLowerCase()) ||
               ing.name.toLowerCase().includes(a.name.toLowerCase());
    });
    
    if (additive) {
        html += '<span class="badge bg-dark px-3 py-2" style="border-radius:50px; font-size:11px;">INS ' + escHtml(additive.ins_no) + '</span>';
    }
    html += '</div>';
    
    if (ing.purpose) {
        html += '<div class="mb-3"><strong>Purpose / Function:</strong><p class="text-muted mt-1" style="font-size:13px;">' + escHtml(ing.purpose) + '</p></div>';
    }
    if (ing.description) {
        html += '<div class="mb-3"><strong>Health &amp; Safety Description:</strong><p class="text-muted mt-1" style="line-height:1.6; font-size:13px;">' + escHtml(ing.description) + '</p></div>';
    }
    
    if (additive) {
        html += '<hr>';
        html += '<h6 class="mb-3" style="font-weight:700;"><i class="bi bi-shield-check text-success me-1"></i>Regulatory Summary</h6>';
        html += '<ul class="list-group list-group-flush mb-4" style="font-size:13px;">';
        html += '<li class="list-group-item d-flex justify-content-between align-items-center py-2 px-0 bg-transparent"><span>India (FSSAI)</span><span class="badge ' + getStatusBadgeClass(additive.countries["India (FSSAI)"].status) + '">' + additive.countries["India (FSSAI)"].status + '</span></li>';
        html += '<li class="list-group-item d-flex justify-content-between align-items-center py-2 px-0 bg-transparent"><span>USA (FDA)</span><span class="badge ' + getStatusBadgeClass(additive.countries["USA (FDA)"].status) + '">' + additive.countries["USA (FDA)"].status + '</span></li>';
        html += '<li class="list-group-item d-flex justify-content-between align-items-center py-2 px-0 bg-transparent"><span>European Union</span><span class="badge ' + getStatusBadgeClass(additive.countries["European Union (EFSA)"].status) + '">' + additive.countries["European Union (EFSA)"].status + '</span></li>';
        html += '</ul>';
        html += '<div class="text-center mt-3">';
        html += '<button class="btn btn-sm" style="border-radius:50px; background:var(--gradient-primary); color:#fff; border:none;" onclick="closeAllModalsAndOpenRegBottomSheet()"><i class="bi bi-file-earmark-bar-graph me-1"></i>View Full Additive Report</button>';
        html += '</div>';
    }
    
    body.innerHTML = html;
    var modal = new bootstrap.Modal(document.getElementById('ingredientDetailModal'));
    modal.show();
}

function getStatusBadgeClass(status) {
    if (status === 'Approved') return 'bg-success';
    if (status === 'Restricted') return 'bg-warning text-dark';
    if (status === 'Banned') return 'bg-danger';
    return 'bg-secondary';
}

function closeAllModalsAndOpenRegBottomSheet() {
    var ingModalEl = document.getElementById('ingredientDetailModal');
    var ingModal = bootstrap.Modal.getInstance(ingModalEl);
    if (ingModal) ingModal.hide();
    
    openRegulatoryBottomSheet();
    
    var tabEl = document.getElementById('additive-report-tab');
    var tab = new bootstrap.Tab(tabEl);
    tab.show();
}

function openRegulatoryBottomSheet() {
    var targetContainer = document.getElementById('foodRegulationsTabContent');
    if (targetContainer) {
        targetContainer.innerHTML = window.activeRegulatoryHtml || '<p class="text-muted">No verified regulatory information available.</p>';
    }
    
    renderAdditiveReport();
    
    var modalEl = document.getElementById('regulatoryBottomSheet');
    var modal = bootstrap.Modal.getInstance(modalEl);
    if (!modal) {
        modal = new bootstrap.Modal(modalEl);
    }
    modal.show();
}

function renderAdditiveReport() {
    var additives = window.activeAdditiveReport || [];
    var searchVal = (document.getElementById('additiveSearchInput') ? document.getElementById('additiveSearchInput').value.toLowerCase() : '').trim();
    var filterCountryVal = document.getElementById('filterCountry') ? document.getElementById('filterCountry').value : '';
    var filterStatusVal = document.getElementById('filterStatus') ? document.getElementById('filterStatus').value : '';
    var filterRiskVal = document.getElementById('filterRisk') ? document.getElementById('filterRisk').value : '';
    var sortVal = document.getElementById('sortAdditives') ? document.getElementById('sortAdditives').value : 'alphabetical';

    var filtered = additives.filter(function(a) {
        var matchesSearch = !searchVal || 
                            a.name.toLowerCase().includes(searchVal) || 
                            a.ins_no.toLowerCase().includes(searchVal) ||
                            a.category.toLowerCase().includes(searchVal);
        
        var matchesCountryAndStatus = true;
        if (filterCountryVal) {
            var cData = a.countries[filterCountryVal];
            if (!cData) {
                matchesCountryAndStatus = false;
            } else if (filterStatusVal && cData.status !== filterStatusVal) {
                matchesCountryAndStatus = false;
            }
        } else if (filterStatusVal) {
            var statuses = Object.values(a.countries).map(function(c) { return c.status; });
            if (!statuses.includes(filterStatusVal)) {
                matchesCountryAndStatus = false;
            }
        }
        
        var matchesRisk = !filterRiskVal || a.risk_level === filterRiskVal;

        return matchesSearch && matchesCountryAndStatus && matchesRisk;
    });

    filtered.sort(function(x, y) {
        if (sortVal === 'alphabetical') {
            return x.name.localeCompare(y.name);
        } else if (sortVal === 'risk-desc') {
            var riskWeight = { "High Risk": 3, "Moderate Risk": 2, "Low Risk": 1 };
            return (riskWeight[y.risk_level] || 0) - (riskWeight[x.risk_level] || 0);
        } else if (sortVal === 'strictness') {
            var getStrictnessScore = function(item) {
                var score = 0;
                Object.values(item.countries).forEach(function(c) {
                    if (c.status === 'Banned') score += 5;
                    else if (c.status === 'Restricted') score += 2;
                });
                return score;
            };
            return getStrictnessScore(y) - getStrictnessScore(x);
        }
        return 0;
    });

    renderAdditiveStats(additives);

    var listContainer = document.getElementById('additiveReportList');
    if (!listContainer) return;

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="text-center py-5 border rounded-4 bg-white mt-3">' +
                                  '<i class="bi bi-shield-check text-muted" style="font-size: 3rem;"></i>' +
                                  '<h5 class="mt-3 text-muted" style="font-weight:700;">No Food Additives Requiring Regulatory Review Were Detected</h5>' +
                                  '<p class="text-muted mb-0">No food additives matching the search/filters requiring regulatory review were detected.</p>' +
                                  '</div>';
        return;
    }

    var html = '<div class="accordion" id="additiveAccordion">';
    for (var j = 0; j < filtered.length; j++) {
        var add = filtered[j];
        var riskIcon = '🟢';
        var riskBadgeClass = 'bg-success';
        if (add.risk_level === 'High Risk') {
            riskIcon = '🔴';
            riskBadgeClass = 'bg-danger';
        } else if (add.risk_level === 'Moderate Risk') {
            riskIcon = '🟡';
            riskBadgeClass = 'bg-warning text-dark';
        }

        var isFssaiOk = add.countries["India (FSSAI)"].status === 'Approved' ? '🟢' : (add.countries["India (FSSAI)"].status === 'Banned' ? '🔴' : '🟡');

        html += '<div class="accordion-item mb-3 border rounded-4 overflow-hidden shadow-sm">';
        html += '<h2 class="accordion-header">';
        html += '<button class="accordion-button collapsed px-4 py-3 d-flex align-items-center" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAdd-' + j + '" aria-expanded="false" aria-controls="collapseAdd-' + j + '">';
        html += '<div class="d-flex align-items-center w-100">';
        html += '<div class="me-3" style="font-size:1.5rem;">' + riskIcon + '</div>';
        html += '<div class="text-start">';
        html += '<h5 class="mb-1" style="font-weight: 700; color: var(--gray-900);">' + escHtml(add.name) + ' <span class="badge bg-secondary ms-2" style="font-size: 11px;">' + escHtml(add.ins_no) + '</span></h5>';
        html += '<p class="text-muted mb-0 small"><strong>Function:</strong> ' + escHtml(add.category) + ' | <strong>FSSAI Status:</strong> ' + isFssaiOk + ' ' + add.countries["India (FSSAI)"].status + '</p>';
        html += '</div>';
        html += '<div class="ms-auto me-3"><span class="badge ' + riskBadgeClass + ' px-3 py-1.5" style="border-radius: 50px;">' + add.risk_level + '</span></div>';
        html += '</div>';
        html += '</button></h2>';

        html += '<div id="collapseAdd-' + j + '" class="accordion-collapse collapse" data-bs-parent="#additiveAccordion">';
        html += '<div class="accordion-body p-4 bg-white border-top">';
        
        html += '<div class="row g-4 mb-4">';
        html += '<div class="col-md-6">';
        html += '<table class="table table-sm table-borderless">';
        html += '<tr><td style="width:180px;"><strong>Purpose / Function:</strong></td><td class="text-muted">' + escHtml(add.purpose) + '</td></tr>';
        html += '<tr><td><strong>Safety Status:</strong></td><td class="text-muted">' + escHtml(add.safety_status) + '</td></tr>';
        html += '<tr><td><strong>Acceptable Daily Intake (ADI):</strong></td><td class="text-muted">' + escHtml(add.adi) + '</td></tr>';
        html += '<tr><td><strong>Maximum permitted limit:</strong></td><td class="text-muted">' + escHtml(add.max_limit) + '</td></tr>';
        html += '</table></div>';
        
        html += '<div class="col-md-6">';
        html += '<table class="table table-sm table-borderless">';
        html += '<tr><td style="width:180px;"><strong>Detected quantity:</strong></td><td class="text-muted">' + escHtml(add.detected_qty) + '</td></tr>';
        html += '<tr><td><strong>Exceeds limit:</strong></td><td class="text-muted">' + escHtml(add.exceeds_limit) + '</td></tr>';
        html += '<tr><td><strong>Allergy warnings:</strong></td><td class="text-muted"><span class="text-danger">' + escHtml(add.allergy_warnings) + '</span></td></tr>';
        html += '<tr><td><strong>Special populations:</strong></td><td class="text-muted"><span class="text-warning">' + escHtml(add.special_population_warnings) + '</span></td></tr>';
        html += '</table></div></div>';

        html += '<div class="p-3 bg-light rounded-4 mb-4 border">';
        html += '<h6 style="font-weight:700;"><i class="bi bi-journal-text me-1 text-primary"></i>Scientific Notes &amp; Observations</h6>';
        html += '<p class="text-muted mb-0 small" style="line-height:1.6;">' + escHtml(add.scientific_notes) + '</p>';
        html += '<h6 class="mt-3" style="font-weight:700;"><i class="bi bi-heart-pulse-fill me-1 text-danger"></i>Health Considerations</h6>';
        html += '<p class="text-muted mb-0 small" style="line-height:1.6;">' + escHtml(add.health_considerations) + '</p>';
        html += '</div>';

        html += '<h6 class="mb-3" style="font-weight:700;"><i class="bi bi-globe2 me-1 text-success"></i>Country-wise Approval &amp; Limits</h6>';
        html += '<div class="table-responsive-container mb-2">';
        html += '<table class="table table-hover align-middle mb-0" style="font-size:13px;">';
        html += '<thead class="table-light"><tr>';
        html += '<th>Country / Region</th>';
        html += '<th>Regulatory Authority</th>';
        html += '<th>Approval Status</th>';
        html += '<th>Maximum Allowed Limit</th>';
        html += '<th>Notes</th>';
        html += '</tr></thead><tbody>';

        var cKeys = Object.keys(add.countries);
        for (var k = 0; k < cKeys.length; k++) {
            var cName = cKeys[k];
            var cInfo = add.countries[cName];
            var cBadge = 'bg-secondary';
            var cIcon = '⚪';
            if (cInfo.status === 'Approved') {
                cBadge = 'bg-success-subtle text-success border border-success-subtle';
                cIcon = '🟢';
            } else if (cInfo.status === 'Restricted') {
                cBadge = 'bg-warning-subtle text-warning border border-warning-subtle';
                cIcon = '🟡';
            } else if (cInfo.status === 'Banned') {
                cBadge = 'bg-danger-subtle text-danger border border-danger-subtle';
                cIcon = '🔴';
            }

            var cNotes = cInfo.notes || 'Data Not Available';

            html += '<tr>';
            html += '<td><strong>' + escHtml(cName) + '</strong></td>';
            html += '<td><span class="text-muted">' + escHtml(cInfo.authority) + '</span></td>';
            html += '<td><span class="badge ' + cBadge + ' px-2.5 py-1" style="font-size:11px;">' + cIcon + ' ' + cInfo.status + '</span></td>';
            html += '<td><code style="font-size:12px;color:var(--gray-700);">' + escHtml(cInfo.limit) + '</code></td>';
            html += '<td><span class="text-muted small">' + escHtml(cNotes) + '</span></td>';
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        if (add.recalls && add.recalls.length > 0) {
            html += '<div class="alert alert-danger mt-3 mb-0" style="border-radius:12px; border: 1px solid rgba(220,53,69,0.2);">';
            html += '<h6 style="font-weight:700;"><i class="bi bi-exclamation-octagon-fill me-1"></i>Historic Recall Safety Alert!</h6>';
            html += '<p class="small mb-2">Recall actions have been reported internationally for matching contaminants/brands:</p>';
            html += '<ul class="mb-0 ps-3 small">';
            for (var rc = 0; rc < add.recalls.length; rc++) {
                var rNotice = add.recalls[rc];
                html += '<li><strong>Brand:</strong> ' + escHtml(rNotice.brand) + ' - ' + escHtml(rNotice.product) + ' | <strong>Hazard:</strong> ' + escHtml(rNotice.hazard) + ' (' + escHtml(rNotice.reason) + ') - ' + escHtml(rNotice.action) + '</li>';
            }
            html += '</ul></div>';
        }

        html += '</div></div></div>';
    }
    html += '</div>';
    listContainer.innerHTML = html;

    if (!window.areAdditiveEventsBound) {
        document.getElementById('additiveSearchInput').addEventListener('input', renderAdditiveReport);
        document.getElementById('filterCountry').addEventListener('change', renderAdditiveReport);
        document.getElementById('filterStatus').addEventListener('change', renderAdditiveReport);
        document.getElementById('filterRisk').addEventListener('change', renderAdditiveReport);
        document.getElementById('sortAdditives').addEventListener('change', renderAdditiveReport);
        
        document.getElementById('btnExportCSV').addEventListener('click', function(e) {
            e.preventDefault();
            exportAdditiveReport('csv');
        });
        document.getElementById('btnExportPDF').addEventListener('click', function(e) {
            e.preventDefault();
            exportAdditiveReport('pdf');
        });
        
        window.areAdditiveEventsBound = true;
    }
}

function renderAdditiveStats(additives) {
    var statsContainer = document.getElementById('additiveStatsContainer');
    if (!statsContainer) return;

    var total = additives.length;
    var approved = 0;
    var restricted = 0;
    var banned = 0;

    var stricterCountries = new Set();

    additives.forEach(function(a) {
        var fssaiStatus = a.countries["India (FSSAI)"].status;
        
        if (a.safety_status === 'Approved') approved++;
        else if (a.safety_status === 'Restricted') restricted++;
        else if (a.safety_status === 'Banned') banned++;

        Object.keys(a.countries).forEach(function(cName) {
            var cStatus = a.countries[cName].status;
            if (fssaiStatus === 'Approved' && (cStatus === 'Restricted' || cStatus === 'Banned')) {
                stricterCountries.add(cName.replace(/ \(.+\)/g, ''));
            } else if (fssaiStatus === 'Restricted' && cStatus === 'Banned') {
                stricterCountries.add(cName.replace(/ \(.+\)/g, ''));
            }
        });
    });

    var compScore = 100;
    if (total > 0) {
        compScore = Math.max(0, 100 - (banned * 25) - (restricted * 10));
    }

    var strictStr = stricterCountries.size > 0 ? Array.from(stricterCountries).join(', ') : 'None';

    var html = '';
    html += '<div class="col-md-3 col-sm-6"><div class="stat-card-custom">';
    html += '<div class="stat-card-icon" style="background:var(--gradient-primary);"><i class="bi bi-funnel-fill"></i></div>';
    html += '<div><span class="text-muted small" style="font-size:11px;">Total Detected</span><h4 class="mb-0 mt-1" style="font-weight:800; font-size:1.4rem;">' + total + '</h4></div>';
    html += '</div></div>';

    html += '<div class="col-md-3 col-sm-6"><div class="stat-card-custom">';
    html += '<div class="stat-card-icon bg-success"><i class="bi bi-shield-check"></i></div>';
    html += '<div><span class="text-muted small" style="font-size:11px;">Approved / Restr / Ban</span>';
    html += '<h4 class="mb-0 mt-1" style="font-weight:800; font-size:1.15rem;"><span class="text-success">' + approved + '</span> / <span class="text-warning">' + restricted + '</span> / <span class="text-danger">' + banned + '</span></h4></div>';
    html += '</div></div>';

    var scoreColor = 'text-success';
    if (compScore < 40) scoreColor = 'text-danger';
    else if (compScore < 70) scoreColor = 'text-warning';

    html += '<div class="col-md-3 col-sm-6"><div class="stat-card-custom">';
    html += '<div class="stat-card-icon bg-info" style="background:linear-gradient(135deg,#06B6D4,#0891B2);"><i class="bi bi-activity"></i></div>';
    html += '<div><span class="text-muted small" style="font-size:11px;">Compliance Score</span><h4 class="mb-0 mt-1 ' + scoreColor + '" style="font-weight:800; font-size:1.4rem;">' + compScore + '%</h4></div>';
    html += '</div></div>';

    html += '<div class="col-md-3 col-sm-6"><div class="stat-card-custom">';
    html += '<div class="stat-card-icon bg-warning" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><i class="bi bi-exclamation-circle"></i></div>';
    html += '<div><span class="text-muted small" style="font-size:11px;">Stricter Markets</span><h4 class="mb-0 mt-1 text-truncate" style="font-weight:800; font-size:1.05rem; max-width:140px;" title="' + strictStr + '">' + strictStr + '</h4></div>';
    html += '</div></div>';

    statsContainer.innerHTML = html;
}

function exportAdditiveReport(type) {
    var additives = window.activeAdditiveReport || [];
    if (additives.length === 0) {
        alert("No additive data available to export.");
        return;
    }

    if (type === 'csv') {
        var csvRows = [];
        csvRows.push(["Additive Name", "INS/E Number", "Function", "Safety Status", "Risk Level", "FSSAI Limit", "US FDA Status", "EU EFSA Status", "Scientific Notes"]);
        
        additives.forEach(function(a) {
            csvRows.push([
                '"' + a.name.replace(/"/g, '""') + '"',
                '"' + a.ins_no.replace(/"/g, '""') + '"',
                '"' + a.category.replace(/"/g, '""') + '"',
                '"' + a.safety_status.replace(/"/g, '""') + '"',
                '"' + a.risk_level.replace(/"/g, '""') + '"',
                '"' + a.countries["India (FSSAI)"].limit.replace(/"/g, '""') + '"',
                '"' + a.countries["USA (FDA)"].status.replace(/"/g, '""') + '"',
                '"' + a.countries["European Union (EFSA)"].status.replace(/"/g, '""') + '"',
                '"' + a.scientific_notes.replace(/"/g, '""') + '"'
            ]);
        });

        var csvContent = csvRows.map(function(e) { return e.join(","); }).join("\n");
        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "additive_regulatory_report.csv");
        link.click();
    } else if (type === 'pdf') {
        var printWin = window.open('', '_blank');
        var html = '';
        html += '<html><head><title>Additive Regulatory Report - Label Padegha Sabh</title>';
        html += '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">';
        html += '<style>';
        html += 'body { font-family: "Outfit", sans-serif; padding: 40px; color: #333; }';
        html += 'h1 { font-weight:800; color:#111; margin-bottom: 5px; }';
        html += 'h2 { font-weight:700; color:#444; margin-top:30px; font-size:1.3rem; border-bottom: 2px solid #ddd; padding-bottom:8px; }';
        html += 'table { font-size: 12.5px; }';
        html += 'th { background-color: #f8f9fa !important; }';
        html += '.risk-badge { font-weight:700; padding:4px 10px; border-radius:50px; font-size:11px; }';
        html += '.risk-High { background-color: #fde8e8; color: #9b1c1c; }';
        html += '.risk-Moderate { background-color: #fef3c7; color: #92400e; }';
        html += '.risk-Low { background-color: #def7ec; color: #03543f; }';
        html += '@media print { .no-print { display:none; } }';
        html += '</style></head><body onload="window.print()">';
        
        html += '<div class="d-flex justify-content-between align-items-center mb-4">';
        html += '<div><h1>Additive Regulatory Report</h1><p class="text-muted">Label Padegha Sabh - Clean Label Analytics</p></div>';
        html += '<button class="btn btn-primary no-print" onclick="window.print()"><i class="bi bi-printer"></i> Print</button>';
        html += '</div>';

        html += '<hr>';
        html += '<h4>Total Additives Detected: ' + additives.length + '</h4>';
        
        additives.forEach(function(a) {
            html += '<h2>' + a.name + ' (' + a.ins_no + ') - <span class="risk-badge risk-' + a.risk_level.split(' ')[0] + '">' + a.risk_level + '</span></h2>';
            html += '<p><strong>Functional Class:</strong> ' + a.category + ' | <strong>Purpose:</strong> ' + a.purpose + '</p>';
            html += '<p><strong>Scientific Notes:</strong> ' + a.scientific_notes + '</p>';
            html += '<p><strong>Health &amp; Safety Considerations:</strong> ' + a.health_considerations + '</p>';
            
            html += '<table class="table table-bordered table-sm mt-2">';
            html += '<thead class="table-light"><tr><th>Country</th><th>Regulatory Authority</th><th>Status</th><th>Max Limit</th></tr></thead><tbody>';
            Object.keys(a.countries).forEach(function(cName) {
                var cInfo = a.countries[cName];
                html += '<tr><td>' + cName + '</td><td>' + cInfo.authority + '</td><td>' + cInfo.status + '</td><td>' + cInfo.limit + '</td></tr>';
            });
            html += '</tbody></table>';
        });

        html += '</body></html>';
        printWin.document.write(html);
        printWin.document.close();
    }
}