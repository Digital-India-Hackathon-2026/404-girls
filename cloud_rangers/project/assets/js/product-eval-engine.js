// ============================================================
// LABEL PADEGHA SABH — Consumer Decision Platform v6.0
// Purpose: Help shoppers decide "Should I buy this?"
// Clean, professional, answer-first design
// ============================================================

const API = (window.location.protocol === 'file:') ? 'http://127.0.0.1:8000' : '';

function log(m, t) { t=t||'info'; var p='[LPS] '; t==='error'?console.error(p+m):t==='warn'?console.warn(p+m):console.log(p+m); }

// ── HTML Escape ──
var _amp='&'+'amp;',_lt='&'+'lt;',_gt='&'+'gt;',_quot='&'+'quot;';
function esc(s){return String(s||'').replace(/&/g,_amp).replace(/</g,_lt).replace(/>/g,_gt).replace(/"/g,_quot).replace(/'/g,'&#039;');}

// ── Bootstrap ──
window.addEventListener('DOMContentLoaded',function(){
    var u=new URLSearchParams(window.location.search);
    var bc=u.get('barcode')||localStorage.getItem('scannedBarcode');
    var img=localStorage.getItem('scannedImageBase64');
    if(bc){log('Scanning: '+bc);fetchFullAnalysis(bc);}
    else if(img){localStorage.removeItem('scannedImageBase64');fetchProductByImage(img);}
    else showError('No product','Scan a product or upload an image first.');
});

function showError(t,m){
    var l=document.getElementById('loadingContainer'),c=document.getElementById('productContainer'),e=document.getElementById('errorContainer');
    if(l)l.style.display='none';if(c)c.style.display='none';
    if(e){e.style.display='block';
        var tt=document.getElementById('errorTitle'),mm=document.getElementById('errorMessage');
        if(tt)tt.textContent=t||'Error';if(mm)mm.textContent=m||'Something went wrong.';
    }
}

function getProfile(){try{return JSON.parse(localStorage.getItem('healthProfile')||'{}');}catch(e){return{};}}

// ── Fetch ──
async function fetchFullAnalysis(barcode){
    var l=document.getElementById('loadingContainer'),c=document.getElementById('productContainer');
    if(l)l.style.display='flex';if(c)c.style.display='none';
    try{
        var p=getProfile();
        var r=await fetch(API+'/api/analyze-product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({barcode:barcode,age:p.age||null,allergies:p.allergies||[],conditions:p.conditions||[],diet:p.diet||''})});
        var d=await r.json();
        if(!r.ok)throw new Error((d&&(d.detail||d.error))||'Server error');
        if(d.error){showError('Not Found',d.error);return;}
        if(l)l.style.display='none';
        renderAnalysis(d,getProfile());
    }catch(e){
        if(l)l.style.display='none';
        if(e.message.indexOf('Failed to fetch')>=0)showError('Cannot Connect','Start the backend: cd backend && python app.py');
        else showError('Analysis Failed',e.message);
    }
}

async function fetchProductByImage(img){
    var l=document.getElementById('loadingContainer'),c=document.getElementById('productContainer');
    if(l)l.style.display='flex';if(c)c.style.display='none';
    try{
        var r=await fetch(API+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:'data:image/jpeg;base64,'+img,preferences:getProfile()})});
        var d=await r.json();
        if(!r.ok)throw new Error((d&&(d.error||d.detail))||'Server error');
        if(d.error&&!d.name){showError('Image Failed',d.error);return;}
        if(l)l.style.display='none';renderAnalysis(d,getProfile());
    }catch(e){if(l)l.style.display='none';showError('Image Failed',e.message);}
}

