/* ================================================================
   RESERVATION.JS — Salon Haute Gamme Founty
   Système de réservation en ligne
   ================================================================ */

/* ── CRÉNEAUX PRIS (chargés depuis Supabase) ── */
var TAKEN_SLOTS = [];

/* ── CATALOGUE COMPLET DES PRESTATIONS ──
   Modifier ce tableau pour ajouter/supprimer/changer les tarifs.
   Structure : catégories > sous-catégories > prestations
   ================================================================ */
var SERVICES = [
    {
        id: 'coiffure',
        name: 'Coiffure',
        subcategories: [
            {
                name: 'Coupe & Brushing',
                services: [
                    { id: 'c-coupe', name: 'Coupe', price: 100 },
                    { id: 'c-brushing-courts', name: 'Brushing courts', price: 50 },
                    { id: 'c-brushing-longs', name: 'Brushing longs', price: 100 }
                ]
            },
            {
                name: 'Coloration',
                services: [
                    { id: 'c-coloration-normale', name: 'Coloration normale', price: 250 },
                    { id: 'c-coloration-igora', name: 'Coloration Igora + Brushing', price: 350 },
                    { id: 'c-coloration-courts-sa', name: 'Coloration + Brushing courts sans amoniaque', price: 400 },
                    { id: 'c-coloration-longs-sa', name: 'Coloration + Brushing longs sans amoniaque', price: 500 },
                    { id: 'c-coloration-racines', name: 'Coloration racines', price: 150 },
                    { id: 'c-coloration-racines-sa', name: 'Coloration racines sans amoniaque', price: 250 }
                ]
            },
            {
                name: 'Décoloration',
                services: [
                    { id: 'c-decoloration-courts', name: 'Décoloration cheveux courts', price: 450 },
                    { id: 'c-decoloration-longs', name: 'Décoloration cheveux longs', price: 550 }
                ]
            },
            {
                name: 'Mèches & Balayage',
                services: [
                    { id: 'c-meches-courts', name: 'Mèches + Brushing courts', price: 700 },
                    { id: 'c-meches-longs', name: 'Mèches + Brushing longs', price: 1300 },
                    { id: 'c-balayage-courts', name: 'Balayage + Brushing courts', price: 800 },
                    { id: 'c-balayage-longs', name: 'Balayage + Brushing longs', price: 1400 }
                ]
            },
            {
                name: 'Soins cheveux',
                services: [
                    { id: 'c-soin-nutrition', name: 'Soin nutrition intense', price: 200 },
                    { id: 'c-soin-sublimateur', name: 'Soin sublimateur', price: 300 },
                    { id: 'c-soin-plex', name: 'Soin Plex Forte', price: 500 },
                    { id: 'c-soin-olaplex', name: 'Soin Olaplex Forte', price: 600 },
                    { id: 'c-soin-myorganics', name: 'Soin My.Organics', price: 300 }
                ]
            },
            {
                name: 'Lissage',
                services: [
                    { id: 'c-lissage-proteine', name: 'Lissage protéine normal', price: 700 },
                    { id: 'c-lissage-diamond', name: 'Lissage Black Diamond', price: 1300 }
                ]
            },
            {
                name: 'Shampoing & Masque',
                services: [
                    { id: 'c-shampoing-macadamia', name: 'Shampoing + Masque Macadamia', price: 30 },
                    { id: 'c-shampoing-loreal', name: 'Shampoing + Masque L\'Oréal', price: 50 }
                ]
            }
        ]
    },
    {
        id: 'ongles',
        name: 'Ongles',
        subcategories: [
            {
                name: 'Mains',
                services: [
                    { id: 'o-manucure', name: 'Manucure', price: 50 },
                    { id: 'o-soin-manucure', name: 'Soin manucure', price: 100 },
                    { id: 'o-soin-spa-mains', name: 'Soin spa mains', price: 150 }
                ]
            },
            {
                name: 'Pieds',
                services: [
                    { id: 'o-pedicure', name: 'Pédicure', price: 100 },
                    { id: 'o-soin-pedicure', name: 'Soin pédicure', price: 150 },
                    { id: 'o-soin-spa-pedicure', name: 'Soin spa pédicure', price: 250 },
                    { id: 'o-pedicure-royale', name: 'Pédicure royale', price: 350 }
                ]
            },
            {
                name: 'Vernis',
                services: [
                    { id: 'o-vernis-normal', name: 'Vernis normal', price: 30 },
                    { id: 'o-vernis-opi', name: 'Vernis OPI', price: 50 },
                    { id: 'o-vernis-permanent', name: 'Vernis permanent', price: 100 },
                    { id: 'o-vernis-semilac', name: 'Vernis permanent Semilac', price: 150 },
                    { id: 'o-biab', name: 'BIAB', price: 250 }
                ]
            },
            {
                name: 'Faux ongles',
                services: [
                    { id: 'o-faux-normal', name: 'Faux ongles + vernis normal', price: 130 },
                    { id: 'o-faux-permanent', name: 'Faux ongles + vernis permanent', price: 180 },
                    { id: 'o-faux-semilac', name: 'Faux ongles + permanent Semilac', price: 250 },
                    { id: 'o-faux-gel', name: 'Faux ongles en gel', price: 300 },
                    { id: 'o-faux-gel-semilac', name: 'Faux ongles gel + Semilac', price: 400 }
                ]
            },
            {
                name: 'Retouche & Dépose',
                services: [
                    { id: 'o-remplissage', name: 'Remplissage gel', price: 100 },
                    { id: 'o-depose-permanent', name: 'Dépose permanent', price: 70 },
                    { id: 'o-depose-gel', name: 'Dépose gel', price: 100 }
                ]
            }
        ]
    },
    {
        id: 'soins-visage',
        name: 'Soins Visage',
        subcategories: [
            {
                name: 'Classiques',
                services: [
                    { id: 'v-hydratant', name: 'Soin hydratant', price: 200 },
                    { id: 'v-nourrissant', name: 'Soin nourrissant', price: 200 },
                    { id: 'v-eclat', name: 'Soin éclat', price: 230 }
                ]
            },
            {
                name: 'Spécifiques',
                services: [
                    { id: 'v-normal', name: 'Soin normal', price: 300 },
                    { id: 'v-apaisant', name: 'Soin apaisant', price: 350 },
                    { id: 'v-eclaircissant', name: 'Soin éclaircissant', price: 400 },
                    { id: 'v-purifiant', name: 'Soin purifiant', price: 450 },
                    { id: 'v-oxygenant', name: 'Soin oxygénant', price: 450 },
                    { id: 'v-raffermissant', name: 'Soin raffermissant', price: 450 },
                    { id: 'v-hydrafacial', name: 'Soin Hydrafacial', price: 500 },
                    { id: 'v-antirides', name: 'Soin anti-rides', price: 500 },
                    { id: 'v-juvenil', name: 'Soin juvénil', price: 500 },
                    { id: 'v-eclat-hydratant', name: 'Soin éclat hydratant', price: 600 },
                    { id: 'v-complet', name: 'Soin complet', price: 750 },
                    { id: 'v-lifting', name: 'Soin lifting', price: 1000 }
                ]
            }
        ]
    },
    {
        id: 'esthetique',
        name: 'Esthétique',
        subcategories: [
            {
                name: 'Épilation',
                services: [
                    { id: 'e-sourcils', name: 'Sourcils', price: 40 },
                    { id: 'e-duvet', name: 'Duvet', price: 30 },
                    { id: 'e-menton', name: 'Menton', price: 30 },
                    { id: 'e-visage', name: 'Visage complet', price: 100 },
                    { id: 'e-aisselles', name: 'Aisselles', price: 50 },
                    { id: 'e-demi-bras', name: '1/2 bras', price: 50 },
                    { id: 'e-bras', name: 'Bras complets', price: 80 },
                    { id: 'e-ventre', name: 'Ventre', price: 50 },
                    { id: 'e-dos', name: 'Dos', price: 100 },
                    { id: 'e-demi-jambes', name: '1/2 jambes', price: 70 },
                    { id: 'e-jambes', name: 'Jambes complètes', price: 120 },
                    { id: 'e-complete', name: 'Épilation complète', price: 350 }
                ]
            }
        ]
    },
    {
        id: 'maquillage',
        name: 'Maquillage',
        subcategories: [
            {
                name: 'Maquillage & Cils',
                services: [
                    { id: 'm-coloration-sourcils', name: 'Coloration sourcils + épilation', price: 100 },
                    { id: 'm-faux-cils', name: 'Pose faux cils', price: 100 },
                    { id: 'm-jour', name: 'Maquillage du jour', price: 150 },
                    { id: 'm-soir', name: 'Maquillage du soir avec cils', price: 300 }
                ]
            }
        ]
    }
];

