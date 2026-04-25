/* ================================================================
   ADMIN.JS — Salon Haute Gamme Founty
   Dashboard d'administration
   ================================================================ */

var $ = function(sel) { return document.querySelector(sel); };
var $$ = function(sel) { return document.querySelectorAll(sel); };

/* ── On utilise _supabase (anon key) avec session auth pour accès complet ── */

/* ══════════════════════════════════════════
   AUTHENTIFICATION
   ══════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function() {
    checkSession();
    bindLoginEvents();
    bindTabEvents();
    bindModalEvents();
    bindCalendarNav();
});

function checkSession() {
    _supabase.auth.getSession().then(function(res) {
        if (res.data && res.data.session) {
            showDashboard(res.data.session.user);
        }
    }).catch(function(err) {
        console.error('Session check error:', err);
    });
}

function bindLoginEvents() {
    $('#btn-login').addEventListener('click', doLogin);
    $('#login-password').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doLogin();
    });
    $('#login-email').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') $('#login-password').focus();
    });
    $('#btn-logout').addEventListener('click', doLogout);
}

function doLogin() {
    var email = $('#login-email').value.trim();
    var password = $('#login-password').value;
    var errEl = $('#login-error');
    errEl.textContent = '';

    if (!email || !password) {
        errEl.textContent = 'Veuillez remplir tous les champs.';
        return;
    }

    var btn = $('#btn-login');
    btn.disabled = true;
    btn.textContent = 'Connexion...';

    _supabase.auth.signInWithPassword({ email: email, password: password })
        .then(function(res) {
            if (res.error) {
                errEl.textContent = 'Email ou mot de passe incorrect.';
                btn.disabled = false;
                btn.textContent = 'Se connecter';
                return;
            }
            showDashboard(res.data.user);
        })
        .catch(function() {
            errEl.textContent = 'Erreur de connexion.';
            btn.disabled = false;
            btn.textContent = 'Se connecter';
        });
}

function doLogout() {
    _supabase.auth.signOut().then(function() {
        $('#dashboard').style.display = 'none';
        $('#login-screen').style.display = '';
        $('#login-email').value = '';
        $('#login-password').value = '';
        $('#login-error').textContent = '';
    });
}

function showDashboard(user) {
    $('#login-screen').style.display = 'none';
    $('#dashboard').style.display = '';
    $('#admin-user').textContent = user.email;
    // Set today as default date for CA locale form
    var today = new Date();
    var todayStr = formatDateStr ? formatDateStr(today) : today.toISOString().slice(0, 10);
    // formatDateStr is defined later, use inline
    var dd = today;
    var cmDate = dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0');
    setTimeout(function() {
        var cmEl = document.getElementById('cm-date');
        if (cmEl) cmEl.value = cmDate;
        var addBtn = document.getElementById('btn-ca-add');
        if (addBtn) addBtn.addEventListener('click', addCaManuel);
    }, 100);
    loadAnalytics();
    initCalendar();
    loadRH();
}

/* ══════════════════════════════════════════
   TABS
   ══════════════════════════════════════════ */

function bindTabEvents() {
    $$('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.tab;
            $$('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            $$('.tab-content').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            $('#tab-' + tab).classList.add('active');

            if (tab === 'calendar') {
                loadCalendarData();
            }
            if (tab === 'rh') {
                loadRH();
            }
        });
    });
}

/* ══════════════════════════════════════════
   ANALYTIQUE
   ══════════════════════════════════════════ */

function loadAnalytics() {
    var db = _supabase;

    db.from('reservations')
        .select('*')
        .in('status', ['confirmed', 'advance_paid', 'completed'])
        .then(function(res) {
            if (res.error) {
                console.error('Analytics query error:', res.error);
            }
            var data = (res.data && res.data.length > 0) ? res.data : [];
            computeStats(data);
            renderCAChart(data);
            renderClientsChart(data);
            renderDonut(data);
            renderHoursChart(data);
            loadTotalCA(data);
            loadCaManuel();
        })
        .catch(function(err) {
            console.error('Analytics fetch error:', err);
        });
}