// ── MAIN RENDER ENGINE (Consumer-First) ──
function renderAnalysis(d,profile){
    if(!profile)profile={};
    window.ad=d; window.ar=d.additive_regulatory_report||[];
    var c=document.getElementById('productContainer');if(!c)return;
    try{
        var p=d.product||{},nut=d.nutrition||{},ings=d.ingredients||[],ie=d.ingredient_explanations||[];
        var cs=d.concern_score||{score:50,level:'Moderate',factors:[]},score=cs.score||50,level=cs.level||'Moderate';
        var al=d.allergens||[],alerts=d.alerts||[],pw=d.personalized_warnings||[],regs=d.regulatory||[],news=d.news||[];
        var nova=d.nova||{level:'Unknown',name:'',description:''};
        var factors=cs.factors||[];

        var tClass=score>=70?'danger':score>=40?'moderate':'safe';
        var tColor=score>=70?'#dc2626':score>=40?'#d97706':'#059669';
        var tIcon=score>=70?'bi-x-circle-fill':score>=40?'bi-exclamation-circle-fill':'bi-check-circle-fill';

        // Traffic light colors
        // Green < 40, Amber 40-69, Red >= 70

        // ── DEDUPLICATE INGREDIENTS (consumer-friendly grouping) ──
        var ingMap={};var ingDedup=[];
        for(var i=0;i<ie.length;i++){
            var ig=ie[i];var key=ig.name.toLowerCase().trim();
            if(!ingMap[key]){ingMap[key]={name:ig.name,simple:ig.simple_name||'',purpose:ig.purpose||'',desc:ig.description||'',cat:ig.category||'',source:ig.source||'',ins_e:ig.ins_e||''};ingDedup.push(ingMap[key]);}
            else{if(ig.simple_name&&!ingMap[key].simple)ingMap[key].simple=ig.simple_name;if(ig.source==='additives'||ig.source==='both')ingMap[key].source=ig.source;}
        }

        // ── BUILD CONSUMER-FRIENDLY HTML ──
        var html='';

        // ═══════════════════════════════════════════════
        // HERO CARD — Should I Buy?
        // ═══════════════════════════════════════════════
        html+='<div class="hero-card">';
        html+='<div class="hero-l">';
        html+='<div class="hero-img">';
        if(p.image_url)html+='<img src="'+esc(p.image_url)+'" alt="" onerror="this.parentNode.innerHTML=\'<i class=bi bi-box style=font-size:4rem;color:#cbd5e1;></i>\'">';
        else html+='<i class="bi bi-box" style="font-size:4rem;color:#cbd5e1;"></i>';
        html+='</div></div>';
        html+='<div class="hero-r">';
        html+='<div class="hero-brand">'+esc(p.brand||'')+'</div>';
        html+='<div class="hero-name">'+esc(p.name||'Product')+'</div>';
        if(Array.isArray(p.categories)&&p.categories.length)html+='<div class="hero-cat">'+esc(p.categories.join(', '))+'</div>';
        else if(p.categories&&typeof p.categories==='string')html+='<div class="hero-cat">'+esc(p.categories)+'</div>';

        // Traffic light + Score
        html+='<div class="hero-scores">';
        html+='<div class="hero-traffic '+tClass+'"><i class="bi '+tIcon+'"></i></div>';
        html+='<div><div class="hero-score" style="color:'+tColor+';">'+score+'<span style="font-size:14px;color:#94a3b8;">/100</span></div>';
        html+='<div class="hero-level" style="color:'+tColor+';">'+esc(level)+'</div></div>';

        // Badges
        html+='<div class="hero-badges">';
        if(nova.level!=='Unknown')html+='<div class="hbadge nova">NOVA '+nova.level+'</div>';
        if(p.nutriscore)html+='<div class="hbadge nutri">Nutri '+esc(p.nutriscore.toUpperCase())+'</div>';
        if(p.source)html+='<div class="hbadge source">'+esc(p.source)+'</div>';
        html+='</div></div>';

        // "Should I Buy?" CTA button
        var recClass=score>=70?'no':score>=40?'maybe':'yes';
        var recText=score>=70?'Not Recommended':score>=40?'Use Occasionally':'Good Choice';
        var recIcon=score>=70?'bi-x-circle':score>=40?'bi-exclamation-circle':'bi-check-circle';
        html+='<div class="hero-cta '+recClass+'"><i class="bi '+recIcon+'"></i> '+recText+'</div>';

        // Health notes
        if(p.health_note)html+='<div class="hero-note health"><i class="bi bi-heart-pulse"></i> '+esc(p.health_note)+'</div>';
        if(p.consumer_note)html+='<div class="hero-note tip"><i class="bi bi-lightbulb"></i> '+esc(p.consumer_note)+'</div>';
        if(p.key_differences)html+='<div class="hero-note diff"><i class="bi bi-info-circle"></i> <strong>India vs Global:</strong> '+esc(p.key_differences)+'</div>';
        html+='</div></div>';

        // ═══════════════════════════════════════════════
        // PURCHASE DECISION SECTION
        // ═══════════════════════════════════════════════
        html+='<div class="decision-card">';
        html+='<div class="dec-header"><i class="bi bi-cart-check"></i> <span>Purchase Decision</span></div>';
        html+='<div class="dec-body">';
        html+='<div class="dec-rating">'+starsFromScore(score)+'</div>';
        html+='<div class="dec-verdict '+recClass+'">'+esc(recText)+'</div>';

        // Positive reasons
        var posReasons=[];var negReasons=[];
        if(ings.length===0)negReasons.push('No ingredient information available');
        if(score<=20){posReasons.push('Low overall concern');}
        if(score>=70){negReasons.push('High concern score ('+score+'/100)');}
        var sugar=parseFloat(nut.sugars_100g||0);
        var salt=parseFloat(nut.salt_100g||0);
        var satFat=parseFloat(nut['saturated-fat_100g']||0);
        var fiber=parseFloat(nut.fiber_100g||0);
        if(sugar>15)negReasons.push('Very high sugar ('+sugar+'g/100g)');
        else if(sugar>5)negReasons.push('Moderate sugar ('+sugar+'g/100g)');
        else if(sugar>0&&sugar<=5)posReasons.push('Low sugar ('+sugar+'g/100g)');
        if(salt>1.5)negReasons.push('High sodium ('+salt+'g/100g)');
        else if(salt<=0.3&&salt>=0)posReasons.push('Low sodium');
        if(satFat>8)negReasons.push('High saturated fat ('+satFat+'g/100g)');
        if(fiber>3)posReasons.push('Good fiber source ('+fiber+'g/100g)');

        // Check for artificial additives
        var artChems=['e102','e110','e129','e133','e150d','e211','e250','e320','e321','e951','e950','e954'];
        var artCount=0;
        for(var i=0;i<ings.length;i++){var il=ings[i].toLowerCase();for(var j=0;j<artChems.length;j++){if(il.indexOf(artChems[j])>=0){artCount++;break;}}}
        if(artCount>2)negReasons.push('Contains '+artCount+' artificial additives');
        else if(artCount>0)negReasons.push('Contains artificial additives');

        if(alerts&&alerts.length>0)negReasons.push('Contains allergens: '+alerts.join(', '));

        // Check for banned ingredients
        var bannedIngs=[];
        if(regs&&regs.length>0){for(var i=0;i<regs.length;i++){var ss=regs[i].regulatory_status||[];for(var j=0;j<ss.length;j++){if(ss[j].status==='Banned'){bannedIngs.push(regs[i].ingredient);break;}}}}
        if(bannedIngs.length>0)negReasons.push('Contains ingredient(s) banned in some countries: '+bannedIngs.join(', '));

        html+='<div class="dec-reasons">';
        if(posReasons.length){html+='<div class="dec-pros">';for(var i=0;i<posReasons.length;i++)html+='<div class="dec-reason pro"><i class="bi bi-check-circle-fill"></i> '+esc(posReasons[i])+'</div>';html+='</div>';}
        if(negReasons.length){html+='<div class="dec-cons">';for(var i=0;i<Math.min(negReasons.length,6);i++)html+='<div class="dec-reason con"><i class="bi bi-x-circle-fill"></i> '+esc(negReasons[i])+'</div>';html+='</div>';}
        html+='</div>';

        // Final recommendation
        var finalRec=score>=70?'This product has significant health concerns. We recommend choosing a healthier alternative with fewer additives and lower sugar content.':
                     score>=40?'This product is acceptable for occasional consumption. Be mindful of portion sizes and consider healthier alternatives for regular use.':
                     'This product appears to be a reasonable choice based on available data. Always check labels for personal dietary needs.';
        html+='<div class="dec-final"><i class="bi bi-info-circle-fill"></i> '+esc(finalRec)+'</div>';
        html+='</div></div>';

        // ═══════════════════════════════════════════════
        // WHY THIS SCORE? — Consumer-friendly factors
        // ═══════════════════════════════════════════════
        if(factors.length){
            html+='<div class="section-card"><div class="sec-header"><i class="bi bi-question-circle"></i> <span>Why This Score?</span></div><div class="sec-body">';
            for(var i=0;i<factors.length;i++)html+='<div class="factor-chip '+tClass+'">'+esc(factors[i])+'</div>';
            html+='</div></div>';
        }

        // ═══════════════════════════════════════════════
        // INGREDIENT INTELLIGENCE (Consumer-friendly)
        // ═══════════════════════════════════════════════
        html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-list-check"></i> <span>Ingredients ('+ingDedup.length+')</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
        html+='<div class="sec-body expanded">';
        if(ingDedup.length){
            for(var i=0;i<ingDedup.length;i++){
                var ig=ingDedup[i];
                var rClass='safe';var rIcon='🟢';
                var cat=(ig.cat||'').toLowerCase();
                if(cat==='preservative'||cat==='colour'||cat==='artificial colour'){rClass='high';rIcon='🔴';}
                else if(cat==='sweetener'||cat==='flavour enhancer'){rClass='moderate';rIcon='🟡';}
                html+='<div class="ing-item '+rClass+'" onclick="showIngModal('+i+')">';
                html+='<span class="ing-dot">'+rIcon+'</span>';
                html+='<span class="ing-name">'+esc(ig.name)+'</span>';
                if(ig.simple)html+='<span class="ing-alias">'+esc(ig.simple)+'</span>';
                if(ig.source==='additives'||ig.source==='both')html+='<span class="ing-tag additive">Additive</span>';
                if(ig.cat)html+='<span class="ing-tag cat">'+esc(ig.cat)+'</span>';
                html+='<span class="ing-arrow"><i class="bi bi-chevron-right"></i></span>';
                html+='</div>';
            }
        } else {
            html+='<div class="note-empty">No ingredient details available.</div>';
        }
        html+='</div></div>';

        // ═══════════════════════════════════════════════
        // NUTRITION AT A GLANCE
        // ═══════════════════════════════════════════════
        html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-bar-chart"></i> <span>Nutrition</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
        html+='<div class="sec-body expanded">'+nutritionTable(nut)+'</div></div>';

        // ═══════════════════════════════════════════════
        // ALLERGENS
        // ═══════════════════════════════════════════════
        html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-exclamation-triangle"></i> <span>Allergens</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
        html+='<div class="sec-body expanded">';
        if(al&&al.length){html+='<div class="allergen-list">';for(var i=0;i<al.length;i++)html+='<div class="allergen-item"><i class="bi bi-exclamation-triangle-fill"></i> <strong>'+esc(al[i].allergen)+'</strong> — found in '+esc(al[i].found_in||'ingredients')+'</div>';html+='</div>';}
        else html+='<div class="note-good"><i class="bi bi-shield-check"></i> No common allergens detected.</div>';
        html+='</div></div>';

        // ═══════════════════════════════════════════════
        // PERSONALIZED WARNINGS
        // ═══════════════════════════════════════════════
        if(pw&&pw.length){
            html+='<div class="section-card warn"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-person-exclamation"></i> <span>Your Health Profile Warnings</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
            html+='<div class="sec-body expanded"><div class="pw-list">';
            for(var i=0;i<pw.length;i++){var w=pw[i];var wc=w.type==='red'?'danger':'caution';var wi=w.type==='red'?'exclamation-triangle-fill':'exclamation-circle-fill';
                html+='<div class="pw-item '+wc+'"><i class="bi bi-'+wi+'"></i><div><div class="pw-title">'+esc(w.title||'')+'</div><div class="pw-desc">'+esc(w.description||'')+'</div></div></div>';}
            html+='</div></div></div>';
        }

        // ═══════════════════════════════════════════════
        // COMPARE COUNTRIES (clean, no tables)
        // ═══════════════════════════════════════════════
        window.regHtml=buildRegSummary(regs);
        html+='<div class="section-card"><div class="sec-header" onclick="openCountryModal()" style="cursor:pointer;"><i class="bi bi-globe2"></i> <span>Compare Countries</span><i class="bi bi-chevron-right"></i></div>';
        html+='<div class="sec-body expanded">';
        html+='<div class="country-mini">';
        var countryFlags={India:'🇮🇳',USA:'🇺🇸','European Union':'🇪🇺',UK:'🇬🇧',Canada:'🇨🇦',Australia:'🇦🇺',Japan:'🇯🇵',Singapore:'🇸🇬'};
        var countryKeys=Object.keys(countryFlags);
        for(var i=0;i<countryKeys.length;i++){
            var cFlag=countryFlags[countryKeys[i]];cFlag=cFlag||'🌐';
            var cScore=calcCountryScore(regs,countryKeys[i]);
            var cClass=cScore>=70?'good':cScore>=40?'ok':'bad';
            html+='<div class="cmini-card '+cClass+'"><span class="cmini-flag">'+cFlag+'</span><span class="cmini-name">'+esc(countryKeys[i])+'</span><span class="cmini-score">'+cScore+'</span></div>';
        }
        html+='</div><div style="text-align:center;margin-top:12px;"><button class="btn-compare" onclick="openCountryModal()"><i class="bi bi-arrows-expand"></i> Full Comparison</button></div>';
        html+='</div></div>';

        // ═══════════════════════════════════════════════
        // SAFETY NEWS (food-only)
        // ═══════════════════════════════════════════════
        html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-newspaper"></i> <span>Safety News</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
        html+='<div class="sec-body expanded">'+newsHtml(news)+'</div></div>';

        // ═══════════════════════════════════════════════
        // AI SUMMARY (consumer language)
        // ═══════════════════════════════════════════════
        var ai=d.ai_summary||genAI(p,nut,score,alerts);
        html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-robot"></i> <span>AI Summary</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
        html+='<div class="sec-body expanded"><div class="ai-text">'+esc(ai)+'</div></div></div>';

        // ═══════════════════════════════════════════════
        // DATASET REGULATORY REPORT (compact, no stats)
        // ═══════════════════════════════════════════════
        var ds=d.dataset_regulatory_report||null;
        if(ds&&ds.rows&&ds.rows.length){
            html+='<div class="section-card"><div class="sec-header" onclick="toggleSection(this)"><i class="bi bi-database-check"></i> <span>Regulatory Details</span><i class="bi bi-chevron-down sec-chevron"></i></div>';
            html+='<div class="sec-body">'+buildDatasetRegulatoryCard(ds)+'</div></div>';
        }

        // ═══════════════════════════════════════════════
        // BETTER ALTERNATIVES (placeholder for future)
        // ═══════════════════════════════════════════════
        html+='<div class="alt-card"><div class="alt-header"><i class="bi bi-arrow-left-right"></i> <span>Healthier Alternatives</span></div>';
        html+='<div class="alt-body"><p class="text-muted">Look for products with fewer ingredients, lower sugar, and no artificial additives. Check the ingredient list and compare nutrition labels.</p>';
        html+='<a href="scanner.html" class="alt-btn"><i class="bi bi-upc-scan"></i> Scan Another Product</a></div></div>';

        // ── AI Chat CTA ──
        html+='<div class="chat-cta"><div><h3>🤖 Ask the AI</h3><p>Get personalized answers about this product.</p></div><a href="ai-chat.html" class="chat-btn"><i class="bi bi-chat-dots"></i> Ask AI</a></div>';

        c.innerHTML=html;
        c.style.display='block';
        log('Consumer UI rendered');

        try{localStorage.setItem('lps_ai_context',JSON.stringify({name:p.name,brand:p.brand,ingredients:ings,concern_score:score,allergens:alerts,nutrition:nut}));}catch(e){}
    }catch(e){log('Render error: '+e.message,'error');console.error(e);
        c.innerHTML='<div style="text-align:center;padding:60px 20px;"><i class="bi bi-exclamation-circle" style="font-size:3rem;color:#ef4444;"></i><h3 style="margin:16px 0 8px;">Analysis Available</h3><p style="color:#64748b;">'+esc((d&&d.product&&d.product.name)||'Product')+'</p></div>';c.style.display='block';}
}