/* ── ICÔNES SVG (stroke, fill:none, style Lucide) ── */
var ICONS = {
    coiffure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
    ongles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v7"/><path d="M10 10V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 16"/></svg>',
    maquillage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 2-4 4-5.17 5.17"/><path d="M7.5 13.5 11 17"/><path d="M14 6l2 2"/></svg>',
    'soins-visage': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    esthetique: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 2c1 2 2 4.5 2 8 0 5.5-3.8 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'
};

/* ── ORDRE DES CATÉGORIES DANS LA BANDE ── */
var CATEGORY_ORDER = ['coiffure', 'ongles', 'maquillage', 'soins-visage', 'esthetique'];

/* ── TABLE DE LOOKUP (construite à l'init) ── */
var SERVICE_MAP = {};

/* ── ÉTAT DE LA RÉSERVATION ── */
var state = {
    step: 1,
    activeCategory: null,
    activeSubcategory: null,
    selected: [],
    date: null,
    time: null,
    name: '',
    phone: '',
    email: '',
    note: ''
};

/* ── HELPERS DOM ── */
var $ = function(sel) { return document.querySelector(sel); };
var $$ = function(sel) { return document.querySelectorAll(sel); };

/* ── INITIALISATION ── */
document.addEventListener('DOMContentLoaded', function() {
    buildServiceMap();
    renderCategoryGrid();
    renderDays();
    renderTimeSlots();
    bindFormEvents();
    bindNavButtons();
    updateUI();
});

