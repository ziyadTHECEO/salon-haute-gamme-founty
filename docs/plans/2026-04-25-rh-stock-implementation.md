# Module RH & Stock — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter un 3ème onglet "RH & Stock" dans l'admin du salon pour gérer les travailleurs, les produits consommables et leur suivi de consommation avec alertes colorées.

**Architecture:** Vanilla JS + Supabase. 4 nouvelles tables SQL. Onglet intégré dans la navigation admin existante. Badge rouge + bandeau d'alertes calculés à partir du taux de consommation (seuil 30% restant = alerte).

**Tech Stack:** HTML/CSS/JS vanilla, Supabase JS SDK v2, variables CSS existantes du projet (--gold, --noir-card, --text-light, etc.).

---

## Task 1: Créer les 4 tables Supabase

**Files:** (action dans Supabase dashboard — pas de fichier local)

**Step 1: Ouvrir Supabase SQL Editor**

Aller dans le projet Supabase → SQL Editor → New query. Coller et exécuter :

```sql
-- Workers
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  departement text not null,
  created_at timestamptz default now()
);

-- Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prix numeric(10,2) not null,
  capacite_clients integer not null,
  created_at timestamptz default now()
);

-- Assignments (une bouteille par worker+product)
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  clients_served integer default 0,
  status text default 'active',
  assigned_at timestamptz default now(),
  closed_at timestamptz
);

-- Consumption logs
create table if not exists consumption_logs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) on delete cascade,
  clients_count integer not null,
  source text not null,
  rdv_id uuid,
  created_at timestamptz default now()
);

-- RLS
alter table workers enable row level security;
alter table products enable row level security;
alter table assignments enable row level security;
alter table consumption_logs enable row level security;

create policy "auth_all_workers" on workers for all to authenticated using (true) with check (true);
create policy "auth_all_products" on products for all to authenticated using (true) with check (true);
create policy "auth_all_assignments" on assignments for all to authenticated using (true) with check (true);
create policy "auth_all_logs" on consumption_logs for all to authenticated using (true) with check (true);
```

**Step 2: Vérifier**

Dans Supabase → Table Editor : les 4 tables `workers`, `products`, `assignments`, `consumption_logs` existent.

**Step 3: Commit**
```bash
git commit --allow-empty -m "feat: create Supabase tables workers/products/assignments/consumption_logs"
```

---

## Task 2: HTML — Onglet nav "RH & Stock" avec badge

**Files:**
- Modify: `admin.html:105-113`

**Step 1: Remplacer le bloc tab-nav**

Dans `admin.html`, remplacer :
```html
<div class="tab-nav">
    <button class="tab-btn active" data-tab="analytics">
        <i class="fas fa-chart-bar"></i> Analytique
    </button>
    <button class="tab-btn" data-tab="calendar">
        <i class="fas fa-calendar-alt"></i> Calendrier
    </button>
</div>
```
Par :
```html
<div class="tab-nav">
    <button class="tab-btn active" data-tab="analytics">
        <i class="fas fa-chart-bar"></i> Analytique
    </button>
    <button class="tab-btn" data-tab="calendar">
        <i class="fas fa-calendar-alt"></i> Calendrier
    </button>
    <button class="tab-btn" data-tab="rh" id="tab-btn-rh">
        <i class="fas fa-users"></i> RH &amp; Stock
        <span class="rh-alert-badge" id="rh-alert-badge" style="display:none">0</span>
    </button>
</div>
```

**Step 2: Vérifier visuellement**

Ouvrir `admin.html` dans le navigateur → le 3ème onglet apparaît dans la nav.

**Step 3: Commit**
```bash
git add admin.html
git commit -m "feat: add RH & Stock tab to admin nav with alert badge"
```

---

## Task 3: HTML — Contenu du tab RH & Stock

**Files:**
- Modify: `admin.html` — ajouter après la div fermante de `#tab-calendar` (ligne ~219), avant la fermeture `</div>` du dashboard

**Step 1: Ajouter le tab-content RH**

Après `</div><!-- fin tab-calendar -->` et avant `</div><!-- fin dashboard -->`, insérer :