// ── HELPERS ──

function starsFromScore(s){var n=Math.round((100-s)/20);n=Math.max(0,Math.min(5,n));var h='';for(var i=0;i<5;i++)h+=i<n?'⭐':'☆';return h;}

function toggleSection(h){var b=h.parentNode.querySelector('.sec-body');var ch=h.querySelector('.sec-chevron');if(!b)return;
    if(b.classList.contains('expanded')){b.classList.remove('expanded');if(ch)ch.className='bi bi-chevron-right sec-chevron';}
    else{b.classList.add('expanded');if(ch)ch.className='bi bi-chevron-down sec-chevron';}}

function calcCountryScore(regs,country){
    if(!regs||!regs.length)return 85;var total=0,count=0;
    for(var i=0;i<regs.length;i++){var ss=regs[i].regulatory_status||[];
        for(var j=0;j<ss.length;j++){if(ss[j].country&&ss[j].country.toLowerCase().indexOf(country.toLowerCase())>=0){
                if(ss[j].status==='Allowed')total+=100;else if(ss[j].status==='Restricted')total+=50;else if(ss[j].status==='Banned')total+=0;else total+=80;count++;}}}
    return count?Math.round(total/count):85;
}

function buildRegSummary(regs){
    if(!regs||!regs.length)return '<p class="text-muted" style="font-size:13px;">No verified regulatory information available.</p>';
    var h='';var totalAllowed=0,totalRestricted=0,totalBanned=0;
    for(var i=0;i<regs.length;i++){var ss=regs[i].regulatory_status||[];
        for(var j=0;j<ss.length;j++){if(ss[j].status==='Allowed')totalAllowed++;else if(ss[j].status==='Restricted')totalRestricted++;else if(ss[j].status==='Banned')totalBanned++;}}
    h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">';
    h+='<div style="display:flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);padding:6px 12px;border-radius:50px;font-size:12px;font-weight:600;color:#047857;"><i class="bi bi-check-circle-fill"></i> '+totalAllowed+' Allowed</div>';
    h+='<div style="display:flex;align-items:center;gap:6px;background:rgba(245,158,11,0.1);padding:6px 12px;border-radius:50px;font-size:12px;font-weight:600;color:#b45309;"><i class="bi bi-exclamation-circle-fill"></i> '+totalRestricted+' Restricted</div>';
    h+='<div style="display:flex;align-items:center;gap:6px;background:rgba(239,68,68,0.1);padding:6px 12px;border-radius:50px;font-size:12px;font-weight:600;color:#b91c1c;"><i class="bi bi-x-circle-fill"></i> '+totalBanned+' Banned</div>';
    h+='</div>';
    if(totalBanned>0){h+='<div style="background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;padding:12px;border-radius:8px;font-size:13px;color:#7f1d1d;">';for(var i=0;i<regs.length;i++){var ss=regs[i].regulatory_status||[];for(var j=0;j<ss.length;j++){if(ss[j].status==='Banned')h+='<div><strong>'+esc(regs[i].ingredient)+'</strong> banned in '+esc(ss[j].country)+'</div>';}}h+='</div>';}
    return h;
}

