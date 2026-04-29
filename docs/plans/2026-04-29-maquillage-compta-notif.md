# Maquillage Prix Sur Place + Notif Compta — Plan d'implémentation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ajouter mariée et fiancée au catalogue de réservation (sans afficher de prix), et notifier l'admin dans le dashboard de les ajouter manuellement à la compta.

**Architecture:** Flag `needs_compta` sur la table `reservations`. Le bandeau `#compta-pending-banner` dans l'onglet Analytique affiche les RDVs en attente. Le bouton "Ajouter à la compta" ouvre un modal pré-rempli qui insère dans `ca_manuel` puis met `needs_compta = false`.

**Tech Stack:** Vanilla JS (`var`, named functions), Supabase JS SDK v2 (`_supabase`), HTML/CSS inline. Pas de `let`/`const`/arrow functions.

---

### Task 1 : Supabase — Ajouter colonne `needs_compta`

**Files:**
- Supabase SQL Editor (manuel)

**Step 1 : Exécuter le SQL dans Supabase**

Dans Supabase → SQL Editor → New Query :

```sql
ALTER TABLE reservations
ADD COLUMN needs_compta BOOLEAN DEFAULT FALSE;
```

Cliquer "Run". Vérifier que la colonne apparaît dans Table Editor > reservations.

**Step 2 : Vérifier**

Dans Table Editor, colonne `needs_compta` visible avec default = false.

---

### Task 2 : reservation.js — Ajouter mariée et fiancée au catalogue

**Files:**
- Modify: `reservation.js:201-204` (sous-catégorie Maquillage)
- Modify: `reservation.js:333` (rendu du prix dans svc-row)
- Modify: `reservation.js:531-534` (getTotal)
- Modify: `reservation.js:591-602` (payload Supabase insert)

**Step 1 : Ajouter les deux services dans SERVICES**

Dans `reservation.js`, ligne 203, remplacer :
```js
                    { id: 'm-invitee', name: 'Maquillage invitée', price: 300 }
```
par :
```js
                    { id: 'm-invitee',  name: 'Maquillage invitée',  price: 300 },
                    { id: 'm-mariee',   name: 'Maquillage mariée',   price: null, prixSurPlace: true },
                    { id: 'm-fiancee',  name: 'Maquillage fiancée',  price: null, prixSurPlace: true }
```

**Step 2 : Masquer le prix pour les services prixSurPlace**

Dans `reservation.js`, ligne 333, remplacer :
```js
                html += '<span class="svc-price">' + svc.price + ' DH</span>';
```
par :
```js
                if (!svc.prixSurPlace) {
                    html += '<span class="svc-price">' + svc.price + ' DH</span>';
                }
```

**Step 3 : Exclure les prix null du total**

Dans `reservation.js`, ligne 533, remplacer :
```js
        if (SERVICE_MAP[id]) total += SERVICE_MAP[id].price;
```
par :
```js
        if (SERVICE_MAP[id] && SERVICE_MAP[id].price) total += SERVICE_MAP[id].price;
```

**Step 4 : Ajouter `needs_compta` dans le payload Supabase**

Dans `reservation.js`, chercher le bloc `var payload = {` (≈ ligne 591). Ajouter `needs_compta` avant la fermeture `}` du payload :

```js
        var hasPrixSurPlace = services.some(function(s) { return s.prixSurPlace; });
        var payload = {
            client_name: state.name,
            client_phone: state.phone,
            note: state.note || null,
            services: services.map(function(s) { return { id: s.id, name: s.name }; }),
            date: state.date.dateStr,
            time: state.time,
            total: 0,
            advance: 0,
            status: 'confirmed',
            advance_paid: false,
            needs_compta: hasPrixSurPlace
        };
```

Note: `getSelectedServices()` retourne les objets service complets avec leur flag `prixSurPlace`. Vérifier que `getSelectedServices` retourne bien les objets depuis SERVICE_MAP (si elle retourne seulement `{id, name}`, adapter `hasPrixSurPlace` pour tester les IDs `'m-mariee'` et `'m-fiancee'` directement).

**Step 5 : Commit**

```bash
git add reservation.js
git commit -m "feat: ajouter maquillage mariée/fiancée (prixSurPlace) au catalogue"
```

---

### Task 3 : admin.html — Bandeau compta-pending

**Files:**
- Modify: `admin.html:121` (dans `#tab-analytics`, avant les stat-cards)

**Step 1 : Insérer le bandeau HTML**

Dans `admin.html`, après la ligne `<div class="tab-content active" id="tab-analytics">` (ligne 121), insérer :

```html
            <!-- BANDEAU COMPTA EN ATTENTE -->
            <div class="compta-pending-banner" id="compta-pending-banner" style="display:none">
                <div class="compta-pending-header">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Prestations à prix libre — à ajouter à la compta</span>
                </div>
                <div class="compta-pending-list" id="compta-pending-list"></div>
            </div>
```

**Step 2 : Ajouter badge sur l'onglet Analytique**

Dans `admin.html`, ligne 107, remplacer :
```html
            <button class="tab-btn active" data-tab="analytics">
                <i class="fas fa-chart-bar"></i> Analytique
            </button>
```
par :
```html
            <button class="tab-btn active" data-tab="analytics" id="tab-btn-analytics">
                <i class="fas fa-chart-bar"></i> Analytique
                <span class="compta-alert-badge" id="compta-alert-badge" style="display:none">0</span>
            </button>
```

**Step 3 : Commit**

```bash
git add admin.html
git commit -m "feat: ajouter bandeau compta-pending dans tab analytics"
```

---

### Task 4 : admin.css — Styles bandeau + badge

**Files:**
- Modify: `admin.css` (ajouter à la fin)

**Step 1 : Ajouter les styles**