```html
<!-- ════════════════════════════════
     TAB 3 — RH & STOCK
     ════════════════════════════════ -->
<div class="tab-content" id="tab-rh">

    <!-- BANDEAU ALERTES -->
    <div class="rh-alert-banner" id="rh-alert-banner" style="display:none">
        <div class="rh-alert-banner-inner" id="rh-alert-banner-inner"></div>
    </div>

    <!-- SECTION TRAVAILLEURS -->
    <div class="rh-section">
        <div class="rh-section-header">
            <h3 class="rh-section-title">TRAVAILLEURS</h3>
            <button class="btn-rh-add" id="btn-add-worker">
                <i class="fas fa-plus"></i> Ajouter
            </button>
        </div>
        <div id="workers-table-wrap">
            <p class="rh-empty">Chargement...</p>
        </div>
    </div>

    <!-- SECTION PRODUITS -->
    <div class="rh-section">
        <div class="rh-section-header">
            <h3 class="rh-section-title">PRODUITS CONSOMMABLES</h3>
            <button class="btn-rh-add" id="btn-add-product">
                <i class="fas fa-plus"></i> Ajouter
            </button>
        </div>
        <div id="products-table-wrap">
            <p class="rh-empty">Chargement...</p>
        </div>
    </div>

    <!-- SECTION HISTORIQUE -->
    <div class="rh-section">
        <div class="rh-section-header">
            <h3 class="rh-section-title">HISTORIQUE — BOUTEILLES ÉPUISÉES</h3>
        </div>
        <div id="history-table-wrap">
            <p class="rh-empty">Aucune bouteille épuisée.</p>
        </div>
    </div>

</div>
```

**Step 2: Commit**
```bash
git add admin.html
git commit -m "feat: add RH tab content with workers/products/history sections"
```

---

## Task 4: HTML — Modal overlay RH

**Files:**
- Modify: `admin.html` — ajouter juste avant `</body>`, après le `<!-- MODAL RDV -->`

**Step 1: Ajouter le système de modals RH**

```html
<!-- ════════════════════════════════════
     MODALS RH
     ════════════════════════════════════ -->
<div class="rh-modal-overlay" id="rh-modal-overlay">
    <div class="rh-modal-card" id="rh-modal-card">
        <button class="modal-close" id="rh-modal-close">&times;</button>
        <div class="rh-modal-title" id="rh-modal-title"></div>
        <div class="rh-modal-body" id="rh-modal-body"></div>
    </div>
</div>
```

**Step 2: Commit**
```bash
git add admin.html
git commit -m "feat: add RH modal overlay to admin.html"
```

---

## Task 5: CSS — Tous les styles RH & Stock

**Files:**
- Modify: `admin.css` — ajouter à la fin du fichier

**Step 1: Ajouter les styles**

```css
/* ══════════════════════════════════════
   RH & STOCK — BADGE ONGLET
   ══════════════════════════════════════ */

.rh-alert-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #c0392b;
    color: #fff;
    font-size: 0.6rem;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 999px;
    padding: 0 4px;
    margin-left: 6px;
    vertical-align: middle;
    letter-spacing: 0;
}

/* ══════════════════════════════════════
   RH — BANDEAU ALERTES
   ══════════════════════════════════════ */

.rh-alert-banner {
    margin: 1.5rem 1.5rem 0;
    background: rgba(192, 57, 43, 0.08);
    border: 1px solid rgba(192, 57, 43, 0.25);
    border-radius: 4px;
    padding: 1rem 1.2rem;
}

.rh-alert-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    font-weight: 500;
    padding: 0.3rem 0;
    color: #c0392b;
}

.rh-alert-item.critical {
    color: #7b1818;
    font-weight: 700;
}

.rh-alert-item i { width: 16px; text-align: center; }

/* ══════════════════════════════════════
   RH — SECTIONS
   ══════════════════════════════════════ */

.rh-section {
    margin: 1.5rem;
    background: var(--noir-card);
    border: 1px solid rgba(196,144,45,0.12);
    padding: 1.5rem;
}

.rh-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
}

.rh-section-title {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.btn-rh-add {
    background: var(--gold);
    color: #fff;
    border: none;
    padding: 0.45rem 1rem;
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn-rh-add:hover { opacity: 0.85; }

.rh-empty {
    font-size: 0.8rem;
    color: var(--text-muted);
    padding: 1rem 0;
}

/* ══════════════════════════════════════
   RH — TABLEAUX
   ══════════════════════════════════════ */

.rh-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
}

.rh-table th {
    text-align: left;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(196,144,45,0.12);
}

.rh-table td {
    padding: 0.7rem 0.75rem;
    border-bottom: 1px solid rgba(196,144,45,0.07);
    color: var(--text-light);
    vertical-align: top;
}

.rh-table tr:last-child td { border-bottom: none; }

/* Pillules état produit */
.stock-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
    margin: 0.15rem 0.15rem 0.15rem 0;
    white-space: nowrap;
}

.stock-pill.ok {
    background: rgba(39, 174, 96, 0.12);
    color: #1a7a44;
}

.stock-pill.low {
    background: rgba(192, 57, 43, 0.12);
    color: #c0392b;
}

.stock-pill.critical {
    background: rgba(123, 24, 24, 0.15);
    color: #7b1818;
    animation: blink-critical 1.4s ease-in-out infinite;
}

@keyframes blink-critical {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.5; }
}

.stock-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
}

/* Boutons actions inline */
.btn-rh-action {
    background: none;
    border: 1px solid rgba(196,144,45,0.3);
    color: var(--gold);
    padding: 0.3rem 0.7rem;
    font-family: var(--font-body);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    margin-right: 0.4rem;
    margin-bottom: 0.3rem;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn-rh-action:hover { background: var(--gold-dim); }

/* ══════════════════════════════════════
   RH — MODAL
   ══════════════════════════════════════ */

.rh-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(60, 38, 20, 0.55);
    z-index: 1000;
    display: none;
    align-items: center;
    justify-content: center;
}

.rh-modal-overlay.open { display: flex; }

.rh-modal-card {
    background: var(--noir-card);
    border: 1px solid rgba(196,144,45,0.15);
    padding: 2rem 2.2rem;
    width: 100%;
    max-width: 440px;
    position: relative;
}

.rh-modal-title {
    font-family: var(--font-heading);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--gold);
    margin-bottom: 1.5rem;
}

.rh-form-group { margin-bottom: 1.1rem; }

.rh-form-group label {
    display: block;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 0.4rem;
}

.rh-modal-actions {
    display: flex;
    gap: 0.8rem;
    justify-content: flex-end;
    margin-top: 1.5rem;
}

.btn-rh-cancel {
    background: none;
    border: 1px solid rgba(196,144,45,0.25);
    color: var(--text-muted);
    padding: 0.55rem 1.2rem;
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 500;
    cursor: pointer;
}

.btn-rh-submit {
    background: var(--gold);
    color: #fff;
    border: none;
    padding: 0.55rem 1.4rem;
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn-rh-submit:hover { opacity: 0.85; }
.btn-rh-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.rh-modal-error {
    font-size: 0.72rem;
    color: #c0392b;
    margin-top: 0.5rem;
    min-height: 1rem;
}
```