function nutritionTable(nut){
    var km={'energy-kcal_100g':['Calories','kcal'],'proteins_100g':['Protein','g'],'carbohydrates_100g':['Carbs','g'],'sugars_100g':['Sugars','g'],'fat_100g':['Fat','g'],'saturated-fat_100g':['Sat.Fat','g'],'fiber_100g':['Fiber','g'],'salt_100g':['Salt','g']};
    var n=nut;if(Array.isArray(n)){var o={};for(var i=0;i<n.length;i++){var k=(n[i].nutrientName||'').toLowerCase().replace(/ /g,'_')+'_100g';o[k]=n[i].amount;}n=o;}
    var rows='';var keys=Object.keys(km);
    for(var j=0;j<keys.length;j++){var key=keys[j];if(n[key]===undefined||n[key]===null)continue;var label=km[key][0],unit=km[key][1];var val=parseFloat(n[key]||0).toFixed(1);
        var cls='';if(key.indexOf('sugars')>=0&&val>15)cls='high';else if(key.indexOf('sugars')>=0&&val>5)cls='mod';else if(key.indexOf('salt')>=0&&val>1.5)cls='high';else if(key.indexOf('salt')>=0&&val>0.5)cls='mod';else if(key.indexOf('saturated')>=0&&val>5)cls='high';else if(key.indexOf('fiber')>=0&&val>3)cls='low';
        rows+='<div class="nut-row"><span class="nut-key">'+label+'</span><span class="nut-val '+cls+'">'+val+' '+unit+'</span></div>';}
    return rows?'<div class="nut-table">'+rows+'</div>':'<div class="note-empty">No nutrition data available.</div>';
}

