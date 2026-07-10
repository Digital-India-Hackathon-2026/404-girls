// ============================================================
// LABEL PADEGHA SABH — Product Evaluation Engine v3.0 (FULL)
// Handles all 9 workflow steps end-to-end
// ============================================================

const API_BASE = "http://127.0.0.1:5000";

// ── Step helpers ──────────────────────────────────────────
function setLoadingStep(stepId, state) { // state: 'active' | 'done' | 'pending'
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = `loading-step ${state}`;
}

async function animateLoadingSteps(steps, delay = 800) {
    for (let i = 0; i < steps.length; i++) {
        setLoadingStep(steps[i], 'active');
        await new Promise(r => setTimeout(r, delay));
        setLoadingStep(steps[i], 'done');
    }
}

// ── State ─────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const barcodeFromUrl = urlParams.get("barcode");
    const barcode = barcodeFromUrl || localStorage.getItem("scannedBarcode");
    const image = localStorage.getItem("scannedImageBase64");

    if (barcode) {
        fetchProductByBarcode(barcode);
    } else if (image) {
        localStorage.removeItem("scannedImageBase64");
        fetchProductByImage(image);
    } else {
        showError("No product to analyze", "Please scan a product or upload an image first.");
    }
});

// ── Error UI ──────────────────────────────────────────────
function showError(title = "Error", msg = "Something went wrong.") {
    document.getElementById("loadingContainer").style.display = "none";
    document.getElementById("productContainer").style.display = "none";
    const err = document.getElementById("errorContainer");
    err.style.display = "block";
    document.getElementById("errorTitle").textContent = title;
    document.getElementById("errorMessage").textContent = msg;
}

// ── GET user preferences ───────────────────────────────────
function getPreferences() {
    try { return JSON.parse(localStorage.getItem("healthProfile") || "{}"); }
    catch { return {}; }
}

// ═══════════════════════════════════════════════════════════
// STEP 2 Method 1: Barcode → /api/product/{barcode}
// ═══════════════════════════════════════════════════════════
async function fetchProductByBarcode(barcode) {
    const loading = document.getElementById("loadingContainer");
    const container = document.getElementById("productContainer");
    loading.style.display = "flex";
    container.style.display = "none";

    const stepSeq = ['step-fetch', 'step-extract', 'step-regulatory', 'step-ai', 'step-personalize', 'step-dashboard'];
    const stepTimer = animateLoadingSteps(stepSeq, 600);

    try {
        const prefs = getPreferences();
        const res = await fetch(`${API_BASE}/api/product/${barcode}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ preferences: prefs })
        });

        await stepTimer;

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Server error (${res.status})`);
        }

        const data = await res.json();
        if (data.error) { showError("Product Not Found", data.error); return; }

        const normalized = normalizeProductPayload(data);
        renderProduct(normalized, prefs);
    } catch (err) {
        console.error(err);
        showError("Analysis Failed", err.message || "Could not connect to the server. Make sure api.py is running.");
    } finally {
        loading.style.display = "none";
    }
}