function computeStats(data) {
    var today = new Date();
    var todayStr = formatDateStr(today);

    /* Semaine courante (lun → dim) */
    var weekStart = getWeekStart(today);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    var weekStartStr = formatDateStr(weekStart);
    var weekEndStr = formatDateStr(weekEnd);

    /* Semaine prochaine aussi */
    var nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    var nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 6);
    var nextWeekEndStr = formatDateStr(nextWeekEnd);

    var todayRdv = data.filter(function(r) { return r.date === todayStr; });

    /* RDV sur les 2 semaines (courante + prochaine) */
    var twoWeeksRdv = data.filter(function(r) { return r.date >= weekStartStr && r.date <= nextWeekEndStr; });

    var caTotal = twoWeeksRdv.reduce(function(s, r) { return s + (r.total || 0); }, 0);
    var avgBasket = twoWeeksRdv.length > 0 ? Math.round(caTotal / twoWeeksRdv.length) : 0;

    /* Compteur total RDV à venir */
    var upcoming = data.filter(function(r) { return r.date >= todayStr; });

    $('#stat-today').textContent = todayRdv.length;
    $('#stat-week').textContent = upcoming.length;
    $('#stat-ca').textContent = caTotal.toLocaleString('fr-FR') + ' DH';
    $('#stat-avg').textContent = avgBasket + ' DH';
}

/* ── BAR CHART: CA / SEMAINE ── */
function renderCAChart(data) {
    var weeks = getRelevantWeeks();
    var values = weeks.map(function(w) {
        return data
            .filter(function(r) { return r.date >= w.start && r.date <= w.end; })
            .reduce(function(s, r) { return s + (r.total || 0); }, 0);
    });
    var labels = weeks.map(function(w) { return w.label; });

    $('#chart-ca').innerHTML = buildBarChart(values, labels, ' DH');
}

/* ── BAR CHART: CLIENTS / SEMAINE ── */
function renderClientsChart(data) {
    var weeks = getRelevantWeeks();
    var values = weeks.map(function(w) {
        return data.filter(function(r) { return r.date >= w.start && r.date <= w.end; }).length;
    });
    var labels = weeks.map(function(w) { return w.label; });

    $('#chart-clients').innerHTML = buildBarChart(values, labels, '');
}

/* ── DONUT: CATÉGORIES ── */
function renderDonut(data) {
    var catMap = {
        'c-': { name: 'Coiffure', count: 0, color: '#B87D6A' },
        'o-': { name: 'Ongles', count: 0, color: '#D4A574' },
        'v-': { name: 'Soins Visage', count: 0, color: '#8A7570' },
        'e-': { name: 'Esthétique', count: 0, color: '#5C4A42' },
        'm-': { name: 'Maquillage', count: 0, color: '#3D2E28' }
    };

    data.forEach(function(r) {
        if (!r.services || !Array.isArray(r.services)) return;
        r.services.forEach(function(svc) {
            var prefix = (svc.id || '').substring(0, 2);
            if (catMap[prefix]) catMap[prefix].count++;
        });
    });

    var cats = Object.keys(catMap).map(function(k) { return catMap[k]; });
    var total = cats.reduce(function(s, c) { return s + c.count; }, 0);

    if (total === 0) {
        $('#chart-donut').innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:2rem">Aucune donnée</p>';
        return;
    }

    var size = 160;
    var cx = size / 2, cy = size / 2, radius = 60, inner = 35;
    var svgPaths = '';
    var angle = -90;
    var activeCats = cats.filter(function(c) { return c.count > 0; });

    /* Cas spécial : une seule catégorie = cercle complet */
    if (activeCats.length === 1) {
        svgPaths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="' + activeCats[0].color + '" opacity="0.85"/>';
        svgPaths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + inner + '" fill="var(--noir-card)"/>';
    } else {
        cats.forEach(function(cat) {
            if (cat.count === 0) return;
            var slice = (cat.count / total) * 360;
            var startAngle = angle;
            var endAngle = angle + slice;
            var largeArc = slice > 180 ? 1 : 0;

            var x1 = cx + radius * Math.cos(startAngle * Math.PI / 180);
            var y1 = cy + radius * Math.sin(startAngle * Math.PI / 180);
            var x2 = cx + radius * Math.cos(endAngle * Math.PI / 180);
            var y2 = cy + radius * Math.sin(endAngle * Math.PI / 180);
            var ix1 = cx + inner * Math.cos(endAngle * Math.PI / 180);
            var iy1 = cy + inner * Math.sin(endAngle * Math.PI / 180);
            var ix2 = cx + inner * Math.cos(startAngle * Math.PI / 180);
            var iy2 = cy + inner * Math.sin(startAngle * Math.PI / 180);

            svgPaths += '<path d="M ' + x1 + ' ' + y1 + ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 1 ' + x2 + ' ' + y2 + ' L ' + ix1 + ' ' + iy1 + ' A ' + inner + ' ' + inner + ' 0 ' + largeArc + ' 0 ' + ix2 + ' ' + iy2 + ' Z" fill="' + cat.color + '" opacity="0.85"/>';
            angle = endAngle;
        });
    }

    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:' + size + 'px;height:' + size + 'px">' + svgPaths + '</svg>';

    var legend = '<div class="donut-legend">';
    cats.forEach(function(cat) {
        var pct = total > 0 ? Math.round(cat.count / total * 100) : 0;
        if (pct > 0 || cat.count > 0) {
            legend += '<div class="legend-item"><span class="legend-dot" style="background:' + cat.color + '"></span>' + cat.name + ' (' + pct + '%)</div>';
        }
    });
    legend += '</div>';

    $('#chart-donut').innerHTML = svg + legend;
}