function newsHtml(news){
    if(news&&news.length){var h='<div class="news-list">';for(var i=0;i<news.length;i++){var n=news[i];
        h+='<div class="news-item" onclick="window.open(\''+esc(n.link)+'\',\'_blank\')">';
        h+='<div class="ns-source">'+esc(n.source||'News')+'</div>';
        h+='<div class="ns-title">'+esc(n.title||'')+'</div>';
        h+='<div class="ns-date">'+esc(n.date||'')+'</div></div>';}h+='</div>';return h;}
    return'<div class="note-good"><i class="bi bi-shield-check"></i> No recent recalls or safety notices for this product.</div>';
}

function genAI(p,nut,score,alerts){
    var n=p.name||'this product',b=p.brand||'',sv=score||50;
    var s=n;if(b)s+=' by '+b;s+='. ';
    if(sv<=20)s+='Low concern — reasonable choice. ';
    else if(sv<=50)s+='Moderate concern — check labels. ';
    else if(sv<=80)s+='High concern — consider alternatives. ';
    else s+='Very high concern — avoid if possible. ';
    if(alerts&&alerts.length)s+='Allergens: '+alerts.join(', ')+'. ';
    var sugar=nut.sugars_100g,salt=nut.salt_100g,fiber=nut.fiber_100g;
    if(sugar>15)s+='High sugar ('+sugar+'g/100g). ';
    else if(sugar>5)s+=sugar+'g sugar/100g. ';
    if(salt>1.5)s+='High sodium ('+salt+'g/100g). ';
    if(fiber>3)s+='Good fiber ('+fiber+'g/100g). ';
    s+='Always read labels and consult professionals.';
    return s;
}

// ── INGREDIENT MODAL (Consumer-friendly) ──
function showIngModal(idx){
    var data=window.ad;if(!data||!data.ingredient_explanations||!data.ingredient_explanations[idx])return;
    var ing=data.ingredient_explanations[idx];
    var body=document.getElementById('ingredientDetailModalBody');if(!body)return;
    var additive=(data.additive_regulatory_report||[]).find(function(a){return a.name.toLowerCase()===ing.name.toLowerCase()||(ing.simple_name&&a.name.toLowerCase()===ing.simple_name.toLowerCase())||ing.name.toLowerCase().includes(a.name.toLowerCase());});
    var h='';
    h+='<div class="ing-modal-header"><h4>'+esc(ing.name||'')+'</h4>';
    if(ing.simple_name)h+='<p class="text-muted" style="font-size:13px;">Also called: '+esc(ing.simple_name)+'</p>';
    if(ing.ins_e)h+='<p class="text-muted" style="font-size:13px;">Code: '+esc(ing.ins_e)+'</p>';
    h+='</div>';
    var badgeClass='#10B981';if(ing.category==='Preservative'||ing.category==='Colour')badgeClass='#ef4444';else if(ing.category==='Sweetener'||ing.category==='Flavour Enhancer')badgeClass='#d97706';
    if(ing.category)h+='<div style="display:inline-block;padding:4px 12px;border-radius:50px;font-size:11px;font-weight:600;background:'+badgeClass+'22;color:'+badgeClass+';margin-bottom:12px;">'+esc(ing.category)+'</div>';
    if(additive)h+='<div style="display:inline-block;padding:4px 12px;border-radius:50px;font-size:11px;font-weight:600;background:#6366f122;color:#4338ca;margin-left:6px;">INS '+esc(additive.ins_no)+'</div>';

    if(ing.purpose)h+='<div style="margin:12px 0;"><strong style="font-size:13px;">What it does:</strong><p style="font-size:13px;color:#64748b;margin:4px 0 0;">'+esc(ing.purpose)+'</p></div>';
    if(ing.description)h+='<div style="margin:12px 0;"><strong style="font-size:13px;">Health Information:</strong><p style="font-size:13px;color:#64748b;margin:4px 0 0;line-height:1.6;">'+esc(ing.description)+'</p></div>';

    if(additive){
        h+='<hr style="margin:16px 0;"><strong style="font-size:13px;">Country Regulations:</strong>';
        var keys=Object.keys(additive.countries);
        for(var k=0;k<keys.length;k++){var c=keys[k],ci=additive.countries[c];
            var sb='#10B981';if(ci.status==='Banned')sb='#ef4444';else if(ci.status==='Restricted')sb='#d97706';
            h+='<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;"><span>'+esc(c)+'</span><span style="color:'+sb+';font-weight:600;">'+esc(ci.status)+'</span></div>';}
    }
    if(!ing.purpose&&!ing.description&&!additive)h+='<p class="text-muted" style="font-size:13px;">No detailed information available for this ingredient.</p>';
    body.innerHTML=h;
    var modal=new bootstrap.Modal(document.getElementById('ingredientDetailModal'));modal.show();
}