// ═══════════════════════════════════════════════════════════
// STEP 2 Method 2: Image → /api/analyze
// ═══════════════════════════════════════════════════════════
async function fetchProductByImage(base64Image) {
    const loading = document.getElementById("loadingContainer");
    const container = document.getElementById("productContainer");
    loading.style.display = "flex";
    container.style.display = "none";

    const stepSeq = ['step-fetch', 'step-extract', 'step-regulatory', 'step-ai', 'step-personalize', 'step-dashboard'];
    const stepTimer = animateLoadingSteps(stepSeq, 700);

    try {
        const prefs = getPreferences();
        // Try the standard image endpoint
        const imageData = `data:image/jpeg;base64,${base64Image}`;
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData, preferences: prefs })
        });

        await stepTimer;

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Server error (${res.status})`);
        }

        let data = await res.json();
        if (data.error) {
            // If image analysis returned an error, check for structured data anyway
            // Gemini sometimes includes error + partial data
            if (!data.name) { showError("Image Analysis Failed", data.error); return; }
        }

        // Merge dashboard insights if they came embedded in the image response
        if (!data.dashboard_insights && data.concern_score !== undefined) {
            data = { ...data, dashboard_insights: data };
        }

        const normalized = normalizeProductPayload(data);
        renderProduct(normalized, prefs);
    } catch (err) {
        console.error(err);
        showError("Image Analysis Failed", err.message || "Could not analyze the image.");
    } finally {
        loading.style.display = "none";
    }
}

// ═══════════════════════════════════════════════════════════
// NORMALIZE PRODUCT PAYLOAD
// ═══════════════════════════════════════════════════════════
function normalizeProductPayload(productData = {}) {
    const parsedIngredients = Array.isArray(productData.parsed_ingredients)
        ? productData.parsed_ingredients
        : (productData.ingredients_text ? productData.ingredients_text.split(',').map(i => i.trim()).filter(Boolean) : []);

    const risks = Array.isArray(productData.risks) ? productData.risks : [];
    const concernScore = productData.health_score ?? productData.dashboard_insights?.concern_score ?? 50;
    const categories = Array.isArray(productData.categories)
        ? productData.categories.join(', ')
        : (productData.category || productData.categories || 'Food');

    const normalized = {
        ...productData,
        name: productData.name || 'Unknown Product',
        brand: productData.brand || 'Unknown Brand',
        image: productData.image || productData.image_url || '',
        category: categories,
        ingredients: productData.ingredients || productData.ingredients_text || '',
        nutrition: productData.nutrition || productData.nutriments || {},
        scores: productData.scores || {
            nutriscore: productData.nutriscore_grade || 'unknown',
            nova: productData.nova_group || 'unknown',
            ecoscore: 'unknown'
        },
        regulatory: productData.regulatory || {
            banned_ingredients: risks.map(item => ({ ingredient: item.ingredient || item.name || 'Ingredient', banned_in: item.banned_in || [] })),
            recalls: []
        },
        allergens: productData.allergens || [],
        additives: productData.additives || [],
        labels: productData.labels || [],
        ingredients_analysis: productData.ingredients_analysis || [],
        nutrient_levels: productData.nutrient_levels || {},
        dashboard_insights: productData.dashboard_insights || {
            concern_score: concernScore,
            ingredient_purpose: parsedIngredients.map(item => ({
                name: item,
                purpose: 'Ingredient listed on product label.',
                risk_level: 'safe'
            })),
            global_regulatory_status: [
                { country: '🇮🇳 FSSAI', status: 'Approved' },
                { country: '🇺🇸 FDA', status: 'Approved' },
                { country: '🇪🇺 EFSA', status: 'Approved' }
            ],
            additive_context: {},
            personal_warnings: [],
            healthier_alternatives: [],
            certifications: []
        },
        source: productData.source || 'OpenFoodFacts'
    };

    return normalized;
}

// ═══════════════════════════════════════════════════════════
// RENDER ENGINE — builds the full 9-step dashboard
// ═══════════════════════════════════════════════════════════
function renderProduct(productData, prefs = {}) {
    const container = document.getElementById("productContainer");
    if (!container) {
        console.error("Product container not found.");
        return;
    }

    try {
        const safeProduct = normalizeProductPayload(productData);
        const insights = safeProduct.dashboard_insights || {};
        const scores = safeProduct.scores || {};
        const reg = safeProduct.regulatory || {};
        const nutrition = safeProduct.nutrition || {};
        const allergens = safeProduct.allergens || [];
        const additives = safeProduct.additives || [];
        const labels = safeProduct.labels || [];
        const ingAnalysis = safeProduct.ingredients_analysis || [];
        const nutriLevels = safeProduct.nutrient_levels || {};

        const concernScore = insights.concern_score ?? 50;
        let scoreLabel = 'Low Concern';
        let scoreRingColor = '#10B981';
        if (concernScore >= 70) { scoreLabel = 'High Concern'; scoreRingColor = '#EF4444'; }
        else if (concernScore >= 40) { scoreLabel = 'Moderate Concern'; scoreRingColor = '#F59E0B'; }

        const circumference = 2 * Math.PI * 52;
        const fillOffset = circumference - (concernScore / 100) * circumference;

        const gradeClass = g => {
            const gStr = String(g ?? 'unknown').toLowerCase();
            return ['a', 'b', 'c', 'd', 'e'].includes(gStr) ? `grade-${gStr}` : 'grade-unknown';
        };

        const ingPurpose = insights.ingredient_purpose || [];
        const purposeHtml = ingPurpose.length
            ? ingPurpose.map(ing => `
                <div class="ingredient-card risk-${(ing.risk_level || 'safe').toLowerCase()}">
                    <span class="risk-badge ${(ing.risk_level || 'safe').toLowerCase()}">${ing.risk_level || 'Safe'}</span>
                    <p class="ing-name">${escHtml(ing.name || '')}</p>
                    <p class="ing-purpose">${escHtml(ing.purpose || '')}</p>
                </div>`).join('')
            : `<p class="text-muted">No ingredient data available. Try uploading a clearer image.</p>`;

        const regStatus = insights.global_regulatory_status || buildHeuristicRegStatus(reg);
        const regHtml = regStatus.map(r => {
            const cls = r.status === 'Approved' ? 'approved' : r.status === 'Banned' ? 'banned' : 'review';
            const icon = r.status === 'Approved' ? 'check-circle-fill' : r.status === 'Banned' ? 'x-circle-fill' : 'exclamation-circle-fill';
            return `<span class="reg-pill ${cls}"><i class="bi bi-${icon}"></i>${escHtml(r.country)} — ${escHtml(r.status)}</span>`;
        }).join('');

        const addCtx = insights.additive_context || {};
        const addHtml = `
            <div class="additive-grid">
                ${addBox(addCtx.preservatives ?? 0, 'Preservatives', '🧪')}
                ${addBox(addCtx.colorants ?? 0, 'Colorants', '🎨')}
                ${addBox(addCtx.stabilizers ?? 0, 'Stabilizers', '🔬')}
                ${addBox(addCtx.flavors_msg ?? 0, 'Flavors/MSG', '🧂')}
            </div>
            ${additives.length ? `<div class="mt-3"><p class="text-muted small mb-2"><strong>Detected E-numbers / Additives:</strong></p>
                ${additives.map(a => `<span class="tag-pill">${escHtml(a)}</span>`).join('')}</div>` : ''}`;

        const warnings = insights.personal_warnings || buildAllergenWarnings(allergens, prefs);
        const warningsHtml = warnings.length
            ? warnings.map(w => `
                <div class="warning-card ${w.type === 'red' ? 'danger' : 'caution'}">
                    <div class="warning-icon"><i class="bi bi-${w.type === 'red' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill'}"></i></div>
                    <div>
                        <div class="warning-title">${escHtml(w.title || 'Warning')}</div>
                        <p class="warning-desc">${escHtml(w.description || '')}</p>
                    </div>
                </div>`).join('')
            : `<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i><strong>No personal warnings detected</strong> based on your health profile.</div>`;

        const recalls = reg.recalls || [];
        const bannedIngs = reg.banned_ingredients || [];
        const safetyHtml = buildSafetyHtml(recalls, bannedIngs, safeProduct.name);
        const nutritionHtml = buildNutritionHtml(nutrition, nutriLevels);
        const labelsHtml = labels.length
            ? `<div class="mt-3">${labels.map(l => `<span class="tag-pill">✅ ${escHtml(l)}</span>`).join('')}</div>`
            : '';
        const allergensHtml = allergens.length
            ? `<div class="mt-2">${allergens.map(a => `<span class="tag-pill" style="background:rgba(239,68,68,0.1);color:#dc2626;">🚨 ${escHtml(a)}</span>`).join('')}</div>`
            : `<span class="text-muted small">None declared</span>`;
        const altList = insights.healthier_alternatives || [];
        const altHtml = altList.length
            ? altList.map(a => `<div class="ingredient-card risk-safe"><p class="ing-name">🌿 ${escHtml(a.name || '')}</p><p class="ing-purpose">${escHtml(a.description || '')}</p></div>`).join('')
            : `<p class="text-muted">Ask the AI assistant for personalized healthier alternatives!</p>`;
        const certs = insights.certifications || [];
        const certsHtml = certs.filter(c => c && c !== 'None verified' && c !== 'Cannot verify automatically')
            .map(c => `<span class="tag-pill">🏅 ${escHtml(c)}</span>`).join('') || `<span class="text-muted small">No certifications detected</span>`;
        const ingredientTagsHtml = ingAnalysis.length
            ? ingAnalysis.map(t => `<span class="tag-pill">${escHtml(t)}</span>`).join('')
            : '';

        container.innerHTML = `
          <div class="product-header-card fade-in mb-4">
            <div class="product-image-large">
                ${safeProduct.image
                ? `<img src="${escHtml(safeProduct.image)}" alt="${escHtml(safeProduct.name)}" style="width:100%;height:100%;object-fit:cover;">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--gray-100);border-radius:16px;"><i class="bi bi-box" style="font-size:5rem;color:var(--gray-300);"></i></div>`}
            </div>
            <div class="product-header-info">
                <h1 class="product-title">${escHtml(safeProduct.name || 'Unknown Product')}</h1>
                <p class="product-brand-large" style="color:var(--gray-500);font-size:1.1rem;">${escHtml(safeProduct.brand || 'Unknown Brand')}</p>
                <div class="product-meta">
                    <span><i class="bi bi-tag text-success"></i> ${escHtml(safeProduct.category || 'Food')}</span>
                    <span><i class="bi bi-box text-muted"></i> Source: ${escHtml(safeProduct.source || 'OpenFoodFacts')}</span>
                </div>
                <div class="scores-bar mt-3">
                    ${scorePill('Nutriscore', scores.nutriscore, gradeClass(scores.nutriscore))}
                    ${scorePill('Nova Group', scores.nova, scores.nova ? (Number(scores.nova) <= 2 ? 'grade-a' : Number(scores.nova) === 3 ? 'grade-c' : 'grade-e') : 'grade-unknown')}
                    ${scorePill('Eco-Score', scores.ecoscore, gradeClass(scores.ecoscore))}
                </div>
                <div class="mt-3">
                    <p class="text-muted small mb-1"><i class="bi bi-exclamation-triangle"></i> <strong>Allergens:</strong></p>
                    ${allergensHtml}
                </div>
                ${labelsHtml}
                ${ingredientTagsHtml ? `<div class="mt-2">${ingredientTagsHtml}</div>` : ''}
            </div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-1">
            <div class="factor-header">
                <div class="factor-icon-lg"><i class="bi bi-speedometer2"></i></div>
                <div>
                    <h3>Factor 1 — Concern Score</h3>
                    <p class="factor-subtitle">Quantitative risk indicator (0–100). Higher = More Concern.</p>
                </div>
            </div>
            <div class="factor-body">
                <div class="concern-score-block">
                    <div class="score-ring-container">
                        <svg class="score-ring-svg" width="120" height="120" viewBox="0 0 120 120">
                            <circle class="score-ring-bg" cx="60" cy="60" r="52"/>
                            <circle class="score-ring-fill" cx="60" cy="60" r="52"
                                stroke="${scoreRingColor}"
                                stroke-dasharray="${circumference}"
                                stroke-dashoffset="${fillOffset}"
                                id="scoreRingFill"/>
                        </svg>
                        <div class="score-ring-text">
                            <span class="score-ring-num" style="color:${scoreRingColor};">${concernScore}</span>
                            <span class="score-ring-label">/ 100</span>
                        </div>
                    </div>
                    <div class="score-description" style="flex:1;">
                        <h4 style="font-size:1.2rem;font-weight:700;margin-bottom:8px;color:${scoreRingColor};">${escHtml(scoreLabel)}</h4>
                        <div class="progress-bar-custom mb-3" style="height:10px;">
                            <div class="progress-fill" id="scoreFillBar" style="width:${concernScore}%;background:${scoreRingColor};"></div>
                        </div>
                        <p class="text-muted small" style="margin:0;">⚠️ This metric indicates concern level only — not a safety guarantee. Make informed personal decisions.</p>
                    </div>
                </div>
            </div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-2">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#3B82F6,#2563EB);"><i class="bi bi-clipboard-data"></i></div>
                <div>
                    <h3>Factor 2 — Ingredient Purpose Analysis</h3>
                    <p class="factor-subtitle">Why each ingredient is used and its health implications</p>
                </div>
            </div>
            <div class="factor-body">
                ${purposeHtml}
                <hr style="margin:1rem 0;">
                <p class="text-muted small"><strong>Full Ingredients:</strong> ${escHtml(safeProduct.ingredients || 'Not available')}</p>
            </div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-3">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#8B5CF6,#7C3AED);"><i class="bi bi-globe-americas"></i></div>
                <div>
                    <h3>Factor 3 — Global Regulatory Status</h3>
                    <p class="factor-subtitle">Cross-country compliance comparison (FSSAI, FDA, EFSA)</p>
                </div>
            </div>
            <div class="factor-body">
                <div class="reg-pills mb-3">${regHtml || '<span class="text-muted">Regulatory data being analyzed…</span>'}</div>
                ${bannedIngs.length ? `<div class="warning-card danger mt-2"><div class="warning-icon"><i class="bi bi-x-octagon-fill"></i></div><div><div class="warning-title">Banned Ingredients Detected!</div><p class="warning-desc">${bannedIngs.map(b => `<strong>${escHtml(b.ingredient)}</strong> banned in: ${escHtml((b.banned_in || []).join(', '))}`).join(' &bull; ')}</p></div></div>` : ''}
            </div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-4">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#EC4899,#BE185D);"><i class="bi bi-eyedropper"></i></div>
                <div>
                    <h3>Factor 4 — Additive & Chemical Context</h3>
                    <p class="factor-subtitle">Scientific background in plain language</p>
                </div>
            </div>
            <div class="factor-body">${addHtml}</div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-5" style="border-color:${warnings.some(w => w.type === 'red') ? 'rgba(239,68,68,0.3)' : 'var(--gray-200)'};">
            <div class="factor-header" style="background:${warnings.some(w => w.type === 'red') ? 'rgba(239,68,68,0.05)' : 'var(--light-gray)'};">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#EF4444,#B91C1C);"><i class="bi bi-person-exclamation"></i></div>
                <div>
                    <h3>Factor 5 — Personalized Warnings</h3>
                    <p class="factor-subtitle">Tailored to your health profile</p>
                </div>
            </div>
            <div class="factor-body">${warningsHtml}</div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-5">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#06B6D4,#0891B2);"><i class="bi bi-bar-chart-fill"></i></div>
                <div>
                    <h3>Nutrition Facts</h3>
                    <p class="factor-subtitle">Per 100g serving — from OpenFoodFacts</p>
                </div>
            </div>
            <div class="factor-body">${nutritionHtml}</div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-6">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#F59E0B,#D97706);"><i class="bi bi-newspaper"></i></div>
                <div>
                    <h3>Factor 6 — Safety Alerts & Recalls</h3>
                    <p class="factor-subtitle">Verified safety information and recall notices</p>
                </div>
            </div>
            <div class="factor-body">${safetyHtml}</div>
          </div>

          <div class="factor-detail-card fade-in-up stagger-6">
            <div class="factor-header">
                <div class="factor-icon-lg" style="background:linear-gradient(135deg,#10B981,#059669);"><i class="bi bi-heart-pulse"></i></div>
                <div>
                    <h3>Healthier Alternatives</h3>
                    <p class="factor-subtitle">AI-suggested better choices</p>
                </div>
            </div>
            <div class="factor-body">${altHtml}</div>
          </div>

          ${certs.filter(c => c && !['none verified', 'cannot verify automatically'].includes(c.toLowerCase())).length
                ? `<div class="factor-detail-card fade-in-up stagger-7">
                  <div class="factor-header">
                      <div class="factor-icon-lg" style="background:linear-gradient(135deg,#059669,#047857);"><i class="bi bi-patch-check-fill"></i></div>
                      <div><h3>Certifications Detected</h3><p class="factor-subtitle">Verified labels and quality marks</p></div>
                  </div>
                  <div class="factor-body">${certsHtml}</div>
               </div>` : ''}

          <div class="decision-banner fade-in-up stagger-7">
            <h4>⚖️ Your Decision Matters</h4>
            <p>Label Padegha Sabh provides transparent, data-driven insights — not a verdict. You are empowered to make the best choice for yourself.</p>
          </div>

          <div class="ai-cta-section fade-in-up stagger-7">
            <div class="ai-cta-text">
                <h3>🤖 Have questions? Ask the AI</h3>
                <p>Get deeper insights about this product's ingredients, health impacts, and alternatives.</p>
                <a href="ai-chat.html" class="btn mt-3" style="background:#fff;color:var(--primary-emerald);font-weight:700;border-radius:12px;padding:10px 24px;">
                    <i class="bi bi-chat-dots-fill me-2"></i>Open AI Chat
                </a>
            </div>
            <i class="bi bi-robot ai-cta-icon"></i>
          </div>`;

        container.style.display = "block";
        localStorage.setItem("lps_ai_context", JSON.stringify({
            name: safeProduct.name,
            brand: safeProduct.brand,
            ingredients: safeProduct.ingredients,
            concern_score: concernScore,
            allergens: allergens,
            scores: scores
        }));
    } catch (err) {
        console.error("Failed to render product dashboard", err);
        container.innerHTML = `
            <div class="error-card">
                <i class="bi bi-exclamation-circle"></i>
                <h4>Analysis Preview Available</h4>
                <p class="text-muted">We received product information, but the full dashboard could not be rendered. You can still review the basics below.</p>
                <div class="mt-3 text-start">
                    <strong>${escHtml((productData && productData.name) || 'Unknown Product')}</strong>
                    <p class="text-muted mb-0">${escHtml((productData && productData.ingredients) || 'No ingredient details available yet.')}</p>
                </div>
            </div>`;
        container.style.display = "block";
    }
}

// ── Helper: Score Pill ─────────────────────────────────────
function scorePill(label, value, cls) {
    const display = String(value ?? '?').toUpperCase();
    return `<div class="score-pill"><div class="sp-label">${label}</div><div class="sp-value ${cls}">${display}</div></div>`;
}

// ── Helper: Additive Box ───────────────────────────────────
function addBox(count, label, emoji) {
    return `<div class="additive-box"><div class="add-count">${count}</div><div class="add-label">${emoji} ${label}</div></div>`;
}

// ── Helper: Heuristic Regulatory Status ───────────────────
function buildHeuristicRegStatus(reg) {
    const bannedCount = (reg.banned_ingredients || []).length;
    return [
        { country: '🇮🇳 FSSAI', status: bannedCount > 0 ? 'Under Review' : 'Approved' },
        { country: '🇺🇸 FDA', status: 'Approved' },
        { country: '🇪🇺 EFSA', status: bannedCount > 0 ? 'Banned' : 'Approved' }
    ];
}

// ── Helper: Build allergen-based warnings ─────────────────
function buildAllergenWarnings(allergens, prefs) {
    const userAllergies = (prefs.allergies || []).map(a => a.toLowerCase());
    return allergens.map(al => {
        const isMatch = userAllergies.some(ua => al.toLowerCase().includes(ua) || ua.includes(al.toLowerCase()));
        return {
            type: isMatch ? 'red' : 'orange',
            title: `${isMatch ? '⚡ CRITICAL — ' : ''}Allergen: ${al}`,
            description: isMatch
                ? `This matches your declared allergy. Do NOT consume without consulting a professional.`
                : `Contains ${al}. Check suitability for your dietary needs.`
        };
    });
}

// ── Helper: Safety Alerts HTML ────────────────────────────
function buildSafetyHtml(recalls, bannedIngs, productName) {
    if (!recalls.length && !bannedIngs.length) {
        return `<div class="alert alert-success"><i class="bi bi-shield-check-fill me-2"></i><strong>No recent recalls found</strong> for ${escHtml(productName || 'this product')}. Always verify with official sources.</div>`;
    }
    let html = '';
    recalls.forEach(r => {
        html += `<div class="warning-card danger mb-2">
            <div class="warning-icon"><i class="bi bi-megaphone-fill"></i></div>
            <div>
                <div class="warning-title">Recall Notice: ${escHtml(r.product_name || '')}</div>
                <p class="warning-desc">${escHtml(r.reason || '')} — ${escHtml((r.regions_affected || []).join(', '))} — Date: ${escHtml(r.date || '')}</p>
            </div></div>`;
    });
    return html || `<div class="alert alert-info"><i class="bi bi-info-circle-fill me-2"></i>No active recalls, but ${bannedIngs.length} banned ingredient(s) detected (see Factor 3).</div>`;
}

// ── Helper: Build Nutrition Table ─────────────────────────
function buildNutritionHtml(nutrition, nutriLevels) {
    const key_map = {
        'energy-kcal_100g': ['Calories (kcal)', 'kcal'],
        'energy_100g': ['Energy (kJ)', 'kJ'],
        'proteins_100g': ['Protein', 'g'],
        'carbohydrates_100g': ['Carbohydrates', 'g'],
        'sugars_100g': ['of which Sugars', 'g'],
        'fat_100g': ['Fat', 'g'],
        'saturated-fat_100g': ['Saturated Fat', 'g'],
        'fiber_100g': ['Dietary Fiber', 'g'],
        'sodium_100g': ['Sodium', 'g'],
        'salt_100g': ['Salt', 'g'],
        'calcium_100g': ['Calcium', 'mg'],
        'iron_100g': ['Iron', 'mg'],
    };

    // If nutrition is an array (USDA format), convert
    let n = nutrition;
    if (Array.isArray(n)) {
        const obj = {};
        n.forEach(item => {
            const k = (item.nutrientName || '').toLowerCase().replace(/ /g, '_') + '_100g';
            obj[k] = item.amount;
        });
        n = obj;
    }

    const rows = Object.entries(key_map)
        .filter(([k]) => n[k] !== undefined && n[k] !== null)
        .map(([k, [label, unit]]) => {
            const val = parseFloat(n[k] || 0).toFixed(2);
            // Find level key: nutriLevels may have 'sugar', 'fat', 'saturated-fat', 'salt'
            const lvlKey = k.replace('_100g', '').replace('carbohydrates', 'carbs');
            const level = nutriLevels[lvlKey] || nutriLevels[k.replace('_100g', '')] || '';
            const lvlClass = level === 'high' ? 'high' : level === 'moderate' ? 'moderate' : level === 'low' ? 'low' : '';
            return `<div class="nutriment-row">
                <span class="nutriment-key">${label}</span>
                <span class="nutriment-val ${lvlClass ? `nutriment-level-${lvlClass}` : ''}">${val} ${unit}</span>
            </div>`;
        });

    if (!rows.length) {
        return `<p class="text-muted">No nutrition data available from OpenFoodFacts for this product.</p>`;
    }

    return `<div class="nutriment-table">${rows.join('')}</div>`;
}

// ── Helper: Escape HTML ───────────────────────────────────
function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