Ajouter à la fin de `admin.css` :

```css
/* ── COMPTA PENDING BANNER ── */
.compta-pending-banner {
    background: linear-gradient(135deg, rgba(196,144,45,0.12), rgba(196,144,45,0.06));
    border: 1px solid var(--gold);
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 18px;
}

.compta-pending-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--gold);
    margin-bottom: 10px;
}

.compta-pending-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--noir-card);
    border-radius: 7px;
    margin-bottom: 6px;
    font-size: 0.87rem;
    gap: 10px;
}

.compta-pending-item:last-child { margin-bottom: 0; }

.compta-pending-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
}

.compta-pending-name {
    font-weight: 500;
    color: var(--cream);
}

.compta-pending-meta {
    font-size: 0.78rem;
    color: var(--text-muted);
}

.compta-pending-item.urgent .compta-pending-name {
    color: #c0392b;
}

.btn-compta-add {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: var(--gold);
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 6px 12px;
    cursor: pointer;
    white-space: nowrap;
    transition: opacity 0.2s;
}

.btn-compta-add:hover { opacity: 0.85; }

/* Badge sur onglet Analytique */
.compta-alert-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #c0392b;
    color: #fff;
    border-radius: 50%;
    font-size: 0.65rem;
    font-weight: 700;
    width: 16px;
    height: 16px;
    margin-left: 4px;
    line-height: 1;
}
```

**Step 2 : Commit**

```bash
git add admin.css
git commit -m "feat: styles bandeau compta-pending et badge"
```

---

### Task 5 : admin.js — `loadComptaPending` + `renderComptaPendingBanner`

**Files:**
- Modify: `admin.js` (ajouter nouvelles fonctions après `loadRH`)
- Modify: `admin.js:102` (appel dans `showDashboard`)

**Step 1 : Ajouter `loadComptaPending` et `renderComptaPendingBanner`**

Ajouter ces fonctions à la fin de `admin.js` (avant la dernière ligne) :

```javascript
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
        html += '<button class="btn-compta-add" onclick="openComptaModal(\'' + rdv.id + '\',\'' + escapeHtml(rdv.client_name) + '\',\'' + escapeHtml(svcNames) + '\',\'' + rdv.date + '\')">';
        html += 'Ajouter à la compta';
        html += '</button>';
        html += '</div>';
    });

    list.innerHTML = html;
}
```

**Step 2 : Appeler `loadComptaPending` dans `showDashboard`**

Dans `admin.js`, ligne 104, après `loadRH();` :
```javascript
    loadRH();
    loadComptaPending();
```

**Step 3 : Commit**

```bash
git add admin.js
git commit -m "feat: loadComptaPending + renderComptaPendingBanner"
```

---

### Task 6 : admin.js — `openComptaModal` + sauvegarde

**Files:**
- Modify: `admin.js` (ajouter après `renderComptaPendingBanner`)

**Step 1 : Ajouter `openComptaModal` et `saveComptaPending`**

```javascript
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

    var note = escapeHtml(clientName) + ' — ' + escapeHtml(svcNames);

    _supabase.from('ca_manuel')
        .insert({ date: date, categorie: 'Maquillage', montant: montant, note: note })
        .then(function(res) {
            if (res.error) {
                if (errEl) errEl.textContent = 'Erreur: ' + res.error.message;
                return;
            }
            /* Marquer needs_compta = false sur le RDV */
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
```

**Step 2 : Appeler `loadComptaPending` dans `updateRdvStatus`**

Dans `admin.js`, la fonction `updateRdvStatus` (ligne 558), après `loadCalendarData();` et `loadAnalytics();` :

```javascript
        loadCalendarData();
        loadAnalytics();
        loadComptaPending();

        if (newStatus === 'completed') {
            triggerAutoConsumption(id);
        }
```

**Step 3 : Commit**

```bash
git add admin.js
git commit -m "feat: openComptaModal + saveComptaPending — résout needs_compta automatiquement"
```

---

### Task 7 : Vérification manuelle end-to-end

**Checklist :**

1. Ouvrir `reservation.html` → catégorie Maquillage → sous-catégorie Maquillage
   - Mariée et Fiancée s'affichent ✓
   - Aucun prix affiché sur leurs cartes ✓
   - Invitée affiche "300 DH" ✓

2. Réserver avec Maquillage mariée (nom test, téléphone test)
   - Dans Supabase → Table reservations → ligne créée avec `needs_compta = true` ✓

3. Ouvrir `admin.html` → login
   - Bandeau jaune visible dans l'onglet Analytique ✓
   - Badge rouge sur le bouton "Analytique" ✓

4. Cliquer "Ajouter à la compta" → modal s'ouvre, client et service pré-remplis ✓

5. Saisir un montant → Enregistrer
   - Entrée dans ca_manuel créée ✓
   - `needs_compta = false` sur le RDV ✓
   - Bandeau se ferme / ligne disparaît ✓

6. Passer un RDV avec mariée/fiancée à "Terminé" dans le calendrier
   - Le bandeau affiche ce RDV avec style urgent (rouge) ✓

---

### Task 8 : Push final

```bash
git push origin main
```

---

## Notes importantes

- `escapeHtml` est déjà définie dans `admin.js` — l'utiliser pour toutes les interpolations de strings dans l'HTML inline.
- Le modal réutilise `openRhModal` / `closeRhModal` déjà présents — pas de nouveau overlay HTML.
- La colonne `needs_compta` est en `DEFAULT FALSE` donc les anciennes réservations ne sont pas affectées.
- `getSelectedServices()` dans `reservation.js` doit retourner les objets complets depuis `SERVICE_MAP` pour que `prixSurPlace` soit accessible. Vérifier et adapter si nécessaire.