function openCountryModal(){
    var tc=document.getElementById('foodRegulationsTabContent');
    if(tc)tc.innerHTML=window.regHtml||'<p class="text-muted" style="font-size:13px;">No regulatory data available.</p>';
    renderAdditiveReport();
    var me=document.getElementById('regulatoryBottomSheet');
    var m=bootstrap.Modal.getInstance(me);if(!m)m=new bootstrap.Modal(me);m.show();
}

// ── Export ──
window.exportPage=function(type){
    if(type==='print'){window.print();return;}
    var w=window.open('','_blank');
    var h='<html><head><title>Product Report - Label Padegha Sabh</title>';
    h+='<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">';
    h+='<style>body{font-family:"Outfit",sans-serif;padding:40px;color:#333;}h1{font-weight:800;}';
    h+='table{width:100%;border-collapse:collapse;font-size:13px;}td,th{padding:8px 12px;border-bottom:1px solid #eee;}';
    h+='.section{margin:20px 0;padding:15px;border:1px solid #ddd;border-radius:12px;}</style></head><body onload="window.print()">';
    h+='<h1>Product Intelligence Report</h1>';
    var d=window.ad;if(d&&d.product){h+='<p><strong>'+esc(d.product.name)+'</strong> by '+esc(d.product.brand)+'</p>';h+='<p>Concern Score: '+(d.concern_score?d.concern_score.score:'N/A')+'/100</p>';}
    h+='<hr>';if(d&&d.ingredients){h+='<div class="section"><h3>Ingredients</h3><p>'+esc(d.ingredients.join(', '))+'</p></div>';}
    if(d&&d.allergens&&d.allergens.length){h+='<div class="section"><h3>Allergens</h3>';for(var a=0;a<d.allergens.length;a++)h+=esc(d.allergens[a].allergen)+', ';h+='</div>';}
    h+='<hr><p style="font-size:12px;color:#999;">Label Padegha Sabh</p></body></html>';
    w.document.write(h);w.document.close();
};

// ═══════════════════════════════════════════════════════════
// LEGACY: Additive Report functions (preserved for bottom sheet)
// ═══════════════════════════════════════════════════════════