**Step 2: Vérifier**

Ouvrir l'admin → onglet RH & Stock → sections bien stylées.

**Step 3: Commit**
```bash
git add admin.css
git commit -m "feat: add RH & Stock CSS (badge, alerts, tables, pills, modal)"
```

---

## Task 6: JS — État global + loadRH() + bindTabEvents

**Files:**
- Modify: `admin.js` — fin du fichier + modification de `bindTabEvents` et `showDashboard`

**Step 1: Ajouter l'état global et loadRH() à la fin de admin.js**

```javascript
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
```

**Step 2: Modifier bindTabEvents() pour déclencher loadRH() sur clic onglet**

Dans la fonction `bindTabEvents()` existante, modifier :
```javascript
if (tab === 'calendar') {
    loadCalendarData();
}
```
En :
```javascript
if (tab === 'calendar') {
    loadCalendarData();
}
if (tab === 'rh') {
    loadRH();
}
```

**Step 3: Appeler loadRH() dans showDashboard()**

Dans `showDashboard()`, après `loadAnalytics();` et `initCalendar();` (dans le setTimeout), ajouter :
```javascript
loadRH();
```

**Step 4: Commit**
```bash
git add admin.js
git commit -m "feat: add rhState, loadRH(), wire tab click and showDashboard"
```

---

## Task 7: JS — Logique alertes (computeAlertState, badge, bandeau)

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter les 3 fonctions d'alerte**

```javascript
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
```

**Step 2: Commit**
```bash
git add admin.js
git commit -m "feat: add computeAlertState, updateAlertBadge, renderAlertBanner"
```

---

## Task 8: JS — renderWorkersTable()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter renderWorkersTable() et bindAddWorkerBtn()**

```javascript
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
```

**Step 2: Vérifier**

Onglet RH & Stock → section Travailleurs affiche "Aucun travailleur enregistré." (ou le tableau si des données existent).

**Step 3: Commit**
```bash
git add admin.js
git commit -m "feat: add renderWorkersTable with stock pills and action buttons"
```

---

## Task 9: JS — renderProductsTable() + renderHistoryTable()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter renderProductsTable()**

```javascript
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
```

**Step 2: Commit**
```bash
git add admin.js
git commit -m "feat: add renderProductsTable and renderHistoryTable"
```

---

## Task 10: JS — Utilitaires modal RH (open/close)

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter openRhModal, closeRhModal, et le binding de fermeture**