function buildServiceMap() {
    SERVICES.forEach(function(cat) {
        cat.subcategories.forEach(function(sub) {
            sub.services.forEach(function(svc) {
                SERVICE_MAP[svc.id] = svc;
            });
        });
    });
}

/* ══════════════════════════════════════════
   ÉTAPE 1 — GRILLE CATÉGORIES + ACCORDÉON
   ══════════════════════════════════════════ */

function renderCategoryGrid() {
    var container = $('#category-grid');
    var html = '';

    CATEGORY_ORDER.forEach(function(catId) {
        var cat = SERVICES.find(function(c) { return c.id === catId; });
        html += '<div class="cat-tab" data-cat="' + catId + '">';
        html += '<div class="cat-icon">' + ICONS[catId] + '</div>';
        html += '<span class="cat-label">' + cat.name + '</span>';
        html += '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll('.cat-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            var catId = this.dataset.cat;
            if (state.activeCategory === catId) {
                state.activeCategory = null;
                state.activeSubcategory = null;
                closeAccordion();
            } else {
                state.activeCategory = catId;
                state.activeSubcategory = null;
                renderAccordionPanel(catId);
            }
            updateCategoryHighlight();
        });
    });
}

function updateCategoryHighlight() {
    $$('.cat-tab').forEach(function(t) {
        t.classList.toggle('active', t.dataset.cat === state.activeCategory);
    });
}