function renderAdditiveReport(){
    var additives=window.ar||[];
    var searchVal=(document.getElementById('additiveSearchInput')?document.getElementById('additiveSearchInput').value.toLowerCase():'').trim();
    var filterCountryVal=document.getElementById('filterCountry')?document.getElementById('filterCountry').value:'';
    var filterStatusVal=document.getElementById('filterStatus')?document.getElementById('filterStatus').value:'';
    var filterRiskVal=document.getElementById('filterRisk')?document.getElementById('filterRisk').value:'';
    var sortVal=document.getElementById('sortAdditives')?document.getElementById('sortAdditives').value:'alphabetical';
    var filtered=additives.filter(function(a){
        var ms=!searchVal||a.name.toLowerCase().includes(searchVal)||a.ins_no.toLowerCase().includes(searchVal)||a.category.toLowerCase().includes(searchVal);
        var mcs=true;
        if(filterCountryVal){var cd=a.countries[filterCountryVal];if(!cd)mcs=false;else if(filterStatusVal&&cd.status!==filterStatusVal)mcs=false;}
        else if(filterStatusVal){var ss=Object.values(a.countries).map(function(c){return c.status;});if(!ss.includes(filterStatusVal))mcs=false;}
        var mr=!filterRiskVal||a.risk_level===filterRiskVal;return ms&&mcs&&mr;
    });
    filtered.sort(function(x,y){
        if(sortVal==='alphabetical')return x.name.localeCompare(y.name);
        else if(sortVal==='risk-desc'){var rw={"High Risk":3,"Moderate Risk":2,"Low Risk":1};return(rw[y.risk_level]||0)-(rw[x.risk_level]||0);}
        else if(sortVal==='strictness'){var gs=function(it){var s=0;Object.values(it.countries).forEach(function(c){if(c.status==='Banned')s+=5;else if(c.status==='Restricted')s+=2;});return s;};return gs(y)-gs(x);}
        return 0;
    });
    renderAdditiveStats(additives);
    var lc=document.getElementById('additiveReportList');if(!lc)return;
    if(!filtered.length){lc.innerHTML='<div class="text-center py-5"><h5 class="text-muted">No additives match your criteria.</h5></div>';return;}
    var html='<div class="accordion" id="additiveAccordion">';
    for(var j=0;j<filtered.length;j++){
        var add=filtered[j];
        var rIcon='🟢',rbc='bg-success';if(add.risk_level==='High Risk'){rIcon='🔴';rbc='bg-danger';}else if(add.risk_level==='Moderate Risk'){rIcon='🟡';rbc='bg-warning text-dark';}
        var isFssaiOk=add.countries["India (FSSAI)"].status==='Approved'?'🟢':(add.countries["India (FSSAI)"].status==='Banned'?'🔴':'🟡');
        html+='<div class="accordion-item mb-3 border rounded-4 overflow-hidden shadow-sm">';
        html+='<h2 class="accordion-header"><button class="accordion-button collapsed px-4 py-3" type="button" data-bs-toggle="collapse" data-bs-target="#collapseAdd-'+j+'">';
        html+='<div class="d-flex align-items-center w-100"><div class="me-3" style="font-size:1.5rem;">'+rIcon+'</div>';
        html+='<div class="text-start"><h5 class="mb-1" style="font-weight:700;color:#1e293b;">'+esc(add.name)+' <span class="badge bg-secondary ms-2" style="font-size:11px;">'+esc(add.ins_no)+'</span></h5>';
        html+='<p class="text-muted mb-0 small"><strong>'+esc(add.category)+'</strong> | FSSAI: '+isFssaiOk+' '+add.countries["India (FSSAI)"].status+'</p></div>';
        html+='<div class="ms-auto me-3"><span class="badge '+rbc+' px-3 py-1.5" style="border-radius:50px;">'+add.risk_level+'</span></div></div></button></h2>';
        html+='<div id="collapseAdd-'+j+'" class="accordion-collapse collapse" data-bs-parent="#additiveAccordion">';
        html+='<div class="accordion-body p-4 bg-white border-top">';
        html+='<p><strong>Purpose:</strong> '+esc(add.purpose)+'</p>';
        html+='<p><strong>Scientific Notes:</strong> '+esc(add.scientific_notes)+'</p>';
        html+='<p><strong>Health:</strong> '+esc(add.health_considerations)+'</p>';
        html+='<h6 class="mt-3 fw-bold">Country Status</h6>';
        var cKeys=Object.keys(add.countries);
        for(var k=0;k<cKeys.length;k++){var cn=cKeys[k],ci=add.countries[cn];
            var cb='bg-secondary',ci2='⚪';if(ci.status==='Approved'){cb='bg-success';ci2='🟢';}else if(ci.status==='Restricted'){cb='bg-warning text-dark';ci2='🟡';}else if(ci.status==='Banned'){cb='bg-danger';ci2='🔴';}
            html+='<div class="d-flex justify-content-between py-1" style="border-bottom:1px solid #f1f5f9;font-size:13px;"><span>'+esc(cn)+'</span><span class="badge '+cb+' px-2">'+ci2+' '+ci.status+'</span></div>';}
        html+='</div></div></div>';
    }
    html+='</div>';lc.innerHTML=html;
    if(!window.areAdditiveEventsBound){
        var b=function(id,fn){var el=document.getElementById(id);if(el)el.addEventListener('change',fn);};
        var bi=function(id,fn){var el=document.getElementById(id);if(el)el.addEventListener('input',fn);};
        bi('additiveSearchInput',renderAdditiveReport);b('filterCountry',renderAdditiveReport);b('filterStatus',renderAdditiveReport);b('filterRisk',renderAdditiveReport);b('sortAdditives',renderAdditiveReport);
        var csv=document.getElementById('btnExportCSV');if(csv)csv.addEventListener('click',function(e){e.preventDefault();exportAdditiveReport('csv');});
        var pdf=document.getElementById('btnExportPDF');if(pdf)pdf.addEventListener('click',function(e){e.preventDefault();exportAdditiveReport('pdf');});
        window.areAdditiveEventsBound=true;
    }
}
function renderAdditiveStats(additives){var sc=document.getElementById('additiveStatsContainer');if(!sc)return;
    var total=additives.length,ap=0,re=0,ba=0;
    additives.forEach(function(a){if(a.safety_status==='Approved')ap++;else if(a.safety_status==='Restricted')re++;else if(a.safety_status==='Banned')ba++;});
    var cs=total>0?Math.max(0,100-(ba*25)-(re*10)):100;
    var h='<div class="col-md-4"><div class="p-3 bg-light rounded-4 text-center"><h4 class="fw-bold">'+total+'</h4><small class="text-muted">Additives</small></div></div>';
    h+='<div class="col-md-4"><div class="p-3 bg-light rounded-4 text-center"><h4 class="fw-bold"><span class="text-success">'+ap+'</span>/<span class="text-warning">'+re+'</span>/<span class="text-danger">'+ba+'</span></h4><small class="text-muted">Approved/Restr/Ban</small></div></div>';
    h+='<div class="col-md-4"><div class="p-3 bg-light rounded-4 text-center"><h4 class="fw-bold">'+cs+'%</h4><small class="text-muted">Compliance</small></div></div>';
    sc.innerHTML=h;
}
function exportAdditiveReport(type){
    var a=window.ar||[];if(!a.length){alert('No data.');return;}
    if(type==='csv'){
        var r=[["Name","INS","Function","Safety","Risk","FSSAI","FDA","EU"]];
        a.forEach(function(x){r.push(['"'+x.name.replace(/"/g,'""')+'"','"'+x.ins_no.replace(/"/g,'""')+'"','"'+x.category.replace(/"/g,'""')+'"','"'+x.safety_status.replace(/"/g,'""')+'"','"'+x.risk_level.replace(/"/g,'""')+'"','"'+x.countries["India (FSSAI)"].status.replace(/"/g,'""')+'"','"'+x.countries["USA (FDA)"].status.replace(/"/g,'""')+'"','"'+x.countries["European Union (EFSA)"].status.replace(/"/g,'""')+'"']);});
        var c=r.map(function(e){return e.join(",");}).join("\n");var blob=new Blob([c],{type:'text/csv;charset=utf-8;'});var url=URL.createObjectURL(blob);var link=document.createElement("a");link.href=url;link.download="additive_report.csv";link.click();
    }
}

