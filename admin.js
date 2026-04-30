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
    loadComptaPending();
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

    html += '<div class="modal-row"><span class="modal-label">Date</span><span class="modal-value">' + escapeHtml(String(rdv.date || '')) + '</span></div>';
    html += '<div class="modal-row"><span class="modal-label">Heure</span><span class="modal-value">' + escapeHtml(String(rdv.time || '')) + '</span></div>';

    if (rdv.note) {
        html += '<div class="modal-row"><span class="modal-label">Note</span><span class="modal-value">' + escapeHtml(rdv.note) + '</span></div>';
    }

    html += '<div class="modal-divider"></div>';

    /* Services */
    var services = rdv.services || [];
    services.forEach(function(svc) {
        html += '<div class="modal-svc-line"><span>' + escapeHtml(svc.name) + '</span><span class="price">' + escapeHtml(String(svc.price || '')) + ' DH</span></div>';
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
        loadComptaPending();

        if (newStatus === 'completed') {
            triggerAutoConsumption(id);
        }
    }).catch(function(err) {
        console.error('updateRdvStatus error:', err);
        alert('Erreur de connexion. Veuillez réessayer.');
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

/* ══════════════════════════════════════════
   RH — ALERTES
   ══════════════════════════════════════════ */

/* Retourne 'ok' | 'low' | 'critical' */
function computeAlertState(assignment) {
    var cap    = assignment.products ? assignment.products.capacite_clients : 0;
    var served = assignment.clients_served || 0;
    if (cap <= 0) return 'ok';
    if (served >= cap) return 'critical';
    var pctRestant = ((cap - served) / cap) * 100;
    return pctRestant <= 30 ? 'low' : 'ok';
}

/* Badge rouge sur l'onglet */
function updateAlertBadge() {
    var badge = document.getElementById('rh-alert-badge');
    if (!badge) return;
    var count = rhState.assignments.filter(function(a) {
        return a.status === 'active' && computeAlertState(a) !== 'ok';
    }).length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
    } else {
        badge.style.display = 'none';
    }
}

/* Bandeau dans l'onglet RH */
function renderAlertBanner() {
    var banner = document.getElementById('rh-alert-banner');
    var inner  = document.getElementById('rh-alert-banner-inner');
    if (!banner || !inner) return;

    var alerts = rhState.assignments.filter(function(a) {
        return a.status === 'active' && computeAlertState(a) !== 'ok';
    });

    if (alerts.length === 0) {
        banner.style.display = 'none';
        return;
    }

    banner.style.display = 'block';
    var html = '';
    alerts.forEach(function(a) {
        var state      = computeAlertState(a);
        var workerName = a.workers ? (a.workers.prenom + ' ' + a.workers.nom) : '—';
        var prodName   = a.products ? a.products.nom : '—';
        var cap        = a.products ? a.products.capacite_clients : 0;
        var restant    = cap - (a.clients_served || 0);

        if (state === 'critical') {
            html += '<div class="rh-alert-item critical"><i class="fas fa-exclamation-circle"></i>';
            html += escapeHtml(workerName) + ' — ' + escapeHtml(prodName) + ' : ÉPUISÉE — Renouveler';
            html += '</div>';
        } else {
            html += '<div class="rh-alert-item"><i class="fas fa-exclamation-triangle"></i>';
            html += 'Attention — ' + escapeHtml(workerName) + ' — ' + escapeHtml(prodName) + ' : ' + restant + ' cliente(s) restante(s)';
            html += '</div>';
        }
    });
    inner.innerHTML = html;
}

/* ══════════════════════════════════════════
   RH — TRAVAILLEURS
   ══════════════════════════════════════════ */

function renderWorkersTable() {
    var wrap = document.getElementById('workers-table-wrap');
    if (!wrap) return;

    if (rhState.workers.length === 0) {
        wrap.innerHTML = '<p class="rh-empty">Aucun travailleur enregistré.</p>';
        bindAddWorkerBtn();
        return;
    }

    var html = '<div class="ca-table-wrap"><table class="rh-table">';
    html += '<thead><tr><th>Prénom Nom</th><th>Département</th><th>Produits actifs</th><th>Actions</th></tr></thead><tbody>';

    rhState.workers.forEach(function(w) {
        var actives = rhState.assignments.filter(function(a) {
            return a.worker_id === w.id && a.status === 'active';
        });

        var pillsHtml = '';
        if (actives.length === 0) {
            pillsHtml = '<span style="color:var(--text-muted);font-size:0.75rem">Aucun produit assigné</span>';
        } else {
            actives.forEach(function(a) {
                var state   = computeAlertState(a);
                var cap     = a.products ? a.products.capacite_clients : 0;
                var restant = cap - (a.clients_served || 0);
                var pName   = a.products ? a.products.nom : '?';
                var label   = state === 'critical'
                    ? pName + ' — ÉPUISÉE'
                    : pName + ' (' + restant + '/' + cap + ')';
                pillsHtml += '<span class="stock-pill ' + state + '"><span class="stock-dot"></span>' + escapeHtml(label) + '</span>';
            });
        }

        var actionsHtml = '<button class="btn-rh-action" onclick="openAssignProductModal(\'' + w.id + '\')">Assigner produit</button>';
        actives.forEach(function(a) {
            var pName = a.products ? a.products.nom : '?';
            actionsHtml += '<button class="btn-rh-action" onclick="openAddConsumptionModal(\'' + a.id + '\')">+ Clients (' + escapeHtml(pName) + ')</button>';
        });

        html += '<tr>';
        html += '<td>' + escapeHtml(w.prenom) + ' ' + escapeHtml(w.nom) + '</td>';
        html += '<td>' + escapeHtml(w.departement) + '</td>';
        html += '<td>' + pillsHtml + '</td>';
        html += '<td>' + actionsHtml + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    bindAddWorkerBtn();
}

function bindAddWorkerBtn() {
    var btn = document.getElementById('btn-add-worker');
    if (btn) btn.onclick = openAddWorkerModal;
}

/* ══════════════════════════════════════════
   RH — PRODUITS + HISTORIQUE
   ══════════════════════════════════════════ */

function renderProductsTable() {
    var wrap = document.getElementById('products-table-wrap');
    if (!wrap) return;

    if (rhState.products.length === 0) {
        wrap.innerHTML = '<p class="rh-empty">Aucun produit enregistré.</p>';
        bindAddProductBtn();
        return;
    }

    var html = '<div class="ca-table-wrap"><table class="rh-table">';
    html += '<thead><tr><th>Produit</th><th>Prix</th><th>Capacité</th><th>Assignments actifs</th></tr></thead><tbody>';

    rhState.products.forEach(function(p) {
        var actives = rhState.assignments.filter(function(a) {
            return a.product_id === p.id && a.status === 'active';
        });
        html += '<tr>';
        html += '<td>' + escapeHtml(p.nom) + '</td>';
        html += '<td>' + Number(p.prix).toLocaleString('fr-FR') + ' DH</td>';
        html += '<td>' + p.capacite_clients + ' clients</td>';
        html += '<td>' + (actives.length > 0
            ? actives.length + ' travailleur(s)'
            : '<span style="color:var(--text-muted)">Aucun</span>') + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    bindAddProductBtn();
}

function bindAddProductBtn() {
    var btn = document.getElementById('btn-add-product');
    if (btn) btn.onclick = openAddProductModal;
}

function renderHistoryTable() {
    var wrap = document.getElementById('history-table-wrap');
    if (!wrap) return;

    var epuisees = rhState.assignments.filter(function(a) { return a.status === 'epuisee'; });

    if (epuisees.length === 0) {
        wrap.innerHTML = '<p class="rh-empty">Aucune bouteille épuisée.</p>';
        return;
    }

    var html = '<div class="ca-table-wrap"><table class="rh-table">';
    html += '<thead><tr><th>Travailleur</th><th>Produit</th><th>Clients réalisés</th><th>Assigné le</th><th>Épuisé le</th></tr></thead><tbody>';

    epuisees.forEach(function(a) {
        var wName = a.workers ? (a.workers.prenom + ' ' + a.workers.nom) : '—';
        var pName = a.products ? a.products.nom : '—';
        var assignedAt = a.assigned_at ? new Date(a.assigned_at).toLocaleDateString('fr-FR') : '—';
        var closedAt   = a.closed_at   ? new Date(a.closed_at).toLocaleDateString('fr-FR')   : '—';
        html += '<tr>';
        html += '<td>' + escapeHtml(wName) + '</td>';
        html += '<td>' + escapeHtml(pName) + '</td>';
        html += '<td>' + (a.clients_served || 0) + '</td>';
        html += '<td>' + assignedAt + '</td>';
        html += '<td>' + closedAt + '</td>';
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    wrap.innerHTML = html;
}

/* ══════════════════════════════════════════
   MODALS RH — UTILITAIRES
   ══════════════════════════════════════════ */

function openRhModal(title, bodyHtml) {
    document.getElementById('rh-modal-title').textContent = title;
    document.getElementById('rh-modal-body').innerHTML = bodyHtml;
    document.getElementById('rh-modal-overlay').classList.add('open');
}

function closeRhModal() {
    document.getElementById('rh-modal-overlay').classList.remove('open');
}

/* Binding fermeture modal RH */
document.addEventListener('DOMContentLoaded', function() {
    var rhOverlay = document.getElementById('rh-modal-overlay');
    var rhClose   = document.getElementById('rh-modal-close');
    if (rhClose)   rhClose.addEventListener('click', closeRhModal);
    if (rhOverlay) rhOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeRhModal();
    });
});

/* ══════════════════════════════════════════
   RH — AJOUTER TRAVAILLEUR
   ══════════════════════════════════════════ */

function openAddWorkerModal() {
    var html = '';
    html += '<div class="rh-form-group"><label for="rh-w-prenom">Prénom</label>';
    html += '<input type="text" class="form-input" id="rh-w-prenom" placeholder="Prénom"></div>';
    html += '<div class="rh-form-group"><label for="rh-w-nom">Nom</label>';
    html += '<input type="text" class="form-input" id="rh-w-nom" placeholder="Nom"></div>';
    html += '<div class="rh-form-group"><label for="rh-w-dept">Département</label>';
    html += '<select class="form-input" id="rh-w-dept">';
    html += '<option value="Coiffure femme">Coiffure femme</option>';
    html += '<option value="Coiffure homme">Coiffure homme</option>';
    html += '<option value="Onglerie">Onglerie</option>';
    html += '<option value="Esthétique">Esthétique</option>';
    html += '<option value="Maquillage">Maquillage</option>';
    html += '<option value="Autre">Autre</option>';
    html += '</select></div>';
    html += '<p class="rh-modal-error" id="rh-w-error"></p>';
    html += '<div class="rh-modal-actions">';
    html += '<button class="btn-rh-cancel" onclick="closeRhModal()">Annuler</button>';
    html += '<button class="btn-rh-submit" id="btn-rh-w-submit">Enregistrer</button></div>';

    openRhModal('Ajouter un travailleur', html);
    document.getElementById('btn-rh-w-submit').addEventListener('click', addWorker);
}

function addWorker() {
    var prenom = document.getElementById('rh-w-prenom').value.trim();
    var nom    = document.getElementById('rh-w-nom').value.trim();
    var dept   = document.getElementById('rh-w-dept').value;
    var errEl  = document.getElementById('rh-w-error');

    if (!prenom || !nom) {
        errEl.textContent = 'Prénom et nom sont obligatoires.';
        return;
    }

    var btn = document.getElementById('btn-rh-w-submit');
    btn.disabled = true; btn.textContent = '...';

    _supabase.from('workers').insert({ nom: nom, prenom: prenom, departement: dept })
        .then(function(res) {
            if (res.error) {
                errEl.textContent = 'Erreur: ' + res.error.message;
                btn.disabled = false; btn.textContent = 'Enregistrer';
                return;
            }
            closeRhModal();
            loadRH();
        })
        .catch(function(err) {
            console.error('addWorker error:', err);
            btn.disabled = false; btn.textContent = 'Enregistrer';
        });
}

/* ══════════════════════════════════════════
   RH — AJOUTER PRODUIT
   ══════════════════════════════════════════ */

function openAddProductModal() {
    var html = '';
    html += '<div class="rh-form-group"><label for="rh-p-nom">Nom du produit</label>';
    html += '<input type="text" class="form-input" id="rh-p-nom" placeholder="Ex: Protéine lissante"></div>';
    html += '<div class="rh-form-group"><label for="rh-p-prix">Prix (DH)</label>';
    html += '<input type="number" class="form-input" id="rh-p-prix" placeholder="120" min="1" step="0.01"></div>';
    html += '<div class="rh-form-group"><label for="rh-p-cap">Capacité approx. (nb clients par unité)</label>';
    html += '<input type="number" class="form-input" id="rh-p-cap" placeholder="6" min="1"></div>';
    html += '<p class="rh-modal-error" id="rh-p-error"></p>';
    html += '<div class="rh-modal-actions">';
    html += '<button class="btn-rh-cancel" onclick="closeRhModal()">Annuler</button>';
    html += '<button class="btn-rh-submit" id="btn-rh-p-submit">Enregistrer</button></div>';

    openRhModal('Ajouter un produit', html);
    document.getElementById('btn-rh-p-submit').addEventListener('click', addProduct);
}

function addProduct() {
    var nom   = document.getElementById('rh-p-nom').value.trim();
    var prix  = parseFloat(document.getElementById('rh-p-prix').value);
    var cap   = parseInt(document.getElementById('rh-p-cap').value);
    var errEl = document.getElementById('rh-p-error');

    if (!nom || !prix || prix <= 0 || !cap || cap <= 0) {
        errEl.textContent = 'Tous les champs sont obligatoires et doivent être valides.';
        return;
    }

    var btn = document.getElementById('btn-rh-p-submit');
    btn.disabled = true; btn.textContent = '...';

    _supabase.from('products').insert({ nom: nom, prix: prix, capacite_clients: cap })
        .then(function(res) {
            if (res.error) {
                errEl.textContent = 'Erreur: ' + res.error.message;
                btn.disabled = false; btn.textContent = 'Enregistrer';
                return;
            }
            closeRhModal();
            loadRH();
        })
        .catch(function(err) {
            console.error('addProduct error:', err);
            btn.disabled = false; btn.textContent = 'Enregistrer';
        });
}

/* ══════════════════════════════════════════
   RH — ASSIGNER PRODUIT
   ══════════════════════════════════════════ */

function openAssignProductModal(workerId) {
    var worker = rhState.workers.find(function(w) { return w.id === workerId; });
    if (!worker) return;

    if (rhState.products.length === 0) {
        alert('Ajoutez d\'abord un produit avant d\'assigner.');
        return;
    }

    var options = rhState.products.map(function(p) {
        return '<option value="' + p.id + '">' + escapeHtml(p.nom) + ' — ' + p.capacite_clients + ' clients — ' + Number(p.prix).toLocaleString('fr-FR') + ' DH</option>';
    }).join('');

    var html = '';
    html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem">Travailleur : <strong style="color:var(--text-light)">' + escapeHtml(worker.prenom) + ' ' + escapeHtml(worker.nom) + '</strong></p>';
    html += '<div class="rh-form-group"><label for="rh-a-product">Produit à assigner</label>';
    html += '<select class="form-input" id="rh-a-product">' + options + '</select></div>';
    html += '<p class="rh-modal-error" id="rh-a-error"></p>';
    html += '<div class="rh-modal-actions">';
    html += '<button class="btn-rh-cancel" onclick="closeRhModal()">Annuler</button>';
    html += '<button class="btn-rh-submit" id="btn-rh-a-submit">Assigner</button></div>';

    openRhModal('Assigner un produit', html);
    document.getElementById('btn-rh-a-submit').addEventListener('click', function() {
        assignProduct(workerId);
    });
}

function assignProduct(workerId) {
    var productId = document.getElementById('rh-a-product').value;
    var errEl     = document.getElementById('rh-a-error');

    if (!productId) {
        errEl.textContent = 'Sélectionnez un produit.';
        return;
    }

    var btn = document.getElementById('btn-rh-a-submit');
    btn.disabled = true; btn.textContent = '...';

    _supabase.from('assignments').insert({
        worker_id: workerId,
        product_id: productId,
        clients_served: 0,
        status: 'active'
    }).then(function(res) {
        if (res.error) {
            errEl.textContent = 'Erreur: ' + res.error.message;
            btn.disabled = false; btn.textContent = 'Assigner';
            return;
        }
        closeRhModal();
        loadRH();
    }).catch(function(err) {
        console.error('assignProduct error:', err);
        btn.disabled = false; btn.textContent = 'Assigner';
    });
}

/* ══════════════════════════════════════════
   RH — SAISIE CONSOMMATION
   ══════════════════════════════════════════ */

function openAddConsumptionModal(assignmentId) {
    var assignment = rhState.assignments.find(function(a) { return a.id === assignmentId; });
    if (!assignment) return;

    var wName   = assignment.workers ? (assignment.workers.prenom + ' ' + assignment.workers.nom) : '—';
    var pName   = assignment.products ? assignment.products.nom : '—';
    var cap     = assignment.products ? assignment.products.capacite_clients : 0;
    var served  = assignment.clients_served || 0;
    var restant = cap - served;

    var html = '';
    html += '<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem">';
    html += escapeHtml(wName) + ' — <strong style="color:var(--text-light)">' + escapeHtml(pName) + '</strong><br>';
    html += 'Clients restants : <strong style="color:var(--text-light)">' + restant + ' / ' + cap + '</strong></p>';
    html += '<div class="rh-form-group"><label for="rh-c-count">Nombre de clients servis à ajouter</label>';
    html += '<input type="number" class="form-input" id="rh-c-count" placeholder="1" min="1" max="' + restant + '"></div>';
    html += '<p class="rh-modal-error" id="rh-c-error"></p>';
    html += '<div class="rh-modal-actions">';
    html += '<button class="btn-rh-cancel" onclick="closeRhModal()">Annuler</button>';
    html += '<button class="btn-rh-submit" id="btn-rh-c-submit">Valider</button></div>';

    openRhModal('Saisie manuelle — Clients servis', html);
    document.getElementById('btn-rh-c-submit').addEventListener('click', function() {
        addConsumption(assignmentId, 'manuel', null);
    });
}

function addConsumption(assignmentId, source, rdvId) {
    var countEl = document.getElementById('rh-c-count');
    var count   = parseInt(countEl ? countEl.value : '1');
    var errEl   = document.getElementById('rh-c-error');

    if (!count || count <= 0) {
        if (errEl) errEl.textContent = 'Entrez un nombre valide.';
        return;
    }

    var btn = document.getElementById('btn-rh-c-submit');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    var assignment = rhState.assignments.find(function(a) { return a.id === assignmentId; });
    if (!assignment) return;

    var newServed = (assignment.clients_served || 0) + count;
    var cap       = assignment.products ? assignment.products.capacite_clients : 0;
    var isEpuisee = newServed >= cap;

    var updateData = { clients_served: newServed };
    if (isEpuisee) {
        updateData.status    = 'epuisee';
        updateData.closed_at = new Date().toISOString();
    }

    _supabase.from('assignments').update(updateData).eq('id', assignmentId)
        .then(function(res) {
            if (res.error) {
                if (errEl) errEl.textContent = 'Erreur: ' + res.error.message;
                if (btn) { btn.disabled = false; btn.textContent = 'Valider'; }
                return;
            }
            var logEntry = { assignment_id: assignmentId, clients_count: count, source: source || 'manuel' };
            if (rdvId) logEntry.rdv_id = rdvId;

            _supabase.from('consumption_logs').insert(logEntry).then(function() {
                if (source !== 'auto') closeRhModal();
                loadRH();
            }).catch(function(err) {
                console.error('consumption_logs insert error:', err);
            });
        })
        .catch(function(err) {
            console.error('addConsumption error:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'Valider'; }
        });
}

/* ══════════════════════════════════════════
   RH — AUTO-CONSOMMATION VIA RDV
   ══════════════════════════════════════════ */

function triggerAutoConsumption(rdvId) {
    _supabase.from('reservations').select('*').eq('id', rdvId).single()
        .then(function(res) {
            if (res.error || !res.data) return;
            var rdv = res.data;

            /* Déterminer le(s) département(s) du RDV à partir des services */
            var services = rdv.services || [];
            var departments = [];
            services.forEach(function(svc) {
                var prefix = (svc.id || '').substring(0, 2);
                if (prefix === 'c-') departments.push('Coiffure femme', 'Coiffure homme');
                if (prefix === 'o-') departments.push('Onglerie');
                if (prefix === 'e-') departments.push('Esthétique');
                if (prefix === 'm-') departments.push('Maquillage');
            });

            if (departments.length === 0 || rhState.assignments.length === 0) return;

            /* Chercher les assignments actifs dont le département du travailleur correspond */
            var actives = rhState.assignments.filter(function(a) {
                return a.status === 'active' && a.workers && departments.indexOf(a.workers.departement) !== -1;
            });

            actives.forEach(function(a) {
                autoIncrementAssignment(a.id, rdvId);
            });
        })
        .catch(function(err) {
            console.error('triggerAutoConsumption error:', err);
        });
}

function autoIncrementAssignment(assignmentId, rdvId) {
    var assignment = rhState.assignments.find(function(a) { return a.id === assignmentId; });
    if (!assignment) return;

    var newServed = (assignment.clients_served || 0) + 1;
    var cap       = assignment.products ? assignment.products.capacite_clients : 0;
    var isEpuisee = newServed >= cap;

    var updateData = { clients_served: newServed };
    if (isEpuisee) {
        updateData.status    = 'epuisee';
        updateData.closed_at = new Date().toISOString();
    }

    _supabase.from('assignments').update(updateData).eq('id', assignmentId)
        .then(function(res) {
            if (res.error) { console.error('autoIncrementAssignment error:', res.error); return; }
            _supabase.from('consumption_logs').insert({
                assignment_id: assignmentId,
                clients_count: 1,
                source: 'auto',
                rdv_id: rdvId
            }).then(function() {
                loadRH();
            }).catch(function(err) {
                console.error('auto consumption_logs insert error:', err);
            });
        })
        .catch(function(err) {
            console.error('autoIncrementAssignment fetch error:', err);
        });
}

/* ══════════════════════════════════════════
   COMPTA PENDING
   ══════════════════════════════════════════ */

function loadComptaPending() {
    _supabase
        .from('reservations')
        .select('id, client_name, date, time, status, services')
        .eq('needs_compta', true)
        .order('date', { ascending: true })
        .then(function(res) {
            renderComptaPendingBanner(res.data || []);
        })
        .catch(function(err) {
            console.error('loadComptaPending error:', err);
            renderComptaPendingBanner([]);
        });
}

function renderComptaPendingBanner(rdvs) {
    var banner = document.getElementById('compta-pending-banner');
    var list   = document.getElementById('compta-pending-list');
    var badge  = document.getElementById('compta-alert-badge');

    if (!banner || !list) return;

    if (rdvs.length === 0) {
        banner.style.display = 'none';
        if (badge) badge.style.display = 'none';
        return;
    }

    banner.style.display = '';
    if (badge) {
        badge.style.display = 'inline-flex';
        badge.textContent = rdvs.length;
    }

    var monthNames = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];

    var html = '';
    rdvs.forEach(function(rdv) {
        var isUrgent = rdv.status === 'completed';
        var dateObj  = new Date(rdv.date + 'T00:00:00');
        var dateLabel = dateObj.getDate() + ' ' + monthNames[dateObj.getMonth()] + ' ' + dateObj.getFullYear();

        var svcNames = '';
        if (rdv.services && Array.isArray(rdv.services)) {
            svcNames = rdv.services
                .filter(function(s) { return s.id === 'm-mariee' || s.id === 'm-fiancee'; })
                .map(function(s) { return s.name; })
                .join(', ');
        }

        var urgentLabel = isUrgent ? ' — <strong>Service terminé</strong>' : '';

        html += '<div class="compta-pending-item' + (isUrgent ? ' urgent' : '') + '">';
        html += '<div class="compta-pending-info">';
        html += '<span class="compta-pending-name">' + escapeHtml(rdv.client_name) + ' — ' + escapeHtml(svcNames) + '</span>';
        html += '<span class="compta-pending-meta">' + dateLabel + ' à ' + (rdv.time || '') + urgentLabel + '</span>';
        html += '</div>';
        html += '<button class="btn-compta-add"'
            + ' data-rdv-id="' + escapeHtml(String(rdv.id)) + '"'
            + ' data-client="' + escapeHtml(rdv.client_name) + '"'
            + ' data-svcs="' + escapeHtml(svcNames) + '"'
            + ' data-date="' + escapeHtml(rdv.date) + '">';
        html += 'Ajouter à la compta';
        html += '</button>';
        html += '</div>';
    });

    list.innerHTML = html;
    list.querySelectorAll('.btn-compta-add').forEach(function(btn) {
        btn.addEventListener('click', function() {
            openComptaModal(this.dataset.rdvId, this.dataset.client, this.dataset.svcs, this.dataset.date);
        });
    });
}

function openComptaModal(rdvId, clientName, svcNames, date) {
    var bodyHtml =
        '<div class="rh-form-group">' +
        '<label>Client</label>' +
        '<input type="text" class="rh-form-input" id="cm-p-client" value="' + escapeHtml(clientName) + '" readonly>' +
        '</div>' +
        '<div class="rh-form-group">' +
        '<label>Service</label>' +
        '<input type="text" class="rh-form-input" id="cm-p-svc" value="' + escapeHtml(svcNames) + '" readonly>' +
        '</div>' +
        '<div class="rh-form-group">' +
        '<label>Montant (DH)</label>' +
        '<input type="number" class="rh-form-input" id="cm-p-montant" placeholder="Montant en DH" min="1">' +
        '</div>' +
        '<div class="rh-modal-error" id="cm-p-error"></div>' +
        '<div style="display:flex;gap:10px;margin-top:8px;">' +
        '<button class="btn-rh-cancel" onclick="closeRhModal()">Annuler</button>' +
        '<button class="btn-rh-submit" onclick="saveComptaPending(\'' + rdvId + '\',\'' + escapeHtml(clientName) + '\',\'' + escapeHtml(svcNames) + '\',\'' + date + '\')">Enregistrer</button>' +
        '</div>';

    openRhModal('Ajouter à la compta', bodyHtml);
}

function saveComptaPending(rdvId, clientName, svcNames, date) {
    var montantEl = document.getElementById('cm-p-montant');
    var errEl     = document.getElementById('cm-p-error');
    var montant   = parseInt(montantEl ? montantEl.value : '0');

    if (!montant || montant <= 0) {
        if (errEl) errEl.textContent = 'Veuillez entrer un montant valide.';
        return;
    }

    var note = clientName + ' — ' + svcNames;

    _supabase.from('ca_manuel')
        .insert({ date: date, categorie: 'Maquillage', montant: montant, note: note })
        .then(function(res) {
            if (res.error) {
                if (errEl) errEl.textContent = 'Erreur: ' + res.error.message;
                return;
            }
            _supabase.from('reservations')
                .update({ needs_compta: false })
                .eq('id', rdvId)
                .then(function() {
                    closeRhModal();
                    loadComptaPending();
                    loadAnalytics();
                    loadCaManuel();
                })
                .catch(function(err) {
                    console.error('saveComptaPending update error:', err);
                    closeRhModal();
                    loadComptaPending();
                });
        })
        .catch(function(err) {
            console.error('saveComptaPending insert error:', err);
            if (errEl) errEl.textContent = 'Erreur de connexion.';
        });
}