function closeAccordion() {
    var panel = $('#accordion-panel');
    panel.innerHTML = '';
    panel.classList.remove('open');
}

function renderAccordionPanel(catId) {
    var panel = $('#accordion-panel');
    var cat = SERVICES.find(function(c) { return c.id === catId; });
    if (!cat) { closeAccordion(); return; }

    var html = '';
    cat.subcategories.forEach(function(sub, idx) {
        var isOpen = state.activeSubcategory === idx;
        html += '<div class="subcat-section' + (isOpen ? ' open' : '') + '">';

        html += '<div class="subcat-header" data-cat="' + catId + '" data-idx="' + idx + '">';
        html += '<span class="subcat-name">' + sub.name + '</span>';
        html += '<span class="subcat-count">' + sub.services.length + '</span>';
        html += '<svg class="subcat-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
        html += '</div>';

        if (isOpen) {
            html += '<div class="subcat-services">';
            sub.services.forEach(function(svc) {
                var isSel = state.selected.indexOf(svc.id) !== -1;
                html += '<div class="svc-row' + (isSel ? ' selected' : '') + '" data-id="' + svc.id + '">';
                html += '<span class="svc-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>';
                html += '<span class="svc-name">' + svc.name + '</span>';
                html += '<span class="svc-price">' + svc.price + ' DH</span>';
                html += '</div>';
            });
            html += '</div>';
        }

        html += '</div>';
    });

    panel.innerHTML = html;
    panel.classList.add('open');

    /* Bind subcategory headers */
    panel.querySelectorAll('.subcat-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var idx = parseInt(this.dataset.idx);
            state.activeSubcategory = state.activeSubcategory === idx ? null : idx;
            renderAccordionPanel(catId);
        });
    });

    /* Bind service rows */
    panel.querySelectorAll('.svc-row').forEach(function(row) {
        row.addEventListener('click', function() {
            var id = this.dataset.id;
            var idx = state.selected.indexOf(id);
            if (idx === -1) {
                state.selected.push(id);
            } else {
                state.selected.splice(idx, 1);
            }
            this.classList.toggle('selected', state.selected.indexOf(id) !== -1);
            updateTotalBar();
        });
    });
}

/* ── BARRE DE TOTAL ── */
function updateTotalBar() {
    var services = getSelectedServices();
    var total = getTotal();
    var advance = getAdvance(total);

    var tagsHtml = '';
    services.forEach(function(s) {
        tagsHtml += '<span class="selected-tag">' + s.name + '</span>';
    });
    $('#selected-tags').innerHTML = tagsHtml;
    $('#total-main').textContent = total + ' DH';

    var advEl = $('#total-advance');
    if (advance > 0) {
        advEl.textContent = 'Avance requise : ' + advance + ' DH';
        advEl.style.display = '';
    } else {
        advEl.style.display = 'none';
    }

    $('#btn-step1-next').disabled = services.length === 0;

    var bar = $('#total-bar');
    if (services.length > 0 && state.step === 1) {
        bar.classList.add('visible');
    } else {
        bar.classList.remove('visible');
    }
}

/* ══════════════════════════════════════════
   ÉTAPE 2 — CHOIX DU CRÉNEAU
   ══════════════════════════════════════════ */

function renderDays() {
    var container = $('#days-row');
    var dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    var monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
    var today = new Date();

    var html = '';
    for (var i = 0; i < 7; i++) {
        var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        var dn = dayNames[d.getDay()];
        var num = String(d.getDate()).padStart(2, '0');
        var mn = monthNames[d.getMonth()];
        var dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + num;
        var label = dn + ' ' + num + ' ' + mn;

        html += '<button class="day-btn" data-date="' + dateStr + '" data-label="' + label + '">';
        html += '<span class="day-name">' + dn + '</span>';
        html += '<span class="day-number">' + num + '</span>';
        html += '<span class="day-month">' + mn + '</span>';
        html += '</button>';
    }

    container.innerHTML = html;

    $$('.day-btn').forEach(function(el) {
        el.addEventListener('click', function() {
            state.date = { dateStr: this.dataset.date, label: this.dataset.label };
            state.time = null;
            updateStep2UI();
            fetchTakenSlots(this.dataset.date);
        });
    });
}