// ═══════════════════════════════════════════════════════════
// DATASET REGULATORY REPORT (compact)
// ═══════════════════════════════════════════════════════════

function buildDatasetRegulatoryCard(report){
    if(!report)return'<div class="note-empty">Not available.</div>';
    var rows=report.rows||[],summary=report.summary||{};
    if(!rows.length)return'<div class="note-empty">No matches in dataset.</div>';
    var h='';
    h+=buildDatasetSummaryBar(summary);
    h+='<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Ingredient</th><th>Status</th><th>Country</th><th>Details</th></tr></thead><tbody>';
    for(var i=0;i<rows.length;i++)h+=buildDatasetIngredientRows(rows[i]);
    h+='</tbody></table></div>';
    return h;
}
function buildDatasetSummaryBar(summary){
    var total=summary.total||0,banned=summary.banned||0,restricted=summary.restricted||0,allowed=summary.allowed||0;
    return '<div class="ds-summary-bar"><div class="ds-stat-pill ds-stat-total"><span class="ds-stat-num">'+total+'</span><span class="ds-stat-lbl">Scanned</span></div><div class="ds-stat-pill ds-stat-banned"><span class="ds-stat-num">'+banned+'</span><span class="ds-stat-lbl">Banned</span></div><div class="ds-stat-pill ds-stat-restricted"><span class="ds-stat-num">'+restricted+'</span><span class="ds-stat-lbl">Restricted</span></div><div class="ds-stat-pill ds-stat-allowed"><span class="ds-stat-num">'+allowed+'</span><span class="ds-stat-lbl">Allowed</span></div></div>';
}
function buildDatasetIngredientRows(row){
    var ingredient=esc(row.ingredient||'');var status=row.status||[];var matchedAs=row.matched_as||'';
    var addHits=row.additive_hits||[],euHits=row.eu_hits||[],recallHits=row.recall_hits||[];
    var sc='ds-status-nomatch',si='bi-dash-circle';
    if(status==='Banned'){sc='ds-status-banned';si='bi-x-circle-fill';}if(status==='Restricted'){sc='ds-status-restricted';si='bi-exclamation-circle-fill';}if(status==='Allowed'){sc='ds-status-allowed';si='bi-check-circle-fill';}
    var display=ingredient;if(matchedAs)display+=' <span class="ds-alias">('+esc(matchedAs)+')</span>';
    if(!addHits.length&&!euHits.length&&!recallHits.length)return'<tr class="ds-row-nomatch"><td class="ds-ing-cell">'+display+'</td><td><span class="ds-status-badge '+sc+'"><i class="bi '+si+'"></i> No Match</span></td><td>—</td><td>Not found in dataset.</td></tr>';
    var html='',rc=0;
    for(var a=0;a<addHits.length;a++){var h=addHits[a];var dp=[];if(h.status_limit)dp.push(esc(h.status_limit));if(h.food_category)dp.push('<em>'+esc(h.food_category)+'</em>');if(h.difference_notes)dp.push(esc(h.difference_notes));var detail=dp.join(' • ')||'—';
        var src='';if(h.ins_e_no&&h.ins_e_no!=='—')src+=esc(h.ins_e_no);if(h.table_group)src+=' — '+esc(h.table_group);
        html+='<tr class="ds-row'+(rc===0?' ds-row-first':'')+'">';if(rc===0){var trs=addHits.length+euHits.length+(recallHits.length||0);html+='<td class="ds-ing-cell" rowspan="'+trs+'">'+display+'</td><td class="ds-status-cell" rowspan="'+trs+'"><span class="ds-status-badge '+sc+'"><i class="bi '+si+'"></i>'+esc(status)+'</span></td>';}
        html+='<td>'+esc(h.jurisdiction||'—')+'</td><td>'+detail+'</td></tr>';rc++;}
    for(var e=0;e<euHits.length;e++){var eh=euHits[e];var edp=[];if(eh.status_limit)edp.push(esc(eh.status_limit));if(eh.reason)edp.push(esc(eh.reason));var euDetail=edp.join(' • ')||'—';
        html+='<tr class="ds-row ds-row-eu'+(rc===0?' ds-row-first':'')+'">';if(rc===0){html+='<td class="ds-ing-cell">'+display+'</td><td class="ds-status-cell"><span class="ds-status-badge '+sc+'"><i class="bi '+si+'"></i>'+esc(status)+'</span></td>';}
        html+='<td>'+esc(eh.jurisdiction||'EU')+'</td><td>'+euDetail+'</td></tr>';rc++;}
    for(var r=0;r<recallHits.length;r++){var rh=recallHits[r];var rdp=[];if(rh.brand&&rh.brand!=='Unspecified')rdp.push(esc(rh.brand)+' — '+esc(rh.product));if(rh.hazard)rdp.push(esc(rh.hazard));var recDetail=rdp.join(' • ')||'—';
        html+='<tr class="ds-row ds-row-recall'+(rc===0?' ds-row-first':'')+'">';if(rc===0){html+='<td class="ds-ing-cell">'+display+'</td><td class="ds-status-cell"><span class="ds-status-badge '+sc+'"><i class="bi '+si+'"></i>'+esc(status)+'</span></td>';}
        html+='<td>'+esc(rh.agency||'—')+'</td><td>'+recDetail+'</td></tr>';rc++;}
    return html;
}