/* ── BAR CHART: HEURES DE POINTE ── */
function renderHoursChart(data) {
    var hours = {};
    for (var h = 10; h <= 20; h++) {
        hours[h] = 0;
    }

    data.forEach(function(r) {
        if (!r.time) return;
        var hour = parseInt(r.time.split(':')[0]);
        if (hours[hour] !== undefined) hours[hour]++;
    });

    var labels = [];
    var values = [];
    for (var h = 10; h <= 20; h++) {
        labels.push(h + 'h');
        values.push(hours[h]);
    }

    $('#chart-hours').innerHTML = buildBarChart(values, labels, '');
}

/* ── SVG BAR CHART BUILDER ── */
function buildBarChart(values, labels, suffix) {
    var maxVal = Math.max.apply(null, values) || 1;
    var barCount = values.length;
    var padding = 40;
    var chartW = 400;
    var chartH = 180;
    var barW = Math.min(30, (chartW - padding * 2) / barCount - 6);
    var gap = (chartW - padding * 2 - barW * barCount) / (barCount - 1 || 1);

    var svg = '<svg viewBox="0 0 ' + chartW + ' ' + (chartH + 30) + '">';

    /* Gridlines */
    for (var i = 0; i <= 4; i++) {
        var y = padding + (chartH - padding * 2) * (1 - i / 4);
        var val = Math.round(maxVal * i / 4);
        svg += '<line x1="' + padding + '" y1="' + y + '" x2="' + (chartW - 10) + '" y2="' + y + '" stroke="rgba(184,125,106,0.08)" stroke-width="1"/>';
        svg += '<text x="' + (padding - 5) + '" y="' + (y + 3) + '" text-anchor="end" class="axis-label">' + val + '</text>';
    }

    /* Bars */
    values.forEach(function(v, idx) {
        var barH = maxVal > 0 ? ((v / maxVal) * (chartH - padding * 2)) : 0;
        var x = padding + idx * (barW + gap);
        var y = chartH - padding - barH;

        svg += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + barH + '" fill="var(--gold)" opacity="0.75" rx="1"/>';

        /* Value on top */
        if (v > 0) {
            svg += '<text x="' + (x + barW / 2) + '" y="' + (y - 5) + '" text-anchor="middle" class="bar-value">' + v.toLocaleString('fr-FR') + suffix + '</text>';
        }

        /* Label below */
        svg += '<text x="' + (x + barW / 2) + '" y="' + (chartH - padding + 15) + '" text-anchor="middle" class="bar-label">' + labels[idx] + '</text>';
    });

    svg += '</svg>';
    return svg;
}

/* ══════════════════════════════════════════
   CALENDRIER
   ══════════════════════════════════════════ */

var calendarState = {
    weekStart: getWeekStart(new Date()),
    rdvs: []
};

function initCalendar() {
    loadCalendarData();
}

function bindCalendarNav() {
    $('#cal-prev').addEventListener('click', function() {
        var ws = calendarState.weekStart;
        calendarState.weekStart = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() - 7);
        loadCalendarData();
    });
    $('#cal-next').addEventListener('click', function() {
        var ws = calendarState.weekStart;
        calendarState.weekStart = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7);
        loadCalendarData();
    });
    $('#cal-today').addEventListener('click', function() {
        calendarState.weekStart = getWeekStart(new Date());
        loadCalendarData();
    });
}