/* ── CHARGER LES CRÉNEAUX PRIS DEPUIS SUPABASE ── */
function fetchTakenSlots(dateStr) {
    if (typeof _supabase === 'undefined') { renderTimeSlots(); return; }

    _supabase
        .from('reservations')
        .select('time')
        .eq('date', dateStr)
        .in('status', ['confirmed', 'advance_paid'])
        .then(function(res) {
            if (res.data) {
                TAKEN_SLOTS = res.data.map(function(r) { return r.time; });
            } else {
                TAKEN_SLOTS = [];
            }
            renderTimeSlots();
        })
        .catch(function() {
            TAKEN_SLOTS = [];
            renderTimeSlots();
        });
}

function renderTimeSlots() {
    var container = $('#time-grid');
    var html = '';

    for (var h = 10; h <= 20; h++) {
        for (var m = 0; m < 60; m += 30) {
            if (h === 20 && m === 30) continue;
            var t = String(h).padStart(2, '0') + ':' + (m === 0 ? '00' : '30');
            var taken = TAKEN_SLOTS.indexOf(t) !== -1;
            html += '<button class="time-btn' + (taken ? ' taken' : '') + '" data-time="' + t + '"' + (taken ? ' disabled' : '') + '>' + t + '</button>';
        }
    }

    container.innerHTML = html;

    $$('.time-btn:not(.taken)').forEach(function(el) {
        el.addEventListener('click', function() {
            state.time = this.dataset.time;
            updateStep2UI();
        });
    });
}

function updateStep2UI() {
    $$('.day-btn').forEach(function(el) {
        el.classList.toggle('selected', state.date && el.dataset.date === state.date.dateStr);
    });
    $$('.time-btn:not(.taken)').forEach(function(el) {
        el.classList.toggle('selected', state.time === el.dataset.time);
    });
    $('#btn-step2-next').disabled = !(state.date && state.time);
}

/* ══════════════════════════════════════════
   ÉTAPE 3 — FORMULAIRE + RÉCAP
   ══════════════════════════════════════════ */

function bindFormEvents() {
    $('#input-name').addEventListener('input', function() { state.name = this.value.trim(); updateStep3UI(); });
    $('#input-phone').addEventListener('input', function() { state.phone = this.value.trim(); updateStep3UI(); });
    $('#input-email').addEventListener('input', function() { state.email = this.value.trim(); });
    $('#input-note').addEventListener('input', function() { state.note = this.value.trim(); });
}

function updateStep3UI() {
    var total = getTotal();
    var advance = getAdvance(total);
    var services = getSelectedServices();

    var tagsHtml = '';
    services.forEach(function(s) { tagsHtml += '<span class="selected-tag">' + s.name + '</span>'; });
    $('#recap-tags').innerHTML = tagsHtml;
    $('#recap-date').textContent = state.date ? state.date.label : '—';
    $('#recap-time').textContent = state.time || '—';
    $('#recap-total').textContent = total + ' DH';

    if (advance > 0) {
        $('#recap-advance-row').style.display = '';
        $('#recap-remain-row').style.display = '';
        $('#recap-advance-note').style.display = '';
        $('#recap-advance-value').textContent = advance + ' DH';
        $('#recap-remain-value').textContent = (total - advance) + ' DH';
    } else {
        $('#recap-advance-row').style.display = 'none';
        $('#recap-remain-row').style.display = 'none';
        $('#recap-advance-note').style.display = 'none';
    }

    var btn = $('#btn-confirm');
    btn.disabled = !(state.name && state.phone);
    if (advance > 0) {
        btn.textContent = 'Confirmer & payer ' + advance + ' DH d\'avance';
    } else {
        btn.textContent = 'Confirmer ma réservation';
    }
}