```javascript
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

/* Binding fermeture — ajouté au DOMContentLoaded existant via event supplémentaire */
document.addEventListener('DOMContentLoaded', function() {
    var rhOverlay = document.getElementById('rh-modal-overlay');
    var rhClose   = document.getElementById('rh-modal-close');
    if (rhClose)   rhClose.addEventListener('click', closeRhModal);
    if (rhOverlay) rhOverlay.addEventListener('click', function(e) {
        if (e.target === this) closeRhModal();
    });
});
```

**Step 2: Commit**
```bash
git add admin.js
git commit -m "feat: add RH modal open/close utilities"
```

---

## Task 11: JS — openAddWorkerModal() + addWorker()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter les fonctions**

```javascript
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
```

**Step 2: Vérifier**

Cliquer "+ Ajouter" section Travailleurs → remplir le formulaire → Enregistrer → travailleur apparaît dans le tableau.

**Step 3: Commit**
```bash
git add admin.js
git commit -m "feat: add openAddWorkerModal and addWorker CRUD"
```

---

## Task 12: JS — openAddProductModal() + addProduct()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter les fonctions**

```javascript
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
```

**Step 2: Commit**
```bash
git add admin.js
git commit -m "feat: add openAddProductModal and addProduct CRUD"
```

---

## Task 13: JS — openAssignProductModal() + assignProduct()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter les fonctions**

```javascript
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
```

**Step 2: Commit**
```bash
git add admin.js
git commit -m "feat: add openAssignProductModal and assignProduct CRUD"
```

---

## Task 14: JS — openAddConsumptionModal() + addConsumption()

**Files:**
- Modify: `admin.js` — ajouter à la fin

**Step 1: Ajouter les fonctions**

```javascript
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
            });
        })
        .catch(function(err) {
            console.error('addConsumption error:', err);
            if (btn) { btn.disabled = false; btn.textContent = 'Valider'; }
        });
}
```

**Step 2: Vérifier**

Cliquer "+ Clients (Protéine)" sur un travailleur → saisir 5 → Valider → pillule change de couleur, badge et bandeau se mettent à jour.

**Step 3: Commit**
```bash
git add admin.js
git commit -m "feat: add manual consumption modal and addConsumption function"
```

---

## Task 15: JS — Auto-consommation quand RDV devient "completed"

**Files:**
- Modify: `admin.js:554-570` (fonction `updateRdvStatus`)

**Step 1: Remplacer updateRdvStatus() dans admin.js**

Trouver et remplacer la fonction existante `updateRdvStatus` par :

```javascript
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

        if (newStatus === 'completed') {
            triggerAutoConsumption(id);
        }
    });
}
```

**Step 2: Ajouter triggerAutoConsumption() + autoIncrementAssignment() à la fin du fichier**

```javascript
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
            }).then(function() { loadRH(); });
        });
}
```

**Step 3: Vérifier**

Dans le calendrier, marquer un RDV comme "Terminé" → onglet RH & Stock → vérifier que les compteurs du département concerné s'incrémentent de 1.

**Step 4: Commit**
```bash
git add admin.js
git commit -m "feat: auto-consumption on RDV completed via triggerAutoConsumption"
```

---

## Task 16: Test manuel — scénario de bout en bout

**Aucun fichier à modifier — validation uniquement**

Suivre ce scénario dans le navigateur :

1. Se connecter → onglet "RH & Stock" → 3 sections vides, badge absent
2. Ajouter produit : "Protéine lissante", 120 DH, 6 clients → apparaît dans la table Produits
3. Ajouter travailleur : Prénom "Marie", Nom "Dupont", Coiffure femme → apparaît dans la table Travailleurs
4. "Assigner produit" sur Marie → choisir Protéine → Assigner → pillule **verte** "Protéine (6/6)"
5. "+ Clients (Protéine)" → saisir **5** → Valider → pillule **rouge** "Protéine (1/6)", badge "1" sur l'onglet, bandeau rouge "Attention — Marie Dupont — 1 cliente restante"
6. "+ Clients" → saisir **1** → pillule **critique clignotante** "Protéine — ÉPUISÉE", bandeau critique, historique rempli, badge toujours visible
7. Dans Calendrier → cliquer un RDV de type Coiffure → "Terminé" → onglet RH & Stock → si Marie avait un autre assignment actif, son compteur est incrémenté
8. Ajouter un 2ème travailleur et produit → vérifier que le badge compte bien les 2 alertes cumulées

**État attendu :** Tous les états fonctionnent, les alertes se mettent à jour sans rechargement de page.