function loadCalendarData() {
    var ws = calendarState.weekStart;
    var we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);

    var startStr = formatDateStr(ws);
    var endStr = formatDateStr(we);

    var db = _supabase;
    db.from('reservations')
        .select('*')
        .gte('date', startStr)
        .lte('date', endStr)
        .order('time', { ascending: true })
        .then(function(res) {
            if (res.error) {
                console.error('Calendar query error:', res.error);
            }
            calendarState.rdvs = res.data || [];
            renderCalendar();
        })
        .catch(function(err) {
            console.error('Calendar fetch error:', err);
            calendarState.rdvs = [];
            renderCalendar();
        });
}

function renderCalendar() {
    var ws = calendarState.weekStart;
    var dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    var monthNames = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
    var todayStr = formatDateStr(new Date());

    /* Week title */
    var weEnd = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
    $('#cal-week-title').textContent = ws.getDate() + ' ' + monthNames[ws.getMonth()] + ' — ' + weEnd.getDate() + ' ' + monthNames[weEnd.getMonth()] + ' ' + weEnd.getFullYear();

    /* Build grid */
    var html = '';

    /* Header row: corner + 7 days */
    html += '<div class="cal-corner"></div>';
    for (var d = 0; d < 7; d++) {
        var day = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + d);
        var dateStr = formatDateStr(day);
        var isToday = dateStr === todayStr;
        html += '<div class="cal-day-header' + (isToday ? ' today' : '') + '">';
        html += '<span class="cal-day-name">' + dayNames[d] + '</span>';
        html += '<span class="cal-day-num">' + day.getDate() + '</span>';
        html += '</div>';
    }

    /* Time rows: 10h to 20h */
    for (var h = 10; h <= 20; h++) {
        html += '<div class="cal-hour-label">' + h + ':00</div>';

        for (var d = 0; d < 7; d++) {
            var day = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + d);
            var dateStr = formatDateStr(day);
            var currentH = h;

            /* Find RDVs for this cell (hour) */
            var cellRdvs = calendarState.rdvs.filter(function(r) {
                return r.date === dateStr && parseInt(r.time.split(':')[0]) === currentH;
            });

            html += '<div class="cal-cell">';
            cellRdvs.forEach(function(r) {
                html += '<div class="cal-rdv status-' + r.status + '" data-id="' + r.id + '">';
                html += '<span class="cal-rdv-time">' + r.time + '</span>';
                html += '<span class="cal-rdv-name">' + escapeHtml(r.client_name) + '</span>';
                html += '</div>';
            });
            html += '</div>';
        }
    }

    $('#calendar-grid').innerHTML = html;

    /* Bind RDV click */
    $$('.cal-rdv').forEach(function(el) {
        el.addEventListener('click', function() {
            var id = this.dataset.id;
            var rdv = calendarState.rdvs.find(function(r) { return r.id === id; });
            if (rdv) openModal(rdv);
        });
    });
}

/* ══════════════════════════════════════════
   MODAL RDV
   ══════════════════════════════════════════ */

function bindModalEvents() {
    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-overlay').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeModal();
    });
}