/* ══════════════════════════════════════════
   NAVIGATION ENTRE ÉTAPES
   ══════════════════════════════════════════ */

function bindNavButtons() {
    $('#btn-step1-next').addEventListener('click', function() { goToStep(2); });
    $('#btn-step2-back').addEventListener('click', function() { goToStep(1); });
    $('#btn-step2-next').addEventListener('click', function() { goToStep(3); });
    $('#btn-step3-back').addEventListener('click', function() { goToStep(2); });
    $('#btn-confirm').addEventListener('click', function() { submitReservation(); });
}

function goToStep(n) {
    state.step = n;
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── CALCULS ── */
function getTotal() {
    var total = 0;
    state.selected.forEach(function(id) {
        if (SERVICE_MAP[id]) total += SERVICE_MAP[id].price;
    });
    return total;
}

function getAdvance(total) {
    if (total <= 500) return 0;
    if (total <= 1000) return 100;
    return Math.ceil(total * 0.20 / 50) * 50;
}

function getSelectedServices() {
    return state.selected.map(function(id) { return SERVICE_MAP[id]; }).filter(Boolean);
}

/* ── MISE À JOUR GLOBALE ── */
function updateUI() {
    updateProgressBar();
    showCurrentStep();
    updateTotalBar();
    updateStep2UI();
    updateStep3UI();
}

function updateProgressBar() {
    for (var i = 1; i <= 3; i++) {
        var el = $('#progress-step-' + i);
        el.classList.remove('active', 'done');
        if (i < state.step) el.classList.add('done');
        if (i === state.step) el.classList.add('active');
    }
    $('#progress-line-1').classList.toggle('filled', state.step > 1);
    $('#progress-line-2').classList.toggle('filled', state.step > 2);
}

function showCurrentStep() {
    $$('.step').forEach(function(el) { el.classList.remove('active'); });
    var cur = $('#step-' + state.step);
    if (cur) cur.classList.add('active');
}

/* ══════════════════════════════════════════
   ÉTAPE 4 — CONFIRMATION
   ══════════════════════════════════════════ */

function submitReservation() {
    if (!state.name || !state.phone) return;

    var total = getTotal();
    var advance = getAdvance(total);
    var services = getSelectedServices();

    /* ── Insertion Supabase ── */
    if (typeof _supabase !== 'undefined') {
        var btn = $('#btn-confirm');
        btn.disabled = true;
        btn.textContent = 'Envoi en cours...';

        var payload = {
            client_name: state.name,
            client_phone: state.phone,
            client_email: state.email || null,
            note: state.note || null,
            services: services.map(function(s) { return { id: s.id, name: s.name, price: s.price }; }),
            date: state.date.dateStr,
            time: state.time,
            total: total,
            advance: advance,
            status: advance > 0 ? 'confirmed' : 'confirmed',
            advance_paid: false
        };

        _supabase.from('reservations').insert([payload]).then(function(res) {
            if (res.error) {
                console.error('Supabase insert error:', res.error);
                alert('Erreur lors de la réservation. Veuillez réessayer.');
                btn.disabled = false;
                updateStep3UI();
                return;
            }
            showConfirmation(services, total, advance);
        }).catch(function(err) {
            console.error('Supabase error:', err);
            alert('Erreur de connexion. Veuillez réessayer.');
            btn.disabled = false;
            updateStep3UI();
        });
        return;
    }

    /* Fallback sans Supabase */
    showConfirmation(services, total, advance);
}

function showConfirmation(services, total, advance) {

    var svcHtml = '';
    services.forEach(function(s) {
        svcHtml += '<div class="confirm-svc-line"><span>' + escapeHtml(s.name) + '</span><span class="price">' + s.price + ' DH</span></div>';
    });

    var advHtml = '';
    if (advance > 0) {
        advHtml += '<div class="recap-divider"></div>';
        advHtml += '<div class="recap-row"><span class="recap-label">Avance à payer</span><span class="recap-value" style="color:var(--gold);font-weight:500">' + advance + ' DH</span></div>';
        advHtml += '<div class="recap-row"><span class="recap-label">Reste sur place</span><span class="recap-value">' + (total - advance) + ' DH</span></div>';
        advHtml += '<div class="recap-advance-note"><strong>Avance requise :</strong> Une avance de ' + advance + ' DH est demandée pour confirmer votre réservation. Le reste (' + (total - advance) + ' DH) sera réglé sur place le jour du rendez-vous.</div>';
    }

    var container = $('#confirmation-content');
    container.innerHTML =
        '<div class="confirm-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
        '<h2>Réservation confirmée !</h2>' +
        '<p class="confirm-sub">Un SMS de confirmation vous sera envoyé</p>' +
        '<div class="confirm-recap">' +
        '<h3>Récapitulatif</h3>' +
        '<div class="recap-row"><span class="recap-label">Nom</span><span class="recap-value">' + escapeHtml(state.name) + '</span></div>' +
        '<div class="recap-row"><span class="recap-label">Téléphone</span><span class="recap-value">' + escapeHtml(state.phone) + '</span></div>' +
        (state.email ? '<div class="recap-row"><span class="recap-label">Email</span><span class="recap-value">' + escapeHtml(state.email) + '</span></div>' : '') +
        '<div class="recap-divider"></div>' +
        '<div class="recap-row"><span class="recap-label">Date</span><span class="recap-value">' + state.date.label + '</span></div>' +
        '<div class="recap-row"><span class="recap-label">Heure</span><span class="recap-value">' + state.time + '</span></div>' +
        (state.note ? '<div class="recap-row"><span class="recap-label">Note</span><span class="recap-value">' + escapeHtml(state.note) + '</span></div>' : '') +
        '<div class="recap-divider"></div>' +
        svcHtml +
        '<div class="recap-divider"></div>' +
        '<div class="recap-row"><span class="recap-label" style="font-weight:500;color:var(--cream)">Total</span><span class="recap-total">' + total + ' DH</span></div>' +
        advHtml +
        '</div>' +
        '<button class="btn-reset" id="btn-reset">Nouvelle réservation</button>';

    state.step = 4;
    updateProgressBar();
    $$('.step').forEach(function(el) { el.classList.remove('active'); });
    $('#step-4').classList.add('active');
    $('#total-bar').classList.remove('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    $('#btn-reset').addEventListener('click', resetReservation);
}

/* ── RESET ── */
function resetReservation() {
    state = {
        step: 1,
        activeCategory: null,
        activeSubcategory: null,
        selected: [],
        date: null,
        time: null,
        name: '',
        phone: '',
        email: '',
        note: ''
    };
    $('#input-name').value = '';
    $('#input-phone').value = '';
    $('#input-email').value = '';
    $('#input-note').value = '';
    closeAccordion();
    updateCategoryHighlight();
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── UTILITAIRE ── */
function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ══════════════════════════════════════════
   HEADER SCROLL + MOBILE MENU
   ══════════════════════════════════════════ */
(function() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    window.addEventListener('scroll', function() {
        header.classList.toggle('scrolled', window.scrollY > 80);
    }, { passive: true });
})();

(function() {
    var toggle = document.querySelector('.menu-toggle');
    var nav = document.querySelector('nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function() {
        var isOpen = nav.classList.toggle('open');
        toggle.classList.toggle('active');
        toggle.setAttribute('aria-expanded', isOpen);
        toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
        document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    nav.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
            nav.classList.remove('open');
            toggle.classList.remove('active');
            toggle.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        });
    });
})();