function openModal(rdv) {
    var statusLabels = {
        confirmed: 'Confirmé',
        advance_paid: 'Avance payée',
        completed: 'Terminé',
        cancelled: 'Annulé'
    };

    var html = '';
    html += '<span class="modal-status status-' + rdv.status + '">' + (statusLabels[rdv.status] || rdv.status) + '</span>';
    html += '<h3 class="modal-title">Détails du rendez-vous</h3>';

    html += '<div class="modal-row"><span class="modal-label">Client</span><span class="modal-value">' + escapeHtml(rdv.client_name) + '</span></div>';
    html += '<div class="modal-row"><span class="modal-label">Téléphone</span><span class="modal-value"><a href="tel:' + rdv.client_phone + '" style="color:var(--gold);text-decoration:none">' + escapeHtml(rdv.client_phone) + '</a></span></div>';

    if (rdv.client_email) {
        html += '<div class="modal-row"><span class="modal-label">Email</span><span class="modal-value">' + escapeHtml(rdv.client_email) + '</span></div>';
    }

    html += '<div class="modal-row"><span class="modal-label">Date</span><span class="modal-value">' + rdv.date + '</span></div>';
    html += '<div class="modal-row"><span class="modal-label">Heure</span><span class="modal-value">' + rdv.time + '</span></div>';

    if (rdv.note) {
        html += '<div class="modal-row"><span class="modal-label">Note</span><span class="modal-value">' + escapeHtml(rdv.note) + '</span></div>';
    }

    html += '<div class="modal-divider"></div>';

    /* Services */
    var services = rdv.services || [];
    services.forEach(function(svc) {
        html += '<div class="modal-svc-line"><span>' + escapeHtml(svc.name) + '</span><span class="price">' + svc.price + ' DH</span></div>';
    });

    html += '<div class="modal-divider"></div>';
    html += '<div class="modal-total-row"><span class="modal-total-label">Total</span><span class="modal-total-value">' + (rdv.total || 0) + ' DH</span></div>';

    if (rdv.advance > 0) {
        html += '<div class="modal-row"><span class="modal-label">Avance</span><span class="modal-value" style="color:var(--gold);font-weight:500">' + rdv.advance + ' DH' + (rdv.advance_paid ? ' (payée)' : '') + '</span></div>';
        html += '<div class="modal-row"><span class="modal-label">Reste</span><span class="modal-value">' + (rdv.total - rdv.advance) + ' DH</span></div>';
    }

    /* Actions */
    if (rdv.status !== 'cancelled' && rdv.status !== 'completed') {
        html += '<div class="modal-actions">';

        if (rdv.advance > 0 && !rdv.advance_paid && rdv.status === 'confirmed') {
            html += '<button class="modal-action-btn action-advance" data-action="advance_paid" data-id="' + rdv.id + '">Avance payée</button>';
        }

        html += '<button class="modal-action-btn action-complete" data-action="completed" data-id="' + rdv.id + '">Terminé</button>';
        html += '<button class="modal-action-btn action-cancel" data-action="cancelled" data-id="' + rdv.id + '">Annuler</button>';
        html += '</div>';
    }

    $('#modal-body').innerHTML = html;
    $('#modal-overlay').classList.add('open');

    /* Bind action buttons */
    $$('.modal-action-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var action = this.dataset.action;
            var id = this.dataset.id;
            updateRdvStatus(id, action);
        });
    });
}

function closeModal() {
    $('#modal-overlay').classList.remove('open');
}

function updateRdvStatus(id, newStatus) {
    var db = _supabase;
    var update = { status: newStatus };
    if (newStatus === 'advance_paid') {
        update.advance_paid = true;
    }

    db.from('reservations').update(update).eq('id', id).then(function(res) {
        if (res.error) {
            alert('Erreur: ' + res.error.message);
            return;
        }
        closeModal();
        loadCalendarData();
        loadAnalytics();
    });
}

/* ══════════════════════════════════════════
   UTILITAIRES
   ══════════════════════════════════════════ */

function formatDateStr(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getWeekStart(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay();
    var diff = day === 0 ? -6 : 1 - day; /* Monday start */
    d.setDate(d.getDate() + diff);
    return d;
}

/* 4 semaines passées + courante + prochaine = 6 semaines */
function getRelevantWeeks() {
    var weeks = [];
    var now = new Date();
    for (var i = -4; i <= 1; i++) {
        var ws = getWeekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() + i * 7));
        var we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6);
        weeks.push({
            start: formatDateStr(ws),
            end: formatDateStr(we),
            label: 'S' + getISOWeek(ws)
        });
    }
    return weeks;
}

function getISOWeek(d) {
    var date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    var week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function escapeHtml(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

/* ══════════════════════════════════════════
   CA TOTAL CONSOLIDÉ
   ══════════════════════════════════════════ */

function loadTotalCA(rdvs) {
    var now = new Date();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var y = now.getFullYear();
    var firstDay = y + '-' + m + '-01';
    var lastDayDate = new Date(y, now.getMonth() + 1, 0); // dernier jour réel du mois
    var lastDay  = y + '-' + m + '-' + String(lastDayDate.getDate()).padStart(2, '0');

    _supabase.from('ca_manuel')
        .select('montant')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .then(function(res) {
            var caRdv = rdvs
                .filter(function(r) { return r.date >= firstDay && r.date <= lastDay; })
                .reduce(function(s, r) { return s + (r.total || 0); }, 0);
            var caManuel = res.data
                ? res.data.reduce(function(s, r) { return s + r.montant; }, 0) : 0;
            var caTotal = caRdv + caManuel;

            var totalEl = document.getElementById('a-ca-total');
            var rdvEl   = document.getElementById('a-ca-rdv');
            var locEl   = document.getElementById('a-ca-local');
            if (totalEl) totalEl.textContent = caTotal.toLocaleString('fr-FR') + ' DH';
            if (rdvEl)   rdvEl.textContent   = 'Réservations : ' + caRdv.toLocaleString('fr-FR') + ' DH';
            if (locEl)   locEl.textContent   = 'Local : ' + caManuel.toLocaleString('fr-FR') + ' DH';
        })
        .catch(function(err) {
            console.error('loadTotalCA error:', err);
        });
}

/* ══════════════════════════════════════════
   SAISIE CA LOCALE
   ══════════════════════════════════════════ */

function addCaManuel() {
    var dateEl     = document.getElementById('cm-date');
    var catEl      = document.getElementById('cm-cat');
    var montantEl  = document.getElementById('cm-montant');
    var noteEl     = document.getElementById('cm-note');

    var date     = dateEl ? dateEl.value : '';
    var categorie= catEl ? catEl.value : '';
    var montant  = parseInt(montantEl ? montantEl.value : '0');
    var note     = noteEl ? noteEl.value.trim() || null : null;

    if (!date || !categorie || !montant || montant <= 0) {
        alert('Veuillez remplir la date, la catégorie et un montant valide.');
        return;
    }

    var btn = document.getElementById('btn-ca-add');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    _supabase.from('ca_manuel')
        .insert({ date: date, categorie: categorie, montant: montant, note: note })
        .then(function(res) {
            if (res.error) {
                alert('Erreur: ' + res.error.message);
                if (btn) { btn.disabled = false; btn.textContent = 'AJOUTER'; }
                return;
            }
            if (montantEl) montantEl.value = '';
            if (noteEl) noteEl.value = '';
            if (btn) { btn.disabled = false; btn.textContent = 'AJOUTER'; }
            loadCaManuel();
            loadAnalytics();
        })
        .catch(function(err) {
            console.error('addCaManuel error:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'AJOUTER'; }
        });
}

function loadCaManuel() {
    _supabase.from('ca_manuel')
        .select('*')
        .order('date', { ascending: false })
        .limit(20)
        .then(function(res) {
            renderCaTable(res.data || []);
        })
        .catch(function(err) {
            console.error('loadCaManuel error:', err);
            renderCaTable([]);
        });
}

function renderCaTable(data) {
    var wrap = document.getElementById('ca-table-wrap');
    if (!wrap) return;

    if (data.length === 0) {
        wrap.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);padding:1rem 0">Aucune entrée manuelle.</p>';
        return;
    }

    var html = '<div class="ca-table-wrap"><table class="ca-table">';
    html += '<thead><tr><th>Date</th><th>Catégorie</th><th>Montant</th><th>Note</th><th></th></tr></thead>';
    html += '<tbody>';
    data.forEach(function(row) {
        html += '<tr>';
        html += '<td>' + escapeHtml(row.date) + '</td>';
        html += '<td>' + escapeHtml(row.categorie) + '</td>';
        html += '<td class="ca-amount">' + row.montant.toLocaleString('fr-FR') + ' DH</td>';
        html += '<td>' + escapeHtml(row.note || '—') + '</td>';
        html += '<td><button class="btn-ca-del" data-id="' + row.id + '">Supprimer</button></td>';
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;

    wrap.querySelectorAll('.btn-ca-del').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var id = this.dataset.id;
            if (confirm('Supprimer cette entrée ?')) {
                deleteCaManuel(id);
            }
        });
    });
}

function deleteCaManuel(id) {
    _supabase.from('ca_manuel')
        .delete()
        .eq('id', id)
        .then(function(res) {
            if (res.error) {
                alert('Erreur: ' + res.error.message);
                return;
            }
            loadCaManuel();
            loadAnalytics();
        })
        .catch(function(err) {
            console.error('deleteCaManuel error:', err);
        });
}

/* ══════════════════════════════════════════
   RH & STOCK — ÉTAT GLOBAL
   ══════════════════════════════════════════ */

var rhState = {
    workers: [],
    products: [],
    assignments: []
};

function loadRH() {
    Promise.all([
        _supabase.from('workers').select('*').order('nom'),
        _supabase.from('products').select('*').order('nom'),
        _supabase.from('assignments')
            .select('*, workers(nom, prenom, departement), products(nom, prix, capacite_clients)')
            .order('assigned_at', { ascending: false })
    ]).then(function(results) {
        rhState.workers     = results[0].data || [];
        rhState.products    = results[1].data || [];
        rhState.assignments = results[2].data || [];

        renderWorkersTable();
        renderProductsTable();
        renderHistoryTable();
        updateAlertBadge();
        renderAlertBanner();
    }).catch(function(err) {
        console.error('loadRH error:', err);
    });
}
